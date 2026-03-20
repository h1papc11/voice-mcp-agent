# Voicebox API Refactor Plan

Date: 2026-03-19
Status: Proposed
Scope: Backend HTTP API structure, schemas, docs, and compatibility strategy

## Goals

- Make the API easier to understand and automate against.
- Improve endpoint consistency without breaking the desktop app or existing local integrations.
- Align generated docs and checked-in OpenAPI artifacts with the actual backend.
- Separate app-facing resources from internal or operational actions.
- Create a migration path toward a cleaner `v2` resource model while preserving `v1` routes during transition.

## Non-Goals

- Rewriting backend business logic or generation internals.
- Introducing authentication for all deployment modes in the first pass.
- Changing storage models or database schema unless required for API correctness.
- Removing current routes immediately.

## Current Pain Points

- Mixed endpoint styles: resource-oriented (`/profiles`) and command-oriented (`/generate`, `/tasks/clear`) coexist.
- Related generation resources are split across multiple namespaces: `/generate`, `/history`, `/audio`, `/effects`, and `/generations/.../versions`.
- Response payloads vary widely: typed models, raw dicts with `message`, booleans, and `HTTPException(detail=...)` payloads.
- Some async flows use exception-shaped `202` responses instead of first-class task contracts.
- Checked-in OpenAPI output can drift from actual backend models.
- Operational endpoints such as `/shutdown` are exposed in the same surface as user workflows.

## Guiding Principles

1. Prefer additive changes before destructive changes.
2. Keep `v1` behavior working until the app and docs fully migrate.
3. Add compatibility shims close to the routing layer, not deep in services.
4. Treat OpenAPI as a release artifact that must be kept in sync.
5. Standardize public contracts before renaming everything.

## Target API Shape

This is the intended end state, not the immediate first milestone.

### Core Resources

- `/profiles`
- `/profiles/{profile_id}/samples`
- `/profiles/{profile_id}/avatar`
- `/profiles/{profile_id}/effects`
- `/generations`
- `/generations/{generation_id}`
- `/generations/{generation_id}/status`
- `/generations/{generation_id}/audio`
- `/generations/{generation_id}/versions`
- `/generations/{generation_id}/versions/{version_id}`
- `/generations/{generation_id}/versions/{version_id}/audio`
- `/stories`
- `/stories/{story_id}/items`
- `/effects/presets`
- `/models`
- `/models/{model_name}`
- `/tasks`

### Operational or Internal Endpoints

Move under an explicit namespace and disable where appropriate:

- `/admin/shutdown`
- `/admin/watchdog/disable`
- `/admin/cache/clear`
- `/admin/tasks/clear`

### Response Contract Direction

- Resource reads and writes return typed resource models.
- Delete and action endpoints return small typed action result models.
- Errors use a consistent structure.
- Async actions return explicit task metadata instead of overloading `detail`.

## Migration Strategy Overview

The refactor is split into six phases. Phases 1-3 are the highest impact and safest to ship first.

| Phase | Focus | Est. Duration | Risk | Backward Compatibility |
| --- | --- | --- | --- | --- |
| 1 | Documentation and contract correctness | 2-3 days | Low | Full |
| 2 | Response and error consistency | 3-5 days | Low-Medium | Full |
| 3 | Router structure and internal organization | 3-4 days | Low | Full |
| 4 | Additive `v2` resource endpoints | 1-2 weeks | Medium | Full |
| 5 | Client migration and deprecation rollout | 1 week | Medium | Full during rollout |
| 6 | Cleanup and optional removals | 1-2 releases | Medium-High | Partial after notice |

## Phase 1: Fix Contract Drift First

Priority: Highest
Outcome: The documented API matches the running backend.

### Problems Addressed

- `docs/openapi.json` can become stale.
- Generated API reference pages may describe outdated request bodies.
- App metadata still frames the backend too narrowly.

### Implementation Steps

