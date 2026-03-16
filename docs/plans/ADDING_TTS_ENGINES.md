# Adding a TTS Engine to Voicebox

Guide for adding new TTS model backends. Based on the implementation of LuxTTS (#254), Chatterbox Multilingual (#257), Chatterbox Turbo (#258), and the PyInstaller fixes in v0.2.3.

---

## Overview

Adding an engine touches ~12 files across 4 layers (down from ~19 after the model config registry refactor). The backend protocol work is straightforward — the real time sink is dependency hell, upstream library bugs, and PyInstaller bundling.

---

## Phase 1: Backend Implementation

### 1.1 Create the backend file

`backend/backends/<engine>_backend.py` (~200-300 lines)

Implement the `TTSBackend` protocol from `backend/backends/__init__.py`:

```python
class YourBackend:
    """Must satisfy the TTSBackend protocol."""

    async def load_model(self, model_size: str = "default") -> None: ...
    async def create_voice_prompt(self, audio_path: str, reference_text: str, use_cache: bool = True) -> tuple[dict, bool]: ...
    async def combine_voice_prompts(self, audio_paths: list[str], ref_texts: list[str]) -> tuple[np.ndarray, str]: ...
    async def generate(self, text: str, voice_prompt: dict, language: str = "en", seed: int | None = None, instruct: str | None = None) -> tuple[np.ndarray, int]: ...
    def unload_model(self) -> None: ...
    def is_loaded(self) -> bool: ...
    def _get_model_path(self, model_size: str) -> str: ...
```

Key decisions per engine:

| Decision | Options | Examples |
|----------|---------|---------|
| **Voice prompt storage** | Pre-computed tensors vs deferred file paths | Qwen PyTorch stores tensor dicts; Chatterbox stores `{"ref_audio": path, "ref_text": text}` |
| **Caching** | Use voice prompt cache or skip it | LuxTTS caches with `luxtts_` prefix; Chatterbox skips caching entirely |
| **Device selection** | CUDA / MPS / CPU | Chatterbox forces CPU on macOS (MPS tensor bugs); LuxTTS supports MPS |
| **Model download** | Library handles it vs manual `snapshot_download` | Turbo uses manual download to bypass upstream `token=True` bug |
| **Sample rate** | Engine-specific | LuxTTS outputs 48kHz, everything else is 24kHz |

### 1.2 Voice prompt patterns

There are three patterns in use. Pick the one that fits your model:

**Pattern A: Pre-computed tensors** (Qwen PyTorch, LuxTTS)
```python
# create_voice_prompt returns opaque dict of tensors
# Cached via torch.save(), reused across generations
encoded = model.encode_prompt(audio_path)
return encoded, False  # (prompt_dict, was_cached)
```

**Pattern B: Deferred file paths** (Chatterbox, MLX)
```python
# Just store paths, process at generation time
return {"ref_audio": audio_path, "ref_text": reference_text}, False
```

**Pattern C: Hybrid** (possible for new engines)
```python
# Pre-compute speaker embeddings, store alongside paths
embedding = model.extract_speaker(audio_path)
return {"embedding": embedding, "ref_audio": audio_path}, False
```

If caching, prefix your cache keys to avoid collisions with other engines using the same reference audio:
```python
cache_key = "yourengine_" + get_cache_key(audio_path, reference_text)
```

### 1.3 Register the engine

In `backend/backends/__init__.py`, three things:

**1. Add a `ModelConfig` entry** in `_get_non_qwen_tts_configs()`:

```python
ModelConfig(
    model_name="your-engine",
    display_name="Your Engine",
    engine="your_engine",
    hf_repo_id="org/model-repo",
    size_mb=3200,
    needs_trim=False,  # set True if output needs trim_tts_output()
    languages=["en", "fr", "de"],
),
```

This single entry replaces what used to be 6+ scattered dicts in `main.py`. The registry helpers (`get_model_config()`, `check_model_loaded()`, `engine_needs_trim()`, etc.) all derive from this config automatically.

**2. Add to `TTS_ENGINES` dict:**

```python
TTS_ENGINES = {
    ...
    "your_engine": "Your Engine",
}
```

**3. Add an elif branch in `get_tts_backend_for_engine()`:**

```python
elif engine == "your_engine":
    from .your_backend import YourBackend
    backend = YourBackend()
```

The import is deferred so platform-specific deps aren't loaded until the engine is first requested.

### 1.4 Update request models

In `backend/models.py`:

- Add engine name to `GenerationRequest.engine` regex pattern
- Add any new language codes to the language regex on both `GenerationRequest` and `VoiceProfileCreate`

---

## Phase 2: API Integration (`main.py`)

With the model config registry, `main.py` has **zero per-engine dispatch points**. All endpoints use registry helpers like `get_model_config()`, `load_engine_model()`, `engine_needs_trim()`, `check_model_loaded()`, etc.

**You don't need to touch `main.py` at all** unless your engine needs custom behavior in the generate endpoint (e.g. a new post-processing step beyond `trim_tts_output`).

### 2.1 What the registry handles automatically

| Endpoint | Registry function used |
|----------|----------------------|
| `POST /generate` | `load_engine_model(engine, size)` + `engine_needs_trim(engine)` |
| `POST /generate/stream` | `ensure_model_cached_or_raise(engine, size)` + `load_engine_model()` |
| `GET /models/status` | `get_all_model_configs()` + `check_model_loaded(config)` |
| `POST /models/download` | `get_model_config(name)` + `get_model_load_func(config)` |
| `POST /models/{name}/unload` | `get_model_config(name)` + `unload_model_by_config(config)` |
| `DELETE /models/{name}` | `get_model_config(name)` + `unload_model_by_config(config)` |

### 2.2 Post-processing

If your model produces trailing silence or hallucinated audio, set `needs_trim=True` on your `ModelConfig`. The generate endpoint checks `engine_needs_trim(engine)` and applies `trim_tts_output()` automatically.

---

## Phase 3: Frontend Integration

### 3.1 TypeScript types

In `app/src/lib/api/types.ts`:
- Add to the `engine` union type on `GenerationRequest`

### 3.2 Language maps

In `app/src/lib/constants/languages.ts`:
- Add entry to `ENGINE_LANGUAGES` record
- Add any new language codes to `ALL_LANGUAGES` if needed

### 3.3 Engine/model selector (shared component)

The model selector is a shared component — update one file:

- `app/src/components/Generation/EngineModelSelector.tsx`

Add an entry to `ENGINE_OPTIONS` and `ENGINE_DESCRIPTIONS`. If the engine is English-only, add it to `ENGLISH_ONLY_ENGINES`. The `handleEngineChange()` function handles language validation automatically (resets to first available language if the current one isn't supported).

Both `GenerationForm.tsx` and `FloatingGenerateBox.tsx` use `<EngineModelSelector>` — no changes needed in either.

Handle engine-specific UI conditionals in the form components if needed:
- Hide instruct field for engines that don't support it
- Show engine-specific controls (e.g. `ParalinguisticInput` for Turbo)

### 3.4 Form hook

In `app/src/lib/hooks/useGenerationForm.ts`:
- Add to Zod schema enum for `engine`
- Add engine-to-model-name mapping (e.g. `"your_engine"` → `"your-engine"`)
- Update payload construction to conditionally include engine-specific fields

### 3.5 Model management

In `app/src/components/ServerSettings/ModelManagement.tsx`:
- Add description to `MODEL_DESCRIPTIONS` record
- The model list auto-renders from `/models/status` data

---

## Phase 4: Dependencies

### 4.1 Python dependencies

Add to `backend/requirements.txt`. Watch for:

**Pinned dependency conflicts** — If the model package pins old versions of numpy, torch, or transformers, install with `--no-deps` and list sub-dependencies manually. This is what Chatterbox requires:
```
# In justfile/Makefile (NOT requirements.txt):
pip install --no-deps chatterbox-tts

# In requirements.txt — list the transitive deps:
conformer
diffusers
omegaconf
# ... etc
```

**Non-PyPI packages** — Some deps only exist as git repos:
```
linacodec @ git+https://github.com/user/repo.git
Zipvoice @ git+https://github.com/user/repo.git
```

**Custom package indexes** — Some packages need `--find-links`:
```
--find-links https://k2-fsa.github.io/icefall/piper_phonemize.html
```

### 4.2 Identifying hidden sub-dependencies

When using `--no-deps`, you need to manually figure out what the package actually imports. There's no shortcut:

1. Install the package normally in a throwaway venv
2. Run `pip show <package>` to get its `Requires:` list
3. Cross-reference against what's already in our requirements.txt
4. Test that the engine loads and generates without import errors

---

## Phase 5: PyInstaller Bundling

This is where most of the pain lives. If your model's Python package or its dependencies use any of the following at runtime, PyInstaller won't bundle them automatically:

### 5.1 Common PyInstaller issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| **`inspect.getsource()` at import time** | "could not get source code" | `--collect-all <package>` (bundles `.py` source files, not just bytecode) |
| **Data files (yaml, .pth.tar, lang dicts)** | FileNotFoundError at runtime | `--collect-all <package>` or `--collect-data <package>` |
| **Native data paths (espeak-ng, etc.)** | Library looks at `/usr/share/...` | Set env var in frozen builds: `os.environ["ESPEAK_DATA_PATH"] = bundled_path` |
| **`importlib.metadata` lookups** | "No package metadata found" | `--copy-metadata <package>` |
| **Dynamic imports** | ModuleNotFoundError | `--hidden-import <module>` |
| **`typeguard` / `@typechecked`** | Calls `inspect.getsource()` on decorated functions | `--collect-all` for the decorated package |

### 5.2 Testing frozen builds

You can't skip this. Models that work in `python -m uvicorn` will break in the PyInstaller binary. The flow:

1. Build the binary: `just build` or the PyInstaller spec
2. Run it and try to download + load + generate with the new engine
3. Check stderr for the actual error (macOS/Linux: stdout/stderr go to Tauri sidecar logs)
4. Fix, rebuild, repeat

### 5.3 Real examples from v0.2.3

These were all models that worked perfectly in dev:

- **LuxTTS**: `typeguard`'s `@typechecked` calls `inspect.getsource()` at import → needed `--collect-all inflect`. `piper_phonemize` bundles `espeak-ng-data/` → needed `--collect-all piper_phonemize` + `ESPEAK_DATA_PATH` env var
- **Chatterbox**: `resemble-perth` bundles a pretrained watermark model (`.pth.tar`, `hparams.yaml`) → needed `--collect-all perth`
- **Both**: `huggingface_hub` silently disables tqdm based on logger level → progress bars showed 0% in frozen builds until we force-enabled the internal counter

---

## Phase 6: Common Upstream Workarounds

Almost every model library has bugs you'll need to work around. Here's the catalog:

### 6.1 torch.load device mismatch

If model weights were saved on CUDA but you're loading on CPU/MPS:
```python
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault("map_location", "cpu")
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load
```
Used by both Chatterbox backends. Use a threading lock if patching globally.

### 6.2 Float64/Float32 dtype mismatch

`librosa` returns float64, model weights are float32. Patch the offending methods:
```python
original_fn = SomeClass.some_method
def patched_fn(self, *args, **kwargs):
    result = original_fn(self, *args, **kwargs)
    return result.float()  # float64 → float32
SomeClass.some_method = patched_fn
```
Used by Chatterbox for `S3Tokenizer.log_mel_spectrogram` and `VoiceEncoder.forward`.

### 6.3 Transformers attention implementation

If the model uses `output_attentions=True` with transformers >= 4.36:
```python
for module in model.modules():
    if hasattr(module, '_attn_implementation'):
        module._attn_implementation = "eager"
```
SDPA (the new default) doesn't support `output_attentions`. Force eager attention.

### 6.4 HuggingFace token bug

Some models' `from_pretrained()` passes `token=True` which requires a stored HF token even for public repos:
```python
from huggingface_hub import snapshot_download
local_path = snapshot_download(repo_id=REPO, token=None)
model = ModelClass.from_local(local_path, device=device)
```
Used by Chatterbox Turbo.

### 6.5 MPS tensor issues

MPS (Apple Silicon GPU) has incomplete operator coverage. If generation crashes on MPS:
```python
def _get_device(self):
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"  # Skip MPS entirely
```
Used by both Chatterbox backends. LuxTTS works fine on MPS.

### 6.6 HuggingFace progress tracking

To get download progress bars in the UI, wrap model loading with `HFProgressTracker`:
```python
from backend.utils.hf_progress import HFProgressTracker
tracker = HFProgressTracker(model_name, progress_manager)
with tracker.patch_download():
    model = ModelClass.from_pretrained(repo_id)
```
The tracker monkey-patches tqdm to intercept HuggingFace's internal progress bars. Must be set up BEFORE importing the model library if it imports HF at module level.

---

## Checklist

### Backend
- [ ] `backend/backends/<engine>_backend.py` — implements TTSBackend protocol
- [ ] `backend/backends/__init__.py` — `ModelConfig` entry + `TTS_ENGINES` + `get_tts_backend_for_engine()` elif
- [ ] `backend/models.py` — engine name in regex, any new language codes
- [ ] `backend/requirements.txt` — dependencies added (check for `--no-deps` needs)
- [ ] `justfile` / `Makefile` — `--no-deps` install step if needed

### API (`backend/main.py`)
No changes needed — the model config registry handles all dispatch automatically.

### Frontend
- [ ] `app/src/lib/api/types.ts` — engine union type
- [ ] `app/src/lib/constants/languages.ts` — `ENGINE_LANGUAGES` entry
- [ ] `app/src/components/Generation/EngineModelSelector.tsx` — `ENGINE_OPTIONS` + `ENGINE_DESCRIPTIONS` + `ENGLISH_ONLY_ENGINES`
- [ ] `app/src/lib/hooks/useGenerationForm.ts` — Zod schema + model mapping
- [ ] `app/src/components/ServerSettings/ModelManagement.tsx` — model description

### Production
- [ ] PyInstaller spec — `--collect-all`, `--hidden-import`, `--copy-metadata` as needed
- [ ] Test in frozen binary — download, load, generate all work
- [ ] Download progress — `HFProgressTracker` wired up, progress shows in UI

### Upstream workarounds (check which apply)
- [ ] torch.load device mapping (CUDA weights on CPU)
- [ ] Float64→Float32 patches (librosa interaction)
- [ ] Eager attention forcing (transformers >= 4.36)
- [ ] HF token bypass (snapshot_download + from_local)
- [ ] MPS skip (if operators not supported)
- [ ] espeak-ng / native data path env vars
