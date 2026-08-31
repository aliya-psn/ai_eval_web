import { useEffect, useState } from 'react';
import { Form, Input, Modal, Select, message } from 'antd';
import { datasetApi } from '@/api/langfuse';
import type { DatasetItem, DatasetStatus } from '@/types/dataset';
import {
  createOptionalJsonRule,
  parseOptionalJsonOrThrow,
  schemaToFormInitialJson,
} from '@/pages/dataset/datasetManagement/utils';

interface NewItemModalProps {
  open: boolean;
  datasetName: string;
  /** 数据集 Input Schema，新建时用于填充初始值 */
  inputSchema?: unknown;
  /** 数据集 Expected Output Schema，新建时用于填充初始值 */
  expectedOutputSchema?: unknown;
  /** 传入则为编辑（POST upsert by id） */
  editing?: DatasetItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormValues {
  input?: string;
  expectedOutput?: string;
  metadata?: string;
  status?: DatasetStatus;
}

function toJsonText(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function NewItemModal({
  open,
  datasetName,
  inputSchema,
  expectedOutputSchema,
  editing = null,
  onClose,
  onSuccess,
}: NewItemModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const jsonRule = createOptionalJsonRule("请输入合法的 JSON 格式");
  const isEdit = Boolean(editing);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        input: toJsonText(editing.input),
        expectedOutput: toJsonText(editing.expectedOutput),
        metadata: toJsonText(editing.metadata),
        status: editing.status || 'ACTIVE',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        input: schemaToFormInitialJson(inputSchema),
        expectedOutput: schemaToFormInitialJson(expectedOutputSchema),
        status: 'ACTIVE',
      });
    }
  }, [open, editing, form, inputSchema, expectedOutputSchema]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      let input: unknown;
      let expectedOutput: unknown;
      let metadata: unknown;
      try {
        input = parseOptionalJsonOrThrow(values.input || '', "输入");
        expectedOutput = parseOptionalJsonOrThrow(
          values.expectedOutput || '',
          "期望输出",
        );
        metadata = parseOptionalJsonOrThrow(values.metadata || '', "元数据");
      } catch (err) {
        message.error(err instanceof Error ? err.message : "请输入合法的 JSON 格式");
        return;
      }

      setSaving(true);
      await datasetApi.createItem({
        datasetName,
        id: editing?.id,
        input,
        expectedOutput,
        metadata,
        status: values.status || 'ACTIVE',
      });
      message.success(isEdit ? "用例已更新" : "用例已创建");
      onClose();
      onSuccess?.();
    } catch {
      // validateFields rejection or API toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? "编辑用例" : "新增用例"}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      okText={isEdit ? "保存" : "新建"}
      cancelText={"取消"}
      destroyOnClose
      width={720}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        {isEdit ? (
          <Form.Item label="用例ID">
            <Input
              className="agent-mono agent-input-readonly"
              value={editing?.id}
              disabled
            />
          </Form.Item>
        ) : null}
        <Form.Item
          name="input"
          label={"输入"}
          rules={[jsonRule]}
          validateTrigger="onBlur"
        >
          <Input.TextArea
            rows={5}
            className="agent-mono"
            placeholder={"{\n  \"question\": \"现在几点了？\"\n}"}
          />
        </Form.Item>
        <Form.Item
          name="expectedOutput"
          label={"期望输出"}
          rules={[jsonRule]}
          validateTrigger="onBlur"
        >
          <Input.TextArea
            rows={5}
            className="agent-mono"
            placeholder={"{\n  \"answer\": \"现在是下午 3 点\"\n}"}
          />
        </Form.Item>
        <Form.Item
          name="metadata"
          label={"元数据"}
          rules={[jsonRule]}
          validateTrigger="onBlur"
        >
          <Input.TextArea
            rows={3}
            className="agent-mono"
            placeholder={"可选，JSON 格式"}
          />
        </Form.Item>
        <Form.Item name="status" label={"状态"}>
          <Select
            options={[
              { value: 'ACTIVE', label: "启用" },
              { value: 'ARCHIVED', label: "已归档" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
