"""
HuggingFace Hub download progress tracking.
"""

from typing import Optional, Callable
from contextlib import contextmanager
import threading
import sys


class HFProgressTracker:
    """Tracks HuggingFace Hub download progress by intercepting tqdm."""
    
    def __init__(self, progress_callback: Optional[Callable] = None, filter_non_downloads: bool = False):
        self.progress_callback = progress_callback
        self.filter_non_downloads = filter_non_downloads  # Only filter if True
        self._original_tqdm_class = None
        self._lock = threading.Lock()
        self._total_downloaded = 0
        self._total_size = 0
        self._file_sizes = {}  # Track sizes of individual files
        self._file_downloaded = {}  # Track downloaded bytes per file
        self._current_filename = ""
        self._active_tqdms = {}  # Track active tqdm instances
    
    def _create_tracked_tqdm_class(self):
        """Create a tqdm subclass that tracks progress."""
        tracker = self
        original_tqdm = self._original_tqdm_class
        
        class TrackedTqdm(original_tqdm):
            """A tqdm subclass that reports progress to our tracker."""

            def __init__(self, *args, **kwargs):
                # Extract filename from desc before passing to parent
                desc = kwargs.get("desc", "")
                if not desc and args:
                    first_arg = args[0]
                    if isinstance(first_arg, str):
                        desc = first_arg
                
                filename = ""
                if desc:
                    # Try to extract filename from description
                    # HuggingFace Hub uses format like "model.safetensors: 0%|..."
                    if ":" in desc:
                        filename = desc.split(":")[0].strip()
                    else:
                        filename = desc.strip()
                
                # Filter out non-standard kwargs that huggingface_hub might pass
                # These are custom kwargs that tqdm doesn't understand
                filtered_kwargs = {}
                # Known tqdm kwargs - pass these through
                tqdm_kwargs = {
                    'iterable', 'desc', 'total', 'leave', 'file', 'ncols', 'mininterval',
                    'maxinterval', 'miniters', 'ascii', 'disable', 'unit', 'unit_scale',
                    'dynamic_ncols', 'smoothing', 'bar_format', 'initial', 'position',
                    'postfix', 'unit_divisor', 'write_bytes', 'lock_args', 'nrows',
                    'colour', 'color', 'delay', 'gui', 'disable_default', 'pos'
                }
                for key, value in kwargs.items():
                    if key in tqdm_kwargs:
                        filtered_kwargs[key] = value
                
                # Try to initialize with filtered kwargs, fall back to all kwargs if that fails
                try:
                    super().__init__(*args, **filtered_kwargs)
                except TypeError:
                    # If filtering failed, try with all kwargs (maybe tqdm version accepts them)
                    super().__init__(*args, **kwargs)
                
                self._tracker_filename = filename or "unknown"
                
                with tracker._lock:
                    if filename:
                        tracker._current_filename = filename
                    tracker._active_tqdms[id(self)] = {
                        "filename": self._tracker_filename,
                    }
            
            def update(self, n=1):
                result = super().update(n)

                # Report progress
                with tracker._lock:
                    if id(self) in tracker._active_tqdms:
                        filename = tracker._active_tqdms[id(self)]["filename"]
                        current = getattr(self, "n", 0)
                        total = getattr(self, "total", 0)
                        
                        if total and total > 0:
                            # Determine if we should report this progress
                            should_report = True
                            
                            if tracker.filter_non_downloads:
                                # Filter out non-download progress bars (e.g., "Segment 1/1" during generation)
                                # Only report progress for actual file downloads from HuggingFace
                                should_report = self._is_download_progress(filename)
                            
                            if should_report:
                                # Update per-file tracking
                                tracker._file_sizes[filename] = total
                                tracker._file_downloaded[filename] = current
                                
                                # Calculate totals across all files
                                tracker._total_size = sum(tracker._file_sizes.values())
                                tracker._total_downloaded = sum(tracker._file_downloaded.values())
                                
                                # Call progress callback
                                if tracker.progress_callback:
                                    tracker.progress_callback(
                                        tracker._total_downloaded,
                                        tracker._total_size,
                                        filename
                                    )
                
                return result
            
            def _is_download_progress(self, filename: str) -> bool:
                """Check if this is a real download progress bar vs internal processing."""
                if not filename or filename == "unknown":
                    return False
                
                # Real downloads have file extensions
                download_extensions = [
                    '.safetensors', '.bin', '.pt', '.pth',  # Model weights
                    '.json', '.txt', '.py',  # Config files
                    '.msgpack', '.h5',  # Other formats
                ]
                
                filename_lower = filename.lower()
                has_extension = any(filename_lower.endswith(ext) for ext in download_extensions)
                
                # Skip internal progress indicators
                skip_patterns = ['segment', 'processing', 'generating', 'loading']
                has_skip_pattern = any(pattern in filename_lower for pattern in skip_patterns)
                
                return has_extension and not has_skip_pattern
            
            def close(self):
                with tracker._lock:
                    if id(self) in tracker._active_tqdms:
                        del tracker._active_tqdms[id(self)]
                return super().close()
        
        return TrackedTqdm
    
    @contextmanager
    def patch_download(self):
        """Context manager to patch tqdm for progress tracking."""
        try:
            import tqdm as tqdm_module

            # Store original tqdm class
            self._original_tqdm_class = tqdm_module.tqdm
            
            # Reset totals
            with self._lock:
                self._total_downloaded = 0
                self._total_size = 0
                self._file_sizes = {}
                self._file_downloaded = {}
                self._current_filename = ""
                self._active_tqdms = {}
            
            # Create our tracked tqdm class
            tracked_tqdm = self._create_tracked_tqdm_class()

            # Patch tqdm.tqdm
            tqdm_module.tqdm = tracked_tqdm

            # Also patch tqdm.auto.tqdm if it exists (used by huggingface_hub)
            self._original_tqdm_auto = None
            if hasattr(tqdm_module, "auto") and hasattr(tqdm_module.auto, "tqdm"):
                self._original_tqdm_auto = tqdm_module.auto.tqdm
                tqdm_module.auto.tqdm = tracked_tqdm
            
            # Patch in sys.modules to catch already-imported references
            self._patched_modules = {}
            for module_name in list(sys.modules.keys()):
                if "huggingface" in module_name or module_name.startswith("tqdm"):
                    try:
                        module = sys.modules[module_name]
                        if hasattr(module, "tqdm"):
                            attr = getattr(module, "tqdm")
                            # Only patch if it's the original tqdm class (not already patched)
                            if attr is self._original_tqdm_class or (
                                hasattr(attr, "__name__") and attr.__name__ == "tqdm"
                            ):
                                self._patched_modules[module_name] = attr
                                setattr(module, "tqdm", tracked_tqdm)
                    except (AttributeError, TypeError):
                        pass
            
            yield
            
        except ImportError:
            # If tqdm not available, just yield without patching
            yield
        finally:
            # Restore original tqdm
            if self._original_tqdm_class:
                try:
                    import tqdm as tqdm_module
                    tqdm_module.tqdm = self._original_tqdm_class
                    
                    if self._original_tqdm_auto:
                        tqdm_module.auto.tqdm = self._original_tqdm_auto
                    
                    # Restore patched modules
                    for module_name, original in self._patched_modules.items():
                        try:
                            module = sys.modules.get(module_name)
                            if module and original:
                                setattr(module, "tqdm", original)
                        except (AttributeError, TypeError):
                            pass
                    self._patched_modules = {}
                    
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
