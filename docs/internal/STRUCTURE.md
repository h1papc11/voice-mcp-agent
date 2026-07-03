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
├── src/                    # Root TypeScript modules
│   └── redis/              # Persistence connection and cache layer
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
| Persistence cache | `src/redis/` |
| Shared Node utilities | `src/` |
| Release automation | `scripts/`, `.github/workflows/` |

## Workspace Boundaries

Bun workspaces: `app`, `tauri`, `web`, `landing`.

The `docs/` site maintains a separate `package.json` for Fumadocs compatibility.

## Import Conventions

- `@/` → `app/src/*` (via Vite alias in `tauri/` and `web/`)
- `src/redis` entrypoint → `src/redis/index.ts`

## Adding New Code

- **UI feature**: `app/src/` + platform hook if native capability needed.
- **API endpoint**: `backend/routes/` + `backend/services/`.
- **Shared TS utility**: place module under `src/`.
- **Build script**: `scripts/` with TypeScript preferred.
