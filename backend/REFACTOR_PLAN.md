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

## Phase 3: Generation Service ✓

Extracted the three near-identical generation closures (`_run_generation`, `_run_retry`, `_run_regenerate`) and the background queue machinery from `main.py` into a new `services/` layer:

- `services/task_queue.py` — `create_background_task()`, `enqueue_generation()`, `init_queue()`, and the serial `_generation_worker`. Replaces the module-level globals and helpers that were in `main.py:63-92`.
- `services/generation.py` — single `run_generation()` function with a `mode` parameter (`"generate"`, `"retry"`, `"regenerate"`). Mode-specific persistence is handled by three small sync helpers (`_save_generate`, `_save_retry`, `_save_regenerate`). The shared pipeline (model loading, voice prompt creation, chunked inference, normalization, error handling, task manager lifecycle) is written once.

Route handlers in `main.py` are now thin: validate input, create/update DB row, resolve effects chain, then `enqueue_generation(run_generation(...))`.

Net result: ~240 lines of duplicated closure code replaced by a single 230-line service module + 50-line queue module.

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

## Phase 7: Style Guide & Tooling ✓

Added a Python style guide (`backend/STYLE_GUIDE.md`) and automated linting/formatting with ruff. Removed the redundant Makefile — the justfile is now the single task runner.

### Style guide

Codifies conventions for the refactor: Google-style docstrings, native 3.12 type syntax (`list[str]`, `X | None` — no `from __future__` or `typing.List`), `logging` module instead of `print()`, two-layer error handling (domain exceptions + route-layer HTTPException), import grouping (stdlib / third-party / local with isort enforcement), 120-char line length.

### Ruff config (`pyproject.toml`)

Added project-root `pyproject.toml` with ruff linter + formatter config. Rule sets: `F`, `E`, `W`, `I` (isort), `N` (naming), `UP` (pyupgrade to 3.12), `B` (bugbear), `SIM`, `RET`, `T20` (print detection), `PT` (pytest style), `RUF`. `T201` (print) is ignored during migration — remove once logging conversion is done.

Initial scan: 1,103 lint violations (879 auto-fixable), 38 files needing reformatting. Mostly whitespace (W293), type annotation modernization (UP045/UP006), and import sorting (I001). To be fixed file-by-file as files are touched, not in a big-bang pass.

### Justfile updates

- `just check` now runs both JS (Biome) and Python (ruff) checks
- Added `just check-python`, `just lint-python`, `just format-python`, `just fix-python`, `just test`
- `just setup-python` installs `ruff`, `pytest`, `pytest-asyncio` as dev tools
- Deleted `Makefile` and updated all references in `CHANGELOG.md`, `PATCH_NOTES.md`, `docs/plans/ADDING_TTS_ENGINES.md`

---

## Notes

- Each phase is independently shippable and testable
- Phase 1 is zero-risk deletion
- Phase 2 is self-contained within `backends/`
- Phase 3 sets up the extraction pattern needed for Phase 4
- Phase 4 is the largest change but should be mostly mechanical after Phase 3
- Phase 5 can run in parallel with Phase 4 since it touches different files