1. Update FastAPI app metadata in `backend/app.py`.
   - Replace the old Qwen-specific description with a multi-engine Voicebox API description.
   - Add tags metadata for major domains if desired.
2. Regenerate OpenAPI from the running app using the existing docs script flow.
3. Compare `backend/models.py` to the checked-in schema.
   - Verify `GenerationRequest`, effects endpoints, stories endpoints, and model endpoints.
4. Regenerate or refresh API reference pages under `docs/content/docs/api-reference/`.
5. Add a CI check that fails if `docs/openapi.json` is out of date.
6. Add a short maintainer note describing when schema regeneration is required.

### Backward Compatibility

- No route changes.
- No payload changes.
- Safe to release immediately.

### Success Criteria

- `docs/openapi.json` matches the live app.
- Generated docs include all currently supported generate parameters.
- No frontend code changes required.

## Phase 2: Standardize Responses and Errors

Priority: High
Outcome: Clients can handle responses predictably.

### Problems Addressed

- Delete endpoints return ad hoc message dicts.
- Toggle endpoints return special one-off payloads.
- `202` async responses are encoded as `HTTPException(detail=...)` in some places.

### Implementation Steps

1. Add shared response models in `backend/models.py`.
   - `ActionResult`
   - `DeleteResult`
   - `ToggleFavoriteResponse`
   - `AcceptedTaskResponse`
   - `ApiError`
2. Convert routes that currently return raw dicts to explicit `response_model`s.
   - `DELETE /profiles/{profile_id}`
   - `DELETE /history/{generation_id}`
   - `DELETE /stories/{story_id}`
   - `POST /tasks/clear`
   - `POST /cache/clear`
   - similar endpoints across routes
3. Replace exception-shaped `202` responses in `transcription.py` with an explicit accepted response body.
   - Return `JSONResponse(status_code=202, content=...)` or typed FastAPI response model.
4. Add a global exception handler for known API errors if helpful.
   - Normalize `ValueError` to `400` with a consistent error body.
   - Preserve FastAPI validation errors for now, or wrap them in a consistent top-level shape in a later pass.
5. Document the stable error contract in the docs.

### Migration Strategy

- Keep field names inside successful payloads compatible where possible.
- For existing dict responses, preserve the current keys while introducing typed models with the same shape.
- For `202` flows, support both old and new client handling for one release if needed.

### Timeline Estimate

- 3-5 engineering days including tests and docs refresh.

### Success Criteria

- All mutation endpoints declare response models.
- Clients can programmatically distinguish success, accepted, and error cases without special casing `detail` payloads.

## Phase 3: Normalize Router Structure Internally

Priority: High
Outcome: The backend becomes easier to maintain before public path changes begin.

### Problems Addressed

- Route files hardcode full paths and are all mounted at root.
- There is no consistent use of router prefixes or tags.
- Route grouping in code does not cleanly express the public API shape.

### Implementation Steps

1. Add prefixes and tags to routers.
   - `profiles`: `prefix="/profiles"`
   - `generations`: `prefix="/generate"` for now or split additive aliases carefully
   - `history`: `prefix="/history"`
   - `effects`: `prefix="/effects"`
   - and so on
2. Convert route declarations to relative paths within each router.
3. Introduce a small route compatibility layer for routes that are likely to move later.
   - Example: helper functions that can be mounted under both old and new paths.
4. Add explicit route tags so Swagger/OpenAPI groups are coherent.
5. Document the intended public ownership of each namespace.

### Backward Compatibility

- No public path changes yet if existing paths are preserved through prefixes and aliases.
- Mostly internal refactoring.

### Timeline Estimate

- 3-4 engineering days.

### Success Criteria

- All route modules use prefixes and tags.
- Route registration in `backend/routes/__init__.py` becomes simpler.
- OpenAPI groups read cleanly by domain.

## Phase 4: Introduce Additive `v2` Resource Endpoints

Priority: High
Outcome: A cleaner API exists without breaking the current one.

### Problems Addressed

