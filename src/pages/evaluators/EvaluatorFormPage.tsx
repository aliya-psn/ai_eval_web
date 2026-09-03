import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowRightOutlined,
  CheckOutlined,
  CodeOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { PageShell } from '@/components/page/PageShell';
import '@/components/page/page.css';
import {
  evaluatorService,
  type EvaluatorFormModel,
  type EvaluatorKind,
  type OutputDataType,
} from '@/services/evaluatorService';
import { getEvaluatorTypeMeta } from '@/types/evaluator';

const { TextArea } = Input;

const KIND_OPTIONS: {
  key: EvaluatorKind;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'llm_as_judge',
    label: 'LLM-as-a-judge',
    desc: '使用 LLM 模型按提示词对数据进行打分',
    icon: <RobotOutlined />,
  },
  {
    key: 'rule',
    label: '规则评估器',
    desc: '基于规则 / 条件对数据进行评估',
    icon: <ThunderboltOutlined />,
  },
  {
    key: 'code',
    label: 'Code 评估器',
    desc: '通过 Python / TypeScript 代码评估',
    icon: <CodeOutlined />,
  },
  {
    key: 'agent',
    label: 'Agent 评估器',
    desc: '通过 Agent 对数据进行评估',
    icon: <UserOutlined />,
  },
];

const DATA_TYPE_OPTIONS: { value: OutputDataType; label: string }[] = [
  { value: 'NUMERIC', label: '数值 (NUMERIC)' },
  { value: 'BOOLEAN', label: '布尔 (BOOLEAN)' },
  { value: 'CATEGORICAL', label: '分类 (CATEGORICAL)' },
];

const CODE_LANG_OPTIONS = [
  { value: 'PYTHON', label: 'Python' },
  { value: 'TYPESCRIPT', label: 'TypeScript' },
];

const DEFAULT_LLM_PROMPT = `你是严谨的评估专家。请根据以下标准对回答进行评分。

输入：
{{input}}

输出要求：
- 输出 JSON 对象，包含 reasoning（评估理由）和 score（评分）两个字段。`;

const DEFAULT_CODE_PYTHON = `from typing import Any, Dict

def evaluate(input: Dict[str, Any], output: Dict[str, Any]) -> Dict[str, Any]:
    """评估函数：返回 {"reasoning": str, "score": float|bool|str}"""
    # 示例：判断输出是否包含关键词
    text = str(output.get("answer", ""))
    score = 1.0 if "正确" in text else 0.0
    return {
        "reasoning": "根据关键词匹配进行评分",
        "score": score,
    }
`;

const DEFAULT_CODE_TS = `export function evaluate(input: Record<string, any>, output: Record<string, any>): {
  reasoning: string;
  score: number | boolean | string;
} {
  // 示例：判断输出是否包含关键词
  const text = String(output.answer ?? "");
  const score = text.includes("正确") ? 1.0 : 0.0;
  return { reasoning: "根据关键词匹配进行评分", score };
}
`;

