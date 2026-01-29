<p align="center">
  <img src=".github/assets/icon-dark.webp" alt="Voicebox" width="120" height="120" />
</p>

<h1 align="center">Voicebox</h1>

<p align="center">
  <strong>The open-source voice synthesis studio.</strong><br/>
  Clone voices. Generate speech. Build voice-powered apps.<br/>
  All running locally on your machine.
</p>

<p align="center">
  <a href="https://voicebox.sh">voicebox.sh</a> •
  <a href="#download">Download</a> •
  <a href="#features">Features</a> •
  <a href="#api">API</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<br/>

<p align="center">
  <a href="https://voicebox.sh">
    <img src="landing/public/assets/app-screenshot-1.webp" alt="Voicebox App Screenshot" width="800" />
  </a>
</p>

<p align="center">
  <em>Click the image above to watch the demo video on <a href="https://voicebox.sh">voicebox.sh</a></em>
</p>

<br/>

<p align="center">
  <img src="landing/public/assets/app-screenshot-2.webp" alt="Voicebox Screenshot 2" width="800" />
</p>

<p align="center">
  <img src="landing/public/assets/app-screenshot-3.webp" alt="Voicebox Screenshot 3" width="800" />
</p>

<br/>

## What is Voicebox?

Voicebox is a **local-first voice cloning studio** with DAW-like features for professional voice synthesis. Think of it as the **Ollama for voice** — download models, clone voices, and generate speech entirely on your machine.

Unlike cloud services that lock your voice data behind subscriptions, Voicebox gives you:

- **Complete privacy** — models and voice data stay on your machine
- **Professional tools** — multi-track timeline editor, audio trimming, conversation mixing
- **Model flexibility** — currently powered by Qwen3-TTS, with support for XTTS, Bark, and other models coming soon
- **API-first** — use the desktop app or integrate voice synthesis into your own projects
- **Native performance** — built with Tauri (Rust), not Electron

Download a voice model, clone any voice from a few seconds of audio, and compose multi-voice projects with studio-grade editing tools. No Python install required, no cloud dependency, no limits.

---

## Download

