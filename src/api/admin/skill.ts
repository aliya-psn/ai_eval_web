import type {
  SkillListParams,
  SkillListResponse,
  SkillAdminDetail,
  SkillDocument,
} from '@/types/skill';
import { adminRequest } from './request';

const BASE = '/api/admin/nacos-skills';

interface UploadOptions {
  skillName?: string; // ZIP 文件名，去掉.zip
  workspaceCode?: string;
  overwrite?: boolean;
  targetVersion?: string;
  commitMsg?: string;
  uploadAction?: string;
}

const skillNameFromZip = (fileName: string, explicit?: string): string => {
  const fromOpt = explicit?.trim();
  if (fromOpt) return fromOpt;
  return fileName.replace(/\.zip$/i, '').trim() || 'skill';
};

export const adminSkillApi = {
  /** 分页查询与搜索列表 */
  list: (params: SkillListParams): Promise<SkillListResponse> =>
    adminRequest({
      path: `${BASE}/list`,
      method: 'GET',
      params,
    }),

  /** 获取 Skill 详情 */
  getDetail: (params: {
    namespaceId?: string;
    skillName: string;
  }): Promise<SkillAdminDetail> =>
    adminRequest({
      path: BASE,
      method: 'GET',
      params,
    }),

  /** 获取指定版本详情 */
  getVersion: (params: {
    namespaceId?: string;
    skillName: string;
    version: string;
  }): Promise<SkillDocument> =>
    adminRequest({
      path: `${BASE}/version`,
      method: 'GET',
      params,
    }),

  /** 下载 Skill 版本为 ZIP */
  downloadVersion: (params: {
    namespaceId?: string;
    skillName: string;
    version: string;
  }): Promise<Blob> =>
    adminRequest({
      path: `${BASE}/version/download`,
      method: 'GET',
      params,
      responseType: 'blob',
    }),

  /**
   * 制品库上传完成后，用 repoPath 注册 Skill。
   * POST /upload?namespaceId&skillName&repoPath&workspaceCode（无 body）
   */
  upload: (
    namespaceId: string,
    repoPath: string,
    options?: UploadOptions & { fileName?: string },
  ): Promise<string> => {
    const skillName = skillNameFromZip(
      options?.fileName || options?.skillName || 'skill.zip',
      options?.skillName,
    );
    return adminRequest({
      path: `${BASE}/upload`,
      method: 'POST',
      params: {
        namespaceId,
        skillName,
        repoPath,
        ...(options?.workspaceCode ? { workspaceCode: options.workspaceCode } : {}),
        ...(options?.overwrite !== undefined ? { overwrite: options.overwrite } : {}),
        ...(options?.targetVersion ? { targetVersion: options.targetVersion } : {}),
        ...(options?.commitMsg ? { commitMsg: options.commitMsg } : {}),
        ...(options?.uploadAction ? { uploadAction: options.uploadAction } : {}),
      },
      timeout: 60000,
    });
  },

  /** 删除 Skill */
  delete: (params: {
    namespaceId?: string;
    skillName: string;
  }): Promise<string> =>
    adminRequest({
      path: BASE,
      method: 'DELETE',
      params,
    }),

  /** 创建草稿版本 */
  createDraft: (data: {
    workspaceCode?: string;
    namespaceId?: string;
    skillName: string;
    basedOnVersion?: string;
    targetVersion?: string;
    skillCard?: string;
    /** 版本级提交说明（可选；非 SKILL.md 中的技能描述） */
    commitMsg?: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/draft`,
      method: 'POST',
      body: data,
      timeout: 60000,
    }),

  /** 更新草稿内容 */
  updateDraft: (data: {
    namespaceId?: string;
    skillCard: string;
    setAsLatest?: boolean;
    /** 版本级提交说明（可选；非技能描述） */
    commitMsg?: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/draft`,
      method: 'PUT',
      body: data,
    }),

  /** 删除草稿 */
  deleteDraft: (params: {
    namespaceId?: string;
    skillName: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/draft`,
      method: 'DELETE',
      params,
    }),

  /** 提交流水线审核 */
  submit: (data: {
    namespaceId?: string;
    skillName: string;
    version?: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/submit`,
      method: 'POST',
      body: data,
    }),

  /** 发布已通过审核的版本 */
  publish: (data: {
    namespaceId?: string;
    skillName: string;
    version: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/publish`,
      method: 'POST',
      body: data,
    }),

  /** 重新编辑已审核版本（回退为草稿） */
  redraft: (data: {
    namespaceId?: string;
    skillName: string;
    version: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/redraft`,
      method: 'POST',
      body: data,
    }),

  /** 更新标签 */
  updateLabels: (data: {
    namespaceId?: string;
    skillName: string;
    labels: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/labels`,
      method: 'PUT',
      body: data,
    }),

  /**
   * 更新业务标签。
   * admin 接口要求 bizTags 为 string[]（与 Nacos 直连的 JSON 字符串不同）。
   */
  updateBizTags: (data: {
    namespaceId?: string;
    skillName: string;
    bizTags: string[];
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/biz-tags`,
      method: 'PUT',
      body: data,
    }),

  /** 上线（Skill 级或版本级） */
  online: (data: {
    namespaceId?: string;
    skillName: string;
    scope?: string;
    version?: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/online`,
      method: 'POST',
      body: data,
    }),

  /** 下线（Skill 级或版本级） */
  offline: (data: {
    namespaceId?: string;
    skillName: string;
    scope?: string;
    version?: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/offline`,
      method: 'POST',
      body: data,
    }),

  /** 更新可见范围 */
  updateVisibility: (data: {
    workspaceCode?: string;
    namespaceId?: string;
    skillName: string;
    visibility: string;
    workspaceName: string;
  }): Promise<string> =>
    adminRequest({
      path: `${BASE}/visibility`,
      method: 'PUT',
      body: data,
    }),

  /**
   * Skill 市场：分页查询公开 Skill。
   * workspaceCode 可由 trigger / withWorkspace 注入。
   */
  marketList: (params: SkillListParams & { workspaceCode?: string }): Promise<SkillListResponse> =>
    adminRequest({
      path: `${BASE}/market/list`,
      method: 'GET',
      params,
    }),
};
