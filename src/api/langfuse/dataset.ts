import { langfuseRequest, callLangfuseTrpc } from './request';
import { experimentRunnerApi } from '@/api/experimentRunner';
import type {
  CreateDatasetItemRequest,
  CreateDatasetRequest,
  CreateDatasetRunItemRequest,
  CreateManyDatasetItemsRequest,
  CreateManyDatasetItemsResult,
  Dataset,
  DatasetItem,
  DatasetListParams,
  DatasetItemsParams,
  ItemsByDatasetIdParams,
  ItemsByDatasetIdResult,
  AllDatasetsMetricsParams,
  AllDatasetsMetricsResult,
  DatasetMetricsRow,
  DatasetRunItem,
  DatasetRunItemsParams,
  DatasetRunsParams,
  DatasetRunWithItems,
  ExperimentJobRunRequest,
  ExperimentJobRunResult,
  PaginatedDatasetItems,
  PaginatedDatasetRunItems,
  PaginatedDatasetRuns,
  PaginatedDatasets,
  RunsByDatasetIdMetricsParams,
  RunsByDatasetIdMetricsResult,
  DatasetRunMetricsRow,
  DeleteDatasetRunsParams,
  TraceMetrics,
  TraceScore,
  RunItemsByRunIdParams,
  RunItemsByRunIdResult,
  EnrichedDatasetRunItem,
  DatasetRunItemRow,
} from '@/types/dataset';

