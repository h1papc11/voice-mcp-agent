"""
FastAPI application for voicebox backend.

Handles voice cloning, generation history, and server mode.
"""

from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn
import argparse
import torch
import tempfile
from pathlib import Path
import uuid

from . import database, models, profiles, history, tts, transcribe, config
from .database import get_db, Generation as DBGeneration, VoiceProfile as DBVoiceProfile
from .utils.progress import get_progress_manager

app = FastAPI(
    title="voicebox API",
    description="Production-quality Qwen3-TTS voice cloning API",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# ROOT & HEALTH ENDPOINTS
# ============================================

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "voicebox API", "version": "0.1.0"}


@app.get("/health", response_model=models.HealthResponse)
async def health():
    """Health check endpoint."""
    from huggingface_hub import hf_hub_download
    from pathlib import Path
    import os
    
    tts_model = tts.get_tts_model()
    gpu_available = torch.cuda.is_available()
    
    vram_used = None
    if gpu_available:
        vram_used = torch.cuda.memory_allocated() / 1024 / 1024  # MB
    
    # Check if model is loaded - use the same logic as model status endpoint
    model_loaded = False
    model_size = None
    try:
        # Use the same check as model status endpoint
        if tts_model.is_loaded():
            model_loaded = True
            # Get the actual loaded model size
            # Check _current_model_size first (more reliable for actually loaded models)
            model_size = getattr(tts_model, '_current_model_size', None)
            if not model_size:
                # Fallback to model_size attribute (which should be set when model loads)
                model_size = getattr(tts_model, 'model_size', None)
    except Exception:
        # If there's an error checking, assume not loaded
        model_loaded = False
        model_size = None
    
    # Check if default model is downloaded (cached)
    model_downloaded = None
    try:
        # Check if the default model (1.7B) is cached
        default_model_id = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
        
        # Method 1: Try scan_cache_dir if available
        try:
            from huggingface_hub import scan_cache_dir
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                if repo.repo_id == default_model_id:
                    model_downloaded = True
                    break
        except (ImportError, Exception):
            # Method 2: Check cache directory
            cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
            repo_cache = Path(cache_dir) / "models--" + default_model_id.replace("/", "--")
            if repo_cache.exists():
                has_model_files = (
                    any(repo_cache.rglob("*.bin")) or
                    any(repo_cache.rglob("*.safetensors")) or
                    any(repo_cache.rglob("*.pt")) or
                    any(repo_cache.rglob("*.pth"))
                )
                model_downloaded = has_model_files
    except Exception:
        pass
    
    return models.HealthResponse(
        status="healthy",
        model_loaded=model_loaded,
        model_downloaded=model_downloaded,
        model_size=model_size,
        gpu_available=gpu_available,
        vram_used_mb=vram_used,
    )


# ============================================
# VOICE PROFILE ENDPOINTS
# ============================================

