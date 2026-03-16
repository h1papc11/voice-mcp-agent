# Backend Refactor Plan

## Current State

2,856-line god file (`main.py`), ~500 lines of copy-pasted backend methods, 3x duplicated generation orchestration, dead modules, fake async, scattered constants. 72 routes all registered in one file. Works fine, but will fight us on every new feature.

---

## Phase 1: Dead Code & Low-Hanging Fruit

Remove noise so the real structure is easier to see.

- Delete `studio.py` (66 lines, every method raises `NotImplementedError`, never imported)
- Delete `migrate_add_instruct.py` (48 lines, superseded by `database.py` migrations)
- Delete `utils/validation.py` (66 lines, none of the 3 functions are called anywhere)
- Remove duplicate `_profile_to_response()` in `main.py:1983-2005`, use the one from `profiles.py`
- Remove duplicate `import asyncio` in `main.py`
- Remove pointless one-line wrappers (`_get_profiles_dir()`, `_get_generations_dir()`) in `profiles.py`, `history.py`, `export_import.py` — call `config.*` directly
- Deduplicate `LANGUAGE_CODE_TO_NAME` (defined in both `pytorch_backend.py:18` and `mlx_backend.py:24`) — move to `backends/__init__.py`
- Deduplicate `WHISPER_HF_REPOS` (defined in both `pytorch_backend.py:379` and `mlx_backend.py:416`) — move to `backends/__init__.py`
- Update `README.md` to reflect actual file structure (it still references `studio.py` and the old two-backend layout)

---

## Phase 2: Backend Deduplication

The backends have 5-7 copies of identical or near-identical methods. This is the highest-value structural change because it removes ~500 lines and makes adding new engines trivial.

### Extract shared methods

Create `backends/base.py` with:

- **`is_model_cached(hf_repo, hf_revision)`** — the HuggingFace cache directory check. Currently copy-pasted in `pytorch_backend.py:81`, `mlx_backend.py:68`, `chatterbox_backend.py:66`, `chatterbox_turbo_backend.py:66`, `luxtts_backend.py:57`, and both STT backends. One function, parameterized by repo/revision.

- **`combine_voice_prompts(samples, sample_rate, backend_type)`** — load audio, normalize, concatenate, join texts. Identical in all 5 TTS backends (`pytorch:301`, `mlx:291`, `chatterbox:266`, `chatterbox_turbo:269`, `luxtts:208`). The only variation is which audio loading function is used (torchaudio vs mlx_audio) — pass the loader as a parameter or detect from backend type.

- **`get_device(backend_type)`** — device detection. Currently 5 slightly different implementations. Parameterize the differences:
  - PyTorch: checks CUDA > XPU > DirectML > MPS > CPU
  - Chatterbox/Chatterbox Turbo: forces CPU on macOS, otherwise CUDA > CPU
  - LuxTTS: checks MPS > CUDA > CPU

- **`model_load_wrapper(load_fn, ...)`** — the progress tracking boilerplate shared by all 7 `_load_model_sync` implementations. Every backend does the same setup/teardown dance with `progress_manager`, `task_manager`, `HFProgressTracker`, and tqdm patching. Extract the wrapper, backends just supply the actual model loading callable.

### Extract Chatterbox f32 patch

Move the S3Tokenizer / VoiceEncoder monkey-patches from `chatterbox_backend.py:189-210` and `chatterbox_turbo_backend.py:193-214` into a shared `backends/chatterbox_patches.py` (or a function in `base.py`). Both files have identical code.

---

## Phase 3: Generation Service

The three generation closures in `main.py` (`_run_generation:782`, `_run_retry:923`, `_run_regenerate:1018`) share ~80% of their logic. Extract into a service module.

### Create `services/generation.py`

Single orchestration function with mode parameter:

```python
async def run_generation(
    generation_id: str,
    profile_id: str,
    text: str,
    language: str,
    engine: str,
    model_size: str,
    seed: Optional[int],
    normalize: bool,
    effects_chain: Optional[list],
    instruct_text: Optional[str],
    mode: Literal["generate", "retry", "regenerate"],
    version_label: Optional[str] = None,
):
```

