import { create } from 'zustand';
import type { StoryItemDetail } from '@/lib/api/types';

interface StoryPlaybackState {
  // Selection
  selectedStoryId: string | null;
  setSelectedStoryId: (id: string | null) => void;

  // Playback state
  isPlaying: boolean;
  currentTimeMs: number;
  totalDurationMs: number;
  playbackStoryId: string | null;
  playbackItems: StoryItemDetail[] | null;

  // Actions
  play: (storyId: string, items: StoryItemDetail[]) => void;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
  tick: (deltaMs: number) => void; // Called by animation frame
}

export const useStoryStore = create<StoryPlaybackState>((set, get) => ({
  // Selection
  selectedStoryId: null,
  setSelectedStoryId: (id) => set({ selectedStoryId: id }),

  // Playback state
  isPlaying: false,
  currentTimeMs: 0,
  totalDurationMs: 0,
  playbackStoryId: null,
  playbackItems: null,

  // Actions
  play: (storyId, items) => {
    // Calculate total duration from items
    const maxEndTimeMs = Math.max(
      ...items.map((item) => item.start_time_ms + item.duration * 1000),
      0
    );

    // Find the minimum start time (first item)
    const minStartTimeMs = Math.min(
      ...items.map((item) => item.start_time_ms),
      0
    );

    // If resuming the same story, keep position; otherwise start at first item
    const currentState = get();
    const shouldResume = currentState.playbackStoryId === storyId && currentState.currentTimeMs > 0;
    const startTimeMs = shouldResume ? currentState.currentTimeMs : minStartTimeMs;

    console.log('[StoryStore] Play called:', {
      storyId,
      itemCount: items.length,
      items: items.map(i => ({ id: i.generation_id, start: i.start_time_ms, duration: i.duration })),
      maxEndTimeMs,
      minStartTimeMs,
      startTimeMs,
      shouldResume,
    });

    set({
      isPlaying: true,
      playbackStoryId: storyId,
      playbackItems: items,
      totalDurationMs: maxEndTimeMs,
      currentTimeMs: startTimeMs,
    });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  stop: () => {
    set({
      isPlaying: false,
      currentTimeMs: 0,
      playbackStoryId: null,
      playbackItems: null,
      totalDurationMs: 0,
    });
  },

  seek: (timeMs) => {
    const state = get();
    const clampedTime = Math.max(0, Math.min(timeMs, state.totalDurationMs));
    set({ currentTimeMs: clampedTime });
  },

  tick: (deltaMs) => {
    const state = get();
    if (!state.isPlaying || !state.playbackItems) {
      return;
    }

    const newTime = state.currentTimeMs + deltaMs;
    const clampedTime = Math.min(newTime, state.totalDurationMs);

    // Auto-stop when reaching the end
    if (clampedTime >= state.totalDurationMs) {
      set({
        currentTimeMs: state.totalDurationMs,
        isPlaying: false,
      });
    } else {
      set({ currentTimeMs: clampedTime });
    }
  },
}));
