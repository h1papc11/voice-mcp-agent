import { GripHorizontal, Minus, Pause, Play, Plus, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { useMoveStoryItem } from '@/lib/hooks/useStories';
import { useStoryStore } from '@/stores/storyStore';
import type { StoryItemDetail } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

// Clip waveform component
function ClipWaveform({ generationId, width }: { generationId: string; width: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current || width < 20) return;

    // Get CSS colors
    const root = document.documentElement;
    const getCSSVar = (varName: string) => {
      const value = getComputedStyle(root).getPropertyValue(varName).trim();
      return value ? `hsl(${value})` : '';
    };

    const waveColor = getCSSVar('--accent-foreground');

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor,
      progressColor: waveColor,
      cursorWidth: 0,
      barWidth: 1,
      barRadius: 1,
      barGap: 1,
      height: 28,
      normalize: true,
      interact: false,
    });

    wavesurferRef.current = wavesurfer;

    const audioUrl = apiClient.getAudioUrl(generationId);
    wavesurfer.load(audioUrl).catch(() => {
      // Ignore load errors
    });

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
  }, [generationId, width]);

  return <div ref={containerRef} className="w-full h-full opacity-60" />;
}

interface StoryTrackEditorProps {
  storyId: string;
  items: StoryItemDetail[];
}

const TRACK_HEIGHT = 48;
const MIN_PIXELS_PER_SECOND = 10;
const MAX_PIXELS_PER_SECOND = 200;
const DEFAULT_PIXELS_PER_SECOND = 50;
const DEFAULT_TRACKS = [1, 0, -1]; // Default 3 tracks
const MIN_EDITOR_HEIGHT = 120;
const MAX_EDITOR_HEIGHT = 500;

