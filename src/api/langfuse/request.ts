import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { getLangfuseBaseUrl, getLangfuseApiKey, getLangfuseEmail, getLangfusePassword } from '@/lib/appEnv';
import { getHostWorkspaceKey } from '@/lib/host-workspace';
import { encodeUtf8ToBase64 } from '@/lib/base64';
import {
  clearStoredLangfuseSession,
  getStoredLangfuseSession,
  storeLangfuseSession,
} from '@/lib/storage';

export type LangfuseHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface LangfuseRequestOptions {
  /** 以 / 开头的 Public API 路径，如 /api/public/v2/datasets */
  path: string;
  method?: LangfuseHttpMethod;
  params?: object;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  /** 为 true 时不自动 toast，由调用方处理 */
  skipErrorToast?: boolean;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const obj = payload as Record<string, unknown>;

  // Langfuse Zod 校验：{ message, error: [{ path, message }] }
  if (Array.isArray(obj.error)) {
    const details = obj.error
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item);
        const err = item as { path?: unknown; message?: string };
        const path = Array.isArray(err.path) ? err.path.filter(Boolean).join('.') : '';
        const msg = typeof err.message === 'string' ? err.message : '';
        if (path && msg) return `${path}: ${msg}`;
        return msg || path;
      })
      .filter(Boolean)
      .join('; ');
    if (details) {
      return typeof obj.message === 'string' && obj.message
        ? `${obj.message}（${details}）`
        : details;
    }
  }

  if (typeof obj.message === 'string' && obj.message) return obj.message;
  if (typeof obj.error === 'string' && obj.error) return obj.error;
  return fallback;
}

