import { create } from 'zustand';
import { getCurrentWorkspace, setCurrentWorkspace } from '@/lib/storage';

interface NamespaceState {
  /** 当前空间 key，供业务接口使用 */
  currentNamespace: string;
  namespaceShowName: string;
}

interface NamespaceActions {
  /** 切换当前空间（持久化到 localStorage，展示名直接用空间 key） */
  setCurrentNamespace: (key: string) => void;
}

type NamespaceStore = NamespaceState & NamespaceActions;

const initialWorkspace = getCurrentWorkspace();

export const useNamespaceStore = create<NamespaceStore>((set) => ({
  currentNamespace: initialWorkspace,
  namespaceShowName: initialWorkspace,

  setCurrentNamespace: (key: string) => {
    setCurrentWorkspace(key);
    set({ currentNamespace: key, namespaceShowName: key });
  },
}));
