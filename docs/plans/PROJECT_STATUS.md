# Voicebox Project Status & Roadmap

> Last updated: 2026-03-12 | Current version: **v0.1.13** | 13.1k stars | 176 open issues | 28 open PRs

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
│  │  ┌─────────────┐  ┌───────────┐  ┌─────────┐ │  │
│  │  │ TTSBackend  │  │ STTBackend│  │ Profiles│ │  │
│  │  │ (Protocol)  │  │ (Whisper) │  │ History │ │  │
│  │  │  ┌────────┐ │  └───────────┘  │ Stories │ │  │
│  │  │  │PyTorch │ │                  └─────────┘ │  │
│  │  │  │or MLX  │ │                              │  │
│  │  │  └────────┘ │                              │  │
│  │  └─────────────┘                              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Key Files

| Layer | File | Purpose |
|-------|------|---------|
| Backend entry | `backend/main.py` | FastAPI app, all API routes (~1700 lines) |
| TTS protocol | `backend/backends/__init__.py:14-81` | `TTSBackend` Protocol definition |
| TTS factory | `backend/backends/__init__.py:118-137` | Singleton backend selection (MLX vs PyTorch) |
| PyTorch TTS | `backend/backends/pytorch_backend.py` | Qwen3-TTS via `qwen_tts` package |
| MLX TTS | `backend/backends/mlx_backend.py` | Qwen3-TTS via `mlx_audio.tts` |
| Platform detect | `backend/platform_detect.py` | Apple Silicon → MLX, else → PyTorch |
| API types | `backend/models.py` | Pydantic request/response models |
| Frontend API | `app/src/lib/api/client.ts` | Hand-written fetch wrapper |
| Frontend types | `app/src/lib/api/types.ts` | TypeScript API types |
| Generation form | `app/src/components/Generation/GenerationForm.tsx` | TTS generation UI |
| Model manager | `app/src/components/ServerSettings/ModelManagement.tsx` | Model download/status UI |
| Gen form hook | `app/src/lib/hooks/useGenerationForm.ts` | Form validation + submission |

### How TTS Generation Works (Current Flow)

```
POST /generate
  1. Look up voice profile from DB
  2. Check model cache → if missing, trigger background download, return HTTP 202
  3. Load model (lazy): tts_backend.load_model(model_size)
  4. Create voice prompt: profiles.create_voice_prompt_for_profile()
       → tts_backend.create_voice_prompt(audio_path, reference_text)
  5. Generate: tts_backend.generate(text, voice_prompt, language, seed, instruct)
  6. Save WAV → data/generations/{id}.wav
  7. Insert history record in SQLite
  8. Return GenerationResponse
```

---

## Current State

### What's Shipped (v0.1.13)

- Qwen3-TTS voice cloning (1.7B and 0.6B models)
- MLX backend for Apple Silicon, PyTorch for everything else
- Voice profiles with multi-sample support
- Stories editor (multi-track DAW timeline)
- Whisper transcription (base, small, medium, large variants)
- Model management UI with download progress (SSE)
- Generation history with caching
- Streaming generation endpoint (MLX only)
- Delivery instructions (instruct parameter)

### What's NOT Shipped But Has Code

| Feature | Branch | Status |
|---------|--------|--------|
| External provider binaries (CUDA split) | `external-provider-binaries` | PR #33, significant work done, stale since Feb |
| Dual server binaries | `feat/dual-server-binaries` | Branch exists, no PR |
| Multi-sample fix | `fix-multi-sample` | Branch exists, no PR |
| Model download notification fix | `fix-dl-notification-...` | Branch exists, no PR |

### Hardcoded Qwen3-TTS Assumptions

These are the specific coupling points that block multi-model support:

