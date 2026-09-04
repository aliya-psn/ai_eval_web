/** 测试报告相关类型定义（基于 Langfuse Dataset Run 数据） */

import type { AggregatedScore, DatasetRunListRow, DatasetRunItemRow } from './dataset';

/** 报告列表条目（对应一条执行记录 Dataset Run） */
export interface ReportRecord extends DatasetRunListRow {
  /** 所属数据集名称 */
  datasetName: string;
  /** 数据集 ID */
  datasetId: string;
  /** 项目 ID */
  projectId: string;
}

/** 报告详情（评分汇总 + 执行项明细） */
export interface ReportDetail {
  /** 执行记录基本信息 */
  run: ReportRecord;
  /** 评分汇总（run 级 + run item 级） */
  scoreSummary: {
    runScores: Record<string, AggregatedScore>;
    runItemScores: Record<string, AggregatedScore>;
  };
  /** 执行项明细 */
  items: DatasetRunItemRow[];
  /** 执行项总数 */
  totalItems: number;
}

/** 基线对比结果 */
export interface BaselineCompareResult {
  /** 基线记录 */
  baseline: ReportRecord;
  /** 对比记录 */
  compare: ReportRecord;
  /** 评分维度对比（按评分名聚合） */
  dimensions: ScoreDimensionCompare[];
}

/** 单个评分维度对比 */
export interface ScoreDimensionCompare {
  /** 评分名称 */
  name: string;
  /** 基线值 */
  baselineValue: number | null;
  /** 对比值 */
  compareValue: number | null;
  /** 变化量（compare - baseline） */
  delta: number | null;
  /** 变化方向：up / down / flat / none */
  trend: 'up' | 'down' | 'flat' | 'none';
  /** 数据来源：run / runItem */
  source: 'run' | 'runItem';
}

/** 报告列表查询参数 */
export interface ReportListParams {
  page?: number;
  limit?: number;
  datasetName?: string;
  keyword?: string;
}
