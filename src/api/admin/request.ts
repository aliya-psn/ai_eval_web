import axios, { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { getAdminApiBase, getAdminServerType } from '@/lib/appEnv';

export type AdminHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface AdminRequestOptions {
  path: string;
  method?: AdminHttpMethod;
  params?: object;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  /**
   * 响应类型。
   * - json（默认）：解包 ResponseBase
   * - blob：文件下载，axios 直接返回 Blob
   */
  responseType?: 'json' | 'blob';
}

const isFormDataBody = (body: unknown): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData;

/** 解包 ResponseBase{code,message,data}；业务失败时 toast 并抛错 */
function unwrapAdminResponse<T>(body: unknown): T {
  if (
    body &&
    typeof body === 'object' &&
    'code' in body &&
    'data' in body &&
    !('id' in body && 'name' in body)
  ) {
    const { code, message, data } = body as {
      code: string | number;
      message?: string;
      data: T;
    };
    if (code !== 0 && code !== '0' && code !== 200 && code !== '200') {
      const msg = message || '请求失败';
      toast.error(msg);
      throw new Error(msg);
    }
    return data;
  }
  return body as T;
}

const adminClient = axios.create({
  baseURL: getAdminApiBase(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Server-Type': getAdminServerType(),
  },
});

adminClient.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') {
      return response.data;
    }
    return unwrapAdminResponse(response.data);
  },
  (error: AxiosError<{ message?: string; data?: unknown; code?: string | number }>) => {
    const detail =
      typeof error.response?.data?.data === 'string' ? error.response.data.data : '';
    const message =
      detail ||
      error.response?.data?.message ||
      error.message ||
      '请求失败';
    toast.error(message);
    return Promise.reject(error);
  },
);

/** axios 直连（同源代理无 CORS） */
async function requestViaClient<T>(options: AdminRequestOptions): Promise<T> {
  const {
    path,
    method = 'GET',
    params,
    body,
    headers,
    timeout,
    responseType,
  } = options;

  const isFormData = isFormDataBody(body);
  const config = {
    params,
    headers: isFormData
      ? {
          ...headers,
          // 交给浏览器/axios 自动带 boundary，覆盖默认 application/json
          'Content-Type': undefined as unknown as string,
        }
      : headers,
    timeout,
    ...(responseType === 'blob' ? { responseType: 'blob' as const } : {}),
  };

  switch (method) {
    case 'POST':
      return adminClient.post(path, body, config) as Promise<T>;
    case 'PUT':
      return adminClient.put(path, body, config) as Promise<T>;
    case 'PATCH':
      return adminClient.patch(path, body, config) as Promise<T>;
    case 'DELETE':
      return adminClient.delete(path, config) as Promise<T>;
    default:
      return adminClient.get(path, config) as Promise<T>;
  }
}

/**
 * testinfra-admin 通用请求入口（axios 直连）
 */
export async function adminRequest<T>(options: AdminRequestOptions): Promise<T> {
  return requestViaClient<T>(options);
}

export { adminClient };
