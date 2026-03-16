# Voicebox v0.2.0 -- Release Notes

## The story

Voicebox v0.1.x shipped as a single-engine voice cloning app built around Qwen3-TTS. It worked, but it was limited: one model family, 10 languages, English-centric emotion, a synchronous generation pipeline that locked the UI, and a hard ceiling on how much text you could generate at once.

v0.2.0 is a ground-up rethink. Voicebox is now a **multi-engine voice cloning platform**. Four TTS engines. 23 languages. Expressive paralinguistic controls. A full post-processing effects pipeline. Unlimited generation length. Asynchronous everything. And it runs on every major GPU vendor -- NVIDIA, AMD, Intel Arc, Apple Silicon -- plus Docker for headless deployment.

This is the release where Voicebox stops being a proof of concept and starts being a real tool.

---

## Major New Features

### Multi-Engine Architecture
Voicebox now supports **four TTS engines**, each with different strengths. Switch between them per-generation from a single unified interface:

| Engine | Languages | Strengths |
|--------|-----------|-----------|
| **Qwen3-TTS** (0.6B / 1.7B) | 10 | High-quality multilingual cloning, delivery instructions ("speak slowly", "whisper") |
| **LuxTTS** | English | Lightweight (~1GB VRAM), 48kHz output, 150x realtime on CPU |
| **Chatterbox Multilingual** | 23 | Broadest language coverage -- Arabic, Danish, Finnish, Greek, Hebrew, Hindi, Malay, Norwegian, Polish, Swahili, Swedish, Turkish and more |
| **Chatterbox Turbo** | English | Fast 350M model with paralinguistic emotion/sound tags |

### Emotions and Paralinguistic Tags (Chatterbox Turbo)
Type `/` in the text input to open an autocomplete for **9 expressive tags** that the model synthesizes inline with speech:

`[laugh]` `[chuckle]` `[gasp]` `[cough]` `[sigh]` `[groan]` `[sniff]` `[shush]` `[clear throat]`

Tags render as inline badges in a rich text editor and serialize cleanly to the API. This makes generated speech sound natural and expressive in a way that plain TTS can't.

### 23 Languages via Chatterbox Multilingual
The Chatterbox Multilingual engine brings zero-shot voice cloning to **23 languages**: Arabic, Chinese, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Italian, Japanese, Korean, Malay, Norwegian, Polish, Portuguese, Russian, Spanish, Swahili, Swedish, and Turkish. The language dropdown dynamically filters to show only languages supported by the selected engine.

### Unlimited Generation Length (Auto-Chunking)
Previously, long text would hit model context limits and degrade. Now, text is **automatically split at sentence boundaries** and each chunk is generated independently, then crossfaded back together. This is fully engine-agnostic and works with all four engines.

- **Auto-chunking limit slider** (100-5,000 chars, default 800) -- controls when text gets split
- **Crossfade slider** (0-200ms, default 50ms) -- blends chunk boundaries smoothly, or set to 0 for a hard cut
- **Max text length raised to 50,000 characters** -- generate entire scripts, chapters, or articles in one go
- Smart splitting respects abbreviations (Dr., e.g., a.m.), CJK punctuation, and never breaks inside paralinguistic `[tags]`

### Asynchronous Generation Queue
Generation is now fully **non-blocking**. Submit a generation and immediately start typing the next one -- no more frozen UI waiting for inference to complete.

- Serial execution queue prevents GPU contention across all backends
- Real-time SSE status streaming (`generating` -> `completed` / `failed`)
- Failed generations can be retried without re-entering text
- Stale generations from crashes are auto-recovered on startup
- Generating status pill shown inline in the story editor

### Post-Processing Effects Pipeline
A full audio effects system powered by Spotify's `pedalboard` library. Apply effects after generation, preview them in real time, and build reusable presets -- all without leaving the app.

**8 effects available:**

| Effect | What it does |
|--------|-------------|
| **Pitch Shift** | Shift pitch up or down by up to 12 semitones |
| **Reverb** | Room reverb with configurable size, damping, and wet/dry mix |
| **Delay** | Echo with adjustable delay time, feedback, and mix |
| **Chorus / Flanger** | Modulated delay -- short for metallic flanger, longer for lush chorus |
| **Compressor** | Dynamic range compression with threshold, ratio, attack, and release |
| **Gain** | Volume adjustment from -40 to +40 dB |
| **High-Pass Filter** | Remove low frequencies below a configurable cutoff |
| **Low-Pass Filter** | Remove high frequencies above a configurable cutoff |

