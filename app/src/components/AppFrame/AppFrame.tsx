import { TitleBarDragRegion } from '@/components/TitleBarDragRegion';
import { AudioPlayer } from '@/components/AudioPlayer/AudioPlayer';
import { TOP_SAFE_AREA_PADDING } from '@/lib/constants/ui';
import { cn } from '@/lib/utils/cn';

interface AppFrameProps {
  children: React.ReactNode;
}

export function AppFrame({ children }: AppFrameProps) {
  return (
    <div className={cn('h-screen bg-background flex flex-col overflow-hidden', TOP_SAFE_AREA_PADDING)}>
      <TitleBarDragRegion />
      {children}
      <AudioPlayer />
    </div>
  );
}
