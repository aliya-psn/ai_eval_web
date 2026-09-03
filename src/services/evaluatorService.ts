import { evaluatorApi } from '@/api/langfuse/evaluator';
import type {
  CreateLangfuseEvaluatorBody,
  EvaluatorOutputDefinition,
  LangfuseEvaluator,
  PromptVariableMapping,
} from '@/types/evaluator';

/** 评估器类型 */
export type EvaluatorKind = 'llm_as_judge' | 'code' | 'rule' | 'agent';

/** 输出数据类型 */
export type OutputDataType = 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL';

/** 表单模型：LLM-as-a-judge */
export interface LlmJudgeFormModel {
  name: string;
  prompt: string;
  dataType: OutputDataType;
  reasoningDescription: string;
  scoreDescription: string;
  minValue?: number | null;
  maxValue?: number | null;
  categories: string[];
  shouldAllowMultipleMatches: boolean;
  provider?: string;
  model?: string;
  mapping: PromptVariableMapping[];
}

/** 表单模型：Code */
export interface CodeFormModel {
  name: string;
  sourceCode: string;
  sourceCodeLanguage: 'PYTHON' | 'TYPESCRIPT';
}

/** 表单模型：规则 */
export interface RuleFormModel {
  name: string;
  rule: string;
  dataType: OutputDataType;
  scoreDescription: string;
  categories: string[];
}

/** 表单模型：Agent */
export interface AgentFormModel {
  name: string;
  agentName: string;
  prompt: string;
  dataType: OutputDataType;
  scoreDescription: string;
  categories: string[];
}

export type EvaluatorFormModel =
  | ({ kind: 'llm_as_judge' } & LlmJudgeFormModel)
  | ({ kind: 'code' } & CodeFormModel)
  | ({ kind: 'rule' } & RuleFormModel)
  | ({ kind: 'agent' } & AgentFormModel);

/** 构建输出定义 */
function buildOutputDefinition(
  dataType: OutputDataType,
  reasoningDescription: string,
  scoreDescription: string,
  extra?: { minValue?: number | null; maxValue?: number | null; categories?: string[]; shouldAllowMultipleMatches?: boolean },
): EvaluatorOutputDefinition {
  if (dataType === 'NUMERIC') {
    return {
      dataType: 'NUMERIC',
      reasoning: { description: reasoningDescription },
      score: {
        description: scoreDescription,
        minValue: extra?.minValue ?? null,
        maxValue: extra?.maxValue ?? null,
      },
    };
  }
  if (dataType === 'BOOLEAN') {
    return {
      dataType: 'BOOLEAN',
      reasoning: { description: reasoningDescription },
      score: { description: scoreDescription },
    };
  }
  return {
    dataType: 'CATEGORICAL',
    reasoning: { description: reasoningDescription },
    score: {
      description: scoreDescription,
      categories: extra?.categories ?? [],
      shouldAllowMultipleMatches: extra?.shouldAllowMultipleMatches ?? false,
    },
  };
}

/** 将表单模型转换为 Langfuse 创建请求体 */
export function toCreateEvaluatorBody(model: EvaluatorFormModel): CreateLangfuseEvaluatorBody {
  if (model.kind === 'llm_as_judge') {
    return {
      name: model.name,
      type: 'llm_as_judge',
      prompt: model.prompt,
      outputDefinition: buildOutputDefinition(
        model.dataType,
        model.reasoningDescription,
        model.scoreDescription,
        {
          minValue: model.minValue,
          maxValue: model.maxValue,
          categories: model.categories,
          shouldAllowMultipleMatches: model.shouldAllowMultipleMatches,
        },
      ),
      modelConfig:
        model.provider || model.model
          ? { provider: model.provider || '', model: model.model || '' }
          : null,
      mapping: model.mapping?.length ? model.mapping : undefined,
    };
  }
  if (model.kind === 'code') {
    return {
      name: model.name,
      type: 'code',
      sourceCode: model.sourceCode,
      sourceCodeLanguage: model.sourceCodeLanguage,
    };
  }
  if (model.kind === 'rule') {
    return {
      name: model.name,
      type: 'rule',
      prompt: model.rule,
      outputDefinition: buildOutputDefinition(
        model.dataType,
        '规则评估说明',
        model.scoreDescription,
        { categories: model.categories },
      ),
    };
  }
  // agent
  return {
    name: model.name,
    type: 'agent',
    prompt: model.prompt,
    outputDefinition: buildOutputDefinition(
      model.dataType,
      'Agent 评估说明',
      model.scoreDescription,
      { categories: model.categories },
    ),
    modelConfig: { provider: 'agent', model: model.agentName },
  };
}

/** 将 Langfuse 评估器转换为表单模型（用于编辑回填） */
export function fromEvaluatorToForm(evaluator: LangfuseEvaluator): EvaluatorFormModel {
  const type = evaluator.type ?? 'llm_as_judge';
  const od = evaluator.outputDefinition;
  const dataType: OutputDataType =
    od?.dataType === 'BOOLEAN' || od?.dataType === 'CATEGORICAL' ? od.dataType : 'NUMERIC';

  if (type === 'code') {
    return {
      kind: 'code',
      name: evaluator.name,
      sourceCode: evaluator.sourceCode ?? '',
      sourceCodeLanguage: evaluator.sourceCodeLanguage ?? 'PYTHON',
    };
  }

  const score =
    od && 'score' in od ? (od.score as unknown as Record<string, unknown>) : undefined;
  const scoreDescription =
    score && typeof score.description === 'string' ? score.description : '';
  const categories =
    dataType === 'CATEGORICAL' && Array.isArray(score?.categories)
      ? (score.categories as string[])
      : [];
  const minValue =
    dataType === 'NUMERIC' && typeof score?.minValue === 'number'
      ? score.minValue
      : null;
  const maxValue =
    dataType === 'NUMERIC' && typeof score?.maxValue === 'number'
      ? score.maxValue
      : null;

  if (type === 'rule') {
    return {
      kind: 'rule',
      name: evaluator.name,
      rule: evaluator.prompt ?? '',
      dataType,
      scoreDescription,
      categories,
    };
  }

  if (type === 'agent') {
    return {
      kind: 'agent',
      name: evaluator.name,
      agentName: evaluator.modelConfig?.model ?? '',
      prompt: evaluator.prompt ?? '',
      dataType,
      scoreDescription,
      categories,
    };
  }

  // llm_as_judge
  return {
    kind: 'llm_as_judge',
    name: evaluator.name,
    prompt: evaluator.prompt ?? '',
    dataType,
    reasoningDescription: od?.reasoning?.description ?? '',
    scoreDescription,
    minValue,
    maxValue,
    categories,
    shouldAllowMultipleMatches:
      dataType === 'CATEGORICAL' && !!score?.shouldAllowMultipleMatches,
    provider: evaluator.modelConfig?.provider ?? '',
    model: evaluator.modelConfig?.model ?? '',
    mapping: evaluator.mapping ?? [],
  };
}

export const evaluatorService = {
  list: (params?: { page?: number; limit?: number }) =>
    evaluatorApi.listEvaluators(params),
  get: (id: string) => evaluatorApi.getEvaluator(id),
  create: (model: EvaluatorFormModel) =>
    evaluatorApi.createEvaluator(toCreateEvaluatorBody(model)),
  fromEvaluatorToForm,
  remove: (id: string) => evaluatorApi.deleteEvaluator(id),
  listRules: (params?: { page?: number; limit?: number }) =>
    evaluatorApi.listEvaluationRules(params),
  removeRule: (id: string) => evaluatorApi.deleteEvaluationRule(id),
};
