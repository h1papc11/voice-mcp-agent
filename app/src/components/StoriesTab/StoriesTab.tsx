import { FloatingGenerateBox } from '@/components/Generation/FloatingGenerateBox';
import { StoryContent } from './StoryContent';
import { StoryList } from './StoryList';
import { StoryTrackEditor } from './StoryTrackEditor';
import { usePlayerStore } from '@/stores/playerStore';
import { useStoryStore } from '@/stores/storyStore';
import { useStory } from '@/lib/hooks/useStories';

export function StoriesTab() {
  const audioUrl = usePlayerStore((state) => state.audioUrl);
  const selectedStoryId = useStoryStore((state) => state.selectedStoryId);
  const { data: story } = useStory(selectedStoryId);

  const hasTrackEditor = selectedStoryId && story && story.items.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden relative">
        {/* Left Column - Story List */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <StoryList />
        </div>

        {/* Right Column - Story Content */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <StoryContent />
        </div>

        {/* Floating Generate Box */}
        <FloatingGenerateBox isPlayerOpen={!!audioUrl || !!hasTrackEditor} showVoiceSelector />
      </div>

      {/* Track Editor - at bottom when a story with items is selected */}
      {hasTrackEditor && (
        <div className="shrink-0 mt-4 px-1">
          <StoryTrackEditor storyId={story.id} items={story.items} />
        </div>
      )}
    </div>
  );
}
