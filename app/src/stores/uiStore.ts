import { create } from 'zustand';

interface UIStore {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Modals
  profileDialogOpen: boolean;
  setProfileDialogOpen: (open: boolean) => void;
  editingProfileId: string | null;
  setEditingProfileId: (id: string | null) => void;

  generationDialogOpen: boolean;
  setGenerationDialogOpen: (open: boolean) => void;

  // Selected profile for generation
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string | null) => void;

  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  profileDialogOpen: false,
  setProfileDialogOpen: (open) => set({ profileDialogOpen: open }),
  editingProfileId: null,
  setEditingProfileId: (id) => set({ editingProfileId: id }),

  generationDialogOpen: false,
  setGenerationDialogOpen: (open) => set({ generationDialogOpen: open }),

  selectedProfileId: null,
  setSelectedProfileId: (id) => set({ selectedProfileId: id }),

  theme: 'light',
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },
}));
