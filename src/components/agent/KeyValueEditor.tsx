import { Button, Input, Select, Space, Table } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { HttpParamType } from '@/types/adminAgent';

export interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  type?: HttpParamType;
}

const PARAM_TYPES: HttpParamType[] = [
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'OBJECT',
  'ARRAY',
];

export function createEmptyKvRow(withType = false): KeyValueRow {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key: '',
    value: '',
    ...(withType ? { type: 'STRING' as HttpParamType } : {}),
  };
}

export function recordToKvRows(
  record?: Record<string, string> | null,
  withType = false,
): KeyValueRow[] {
  if (!record || Object.keys(record).length === 0) {
    return [createEmptyKvRow(withType)];
  }
  return Object.entries(record).map(([key, value]) => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${key}`,
    key,
    value: value ?? '',
    ...(withType ? { type: 'STRING' as HttpParamType } : {}),
  }));
}

export function kvRowsToRecord(rows: KeyValueRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  rows.forEach((row) => {
    const k = row.key.trim();
    if (k) {
      result[k] = row.value;
    }
  });
  return result;
}

interface KeyValueEditorProps {
  value: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  readOnly?: boolean;
  /** Params 场景：展示类型列，支持 STRING / NUMBER 等 */
  showType?: boolean;
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  readOnly = false,
  showType = false,
}: KeyValueEditorProps) {
  const updateRow = (id: string, patch: Partial<KeyValueRow>) => {
    onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    const next = value.filter((row) => row.id !== id);
    onChange(next.length ? next : [createEmptyKvRow(showType)]);
  };

  const columns: ColumnsType<KeyValueRow> = [
    {
      title: 'KEY',
      dataIndex: 'key',
      render: (_, record) =>
        readOnly ? (
          <span>{record.key}</span>
        ) : (
          <Input
            value={record.key}
            placeholder={keyPlaceholder}
            onChange={(e) => updateRow(record.id, { key: e.target.value })}
          />
        ),
    },
  ];

  if (showType) {
    columns.push({
      title: 'TYPE',
      dataIndex: 'type',
      width: 140,
      render: (_, record) =>
        readOnly ? (
          <span>{record.type || 'STRING'}</span>
        ) : (
          <Select
            value={record.type || 'STRING'}
            style={{ width: '100%' }}
            options={PARAM_TYPES.map((t) => ({ label: t, value: t }))}
            onChange={(type: HttpParamType) => updateRow(record.id, { type })}
          />
        ),
    });
  }

  columns.push({
    title: 'VALUE',
    dataIndex: 'value',
    render: (_, record) =>
      readOnly ? (
        <span>{record.value}</span>
      ) : (
        <Input
          value={record.value}
          placeholder={valuePlaceholder}
          onChange={(e) => updateRow(record.id, { value: e.target.value })}
        />
      ),
  });

  if (!readOnly) {
    columns.push({
      title: '',
      width: 56,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeRow(record.id)}
        />
      ),
    });
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={value}
        columns={columns}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      />
      {!readOnly && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => onChange([...value, createEmptyKvRow(showType)])}
          block
          style={{ borderRadius: 8 }}
        >
          添加一行
        </Button>
      )}
    </Space>
  );
}
