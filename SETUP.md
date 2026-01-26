# Development Setup Guide

This guide will help you set up the Voicebox development environment.

## Prerequisites

- **Bun** - Fast JavaScript runtime and package manager
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **Python 3.11+** - For backend development
  ```bash
  python --version  # Should be 3.11 or higher
  ```

- **Rust** - For Tauri desktop app (installed automatically by Tauri CLI)
  ```bash
  rustc --version  # Check if installed
  ```

- **Node.js 18+** (optional) - Fallback if Bun is not available

## Initial Setup

### 1. Install Dependencies

```bash
# Install all workspace dependencies
bun install
```

This will install dependencies for:
- `app/` - Shared React frontend
- `tauri/` - Tauri desktop wrapper
- `web/` - Web deployment wrapper

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Initialize Database

```bash
cd backend
python -c "from database import init_db; init_db()"
```

This creates the SQLite database at `data/voicebox.db`.

### 4. Install Qwen3-TTS (Optional)

The Qwen3-TTS models are automatically downloaded from HuggingFace Hub on first use. However, you need to install the `qwen_tts` package:

```bash
pip install git+https://github.com/QwenLM/Qwen3-TTS.git
```

**Note:** Models (~2-4GB) will be automatically downloaded on first generation. This may take a few minutes depending on your internet connection.

## Development

### Start Backend Server

```bash
cd backend
source venv/bin/activate  # Activate venv if not already active
uvicorn main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`

### Start Tauri Desktop App

```bash
# From project root
bun run dev
```

Or manually:
```bash
cd tauri
bun run tauri dev
```

This will:
1. Start Vite dev server on port 5173
2. Launch Tauri window pointing to localhost:5173
3. Enable hot reload

### Start Web App

```bash
# From project root
bun run dev:web
```

Or manually:
```bash
cd web
bun run dev
```

Web app will be available at `http://localhost:5174` (or next available port)

## Building

### Build Python Server Binary

```bash
./scripts/build-server.sh
```

This creates a platform-specific binary in `tauri/src-tauri/binaries/`

### Build Tauri Desktop App

```bash
cd tauri
bun run tauri build
```

Creates platform-specific installers:
- macOS: `.app`, `.dmg`
- Windows: `.exe`, `.msi`
- Linux: `.deb`, `.AppImage`

### Build Web App

```bash
cd web
bun run build
```

Output in `web/dist/`

## Generate OpenAPI Client

After starting the backend server:

```bash
./scripts/generate-api.sh
```

This will:
1. Download OpenAPI schema from backend
2. Generate TypeScript client in `app/src/lib/api/`

## Project Structure

```
voicebox/
├── app/              # Shared React frontend
├── tauri/            # Tauri desktop wrapper
├── web/              # Web deployment wrapper
├── backend/          # Python FastAPI server
├── scripts/          # Build and utility scripts
├── data/             # User data (gitignored)
└── docs/             # Documentation
```

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues and solutions.

### Quick Fixes

**Backend won't start:**
- Check Python version: `python --version` (needs 3.11+)
- Ensure virtual environment is activated
- Install dependencies: `pip install -r requirements.txt`

**Tauri build fails:**
- Ensure Rust is installed: `rustc --version`
- Install Tauri CLI: `bunx @tauri-apps/cli install`
- Clean build: `cd tauri/src-tauri && cargo clean`

**OpenAPI client generation fails:**
- Ensure backend is running on port 8000
- Check `curl http://localhost:8000/openapi.json` returns valid JSON

## Model Downloads

Models are automatically downloaded from HuggingFace Hub on first use:
- **Whisper** (transcription): Auto-downloads on first transcription
- **Qwen3-TTS** (voice cloning): Auto-downloads on first generation

First-time usage will be slower due to model downloads, but subsequent runs will use cached models.

## Next Steps

- Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
- Check [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) if you encounter issues
- Review [backend/README.md](backend/README.md) for API documentation
- See [README.md](README.md) for project overview

## Additional Resources

- [Auto-Updater Setup](docs/AUTOUPDATER_QUICKSTART.md) - Configure automatic updates
- [Security Policy](SECURITY.md) - Security reporting and best practices
- [Changelog](CHANGELOG.md) - Version history and changes
