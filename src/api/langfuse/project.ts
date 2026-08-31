import { getHostWorkspaceKey } from '@/lib/host-workspace';
import { langfuseRequest } from './request';

/** 当前空间已缓存的 Langfuse 项目名 */
let cachedWorkspaceKey = '';
let cachedProjectName = '';
/** 进行中的加载（同空间去重） */
let loading: Promise<string> | null = null;

/**
 * 从 Langfuse 拉取当前 API key 对应的项目名并缓存。
 * 应用初始化 / 切换空间时调用一次即可。
 */
export async function loadLangfuseProjectName(): Promise<string> {
  const workspaceKey = getHostWorkspaceKey().trim();
  if (!workspaceKey) {
    throw new Error('当前 DevOps 空间为空，无法解析 Langfuse 项目名');
  }

  if (cachedWorkspaceKey === workspaceKey && cachedProjectName) {
    return cachedProjectName;
  }
  if (loading) return loading;

  loading = (async () => {
    const res = await langfuseRequest<{ data?: Array<{ name?: string }> }>({
      path: '/api/public/projects',
      method: 'GET',
      skipErrorToast: true,
    });
    const name = res?.data?.[0]?.name?.trim() || '';
    if (!name) {
      throw new Error('无法获取 Langfuse 项目名，请检查 LANGFUSE_PROJECT_MAP 密钥配置');
    }
    cachedWorkspaceKey = workspaceKey;
    cachedProjectName = name;
    return name;
  })().finally(() => {
    loading = null;
  });

  return loading;
}

/** 读取已缓存的项目名（未加载则为空字符串） */
export function getLangfuseProjectName(): string {
  const workspaceKey = getHostWorkspaceKey().trim();
  if (!workspaceKey || cachedWorkspaceKey !== workspaceKey) return '';
  return cachedProjectName;
}
