import { AudioWaveform, Download, MoreHorizontal, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api/client';
import { useDeleteGeneration, useHistory } from '@/lib/hooks/useHistory';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDuration } from '@/lib/utils/format';
import { usePlayerStore } from '@/stores/playerStore';

// OLD TABLE-BASED COMPONENT - REMOVED (can be found in git history)
// This is the new alternate history view with fixed height rows

// NEW ALTERNATE HISTORY VIEW - FIXED HEIGHT ROWS
export function HistoryTable() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: historyData, isLoading } = useHistory({
    limit,
    offset: page * limit,
  });

  const deleteGeneration = useDeleteGeneration();
  const setAudio = usePlayerStore((state) => state.setAudio);
  const currentAudioId = usePlayerStore((state) => state.audioId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const audioUrl = usePlayerStore((state) => state.audioUrl);
  const isPlayerVisible = !!audioUrl;

  const handlePlay = (audioId: string, text: string) => {
    const audioUrl = apiClient.getAudioUrl(audioId);
    // If clicking the same audio that's playing, it will be handled by the player
    setAudio(audioUrl, audioId, text.substring(0, 50));
  };

  const handleDownload = (audioId: string, text: string) => {
    const audioUrl = apiClient.getAudioUrl(audioId);
    const filename = `${text.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}.wav`;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading history...</div>
      </div>
    );
  }

  const history = historyData?.items || [];
  const total = historyData?.total || 0;
  const hasMore = history.length === limit && (page + 1) * limit < total;

  return (
    <div className="flex flex-col h-full min-h-0">
      {history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground flex-1 flex items-center justify-center">
          No generation history yet. Generate your first audio to see it here.
        </div>
      ) : (
        <>
          <div
            className={cn(
              'flex-1 min-h-0 overflow-y-auto space-y-2',
              isPlayerVisible && 'max-h-[calc(100vh-220px)]',
            )}
          >
            {history.map((gen) => {
              const isCurrentlyPlaying = currentAudioId === gen.id && isPlaying;
              return (
                <div
                  key={gen.id}
                  className={cn(
                    'flex items-stretch gap-4 h-24 border rounded-md p-3 bg-card hover:bg-muted/70 transition-colors cursor-pointer',
                    isCurrentlyPlaying && 'bg-muted/70',
                  )}
                  onClick={() => handlePlay(gen.id, gen.text)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePlay(gen.id, gen.text);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Play audio"
                >
                  {/* Waveform icon */}
                  <div className="flex items-center shrink-0">
                    <AudioWaveform className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Left side - Meta information */}
                  <div className="flex flex-col gap-1.5 w-48 shrink-0 justify-center">
                    <div className="font-medium text-sm truncate" title={gen.profile_name}>
                      {gen.profile_name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {gen.language}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(gen.duration)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(gen.created_at)}
                    </div>
                  </div>

                  {/* Right side - Transcript textarea */}
                  <div className="flex-1 min-w-0 flex">
                    <Textarea
                      readOnly
                      value={gen.text}
                      className="flex-1 resize-none text-sm text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Far right - Ellipsis actions */}
                  <div className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePlay(gen.id, gen.text)}>
                          <Play className="mr-2 h-4 w-4" />
                          Play
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(gen.id, gen.text)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteGeneration.mutate(gen.id)}
                          disabled={deleteGeneration.isPending}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center mt-4 shrink-0">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {page + 1} • {total} total
            </div>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