- Generation-related resources are fragmented.
- Sample and audio endpoints are not consistently modeled as resources.
- Command-style naming makes the API harder to reason about.

### New Endpoints to Add

These should be introduced alongside current endpoints, not as replacements.

- `POST /generations` -> alias for current `/generate`
- `GET /generations` -> alias for current `/history`
- `GET /generations/{id}` -> alias for current `/history/{id}`
- `POST /generations/{id}/retry` -> alias for current `/generate/{id}/retry`
- `POST /generations/{id}/regenerate` -> alias for current `/generate/{id}/regenerate`
- `GET /generations/{id}/status` -> alias for current `/generate/{id}/status`
- `POST /generations/stream` -> alias for current `/generate/stream`
- `GET /generations/{id}/audio` -> alias for current `/audio/{generation_id}`
- `GET /generations/{id}/export` -> alias for current `/history/{generation_id}/export`
- `GET /generations/{id}/export-audio` -> alias for current `/history/{generation_id}/export-audio`
- `GET /profiles/{profile_id}/samples/{sample_id}` or `GET /samples/{sample_id}` as a consciously chosen model
- `PUT /profiles/{profile_id}/samples/{sample_id}` -> alias for current sample update route
- `DELETE /profiles/{profile_id}/samples/{sample_id}` -> alias for current sample delete route

### Implementation Steps

1. Create new handler entry points that call the existing service functions.
2. Keep old handlers in place, but mark them deprecated in OpenAPI.
3. Add `summary` and `description` text clarifying preferred routes.
4. Update frontend and docs examples to use new endpoints first.
5. Add tests proving both old and new paths return equivalent responses.

### Migration Strategy

- Old paths remain functional for at least one stable release cycle.
- New docs and client examples use `v2-style` resource routes immediately.
- Include deprecation headers where feasible, for example:
  - `Deprecation: true`
  - `Sunset: <date>`
  - `Link: <new-doc-url>; rel="successor-version"`

### Timeline Estimate

- 1-2 weeks depending on test coverage and frontend updates.

### Success Criteria

- All major generation workflows are accessible through resource-oriented routes.
- Old routes still work unchanged.

## Phase 5: Migrate First-Party Clients and Publish Deprecations

Priority: Medium
Outcome: Voicebox itself stops depending on legacy paths.

### Problems Addressed

- The desktop app and docs may continue to reinforce old route shapes.
- Third-party consumers need a visible migration path.

### Implementation Steps

1. Update `app/src/lib/api/client.ts` to use the new preferred endpoints.
2. Regenerate or refresh any generated API clients.
3. Update docs examples, tutorials, and code snippets to use preferred routes only.
4. Add a changelog entry describing the migration path.
5. Add runtime deprecation logging for legacy route usage in development mode.
6. If feasible, expose a small `/health` or `/meta` field showing API version and deprecation window.

### Migration Strategy

- Keep old endpoints available but clearly documented as legacy.
- Publish a mapping table from old route to new route.
- Do not change request or response payloads during the same phase unless necessary.

### Timeline Estimate

- About 1 week including docs and app verification.

### Success Criteria

- First-party app no longer depends on legacy route names.
- Docs do not advertise deprecated paths as the primary interface.

## Phase 6: Cleanup, Namespace Hardening, and Optional Breaking Changes

Priority: Medium
Outcome: The API surface is cleaner and safer for remote or Docker use.

### Problems Addressed

- Internal/admin endpoints are mixed into the public API.
- Legacy aliases increase maintenance cost forever if never retired.

### Implementation Steps

1. Move operational endpoints under `/admin` or `/internal`.
   - `/shutdown`
   - `/watchdog/disable`
   - `/tasks/clear`
   - `/cache/clear`
2. Gate these endpoints behind configuration for non-local deployments.
   - Example: `VOICEBOX_ENABLE_ADMIN_API=true`
3. Decide whether to remove or keep legacy aliases.
   - If removing, do so only after a published deprecation window.
