import { Plus, Trash2, Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDeleteSample, useProfileSamples } from '@/lib/hooks/useProfiles';
import { usePlayerStore } from '@/stores/playerStore';
import { apiClient } from '@/lib/api/client';
import { SampleUpload } from './SampleUpload';

interface SampleListProps {
  profileId: string;
}

export function SampleList({ profileId }: SampleListProps) {
  const { data: samples, isLoading } = useProfileSamples(profileId);
  const deleteSample = useDeleteSample();
  const [uploadOpen, setUploadOpen] = useState(false);
  const setAudio = usePlayerStore((state) => state.setAudio);
  const currentAudioId = usePlayerStore((state) => state.audioId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const handleDelete = (sampleId: string) => {
    if (confirm('Are you sure you want to delete this sample?')) {
      deleteSample.mutate(sampleId);
    }
  };

  const handlePlay = (referenceText: string, sampleId: string) => {
    const audioUrl = apiClient.getSampleUrl(sampleId);
    setAudio(audioUrl, sampleId, referenceText.substring(0, 50));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading samples...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Audio Samples</h3>
        <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Sample
        </Button>
      </div>

      {samples && samples.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          No samples yet. Add your first audio sample.
        </div>
      ) : (
        <div className="space-y-2">
          {samples?.map((sample) => (
            <div
              key={sample.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{sample.reference_text}</p>
                <p className="text-xs text-muted-foreground mt-1">{sample.audio_path}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePlay(sample.reference_text, sample.id)}
                  className={currentAudioId === sample.id && isPlaying ? 'text-primary' : ''}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(sample.id)}
                  disabled={deleteSample.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SampleUpload profileId={profileId} open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
