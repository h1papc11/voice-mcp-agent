"""
HuggingFace Hub download progress tracking.
"""

from typing import Optional, Callable
from contextlib import contextmanager
import threading


class HFProgressTracker:
    """Tracks HuggingFace Hub download progress by intercepting hf_hub_download and snapshot_download."""
    
    def __init__(self, progress_callback: Optional[Callable] = None):
        self.progress_callback = progress_callback
        self._original_hf_hub_download = None
        self._original_snapshot_download = None
        self._lock = threading.Lock()
        self._total_downloaded = 0
        self._total_size = 0
        self._file_sizes = {}  # Track sizes of individual files
        self._file_downloaded = {}  # Track downloaded bytes per file
        self._current_filename = ""
    
    def _tracked_hf_hub_download(self, *args, **kwargs):
        """Wrapper for hf_hub_download with progress tracking."""
        import huggingface_hub
        
        # Get original callback if present
        original_resume_callback = kwargs.get("resume_download", None)
        
        # Extract filename if available
        filename = kwargs.get("filename", "")
        if not filename and len(args) > 1:
            filename = args[1] if isinstance(args[1], str) else ""
        
        with self._lock:
            self._current_filename = filename
        
        def combined_callback(downloaded: int, total: int):
            """Combined callback that tracks progress."""
            # Update per-file tracking
            with self._lock:
                if filename:
                    self._file_sizes[filename] = total
                    self._file_downloaded[filename] = downloaded
                
                # Calculate totals across all files
                self._total_size = sum(self._file_sizes.values())
                self._total_downloaded = sum(self._file_downloaded.values())
            
            # Call original callback if present
            if original_resume_callback:
                original_resume_callback(downloaded, total)
            
            # Call our progress callback
            if self.progress_callback:
                with self._lock:
                    # Pass filename for better progress display
                    self.progress_callback(self._total_downloaded, self._total_size, filename)
        
        # Replace callback
        kwargs["resume_download"] = combined_callback
        
        # Call original download
        return self._original_hf_hub_download(*args, **kwargs)
    
    def _tracked_snapshot_download(self, *args, **kwargs):
        """Wrapper for snapshot_download with progress tracking."""
        import huggingface_hub
        
        # snapshot_download also uses resume_download callback
        original_resume_callback = kwargs.get("resume_download", None)
        
        def combined_callback(downloaded: int, total: int):
            """Combined callback that tracks progress."""
            with self._lock:
                # For snapshot_download, we track overall progress
                if total > 0:
                    self._total_size = max(self._total_size, total)
                    self._total_downloaded = downloaded
            
            # Call original callback if present
            if original_resume_callback:
                original_resume_callback(downloaded, total)
            
            # Call our progress callback
            if self.progress_callback:
                with self._lock:
                    self.progress_callback(self._total_downloaded, self._total_size, "")
        
        # Replace callback
        kwargs["resume_download"] = combined_callback
        
        # Call original download
        return self._original_snapshot_download(*args, **kwargs)
    
    def _tracked_tqdm_update(self, n=1):
        """Track tqdm updates for progress."""
        if self._original_tqdm:
            # Get current tqdm instance
            import tqdm
            # Try to get progress info from tqdm
            # This is a fallback if hf_hub_download callback doesn't work
            pass
    
    @contextmanager
    def patch_download(self):
        """Context manager to patch hf_hub_download and snapshot_download for progress tracking."""
        try:
            import huggingface_hub
            self._original_hf_hub_download = huggingface_hub.hf_hub_download
            
            # Also patch snapshot_download if available (used by from_pretrained)
            try:
                self._original_snapshot_download = huggingface_hub.snapshot_download
            except AttributeError:
                self._original_snapshot_download = None
            
            # Reset totals
            with self._lock:
                self._total_downloaded = 0
                self._total_size = 0
                self._file_sizes = {}
                self._file_downloaded = {}
                self._current_filename = ""
            
            # Patch the functions
            huggingface_hub.hf_hub_download = self._tracked_hf_hub_download
            if self._original_snapshot_download:
                huggingface_hub.snapshot_download = self._tracked_snapshot_download
            
            yield
        except ImportError:
            # If huggingface_hub not available, just yield without patching
            yield
        finally:
            # Restore original functions
            if self._original_hf_hub_download:
                try:
                    import huggingface_hub
                    huggingface_hub.hf_hub_download = self._original_hf_hub_download
                except ImportError:
                    pass
            
            if self._original_snapshot_download:
                try:
                    import huggingface_hub
                    huggingface_hub.snapshot_download = self._original_snapshot_download
                except (ImportError, AttributeError):
                    pass


def create_hf_progress_callback(model_name: str, progress_manager):
    """Create a progress callback for HuggingFace downloads."""
    def callback(downloaded: int, total: int, filename: str = ""):
        """Progress callback."""
        if total > 0:
            progress_manager.update_progress(
                model_name=model_name,
                current=downloaded,
                total=total,
                filename=filename or "",
                status="downloading",
            )
    return callback
