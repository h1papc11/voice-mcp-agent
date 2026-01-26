import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, CheckCircle2 } from 'lucide-react';
import { ModelProgress } from './ModelProgress';
import { useToast } from '@/components/ui/use-toast';

export function ModelManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);

  const { data: modelStatus, isLoading } = useQuery({
    queryKey: ['modelStatus'],
    queryFn: () => apiClient.getModelStatus(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const downloadMutation = useMutation({
    mutationFn: (modelName: string) => {
      setDownloadingModel(modelName);
      return apiClient.triggerModelDownload(modelName);
    },
    onSuccess: (_, modelName) => {
      toast({
        title: 'Download started',
        description: `Downloading ${modelName}...`,
      });
      // Refetch status after a delay to see progress
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
      }, 1000);
    },
    onError: (error: Error) => {
      setDownloadingModel(null);
      toast({
        title: 'Download failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Clear downloading state after a delay to allow progress to show
      setTimeout(() => {
        setDownloadingModel(null);
      }, 2000);
    },
  });

  const formatSize = (sizeMb?: number): string => {
    if (!sizeMb) return 'Unknown';
    if (sizeMb < 1024) return `${sizeMb.toFixed(1)} MB`;
    return `${(sizeMb / 1024).toFixed(2)} GB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Management</CardTitle>
        <CardDescription>
          Download and manage AI models for voice generation and transcription
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : modelStatus ? (
          <div className="space-y-4">
            {/* TTS Models */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                Voice Generation Models
              </h3>
              <div className="space-y-2">
                {modelStatus.models
                  .filter((m) => m.model_name.startsWith('qwen-tts'))
                  .map((model) => (
                    <ModelItem
                      key={model.model_name}
                      model={model}
                      onDownload={() => downloadMutation.mutate(model.model_name)}
                      isDownloading={downloadingModel === model.model_name}
                      formatSize={formatSize}
                    />
                  ))}
              </div>
            </div>

            {/* Whisper Models */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                Transcription Models
              </h3>
              <div className="space-y-2">
                {modelStatus.models
                  .filter((m) => m.model_name.startsWith('whisper'))
                  .map((model) => (
                    <ModelItem
                      key={model.model_name}
                      model={model}
                      onDownload={() => downloadMutation.mutate(model.model_name)}
                      isDownloading={downloadingModel === model.model_name}
                      formatSize={formatSize}
                    />
                  ))}
              </div>
            </div>

            {/* Progress indicators */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                Download Progress
              </h3>
              <div className="space-y-2">
                {modelStatus.models.map((model) => (
                  <ModelProgress
                    key={model.model_name}
                    modelName={model.model_name}
                    displayName={model.display_name}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface ModelItemProps {
  model: {
    model_name: string;
    display_name: string;
    downloaded: boolean;
    size_mb?: number;
    loaded: boolean;
  };
  onDownload: () => void;
  isDownloading: boolean;
  formatSize: (sizeMb?: number) => string;
}

function ModelItem({ model, onDownload, isDownloading, formatSize }: ModelItemProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{model.display_name}</span>
          {model.loaded && (
            <Badge variant="default" className="text-xs">
              Loaded
            </Badge>
          )}
          {model.downloaded && !model.loaded && (
            <Badge variant="secondary" className="text-xs">
              Downloaded
            </Badge>
          )}
        </div>
        {model.downloaded && model.size_mb && (
          <div className="text-xs text-muted-foreground mt-1">
            Size: {formatSize(model.size_mb)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {model.downloaded ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Ready</span>
          </div>
        ) : (
          <Button size="sm" onClick={onDownload} disabled={isDownloading} variant="outline">
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
