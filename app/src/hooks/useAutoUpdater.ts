import { useCallback, useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  version?: string;
  downloading: boolean;
  installing: boolean;
  error?: string;
  downloadProgress?: number; // 0-100 percentage
  downloadedBytes?: number;
  totalBytes?: number;
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
  }, []);

  const downloadAndInstall = async () => {
    if (!update || !isTauri()) return;

    try {
      setStatus((prev) => ({ ...prev, downloading: true, error: undefined }));

      let downloadedBytes = 0;
      let totalBytes = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0;
            downloadedBytes = 0;
            setStatus((prev) => ({ 
              ...prev, 
              downloading: true,
              totalBytes,
              downloadedBytes: 0,
              downloadProgress: 0
            }));
            break;
          case 'Progress': {
            downloadedBytes += event.data.chunkLength;
            const progress = totalBytes > 0 
              ? Math.round((downloadedBytes / totalBytes) * 100)
              : undefined;
            setStatus((prev) => ({
              ...prev,
              downloadedBytes,
              downloadProgress: progress
            }));
            break;
          }
          case 'Finished':
            setStatus((prev) => ({
              ...prev,
              downloading: false,
              installing: true,
              downloadProgress: 100
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
        downloadProgress: undefined,
        downloadedBytes: undefined,
        totalBytes: undefined,
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
  };
}
