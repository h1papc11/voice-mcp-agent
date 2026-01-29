import { FloatingGenerateBox } from '@/components/Generation/FloatingGenerateBox';
import { StoryContent } from './StoryContent';
import { StoryList } from './StoryList';
import { usePlayerStore } from '@/stores/playerStore';

export function StoriesTab() {
  const audioUrl = usePlayerStore((state) => state.audioUrl);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0 overflow-hidden relative">
      {/* Left Column - Story List */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <StoryList />
      </div>

      {/* Right Column - Story Content */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <StoryContent />
      </div>

      {/* Floating Generate Box */}
      <FloatingGenerateBox isPlayerOpen={!!audioUrl} showVoiceSelector />
    </div>
  );
}