function mapTraceScores(scores: Array<Record<string, unknown>> | undefined): TraceScore[] {
  return (scores ?? []).map((s) => ({
    id: String(s.id ?? ''),
    name: String(s.name ?? ''),
    dataType: typeof s.dataType === 'string' ? s.dataType : undefined,
    source: typeof s.source === 'string' ? s.source : undefined,
    value: (s.value as TraceScore['value']) ?? null,
    stringValue: typeof s.stringValue === 'string' ? s.stringValue : null,
    comment: typeof s.comment === 'string' ? s.comment : null,
  }));
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    try {
      const n = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 将 tRPC EnrichedDatasetRunItem 映射为表格行（对齐 Langfuse convertRunItemToItemsByRunUiTableRow） */
function mapEnrichedRunItem(item: EnrichedDatasetRunItem): DatasetRunItemRow {
  const obsCost = toFiniteNumber(item.observation?.calculatedTotalCost);
  const traceCost = toFiniteNumber(item.trace?.totalCost);
  const latency =
    toFiniteNumber(item.observation?.latency) ??
    toFiniteNumber(item.trace?.duration);

  const scores: TraceScore[] = Object.entries(item.scores ?? {}).map(
    ([name, score]) => {
      const average =
        typeof score.average === 'number' && Number.isFinite(score.average)
          ? score.average
          : null;
      const first = score.values?.[0];
      const value =
        average ??
        (typeof first === 'number' || typeof first === 'boolean' || typeof first === 'string'
          ? first
          : null);
      return {
        id: score.id != null ? String(score.id) : name,
        name,
        dataType: score.type,
        value,
        stringValue:
          score.type === 'CATEGORICAL' || score.type === 'TEXT'
            ? first != null
              ? String(first)
              : score.comment ?? null
            : null,
        comment: score.comment ?? null,
      };
    },
  );

  const createdAt =
    typeof item.createdAt === 'string'
      ? item.createdAt
      : item.createdAt
        ? new Date(item.createdAt as unknown as string | number | Date).toISOString()
        : '';

  return {
    id: String(item.id ?? ''),
    datasetRunId: String(item.datasetRunId ?? ''),
    datasetRunName: String(item.datasetRunName ?? ''),
    datasetItemId: String(item.datasetItemId ?? ''),
    traceId: item.trace?.id ? String(item.trace.id) : '',
    observationId: item.observation?.id ? String(item.observation.id) : null,
    createdAt,
    updatedAt: createdAt,
    latency,
    totalCost: obsCost ?? traceCost,
    scores,
    metricsLoading: false,
  };
}

/**
 * Langfuse Datasets API
 * @see https://api.reference.langfuse.com/
 */
export const datasetApi = {
  /** GET 数据集列表 */
  listDatasets: (params?: DatasetListParams): Promise<PaginatedDatasets> =>
    langfuseRequest({
      path: '/api/public/v2/datasets',
      method: 'GET',
      params,
    }),

  /** GET 数据集详情 */
  getDataset: (datasetName: string): Promise<Dataset> =>
    langfuseRequest({
      path: `/api/public/v2/datasets/${encodeURIComponent(datasetName)}`,
      method: 'GET',
    }),

  /**
   * POST 数据集更新接口
   * 按 name upsert：同名则更新 description / metadata / schema
   */
  upsertDataset: (data: CreateDatasetRequest): Promise<Dataset> =>
    langfuseRequest({
      path: '/api/public/v2/datasets',
      method: 'POST',
      body: data,
    }),

  /**
   * 删除某个项目下的某个数据集
   * tRPC datasets.deleteDataset
   */
  deleteDataset: (params: {
    projectId: string;
    datasetId: string;
  }): Promise<unknown> =>
    callLangfuseTrpc('datasets.deleteDataset', {
      projectId: params.projectId,
      datasetId: params.datasetId,
    }),

  /**
   * tRPC datasets.allDatasetsMetrics
   * 批量拉取 Items / Experiments / Last Run
   */
  allDatasetsMetrics: async (
    params: AllDatasetsMetricsParams,
  ): Promise<AllDatasetsMetricsResult> => {
    if (!params.datasetIds.length) return { metrics: [] };
    const res = await callLangfuseTrpc<AllDatasetsMetricsResult>(
      'datasets.allDatasetsMetrics',
      {
        projectId: params.projectId,
        datasetIds: params.datasetIds,
      },
      { method: 'GET' },
    );
    const metrics = (res?.metrics ?? []).map((m): DatasetMetricsRow => ({
      id: String(m.id ?? ''),
      countDatasetItems: Number(m.countDatasetItems ?? 0),
      countDatasetRuns: Number(m.countDatasetRuns ?? 0),
      lastRunAt:
        m.lastRunAt == null
          ? null
          : typeof m.lastRunAt === 'string'
            ? m.lastRunAt
            : new Date(m.lastRunAt as unknown as string | number | Date).toISOString(),
    }));
    return { metrics };
  },

  /**
   * tRPC datasets.runsByDatasetIdMetrics
   * 批量拉取 Experiment 列表指标 补全字段：（count / latency / cost / scores）
   */
  runsByDatasetIdMetrics: async (
    params: RunsByDatasetIdMetricsParams,
  ): Promise<RunsByDatasetIdMetricsResult> => {
    if (!params.runIds.length) return { runs: [] };
    const res = await callLangfuseTrpc<RunsByDatasetIdMetricsResult>(
      'datasets.runsByDatasetIdMetrics',
      {
        projectId: params.projectId,
        datasetId: params.datasetId,
        runIds: params.runIds,
        filter: params.filter ?? [],
      },
      { method: 'GET' },
    );
    const runs = (res?.runs ?? []).map((m): DatasetRunMetricsRow => ({
      id: String(m.id ?? ''),
      name: typeof m.name === 'string' ? m.name : undefined,
      countRunItems:
        m.countRunItems == null ? undefined : Number(m.countRunItems),
      avgTotalCost: m.avgTotalCost ?? null,
      totalCost: m.totalCost ?? null,
      avgLatency:
        typeof m.avgLatency === 'number' && Number.isFinite(m.avgLatency)
          ? m.avgLatency
          : m.avgLatency == null
            ? null
            : Number(m.avgLatency),
      scores: m.scores ?? {},
      runScores: m.runScores ?? {},
    }));
    return { runs };
  },

  /**
   * CSV 批量导入某个数据集的 items
   * tRPC datasets.createManyDatasetItems
   * items 的 input / expectedOutput / metadata 须为 JSON 字符串
   */
  createManyItems: async (
    data: CreateManyDatasetItemsRequest,
  ): Promise<CreateManyDatasetItemsResult> => {
    const res = await callLangfuseTrpc<CreateManyDatasetItemsResult>(
      'datasets.createManyDatasetItems',
      data,
    );
    if (res && typeof res === 'object' && res.success === false) {
      const details = (res.validationErrors ?? [])
        .map((e) => {
          const idx = e.itemIndex != null ? `#${e.itemIndex + 1}` : '';
          const field = e.field ? ` ${e.field}` : '';
          const msgs = e.errors?.join('; ') || e.message || '';
          return `${idx}${field}: ${msgs}`.trim();
        })
        .filter(Boolean)
        .join('；');
      throw new Error(details || 'Dataset items validation failed');
    }
    return res;
  },

  /** GET /api/public/datasets/{datasetName}/runs — 某个数据集的Experiments 列表 */
  listRuns: (params: DatasetRunsParams): Promise<PaginatedDatasetRuns> => {
    const { datasetName, ...query } = params;
    return langfuseRequest({
      path: `/api/public/datasets/${encodeURIComponent(datasetName)}/runs`,
      method: 'GET',
      params: query,
    });
  },

  /** GET /api/public/datasets/{datasetName}/runs/{runName} — Experiment 详情 */
  getRun: (datasetName: string, runName: string): Promise<DatasetRunWithItems> =>
    langfuseRequest({
      path: `/api/public/datasets/${encodeURIComponent(datasetName)}/runs/${encodeURIComponent(runName)}`,
      method: 'GET',
    }),

  /**
   * DELETE /api/public/datasets/{datasetName}/runs/{runName}
   * 删除单个 Dataset Run（Experiment）及其全部 run items（不可恢复）
   */
  deleteRun: (
    datasetName: string,
    runName: string,
  ): Promise<{ message?: string }> =>
    langfuseRequest({
      path: `/api/public/datasets/${encodeURIComponent(datasetName)}/runs/${encodeURIComponent(runName)}`,
      method: 'DELETE',
    }),

  /**
   * tRPC datasets.deleteDatasetRuns
   * 批量删除 Dataset Runs（Public API 无批量删除）
   */
  deleteDatasetRuns: (params: DeleteDatasetRunsParams): Promise<unknown> =>
    callLangfuseTrpc('datasets.deleteDatasetRuns', {
      projectId: params.projectId,
      datasetId: params.datasetId,
      datasetRunIds: params.datasetRunIds,
    }),

  /** GET /api/public/dataset-run-items?datasetId=&runName= */
  listRunItems: (params: DatasetRunItemsParams): Promise<PaginatedDatasetRunItems> =>
    langfuseRequest({
      path: '/api/public/dataset-run-items',
      method: 'GET',
      params,
    }),

  /**
   * tRPC datasets.runItemsByRunId
   * 与 Langfuse Experiment 详情一致：一次返回 latency / cost / scores / trace
   * page 从 0 起
   */
  listRunItemsByRunId: async (
    params: RunItemsByRunIdParams,
  ): Promise<PaginatedDatasetRunItems & { data: DatasetRunItemRow[] }> => {
    const page = params.page ?? 0;
    const limit = params.limit ?? 20;
    const input: Record<string, unknown> = {
      projectId: params.projectId,
      datasetId: params.datasetId,
      datasetRunId: params.datasetRunId,
      filter: params.filter ?? [],
      page,
      limit,
    };
    if (params.datasetVersion != null && params.datasetVersion !== '') {
      input.datasetVersion = params.datasetVersion;
    }

    const res = await callLangfuseTrpc<RunItemsByRunIdResult>(
      'datasets.runItemsByRunId',
      input,
      { method: 'GET' },
    );

    const totalItems = res?.totalRunItems ?? 0;
    const data: DatasetRunItemRow[] = (res?.runItems ?? []).map(mapEnrichedRunItem);

    return {
      data,
      meta: {
        page: page + 1,
        limit,
        totalItems,
        totalPages: limit > 0 ? Math.ceil(totalItems / limit) : 0,
      },
    };
  },

  /**
   * GET /api/public/dataset-items?datasetName= - 数据集 items 列表
   * 注意：Public API 默认不含 ARCHIVED；列表请用 listItemsByDatasetId
   */
  listItems: (params: DatasetItemsParams): Promise<PaginatedDatasetItems> =>
    langfuseRequest({
      path: '/api/public/dataset-items',
      method: 'GET',
      params,
    }),

  /**
   * tRPC datasets.itemsByDatasetId
   * 与 Langfuse UI 一致，可查出 ARCHIVED items；page 从 0 起
   * 注意：searchQuery / version 不能传 null（Zod optional 只接受 undefined），无值时直接省略
   */
  listItemsByDatasetId: async (
    params: ItemsByDatasetIdParams,
  ): Promise<PaginatedDatasetItems> => {
    const page = params.page ?? 0;
    const limit = params.limit ?? 50;
    const input: Record<string, unknown> = {
      projectId: params.projectId,
      datasetId: params.datasetId,
      filter: params.filter ?? [],
      page,
      limit,
      searchType: params.searchType ?? ['id'],
    };
    if (params.searchQuery != null && params.searchQuery !== '') {
      input.searchQuery = params.searchQuery;
    }
    if (params.version != null && params.version !== '') {
      input.version = params.version;
    }
    const res = await callLangfuseTrpc<ItemsByDatasetIdResult>(
      'datasets.itemsByDatasetId',
      input,
      { method: 'GET' },
    );
    const totalItems = res?.totalDatasetItems ?? 0;
    return {
      data: res?.datasetItems ?? [],
      meta: {
        page: page + 1,
        limit,
        totalItems,
        totalPages: limit > 0 ? Math.ceil(totalItems / limit) : 0,
      },
    };
  },

  /** GET /api/public/dataset-items/{id}  - 数据集 item 详情 */
  getItem: (id: string): Promise<DatasetItem> =>
    langfuseRequest({
      path: `/api/public/dataset-items/${encodeURIComponent(id)}`,
      method: 'GET',
      skipErrorToast: true,
    }),

  /**
   * POST 创建数据集 items（单个）
   * 创建 / upsert Dataset Item（带 id 时为 upsert）  
   */
  createItem: (data: CreateDatasetItemRequest): Promise<DatasetItem> =>
    langfuseRequest({
      path: '/api/public/dataset-items',
      method: 'POST',
      body: data,
    }),

  /**
   * DELETE 删除某个数据集的 item
   * 删除 Dataset Item 及其全部 run items（不可恢复）
   */
  deleteItem: (id: string): Promise<{ message?: string }> =>
    langfuseRequest({
      path: `/api/public/dataset-items/${encodeURIComponent(id)}`,
      method: 'DELETE',
    }),

  /**
   * POST 执行 item
   * 创建 run item；若 run 不存在则同时创建 Dataset Run
   */
  createRunItemCopy: (data: CreateDatasetRunItemRequest): Promise<DatasetRunItem> =>
    langfuseRequest({
      path: '/api/public/dataset-run-items',
      method: 'POST',
      body: data,
    }),

  /**
   * POST /api/runner/experiment-jobs/run
   * 提交实验执行任务（testinfra-experiment-runner）
   */
  createRunItem: (data: ExperimentJobRunRequest): Promise<ExperimentJobRunResult> =>
    experimentRunnerApi.runExperimentJob(data),


  /**
   * GET /api/public/v2/scores?datasetRunId= - 给某个执行打分
   * Run-level scores（挂在 dataset run 上）
   */
  listScoresByDatasetRunId: async (datasetRunId: string): Promise<TraceScore[]> => {
    try {
      const res = await langfuseRequest<{
        data?: Array<Record<string, unknown>>;
      }>({
        path: '/api/public/v2/scores',
        method: 'GET',
        params: { datasetRunId, limit: 100 },
        skipErrorToast: true,
      });
      return mapTraceScores(res?.data);
    } catch {
      return [];
    }
  },

  /**
   * GET /api/public/traces/{traceId}?fields=core,io,metrics,scores - 获取某个 trace 详情
   * 用于补全 run item 的 latency / cost / scores / input / output
   */
  getTraceMetrics: async (traceId: string): Promise<TraceMetrics | null> => {
    try {
      const res = await langfuseRequest<{
        id: string;
        latency?: number | null;
        totalCost?: number | null;
        input?: unknown;
        output?: unknown;
        scores?: Array<Record<string, unknown>>;
      }>({
        path: `/api/public/traces/${encodeURIComponent(traceId)}`,
        method: 'GET',
        params: { fields: 'core,io,metrics,scores' },
        skipErrorToast: true,
      });
      return {
        id: res.id,
        latency: typeof res.latency === 'number' && res.latency >= 0 ? res.latency : null,
        totalCost: typeof res.totalCost === 'number' && res.totalCost >= 0 ? res.totalCost : null,
        scores: mapTraceScores(res?.scores),
        input: res.input,
        output: res.output,
      };
    } catch {
      return null;
    }
  },
};
