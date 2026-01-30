import { getVersion } from '@tauri-apps/api/app';
import type { PlatformMetadata } from '@/platform/types';

export const tauriMetadata: PlatformMetadata = {
  async getVersion(): Promise<string> {
    try {
      return await getVersion();
    } catch (error) {
      console.error('Failed to get version:', error);
      return '0.1.0';
    }
  },
  isTauri: true,
};
