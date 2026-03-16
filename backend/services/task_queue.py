"""
Serial generation queue — ensures only one TTS inference runs at a time
to avoid GPU contention.
"""

import asyncio
import traceback

# Keep references to fire-and-forget background tasks to prevent GC
_background_tasks: set = set()

# Generation queue — serializes TTS inference to avoid GPU contention
_generation_queue: asyncio.Queue = None  # type: ignore  # initialized at startup


def create_background_task(coro) -> asyncio.Task:
    """Create a background task and prevent it from being garbage collected."""
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task


async def _generation_worker():
    """Worker that processes generation tasks one at a time."""
    while True:
        coro = await _generation_queue.get()
        try:
            await coro
        except Exception:
            traceback.print_exc()
        finally:
            _generation_queue.task_done()


def enqueue_generation(coro):
    """Add a generation coroutine to the serial queue."""
    _generation_queue.put_nowait(coro)


def init_queue():
    """Initialize the generation queue and start the worker.

    Must be called once during application startup (inside a running event loop).
    """
    global _generation_queue
    _generation_queue = asyncio.Queue()
    create_background_task(_generation_worker())
