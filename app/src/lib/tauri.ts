/**
 * Tauri integration utilities
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Start the bundled Python server (Tauri only)
 */
export async function startServer(remote = false): Promise<string> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  try {
    const result = await invoke<string>('start_server', { remote });
    console.log('Server started:', result);
    return result;
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

/**
 * Stop the bundled Python server (Tauri only)
 */
export async function stopServer(): Promise<void> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  try {
    await invoke('stop_server');
    console.log('Server stopped');
  } catch (error) {
    console.error('Failed to stop server:', error);
    throw error;
  }
}

/**
 * Setup window close handler to check setting and stop server if needed
 */
export async function setupWindowCloseHandler(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    // Listen for window close request from Rust
    await listen<null>('window-close-requested', async () => {
      // Import store here to avoid circular dependency
      const { useServerStore } = await import('@/stores/serverStore');
      const keepRunning = useServerStore.getState().keepServerRunningOnClose;

      // Check if server was started by this app instance
      // In dev mode, serverStartedByApp will be false, so we won't try to stop a separately-run server
      // We need to access the module-level variable - this is a bit hacky but works
      // @ts-expect-error - accessing module-level variable from another module
      const serverStartedByApp = window.__voiceboxServerStartedByApp ?? false;

      if (!keepRunning && serverStartedByApp) {
        // Stop server before closing (only if we started it)
        try {
          await stopServer();
        } catch (error) {
          console.error('Failed to stop server on close:', error);
        }
      }

      // Emit event back to Rust to allow close
      await emit('window-close-allowed');
    });
  } catch (error) {
    console.error('Failed to setup window close handler:', error);
  }
}
