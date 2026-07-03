# Voicebox Repository Audit

Internal engineering audit for the production-ready fork. Version baseline: **0.5.0**.

## Current Architecture

Voicebox is a **Bun monorepo** with four primary runtime surfaces:

| Layer | Technology | Path | Role |
|-------|------------|------|------|
| Shared UI | React 18 + TypeScript | `app/` | Routes, stores, components, OpenAPI client |
| Desktop shell | Tauri 2 + Rust | `tauri/` | Hotkeys, dictation, audio capture, sidecar spawn |
| Web deployment | Vite + platform stubs | `web/` | Browser deployment over shared `app/` code |
| API layer | TypeScript-first service layer | `app/src/lib/api/` | TTS/STT/LLM integrations and API clients |
| Marketing | Next.js 16 | `landing/` | Public site |
| Documentation | Fumadocs | `docs/` | API and developer docs (standalone install) |

Data flow: React UI → HTTP/SSE → API layer (`127.0.0.1:17493`) → service integrations + persistence.

Platform abstraction lives in `app/src/platform/types.ts` with implementations under `tauri/src/platform/` and `web/src/platform/`.

## Dependency Review

- **JS**: Bun workspaces (`app`, `tauri`, `web`, `landing`); Biome for lint/format.
- **TypeScript**: Bun workspaces and strict compiler settings.
- **Rust**: Tauri 2, cpal, platform-specific audio crates.

Notable issues addressed in this fork:

- Unused `motion` package in `app/` (only `framer-motion` is imported).
- Broken ESLint setup in `web/` with no config file.
- Legacy backend metadata drift removed in favor of root TypeScript metadata.
- `loaders.css` / `react-loaders` hoisted at root instead of `app/`.

## Build System

- Primary orchestration: `justfile` (`just setup`, `just dev`, `just build`, `just test`).
- Root scripts: `bun run typecheck`, `bun run build:web`, `bun run ci`.
- CI (`.github/workflows/ci.yml`): TypeScript-centric checks and web build.

## Linting & Testing

- **Biome 2.3.12** at root for lint/format.
- **Vitest** for TypeScript unit tests.
- One Rust integration test for audio capture.

## Documentation

Strong user-facing docs (`README`, Fumadocs site, CONTRIBUTING). Gaps: stale `SECURITY.md` version policy, architecture doc references `routes/generate.py` instead of `generations.py`.

## Security

- Localhost-first by design; no API auth on REST/MCP.
- CORS allowlist with `VOICEBOX_CORS_ORIGINS` extension.
- MCP transcribe gated to loopback callers.
- Tauri capabilities are broad (`fs:read-all`, `csp: null`) — acceptable for local desktop, review before remote deployment.

## Type Safety

- Application UI is TypeScript with `strict: true` in `app/` and `web/`.
- Root `typecheck` originally covered only `app/` and `web/` — extended in this fork.
- Four JavaScript config/script files converted to TypeScript.
- Generated OpenAPI client retains intentional `any` types (Biome warn level).

## Major Weaknesses (Pre-Fork)

1. CI scope should remain focused on TypeScript lint, typecheck, and tests.
2. Missing `package-lock.json` in `.gitignore`.
3. No shared persistence layer for web deployment state/cache.
4. Config files split across JS and TS inconsistently.
5. No structured logging or centralized env configuration on the Node side.

## Recommended Improvements (Implemented)

1. Add root persistence module (`src/redis`) with connection manager, retry, graceful shutdown.
2. Standardize TypeScript configs and extend typecheck to all JS workspaces.
3. Replace broken web ESLint with Biome alignment.
4. Centralize env configuration with Zod-validated schemas.
5. Add structured logging module for Node-side scripts.
6. Redesign README with Mermaid architecture diagrams and operational guides.
7. Expand `.gitignore` and repository hygiene rules.
8. Keep version metadata aligned across all JavaScript/TypeScript workspaces.