export default function EvaluatorFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [form] = Form.useForm();
  const [kind, setKind] = useState<EvaluatorKind>('llm_as_judge');
  const [dataType, setDataType] = useState<OutputDataType>('NUMERIC');
  const [codeLang, setCodeLang] = useState<'PYTHON' | 'TYPESCRIPT'>('PYTHON');
  const [categories, setCategories] = useState<string[]>(['优秀', '良好', '一般', '较差']);
  const [categoryInput, setCategoryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editId;

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoading(true);
    evaluatorService
      .get(editId)
      .then((evaluator) => {
        if (cancelled) return;
        const model = evaluatorService.fromEvaluatorToForm(evaluator);
        setKind(model.kind);
        if (model.kind === 'code') {
          setCodeLang(model.sourceCodeLanguage);
        } else {
          setDataType(model.dataType);
          if (model.dataType === 'CATEGORICAL' && 'categories' in model) {
            setCategories(model.categories);
          }
        }
        form.setFieldsValue(model);
      })
      .catch(() => {
        if (!cancelled) message.error('加载评估器失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, form]);

  const handleKindChange = (next: EvaluatorKind) => {
    setKind(next);
    if (next === 'code') {
      form.setFieldsValue({
        sourceCode: codeLang === 'PYTHON' ? DEFAULT_CODE_PYTHON : DEFAULT_CODE_TS,
      });
    } else if (next === 'llm_as_judge') {
      const current = form.getFieldValue('prompt');
      if (!current) form.setFieldsValue({ prompt: DEFAULT_LLM_PROMPT });
    }
  };

  const handleAddCategory = () => {
    const v = categoryInput.trim();
    if (!v) return;
    if (categories.includes(v)) {
      message.warning('分类已存在');
      return;
    }
    setCategories((prev) => [...prev, v]);
    setCategoryInput('');
  };

  const handleRemoveCategory = (c: string) => {
    setCategories((prev) => prev.filter((x) => x !== c));
  };

  const buildModel = useCallback((): EvaluatorFormModel => {
    const values = form.getFieldsValue();
    if (kind === 'code') {
      return {
        kind: 'code',
        name: values.name,
        sourceCode: values.sourceCode,
        sourceCodeLanguage: codeLang,
      };
    }
    if (kind === 'rule') {
      return {
        kind: 'rule',
        name: values.name,
        rule: values.rule,
        dataType,
        scoreDescription: values.scoreDescription,
        categories,
      };
    }
    if (kind === 'agent') {
      return {
        kind: 'agent',
        name: values.name,
        agentName: values.agentName,
        prompt: values.prompt,
        dataType,
        scoreDescription: values.scoreDescription,
        categories,
      };
    }
    return {
      kind: 'llm_as_judge',
      name: values.name,
      prompt: values.prompt,
      dataType,
      reasoningDescription: values.reasoningDescription,
      scoreDescription: values.scoreDescription,
      minValue: values.minValue ?? null,
      maxValue: values.maxValue ?? null,
      categories,
      shouldAllowMultipleMatches: values.shouldAllowMultipleMatches ?? false,
      provider: values.provider,
      model: values.model,
      mapping: [],
    };
  }, [form, kind, dataType, codeLang, categories]);

  const handleSubmit = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const model = buildModel();
      await evaluatorService.create(model);
      message.success(isEdit ? '评估器已更新' : '评估器创建成功');
      navigate('/evaluatorManagement');
    } catch {
      // 错误已由拦截器 toast
    } finally {
      setSubmitting(false);
    }
  };

  const renderKindSelector = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {KIND_OPTIONS.map((opt) => {
        const active = kind === opt.key;
        return (
          <div
            key={opt.key}
            onClick={() => handleKindChange(opt.key)}
            style={{
              border: active ? '1.5px solid #2563EB' : '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 16,
              cursor: 'pointer',
              background: active ? 'rgba(37,99,235,0.05)' : '#fff',
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: active ? '#2563EB' : '#334155',
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 18 }}>{opt.icon}</span>
              {opt.label}
              {active ? <CheckOutlined style={{ marginLeft: 'auto' }} /> : null}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: 'rgba(9,25,64,0.55)',
                lineHeight: 1.5,
              }}
            >
              {opt.desc}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderOutputDefinition = () => (
    <>
      <Form.Item label="输出数据类型" required>
        <Radio.Group
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          options={DATA_TYPE_OPTIONS}
        />
      </Form.Item>

      {dataType === 'NUMERIC' ? (
        <Space size={16} style={{ display: 'flex' }}>
          <Form.Item label="最低分" name="minValue">
            <InputNumber style={{ width: 160 }} placeholder="可选" />
          </Form.Item>
          <Form.Item label="最高分" name="maxValue">
            <InputNumber style={{ width: 160 }} placeholder="可选" />
          </Form.Item>
        </Space>
      ) : null}

      {dataType === 'CATEGORICAL' ? (
        <Form.Item label="分类选项" required>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {categories.map((c) => (
              <Tag
                key={c}
                closable
                onClose={() => handleRemoveCategory(c)}
                color="blue"
              >
                {c}
              </Tag>
            ))}
          </div>
          <Space.Compact style={{ width: 320 }}>
            <Input
              placeholder="输入分类名称"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              onPressEnter={handleAddCategory}
            />
            <Button onClick={handleAddCategory}>添加</Button>
          </Space.Compact>
        </Form.Item>
      ) : null}

      <Form.Item label="评分说明" name="scoreDescription" required>
        <TextArea
          rows={2}
          placeholder="描述评分的含义，例如：1 表示完全正确，0 表示错误"
        />
      </Form.Item>
    </>
  );

  const renderLlmForm = () => (
    <>
      <Form.Item
        label="评估提示词"
        name="prompt"
        required
        rules={[{ required: true, message: '请输入评估提示词' }]}
      >
        <TextArea rows={8} placeholder="输入 LLM 评估提示词，可使用 {{变量}} 占位" />
      </Form.Item>
      <Form.Item label="推理说明" name="reasoningDescription">
        <TextArea rows={2} placeholder="描述模型应如何推理（可选）" />
      </Form.Item>
      {renderOutputDefinition()}
      <Space size={16} style={{ display: 'flex' }}>
        <Form.Item label="模型 Provider" name="provider">
          <Input style={{ width: 200 }} placeholder="如 openai（留空用默认）" />
        </Form.Item>
        <Form.Item label="模型名称" name="model">
          <Input style={{ width: 240 }} placeholder="如 gpt-4o（留空用默认）" />
        </Form.Item>
      </Space>
    </>
  );

  const renderRuleForm = () => (
    <>
      <Form.Item
        label="规则表达式"
        name="rule"
        required
        rules={[{ required: true, message: '请输入规则表达式' }]}
        extra="定义评估规则，例如：output.answer 包含关键词则通过"
      >
        <TextArea rows={6} placeholder="输入规则表达式" />
      </Form.Item>
      {renderOutputDefinition()}
    </>
  );

  const renderCodeForm = () => (
    <>
      <Form.Item label="运行语言" required>
        <Select
          value={codeLang}
          onChange={(v) => {
            setCodeLang(v);
            form.setFieldsValue({
              sourceCode: v === 'PYTHON' ? DEFAULT_CODE_PYTHON : DEFAULT_CODE_TS,
            });
          }}
          style={{ width: 200 }}
          options={CODE_LANG_OPTIONS}
        />
      </Form.Item>
      <Form.Item
        label="源代码"
        name="sourceCode"
        required
        rules={[{ required: true, message: '请输入源代码' }]}
      >
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <Editor
            height={320}
            language={codeLang === 'PYTHON' ? 'python' : 'typescript'}
            theme="vs"
            value={form.getFieldValue('sourceCode')}
            onChange={(v) => form.setFieldsValue({ sourceCode: v ?? '' })}
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        </div>
      </Form.Item>
    </>
  );

  const renderAgentForm = () => (
    <>
      <Form.Item
        label="Agent 名称"
        name="agentName"
        required
        rules={[{ required: true, message: '请输入 Agent 名称' }]}
      >
        <Input placeholder="输入用于评估的 Agent 名称" />
      </Form.Item>
      <Form.Item
        label="评估提示词"
        name="prompt"
        required
        rules={[{ required: true, message: '请输入评估提示词' }]}
      >
        <TextArea rows={6} placeholder="输入 Agent 评估提示词" />
      </Form.Item>
      {renderOutputDefinition()}
    </>
  );

  const renderFormBody = () => {
    switch (kind) {
      case 'code':
        return renderCodeForm();
      case 'rule':
        return renderRuleForm();
      case 'agent':
        return renderAgentForm();
      default:
        return renderLlmForm();
    }
  };

  const meta = getEvaluatorTypeMeta(kind);

  return (
    <PageShell
      title={isEdit ? '编辑评估器' : '新建评估器'}
      onBack={() => navigate('/evaluatorManagement')}
      backLabel="返回列表"
    >
      <div className="agent-panel">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: '',
            prompt: DEFAULT_LLM_PROMPT,
            sourceCode: DEFAULT_CODE_PYTHON,
            shouldAllowMultipleMatches: false,
          }}
        >
          <Card
            size="small"
            title="基本信息"
            style={{ marginBottom: 16 }}
            styles={{ body: { paddingTop: 8 } }}
          >
            <Form.Item
              label="评估器名称"
              name="name"
              required
              rules={[{ required: true, message: '请输入评估器名称' }]}
            >
              <Input placeholder="输入评估器名称" style={{ maxWidth: 480 }} />
            </Form.Item>
          </Card>

          <Card
            size="small"
            title={
              <Space>
                评估器类型
                {kind ? <Tag color={meta.color}>{meta.label}</Tag> : null}
              </Space>
            }
            style={{ marginBottom: 16 }}
            styles={{ body: { paddingTop: 8 } }}
          >
            {renderKindSelector()}
          </Card>

          <Card size="small" title="类型配置" style={{ marginBottom: 16 }}>
            {renderFormBody()}
          </Card>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              paddingTop: 8,
            }}
          >
            <Button onClick={() => navigate('/evaluatorManagement')}>取消</Button>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              loading={submitting}
              onClick={handleSubmit}
            >
              {isEdit ? '保存修改' : '创建评估器'}
            </Button>
          </div>
        </Form>
      </div>
    </PageShell>
  );
}
