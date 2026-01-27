import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AudioChannel {
  id: string;
  name: string;
  is_default: boolean;
  device_ids: string[];
  created_at: string;
}

interface AudioChannelStore {
  channels: AudioChannel[];
  setChannels: (channels: AudioChannel[]) => void;
  addChannel: (channel: AudioChannel) => void;
  updateChannel: (id: string, channel: Partial<AudioChannel>) => void;
  removeChannel: (id: string) => void;
}

export const useAudioChannelStore = create<AudioChannelStore>()(
  persist(
    (set) => ({
      channels: [],
      setChannels: (channels) => set({ channels }),
      addChannel: (channel) =>
        set((state) => ({
          channels: [...state.channels, channel],
        })),
      updateChannel: (id, updates) =>
        set((state) => ({
          channels: state.channels.map((ch) =>
            ch.id === id ? { ...ch, ...updates } : ch,
          ),
        })),
      removeChannel: (id) =>
        set((state) => ({
          channels: state.channels.filter((ch) => ch.id !== id),
        })),
    }),
    {
      name: 'voicebox-audio-channels',
    },
  ),
);
