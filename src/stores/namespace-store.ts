import { create } from 'zustand';
import { getCurrentWorkspace, setCurrentWorkspace } from '@/lib/storage';
import { getLangfuseProjectMap } from '@/lib/appEnv';

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

/** 首次进入未选空间时，取 LANGFUSE_PROJECT_MAP 第一个 key 作默认，避免 Public API 401 */
function resolveInitialWorkspace(): string {
  const stored = getCurrentWorkspace();
  if (stored) return stored;
  const firstKey = Object.keys(getLangfuseProjectMap())[0];
  if (firstKey) {
    setCurrentWorkspace(firstKey);
    return firstKey;
  }
  return '';
}

const initialWorkspace = resolveInitialWorkspace();

export const useNamespaceStore = create<NamespaceStore>((set) => ({
  currentNamespace: initialWorkspace,
  namespaceShowName: initialWorkspace,

  setCurrentNamespace: (key: string) => {
    setCurrentWorkspace(key);
    set({ currentNamespace: key, namespaceShowName: key });
  },
}));
