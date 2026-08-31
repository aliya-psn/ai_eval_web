import { langfuseRequest } from './request';
import type {
  CreateLangfuseEvaluatorBody,
  EvaluationRule,
  EvaluatorListRow,
  LangfuseEvaluator,
  PaginatedEvaluationRules,
  PaginatedEvaluators,
} from '@/types/evaluator';

function asArray<T>(payload: unknown, key = 'data'): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && key in payload) {
    const list = (payload as Record<string, unknown>)[key];
    if (Array.isArray(list)) return list as T[];
  }
  return [];
}

/**
 * Langfuse Evaluators / Evaluation Rules（unstable Public API）
 * @see /api/public/unstable/evaluators
 * @see /api/public/unstable/evaluation-rules
 */
export const evaluatorApi = {
  /** GET /api/public/unstable/evaluation-rules — Running Evaluators */
  listEvaluationRules: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedEvaluationRules> => {
    try {
      const res = await langfuseRequest<PaginatedEvaluationRules | EvaluationRule[]>({
        path: '/api/public/unstable/evaluation-rules',
        method: 'GET',
        params,
        skipErrorToast: true,
      });
      const data = asArray<EvaluationRule>(res);
      const meta =
        res && typeof res === 'object' && 'meta' in res
          ? (res as PaginatedEvaluationRules).meta
          : { page: params?.page ?? 1, limit: params?.limit ?? 50, totalItems: data.length, totalPages: 1 };
      return { data, meta };
    } catch {
      return { data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } };
    }
  },

  /** GET /api/public/unstable/evaluators — Evaluator Library */
  listEvaluators: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedEvaluators> => {
    try {
      const res = await langfuseRequest<PaginatedEvaluators | LangfuseEvaluator[]>({
        path: '/api/public/unstable/evaluators',
        method: 'GET',
        params,
        skipErrorToast: true,
      });
      const data = asArray<LangfuseEvaluator>(res);
      const meta =
        res && typeof res === 'object' && 'meta' in res
          ? (res as PaginatedEvaluators).meta
          : { page: params?.page ?? 1, limit: params?.limit ?? 50, totalItems: data.length, totalPages: 1 };
      return { data, meta };
    } catch {
      return { data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } };
    }
  },

  /** GET /api/public/unstable/evaluators/:id */
  getEvaluator: (evaluatorId: string) =>
    langfuseRequest<LangfuseEvaluator>({
      path: `/api/public/unstable/evaluators/${encodeURIComponent(evaluatorId)}`,
      method: 'GET',
    }),

  /**
   * POST /api/public/unstable/evaluators
   * 同名项目级评估器会创建新版本；内置评估器编辑时以此创建项目级副本。
   */
  createEvaluator: (body: CreateLangfuseEvaluatorBody) =>
    langfuseRequest<LangfuseEvaluator>({
      path: '/api/public/unstable/evaluators',
      method: 'POST',
      body,
    }),

  /** DELETE /api/public/unstable/evaluators/:id — 仅项目级（自定义）可删 */
  deleteEvaluator: (evaluatorId: string) =>
    langfuseRequest<{ message: string }>({
      path: `/api/public/unstable/evaluators/${encodeURIComponent(evaluatorId)}`,
      method: 'DELETE',
    }),

  /** DELETE /api/public/unstable/evaluation-rules/:id */
  deleteEvaluationRule: (evaluationRuleId: string) =>
    langfuseRequest<{ message: string }>({
      path: `/api/public/unstable/evaluation-rules/${encodeURIComponent(evaluationRuleId)}`,
      method: 'DELETE',
    }),

  /** PATCH /api/public/unstable/evaluation-rules/:id */
  updateEvaluationRule: (
    evaluationRuleId: string,
    body: {
      name?: string;
      enabled?: boolean;
      sampling?: number;
    },
  ) =>
    langfuseRequest<EvaluationRule>({
      path: `/api/public/unstable/evaluation-rules/${encodeURIComponent(evaluationRuleId)}`,
      method: 'PATCH',
      body,
    }),

  /** 优先取 Running Evaluators；为空则回退 Evaluator Library */
  listEvaluatorRows: async (): Promise<EvaluatorListRow[]> => {
    const rulesRes = await evaluatorApi.listEvaluationRules({ page: 1, limit: 100 });
    if (rulesRes.data.length > 0) {
      return rulesRes.data.map((rule) => ({
        id: rule.id,
        scoreName: rule.name,
        status: rule.status || (rule.enabled ? 'active' : 'inactive'),
        referencedEvaluator: rule.evaluator?.name || '-',
        evalVersion: undefined,
        runsOn: rule.target || '-',
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
        source: 'rule' as const,
        raw: rule,
      }));
    }

    const evalRes = await evaluatorApi.listEvaluators({ page: 1, limit: 100 });
    return evalRes.data.map((ev) => ({
      id: ev.id,
      scoreName: ev.name,
      status: 'active',
      referencedEvaluator: ev.name,
      evalVersion: ev.version ?? null,
      runsOn: '-',
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
      source: 'evaluator' as const,
      raw: ev,
    }));
  },
};
