import { useEffect, useMemo, useState } from 'react';
import { Empty } from 'antd';
import type { ObservationNode as ObservationNodeType } from '@/types/trace';
import { ObservationNode } from './ObservationNode';
import { DetailPanel } from './DetailPanel';

interface Props {
  tree: ObservationNodeType[];
}

function findNode(
  nodes: ObservationNodeType[],
  id: string,
): ObservationNodeType | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

export function ObservationTree({ tree }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => (selectedId ? findNode(tree, selectedId) : null),
    [tree, selectedId],
  );

  // 默认选中第一条
  useEffect(() => {
    if (!selectedId && tree.length) {
      setSelectedId(tree[0].id);
    }
  }, [tree, selectedId]);

  if (!tree.length) {
    return (
      <Empty
        description="暂无 Observation 数据"
        style={{ padding: 32 }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%', minHeight: 0 }}>
      {/* 左侧：树 */}
      <div
        style={{
          width: '42%',
          minWidth: 280,
          flexShrink: 0,
          padding: 8,
          overflow: 'auto',
        }}
      >
        {tree.map((node) => (
          <ObservationNode
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {/* 右侧：选中节点详情（多标签） */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          border: '1px solid var(--agent-line-soft)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <DetailPanel observation={selected} />
      </div>
    </div>
  );
}
