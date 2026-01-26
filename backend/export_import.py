"""
Voice profile export/import module.

Handles exporting profiles to ZIP archives and importing them back.
"""

import json
import zipfile
import io
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session

from .models import VoiceProfileResponse
from .database import VoiceProfile as DBVoiceProfile, ProfileSample as DBProfileSample
from .profiles import create_profile, add_profile_sample
from .models import VoiceProfileCreate
from . import config


def _get_profiles_dir() -> Path:
    """Get profiles directory from config."""
    return config.get_profiles_dir()


def _get_unique_profile_name(name: str, db: Session) -> str:
    """
    Get a unique profile name by appending a number if needed.
    
    Args:
        name: Original profile name
        db: Database session
        
    Returns:
        Unique profile name
    """
    base_name = name
    counter = 1
    
    while True:
        existing = db.query(DBVoiceProfile).filter_by(name=name).first()
        if not existing:
            return name
        
        name = f"{base_name} ({counter})"
        counter += 1


def export_profile_to_zip(profile_id: str, db: Session) -> bytes:
    """
    Export a voice profile to a ZIP archive.
    
    Args:
        profile_id: Profile ID to export
        db: Database session
        
    Returns:
        ZIP file contents as bytes
        
    Raises:
        ValueError: If profile not found or has no samples
    """
    # Get profile
    profile = db.query(DBVoiceProfile).filter_by(id=profile_id).first()
    if not profile:
        raise ValueError(f"Profile {profile_id} not found")
    
    # Get all samples
    samples = db.query(DBProfileSample).filter_by(profile_id=profile_id).all()
    if not samples:
        raise ValueError(f"Profile {profile_id} has no samples")
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Create manifest.json
        manifest = {
            "version": "1.0",
            "profile": {
                "name": profile.name,
                "description": profile.description,
                "language": profile.language,
            }
        }
        zip_file.writestr("manifest.json", json.dumps(manifest, indent=2))
        
        # Create samples.json mapping
        samples_data = {}
        profile_dir = _get_profiles_dir() / profile_id
        
        for sample in samples:
            # Get filename from audio_path (should be {sample_id}.wav)
            audio_path = Path(sample.audio_path)
            filename = audio_path.name
            
            # Read audio file
            if not audio_path.exists():
                raise ValueError(f"Audio file not found: {audio_path}")
            
            # Add to samples directory in ZIP
            zip_path = f"samples/{filename}"
            zip_file.write(audio_path, zip_path)
            
            # Map filename to reference text
            samples_data[filename] = sample.reference_text
        
        zip_file.writestr("samples.json", json.dumps(samples_data, indent=2))
    
    zip_buffer.seek(0)
    return zip_buffer.read()


async def import_profile_from_zip(file_bytes: bytes, db: Session) -> VoiceProfileResponse:
    """
    Import a voice profile from a ZIP archive.
    
    Args:
        file_bytes: ZIP file contents
        db: Database session
        
    Returns:
        Created profile
        
    Raises:
        ValueError: If ZIP is invalid or missing required files
    """
    zip_buffer = io.BytesIO(file_bytes)
    
    try:
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            # Validate ZIP structure
            namelist = zip_file.namelist()
            
            if "manifest.json" not in namelist:
                raise ValueError("ZIP archive missing manifest.json")
            
            if "samples.json" not in namelist:
                raise ValueError("ZIP archive missing samples.json")
            
            # Read manifest
            manifest_data = json.loads(zip_file.read("manifest.json"))
            
            if "version" not in manifest_data:
                raise ValueError("Invalid manifest.json: missing version")
            
            if "profile" not in manifest_data:
                raise ValueError("Invalid manifest.json: missing profile")
            
            profile_data = manifest_data["profile"]
            
            # Read samples mapping
            samples_data = json.loads(zip_file.read("samples.json"))
            
            if not isinstance(samples_data, dict):
                raise ValueError("Invalid samples.json: must be a dictionary")
            
            # Get unique profile name
            original_name = profile_data.get("name", "Imported Profile")
            unique_name = _get_unique_profile_name(original_name, db)
            
            # Create profile
            profile_create = VoiceProfileCreate(
                name=unique_name,
                description=profile_data.get("description"),
                language=profile_data.get("language", "en"),
            )
            
            profile = await create_profile(profile_create, db)
            
            # Extract and add samples
            profile_dir = _get_profiles_dir() / profile.id
            profile_dir.mkdir(parents=True, exist_ok=True)
            
            for filename, reference_text in samples_data.items():
                # Validate filename
                if not filename.endswith('.wav'):
                    raise ValueError(f"Invalid sample filename: {filename} (must be .wav)")
                
                # Extract audio file to temp location
                zip_path = f"samples/{filename}"
                
                if zip_path not in namelist:
                    raise ValueError(f"Sample file not found in ZIP: {zip_path}")
                
                # Extract to temporary file
                import tempfile
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp.write(zip_file.read(zip_path))
                    tmp_path = tmp.name
                
                try:
                    # Add sample to profile
                    await add_profile_sample(
                        profile.id,
                        tmp_path,
                        reference_text,
                        db,
                    )
                finally:
                    # Clean up temp file
                    Path(tmp_path).unlink(missing_ok=True)
            
            return profile
            
    except zipfile.BadZipFile:
        raise ValueError("Invalid ZIP file")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in archive: {e}")
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Error importing profile: {str(e)}")
