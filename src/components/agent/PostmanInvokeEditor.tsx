import { useState } from 'react';
import { Button, Input, InputNumber, Segmented, Select, Tabs, message } from 'antd';
import type {
  HttpAgentParameter,
  HttpContentType,
  HttpInvokeConfig,
  HttpMethod,
  HttpParamType,
} from '@/types/adminAgent';
import { requestHttpDebug } from '@/lib/http-debug';
import type { HttpDebugResult } from '@/types/httpDebug';
import {
  KeyValueEditor,
  createEmptyKvRow,
  kvRowsToRecord,
  recordToKvRows,
  type KeyValueRow,
} from './KeyValueEditor';

export type BodyInputMode = 'kv' | 'json';

export interface PostmanInvokeValue {
  method: HttpMethod;
  url: string;
  timeoutMs?: number;
  queryParams: KeyValueRow[];
  headers: KeyValueRow[];
  contentType: HttpContentType;
  bodyMode: BodyInputMode;
  bodyParams: KeyValueRow[];
  /** JSON / Raw 模式下的 Body 文本 */
  bodyJson: string;
}

const CONTENT_TYPE_HEADER: Record<HttpContentType, string> = {
  APPLICATION_JSON: 'application/json',
  APPLICATION_FORM_URLENCODED: 'application/x-www-form-urlencoded',
  TEXT_PLAIN: 'text/plain',
};

function inferParamType(value: unknown): HttpParamType {
  if (typeof value === 'number') return 'NUMBER';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (Array.isArray(value)) return 'ARRAY';
  if (value !== null && typeof value === 'object') return 'OBJECT';
  return 'STRING';
}

