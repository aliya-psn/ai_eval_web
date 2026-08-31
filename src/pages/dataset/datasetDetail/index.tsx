import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Descriptions, Empty, Input, Select, Space, Spin, Tabs, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  ExperimentOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { datasetApi } from '@/api/langfuse';
import type { Dataset, DatasetStatus } from '@/types/dataset';
import {
  AgentPageShell,
  AgentSection,
  agentInitials,
} from '@/pages/agentManagement/AgentPageShell';
import '@/pages/agentManagement/agent.css';
import { formatDatasetTime, previewJson, prettyJson } from '@/pages/dataset/datasetManagement/utils';
import { ExperimentsPanel } from './experiments/ExperimentsPanel';
import { RunExperimentModal } from './experiments/RunExperimentModal';
import { ItemsPanel } from './items/ItemsPanel';

const ITEMS_SEARCH_DEBOUNCE_MS = 300;
type ItemsStatusFilter = 'all' | DatasetStatus;

function SchemaJsonPreview({ value }: { value: unknown }) {
  const pretty = prettyJson(value);
  if (!pretty) {
    return <span style={{ color: 'rgba(9,25,64,0.35)' }}>-</span>;
  }

  return (
    <Tooltip
      placement="topLeft"
      mouseEnterDelay={0.15}
      styles={{ root: { maxWidth: 520 } }}
      title={
        <pre
          className="agent-mono"
          style={{
            margin: 0,
            maxHeight: 360,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {pretty}
        </pre>
      }
    >
      <span
        className="agent-mono"
        style={{
          display: 'block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'default',
          color: 'rgba(9,25,64,0.78)',
        }}
      >
        {previewJson(value, 64)}
      </span>
    </Tooltip>
  );
}

export default function DatasetDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const datasetName = searchParams.get('name') || '';

  const [loading, setLoading] = useState(false);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [experimentsRefreshKey, setExperimentsRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('items');
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [itemsSearchInput, setItemsSearchInput] = useState('');
  const [itemsSearchQuery, setItemsSearchQuery] = useState('');
  const [itemsStatusFilter, setItemsStatusFilter] = useState<ItemsStatusFilter>('all');

  const loadDetail = useCallback(async () => {
    if (!datasetName) {
      setDataset(null);
      return;
    }
    setLoading(true);
    try {
      const data = await datasetApi.getDataset(datasetName);
      setDataset(data);
    } catch {
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }, [datasetName]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItemsSearchQuery(itemsSearchInput.trim());
    }, ITEMS_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [itemsSearchInput]);

  const displayName = dataset?.name || datasetName || "数据集";

  if (!datasetName) {
    return (
      <AgentPageShell title={"数据集"} onBack={() => navigate('/datasetManagement')}>
        <div className="agent-section">
          <Empty style={{ padding: 48 }} description={"缺少数据集名称"} />
        </div>
      </AgentPageShell>
    );
  }

  return (
    <AgentPageShell
      title={displayName}
      onBack={() => navigate('/datasetManagement')}
      extra={
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          disabled={!dataset}
          onClick={() => setRunOpen(true)}
        >
          {"开始执行"}
        </Button>
      }
    >
      <Spin spinning={loading}>
        {!dataset && !loading ? (
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description={"未找到该数据集"} />
          </div>
        ) : dataset ? (
          <AgentSection title={"基本信息"}>
            <div className="agent-detail-hero">
              <div className="agent-detail-avatar">{agentInitials(dataset.name)}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#091940' }}>
                  {dataset.name}
                </div>
                {dataset.description ? (
                  <div style={{ marginTop: 6, color: 'rgba(9,25,64,0.55)', fontSize: 13 }}>
                    {dataset.description}
                  </div>
                ) : null}
              </div>
            </div>

            <Descriptions
              className="dataset-detail-desc"
              size="small"
              column={{ xs: 1, sm: 2, lg: 3 }}
              style={{ marginTop: 16 }}
              styles={{
                label: { color: 'rgba(9,25,64,0.48)', width: 92 },
              }}
            >
              <Descriptions.Item label="ID">
                <span className="agent-mono">{dataset.id}</span>
              </Descriptions.Item>
              <Descriptions.Item label={"创建时间"}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatDatasetTime(dataset.createdAt)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label={"更新时间"}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatDatasetTime(dataset.updatedAt)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label={"输入结构"}>
                <SchemaJsonPreview value={dataset.inputSchema} />
              </Descriptions.Item>
              <Descriptions.Item label={"期望输出结构"}>
                <SchemaJsonPreview value={dataset.expectedOutputSchema} />
              </Descriptions.Item>
              <Descriptions.Item label={"元数据"}>
                <SchemaJsonPreview value={dataset.metadata} />
              </Descriptions.Item>
            </Descriptions>
          </AgentSection>
        ) : null}
      </Spin>

      <div className="agent-panel">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            activeTab === 'items' ? (
              <Space size={10} wrap>
                <Select
                  value={itemsStatusFilter}
                  onChange={setItemsStatusFilter}
                  style={{ width: 120 }}
                  options={[
                    { value: 'all', label: "全部" },
                    { value: 'ACTIVE', label: "启用" },
                    { value: 'ARCHIVED', label: "已归档" },
                  ]}
                />
                <Input
                  allowClear
                  value={itemsSearchInput}
                  onChange={(e) => setItemsSearchInput(e.target.value)}
                  placeholder={"按 ID / Input / Output 搜索"}
                  prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
                  style={{ width: 280 }}
                />
                <Button
                  icon={<UploadOutlined />}
                  disabled={!dataset?.id || !dataset?.projectId}
                  onClick={() => setCsvOpen(true)}
                >
                  {"上传 CSV"}
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateItemOpen(true)}
                >
                  {"新增用例"}
                </Button>
              </Space>
            ) : null
          }
          items={[
            {
              key: 'items',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <UnorderedListOutlined />
                  {"用例列表"}
                </span>
              ),
              children: (
                <div className="agent-panel-inner">
                  <ItemsPanel
                    datasetName={datasetName}
                    datasetId={dataset?.id}
                    projectId={dataset?.projectId}
                    inputSchema={dataset?.inputSchema}
                    expectedOutputSchema={dataset?.expectedOutputSchema}
                    searchQuery={itemsSearchQuery}
                    statusFilter={itemsStatusFilter}
                    createOpen={createItemOpen}
                    csvOpen={csvOpen}
                    onCreateClose={() => setCreateItemOpen(false)}
                    onCsvClose={() => setCsvOpen(false)}
                  />
                </div>
              ),
            },
            {
              key: 'experiments',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ExperimentOutlined />
                  {"执行记录"}
                </span>
              ),
              // forceRender：默认展示用例列表，但预先加载执行记录，切换时无需等待
              forceRender: true,
              children: (
                <div className="agent-panel-inner">
                  <ExperimentsPanel
                    datasetName={datasetName}
                    datasetId={dataset?.id}
                    projectId={dataset?.projectId}
                    refreshKey={experimentsRefreshKey}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <RunExperimentModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        dataset={dataset}
        onSuccess={() => {
          setActiveTab('experiments');
          setExperimentsRefreshKey((k) => k + 1);
        }}
      />
    </AgentPageShell>
  );
}
