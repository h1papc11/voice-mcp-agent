"""
Pydantic models for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class VoiceProfileCreate(BaseModel):
    """Request model for creating a voice profile."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    language: str = Field(default="en", pattern="^(zh|en|ja|ko|de|fr|ru|pt|es|it)$")


class VoiceProfileResponse(BaseModel):
    """Response model for voice profile."""
    id: str
    name: str
    description: Optional[str]
    language: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProfileSampleCreate(BaseModel):
    """Request model for adding a sample to a profile."""
    reference_text: str = Field(..., min_length=1, max_length=1000)


class ProfileSampleResponse(BaseModel):
    """Response model for profile sample."""
    id: str
    profile_id: str
    audio_path: str
    reference_text: str

    class Config:
        from_attributes = True


class GenerationRequest(BaseModel):
    """Request model for voice generation."""
    profile_id: str
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = Field(default="en", pattern="^(zh|en|ja|ko|de|fr|ru|pt|es|it)$")
    seed: Optional[int] = Field(None, ge=0)
    model_size: Optional[str] = Field(default="1.7B", pattern="^(1\\.7B|0\\.6B)$")
    instruct: Optional[str] = Field(None, max_length=500)


class GenerationResponse(BaseModel):
    """Response model for voice generation."""
    id: str
    profile_id: str
    text: str
    language: str
    audio_path: str
    duration: float
    seed: Optional[int]
    instruct: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class HistoryQuery(BaseModel):
    """Query model for generation history."""
    profile_id: Optional[str] = None
    search: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class HistoryResponse(BaseModel):
    """Response model for history entry (includes profile name)."""
    id: str
    profile_id: str
    profile_name: str
    text: str
    language: str
    audio_path: str
    duration: float
    seed: Optional[int]
    instruct: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    """Response model for history list."""
    items: List[HistoryResponse]
    total: int


class TranscriptionRequest(BaseModel):
    """Request model for audio transcription."""
    language: Optional[str] = Field(None, pattern="^(en|zh)$")


class TranscriptionResponse(BaseModel):
    """Response model for transcription."""
    text: str
    duration: float


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    model_loaded: bool
    model_downloaded: Optional[bool] = None  # Whether model is cached/downloaded
    model_size: Optional[str] = None  # Current model size if loaded
    gpu_available: bool
    vram_used_mb: Optional[float] = None


class ModelStatus(BaseModel):
    """Response model for model status."""
    model_name: str
    display_name: str
    downloaded: bool
    size_mb: Optional[float] = None
    loaded: bool = False


class ModelStatusListResponse(BaseModel):
    """Response model for model status list."""
    models: List[ModelStatus]


class ModelDownloadRequest(BaseModel):
    """Request model for triggering model download."""
    model_name: str


class ActiveDownloadTask(BaseModel):
    """Response model for active download task."""
    model_name: str
    status: str
    started_at: datetime


class ActiveGenerationTask(BaseModel):
    """Response model for active generation task."""
    task_id: str
    profile_id: str
    text_preview: str
    started_at: datetime


class ActiveTasksResponse(BaseModel):
    """Response model for active tasks."""
    downloads: List[ActiveDownloadTask]
    generations: List[ActiveGenerationTask]


class AudioChannelCreate(BaseModel):
    """Request model for creating an audio channel."""
    name: str = Field(..., min_length=1, max_length=100)
    device_ids: List[str] = Field(default_factory=list)


class AudioChannelUpdate(BaseModel):
    """Request model for updating an audio channel."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    device_ids: Optional[List[str]] = None


class AudioChannelResponse(BaseModel):
    """Response model for audio channel."""
    id: str
    name: str
    is_default: bool
    device_ids: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChannelVoiceAssignment(BaseModel):
    """Request model for assigning voices to a channel."""
    profile_ids: List[str]


class ProfileChannelAssignment(BaseModel):
    """Request model for assigning channels to a profile."""
    channel_ids: List[str]
