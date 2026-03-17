"""
HumeAI TADA TTS backend implementation.

Wraps HumeAI's TADA (Text-Acoustic Dual Alignment) model for
high-quality voice cloning. Two model variants:
  - tada-1b: English-only, ~2B params (Llama 3.2 1B base)
  - tada-3b-ml: Multilingual, ~4B params (Llama 3.2 3B base)

Both use a shared encoder/codec (HumeAI/tada-codec). The encoder
produces 1:1 aligned token embeddings from reference audio, and the
causal LM generates speech via flow-matching diffusion.

24kHz output, bf16 inference on CUDA, fp32 on CPU.
"""

import asyncio
import logging
import threading
from typing import ClassVar, List, Optional, Tuple

import numpy as np

from . import TTSBackend
from .base import (
    is_model_cached,
    get_torch_device,
    combine_voice_prompts as _combine_voice_prompts,
    model_load_progress,
)
from ..utils.cache import get_cache_key, get_cached_voice_prompt, cache_voice_prompt

logger = logging.getLogger(__name__)

# HuggingFace repos
TADA_CODEC_REPO = "HumeAI/tada-codec"
TADA_1B_REPO = "HumeAI/tada-1b"
TADA_3B_ML_REPO = "HumeAI/tada-3b-ml"

TADA_MODEL_REPOS = {
    "1B": TADA_1B_REPO,
    "3B": TADA_3B_ML_REPO,
}

# Key weight files for cache detection
_TADA_MODEL_WEIGHT_FILES = [
    "model.safetensors",
]

_TADA_CODEC_WEIGHT_FILES = [
    "encoder/model.safetensors",
]


