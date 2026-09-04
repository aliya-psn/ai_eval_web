import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Empty, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { reportService } from '@/services/reportService';
import type { ReportDetail, ReportRecord } from '@/types/report';
import type { DatasetRunItemRow } from '@/types/dataset';
import { PageShell } from '@/components/page/PageShell';
import '@/components/page/page.css';
import {
  formatDatasetTime,
  formatLatencySeconds,
  formatScoreValue,
  previewJson,
  prettyJson,
} from '@/pages/dataset/datasetManagement/utils';

/** 评分列标题：只展示第一个 `-` 之前的部分 */
function formatScoreTitle(name: string) {
  const idx = name.indexOf('-');
  return idx === -1 ? name : name.slice(0, idx);
}

/** 从 URL 参数构造 ReportRecord */
function buildRecordFromParams(
  params: URLSearchParams,
  datasetName: string,
  runName: string,
): ReportRecord {
  return {
    id: params.get('runId') || '',
    name: runName,
    datasetName,
    datasetId: params.get('datasetId') || undefined,
    projectId: params.get('projectId') || undefined,
    createdAt: '',
    updatedAt: '',
  } as ReportRecord;
}

export default function ReportDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const datasetName = searchParams.get('datasetName') || '';
  const runName = searchParams.get('runName') || '';

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ReportDetail | null>(null);

  const loadDetail = useCallback(async () => {
    if (!datasetName || !runName) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const record = buildRecordFromParams(searchParams, datasetName, runName);
      const data = await reportService.fetchReportDetail(record);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [datasetName, runName, searchParams]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const scoreNames = useMemo(() => {
    if (!detail) return [];
    const names = new Set<string>();
    Object.keys(detail.scoreSummary.runScores ?? {}).forEach((n) => names.add(n));
    Object.keys(detail.scoreSummary.runItemScores ?? {}).forEach((n) => names.add(n));
    return Array.from(names).sort();
  }, [detail]);

  const itemScoreNames = useMemo(() => {
    if (!detail) return [];
    const names = new Set<string>();
    detail.items.forEach((row) => {
      row.scores?.forEach((s) => {
        if (s.name) names.add(s.name);
      });
    });
    return Array.from(names).sort();
  }, [detail]);

  const findScore = (scores: DatasetRunItemRow['scores'], name: string) =>
    scores?.find((s) => s.name === name);

  const columns: ColumnsType<DatasetRunItemRow> = useMemo(() => {
    const base: ColumnsType<DatasetRunItemRow> = [
      {
        title: '执行ID',
        dataIndex: 'datasetItemId',
        width: 200,
        ellipsis: true,
        fixed: 'left',
        render: (id: string) => (
          <span className="agent-mono" title={id}>
            {id}
          </span>
        ),
      },
      {
        title: '执行时间',
        dataIndex: 'createdAt',
        width: 170,
        render: (v: string) => (
          <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDatasetTime(v)}
          </span>
        ),
      },
      {
        title: '耗时',
        dataIndex: 'latency',
        width: 100,
        render: (v: number | null | undefined) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatLatencySeconds(v)}
          </span>
        ),
      },
      ...itemScoreNames.map(
        (name): ColumnsType<DatasetRunItemRow>[number] => ({
          title: `# ${formatScoreTitle(name)}`,
          key: `score-${name}`,
          width: 140,
          ellipsis: true,
          render: (_, row) => {
            const score = findScore(row.scores, name);
            if (!score) {
              return <span style={{ color: 'rgba(9,25,64,0.35)' }}>∅</span>;
            }
            return (
              <span
                style={{ fontVariantNumeric: 'tabular-nums' }}
                title={score.comment || undefined}
              >
                {formatScoreValue(score)}
              </span>
            );
          },
        }),
      ),
      {
        title: 'Trace Input',
        dataIndex: 'input',
        width: 200,
        ellipsis: true,
        render: (v) => (
          <span className="agent-mono" title={previewJson(v, 2000)}>
            {previewJson(v)}
          </span>
        ),
      },
      {
        title: 'Output',
        dataIndex: 'output',
        width: 200,
        ellipsis: true,
        render: (v) => (
          <span className="agent-mono" title={previewJson(v, 2000)}>
            {previewJson(v)}
          </span>
        ),
      },
    ];
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemScoreNames]);

  if (!datasetName || !runName) {
    return (
      <PageShell title="测试报告" onBack={() => navigate('/report')}>
        <div className="agent-section">
          <Empty style={{ padding: 48 }} description="缺少执行记录信息" />
        </div>
      </PageShell>
    );
  }

  const run = detail?.run;
  const metadataText = prettyJson(run?.metadata) || previewJson(run?.metadata, 2000);

  return (
    <PageShell
      title={run?.name || runName}
      onBack={() => navigate('/report')}
      backLabel="测试报告"
    >
      <Spin spinning={loading}>
        {!detail && !loading ? (
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description="未找到该测试报告" />
          </div>
        ) : detail ? (
          <div className="agent-experiment-layout">
            {/* 基本信息 */}
            <div className="agent-section" style={{ marginBottom: 0 }}>
              <div className="agent-section-head">
                <h2 className="agent-section-title">报告信息</h2>
              </div>
              <div className="agent-section-body agent-experiment-detail-body">
                <div className="agent-experiment-field">
                  <div className="agent-experiment-field-label">数据集</div>
                  <span style={{ color: 'rgba(9,25,64,0.72)' }}>{datasetName}</span>
                </div>
                <div className="agent-experiment-field">
                  <div className="agent-experiment-field-label">创建时间</div>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDatasetTime(run?.createdAt)}
                  </span>
                </div>
                <div className="agent-experiment-field">
                  <div className="agent-experiment-field-label">执行数</div>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {detail.totalItems ?? run?.countRunItems ?? '-'}
                  </span>
                </div>
                <div className="agent-experiment-field">
                  <div className="agent-experiment-field-label">平均耗时</div>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatLatencySeconds(run?.avgLatency)}
                  </span>
                </div>
                <div className="agent-experiment-field">
                  <div className="agent-experiment-field-label">描述</div>
                  {run?.description ? (
                    <Typography.Paragraph
                      copyable
                      ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}
                      style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                    >
                      {run.description}
                    </Typography.Paragraph>
                  ) : (
                    <span style={{ color: 'rgba(9,25,64,0.45)' }}>-</span>
                  )}
                </div>
                <div className="agent-experiment-field">
                  <div className="agent-experiment-field-label">元数据</div>
                  {metadataText && metadataText !== '-' ? (
                    <Typography.Paragraph
                      copyable={{ text: prettyJson(run?.metadata) || metadataText }}
                      style={{ marginBottom: 0 }}
                    >
                      <pre className="agent-experiment-json">{metadataText}</pre>
                    </Typography.Paragraph>
                  ) : (
                    <span style={{ color: 'rgba(9,25,64,0.45)' }}>-</span>
                  )}
                </div>
              </div>
            </div>

            {/* 评分汇总 */}
            <div className="agent-section" style={{ marginBottom: 0 }}>
              <div className="agent-section-head">
                <h2 className="agent-section-title">评分汇总</h2>
              </div>
              <div className="agent-section-body">
                {scoreNames.length === 0 ? (
                  <div style={{ color: 'rgba(9,25,64,0.45)', fontSize: 13 }}>
                    暂无评分数据
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {scoreNames.map((name) => {
                      const runScore = detail.scoreSummary.runScores?.[name];
                      const itemScore = detail.scoreSummary.runItemScores?.[name];
                      const score = runScore ?? itemScore;
                      return (
                        <div
                          key={name}
                          style={{
                            border: '1px solid var(--agent-line-soft)',
                            borderRadius: 12,
                            padding: '14px 16px',
                            background:
                              'linear-gradient(145deg, #f8faff 0%, #ffffff 100%)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: 'rgba(9,25,64,0.48)',
                              marginBottom: 6,
                            }}
                          >
                            {formatScoreTitle(name)}
                          </div>
                          <div
                            style={{
                              fontSize: 24,
                              fontWeight: 700,
                              color: '#0c62ff',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {score?.displayValue ?? '∅'}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'rgba(9,25,64,0.35)',
                              marginTop: 4,
                            }}
                          >
                            {runScore ? 'Run 级' : '执行项级'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 执行项明细 */}
            <div className="agent-section" style={{ marginBottom: 0 }}>
              <div className="agent-section-head">
                <h2 className="agent-section-title">执行项明细</h2>
              </div>
              <div className="agent-section-body" style={{ paddingTop: 8 }}>
                <Table<DatasetRunItemRow>
                  rowKey="id"
                  columns={columns}
                  dataSource={detail.items}
                  scroll={{ x: 1400 }}
                  size="middle"
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (n) => `共 ${n} 条`,
                  }}
                  locale={{
                    emptyText: (
                      <Empty description="暂无执行项明细" style={{ padding: 24 }} />
                    ),
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </Spin>
    </PageShell>
  );
}
