import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Download } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  useExportStoryAudio,
  useRemoveStoryItem,
  useReorderStoryItems,
  useStory,
} from '@/lib/hooks/useStories';
import { useStoryPlayback } from '@/lib/hooks/useStoryPlayback';
import { useStoryStore } from '@/stores/storyStore';
import { SortableStoryChatItem } from './StoryChatItem';

// Height of the floating generate box plus some padding
const GENERATE_BOX_HEIGHT = 160;

export function StoryContent() {
  const selectedStoryId = useStoryStore((state) => state.selectedStoryId);
  const { data: story, isLoading } = useStory(selectedStoryId);
  const removeItem = useRemoveStoryItem();
  const reorderItems = useReorderStoryItems();
  const exportAudio = useExportStoryAudio();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get track editor height from store for dynamic padding
  const trackEditorHeight = useStoryStore((state) => state.trackEditorHeight);

  // Track editor is shown when story has items
  const hasBottomBar = story && story.items.length > 0;

  // Calculate dynamic bottom padding: track editor + generate box + gap
  const bottomPadding = hasBottomBar ? trackEditorHeight + GENERATE_BOX_HEIGHT + 24 : 0;

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

  // Playback state (for auto-scroll and item highlighting)
  const isPlaying = useStoryStore((state) => state.isPlaying);
  const currentTimeMs = useStoryStore((state) => state.currentTimeMs);
  const playbackStoryId = useStoryStore((state) => state.playbackStoryId);

  // Refs for auto-scrolling to playing item
  const itemRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastScrolledItemRef = useRef<string | null>(null);

  // Use playback hook
  useStoryPlayback(story?.items);

  // Sort items by start_time_ms
  const sortedItems = useMemo(() => {
    if (!story?.items) return [];
    return [...story.items].sort((a, b) => a.start_time_ms - b.start_time_ms);
  }, [story?.items]);

  // Find the currently playing item based on timecode
  const currentlyPlayingItemId = useMemo(() => {
    if (!isPlaying || playbackStoryId !== story?.id || !sortedItems.length) {
      return null;
    }
    const playingItem = sortedItems.find((item) => {
      const itemStart = item.start_time_ms;
      const itemEnd = item.start_time_ms + item.duration * 1000;
      return currentTimeMs >= itemStart && currentTimeMs < itemEnd;
    });
    return playingItem?.generation_id ?? null;
  }, [isPlaying, playbackStoryId, story?.id, sortedItems, currentTimeMs]);

  // Auto-scroll to the currently playing item
  useEffect(() => {
    if (!currentlyPlayingItemId || currentlyPlayingItemId === lastScrolledItemRef.current) {
      return;
    }

    const element = itemRefsMap.current.get(currentlyPlayingItemId);
    if (element && scrollRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      lastScrolledItemRef.current = currentlyPlayingItemId;
    }
  }, [currentlyPlayingItemId]);

  // Reset last scrolled item when playback stops
  useEffect(() => {
    if (!isPlaying) {
      lastScrolledItemRef.current = null;
    }
  }, [isPlaying]);

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
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-2xl font-bold">{story.name}</h2>
          {story.description && (
            <p className="text-sm text-muted-foreground mt-1">{story.description}</p>
          )}
        </div>
        {story.items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAudio}
            disabled={exportAudio.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Audio
          </Button>
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3"
        style={{ paddingBottom: bottomPadding > 0 ? `${bottomPadding}px` : undefined }}
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
                  <div
                    key={item.id}
                    ref={(el) => {
                      if (el) {
                        itemRefsMap.current.set(item.generation_id, el);
                      } else {
                        itemRefsMap.current.delete(item.generation_id);
                      }
                    }}
                  >
                    <SortableStoryChatItem
                      item={item}
                      storyId={story.id}
                      index={index}
                      onRemove={() => handleRemoveItem(item.generation_id)}
                      currentTimeMs={currentTimeMs}
                      isPlaying={isPlaying && playbackStoryId === story.id}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