function valueToKvString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function coerceKvValue(value: string, type?: HttpParamType): unknown {
  if (!value.trim()) return undefined;
  if (type === 'NUMBER') return Number(value);
  if (type === 'BOOLEAN') return value === 'true';
  if (type === 'OBJECT' || type === 'ARRAY') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function objectToKvRows(
  obj?: Record<string, unknown> | null,
  withType = true,
): KeyValueRow[] {
  if (!obj || Object.keys(obj).length === 0) {
    return [createEmptyKvRow(withType)];
  }
  return Object.entries(obj).map(([key, val]) => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${key}`,
    key,
    value: valueToKvString(val),
    ...(withType ? { type: inferParamType(val) } : {}),
  }));
}

function bodyTemplateToKvRows(bodyTemplate: unknown): KeyValueRow[] {
  if (bodyTemplate == null) {
    return [createEmptyKvRow(true)];
  }
  if (typeof bodyTemplate === 'object' && !Array.isArray(bodyTemplate)) {
    return objectToKvRows(bodyTemplate as Record<string, unknown>, true);
  }
  return [
    {
      ...createEmptyKvRow(true),
      value: typeof bodyTemplate === 'string' ? bodyTemplate : JSON.stringify(bodyTemplate),
    },
  ];
}

function bodyTemplateToJsonText(bodyTemplate: unknown): string {
  if (bodyTemplate == null) return '';
  if (typeof bodyTemplate === 'string') {
    try {
      return JSON.stringify(JSON.parse(bodyTemplate), null, 2);
    } catch {
      return bodyTemplate;
    }
  }
  try {
    return JSON.stringify(bodyTemplate, null, 2);
  } catch {
    return String(bodyTemplate);
  }
}

/** Body 默认用 JSON 模式展示 */
function inferBodyMode(): BodyInputMode {
  return 'json';
}

function parseBodyJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'JSON 解析失败';
    return { ok: false, error: msg };
  }
}

function kvRowsToJsonText(rows: KeyValueRow[]): string {
  const typed = kvRowsToTypedRecord(rows);
  if (Object.keys(typed).length === 0) return '';
  return JSON.stringify(typed, null, 2);
}

function jsonTextToKvRows(text: string): KeyValueRow[] | null {
  const parsed = parseBodyJson(text);
  if (!parsed.ok) return null;
  if (parsed.value == null) return [createEmptyKvRow(true)];
  if (typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
    return objectToKvRows(parsed.value as Record<string, unknown>, true);
  }
  return null;
}

function kvRowsToTypedRecord(rows: KeyValueRow[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  rows.forEach((row) => {
    const key = row.key.trim();
    if (!key) return;
    const coerced = coerceKvValue(row.value, row.type);
    if (coerced !== undefined) {
      result[key] = coerced;
    }
  });
  return result;
}

function applyTypesToKvRows(
  rows: KeyValueRow[],
  typeByName: Map<string, HttpParamType>,
): KeyValueRow[] {
  return rows.map((row) => ({
    ...row,
    type: (row.key.trim() && typeByName.get(row.key.trim())) || row.type || 'STRING',
  }));
}

export function createDefaultPostmanInvoke(): PostmanInvokeValue {
  return {
    method: 'POST',
    url: '',
    timeoutMs: 30000,
    queryParams: [createEmptyKvRow(true)],
    headers: [createEmptyKvRow()],
    contentType: 'APPLICATION_JSON',
    bodyMode: 'json',
    bodyParams: [createEmptyKvRow(true)],
    bodyJson: '',
  };
}

export function invokeToPostmanValue(invoke?: HttpInvokeConfig | null): PostmanInvokeValue {
  const bodyTemplate = invoke?.bodyTemplate;
  return {
    method: invoke?.method || 'POST',
    url: invoke?.url || '',
    timeoutMs: invoke?.timeoutMs ?? 30000,
    queryParams: recordToKvRows(invoke?.queryParams, true),
    headers: recordToKvRows(invoke?.headers),
    contentType: invoke?.contentType || 'APPLICATION_JSON',
    bodyMode: inferBodyMode(),
    bodyParams: bodyTemplateToKvRows(bodyTemplate),
    bodyJson: bodyTemplateToJsonText(bodyTemplate),
  };
}

/** 用 agent parameters 回填 Params / Body 行的类型 */
export function applyParamTypesToInvoke(
  invoke: PostmanInvokeValue,
  parameters?: HttpAgentParameter[] | null,
): PostmanInvokeValue {
  if (!parameters?.length) return invoke;
  const typeByName = new Map(
    parameters
      .filter((p) => p.name?.trim())
      .map((p) => [p.name!.trim(), (p.type || 'STRING') as HttpParamType]),
  );
  return {
    ...invoke,
    queryParams: applyTypesToKvRows(invoke.queryParams, typeByName),
    bodyParams: applyTypesToKvRows(invoke.bodyParams, typeByName),
  };
}

/** 从 Params + Body 键值对生成 agent parameters */
export function invokeKvRowsToParameters(
  queryParams: KeyValueRow[],
  bodyParams: KeyValueRow[],
  bodyMode: BodyInputMode = 'kv',
  bodyJson = '',
): HttpAgentParameter[] {
  let resolvedBodyParams = bodyParams;
  if (bodyMode === 'json') {
    const fromJson = jsonTextToKvRows(bodyJson);
    resolvedBodyParams = fromJson ?? [];
  }

  const toParameter = (row: KeyValueRow): HttpAgentParameter => ({
    name: row.key.trim(),
    label: row.key.trim(),
    type: row.type || 'STRING',
    required: false,
    defaultValue: coerceKvValue(row.value, row.type),
    description: '',
  });

  return [...queryParams, ...resolvedBodyParams]
    .filter((row) => row.key.trim())
    .map(toParameter);
}

export function postmanValueToInvoke(value: PostmanInvokeValue): HttpInvokeConfig {
  let bodyTemplate: unknown = undefined;
  if (value.method !== 'GET') {
    if (value.bodyMode === 'json') {
      const parsed = parseBodyJson(value.bodyJson);
      if (parsed.ok) {
        bodyTemplate = parsed.value;
      } else if (value.contentType === 'TEXT_PLAIN') {
        bodyTemplate = value.bodyJson;
      } else {
        // 非法 JSON 时仍透传原文，便于保存草稿；调试时再提示
        bodyTemplate = value.bodyJson.trim() || undefined;
      }
    } else {
      const typedBody = kvRowsToTypedRecord(value.bodyParams);
      if (Object.keys(typedBody).length > 0) {
        if (value.contentType === 'TEXT_PLAIN') {
          bodyTemplate =
            Object.keys(typedBody).length === 1
              ? String(Object.values(typedBody)[0] ?? '')
              : JSON.stringify(typedBody);
        } else {
          bodyTemplate = typedBody;
        }
      }
    }
  }

  return {
    method: value.method,
    url: value.url,
    timeoutMs: value.timeoutMs,
    queryParams: kvRowsToRecord(value.queryParams),
    headers: kvRowsToRecord(value.headers),
    contentType: value.contentType,
    bodyTemplate,
  };
}

function formatDebugBody(data: unknown): string {
  if (data === undefined) return '';
  if (typeof data === 'string') {
    try {
      return JSON.stringify(JSON.parse(data), null, 2);
    } catch {
      return data;
    }
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function statusTone(status?: number): 'ok' | 'warn' | 'err' | 'mute' {
  if (status == null) return 'mute';
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 300 && status < 400) return 'warn';
  return 'err';
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#09b866',
  POST: '#0c62ff',
  PUT: '#f59e0b',
  DELETE: '#cf1322',
};

interface PostmanInvokeEditorProps {
  value: PostmanInvokeValue;
  onChange: (value: PostmanInvokeValue) => void;
  readOnly?: boolean;
  /** 是否显示 Send 调试（默认 true） */
  enableDebug?: boolean;
}

export function PostmanInvokeEditor({
  value,
  onChange,
  readOnly = false,
  enableDebug = true,
}: PostmanInvokeEditorProps) {
  const patch = (partial: Partial<PostmanInvokeValue>) => onChange({ ...value, ...partial });
  const isGet = value.method === 'GET';
  const bodyMode = value.bodyMode ?? 'kv';
  const [sending, setSending] = useState(false);
  const [debugResult, setDebugResult] = useState<HttpDebugResult | null>(null);
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');

  const bodyFieldCount =
    bodyMode === 'json'
      ? (() => {
          const parsed = parseBodyJson(value.bodyJson || '');
          if (
            parsed.ok &&
            parsed.value &&
            typeof parsed.value === 'object' &&
            !Array.isArray(parsed.value)
          ) {
            return Object.keys(parsed.value as object).length;
          }
          return value.bodyJson?.trim() ? 1 : 0;
        })()
      : value.bodyParams.filter((r) => r.key.trim()).length;

  const switchBodyMode = (mode: BodyInputMode) => {
    if (mode === bodyMode) return;
    if (mode === 'json') {
      const fromKv = kvRowsToJsonText(value.bodyParams);
      patch({
        bodyMode: 'json',
        bodyJson: fromKv || value.bodyJson || '{\n  \n}',
      });
      return;
    }

    const rows = jsonTextToKvRows(value.bodyJson || '');
    if (rows == null) {
      if ((value.bodyJson || '').trim()) {
        message.warning('JSON 根节点需为对象才能转为键值对，已保留原键值对内容');
      }
      patch({ bodyMode: 'kv' });
      return;
    }
    patch({ bodyMode: 'kv', bodyParams: rows });
  };

  const formatBodyJson = () => {
    const raw = value.bodyJson || '';
    if (!raw.trim()) {
      message.info('Body 为空，无需格式化');
      return;
    }
    const parsed = parseBodyJson(raw);
    if (parsed.ok === false) {
      message.error(`无法格式化：${parsed.error}`);
      return;
    }
    patch({ bodyJson: JSON.stringify(parsed.value, null, 2) });
  };

  const handleSend = async () => {
    const url = value.url.trim();
    if (!url) {
      message.error('请填写接口 URL');
      return;
    }

    if (
      !isGet &&
      bodyMode === 'json' &&
      value.contentType !== 'TEXT_PLAIN' &&
      (value.bodyJson || '').trim()
    ) {
      const parsed = parseBodyJson(value.bodyJson);
      if (parsed.ok === false) {
        message.error(`Body JSON 无效：${parsed.error}`);
        return;
      }
    }

    const invoke = postmanValueToInvoke({ ...value, bodyMode });
    const headers: Record<string, string> = { ...(invoke.headers || {}) };
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
    if (!isGet && !hasContentType) {
      headers['Content-Type'] = CONTENT_TYPE_HEADER[value.contentType];
    }

    setSending(true);
    setDebugResult(null);
    setResponseTab('body');
    try {
      const result = await requestHttpDebug({
        url,
        method: value.method,
        params: invoke.queryParams,
        headers,
        body: isGet ? undefined : invoke.bodyTemplate,
        timeout: value.timeoutMs ?? 30000,
      });
      setDebugResult(result);
      if (result.error && result.status == null) {
        message.error(result.error);
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '请求失败';
      setDebugResult({ error: errMsg });
      message.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="agent-postman">
      <div className="agent-postman-bar">
        <Select
          value={value.method}
          disabled={readOnly}
          style={{ width: 128 }}
          options={[
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PUT', value: 'PUT' },
            { label: 'DELETE', value: 'DELETE' },
          ]}
          onChange={(method: HttpMethod) => patch({ method })}
          labelRender={(item) => (
            <span style={{ color: METHOD_COLORS[item.value as HttpMethod], fontWeight: 700 }}>
              {item.label}
            </span>
          )}
          optionRender={(option) => (
            <span
              style={{
                color: METHOD_COLORS[option.value as HttpMethod],
                fontWeight: 700,
              }}
            >
              {option.label}
            </span>
          )}
        />
        <Input
          value={value.url}
          disabled={readOnly}
          placeholder="https://api.example.com/v1/invoke"
          className="agent-mono"
          style={{ flex: 1, marginLeft: 8 }}
          onChange={(e) => patch({ url: e.target.value })}
        />
        <InputNumber
          value={value.timeoutMs}
          disabled={readOnly}
          min={0}
          addonAfter="ms"
          style={{ width: 150, marginLeft: 8 }}
          placeholder="timeout"
          onChange={(timeoutMs) => patch({ timeoutMs: timeoutMs ?? undefined })}
        />
        {enableDebug && (
          <Button
            type="primary"
            loading={sending}
            style={{ marginLeft: 8 }}
            onClick={() => void handleSend()}
          >
            调试接口
          </Button>
        )}
      </div>

      <div className="agent-postman-body">
        <Tabs
          size="small"
          items={[
            {
              key: 'params',
              label: `Params${
                value.queryParams.filter((r) => r.key.trim()).length
                  ? ` (${value.queryParams.filter((r) => r.key.trim()).length})`
                  : ''
              }`,
              children: (
                <KeyValueEditor
                  value={value.queryParams}
                  onChange={(queryParams) => patch({ queryParams })}
                  keyPlaceholder="Query Key"
                  valuePlaceholder="Query Value"
                  readOnly={readOnly}
                  showType
                />
              ),
            },
            {
              key: 'headers',
              label: `Headers${
                value.headers.filter((r) => r.key.trim()).length
                  ? ` (${value.headers.filter((r) => r.key.trim()).length})`
                  : ''
              }`,
              children: (
                <KeyValueEditor
                  value={value.headers}
                  onChange={(headers) => patch({ headers })}
                  keyPlaceholder="Header"
                  valuePlaceholder="Value"
                  readOnly={readOnly}
                />
              ),
            },
            {
              key: 'body',
              label: `Body${bodyFieldCount ? ` (${bodyFieldCount})` : ''}`,
              disabled: isGet,
              children: isGet ? (
                <div className="agent-empty-hint" style={{ padding: 24 }}>
                  GET 请求不携带 Body
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
                  <div className="agent-postman-body-toolbar">
                    <Select
                      value={value.contentType}
                      disabled={readOnly}
                      style={{ width: 300 }}
                      options={[
                        { label: 'JSON · application/json', value: 'APPLICATION_JSON' },
                        {
                          label: 'Form · x-www-form-urlencoded',
                          value: 'APPLICATION_FORM_URLENCODED',
                        },
                        { label: 'Text · text/plain', value: 'TEXT_PLAIN' },
                      ]}
                      onChange={(contentType: HttpContentType) => patch({ contentType })}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {bodyMode === 'json' && !readOnly && (
                        <Button size="small" onClick={formatBodyJson}>
                          格式化
                        </Button>
                      )}
                      <Segmented
                        value={bodyMode}
                        disabled={readOnly}
                        options={[
                          { label: 'JSON', value: 'json' },
                          { label: '键值对', value: 'kv' },
                        ]}
                        onChange={(mode) => switchBodyMode(mode as BodyInputMode)}
                      />
                    </div>
                  </div>
                  {bodyMode === 'json' ? (
                    <Input.TextArea
                      value={value.bodyJson}
                      disabled={readOnly}
                      className="agent-mono agent-postman-body-json"
                      placeholder={'{\n  "key": "value"\n}'}
                      autoSize={{ minRows: 8, maxRows: 20 }}
                      onChange={(e) => patch({ bodyJson: e.target.value })}
                    />
                  ) : (
                    <KeyValueEditor
                      value={value.bodyParams}
                      onChange={(bodyParams) => patch({ bodyParams })}
                      keyPlaceholder="Body Key"
                      valuePlaceholder="Body Value"
                      readOnly={readOnly}
                      showType
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {enableDebug && (sending || debugResult) && (
        <div className="agent-postman-response">
          <div className="agent-postman-response-meta">
            <span className="agent-postman-response-title">Response</span>
            {debugResult?.status != null && (
              <span
                className={`agent-postman-status agent-postman-status--${statusTone(debugResult.status)}`}
              >
                {debugResult.status}
                {debugResult.statusText ? ` ${debugResult.statusText}` : ''}
              </span>
            )}
            {debugResult?.durationMs != null && (
              <span className="agent-postman-duration">{debugResult.durationMs} ms</span>
            )}
            {sending && !debugResult && (
              <span className="agent-postman-duration">请求中…</span>
            )}
            {debugResult?.error && debugResult.status == null && (
              <span className="agent-postman-status agent-postman-status--err">
                {debugResult.error}
              </span>
            )}
          </div>
          {debugResult && (
            <Tabs
              size="small"
              activeKey={responseTab}
              onChange={(key) => setResponseTab(key as 'body' | 'headers')}
              items={[
                {
                  key: 'body',
                  label: 'Body',
                  children: (
                    <pre className="agent-postman-response-pre agent-mono">
                      {debugResult.error && debugResult.data == null
                        ? debugResult.error
                        : formatDebugBody(debugResult.data) || '(empty)'}
                    </pre>
                  ),
                },
                {
                  key: 'headers',
                  label: `Headers${
                    debugResult.headers && Object.keys(debugResult.headers).length
                      ? ` (${Object.keys(debugResult.headers).length})`
                      : ''
                  }`,
                  children: (
                    <pre className="agent-postman-response-pre agent-mono">
                      {debugResult.headers && Object.keys(debugResult.headers).length
                        ? Object.entries(debugResult.headers)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join('\n')
                        : '(empty)'}
                    </pre>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}
