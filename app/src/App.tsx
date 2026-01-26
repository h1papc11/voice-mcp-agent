import { useState, useEffect } from 'react';
import { GenerationForm } from '@/components/Generation/GenerationForm';
import { HistoryTable } from '@/components/History/HistoryTable';
import { ConnectionForm } from '@/components/ServerSettings/ConnectionForm';
import { ServerStatus } from '@/components/ServerSettings/ServerStatus';
import { UpdateStatus } from '@/components/ServerSettings/UpdateStatus';
import { ModelManagement } from '@/components/ServerSettings/ModelManagement';
import { Toaster } from '@/components/ui/toaster';
import { ProfileList } from '@/components/VoiceProfiles/ProfileList';
import { Sidebar } from '@/components/Sidebar';
import { AudioPlayer } from '@/components/AudioPlayer/AudioPlayer';
import { UpdateNotification } from '@/components/UpdateNotification';
import { isTauri, startServer, setupWindowCloseHandler } from '@/lib/tauri';

// Track if server is starting to prevent duplicate starts
let serverStarting = false;

function App() {
  const [activeTab, setActiveTab] = useState('main');
  const [serverReady, setServerReady] = useState(false);

  // Setup window close handler and auto-start server when running in Tauri (production only)
  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    // Setup window close handler to check setting and stop server if needed
    // This works in both dev and prod, but will only stop server if it was started by the app
    setupWindowCloseHandler().catch((error) => {
      console.error('Failed to setup window close handler:', error);
    });

    // Only auto-start server in production mode
    // In dev mode, user runs server separately
    if (!import.meta.env?.PROD) {
      console.log('Dev mode: Skipping auto-start of server (run it separately)');
      setServerReady(true); // Mark as ready so UI doesn't show loading screen
      // Mark that server was not started by app (so we don't try to stop it on close)
      // @ts-expect-error - adding property to window
      window.__voiceboxServerStartedByApp = false;
      return;
    }

    // Auto-start server in production
    if (serverStarting) {
      return;
    }

    serverStarting = true;
    console.log('Production mode: Starting bundled server...');

    startServer(false)
      .then(() => {
        console.log('Server is ready');
        setServerReady(true);
        // Mark that we started the server (so we know to stop it on close)
        // @ts-expect-error - adding property to window
        window.__voiceboxServerStartedByApp = true;
      })
      .catch((error) => {
        console.error('Failed to auto-start server:', error);
        serverStarting = false;
        // @ts-expect-error - adding property to window
        window.__voiceboxServerStartedByApp = false;
      });

    // Cleanup: stop server on actual unmount (not StrictMode remount)
    // Note: Window close is handled separately in Tauri Rust code
    return () => {
      // Window close event handles server shutdown based on setting
      serverStarting = false;
    };
  }, []);

  // Show loading screen while server is starting in Tauri
  if (isTauri() && !serverReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Starting server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 ml-20 overflow-hidden flex flex-col">
          <div className="container mx-auto px-8 py-8 max-w-[1800px] h-full overflow-hidden flex flex-col">
            <UpdateNotification />

            {activeTab === 'settings' ? (
              <div className="space-y-4 overflow-y-auto">
                <div className="grid gap-4 md:grid-cols-2">
                  <ConnectionForm />
                  <ServerStatus />
                </div>
                {isTauri() && <UpdateStatus />}
                <ModelManagement />
              </div>
            ) : (
              // Main view: Profiles top left, Generator bottom left, History right
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0 overflow-hidden">
                {/* Left Column */}
                <div className="flex flex-col gap-6 min-h-0 overflow-y-auto pb-32">
                  {/* Profiles - Top Left */}
                  <div className="shrink-0 flex flex-col">
                    <ProfileList />
                  </div>

                  {/* Generator - Bottom Left */}
                  <div className="shrink-0">
                    <GenerationForm />
                  </div>
                </div>

                {/* Right Column - History */}
                <div className="flex flex-col min-h-0 overflow-hidden">
                  <HistoryTable />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Audio Player - always visible except on settings */}
      {activeTab !== 'settings' && <AudioPlayer />}

      <Toaster />
    </div>
  );
}

export default App;