class HumeTadaBackend:
    """HumeAI TADA TTS backend for high-quality voice cloning."""

    _load_lock: ClassVar[threading.Lock] = threading.Lock()

    def __init__(self):
        self.model = None
        self.encoder = None
        self.model_size = "1B"  # default to 1B
        self._device = None
        self._model_load_lock = asyncio.Lock()

    def _get_device(self) -> str:
        # Force CPU on macOS — MPS has issues with flow matching
        # and large vocab lm_head (>65536 output channels)
        return get_torch_device(force_cpu_on_mac=True)

    def is_loaded(self) -> bool:
        return self.model is not None

    def _get_model_path(self, model_size: str = "1B") -> str:
        return TADA_MODEL_REPOS.get(model_size, TADA_1B_REPO)

    def _is_model_cached(self, model_size: str = "1B") -> bool:
        repo = TADA_MODEL_REPOS.get(model_size, TADA_1B_REPO)
        model_cached = is_model_cached(repo, required_files=_TADA_MODEL_WEIGHT_FILES)
        codec_cached = is_model_cached(TADA_CODEC_REPO, required_files=_TADA_CODEC_WEIGHT_FILES)
        return model_cached and codec_cached

    async def load_model(self, model_size: str = "1B") -> None:
        """Load the TADA model and encoder."""
        if self.model is not None and self.model_size == model_size:
            return
        async with self._model_load_lock:
            if self.model is not None and self.model_size == model_size:
                return
            # Unload existing model if switching sizes
            if self.model is not None:
                self.unload_model()
            self.model_size = model_size
            await asyncio.to_thread(self._load_model_sync, model_size)

    def _load_model_sync(self, model_size: str = "1B"):
        """Synchronous model loading with progress tracking."""
        model_name = f"tada-{model_size.lower()}"
        is_cached = self._is_model_cached(model_size)
        repo = TADA_MODEL_REPOS.get(model_size, TADA_1B_REPO)

        with model_load_progress(model_name, is_cached):
            import torch
            from huggingface_hub import snapshot_download

            device = self._get_device()
            self._device = device
            logger.info(f"Loading HumeAI TADA {model_size} on {device}...")

            # Download codec (encoder + decoder) if not cached
            logger.info("Downloading TADA codec...")
            snapshot_download(
                repo_id=TADA_CODEC_REPO,
                token=None,
                allow_patterns=["*.safetensors", "*.json", "*.txt", "*.bin"],
            )

            # Download model weights if not cached
            logger.info(f"Downloading TADA {model_size} model...")
            snapshot_download(
                repo_id=repo,
                token=None,
                allow_patterns=["*.safetensors", "*.json", "*.txt", "*.bin", "*.model"],
            )

            # Determine dtype — use bf16 on CUDA for ~50% memory savings
            if device == "cuda" and torch.cuda.is_bf16_supported():
                model_dtype = torch.bfloat16
            else:
                model_dtype = torch.float32

            # Load encoder (only needed for voice prompt encoding)
            from tada.modules.encoder import Encoder
            logger.info("Loading TADA encoder...")
            self.encoder = Encoder.from_pretrained(
                TADA_CODEC_REPO, subfolder="encoder"
            ).to(device)
            self.encoder.eval()

            # Load the causal LM (includes decoder for wav generation)
            from tada.modules.tada import TadaForCausalLM
            logger.info(f"Loading TADA {model_size} model...")
            self.model = TadaForCausalLM.from_pretrained(
                repo, torch_dtype=model_dtype
            ).to(device)
            self.model.eval()

        logger.info(f"HumeAI TADA {model_size} loaded successfully on {device}")

    def unload_model(self) -> None:
        """Unload model and encoder to free memory."""
        if self.model is not None:
            del self.model
            self.model = None
        if self.encoder is not None:
            del self.encoder
            self.encoder = None

        self._device = None

        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        logger.info("HumeAI TADA unloaded")

    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[dict, bool]:
        """
        Create voice prompt from reference audio using TADA's encoder.

        TADA's encoder performs forced alignment between audio and text tokens,
        producing an EncoderOutput with 1:1 token-audio alignment. If no
        reference_text is provided, the encoder uses built-in ASR (English only).

        We serialize the EncoderOutput to a dict for caching.
        """
        await self.load_model(self.model_size)

        cache_key = (
            "tada_" + get_cache_key(audio_path, reference_text)
        ) if use_cache else None

        if cache_key:
            cached = get_cached_voice_prompt(cache_key)
            if cached is not None and isinstance(cached, dict):
                return cached, True

        def _encode_sync():
            import torch
            import torchaudio

            device = self._device

            # Load and prepare audio
            audio, sr = torchaudio.load(str(audio_path))
            audio = audio.to(device)

            # Encode with forced alignment
            text_arg = [reference_text] if reference_text else None
            prompt = self.encoder(
                audio, text=text_arg, sample_rate=sr
            )

            # Serialize EncoderOutput to a dict of CPU tensors for caching
            prompt_dict = {}
            for field_name in prompt.__dataclass_fields__:
                val = getattr(prompt, field_name)
                if isinstance(val, torch.Tensor):
                    prompt_dict[field_name] = val.detach().cpu()
                elif isinstance(val, list):
                    prompt_dict[field_name] = val
                elif isinstance(val, (int, float)):
                    prompt_dict[field_name] = val
                else:
                    prompt_dict[field_name] = val
            return prompt_dict

        encoded = await asyncio.to_thread(_encode_sync)

        if cache_key:
            cache_voice_prompt(cache_key, encoded)

        return encoded, False

    async def combine_voice_prompts(
        self,
        audio_paths: List[str],
        reference_texts: List[str],
    ) -> Tuple[np.ndarray, str]:
        return await _combine_voice_prompts(audio_paths, reference_texts, sample_rate=24000)

    async def generate(
        self,
        text: str,
        voice_prompt: dict,
        language: str = "en",
        seed: Optional[int] = None,
        instruct: Optional[str] = None,
    ) -> Tuple[np.ndarray, int]:
        """
        Generate audio from text using HumeAI TADA.

        Args:
            text: Text to synthesize
            voice_prompt: Serialized EncoderOutput dict from create_voice_prompt()
            language: Language code (en, ar, de, es, fr, it, ja, pl, pt, zh)
            seed: Random seed for reproducibility
            instruct: Not supported by TADA (ignored)

        Returns:
            Tuple of (audio_array, sample_rate=24000)
        """
        await self.load_model(self.model_size)

        def _generate_sync():
            import torch
            from tada.modules.encoder import EncoderOutput

            if seed is not None:
                torch.manual_seed(seed)
                if torch.cuda.is_available():
                    torch.cuda.manual_seed(seed)

            device = self._device

            # Reconstruct EncoderOutput from the cached dict
            restored = {}
            for k, v in voice_prompt.items():
                if isinstance(v, torch.Tensor):
                    # Move to device and match model dtype for float tensors
                    if v.is_floating_point():
                        model_dtype = next(self.model.parameters()).dtype
                        restored[k] = v.to(device=device, dtype=model_dtype)
                    else:
                        restored[k] = v.to(device=device)
                else:
                    restored[k] = v

            prompt = EncoderOutput(**restored)

            # For non-English with the 3B-ML model, we could reload the
            # encoder with the language-specific aligner. However, the
            # generation itself is language-agnostic — only the encoder's
            # aligner changes. Since we encode at create_voice_prompt time,
            # the language is already baked in. For simplicity, we don't
            # reload the encoder here.

            logger.info(f"[TADA] Generating ({language}), text length: {len(text)}")

            output = self.model.generate(
                prompt=prompt,
                text=text,
            )

            # output.audio is a list of tensors (one per batch item)
            if output.audio and output.audio[0] is not None:
                audio_tensor = output.audio[0]
                audio = audio_tensor.detach().cpu().numpy().squeeze().astype(np.float32)
            else:
                logger.warning("[TADA] Generation produced no audio")
                audio = np.zeros(24000, dtype=np.float32)

            return audio, 24000

        return await asyncio.to_thread(_generate_sync)
