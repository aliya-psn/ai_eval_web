import { namespaceApi, type NacosNamespaceItem } from '@/api/admin/namespace';
import { getAdminServerType } from '@/lib/appEnv';

/** 是否测试环境（网关 Server-Type 为 gateway-test） */
const isTestEnv = (): boolean => getAdminServerType() === 'gateway-test';

const findMatchedNamespace = (
  namespaces: NacosNamespaceItem[],
  candidates: string[],
): NacosNamespaceItem | undefined =>
  namespaces.find(
    (item) =>
      candidates.includes(item.namespaceShowName) ||
      candidates.includes(item.namespace),
  );

/**
 * 把 DevOps 当前空间key 转成 Nacos 的 namespace id。
 *
 * 例如：'ceshikongjian' → 'b3010474-0a7d-4bc5-a1ee-bf787e622037'
 *
 * 若 DevOps 空间在 Nacos 尚无对应命名空间，会先创建再重新拉取列表。
 */
export async function resolveNacosNamespaceId(
  currentNamespace: string,
  namespaceShowName?: string,
): Promise<string> {
  const namespaceKey = currentNamespace?.trim();
  if (!namespaceKey) return '';

  const candidates = [namespaceKey, namespaceShowName]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];

  const namespaces = (await namespaceApi.list()) ?? [];
  const matched = findMatchedNamespace(namespaces, candidates);
  if (matched?.namespace) return matched.namespace;

  const desc = namespaceShowName?.trim();
  await namespaceApi.create({
    namespaceName: namespaceKey,
    namespaceDesc: isTestEnv() && desc ? `${desc}（测试环境）` : desc,
  });

  const refreshed = (await namespaceApi.list()) ?? [];
  return findMatchedNamespace(refreshed, candidates)?.namespace ?? '';
}

/**
 * 判断某个 Skill 是否属于当前 DevOps 空间。
 *
 * 流程：当前空间名 → Nacos namespace id → 与 Skill 上的 namespaceId 比较
 */
export async function isSkillInCurrentNamespace(
  skillNamespaceId: string,
  currentNamespace: string,
): Promise<boolean> {
  const skillNs = skillNamespaceId?.trim();
  const workspaceName = currentNamespace?.trim();
  if (!skillNs || !workspaceName) return false;

  const currentNs = await resolveNacosNamespaceId(workspaceName);
  return Boolean(currentNs) && currentNs === skillNs;
}
