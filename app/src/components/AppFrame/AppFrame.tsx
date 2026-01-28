import { TitleBarDragRegion } from '@/components/TitleBarDragRegion';
import { AudioPlayer } from '@/components/AudioPlayer/AudioPlayer';

interface AppFrameProps {
  children: React.ReactNode;
}

export function AppFrame({ children }: AppFrameProps) {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden pt-12">
      <TitleBarDragRegion />
      {children}
      <AudioPlayer />
    </div>
  );
}
