import { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, GitBranch, Zap } from 'lucide-react';
import type { ObservationNode as ObservationNodeType } from '@/types/trace';
import {
  formatTraceLatency,
  observationStatusColor,
  observationTypeColor,
  observationTypeLabel,
} from '@/utils/traceUtils';

interface Props {
  node: ObservationNodeType;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function TypeIcon({ type }: { type?: string }) {
  const color = observationTypeColor(type);
  if (type === 'GENERATION') return <Cpu size={14} style={{ color }} />;
  if (type === 'EVENT') return <Zap size={14} style={{ color }} />;
  return <GitBranch size={14} style={{ color }} />;
}

export function ObservationNode({ node, depth, selectedId, onSelect }: Props) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const color = observationTypeColor(node.type);
  const statusColor = observationStatusColor(node.status);

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px 6px 12px',
          marginLeft: depth * 18,
          borderRadius: 8,
          cursor: 'pointer',
          background: isSelected ? 'rgba(12,98,255,0.08)' : 'transparent',
          border: isSelected ? '1px solid rgba(12,98,255,0.35)' : '1px solid transparent',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(9,25,64,0.04)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* 类型色左边框 */}
        {/* <span
          style={{
            position: 'absolute',
            left: 0,
            top: 6,
            bottom: 6,
            width: 3,
            borderRadius: 2,
            background: color,
            opacity: isSelected ? 1 : 0.7,
          }}
        /> */}
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            {expanded ? (
              <ChevronDown size={14} style={{ color: 'rgba(9,25,64,0.45)' }} />
            ) : (
              <ChevronRight size={14} style={{ color: 'rgba(9,25,64,0.45)' }} />
            )}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <TypeIcon type={node.type} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: isSelected ? 600 : 500,
            color: 'rgba(9,25,64,0.85)',
          }}
          title={node.name || node.id}
        >
          {node.name || node.id}
        </span>
        {node.status && node.status !== 'COMPLETED' ? (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: statusColor,
              flexShrink: 0,
            }}
            title={node.status}
          />
        ) : null}
        <span
          style={{
            fontSize: 11,
            color,
            background: `${color}1a`,
            padding: '1px 6px',
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          {observationTypeLabel(node.type)}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'rgba(9,25,64,0.55)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {formatTraceLatency(node.latency)}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <ObservationNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
