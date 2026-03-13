import { ConnectionForm } from '@/components/ServerSettings/ConnectionForm';
import { GenerationSettings } from '@/components/ServerSettings/GenerationSettings';
import { GpuAcceleration } from '@/components/ServerSettings/GpuAcceleration';
import { UpdateStatus } from '@/components/ServerSettings/UpdateStatus';
import { usePlatform } from '@/platform/PlatformContext';

export function ServerTab() {
  const platform = usePlatform();
  return (
    <div className="overflow-y-auto flex flex-col">
      <div className="grid gap-4 md:grid-cols-2">
        <ConnectionForm />
        <GenerationSettings />
        {platform.metadata.isTauri && <GpuAcceleration />}
        {platform.metadata.isTauri && <UpdateStatus />}
      </div>
      <div className="py-8 text-center text-sm text-muted-foreground">
        Created by{' '}
        <a
          href="https://github.com/jamiepine"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Jamie Pine
        </a>
      </div>
    </div>
  );
}
