import { create } from 'zustand';

interface PlayerState {
  audioUrl: string | null;
  audioId: string | null;
  title: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLooping: boolean;

  setAudio: (url: string, id: string, title?: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleLoop: () => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  audioUrl: null,
  audioId: null,
  title: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isLooping: false,

  setAudio: (url, id, title) =>
    set({
      audioUrl: url,
      audioId: id,
      title: title || null,
      currentTime: 0,
      isPlaying: false,
    }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })),
  reset: () =>
    set({
      audioUrl: null,
      audioId: null,
      title: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLooping: false,
    }),
}));