@app.post("/profiles", response_model=models.VoiceProfileResponse)
async def create_profile(
    data: models.VoiceProfileCreate,
    db: Session = Depends(get_db),
):
    """Create a new voice profile."""
    try:
        return await profiles.create_profile(data, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/profiles", response_model=List[models.VoiceProfileResponse])
async def list_profiles(db: Session = Depends(get_db)):
    """List all voice profiles."""
    return await profiles.list_profiles(db)


@app.get("/profiles/{profile_id}", response_model=models.VoiceProfileResponse)
async def get_profile(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Get a voice profile by ID."""
    profile = await profiles.get_profile(profile_id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.put("/profiles/{profile_id}", response_model=models.VoiceProfileResponse)
async def update_profile(
    profile_id: str,
    data: models.VoiceProfileCreate,
    db: Session = Depends(get_db),
):
    """Update a voice profile."""
    profile = await profiles.update_profile(profile_id, data, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.delete("/profiles/{profile_id}")
async def delete_profile(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Delete a voice profile."""
    success = await profiles.delete_profile(profile_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile deleted successfully"}


@app.post("/profiles/{profile_id}/samples", response_model=models.ProfileSampleResponse)
async def add_profile_sample(
    profile_id: str,
    file: UploadFile = File(...),
    reference_text: str = Form(...),
    db: Session = Depends(get_db),
):
    """Add a sample to a voice profile."""
    # Save uploaded file to temporary location
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        sample = await profiles.add_profile_sample(
            profile_id,
            tmp_path,
            reference_text,
            db,
        )
        return sample
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        # Clean up temp file
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/profiles/{profile_id}/samples", response_model=List[models.ProfileSampleResponse])
async def get_profile_samples(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Get all samples for a profile."""
    return await profiles.get_profile_samples(profile_id, db)


@app.delete("/profiles/samples/{sample_id}")
async def delete_profile_sample(
    sample_id: str,
    db: Session = Depends(get_db),
):
    """Delete a profile sample."""
    success = await profiles.delete_profile_sample(sample_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Sample not found")
    return {"message": "Sample deleted successfully"}


# ============================================
# GENERATION ENDPOINTS
# ============================================

@app.post("/generate", response_model=models.GenerationResponse)
async def generate_speech(
    data: models.GenerationRequest,
    db: Session = Depends(get_db),
):
    """Generate speech from text using a voice profile."""
    try:
        # Get profile
        profile = await profiles.get_profile(data.profile_id, db)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Create voice prompt from profile
        voice_prompt = await profiles.create_voice_prompt_for_profile(
            data.profile_id,
            db,
        )
        
        # Generate audio
        tts_model = tts.get_tts_model()
        # Load the requested model size if different from current
        model_size = data.model_size or "1.7B"
        tts_model.load_model(model_size)
        audio, sample_rate = await tts_model.generate(
            data.text,
            voice_prompt,
            data.language,
            data.seed,
            data.instruct,
        )

        # Calculate duration
        duration = len(audio) / sample_rate

        # Save audio
        generation_id = str(uuid.uuid4())
        audio_path = config.get_generations_dir() / f"{generation_id}.wav"

        from .utils.audio import save_audio
        save_audio(audio, str(audio_path), sample_rate)

        # Create history entry
        generation = await history.create_generation(
            profile_id=data.profile_id,
            text=data.text,
            language=data.language,
            audio_path=str(audio_path),
            duration=duration,
            seed=data.seed,
            db=db,
            instruct=data.instruct,
        )
        
        return generation
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# HISTORY ENDPOINTS
# ============================================

@app.get("/history", response_model=models.HistoryListResponse)
async def list_history(
    profile_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List generation history with optional filters."""
    query = models.HistoryQuery(
        profile_id=profile_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return await history.list_generations(query, db)


@app.get("/history/{generation_id}", response_model=models.HistoryResponse)
async def get_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Get a generation by ID."""
    # Get generation with profile name
    result = db.query(
        DBGeneration,
        DBVoiceProfile.name.label('profile_name')
    ).join(
        DBVoiceProfile,
        DBGeneration.profile_id == DBVoiceProfile.id
    ).filter(
        DBGeneration.id == generation_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    gen, profile_name = result
    return models.HistoryResponse(
        id=gen.id,
        profile_id=gen.profile_id,
        profile_name=profile_name,
        text=gen.text,
        language=gen.language,
        audio_path=gen.audio_path,
        duration=gen.duration,
        seed=gen.seed,
        instruct=gen.instruct,
        created_at=gen.created_at,
    )


@app.delete("/history/{generation_id}")
async def delete_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Delete a generation."""
    success = await history.delete_generation(generation_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Generation not found")
    return {"message": "Generation deleted successfully"}


@app.get("/history/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get generation statistics."""
    return await history.get_generation_stats(db)


# ============================================
# TRANSCRIPTION ENDPOINTS
# ============================================

@app.post("/transcribe", response_model=models.TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe audio file to text."""
    # Save uploaded file to temporary location
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Get audio duration
        from .utils.audio import load_audio
        audio, sr = load_audio(tmp_path)
        duration = len(audio) / sr
        
        # Transcribe
        whisper_model = transcribe.get_whisper_model()
        text = await whisper_model.transcribe(tmp_path, language)
        
        return models.TranscriptionResponse(
            text=text,
            duration=duration,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        Path(tmp_path).unlink(missing_ok=True)


# ============================================
# FILE SERVING
# ============================================

@app.get("/audio/{generation_id}")
async def get_audio(generation_id: str, db: Session = Depends(get_db)):
    """Serve generated audio file."""
    generation = await history.get_generation(generation_id, db)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    audio_path = Path(generation.audio_path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        audio_path,
        media_type="audio/wav",
        filename=f"generation_{generation_id}.wav",
    )


# ============================================
# MODEL MANAGEMENT
# ============================================

@app.post("/models/load")
async def load_model(model_size: str = "1.7B"):
    """Manually load TTS model."""
    try:
        tts_model = tts.get_tts_model()
        tts_model.load_model(model_size)
        return {"message": f"Model {model_size} loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/unload")
async def unload_model():
    """Unload TTS model to free memory."""
    try:
        tts.unload_tts_model()
        return {"message": "Model unloaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models/progress/{model_name}")
async def get_model_progress(model_name: str):
    """Get model download progress via Server-Sent Events."""
    from fastapi.responses import StreamingResponse
    
    progress_manager = get_progress_manager()
    
    async def event_generator():
        """Generate SSE events for progress updates."""
        async for event in progress_manager.subscribe(model_name):
            yield event
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/models/status", response_model=models.ModelStatusListResponse)
async def get_model_status():
    """Get status of all available models."""
    from huggingface_hub import hf_hub_download
    from pathlib import Path
    import os
    
    # Try to import scan_cache_dir (might not be available in older versions)
    try:
        from huggingface_hub import scan_cache_dir
        use_scan_cache = True
    except ImportError:
        use_scan_cache = False
    
    def check_tts_loaded(model_size: str):
        """Check if TTS model is loaded with specific size."""
        try:
            tts_model = tts.get_tts_model()
            return tts_model.is_loaded() and tts_model.model_size == model_size
        except Exception:
            return False
    
    def check_whisper_loaded(model_size: str):
        """Check if Whisper model is loaded with specific size."""
        try:
            whisper_model = transcribe.get_whisper_model()
            return whisper_model.is_loaded() and whisper_model.model_size == model_size
        except Exception:
            return False
    
    model_configs = [
        {
            "model_name": "qwen-tts-1.7B",
            "display_name": "Qwen TTS 1.7B",
            "hf_repo_id": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
            "model_size": "1.7B",
            "check_loaded": lambda: check_tts_loaded("1.7B"),
        },
        {
            "model_name": "qwen-tts-0.6B",
            "display_name": "Qwen TTS 0.6B",
            "hf_repo_id": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
            "model_size": "0.6B",
            "check_loaded": lambda: check_tts_loaded("0.6B"),
        },
        {
            "model_name": "whisper-base",
            "display_name": "Whisper Base",
            "hf_repo_id": "openai/whisper-base",
            "model_size": "base",
            "check_loaded": lambda: check_whisper_loaded("base"),
        },
        {
            "model_name": "whisper-small",
            "display_name": "Whisper Small",
            "hf_repo_id": "openai/whisper-small",
            "model_size": "small",
            "check_loaded": lambda: check_whisper_loaded("small"),
        },
        {
            "model_name": "whisper-medium",
            "display_name": "Whisper Medium",
            "hf_repo_id": "openai/whisper-medium",
            "model_size": "medium",
            "check_loaded": lambda: check_whisper_loaded("medium"),
        },
        {
            "model_name": "whisper-large",
            "display_name": "Whisper Large",
            "hf_repo_id": "openai/whisper-large",
            "model_size": "large",
            "check_loaded": lambda: check_whisper_loaded("large"),
        },
    ]
    
    # Get HuggingFace cache info (if available)
    cache_info = None
    if use_scan_cache:
        try:
            cache_info = scan_cache_dir()
        except Exception:
            # Function failed, continue without it
            pass
    
    statuses = []
    
    for config in model_configs:
        try:
            downloaded = False
            size_mb = None
            loaded = False
            
            # Method 1: Try using scan_cache_dir if available
            if cache_info:
                repo_id = config["hf_repo_id"]
                for repo in cache_info.repos:
                    if repo.repo_id == repo_id:
                        downloaded = True
                        # Calculate size from cache info
                        try:
                            total_size = sum(revision.size_on_disk for revision in repo.revisions)
                            size_mb = total_size / (1024 * 1024)
                        except Exception:
                            pass
                        break
            
            # Method 2: Fallback to checking cache directory directly
            if not downloaded:
                try:
                    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
                    repo_cache = Path(cache_dir) / "models--" + config["hf_repo_id"].replace("/", "--")
                    
                    if repo_cache.exists():
                        # Check for model files (bin, safetensors, or other common model files)
                        has_model_files = (
                            any(repo_cache.rglob("*.bin")) or
                            any(repo_cache.rglob("*.safetensors")) or
                            any(repo_cache.rglob("*.pt")) or
                            any(repo_cache.rglob("*.pth")) or
                            any(repo_cache.rglob("model.safetensors.index.json")) or
                            any(repo_cache.rglob("pytorch_model.bin.index.json"))
                        )
                        
                        if has_model_files:
                            downloaded = True
                            # Calculate size
                            try:
                                total_size = sum(f.stat().st_size for f in repo_cache.rglob("*") if f.is_file())
                                size_mb = total_size / (1024 * 1024)
                            except Exception:
                                pass
                except Exception:
                    pass
            
            # Method 3: Try to check if model can be loaded locally (last resort)
            if not downloaded:
                try:
                    # Try to download with local_files_only=True to check if cached
                    hf_hub_download(
                        repo_id=config["hf_repo_id"],
                        filename="config.json",  # Try a common file
                        local_files_only=True,
                    )
                    downloaded = True
                except Exception:
                    # File not found locally, model not downloaded
                    pass
            
            # Check if loaded in memory
            try:
                loaded = config["check_loaded"]()
            except Exception:
                loaded = False
            
            statuses.append(models.ModelStatus(
                model_name=config["model_name"],
                display_name=config["display_name"],
                downloaded=downloaded,
                size_mb=size_mb,
                loaded=loaded,
            ))
        except Exception as e:
            # If check fails, try to at least check if loaded
            try:
                loaded = config["check_loaded"]()
            except Exception:
                loaded = False
            
            statuses.append(models.ModelStatus(
                model_name=config["model_name"],
                display_name=config["display_name"],
                downloaded=False,  # Assume not downloaded if check failed
                size_mb=None,
                loaded=loaded,
            ))
    
    return models.ModelStatusListResponse(models=statuses)


@app.post("/models/download")
async def trigger_model_download(request: models.ModelDownloadRequest):
    """Trigger download of a specific model."""
    import asyncio
    
    model_configs = {
        "qwen-tts-1.7B": {
            "model_size": "1.7B",
            "load_func": lambda: tts.get_tts_model().load_model("1.7B"),
        },
        "qwen-tts-0.6B": {
            "model_size": "0.6B",
            "load_func": lambda: tts.get_tts_model().load_model("0.6B"),
        },
        "whisper-base": {
            "model_size": "base",
            "load_func": lambda: transcribe.get_whisper_model().load_model("base"),
        },
        "whisper-small": {
            "model_size": "small",
            "load_func": lambda: transcribe.get_whisper_model().load_model("small"),
        },
        "whisper-medium": {
            "model_size": "medium",
            "load_func": lambda: transcribe.get_whisper_model().load_model("medium"),
        },
        "whisper-large": {
            "model_size": "large",
            "load_func": lambda: transcribe.get_whisper_model().load_model("large"),
        },
    }
    
    if request.model_name not in model_configs:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model_name}")
    
    config = model_configs[request.model_name]
    
    try:
        # Trigger download by loading the model (which will download if not cached)
        # Run in background to avoid blocking
        await asyncio.to_thread(config["load_func"])
        
        return {"message": f"Model {request.model_name} download started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# STARTUP & SHUTDOWN
# ============================================

@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    print("voicebox API starting up...")
    database.init_db()
    print(f"Database initialized at {database._db_path}")
    print(f"GPU available: {torch.cuda.is_available()}")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    print("voicebox API shutting down...")
    # Unload models to free memory
    tts.unload_tts_model()
    transcribe.unload_whisper_model()


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="voicebox backend server")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (use 0.0.0.0 for remote access)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to",
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=None,
        help="Data directory for database, profiles, and generated audio",
    )
    args = parser.parse_args()

    # Set data directory if provided
    if args.data_dir:
        config.set_data_dir(args.data_dir)

    # Initialize database after data directory is set
    database.init_db()

    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=args.port,
        reload=False,  # Disable reload in production
    )