const langfuseClient = axios.create({
  baseURL: getLangfuseBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/** Public API 鉴权：按空间 key 查 API Key，注入 Basic 头 */
langfuseClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    if (url.startsWith('/api/public/')) {
      // Public API 仅用 Basic Auth，不带 session cookie；
      // 否则浏览器存的过期 next-auth cookie 会被 NextAuth 中间件优先拦截 → 401
      config.withCredentials = false;
      if (!config.headers.Authorization) {
        const workspaceKey = getHostWorkspaceKey();
        const apiKey = getLangfuseApiKey(workspaceKey);
        if (apiKey) {
          config.headers.Authorization = `Basic ${encodeUtf8ToBase64(`${apiKey.publicKey}:${apiKey.secretKey}`)}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

langfuseClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    if (!(error.config as { skipErrorToast?: boolean } | undefined)?.skipErrorToast) {
      const message = extractErrorMessage(
        error.response?.data,
        error.message || '请求失败',
      );
      toast.error(message);
    }
    return Promise.reject(error);
  },
);

/**
 * Langfuse Public API 统一入口。
 */
export async function langfuseRequest<T>(options: LangfuseRequestOptions): Promise<T> {
  const {
    path,
    method = 'GET',
    params,
    body,
    headers,
    timeout,
    skipErrorToast,
  } = options;

  const config = {
    params,
    headers,
    timeout,
    skipErrorToast,
  };

  switch (method) {
    case 'POST':
      return langfuseClient.post(path, body, config) as Promise<T>;
    case 'PUT':
      return langfuseClient.put(path, body, config) as Promise<T>;
    case 'PATCH':
      return langfuseClient.patch(path, body, config) as Promise<T>;
    case 'DELETE':
      return langfuseClient.delete(path, config) as Promise<T>;
    default:
      return langfuseClient.get(path, config) as Promise<T>;
  }
}

/** langfuse trpc 错误体 */
type TrpcErrorBody = {
  message?: string;
  error?: string | { json?: { message?: string }; message?: string };
  id?: string;
  success?: boolean;
};

/**
 * 登录状态的“有效期”缓存。
 * 说明：Langfuse 的 session cookie（next-auth.session-token）是 HttpOnly，
 * 浏览器禁止 JS 读取其 Set-Cookie 值，故不能用“手动解析 cookie 字符串”的方式复用。
 * 改为：登录成功后，浏览器经代理自动持有该 cookie（HttpOnly，host-only），
 * 后续 /api/trpc 请求由 langfuseClient（withCredentials + 同源相对路径）自动携带。
 * 这里只缓存一个“已登录时间戳”，用于避免每次请求都重复走 CSRF+凭据登录；
 * 若服务端 session 已过期，tRPC 会返回 401，再触发一次性重登。
 */
const LOGIN_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h 内不重复登录（实际以 NextAuth 30 天为准，401 兜底）
let loggedInSince = 0;
let sessionLoading: Promise<boolean> | null = null;

/** 登录成功：记录时间戳并持久化（刷新后仍可跳过重复登录） */
function markLoggedIn(): void {
  loggedInSince = Date.now();
  try {
    storeLangfuseSession(JSON.stringify({ loggedInSince }));
  } catch {
    // localStorage 不可用时忽略，仅内存缓存
  }
}

/** 清除登录缓存（登出/失效） */
function clearLoggedIn(): void {
  loggedInSince = 0;
  clearStoredLangfuseSession();
}

/** 从 localStorage 恢复登录时间戳（未过期则复用，避免刷新后重复登录） */
function restoreSessionFromStorage(): void {
  try {
    const stored = getStoredLangfuseSession();
    if (!stored) return;
    const data = JSON.parse(stored) as { loggedInSince?: unknown };
    if (
      typeof data.loggedInSince === 'number' &&
      Date.now() - data.loggedInSince < LOGIN_CACHE_TTL
    ) {
      loggedInSince = data.loggedInSince;
      return;
    }
    // 旧格式（{ cookie, expiry }）或已过期，清理
    clearStoredLangfuseSession();
  } catch {
    clearStoredLangfuseSession();
  }
}

restoreSessionFromStorage();

/**
 * 确保 Langfuse 已登录（浏览器持有 session cookie）。
 * 两步：GET /api/auth/csrf → POST /api/auth/callback/credentials，均由 dev/prod 代理同源转发。
 * 已登录缓存期内直接返回 true；并发调用由 sessionLoading 去重（只发起一次登录）。
 */
async function ensureLangfuseSession(): Promise<boolean> {
  if (loggedInSince && Date.now() - loggedInSince < LOGIN_CACHE_TTL) return true;
  if (sessionLoading) return sessionLoading;

  const email = getLangfuseEmail();
  const password = getLangfusePassword();
  if (!email || !password) return false;

  sessionLoading = (async () => {
    try {
      // 1. GET /api/auth/csrf
      const csrfRes = await fetch('/api/auth/csrf', {
        credentials: 'same-origin',
      });
      if (!csrfRes.ok) return false;
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      if (!csrfToken) return false;

      // 2. POST /api/auth/callback/credentials
      // csrf cookie 由浏览器在 GET 后自动持有，无需手动读取 Set-Cookie 注入
      const body = new URLSearchParams({
        email,
        password,
        csrfToken,
        callbackUrl: '/api/auth/session',
        json: 'true',
      });
      const loginRes = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      if (!loginRes.ok) {
        clearLoggedIn();
        return false;
      }

      // 登录成功：session cookie 已由浏览器经代理自动持有（HttpOnly，JS 读不到），
      // 仅记录时间戳，避免后续请求重复登录。
      markLoggedIn();
      return true;
    } catch {
      clearLoggedIn();
      return false;
    } finally {
      sessionLoading = null;
    }
  })();

  return sessionLoading;
}

/**
 * 直连调用 Langfuse tRPC。
 * 需登录的调用会先确保已登录（登录后由浏览器自动携带 session cookie）。
 */
/** 判断 tRPC 错误是否为 session 失效（401） */
function isSessionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { response?: { status?: number } };
  return e.response?.status === 401;
}

/** 执行一次 tRPC 请求并解包响应 */
async function doTrpcRequest<T>(
  procedure: string,
  inputPayload: { json: unknown; meta?: Record<string, unknown> },
  method: 'GET' | 'POST',
): Promise<T> {
  // 不手动注入 Cookie：session cookie 为 HttpOnly，由浏览器经 langfuseClient
  // （withCredentials + 同源相对路径）自动携带
  const headers: Record<string, string> = {
    'x-langfuse-trpc-method': method,
  };

  // 响应拦截器已解包 response.data，此处拿到的是响应体
  let res: unknown;
  if (method === 'GET') {
    // tRPC GET：input 序列化为 query parameter（GET 请求不发 body）
    const query = `?input=${encodeURIComponent(JSON.stringify(inputPayload))}`;
    res = await langfuseClient.request<unknown>({
      url: `/api/trpc/${procedure}${query}`,
      baseURL: '',
      method: 'GET',
      headers,
    });
  } else {
    // tRPC POST：input 序列化为 JSON body
    res = await langfuseClient.request<unknown>({
      url: `/api/trpc/${procedure}`,
      baseURL: '',
      method,
      data: inputPayload,
      headers,
    });
  }

  // tRPC 响应解包：{ result: { data: { json } } } 或 SuperJSON { json }
  let payload = res;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const result = obj.result as { data?: { json?: unknown } } | undefined;
    payload = result?.data?.json ?? obj.json ?? obj;
  }

  if (payload && typeof payload === 'object') {
    const p = payload as TrpcErrorBody;
    if (typeof p.error === 'string' && p.error) {
      throw new Error(p.error);
    }
    if (p.error && typeof p.error === 'object') {
      throw new Error(
        p.error.json?.message || p.error.message || p.message || 'tRPC failed',
      );
    }
    if (
      typeof p.message === 'string' &&
      /fail|error|未配置|登录失败/i.test(p.message) &&
      p.success !== true &&
      !('id' in p)
    ) {
      throw new Error(p.message);
    }
  }
  return payload as T;
}

export async function callLangfuseTrpc<T>(
  procedure: string,
  input: unknown,
  options?: {
    method?: 'GET' | 'POST';
    /** SuperJSON meta，如 Date 字段标记 */
    meta?: Record<string, unknown>;
  },
): Promise<T> {
  const method = options?.method ?? 'POST';
  let inputPayload: { json: unknown; meta?: Record<string, unknown> } = { json: input };
  if (options?.meta) inputPayload.meta = options.meta;

  // 确保已登录（未过期则直接复用，缓存 + 并发去重）
  await ensureLangfuseSession();

  try {
    return await doTrpcRequest<T>(procedure, inputPayload, method);
  } catch (error) {
    // session 失效（401）：清除登录缓存并重新登录后重试一次
    if (isSessionExpiredError(error)) {
      clearLoggedIn();
      if (await ensureLangfuseSession()) {
        return await doTrpcRequest<T>(procedure, inputPayload, method);
      }
    }
    throw error;
  }
}

export { langfuseClient };
