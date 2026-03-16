# Backend Refactor Plan

## Current State

`main.py` is still a ~2,800-line god file with 72 routes, 3x duplicated generation orchestration, fake async CRUD modules, and scattered constants. The backend dedup is done — adding new engines is now trivial.

---

## Phase 1: Dead Code & Low-Hanging Fruit ✓

Deleted `studio.py`, `migrate_add_instruct.py`, `utils/validation.py`. Removed duplicate `_profile_to_response`, duplicate `import asyncio`, pointless wrapper functions. Consolidated `LANGUAGE_CODE_TO_NAME` and `WHISPER_HF_REPOS` into `backends/__init__.py`. Updated README.

---

## Phase 2: Backend Deduplication ✓

Created `backends/base.py` with shared utilities:
- `is_model_cached()` — parameterized HF cache check (replaced 7 copies)
- `get_torch_device()` — parameterized device detection (replaced 5 copies)
- `combine_voice_prompts()` — load + normalize + concatenate (replaced 5 copies)
- `model_load_progress()` — context manager for progress tracking lifecycle (replaced 7 copies)
- `patch_chatterbox_f32()` — shared dtype monkey-patches (replaced 2 copies)

Net result: -1,078 lines across the backend.

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

### Adopt Alembic

Replace the hand-rolled `_run_migrations()` (200 lines of manual ALTER TABLE + column existence checks) with Alembic.

**Why:**
- Current approach has no migration tracking — checks column existence on every startup
- Can't express complex migrations (data transforms, renames) safely
- No rollback path
- Already at 12 migration blocks and growing

**Migration steps:**

1. `pip install alembic` and add to `requirements.txt`
2. Run `alembic init alembic` to scaffold the config
3. Point `alembic/env.py` at the existing SQLAlchemy `Base.metadata` and engine
4. Create a baseline migration stamped as the current schema — this tells Alembic "the DB already has all this, don't recreate it":
   ```bash
   alembic revision --autogenerate -m "baseline"
   # Then stamp existing DBs so they skip the baseline:
   alembic stamp head
   ```
5. Replace `_run_migrations()` in `init_db()` with `alembic.command.upgrade(config, "head")`
6. Move `_backfill_generation_versions` and `_seed_builtin_presets` into a post-migration hook or a dedicated seed step in `init_db()`
7. Delete the 200 lines of manual migration code

**Going forward**, new schema changes become:
```bash
# Auto-generate from model diff
alembic revision --autogenerate -m "add_whatever_column"
# Review the generated file, then it runs on next startup
```

**Target structure:**

```
backend/
  alembic/
    versions/
      001_baseline.py
    env.py
  alembic.ini
  database/
    __init__.py       # re-exports for backward compat
    models.py         # ORM model definitions (11 models, ~140 lines)
    session.py        # engine creation, init_db(), get_db()
    seed.py           # _backfill_generation_versions + _seed_builtin_presets
```

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
