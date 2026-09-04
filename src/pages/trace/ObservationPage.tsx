import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Empty, Spin } from 'antd';
import { traceService } from '@/services/traceService';
import type { ObservationNode } from '@/types/trace';
import { PageShell } from '@/components/page/PageShell';
import { ObservationTree } from '@/components/trace/ObservationTree';
import '@/components/page/page.css';

export default function ObservationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const traceId = searchParams.get('traceId') || '';

  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<ObservationNode[]>([]);

  const loadTree = useCallback(async () => {
    if (!traceId) {
      setTree([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const t = await traceService.fetchObservationTree(traceId);
      setTree(t);
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  return (
    <PageShell
      title="Observation 树"
      onBack={() => navigate('/trace')}
      backLabel="Trace 追踪"
    >
      <Spin spinning={loading}>
        {!traceId ? (
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description="缺少 traceId 参数" />
          </div>
        ) : (
          <div className="agent-section" style={{ marginBottom: 0 }}>
            <div className="agent-section-head">
              <h2 className="agent-section-title">Observation 树</h2>
            </div>
            <div className="agent-section-body">
              <ObservationTree tree={tree} />
            </div>
          </div>
        )}
      </Spin>
    </PageShell>
  );
}
