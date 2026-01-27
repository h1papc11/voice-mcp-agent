import { useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const playPause = (file: File | null | undefined) => {
    if (!file) return;

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(URL.createObjectURL(file));
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        if (audioRef.current) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      });

      audio.addEventListener('error', () => {
        setIsPlaying(false);
        toast({
          title: 'Playback error',
          description: 'Failed to play audio file',
          variant: 'destructive',
        });
        if (audioRef.current) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      });

      audio.play();
      setIsPlaying(true);
    }
  };

  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  return {
    isPlaying,
    playPause,
    cleanup,
  };
}
