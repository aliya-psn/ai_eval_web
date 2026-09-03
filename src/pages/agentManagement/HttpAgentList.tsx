import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  message,
} from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminAgentApi } from '@/api/admin';
import { useCurrentUser } from '@/lib/api/user';
import { useNamespaceStore } from '@/stores/namespace-store';
import type { HttpAgentListItem } from '@/types/adminAgent';
import { nameInitials, formatTime } from '@/components/page/PageShell';

export function HttpAgentList() {
  const navigate = useNavigate();
  const { currentNamespace } = useNamespaceStore();
  const workspace = currentNamespace;
  const { data: currentUser } = useCurrentUser();

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<HttpAgentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [nameInput, setNameInput] = useState('');
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [editingAgent, setEditingAgent] = useState<HttpAgentListItem | null>(null);
  const [agentForm] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!workspace) {
      setRecords([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminAgentApi.listHttpAgents({
        workspace,
        name: name || undefined,
        enabled,
        pageNo,
        pageSize,
      });
      setRecords(res?.records || []);
      setTotal(res?.total ?? 0);
    } catch {
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [workspace, name, enabled, pageNo, pageSize]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearch = () => {
    setPageNo(1);
    setName(nameInput.trim());
  };

  const handleReset = () => {
    setNameInput('');
    setName('');
    setEnabled(undefined);
    setPageNo(1);
  };

  const handleDelete = (record: HttpAgentListItem) => {
    if (!record.agentId) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定删除 HTTP Agent「${record.name}」吗？此操作不可恢复。`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await adminAgentApi.deleteHttpAgent(record.agentId!);
        message.success('删除成功');
        void loadData();
      },
    });
  };

  const goDetail = (record: HttpAgentListItem) => {
    const qs = new URLSearchParams({
      id: String(record.agentId),
      name: record.name || '',
    });
    if (record.description) qs.set('description', record.description);
    navigate(`/agentManagement/http/detail?${qs.toString()}`);
  };

  const openCreate = () => {
    setEditingAgent(null);
    agentForm.resetFields();
    agentForm.setFieldsValue({ enabled: true });
    setFormOpen(true);
  };

  const openEdit = (record: HttpAgentListItem) => {
    setEditingAgent(record);
    agentForm.setFieldsValue({
      name: record.name,
      description: record.description,
      enabled: record.enabled ?? true,
    });
    setFormOpen(true);
  };

  const handleSaveAgent = async () => {
    const username = currentUser?.username || '';
    if (!username) {
      message.error('无法获取当前用户，请重新登录后再试');
      return;
    }
    if (!workspace) {
      message.error('请先选择 Workspace');
      return;
    }

    let values: { name: string; description?: string; enabled?: boolean };
    try {
      values = await agentForm.validateFields();
    } catch {
      return;
    }

    const payload = {
      workspace,
      name: values.name.trim(),
      description: values.description?.trim(),
      enabled: values.enabled ?? true,
      updateUser: username,
    };

    setFormSaving(true);
    try {
      if (editingAgent?.agentId) {
        await adminAgentApi.updateHttpAgent(editingAgent.agentId, payload);
        message.success('Agent 更新成功');
        setFormOpen(false);
        void loadData();
      } else {
        const result = await adminAgentApi.createHttpAgent({
          ...payload,
          createUser: username,
        });
        message.success('Agent 创建成功');
        setFormOpen(false);
        if (result?.id) {
          navigate(
            `/agentManagement/http/edit?id=${result.id}&mode=newVersion&name=${encodeURIComponent(values.name.trim())}`,
          );
        } else {
          void loadData();
        }
      }
    } finally {
      setFormSaving(false);
    }
  };

  const columns: ColumnsType<HttpAgentListItem> = [
    {
      title: 'Agent',
      dataIndex: 'name',
      ellipsis: true,
      render: (text, record) => (
        <div className="agent-name-cell">
          <span className="agent-avatar">{nameInitials(text)}</span>
          <div className="agent-name-text">
            <Button type="link" className="agent-name-link" onClick={() => goDetail(record)}>
              {text}
            </Button>
            {record.description ? (
              <span className="agent-name-meta">{record.description}</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: '最新交付版本',
      dataIndex: 'latestDeliveryVersion',
      width: 130,
      render: (v) => <span className="agent-version-pill">{v || '-'}</span>,
    },
    {
      title: '版本数',
      dataIndex: 'deliveryVersionCount',
      width: 110,
      align: 'center',
      render: (v) => (v != null ? v : '-'),
    },
    {
      title: '当前修订号',
      dataIndex: 'currentRevisionNo',
      width: 110,
      align: 'center',
      render: (v) => (v != null ? v : '-'),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <span className="agent-status on">
            <span className="agent-status-dot" />
            启用
          </span>
        ) : (
          <span className="agent-status off">
            <span className="agent-status-dot" />
            停用
          </span>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdTime',
      width: 180,
      render: (v) => (
        <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(v)}
        </span>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedTime',
      width: 180,
      render: (v) => (
        <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(v)}
        </span>
      ),
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} wrap={false}>
          <Button type="link" onClick={() => goDetail(record)}>
            详情
          </Button>
          <Button type="link" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            onClick={() =>
              navigate(
                `/agentManagement/http/edit?id=${record.agentId}&mode=newVersion&name=${encodeURIComponent(record.name || '')}`,
              )
            }
          >
            新增版本
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="agent-toolbar">
        <Space wrap size={10}>
          <Input
            allowClear
            placeholder="搜索 Agent 名称"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240 }}
            prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
          />
          <Select
            allowClear
            placeholder="启用状态"
            style={{ width: 140 }}
            value={enabled}
            onChange={(v) => {
              setEnabled(v);
              setPageNo(1);
            }}
            options={[
              { label: '启用', value: true },
              { label: '停用', value: false },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建 HTTP Agent
        </Button>
      </div>

      <Table
        rowKey={(r) => String(r.agentId ?? r.name)}
        loading={loading}
        columns={columns}
        dataSource={records}
        scroll={{ x: 1200 }}
        pagination={{
          current: pageNo,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count) => `共 ${count} 条`,
          onChange: (p, ps) => {
            setPageNo(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editingAgent ? '编辑 HTTP Agent' : '新建 HTTP Agent'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => void handleSaveAgent()}
        confirmLoading={formSaving}
        okText={editingAgent ? '保存' : '新建'}
        cancelText="取消"
        destroyOnClose
        width={480}
      >
        <Form
          form={agentForm}
          layout="vertical"
          initialValues={{ enabled: true }}
          style={{ marginTop: 8 }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: 'Agent 名称不能为空' }]}
          >
            <Input placeholder="Agent 名称" maxLength={128} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入 Agent 的功能描述..." />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