| Location | What's Hardcoded |
|----------|-----------------|
| `backend/models.py:58` | `model_size` regex: `^(1\.7B\|0\.6B)$` |
| `backend/main.py:611` | Default: `model_size or "1.7B"` |
| `backend/main.py:1322-1365` | Model status list (2 Qwen + 4 Whisper) |
| `backend/main.py:1523-1548` | Download trigger map |
| `backend/main.py:1597-1628` | Delete map |
| `backend/backends/pytorch_backend.py:65-68` | HF repo ID map |
| `backend/backends/mlx_backend.py:41-44` | MLX repo ID map |
| `backend/backends/__init__.py:118-137` | Single global TTS backend |
| `app/src/lib/hooks/useGenerationForm.ts:17` | `modelSize: z.enum(['1.7B', '0.6B'])` |
| `app/src/lib/hooks/useGenerationForm.ts:70-71` | `modelName = "qwen-tts-${data.modelSize}"` |
| `app/src/components/Generation/GenerationForm.tsx:140-141` | Hardcoded "Qwen TTS" labels |
| `app/src/components/ServerSettings/ModelManagement.tsx:166-213` | Filters by `qwen-tts` and `whisper` prefix |
| `backend/utils/cache.py` | Voice prompt cache uses `torch.save()` |

---

## Open PRs — Triage & Analysis

### Merge-Ready / Near-Ready (Bug Fixes & Small Features)

| PR | Title | Risk | Notes |
|----|-------|------|-------|
| **#250** | docs: align local API port examples | None | Docs-only |
| **#230** | docs: fix README grammar | None | Docs-only |
| **#243** | a11y: screen reader and keyboard improvements | Low | Accessibility, no backend changes |
| **#175** | Fix #134: duplicate profile name validation | Low | Simple validation |
| **#178** | Fix #168 #140: generation error handling | Low | Error handling improvements |
| **#152** | Fix: prevent crashes when HuggingFace unreachable | Medium | Monkey-patches HF hub; solves real offline bug (#150, #151) |
| **#218** | fix: unify qwen tts cache dir on Windows | Low | Windows-specific path fix |
| **#214** | fix: panic on launch from tokio::spawn | Low | Rust-side Tauri fix |
| **#210** | fix: Linux NVIDIA GBM buffer crash | Low | Linux-specific, narrowly scoped |
| **#88** | security: restrict CORS to known local origins | Low | Security hardening |

### Significant Feature PRs

| PR | Title | Complexity | Dependencies | Notes |
|----|-------|-----------|--------------|-------|
| **#97** | fix: pass language parameter to TTS models | Medium | None | **Critical bug** — language param was silently dropped. Adds `LANGUAGE_CODE_TO_NAME` mapping to both backends. Should be high priority. |
| **#133** | feat: network access toggle | Low | None | Wires up existing plumbing (`--host 0.0.0.0`). Clean, small. |
| **#238** | download cancel/clear UI + error panel | Medium | None | Adds cancel buttons, VS Code-style Problems panel, fixes whisper-large repo. Quality-of-life win. |
| **#99** | feat: chunked TTS with quality selector | Medium | None | Solves the 500-char/2048-token limit. Sentence-aware splitting, crossfade concat, 44.1kHz upsampling. Addresses #191, #203, #69, #111. |
| **#154** | feat: Audiobook tab | Medium | Depends on #99 concepts | Full audiobook workflow — chunked gen, preview, auto-save to Stories. New route + tab. |
| **#91** | fix: CoreAudio device enumeration | Medium | None | macOS audio device handling. |

### Architectural PRs (Need Careful Review)

