/**
 * 制品库 ArtifactUpload：读 .env UPLOAD_REPO，走 webpack /repo 代理直连。
 */

import { getUploadRepoConfig } from '@/lib/appEnv';
import { toBasicAuthHeader } from '@/lib/base64';
import { getHostWorkspaceKey, getHostWorkspaceName } from '@/lib/host-workspace';

export interface UploadRepoOptions {
  /** 覆盖配置里的 pathPrefix */
  pathPrefix?: string;
  /** 仓库内文件名，默认用原始文件名（仍会再拼空间名+时间戳） */
  fileName?: string;
}

type ArtifactUploadResponse = {
  repo?: string;
  path?: string;
  downloadUri?: string;
  message?: string;
  errors?: { status?: number; message?: string };
};

function joinRepoObjectPath(repo: string, pathPrefix: string, fileName: string): string {
  const parts = [repo, pathPrefix, fileName]
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return parts.join('/');
}

function resolveArtifactRepoPath(
  res: ArtifactUploadResponse,
  absolutePutUrl: string,
): string {
  if (typeof res.downloadUri === 'string' && res.downloadUri.trim()) {
    return res.downloadUri.trim();
  }
  if (typeof res.path === 'string' && res.path.trim()) {
    const cfg = getUploadRepoConfig();
    const normalized = res.path.replace(/^\/+/, '');
    if (normalized.startsWith(`${cfg.repo}/`) || normalized === cfg.repo) {
      return `${cfg.baseUrl}/repo/repository/${normalized}`;
    }
    return `${cfg.baseUrl}/repo/repository/${cfg.repo}/${normalized}`;
  }
  return absolutePutUrl;
}

/** 上传至 repo 分层：`/{空间名}/{文件名}_{时间戳}.zip` */
function buildRepoUploadFileName(rawFileName: string): string {
  const workspace = getHostWorkspaceKey();
  const stem = rawFileName.replace(/^\/+/, '').replace(/\.zip$/i, '') || 'file';
  return `/${workspace}/${stem}-${Date.now()}.zip`;
}

/**
 * 上传文件到制品库，返回 downloadUri / 可访问路径。
 */
export async function uploadRepo(
  file: File,
  options?: UploadRepoOptions,
): Promise<string> {
  const sourceName = options?.fileName || file.name;
  if (!sourceName.toLowerCase().endsWith('.zip') && file.type !== 'application/zip') {
    throw new Error('仅支持上传 .zip 文件');
  }

  const fileName = buildRepoUploadFileName(sourceName);
  const contentType = file.type || 'application/zip';
  const buffer = await file.arrayBuffer();

  // 读 .env UPLOAD_REPO，走 webpack /repo 代理
  const cfg = getUploadRepoConfig();
  if (!cfg.baseUrl || !cfg.repo) {
    throw new Error('UPLOAD_REPO 未配置 baseUrl / repo');
  }
  if (!cfg.username || !cfg.password) {
    throw new Error('UPLOAD_REPO 未配置 username / password（制品库禁止匿名上传）');
  }

  const pathPrefix = options?.pathPrefix ?? cfg.pathPrefix ?? '';
  const repoPath = joinRepoObjectPath(cfg.repo, pathPrefix, fileName);
  const absoluteUrl = `${cfg.baseUrl}/repo/repository/${repoPath}`;
  const requestUrl = `/repo/repository/${repoPath}`;

  const response = await fetch(requestUrl, {
    method: 'PUT',
    headers: {
      Authorization: toBasicAuthHeader(cfg.username, cfg.password),
      'Content-Type': contentType,
    },
    body: buffer,
  });

  const text = await response.text();
  let data: ArtifactUploadResponse = {};
  try {
    data = text ? (JSON.parse(text) as ArtifactUploadResponse) : {};
  } catch {
    data = { message: text.slice(0, 200) };
  }

  if (!response.ok) {
    const msg = data.errors?.message || data.message || response.statusText;
    throw new Error(`制品库上传失败：${msg}`);
  }

  return resolveArtifactRepoPath(data, absoluteUrl);
}
