import { useAutoUpdater } from '../hooks/useAutoUpdater';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';

export function UpdateNotification() {
  const { status, checkForUpdates, downloadAndInstall } = useAutoUpdater(true);

  if (status.error) {
    return null;
  }

  if (!status.available && !status.checking) {
    return null;
  }

  if (status.checking) {
    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm">Checking for updates...</span>
        </div>
      </Card>
    );
  }

  if (status.available) {
    return (
      <Card className="p-4 mb-4 border-primary">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Update Available</h3>
            <p className="text-sm text-muted-foreground">
              Version {status.version} is ready to install
            </p>
          </div>

          {status.downloading && (
            <div className="space-y-2">
              <p className="text-sm">Downloading update...</p>
              <Progress />
            </div>
          )}

          {status.installing && (
            <div className="space-y-2">
              <p className="text-sm">Installing update...</p>
              <p className="text-xs text-muted-foreground">App will restart automatically</p>
            </div>
          )}

          {!status.downloading && !status.installing && (
            <div className="flex gap-2">
              <Button onClick={downloadAndInstall} size="sm">
                Install Now
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Later
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return null;
}
