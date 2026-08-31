import { useEffect } from 'react';
import { Form, Input, Modal, Select, Switch } from 'antd';
import type {
  MockEvaluator,
  MockEvaluatorInput,
  MockEvaluatorStatus,
} from './mockStore';

type FormValues = {
  name: string;
  type: string;
  status: MockEvaluatorStatus;
  description?: string;
  prompt?: string;
};

export function EvaluatorFormModal({
  open,
  editing,
  saving,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  editing: MockEvaluator | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: MockEvaluatorInput) => Promise<void>;
}) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        type: editing.type,
        status: editing.status,
        description: editing.description || '',
        prompt: editing.prompt || '',
      });
    } else {
      form.setFieldsValue({
        name: '',
        type: 'llm_as_judge',
        status: 'active',
        description: '',
        prompt: '',
      });
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit({
      name: values.name,
      type: values.type,
      status: values.status,
      description: values.description,
      prompt: values.prompt,
    });
  };

  return (
    <Modal
      title={editing ? '编辑评估器' : '新建评估器'}
      open={open}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      okText={editing ? '保存' : '新建'}
      cancelText="取消"
      destroyOnClose
      width={640}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入评估器名称' }]}
        >
          <Input maxLength={128} placeholder="请输入评估器名称" />
        </Form.Item>

        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'llm_as_judge', label: 'LLM-as-judge' },
              { value: 'code', label: 'Code' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="status"
          label="状态"
          valuePropName="checked"
          getValueFromEvent={(checked: boolean) => (checked ? 'active' : 'inactive')}
          getValueProps={(value: MockEvaluatorStatus) => ({
            checked: value !== 'inactive',
          })}
        >
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="可选，简要说明评估器用途" />
        </Form.Item>

        <Form.Item
          name="prompt"
          label="Prompt"
          extra="可使用 {{variable}} 语法声明变量"
        >
          <Input.TextArea rows={8} className="agent-mono" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
