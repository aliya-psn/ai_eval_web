/** Langfuse Unstable Evaluators / Evaluation Rules */

export type EvaluationRuleStatus = 'active' | 'inactive' | 'paused';
export type EvaluationRuleTarget = 'trace' | 'observation' | 'experiment' | 'session' | string;
export type EvaluatorScope = 'project' | 'managed' | string;
export type EvaluatorType = string;
export type EvaluatorScoreDataType = 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL';
export type CodeEvaluatorSourceLanguage = 'PYTHON' | 'TYPESCRIPT';

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

export interface EvaluatorCategoricalScoreDefinition extends EvaluatorOutputFieldDefinition {
  categories: string[];
  shouldAllowMultipleMatches: boolean;
}

export type EvaluatorOutputDefinition =
  | {
      dataType: 'NUMERIC';
      reasoning: EvaluatorOutputFieldDefinition;
      score: EvaluatorOutputFieldDefinition;
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

export interface CreateLangfuseEvaluatorBody {
  name: string;
  type: EvaluatorType;
  prompt?: string;
  outputDefinition?: EvaluatorOutputDefinition;
  modelConfig?: EvaluatorModelConfig | null;
  sourceCode?: string;
  sourceCodeLanguage?: CodeEvaluatorSourceLanguage;
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
