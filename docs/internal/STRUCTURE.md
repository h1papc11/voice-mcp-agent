# Repository Structure

## Top-Level Layout

```
voicebox/
├── app/                    # Shared React application (primary UI)
├── tauri/                  # Desktop shell (Vite + Rust)
├── web/                    # Browser deployment wrapper
├── landing/                # Marketing site (Next.js)
├── docs/                   # Documentation site (Fumadocs)
├── backend/                # Python FastAPI server
├── packages/               # Shared TypeScript libraries
│   └── redis/              # Redis connection and cache layer
├── scripts/                # Build and release automation
├── docs/internal/          # Internal engineering notes (this folder)
├── biome.json              # Lint/format configuration
├── justfile                # Dev/build orchestration
└── package.json            # Bun workspace root
```

## Separation of Concerns

| Concern | Location |
|---------|----------|
| UI components & routes | `app/src/` |
| Platform-specific I/O | `tauri/src/platform/`, `web/src/platform/` |
| API business logic | `backend/services/` |
| HTTP routes | `backend/routes/` |
| TTS/STT engines | `backend/backends/` |
| Persistence (SQL) | `backend/database/` |
| Persistence (Redis) | `packages/redis/` |
| Shared Node utilities | `packages/` (extensible) |
| Release automation | `scripts/`, `.github/workflows/` |

## Workspace Boundaries

Bun workspaces: `app`, `tauri`, `web`, `landing`, `packages/*`.

The `docs/` site maintains a separate `package.json` for Fumadocs compatibility.

## Import Conventions

- `@/` → `app/src/*` (via Vite alias in `tauri/` and `web/`)
- `@voicebox/redis` → `packages/redis/src/index.ts`

## Adding New Code

- **UI feature**: `app/src/` + platform hook if native capability needed.
- **API endpoint**: `backend/routes/` + `backend/services/`.
- **Shared TS utility**: new package under `packages/`.
- **Build script**: `scripts/` with TypeScript preferred.
