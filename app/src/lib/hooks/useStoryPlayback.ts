import { useEffect, useRef, useCallback } from 'react';
import { useStoryStore } from '@/stores/storyStore';
import { apiClient } from '@/lib/api/client';
import type { StoryItemDetail } from '@/lib/api/types';

/**
 * Hook for managing timecode-based story playback.
 * Uses a single audio element for reliable playback.
 */
export function useStoryPlayback(_items: StoryItemDetail[] | undefined) {
  const isPlaying = useStoryStore((state) => state.isPlaying);
  const playbackItems = useStoryStore((state) => state.playbackItems);
  const tick = useStoryStore((state) => state.tick);

  // Single audio element for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentItemIdRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // Get or create audio element
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    return audioRef.current;
  }, []);

  // Find the item that should be playing at a given time
  const findActiveItem = useCallback((timeMs: number, items: StoryItemDetail[]): StoryItemDetail | null => {
    for (const item of items) {
      const itemStart = item.start_time_ms;
      const itemEnd = item.start_time_ms + item.duration * 1000;
      if (timeMs >= itemStart && timeMs < itemEnd) {
        return item;
      }
    }
    return null;
  }, []);

  // Find the next item after a given time
  const findNextItem = useCallback((timeMs: number, items: StoryItemDetail[]): StoryItemDetail | null => {
    const sorted = [...items].sort((a, b) => a.start_time_ms - b.start_time_ms);
    for (const item of sorted) {
      if (item.start_time_ms > timeMs) {
        return item;
      }
    }
    return null;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Main playback effect
  useEffect(() => {
    const audio = getAudio();

    if (!isPlaying || !playbackItems || playbackItems.length === 0) {
      console.log('[StoryPlayback] Stopping playback');
      audio.pause();
      currentItemIdRef.current = null;
      
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const items = playbackItems; // Capture for closure
    console.log('[StoryPlayback] Starting playback');

    const playItem = (item: StoryItemDetail, offsetMs: number = 0) => {
      console.log('[StoryPlayback] Playing item:', item.generation_id, 'offset:', offsetMs);
      currentItemIdRef.current = item.generation_id;
      
      const audioUrl = apiClient.getAudioUrl(item.generation_id);
      audio.src = audioUrl;
      
      audio.onloadedmetadata = () => {
        const offsetSeconds = Math.max(0, offsetMs / 1000);
        audio.currentTime = offsetSeconds;
        audio.play().catch(err => {
          console.error('[StoryPlayback] Play failed:', err);
        });
      };

      audio.onerror = (e) => {
        console.error('[StoryPlayback] Audio error:', e);
      };

      // When this audio ends, advance the clock and check for next item
      audio.onended = () => {
        console.log('[StoryPlayback] Audio ended');
        const state = useStoryStore.getState();
        if (!state.isPlaying || !state.playbackItems) return;

        // Find what's next
        const nextItem = findNextItem(state.currentTimeMs, state.playbackItems);
        if (nextItem) {
          // Jump to next item's start
          useStoryStore.setState({ currentTimeMs: nextItem.start_time_ms });
          playItem(nextItem, 0);
        } else {
          // No more items
          console.log('[StoryPlayback] Story complete');
          useStoryStore.getState().stop();
        }
      };
    };

    // Animation frame for updating the clock
    const updateClock = () => {
      if (!useStoryStore.getState().isPlaying) return;

      const now = Date.now();
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Update master clock
      tick(deltaMs);

      const currentTime = useStoryStore.getState().currentTimeMs;
      const totalDuration = useStoryStore.getState().totalDurationMs;

      // Check if we need to start playing a different item
      const activeItem = findActiveItem(currentTime, items);
      
      if (activeItem && currentItemIdRef.current !== activeItem.generation_id) {
        // Need to switch to a different item
        const offset = currentTime - activeItem.start_time_ms;
        playItem(activeItem, offset);
      } else if (!activeItem && currentItemIdRef.current) {
        // We're in a gap between items, pause audio
        audio.pause();
        currentItemIdRef.current = null;
        
        // Check if there's a next item to wait for
        const nextItem = findNextItem(currentTime, items);
        if (!nextItem && currentTime >= totalDuration) {
          console.log('[StoryPlayback] Reached end');
          useStoryStore.getState().stop();
          return;
        }
      }

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(updateClock);
    };

    // Start with the first item
    const currentTime = useStoryStore.getState().currentTimeMs;
    const activeItem = findActiveItem(currentTime, items);
    
    if (activeItem) {
      const offset = currentTime - activeItem.start_time_ms;
      playItem(activeItem, offset);
    } else {
      // Maybe we're before all items start, find the first one
      const firstItem = [...items].sort((a, b) => a.start_time_ms - b.start_time_ms)[0];
      if (firstItem && currentTime < firstItem.start_time_ms) {
        // Wait for the first item
        console.log('[StoryPlayback] Waiting for first item at', firstItem.start_time_ms);
      }
    }

    // Start clock
    lastTimeRef.current = Date.now();
    animationFrameRef.current = requestAnimationFrame(updateClock);

    return () => {
      audio.onended = null;
      audio.onloadedmetadata = null;
      audio.onerror = null;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackItems, getAudio, findActiveItem, findNextItem, tick]);
}
