/** Trace 数据处理工具函数 */

import dayjs from 'dayjs';

/** 格式化 ISO 时间 */
export function formatTraceTime(value?: string | null): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value;
}

/** 耗时（秒）→ 可读字符串 */
export function formatTraceLatency(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '-';
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m ${secs}s`;
}

/** 预览 JSON / 任意值，过长截断 */
export function previewTraceJson(value: unknown, maxLen = 200): string {
  if (value == null) return '-';
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (!text || text === 'null') return '-';
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  } catch {
    return String(value);
  }
}

/** 美化 JSON，供悬浮预览；空值返回 null */
export function prettyTraceJson(value: unknown, maxLen = 8000): string | null {
  if (value == null) return null;
  try {
    const parsed =
      typeof value === 'string' ? (value.trim() ? JSON.parse(value) : null) : value;
    if (parsed == null) return null;
    const text = JSON.stringify(parsed, null, 2);
    if (!text || text === 'null') return null;
    return text.length > maxLen ? `${text.slice(0, maxLen)}\n…` : text;
  } catch {
    const text = String(value);
    if (!text.trim()) return null;
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  }
}

/** Observation 类型 → 中文标签 */
export function observationTypeLabel(type?: string): string {
  switch (type) {
    case 'GENERATION':
      return '生成';
    case 'EVENT':
      return '事件';
    case 'SPAN':
    default:
      return '跨度';
  }
}

/** Observation 类型 → 颜色（用于图标/标签） */
export function observationTypeColor(type?: string): string {
  switch (type) {
    case 'GENERATION':
      return '#8b5cf6'; // 紫色
    case 'EVENT':
      return '#10b981'; // 绿色
    case 'SPAN':
    default:
      return '#3b82f6'; // 蓝色
  }
}

/** Observation 状态 → 中文标签 */
export function observationStatusLabel(status?: string | null): string {
  switch (status) {
    case 'ERROR':
      return '错误';
    case 'PENDING':
      return '进行中';
    case 'CANCELLED':
      return '已取消';
    case 'COMPLETED':
    default:
      return '完成';
  }
}

/** Observation 状态 → 颜色 */
export function observationStatusColor(status?: string | null): string {
  switch (status) {
    case 'ERROR':
      return '#ef4444';
    case 'PENDING':
      return '#f59e0b';
    case 'CANCELLED':
      return '#94a3b8';
    case 'COMPLETED':
    default:
      return '#10b981';
  }
}

/** 从 usage 中提取 token 用量（兼容多种字段命名） */
export function extractUsageTokens(usage?: unknown): {
  input?: number;
  output?: number;
  total?: number;
} {
  if (!usage || typeof usage !== 'object') return {};
  const u = usage as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return {
    input: num(u.input) ?? num(u.inputTokens),
    output: num(u.output) ?? num(u.outputTokens),
    total: num(u.total) ?? num(u.totalTokens),
  };
}

/** 从 usage 中提取成本（USD） */
export function extractUsageCost(usage?: unknown): number | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as Record<string, unknown>;
  const v = u.totalCost ?? u.cost;
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
