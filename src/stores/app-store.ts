import { create } from 'zustand';
import { getTheme, setTheme as saveTheme, getSidebarCollapsed, setSidebarCollapsed as saveSidebarCollapsed } from '@/lib/storage';

type Theme = 'light' | 'dark';

interface AppState {
  sidebarCollapsed: boolean;
  theme: Theme;
}

interface AppActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  initFromStorage: () => void;
}

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set) => ({
  // State with defaults
  sidebarCollapsed: false,
  theme: 'light',

  // Actions
  toggleSidebar: () => {
    set((state) => {
      const newCollapsed = !state.sidebarCollapsed;
      saveSidebarCollapsed(newCollapsed);
      return { sidebarCollapsed: newCollapsed };
    });
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    saveSidebarCollapsed(collapsed);
    set({ sidebarCollapsed: collapsed });
  },

  setTheme: (theme: Theme) => {
    saveTheme(theme);
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    set({ theme });
  },

  initFromStorage: () => {
    const sidebarCollapsed = getSidebarCollapsed();
    const theme = getTheme();

    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);

    set({
      sidebarCollapsed,
      theme,
    });
  },
}));
