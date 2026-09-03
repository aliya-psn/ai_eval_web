/** Langfuse Unstable Evaluators / Evaluation Rules */

export type EvaluationRuleStatus = 'active' | 'inactive' | 'paused';
export type EvaluationRuleTarget = 'trace' | 'observation' | 'experiment' | 'session' | string;
export type EvaluatorScope = 'project' | 'managed' | string;
export type EvaluatorType = string;
export type EvaluatorScoreDataType = 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL';
export type CodeEvaluatorSourceLanguage = 'PYTHON' | 'TYPESCRIPT';

/** 评估器类型（Langfuse evaluator family type） */
export type EvaluatorFamilyType =
  | 'llm_as_judge'
  | 'code'
  | 'rule'
  | 'agent'
  | 'string'
  | 'boolean'
  | string;

/** 评估器类型展示元信息 */
export const EVALUATOR_TYPE_META: Record<
  string,
  { label: string; color: string; description: string }
> = {
  llm_as_judge: {
    label: 'LLM-as-a-judge',
    color: 'blue',
    description: '使用 LLM 模型按提示词对数据进行打分',
  },
  code: {
    label: 'Code 评估器',
    color: 'purple',
    description: '通过 Python / TypeScript 代码对数据进行评估',
  },
  rule: {
    label: '规则评估器',
    color: 'green',
    description: '基于规则 / 条件对数据进行评估',
  },
  agent: {
    label: 'Agent 评估器',
    color: 'orange',
    description: '通过 Agent 对数据进行评估',
  },
  string: {
    label: '字符串评估器',
    color: 'cyan',
    description: '基于字符串匹配对数据进行评估',
  },
  boolean: {
    label: '布尔评估器',
    color: 'geekblue',
    description: '基于布尔条件对数据进行评估',
  },
};

export function getEvaluatorTypeMeta(type?: string) {
  if (!type) return EVALUATOR_TYPE_META.llm_as_judge;
  return EVALUATOR_TYPE_META[type] ?? {
    label: type,
    color: 'default',
    description: '',
  };
}

export interface EvaluationRuleEvaluatorRef {
  id?: string;
  name: string;
  scope?: EvaluatorScope;
  type?: EvaluatorType;
}

/** GET /api/public/unstable/evaluation-rules 单条（Running Evaluators） */
export interface EvaluationRule {
  id: string;
  name: string;
  evaluator: EvaluationRuleEvaluatorRef;
  target: EvaluationRuleTarget;
  enabled: boolean;
  status: EvaluationRuleStatus;
  pausedReason?: string | null;
  pausedMessage?: string | null;
  sampling?: number;
  filter?: unknown[];
  mapping?: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEvaluationRules {
  data: EvaluationRule[];
  meta?: {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
  };
}

export interface EvaluatorOutputFieldDefinition {
  description: string;
}

export interface EvaluatorNumericScoreDefinition extends EvaluatorOutputFieldDefinition {
  minValue?: number | null;
  maxValue?: number | null;
}

export interface EvaluatorCategoricalScoreDefinition extends EvaluatorOutputFieldDefinition {
  categories: string[];
  shouldAllowMultipleMatches: boolean;
}

export type EvaluatorOutputDefinition =
  | {
      dataType: 'NUMERIC';
      reasoning: EvaluatorOutputFieldDefinition;
      score: EvaluatorNumericScoreDefinition;
    }
  | {
      dataType: 'BOOLEAN';
      reasoning: EvaluatorOutputFieldDefinition;
      score: EvaluatorOutputFieldDefinition;
    }
  | {
      dataType: 'CATEGORICAL';
      reasoning: EvaluatorOutputFieldDefinition;
      score: EvaluatorCategoricalScoreDefinition;
    };

export interface EvaluatorModelConfig {
  provider: string;
  model: string;
}

/** GET /api/public/unstable/evaluators 单条（Evaluator Library） */
export interface LangfuseEvaluator {
  id: string;
  name: string;
  version?: number;
  scope?: EvaluatorScope;
  type?: EvaluatorType;
  variables?: string[];
  evaluationRuleCount?: number;
  prompt?: string;
  outputDefinition?: EvaluatorOutputDefinition;
  modelConfig?: EvaluatorModelConfig | null;
  sourceCode?: string;
  sourceCodeLanguage?: CodeEvaluatorSourceLanguage;
  mapping?: PromptVariableMapping[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedEvaluators {
  data: LangfuseEvaluator[];
  meta?: {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
  };
}

/** 提示词变量映射（LLM-as-a-judge） */
export interface PromptVariableMapping {
  variable: string;
  source: string;
  jsonPath?: string | null;
}

export interface CreateLangfuseEvaluatorBody {
  name: string;
  type: EvaluatorType;
  prompt?: string;
  outputDefinition?: EvaluatorOutputDefinition;
  modelConfig?: EvaluatorModelConfig | null;
  sourceCode?: string;
  sourceCodeLanguage?: CodeEvaluatorSourceLanguage;
  mapping?: PromptVariableMapping[];
}

/** 向导中选中的评估器行（对齐 Running Evaluators 展示） */
export interface EvaluatorListRow {
  id: string;
  scoreName: string;
  status: string;
  referencedEvaluator: string;
  evalVersion?: number | string | null;
  runsOn?: string;
  createdAt?: string;
  updatedAt?: string;
  source: 'rule' | 'evaluator';
  raw: EvaluationRule | LangfuseEvaluator;
}
