/** Langfuse Dataset 相关类型（对齐 Public API） */

export type DatasetStatus = 'ACTIVE' | 'ARCHIVED';

export interface LangfuseMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string | null;
  metadata?: unknown;
  inputSchema?: unknown;
  expectedOutputSchema?: unknown;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetItem {
  id: string;
  status: DatasetStatus;
  input: unknown;
  expectedOutput: unknown;
  metadata: unknown;
  sourceTraceId?: string | null;
  sourceObservationId?: string | null;
  datasetId: string;
  datasetName: string;
  createdAt: string;
  updatedAt: string;
}

/** Langfuse UI 中的 Experiment 对应 API 的 Dataset Run */
export interface DatasetRun {
  id: string;
  name: string;
  description?: string | null;
  metadata: unknown;
  datasetId: string;
  datasetName: string;
  createdAt: string;
  updatedAt: string;
}

/** GET dataset 执行记录 单条 */
export interface DatasetRunItem {
  id: string;
  datasetRunId: string;
  datasetRunName: string;
  datasetItemId: string;
  traceId: string;
  observationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetRunWithItems extends DatasetRun {
  datasetRunItems: DatasetRunItem[];
}

/** 列表展示用：附加 Run Items / Latency / Cost / Scores 等指标 */
export interface DatasetRunListRow extends DatasetRun {
  countRunItems?: number;
  avgLatency?: number | null;
  avgTotalCost?: number | null;
  totalCost?: number | null;
  /** Run item 级 score 聚合（按 name → 展示值） */
  runItemScores?: Record<string, AggregatedScore>;
  /** Run 级 score（按 name → 展示值） */
  runScores?: Record<string, AggregatedScore>;
  metricsLoading?: boolean;
}

/** Score 聚合展示（对齐 Langfuse ScoreAggregate 简化版） */
export interface AggregatedScore {
  name: string;
  dataType?: string;
  /** NUMERIC 取 average；CATEGORICAL/TEXT 取代表值 */
  displayValue: string;
  average?: number | null;
  rawValue?: number | string | boolean | null;
}

/** 详情页 run item + trace metrics / scores / IO */
export interface DatasetRunItemRow extends DatasetRunItem {
  latency?: number | null;
  totalCost?: number | null;
  scores?: TraceScore[];
  input?: unknown;
  output?: unknown;
  expectedOutput?: unknown;
  metricsLoading?: boolean;
}

export interface TraceScore {
  id: string;
  name: string;
  dataType?: string;
  source?: string;
  value?: number | string | boolean | null;
  stringValue?: string | null;
  comment?: string | null;
}

export interface TraceMetrics {
  id: string;
  latency?: number | null;
  totalCost?: number | null;
  scores?: TraceScore[];
  input?: unknown;
  output?: unknown;
}

export interface PaginatedDatasets {
  data: Dataset[];
  meta: LangfuseMeta;
}

export interface PaginatedDatasetItems {
  data: DatasetItem[];
  meta: LangfuseMeta;
}

export interface PaginatedDatasetRuns {
  data: DatasetRun[];
  meta: LangfuseMeta;
}

export interface PaginatedDatasetRunItems {
  data: DatasetRunItem[];
  meta: LangfuseMeta;
}

export interface DatasetListParams {
  page?: number;
  limit?: number;
}

export interface DatasetItemsParams {
  datasetName: string;
  page?: number;
  limit?: number;
  sourceTraceId?: string;
  sourceObservationId?: string;
  version?: string;
}

/** tRPC datasets.itemsByDatasetId — page 从 0 起，默认不过滤 status（含 ARCHIVED） */
export interface ItemsByDatasetIdParams {
  projectId: string;
  datasetId: string;
  page?: number;
  limit?: number;
  filter?: unknown[];
  searchQuery?: string | null;
  searchType?: string[];
  version?: string | null;
}

export interface ItemsByDatasetIdResult {
  datasetItems: DatasetItem[];
  totalDatasetItems: number;
}

export interface DatasetRunsParams {
  datasetName: string;
  page?: number;
  limit?: number;
}

export interface DatasetRunItemsParams {
  datasetId: string;
  runName: string;
  page?: number;
  limit?: number;
}

export interface CreateDatasetRunItemRequest {
  runName: string;
  runDescription?: string | null;
  metadata?: unknown;
  datasetItemId: string;
  observationId?: string | null;
  traceId?: string | null;
}

/** POST /api/runner/experiment-jobs/run — 实验执行任务 */
export type ExperimentAgentType = 'HTTP_AGENT' | 'NACOS_AGENT' | string;

export interface ExperimentJobAgent {
  type: ExperimentAgentType;
  agentId?: number;
  deliveryVersionId?: number;
  code: string;
  version: string;
}

export interface ExperimentJobEvaluator {
  type?: number; // 评估器类型 1-智能体 2-LLM
  agentId?: number;
  deliveryVersionId?: number;
  namespace?: string;
  skill?: string;
  code?: string;
  version?: string;
  endpoint?: string;
}

export interface ExperimentJobRunRequest {
  workspace?: string; // Langfuse 项目名
  projectName?: string; // devops 空间 key
  datasetName: string;
  runName: string;
  runDescription?: string | null;
  agent: ExperimentJobAgent;
  evaluators?: ExperimentJobEvaluator[];
}

export interface ExperimentJobRunResult {
  jobId?: string | number;
  [key: string]: unknown;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string | null;
  metadata?: unknown;
  inputSchema?: unknown;
  expectedOutputSchema?: unknown;
}

/** POST /api/public/dataset-items — 有 id 的情况是更新 */
export interface CreateDatasetItemRequest {
  datasetName: string;
  input?: unknown;
  expectedOutput?: unknown;
  metadata?: unknown;
  id?: string | null;
  sourceTraceId?: string | null;
  sourceObservationId?: string | null;
  status?: DatasetStatus | null;
}

/** tRPC datasets.createManyDatasetItems 批量上传 items */
export interface CreateManyDatasetItemInput {
  datasetId: string;
  id?: string;
  input?: string | null;
  expectedOutput?: string | null;
  metadata?: string | null;
  sourceTraceId?: string;
  sourceObservationId?: string;
}

export interface CreateManyDatasetItemsRequest {
  projectId: string;
  items: CreateManyDatasetItemInput[];
}

export type CreateManyDatasetItemsResult =
  | { success: true }
  | {
      success: false;
      validationErrors?: Array<{
        itemIndex?: number;
        field?: string;
        errors?: string[];
        message?: string;
      }>;
    };

/** 列表展示用：在 Dataset 上附加 Items / Experiments 统计 */
export interface DatasetListRow extends Dataset {
  itemCount?: number;
  experimentCount?: number;
  lastRunAt?: string | null;
  metricsLoading?: boolean;
}

/** tRPC datasets.allDatasetsMetrics */
export interface AllDatasetsMetricsParams {
  projectId: string;
  datasetIds: string[];
}

export interface DatasetMetricsRow {
  id: string;
  countDatasetItems: number;
  countDatasetRuns: number;
  lastRunAt: string | null;
}

export interface AllDatasetsMetricsResult {
  metrics: DatasetMetricsRow[];
}

/** tRPC datasets.runsByDatasetIdMetrics — ScoreAggregate 简化 */
export interface RunMetricsScoreAggregate {
  type?: string;
  values?: Array<number | string | boolean | null>;
  average?: number | null;
  comment?: string | null;
  id?: string | null;
  hasMetadata?: boolean | null;
  timestamp?: string | null;
}

/** tRPC datasets.runsByDatasetIdMetrics 单条 run 指标 */
export interface DatasetRunMetricsRow {
  id: string;
  name?: string;
  countRunItems?: number;
  avgTotalCost?: number | string | null;
  totalCost?: number | string | null;
  avgLatency?: number | null;
  /** Run item 级 scores（Langfuse 字段名 scores） */
  scores?: Record<string, RunMetricsScoreAggregate>;
  /** Run 级 scores */
  runScores?: Record<string, RunMetricsScoreAggregate>;
}

export interface RunsByDatasetIdMetricsParams {
  projectId: string;
  datasetId: string;
  runIds: string[];
  filter?: unknown[];
}

export interface RunsByDatasetIdMetricsResult {
  runs: DatasetRunMetricsRow[];
}

/** tRPC datasets.deleteDatasetRuns */
export interface DeleteDatasetRunsParams {
  projectId: string;
  datasetId: string;
  datasetRunIds: string[];
}

/** tRPC datasets.runItemsByRunId — page 从 0 起 */
export interface RunItemsByRunIdParams {
  projectId: string;
  datasetId: string;
  datasetRunId: string;
  page?: number;
  limit?: number;
  filter?: unknown[];
  /** 仅透传（Langfuse UI 会带）；服务端 schema 可不消费 */
  datasetVersion?: string | null;
}

/** tRPC datasets.runItemsByRunId 单条（对齐 EnrichedDatasetRunItem） */
export interface EnrichedDatasetRunItem {
  id: string;
  createdAt: string;
  updatedAt?: string;
  datasetItemId: string;
  datasetItemVersion?: string | null;
  datasetRunId: string;
  datasetRunName: string;
  observation?: {
    id: string;
    latency?: number | null;
    calculatedTotalCost?: number | string | null;
  } | null;
  trace?: {
    id: string;
    duration?: number | null;
    totalCost?: number | string | null;
  } | null;
  scores?: Record<string, RunMetricsScoreAggregate>;
}

export interface RunItemsByRunIdResult {
  totalRunItems: number;
  runItems: EnrichedDatasetRunItem[];
}
