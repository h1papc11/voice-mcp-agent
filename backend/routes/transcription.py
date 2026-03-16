"""Transcription endpoints."""

import asyncio
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import models, transcribe
from ..services.task_queue import create_background_task
from ..utils.tasks import get_task_manager

router = APIRouter()


@router.post("/transcribe", response_model=models.TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(None),
):
    """Transcribe audio file to text."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from ..utils.audio import load_audio

        audio, sr = await asyncio.to_thread(load_audio, tmp_path)
        duration = len(audio) / sr

        whisper_model = transcribe.get_whisper_model()

        model_size = whisper_model.model_size
        whisper_hf_repos = {
            "large": "openai/whisper-large-v3",
            "turbo": "openai/whisper-large-v3-turbo",
        }
        model_name = whisper_hf_repos.get(model_size, f"openai/whisper-{model_size}")

        from huggingface_hub import constants as hf_constants

        repo_cache = Path(hf_constants.HF_HUB_CACHE) / ("models--" + model_name.replace("/", "--"))
        if not repo_cache.exists():
            progress_model_name = f"whisper-{model_size}"

            async def download_whisper_background():
                try:
                    await whisper_model.load_model_async(model_size)
                except Exception as e:
                    get_task_manager().error_download(progress_model_name, str(e))

            get_task_manager().start_download(progress_model_name)
            create_background_task(download_whisper_background())

            raise HTTPException(
                status_code=202,
                detail={
                    "message": f"Whisper model {model_size} is being downloaded. Please wait and try again.",
                    "model_name": progress_model_name,
                    "downloading": True,
                },
            )

        text = await whisper_model.transcribe(tmp_path, language)

        return models.TranscriptionResponse(
            text=text,
            duration=duration,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)
