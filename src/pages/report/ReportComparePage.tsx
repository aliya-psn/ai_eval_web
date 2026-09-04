import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Empty, Spin, Tag } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { reportService } from '@/services/reportService';
import type {
  BaselineCompareResult,
  ReportRecord,
  ScoreDimensionCompare,
} from '@/types/report';
import { PageShell } from '@/components/page/PageShell';
import '@/components/page/page.css';
import { formatDatasetTime } from '@/pages/dataset/datasetManagement/utils';

/** 从 URL 参数构造 ReportRecord */
function buildRecordFromParams(
  params: URLSearchParams,
  idx: 1 | 2,
): ReportRecord {
  return {
    id: params.get(`runId${idx}`) || '',
    name: params.get(`runName${idx}`) || '',
    datasetName: params.get(`datasetName${idx}`) || '',
    datasetId: params.get(`datasetId${idx}`) || undefined,
    projectId: params.get(`projectId${idx}`) || undefined,
    createdAt: '',
    updatedAt: '',
  } as ReportRecord;
}

/** 评分列标题：只展示第一个 `-` 之前的部分 */
function formatScoreTitle(name: string) {
  const idx = name.indexOf('-');
  return idx === -1 ? name : name.slice(0, idx);
}

/** 趋势标签 */
function TrendTag({ trend }: { trend: ScoreDimensionCompare['trend'] }) {
  if (trend === 'up') {
    return (
      <Tag color="green" icon={<ArrowUpOutlined />} style={{ marginInlineEnd: 0 }}>
        上升
      </Tag>
    );
  }
  if (trend === 'down') {
    return (
      <Tag color="red" icon={<ArrowDownOutlined />} style={{ marginInlineEnd: 0 }}>
        下降
      </Tag>
    );
  }
  if (trend === 'flat') {
    return (
      <Tag icon={<MinusOutlined />} style={{ marginInlineEnd: 0 }}>
        持平
      </Tag>
    );
  }
  return <Tag style={{ marginInlineEnd: 0 }}>无对比</Tag>;
}

/** 数值格式化 */
function formatNum(v: number | null): string {
  if (v == null) return '∅';
  return Number.isInteger(v) ? String(v) : v.toFixed(4);
}

/** 单条记录的评分对比条形图 */
function ScoreBar({
  value,
  max,
  color,
}: {
  value: number | null;
  max: number;
  color: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: 'rgba(9,25,64,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 999,
          background: color,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

export default function ReportComparePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<BaselineCompareResult | null>(null);

  const baseline = useMemo(
    () => buildRecordFromParams(searchParams, 1),
    [searchParams],
  );
  const compare = useMemo(
    () => buildRecordFromParams(searchParams, 2),
    [searchParams],
  );

  const loadCompare = useCallback(async () => {
    if (!baseline.name || !compare.name) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await reportService.fetchCompareData(baseline, compare);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [baseline, compare]);

  useEffect(() => {
    void loadCompare();
  }, [loadCompare]);

  if (!baseline.name || !compare.name) {
    return (
      <PageShell title="基线对比" onBack={() => navigate('/report')}>
        <div className="agent-section">
          <Empty style={{ padding: 48 }} description="缺少对比的执行记录信息" />
        </div>
      </PageShell>
    );
  }

  const dimensions = result?.dimensions ?? [];
  const maxValue = useMemo(() => {
    let max = 1;
    dimensions.forEach((d) => {
      if (d.baselineValue != null) max = Math.max(max, d.baselineValue);
      if (d.compareValue != null) max = Math.max(max, d.compareValue);
    });
    return max;
  }, [dimensions]);

  return (
    <PageShell
      title="基线对比"
      onBack={() => navigate('/report')}
      backLabel="测试报告"
    >
      <Spin spinning={loading}>
        {!result && !loading ? (
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description="未找到对比数据" />
          </div>
        ) : result ? (
          <div className="agent-experiment-layout">
            {/* 两条记录概览 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
              }}
            >
              {[
                { label: '基线记录', record: result.baseline, color: '#0c62ff' },
                { label: '对比记录', record: result.compare, color: '#09b866' },
              ].map(({ label, record, color }) => (
                <div
                  key={label}
                  className="agent-section"
                  style={{ marginBottom: 0 }}
                >
                  <div
                    className="agent-section-head"
                    style={{ borderBottom: 'none' }}
                  >
                    <h2 className="agent-section-title" style={{ color }}>
                      {label}
                    </h2>
                  </div>
                  <div className="agent-section-body" style={{ paddingTop: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#091940' }}>
                      {record.name}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        fontSize: 13,
                        color: 'rgba(9,25,64,0.55)',
                      }}
                    >
                      <span>数据集：{record.datasetName || '-'}</span>
                      <span>
                        创建时间：
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatDatasetTime(record.createdAt)}
                        </span>
                      </span>
                      <span>
                        执行数：
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {record.countRunItems ?? '-'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 评分维度对比 */}
            <div className="agent-section" style={{ marginBottom: 0 }}>
              <div className="agent-section-head">
                <h2 className="agent-section-title">评分维度对比</h2>
              </div>
              <div className="agent-section-body">
                {dimensions.length === 0 ? (
                  <div style={{ color: 'rgba(9,25,64,0.45)', fontSize: 13 }}>
                    两条记录暂无共同评分维度
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    {dimensions.map((d) => (
                      <div
                        key={`${d.source}-${d.name}`}
                        style={{
                          border: '1px solid var(--agent-line-soft)',
                          borderRadius: 12,
                          padding: '14px 16px',
                          background:
                            d.trend === 'up'
                              ? 'rgba(9,184,102,0.04)'
                              : d.trend === 'down'
                                ? 'rgba(207,19,34,0.04)'
                                : '#fff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            marginBottom: 12,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 650,
                                color: '#091940',
                              }}
                            >
                              {formatScoreTitle(d.name)}
                            </span>
                            <Tag
                              style={{ marginInlineEnd: 0, fontSize: 11 }}
                              color={d.source === 'run' ? 'blue' : 'purple'}
                            >
                              {d.source === 'run' ? 'Run 级' : '执行项级'}
                            </Tag>
                          </div>
                          <TrendTag trend={d.trend} />
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 16,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 12,
                                color: 'rgba(9,25,64,0.48)',
                                marginBottom: 6,
                              }}
                            >
                              <span>基线</span>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: '#0c62ff',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {formatNum(d.baselineValue)}
                              </span>
                            </div>
                            <ScoreBar
                              value={d.baselineValue}
                              max={maxValue}
                              color="#0c62ff"
                            />
                          </div>
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 12,
                                color: 'rgba(9,25,64,0.48)',
                                marginBottom: 6,
                              }}
                            >
                              <span>对比</span>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: '#09b866',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {formatNum(d.compareValue)}
                              </span>
                            </div>
                            <ScoreBar
                              value={d.compareValue}
                              max={maxValue}
                              color="#09b866"
                            />
                          </div>
                        </div>

                        {d.delta != null ? (
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 12,
                              color:
                                d.trend === 'up'
                                  ? '#09b866'
                                  : d.trend === 'down'
                                    ? '#cf1322'
                                    : 'rgba(9,25,64,0.45)',
                              fontWeight: 600,
                            }}
                          >
                            变化：{d.delta > 0 ? '+' : ''}
                            {d.delta}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Spin>
    </PageShell>
  );
}
