import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Space, Spin, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { datasetApi } from '@/api/langfuse';
import type { AggregatedScore, DatasetRun, DatasetRunListRow } from '@/types/dataset';
import {
  enrichRunsMetrics,
  formatDatasetTime,
  formatLatencySeconds,
  formatUsd,
  previewJson,
} from '@/pages/dataset/datasetManagement/utils';

interface ExperimentsPanelProps {
  datasetName: string;
  datasetId?: string;
  projectId?: string;
  /** 外部触发重新加载（如 Run Experiment 成功后） */
  refreshKey?: number;
}

/** 执行实验后延列表、 */
const POST_RUN_REFRESH_DELAY_MS = 1000;

function renderMetricCell(loading: boolean | undefined, content: ReactNode) {
  if (loading) {
    return <span style={{ color: 'rgba(9,25,64,0.35)' }}>…</span>;
  }
  return content;
}

function renderScoreCell(
  loading: boolean | undefined,
  score?: AggregatedScore,
) {
  if (loading) {
    return <span style={{ color: 'rgba(9,25,64,0.35)' }}>…</span>;
  }
  if (!score) {
    return <span style={{ color: 'rgba(9,25,64,0.35)' }}>∅</span>;
  }
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score.displayValue}</span>
  );
}

/** 列标题只展示第一个 `-` 之前的部分，如 `xxx-API-NUMERIC` → `xxx` */
function formatScoreColumnTitle(name: string) {
  const idx = name.indexOf('-');
  return idx === -1 ? name : name.slice(0, idx);
}