Voicebox is available now for macOS and Windows.

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [voicebox_aarch64.app.tar.gz](https://github.com/jamiepine/voicebox/releases/download/v0.1.0/voicebox_aarch64.app.tar.gz) |
| macOS (Intel) | [voicebox_x64.app.tar.gz](https://github.com/jamiepine/voicebox/releases/download/v0.1.0/voicebox_x64.app.tar.gz) |
| Windows (MSI) | [voicebox_0.1.0_x64_en-US.msi](https://github.com/jamiepine/voicebox/releases/download/v0.1.0/voicebox_0.1.0_x64_en-US.msi) |
| Windows (Setup) | [voicebox_0.1.0_x64-setup.exe](https://github.com/jamiepine/voicebox/releases/download/v0.1.0/voicebox_0.1.0_x64-setup.exe) |

> **Linux builds coming soon** — Currently blocked by GitHub runner disk space limitations.

---

## Features

### Voice Cloning with Qwen3-TTS

Powered by Alibaba's **Qwen3-TTS** — a breakthrough model that achieves near-perfect voice cloning from just a few seconds of audio.

- **Instant cloning** — Upload a sample, get a voice profile
- **High fidelity** — Natural prosody, emotion, and cadence
- **Multi-language** — English, Chinese, and more coming

### Voice Profile Management

- **Create profiles** from audio files or record directly in-app
- **Import/Export** profiles to share or backup
- **Multi-sample support** — combine multiple samples for higher quality cloning
- **Organize** with descriptions and language tags

### Speech Generation

- **Text-to-speech** with any cloned voice
- **Batch generation** for long-form content
- **Smart caching** — regenerate instantly with voice prompt caching

### Stories Editor

Create multi-voice narratives, podcasts, and conversations with a timeline-based editor.

- **Multi-track composition** — arrange multiple voice tracks in a single project
- **Inline audio editing** — trim and split clips directly in the timeline
- **Auto-playback** — preview stories with synchronized playhead
- **Voice mixing** — build conversations with multiple participants

### Recording & Transcription

- **In-app recording** with waveform visualization
- **System audio capture** — record desktop audio on macOS and Windows
- **Automatic transcription** powered by Whisper
- **Export recordings** in multiple formats

### Generation History

- **Full history** of all generated audio
- **Search & filter** by voice, text, or date
- **Re-generate** any past generation with one click

### Flexible Deployment

- **Local mode** — Everything runs on your machine
- **Remote mode** — Connect to a GPU server on your network
- **One-click server** — Turn any machine into a Voicebox server

---

## API

Voicebox exposes a full REST API, so you can integrate voice synthesis into your own apps.

```bash
# Generate speech
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "profile_id": "abc123"}'

# List voice profiles
curl http://localhost:8000/api/profiles

# Create a profile from audio
curl -X POST http://localhost:8000/api/profiles \
  -F "audio=@voice-sample.wav" \
  -F "name=My Voice"
```

**Use cases:**

- Game dialogue systems
- Podcast/video production pipelines
- Accessibility tools
- Voice assistants
- Content creation automation

Full API documentation available at `http://localhost:8000/docs` when running.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop App | Tauri (Rust) |
| Frontend | React, TypeScript, Tailwind CSS |
| State | Zustand, React Query |
| Backend | FastAPI (Python) |
| Voice Model | Qwen3-TTS |
| Transcription | Whisper |
| Database | SQLite |
| Audio | WaveSurfer.js, librosa |

**Why this stack?**

- **Tauri over Electron** — 10x smaller bundle, native performance, lower memory
- **FastAPI** — Async Python with automatic OpenAPI schema generation
- **Type-safe end-to-end** — Generated TypeScript client from OpenAPI spec

---

## Roadmap

Voicebox is the beginning of something bigger. Here's what's coming:

### Coming Soon

| Feature | Description |
|---------|-------------|
| **Real-time Synthesis** | Stream audio as it generates, word by word |
| **Conversation Mode** | Multi-speaker dialogues with automatic turn-taking |
| **Voice Effects** | Pitch shift, reverb, M3GAN-style effects |
| **Timeline Editor** | Audio studio with word-level precision editing |
| **More Models** | XTTS, Bark, and other open-source voice models |

### Future Vision

- **Voice Design** — Create new voices from text descriptions
- **Project System** — Save and load complex multi-voice sessions
- **Plugin Architecture** — Extend with custom models and effects
- **Mobile Companion** — Control Voicebox from your phone

Voicebox aims to be the **one-stop shop for everything voice** — cloning, synthesis, editing, effects, and beyond.

---

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup and contribution guidelines.

**Using the Makefile (recommended):** Run `make help` to see all available commands for setup, development, building, and testing.

### Quick Start

**With Makefile (Unix/macOS/Linux):**

```bash
# Clone the repo
git clone https://github.com/voicebox-sh/voicebox.git
cd voicebox

# Setup everything
make setup

# Start development
make dev
```

**Manual setup (all platforms):**

```bash
# Clone the repo
git clone https://github.com/voicebox-sh/voicebox.git
cd voicebox

# Install dependencies
bun install

# Install Python dependencies
cd backend && pip install -r requirements.txt && cd ..

# Start development
bun run dev
```

**Prerequisites:** [Bun](https://bun.sh), [Rust](https://rustup.rs), [Python 3.11+](https://python.org). CUDA-capable GPU recommended (CPU inference supported but slower).

### Project Structure

```
voicebox/
├── app/              # Shared React frontend
├── tauri/            # Desktop app (Tauri + Rust)
├── web/              # Web deployment
├── backend/          # Python FastAPI server
├── landing/          # Marketing website
└── scripts/          # Build & release scripts
```

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

## Security

Found a security vulnerability? Please report it responsibly. See [SECURITY.md](SECURITY.md) for details.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <a href="https://voicebox.sh">voicebox.sh</a>
</p>
