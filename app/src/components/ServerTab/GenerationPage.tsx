import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { useServerStore } from '@/stores/serverStore';
import { SettingRow, SettingSection } from './SettingRow';

export function GenerationPage() {
  const maxChunkChars = useServerStore((state) => state.maxChunkChars);
  const setMaxChunkChars = useServerStore((state) => state.setMaxChunkChars);
  const crossfadeMs = useServerStore((state) => state.crossfadeMs);
  const setCrossfadeMs = useServerStore((state) => state.setCrossfadeMs);
  const normalizeAudio = useServerStore((state) => state.normalizeAudio);
  const setNormalizeAudio = useServerStore((state) => state.setNormalizeAudio);
  const autoplayOnGenerate = useServerStore((state) => state.autoplayOnGenerate);
  const setAutoplayOnGenerate = useServerStore((state) => state.setAutoplayOnGenerate);

  return (
    <div className="space-y-8 max-w-2xl">
      <SettingSection
        title="Generation"
        description="Controls for long text generation. These settings apply to all engines."
      >
        <SettingRow
          title="Auto-chunking limit"
          description="Long text is split into chunks at sentence boundaries. Lower values can improve quality for long outputs."
          action={
            <span className="text-sm tabular-nums text-muted-foreground">
              {maxChunkChars} chars
            </span>
          }
        >
          <Slider
            id="maxChunkChars"
            value={[maxChunkChars]}
            onValueChange={([value]) => setMaxChunkChars(value)}
            min={100}
            max={5000}
            step={50}
            aria-label="Auto-chunking character limit"
          />
        </SettingRow>

        <SettingRow
          title="Chunk crossfade"
          description="Blends audio between chunks to smooth transitions. Set to 0 for a hard cut."
          action={
            <span className="text-sm tabular-nums text-muted-foreground">
              {crossfadeMs === 0 ? 'Cut' : `${crossfadeMs}ms`}
            </span>
          }
        >
          <Slider
            id="crossfadeMs"
            value={[crossfadeMs]}
            onValueChange={([value]) => setCrossfadeMs(value)}
            min={0}
            max={200}
            step={10}
            aria-label="Chunk crossfade duration"
          />
        </SettingRow>

        <SettingRow
          title="Normalize audio"
          description="Adjusts output volume to a consistent level across generations."
          htmlFor="normalizeAudio"
          action={
            <Toggle
              id="normalizeAudio"
              checked={normalizeAudio}
              onCheckedChange={setNormalizeAudio}
            />
          }
        />

        <SettingRow
          title="Autoplay on generate"
          description="Automatically play audio when a generation completes."
          htmlFor="autoplayOnGenerate"
          action={
            <Toggle
              id="autoplayOnGenerate"
              checked={autoplayOnGenerate}
              onCheckedChange={setAutoplayOnGenerate}
            />
          }
        />
      </SettingSection>
    </div>
  );
}
