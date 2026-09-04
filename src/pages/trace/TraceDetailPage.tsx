import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Empty, Spin, Typography } from 'antd';
import { traceService, type TraceDetailData } from '@/services/traceService';
import { PageShell } from '@/components/page/PageShell';
import { ObservationTree } from '@/components/trace/ObservationTree';
import '@/components/page/page.css';
import {
  formatTraceLatency,
  formatTraceTime,
  prettyTraceJson,
  previewTraceJson,
} from '@/utils/traceUtils';

export default function TraceDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const traceId = searchParams.get('traceId') || '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TraceDetailData | null>(null);

  const loadDetail = useCallback(async () => {
    if (!traceId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await traceService.fetchTraceDetail(traceId);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const trace = data?.trace;
  const metadataText = prettyTraceJson(trace?.metadata) || previewTraceJson(trace?.metadata, 2000);
  const inputText = prettyTraceJson(trace?.input) || previewTraceJson(trace?.input, 2000);
  const outputText = prettyTraceJson(trace?.output) || previewTraceJson(trace?.output, 2000);

  return (
    <PageShell
      title={trace?.name || traceId || 'Trace 详情'}
      onBack={() => navigate('/trace')}
      backLabel="Trace 追踪"
    >
      <Spin spinning={loading}>
        {!data && !loading ? (
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description="未找到该 Trace" />
          </div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 概览 */}
            <div className="agent-section" style={{ marginBottom: 0 }}>
              <div className="agent-section-head">
                <h2 className="agent-section-title">Trace 概览</h2>
              </div>
              <div className="agent-section-body">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 10,
                  }}
                >
                  <Metric label="Trace ID" value={traceId} mono />
                  <Metric label="开始时间" value={formatTraceTime(trace?.timestamp)} />
                  <Metric label="耗时" value={formatTraceLatency(trace?.latency)} />
                  <Metric label="观测数" value={String(data.observationTree.length)} />
                  {Object.keys(data.scoreMap).length > 0 && (
                    <Metric
                      label="评分"
                      value={Object.entries(data.scoreMap)
                        .map(([name, value]) => `${name}: ${value}`)
                        .join('  ')}
                    />
                  )}
                </div>

                {metadataText && metadataText !== '-' && (
                  <div style={{ marginTop: 12 }}>
                    <Label>元数据</Label>
                    <Typography.Paragraph
                      copyable={{ text: prettyTraceJson(trace?.metadata) || metadataText }}
                      style={{ marginBottom: 0 }}
                    >
                      <pre className="agent-experiment-json">{metadataText}</pre>
                    </Typography.Paragraph>
                  </div>
                )}
              </div>
            </div>

            {/* 输入输出 */}
            <div className="agent-section" style={{ marginBottom: 0 }}>
              <div className="agent-section-head">
                <h2 className="agent-section-title">输入 / 输出</h2>
              </div>
              <div className="agent-section-body">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 16,
                  }}
                >
                  <IoBlock label="输入" value={trace?.input} text={inputText} />
                  <IoBlock label="输出" value={trace?.output} text={outputText} />
                </div>
              </div>
            </div>

            {/* Observation 树 */}
            <div className="agent-section" style={{ marginBottom: 0 }}>
              <div className="agent-section-head">
                <h2 className="agent-section-title">Observation 树</h2>
              </div>
              <div className="agent-section-body">
                <ObservationTree tree={data.observationTree} />
              </div>
            </div>
          </div>
        ) : null}
      </Spin>
    </PageShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(9,25,64,0.55)', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #f8faff 0%, #ffffff 100%)',
        border: '1px solid var(--agent-line-soft)',
        borderRadius: 10,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontSize: 11, color: 'rgba(9,25,64,0.48)', marginBottom: 4 }}>
        {label}
      </div>
      <div
        className={mono ? 'agent-mono' : undefined}
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'rgba(9,25,64,0.9)',
          fontVariantNumeric: 'tabular-nums',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function IoBlock({
  label,
  value,
  text,
}: {
  label: string;
  value: unknown;
  text: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {text && text !== '-' ? (
        <Typography.Paragraph
          copyable={{ text: prettyTraceJson(value) || String(value) }}
          style={{ marginBottom: 0 }}
        >
          <pre className="agent-experiment-json">{text}</pre>
        </Typography.Paragraph>
      ) : (
        <span style={{ color: 'rgba(9,25,64,0.35)', fontSize: 13 }}>-</span>
      )}
    </div>
  );
}
