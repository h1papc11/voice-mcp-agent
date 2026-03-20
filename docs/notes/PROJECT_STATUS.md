# Voicebox Project Status & Roadmap

> Last updated: 2026-03-18 | Current version: **v0.3.0** | 13.4k stars | ~136 open issues | 9 open PRs

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Current State](#current-state)
3. [Open PRs — Triage & Analysis](#open-prs--triage--analysis)
4. [Open Issues — Categorized](#open-issues--categorized)
5. [Existing Plan Documents — Status](#existing-plan-documents--status)
6. [New Model Integration — Landscape](#new-model-integration--landscape)
7. [Architectural Bottlenecks](#architectural-bottlenecks)
8. [Recommended Priorities](#recommended-priorities)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Tauri Shell (Rust)                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  React Frontend (app/)                        │  │
│  │  Zustand stores · API client · Generation UI  │  │
│  │  Stories Editor · Voice Profiles · Model Mgmt │  │
│  └──────────────────────┬────────────────────────┘  │
│                         │ HTTP :17493                │
│  ┌──────────────────────▼────────────────────────┐  │
│  │  FastAPI Backend (backend/)                   │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │ TTSBackend Protocol                     │  │  │
│  │  │  ┌──────────┐ ┌───────┐ ┌───────────┐  │  │  │
│  │  │  │ Qwen3-TTS│ │LuxTTS │ │Chatterbox │  │  │  │
│  │  │  │(Py/MLX)  │ │       │ │(MTL+Turbo)│  │  │  │
│  │  │  └──────────┘ └───────┘ └───────────┘  │  │  │
│  │  │  ┌──────────┐                           │  │  │
│  │  │  │ TADA     │                           │  │  │
│  │  │  │(1B / 3B) │                           │  │  │
│  │  │  └──────────┘                           │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │  ┌───────────┐  ┌─────────┐                   │  │
│  │  │ STTBackend│  │ Profiles│                   │  │
│  │  │ (Whisper) │  │ History │                   │  │
│  │  └───────────┘  │ Stories │                   │  │
│  │                  └─────────┘                   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Key Files

| Layer | File | Purpose |
|-------|------|---------|
| Backend entry | `backend/main.py` | FastAPI app, all API routes (~2850 lines) |
| TTS protocol | `backend/backends/__init__.py:32-101` | `TTSBackend` Protocol definition |
| Model registry | `backend/backends/__init__.py:17-29,153-366` | `ModelConfig` dataclass + registry helpers |
| TTS factory | `backend/backends/__init__.py:382-426` | Thread-safe engine registry (double-checked locking) |
| PyTorch TTS | `backend/backends/pytorch_backend.py` | Qwen3-TTS via `qwen_tts` package |
| MLX TTS | `backend/backends/mlx_backend.py` | Qwen3-TTS via `mlx_audio.tts` |
| LuxTTS | `backend/backends/luxtts_backend.py` | LuxTTS — fast, CPU-friendly |
| Chatterbox MTL | `backend/backends/chatterbox_backend.py` | Chatterbox Multilingual — 23 languages |
| Chatterbox Turbo | `backend/backends/chatterbox_turbo_backend.py` | Chatterbox Turbo — English, paralinguistic tags |
| TADA | `backend/backends/hume_backend.py` | HumeAI TADA — 1B English + 3B Multilingual |
| Platform detect | `backend/platform_detect.py` | Apple Silicon → MLX, else → PyTorch |
| API types | `backend/models.py` | Pydantic request/response models |
| HF progress | `backend/utils/hf_progress.py` | HFProgressTracker (tqdm patching for download progress) |
| Audio utils | `backend/utils/audio.py` | `trim_tts_output()`, normalize, load/save audio |
| Frontend API | `app/src/lib/api/client.ts` | Hand-written fetch wrapper |
| Frontend types | `app/src/lib/api/types.ts` | TypeScript API types |
| Engine selector | `app/src/components/Generation/EngineModelSelector.tsx` | Shared engine/model dropdown |
| Generation form | `app/src/components/Generation/GenerationForm.tsx` | TTS generation UI |
| Floating gen box | `app/src/components/Generation/FloatingGenerateBox.tsx` | Compact generation UI |
| Model manager | `app/src/components/ServerSettings/ModelManagement.tsx` | Model download/status/progress UI |
| GPU acceleration | `app/src/components/ServerSettings/GpuAcceleration.tsx` | CUDA backend swap UI |
| Gen form hook | `app/src/lib/hooks/useGenerationForm.ts` | Form validation + submission |
| Language constants | `app/src/lib/constants/languages.ts` | Per-engine language maps |

### How TTS Generation Works (Current Flow)

```
POST /generate
  1. Look up voice profile from DB
  2. Resolve engine from request (qwen | luxtts | chatterbox | chatterbox_turbo | tada)
  3. Get backend: get_tts_backend_for_engine(engine)  # thread-safe singleton per engine
  4. Check model cache → if missing, trigger background download, return HTTP 202
  5. Load model (lazy): tts_backend.load_model(model_size)
  6. Create voice prompt: profiles.create_voice_prompt_for_profile(engine=engine)
       → tts_backend.create_voice_prompt(audio_path, reference_text)
  7. Generate: tts_backend.generate(text, voice_prompt, language, seed, instruct)
  8. Post-process: trim_tts_output() for Chatterbox engines
  9. Save WAV → data/generations/{id}.wav
  10. Insert history record in SQLite
  11. Return GenerationResponse
```

---

## Current State

### What's Shipped (v0.3.0)

**Core TTS:**
- Qwen3-TTS voice cloning (1.7B and 0.6B models)
- MLX backend for Apple Silicon, PyTorch for everything else
- Multi-engine TTS architecture with thread-safe backend registry (PR #254)
- LuxTTS integration — fast, CPU-friendly English TTS (PR #254)
- Chatterbox Multilingual TTS — 23 languages including Hebrew (PR #257)
- Chatterbox Turbo — paralinguistic tags, low latency English (PR #258)
- HumeAI TADA integration — 1B English + 3B Multilingual speech-language model (PR #296)
- Chunked TTS generation for long text — engine-agnostic, removes ~500 char limit (PR #266)
- Async generation queue (PR #269)
- Post-processing audio effects system (PR #271)
- Centralized model config registry (`ModelConfig` dataclass) — no per-engine dispatch maps
- Shared `EngineModelSelector` component — engine/model dropdown defined once, used in both generation forms

**Infrastructure:**
- CUDA backend swap via binary download and restart (PR #252), upgraded to cu128 (PR #316)
- CUDA backend split into independently versioned server + libs archives (PR #298)
- Docker + web deployment (PR #161)
- Backend refactor: modular architecture, style guide, tooling (PR #285)
- Settings overhaul: routed sub-tabs, server logs, changelog, about page (PR #294)
- Windows support: CUDA detection, cross-platform justfile, clean server shutdown (PR #272)
- Voice profiles with multi-sample support
- Stories editor (multi-track DAW timeline)
- Whisper transcription (base, small, medium, large variants)
- Model management UI with inline download progress bars + folder migration (PR #268)
- Download cancel/clear UI with error panel (PR #238)
- Generation history with caching
- Streaming generation endpoint (MLX only)
- Audio player freeze fix + UX improvements (PR #293)
- CORS restriction to known local origins (PR #88)

### Abandoned Integrations

| Model | PR | Reason |
|-------|----|--------|
| **CosyVoice2/3** | PR #311 | Output quality too poor. Heavy deps, no PyPI, needed 5+ shims. |

### What's In-Flight

| Feature | Branch/PR | Status |
|---------|-----------|--------|
| Kokoro 82M TTS engine | WIP | In development — 82M CPU-realtime engine, 8 languages |

### TTS Engine Comparison

| Engine | Model Name | Languages | Size | Key Features | Instruct Support |
|--------|-----------|-----------|------|-------------|-----------------|
| Qwen3-TTS 1.7B | `qwen-tts-1.7B` | 10 (zh, en, ja, ko, de, fr, ru, pt, es, it) | ~3.5 GB | Highest quality, voice cloning | None (Base model has no instruct path) |
| Qwen3-TTS 0.6B | `qwen-tts-0.6B` | 10 | ~1.2 GB | Lighter, faster | None |
| LuxTTS | `luxtts` | English | ~300 MB | CPU-friendly, 48 kHz, fast | None |
| Chatterbox | `chatterbox-tts` | 23 (incl. Hebrew, Arabic, Hindi, etc.) | ~3.2 GB | Zero-shot cloning, multilingual | Partial — `exaggeration` float (0-1) for expressiveness |
| Chatterbox Turbo | `chatterbox-turbo` | English | ~1.5 GB | Paralinguistic tags ([laugh], [cough]), 350M params, low latency | Partial — inline tags only, no separate instruct param |
| TADA 1B | `tada-1b` | English | ~4 GB | HumeAI speech-language model, 700s+ coherent audio | None |
| TADA 3B Multilingual | `tada-3b-ml` | 10 (en, ar, zh, de, es, fr, it, ja, pl, pt) | ~8 GB | Multilingual, text-acoustic dual alignment | None |
| Kokoro 82M | `kokoro` | 8 (en, es, fr, hi, it, pt, ja, zh) | ~350 MB | 82M params, CPU realtime, Apache 2.0, pre-built voices | None |

### Multi-Engine Architecture (Shipped)

The singleton TTS backend blocker described in the previous version of this doc has been **resolved**. The architecture now supports:

- **Thread-safe backend registry** (`_tts_backends` dict + `_tts_backends_lock`) with double-checked locking
- **Per-engine backend instances** — each engine gets its own singleton, loaded lazily
- **Engine field on GenerationRequest** — frontend sends `engine: 'qwen' | 'luxtts' | 'chatterbox' | 'chatterbox_turbo' | 'tada'`
- **Per-engine language filtering** — `ENGINE_LANGUAGES` map in frontend, backend regex accepts all languages
- **Per-engine voice prompts** — `create_voice_prompt_for_profile()` dispatches to the correct backend
- **Trim post-processing** — `trim_tts_output()` for Chatterbox engines (cuts trailing silence/hallucination)

### Known Limitations

- **HF XET progress**: Large files downloaded via `hf-xet` (HuggingFace's new transfer backend) report `n=0` in tqdm updates. Progress bars may appear stuck for large `.safetensors` files even though the download is proceeding. This is a known upstream limitation.
- **Chatterbox Turbo upstream token bug**: `from_pretrained()` passes `token=os.getenv("HF_TOKEN") or True` which fails without a stored HF token. Our backend works around this by calling `snapshot_download(token=None)` + `from_local()`.
- **chatterbox-tts must install with `--no-deps`**: It pins `numpy<1.26`, `torch==2.6.0`, `transformers==4.46.3` — all incompatible with our stack (Python 3.12, torch 2.10, transformers 4.57.3). Sub-deps listed explicitly in `requirements.txt`.
- **Instruct parameter is non-functional** (#224): The UI exposes an instruct text field, but it's silently dropped by every backend. The Qwen3-TTS Base model we ship only supports voice cloning — instruct requires the separate CustomVoice model variant (`Qwen3-TTS-12Hz-1.7B-CustomVoice`), which uses predefined speakers instead of ref audio. The instruct UI should be hidden until a backend with real support is integrated.
- **Streaming generation** only works for Qwen on MLX. Other engines use the non-streaming `/generate` endpoint.
- **dicta-onnx** (Hebrew diacritization) not included — upstream Chatterbox bug requires `model_path` arg but calls `Dicta()` with none. Hebrew works fine without it.

---

## Open PRs — Triage & Analysis

### Recently Merged (Since Last Update)

| PR | Title | Merged |
|----|-------|--------|
| **#316** | Upgrade CUDA backend from cu126 to cu128, fix GPU settings UI | 2026-03-18 |
| **#305** | fix: bundle qwen_tts source files in PyInstaller build | 2026-03-17 |
| **#298** | feat: split CUDA backend into independently versioned server + libs archives | 2026-03-17 |
| **#296** | Add HumeAI TADA TTS engine (1B English + 3B Multilingual) | 2026-03-17 |
| **#295** | fix: batch of bug fixes from issue tracker | 2026-03-17 |
| **#293** | Fix audio player freezing and improve UX | 2026-03-17 |
| **#294** | Settings overhaul: routed sub-tabs, server logs, changelog, about page | 2026-03-16 |
| **#288** | Better docs | 2026-03-16 |
| **#285** | Backend refactor: modular architecture, style guide, tooling | 2026-03-16 |
| **#274** | Landing page v0.2.0 redesign | 2026-03-15 |
| **#272** | Windows support: CUDA detection, cross-platform justfile, clean server shutdown | 2026-03-15 |
| **#271** | Add post-processing audio effects system | 2026-03-14 |
| **#269** | feat: async generation queue | 2026-03-13 |
| **#268** | feat: model management improvements and folder migration | 2026-03-13 |
| **#266** | feat: chunked TTS generation for long text (engine-agnostic) | 2026-03-13 |
| **#265** | feat: paralinguistic tag autocomplete for Chatterbox Turbo | 2026-03-13 |
| **#264** | fix: Chatterbox float64 dtype mismatch + model unload button | 2026-03-13 |
| **#258** | feat: Chatterbox Turbo engine + per-engine language lists | 2026-03-13 |
| **#230** | docs: fix README grammar | 2026-03-13 |
| **#161** | feat: Docker + web deployment | 2026-03-13 |
| **#88** | security: restrict CORS to known local origins | 2026-03-13 |

### Currently Open (9 PRs)

| PR | Title | Status | Notes |
|----|-------|--------|-------|
| **#311** | feat: add CosyVoice2/3 TTS engine | **Will close** | Model quality too poor. See Abandoned Integrations. |
| **#253** | Enhance speech tokenizer with 48kHz version | Community PR | Qwen tokenizer upgrade. Worth reviewing. |
| **#237** | fix: bundle qwen_tts source files in PyInstaller | Superseded | Our PR #305 shipped this. Can close. |
| **#227** | fix: harden input validation & file safety | Community PR | Coupled to #225 (custom models). |
| **#225** | feat: custom HuggingFace model support | Community PR | Needs rework for multi-engine arch. |
| **#218** | fix: unify qwen tts cache dir on Windows | Community PR | Windows-specific path fix. Still relevant. |
| **#195** | feat: per-profile LoRA fine-tuning | Draft | Complex. 15 new endpoints. |
| **#154** | feat: Audiobook tab | Community PR | Chunked generation now shipped (#266). |
| **#91** | fix: CoreAudio device enumeration | Draft | macOS audio device handling. |

---

## Open Issues — Categorized

### GPU / Hardware Detection (19 issues)

The single most reported category. Users on Windows with NVIDIA GPUs frequently report "GPU not detected."

**Root causes (likely):**
- PyInstaller binary doesn't bundle CUDA correctly → falls back to CPU
- DirectML/Vulkan path not implemented (AMD on Windows)
- Binary size limit means CUDA can't ship in the main release

**Key issues:** #239, #222, #220, #217, #208, #198, #192, #167, #164, #141, #130, #127

**Fix path:** PR #252 (CUDA backend swap) is now merged. Users can download the CUDA binary separately from the GPU acceleration settings. Many of these issues may now be resolvable — needs triage to confirm.

### Model Downloads (20 issues)

Second most reported. Users get stuck downloads, can't resume, no offline fallback.

**Key issues:** #249, #240, #221, #216, #212, #181, #180, #159, #150, #149, #145, #143, #135, #134

**Fix path:** PR #238 (cancel/clear UI) is now merged. PR #152 (offline crash fix) still open. Inline progress bars now show for all engines. Resume support not yet addressed.

### Language Requests (18 issues)

Strong demand for: Hindi (#245), Indonesian (#247), Dutch (#236), Hebrew (#199), Greek (#188), Portuguese (#183), Persian (#162), and many more.

**Key issues:** #247, #245, #236, #211, #205, #199, #189, #188, #187, #183, #179, #162

**Fix path:** Chatterbox Multilingual (merged via #257) now supports 23 languages including many of the requested ones: Arabic, Danish, German, Greek, Finnish, Hebrew, Hindi, Dutch, Norwegian, Polish, Swedish, Swahili, Turkish. Per-engine language filtering (PR #258) ensures the UI shows correct options. Several of these issues may be closeable.

### New Model Requests (5 explicit issues)

| Issue | Model Requested |
|-------|----------------|
| #226 | GGUF support |
| #172 | VibeVoice |
| #138 | Export to ONNX/Piper format |
| #132 | LavaSR (transcription) |
| #76 | (General model expansion) |

Community also requests: XTTS-v2, Fish Speech, Kokoro. CosyVoice was tried and abandoned. The multi-engine architecture is in place, making new model integration straightforward.

### Long-Form / Chunking (5 issues)

Users hitting the ~500 character practical limit.

**Key issues:** #234 (queue system), #203 (500 char limit), #191 (auto-split), #111, #69

**Fix path:** **Mostly resolved.** PR #266 (engine-agnostic chunked TTS) and PR #269 (async generation queue) are both merged. PR #154 (Audiobook tab) is still open.

### Feature Requests (23 issues)

Notable requests:
- **#234** — Queue system for batch generation
- **#182** — Concurrent/multi-thread generation
- **#173** — Vocal intonation/inflection control
- **#165** — Audiobook mode
- **#144** — Copy text to clipboard
- **#184** — Cancel button for progress bar
- **#242** — Seed value pinning for consistency
- **#228** — Always use 0.6B option
- **#233** — Transcribe audio API improvements
- **#235** — Finetuned Qwen3-TTS tokenizer

### Bugs (19 issues)

| Category | Issues |
|----------|--------|
| Generation failures | #248 (broken pipe), #219 (unsupported scalarType), #202 (clipping error), #170 (load failed) |
| UI bugs | #231 (history not updating), #190 (mobile landing), #169 (blank interface) |
| File operations | #207 (transcribe file error), #168 (no such file), #142 (download audio fail) |
| Server lifecycle | #166 (server processes remain), #164 (no auto-update) |
| Database | #174 (sqlite3 IntegrityError) |
| Dependency | #131 (numpy ABI mismatch), #209 (import error) |

---

## Existing Plan Documents — Status

| Document | Target Version | Status | Relevance |
|----------|---------------|--------|-----------|
| `TTS_PROVIDER_ARCHITECTURE.md` | v0.1.13 | **Partially superseded** by multi-engine arch + CUDA swap | Core concepts implemented differently than planned |
| `CUDA_BACKEND_SWAP.md` | — | **Shipped** (PR #252) | CUDA binary download + backend restart |
| `CUDA_BACKEND_SWAP_FINAL.md` | — | **Shipped** (PR #252) | Final implementation plan |
| `EXTERNAL_PROVIDERS.md` | v0.2.0 | **Not started** | Remote server support |
| `MLX_AUDIO.md` | — | **Shipped** | MLX backend is live |
| `DOCKER_DEPLOYMENT.md` | v0.2.0 | **Shipped** (PR #161) | Docker + web deployment |
| `OPENAI_SUPPORT.md` | v0.2.0 | **Not started** | OpenAI-compatible API layer |
| `PR33_CUDA_PROVIDER_REVIEW.md` | — | **Reference** | Analysis of the original provider approach |

---

## New Model Integration — Landscape

### Models Worth Supporting (2026 SOTA — updated March 18)

| Model | Cloning | Speed | Sample Rate | Languages | VRAM | Instruct Support | Integration Ease | Status |
|-------|---------|-------|-------------|-----------|------|-----------------|-----------------|--------|
| **Qwen3-TTS** | 10s zero-shot | Medium | 24 kHz | 10 | Medium | None (Base); Yes (CustomVoice variant, predefined speakers only) | **Shipped** | v0.1.13 |
| **LuxTTS** | 3s zero-shot | 150x RT, CPU ok | 48 kHz | English | <1 GB | None | **Shipped** | PR #254 |
| **Chatterbox MTL** | 5s zero-shot | Medium | 24 kHz | 23 | Medium | Partial — `exaggeration` float | **Shipped** | PR #257 |
| **Chatterbox Turbo** | 5s zero-shot | Fast | 24 kHz | English | Low | Partial — inline tags only | **Shipped** | PR #258 |
| **HumeAI TADA 1B/3B** | Zero-shot | 5x faster than LLM-TTS | 24 kHz | EN (1B), Multilingual (3B) | Medium | Partial — automatic prosody | **Shipped** | PR #296 |
| **Kokoro-82M** | Pre-built voices | CPU realtime | 24 kHz | 8 | Tiny (82M) | None | **In progress** | Apache 2.0, pip install, ~350MB |
| ~~**CosyVoice2-0.5B**~~ | 3-10s zero-shot | Very fast | 24 kHz | Multilingual | Low | Yes — `inference_instruct2()` | **Abandoned** | PR #311 — poor output quality |
| **Fish Speech** | 10-30s few-shot | Real-time | 24-44 kHz | 50+ | Medium | **Yes** — inline text descriptions, word-level control | Ready | Needs license clarification |
| **XTTS-v2** | 6s zero-shot | Mid-GPU | 24 kHz | 17+ | Medium | Partial — style transfer from ref audio only | Ready | Mature pip package |
| **Pocket TTS** | Zero-shot + streaming | >1x RT on CPU | — | English | ~100M params, CPU-first | None | Ready | MIT, Kyutai Labs |
| **MOSS-TTS Family** | Zero-shot | — | — | Multilingual | Medium | **Yes** — text prompts for style + timbre design | Needs vetting | Apache 2.0 |
| **VoxCPM 1.5** | Zero-shot (seconds) | ~0.15 RTF streaming | — | Bilingual (EN/ZH) | Medium | Partial — automatic context-aware prosody | Needs vetting | Apache 2.0 |

#### Notes on Candidates (March 2026)

- **CosyVoice2-0.5B** — **Tried and abandoned** (PR #311). Despite having the best instruct API, output quality was poor. No PyPI package, needed 5+ shims, heavy deps. Not worth it.
- **HumeAI TADA** — **Shipped** (PR #296). 700+ seconds coherent audio. [GitHub: HumeAI/tada](https://github.com/HumeAI/tada)
- **Kokoro-82M** — **In progress.** 82M params, CPU realtime, Apache 2.0, clean `pip install kokoro`. Uses pre-built voice styles (not zero-shot cloning from arbitrary audio). [GitHub: hexgrad/kokoro](https://github.com/hexgrad/kokoro)
- **Fish Speech** — Word-level fine-grained control. License needs clarification. [fish.audio blog](https://fish.audio/blog/fish-audio-s2-fine-grained-ai-voice-control-at-the-word-level)
- **XTTS-v2** — Coqui's multilingual cloning. 17+ languages, pip-installable. [GitHub: coqui-ai/TTS](https://github.com/coqui-ai/TTS)
- **Pocket TTS** — 100M param CPU-first model from Kyutai Labs. [GitHub: kyutai-labs/pocket-tts](https://github.com/kyutai-labs/pocket-tts)
- **Watch list:** MioTTS-2.6B (fast LLM-based EN/JP, vLLM compatible), Oolel-Voices (Soynade Research, expressive modular control)

### Adding a New Engine (Now Straightforward)

With the model config registry and shared `EngineModelSelector` component, adding a new TTS engine requires:

1. **Create `backend/backends/<engine>_backend.py`** — implement `TTSBackend` protocol (~200-300 lines)
2. **Register in `backend/backends/__init__.py`** — add `ModelConfig` entry + `TTS_ENGINES` entry + factory elif
3. **Update `backend/models.py`** — add engine name to regex
4. **Update frontend** — add to engine union type, `EngineModelSelector` options, form schema, language map (4 files)

`main.py` requires **zero changes** — the registry handles all dispatch automatically.

Total effort: **~1 day** for a well-documented model with a PyPI package. See `docs/plans/ADDING_TTS_ENGINES.md` for the full guide.

---

## Architectural Bottlenecks

### ~~1. Single Backend Singleton~~ — RESOLVED

The singleton TTS backend was replaced with a thread-safe per-engine registry in PR #254. Multiple engines can now be loaded simultaneously.

### ~~2. `main.py` Dispatch Point Duplication~~ — RESOLVED

Previously, each engine required updates to 6+ hardcoded dispatch maps across `main.py` (~320 lines of if/elif chains). A model config registry in `backend/backends/__init__.py` now centralizes all model metadata (`ModelConfig` dataclass) with helper functions (`load_engine_model()`, `check_model_loaded()`, `engine_needs_trim()`, etc.). Adding a new engine requires zero changes to `main.py`.

### ~~3. Model Config is Scattered~~ — RESOLVED

Model identifiers, HF repo IDs, display names, and engine metadata are now consolidated in the `ModelConfig` registry. Backend-aware branching (e.g. MLX vs PyTorch Qwen repo IDs) happens inside the registry. Frontend model options are centralized in `EngineModelSelector.tsx`.

### 4. Voice Prompt Cache Assumes PyTorch Tensors

`backend/utils/cache.py` uses `torch.save()` / `torch.load()`. LuxTTS and Chatterbox backends work around this by storing reference audio paths instead of tensors in their voice prompt dicts. Not ideal but functional.

### 5. ~~Frontend Assumes Qwen Model Sizes~~ — RESOLVED

The generation form now uses a flat model dropdown with engine-based routing. Per-engine language filtering is in place. Model size is only sent for Qwen.

---

## Recommended Priorities

### Tier 1 — Ship Now

| Priority | PR/Item | Impact | Effort |
|----------|---------|--------|--------|
| 1 | **Kokoro 82M** — finish integration | New engine, CPU-friendly, 8 langs | Low (nearly done) |
| 2 | Close PR #311 (CosyVoice) and #237 (superseded by #305) | Housekeeping | None |
| 3 | **#218** — Windows HF cache dir fix | Windows-specific pain | Low |
| 4 | **#253** — 48kHz speech tokenizer | Quality improvement for Qwen | Medium |

### Tier 2 — Feature Work

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| 1 | **#154** — Audiobook tab | Long-form users. Chunking + queue now shipped. | Medium |
| 2 | **#225** — Custom HuggingFace models | User-supplied models. Needs rework. | High |
| 3 | OpenAI-compatible API (plan doc exists) | Low effort once API is stable | Low |
| 4 | LoRA fine-tuning (PR #195) | Complex, needs rework for multi-engine | Very High |
| 5 | Streaming for non-MLX engines | Currently MLX-only | Medium |

### Tier 3 — Future Engines

| Priority | Item | Notes |
|----------|------|-------|
| 1 | **Fish Speech** | 50+ langs, word-level instruct. License TBD. |
| 2 | **XTTS-v2** | 17+ langs, mature pip package. Best multilingual cloning. |
| 3 | **Pocket TTS** (Kyutai) | CPU-first 100M model. MIT. |
| 4 | **MOSS-TTS** | Text-to-voice design. Multi-speaker dialogue for Stories. |
| 5 | **VoxCPM 1.5** | Tokenizer-free streaming. Uncertain integration surface. |

### ~~Previously Prioritized — Now Done~~

- ~~#258 — Chatterbox Turbo~~ **Merged**
- ~~#99 — Chunked TTS~~ **Superseded by #266, merged**
- ~~#88 — CORS restriction~~ **Merged**
- ~~#161 — Docker deployment~~ **Merged**
- ~~#234 — Queue system~~ **Addressed by #269, merged**
- ~~HumeAI TADA~~ **Shipped** (PR #296)
- ~~Kokoro-82M~~ **In progress**

---

## Branch Inventory

| Branch | PR | Status | Notes |
|--------|-----|--------|-------|
| `feat/cosyvoice-engine` | #311 | Open — closing | CosyVoice2/3 — abandoned, poor quality |
| `feat/chatterbox-turbo` | #258 | **Merged** | Chatterbox Turbo + per-engine languages |
| `feat/chatterbox` | #257 | **Merged** | Chatterbox Multilingual |
| `feat/luxtts` | #254 | **Merged** | LuxTTS + multi-engine arch |

---

## Quick Reference: API Endpoints

<details>
<summary>All current endpoints</summary>

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check, model/GPU status |
| `/profiles` | POST, GET | Create/list voice profiles |
| `/profiles/{id}` | GET, PUT, DELETE | Profile CRUD |
| `/profiles/{id}/samples` | POST, GET | Add/list voice samples |
| `/profiles/{id}/avatar` | POST, GET, DELETE | Avatar management |
| `/profiles/{id}/export` | GET | Export profile as ZIP |
| `/profiles/import` | POST | Import profile from ZIP |
| `/generate` | POST | Generate speech (engine param selects TTS backend) |
| `/generate/stream` | POST | Stream speech (MLX only) |
| `/history` | GET | List generation history |
| `/history/{id}` | GET, DELETE | Get/delete generation |
| `/history/{id}/export` | GET | Export generation ZIP |
| `/history/{id}/export-audio` | GET | Export audio only |
| `/transcribe` | POST | Transcribe audio (Whisper) |
| `/models/status` | GET | All model statuses (Qwen, LuxTTS, Chatterbox, Chatterbox Turbo, TADA, Whisper) |
| `/models/download` | POST | Trigger model download |
| `/models/download/cancel` | POST | Cancel/dismiss download |
| `/models/{name}` | DELETE | Delete downloaded model |
| `/models/load` | POST | Load model into memory |
| `/models/unload` | POST | Unload model |
| `/models/progress/{name}` | GET | SSE download progress |
| `/tasks/active` | GET | Active downloads/generations (with inline progress) |
| `/stories` | POST, GET | Create/list stories |
| `/stories/{id}` | GET, PUT, DELETE | Story CRUD |
| `/stories/{id}/items` | POST, GET | Story items CRUD |
| `/stories/{id}/export` | GET | Export story audio |
| `/channels` | POST, GET | Audio channel CRUD |
| `/channels/{id}` | PUT, DELETE | Channel update/delete |
| `/cache/clear` | POST | Clear voice prompt cache |
| `/server/cuda/status` | GET | CUDA binary availability |
| `/server/cuda/download` | POST | Download CUDA binary |
| `/server/cuda/switch` | POST | Switch to CUDA backend |

</details>
