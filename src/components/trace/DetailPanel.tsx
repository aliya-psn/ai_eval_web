import { useMemo, useState } from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { message, Typography } from 'antd';
import type { ObservationNode as ObservationNodeType } from '@/types/trace';
import {
  extractUsageCost,
  extractUsageTokens,
  formatTraceLatency,
  formatTraceTime,
  observationStatusColor,
  observationStatusLabel,
  observationTypeLabel,
  prettyTraceJson,
} from '@/utils/traceUtils';

type TabKey = 'overview' | 'json' | 'scores' | 'usage' | 'metadata';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'json', label: 'JSON' },
  { key: 'scores', label: '评分' },
  { key: 'usage', label: '用量' },
  { key: 'metadata', label: '元数据' },
];

interface Props {
  observation: ObservationNodeType | null;
}

export function DetailPanel({ observation }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // 切换节点时重置到概览标签
  const nodeKey = observation?.id ?? '';
  const [lastNodeKey, setLastNodeKey] = useState(nodeKey);
  if (nodeKey !== lastNodeKey) {
    setLastNodeKey(nodeKey);
    setActiveTab('overview');
  }

  const jsonText = useMemo(
    () => (observation ? prettyTraceJson(observation, 20000) : null),
    [observation],
  );

  if (!observation) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 260,
          color: 'rgba(9,25,64,0.45)',
          fontSize: 13,
        }}
      >
        点击左侧节点查看详情
      </div>
    );
  }

  const statusColor = observationStatusColor(observation.status);
  const tokens = extractUsageTokens(observation.usage);
  const cost = extractUsageCost(observation.usage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* 标签栏 */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 14px',
          borderBottom: '1px solid var(--agent-line-soft)',
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: active ? 650 : 500,
                color: active ? 'var(--agent-primary)' : 'rgba(9,25,64,0.55)',
                cursor: 'pointer',
                borderBottom: active ? '2px solid var(--agent-primary)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14 }}>
        {activeTab === 'overview' && <OverviewTab observation={observation} />}
        {activeTab === 'json' && <JsonTab text={jsonText} />}
        {activeTab === 'scores' && <ScoresTab observation={observation} />}
        {activeTab === 'usage' && <UsageTab tokens={tokens} cost={cost} />}
        {activeTab === 'metadata' && <MetadataTab observation={observation} />}
      </div>

      {/* 状态角标 */}
      {observation.status && observation.status !== 'COMPLETED' ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            color: statusColor,
            background: `${statusColor}14`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
            }}
          />
          {observationStatusLabel(observation.status)}
        </div>
      ) : null}
    </div>
  );
}

function OverviewTab({ observation }: { observation: ObservationNodeType }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 650, color: 'rgba(9,25,64,0.9)' }}>
          {observation.name || observation.id}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(9,25,64,0.45)', marginTop: 2 }}>
          {observationTypeLabel(observation.type)} ·{' '}
          <span className="agent-mono">{observation.id}</span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        <Metric label="耗时" value={formatTraceLatency(observation.latency)} />
        <Metric label="开始" value={formatTraceTime(observation.startTime)} />
        <Metric label="结束" value={formatTraceTime(observation.endTime)} />
      </div>

      {observation.model && (
        <Field label="模型">
          <div style={{ fontSize: 13, color: 'rgba(9,25,64,0.85)' }}>{observation.model}</div>
        </Field>
      )}

      {observation.statusMessage && (
        <Field label="状态消息">
          <div style={{ fontSize: 13, color: '#cf1322' }}>{observation.statusMessage}</div>
        </Field>
      )}

      <IoBlock label="输入" value={observation.input} />
      <IoBlock label="输出" value={observation.output} />
    </div>
  );
}

function JsonTab({ text }: { text: string | null }) {
  if (!text) {
    return <EmptyHint text="暂无 JSON 数据" />;
  }
  return (
    <div style={{ position: 'relative' }}>
      <CopyButton text={text} />
      <pre
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 8,
          border: '1px solid var(--agent-line-soft)',
          background: '#fafbfc',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 12,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'rgba(9,25,64,0.75)',
        }}
      >
        {text}
      </pre>
    </div>
  );
}

