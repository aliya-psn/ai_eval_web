import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Tree,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'react';
import { BarChartOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { reportService } from '@/services/reportService';
import { datasetApi } from '@/api/langfuse';
import {
  enrichRunsMetrics,
  fetchAllDatasets,
  formatDatasetTime,
  formatLatencySeconds,
  previewJson,
} from '@/pages/dataset/datasetManagement/utils';
import type { Dataset, DatasetRunListRow } from '@/types/dataset';
import type { ReportRecord } from '@/types/report';
import { PageShell } from '@/components/page/PageShell';
import '@/components/page/page.css';

/** 评分列标题：只展示第一个 `-` 之前的部分 */
function formatScoreTitle(name: string) {
  const idx = name.indexOf('-');
  return idx === -1 ? name : name.slice(0, idx);
}

/** 从评分记录中提取数值展示 */
function scoreDisplay(score?: { displayValue?: string; average?: number | null }) {
  if (!score) return <span style={{ color: 'rgba(9,25,64,0.35)' }}>∅</span>;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score.displayValue}</span>
  );
}

/** 将 tRPC 拉取的 run 行补上数据集信息，转为 ReportRecord */
function toReportRecord(row: DatasetRunListRow, ds: Dataset): ReportRecord {
  return {
    ...row,
    datasetName: ds.name,
    datasetId: ds.id,
    projectId: ds.projectId,
  } as ReportRecord;
}

