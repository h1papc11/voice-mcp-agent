# Contributing

## Development Setup

```bash
just setup
just dev
```

## Quality Checks

Run these commands before opening a pull request:

```bash
bun run typecheck
bun run check
bun run test
```

## Standards

- Keep changes TypeScript-first across `app`, `web`, `landing`, and root `src`.
- Follow Biome formatting and lint rules.
- Prefer small, focused PRs with clear commit messages.
