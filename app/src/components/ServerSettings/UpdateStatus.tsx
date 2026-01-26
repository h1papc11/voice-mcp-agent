import { useState, useEffect } from 'react';
import { RefreshCw, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';
import { getVersion } from '@tauri-apps/api/app';

export function UpdateStatus() {
  const { status, checkForUpdates, downloadAndInstall } = useAutoUpdater(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion('0.1.0'));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Current Version</div>
            <div className="text-sm text-muted-foreground">v{currentVersion}</div>
          </div>
          <Button
            onClick={checkForUpdates}
            disabled={status.checking || status.downloading || status.installing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${status.checking ? 'animate-spin' : ''}`} />
            Check for Updates
          </Button>
        </div>

        {status.checking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Checking for updates...
          </div>
        )}

        {status.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {status.error}
          </div>
        )}

        {status.available && !status.downloading && !status.installing && (
          <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Update Available</div>
                <div className="text-sm text-muted-foreground">Version {status.version}</div>
              </div>
              <Badge>New</Badge>
            </div>
            <Button onClick={downloadAndInstall} className="w-full" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Install Update
            </Button>
          </div>
        )}

        {status.downloading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Download className="h-4 w-4" />
              Downloading update...
            </div>
            <Progress />
          </div>
        )}

        {status.installing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Installing update...
            </div>
            <div className="text-xs text-muted-foreground">App will restart automatically</div>
          </div>
        )}

        {!status.available && !status.checking && !status.error && status.checking === false && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            You're up to date
          </div>
        )}
      </CardContent>
    </Card>
  );
}
