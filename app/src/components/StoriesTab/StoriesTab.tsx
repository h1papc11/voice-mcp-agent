import { FloatingGenerateBox } from '@/components/Generation/FloatingGenerateBox';
import { StoryContent } from './StoryContent';
import { StoryList } from './StoryList';

export function StoriesTab() {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 min-h-0 flex gap-6 overflow-hidden relative">
        {/* Left Column - Story List */}
        <div className="flex flex-col min-h-0 overflow-hidden w-full max-w-[360px] shrink-0">
          <StoryList />
        </div>

        {/* Right Column - Story Content */}
        <div className="flex flex-col min-h-0 overflow-hidden flex-1">
          <StoryContent />
        </div>

        {/* Floating Generate Box - position is managed via storyStore.trackEditorHeight */}
        <FloatingGenerateBox showVoiceSelector />
      </div>
    </div>
  );
}
