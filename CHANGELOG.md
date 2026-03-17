<!-- This file is compiled automatically during the release workflow. -->
<!-- Do not edit manually — your changes will be overwritten. -->
<!-- To update the draft: ask the agent to use the draft-release-notes skill. -->
<!-- To finalize a release: ask the agent to use the release-bump skill. -->

# Changelog

## [Unreleased]

## [0.3.0] - 2026-03-17

This release rewrites the backend into a modular architecture, overhauls the settings UI into routed sub-pages, fixes audio player freezing, migrates documentation to Fumadocs, and ships a batch of bug fixes targeting the most-reported issues from the tracker.

The backend's 3,000-line monolith `main.py` has been decomposed into domain routers, a services layer, and a proper database package. A style guide and ruff configuration now enforce consistency. On the frontend, settings have been split into dedicated routed pages with server logs, a changelog viewer, and an about page. The audio player no longer freezes mid-playback, and model loading status is now visible in the UI. Seven user-reported bugs have been fixed, including server crashes during sample uploads, generation list staleness, cryptic error messages, and CUDA support for RTX 50-series GPUs.

### Settings Overhaul ([#294](https://github.com/jamiepine/voicebox/pull/294))
- Split settings into routed sub-tabs: General, Generation, GPU, Logs, Changelog, About
- Added live server log viewer with auto-scroll
- Added in-app changelog page that parses `CHANGELOG.md` at build time
- Added About page with version info, license, and generation folder quick-open
- Extracted reusable `SettingRow` component for consistent setting layouts

### Audio Player Fix ([#293](https://github.com/jamiepine/voicebox/pull/293))
- Fixed audio player freezing during playback
- Improved playback UX with better state management and listener cleanup
- Fixed restart race condition during regeneration
- Added stable keys for audio element re-rendering
- Improved accessibility across player controls

### Backend Refactor ([#285](https://github.com/jamiepine/voicebox/pull/285))
- Extracted all routes from `main.py` into 13 domain routers under `backend/routes/` — `main.py` dropped from ~3,100 lines to ~10
- Moved CRUD and service modules into `backend/services/`, platform detection into `backend/utils/`
- Split monolithic `database.py` into a `database/` package with separate `models`, `session`, `migrations`, and `seed` modules
- Added `backend/STYLE_GUIDE.md` and `pyproject.toml` with ruff linting config
- Removed dead code: unused `_get_cuda_dll_excludes`, stale `studio.py`, `example_usage.py`, old `Makefile`
- Deduplicated shared logic across TTS backends into `backends/base.py`
- Improved startup logging with version, platform, data directory, and database stats
- Fixed startup database session leak — sessions now rollback and close in `finally` block
- Isolated shutdown unload calls so one backend failure doesn't block the others
- Handled null duration in `story_items` migration
- Reject model migration when target is a subdirectory of source cache

### Documentation Rewrite ([#288](https://github.com/jamiepine/voicebox/pull/288))
- Migrated docs site from Mintlify to Fumadocs (Next.js-based)
- Rewrote introduction and root page with content from README
- Added "Edit on GitHub" links and last-updated timestamps on all pages
- Generated OpenAPI spec and auto-generated API reference pages
- Removed stale planning docs (`CUDA_BACKEND_SWAP`, `EXTERNAL_PROVIDERS`, `MLX_AUDIO`, `TTS_PROVIDER_ARCHITECTURE`, etc.)
- Sidebar groups now expand by default; root redirects to `/docs`
- Added OG image metadata and `/og` preview page

