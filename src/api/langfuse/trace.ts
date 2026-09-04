import { langfuseRequest, callLangfuseTrpc } from './request';
import type {
  Observation,
  ObservationListParams,
  ObservationNode,
  PaginatedObservations,
  PaginatedTraces,
  TraceDetail,
  TraceDetailFields,
  TraceListParams,
} from '@/types/trace';

/** 将扁平 observations 构建为树形结构（按 parentObservationId 关联） */
export function buildObservationTree(
  observations: Observation[],
): ObservationNode[] {
  const nodes = new Map<string, ObservationNode>();
  observations.forEach((obs) => {
    nodes.set(obs.id, { ...obs, children: [] });
  });

  const roots: ObservationNode[] = [];
  nodes.forEach((node) => {
    const parentId = node.parentObservationId;
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 按开始时间排序
  const sortByStart = (list: ObservationNode[]) => {
    list.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    list.forEach((n) => sortByStart(n.children));
  };
  sortByStart(roots);

  return roots;
}

/**
 * Langfuse Trace API
 * @see https://api.reference.langfuse.com/
 */
export const traceApi = {
  /** GET /api/public/traces — Trace 列表（name 支持多选，多选时分别请求并合并去重） */
  listTraces: async (params?: TraceListParams): Promise<PaginatedTraces> => {
    const { name, ...rest } = params ?? {};
    if (Array.isArray(name) && name.length > 1) {
      const results = await Promise.all(
        name.map((n) =>
          langfuseRequest<PaginatedTraces>({
            path: '/api/public/traces',
            method: 'GET',
            params: { ...rest, name: n },
          }),
        ),
      );
      const seen = new Set<string>();
      const data = results
        .flatMap((r) => r?.data ?? [])
        .filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
      const limit = rest.limit ?? 20;
      return {
        data,
        meta: {
          page: rest.page ?? 1,
          limit,
          totalItems: data.length,
          totalPages: Math.ceil(data.length / limit),
        },
      };
    }
    return langfuseRequest<PaginatedTraces>({
      path: '/api/public/traces',
      method: 'GET',
      params,
    });
  },

  /**
   * tRPC projects.environmentFilterOptions
   * 获取某个项目下可用的环境筛选项
   */
  getEnvironmentFilterOptions: async (params: {
    projectId: string;
    fromTimestamp?: string;
  }): Promise<string[]> => {
    const input: Record<string, unknown> = { projectId: params.projectId };
    const meta: Record<string, unknown> = {};
    if (params.fromTimestamp) {
      input.fromTimestamp = params.fromTimestamp;
      meta.values = { fromTimestamp: ['Date'] };
    }
    // 接口返回 [{ environment: 'default' }, ...]（tRPC 已解包 result.data.json）
    const res = await callLangfuseTrpc<Array<{ environment?: string }>>(
      'projects.environmentFilterOptions',
      input,
      { method: 'GET', meta },
    );
    // 防御：接口可能返回 undefined 或非数组，统一兜底为空数组
    if (!Array.isArray(res)) return [];
    return res
      .map((item) => item?.environment)
      .filter((e): e is string => typeof e === 'string' && e.length > 0);
  },

  /**
   * tRPC traces.filterOptions
   * 获取某个项目下可用的 Trace 名称筛选项（支持按时间范围过滤）
   */
  getTraceNameFilterOptions: async (params: {
    projectId: string;
    fromTimestamp?: string;
    toTimestamp?: string;
  }): Promise<string[]> => {
    const input: Record<string, unknown> = { projectId: params.projectId };
    const metaValues: Record<string, unknown> = {};
    const timestampFilter: Array<Record<string, unknown>> = [];
    if (params.fromTimestamp) {
      timestampFilter.push({
        column: 'timestamp',
        type: 'datetime',
        operator: '>=',
        value: params.fromTimestamp,
      });
      metaValues[`timestampFilter.${timestampFilter.length - 1}.value`] = ['Date'];
    }
    if (params.toTimestamp) {
      timestampFilter.push({
        column: 'timestamp',
        type: 'datetime',
        operator: '<=',
        value: params.toTimestamp,
      });
      metaValues[`timestampFilter.${timestampFilter.length - 1}.value`] = ['Date'];
    }
    if (timestampFilter.length) {
      input.timestampFilter = timestampFilter;
    }
    // 接口返回 { name: [{ value, count }], ... }（tRPC 已解包 result.data.json）
    const res = await callLangfuseTrpc<{ name?: Array<{ value?: string }> }>(
      'traces.filterOptions',
      input,
      { method: 'GET', meta: { values: metaValues } },
    );
    if (!res || !Array.isArray(res.name)) return [];
    return res.name
      .map((item) => item?.value)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
  },

  /** GET /api/public/traces/{traceId} — Trace 详情 */
  getTrace: (
    traceId: string,
    fields?: TraceDetailFields[],
  ): Promise<TraceDetail> =>
    langfuseRequest({
      path: `/api/public/traces/${encodeURIComponent(traceId)}`,
      method: 'GET',
      params: fields?.length ? { fields: fields.join(',') } : undefined,
      skipErrorToast: true,
    }),

  /** DELETE /api/public/traces/{traceId} — 删除 Trace（不可恢复） */
  deleteTrace: (traceId: string): Promise<{ message?: string }> =>
    langfuseRequest({
      path: `/api/public/traces/${encodeURIComponent(traceId)}`,
      method: 'DELETE',
    }),

  /** GET /api/public/observations — Observation 列表 */
  listObservations: (
    params?: ObservationListParams,
  ): Promise<PaginatedObservations> =>
    langfuseRequest({
      path: '/api/public/observations',
      method: 'GET',
      params,
    }),

  /** GET /api/public/observations/{observationId} — 单个 Observation 详情 */
  getObservation: (observationId: string): Promise<Observation> =>
    langfuseRequest({
      path: `/api/public/observations/${encodeURIComponent(observationId)}`,
      method: 'GET',
      skipErrorToast: true,
    }),

  /**
   * 拉取某个 Trace 的全部 observations 并构建树。
   * 分页拉取直到取完。
   */
  async fetchObservationTree(traceId: string): Promise<ObservationNode[]> {
    const all: Observation[] = [];
    let page = 1;
    const limit = 100;
    while (true) {
      const res = await langfuseRequest<PaginatedObservations>({
        path: '/api/public/observations',
        method: 'GET',
        params: { traceId, page, limit },
        skipErrorToast: true,
      });
      const batch = res?.data ?? [];
      all.push(...batch);
      const totalPages = res?.meta?.totalPages ?? 1;
      if (page >= totalPages || batch.length === 0) break;
      page += 1;
    }
    return buildObservationTree(all);
  },
};
