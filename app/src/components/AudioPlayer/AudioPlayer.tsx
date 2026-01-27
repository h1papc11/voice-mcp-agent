import { Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatAudioDuration } from '@/lib/utils/audio';
import { usePlayerStore } from '@/stores/playerStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { isTauri } from '@/lib/tauri';
import { invoke } from '@tauri-apps/api/core';

export function AudioPlayer() {
  const {
    audioUrl,
    audioId,
    profileId,
    title,
    isPlaying,
    currentTime,
    duration,
    volume,
    isLooping,
    shouldRestart,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    toggleLoop,
    clearRestartFlag,
  } = usePlayerStore();

  // Check if profile has assigned channels (for native audio routing)
  const { data: profileChannels } = useQuery({
    queryKey: ['profile-channels', profileId],
    queryFn: () => {
      if (!profileId) return { channel_ids: [] };
      return apiClient.getProfileChannels(profileId);
    },
    enabled: !!profileId && isTauri(),
  });

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: () => apiClient.listChannels(),
    enabled: !!profileChannels && profileChannels.channel_ids.length > 0,
  });

  // Determine if we should use native playback
  const useNativePlayback = useMemo(() => {
    if (!isTauri() || !profileChannels || !channels) return false;
    
    const assignedChannels = channels.filter((ch) =>
      profileChannels.channel_ids.includes(ch.id),
    );
    
    // Use native playback if any assigned channel has non-default devices
    return assignedChannels.some(
      (ch) => ch.device_ids.length > 0 && !ch.is_default,
    );
  }, [profileChannels, channels, isTauri()]);

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const loadingRef = useRef(false);
  const previousAudioIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize WaveSurfer (only when audioUrl exists and container is ready)
  useEffect(() => {
    // Don't initialize if no audioUrl or already initialized
    if (!audioUrl) {
      return;
    }

    if (wavesurferRef.current) {
      console.log('WaveSurfer already initialized, skipping');
      return;
    }

    console.log('Creating NEW WaveSurfer instance');

    // Wait for container to be properly rendered
    const initWaveSurfer = () => {
      const container = waveformRef.current;
      if (!container) {
        // Container not ready yet, retry
        setTimeout(initWaveSurfer, 50);
        return;
      }

      // Check if container has dimensions and is visible
      const rect = container.getBoundingClientRect();
      const style = window.getComputedStyle(container);
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';

      if (!isVisible) {
        // Retry after a short delay
        setTimeout(initWaveSurfer, 50);
        return;
      }

      console.log('Initializing WaveSurfer...', {
        container,
        width: rect.width,
        height: rect.height,
      });

      try {
        // Get computed CSS variable values
        const root = document.documentElement;
        const getCSSVar = (varName: string) => {
          const value = getComputedStyle(root).getPropertyValue(varName).trim();
          return value ? `hsl(${value})` : '';
        };

        const waveColor = getCSSVar('--muted');
        const progressColor = getCSSVar('--accent');
        const cursorColor = getCSSVar('--accent');

        const wavesurfer = WaveSurfer.create({
          container: container,
          waveColor: waveColor,
          progressColor: progressColor,
          cursorColor: cursorColor,
          barWidth: 2,
          barRadius: 2,
          height: 80,
          normalize: true,
          backend: 'WebAudio',
          interact: true, // Enable interaction (click to seek)
          mediaControls: false, // Don't show native controls
        });

        wavesurferRef.current = wavesurfer;
        console.log('WaveSurfer created successfully');
      } catch (error) {
        console.error('Failed to create WaveSurfer:', error);
        setError(
          `Failed to initialize waveform: ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }

      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer) return;

      // Update store when time changes
      wavesurfer.on('timeupdate', (time) => {
        setCurrentTime(time);
      });

      // Update store when duration is loaded
      wavesurfer.on('ready', () => {
        const dur = wavesurfer.getDuration();
        setDuration(dur);
        loadingRef.current = false;
        setIsLoading(false);
        setError(null);
        console.log('Audio ready, duration:', dur);
        console.log('Waveform should be visible now');

        // Ensure volume is set
        const currentVolume = usePlayerStore.getState().volume;
        wavesurfer.setVolume(currentVolume);

        // Get the underlying audio element and ensure it's not muted
        const mediaElement = wavesurfer.getMediaElement();
        if (mediaElement) {
          mediaElement.volume = currentVolume;
          mediaElement.muted = false;
          console.log('Audio element volume:', mediaElement.volume, 'muted:', mediaElement.muted);
        }

        // Auto-play when ready
        // Use a small delay to ensure audio element is fully ready
        setTimeout(() => {
          wavesurfer.play().catch((error) => {
            console.error('Failed to autoplay:', error);
            // Don't show error for autoplay failures (browser restrictions)
          });
        }, 100);
      });

      // Handle play/pause
      wavesurfer.on('play', () => {
        setIsPlaying(true);
        // Ensure audio element is not muted when playing
        const mediaElement = wavesurfer.getMediaElement();
        if (mediaElement) {
          mediaElement.muted = false;
          const currentVolume = usePlayerStore.getState().volume;
          mediaElement.volume = currentVolume;
          console.log('Playing - volume:', mediaElement.volume, 'muted:', mediaElement.muted);
        }
      });
      wavesurfer.on('pause', () => setIsPlaying(false));
      wavesurfer.on('finish', () => {
        // Check loop state from store
        const loop = usePlayerStore.getState().isLooping;
        if (loop) {
          wavesurfer.seekTo(0);
          wavesurfer.play();
        } else {
          setIsPlaying(false);
        }
      });

      // Handle errors
      wavesurfer.on('error', (error) => {
        console.error('WaveSurfer error:', error);
        setIsLoading(false);
        setError(`Audio error: ${error instanceof Error ? error.message : String(error)}`);
      });

      // Handle loading
      wavesurfer.on('loading', (percent) => {
        setIsLoading(true);
        if (percent === 100) {
          setIsLoading(false);
        }
      });

      // Load audio immediately if audioUrl is already set
      if (audioUrl) {
        console.log('WaveSurfer ready, loading audio:', audioUrl);
        loadingRef.current = true;
        setIsLoading(true);
        // Stop any current playback before loading new audio
        if (wavesurfer.isPlaying()) {
          wavesurfer.pause();
        }
        wavesurfer
          .load(audioUrl)
          .then(() => {
            console.log('Audio loaded into WaveSurfer');
            loadingRef.current = false;
          })
          .catch((error) => {
            console.error('Failed to load audio into WaveSurfer:', error);
            loadingRef.current = false;
            setIsLoading(false);
            setError(
              `Failed to load audio: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
      }
    };

    // Use double requestAnimationFrame to ensure DOM is fully rendered
    let rafId1: number;
    let rafId2: number;
    let timeoutId: number | null = null;

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        // Add a small delay to ensure container is fully laid out
        timeoutId = setTimeout(() => {
          initWaveSurfer();
        }, 10);
      });
    });

    return () => {
      console.log('Cleaning up WaveSurfer initialization effect');
      if (rafId1) cancelAnimationFrame(rafId1);
      if (rafId2) cancelAnimationFrame(rafId2);
      if (timeoutId) clearTimeout(timeoutId);
      if (wavesurferRef.current) {
        console.log('Destroying WaveSurfer instance');
        try {
          const mediaElement = wavesurferRef.current.getMediaElement();
          if (mediaElement) {
            mediaElement.pause();
            mediaElement.src = '';
          }
          wavesurferRef.current.destroy();
        } catch (error) {
          console.error('Error destroying WaveSurfer:', error);
        }
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl, setIsPlaying, setCurrentTime, setDuration]);

  // Load audio when URL changes (only if WaveSurfer is already initialized)
  useEffect(() => {
    const wavesurfer = wavesurferRef.current;

    if (!audioUrl || !wavesurfer) {
      // Reset state when no audio or WaveSurfer not ready
      if (!audioUrl && wavesurfer) {
        wavesurfer.pause();
        wavesurfer.seekTo(0);
        loadingRef.current = false;
        setIsLoading(false);
        setDuration(0);
        setCurrentTime(0);
        setError(null);
      }
      return;
    }

    // CRITICAL: Force stop any current playback and cancel any pending loads
    // This must happen BEFORE any early returns
    console.log('Audio URL changed to:', audioUrl);

    // COMPLETELY stop and destroy the current audio
    try {
      // First pause if playing
      if (wavesurfer.isPlaying()) {
        console.log('Pausing current playback');
        wavesurfer.pause();
      }

      // Stop the media element explicitly
      const mediaElement = wavesurfer.getMediaElement();
      if (mediaElement) {
        console.log('Stopping media element');
        mediaElement.pause();
        mediaElement.currentTime = 0;
        mediaElement.src = '';
      }

      // Use empty() to completely destroy the waveform and media element
      console.log('Calling wavesurfer.empty() to destroy audio');
      wavesurfer.empty();
    } catch (error) {
      console.error('Error stopping previous audio:', error);
      // Continue anyway to load new audio
    }

    // Reset loading state to allow new load (cancel any pending loads)
    loadingRef.current = false;

    // Now start the new load
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);

    // Load new audio
    console.log('Starting new audio load for:', audioUrl);
    wavesurfer
      .load(audioUrl)
      .then(() => {
        console.log('Audio load promise resolved');
        // Don't set loading to false here - wait for 'ready' event
      })
      .catch((error) => {
        console.error('Failed to load audio:', error);
        console.error('Audio URL:', audioUrl);
        loadingRef.current = false;
        setIsLoading(false);
        setError(`Failed to load audio: ${error instanceof Error ? error.message : String(error)}`);
      });
  }, [audioUrl, setCurrentTime, setDuration]);

  // Sync play/pause state (only when user clicks play/pause button, not auto-sync)
  // This effect is kept for external state changes but should be minimal
  useEffect(() => {
    if (!wavesurferRef.current || duration === 0) return;

    if (isPlaying && wavesurferRef.current.isPlaying() === false) {
      // Only auto-play if audio is ready
      wavesurferRef.current.play().catch((error) => {
        console.error('Failed to play:', error);
        setIsPlaying(false);
        setError(`Playback error: ${error instanceof Error ? error.message : String(error)}`);
      });
    } else if (!isPlaying && wavesurferRef.current.isPlaying()) {
      wavesurferRef.current.pause();
    }
  }, [isPlaying, setIsPlaying, duration]);

  // Sync volume
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(volume);
      // Also ensure the underlying audio element volume is set
      const mediaElement = wavesurferRef.current.getMediaElement();
      if (mediaElement) {
        mediaElement.volume = volume;
        mediaElement.muted = volume === 0;
        console.log('Volume synced:', volume, 'muted:', mediaElement.muted);
      }
    }
  }, [volume]);

  // Mark as initialized when audio is ready, reset when audioId changes
  useEffect(() => {
    if (duration > 0 && audioId) {
      hasInitializedRef.current = true;
    }
    // Reset initialization flag when audioId changes to a new audio
    if (audioId !== previousAudioIdRef.current && previousAudioIdRef.current !== null) {
      hasInitializedRef.current = false;
    }
    if (audioId !== null) {
      previousAudioIdRef.current = audioId;
    }
  }, [duration, audioId]);

  // Handle restart flag - when history item is clicked again, restart from beginning
  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !shouldRestart || duration === 0) {
      return;
    }

    // Reset to beginning and play
    console.log('Restarting current audio from beginning');
    wavesurfer.seekTo(0);
    wavesurfer.play().catch((error) => {
      console.error('Failed to play after restart:', error);
      setIsPlaying(false);
      setError(`Playback error: ${error instanceof Error ? error.message : String(error)}`);
    });
    
    // Clear the restart flag
    clearRestartFlag();
  }, [shouldRestart, duration, setIsPlaying, clearRestartFlag]);

  // Handle loop - WaveSurfer handles this via the 'finish' event

  const handlePlayPause = async () => {
    // If using native playback, handle differently
    if (useNativePlayback && audioUrl && profileChannels && channels) {
      if (isPlaying) {
        // For native playback, we'd need to track and stop streams
        // For now, just toggle the state
        setIsPlaying(false);
        return;
      }

      try {
        // Collect all device IDs from assigned channels
        const assignedChannels = channels.filter((ch) =>
          profileChannels.channel_ids.includes(ch.id),
        );
        const deviceIds = assignedChannels.flatMap((ch) => ch.device_ids);

        if (deviceIds.length > 0) {
          // Fetch audio data
          const response = await fetch(audioUrl);
          const audioData = new Uint8Array(await response.arrayBuffer());

          // Play via native audio
          await invoke('play_audio_to_devices', {
            audio_data: Array.from(audioData),
            device_ids: deviceIds,
          });

          setIsPlaying(true);
          return;
        }
      } catch (error) {
        console.error('Native playback failed, falling back to WaveSurfer:', error);
        // Fall through to WaveSurfer playback
      }
    }

    // Standard WaveSurfer playback
    if (!wavesurferRef.current) {
      console.error('WaveSurfer not initialized');
      return;
    }

    // Check if audio is loaded
    if (duration === 0 && !isLoading) {
      console.error('Audio not loaded yet');
      setError('Audio not loaded. Please wait...');
      return;
    }

    if (wavesurferRef.current.isPlaying()) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play().catch((error) => {
        console.error('Failed to play:', error);
        setIsPlaying(false);
        setError(`Playback error: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  };

  const handleSeek = (value: number[]) => {
    if (!wavesurferRef.current || duration === 0) return;
    const progress = value[0] / 100;
    wavesurferRef.current.seekTo(progress);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100);
  };

  // Don't render if no audio
  if (!audioUrl) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 z-50">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlayPause}
            disabled={isLoading || duration === 0}
            className="shrink-0"
            title={duration === 0 && !isLoading ? 'Audio not loaded' : ''}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          {/* Waveform */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div ref={waveformRef} className="w-full min-h-[80px]" />
            {duration > 0 && (
              <Slider
                value={duration > 0 ? [(currentTime / duration) * 100] : [0]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="w-full"
              />
            )}
            {isLoading && (
              <div className="text-xs text-muted-foreground text-center py-2">Loading audio...</div>
            )}
            {error && <div className="text-xs text-destructive text-center py-2">{error}</div>}
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0 min-w-[100px]">
            <span className="font-mono">{formatAudioDuration(currentTime)}</span>
            <span>/</span>
            <span className="font-mono">{formatAudioDuration(duration)}</span>
          </div>

          {/* Title */}
          {title && (
            <div className="text-sm font-medium truncate max-w-[200px] shrink-0">{title}</div>
          )}

          {/* Loop Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLoop}
            className={isLooping ? 'text-primary' : ''}
            title="Toggle loop"
          >
            <Repeat className="h-4 w-4" />
          </Button>

          {/* Volume Control */}
          <div className="flex items-center gap-2 shrink-0 w-[120px]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
              className="h-8 w-8"
            >
              {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Slider
              value={[volume * 100]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
