"""
Input validation utilities.
"""

from typing import Tuple, Optional
from pathlib import Path


def validate_text(text: str, max_length: int = 5000) -> Tuple[bool, Optional[str]]:
    """
    Validate text input.
    
    Args:
        text: Text to validate
        max_length: Maximum length
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not text or not text.strip():
        return False, "Text cannot be empty"
    
    if len(text) > max_length:
        return False, f"Text too long (maximum {max_length} characters)"
    
    return True, None


def validate_language(language: str) -> Tuple[bool, Optional[str]]:
    """
    Validate language code.

    Supported languages for Qwen3-TTS:
    Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian

    Args:
        language: Language code

    Returns:
        Tuple of (is_valid, error_message)
    """
    valid_languages = ["zh", "en", "ja", "ko", "de", "fr", "ru", "pt", "es", "it"]
    if language not in valid_languages:
        return False, f"Invalid language (must be one of: {', '.join(valid_languages)})"

    return True, None


def validate_file_path(path: str) -> Tuple[bool, Optional[str]]:
    """
    Validate file path exists.
    
    Args:
        path: File path
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    file_path = Path(path)
    if not file_path.exists():
        return False, f"File not found: {path}"
    
    if not file_path.is_file():
        return False, f"Path is not a file: {path}"
    
    return True, None