export function ExperimentsPanel({
  datasetName,
  datasetId,
  projectId,
  refreshKey = 0,
}: ExperimentsPanelProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DatasetRunListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  /** 点击查询时递增，保证空关键词也会重新请求全部 */
  const [queryTick, setQueryTick] = useState(0);

  const applyNameFilter = useCallback((value?: string) => {
    const next = (value ?? nameInput).trim();
    setNameQuery(next);
    setPage(1);
    setSelectedRowKeys([]);
    setQueryTick((t) => t + 1);
  }, [nameInput]);

  const loadData = useCallback(async () => {
    if (!datasetName) return;
    // 等 projectId / datasetId 就绪后再加载，避免先渲染只有基础列的表格
    if (!projectId || !datasetId) {
      setLoading(true);
      return;
    }
    setLoading(true);
    try {
      let runs: DatasetRun[] = [];
      let nextTotal = 0;

      if (nameQuery) {
        // Public API 无模糊搜索，按名称精确查询单个 run
        try {
          const run = await datasetApi.getRun(datasetName, nameQuery);
          const { datasetRunItems: _items, ...rest } = run;
          runs = [rest];
          nextTotal = 1;
        } catch {
          runs = [];
          nextTotal = 0;
        }
      } else {
        // 空关键词：分页查询全部
        const res = await datasetApi.listRuns({
          datasetName,
          page,
          limit: pageSize,
        });
        runs = res?.data ?? [];
        nextTotal = res?.meta?.totalItems ?? 0;
      }

      const enriched = await enrichRunsMetrics(runs, {
        projectId,
        datasetId,
      });
      setRecords(enriched);
      setTotal(nextTotal);
      setLoading(false);
    } catch {
      setRecords([]);
      setTotal(0);
      setLoading(false);
    }
  }, [datasetName, datasetId, projectId, page, pageSize, nameQuery]);

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // 常规依赖变化 / 点击查询（含空关键词查全部）
  useEffect(() => {
    void loadData();
  }, [loadData, queryTick]);

  // 执行实验成功后：清空筛选，延迟 500ms 再请求一次
  useEffect(() => {
    if (refreshKey === 0) return;

    setPage(1);
    setNameInput('');
    setNameQuery('');
    setSelectedRowKeys([]);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void loadDataRef.current();
    }, POST_RUN_REFRESH_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshKey]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize, datasetName, nameQuery]);

  const openDetail = (record: DatasetRunListRow) => {
    const params = new URLSearchParams({
      datasetName,
      runName: record.name,
    });
    if (record.id) params.set('runId', record.id);
    if (record.datasetId || datasetId) {
      params.set('datasetId', record.datasetId || datasetId || '');
    }
    if (projectId) params.set('projectId', projectId);
    navigate(`/datasetExperimentDetail?${params.toString()}`);
  };

  const handleDelete = useCallback(
    (record: DatasetRunListRow) => {
      Modal.confirm({
        title: "确认删除",
        content: `确定要删除执行记录「${record.name}」吗？此操作不可恢复，相关执行也会一并删除。`,
        okType: 'danger',
        okText: "删除",
        cancelText: "取消",
        onOk: async () => {
          await datasetApi.deleteRun(datasetName, record.name);
          message.success("执行记录已删除");
          setSelectedRowKeys((keys) => keys.filter((k) => k !== record.id));
          const remaining = records.length - 1;
          if (remaining <= 0 && page > 1) {
            setPage((p) => p - 1);
          } else {
            void loadData();
          }
        },
      });
    },
    [datasetName, records.length, page, loadData],
  );

  const handleBatchDelete = useCallback(() => {
    if (!selectedRowKeys.length) return;
    if (!projectId || !datasetId) {
      message.error("缺少数据集 ID，请刷新页面后重试");
      return;
    }
    const selectedIds = selectedRowKeys.map(String);
    const count = selectedIds.length;

    Modal.confirm({
      title: "确认批量删除",
      content: `确定要删除选中的 ${count} 个执行记录吗？此操作不可恢复，相关执行也会一并删除。`,
      okType: 'danger',
      okText: "删除",
      cancelText: "取消",
      onOk: async () => {
        setBatchDeleting(true);
        try {
          await datasetApi.deleteDatasetRuns({
            projectId,
            datasetId,
            datasetRunIds: selectedIds,
          });
          message.success(`已删除 ${count} 个执行记录`);
          setSelectedRowKeys([]);
          const remaining = records.length - count;
          if (remaining <= 0 && page > 1) {
            setPage((p) => p - 1);
          } else {
            void loadData();
          }
        } finally {
          setBatchDeleting(false);
        }
      },
    });
  }, [projectId, datasetId, selectedRowKeys, records.length, page, loadData]);

  const runScoreNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((row) => {
      Object.keys(row.runScores ?? {}).forEach((n) => names.add(n));
    });
    return Array.from(names).sort();
  }, [records]);

  const runItemScoreNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((row) => {
      Object.keys(row.runItemScores ?? {}).forEach((n) => names.add(n));
    });
    return Array.from(names).sort();
  }, [records]);

  const columns: ColumnsType<DatasetRunListRow> = useMemo(() => {
    const base: ColumnsType<DatasetRunListRow> = [
      {
        title: "执行记录名称",
        dataIndex: 'name',
        ellipsis: true,
        fixed: 'left',
        width: 340,
        render: (text: string, record) => (
          <button
            type="button"
            className="agent-table-link"
            onClick={() => openDetail(record)}
            title={text}
          >
            {text}
          </button>
        ),
      },
      {
        title: "执行数",
        dataIndex: 'countRunItems',
        width: 80,
        render: (value: number | undefined, row) =>
          renderMetricCell(
            row.metricsLoading,
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value ?? '-'}</span>,
          ),
      },
      {
        title: "描述",
        dataIndex: 'description',
        ellipsis: true,
        width: 180,
        render: (value?: string | null) => (
          <span style={{ color: 'rgba(9,25,64,0.55)' }}>{value || '-'}</span>
        ),
      },
      {
        title: "耗时 (平均)",
        dataIndex: 'avgLatency',
        width: 120,
        render: (value: number | null | undefined, row) =>
          renderMetricCell(
            row.metricsLoading,
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatLatencySeconds(value)}
            </span>,
          ),
      },
      ...runScoreNames.map(
        (name): ColumnsType<DatasetRunListRow>[number] => ({
          title: formatScoreColumnTitle(name),
          key: `runScore-${name}`,
          width: 150,
          ellipsis: true,
          render: (_: unknown, row) =>
            renderScoreCell(row.metricsLoading, row.runScores?.[name]),
        }),
      ),
      ...runItemScoreNames.map(
        (name): ColumnsType<DatasetRunListRow>[number] => ({
          title: `${formatScoreColumnTitle(name)} (评估值)`,
          key: `runItemScore-${name}`,
          width: 140,
          ellipsis: true,
          render: (_: unknown, row) =>
            renderScoreCell(row.metricsLoading, row.runItemScores?.[name]),
        }),
      ),
      {
        title: "创建时间",
        dataIndex: 'createdAt',
        width: 170,
        render: (v: string) => (
          <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDatasetTime(v)}
          </span>
        ),
      },
      {
        title: "元数据",
        dataIndex: 'metadata',
        width: 200,
        ellipsis: true,
        render: (value) => (
          <span className="agent-mono" title={previewJson(value, 2000)}>
            {previewJson(value)}
          </span>
        ),
      },
      {
        title: "操作",
        key: 'action',
        width: 80,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" danger onClick={() => handleDelete(record)}>
            {"删除"}
          </Button>
        ),
      },
    ];
    return base;
  }, [runScoreNames, runItemScoreNames, handleDelete]);

  /** 按列宽求和作为横向滚动最小宽度；容器更宽时表格仍可撑满 */
  const scrollX = useMemo(() => {
    const selectionColWidth = 48;
    const columnsWidth = columns.reduce(
      (sum, col) => sum + (typeof col.width === 'number' ? col.width : 0),
      0,
    );
    return Math.max(columnsWidth + selectionColWidth, 1200);
  }, [columns]);

  return (
    <>
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
        <Space size={10} wrap>
          <Input
            allowClear
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onPressEnter={() => applyNameFilter()}
            onClear={() => applyNameFilter('')}
            placeholder={"按名称精确查询"}
            prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={() => applyNameFilter()}>
            {"查询"}
          </Button>
        </Space>

        {selectedRowKeys.length > 0 ? (
          <Space size={10} wrap>
            <span style={{ color: 'rgba(9,25,64,0.65)', fontSize: 13 }}>
              {`已选择 ${selectedRowKeys.length} 项`}
            </span>
            <Button onClick={() => setSelectedRowKeys([])}>{"取消"}</Button>
            <Button
              danger
              type="primary"
              loading={batchDeleting}
              disabled={!projectId || !datasetId}
              onClick={handleBatchDelete}
            >
              {"批量删除"}
            </Button>
          </Space>
        ) : null}
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 0',
          }}
        >
          <Spin>
          <div style={{ padding: '48px 0' }}>数据加载中…</div>
        </Spin>
        </div>
      ) : (
        <Table<DatasetRunListRow>
          rowKey="id"
          columns={columns}
          dataSource={records}
          scroll={{ x: scrollX }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
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
      )}
    </>
  );
}
