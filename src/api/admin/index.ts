/**
 * testinfra-admin 通用 API 层。
 *
 * 基建：adminRequest / adminClient
 * 业务：adminAgentApi → agent；adminSkillApi → nacos-skills
 */
export { adminRequest, adminClient } from './request';
export type { AdminHttpMethod, AdminRequestOptions } from './request';
export { adminAgentApi } from './agent';
export { adminSkillApi } from './skill';
export { namespaceApi } from './namespace';
export type { NacosNamespaceItem } from './namespace';