### UI & Frontend
- Added model loading status indicator and effects preset dropdown ([3187344](https://github.com/jamiepine/voicebox/commit/3187344))
- Fixed take-label race condition during regeneration
- Added accessible focus styling to select component
- Softened select focus indicator opacity
- Addressed 4 critical and 12 major issues from CodeRabbit review

### Bug Fixes ([#295](https://github.com/jamiepine/voicebox/pull/295))
- Fixed sample uploads crashing the server — audio decoding now runs in a thread pool instead of blocking the async event loop ([#278](https://github.com/jamiepine/voicebox/issues/278))
- Fixed generation list not updating when a generation completes — switched to `refetchQueries` for reliable cache busting, added SSE error fallback, and page reset on completion ([#231](https://github.com/jamiepine/voicebox/issues/231))
- Fixed error toasts showing `[object Object]` instead of the actual error message ([#290](https://github.com/jamiepine/voicebox/issues/290))
- Added Whisper model selection (`base`, `small`, `medium`, `large`, `turbo`) and expanded language support to the `/transcribe` endpoint ([#233](https://github.com/jamiepine/voicebox/issues/233))
- Upgraded CUDA backend build from cu121 to cu126 for RTX 50-series (Blackwell) GPU support ([#289](https://github.com/jamiepine/voicebox/issues/289))
- Handled client disconnects in SSE and streaming endpoints to suppress `[Errno 32] Broken Pipe` errors ([#248](https://github.com/jamiepine/voicebox/issues/248))
- Fixed Docker build failure from pip hash mismatch on Qwen3-TTS dependencies ([#286](https://github.com/jamiepine/voicebox/issues/286))
- Added 50 MB upload size limit with chunked reads to prevent unbounded memory allocation on sample uploads
- Eliminated redundant double audio decode in sample processing pipeline

### Platform Fixes
- Replaced `netstat` with `TcpStream` + PowerShell for Windows port detection ([#277](https://github.com/jamiepine/voicebox/pull/277))
- Fixed Docker frontend build and cleaned up Docker docs
- Fixed macOS download links to use `.dmg` instead of `.app.tar.gz`
- Added dynamic download redirect routes to landing site

### Release Tooling
- Added `draft-release-notes` and `release-bump` agent skills
- Wired CI release workflow to extract notes from `CHANGELOG.md` for GitHub Releases
- Backfilled changelog with all historical releases

## [0.2.3] - 2026-03-15

The "it works in dev but not in prod" release. This version fixes a series of PyInstaller bundling issues that prevented model downloading, loading, generation, and progress tracking from working in production builds.

### Model Downloads Now Actually Work

The v0.2.1/v0.2.2 builds could not download or load models that weren't already cached from a dev install. This release fixes the entire chain:

- **Chatterbox, Chatterbox Turbo, and LuxTTS** all download, load, and generate correctly in bundled builds
- **Real-time download progress** — byte-level progress bars now work in production. The root cause: `huggingface_hub` silently disables tqdm progress bars based on logger level, which prevented our progress tracker from receiving byte updates. We now force-enable the internal counter regardless.
- **Fixed Python 3.12.0 `code.replace()` bug** — the macOS build was on Python 3.12.0, which has a [known CPython bug](https://github.com/pyinstaller/pyinstaller/issues/7992) that corrupts bytecode when PyInstaller rewrites code objects. This caused `NameError: name 'obj' is not defined` crashes during scipy/torch imports. Upgraded to Python 3.12.13.

### PyInstaller Fixes

- Collect all `inflect` files — `typeguard`'s `@typechecked` decorator calls `inspect.getsource()` at import time, which needs `.py` source files, not just bytecode. Fixes LuxTTS "could not get source code" error.
- Collect all `perth` files — bundles the pretrained watermark model (`hparams.yaml`, `.pth.tar`) needed by Chatterbox at runtime
- Collect all `piper_phonemize` files — bundles `espeak-ng-data/` (phoneme tables, language dicts) needed by LuxTTS for text-to-phoneme conversion
- Set `ESPEAK_DATA_PATH` in frozen builds so the espeak-ng C library finds the bundled data instead of looking at `/usr/share/espeak-ng-data/`
- Collect all `linacodec` files — fixes `inspect.getsource` error in Vocos codec
- Collect all `zipvoice` files — fixes source code lookup in LuxTTS voice cloning
- Copy metadata for `requests`, `transformers`, `huggingface-hub`, `tokenizers`, `safetensors`, `tqdm` — fixes `importlib.metadata` lookups in frozen binary
- Add hidden imports for `chatterbox`, `chatterbox_turbo`, `luxtts`, `zipvoice` backends
- Add `multiprocessing.freeze_support()` to fix resource_tracker subprocess crash in frozen binary
- `--noconsole` now only applied on Windows — macOS/Linux need stdout/stderr for Tauri sidecar log capture
- Hardened `sys.stdout`/`sys.stderr` devnull redirect to test writability, not just `None` check

### Updater

- Fixed updater artifact generation with `v1Compatible` for `tauri-action` signature files
- Updated `tauri-action` to v0.6 to fix updater JSON and `.sig` generation

### Other Fixes

- Full traceback logging on all backend model loading errors (was just `str(e)` before)

## [0.2.2] - 2026-03-15

- Fix Chatterbox model support in bundled builds
- Fix LuxTTS/ZipVoice support in bundled builds
- Auto-update CUDA binary when app version changes
- CUDA download progress bar
- Fix server process staying alive on macOS (SIGHUP handling, watchdog grace period)
- Hide console window when running CUDA binary on Windows

## [0.2.1] - 2026-03-15

Voicebox v0.1.x was a single-engine voice cloning app built around Qwen3-TTS. v0.2.0 is a ground-up rethink: four TTS engines, 23 languages, paralinguistic emotion controls, a post-processing effects pipeline, unlimited generation length, an async generation queue, and support for every major GPU vendor. Plus Docker.

### New TTS Engines

#### Multi-Engine Architecture

Voicebox now runs **four independent TTS engines** behind a thread-safe per-engine backend registry. Switch engines per-generation from a single dropdown — no restart required.

| Engine                      | Languages | Size    | Key Strengths                                 |
| --------------------------- | --------- | ------- | --------------------------------------------- |
| **Qwen3-TTS 1.7B**          | 10        | ~3.5 GB | Highest quality, delivery instructions        |
| **Qwen3-TTS 0.6B**          | 10        | ~1.2 GB | Lighter, faster variant                       |
| **LuxTTS**                  | English   | ~300 MB | CPU-friendly, 48 kHz output, 150x realtime    |
| **Chatterbox Multilingual** | 23        | ~3.2 GB | Broadest language coverage, zero-shot cloning |
| **Chatterbox Turbo**        | English   | ~1.5 GB | 350M params, low latency, paralinguistic tags |

#### Chatterbox Multilingual — 23 Languages ([#257](https://github.com/jamiepine/voicebox/pull/257))

Zero-shot voice cloning in Arabic, Chinese, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Italian, Japanese, Korean, Malay, Norwegian, Polish, Portuguese, Russian, Spanish, Swahili, Swedish, and Turkish.

#### LuxTTS — Lightweight English TTS ([#254](https://github.com/jamiepine/voicebox/pull/254))

A fast, CPU-friendly English engine. ~300 MB download, 48 kHz output, runs at 150x realtime on CPU.

#### Chatterbox Turbo — Expressive English ([#258](https://github.com/jamiepine/voicebox/pull/258))

A fast 350M-parameter English model with inline paralinguistic tags.

#### Paralinguistic Tags Autocomplete ([#265](https://github.com/jamiepine/voicebox/pull/265))

Type `/` in the text input with Chatterbox Turbo selected to open an autocomplete for **9 expressive tags**: `[laugh]` `[chuckle]` `[gasp]` `[cough]` `[sigh]` `[groan]` `[sniff]` `[shush]` `[clear throat]`

### Generation

#### Unlimited Generation Length — Auto-Chunking ([#266](https://github.com/jamiepine/voicebox/pull/266))

Long text is now automatically split at sentence boundaries, generated per-chunk, and crossfaded back together. Engine-agnostic.

- Auto-chunking limit slider — 100–5,000 chars (default 800)
- Crossfade slider — 0–200ms (default 50ms)
- Max text length raised to 50,000 characters
- Smart splitting respects abbreviations, CJK punctuation, and `[tags]`

#### Asynchronous Generation Queue ([#269](https://github.com/jamiepine/voicebox/pull/269))

Generation is now fully non-blocking. Serial execution queue prevents GPU contention. Real-time SSE status streaming.

#### Generation Versions

Every generation now supports multiple versions with provenance tracking — original, effects versions, takes, source tracking, version pinning in stories, and favorites.

### Post-Processing Effects ([#271](https://github.com/jamiepine/voicebox/pull/271))

A full audio effects system powered by Spotify's `pedalboard` library: Pitch Shift, Reverb, Delay, Chorus/Flanger, Compressor, Gain, High-Pass Filter, Low-Pass Filter. 4 built-in presets, custom presets, per-profile default effects, and live preview.

### Platform Support

- **Windows Support** ([#272](https://github.com/jamiepine/voicebox/pull/272)) — Full Windows support with CUDA GPU detection
- **Linux** ([#262](https://github.com/jamiepine/voicebox/pull/262)) — AMD ROCm, NVIDIA GBM fix, WebKitGTK mic access (build from source)
- **NVIDIA CUDA Backend Swap** ([#252](https://github.com/jamiepine/voicebox/pull/252)) — Download and swap in CUDA backend from within the app
- **Intel Arc (XPU) and DirectML** — PyTorch backend supports Intel Arc and DirectML
- **Docker + Web Deployment** ([#161](https://github.com/jamiepine/voicebox/pull/161)) — 3-stage build, non-root runtime, health checks
- **Whisper Turbo** — Added `openai/whisper-large-v3-turbo` as a transcription model option

### Model Management ([#268](https://github.com/jamiepine/voicebox/pull/268))

Per-model unload, custom models directory, model folder migration, download cancel/clear UI ([#238](https://github.com/jamiepine/voicebox/pull/238)), restructured settings UI.

### Security & Reliability

- CORS hardening ([#88](https://github.com/jamiepine/voicebox/pull/88))
- Network access toggle ([#133](https://github.com/jamiepine/voicebox/pull/133))
- Offline crash fix ([#152](https://github.com/jamiepine/voicebox/pull/152))
- Atomic audio saves ([#263](https://github.com/jamiepine/voicebox/pull/263))
- Filesystem health endpoint
- Chatterbox float64 dtype fix ([#264](https://github.com/jamiepine/voicebox/pull/264))

### Accessibility ([#243](https://github.com/jamiepine/voicebox/pull/243))

Screen reader support, keyboard navigation, state-aware `aria-label` attributes on all interactive controls.

### UI Polish

- Redesigned landing page ([#274](https://github.com/jamiepine/voicebox/pull/274))
- Voices tab overhaul with inline inspector
- Responsive layout improvements
- Duplicate profile name validation ([#175](https://github.com/jamiepine/voicebox/pull/175))

### Community Contributors

[@haosenwang1018](https://github.com/haosenwang1018), [@Balneario-de-Cofrentes](https://github.com/Balneario-de-Cofrentes), [@ageofalgo](https://github.com/ageofalgo), [@mikeswann](https://github.com/mikeswann), [@rayl15](https://github.com/rayl15), [@mpecanha](https://github.com/mpecanha), [@ways2read](https://github.com/ways2read), [@ieguiguren](https://github.com/ieguiguren), [@Vaibhavee89](https://github.com/Vaibhavee89), [@pandego](https://github.com/pandego), [@luminest-llc](https://github.com/luminest-llc)

## [0.1.13] - 2026-02-23

### Stability and reliability

- [#95](https://github.com/jamiepine/voicebox/pull/95) Fix: selecting 0.6B model still downloads and uses 1.7B
- [#93](https://github.com/jamiepine/voicebox/pull/93) fix(mlx): bundle native libs and broaden error handling for Apple Silicon
- [#79](https://github.com/jamiepine/voicebox/pull/79) fix: handle non-ASCII filenames in Content-Disposition headers
- [#78](https://github.com/jamiepine/voicebox/pull/78) fix: guard getUserMedia call against undefined mediaDevices in non-secure contexts
- [#77](https://github.com/jamiepine/voicebox/pull/77) fix: await for confirmation before deleting voices and channels
- [#128](https://github.com/jamiepine/voicebox/pull/128) fix: resolve multiple issues (#96, #119, #111, #108, #121, #125, #127)
- [#40](https://github.com/jamiepine/voicebox/pull/40) Fix: audio export path resolution

### Build and packaging

- [#122](https://github.com/jamiepine/voicebox/pull/122) fix(web): add @tailwindcss/vite plugin to web config
- [#126](https://github.com/jamiepine/voicebox/pull/126) Create requirements.txt

### UX and docs

- [#44](https://github.com/jamiepine/voicebox/pull/44) Enhances floating generate box UX
- [#57](https://github.com/jamiepine/voicebox/pull/57) chore: updates repo URL in README
- [#146](https://github.com/jamiepine/voicebox/pull/146) Add Spacebot banner to landing page
- [#1](https://github.com/jamiepine/voicebox/pull/1) Improvements

## [0.1.12] - 2026-01-31

### Model Download UX Overhaul

- Real-time download progress tracking with accurate percentage and speed info
- No more downloading notifications during generation even when its not downloading
- Better error handling and status reporting throughout the download process

### Other Improvements

- Enhanced health check endpoint with GPU type information
- Improved model caching verification
- More reliable SSE progress updates
- Actual update notifications — no need to manually check in settings anymore

## [0.1.11] - 2026-01-30

- Fixed transcriptions on MLX
- Fixed model download progress (finally)

## [0.1.10] - 2026-01-30

### Faster generation on Apple Silicon

Massive speed gains, from around 20s per generation to 2-3s. Added native MLX backend support for Apple Silicon, providing significantly faster TTS and STT generation on M-series macOS machines.

- **MLX Backend** — New backend implementation optimized for Apple Silicon using MLX framework
- **Dynamic Backend Selection** — Automatically detects platform and selects between MLX (macOS) and PyTorch (other platforms)
- Refactored TTS and STT logic into modular backend implementations
- Updated build process to include MLX-specific dependencies for macOS builds

## [0.1.9] - 2026-01-30

### Improved voice profile creation flow

- Voice create drafts: No longer lose work if you close the modal
- Fixed whisper only transcribing English or Chinese, now has support for all languages

### Improved Stories editor

- Added spacebar for play/pause
- Timeline now auto-scrolls to follow playhead during playback
- Fixed misalignment of the items with mouse when picking up
- Fixed hitbox for selecting an item
- Fixed playhead jumping forward when pressing play

### Generation box improvements

- Instruct mode no longer wipes prompt text
- Improved UI cleanliness

### Misc

- Fixed "Model downloading" toast during generation when model is already downloaded

## [0.1.8] - 2026-01-29

### Model Download Timeout Issues

Fixed critical issue where model downloads would fail with "Failed to fetch" errors on Windows. Refactored download endpoints to return immediately and continue downloads in background.

### Cross-Platform Cache Path Issues

Fixed hardcoded `~/.cache/huggingface/hub` paths that don't work on Windows. All cache paths now use `hf_constants.HF_HUB_CACHE` for proper cross-platform support.

### Windows Process Management

- Added `/shutdown` endpoint for graceful server shutdown on Windows
- Added `gpu_type` field to health check response

## [0.1.7] - 2026-01-29

- Trim and split audio clips in Story Editor
- Auto-activation of stories in Story Editor with visible playhead
- Conditional auto-play support in AudioPlayer for better user control
- Refactored audio loading across HistoryTable, SampleList, and generation forms
- Audio now only auto-plays when explicitly intended, preventing unexpected playback

## [0.1.6] - 2026-01-29

### Introducing Stories

A full voice editor for composing podcasts and generated conversations.

- **Stories Editor** — Create multi-voice narratives, podcasts, or conversations with a timeline-based editor
- Compose tracks with different voices
- Edit and arrange audio segments inline
- Build generated conversations with multiple participants
- **Improved Voice Generation UI** — Auto-resizing input, default voice selection, better layout
- **Track Editor Integration** — Inline track editing within story items

## [0.1.5] - 2026-01-28

Fixed recording length limit at 0:29 to auto stop instead of passing the limit and getting an error, which would cause users to lose their recording.

## [0.1.4] - 2026-01-28

- Audio channel management system
- Native audio playback handling in AudioPlayer component
- Refactored ConnectionForm and Checkbox components
- Improved layout consistency and responsiveness
- Added safe area constants for better responsive design

## [0.1.3] - 2026-01-27

- Improved the generate textbox
- Maybe fixed Windows autoupdate restarting entire computer

## [0.1.2] - 2026-01-27

### Audio Capture & Format Conversion

- Added audio format conversion util
- Enhanced system audio capture on macOS and Windows
- Improved audio recording hooks
- Added audio input entitlement for macOS
- Added audio capture tests

### Update System

- Enhanced auto-updater functionality and update status display

## [0.1.1] - 2026-01-27

### Platform Support

- **macOS Audio Capture** — Native audio capture support for sample creation
- **Windows Audio Capture** — WASAPI implementation with improved thread safety
- **Linux Support** — Temporarily removed builds due to runner disk space constraints

### Audio Features

- Play/pause for audio samples across all components
- Three new sample components: Recording, System capture, Upload with drag-and-drop
- Audio validation, error handling, and consistent cleanup

### Voice Profile Management

- Profile import with file size validation (100MB limit)
- Enhanced profile form with new audio sample components
- Drag-and-drop support for audio file uploads

### Server Management

- Changed default URL from `localhost:8000` to `127.0.0.1:17493`
- Server reuse logic, "keep server running" preference, orphaned process handling

### Build & Release

- Added `.bumpversion.cfg` for automated version management
- Enhanced icon generation script for multi-size Windows icons

### Bug Fixes

- Fixed date formatting for timezone-less date strings
- Fixed getLatestRelease file filtering
- Improved audio duration metadata on Windows

## [0.1.0] - 2026-01-27

The first public release of Voicebox — an open-source voice synthesis studio powered by Qwen3-TTS.

### Voice Cloning with Qwen3-TTS

- Automatic model download from HuggingFace
- Multiple model sizes (1.7B and 0.6B)
- Voice prompt caching for instant regeneration
- English and Chinese support

### Voice Profile Management

- Create profiles from audio files or record directly in the app
- Multiple samples per profile for higher quality cloning
- Import/Export profiles
- Automatic transcription via Whisper

### Speech Generation

- Simple text-to-speech with profile selection
- Seed control for reproducible generations
- Long-form support up to 5,000 characters

### Generation History

- Full history with metadata
- Search by text content
- Inline playback and download

### Flexible Deployment

- Local mode with bundled backend
- Remote mode for GPU servers on your network
- One-click server setup

### Desktop Experience

- Built with Tauri v2 (Rust) — native performance, not Electron
- Cross-platform: macOS and Windows
- No Python installation required

### Tech Stack

Tauri v2, React, TypeScript, Tailwind CSS, FastAPI, Qwen3-TTS, Whisper, SQLite

[Unreleased]: https://github.com/jamiepine/voicebox/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/jamiepine/voicebox/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/jamiepine/voicebox/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/jamiepine/voicebox/compare/v0.1.13...v0.2.1
[0.1.13]: https://github.com/jamiepine/voicebox/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/jamiepine/voicebox/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/jamiepine/voicebox/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/jamiepine/voicebox/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/jamiepine/voicebox/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/jamiepine/voicebox/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/jamiepine/voicebox/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/jamiepine/voicebox/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/jamiepine/voicebox/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/jamiepine/voicebox/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/jamiepine/voicebox/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/jamiepine/voicebox/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jamiepine/voicebox/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jamiepine/voicebox/releases/tag/v0.1.0
