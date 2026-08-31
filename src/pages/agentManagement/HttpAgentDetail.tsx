import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Descriptions,
  Empty,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  PostmanInvokeEditor,
  applyParamTypesToInvoke,
  invokeToPostmanValue,
} from '@/components/agent/PostmanInvokeEditor';
import { adminAgentApi } from '@/api/admin';
import type {
  HttpAgentDeliveryVersionView,
  HttpAgentRevisionDetail,
  HttpAgentRevisionView,
} from '@/types/adminAgent';
import { AgentPageShell, AgentSection, agentInitials, formatAgentTime } from './AgentPageShell';

function formatOwnerDisplay(id?: string, name?: string): string {
  if (name && id) return `${name} (${id})`;
  return name || id || '';
}

export default function HttpAgentDetailPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const agentIdParam = searchParams.get('id');
  const agentId = agentIdParam ? Number(agentIdParam) : undefined;
  const nameParam = searchParams.get('name') || '';
  const agentDescriptionParam = searchParams.get('description') || '';

  const [loading, setLoading] = useState(false);
  const [deliveryVersions, setDeliveryVersions] = useState<HttpAgentDeliveryVersionView[]>([]);
  const [revisions, setRevisions] = useState<HttpAgentRevisionView[]>([]);
  const [selectedDeliveryVersionId, setSelectedDeliveryVersionId] = useState<number | undefined>();
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | undefined>();
  const [detail, setDetail] = useState<HttpAgentRevisionDetail | null>(null);

  const loadDeliveryVersions = useCallback(async () => {
    if (!agentId || !Number.isFinite(agentId)) return [];
    try {
      const list = await adminAgentApi.listDeliveryVersions(agentId);
      setDeliveryVersions(list || []);
      return list || [];
    } catch {
      setDeliveryVersions([]);
      return [];
    }
  }, [agentId]);

  const loadRevisions = useCallback(
    async (deliveryVersionId: number) => {
      if (!agentId) return [];
      try {
        const list = await adminAgentApi.listRevisions(agentId, deliveryVersionId);
        setRevisions(list || []);
        return list || [];
      } catch {
        setRevisions([]);
        return [];
      }
    },
    [agentId],
  );

  const loadLatestRevision = useCallback(
    async (deliveryVersionId: number) => {
      if (!agentId) return;
      setLoading(true);
      try {
        const data = await adminAgentApi.getLatestRevision(agentId, deliveryVersionId);
        setDetail(data);
        setSelectedRevisionId(data?.revisionId);
      } catch {
        setDetail(null);
        setSelectedRevisionId(undefined);
      } finally {
        setLoading(false);
      }
    },
    [agentId],
  );

  const loadRevisionDetail = useCallback(
    async (deliveryVersionId: number, revisionId: number) => {
      if (!agentId) return;
      setLoading(true);
      try {
        const data = await adminAgentApi.getRevision(agentId, deliveryVersionId, revisionId);
        setDetail(data);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [agentId],
  );

  useEffect(() => {
    if (!agentId || !Number.isFinite(agentId)) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const versions = await loadDeliveryVersions();
      if (cancelled) return;

      if (!versions.length) {
        setSelectedDeliveryVersionId(undefined);
        setSelectedRevisionId(undefined);
        setRevisions([]);
        setDetail(null);
        setLoading(false);
        return;
      }

      const preferredId = searchParams.get('deliveryVersionId');
      const preferred = preferredId
        ? versions.find((v) => String(v.deliveryVersionId) === preferredId)
        : undefined;
      const initial = preferred || versions[0];
      const deliveryVersionId = initial.deliveryVersionId!;
      setSelectedDeliveryVersionId(deliveryVersionId);

      await loadRevisions(deliveryVersionId);
      if (cancelled) return;

      const revisionIdParam = searchParams.get('revisionId');
      if (revisionIdParam) {
        const revisionId = Number(revisionIdParam);
        setSelectedRevisionId(revisionId);
        await loadRevisionDetail(deliveryVersionId, revisionId);
      } else {
        await loadLatestRevision(deliveryVersionId);
      }
    })();

    return () => {
      cancelled = true;
    };
    // 仅在 agentId 变化时重新初始化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handleDeliveryVersionChange = async (deliveryVersionId: number) => {
    setSelectedDeliveryVersionId(deliveryVersionId);
    setSelectedRevisionId(undefined);
    setDetail(null);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('deliveryVersionId', String(deliveryVersionId));
      next.delete('revisionId');
      return next;
    });

    await loadRevisions(deliveryVersionId);
    await loadLatestRevision(deliveryVersionId);
  };

  const handleRevisionChange = async (revisionId: number) => {
    if (!selectedDeliveryVersionId) return;
    setSelectedRevisionId(revisionId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('revisionId', String(revisionId));
      return next;
    });
    await loadRevisionDetail(selectedDeliveryVersionId, revisionId);
  };

  const handleDeleteVersion = () => {
    if (!agentId || !selectedDeliveryVersionId) return;
    const version = deliveryVersions.find(
      (v) => v.deliveryVersionId === selectedDeliveryVersionId,
    );
    Modal.confirm({
      title: '确认删除',
      content: `确定删除交付版本「${version?.deliveryVersion || selectedDeliveryVersionId}」吗？此操作不可恢复。`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await adminAgentApi.deleteDeliveryVersion(agentId, selectedDeliveryVersionId);
        message.success('交付版本删除成功');

        const versions = await loadDeliveryVersions();
        if (!versions.length) {
          setSelectedDeliveryVersionId(undefined);
          setSelectedRevisionId(undefined);
          setRevisions([]);
          setDetail(null);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('deliveryVersionId');
            next.delete('revisionId');
            return next;
          });
          return;
        }

        const nextVersion = versions[0];
        const nextId = nextVersion.deliveryVersionId!;
        setSelectedDeliveryVersionId(nextId);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('deliveryVersionId', String(nextId));
          next.delete('revisionId');
          return next;
        });
        await loadRevisions(nextId);
        await loadLatestRevision(nextId);
      },
    });
  };

  const displayName = detail?.name || nameParam || 'HTTP Agent 详情';

  return (
    <AgentPageShell
      title={displayName}
      onBack={() => navigate('/agentManagement')}
      extra={
        agentId ? (
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() =>
                navigate(
                  `/agentManagement/http/edit?id=${agentId}&mode=newVersion&name=${encodeURIComponent(displayName)}`,
                )
              }
            >
              新增版本
            </Button>
            {selectedDeliveryVersionId ? (
              <>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() =>
                    navigate(
                      `/agentManagement/http/edit?id=${agentId}&deliveryVersionId=${selectedDeliveryVersionId}&name=${encodeURIComponent(displayName)}`,
                    )
                  }
                >
                  编辑
                </Button>
              </>
            ) : null}
          </Space>
        ) : null
      }
    >
      <Spin spinning={loading}>
        {!agentId ? (
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description="未找到 Agent" />
          </div>
        ) : (
          <>
            <AgentSection
              title="基本信息"
              extra={
                <Space wrap size={10}>
                  <Select
                    style={{ width: 200 }}
                    value={selectedDeliveryVersionId}
                    placeholder="选择版本"
                    options={deliveryVersions.map((v) => ({
                      label: v.deliveryVersion || '-',
                      value: v.deliveryVersionId,
                    }))}
                    onChange={(v) => void handleDeliveryVersionChange(v)}
                    notFoundContent="暂无集成交付版本"
                    optionRender={(option) => (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{option.data.label}</span>
                        <DeleteOutlined
                          style={{ color: '#ff4d4f', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteVersion();
                          }}
                        />
                      </div>
                    )}
                  />
                  <Select
                    style={{ width: 240 }}
                    value={selectedRevisionId}
                    placeholder="选择历史修订"
                    options={revisions.map((r) => ({
                      label: `修订 #${r.revisionNo ?? '-'}${r.current ? ' · 最新' : ''}`,
                      value: r.revisionId,
                    }))}
                    onChange={(v) => void handleRevisionChange(v)}
                    disabled={!selectedDeliveryVersionId || !revisions.length}
                    notFoundContent="暂无历史修订"
                  />
                </Space>
              }
            >
              {detail ? (
                <>
                  <div className="agent-detail-hero">
                    <div className="agent-detail-avatar">
                      {detail.metadata?.iconUrl ? (
                        <img src={detail.metadata.iconUrl} alt="" />
                      ) : (
                        agentInitials(detail.name || nameParam)
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#091940' }}>
                        {detail.name || nameParam}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="agent-version-pill">
                          {detail.deliveryVersion || '-'}
                        </span>
                        {detail.agentEnabled ? (
                          <span className="agent-status on">
                            <span className="agent-status-dot" />
                            启用
                          </span>
                        ) : (
                          <span className="agent-status off">
                            <span className="agent-status-dot" />
                            停用
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Descriptions
                    column={2}
                    size="small"
                    style={{ marginTop: 20 }}
                    styles={{ label: { width: 110 } }}
                  >
                    <Descriptions.Item label="描述" span={2}>
                      {agentDescriptionParam || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="版本描述" span={2}>
                      {detail.description || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="标签" span={2}>
                      {(detail.metadata?.tags || []).length
                        ? detail.metadata!.tags!.map((tag) => <Tag key={tag}>{tag}</Tag>)
                        : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="测试负责人">
                      {formatOwnerDisplay(detail.testOwner, detail.testOwnerName) || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="研发负责人">
                      {formatOwnerDisplay(detail.devOwner, detail.devOwnerName) || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="文档" span={2}>
                      {detail.metadata?.documentationUrl ? (
                        <a
                          href={detail.metadata.documentationUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {detail.metadata.documentationUrl}
                        </a>
                      ) : (
                        '-'
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {formatAgentTime(detail.createdTime)}
                    </Descriptions.Item>
                  </Descriptions>
                </>
              ) : !loading ? (
                <Empty
                  style={{ padding: 32 }}
                  description={
                    deliveryVersions.length
                      ? '暂无历史修订'
                      : '暂无集成交付版本'
                  }
                />
              ) : null}
            </AgentSection>

            {detail?.invoke ? (
              <AgentSection title="支持接口">
                <PostmanInvokeEditor
                  value={applyParamTypesToInvoke(
                    invokeToPostmanValue(detail.invoke),
                    detail.parameters,
                  )}
                  onChange={() => undefined}
                  readOnly
                />
              </AgentSection>
            ) : null}
          </>
        )}
      </Spin>
    </AgentPageShell>
  );
}
