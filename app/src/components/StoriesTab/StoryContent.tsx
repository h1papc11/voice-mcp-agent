import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Download, Pause, Play } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { BOTTOM_SAFE_AREA_PADDING } from '@/lib/constants/ui';
import { Slider } from '@/components/ui/slider';
import { useStory, useRemoveStoryItem, useExportStoryAudio, useReorderStoryItems } from '@/lib/hooks/useStories';
import { useStoryStore } from '@/stores/storyStore';
import { usePlayerStore } from '@/stores/playerStore';
import { SortableStoryChatItem } from './StoryChatItem';
import { cn } from '@/lib/utils/cn';
import { useStoryPlayback } from '@/lib/hooks/useStoryPlayback';

export function StoryContent() {
  const selectedStoryId = useStoryStore((state) => state.selectedStoryId);
  const { data: story, isLoading } = useStory(selectedStoryId);
  const removeItem = useRemoveStoryItem();
  const reorderItems = useReorderStoryItems();
  const exportAudio = useExportStoryAudio();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioUrl = usePlayerStore((state) => state.audioUrl);
  const isPlayerVisible = !!audioUrl;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Playback state
  const isPlaying = useStoryStore((state) => state.isPlaying);
  const currentTimeMs = useStoryStore((state) => state.currentTimeMs);
  const totalDurationMs = useStoryStore((state) => state.totalDurationMs);
  const playbackStoryId = useStoryStore((state) => state.playbackStoryId);
  const play = useStoryStore((state) => state.play);
  const pause = useStoryStore((state) => state.pause);
  const stop = useStoryStore((state) => state.stop);
  const seek = useStoryStore((state) => state.seek);

  // Use playback hook
  useStoryPlayback(story?.items);

  // Sort items by start_time_ms
  const sortedItems = useMemo(() => {
    if (!story?.items) return [];
    return [...story.items].sort((a, b) => a.start_time_ms - b.start_time_ms);
  }, [story?.items]);

  const handleRemoveItem = (generationId: string) => {
    if (!story) return;

    removeItem.mutate(
      {
        storyId: story.id,
        generationId,
      },
      {
        onError: (error) => {
          toast({
            title: 'Failed to remove item',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!story || !over || active.id === over.id) return;

    const oldIndex = sortedItems.findIndex((item) => item.generation_id === active.id);
    const newIndex = sortedItems.findIndex((item) => item.generation_id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate the new order
    const newOrder = arrayMove(sortedItems, oldIndex, newIndex);
    const generationIds = newOrder.map((item) => item.generation_id);

    // Send reorder request to backend
    reorderItems.mutate(
      {
        storyId: story.id,
        data: { generation_ids: generationIds },
      },
      {
        onError: (error) => {
          toast({
            title: 'Failed to reorder items',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handlePlayPause = () => {
    if (!story || story.items.length === 0) return;

    if (isPlaying && playbackStoryId === story.id) {
      pause();
    } else {
      play(story.id, sortedItems);
    }
  };

  const handleStop = () => {
    stop();
  };

  const handleSeek = (value: number[]) => {
    seek(value[0]);
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;
  };

  const handleExportAudio = () => {
    if (!story) return;

    exportAudio.mutate(
      {
        storyId: story.id,
        storyName: story.name,
      },
      {
        onError: (error) => {
          toast({
            title: 'Failed to export audio',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  if (!selectedStoryId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Select a story</p>
          <p className="text-sm">Choose a story from the list to view its content</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading story...</div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Story not found</p>
          <p className="text-sm">The selected story could not be loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-4 px-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{story.name}</h2>
            {story.description && (
              <p className="text-sm text-muted-foreground mt-1">{story.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            {story.items.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={handlePlayPause}>
                  {isPlaying && playbackStoryId === story.id ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Play
                    </>
                  )}
                </Button>
                {isPlaying && playbackStoryId === story.id && (
                  <Button variant="outline" size="sm" onClick={handleStop}>
                    Stop
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExportAudio} disabled={exportAudio.isPending}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Audio
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Playback Controls */}
        {story.items.length > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground tabular-nums min-w-16">
              {formatTime(currentTimeMs)}
            </span>
            <Slider
              value={[currentTimeMs]}
              max={totalDurationMs || 1}
              step={10}
              onValueChange={handleSeek}
              className="flex-1"
              disabled={!isPlaying && playbackStoryId !== story.id}
            />
            <span className="text-xs text-muted-foreground tabular-nums min-w-16">
              {formatTime(totalDurationMs)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto space-y-3',
          isPlayerVisible && BOTTOM_SAFE_AREA_PADDING,
        )}
      >
        {sortedItems.length === 0 ? (
          <div className="text-center py-12 px-5 border-2 border-dashed border-muted rounded-md text-muted-foreground">
            <p className="text-sm">No items in this story</p>
            <p className="text-xs mt-2">Generate speech using the box below to add items</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedItems.map((item) => item.generation_id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {sortedItems.map((item, index) => (
                  <SortableStoryChatItem
                    key={item.id}
                    item={item}
                    storyId={story.id}
                    index={index}
                    onRemove={() => handleRemoveItem(item.generation_id)}
                    currentTimeMs={currentTimeMs}
                    isPlaying={isPlaying && playbackStoryId === story.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

