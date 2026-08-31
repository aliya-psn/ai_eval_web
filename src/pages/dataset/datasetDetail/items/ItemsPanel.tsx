import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { datasetApi } from '@/api/langfuse';
import type { DatasetItem, DatasetStatus } from '@/types/dataset';
import { formatDatasetTime, previewJson } from '@/pages/dataset/datasetManagement/utils';
import { NewItemModal } from './NewItemModal';
import { UploadCsvModal } from './UploadCsvModal';

interface ItemsPanelProps {
  datasetName: string;
  datasetId?: string;
  projectId?: string;
  inputSchema?: unknown;
  expectedOutputSchema?: unknown;
  /** 传给 tRPC searchQuery；按 id / input / output 搜索 */
  searchQuery?: string;
  /** all = 不过滤；否则按 status 筛 */
  statusFilter?: 'all' | DatasetStatus;
  createOpen: boolean;
  csvOpen: boolean;
  onCreateClose: () => void;
  onCsvClose: () => void;
}

const ITEMS_SEARCH_TYPE = ['id', 'input', 'output'] as const;

export function ItemsPanel({
  datasetName,
  datasetId = '',
  projectId = '',
  inputSchema,
  expectedOutputSchema,
  searchQuery = '',
  statusFilter = 'ACTIVE',
  createOpen,
  csvOpen,
  onCreateClose,
  onCsvClose,
}: ItemsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DatasetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<DatasetItem | null>(null);

  // 搜索 / 状态筛选变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const loadData = useCallback(async () => {
    if (!projectId || !datasetId) return;
    setLoading(true);
    try {
      const filter =
        statusFilter === 'all'
          ? []
          : [
              {
                type: 'stringOptions',
                column: 'status',
                operator: 'any of',
                value: [statusFilter],
              },
            ];
      const res = await datasetApi.listItemsByDatasetId({
        projectId,
        datasetId,
        page: page - 1,
        limit: pageSize,
        filter,
        searchQuery: searchQuery || undefined,
        searchType: [...ITEMS_SEARCH_TYPE],
      });
      setRecords(res?.data ?? []);
      setTotal(res?.meta?.totalItems ?? 0);
    } catch {
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [projectId, datasetId, page, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreated = () => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    void loadData();
  };

  const handleUpdated = () => {
    void loadData();
  };

  const handleDelete = (record: DatasetItem) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除用例「${record.id}」吗？此操作不可恢复，相关执行也会一并删除。`,
      okType: 'danger',
      okText: "删除",
      cancelText: "取消",
      onOk: async () => {
        await datasetApi.deleteItem(record.id);
        message.success("用例已删除");
        const remaining = records.length - 1;
        if (remaining <= 0 && page > 1) {
          setPage((p) => p - 1);
        } else {
          void loadData();
        }
      },
    });
  };

  const handleToggleArchive = (record: DatasetItem) => {
    const nextStatus = record.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const isArchive = nextStatus === 'ARCHIVED';
    Modal.confirm({
      title: (isArchive ? "确认归档" : "确认取消归档"),
      content: (isArchive ? `确定要将用例「${record.id}」标记为已归档吗？` : `确定要将用例「${record.id}」恢复为启用吗？`),
      okText: (isArchive ? "归档" : "取消归档"),
      cancelText: "取消",
      onOk: async () => {
        await datasetApi.createItem({
          datasetName,
          id: record.id,
          input: record.input,
          expectedOutput: record.expectedOutput,
          metadata: record.metadata,
          status: nextStatus,
        });
        message.success(
          (isArchive ? "用例已归档" : "用例已取消归档"),
        );
        void loadData();
      },
    });
  };

  const columns: ColumnsType<DatasetItem> = [
    {
      title: '用例ID',
      dataIndex: 'id',
      width: 260,
      ellipsis: true,
      render: (id: string) => (
        <Typography.Text
          className="agent-mono"
          copyable={{ text: id, tooltips: ["点击复制 ID", "ID 已复制"] }}
          ellipsis={{ tooltip: id }}
          style={{ maxWidth: '100%' }}
        >
          {id}
        </Typography.Text>
      ),
    },
    {
      title: "状态",
      dataIndex: 'status',
      width: 110,
      render: (status: string) =>
        status === 'ACTIVE' ? (
          <span className="agent-status on">
            <span className="agent-status-dot" />
            {"启用"}
          </span>
        ) : (
          <span className="agent-status off">
            <span className="agent-status-dot" />
            {"已归档"}
          </span>
        ),
    },
    {
      title: "输入",
      dataIndex: 'input',
      ellipsis: true,
      render: (value) => (
        <span className="agent-mono" title={previewJson(value, 2000)}>
          {previewJson(value)}
        </span>
      ),
    },
    {
      title: "期望输出",
      dataIndex: 'expectedOutput',
      ellipsis: true,
      render: (value) => (
        <span className="agent-mono" title={previewJson(value, 2000)}>
          {previewJson(value)}
        </span>
      ),
    },
    {
      title: "创建时间",
      dataIndex: 'createdAt',
      width: 180,
      render: (v) => (
        <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
          {formatDatasetTime(v)}
        </span>
      ),
    },
    {
      title: "操作",
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" onClick={() => setEditing(record)}>
            {"编辑"}
          </Button>
          <Button type="link" onClick={() => handleToggleArchive(record)}>
            {record.status === 'ACTIVE' ? '归档' : '取消归档'}
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>
            {"删除"}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table<DatasetItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={records}
        scroll={{ x: 1100 }}
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

      <NewItemModal
        open={createOpen}
        datasetName={datasetName}
        inputSchema={inputSchema}
        expectedOutputSchema={expectedOutputSchema}
        onClose={onCreateClose}
        onSuccess={handleCreated}
      />
      <NewItemModal
        open={Boolean(editing)}
        datasetName={datasetName}
        editing={editing}
        onClose={() => setEditing(null)}
        onSuccess={handleUpdated}
      />
      <UploadCsvModal
        open={csvOpen}
        datasetId={datasetId}
        projectId={projectId}
        onClose={onCsvClose}
        onSuccess={handleCreated}
      />
    </>
  );
}
