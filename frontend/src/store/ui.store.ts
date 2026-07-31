import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  themeMode: 'light' | 'dark';
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      themeMode: 'light',
      toggleTheme: () => set(s => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),
    }),
    { name: 'atelie-ui' },
  ),
);
