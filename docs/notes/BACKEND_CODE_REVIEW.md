# Code Review: `backend/` Post-Refactor

**Date:** 2026-03-16
**Scope:** Full review of `backend/` after major refactor

## Overall Assessment

The refactor is well-executed. The codebase follows a clean layered architecture (routes -> services -> backends) with good separation of concerns. The code is readable, the module boundaries are sensible, and the migration strategy is pragmatic for a desktop app. Below are findings organized by severity.

---

## Critical Issues

### 1. Double `init_db()` in bundled entry point

**File:** `server.py:261`

`server.py:261` calls `database.init_db()` explicitly, but `app.py:140` also calls `database.init_db()` inside the `startup` event handler. When running via `server.py`, the database gets initialized twice -- once before uvicorn starts and once during the startup event. This is likely benign (idempotent migrations), but the second call recreates the engine and `SessionLocal`, which could cause subtle issues if any sessions were opened between the two calls.

**Recommendation:** Remove the explicit `init_db()` call in `server.py:260-262` and rely solely on the startup event in `app.py`. The same issue exists in `main.py:38`.

### 2. SSE endpoint holds DB session open indefinitely

**File:** `routes/generations.py:179-212`

The `get_generation_status` SSE endpoint receives a `db` session via `Depends(get_db)` but keeps it open for the lifetime of the SSE stream (polling every 1 second). This ties up a SQLite connection for potentially minutes. With SQLite's single-writer model, this is a contention risk.

**Recommendation:** Open and close a short-lived session on each poll iteration instead of holding one via dependency injection:

```python
async def event_stream():
    while True:
        db = next(get_db())
        try:
            gen = db.query(DBGeneration).filter_by(id=generation_id).first()
            ...
        finally:
            db.close()
        await asyncio.sleep(1)
```

---

## High Severity

### 3. `_save_retry` creates no version record

**File:** `services/generation.py:201-214`

`_save_retry` writes the audio file but creates no `GenerationVersion` entry. If the generation previously had versions (from an initial generate that failed mid-effects, for example), the retry result won't appear in the versions list. This creates an inconsistency: some generations have versions, retried ones don't.

**Recommendation:** Create a "clean" version in `_save_retry` the same way `_save_generate` does.

### 4. `datetime.utcnow()` is deprecated

**File:** `services/stories.py` and others

`datetime.utcnow()` is deprecated as of Python 3.12 and returns a naive datetime. Used throughout `services/stories.py` (lines 95, 96, 193, 307, 360, 404, 457, 529, 537, 598, 610, 652, 716, 775) and possibly other service files.

**Recommendation:** Replace with `datetime.now(datetime.UTC)` or `datetime.now(timezone.utc)`.

### 5. `list_stories` N+1 query

**File:** `services/stories.py:122-132`

`list_stories` issues one `COUNT(*)` query per story inside a loop. For N stories, that's N+1 queries.

**Recommendation:** Use a subquery or a single aggregated query:

```python
from sqlalchemy import func
counts = dict(
    db.query(DBStoryItem.story_id, func.count(DBStoryItem.id))
    .group_by(DBStoryItem.story_id)
    .all()
)
```

---

## Medium Severity

### 6. `create_story` queries item count immediately after creation

**File:** `services/stories.py:103`

Line 103 queries the item count for a story that was just created -- it will always be 0. This is wasted I/O.

### 7. Bare `except Exception` with silent `pass`

**File:** `routes/generations.py:69-70`

When parsing a profile's stored `effects_chain` JSON, exceptions are silently swallowed. A corrupt JSON blob would result in no effects being applied with no logging.

**Recommendation:** Log the exception at warning level.

### 8. `update_story_item_times` uses `generation_id` as key

**File:** `services/stories.py:643-649`

`item_map` is keyed by `generation_id`, but the same generation can appear in a story multiple times (via split/duplicate). This would cause key collisions, and only the last item per generation_id would be updatable.

