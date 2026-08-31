/**
 * testinfra-experiment-runner 通用请求层。
 */
import axios, { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { getAdminServerType, getExperimentRunnerApiBase } from '@/lib/appEnv';

export type ExperimentRunnerHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ExperimentRunnerRequestOptions {
  path: string;
  method?: ExperimentRunnerHttpMethod;
  params?: object;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

/** 解包 ResponseBase{code,message,data}；业务失败时 toast 并抛错 */
function unwrapResponse<T>(body: unknown): T {
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

const runnerClient = axios.create({
  baseURL: getExperimentRunnerApiBase(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Server-Type': getAdminServerType(),
  },
});

runnerClient.interceptors.response.use(
  (response) => unwrapResponse(response.data),
  (error: AxiosError<{ message?: string; data?: string }>) => {
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

/** experiment-runner 请求入口（axios 直连） */
export async function experimentRunnerRequest<T>(
  options: ExperimentRunnerRequestOptions,
): Promise<T> {
  const { path, method = 'GET', params, body, headers, timeout } = options;
  const config = { params, headers, timeout };

  switch (method) {
    case 'POST':
      return runnerClient.post(path, body, config) as Promise<T>;
    case 'PUT':
      return runnerClient.put(path, body, config) as Promise<T>;
    case 'PATCH':
      return runnerClient.patch(path, body, config) as Promise<T>;
    case 'DELETE':
      return runnerClient.delete(path, config) as Promise<T>;
    default:
      return runnerClient.get(path, config) as Promise<T>;
  }
}
