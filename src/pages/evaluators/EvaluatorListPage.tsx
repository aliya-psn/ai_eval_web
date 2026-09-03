import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { evaluatorService } from '@/services/evaluatorService';
import { PageShell, formatTime } from '@/components/page/PageShell';
import '@/components/page/page.css';
import { EvaluatorTypeBadge } from '@/components/evaluators/EvaluatorTypeBadge';
import { EVALUATOR_TYPE_META, type LangfuseEvaluator } from '@/types/evaluator';

const PAGE_SIZE = 10;

const TYPE_OPTIONS = Object.entries(EVALUATOR_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export default function EvaluatorListPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LangfuseEvaluator[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await evaluatorService.list({ page, limit: PAGE_SIZE });
      let data = res.data ?? [];
      if (typeFilter) {
        data = data.filter((e) => (e.type ?? 'llm_as_judge') === typeFilter);
      }
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        data = data.filter((e) => e.name.toLowerCase().includes(kw));
      }
      setRecords(data);
      setTotal(res.meta?.totalItems ?? data.length);
    } catch {
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, searchKeyword]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearch = () => {
    setPage(1);
    setSearchKeyword(keyword.trim());
  };

  const handleReset = () => {
    setKeyword('');
    setSearchKeyword('');
    setTypeFilter(undefined);
    setPage(1);
    setSelectedRowKeys([]);
  };

  const handleDelete = (record: LangfuseEvaluator) => {
    Modal.confirm({
      title: '删除评估器',
      content: `确定要删除评估器「${record.name}」吗？该操作不可恢复。`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await evaluatorService.remove(record.id);
        message.success('删除成功');
        setSelectedRowKeys((prev) => prev.filter((k) => k !== record.id));
        void loadData();
      },
    });
  };

  const handleBatchDelete = () => {
    if (!selectedRowKeys.length) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个评估器吗？`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await Promise.all(
          selectedRowKeys.map((id) => evaluatorService.remove(String(id))),
        );
        message.success('批量删除成功');
        setSelectedRowKeys([]);
        void loadData();
      },
    });
  };

  const columns: ColumnsType<LangfuseEvaluator> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <a onClick={() => navigate(`/evaluatorDetail?id=${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (type?: string) => <EvaluatorTypeBadge type={type} />,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v?: number) => (v != null ? `v${v}` : '-'),
    },
    {
      title: '输出类型',
      key: 'output',
      width: 120,
      render: (_, record) => {
        const dt = record.outputDefinition?.dataType;
        if (!dt) return '-';
        const color =
          dt === 'NUMERIC' ? 'blue' : dt === 'BOOLEAN' ? 'green' : 'orange';
        return <Tag color={color}>{dt}</Tag>;
      },
    },
    {
      title: '关联规则',
      dataIndex: 'evaluationRuleCount',
      key: 'evaluationRuleCount',
      width: 100,
      render: (count?: number) => count ?? 0,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v?: string) => formatTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} wrap={false}>
          <Button
            type="link"
            onClick={() => navigate(`/evaluatorDetail?id=${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            onClick={() => navigate(`/evaluatorForm?id=${record.id}`)}
          >
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="评估器管理"
      subtitle="管理 LLM-as-a-judge、规则、Code、Agent 四类评估器"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/evaluatorForm')}
        >
          新建评估器
        </Button>
      }
    >
      <div className="agent-panel">
        <div className="agent-toolbar" style={{ padding: '0 0 12px 0' }}>
          <Space wrap size={10}>
            <Input
              allowClear
              placeholder="搜索评估器名称"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 220 }}
              prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
            />
            <Select
              allowClear
              suffixIcon={null}
              placeholder="按类型筛选"
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
              style={{ width: 180 }}
              options={TYPE_OPTIONS}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
          {selectedRowKeys.length > 0 ? (
            <Space size={8}>
              <span style={{ color: 'rgba(9,25,64,0.55)', fontSize: 12 }}>
                已选择 {selectedRowKeys.length} 项
              </span>
              <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                批量删除
              </Button>
              <Button onClick={() => setSelectedRowKeys([])}>取消</Button>
            </Space>
          ) : null}
        </div>

        <Table<LangfuseEvaluator>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={records}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                description={
                  <span>
                    暂无评估器
                    <br />
                    <span style={{ fontSize: 12, color: 'rgba(9,25,64,0.45)' }}>
                      点击右上角「新建评估器」开始创建
                    </span>
                  </span>
                }
              />
            ),
          }}
          scroll={{ x: 900 }}
        />

        {total > 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 16,
              paddingTop: 8,
            }}
          >
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={total}
              showSizeChanger={false}
              showTotal={(count) => `共 ${count} 个评估器`}
              onChange={(p) => setPage(p)}
            />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
