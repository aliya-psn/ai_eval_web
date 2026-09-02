import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  Modal,
  Pagination,
  Skeleton,
  Space,
  Tabs,
  message,
} from 'antd';
import {
  AppstoreOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { adminSkillApi } from '@/api/admin/skill';
import { resolveNacosNamespaceId } from '@/lib/resolve-nacos-namespace';
import {
  AgentPageShell,
} from '@/pages/agentManagement/AgentPageShell';
import '@/pages/agentManagement/agent.css';
import { UploadSkillDialog } from '@/pages/skill/skillShared/UploadSkillDialog';
import { useNamespaceStore } from '@/stores/namespace-store';
import type { SkillListItem } from '@/types/skill';
import { SkillCard } from './components/SkillCard';

type SkillTabKey = 'mine' | 'market';

const PAGE_SIZE = 12;

export default function SkillManagementPage() {
  const navigate = useNavigate();
  const { currentNamespace, namespaceShowName } = useNamespaceStore();

  /** skill 接口使用的 Nacos namespace（由 namespaceShowName 匹配得到） */
  const [namespaceId, setNamespaceId] = useState('');

  const [activeTab, setActiveTab] = useState<SkillTabKey>('mine');

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<SkillListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  const [nameInput, setNameInput] = useState('');
  const [name, setName] = useState('');
  const [bizTagInput, setBizTagInput] = useState('');
  const [bizTag, setBizTag] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadInitialFile, setUploadInitialFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!currentNamespace) {
      setNamespaceId('');
      return;
    }
    void resolveNacosNamespaceId(currentNamespace, namespaceShowName).then((id) => {
      if (!cancelled) setNamespaceId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [currentNamespace, namespaceShowName]);

  const loadData = useCallback(async () => {
    if (!namespaceId) return;
    setLoading(true);
    try {
      const common = {
        namespaceId,
        skillName: name || undefined,
        search: name ? ('blur' as const) : undefined,
        bizTag: bizTag || undefined,
        pageNo,
        pageSize: PAGE_SIZE,
      };
      const res =
        activeTab === 'market'
          ? await adminSkillApi.marketList(common)
          : await adminSkillApi.list(common);
      setRecords(res.pageItems || []);
      setTotal(res.totalCount ?? 0);
    } catch {
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    namespaceId,
    name,
    bizTag,
    pageNo,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearch = () => {
    setPageNo(1);
    setName(nameInput.trim());
    setBizTag(bizTagInput.trim());
  };

  const handleReset = () => {
    setNameInput('');
    setName('');
    setBizTagInput('');
    setBizTag('');
    setPageNo(1);
    setSelectedNames([]);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as SkillTabKey);
    setPageNo(1);
    setSelectedNames([]);
    setNameInput('');
    setName('');
    setBizTagInput('');
    setBizTag('');
  };

  const goDetail = (skillName: string, skillNamespaceId?: string) => {
    const ns = skillNamespaceId || namespaceId;
    const qs = new URLSearchParams({ name: skillName, namespaceId: ns });
    const item = records.find((r) => r.name === skillName);
    if (item?.workspaceName) qs.set('workspaceName', item.workspaceName);
    navigate(`/skillDetail?${qs.toString()}`);
  };

  const handleDelete = (skillName: string) => {
    Modal.confirm({
      title: '删除',
      content: `确定要删除 Skill「${skillName}」吗？`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await adminSkillApi.delete({ namespaceId, skillName });
        message.success('删除成功');
        setSelectedNames((prev) => prev.filter((n) => n !== skillName));
        void loadData();
      },
    });
  };

  const handleBatchDelete = () => {
    if (!selectedNames.length) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedNames.length} 个 Skill 吗？`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await Promise.all(
          selectedNames.map((skillName) => adminSkillApi.delete({ namespaceId, skillName })),
        );
        message.success('批量删除成功');
        setSelectedNames([]);
        void loadData();
      },
    });
  };

  const toggleSelect = (skillName: string) => {
    setSelectedNames((prev) =>
      prev.includes(skillName)
        ? prev.filter((n) => n !== skillName)
        : [...prev, skillName],
    );
  };

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handlePageDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragOver(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (!droppedFile) return;
    if (
      !droppedFile.name.toLowerCase().endsWith('.zip') &&
      droppedFile.type !== 'application/zip'
    ) {
      message.error('请选择有效的 .zip 文件');
      return;
    }
    setUploadInitialFile(droppedFile);
    setUploadOpen(true);
  }, []);

  const renderToolbar = () => (
    <div className="agent-toolbar" style={{ padding: '0 0 12px 0' }}>
      <Space wrap size={10}>
        <Input
          allowClear
          placeholder={activeTab === 'market' ? '搜索公开 Skill' : '搜索 Skill 名称'}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 220 }}
          prefix={<SearchOutlined style={{ color: '#b5bac5' }} />}
        />
        <Button type="primary" onClick={handleSearch}>
          搜索
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          重置
        </Button>
      </Space>
      {activeTab === 'mine' && selectedNames.length > 0 ? (
        <Space size={8}>
          <span style={{ color: 'rgba(9,25,64,0.55)', fontSize: 12 }}>
            已选择 {selectedNames.length} 项
          </span>
          <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
            批量删除
          </Button>
          <Button onClick={() => setSelectedNames([])}>取消</Button>
        </Space>
      ) : null}
    </div>
  );

  const renderGrid = () => {
    if (loading && records.length === 0) {
      return (
        <div className="skill-mgmt-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="skill-mgmt-card"
              style={{
                border: '1px solid #f1f2f4',
                borderRadius: 4,
                padding: 16,
                background: '#fff',
              }}
            >
              <Space align="start" size={12} style={{ width: '100%' }}>
                <Skeleton.Avatar active size={40} shape="square" />
                <div style={{ flex: 1 }}>
                  <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
                </div>
              </Space>
            </div>
          ))}
        </div>
      );
    }

    if (records.length === 0) {
      return (
        <Empty
          style={{ padding: '64px 24px' }}
          description={
            <span>
              {activeTab === 'market' ? '暂无公开 Skill' : '暂无数据'}
              <br />
              <span style={{ fontSize: 12, color: 'rgba(9,25,64,0.45)' }}>
                {activeTab === 'market'
                  ? '可将 Skill 设为公开后在此浏览'
                  : '可搜索或上传 Skill'}
              </span>
            </span>
          }
        >
          {activeTab === 'mine' ? (
            <Button
              icon={<UploadOutlined />}
              onClick={() => {
                setUploadInitialFile(null);
                setUploadOpen(true);
              }}
            >
              上传
            </Button>
          ) : null}
        </Empty>
      );
    }

    return (
      <div className="skill-mgmt-grid" style={{ opacity: loading ? 0.6 : 1 }}>
        {records.map((item) => (
          <SkillCard
            key={`${item.namespaceId || namespaceId}:${item.name}`}
            item={item}
            variant={activeTab === 'market' ? 'market' : 'manage'}
            currentNamespaceId={namespaceId}
            selected={selectedNames.includes(item.name)}
            onSelect={activeTab === 'mine' ? toggleSelect : undefined}
            onDetail={goDetail}
            onDelete={activeTab === 'mine' ? handleDelete : undefined}
          />
        ))}
      </div>
    );
  };

  const renderPagination = () =>
    total > 0 ? (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 16,
          paddingTop: 8,
        }}
      >
        <Pagination
          current={pageNo}
          pageSize={PAGE_SIZE}
          total={total}
          showSizeChanger={false}
          showTotal={(count) =>
            activeTab === 'market' ? `共 ${count} 个公开 Skill` : `共 ${count} 个 Skill`
          }
          onChange={(p) => setPageNo(p)}
        />
      </div>
    ) : null;

  return (
    <div
      className="agent"
      onDragOver={activeTab === 'mine' ? handlePageDragOver : undefined}
      onDragEnter={activeTab === 'mine' ? handlePageDragEnter : undefined}
      onDragLeave={activeTab === 'mine' ? handlePageDragLeave : undefined}
      onDrop={activeTab === 'mine' ? handlePageDrop : undefined}
      style={{ position: 'relative' }}
    >
      {isDragOver && activeTab === 'mine' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #0c62ff',
            borderRadius: 8,
            background: 'rgba(12,98,255,0.06)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ textAlign: 'center', color: '#0c62ff', fontWeight: 600 }}>
            <UploadOutlined style={{ fontSize: 28, marginBottom: 8 }} />
            <div>释放 .zip 文件以上传</div>
          </div>
        </div>
      ) : null}

      <AgentPageShell
        title="Skill 管理"
        extra={
          activeTab === 'mine' ? (
            <Space wrap>
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  setUploadInitialFile(null);
                  setUploadOpen(true);
                }}
              >
                上传
              </Button>
            </Space>
          ) : null
        }
      >
        <div className="agent-panel">
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              {
                key: 'mine',
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <AppstoreOutlined />
                    我的 Skill
                  </span>
                ),
                children: (
                  <div className="agent-panel-inner">
                    {renderToolbar()}
                    {renderGrid()}
                    {renderPagination()}
                  </div>
                ),
              },
              {
                key: 'market',
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ShopOutlined />
                    Skill 市场
                  </span>
                ),
                children: (
                  <div className="agent-panel-inner">
                    {renderToolbar()}
                    {renderGrid()}
                    {renderPagination()}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </AgentPageShell>

      <UploadSkillDialog
        open={uploadOpen}
        onOpenChange={(nextOpen) => {
          setUploadOpen(nextOpen);
          if (!nextOpen) setUploadInitialFile(null);
        }}
        namespaceId={namespaceId}
        onSuccess={() => void loadData()}
        initialFile={uploadInitialFile}
      />
    </div>
  );
}
