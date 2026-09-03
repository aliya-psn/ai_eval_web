import { langfuseRequest } from './request';
import type {
  CreateLangfuseEvaluatorBody,
  EvaluationRule,
  LangfuseEvaluator,
  PaginatedEvaluationRules,
  PaginatedEvaluators,
} from '@/types/evaluator';

export interface EvaluatorListParams {
  page?: number;
  limit?: number;
}

export interface EvaluationRuleListParams {
  page?: number;
  limit?: number;
}

/**
 * Langfuse Evaluator Library / Evaluation Rules API。
 *
 * 说明：unstable 端点仅在 Langfuse Cloud 上被弃用，自托管部署不受影响，
 * 因此本项目（自托管 Langfuse）可直接使用。
 */
export const evaluatorApi = {
  /** GET 评估器列表（返回每个评估器的最新版本） */
  listEvaluators: (params?: EvaluatorListParams): Promise<PaginatedEvaluators> =>
    langfuseRequest({
      path: '/api/public/unstable/evaluators',
      params,
    }),

  /** GET 单个评估器 */
  getEvaluator: (evaluatorId: string): Promise<LangfuseEvaluator> =>
    langfuseRequest({
      path: `/api/public/unstable/evaluators/${encodeURIComponent(evaluatorId)}`,
    }),

  /** POST 创建评估器（同名则创建下一版本） */
  createEvaluator: (body: CreateLangfuseEvaluatorBody): Promise<LangfuseEvaluator> =>
    langfuseRequest({
      path: '/api/public/unstable/evaluators',
      method: 'POST',
      body,
    }),

  /** DELETE 删除评估器 */
  deleteEvaluator: (evaluatorId: string): Promise<unknown> =>
    langfuseRequest({
      path: `/api/public/unstable/evaluators/${encodeURIComponent(evaluatorId)}`,
      method: 'DELETE',
    }),

  /** GET 评估规则列表 */
  listEvaluationRules: (
    params?: EvaluationRuleListParams,
  ): Promise<PaginatedEvaluationRules> =>
    langfuseRequest({
      path: '/api/public/unstable/evaluation-rules',
      params,
    }),

  /** GET 单个评估规则 */
  getEvaluationRule: (evaluationRuleId: string): Promise<EvaluationRule> =>
    langfuseRequest({
      path: `/api/public/unstable/evaluation-rules/${encodeURIComponent(evaluationRuleId)}`,
    }),

  /** DELETE 删除评估规则 */
  deleteEvaluationRule: (evaluationRuleId: string): Promise<unknown> =>
    langfuseRequest({
      path: `/api/public/unstable/evaluation-rules/${encodeURIComponent(evaluationRuleId)}`,
      method: 'DELETE',
    }),
};
