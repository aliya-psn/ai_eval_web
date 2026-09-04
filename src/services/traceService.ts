/** Trace 数据服务层：封装对 Langfuse traceApi 的调用与数据处理 */

import { traceApi } from '@/api/langfuse/trace';
import type {
  ObservationNode,
  Trace,
  TraceDetail,
  TraceListParams,
} from '@/types/trace';

/** 列表展示用 Trace 行（附加评分聚合） */
export interface TraceListRow extends Trace {
  /** 评分聚合（按 name → 展示值） */
  scoreMap?: Record<string, string>;
  metricsLoading?: boolean;
}

/** 详情页数据：Trace 概览 + observation 树 */
export interface TraceDetailData {
  trace: TraceDetail;
  observationTree: ObservationNode[];
  /** 评分聚合 */
  scoreMap: Record<string, string>;
}

/** 从 Trace 的 scores 聚合为 name → 展示值 */
function aggregateScores(scores?: Trace['scores']): Record<string, string> {
  const map: Record<string, string> = {};
  (scores ?? []).forEach((s) => {
    if (!s.name) return;
    const value =
      s.stringValue != null && s.stringValue !== ''
        ? s.stringValue
        : s.value == null
          ? '∅'
          : String(s.value);
    map[s.name] = value;
  });
  return map;
}

export const traceService = {
  /** 获取 Trace 列表（分页） */
  async fetchTraces(params: TraceListParams): Promise<{
    rows: TraceListRow[];
    total: number;
  }> {
    const res = await traceApi.listTraces(params);
    const rows: TraceListRow[] = (res?.data ?? []).map((t) => ({
      ...t,
      scoreMap: aggregateScores(t.scores),
      metricsLoading: false,
    }));
    return { rows, total: res?.meta?.totalItems ?? rows.length };
  },

  /** 获取 Trace 详情 + observation 树 */
  async fetchTraceDetail(traceId: string): Promise<TraceDetailData> {
    const trace = await traceApi.getTrace(traceId, [
      'core',
      'io',
      'metrics',
      'scores',
      'metadata',
      'usage',
      'cost',
    ]);
    const observationTree = await traceApi.fetchObservationTree(traceId);
    return {
      trace,
      observationTree,
      scoreMap: aggregateScores(trace.scores),
    };
  },

  /** 仅获取某个 Trace 的 observation 树（独立页面用） */
  async fetchObservationTree(traceId: string): Promise<ObservationNode[]> {
    return traceApi.fetchObservationTree(traceId);
  },

  /** 删除 Trace（不可恢复） */
  async remove(traceId: string): Promise<void> {
    await traceApi.deleteTrace(traceId);
  },
};
