"""
Progress tracking for model downloads using Server-Sent Events.
"""

from typing import Optional, Callable, Dict, List
from fastapi.responses import StreamingResponse
import asyncio
import json
from datetime import datetime


class ProgressManager:
    """Manages download progress for multiple models."""
    
    def __init__(self):
        self._progress: Dict[str, Dict] = {}
        self._listeners: Dict[str, list] = {}
    
    def update_progress(
        self,
        model_name: str,
        current: int,
        total: int,
        filename: Optional[str] = None,
        status: str = "downloading",
    ):
        """
        Update progress for a model download.
        
        Args:
            model_name: Name of the model (e.g., "qwen-tts-1.7B", "whisper-base")
            current: Current bytes downloaded
            total: Total bytes to download
            filename: Current file being downloaded
            status: Status string (downloading, extracting, complete, error)
        """
        progress_pct = (current / total * 100) if total > 0 else 0
        
        self._progress[model_name] = {
            "model_name": model_name,
            "current": current,
            "total": total,
            "progress": progress_pct,
            "filename": filename,
            "status": status,
            "timestamp": datetime.now().isoformat(),
        }
        
        # Notify all listeners
        if model_name in self._listeners:
            for queue in self._listeners[model_name]:
                try:
                    queue.put_nowait(self._progress[model_name].copy())
                except asyncio.QueueFull:
                    pass
    
    def get_progress(self, model_name: str) -> Optional[Dict]:
        """Get current progress for a model."""
        return self._progress.get(model_name)
    
    def get_all_active(self) -> List[Dict]:
        """Get all active downloads (status is 'downloading' or 'extracting')."""
        active = []
        for model_name, progress in self._progress.items():
            status = progress.get("status", "")
            if status in ("downloading", "extracting"):
                active.append(progress.copy())
        return active
    
    def create_progress_callback(self, model_name: str, filename: Optional[str] = None):
        """
        Create a progress callback function for HuggingFace downloads.
        
        Args:
            model_name: Name of the model
            filename: Optional filename filter
            
        Returns:
            Callback function
        """
        def callback(progress: Dict):
            """HuggingFace Hub progress callback."""
            if "total" in progress and "current" in progress:
                current = progress.get("current", 0)
                total = progress.get("total", 0)
                file_name = progress.get("filename", filename)
                
                self.update_progress(
                    model_name=model_name,
                    current=current,
                    total=total,
                    filename=file_name,
                    status="downloading",
                )
        
        return callback
    
    async def subscribe(self, model_name: str):
        """
        Subscribe to progress updates for a model.
        
        Yields progress updates as Server-Sent Events.
        """
        queue = asyncio.Queue(maxsize=10)
        
        # Add to listeners
        if model_name not in self._listeners:
            self._listeners[model_name] = []
        self._listeners[model_name].append(queue)
        
        try:
            # Send initial progress if available
            if model_name in self._progress:
                yield f"data: {json.dumps(self._progress[model_name])}\n\n"
            
            # Stream updates
            while True:
                try:
                    # Wait for update with timeout
                    progress = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield f"data: {json.dumps(progress)}\n\n"
                    
                    # Stop if complete or error
                    if progress.get("status") in ("complete", "error"):
                        break
                except asyncio.TimeoutError:
                    # Send heartbeat
                    yield ": heartbeat\n\n"
                    continue
        finally:
            # Remove from listeners
            if model_name in self._listeners:
                self._listeners[model_name].remove(queue)
                if not self._listeners[model_name]:
                    del self._listeners[model_name]
    
    def mark_complete(self, model_name: str):
        """Mark a model download as complete."""
        if model_name in self._progress:
            self._progress[model_name]["status"] = "complete"
            self._progress[model_name]["progress"] = 100.0
            # Notify listeners
            if model_name in self._listeners:
                for queue in self._listeners[model_name]:
                    try:
                        queue.put_nowait(self._progress[model_name].copy())
                    except asyncio.QueueFull:
                        pass
    
    def mark_error(self, model_name: str, error: str):
        """Mark a model download as failed."""
        if model_name in self._progress:
            self._progress[model_name]["status"] = "error"
            self._progress[model_name]["error"] = error
            # Notify listeners
            if model_name in self._listeners:
                for queue in self._listeners[model_name]:
                    try:
                        queue.put_nowait(self._progress[model_name].copy())
                    except asyncio.QueueFull:
                        pass


# Global progress manager instance
_progress_manager: Optional[ProgressManager] = None


def get_progress_manager() -> ProgressManager:
    """Get or create the global progress manager."""
    global _progress_manager
    if _progress_manager is None:
        _progress_manager = ProgressManager()
    return _progress_manager
