import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DatePicker,
  Empty,
  Input,
  message,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { traceService, type TraceListRow } from '@/services/traceService';
import { traceApi } from '@/api/langfuse';
import { PageShell } from '@/components/page/PageShell';
import '@/components/page/page.css';
import {
  formatTraceLatency,
  formatTraceTime,
} from '@/utils/traceUtils';

const { RangePicker } = DatePicker;

export default function TraceListPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TraceListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 筛选条件
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userId, setUserId] = useState('');
  const [environments, setEnvironments] = useState<string[]>([]);
  const [traceNames, setTraceNames] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  // Trace 名称筛选模式：select（多选下拉）| text（文本搜索）
  const [nameFilterMode, setNameFilterMode] = useState<'select' | 'text'>('select');

  // input/output 完整内容弹窗
  const [previewContent, setPreviewContent] = useState<{
    title: string;
    content: string;
  } | null>(null);

  // 环境筛选项（来自 projects.environmentFilterOptions）
  const [environmentOptions, setEnvironmentOptions] = useState<string[]>([]);
  // Trace 名称筛选项（来自 traces.filterOptions）
  const [traceNameOptions, setTraceNameOptions] = useState<string[]>([]);

  const loadTraces = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof traceService.fetchTraces>[0] = {
        page,
        limit: pageSize,
      };
      if (nameFilterMode === 'text') {
        if (searchKeyword) params.name = searchKeyword;
      } else if (traceNames.length) {
        params.name = traceNames;
      }
      if (userId.trim()) params.userId = userId.trim();
      if (environments.length) params.environment = environments.join(',');
      if (timeRange?.[0]) params.fromTimestamp = timeRange[0].toISOString();
      if (timeRange?.[1]) params.toTimestamp = timeRange[1].toISOString();
      const res = await traceService.fetchTraces(params);
      setRows(res.rows);
      setTotal(res.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchKeyword, userId, environments, traceNames, timeRange, nameFilterMode]);

  useEffect(() => {
    void loadTraces();
  }, [loadTraces]);

  // 从已加载 Trace 中取 projectId，拉取环境筛选项
  useEffect(() => {
    const projectId = rows.find((r) => r.projectId)?.projectId;
    if (!projectId) return;
    let cancelled = false;
    void traceApi
      .getEnvironmentFilterOptions({ projectId })
      .then((values) => {
        // 防御：确保状态始终为合法数组，避免渲染时对 undefined 调用方法
        if (!cancelled) setEnvironmentOptions(Array.isArray(values) ? values : []);
      })
      .catch(() => {
        if (!cancelled) setEnvironmentOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  // 从已加载 Trace 中取 projectId，拉取 Trace 名称筛选项（支持多选）
  useEffect(() => {
    const projectId = rows.find((r) => r.projectId)?.projectId;
    if (!projectId) return;
    let cancelled = false;
    void traceApi
      .getTraceNameFilterOptions({
        projectId,
        fromTimestamp: timeRange?.[0]?.toISOString(),
        toTimestamp: timeRange?.[1]?.toISOString(),
      })
      .then((values) => {
        if (!cancelled) setTraceNameOptions(Array.isArray(values) ? values : []);
      })
      .catch(() => {
        if (!cancelled) setTraceNameOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [rows, timeRange]);

  const handleSearch = () => {
    setPage(1);
    setSearchKeyword(keyword.trim());
  };

  const handleReset = () => {
    setKeyword('');
    setSearchKeyword('');
    setUserId('');
    setEnvironments([]);
    setTraceNames([]);
    setTimeRange(null);
    setPage(1);
  };

  // 切换 Trace 名称筛选模式时，清空另一种模式的值
  const handleNameFilterModeChange = (mode: 'select' | 'text') => {
    setNameFilterMode(mode);
    if (mode === 'select') {
      setKeyword('');
      setSearchKeyword('');
    } else {
      setTraceNames([]);
    }
    setPage(1);
  };

  const openDetail = (traceId: string) => {
    navigate(`/trace/detail?traceId=${encodeURIComponent(traceId)}`);
  };

  const openObservation = (traceId: string) => {
    navigate(`/trace/observation?traceId=${encodeURIComponent(traceId)}`);
  };

  const handleDelete = (record: TraceListRow) => {
    Modal.confirm({
      title: '删除 Trace',
      content: `确定要删除 Trace「${record.name || record.id}」吗？该操作不可恢复。`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await traceService.remove(record.id);
        message.success('删除成功');
        void loadTraces();
      },
    });
  };

  // 将 Trace 的 input 格式化为可读文本（数组取 content 字段，对象 JSON 序列化）
  const formatTraceInput = (input: unknown): string => {
    if (input == null) return '';
    if (Array.isArray(input)) {
      return input
        .map((item) => {
          if (item && typeof item === 'object') {
            const obj = item as { content?: unknown };
            if (typeof obj.content === 'string') return obj.content;
          }
          return typeof item === 'string' ? item : JSON.stringify(item);
        })
        .filter(Boolean)
        .join('\n');
    }
    if (typeof input === 'string') return input;
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  // 将 Trace 的 output 格式化为可读文本（取 reason 字段）
  const formatTraceOutput = (output: unknown): string => {
    if (output == null) return '';
    if (typeof output === 'string') return output;
    if (typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      if (obj.reasoning != null) return String(obj.reasoning);
    }
  };

  // 取 Trace 的 output 中的 score 字段作为输出打分
  const getOutputScore = (output: unknown): string => {
    if (output == null || typeof output !== 'object') return '';
    const obj = output as Record<string, unknown>;
    return obj.score == null ? '' : String(obj.score);
  };

  // 渲染可查看的文本单元格（截断 + 弹窗查看完整内容）
  const renderExpandableText = (text: string, title: string) => {
    if (!text) return <span style={{ color: 'rgba(9,25,64,0.35)' }}>-</span>;
    return (
      <div>
        <Typography.Paragraph
          style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}
          ellipsis={{ rows: 3, tooltip: false }}
        >
          {text}
        </Typography.Paragraph>
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => setPreviewContent({ title, content: text })}
        >
          查看完整内容
        </Button>
      </div>
    );
  };

  const columns: ColumnsType<TraceListRow> = useMemo(
    () => [
      {
        title: 'Trace 名称',
        dataIndex: 'name',
        ellipsis: true,
        fixed: 'left',
        width: 260,
        render: (text: string, record) => (
          <button
            type="button"
            className="agent-table-link"
            onClick={() => openDetail(record.id)}
            title={text || record.id}
          >
            {text || record.id}
          </button>
        ),
      },
      {
        title: 'Trace ID',
        dataIndex: 'id',
        width: 200,
        ellipsis: true,
        render: (id: string) => (
          <span className="agent-mono" title={id}>
            {id}
          </span>
        ),
      },
      {
        title: '耗时',
        dataIndex: 'latency',
        width: 90,
        sorter: (a, b) => (a.latency ?? 0) - (b.latency ?? 0),
        render: (v?: number | null) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatTraceLatency(v)}
          </span>
        ),
      },
      {
        title: '输入',
        dataIndex: 'input',
        width: 320,
        render: (v: unknown, record) =>
          renderExpandableText(formatTraceInput(v), `输入 - ${record.name || record.id}`),
      },
      {
        title: '输出',
        dataIndex: 'output',
        width: 320,
        render: (v: unknown) => {
          const text = formatTraceOutput(v);
          if (!text) return <span style={{ color: 'rgba(9,25,64,0.35)' }}>-</span>;
          return (
            <Typography.Paragraph
              style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
              ellipsis={{ rows: 3, tooltip: false }}
            >
              {text}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: '评分',
        dataIndex: 'output',
        width: 80,
        render: (v: unknown) => {
          const score = getOutputScore(v);
          if (!score) return <span style={{ color: 'rgba(9,25,64,0.35)' }}>-</span>;
          return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score}</span>;
        },
      },
       {
        title: '时间',
        dataIndex: 'timestamp',
        width: 180,
        sorter: (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        render: (v: string) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatTraceTime(v)}
          </span>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        fixed: 'right',
        render: (_, record) => (
          <Space size={0}>
            <Button type="link" onClick={() => openDetail(record.id)}>
              详情
            </Button>
            <Button type="link" onClick={() => openObservation(record.id)}>
              Observation
            </Button>
            <Button type="link" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <PageShell
      title="Trace 追踪"
      extra={
        <Space size={8}>
          <Button icon={<ReloadOutlined />} onClick={() => void loadTraces()}>
            刷新
          </Button>
        </Space>
      }
    >
      <div className="agent-panel">
        <div className="agent-toolbar">
          <Space size={8} wrap>
            <Space.Compact>
              <Segmented
                value={nameFilterMode}
                onChange={(v) => handleNameFilterModeChange(v as 'select' | 'text')}
                options={[
                  { label: 'Select', value: 'select' },
                  { label: 'Text', value: 'text' },
                ]}
              />
              {nameFilterMode === 'select' ? (
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  placeholder="Trace 名称"
                  value={traceNames}
                  onChange={(v) => {
                    setTraceNames(v);
                    setPage(1);
                  }}
                  style={{ width: 260 }}
                  options={(traceNameOptions ?? []).map((n) => ({ label: n, value: n }))}
                />
              ) : (
                <Input
                  allowClear
                  placeholder="Trace 名称"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 260 }}
                  prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
                />
              )}
            </Space.Compact>
            <Select
              mode="multiple"
              allowClear
              placeholder="环境"
              value={environments}
              onChange={(v) => {
                setEnvironments(v);
                setPage(1);
              }}
              style={{ width: 320 }}
              options={(environmentOptions ?? []).map((e) => ({ label: e, value: e }))}
            />
            <RangePicker
              showTime
              value={timeRange}
              onChange={(v) => setTimeRange(v as [Dayjs | null, Dayjs | null] | null)}
              style={{ width: 320 }}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
          <span style={{ color: 'rgba(9,25,64,0.55)', fontSize: 12 }}>
            共 {total} 条
          </span>
        </div>

        <Table<TraceListRow>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1400 }}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (n) => `共 ${n} 条`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无 Trace 数据"
                style={{ padding: 24 }}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </div>

      {/* input/output 完整内容弹窗 */}
      <Modal
        open={!!previewContent}
        title={previewContent?.title}
        onCancel={() => setPreviewContent(null)}
        footer={null}
        width={720}
        styles={{ body: { maxHeight: '60vh', overflow: 'auto' } }}
      >
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {previewContent?.content}
        </pre>
      </Modal>
    </PageShell>
  );
}