function ScoresTab({ observation }: { observation: ObservationNodeType }) {
  const scores = observation.scores ?? [];
  if (!scores.length) {
    return <EmptyHint text="暂无评分" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {scores.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            background: 'rgba(12,98,255,0.05)',
            borderRadius: 8,
            border: '1px solid rgba(12,98,255,0.12)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(9,25,64,0.85)' }}>
              {s.name}
            </div>
            {s.comment && (
              <div style={{ fontSize: 12, color: 'rgba(9,25,64,0.5)', marginTop: 2 }}>
                {s.comment}
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--agent-primary)',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            {s.stringValue ?? s.value ?? '∅'}
          </div>
        </div>
      ))}
    </div>
  );
}

function UsageTab({
  tokens,
  cost,
}: {
  tokens: { input?: number; output?: number; total?: number };
  cost?: number;
}) {
  const hasTokens = tokens.input != null || tokens.output != null || tokens.total != null;
  if (!hasTokens && cost == null) {
    return <EmptyHint text="暂无用量数据" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        <Metric label="输入 Tokens" value={tokens.input != null ? String(tokens.input) : '-'} />
        <Metric label="输出 Tokens" value={tokens.output != null ? String(tokens.output) : '-'} />
        <Metric label="总 Tokens" value={tokens.total != null ? String(tokens.total) : '-'} />
      </div>
      {cost != null && (
        <Field label="成本（USD）">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(9,25,64,0.85)' }}>
            ${cost.toFixed(6)}
          </div>
        </Field>
      )}
    </div>
  );
}

function MetadataTab({ observation }: { observation: ObservationNodeType }) {
  const meta = observation.metadata;
  if (meta == null) {
    return <EmptyHint text="暂无元数据" />;
  }
  if (typeof meta === 'object' && !Array.isArray(meta)) {
    const entries = Object.entries(meta as Record<string, unknown>);
    if (!entries.length) return <EmptyHint text="暂无元数据" />;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              gap: 12,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--agent-line-soft)',
              background: '#fafbfc',
            }}
          >
            <div
              style={{
                width: 140,
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(9,25,64,0.55)',
                wordBreak: 'break-all',
              }}
            >
              {k}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                color: 'rgba(9,25,64,0.8)',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {typeof v === 'string' ? v : JSON.stringify(v)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <JsonTab text={prettyTraceJson(meta, 20000)} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(9,25,64,0.55)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #f8faff 0%, #ffffff 100%)',
        border: '1px solid var(--agent-line-soft)',
        borderRadius: 8,
        padding: '8px 10px',
      }}
    >
      <div style={{ fontSize: 11, color: 'rgba(9,25,64,0.48)', marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(9,25,64,0.9)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function IoBlock({ label, value }: { label: string; value: unknown }) {
  const text = prettyTraceJson(value, 4000);
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(9,25,64,0.55)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {text ? (
        <Typography.Paragraph
          copyable={{ text: prettyTraceJson(value) || String(value) }}
          style={{ marginBottom: 0 }}
        >
          <pre
            style={{
              margin: 0,
              padding: 10,
              borderRadius: 8,
              border: '1px solid var(--agent-line-soft)',
              background: '#fafbfc',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 220,
              overflow: 'auto',
              color: 'rgba(9,25,64,0.75)',
            }}
          >
            {text}
          </pre>
        </Typography.Paragraph>
      ) : (
        <span style={{ color: 'rgba(9,25,64,0.35)', fontSize: 13 }}>-</span>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        border: '1px solid var(--agent-line)',
        background: '#fff',
        color: 'rgba(9,25,64,0.6)',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      <CopyOutlined /> 复制
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '32px 0',
        textAlign: 'center',
        color: 'rgba(9,25,64,0.4)',
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}
