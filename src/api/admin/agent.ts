import { adminRequest } from './request';
import type {
  HttpAgentCreateRequest,
  HttpAgentCreateResult,
  HttpAgentDeliveryVersionCreateRequest,
  HttpAgentDeliveryVersionUpdateRequest,
  HttpAgentDeliveryVersionView,
  HttpAgentListRequest,
  HttpAgentPageView,
  HttpAgentRevisionDetail,
  HttpAgentRevisionView,
  NacosAgentCardDetailInfo,
  NacosAgentCardDetailRequest,
  NacosAgentCardPageRequest,
  NacosAgentCardVersionListRequest,
  NacosAgentVersionDetail,
  PageNacosAgentCardVersionInfo,
} from '@/types/adminAgent';

export const adminAgentApi = {
  // ===== HTTP Agent =====

  listHttpAgents: (params: HttpAgentListRequest): Promise<HttpAgentPageView> =>
    adminRequest({ path: '/api/admin/http-agents', method: 'GET', params }),

  createHttpAgent: (data: HttpAgentCreateRequest): Promise<HttpAgentCreateResult> =>
    adminRequest({ path: '/api/admin/http-agents', method: 'POST', body: data }),

  updateHttpAgent: (
    agentId: number,
    data: HttpAgentCreateRequest,
  ): Promise<boolean> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}`,
      method: 'PUT',
      body: data,
    }),

  deleteHttpAgent: (agentId: number): Promise<boolean> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}`,
      method: 'DELETE',
    }),

  listDeliveryVersions: (
    agentId: number,
  ): Promise<HttpAgentDeliveryVersionView[]> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}/delivery-versions`,
      method: 'GET',
    }),

  createDeliveryVersion: (
    agentId: number,
    data: HttpAgentDeliveryVersionCreateRequest,
  ): Promise<HttpAgentRevisionDetail> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}/delivery-versions`,
      method: 'POST',
      body: data,
    }),

  updateDeliveryVersion: (
    agentId: number,
    data: HttpAgentDeliveryVersionUpdateRequest,
  ): Promise<HttpAgentRevisionDetail> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}/delivery-versions`,
      method: 'PUT',
      body: data,
    }),

  deleteDeliveryVersion: (
    agentId: number,
    deliveryVersionId: number,
  ): Promise<boolean> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}/delivery-versions/${deliveryVersionId}`,
      method: 'DELETE',
    }),

  listRevisions: (
    agentId: number,
    deliveryVersionId: number,
  ): Promise<HttpAgentRevisionView[]> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}/delivery-versions/${deliveryVersionId}/revisions`,
      method: 'GET',
    }),

  getRevision: (
    agentId: number,
    deliveryVersionId: number,
    revisionId: number,
  ): Promise<HttpAgentRevisionDetail> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}/delivery-versions/${deliveryVersionId}/revisions/${revisionId}`,
      method: 'GET',
    }),

  getLatestRevision: (
    agentId: number,
    deliveryVersionId: number,
  ): Promise<HttpAgentRevisionDetail> =>
    adminRequest({
      path: `/api/admin/http-agents/${agentId}/delivery-versions/${deliveryVersionId}/revisions/latest`,
      method: 'GET',
    }),

  // ===== Nacos A2A Agent =====

  listNacosAgents: (
    params: NacosAgentCardPageRequest,
  ): Promise<PageNacosAgentCardVersionInfo> =>
    adminRequest({
      path: '/api/admin/nacos-agents/list',
      method: 'GET',
      params,
    }),

  getNacosAgent: (
    params: NacosAgentCardDetailRequest,
  ): Promise<NacosAgentCardDetailInfo> =>
    adminRequest({ path: '/api/admin/nacos-agents', method: 'GET', params }),

  getNacosVersionList: (
    params: NacosAgentCardVersionListRequest,
  ): Promise<NacosAgentVersionDetail[]> =>
    adminRequest({
      path: '/api/admin/nacos-agents/version/list',
      method: 'GET',
      params,
    }),
};