export default function ReportListPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // 是否处于详情/对比子路由（此时以浮层展示，列表保持挂载）
  const overlayActive = pathname.endsWith('/detail') || pathname.endsWith('/compare');

  // —— 左侧：数据集 ——
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetKeyword, setDatasetKeyword] = useState('');

  // —— 右侧：当前选中数据集下的执行记录 ——
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runs, setRuns] = useState<ReportRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    try {
      const list = await fetchAllDatasets();
      setDatasets(list);
    } catch {
      setDatasets([]);
    } finally {
      setDatasetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  // 点击数据集：拉取该数据集下的执行记录并补充评分指标
  const handleSelectDataset = useCallback(
    async (ds: Dataset) => {
      setSelectedDataset(ds);
      setRunsLoading(true);
      setRuns([]);
      setSelectedRowKeys([]);
      setPage(1);
      try {
        const res = await datasetApi.listRuns({
          datasetName: ds.name,
          page: 1,
          limit: 100,
        });
        const runs = res?.data ?? [];
        let rows: DatasetRunListRow[] = runs;
        if (runs.length && ds.projectId && ds.id) {
          try {
            rows = await enrichRunsMetrics(runs, {
              projectId: ds.projectId,
              datasetId: ds.id,
            });
          } catch {
            rows = runs;
          }
        }
        setRuns(rows.map((r) => toReportRecord(r, ds)));
      } catch {
        setRuns([]);
      } finally {
        setRunsLoading(false);
      }
    },
    [],
  );

  // 进入页面默认选中第一个数据集
  useEffect(() => {
    if (datasets.length && !selectedDataset) {
      void handleSelectDataset(datasets[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, selectedDataset]);

  const filteredDatasets = useMemo(
    () =>
      datasets.filter((d) => {
        const q = datasetKeyword.trim().toLowerCase();
        if (!q) return true;
        return d.name.toLowerCase().includes(q);
      }),
    [datasets, datasetKeyword],
  );

  const treeData: DataNode[] = useMemo(
    () =>
      filteredDatasets.map((d) => ({
        key: d.id,
        title: d.name,
        isLeaf: true,
      })),
    [filteredDatasets],
  );

  const handleSearch = () => {
    setPage(1);
    setSearchKeyword(keyword.trim());
  };

  const handleReset = () => {
    setKeyword('');
    setSearchKeyword('');
    setPage(1);
    setSelectedRowKeys([]);
  };

  const openDetail = (record: ReportRecord) => {
    const params = new URLSearchParams({
      datasetName: record.datasetName || '',
      runName: record.name,
    });
    if (record.id) params.set('runId', record.id);
    if (record.datasetId) params.set('datasetId', record.datasetId);
    if (record.projectId) params.set('projectId', record.projectId);
    navigate(`/report/detail?${params.toString()}`);
  };

  const handleCompare = () => {
    if (selectedRowKeys.length !== 2) {
      message.warning('请勾选两条执行记录进行基线对比');
      return;
    }
    const selected = runs.filter((r) => selectedRowKeys.includes(r.id));
    if (selected.length !== 2) {
      message.warning('请勾选两条执行记录进行基线对比');
      return;
    }
    const params = new URLSearchParams();
    selected.forEach((r, i) => {
      params.set(`datasetName${i + 1}`, r.datasetName || '');
      params.set(`runName${i + 1}`, r.name);
      if (r.id) params.set(`runId${i + 1}`, r.id);
      if (r.datasetId) params.set(`datasetId${i + 1}`, r.datasetId);
      if (r.projectId) params.set(`projectId${i + 1}`, r.projectId);
    });
    navigate(`/report/compare?${params.toString()}`);
  };

  const scoreNames = useMemo(() => {
    const names = new Set<string>();
    runs.forEach((row) => {
      Object.keys(row.runScores ?? {}).forEach((n) => names.add(n));
      Object.keys(row.runItemScores ?? {}).forEach((n) => names.add(n));
    });
    return Array.from(names).sort();
  }, [runs]);

  const columns: ColumnsType<ReportRecord> = useMemo(() => {
    const base: ColumnsType<ReportRecord> = [
      {
        title: '执行记录名称',
        dataIndex: 'name',
        ellipsis: true,
        fixed: 'left',
        width: 300,
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
        title: '执行数',
        dataIndex: 'countRunItems',
        width: 80,
        render: (v?: number) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v ?? '-'}</span>
        ),
      },
      {
        title: '耗时(平均)',
        dataIndex: 'avgLatency',
        width: 120,
        render: (v?: number | null) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatLatencySeconds(v)}
          </span>
        ),
      },
      ...scoreNames.map(
        (name): ColumnsType<ReportRecord>[number] => ({
          title: formatScoreTitle(name),
          key: `score-${name}`,
          width: 140,
          ellipsis: true,
          render: (_, row) =>
            scoreDisplay(row.runScores?.[name] ?? row.runItemScores?.[name]),
        }),
      ),
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 170,
        render: (v: string) => (
          <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDatasetTime(v)}
          </span>
        ),
      },
      {
        title: '元数据',
        dataIndex: 'metadata',
        width: 160,
        ellipsis: true,
        render: (v) => (
          <span className="agent-mono" title={previewJson(v, 2000)}>
            {previewJson(v)}
          </span>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 80,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" onClick={() => openDetail(record)}>
            详情
          </Button>
        ),
      },
    ];
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreNames]);

  const visibleRuns = useMemo(() => {
    if (!searchKeyword) return runs;
    const kw = searchKeyword.toLowerCase();
    return runs.filter(
      (r) =>
        r.name.toLowerCase().includes(kw) ||
        (r.datasetName || '').toLowerCase().includes(kw),
    );
  }, [runs, searchKeyword]);

  const headerAction = (
    <Space size={8}>
      <Button icon={<ReloadOutlined />} onClick={() => void loadDatasets()}>
        刷新数据集
      </Button>
      <Button
        type="primary"
        icon={<BarChartOutlined />}
        disabled={selectedRowKeys.length !== 2}
        onClick={handleCompare}
      >
        基线对比
      </Button>
    </Space>
  );

  return (
    <PageShell
      title="测试报告"
      extra={headerAction}
    >
      <div style={{ position: 'relative' }}>
        <div className="report-split">
        {/* 左侧：数据集树 */}
        <div className="agent-panel report-panel report-col" style={{ width: 344, flexShrink: 0 }}>
          <div className="report-panel-head">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)',
                display: 'inline-block',
                marginRight: 6,
              }}
            />
            <span style={{ fontWeight: 600, color: 'rgba(9,25,64,0.85)' }}>数据集</span>
            <span style={{ color: 'rgba(9,25,64,0.4)', fontSize: 12 }}>
              {filteredDatasets.length} 个
            </span>
          </div>
          <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
            <Input
              allowClear
              placeholder="搜索数据集"
              value={datasetKeyword}
              onChange={(e) => setDatasetKeyword(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
            />
          </div>
          <div className="report-tree report-col-scroll">
            {datasetsLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Spin />
              </div>
            ) : (
              <Tree
                showIcon
                treeData={treeData}
                defaultExpandAll
                selectedKeys={selectedDataset ? [selectedDataset.id] : []}
                onSelect={(keys) => {
                  const d = filteredDatasets.find((x) => x.id === keys[0]);
                  if (d) void handleSelectDataset(d);
                }}
                blockNode
              />
            )}
            {!datasetsLoading && treeData.length === 0 && (
              <Empty
                style={{ padding: '40px 0' }}
                description="暂无可报告的数据集"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </div>

        {/* 右侧：选中数据集的执行记录表格 */}
        <div className="agent-panel report-panel report-col" style={{ flex: 1, minWidth: 0 }}>
          {!selectedDataset ? (
            <Empty
              style={{ padding: '110px 0' }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <>
              <div className="report-panel-head">
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  {selectedDataset.name}
                </Tag>
                <span style={{ color: 'rgba(9,25,64,0.55)', fontSize: 12 }}>
                  共 {runs.length} 条执行记录
                </span>
                <span style={{ flex: 1 }} />
                <Input
                  allowClear
                  placeholder="搜索执行记录名称"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 240 }}
                  prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
                />
                <Button type="primary" onClick={handleSearch}>
                  搜索
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </div>

              {selectedRowKeys.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '10px 16px 0',
                  }}
                >
                  <Space size={8}>
                    <span style={{ color: 'rgba(9,25,64,0.55)', fontSize: 12 }}>
                      已选择 {selectedRowKeys.length} 项
                      {selectedRowKeys.length === 2 ? '，可进行基线对比' : '，请再选择 1 项'}
                    </span>
                    <Button size="small" onClick={() => setSelectedRowKeys([])}>
                      取消
                    </Button>
                  </Space>
                </div>
              ) : null}

              <div className="report-col-scroll" style={{ padding: '12px 12px 16px' }}>
                {runsLoading ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '64px 0',
                    }}
                  >
                    <Spin>
                      <div style={{ padding: '48px 0' }}>数据加载中…</div>
                    </Spin>
                  </div>
                ) : (
                  <Table<ReportRecord>
                    rowKey="id"
                    loading={runsLoading}
                    columns={columns}
                    dataSource={visibleRuns}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys,
                    }}
                    pagination={{
                      current: page,
                      pageSize,
                      total: visibleRuns.length,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50, 100],
                      showTotal: (total) => `共 ${total} 条`,
                      onChange: (nextPage, nextPageSize) => {
                        setPage(nextPage);
                        setPageSize(nextPageSize);
                      },
                    }}
                    scroll={{ x: 1200 }}
                    locale={{
                      emptyText: (
                        <Empty
                          description={
                            <span>
                              该数据集暂无执行记录
                              <br />
                              <span style={{ fontSize: 12, color: 'rgba(9,25,64,0.45)' }}>
                                请先在数据集详情中执行实验生成执行记录
                              </span>
                            </span>
                          }
                        />
                      ),
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 详情 / 对比 子路由浮层：列表保持挂载，返回时不变、不重新请求 */}
      {overlayActive && (
        <div className="report-overlay">
          <Outlet />
        </div>
      )}
      </div>
    </PageShell>
  );
}
