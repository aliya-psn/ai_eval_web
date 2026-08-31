import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Space, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { AgentPageShell } from '@/pages/agentManagement/AgentPageShell';
import '@/pages/agentManagement/agent.css';
import { formatDatasetTime } from '@/pages/dataset/datasetManagement/utils';
import { EvaluatorFormModal } from './EditEvaluatorModal';
import {
  mockEvaluatorStore,
  type MockEvaluator,
  type MockEvaluatorInput,
} from './mockStore';

function statusColor(status: string): string {
  return status === 'active' ? 'success' : 'default';
}

export default function EvaluatorManagementPage() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<MockEvaluator[]>([]);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [editing, setEditing] = useState<MockEvaluator | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await mockEvaluatorStore.list();
      setRecords(list);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q),
    );
  }, [records, search]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (record: MockEvaluator) => {
    setEditing(record);
    setFormOpen(true);
  };

  const handleDelete = (record: MockEvaluator) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除评估器「${record.name}」吗？`,
      okText: "删除",
      okType: 'danger',
      cancelText: "取消",
      onOk: async () => {
        try {
          await mockEvaluatorStore.remove(record.id);
          message.success("删除成功");
          await loadData();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "操作失败");
        }
      },
    });
  };

  const handleSubmit = async (values: MockEvaluatorInput) => {
    setFormSaving(true);
    try {
      if (editing) {
        await mockEvaluatorStore.update(editing.id, values);
        message.success("保存成功");
      } else {
        await mockEvaluatorStore.create(values);
        message.success("创建成功");
      }
      setFormOpen(false);
      setEditing(null);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setFormSaving(false);
    }
  };

  const columns: ColumnsType<MockEvaluator> = [
    {
      title: "名称",
      dataIndex: 'name',
      ellipsis: true,
      width: 200,
      render: (text: string) => <span style={{ fontWeight: 600 }}>{text}</span>,
    },
    {
      title: "状态",
      dataIndex: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={statusColor(status)}>
          {status === 'active' ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "描述",
      dataIndex: 'description',
      ellipsis: true,
      render: (v?: string) => v || '-',
    },
    {
      title: "更新时间",
      dataIndex: 'updatedAt',
      width: 180,
      render: (v?: string) => (
        <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
          {formatDatasetTime(v)}
        </span>
      ),
    },
    {
      title: "操作",
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} wrap={false}>
          <Button type="link" onClick={() => openEdit(record)}>
            {"编辑"}
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>
            {"删除"}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AgentPageShell title={"评估器"}>
      <div className="agent-panel">
        <div className="agent-panel-inner">
          <div className="agent-toolbar">
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: 'rgba(9,25,64,0.35)' }} />}
                placeholder={"搜索名称、描述或类型"}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={() => setSearch(keyword.trim())}
                style={{ width: 260 }}
              />
              <button
                type="button"
                className="agent-btn ghost"
                onClick={() => setSearch(keyword.trim())}
              >
                <SearchOutlined /> {"搜索"}
              </button>
              <button
                type="button"
                className="agent-btn ghost"
                onClick={() => {
                  setKeyword('');
                  setSearch('');
                  void loadData();
                }}
              >
                <ReloadOutlined /> {"重置"}
              </button>
            </Space>
            <Space>
              <span style={{ color: 'rgba(9,25,64,0.45)', fontSize: 13 }}>
                {`共 ${filtered.length} 条`}
              </span>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                {"新建评估器"}
              </Button>
            </Space>
          </div>

          <Table<MockEvaluator>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 900 }}
            pagination={{
              showSizeChanger: true,
              showTotal: (n) => `共 ${n} 条`,
            }}
          />
        </div>
      </div>

      <EvaluatorFormModal
        open={formOpen}
        editing={editing}
        saving={formSaving}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </AgentPageShell>
  );
}