| PR | Title | Complexity | Notes |
|----|-------|-----------|-------|
| **#33** | CUDA GPU Support — External Provider Binaries | **Very High** | The big one. Splits monolithic backend into main app + downloadable provider executables (PyTorch CPU, CUDA). New provider management system, CI/CD for R2 uploads, provider settings UI. Created Feb 1, significant codebase. **This is the foundation for multi-model support** but is currently Qwen-only. |
| **#225** | feat: custom HuggingFace model support | High | Adds `custom_models.py`, `custom:<slug>` model IDs, frontend model grouping (Built-in vs Custom). **Takes a different approach than #33** — keeps single backend but allows arbitrary HF repos. These two PRs may conflict architecturally. |
| **#194** | feat: Hebrew + Chatterbox TTS | High | **First non-Qwen TTS model.** Adds `ChatterboxTTSBackend` alongside existing backends. Routes by language (`he` → Chatterbox, else → Qwen). Adds Hebrew Whisper models. Includes a lot of cleanup. Important precedent for multi-model. |
| **#195** | feat: per-profile LoRA fine-tuning | **Very High** | Depends on #194. Training pipeline, adapter management, SSE progress, 15 new API endpoints. New DB tables. Forces PyTorch even on MLX systems for adapter inference. |
| **#161** | feat: Docker + web deployment | High | 3-stage Dockerfile, SPA serving from FastAPI, docker-compose. Implements the Docker deployment plan. |
| **#124** | Add Dockerfiles + docker-compose + docs | Medium | Earlier, simpler Docker attempt. Overlaps with #161. |
| **#123** | added docker | Low | Minimal Docker PR. Overlaps with #161 and #124. |
| **#227** | fix: harden input validation & file safety | Medium | Follow-up to #225. Atomic writes, threading locks, input validation. Good hardening but coupled to the custom models feature. |

### PRs That Need Author Action / Are Stale

| PR | Title | Notes |
|----|-------|-------|
| **#237** | fix: bundle qwen_tts source files in PyInstaller | Solves #212 but needs review for build system impact |
| **#215** | Update prerequisites with Tauri deps | Branch is `main` — will have conflicts |
| **#89** | Linux Support | Branch is `main` — will have conflicts. Broad scope. |
| **#83** | Update download links for v0.1.12 | Outdated (we're on v0.1.13) |

---

## Open Issues — Categorized

### GPU / Hardware Detection (19 issues)

The single most reported category. Users on Windows with NVIDIA GPUs frequently report "GPU not detected."

**Root causes (likely):**
- PyInstaller binary doesn't bundle CUDA correctly → falls back to CPU
- DirectML/Vulkan path not implemented (AMD on Windows)
- Binary size limit means CUDA can't ship in the main release

**Key issues:** #239, #222, #220, #217, #208, #198, #192, #167, #164, #141, #130, #127

**Fix path:** PR #33 (external provider binaries) is designed to solve this. Ship a small main app, let users download the CUDA provider separately.

### Model Downloads (20 issues)

Second most reported. Users get stuck downloads, can't resume, no cancel button, no offline fallback.

**Key issues:** #249, #240, #221, #216, #212, #181, #180, #159, #150, #149, #145, #143, #135, #134

**Fix path:** PR #238 (cancel/clear UI), PR #152 (offline crash fix). Resume support not yet addressed.

### Language Requests (18 issues)

