import { ProfileList } from '@/components/VoiceProfiles/ProfileList';
import { HistoryTable } from '@/components/History/HistoryTable';
import { FloatingGenerateBox } from '@/components/Generation/FloatingGenerateBox';
import { usePlayerStore } from '@/stores/playerStore';

export function MainEditor() {
  const audioUrl = usePlayerStore((state) => state.audioUrl);

  return (
    // Main view: Profiles top left, Generator bottom left, History right
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0 overflow-hidden relative">
      {/* Left Column */}
      <div className="flex flex-col gap-6 min-h-0 overflow-y-auto pb-32">
        {/* Profiles - Top Left */}
        <div className="shrink-0 flex flex-col">
          <ProfileList />
        </div>

        {/* Generator - Bottom Left */}
        {/* <div className="shrink-0">
          <GenerationForm />
        </div> */}
      </div>

      {/* Right Column - History */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <HistoryTable />
      </div>

      {/* Floating Generate Box */}
      <FloatingGenerateBox isPlayerOpen={!!audioUrl} />
    </div>
  );
}
