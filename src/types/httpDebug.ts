export interface HttpDebugRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpDebugResult {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: unknown;
  durationMs?: number;
  error?: string;
  url?: string;
}
