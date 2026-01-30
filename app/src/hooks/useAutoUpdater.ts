import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@/platform/PlatformContext';
import type { UpdateStatus } from '@/platform/types';

// Re-export UpdateStatus for backwards compatibility
export type { UpdateStatus };

export function useAutoUpdater(checkOnMount = false) {
  const platform = usePlatform();
  const [status, setStatus] = useState<UpdateStatus>(
    platform.updater.getStatus(),
  );

  // Subscribe to updater status changes
  useEffect(() => {
    const unsubscribe = platform.updater.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, [platform]);

  const checkForUpdates = useCallback(async () => {
    await platform.updater.checkForUpdates();
  }, [platform]);

  const downloadAndInstall = useCallback(async () => {
    await platform.updater.downloadAndInstall();
  }, [platform]);

  const restartAndInstall = useCallback(async () => {
    await platform.updater.restartAndInstall();
  }, [platform]);

  useEffect(() => {
    if (checkOnMount && platform.metadata.isTauri) {
      checkForUpdates();
    }
  }, [checkOnMount, checkForUpdates, platform.metadata.isTauri]);

  return {
    status,
    checkForUpdates,
    downloadAndInstall,
    restartAndInstall,
  };
}
