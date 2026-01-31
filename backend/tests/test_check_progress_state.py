"""
Check the internal state of ProgressManager.
"""
import sys
import time

# Add backend to path
sys.path.insert(0, '.')

from utils.progress import get_progress_manager
from utils.tasks import get_task_manager

def main():
    pm = get_progress_manager()
    tm = get_task_manager()

    print("=" * 60)
    print("ProgressManager State Inspector")
    print("=" * 60)

    # Check all progress
    print("\nAll progress entries:")
    print(f"  _progress dict: {pm._progress}")

    # Check listeners
    print("\nActive listeners:")
    print(f"  _listeners dict: {pm._listeners}")

    # Check main loop
    print(f"\nMain loop set: {pm._main_loop is not None}")
    if pm._main_loop:
        print(f"  Loop running: {pm._main_loop.is_running()}")

    # Check task manager
    print("\nTaskManager state:")
    print(f"  Active downloads: {tm.get_active_downloads()}")
    print(f"  Active generations: {tm.get_active_generations()}")

    # Check for specific model
    print("\nChecking whisper-base specifically:")
    progress = pm.get_progress("whisper-base")
    if progress:
        print(f"  Progress: {progress}")
    else:
        print("  No progress data found")

if __name__ == "__main__":
    main()
