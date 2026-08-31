import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InboxOutlined, LeftOutlined } from '@ant-design/icons';
import { datasetApi } from '@/api/langfuse';
import {
  MAX_FILE_SIZE_BYTES,
  buildFieldFromColumns,
  guessDefaultColumns,
  parseCsvFile,
  type CsvPreviewResult,
} from './csvHelpers';

interface UploadCsvModalProps {
  open: boolean;
  datasetId: string;
  projectId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'map';

/** 对齐 Langfuse：按 payload 大小分块，避免单次过大 */
const CHUNK_START_SIZE = 50; // 初始分块大小
const MIN_CHUNK_SIZE = 1; // 最小分块大小
const MAX_PAYLOAD_SIZE = 500 * 1024; // 500KB 限制，避免单次过大
const DELAY_BETWEEN_CHUNKS_MS = 100; // 100ms 间隔，避免单次过大

/**
 * 获取最优分块大小
 * @param items 数据集 items
 * @param startSize 初始分块大小
 * @returns 最优分块大小
 */
function getOptimalChunkSize(items: unknown[], startSize: number): number {
  const getPayloadSize = (size: number) =>
    new TextEncoder().encode(
      JSON.stringify({
        projectId: 'test',
        items: items.slice(0, size),
      }),
    ).length;

  let low = MIN_CHUNK_SIZE;
  let high = Math.min(startSize, items.length);
  let best = MIN_CHUNK_SIZE;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (getPayloadSize(mid) <= MAX_PAYLOAD_SIZE) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

export function UploadCsvModal({
  open,
  datasetId,
  projectId,
  onClose,
  onSuccess,
}: UploadCsvModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [inputCols, setInputCols] = useState<string[]>([]);
  const [expectedCols, setExpectedCols] = useState<string[]>([]);
  const [metadataCols, setMetadataCols] = useState<string[]>([]);
  const [wrapSingleColumn, setWrapSingleColumn] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const reset = useCallback(() => {
    setStep('upload');
    setParsing(false);
    setImporting(false);
    setPreview(null);
    setInputCols([]);
    setExpectedCols([]);
    setMetadataCols([]);
    setProgress({ processed: 0, total: 0 });
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const columnOptions = useMemo(
    () => (preview?.columns ?? []).map((name) => ({ label: name, value: name })),
    [preview],
  );

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      message.error("请上传 CSV 文件");
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      message.error("文件过大，最大支持 10MB");
      return false;
    }

    setParsing(true);
    try {
      const result = await parseCsvFile(file);
      if (result.rows.length === 0) {
        message.error("CSV 没有数据行");
        return false;
      }
      const guessed = guessDefaultColumns(result.columns);
      setPreview(result);
      setInputCols(guessed.input);
      setExpectedCols(guessed.expectedOutput);
      setMetadataCols(guessed.metadata);
      setStep('map');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'FILE_TOO_LARGE') message.error("文件过大，最大支持 10MB");
      else if (code === 'CSV_EMPTY' || code === 'CSV_NO_COLUMNS') {
        message.error("CSV 文件为空或缺少表头");
      } else {
        message.error("CSV 解析失败");
      }
    } finally {
      setParsing(false);
    }
    return false;
  };

  const previewColumns: ColumnsType<Record<string, string>> = useMemo(() => {
    if (!preview) return [];
    return preview.columns.map((col) => ({
      title: col,
      dataIndex: col,
      ellipsis: true,
      width: 160,
      render: (v: string) => <span className="agent-mono">{v || '-'}</span>,
    }));
  }, [preview]);

  const previewData = useMemo(() => {
    if (!preview) return [];
    return preview.previewRows.map((row, idx) => {
      const record: Record<string, string> = { key: String(idx) };
      preview.columns.forEach((col, colIdx) => {
        record[col] = row[colIdx] ?? '';
      });
      return record;
    });
  }, [preview]);

  const canImport =
    Boolean(preview) &&
    (inputCols.length > 0 || expectedCols.length > 0 || metadataCols.length > 0);

  /**
   * 导入 CSV 文件
   * @returns void
   */
  const handleImport = async () => {
    if (!preview || !canImport) return;
    if (!datasetId || !projectId) {
      message.error("缺少数据集 ID，请刷新页面后重试");
      return;
    }

    const headerMap = new Map(preview.columns.map((c, i) => [c, i]));
    const missing = [...inputCols, ...expectedCols, ...metadataCols].filter(
      (c) => !headerMap.has(c),
    );
    if (missing.length > 0) {
      message.error(`缺少列：${missing.join(', ')}`);
      return;
    }

    const items = preview.rows.map((row) => {
      const input = buildFieldFromColumns(inputCols, row, headerMap, wrapSingleColumn);
      const expectedOutput = buildFieldFromColumns(
        expectedCols,
        row,
        headerMap,
        wrapSingleColumn,
      );
      const metadata = buildFieldFromColumns(
        metadataCols,
        row,
        headerMap,
        wrapSingleColumn,
      );
      return {
        datasetId,
        input: JSON.stringify(input),
        expectedOutput: JSON.stringify(expectedOutput),
        metadata: JSON.stringify(metadata),
      };
    });

    setImporting(true);
    setProgress({ processed: 0, total: items.length });

    let processed = 0;
    try {
      const chunkSize = getOptimalChunkSize(items, CHUNK_START_SIZE);
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await datasetApi.createManyItems({
          projectId,
          items: chunk,
        });
        processed += chunk.length;
        setProgress({ processed, total: items.length });
        if (i + chunkSize < items.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));
        }
      }
      message.success(`成功导入 ${processed} 条 Items`);
      onClose();
      onSuccess?.();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : `导入中断：已成功 ${processed} / ${items.length} 条，请检查后重试`,
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      title={"上传 CSV"}
      open={open}
      onCancel={onClose}
      width={1080}
      destroyOnClose
      rootClassName="app-antd"
      getContainer={() =>
        (document.querySelector('.app-antd') as HTMLElement) || document.body
      }
      footer={
        step === 'upload' ? (
          <Button onClick={onClose}>{"取消"}</Button>
        ) : (
          <Space>
            <Button
              icon={<LeftOutlined />}
              disabled={importing}
              onClick={() => {
                setStep('upload');
                setPreview(null);
              }}
            >
              {"重新选择文件"}
            </Button>
            <Button onClick={onClose} disabled={importing}>
              {"取消"}
            </Button>
            <Button
              type="primary"
              disabled={!canImport}
              loading={importing}
              onClick={() => void handleImport()}
            >
              {`导入 ${preview?.rows.length ?? 0} 条`}
            </Button>
          </Space>
        )
      }
    >
      {step === 'upload' ? (
        <Upload.Dragger
          accept=".csv,text/csv"
          multiple={false}
          showUploadList={false}
          disabled={parsing}
          beforeUpload={(file) => {
            void handleFile(file);
            return false;
          }}
          style={{ marginTop: 8, padding: '24px 12px' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{"点击或拖拽 CSV 文件到此处"}</p>
          <p className="ant-upload-hint">{"仅支持 .csv，最大 10MB"}</p>
        </Upload.Dragger>
      ) : (
        <div style={{ marginTop: 4 }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`「${preview?.fileName}」共 ${preview?.rows.length ?? 0} 行，请将列映射到 Input（输入）/ Expected Output（期望输出）/ Metadata（元数据）`}
          />

          <Checkbox
            checked={wrapSingleColumn}
            onChange={(e) => setWrapSingleColumn(e.target.checked)}
            disabled={importing}
            style={{ marginBottom: 12 }}
          >
            {"强制对象"}
            <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              {"当单个 CSV 列映射到数据集字段时，将其值包装为对象，而不是使用原始值。例如：{\"columnName\": \"value\"} 而不是 \"value\""}
            </Typography.Text>
          </Checkbox>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {"输入"}
              </Typography.Text>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%', marginTop: 4 }}
                placeholder={"选择 CSV 列"}
                options={columnOptions}
                value={inputCols}
                onChange={setInputCols}
                disabled={importing}
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {"期望输出"}
              </Typography.Text>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%', marginTop: 4 }}
                placeholder={"选择 CSV 列"}
                options={columnOptions}
                value={expectedCols}
                onChange={setExpectedCols}
                disabled={importing}
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {"元数据"}
              </Typography.Text>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%', marginTop: 4 }}
                placeholder={"选择 CSV 列"}
                options={columnOptions}
                value={metadataCols}
                onChange={setMetadataCols}
                disabled={importing}
              />
            </div>
          </div>

          {importing ? (
            <Progress
              percent={
                progress.total
                  ? Math.round((progress.processed / progress.total) * 100)
                  : 0
              }
              status="active"
              style={{ marginBottom: 12 }}
              format={() => `${progress.processed} / ${progress.total}`}
            />
          ) : null}

          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {`预览（前 ${previewData.length} 行）`}
          </Typography.Text>
          <Table
            size="small"
            rowKey="key"
            columns={previewColumns}
            dataSource={previewData}
            scroll={{ x: Math.max(480, (preview?.columns.length ?? 0) * 160), y: 280 }}
            pagination={false}
          />
        </div>
      )}
    </Modal>
  );
}