**Effects presets** -- Four built-in presets ship out of the box (Robotic, Radio, Echo Chamber, Deep Voice), and you can create unlimited custom presets. Presets are drag-and-drop chains of effects with per-parameter sliders.

**Per-profile default effects** -- Assign an effects chain to a voice profile and it applies automatically to every generation with that voice. Override per-generation from the generate box.

**Live preview** -- Audition any effects chain against an existing generation before committing. The preview streams processed audio without saving anything.

### Generation Versions
Every generation now supports **multiple versions** with full provenance tracking:

- **Original** -- the clean, unprocessed TTS output (always preserved)
- **Effects versions** -- apply different effects chains to create new versions from any source version
- **Takes** -- regenerate with the same text and voice but a new seed for variation
- **Source tracking** -- each version records which version it was derived from
- **Version pinning in stories** -- pin a specific version to a track clip in the story editor, independent of the generation's default
- **Favorites** -- star generations to mark them for quick access

---

## New Platform Support

### Linux (Native)
Full Linux support with `.deb` and `.rpm` packages. Includes PulseAudio/PipeWire audio capture for voice sample recording.

### AMD ROCm GPU Acceleration
AMD GPU users now get hardware-accelerated inference via ROCm, with automatic `HSA_OVERRIDE_GFX_VERSION` configuration for GPUs not officially in the ROCm compatibility list (e.g., RX 6600).

### NVIDIA CUDA Backend Swap
The CPU-only release can download and swap in a CUDA-accelerated backend binary from within the app -- no reinstall required. Handles GitHub's 2GB asset limit by downloading split parts and verifying SHA-256 checksums.

### Intel Arc (XPU) and DirectML
PyTorch backend also supports Intel Arc GPUs via IPEX/XPU and Windows any-GPU via DirectML.

### Docker + Web Deployment
Run Voicebox headless as a Docker container with the full web UI:
```bash
docker compose up
```
3-stage build, non-root runtime, health checks, persistent model cache across rebuilds. Binds to localhost only by default.

---

## Model Management
- **Per-model unload** -- free GPU memory without deleting downloaded models
- **Custom models directory** -- set `VOICEBOX_MODELS_DIR` to store models anywhere
- **Model folder migration** -- move all models to a new location with progress tracking
- **Whisper Turbo** -- added `openai/whisper-large-v3-turbo` as a transcription model option
- **Download cancel/clear UI** -- cancel in-progress downloads, VS Code-style problems panel for errors

---

## Security
- **CORS hardening** -- replaced wildcard `*` with an explicit allowlist of local origins; extensible via `VOICEBOX_CORS_ORIGINS` env var
- **Network access toggle** -- fully disable outbound network requests for air-gapped deployments

## Accessibility
- Comprehensive screen reader support (tested with NVDA/Narrator) across all major UI surfaces
- Keyboard navigation for voice cards, history rows, model management, and story editor
- State-aware `aria-label` attributes on all interactive controls

## Reliability
- **Atomic audio saves** -- two-phase write prevents corrupted files on crash/interrupt
- **Filesystem health endpoint** -- proactive disk space and directory writability checks
- **Errno-specific error messages** -- clear feedback for permission denied, disk full, missing directory

## UX Polish
- Responsive layout with horizontal-scroll voice cards on mobile
- App version shown in sidebar
- Voice card heights normalized
- Audio player title hidden at narrow widths to prevent overflow

---

## Installation

| Platform | Download |
|----------|----------|
| **macOS (Apple Silicon)** | `Voicebox_0.2.0_aarch64.dmg` |
| **macOS (Intel)** | `Voicebox_0.2.0_x64.dmg` |
| **Windows** | `Voicebox_0.2.0_x64_en-US.msi` or `x64-setup.exe` |
| **Linux** | `.deb` / `.rpm` packages |
| **Docker** | `docker compose up` |

The app includes automatic updates -- future patches will be installed automatically.

---

## Video Script Beats

For the marketing video, focus on these six beats:

1. **"Four engines, one app"** -- show the engine dropdown switching between Qwen, LuxTTS, Chatterbox, and Turbo
2. **"23 languages"** -- generate the same voice clone in Arabic, Japanese, Hindi, etc.
3. **"Make it expressive"** -- type `/laugh` and `/sigh` with Chatterbox Turbo, play back the result
4. **"Shape your sound"** -- apply the Robotic or Deep Voice preset, preview it live, then build a custom effects chain with drag-and-drop
5. **"No limits"** -- paste a long script, show it auto-chunk and generate seamlessly
6. **"Queue and go"** -- fire off multiple generations back-to-back without waiting