**Recommendation:** Key by `item_id` instead, and change the `StoryItemUpdateTime` model to use `item_id`.

### 9. Thread safety gap in `get_stt_backend`

**File:** `backends/__init__.py:499-520`

`get_stt_backend()` uses no locking (unlike `get_tts_backend_for_engine` which uses `_tts_backends_lock`). A race condition could create duplicate STT backend instances.

**Recommendation:** Add a lock or use the same double-checked locking pattern.

### 10. Unused `_tts_backend` global

**File:** `backends/__init__.py:156`

`_tts_backend` is declared but never read or written outside of `reset_backends()`. All TTS access goes through `_tts_backends` dict. Dead code.

### 11. `trim_story_item` returns `None` for validation errors

**File:** `services/stories.py:448`

Returning `None` for "item not found" and "invalid trim values" is ambiguous. The route handler can't distinguish between a 404 and a 400 response.

**Recommendation:** Raise specific exceptions (e.g., `ValueError` for invalid trim) so the route can return the appropriate HTTP status.

### 12. `load_engine_model` calls different method names

**File:** `backends/__init__.py:340-346`

For Qwen, it calls `load_model_async(model_size)`. For others, it calls `load_model()` with no arguments. But the `TTSBackend` protocol defines `load_model(self, model_size: str)`. This means the protocol signature doesn't match actual usage for either path.

**Recommendation:** Align the protocol definition with actual backend implementations, or add `load_model_async` to the protocol.

---

## Low Severity / Style

### 13. Inconsistent `async` usage in services

Functions like `create_story`, `list_stories`, etc. in `services/stories.py` are `async def` but contain no `await` expressions. They do synchronous SQLAlchemy I/O. While this works (the functions are awaitable), it's misleading -- these will block the event loop during DB access.

This is a known tradeoff with synchronous SQLAlchemy + FastAPI, and acceptable for a single-user desktop app with SQLite, but worth noting for documentation.

### 14. `getattr(item, "version_id", None)` pattern

**File:** `services/stories.py:57, 504, 524, etc.`

Multiple places use `getattr(item, "version_id", None)` on a DB model that has `version_id` as a declared column (from migrations). After the migration runs, this is always a real attribute. The defensive `getattr` is cargo-culted.

**Recommendation:** Access `item.version_id` directly. If the column is missing, the ORM will raise a clear error.

### 15. `reorder_story_items` ignores trim values

**File:** `services/stories.py:707`

When recalculating timecodes, it uses the full `generation.duration` rather than the effective (trimmed) duration. Trimmed items will have larger gaps than intended.

### 16. Module-level `import torch` in `app.py:44`

`import torch` at module level in `app.py` means torch loads on every import of the app module. This is intentional (AMD env vars must be set first), but the comment on line 38 should mention that this is why the import is here and not at the top.

### 17. f-strings in logging in `server.py`

`server.py` uses f-strings in logging calls (e.g., lines 63-66, 252, 256, 264). This evaluates the string even when the log level is filtered out. The rest of the codebase correctly uses `%s` style (e.g., `app.py:131`).

---

## Architecture Observations (Not Issues)

- **Clean layered design**: routes -> services -> backends with Pydantic models as the API contract.
- **Backend abstraction** with `Protocol` classes and a config registry is a solid pattern.
- **Serial generation queue** (`task_queue.py`) is simple and effective for single-GPU serialization.
- **Migration approach** is pragmatic for the use case. The idempotent, check-then-act pattern is reliable.
- **The `generation.py` refactor** (collapsing three closures into `run_generation` with a mode parameter) is a clear improvement.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 3 |
| Medium | 7 |
| Low/Style | 5 |

The refactor achieved its goals: clear module boundaries, reduced duplication (especially in `generation.py`), and a well-organized backend abstraction. The critical items (double init_db and SSE session leak) should be addressed first, followed by the version consistency issue in retry and the N+1 query.
