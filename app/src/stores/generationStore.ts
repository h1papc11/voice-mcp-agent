import { create } from 'zustand';

interface GenerationState {
  /** IDs of generations currently in progress */
  pendingGenerationIds: Set<string>;
  /** Whether any generation is in progress (derived convenience) */
  isGenerating: boolean;
  addPendingGeneration: (id: string) => void;
  removePendingGeneration: (id: string) => void;
  /** Legacy setter for backward compat with useRestoreActiveTasks */
  setIsGenerating: (generating: boolean) => void;
  setActiveGenerationId: (id: string | null) => void;
  activeGenerationId: string | null;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  pendingGenerationIds: new Set(),
  isGenerating: false,
  activeGenerationId: null,

  addPendingGeneration: (id) =>
    set((state) => {
      const next = new Set(state.pendingGenerationIds);
      next.add(id);
      return { pendingGenerationIds: next, isGenerating: true };
    }),

  removePendingGeneration: (id) =>
    set((state) => {
      const next = new Set(state.pendingGenerationIds);
      next.delete(id);
      return { pendingGenerationIds: next, isGenerating: next.size > 0 };
    }),

  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setActiveGenerationId: (id) => set({ activeGenerationId: id }),
}));