Strong demand for: Hindi (#245), Indonesian (#247), Dutch (#236), Hebrew (#199), Greek (#188), Portuguese (#183), Persian (#162), and many more.

**Key issues:** #247, #245, #236, #211, #205, #199, #189, #188, #187, #183, #179, #162

**Fix path:** PR #97 (pass language param — currently silently dropped!) is the prerequisite. Qwen3-TTS already supports many languages; the bug is that the language code isn't forwarded. Multi-model (#194 Chatterbox for Hebrew) expands coverage further.

### New Model Requests (5 explicit issues)

| Issue | Model Requested |
|-------|----------------|
| #226 | GGUF support |
| #172 | VibeVoice |
| #138 | Export to ONNX/Piper format |
| #132 | LavaSR (transcription) |
| #76 | (General model expansion) |

Community is also vocally requesting: LuxTTS, Chatterbox, XTTS-v2, Fish Speech, CosyVoice, Kokoro on social media and in issue comments.

### Long-Form / Chunking (5 issues)

Users hitting the ~500 character practical limit.

**Key issues:** #234 (queue system), #203 (500 char limit), #191 (auto-split), #111, #69

**Fix path:** PR #99 (chunked TTS + quality selector) directly addresses this. PR #154 (Audiobook tab) builds on it.

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
| `TTS_PROVIDER_ARCHITECTURE.md` | v0.1.13 | **Partially implemented** in PR #33 | Core architecture for multi-model + CUDA distribution |
| `EXTERNAL_PROVIDERS.md` | v0.2.0 | **Not started** | Remote server support. API path inconsistency with provider arch doc (`/v1/` vs `/tts/`) |
| `MLX_AUDIO.md` | — | **Shipped** (the only one) | MLX backend is live. 0.6B MLX model still missing. |
| `DOCKER_DEPLOYMENT.md` | v0.2.0 | **PR exists** (#161) | Waiting on review. No official images published. |
| `OPENAI_SUPPORT.md` | v0.2.0 | **Not started** | OpenAI-compatible API layer. Linked to issue #10. Low complexity. |

### Cross-Document Conflicts

1. **API path inconsistency:** Provider arch uses `/tts/generate`, External providers uses `/v1/generate`, OpenAI compat uses `/v1/audio/speech`. Need to reconcile.
2. **Docker vs. Provider split:** Docker doc assumes monolithic backend. Provider arch splits into separate binaries. Need to decide: does Docker run the monolith or individual providers?
3. **Version targeting:** Provider arch targets v0.1.13 (current!) but isn't merged. Everything else targets v0.2.0.

---

## New Model Integration — Landscape

### Models Worth Supporting (2026 SOTA)

| Model | Cloning | Speed | Sample Rate | Languages | VRAM | Integration Ease | Repo |
|-------|---------|-------|-------------|-----------|------|-----------------|------|
| **LuxTTS** | 3s zero-shot | 150x RT, CPU ok | 48 kHz | English-first | <1 GB | Easy | `ysharma3501/LuxTTS` |
| **Chatterbox** | 5s zero-shot | Sub-200ms streaming | 24-48 kHz | 23+ | Low | Medium | `resemble-ai/chatterbox` |
| **XTTS-v2** | 6s zero-shot | Fast mid-GPU | 24 kHz | 17+ | Medium | Medium | `coqui/XTTS-v2` |
| **Fish Speech** | 10-30s few-shot | Real-time | 24-44 kHz | 50+ | Medium | Medium | `fishaudio/fish-speech` |
| **CosyVoice2-0.5B** | 3-10s zero-shot | Very fast | 24 kHz | Multilingual | Low | Easy | Alibaba HF org |
| **Kokoro-82M** | 3s instant | CPU realtime | 24 kHz | English | Tiny | Medium | Kokoro repo |

### What's Needed Architecturally for Multi-Model

The current codebase assumes one TTS model family (Qwen3-TTS). Adding any new model requires:

1. **Model type concept** — A `model_type` field (e.g. `qwen`, `luxtts`, `chatterbox`) alongside `model_size`. The `GenerationRequest` schema, frontend form, and all model config dicts need updating.

2. **Multiple backend instances** — The singleton `get_tts_backend()` needs to become a registry. Different models have different voice prompt formats, different inference APIs, different sample rates.

3. **Voice prompt format abstraction** — Qwen uses `torch.save()`-serialized tensors. LuxTTS uses `encode_prompt()` returning its own format. Chatterbox uses audio-path-based cloning. The cache system (`backend/utils/cache.py`) needs to handle heterogeneous formats.

4. **Sample rate normalization** — Qwen outputs 24 kHz. LuxTTS outputs 48 kHz. The Stories editor and audio pipeline need to handle mixed rates.

5. **Per-model capabilities** — Not all models support `instruct` (delivery instructions), not all support streaming, not all support the same languages. The UI needs to adapt.

### PR #194 as Precedent

The Hebrew/Chatterbox PR (#194) is the first attempt at multi-model. It takes a pragmatic approach: route by language (`he` → Chatterbox, else → Qwen). This works for one extra model but doesn't scale — what happens when you want Chatterbox for English too?

### PR #225 as Alternative Approach

The custom HuggingFace models PR (#225) takes a different angle: let users register arbitrary HF repos and attempt to load them through the existing Qwen backend. This is flexible but fragile — it assumes all models have the same API as Qwen3-TTS.

### PR #33 as Foundation

The external provider binaries PR (#33) has the most robust architecture for multi-model, since each provider is a separate process with its own dependencies. But it's complex, currently Qwen-only, and has been stale since early February.

---

## Architectural Bottlenecks

### 1. Single Backend Singleton

**File:** `backend/backends/__init__.py:118-137`

The entire TTS system runs through one global `_tts_backend` instance. You literally cannot have two models loaded. This is the #1 blocker for multi-model support.

### 2. `main.py` is 1700+ Lines

All API routes, all model configs, all business logic in one file. Three separate hardcoded model config dicts that must stay in sync. Any multi-model change touches this file heavily.

### 3. Model Config is Scattered

Model identifiers, HF repo IDs, display names, and download logic are duplicated across:
- `main.py` (3 separate dicts)
- `pytorch_backend.py` (HF repo map)
- `mlx_backend.py` (MLX repo map)
- `GenerationForm.tsx` (UI labels)
- `useGenerationForm.ts` (validation schema)
- `ModelManagement.tsx` (prefix filters)

There is no single source of truth for "what models does Voicebox support."

### 4. Voice Prompt Cache Assumes PyTorch Tensors

`backend/utils/cache.py` uses `torch.save()` / `torch.load()` for caching voice prompts. Models that don't use PyTorch tensors (LuxTTS, MLX-native models) can't use this cache.

### 5. Frontend Assumes Qwen Model Sizes

The generation form schema (`useGenerationForm.ts:17`) validates `model_size` as `'1.7B' | '0.6B'`. The model management UI filters by string prefix `qwen-tts`. Adding any model requires touching 3-4 frontend files.

---

## Recommended Priorities

### Tier 1 — Ship Now (Bug Fixes & Critical Improvements)

These PRs fix real user pain with low risk. Can be reviewed and merged quickly.

| Priority | PR | Impact | Effort |
|----------|-----|--------|--------|
| 1 | **#97** — Pass language param to TTS | Fixes all non-English generation (18 language issues) | Low |
| 2 | **#238** — Download cancel/clear UI | Addresses 20 download-related issues | Low |
| 3 | **#152** — Offline mode crash fix | Fixes #150, #151 | Low |
| 4 | **#99** — Chunked TTS + quality selector | Removes 500-char limit, addresses 5 issues | Medium |
| 5 | **#218** — Windows HF cache dir fix | Windows-specific pain | Low |
| 6 | **#175, #178** — Profile validation + error handling | Small fixes | Low |
| 7 | **#250, #230** — Docs fixes | Zero risk | None |
| 8 | **#133** — Network access toggle | Wires up existing code | Low |
| 9 | **#88** — CORS restriction | Security improvement | Low |
| 10 | **#214** — Tauri window close panic fix | Stability | Low |

### Tier 2 — Next Release (v0.2.0 Foundations)

These require more review but unlock major capabilities.

| Priority | Item | Impact | Effort | Dependencies |
|----------|------|--------|--------|-------------|
| 1 | **PR #33** — External provider binaries | Solves GPU distribution (19 issues), foundation for multi-model | Very High | Needs rebase, thorough review |
| 2 | **Multi-model abstraction layer** | Required before adding LuxTTS/Chatterbox/etc. | High | Informed by #33, #194, #225 |
| 3 | **PR #161** — Docker deployment | Server/headless users | Medium | Independent of #33 |
| 4 | **PR #194** — Hebrew + Chatterbox | First non-Qwen model, language expansion | High | Should align with multi-model abstraction |
| 5 | **PR #154** — Audiobook tab | Significant feature for long-form users | Medium | Benefits from #99 (chunking) |

### Tier 3 — Future (v0.3.0+)

| Item | Notes |
|------|-------|
| LuxTTS integration | 48 kHz, low VRAM, but needs multi-model arch first |
| XTTS-v2 / Fish Speech | Multilingual powerhouses |
| OpenAI-compatible API (plan doc exists) | Low effort once API is stable |
| LoRA fine-tuning (PR #195) | Complex, depends on #194 |
| External/remote providers (plan doc exists) | Depends on provider architecture |
| GGUF support (#226) | Depends on model ecosystem maturity |
| Queue system (#234) | Batch generation |
| Real-time streaming synthesis | MLX-only currently, needs PyTorch path |

### Decision Point: Multi-Model Architecture

Before adding any new TTS model, a decision is needed on *how*:

**Option A — Provider Binary Split (PR #33 approach)**
Each model family is a separate executable/process. Most isolated, most flexible, but most complex. Solves the CUDA distribution problem simultaneously.

**Option B — In-Process Model Registry**
Keep everything in one process but replace the singleton with a registry that can instantiate multiple `TTSBackend` implementations. Simpler, but doesn't solve binary size / CUDA distribution.

**Option C — Hybrid (Recommended)**
Use Option B for lightweight models (LuxTTS, Kokoro — small, CPU-friendly) that can coexist in-process. Use Option A for heavy models (CUDA Qwen3-TTS, Fish Speech) that need their own process/dependencies. The provider architecture from PR #33 becomes the escape hatch for heavy models, while light models are built-in.

This matches how PR #194 already works (Chatterbox loaded in-process alongside Qwen) while keeping the door open for PR #33's provider split.

---

## Branch Inventory

| Branch | PR | Status | Notes |
|--------|-----|--------|-------|
| `external-provider-binaries` | #33 | Open, stale | Major architecture work |
| `feat/dual-server-binaries` | — | No PR | Related to provider split? |
| `fix-multi-sample` | — | No PR | Voice profile multi-sample fix |
| `fix-dl-notification-...` | — | No PR | Model download UX |
| `improvements` | — | No PR | Unknown scope |
| `stories` | — | No PR | Stories editor work? |
| `windows-server-shutdown` | — | No PR | Windows lifecycle |
| `model-dl-fix` | — | No PR | Model download fix |
| `channels` | — | No PR | Audio channels |
| `audio-export-entitlement-fix` | — | No PR | macOS entitlements |
| `better-docs` | — | No PR | Documentation |

---

## Quick Reference: API Endpoints

<details>
<summary>All current endpoints (v0.1.13)</summary>

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check, model/GPU status |
| `/profiles` | POST, GET | Create/list voice profiles |
| `/profiles/{id}` | GET, PUT, DELETE | Profile CRUD |
| `/profiles/{id}/samples` | POST, GET | Add/list voice samples |
| `/profiles/{id}/avatar` | POST, GET, DELETE | Avatar management |
| `/profiles/{id}/export` | GET | Export profile as ZIP |
| `/profiles/import` | POST | Import profile from ZIP |
| `/generate` | POST | Generate speech |
| `/generate/stream` | POST | Stream speech (SSE) |
| `/history` | GET | List generation history |
| `/history/{id}` | GET, DELETE | Get/delete generation |
| `/history/{id}/export` | GET | Export generation ZIP |
| `/history/{id}/export-audio` | GET | Export audio only |
| `/transcribe` | POST | Transcribe audio (Whisper) |
| `/models/status` | GET | All model statuses |
| `/models/download` | POST | Trigger model download |
| `/models/{name}` | DELETE | Delete downloaded model |
| `/models/load` | POST | Load model into memory |
| `/models/unload` | POST | Unload model |
| `/models/progress/{name}` | GET | SSE download progress |
| `/tasks/active` | GET | Active downloads/generations |
| `/stories` | POST, GET | Create/list stories |
| `/stories/{id}` | GET, PUT, DELETE | Story CRUD |
| `/stories/{id}/items` | POST, GET | Story items CRUD |
| `/stories/{id}/export` | GET | Export story audio |
| `/channels` | POST, GET | Audio channel CRUD |
| `/channels/{id}` | PUT, DELETE | Channel update/delete |
| `/cache/clear` | POST | Clear voice prompt cache |

</details>
