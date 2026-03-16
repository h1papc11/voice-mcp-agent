"""FastAPI application factory, middleware, and lifecycle events."""

import asyncio
import os
from pathlib import Path

# AMD GPU environment variables must be set before torch import
if not os.environ.get("HSA_OVERRIDE_GFX_VERSION"):
    os.environ["HSA_OVERRIDE_GFX_VERSION"] = "10.3.0"
if not os.environ.get("MIOPEN_LOG_LEVEL"):
    os.environ["MIOPEN_LOG_LEVEL"] = "4"

import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import quote

from . import __version__, database
from .services import tts, transcribe
from .database import get_db
from .utils.platform_detect import get_backend_type
from .utils.progress import get_progress_manager
from .services.task_queue import create_background_task, init_queue
from .routes import register_routers


def safe_content_disposition(disposition_type: str, filename: str) -> str:
    """Build a Content-Disposition header safe for non-ASCII filenames.

    Uses RFC 5987 ``filename*`` parameter so browsers can decode UTF-8
    filenames while the ``filename`` fallback stays ASCII-only.
    """
    ascii_name = (
        "".join(c for c in filename if c.isascii() and (c.isalnum() or c in " -_.")).strip() or "download"
    )
    utf8_name = quote(filename, safe="")
    return f'{disposition_type}; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(
        title="voicebox API",
        description="Production-quality Qwen3-TTS voice cloning API",
        version=__version__,
    )

    _configure_cors(application)
    register_routers(application)
    _register_lifecycle(application)

    return application


def _configure_cors(application: FastAPI) -> None:
    """Set up CORS middleware with local-first defaults."""
    default_origins = [
        "http://localhost:5173",        # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:17493",
        "http://127.0.0.1:17493",
        "tauri://localhost",            # Tauri webview (macOS)
        "https://tauri.localhost",      # Tauri webview (Windows/Linux)
        "http://tauri.localhost",       # Tauri webview (Windows, some builds)
    ]
    env_origins = os.environ.get("VOICEBOX_CORS_ORIGINS", "")
    all_origins = default_origins + [o.strip() for o in env_origins.split(",") if o.strip()]

    application.add_middleware(
        CORSMiddleware,
        allow_origins=all_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _get_gpu_status() -> str:
    """Return a human-readable string describing GPU availability."""
    backend_type = get_backend_type()
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        is_rocm = hasattr(torch.version, "hip") and torch.version.hip is not None
        if is_rocm:
            return f"ROCm ({device_name})"
        return f"CUDA ({device_name})"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "MPS (Apple Silicon)"
    elif backend_type == "mlx":
        return "Metal (Apple Silicon via MLX)"
    return "None (CPU only)"


def _register_lifecycle(application: FastAPI) -> None:
    """Attach startup and shutdown event handlers."""

    @application.on_event("startup")
    async def startup_event():
        print("voicebox API starting up...")
        database.init_db()
        print(f"Database initialized at {database._db_path}")

        init_queue()

        # Mark stale "generating" records as failed -- leftovers from a killed process
        try:
            from sqlalchemy import text as sa_text

            db = next(get_db())
            result = db.execute(
                sa_text(
                    "UPDATE generations SET status = 'failed', "
                    "error = 'Server was shut down during generation' "
                    "WHERE status = 'generating'"
                )
            )
            if result.rowcount > 0:
                print(f"Marked {result.rowcount} stale generation(s) as failed")
            db.commit()
            db.close()
        except Exception as e:
            print(f"Warning: Could not clean up stale generations: {e}")

        backend_type = get_backend_type()
        print(f"Backend: {backend_type.upper()}")
        print(f"GPU available: {_get_gpu_status()}")

        from .services.cuda import check_and_update_cuda_binary

        create_background_task(check_and_update_cuda_binary())

        try:
            progress_manager = get_progress_manager()
            progress_manager._set_main_loop(asyncio.get_running_loop())
            print("Progress manager initialized with event loop")
        except Exception as e:
            print(f"Warning: Could not initialize progress manager event loop: {e}")

        try:
            from huggingface_hub import constants as hf_constants

            cache_dir = Path(hf_constants.HF_HUB_CACHE)
            cache_dir.mkdir(parents=True, exist_ok=True)
            print(f"HuggingFace cache directory: {cache_dir}")
        except Exception as e:
            print(f"Warning: Could not create HuggingFace cache directory: {e}")
            print("Model downloads may fail. Please ensure the directory exists and has write permissions.")

    @application.on_event("shutdown")
    async def shutdown_event():
        print("voicebox API shutting down...")
        tts.unload_tts_model()
        transcribe.unload_whisper_model()


app = create_app()
