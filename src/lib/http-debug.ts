import type { HttpDebugRequest, HttpDebugResult } from '@/types/httpDebug';

const HTTP_URL_PATTERN = /^https?:\/\//i;

/** 浏览器直连调试请求（独立运行模式，无服务端代发） */
export async function requestHttpDebug(
  options: HttpDebugRequest,
): Promise<HttpDebugResult> {
  const {
    url: rawUrl,
    method = 'GET',
    body: reqBody,
    params,
    headers = {},
    timeout = 30000,
  } = options;

  if (!rawUrl?.trim()) return { error: 'url is required' };

  const trimmedUrl = rawUrl.trim();
  if (!HTTP_URL_PATTERN.test(trimmedUrl)) {
    return { error: 'url 非法，需以 http(s):// 开头', url: rawUrl };
  }

  let requestUrl = trimmedUrl;
  if (params && Object.keys(params).length > 0) {
    const query = Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (query) requestUrl = `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}${query}`;
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const isObjectBody = reqBody != null && typeof reqBody === 'object';
    const hasContentType = Object.keys(headers).some(
      (k) => k.toLowerCase() === 'content-type',
    );
    const body =
      method === 'GET' || reqBody == null
        ? undefined
        : isObjectBody
          ? hasContentType
            ? JSON.stringify(reqBody)
            : JSON.stringify(reqBody)
          : String(reqBody);

    const res = await fetch(requestUrl, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      // 非 JSON 响应保留原始文本
    }

    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      data,
      durationMs: Date.now() - started,
      url: res.url || requestUrl,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    const aborted = err?.name === 'AbortError';
    return {
      durationMs: Date.now() - started,
      error: aborted ? `请求超时（${timeout}ms）` : err?.message || 'request failed',
      url: requestUrl,
    };
  } finally {
    clearTimeout(timer);
  }
}
