import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  version?: string;
  downloading: boolean;
  installing: boolean;
  error?: string;
}

const isTauri = () => {
  return '__TAURI_INTERNALS__' in window;
};

export function useAutoUpdater(checkOnMount = false) {
  const [status, setStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    installing: false,
  });

  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdates = async () => {
    if (!isTauri()) {
      return;
    }

    try {
      setStatus((prev) => ({ ...prev, checking: true, error: undefined }));

      const foundUpdate = await check();

      if (foundUpdate?.available) {
        setUpdate(foundUpdate);
        setStatus({
          checking: false,
          available: true,
          version: foundUpdate.version,
          downloading: false,
          installing: false,
        });
      } else {
        setStatus({
          checking: false,
          available: false,
          downloading: false,
          installing: false,
        });
      }
    } catch (error) {
      setStatus({
        checking: false,
        available: false,
        downloading: false,
        installing: false,
        error: error instanceof Error ? error.message : 'Failed to check for updates',
      });
    }
  };

  const downloadAndInstall = async () => {
    if (!update || !isTauri()) return;

    try {
      setStatus((prev) => ({ ...prev, downloading: true, error: undefined }));

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setStatus((prev) => ({ ...prev, downloading: true }));
            break;
          case 'Progress':
            console.log(`Downloaded ${event.data.chunkLength} bytes`);
            break;
          case 'Finished':
            setStatus((prev) => ({
              ...prev,
              downloading: false,
              installing: true,
            }));
            break;
        }
      });

      await relaunch();
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        downloading: false,
        installing: false,
        error: error instanceof Error ? error.message : 'Failed to install update',
      }));
    }
  };

  useEffect(() => {
    if (checkOnMount && isTauri()) {
      checkForUpdates();
    }
  }, [checkOnMount]);

  return {
    status,
    checkForUpdates,
    downloadAndInstall,
  };
}
