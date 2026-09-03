import { Tag } from 'antd';
import { getEvaluatorTypeMeta } from '@/types/evaluator';

export function EvaluatorTypeBadge({ type }: { type?: string }) {
  const meta = getEvaluatorTypeMeta(type);
  return (
    <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>
      {meta.label}
    </Tag>
  );
}

export default EvaluatorTypeBadge;
