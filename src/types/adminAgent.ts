// ===== HTTP Agent (testinfra-admin) =====

export type HttpParamType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type HttpContentType =
  | 'APPLICATION_JSON'
  | 'APPLICATION_FORM_URLENCODED'
  | 'TEXT_PLAIN';

export interface HttpAgentMetadata {
  iconUrl?: string;
  tags?: string[];
  owner?: string;
  documentationUrl?: string;
}

export interface HttpAgentParameter {
  name?: string;
  label?: string;
  type?: HttpParamType;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
}

export interface HttpInvokeConfig {
  method?: HttpMethod;
  url?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  contentType?: HttpContentType;
  bodyTemplate?: unknown;
}

/** 新建 Agent（仅基础信息） */
export interface HttpAgentCreateRequest {
  workspace?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  createUser?: string;
  updateUser?: string;
}

export interface HttpAgentCreateResult {
  id?: number;
}

/** Agent 列表项 */
export interface HttpAgentListItem {
  agentId?: number;
  workspace?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  deliveryVersionCount?: number;
  latestDeliveryVersion?: string;
  currentRevisionNo?: number;
  createdTime?: string;
  updatedTime?: string;
}

export interface HttpAgentListRequest {
  workspace?: string;
  name?: string;
  enabled?: boolean;
  pageNo?: number;
  pageSize?: number;
}

export interface HttpAgentPageView {
  pageNo?: number;
  pageSize?: number;
  total?: number;
  records?: HttpAgentListItem[];
}

/** 集成交付版本 */
export interface HttpAgentDeliveryVersionView {
  deliveryVersionId?: number;
  agentId?: number;
  deliveryVersion?: string;
  description?: string;
  currentRevisionId?: number;
  currentRevisionNo?: number;
  revisionCount?: number;
  createdTime?: string;
  updatedTime?: string;
}

export interface HttpAgentDeliveryVersionCreateRequest {
  deliveryVersion?: string;
  description?: string;
  /** 测试负责人工号 */
  testOwner?: string;
  /** 测试负责人名字 */
  testOwnerName?: string;
  /** 研发负责人工号 */
  devOwner?: string;
  /** 研发负责人名字 */
  devOwnerName?: string;
  parameters?: HttpAgentParameter[];
  invoke?: HttpInvokeConfig;
  metadata?: HttpAgentMetadata;
  createUser?: string;
}

export interface HttpAgentDeliveryVersionUpdateRequest {
  deliveryVersionId?: number;
  description?: string;
  /** 测试负责人工号 */
  testOwner?: string;
  /** 测试负责人名字 */
  testOwnerName?: string;
  /** 研发负责人工号 */
  devOwner?: string;
  /** 研发负责人名字 */
  devOwnerName?: string;
  parameters?: HttpAgentParameter[];
  invoke?: HttpInvokeConfig;
  metadata?: HttpAgentMetadata;
  createUser?: string;
}

/** 历史修订 */
export interface HttpAgentRevisionView {
  revisionId?: number;
  deliveryVersionId?: number;
  revisionNo?: number;
  current?: boolean;
  createUser?: string;
  createdTime?: string;
}

export interface HttpAgentRevisionDetail {
  agentId?: number;
  workspace?: string;
  name?: string;
  agentEnabled?: boolean;
  deliveryVersionId?: number;
  deliveryVersion?: string;
  revisionId?: number;
  revisionNo?: number;
  current?: boolean;
  description?: string;
  /** 测试负责人工号 */
  testOwner?: string;
  /** 测试负责人名字 */
  testOwnerName?: string;
  /** 研发负责人工号 */
  devOwner?: string;
  /** 研发负责人名字 */
  devOwnerName?: string;
  parameters?: HttpAgentParameter[];
  invoke?: HttpInvokeConfig;
  metadata?: HttpAgentMetadata;
  createUser?: string;
  createdTime?: string;
}

/** @deprecated 兼容旧引用，请使用 HttpAgentRevisionDetail */
export type HttpAgentCard = HttpAgentRevisionDetail & {
  id?: number;
  version?: string;
  enabled?: boolean;
  updateUser?: string;
  updatedTime?: string;
  isDeleted?: number;
};

/** @deprecated 兼容旧引用，请使用 HttpAgentDeliveryVersionView */
export type HttpAgentVersionDetail = HttpAgentDeliveryVersionView & {
  id?: number;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  latest?: boolean;
};

/** @deprecated 兼容旧引用，请使用 HttpAgentListItem */
export type HttpAgentVersionInfo = HttpAgentListItem & {
  id?: number;
  version?: string;
  createUser?: string;
  updateUser?: string;
  metadata?: HttpAgentMetadata;
  versionDetails?: HttpAgentVersionDetail[];
};

export interface HttpAgentVersionListRequest {
  workspace?: string;
  name?: string;
}

// ===== Nacos A2A Agent (via testinfra-admin) =====

export interface NacosAgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extensions?: Array<{
    uri?: string;
    description?: string;
    required?: boolean;
    params?: Record<string, unknown>;
  }>;
}

export interface NacosAgentSkill {
  id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface NacosAgentInterface {
  url?: string;
  transport?: string;
}

export interface NacosAgentProvider {
  organization?: string;
  url?: string;
}

export interface NacosAgentVersionDetail {
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  latest?: boolean;
}

export interface NacosAgentCardVersionInfo {
  protocolVersion?: string;
  name?: string;
  description?: string;
  version?: string;
  iconUrl?: string;
  capabilities?: NacosAgentCapabilities;
  skills?: NacosAgentSkill[];
  latestPublishedVersion?: string;
  versionDetails?: NacosAgentVersionDetail[];
  registrationType?: string;
}

export interface NacosAgentCardDetailInfo extends NacosAgentCardVersionInfo {
  url?: string;
  preferredTransport?: string;
  additionalInterfaces?: NacosAgentInterface[];
  supportedInterfaces?: NacosAgentInterface[];
  provider?: NacosAgentProvider;
  documentationUrl?: string;
  securitySchemes?: unknown;
  security?: unknown;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  supportsAuthenticatedExtendedCard?: boolean;
  latestVersion?: boolean;
}

export interface NacosAgentCardPageRequest {
  namespaceId?: string;
  agentName?: string;
  search?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface PageNacosAgentCardVersionInfo {
  totalCount?: number;
  pageNumber?: number;
  pagesAvailable?: number;
  pageItems?: NacosAgentCardVersionInfo[];
}

export interface NacosAgentCardDetailRequest {
  namespaceId?: string;
  agentName?: string;
  version?: string;
  registrationType?: string;
}

export interface NacosAgentCardVersionListRequest {
  namespaceId?: string;
  agentName?: string;
}
