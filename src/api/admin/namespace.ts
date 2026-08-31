import { adminRequest } from './request';

/** Nacos 控制台命名空间项 */
export interface NacosNamespaceItem {
  namespace: string;
  namespaceShowName: string;
  namespaceDesc: string;
  quota: number;
  configCount: number;
  type: number;
}

export interface CreateNacosNamespaceParams {
  namespaceName: string;
  namespaceDesc: string;
}

export const namespaceApi = {
  /** 拉取 Nacos 命名空间列表 */
  list: (): Promise<NacosNamespaceItem[]> =>
    adminRequest({
      path: '/api/admin/nacos-namespaces/list',
      method: 'GET',
    }),

  /** 在 Nacos 新建命名空间（与 DevOps 空间同步） */
  create: (data: CreateNacosNamespaceParams): Promise<void> =>
    adminRequest({
      path: '/api/admin/nacos-namespaces',
      method: 'POST',
      body: data,
    }),
};
