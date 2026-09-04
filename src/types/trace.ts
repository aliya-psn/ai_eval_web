/** Langfuse Trace 相关类型定义（对齐 Public API） */

/** Trace 列表项（GET /api/public/traces） */
export interface Trace {
  id: string;
  /** 项目 ID */
  projectId: string;
  /** Trace 名称 */
  name?: string | null;
  /** 用户标识 */
  userId?: string | null;
  /** 会话 ID */
  sessionId?: string | null;
  /** 版本 */
  version?: string | null;
  /** 输入 */
  input?: unknown;
  /** 输出 */
  output?: unknown;
  /** 元数据 */
  metadata?: unknown;
  /** 开始时间 */
  timestamp: string;
  /** 结束时间 */
  endTime?: string | null;
  /** 耗时（秒） */
  duration?: number | null;
  /** 延迟（秒） */
  latency?: number | null;
  /** 环境 */
  environment?: string | null;
  /** 总成本（USD） */
  totalCost?: number | null;
  /** 标签 */
  tags?: string[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 关联的评分 */
  scores?: TraceScore[];
  /** 使用量 */
  usage?: unknown;
}

/** Trace 评分 */
export interface TraceScore {
  id: string;
  name: string;
  dataType?: string;
  source?: string;
  value?: number | string | boolean | null;
  stringValue?: string | null;
  comment?: string | null;
}

/** Trace 列表查询参数 */
export interface TraceListParams {
  page?: number;
  limit?: number;
  /** 按名称搜索（支持多选） */
  name?: string | string[];
  /** 按用户 ID 过滤 */
  userId?: string;
  /** 按会话 ID 过滤 */
  sessionId?: string;
  /** 按标签过滤 */
  tags?: string[];
  /** 按环境过滤 */
  environment?: string;
  /** 开始时间（ISO） */
  fromTimestamp?: string;
  /** 结束时间（ISO） */
  toTimestamp?: string;
  /** 按 Trace ID 过滤 */
  traceIds?: string[];
}

/** Trace 列表分页结果 */
export interface PaginatedTraces {
  data: Trace[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Observation 类型 */
export type ObservationType = 'SPAN' | 'GENERATION' | 'EVENT';

/** Observation 状态 */
export type ObservationStatus = 'COMPLETED' | 'ERROR' | 'PENDING' | 'CANCELLED';

/** Token 用量 */
export interface ObservationUsage {
  input?: number;
  output?: number;
  total?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  unit?: string;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  [key: string]: unknown;
}

/** Observation（GET /api/public/observations） */
export interface Observation {
  id: string;
  traceId: string;
  projectId: string;
  type: ObservationType;
  name?: string | null;
  startTime: string;
  endTime?: string | null;
  /** 父 observation ID（根节点为 null） */
  parentObservationId?: string | null;
  /** 耗时（秒） */
  latency?: number | null;
  /** 成本（USD） */
  calculatedTotalCost?: number | null;
  /** 输入 */
  input?: unknown;
  /** 输出 */
  output?: unknown;
  /** 元数据 */
  metadata?: unknown;
  /** 模型名（generation） */
  model?: string | null;
  /** 使用量 */
  usage?: ObservationUsage | null;
  /** 状态 */
  status?: ObservationStatus | null;
  /** 状态消息（错误信息等） */
  statusMessage?: string | null;
  /** 层级 */
  level?: string | null;
  /** 版本 */
  version?: string | null;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 关联评分 */
  scores?: TraceScore[];
}

/** Observation 列表查询参数 */
export interface ObservationListParams {
  traceId?: string;
  name?: string;
  userId?: string;
  type?: ObservationType;
  page?: number;
  limit?: number;
}

/** Observation 分页结果 */
export interface PaginatedObservations {
  data: Observation[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

/** 树形 Observation 节点（用于详情页渲染） */
export interface ObservationNode extends Observation {
  children: ObservationNode[];
}

/** Trace 详情（GET /api/public/traces/{traceId}） */
export interface TraceDetail extends Trace {
  /** 关联的 observations（扁平） */
  observations?: Observation[];
  /** 树形 observations */
  observationTree?: ObservationNode[];
}

/** Trace 详情查询字段 */
export type TraceDetailFields =
  | 'core'
  | 'io'
  | 'metrics'
  | 'scores'
  | 'metadata'
  | 'usage'
  | 'cost';
