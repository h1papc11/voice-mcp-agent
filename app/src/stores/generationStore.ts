import { create } from 'zustand';

interface GenerationState {
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),
}));
