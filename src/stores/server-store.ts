import { create } from 'zustand';

interface ServerState {
  version: string;
  startupMode: string;
  functionMode: string;
  aiEnabled: boolean;
}

export const useServerStore = create<ServerState>(() => ({
  version: '',
  startupMode: '',
  functionMode: '',
  aiEnabled: true,
}));