export function StoryTrackEditor({ storyId, items }: StoryTrackEditorProps) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND);
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);
  const moveItem = useMoveStoryItem();
  const { toast } = useToast();

  // Track editor height from store (shared with FloatingGenerateBox)
  const editorHeight = useStoryStore((state) => state.trackEditorHeight);
  const setEditorHeight = useStoryStore((state) => state.setTrackEditorHeight);

  // Playback state
  const isPlaying = useStoryStore((state) => state.isPlaying);
  const currentTimeMs = useStoryStore((state) => state.currentTimeMs);
  const storeTotalDurationMs = useStoryStore((state) => state.totalDurationMs);
  const playbackStoryId = useStoryStore((state) => state.playbackStoryId);
  const play = useStoryStore((state) => state.play);
  const pause = useStoryStore((state) => state.pause);
  const stop = useStoryStore((state) => state.stop);
  const seek = useStoryStore((state) => state.seek);

  const isActiveStory = playbackStoryId === storyId;
  const isCurrentlyPlaying = isPlaying && isActiveStory;

  // Sort items by start time for play
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.start_time_ms - b.start_time_ms);
  }, [items]);

  const handlePlayPause = () => {
    if (isCurrentlyPlaying) {
      pause();
    } else {
      play(storyId, sortedItems);
    }
  };

  const handleStop = () => {
    stop();
  };

  // Calculate unique tracks from items, always showing at least 3 default tracks
  const tracks = useMemo(() => {
    const trackSet = new Set([...DEFAULT_TRACKS, ...items.map((item) => item.track)]);
    return Array.from(trackSet).sort((a, b) => b - a); // Higher tracks on top
  }, [items]);

  // Track container width for full-width minimum
  useEffect(() => {
    const container = tracksRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    // Set initial width
    setContainerWidth(container.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Calculate total duration
  const totalDurationMs = useMemo(() => {
    if (items.length === 0) return 10000; // Default 10 seconds
    return Math.max(
      ...items.map((item) => item.start_time_ms + item.duration * 1000),
      10000
    );
  }, [items]);

  // Calculate timeline width - at least full container width
  const contentWidth = (totalDurationMs / 1000) * pixelsPerSecond + 200; // Content width with padding
  const timelineWidth = Math.max(contentWidth, containerWidth);

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    // Determine interval based on zoom level
    let intervalMs = 5000; // 5 seconds
    if (pixelsPerSecond > 100) intervalMs = 1000;
    else if (pixelsPerSecond > 50) intervalMs = 2000;
    else if (pixelsPerSecond < 20) intervalMs = 10000;

    for (let ms = 0; ms <= totalDurationMs + intervalMs; ms += intervalMs) {
      markers.push(ms);
    }
    return markers;
  }, [totalDurationMs, pixelsPerSecond]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const msToPixels = useCallback(
    (ms: number) => (ms / 1000) * pixelsPerSecond,
    [pixelsPerSecond]
  );

  const pixelsToMs = useCallback(
    (px: number) => (px / pixelsPerSecond) * 1000,
    [pixelsPerSecond]
  );

  const handleZoomIn = () => {
    setPixelsPerSecond((prev) => Math.min(prev * 1.5, MAX_PIXELS_PER_SECOND));
  };

  const handleZoomOut = () => {
    setPixelsPerSecond((prev) => Math.max(prev / 1.5, MIN_PIXELS_PER_SECOND));
  };

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = editorHeight;
  }, [editorHeight]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const deltaY = resizeStartY.current - e.clientY;
    const newHeight = Math.min(
      MAX_EDITOR_HEIGHT,
      Math.max(MIN_EDITOR_HEIGHT, resizeStartHeight.current + deltaY)
    );
    setEditorHeight(newHeight);
  }, [isResizing, setEditorHeight]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add global mouse listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tracksRef.current || draggingItem) return;
    const rect = tracksRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + tracksRef.current.scrollLeft;
    const timeMs = Math.max(0, pixelsToMs(x));
    seek(timeMs);
  };

  const handleDragStart = (
    e: React.MouseEvent,
    item: StoryItemDetail
  ) => {
    e.stopPropagation();
    if (!tracksRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setDragPosition({
      x: rect.left - tracksRef.current.getBoundingClientRect().left + tracksRef.current.scrollLeft,
      y: rect.top - tracksRef.current.getBoundingClientRect().top,
    });
    setDraggingItem(item.generation_id);
  };

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingItem || !tracksRef.current) return;

      const rect = tracksRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + tracksRef.current.scrollLeft - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      setDragPosition({ x: Math.max(0, x), y });
    },
    [draggingItem, dragOffset]
  );

  const handleDragEnd = useCallback(() => {
    if (!draggingItem || !tracksRef.current) {
      setDraggingItem(null);
      return;
    }

    const item = items.find((i) => i.generation_id === draggingItem);
    if (!item) {
      setDraggingItem(null);
      return;
    }

    // Calculate new time from x position
    const newTimeMs = Math.max(0, Math.round(pixelsToMs(dragPosition.x)));

    // Calculate new track from y position
    const trackIndex = Math.floor(dragPosition.y / TRACK_HEIGHT);
    const clampedTrackIndex = Math.max(0, Math.min(trackIndex, tracks.length - 1));
    const newTrack = tracks[clampedTrackIndex] ?? 0;

    // Check if position changed
    if (newTimeMs !== item.start_time_ms || newTrack !== item.track) {
      moveItem.mutate(
        {
          storyId,
          generationId: item.generation_id,
          data: {
            start_time_ms: newTimeMs,
            track: newTrack,
          },
        },
        {
          onError: (error) => {
            toast({
              title: 'Failed to move item',
              description: error.message,
              variant: 'destructive',
            });
          },
        }
      );
    }

    setDraggingItem(null);
  }, [draggingItem, dragPosition, items, tracks, pixelsToMs, storyId, moveItem, toast]);

  // Get track index for rendering
  const getTrackIndex = (trackNumber: number) => tracks.indexOf(trackNumber);

  // Calculate clip position and dimensions
  const getClipStyle = (item: StoryItemDetail) => {
    const isDragging = draggingItem === item.generation_id;
    const trackIndex = getTrackIndex(item.track);
    const width = msToPixels(item.duration * 1000);
    const left = isDragging ? dragPosition.x : msToPixels(item.start_time_ms);
    const top = isDragging ? dragPosition.y : trackIndex * TRACK_HEIGHT;

    return {
      width: `${width}px`,
      left: `${left}px`,
      top: `${top}px`,
      height: `${TRACK_HEIGHT - 4}px`,
    };
  };

  // Playhead position
  const playheadLeft = msToPixels(currentTimeMs);

  // Calculate tracks area height
  const tracksAreaHeight = tracks.length * TRACK_HEIGHT;
  const timelineContainerHeight = editorHeight - 40; // Subtract toolbar height

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 z-50">
      <div className="border-t bg-card overflow-hidden relative" ref={containerRef}>
      {/* Resize handle at top */}
      <button
        type="button"
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center hover:bg-muted/50 transition-colors z-20 group"
        onMouseDown={handleResizeStart}
        aria-label="Resize track editor"
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
      </button>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 mt-2">
        {/* Play controls - left side */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePlayPause}>
            {isCurrentlyPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStop} disabled={!isActiveStory}>
            <Square className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums ml-2">
            {formatTime(isActiveStory ? currentTimeMs : 0)} / {formatTime(isActiveStory ? storeTotalDurationMs : 0)}
          </span>
        </div>

        {/* Zoom controls - right side */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Zoom:</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomOut}>
            <Minus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomIn}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Timeline container with track labels sidebar */}
      <div className="flex" style={{ height: `${timelineContainerHeight}px` }}>
        {/* Track labels sidebar - fixed width */}
        <div className="w-16 shrink-0 border-r bg-muted/20 overflow-hidden">
          {/* Spacer for time ruler */}
          <div className="h-6 border-b bg-muted/30" />
          {/* Track labels */}
          <div style={{ height: `${tracksAreaHeight}px` }}>
            {tracks.map((trackNumber, index) => (
              <div
                key={trackNumber}
                className={cn(
                  'border-b flex items-center justify-center',
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
                style={{ height: `${TRACK_HEIGHT}px` }}
              >
                <span className="text-[10px] text-muted-foreground select-none">
                  {trackNumber}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable timeline area */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Container handles drag events for child clips */}
        <div
          ref={tracksRef}
          className="overflow-auto relative flex-1"
          onMouseMove={draggingItem ? handleDragMove : undefined}
          onMouseUp={draggingItem ? handleDragEnd : undefined}
          onMouseLeave={draggingItem ? handleDragEnd : undefined}
        >
          {/* Time ruler */}
          <div
            className="h-6 border-b bg-muted/20 sticky top-0 z-10"
            style={{ width: `${timelineWidth}px` }}
          >
            {timeMarkers.map((ms) => (
              <div
                key={ms}
                className="absolute top-0 h-full flex flex-col justify-end"
                style={{ left: `${msToPixels(ms)}px` }}
              >
                <div className="h-2 w-px bg-border" />
                <span className="text-[10px] text-muted-foreground ml-1 select-none">
                  {formatTime(ms)}
                </span>
              </div>
            ))}
          </div>

          {/* Tracks area */}
          <div
            className="relative"
            style={{ width: `${timelineWidth}px`, height: `${tracksAreaHeight}px` }}
          >
            {/* Track backgrounds */}
            {tracks.map((trackNumber, index) => (
              <div
                key={trackNumber}
                className={cn(
                  'absolute left-0 right-0 border-b',
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
                style={{
                  top: `${index * TRACK_HEIGHT}px`,
                  height: `${TRACK_HEIGHT}px`,
                }}
              />
            ))}

            {/* Click area for seeking - z-index lower than clips */}
            <button
              type="button"
              className="absolute inset-0 z-0 cursor-pointer"
              onClick={handleTimelineClick}
              aria-label="Seek timeline"
            />

          {/* Audio clips */}
          {items.map((item) => {
            const isDragging = draggingItem === item.generation_id;
            const style = getClipStyle(item);
            const clipWidth = msToPixels(item.duration * 1000);

            return (
              <button
                type="button"
                key={item.generation_id}
                className={cn(
                  'absolute rounded cursor-move select-none overflow-hidden z-10',
                  'bg-accent/80 hover:bg-accent border border-accent-foreground/20',
                  'flex flex-col justify-center',
                  isDragging && 'opacity-80 shadow-lg z-20',
                  !isDragging && 'transition-all duration-100'
                )}
                style={style}
                onMouseDown={(e) => handleDragStart(e, item)}
              >
                {/* Clip label */}
                <div className="absolute top-0 left-1 right-1 z-10">
                  <p className="text-[9px] font-medium text-accent-foreground truncate">
                    {item.profile_name}
                  </p>
                </div>
                {/* Waveform */}
                <div className="absolute inset-0 top-3">
                  <ClipWaveform generationId={item.generation_id} width={clipWidth} />
                </div>
              </button>
            );
          })}

          {/* Playhead */}
          {isActiveStory && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-accent z-30 pointer-events-none rounded-full"
              style={{ left: `${playheadLeft}px` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-full" />
            </div>
          )}
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}
