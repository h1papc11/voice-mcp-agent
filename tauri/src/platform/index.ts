import type { Platform } from '@/platform/types';
import { tauriFilesystem } from './filesystem';
import { tauriUpdater } from './updater';
import { tauriAudio } from './audio';
import { tauriLifecycle } from './lifecycle';
import { tauriMetadata } from './metadata';

export const tauriPlatform: Platform = {
  filesystem: tauriFilesystem,
  updater: tauriUpdater,
  audio: tauriAudio,
  lifecycle: tauriLifecycle,
  metadata: tauriMetadata,
};
