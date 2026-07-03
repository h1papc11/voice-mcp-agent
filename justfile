set windows-shell := ["powershell", "-NoProfile", "-Command"]

# Install dependencies
setup:
    bun install

# Development
[unix]
dev:
    bun run dev:web

[windows]
dev:
    bun run dev:web

[unix]
dev-web:
    cd web && bun run dev

[windows]
dev-web:
    Set-Location web; bun run dev

[unix]
dev-landing:
    cd landing && bun run dev

[windows]
dev-landing:
    Set-Location landing; bun run dev

# Build
build:
    bun run build

build-web:
    bun run build:web

build-landing:
    bun run build:landing

# Quality
check:
    bun run check

typecheck:
    bun run typecheck

test:
    bun run test

ci:
    bun run ci

# Cleanup
[unix]
clean:
    rm -rf dist
    rm -rf web/dist
    rm -rf landing/.next

[windows]
clean:
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "web/dist") { Remove-Item -Recurse -Force "web/dist" }
    if (Test-Path "landing/.next") { Remove-Item -Recurse -Force "landing/.next" }
