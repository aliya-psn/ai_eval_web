import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { evaluatorService } from '@/services/evaluatorService';
import { PageShell, formatTime } from '@/components/page/PageShell';
import '@/components/page/page.css';
import { EvaluatorTypeBadge } from '@/components/evaluators/EvaluatorTypeBadge';
import {
  getEvaluatorTypeMeta,
  type EvaluationRule,
  type LangfuseEvaluator,
} from '@/types/evaluator';

const { Paragraph, Text } = Typography;

function JsonBlock({ value }: { value: unknown }) {
  if (value == null) return <Text type="secondary">-</Text>;
  return (
    <pre
      className="agent-mono"
      style={{
        margin: 0,
        padding: 12,
        background: '#f8fafc',
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.5,
        overflow: 'auto',
        maxHeight: 320,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function EvaluatorDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') ?? '';

  const [loading, setLoading] = useState(false);
  const [evaluator, setEvaluator] = useState<LangfuseEvaluator | null>(null);
  const [rules, setRules] = useState<EvaluationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  const loadEvaluator = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await evaluatorService.get(id);
      setEvaluator(data);
    } catch {
      setEvaluator(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRules = useCallback(async () => {
    if (!id) return;
    setRulesLoading(true);
    try {
      const res = await evaluatorService.listRules({ page: 1, limit: 100 });
      const name = evaluator?.name;
      const filtered = name
        ? res.data.filter((r) => r.evaluator?.name === name)
        : res.data;
      setRules(filtered);
    } catch {
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, [id, evaluator?.name]);

  useEffect(() => {
    void loadEvaluator();
  }, [loadEvaluator]);

  useEffect(() => {
    if (evaluator) void loadRules();
  }, [evaluator, loadRules]);

  const handleDelete = () => {
    if (!evaluator) return;
    Modal.confirm({
      title: '删除评估器',
      content: `确定要删除评估器「${evaluator.name}」吗？该操作不可恢复。`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await evaluatorService.remove(evaluator.id);
        message.success('删除成功');
        navigate('/evaluatorManagement');
      },
    });
  };

  const ruleColumns: ColumnsType<EvaluationRule> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '目标',
      dataIndex: 'target',
      key: 'target',
      width: 140,
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const color = s === 'active' ? 'green' : s === 'paused' ? 'orange' : 'default';
        return <Tag color={color}>{s}</Tag>;
      },
    },
    {
      title: '采样率',
      dataIndex: 'sampling',
      key: 'sampling',
      width: 100,
      render: (v?: number) => (v != null ? `${Math.round(v * 100)}%` : '100%'),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v?: string) => formatTime(v),
    },
  ];

  const meta = getEvaluatorTypeMeta(evaluator?.type);

  if (loading) {
    return (
      <PageShell title="评估器详情" onBack={() => navigate('/evaluatorManagement')}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </PageShell>
    );
  }

  if (!evaluator) {
    return (
      <PageShell title="评估器详情" onBack={() => navigate('/evaluatorManagement')}>
        <Empty description="未找到该评估器" />
      </PageShell>
    );
  }

  const od = evaluator.outputDefinition;
  const scoreDesc =
    od && 'score' in od ? od.score?.description : undefined;
  const reasoningDesc = od?.reasoning?.description;

  return (
    <PageShell
      title={evaluator.name}
      subtitle={`${meta.label} · 版本 v${evaluator.version ?? 1} · 输出类型 ${od?.dataType ?? '-'}`}
      onBack={() => navigate('/evaluatorManagement')}
      backLabel="返回列表"
      extra={
        <Space>
          <EvaluatorTypeBadge type={evaluator.type} />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void loadEvaluator();
              void loadRules();
            }}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/evaluatorForm?id=${evaluator.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除评估器"
            description={`确定删除「${evaluator.name}」？`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={handleDelete}
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <div className="agent-panel">
        <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="名称">{evaluator.name}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <EvaluatorTypeBadge type={evaluator.type} />
            </Descriptions.Item>
            <Descriptions.Item label="版本">
              {evaluator.version != null ? `v${evaluator.version}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="关联规则数">
              {evaluator.evaluationRuleCount ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatTime(evaluator.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {formatTime(evaluator.updatedAt)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card size="small" title="评估配置" style={{ marginBottom: 16 }}>
          {evaluator.type === 'code' ? (
            <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="运行语言">
                <Tag color="purple">{evaluator.sourceCodeLanguage}</Tag>
              </Descriptions.Item>
            </Descriptions>
          ) : null}

          {evaluator.prompt ? (
            <div style={{ marginBottom: 16 }}>
              <Text strong>评估提示词</Text>
              <div style={{ marginTop: 8 }}>
                <JsonBlock value={evaluator.prompt} />
              </div>
            </div>
          ) : null}

          {evaluator.sourceCode ? (
            <div style={{ marginBottom: 16 }}>
              <Text strong>源代码</Text>
              <div style={{ marginTop: 8 }}>
                <JsonBlock value={evaluator.sourceCode} />
              </div>
            </div>
          ) : null}

          {evaluator.modelConfig ? (
            <div style={{ marginBottom: 16 }}>
              <Text strong>模型配置</Text>
              <div style={{ marginTop: 8 }}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Provider">
                    {evaluator.modelConfig.provider || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="模型">
                    {evaluator.modelConfig.model || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>
          ) : null}

          {od ? (
            <div>
              <Text strong>输出定义</Text>
              <div style={{ marginTop: 8 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="数据类型">
                    <Tag color="blue">{od.dataType}</Tag>
                  </Descriptions.Item>
                  {reasoningDesc ? (
                    <Descriptions.Item label="推理说明">
                      {reasoningDesc}
                    </Descriptions.Item>
                  ) : null}
                  {scoreDesc ? (
                    <Descriptions.Item label="评分说明">
                      {scoreDesc}
                    </Descriptions.Item>
                  ) : null}
                  {od.dataType === 'NUMERIC' && 'minValue' in od.score ? (
                    <Descriptions.Item label="评分范围">
                      {od.score.minValue ?? '-∞'} ~ {od.score.maxValue ?? '+∞'}
                    </Descriptions.Item>
                  ) : null}
                  {od.dataType === 'CATEGORICAL' && 'categories' in od.score ? (
                    <Descriptions.Item label="分类选项">
                      <Space wrap>
                        {(od.score.categories ?? []).map((c) => (
                          <Tag key={c} color="blue">
                            {c}
                          </Tag>
                        ))}
                      </Space>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>
              </div>
            </div>
          ) : null}
        </Card>

        <Card
          size="small"
          title="关联评估规则"
          extra={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadRules()}>
              刷新
            </Button>
          }
        >
          <Table<EvaluationRule>
            rowKey="id"
            loading={rulesLoading}
            columns={ruleColumns}
            dataSource={rules}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无关联的评估规则" /> }}
            scroll={{ x: 700 }}
          />
        </Card>
      </div>
    </PageShell>
  );
}
