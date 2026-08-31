import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { getLangfuseBaseUrl, getLangfuseApiKey, getLangfuseEmail, getLangfusePassword } from '@/lib/appEnv';
import { getHostWorkspaceKey } from '@/lib/host-workspace';
import { encodeUtf8ToBase64 } from '@/lib/base64';

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

/**
 * 是否为业务错误体。
 * 只认通用错误形态，不依赖具体业务字段。
 */
function isLangfuseErrorBody(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const obj = body as Record<string, unknown>;

  // Public API / Zod：{ message?, error: string | array }
  const err = obj.error;
  if (typeof err === 'string' && err) return true;
  if (Array.isArray(err) && err.length > 0) return true;

  // 网关 / 运行时：{ code, message }，排除成功码
  if ('code' in obj) {
    const { code } = obj as { code: string | number };
    return code !== 200 && code !== '200' && code !== 0 && code !== '0';
  }

  return false;
}

/** Langfuse 错误体（HTTP 非 2xx 或业务错误）拦截 */
function assertLangfuseOk<T>(body: unknown): T {
  if (isLangfuseErrorBody(body)) {
    throw new Error(extractErrorMessage(body, '请求失败'));
  }
  return body as T;
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
    if (url.startsWith('/api/public/') && !config.headers.Authorization) {
      const workspaceKey = getHostWorkspaceKey();
      const apiKey = getLangfuseApiKey(workspaceKey);
      if (apiKey) {
        config.headers.Authorization = `Basic ${encodeUtf8ToBase64(`${apiKey.publicKey}:${apiKey.secretKey}`)}`;
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
 * Langfuse Public API 统一入口（axios 直连）。
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

/** Session Cookie 缓存（25 分钟有效） */
let sessionCookie: string | null = null;
let sessionExpiry = 0;
let sessionLoading: Promise<string | null> | null = null;

/**
 * NextAuth 登录拿 Session Cookie。
 * 两步：GET /api/auth/csrf → POST /api/auth/callback/credentials
 */
async function loginLangfuseSession(): Promise<string | null> {
  if (sessionCookie && Date.now() < sessionExpiry) return sessionCookie;
  if (sessionLoading) return sessionLoading;

  const email = getLangfuseEmail();
  const password = getLangfusePassword();
  if (!email || !password) return null;

  sessionLoading = (async () => {
    try {
      const base = getLangfuseBaseUrl();
      // 1. GET /api/auth/csrf
      const csrfRes = await fetch(`${base}/api/auth/csrf`, {
        credentials: 'include',
      });
      if (!csrfRes.ok) return null;
      const csrfData = (await csrfRes.json()) as { csrfToken?: string };
      const csrfToken = csrfData.csrfToken;
      if (!csrfToken) return null;

      // 取 Set-Cookie 里的 csrf-token
      const setCookieHeader = csrfRes.headers.get('set-cookie') ?? '';
      const csrfCookie = setCookieHeader.match(/csrf-token=[^;]+/i)?.[0] ?? '';

      // 2. POST /api/auth/callback/credentials
      const body = new URLSearchParams({
        email,
        password,
        csrfToken,
        callbackUrl: '/api/auth/session',
        json: 'true',
      });
      const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrfCookie,
        },
        body: body.toString(),
      });
      if (!loginRes.ok) return null;

      // 取 Set-Cookie 里的 session-token
      const loginCookieHeader = loginRes.headers.get('set-cookie') ?? '';
      const sessionMatch = loginCookieHeader.match(/next-auth\.session-token=[^;]+/i);
      if (sessionMatch) {
        sessionCookie = sessionMatch[0];
        sessionExpiry = Date.now() + 25 * 60 * 1000;
        return sessionCookie;
      }
      return null;
    } catch {
      return null;
    } finally {
      sessionLoading = null;
    }
  })();

  return sessionLoading;
}

/**
 * 直连调用 Langfuse tRPC。
 * 需登录 Session 的 mutation 会先做 NextAuth 登录注入 Cookie。
 */
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
  const body: { json: unknown; meta?: Record<string, unknown> } = { json: input };
  if (options?.meta) body.meta = options.meta;

  // 确保 Session Cookie 可用
  const cookie = await loginLangfuseSession();

  // 响应拦截器已解包 response.data，此处拿到的是响应体
  const res: unknown = await langfuseClient.request<unknown>({
    url: `/api/trpc/${procedure}`,
    method,
    data: body,
    headers: {
      'x-langfuse-trpc-method': method,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

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

export { langfuseClient };
