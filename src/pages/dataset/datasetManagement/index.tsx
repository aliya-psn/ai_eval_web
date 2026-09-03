import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { datasetApi } from '@/api/langfuse';
import { useNamespaceStore } from '@/stores/namespace-store';
import type { Dataset, DatasetListRow } from '@/types/dataset';
import { nameInitials } from '@/components/page/PageShell';
import '@/components/page/page.css';
import JsonSchemaEditor from './JsonSchemaEditor';
import {
  createOptionalJsonRule,
  enrichDatasetsMetrics,
  fetchAllDatasets,
  formatDatasetTime,
  matchDatasetQuery,
  parseOptionalJsonOrThrow,
  previewJson,
  prettyJson,
} from './utils';

const JSON_SCHEMA_DOC_URL = 'https://json-schema.org/learn/miscellaneous-examples';

const DEFAULT_INPUT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      question: { type: 'string' },
    },
    required: ['question'],
    additionalProperties: false,
  },
  null,
  2,
);

const DEFAULT_EXPECTED_OUTPUT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      answer: { type: 'string' },
    },
    required: ['answer'],
    additionalProperties: false,
  },
  null,
  2,
);

function stringifyJsonField(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function JsonPreviewCell({ value }: { value: unknown }) {
  const pretty = prettyJson(value);
  if (!pretty) {
    return <span style={{ color: 'rgba(9,25,64,0.35)' }}>-</span>;
  }

  return (
    <Tooltip
      placement="topLeft"
      mouseEnterDelay={0.15}
      styles={{ root: { maxWidth: 480 } }}
      title={
        <pre
          className="agent-mono"
          style={{
            margin: 0,
            maxHeight: 320,
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
        className="agent-mono dataset-json-preview-cell"
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          verticalAlign: 'bottom',
          cursor: 'default',
          color: 'rgba(9,25,64,0.72)',
        }}
      >
        {previewJson(value, 48)}
      </span>
    </Tooltip>
  );
}

export default function DatasetManagementPage() {
  const navigate = useNavigate();
  const { currentNamespace } = useNamespaceStore();

  const [loading, setLoading] = useState(false);
  const [allRecords, setAllRecords] = useState<Dataset[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, DatasetListRow>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchKey, setSearchKey] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [editing, setEditing] = useState<Dataset | null>(null);
  const [inputSchemaEnabled, setInputSchemaEnabled] = useState(false);
  const [expectedSchemaEnabled, setExpectedSchemaEnabled] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllDatasets();
      setAllRecords(list);
      setMetricsMap({});
    } catch {
      setAllRecords([]);
      setMetricsMap({});
    } finally {
      setLoading(false);
    }
  }, [currentNamespace]);

  useEffect(() => {
    setPage(1);
    void loadData();
  }, [loadData, currentNamespace]);

  const filtered = useMemo(
    () => allRecords.filter((item) => matchDatasetQuery(item, searchKey)),
    [allRecords, searchKey],
  );

  const pageRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // 当前页批量拉取 Items / Experiments / Last Run（tRPC allDatasetsMetrics）
  const tableData: DatasetListRow[] = useMemo(
    () =>
      pageRecords.map((item) => ({
        ...item,
        ...metricsMap[item.id],
        metricsLoading: metricsMap[item.id] == null,
      })),
    [pageRecords, metricsMap],
  );

  useEffect(() => {
    let cancelled = false;
    const missing = pageRecords.filter((item) => !(item.id in metricsMap));
    if (!missing.length) return;

    void (async () => {
      const batch = await enrichDatasetsMetrics(missing);
      if (cancelled) return;
      setMetricsMap((prev) => ({ ...prev, ...batch }));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRecords]);

  const handleSearchChange = (value: string) => {
    setSearchKey(value);
    setPage(1);
  };

  const handleReset = () => {
    setSearchKey('');
    setPage(1);
    void loadData();
  };

  const goDetail = (record: Dataset) => {
    navigate(`/datasetDetail?name=${encodeURIComponent(record.name)}`);
  };

  const openCreate = () => {
    setEditing(null);
    setInputSchemaEnabled(false);
    setExpectedSchemaEnabled(false);
    form.resetFields();
    form.setFieldsValue({
      name: '',
      description: '',
      metadata: '',
      inputSchema: '',
      expectedOutputSchema: '',
    });
    setFormOpen(true);
  };

  const openEdit = (record: Dataset) => {
    setEditing(record);
    const inputSchemaText = stringifyJsonField(record.inputSchema);
    const expectedSchemaText = stringifyJsonField(record.expectedOutputSchema);
    setInputSchemaEnabled(Boolean(inputSchemaText));
    setExpectedSchemaEnabled(Boolean(expectedSchemaText));
    form.setFieldsValue({
      name: record.name,
      description: record.description || '',
      metadata: stringifyJsonField(record.metadata),
      inputSchema: inputSchemaText,
      expectedOutputSchema: expectedSchemaText,
    });
    setFormOpen(true);
  };

  const handleDelete = (record: Dataset) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除数据集「${record.name}」吗？此操作不可恢复。`,
      okType: 'danger',
      okText: "删除",
      cancelText: "取消",
      onOk: async () => {
        try {
          await datasetApi.deleteDataset({
            projectId: record.projectId,
            datasetId: record.id,
          });
          message.success("数据集已删除");
          void loadData();
        } catch (error: unknown) {
          message.error(
            (error instanceof Error && error.message) || "请求失败",
          );
        }
      },
    });
  };

  const jsonRule = useMemo(
    () => createOptionalJsonRule('请输入合法的 JSON 格式'),
    [],
  );

  const handleSave = async () => {
    let values: {
      name: string;
      description?: string;
      metadata?: string;
      inputSchema?: string;
      expectedOutputSchema?: string;
    };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    let metadata: unknown;
    let inputSchema: unknown;
    let expectedOutputSchema: unknown;
    try {
      metadata = parseOptionalJsonOrThrow(values.metadata || '', "元数据");
      inputSchema = inputSchemaEnabled
        ? parseOptionalJsonOrThrow(values.inputSchema || '', "输入结构")
        : null;
      expectedOutputSchema = expectedSchemaEnabled
        ? parseOptionalJsonOrThrow(
            values.expectedOutputSchema || '',
            "期望输出结构",
          )
        : null;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
      return;
    }

    setFormSaving(true);
    try {
      await datasetApi.upsertDataset({
        name: values.name.trim(),
        description: values.description?.trim() || '',
        metadata,
        inputSchema,
        expectedOutputSchema,
      });
      message.success(editing ? "数据集已更新" : "数据集已创建");
      setFormOpen(false);
      void loadData();
    } catch {
      // 错误已由 langfuseRequest toast；此处避免误报成功
    } finally {
      setFormSaving(false);
    }
  };

  const columns: ColumnsType<DatasetListRow> = [
    {
      title: "名称",
      dataIndex: 'name',
      width: 220,
      ellipsis: true,
      fixed: 'left',
      render: (text: string, record) => (
        <div className="agent-name-cell">
          <span className="agent-avatar">{nameInitials(text)}</span>
          <div className="agent-name-text">
            <Button type="link" className="agent-name-link" onClick={() => goDetail(record)}>
              {text}
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: "描述",
      dataIndex: 'description',
      ellipsis: true,
      width: 160,
      render: (value?: string | null) => (
        <span style={{ color: 'rgba(9,25,64,0.55)' }}>{value || '-'}</span>
      ),
    },
    {
      title: "用例数",
      dataIndex: 'itemCount',
      width: 90,
      align: 'center',
      render: (v, record) =>
        record.metricsLoading ? (
          <span style={{ color: 'rgba(9,25,64,0.35)' }}>…</span>
        ) : (
          <span className="agent-version-pill">{v ?? 0}</span>
        ),
    },
    {
      title: "执行记录数",
      dataIndex: 'experimentCount',
      width: 90,
      align: 'center',
      render: (v, record) =>
        record.metricsLoading ? (
          <span style={{ color: 'rgba(9,25,64,0.35)' }}>…</span>
        ) : (
          <span className="agent-version-pill">{v ?? 0}</span>
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
      title: "最近运行时间",
      dataIndex: 'lastRunAt',
      width: 180,
      render: (v, record) =>
        record.metricsLoading ? (
          <span style={{ color: 'rgba(9,25,64,0.35)' }}>…</span>
        ) : (
          <span style={{ color: 'rgba(9,25,64,0.55)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDatasetTime(v)}
          </span>
        ),
    },
    {
      title: "输入结构",
      dataIndex: 'inputSchema',
      width: 160,
      ellipsis: true,
      render: (value) => <JsonPreviewCell value={value} />,
    },
    {
      title: "期望输出结构",
      dataIndex: 'expectedOutputSchema',
      width: 160,
      ellipsis: true,
      render: (value) => <JsonPreviewCell value={value} />,
    },
    {
      title: "元数据",
      dataIndex: 'metadata',
      width: 140,
      ellipsis: true,
      render: (value) => <JsonPreviewCell value={value} />,
    },
    {
      title: "操作",
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} wrap={false}>
          <Button type="link" onClick={() => goDetail(record)}>
            {"详情"}
          </Button>
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
    <div className="agent">
      <div className="agent-shell">
        <header className="agent-page-header">
          <h1 className="agent-title">{"数据集管理"}</h1>
        </header>

        <div className="agent-panel">
            <div className="agent-toolbar">
              <Space wrap size={10}>
                <Input
                  allowClear
                  placeholder={"搜索数据集名称或描述"}
                  value={searchKey}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  style={{ width: 280 }}
                  prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
                />
                <Button icon={<ReloadOutlined />} onClick={handleReset} loading={loading}>
                  {"重置"}
                </Button>
              </Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                {"新建数据集"}
              </Button>
            </div>

            <Table<DatasetListRow>
              rowKey="id"
              loading={loading}
              columns={columns}
              dataSource={tableData}
              scroll={{ x: 1800 }}
              pagination={{
                current: page,
                pageSize,
                total: filtered.length,
                showSizeChanger: true,
                showTotal: (count) => `共 ${count} 条`,
                onChange: (nextPage, nextSize) => {
                  setPage(nextPage);
                  setPageSize(nextSize);
                },
              }}
            />
        </div>

        <Modal
          title={editing ? "编辑数据集" : "新建数据集"}
          open={formOpen}
          onCancel={() => setFormOpen(false)}
          onOk={() => void handleSave()}
          confirmLoading={formSaving}
          okText={editing ? "保存" : "新建"}
          cancelText={"取消"}
          destroyOnClose
          width={640}
        >
          <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item
              name="name"
              label={"名称"}
              rules={[{ required: true, message: "请输入数据集名称" }]}
            >
              <Input
                disabled={Boolean(editing)}
                className={editing ? 'agent-input-readonly' : undefined}
                placeholder={"请输入数据集名称"}
                maxLength={128}
              />
            </Form.Item>
            <Form.Item name="description" label={"描述"}>
              <Input.TextArea rows={2} placeholder={"可选描述"} />
            </Form.Item>
            <Form.Item name="metadata" label={"元数据"}>
              <Input.TextArea
                rows={3}
                className="agent-mono"
                placeholder={"可选，JSON 格式"}
              />
            </Form.Item>

            <Typography.Paragraph
              type="secondary"
              style={{ marginBottom: 12, fontSize: 12 }}
            >
              {"JSON Schema 参考文档："}{' '}
              <Typography.Link href={JSON_SCHEMA_DOC_URL} target="_blank" rel="noreferrer">
                {JSON_SCHEMA_DOC_URL}
              </Typography.Link>
            </Typography.Paragraph>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: inputSchemaEnabled ? 8 : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{"输入结构"}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>
                    {"用 JSON Schema 校验数据集用例的 Input。开启后，新建与已有用例都必须符合该结构。properties 对应 CSV 中的字段名。"}
                  </div>
                </div>
                <Space size={8} style={{ flexShrink: 0, paddingTop: 2 }}>
                  <Switch
                    checked={inputSchemaEnabled}
                    onChange={(checked) => {
                      setInputSchemaEnabled(checked);
                      if (!checked) {
                        form.setFieldValue('inputSchema', '');
                      } else if (!form.getFieldValue('inputSchema')) {
                        form.setFieldValue('inputSchema', DEFAULT_INPUT_SCHEMA);
                      }
                    }}
                  />
                </Space>
              </div>
              {inputSchemaEnabled ? (
                <Form.Item
                  name="inputSchema"
                  rules={[jsonRule]}
                  validateTrigger="onBlur"
                  style={{ marginBottom: 0 }}
                >
                  <JsonSchemaEditor />
                </Form.Item>
              ) : null}
            </div>

            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: expectedSchemaEnabled ? 8 : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{"期望输出结构"}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>
                    {"用 JSON Schema 校验数据集用例的 Expected Output。开启后，新建与已有用例都必须符合该结构。properties 对应 CSV 中的字段名。"}
                  </div>
                </div>
                <Space size={8} style={{ flexShrink: 0, paddingTop: 2 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {expectedSchemaEnabled
                      ? "已启用"
                      : "未启用"}
                  </Typography.Text>
                  <Switch
                    checked={expectedSchemaEnabled}
                    onChange={(checked) => {
                      setExpectedSchemaEnabled(checked);
                      if (!checked) {
                        form.setFieldValue('expectedOutputSchema', '');
                      } else if (!form.getFieldValue('expectedOutputSchema')) {
                        form.setFieldValue(
                          'expectedOutputSchema',
                          DEFAULT_EXPECTED_OUTPUT_SCHEMA,
                        );
                      }
                    }}
                  />
                </Space>
              </div>
              {expectedSchemaEnabled ? (
                <Form.Item
                  name="expectedOutputSchema"
                  rules={[jsonRule]}
                  validateTrigger="onBlur"
                  style={{ marginBottom: 0 }}
                >
                  <JsonSchemaEditor />
                </Form.Item>
              ) : null}
            </div>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
