import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Empty, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApartmentOutlined } from '@ant-design/icons';
import { datasetApi } from '@/api/langfuse';
import type { DatasetRun, DatasetRunItemRow, TraceScore } from '@/types/dataset';
import { AgentPageShell } from '@/pages/agentManagement/AgentPageShell';
import '@/pages/agentManagement/agent.css';
import {
  formatDatasetTime,
  formatLatencySeconds,
  formatScoreValue,
  formatUsd,
  prettyJson,
  previewJson,
} from '@/pages/dataset/datasetManagement/utils';

export default function DatasetExperimentDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const datasetName = searchParams.get('datasetName') || '';
  const runName = searchParams.get('runName') || '';
  const queryRunId = searchParams.get('runId') || '';
  const queryDatasetId = searchParams.get('datasetId') || '';
  const queryProjectId = searchParams.get('projectId') || '';

  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [run, setRun] = useState<DatasetRun | null>(null);
  const [projectId, setProjectId] = useState(queryProjectId);
  const [records, setRecords] = useState<DatasetRunItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadRun = useCallback(async () => {
    if (!datasetName || !runName) {
      setRun(null);
      return;
    }
    setLoading(true);
    try {
      const data = await datasetApi.getRun(datasetName, runName);
      setRun(data);

      // URL 未带 projectId 时，从 dataset 补齐（runItemsByRunId 需要）
      if (!queryProjectId && data?.datasetId) {
        try {
          const ds = await datasetApi.getDataset(datasetName);
          setProjectId(ds.projectId || '');
        } catch {
          setProjectId('');
        }
      } else {
        setProjectId(queryProjectId);
      }
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [datasetName, runName, queryProjectId]);

  const datasetId = queryDatasetId || run?.datasetId || '';
  const datasetRunId = queryRunId || run?.id || '';

  const loadItems = useCallback(async () => {
    if (!projectId || !datasetId || !datasetRunId) return;
    setItemsLoading(true);
    try {
      const res = await datasetApi.listRunItemsByRunId({
        projectId,
        datasetId,
        datasetRunId,
        page: page - 1,
        limit: pageSize,
        filter: [],
      });
      setRecords(res?.data ?? []);
      setTotal(res?.meta?.totalItems ?? 0);
    } catch {
      setRecords([]);
      setTotal(0);
    } finally {
      setItemsLoading(false);
    }
  }, [projectId, datasetId, datasetRunId, page, pageSize]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  useEffect(() => {
    if (projectId && datasetId && datasetRunId) {
      void loadItems();
    }
  }, [projectId, datasetId, datasetRunId, loadItems]);

  const scoreNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((row) => {
      row.scores?.forEach((s) => {
        if (s.name) names.add(s.name);
      });
    });
    return Array.from(names).sort();
  }, [records]);

  const findScore = (scores: TraceScore[] | undefined, name: string) =>
    scores?.find((s) => s.name === name);

  const columns: ColumnsType<DatasetRunItemRow> = useMemo(() => {
    const base: ColumnsType<DatasetRunItemRow> = [
      {
        title: "执行ID",
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
        title: "执行时间",
        dataIndex: 'createdAt',
        width: 170,
        render: (v: string) => (
          <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDatasetTime(v)}
          </span>
        ),
      },
      // {
      //   title: "Trace",
      //   dataIndex: 'traceId',
      //   width: 72,
      //   align: 'center',
      //   render: (traceId: string, row) =>
      //     traceId ? (
      //       <span
      //         className="agent-table-link"
      //         title={
      //           row.observationId
      //             ? `Trace: ${traceId}, Observation: ${row.observationId}`
      //             : `Trace: ${traceId}`
      //         }
      //       >
      //         <ApartmentOutlined />
      //       </span>
      //     ) : (
      //       '-'
      //     ),
      // },
      {
        title: "耗时",
        dataIndex: 'latency',
        width: 100,
        render: (value: number | null | undefined) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatLatencySeconds(value)}
          </span>
        ),
      },
      // {
      //   title: "Cost",
      //   dataIndex: 'totalCost',
      //   width: 100,
      //   render: (value: number | null | undefined) => (
      //     <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsd(value)}</span>
      //   ),
      // },
      ...scoreNames.map(
        (name): ColumnsType<DatasetRunItemRow>[number] => ({
          title: `# ${name} (eval)`,
          key: `score-${name}`,
          width: 140,
          ellipsis: true,
          render: (_: unknown, row) => {
            const score = findScore(row.scores, name);
            if (!score) return <span style={{ color: 'rgba(9,25,64,0.35)' }}>∅</span>;
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
        title: "Trace Input",
        dataIndex: 'input',
        width: 200,
        ellipsis: true,
        render: (value) => (
          <span className="agent-mono" title={previewJson(value, 2000)}>
            {previewJson(value)}
          </span>
        ),
      },
      {
        title: "Output",
        dataIndex: 'output',
        width: 200,
        ellipsis: true,
        render: (value) => (
          <span className="agent-mono" title={previewJson(value, 2000)}>
            {previewJson(value)}
          </span>
        ),
      }
    ];
    return base;
  }, [scoreNames]);

  const metadataText = prettyJson(run?.metadata) || previewJson(run?.metadata, 2000);
  const displayTitle = run?.name || runName || "Dataset run";

  if (!datasetName || !runName) {
    return (
      <AgentPageShell
        title={"Dataset run"}
        onBack={() => navigate('/datasetManagement')}
      >
        <div className="agent-section">
          <Empty style={{ padding: 48 }} description={"缺少数据集或执行记录名称"} />
        </div>
      </AgentPageShell>
    );
  }

  return (
    <AgentPageShell
      title={displayTitle}
      onBack={() =>
        navigate(`/datasetDetail?name=${encodeURIComponent(datasetName)}`)
      }
      backLabel={"执行记录"}
    >
      <Spin spinning={loading && !run}>
        {!run && !loading ? (
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description={"未找到该执行记录"} />
          </div>
        ) : (
          <div className="agent-experiment-layout">
            <div className="agent-experiment-detail">
              <div className="agent-section" style={{ marginBottom: 0 }}>
                <div className="agent-section-head">
                  <h2 className="agent-section-title">{"执行详情"}</h2>
                </div>
                <div className="agent-section-body agent-experiment-detail-body">
                  <div className="agent-experiment-field">
                    <div className="agent-experiment-field-label">{"描述"}</div>
                    {run?.description ? (
                      <Typography.Paragraph
                        copyable
                        ellipsis={{ rows: 4, expandable: true, symbol: "展开" }}
                        style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                      >
                        {run.description}
                      </Typography.Paragraph>
                    ) : (
                      <span style={{ color: 'rgba(9,25,64,0.45)' }}>-</span>
                    )}
                  </div>

                  <div className="agent-experiment-field">
                    <div className="agent-experiment-field-label">{"元数据"}</div>
                    {run?.metadata != null && metadataText && metadataText !== '-' ? (
                      <Typography.Paragraph
                        copyable={{ text: prettyJson(run.metadata) || metadataText }}
                        style={{ marginBottom: 0 }}
                      >
                        <pre className="agent-experiment-json">{metadataText}</pre>
                      </Typography.Paragraph>
                    ) : (
                      <span style={{ color: 'rgba(9,25,64,0.45)' }}>-</span>
                    )}
                  </div>

                  {!run?.description && (run?.metadata == null || metadataText === '-') ? (
                    <div style={{ color: 'rgba(9,25,64,0.45)', fontSize: 13 }}>
                      {"该 run 暂无描述或元数据"}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="agent-experiment-main">
              <div className="agent-section" style={{ marginBottom: 0 }}>
                <div className="agent-section-head">
                  <h2 className="agent-section-title">{"执行列表"}</h2>
                </div>
                <div className="agent-section-body" style={{ paddingTop: 8 }}>
                  <Table<DatasetRunItemRow>
                    rowKey="id"
                    loading={itemsLoading && records.length === 0}
                    columns={columns}
                    dataSource={records}
                    scroll={{ x: 1600 }}
                    size="middle"
                    pagination={{
                      current: page,
                      pageSize,
                      total,
                      showSizeChanger: true,
                      showTotal: (n) => `共 ${n} 条`,
                      onChange: (nextPage, nextSize) => {
                        setPage(nextPage);
                        setPageSize(nextSize);
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Spin>
    </AgentPageShell>
  );
}