Differences between modes are small and can be handled with conditionals:
- `retry`: reuses same seed, skips effects/versions
- `regenerate`: seed=None, creates a new version with auto-label
- `generate`: full pipeline including effects version

### Move background queue management

Move `_generation_queue`, `_generation_worker`, `_enqueue_generation`, `_background_tasks`, and `_create_background_task` (currently `main.py:63-92`) into the service module or a dedicated `services/task_queue.py`.

---

## Phase 4: Route Extraction

Split `main.py` (72 routes) into domain-specific routers. After Phase 3, the route handlers should be thin — just validation, delegation, and response formatting.

### Target structure

```
backend/
  app.py                    # FastAPI app creation, middleware, startup/shutdown
  routes/
    __init__.py
    health.py               # GET /, /health, /health/filesystem, /shutdown, /watchdog/disable  (5 routes)
    profiles.py             # All /profiles/* routes  (17 routes)
    channels.py             # All /channels/* routes  (7 routes)
    generations.py          # /generate, /generate/stream, /generate/*/retry, regenerate, status  (5 routes)
    history.py              # All /history/* routes  (8 routes)
    stories.py              # All /stories/* routes  (15 routes)
    effects.py              # All /effects/* routes + /generations/*/versions/*  (11 routes)
    audio.py                # /audio/*, /samples/*  (2 routes)
    models.py               # All /models/* routes  (11 routes)
    tasks.py                # /tasks/*, /cache/*  (3 routes)
    cuda.py                 # /backend/cuda-*  (4 routes)
  services/
    generation.py           # TTS orchestration (from Phase 3)
    model_status.py         # HF cache inspection logic (currently inline at main.py:2251-2431)
```

`main.py` becomes a thin entry point that imports the app from `app.py` and runs uvicorn (preserving backward compat for `python -m backend.main`).

### Model status extraction

The `get_model_status` endpoint (`main.py:2251-2431`) is 180 lines of HuggingFace cache inspection that duplicates logic from `_is_model_cached` in the backends. Extract to `services/model_status.py` and reuse the shared `is_model_cached` from Phase 2 where possible.

---

## Phase 5: Database Cleanup

### Split `database.py` (487 lines)

- `database/models.py` — ORM model definitions (11 models, ~140 lines)
- `database/migrations.py` — migration logic (`_run_migrations`, ~200 lines)
- `database/seed.py` — `_backfill_generation_versions` + `_seed_builtin_presets`
- `database/session.py` — engine creation, `init_db()`, `get_db()`

### Fix async-over-sync CRUD modules

`channels.py`, `history.py`, `stories.py`, `effects.py`, `versions.py`, `profiles.py` all declare `async def` but never `await`. They run synchronous SQLAlchemy queries directly, blocking the event loop. Two options:

- **Option A**: Drop `async` keyword, wrap calls in `asyncio.to_thread()` at the route layer
- **Option B**: Switch to async SQLAlchemy (`create_async_engine` + `AsyncSession`)

Option A is simpler and non-disruptive. Option B is cleaner long-term but touches every query.

---

## Phase 6: Polish

- Consolidate hardcoded constants (`24000` sample rate, `100MB`/`50MB` max file sizes, `HSA_OVERRIDE_GFX_VERSION`, CORS origins) into `config.py` or a `constants.py`
- Fix `hf_offline_patch.py` side-effect-on-import (runs patching twice — once on import, once explicitly in `mlx_backend.py`)
- Standardize error handling across routes (currently three different patterns)
- Rename `effects.py` (preset CRUD) to avoid confusion with `utils/effects.py` (DSP engine) — either rename to `effect_presets.py` or fold into routes
- Clean up test suite — the 4 manual integration scripts in `tests/` should either be converted to pytest or moved to a `scripts/` dir

---

## Notes

- Each phase is independently shippable and testable
- Phase 1 is zero-risk deletion
- Phase 2 is self-contained within `backends/`
- Phase 3 sets up the extraction pattern needed for Phase 4
- Phase 4 is the largest change but should be mostly mechanical after Phase 3
- Phase 5 can run in parallel with Phase 4 since it touches different files
