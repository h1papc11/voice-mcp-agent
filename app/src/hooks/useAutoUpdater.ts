import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useState } from 'react';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  version?: string;
  downloading: boolean;
  installing: boolean;
  readyToInstall: boolean;
  error?: string;
  downloadProgress?: number; // 0-100 percentage
  downloadedBytes?: number;
  totalBytes?: number;
}

// Check if we're on Windows (NSIS installer handles restart automatically)
const isWindows = () => {
  return navigator.userAgent.includes('Windows');
};

const isTauri = () => {
  return '__TAURI_INTERNALS__' in window;
};

export function useAutoUpdater(checkOnMount = false) {
  const [status, setStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    installing: false,
    readyToInstall: false,
  });

  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
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
          readyToInstall: false,
        });
      } else {
        setStatus({
          checking: false,
          available: false,
          downloading: false,
          installing: false,
          readyToInstall: false,
        });
      }
    } catch (error) {
      setStatus({
        checking: false,
        available: false,
        downloading: false,
        installing: false,
        readyToInstall: false,
        error: error instanceof Error ? error.message : 'Failed to check for updates',
      });
    }
  }, []);

  // Download the update (but don't install yet)
  const downloadAndInstall = async () => {
    if (!update || !isTauri()) return;

    try {
      setStatus((prev) => ({ ...prev, downloading: true, error: undefined }));

      let downloadedBytes = 0;
      let totalBytes = 0;

      // Just download the update
      await update.download((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0;
            downloadedBytes = 0;
            setStatus((prev) => ({
              ...prev,
              downloading: true,
              totalBytes,
              downloadedBytes: 0,
              downloadProgress: 0,
            }));
            break;
          case 'Progress': {
            downloadedBytes += event.data.chunkLength;
            const progress =
              totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : undefined;
            setStatus((prev) => ({
              ...prev,
              downloadedBytes,
              downloadProgress: progress,
            }));
            break;
          }
          case 'Finished':
            setStatus((prev) => ({
              ...prev,
              downloading: false,
              readyToInstall: true,
              downloadProgress: 100,
            }));
            break;
        }
      });
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        downloading: false,
        installing: false,
        readyToInstall: false,
        downloadProgress: undefined,
        downloadedBytes: undefined,
        totalBytes: undefined,
        error: error instanceof Error ? error.message : 'Failed to download update',
      }));
    }
  };

  // Install the downloaded update and restart the app
  const restartAndInstall = async () => {
    if (!update || !isTauri()) return;

    try {
      setStatus((prev) => ({ ...prev, installing: true, error: undefined }));

      // Install the update
      await update.install();

      // On Windows with NSIS, the installer handles the restart automatically.
      // The process will be killed by the NSIS installer, so we won't reach here.
      // On macOS/Linux, we need to manually relaunch.
      if (!isWindows()) {
        await relaunch();
      }
      // If we're on Windows and somehow still running, the NSIS installer
      // should have already handled everything. Just wait for the process to end.
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        installing: false,
        error: error instanceof Error ? error.message : 'Failed to install update',
      }));
    }
  };

  useEffect(() => {
    if (checkOnMount && isTauri()) {
      checkForUpdates();
    }
  }, [checkOnMount, checkForUpdates]);

  return {
    status,
    checkForUpdates,
    downloadAndInstall,
    restartAndInstall,
  };
}
