import { FolderOpen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { usePlatform } from '@/platform/PlatformContext';
import { useServerStore } from '@/stores/serverStore';
import { SettingRow, SettingSection } from './SettingRow';

export function GenerationPage() {
  const { t } = useTranslation();
  const platform = usePlatform();
  const serverUrl = useServerStore((state) => state.serverUrl);
  const maxChunkChars = useServerStore((state) => state.maxChunkChars);
  const setMaxChunkChars = useServerStore((state) => state.setMaxChunkChars);
  const crossfadeMs = useServerStore((state) => state.crossfadeMs);
  const setCrossfadeMs = useServerStore((state) => state.setCrossfadeMs);
  const normalizeAudio = useServerStore((state) => state.normalizeAudio);
  const setNormalizeAudio = useServerStore((state) => state.setNormalizeAudio);
  const autoplayOnGenerate = useServerStore((state) => state.autoplayOnGenerate);
  const setAutoplayOnGenerate = useServerStore((state) => state.setAutoplayOnGenerate);
  const [opening, setOpening] = useState(false);
  const [generationsPath, setGenerationsPath] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${serverUrl}/health/filesystem`)
      .then((res) => res.json())
      .then((data) => {
        const genDir = data.directories?.find((d: { path: string }) =>
          d.path.includes('generations'),
        );
        if (genDir?.path) setGenerationsPath(genDir.path);
      })
      .catch(() => {});
  }, [serverUrl]);

  const openGenerationsFolder = useCallback(async () => {
    if (!generationsPath) return;
    setOpening(true);
    try {
      await platform.filesystem.openPath(generationsPath);
    } catch (e) {
      console.error('Failed to open generations folder:', e);
    } finally {
      setOpening(false);
    }
  }, [platform, generationsPath]);

  return (
    <div className="space-y-8 max-w-2xl">
      <SettingSection
        title={t('settings.generation.title')}
        description={t('settings.generation.description')}
      >
        <SettingRow
          title={t('settings.generation.chunkLimit.title')}
          description={t('settings.generation.chunkLimit.description')}
          action={
            <span className="text-sm tabular-nums text-muted-foreground">
              {t('settings.generation.chunkLimit.value', { chars: maxChunkChars })}
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
            aria-label={t('settings.generation.chunkLimit.title')}
          />
        </SettingRow>

        <SettingRow
          title={t('settings.generation.crossfade.title')}
          description={t('settings.generation.crossfade.description')}
          action={
            <span className="text-sm tabular-nums text-muted-foreground">
              {crossfadeMs === 0
                ? t('settings.generation.crossfade.cut')
                : t('settings.generation.crossfade.ms', { ms: crossfadeMs })}
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
            aria-label={t('settings.generation.crossfade.title')}
          />
        </SettingRow>

        <SettingRow
          title={t('settings.generation.normalize.title')}
          description={t('settings.generation.normalize.description')}
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
          title={t('settings.generation.autoplay.title')}
          description={t('settings.generation.autoplay.description')}
          htmlFor="autoplayOnGenerate"
          action={
            <Toggle
              id="autoplayOnGenerate"
              checked={autoplayOnGenerate}
              onCheckedChange={setAutoplayOnGenerate}
            />
          }
        />

        <SettingRow
          title={t('settings.generation.folder.title')}
          description={generationsPath ?? t('settings.generation.folder.description')}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={openGenerationsFolder}
              disabled={opening || !generationsPath}
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              {t('settings.generation.folder.open')}
            </Button>
          }
        />
      </SettingSection>
    </div>
  );
}
