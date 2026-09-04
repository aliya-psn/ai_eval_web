/** 测试报告数据服务层：封装对 Langfuse datasetApi 的调用 */

import { datasetApi } from '@/api/langfuse';
import type {
  AggregatedScore,
  DatasetRunItemRow,
  RunMetricsScoreAggregate,
} from '@/types/dataset';
import type {
  BaselineCompareResult,
  ReportDetail,
  ReportRecord,
  ScoreDimensionCompare,
} from '@/types/report';

/** 将 Langfuse ScoreAggregate 映射为 AggregatedScore（对齐 utils.mapRunMetricsScores） */
function mapRunMetricsScores(
  scores: Record<string, RunMetricsScoreAggregate> | undefined,
): Record<string, AggregatedScore> {
  if (!scores) return {};
  const result: Record<string, AggregatedScore> = {};
  Object.entries(scores).forEach(([name, score]) => {
    const dataType = score.type;
    const average =
      typeof score.average === 'number' && Number.isFinite(score.average)
        ? score.average
        : null;
    if (
      dataType === 'NUMERIC' ||
      (average != null && dataType !== 'CATEGORICAL' && dataType !== 'TEXT')
    ) {
      result[name] = {
        name,
        dataType: dataType || 'NUMERIC',
        average,
        rawValue: average,
        displayValue:
          average == null
            ? '∅'
            : Number.isInteger(average)
              ? String(average)
              : average.toFixed(4),
      };
      return;
    }
    const first = score.values?.[0];
    result[name] = {
      name,
      dataType,
      average: null,
      rawValue: first ?? score.comment ?? null,
      displayValue:
        first == null || first === ''
          ? score.comment || '∅'
          : String(first),
    };
  });
  return result;
}

/** 从 AggregatedScore 提取数值（NUMERIC 取 average） */
function toNumeric(score?: AggregatedScore): number | null {
  if (!score) return null;
  if (typeof score.average === 'number' && Number.isFinite(score.average)) {
    return score.average;
  }
  if (typeof score.rawValue === 'number' && Number.isFinite(score.rawValue)) {
    return score.rawValue;
  }
  return null;
}

/** 计算单个评分维度的对比 */
function buildDimensionCompare(
  name: string,
  baselineScore: AggregatedScore | undefined,
  compareScore: AggregatedScore | undefined,
  source: 'run' | 'runItem',
): ScoreDimensionCompare {
  const baselineValue = toNumeric(baselineScore);
  const compareValue = toNumeric(compareScore);

  let trend: ScoreDimensionCompare['trend'] = 'none';
  if (baselineValue != null && compareValue != null) {
    if (compareValue > baselineValue) trend = 'up';
    else if (compareValue < baselineValue) trend = 'down';
    else trend = 'flat';
  }

  return {
    name,
    baselineValue,
    compareValue,
    delta:
      baselineValue != null && compareValue != null
        ? Number((compareValue - baselineValue).toFixed(4))
        : null,
    trend,
    source,
  };
}

/** 合并两条记录的评分维度（run 级 + run item 级） */
function mergeDimensionNames(
  baseline: ReportRecord,
  compare: ReportRecord,
): { runNames: string[]; itemNames: string[] } {
  const runNames = new Set<string>();
  const itemNames = new Set<string>();

  [baseline, compare].forEach((r) => {
    Object.keys(r.runScores ?? {}).forEach((n) => runNames.add(n));
    Object.keys(r.runItemScores ?? {}).forEach((n) => itemNames.add(n));
  });

  return {
    runNames: Array.from(runNames).sort(),
    itemNames: Array.from(itemNames).sort(),
  };
}

export const reportService = {
  /**
   * 获取报告详情：评分汇总 + 执行项明细
   */
  async fetchReportDetail(record: ReportRecord): Promise<ReportDetail> {
    const { projectId, datasetId, id: runId } = record;

    // 评分汇总（run 级 + run item 级）
    let runScores: Record<string, AggregatedScore> = record.runScores ?? {};
    let runItemScores: Record<string, AggregatedScore> = record.runItemScores ?? {};

    if (projectId && datasetId && runId) {
      try {
        const res = await datasetApi.runsByDatasetIdMetrics({
          projectId,
          datasetId,
          runIds: [runId],
          filter: [],
        });
        const m = res.runs?.[0];
        if (m) {
          runScores = mapRunMetricsScores(m.runScores);
          runItemScores = mapRunMetricsScores(m.scores);
        }
      } catch {
        // 保留列表传入的指标
      }
    }

    // 执行项明细
    let items: DatasetRunItemRow[] = [];
    let totalItems = 0;
    if (projectId && datasetId && runId) {
      try {
        const res = await datasetApi.listRunItemsByRunId({
          projectId,
          datasetId,
          datasetRunId: runId,
          page: 0,
          limit: 100,
          filter: [],
        });
        items = res?.data ?? [];
        totalItems = res?.meta?.totalItems ?? items.length;
      } catch {
        items = [];
        totalItems = 0;
      }
    }

    return {
      run: record,
      scoreSummary: { runScores, runItemScores },
      items,
      totalItems,
    };
  },

  /**
   * 获取基线对比结果：对比两条记录的评分变化
   */
  async fetchCompareData(
    baseline: ReportRecord,
    compare: ReportRecord,
  ): Promise<BaselineCompareResult> {
    // 若缺少评分指标，尝试补充
    const [b, c] = await Promise.all([
      this.ensureMetrics(baseline),
      this.ensureMetrics(compare),
    ]);

    const { runNames, itemNames } = mergeDimensionNames(b, c);

    const runDimensions: ScoreDimensionCompare[] = runNames.map((name) =>
      buildDimensionCompare(name, b.runScores?.[name], c.runScores?.[name], 'run'),
    );
    const itemDimensions: ScoreDimensionCompare[] = itemNames.map((name) =>
      buildDimensionCompare(
        name,
        b.runItemScores?.[name],
        c.runItemScores?.[name],
        'runItem',
      ),
    );

    return {
      baseline: b,
      compare: c,
      dimensions: [...runDimensions, ...itemDimensions],
    };
  },

  /** 若记录缺少评分指标，则补充拉取 */
  async ensureMetrics(record: ReportRecord): Promise<ReportRecord> {
    const hasScores =
      (record.runScores && Object.keys(record.runScores).length > 0) ||
      (record.runItemScores && Object.keys(record.runItemScores).length > 0);
    if (hasScores || !record.projectId || !record.datasetId || !record.id) {
      return record;
    }
    try {
      const res = await datasetApi.runsByDatasetIdMetrics({
        projectId: record.projectId,
        datasetId: record.datasetId,
        runIds: [record.id],
        filter: [],
      });
      const m = res.runs?.[0];
      if (m) {
        return {
          ...record,
          runScores: mapRunMetricsScores(m.runScores),
          runItemScores: mapRunMetricsScores(m.scores),
        };
      }
    } catch {
      // 忽略
    }
    return record;
  },
};
