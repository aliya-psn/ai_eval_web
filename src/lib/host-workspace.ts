/**
 * 当前空间上下文（独立运行模式）。
 * 无基座注入（原 QiankunProps 已移除），统一从 namespace-store 读取；
 * 无空间上下文时为空字符串。
 */
import { useNamespaceStore } from '@/stores/namespace-store';

/** 当前空间 key */
export function getHostWorkspaceKey(): string {
  return useNamespaceStore.getState().currentNamespace;
}

/** 当前空间展示名 */
export async function getHostWorkspaceName(): Promise<string> {
  return useNamespaceStore.getState().namespaceShowName;
}
