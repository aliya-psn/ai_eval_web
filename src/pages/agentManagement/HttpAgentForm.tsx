import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Form, Input, Select, Spin, message } from 'antd';
import {
  PostmanInvokeEditor,
  createDefaultPostmanInvoke,
  invokeToPostmanValue,
  postmanValueToInvoke,
  applyParamTypesToInvoke,
  invokeKvRowsToParameters,
  type PostmanInvokeValue,
} from '@/components/agent/PostmanInvokeEditor';
import { adminAgentApi } from '@/api/admin';
import { useCurrentUser } from '@/lib/api/user';
import type { HttpAgentRevisionDetail } from '@/types/adminAgent';
import { AgentPageShell, AgentSection } from './AgentPageShell';

export default function HttpAgentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: currentUser } = useCurrentUser();

  const agentIdParam = searchParams.get('id');
  const agentId = agentIdParam ? Number(agentIdParam) : undefined;
  const deliveryVersionIdParam = searchParams.get('deliveryVersionId');
  const deliveryVersionId = deliveryVersionIdParam
    ? Number(deliveryVersionIdParam)
    : undefined;
  const isNewVersion = searchParams.get('mode') === 'newVersion' || !deliveryVersionId;
  const agentName = searchParams.get('name') || '';

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invokeValue, setInvokeValue] = useState<PostmanInvokeValue>(createDefaultPostmanInvoke());
  const [tags, setTags] = useState<string[]>([]);
  const [preservedMeta, setPreservedMeta] = useState<{
    iconUrl?: string;
  }>({});

  const applyRevisionToForm = useCallback(
    (data: HttpAgentRevisionDetail) => {
      const meta = data.metadata;
      form.setFieldsValue({
        deliveryVersion: data.deliveryVersion,
        description: data.description,
        documentationUrl: meta?.documentationUrl || undefined,
        testOwner: data.testOwner || undefined,
        testOwnerName: data.testOwnerName || undefined,
        devOwner: data.devOwner || undefined,
        devOwnerName: data.devOwnerName || undefined,
      });
      setPreservedMeta({
        iconUrl: meta?.iconUrl,
      });
      setTags(meta?.tags || []);
      setInvokeValue(
        applyParamTypesToInvoke(invokeToPostmanValue(data.invoke), data.parameters),
      );
    },
    [form],
  );

  useEffect(() => {
    if (!agentId || !Number.isFinite(agentId)) return;

    if (isNewVersion) {
      form.setFieldsValue({
        deliveryVersion: '',
        description: '',
      });
      setInvokeValue(createDefaultPostmanInvoke());
      setTags([]);
      setPreservedMeta({});
      return;
    }

    if (!deliveryVersionId || !Number.isFinite(deliveryVersionId)) return;

    setLoading(true);
    adminAgentApi
      .getLatestRevision(agentId, deliveryVersionId)
      .then((data) => {
        applyRevisionToForm(data);
        // 更新当前交付版本：版本号只读展示，不可改
        form.setFieldsValue({ deliveryVersion: data.deliveryVersion });
      })
      .catch(() => {
        message.error('数据加载失败');
      })
      .finally(() => setLoading(false));
  }, [agentId, deliveryVersionId, isNewVersion, applyRevisionToForm, form]);

  // 尚未选负责人时，默认当前用户
  useEffect(() => {
    if (!currentUser?.username) return;
    const patch: Record<string, string> = {};
    if (!form.getFieldValue('testOwner')) {
      patch.testOwner = currentUser.username;
      patch.testOwnerName =
        currentUser.nickname || currentUser.username;
    }
    if (!form.getFieldValue('devOwner')) {
      patch.devOwner = currentUser.username;
      patch.devOwnerName =
        currentUser.nickname || currentUser.username;
    }
    if (Object.keys(patch).length) {
      form.setFieldsValue(patch);
    }
  }, [currentUser?.username, currentUser?.nickname, form]);

  const resolveOwnerName = useCallback(
    (username: string): string => {
      if (username === currentUser?.username) {
        return currentUser.nickname || currentUser.username || username;
      }
      return username;
    },
    [currentUser],
  );

  const handleSubmit = async () => {
    if (!agentId || !Number.isFinite(agentId)) {
      message.error('未找到 Agent');
      return;
    }
    const createUsername = currentUser?.username || '';
    if (!createUsername) {
      message.error('无法获取当前用户，请重新登录后再试');
      return;
    }
    if (!invokeValue.url?.trim()) {
      message.error('请填写接口 URL');
      return;
    }

    let values: {
      deliveryVersion: string;
      description?: string;
      documentationUrl?: string;
      testOwner: string;
      testOwnerName?: string;
      devOwner: string;
      devOwnerName?: string;
    };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const testOwner = values.testOwner?.trim();
    const devOwner = values.devOwner?.trim();
    if (!testOwner) {
      message.error('请选择测试负责人');
      return;
    }
    if (!devOwner) {
      message.error('请选择研发负责人');
      return;
    }

    const testOwnerName =
      values.testOwnerName?.trim() || resolveOwnerName(testOwner);
    const devOwnerName =
      values.devOwnerName?.trim() || resolveOwnerName(devOwner);

    const normalizedTags = Array.from(
      new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
    );

    const shared = {
      description: values.description,
      testOwner,
      testOwnerName,
      devOwner,
      devOwnerName,
      parameters: invokeKvRowsToParameters(
        invokeValue.queryParams,
        invokeValue.bodyParams,
        invokeValue.bodyMode,
        invokeValue.bodyJson,
      ),
      invoke: postmanValueToInvoke(invokeValue),
      metadata: {
        iconUrl: preservedMeta.iconUrl,
        documentationUrl: values.documentationUrl?.trim() || undefined,
        tags: normalizedTags,
      },
      createUser: createUsername,
    };

    setSaving(true);
    try {
      if (isNewVersion) {
        await adminAgentApi.createDeliveryVersion(agentId, {
          ...shared,
          deliveryVersion: values.deliveryVersion.trim(),
        });
        message.success('交付版本创建成功');
      } else {
        await adminAgentApi.updateDeliveryVersion(agentId, {
          ...shared,
          deliveryVersionId,
        });
        message.success('Agent 更新成功');
      }
      navigate(
        `/agentManagement/http/detail?id=${agentId}&name=${encodeURIComponent(agentName || '')}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = isNewVersion
    ? '新增集成交付版本'
    : '编辑集成交付版本';

  if (!agentId || !Number.isFinite(agentId)) {
    return (
      <AgentPageShell title={pageTitle} onBack={() => navigate('/agentManagement')}>
        <div className="agent-section" style={{ padding: 48, textAlign: 'center' }}>
          未找到 Agent
        </div>
      </AgentPageShell>
    );
  }

  return (
    <AgentPageShell title={pageTitle} onBack={() => navigate(-1)}>
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="horizontal"
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 18 }}
          initialValues={{
            deliveryVersion: '1.0.0',
            testOwner: currentUser?.username,
            testOwnerName: currentUser?.nickname || currentUser?.username,
            devOwner: currentUser?.username,
            devOwnerName: currentUser?.nickname || currentUser?.username,
          }}
        >
          <Form.Item name="testOwnerName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="devOwnerName" hidden>
            <Input />
          </Form.Item>

          <AgentSection title="基本信息">
            {agentName ? (
              <Form.Item label="名称">
                <span className="agent-owner-text">{agentName}</span>
              </Form.Item>
            ) : null}
            <Form.Item
              name="deliveryVersion"
              label="版本号"
              rules={[{ required: true, message: '版本号不能为空' }]}
            >
              <Input
                className={!isNewVersion ? 'agent-input-readonly' : undefined}
                placeholder="如 1.0.0"
                style={{ maxWidth: 240 }}
                disabled={!isNewVersion}
              />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="请输入 Agent 的功能描述..." />
            </Form.Item>
            <Form.Item name="documentationUrl" label="文档">
              <Input
                placeholder="请输入文档链接"
                style={{ maxWidth: 480 }}
              />
            </Form.Item>
            <Form.Item
              name="testOwner"
              label="测试负责人"
              rules={[{ required: true, message: '请选择测试负责人' }]}
            >
              <Input
                placeholder="请选择测试负责人"
                style={{ maxWidth: 360 }}
              />
            </Form.Item>
            <Form.Item
              name="devOwner"
              label="研发负责人"
              rules={[{ required: true, message: '请选择研发负责人' }]}
            >
              <Input
                placeholder="请选择研发负责人"
                style={{ maxWidth: 360 }}
              />
            </Form.Item>
            <Form.Item label="标签">
              <Select
                mode="tags"
                value={tags}
                onChange={setTags}
                placeholder="输入后按回车添加标签"
                tokenSeparators={[',']}
                open={false}
                suffixIcon={null}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </AgentSection>

          <AgentSection title="支持的接口">
            <PostmanInvokeEditor value={invokeValue} onChange={setInvokeValue} />
          </AgentSection>

          <div className="agent-footer-bar">
            <Button onClick={() => navigate(-1)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSubmit()}>
              保存
            </Button>
          </div>
        </Form>
      </Spin>
    </AgentPageShell>
  );
}