4. Remove deprecated docs pages and old examples.
5. Tighten route-level tests to prevent accidental reintroduction of legacy patterns.

### Migration Strategy

- For desktop-only local use, aliases may remain indefinitely if removal cost outweighs benefit.
- For published remote API guidance, hide admin endpoints from default docs even if they still exist.

### Timeline Estimate

- 1-2 releases after the additive migration is complete.

### Success Criteria

- Public docs expose a coherent resource API.
- Operational endpoints are clearly separate or disabled in remote contexts.

## Cross-Cutting Work Items

These should happen throughout the migration, not only in a single phase.

### Testing

- Add route equivalence tests for old and new paths.
- Add schema snapshot tests for OpenAPI generation.
- Add response-shape tests for common mutations and async workflows.
- Add contract tests for `202 Accepted` flows.

### Documentation

- Maintain an old-to-new endpoint mapping table.
- Add per-endpoint examples for create profile, generate, apply effects, transcribe, and stories operations.
- Explicitly document which endpoints are app-facing vs admin-facing.

### Observability

- Add warning logs when deprecated endpoints are used.
- Track usage counts in development or optional telemetry-free local logs.

### Release Management

- Mention API changes in `CHANGELOG.md`.
- Ensure docs and app updates ship in the same release as new preferred routes.

## Recommended Execution Order

If engineering time is limited, implement in this exact order:

1. Fix OpenAPI and docs drift.
2. Standardize response models and accepted-task responses.
3. Add router prefixes and tags internally.
4. Add `/generations` aliases and sample path aliases.
5. Migrate the first-party app to preferred routes.
6. Deprecate or hide legacy/admin routes.

## Old-to-New Route Mapping

| Current Route | Preferred Route |
| --- | --- |
| `POST /generate` | `POST /generations` |
| `POST /generate/stream` | `POST /generations/stream` |
| `POST /generate/{id}/retry` | `POST /generations/{id}/retry` |
| `POST /generate/{id}/regenerate` | `POST /generations/{id}/regenerate` |
| `GET /generate/{id}/status` | `GET /generations/{id}/status` |
| `GET /history` | `GET /generations` |
| `GET /history/{id}` | `GET /generations/{id}` |
| `GET /audio/{id}` | `GET /generations/{id}/audio` |
| `GET /history/{id}/export` | `GET /generations/{id}/export` |
| `GET /history/{id}/export-audio` | `GET /generations/{id}/export-audio` |
| `PUT /profiles/samples/{sample_id}` | `PUT /profiles/{profile_id}/samples/{sample_id}` |
| `DELETE /profiles/samples/{sample_id}` | `DELETE /profiles/{profile_id}/samples/{sample_id}` |
| `POST /tasks/clear` | `POST /admin/tasks/clear` |
| `POST /cache/clear` | `POST /admin/cache/clear` |
| `POST /shutdown` | `POST /admin/shutdown` |
| `POST /watchdog/disable` | `POST /admin/watchdog/disable` |

## Risks and Mitigations

### Risk: App regressions during endpoint migration

- Mitigation: Add new routes before changing client usage.
- Mitigation: Keep payloads identical while paths change.

### Risk: Docs still drift after cleanup

- Mitigation: Add CI enforcement and a release checklist step.

### Risk: Third-party local scripts break on removal

- Mitigation: Prefer indefinite aliases for one-person local workflows unless maintenance becomes painful.

### Risk: Admin endpoints remain dangerous in remote mode

- Mitigation: Hide and gate them before promoting remote deployment more broadly.

## Definition of Done

The refactor can be considered complete when all of the following are true:

- OpenAPI, checked-in docs, and backend models match.
- The preferred public API is resource-oriented and documented consistently.
- The Voicebox app uses preferred routes exclusively.
- Legacy routes are either deprecated with a timeline or intentionally retained as compatibility aliases.
- Operational endpoints are clearly separated from the public app API.
