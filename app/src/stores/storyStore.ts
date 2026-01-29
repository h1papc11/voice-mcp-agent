import { create } from 'zustand';
import type { StoryItemDetail } from '@/lib/api/types';

interface StoryPlaybackState {
  // Selection
  selectedStoryId: string | null;
  setSelectedStoryId: (id: string | null) => void;

  // Track editor UI state
  trackEditorHeight: number;
  setTrackEditorHeight: (height: number) => void;

  // Playback state
  isPlaying: boolean;
  currentTimeMs: number;
  totalDurationMs: number;
  playbackStoryId: string | null;
  playbackItems: StoryItemDetail[] | null;
  // Web Audio API timing (null when not playing)
  playbackStartContextTime: number | null; // AudioContext.currentTime when playback started
  playbackStartStoryTime: number | null; // Story time (ms) when playback started

  // Actions
  play: (storyId: string, items: StoryItemDetail[]) => void;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
  setPlaybackTiming: (contextTime: number, storyTime: number) => void; // Set timing anchors for Web Audio API
}

const DEFAULT_TRACK_EDITOR_HEIGHT = 250;

export const useStoryStore = create<StoryPlaybackState>((set, get) => ({
  // Selection
  selectedStoryId: null,
  setSelectedStoryId: (id) => set({ selectedStoryId: id }),

  // Track editor UI state
  trackEditorHeight: DEFAULT_TRACK_EDITOR_HEIGHT,
  setTrackEditorHeight: (height) => set({ trackEditorHeight: height }),

  // Playback state
  isPlaying: false,
  currentTimeMs: 0,
  totalDurationMs: 0,
  playbackStoryId: null,
  playbackItems: null,
  playbackStartContextTime: null,
  playbackStartStoryTime: null,

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
    set({ 
      isPlaying: false,
      // Keep timing anchors so we can resume from same position
    });
  },

  stop: () => {
    set({
      isPlaying: false,
      currentTimeMs: 0,
      playbackStoryId: null,
      playbackItems: null,
      totalDurationMs: 0,
      playbackStartContextTime: null,
      playbackStartStoryTime: null,
    });
  },

  seek: (timeMs) => {
    const state = get();
    const clampedTime = Math.max(0, Math.min(timeMs, state.totalDurationMs));
    set({ 
      currentTimeMs: clampedTime,
      // Reset timing anchors - will be set by hook when playback resumes
      playbackStartContextTime: null,
      playbackStartStoryTime: null,
    });
  },

  setPlaybackTiming: (contextTime, storyTime) => {
    set({
      playbackStartContextTime: contextTime,
      playbackStartStoryTime: storyTime,
    });
  },
}));
