import dayjs from 'dayjs';
import { datasetApi } from '@/api/langfuse';
import type {
  AggregatedScore,
  Dataset,
  DatasetListRow,
  DatasetRun,
  DatasetRunListRow,
  RunMetricsScoreAggregate,
  TraceScore,
} from '@/types/dataset';

/** 格式化 Langfuse ISO 时间 */
export function formatDatasetTime(value?: string | null): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value;
}

/** 预览 JSON / 任意值，过长截断 */
export function previewJson(value: unknown, maxLen = 120): string {
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
export function prettyJson(value: unknown, maxLen = 8000): string | null {
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

/** 从 JSON Schema 生成新建 Item 时的示例值 */
function exampleFromJsonSchema(schema: unknown, depth = 0): unknown {
  if (schema == null || depth > 8) return undefined;

  let resolved: unknown = schema;
  if (typeof resolved === 'string') {
    const trimmed = resolved.trim();
    if (!trimmed) return undefined;
    try {
      resolved = JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }
  if (typeof resolved !== 'object' || resolved === null || Array.isArray(resolved)) {
    return undefined;
  }

  const sch = resolved as Record<string, unknown>;
  if ('const' in sch) return sch.const;
  if ('default' in sch) return sch.default;
  if ('example' in sch) return sch.example;
  if (Array.isArray(sch.examples) && sch.examples.length > 0) return sch.examples[0];

  const typeList = Array.isArray(sch.type)
    ? (sch.type as string[])
    : typeof sch.type === 'string'
      ? [sch.type]
      : [];

  if (typeList.includes('object') || sch.properties) {
    const props = (sch.properties ?? {}) as Record<string, unknown>;
    const obj: Record<string, unknown> = {};
    Object.entries(props).forEach(([key, propSchema]) => {
      const value = exampleFromJsonSchema(propSchema, depth + 1);
      obj[key] = value === undefined ? '' : value;
    });
    return obj;
  }

  if (typeList.includes('array') || sch.items) {
    if (sch.items) {
      const item = exampleFromJsonSchema(sch.items, depth + 1);
      return item === undefined ? [] : [item];
    }
    return [];
  }

  if (typeList.includes('string')) return '';
  if (typeList.includes('integer') || typeList.includes('number')) return 0;
  if (typeList.includes('boolean')) return false;
  if (typeList.includes('null')) return null;

  if (Array.isArray(sch.anyOf) && sch.anyOf[0]) {
    return exampleFromJsonSchema(sch.anyOf[0], depth + 1);
  }
  if (Array.isArray(sch.oneOf) && sch.oneOf[0]) {
    return exampleFromJsonSchema(sch.oneOf[0], depth + 1);
  }

  return undefined;
}

/** 将 dataset schema 转为新建表单初始 JSON 文本；无 schema 时返回空串 */
export function schemaToFormInitialJson(schema: unknown): string {
  const example = exampleFromJsonSchema(schema);
  if (example === undefined) return '';
  try {
    return JSON.stringify(example, null, 2);
  } catch {
    return '';
  }
}

/** Latency（秒）→ Langfuse 风格展示，如 22.47s / 1m 01s */
export function formatLatencySeconds(seconds?: number | null, scale = 2): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '-';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => `00${n}`.slice(-2);
  if (hrs > 0) return `${hrs}h ${pad(mins)}m ${pad(secs)}s`;
  if (mins > 0) return `${mins}m ${pad(secs)}s`;
  return `${seconds.toFixed(scale)}s`;
}

/** USD 金额格式化 */
export function formatUsd(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

/** Score 展示值 */
export function formatScoreValue(score: {
  value?: number | string | boolean | null;
  stringValue?: string | null;
  dataType?: string;
}): string {
  if (score.stringValue != null && score.stringValue !== '') return score.stringValue;
  if (score.value == null) return '∅';
  if (typeof score.value === 'number') {
    return Number.isInteger(score.value) ? String(score.value) : score.value.toFixed(4);
  }
  return String(score.value);
}

/** 聚合 TraceScore[] → Record<name, AggregatedScore>（NUMERIC 取平均） */
export function aggregateScoresByName(scores: TraceScore[]): Record<string, AggregatedScore> {
  const groups = new Map<string, TraceScore[]>();
  scores.forEach((s) => {
    if (!s.name) return;
    const list = groups.get(s.name) ?? [];
    list.push(s);
    groups.set(s.name, list);
  });

  const result: Record<string, AggregatedScore> = {};
  groups.forEach((list, name) => {
    const dataType = list[0]?.dataType;
    const numericValues = list
      .map((s) => (typeof s.value === 'number' ? s.value : null))
      .filter((v): v is number => v != null && Number.isFinite(v));

    if (
      dataType === 'NUMERIC' ||
      (numericValues.length > 0 && dataType !== 'CATEGORICAL' && dataType !== 'TEXT')
    ) {
      const average =
        numericValues.length > 0
          ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
          : null;
      result[name] = {
        name,
        dataType: dataType || 'NUMERIC',
        average,
        rawValue: average,
        displayValue:
          average == null
            ? '∅'
            : Number.isInteger(average)
              ? String(average)
              : average.toFixed(4),
      };
      return;
    }

    const first = list[0];
    result[name] = {
      name,
      dataType,
      average: null,
      rawValue: first?.value ?? first?.stringValue ?? null,
      displayValue: formatScoreValue(first),
    };
  });
  return result;
}

/** 尝试把字符串解析为 JSON；空串返回 undefined；非法 JSON 抛错 */
export function parseOptionalJsonOrThrow(raw: string, fieldLabel: string): unknown {
  const text = raw.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fieldLabel} JSON 格式无效`);
  }
}

/** 空串合法；非空时必须是可解析的 JSON。用于 Form.Item rules */
export function createOptionalJsonRule(invalidMessage: string) {
  return {
    validator: async (_: unknown, value: unknown) => {
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text) return;
      try {
        JSON.parse(text);
      } catch {
        throw new Error(invalidMessage);
      }
    },
  };
}

/** 名称 / 描述模糊匹配（不区分大小写，子串） */
export function matchDatasetQuery(dataset: Dataset, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (dataset.name || '').toLowerCase();
  const description = (dataset.description || '').toLowerCase();
  return name.includes(q) || description.includes(q);
}

/** 拉取全部数据集（Public API 无 search，用于前端模糊过滤） */
export async function fetchAllDatasets(): Promise<Dataset[]> {
  const all: Dataset[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const res = await datasetApi.listDatasets({ page, limit });
    const batch = res?.data ?? [];
    all.push(...batch);
    const totalPages = res?.meta?.totalPages ?? 1;
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
  }

  return all;
}

/** 补充 Items / Experiments / Last Run（当前页按需加载，走 tRPC allDatasetsMetrics） */
export async function enrichDatasetsMetrics(
  datasets: Dataset[],
): Promise<Record<string, DatasetListRow>> {
  if (!datasets.length) return {};

  // 按 projectId 分组批量请求（通常同一 workspace 只有一个 project）
  const byProject = new Map<string, Dataset[]>();
  datasets.forEach((d) => {
    const pid = d.projectId || '';
    if (!pid) return;
    const list = byProject.get(pid) ?? [];
    list.push(d);
    byProject.set(pid, list);
  });

  const result: Record<string, DatasetListRow> = {};

  await Promise.all(
    Array.from(byProject.entries()).map(async ([projectId, list]) => {
      try {
        const res = await datasetApi.allDatasetsMetrics({
          projectId,
          datasetIds: list.map((d) => d.id),
        });
        const map = new Map((res.metrics ?? []).map((m) => [m.id, m]));
        list.forEach((dataset) => {
          const m = map.get(dataset.id);
          result[dataset.id] = {
            ...dataset,
            itemCount: m?.countDatasetItems ?? 0,
            experimentCount: m?.countDatasetRuns ?? 0,
            lastRunAt: m?.lastRunAt ?? null,
            metricsLoading: false,
          };
        });
      } catch {
        list.forEach((dataset) => {
          result[dataset.id] = {
            ...dataset,
            itemCount: undefined,
            experimentCount: undefined,
            lastRunAt: null,
            metricsLoading: false,
          };
        });
      }
    }),
  );

  // 无 projectId 的兜底
  datasets.forEach((dataset) => {
    if (!result[dataset.id]) {
      result[dataset.id] = {
        ...dataset,
        itemCount: undefined,
        experimentCount: undefined,
        lastRunAt: null,
        metricsLoading: false,
      };
    }
  });

  return result;
}

/** 解析 tRPC 返回的 cost（decimal.js 常为字符串） */
function parseCostNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 将 Langfuse ScoreAggregate 映射为列表展示用 AggregatedScore */
function mapRunMetricsScores(
  scores: Record<string, RunMetricsScoreAggregate> | undefined,
): Record<string, AggregatedScore> {
  if (!scores) return {};
  const result: Record<string, AggregatedScore> = {};
  Object.entries(scores).forEach(([name, score]) => {
    const dataType = score.type;
    const average =
      typeof score.average === 'number' && Number.isFinite(score.average)
        ? score.average
        : null;
    if (
      dataType === 'NUMERIC' ||
      (average != null && dataType !== 'CATEGORICAL' && dataType !== 'TEXT')
    ) {
      result[name] = {
        name,
        dataType: dataType || 'NUMERIC',
        average,
        rawValue: average,
        displayValue:
          average == null
            ? '∅'
            : Number.isInteger(average)
              ? String(average)
              : average.toFixed(4),
      };
      return;
    }
    const first = score.values?.[0];
    result[name] = {
      name,
      dataType,
      average: null,
      rawValue: first ?? score.comment ?? null,
      displayValue:
        first == null || first === ''
          ? score.comment || '∅'
          : String(first),
    };
  });
  return result;
}

/**
 * 批量补充 Experiment 列表指标（对齐 Langfuse DatasetRunsTable）。
 * 走 tRPC datasets.runsByDatasetIdMetrics，一次拉齐 count / latency / cost / scores。
 */
export async function enrichRunsMetrics(
  runs: DatasetRun[],
  opts: { projectId: string; datasetId: string },
): Promise<DatasetRunListRow[]> {
  if (!runs.length) return [];
  if (!opts.projectId || !opts.datasetId) {
    return runs.map((run) => ({
      ...run,
      countRunItems: undefined,
      avgLatency: null,
      avgTotalCost: null,
      totalCost: null,
      runScores: {},
      runItemScores: {},
      metricsLoading: false,
    }));
  }

  try {
    const res = await datasetApi.runsByDatasetIdMetrics({
      projectId: opts.projectId,
      datasetId: opts.datasetId,
      runIds: runs.map((r) => r.id),
      filter: [],
    });
    const map = new Map((res.runs ?? []).map((m) => [m.id, m]));

    return runs.map((run) => {
      const m = map.get(run.id);
      if (!m) {
        return {
          ...run,
          countRunItems: undefined,
          avgLatency: null,
          avgTotalCost: null,
          totalCost: null,
          runScores: {},
          runItemScores: {},
          metricsLoading: false,
        };
      }
      return {
        ...run,
        countRunItems: m.countRunItems,
        avgLatency:
          typeof m.avgLatency === 'number' && Number.isFinite(m.avgLatency)
            ? m.avgLatency
            : null,
        avgTotalCost: parseCostNumber(m.avgTotalCost),
        totalCost: parseCostNumber(m.totalCost),
        // Langfuse: scores = run-item 级；runScores = run 级
        runItemScores: mapRunMetricsScores(m.scores),
        runScores: mapRunMetricsScores(m.runScores),
        metricsLoading: false,
      };
    });
  } catch {
    return runs.map((run) => ({
      ...run,
      countRunItems: undefined,
      avgLatency: null,
      avgTotalCost: null,
      totalCost: null,
      runScores: {},
      runItemScores: {},
      metricsLoading: false,
    }));
  }
}
