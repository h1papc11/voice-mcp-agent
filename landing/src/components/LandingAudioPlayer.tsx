'use client';

import { Pause, Play, Repeat, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface LandingAudioPlayerProps {
  audioUrl: string;
  title: string;
  playing: boolean;
  muted: boolean;
  onFinish: () => void;
  onClose: () => void;
}

export function LandingAudioPlayer({
  audioUrl,
  title,
  playing,
  muted,
  onFinish,
  onClose,
}: LandingAudioPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [isLooping, setIsLooping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Initialize WaveSurfer
  useEffect(() => {
    const initWaveSurfer = () => {
      const container = waveformRef.current;
      if (!container) {
        setTimeout(initWaveSurfer, 50);
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initWaveSurfer, 50);
        return;
      }

      // Clean up existing instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }

      const root = document.documentElement;
      const getCSSVar = (varName: string) => {
        const value = getComputedStyle(root).getPropertyValue(varName).trim();
        return value ? `hsl(${value})` : '';
      };

      const ws = WaveSurfer.create({
        container,
        waveColor: getCSSVar('--muted'),
        progressColor: getCSSVar('--accent'),
        cursorColor: getCSSVar('--accent'),
        barWidth: 2,
        barRadius: 2,
        height: 80,
        normalize: true,
        interact: true,
        mediaControls: false,
      });

      ws.on('ready', () => {
        setDuration(ws.getDuration());
        ws.setVolume(mutedRef.current ? 0 : volume);
        setIsReady(true);
      });

      ws.on('play', () => {
        console.log('[Player] play event');
        setIsPlaying(true);
      });
      ws.on('pause', () => {
        console.log('[Player] pause event');
        setIsPlaying(false);
      });

      ws.on('timeupdate', (time: number) => {
        setCurrentTime(Math.min(time, ws.getDuration()));
      });

      let didFinish = false;
      ws.on('finish', () => {
        if (didFinish) return;
        didFinish = true;
        console.log(
          '[Player] finish event, currentTime:',
          ws.getCurrentTime(),
          'duration:',
          ws.getDuration(),
        );
        setIsPlaying(false);
        onFinishRef.current();
      });

      ws.load(audioUrl);
      wavesurferRef.current = ws;
    };

    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(initWaveSurfer, 10);
      });
    });

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Respond to external play/stop signals
  useEffect(() => {
    const ws = wavesurferRef.current;
    console.log('[Player] effect', { playing, isReady, hasWs: !!ws });
    if (!ws || !isReady) return;

    if (playing) {
      ws.play()
        .then(() => {
          console.log(
            '[Player] play succeeded, isPlaying:',
            ws.isPlaying(),
            'currentTime:',
            ws.getCurrentTime(),
          );
          setTimeout(() => {
            console.log(
              '[Player] 1s later, isPlaying:',
              ws.isPlaying(),
              'currentTime:',
              ws.getCurrentTime(),
            );
          }, 1000);
        })
        .catch((e) => console.error('[Player] play failed', e));
    } else {
      ws.pause();
    }
  }, [playing, isReady]);

  // Sync volume and muted state
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(muted ? 0 : volume);
    }
  }, [volume, muted]);

  const handlePlayPause = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  }, []);

  const handleClose = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
    }
    setIsPlaying(false);
    onClose();
  }, [onClose]);

  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 z-30">
      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            disabled={!isReady}
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted shrink-0 disabled:opacity-50"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          {/* Waveform */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div ref={waveformRef} className="w-full min-h-[80px]" />
          </div>

          {/* Time */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
            <span className="font-mono text-xs">{formatDuration(currentTime)}</span>
            <span className="text-xs">/</span>
            <span className="font-mono text-xs">{formatDuration(duration)}</span>
          </div>

          {/* Title */}
          {title && (
            <div className="text-sm font-medium truncate max-w-[200px] shrink-0 hidden lg:block">
              {title}
            </div>
          )}

          {/* Loop */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`h-8 w-8 flex items-center justify-center rounded-sm shrink-0 hover:bg-muted ${
              isLooping ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Repeat className="h-4 w-4" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 shrink-0 w-[120px]">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
              className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-sm"
            >
              {volume > 0 ? (
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume * 100}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="flex-1 h-1 appearance-none bg-muted rounded-full accent-foreground cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
            />
          </div>

          {/* Close */}
          <button
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-sm shrink-0"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
