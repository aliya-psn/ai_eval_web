import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HistoryOutlined,
  LockOutlined,
  MessageOutlined,
  PlusOutlined,
  PoweroffOutlined,
  SaveOutlined,
  SendOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { ArrowLeft } from 'lucide-react';
import Markdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import { adminSkillApi } from '@/api/admin/skill';
import { BizTagEditDialog } from '@/components/ai/BizTagEditDialog';
import { CliCommandCard } from '@/components/ai/CliCommandCard';
import { LabelBindDialog } from '@/components/ai/LabelBindDialog';
import {
  AgentSection,
  agentInitials,
  formatAgentTime,
} from '@/pages/agentManagement/AgentPageShell';
import '@/pages/agentManagement/agent.css';
import { SkillResourcePanel } from '@/pages/skill/skillShared/SkillResourcePanel';
import { PipelineStatusDisplay } from '@/pages/skill/skillShared/PipelineStatusDisplay';
import { SkillVersionTimeline } from '@/pages/skill/skillShared/SkillVersionTimeline';
import {
  getValidActionsWithContext,
  sortVersionsDescending,
} from '@/pages/skill/skillShared/version-utils';
import {
  hasNonFrontmatterMarkdownBody,
  parseFrontmatter,
  prepareSkillMarkdownPreview,
  updateFrontmatterField,
} from '@/lib/markdown-utils';
import { getHostWorkspaceName } from '@/lib/host-workspace';
import { copyToClipboard } from '@/lib/clipboard';
import { useNamespaceStore } from '@/stores/namespace-store';
import {
  isSkillInCurrentNamespace,
  resolveNacosNamespaceId,
} from '@/lib/resolve-nacos-namespace';
import {
  parseBizTags,
  parsePipelineInfo,
  type SkillAdminDetail,
  type SkillDocument,
  type SkillResource,
} from '@/types/skill';

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusColor(status?: string): string {
  switch (status) {
    case 'online':
      return 'success';
    case 'draft':
      return 'default';
    case 'reviewing':
      return 'processing';
    case 'reviewed':
      return 'warning';
    case 'offline':
      return 'default';
    default:
      return 'default';
  }
}

const VERSION_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  reviewing: '审核中',
  reviewed: '待发布',
  pendingPublish: '待发布',
  rejected: '审核未通过',
  online: '已上线',
  offline: '已下线',
};

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function isSemverVersion(version: string): boolean {
  return parseSemver(version) !== null;
}

function compareSemverVersion(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

function parseLegacyVersion(version: string): number | null {
  const match = version.trim().match(/^[vV](\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function isLegacyVersion(version: string): boolean {
  return parseLegacyVersion(version) !== null;
}

function compareLegacyVersion(a: string, b: string): number {
  const pa = parseLegacyVersion(a);
  const pb = parseLegacyVersion(b);
  if (pa === null || pb === null) return 0;
  return pa - pb;
}

function suggestNextVersionFromBase(baseVersion: string): string {
  const semver = parseSemver(baseVersion);
  if (semver) {
    return `${semver.major}.${semver.minor}.${semver.patch + 1}`;
  }
  const legacy = parseLegacyVersion(baseVersion);
  if (legacy !== null) {
    return `v${legacy + 1}`;
  }
  return baseVersion;
}

function InfoCell({
  label,
  value,
  icon,
  colSpan = 1,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  colSpan?: 1 | 2;
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        gridColumn: colSpan === 2 ? '1 / -1' : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
          color: 'rgba(9,25,64,0.48)',
          fontSize: 12,
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 13, wordBreak: 'break-word', color: '#091940' }}>{value}</div>
    </div>
  );
}

export default function SkillDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentNamespace, namespaceShowName } = useNamespaceStore();

  const skillName = searchParams.get('name') || '';
  const namespaceId =
    searchParams.get('namespaceId') ||
    searchParams.get('namespace') ||
    currentNamespace;
  const workspaceName = searchParams.get('workspaceName') || undefined;
  /** 市场跨空间 Skill：仅可查看与下载 zip */
  const [isReadOnly, setIsReadOnly] = useState(false);
  /** CLI 命令使用的 Nacos namespace id（由当前空间 key 解析而来） */
  const [cliNamespaceId, setCliNamespaceId] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!currentNamespace || !namespaceId) {
      setIsReadOnly(false);
      return;
    }
    // currentNamespace(namespaceShowName) → nacos namespace，再与 skill.namespaceId 比较
    void isSkillInCurrentNamespace(namespaceId, currentNamespace).then((isLocal) => {
      if (!cancelled) setIsReadOnly(!isLocal);
    });
    return () => {
      cancelled = true;
    };
  }, [currentNamespace, namespaceId]);

  // 当前空间 key → Nacos namespace id（取自 /api/admin/nacos-namespaces/list）
  useEffect(() => {
    let cancelled = false;
    if (!currentNamespace) {
      setCliNamespaceId('');
      return;
    }
    void resolveNacosNamespaceId(currentNamespace, namespaceShowName).then((id) => {
      if (!cancelled) setCliNamespaceId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [currentNamespace, namespaceShowName]);

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<(SkillAdminDetail & { name: string }) | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [versionDoc, setVersionDoc] = useState<SkillDocument | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isCreatingNewDraft, setIsCreatingNewDraft] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editResources, setEditResources] = useState<Record<string, SkillResource>>({});
  const [draftCommitMsg, setDraftCommitMsg] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const syncSourceRef = useRef<'description' | 'instruction' | null>(null);

  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [bizTagDialogOpen, setBizTagDialogOpen] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [createDraftOpen, setCreateDraftOpen] = useState(false);
  const [createDraftFromVersion, setCreateDraftFromVersion] = useState('');
  const [createDraftTargetVersion, setCreateDraftTargetVersion] = useState('');
  const [createDraftCommitMsg, setCreateDraftCommitMsg] = useState('');

  const versions = useMemo(
    () => sortVersionsDescending(detail?.versions || []),
    [detail?.versions],
  );

  const currentVersion = useMemo(
    () => versions.find((v) => v.version === selectedVersion),
    [versions, selectedVersion],
  );

  const pipelineInfo = useMemo(
    () => parsePipelineInfo(currentVersion?.publishPipelineInfo),
    [currentVersion?.publishPipelineInfo],
  );

  const bizTags = useMemo(() => parseBizTags(detail?.bizTags), [detail?.bizTags]);

  const currentVersionLabels = useMemo(() => {
    if (!selectedVersion || !detail?.labels) return [] as Array<[string, string]>;
    return Object.entries(detail.labels).filter(([, v]) => v === selectedVersion);
  }, [detail?.labels, selectedVersion]);

  const resourceEntries = useMemo(
    () => Object.keys(isEditingDraft ? editResources : versionDoc?.resource || {}),
    [editResources, isEditingDraft, versionDoc?.resource],
  );

  const actionItems = useMemo(() => {
    if (!currentVersion) return [];
    return getValidActionsWithContext(
      currentVersion.status,
      Boolean(detail?.editingVersion || detail?.reviewingVersion),
      pipelineInfo?.status,
      pipelineInfo?.historical,
    );
  }, [currentVersion, detail, pipelineInfo]);

  const loadDetail = useCallback(async () => {
    if (!skillName) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const res = await adminSkillApi.getDetail({ namespaceId, skillName });
      setDetail({ ...res, name: skillName, workspaceName });
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [namespaceId, skillName, workspaceName]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;
    const sorted = sortVersionsDescending(detail.versions || []);
    const latestLabel = detail.labels?.latest;
    const preferred =
      latestLabel && sorted.some((v) => v.version === latestLabel)
        ? latestLabel
        : sorted[0]?.version || '';
    if (!selectedVersion || !sorted.some((v) => v.version === selectedVersion)) {
      setSelectedVersion(preferred);
    }
  }, [detail, selectedVersion]);

  useEffect(() => {
    if (!selectedVersion || !skillName) {
      setVersionDoc(null);
      return;
    }
    let cancelled = false;
    setDocLoading(true);
    setIsEditingDraft(false);
    setIsCreatingNewDraft(false);
    adminSkillApi
      .getVersion({ namespaceId, skillName, version: selectedVersion })
      .then((res) => {
        if (!cancelled) setVersionDoc(res);
      })
      .catch(() => {
        if (!cancelled) setVersionDoc(null);
      })
      .finally(() => {
        if (!cancelled) setDocLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVersion, namespaceId, skillName]);

  const handleInstructionChange = useCallback(
    (val: string | undefined) => {
      let newVal = val || '';
      const fm = parseFrontmatter(newVal);
      if (fm.name === undefined || fm.name !== skillName) {
        newVal = updateFrontmatterField(newVal, 'name', skillName);
      }
      setEditInstruction(newVal);
      if (syncSourceRef.current === 'description') return;
      syncSourceRef.current = 'instruction';
      if (fm.description !== undefined) {
        setEditDescription(fm.description);
      }
      queueMicrotask(() => {
        syncSourceRef.current = null;
      });
    },
    [skillName],
  );

  const handleDescriptionChange = useCallback((newDesc: string) => {
    setEditDescription(newDesc);
    if (syncSourceRef.current === 'instruction') return;
    syncSourceRef.current = 'description';
    setEditInstruction((prev) => updateFrontmatterField(prev, 'description', newDesc));
    queueMicrotask(() => {
      syncSourceRef.current = null;
    });
  }, []);

  const validateDraftTargetVersion = useCallback(
    (targetVersion: string, basedOnVersion: string): string | null => {
      if (!targetVersion) {
        return '新版本号不能为空';
      }
      const isTargetSemver = isSemverVersion(targetVersion);
      const isTargetLegacy = isLegacyVersion(targetVersion);
      if (!isTargetSemver && !isTargetLegacy) {
        return '版本号格式不正确，格式为 x.y.z 或 vN';
      }
      if (basedOnVersion) {
        const isBaseSemver = isSemverVersion(basedOnVersion);
        const isBaseLegacy = isLegacyVersion(basedOnVersion);
        if (
          isTargetSemver &&
          isBaseSemver &&
          compareSemverVersion(targetVersion, basedOnVersion) <= 0
        ) {
          return `新版本号必须大于当前版本 ${basedOnVersion}`;
        }
        if (
          isTargetLegacy &&
          isBaseLegacy &&
          compareLegacyVersion(targetVersion, basedOnVersion) <= 0
        ) {
          return `新版本号必须大于当前版本 ${basedOnVersion}`;
        }
      }
      return null;
    },
    [],
  );

  const refreshAfterAction = async (preferVersion?: string) => {
    await loadDetail();
    const version = preferVersion || selectedVersion;
    if (preferVersion && preferVersion !== selectedVersion) {
      setSelectedVersion(preferVersion);
    }
    // 版本号未变时 useEffect 不会重拉；保存草稿后必须显式刷新 versionDoc
    if (version) {
      try {
        const res = await adminSkillApi.getVersion({
          namespaceId,
          skillName,
          version,
        });
        setVersionDoc(res);
      } catch {
        setVersionDoc(null);
      }
    }
  };

  const runAction = async (
    fn: () => Promise<unknown>,
    successMsg: string,
    resetToLatest = false,
  ) => {
    setActionLoading(true);
    try {
      await fn();
      message.success(successMsg);
      if (resetToLatest) {
        // 删除草稿后，切换到删除后的最新版本，避免继续请求已删除的版本
        const res = await adminSkillApi.getDetail({ namespaceId, skillName });
        setDetail({ ...res, name: skillName, workspaceName });
        const sorted = sortVersionsDescending(res?.versions || []);
        const latestLabel = res?.labels?.latest;
        const preferred =
          latestLabel && sorted.some((v) => v.version === latestLabel)
            ? latestLabel
            : sorted[0]?.version || '';
        if (preferred) {
          setSelectedVersion(preferred);
          const doc = await adminSkillApi.getVersion({
            namespaceId,
            skillName,
            version: preferred,
          });
          setVersionDoc(doc);
        } else {
          setSelectedVersion('');
          setVersionDoc(null);
        }
      } else {
        await refreshAfterAction();
      }
    } catch {
      // interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleScope = async () => {
    if (!detail) return;
    const next = detail.scope === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    const workspaceName = await getHostWorkspaceName();
    await runAction(
      () => adminSkillApi.updateVisibility({ namespaceId, skillName, visibility: next, workspaceName }),
      '可见范围已更新',
    );
  };

  const handleDownload = async (version: string) => {
    try {
      const blob = await adminSkillApi.downloadVersion({ namespaceId, skillName, version });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skillName}-${version}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // interceptor
    }
  };

  const skillMdContent = isEditingDraft ? editInstruction : versionDoc?.skillMd ?? '';
  const hasSkillMdContent = skillMdContent.length > 0;
  const downloadZipName = selectedVersion ? `${skillName}-${selectedVersion}.zip` : '';

  const cliCommands = useMemo(() => {
    const versionFlag = selectedVersion ? ` --version ${selectedVersion}` : '';
    return [
      {
        label: 'CLI 安装',
        command: `npx @testinfra-ai-group/cli skill-get ${skillName}${versionFlag} --namespace ${cliNamespaceId}`,
      },
    ];
  }, [skillName, selectedVersion, cliNamespaceId]);

  const handleCopySkillMd = async () => {
    if (!hasSkillMdContent) return;
    const ok = await copyToClipboard(skillMdContent);
    if (ok) {
      message.success('文件内容已复制');
    } else {
      message.error('复制文件内容失败');
    }
  };

  const handleDownloadSkillMd = () => {
    if (!hasSkillMdContent) return;
    downloadTextFile('SKILL.md', skillMdContent);
  };

  const handleStartEdit = () => {
    setEditInstruction(versionDoc?.skillMd ?? '');
    setEditDescription(versionDoc?.description ?? '');
    setEditResources({ ...(versionDoc?.resource ?? {}) });
    setDraftCommitMsg(currentVersion?.commitMsg?.trim() || '');
    setIsCreatingNewDraft(false);
    setIsEditingDraft(true);
    setActiveTab('overview');
  };

  const handleCancelEdit = () => {
    setIsEditingDraft(false);
    setIsCreatingNewDraft(false);
    setEditResources({});
    setDraftCommitMsg('');
  };

  const handleSaveDraft = async () => {
    if (!editDescription.trim()) {
      message.error('描述不能为空');
      return;
    }
    if (!hasNonFrontmatterMarkdownBody(editInstruction)) {
      message.error('SKILL.md 内容不能为空');
      return;
    }
    setDraftSaving(true);
    try {
      const skillCard = JSON.stringify({
        name: skillName,
        description: editDescription.trim(),
        skillMd: editInstruction,
        resource: editResources,
      });
      const commitOpt = draftCommitMsg.trim() || undefined;
      if (isCreatingNewDraft) {
        await adminSkillApi.createDraft({
          namespaceId,
          skillName,
          skillCard,
          commitMsg: commitOpt,
        });
        message.success('草稿创建成功');
        setIsCreatingNewDraft(false);
        setIsEditingDraft(false);
        setDraftCommitMsg('');
        await loadDetail();
        const res = await adminSkillApi.getDetail({ namespaceId, skillName });
        const editing = res?.editingVersion;
        if (editing) {
          setSelectedVersion(editing);
        }
      } else {
        await adminSkillApi.updateDraft({
          namespaceId,
          skillCard,
          commitMsg: commitOpt,
        });
        message.success('草稿已保存');
        setIsEditingDraft(false);
        await refreshAfterAction(selectedVersion);
      }
    } catch {
      // interceptor
    } finally {
      setDraftSaving(false);
    }
  };

  const handleCreateDraftFrom = async () => {
    const target = createDraftTargetVersion.trim();
    const errorMsg = validateDraftTargetVersion(target, createDraftFromVersion);
    if (errorMsg) {
      message.error(errorMsg);
      return;
    }
    setActionLoading(true);
    try {
      await adminSkillApi.createDraft({
        namespaceId,
        skillName,
        basedOnVersion: createDraftFromVersion,
        targetVersion: target,
        commitMsg: createDraftCommitMsg.trim() || undefined,
      });
      message.success('草稿创建成功');
      setCreateDraftOpen(false);
      setCreateDraftTargetVersion('');
      setCreateDraftCommitMsg('');
      await loadDetail();
      const res = await adminSkillApi.getDetail({ namespaceId, skillName });
      if (res?.editingVersion) {
        setSelectedVersion(res.editingVersion);
      } else {
        setSelectedVersion(target);
      }
      setActiveTab('overview');
    } catch {
      // interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const openCreateDraft = (fromVersion?: string) => {
    if (!fromVersion) {
      setEditDescription('');
      setEditInstruction('');
      setEditResources({});
      setDraftCommitMsg('');
      setIsCreatingNewDraft(true);
      setIsEditingDraft(true);
      setActiveTab('overview');
      setVersionDrawerOpen(false);
      return;
    }
    setCreateDraftFromVersion(fromVersion);
    setCreateDraftTargetVersion(suggestNextVersionFromBase(fromVersion));
    setCreateDraftCommitMsg('');
    setCreateDraftOpen(true);
  };

  const handleSubmit = async (version: string) => {
    const doc =
      version === selectedVersion
        ? versionDoc
        : (
            await adminSkillApi.getVersion({ namespaceId, skillName, version })
          );
    if (
      !doc?.description?.trim() ||
      !hasNonFrontmatterMarkdownBody(doc.skillMd || '')
    ) {
      message.error('提交前请填写描述和 SKILL.md 内容');
      return;
    }
    await runAction(
      () => adminSkillApi.submit({ namespaceId, skillName, version }),
      '提交发布成功',
    );
  };

  const handleRedraft = async (version: string) => {
    setActionLoading(true);
    try {
      await adminSkillApi.redraft({ namespaceId, skillName, version });
      message.success('版本已退回草稿，可重新编辑');
      await loadDetail();
      setSelectedVersion(version);
      const response = await adminSkillApi.getVersion({ namespaceId, skillName, version });
      setVersionDoc(response);
      const doc = response;
      setEditInstruction(doc?.skillMd ?? '');
      setEditDescription(doc?.description ?? '');
      setEditResources({ ...(doc?.resource ?? {}) });
      setDraftCommitMsg('');
      setIsCreatingNewDraft(false);
      setIsEditingDraft(true);
      setActiveTab('overview');
      setVersionDrawerOpen(false);
    } catch {
      // interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectVersion = (version: string) => {
    setSelectedVersion(version);
    setIsEditingDraft(false);
    setIsCreatingNewDraft(false);
    setVersionDrawerOpen(false);
  };

  const confirmAction = (
    title: string,
    content: string,
    onOk: () => Promise<void>,
  ) => {
    Modal.confirm({
      title,
      content,
      okText: '确认',
      cancelText: '取消',
      onOk,
    });
  };

  const hasAction = (action: string) =>
    actionItems.some((i) => i.action === action && !i.disabled);
  const disabledReason = (action: string) =>
    actionItems.find((i) => i.action === action)?.disabledReason;

  const versionSelectOptions = useMemo(() => {
    const latest = detail?.labels?.latest;
    return versions.map((v) => {
      const tags: Array<{ text: string; color: string }> = [];
      if (latest === v.version) tags.push({ text: '最新', color: 'success' });

      const pipeline = parsePipelineInfo(v.publishPipelineInfo);
      const isRejected = v.status === 'reviewed' && pipeline?.status === 'REJECTED';
      const isPendingPublish =
        (v.status === 'reviewed' && pipeline?.status !== 'REJECTED') ||
        (v.status === 'reviewing' && pipeline?.status === 'APPROVED');

      if (v.status === 'draft') tags.push({ text: '草稿', color: 'gold' });
      else if (isRejected) tags.push({ text: '审核未通过', color: 'error' });
      else if (v.status === 'reviewing' || v.status === 'reviewed') {
        tags.push({
          text: isPendingPublish ? '待发布' : '审核中',
          color: isPendingPublish ? 'cyan' : 'processing',
        });
      }
      return { label: v.version, value: v.version, tags };
    });
  }, [versions, detail?.labels?.latest]);

  const renderVersionSelectLabel = (
    version: string,
    tags?: Array<{ text: string; color: string }>,
  ) => (
    <span className="agent-version-option">
      <span className="agent-version-option__ver">{version}</span>
      {tags?.map((tag) => (
        <Tag key={tag.text} color={tag.color} bordered={false} className="agent-version-option__tag">
          {tag.text}
        </Tag>
      ))}
    </span>
  );

  const renderHeroActions = () => {
    if (isReadOnly) return null;

    if (!selectedVersion || !currentVersion) {
      if (versions.length === 0 && !isEditingDraft) {
        return (
          <Button
            className="agent-pill-btn agent-pill-btn--primary"
            icon={<PlusOutlined />}
            onClick={() => openCreateDraft()}
          >
            创建草稿
          </Button>
        );
      }
      if (isEditingDraft) {
        return (
          <div className="agent-hero-actions">
            <Button
              className="agent-pill-btn"
              icon={<EditOutlined />}
              onClick={handleCancelEdit}
              disabled={draftSaving}
            >
              取消
            </Button>
            <Button
              className="agent-pill-btn agent-pill-btn--primary"
              icon={<SaveOutlined />}
              loading={draftSaving}
              onClick={() => void handleSaveDraft()}
            >
              保存
            </Button>
          </div>
        );
      }
      return null;
    }

    return (
      <div className="agent-hero-actions">
        {currentVersion.status === 'draft' ? (
          isEditingDraft ? (
            <>
              <Button
                className="agent-pill-btn"
                icon={<EditOutlined />}
                onClick={handleCancelEdit}
                disabled={draftSaving}
              >
                取消
              </Button>
              <Button
                className="agent-pill-btn agent-pill-btn--primary"
                icon={<SaveOutlined />}
                loading={draftSaving}
                onClick={() => void handleSaveDraft()}
              >
                保存
              </Button>
            </>
          ) : (
            <Button
              className="agent-pill-btn agent-pill-btn--primary"
              icon={<EditOutlined />}
              onClick={handleStartEdit}
            >
              编辑
            </Button>
          )
        ) : null}
        {hasAction('submit') ? (
          <Button
            className="agent-pill-btn agent-pill-btn--ghost"
            icon={<SendOutlined />}
            loading={actionLoading}
            disabled={isEditingDraft}
            onClick={() => void handleSubmit(selectedVersion)}
          >
            提交发布
          </Button>
        ) : null}
        {hasAction('publish') ? (
          <Button
            className="agent-pill-btn agent-pill-btn--primary"
            loading={actionLoading}
            disabled={isEditingDraft}
            onClick={() =>
              void runAction(
                () => adminSkillApi.publish({ namespaceId, skillName, version: selectedVersion }),
                '发布成功',
              )
            }
          >
            发布
          </Button>
        ) : actionItems.some((i) => i.action === 'publish' && i.disabled) ? (
          <Button className="agent-pill-btn" disabled title={disabledReason('publish') ?? undefined}>
            发布
          </Button>
        ) : null}
        {hasAction('redraft') ? (
          <Button
            className="agent-pill-btn"
            loading={actionLoading}
            disabled={isEditingDraft}
            onClick={() => void handleRedraft(selectedVersion)}
          >
            创建草稿
          </Button>
        ) : null}
        {hasAction('deleteDraft') ? (
          <Button
            className="agent-pill-btn"
            danger
            icon={<DeleteOutlined />}
            loading={actionLoading}
            disabled={isEditingDraft}
            onClick={() =>
              confirmAction('删除', '确定要删除草稿吗？', async () => {
                setActionLoading(true);
                try {
                  await adminSkillApi.deleteDraft({ namespaceId, skillName });
                  message.success('草稿已删除');
                  // 删除后刷新列表，并切换到最新有效版本，避免用已删除的版本号请求详情
                  await loadDetail();
                  const res = await adminSkillApi.getDetail({ namespaceId, skillName });
                  const sorted = sortVersionsDescending(res?.versions || []);
                  const latestLabel = res?.labels?.latest;
                  const preferred =
                    latestLabel && sorted.some((v) => v.version === latestLabel)
                      ? latestLabel
                      : sorted[0]?.version || '';
                  setSelectedVersion(preferred);
                  setVersionDoc(null);
                } catch {
                  // interceptor
                } finally {
                  setActionLoading(false);
                }
              })
            }
          >
            删除草稿
          </Button>
        ) : null}
        {/* {!isEditingDraft && hasAction('online') ? (
          <Button
            className="agent-pill-btn agent-pill-btn--primary"
            loading={actionLoading}
            icon={<PoweroffOutlined rotate={180} />}
            onClick={() =>
              void runAction(
                () =>
                  adminSkillApi.online({
                    namespaceId,
                    skillName,
                    scope: 'version',
                    version: selectedVersion,
                  }),
                '上线成功',
              )
            }
          >
            版本上线
          </Button>
        ) : null}
        {!isEditingDraft && hasAction('offline') ? (
          <Button
            className="agent-pill-btn"
            loading={actionLoading}
            icon={<PoweroffOutlined />}
            onClick={() =>
              void runAction(
                () =>
                  adminSkillApi.offline({
                    namespaceId,
                    skillName,
                    scope: 'version',
                    version: selectedVersion,
                  }),
                '下线成功',
              )
            }
          >
            版本下线
          </Button>
        ) : null} */}
        {!isEditingDraft && actionItems.some((i) => i.action === 'createDraftFrom') ? (
          <Button
            className="agent-pill-btn"
            icon={<PlusOutlined />}
            disabled={actionItems.some((i) => i.action === 'createDraftFrom' && i.disabled)}
            title={actionItems.find((i) => i.action === 'createDraftFrom')?.disabledReason}
            onClick={() => openCreateDraft(selectedVersion)}
          >
            基于此版本创建草稿
          </Button>
        ) : null}
      </div>
    );
  };

  if (!skillName) {
    return (
      <div className="agent">
        <div className="agent-shell">
          <button type="button" className="agent-back" onClick={() => navigate('/skill')}>
            <ArrowLeft size={15} strokeWidth={2.2} />
            返回
          </button>
          <div className="agent-section">
            <Empty style={{ padding: 48 }} description="加载数据失败" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent">
      <div className="agent-shell">
        <Spin spinning={loading}>
          {!detail && !loading ? (
            <div className="agent-section">
              <Empty style={{ padding: 48 }} description="加载数据失败" />
            </div>
          ) : detail ? (
            <>
              <section className="agent-section">
                <div className="agent-section-body" style={{ paddingTop: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button type="button" className="agent-back" onClick={() => navigate('/skill')}>
                      <ArrowLeft size={15} strokeWidth={2.2} />
                      返回
                    </button>
                    <Space wrap size={8}>
                      {versions.length > 0 ? (
                        <Select
                          className="agent-version-select"
                          style={{ minWidth: 180 }}
                          value={selectedVersion || undefined}
                          placeholder="选择版本"
                          disabled={isEditingDraft}
                          options={versionSelectOptions}
                          onChange={(version) => handleSelectVersion(version)}
                          optionRender={(option) =>
                            renderVersionSelectLabel(
                              String(option.data.value),
                              option.data.tags as Array<{ text: string; color: string }> | undefined,
                            )
                          }
                          labelRender={(props) => {
                            const opt = versionSelectOptions.find((o) => o.value === props.value);
                            return renderVersionSelectLabel(String(props.value ?? ''), opt?.tags);
                          }}
                        />
                      ) : null}
                      <Button
                        icon={<HistoryOutlined />}
                        disabled={isEditingDraft}
                        onClick={() => setVersionDrawerOpen(true)}
                      >
                        版本历史
                      </Button>
                    </Space>
                  </div>

                  <div className="agent-detail-hero">
                    <div className="agent-detail-avatar">{agentInitials(skillName)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#091940' }}>
                          {detail.name}
                        </div>
                        {selectedVersion ? (
                          <span className="agent-version-pill">{selectedVersion}</span>
                        ) : null}
                        {currentVersion ? (
                          <Tag color={statusColor(currentVersion.status)}>
                            {VERSION_STATUS_LABEL[currentVersion.status] ?? currentVersion.status}
                          </Tag>
                        ) : null}
                        {/* {detail.enable ? (
                          <span className="agent-status on">
                            <span className="agent-status-dot" />
                            已启用
                          </span>
                        ) : (
                          <span className="agent-status off">
                            <span className="agent-status-dot" />
                            已禁用
                          </span>
                        )} */}
                      </div>

                      {isReadOnly ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            marginTop: 10,
                            flexWrap: 'wrap',
                            fontSize: 12,
                            color: 'rgba(9,25,64,0.72)',
                          }}
                        >
                          {/* <span>{detail.enable ? '已启用' : '已禁用'}</span>
                          <div
                            style={{
                              width: 1,
                              height: 14,
                              background: 'rgba(9,25,64,0.12)',
                            }}
                          /> */}
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {detail.scope === 'PUBLIC' ? <GlobalOutlined /> : <LockOutlined />}
                            {detail.scope === 'PUBLIC' ? '公开' : '私有空间'}
                          </span>
                          <Tag style={{ margin: 0 }}>只读 · 来自其他空间</Tag>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            marginTop: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          {/* <Space size={8}>
                            <Switch
                              size="small"
                              checked={detail.enable}
                              loading={actionLoading}
                              onChange={() => void handleToggleEnable()}
                            />
                            <span style={{ fontSize: 12, color: 'rgba(9,25,64,0.72)' }}>
                              {detail.enable ? '已启用' : '已禁用'}
                            </span>
                          </Space>
                          <div
                            style={{
                              width: 1,
                              height: 14,
                              background: 'rgba(9,25,64,0.12)',
                            }}
                          /> */}
                          <Space size={8}>
                            <Switch
                              size="small"
                              checked={detail.scope === 'PUBLIC'}
                              loading={actionLoading}
                              onChange={() => void handleToggleScope()}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                color: 'rgba(9,25,64,0.72)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {detail.scope === 'PUBLIC' ? <GlobalOutlined /> : <LockOutlined />}
                              {detail.scope === 'PUBLIC' ? '公开' : '私有空间'}
                            </span>
                          </Space>
                        </div>
                      )}

                      {isEditingDraft ? (
                        <Input.TextArea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => handleDescriptionChange(e.target.value)}
                          placeholder="请输入描述"
                          style={{ marginTop: 10, maxWidth: 640 }}
                        />
                      ) : versionDoc?.description ? (
                        <p
                          style={{
                            margin: '10px 0 0',
                            fontSize: 13,
                            color: 'rgba(9,25,64,0.48)',
                            lineHeight: 1.6,
                            maxWidth: 640,
                          }}
                        >
                          {versionDoc.description}
                        </p>
                      ) : null}

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          marginTop: 10,
                          fontSize: 12,
                          color: 'rgba(9,25,64,0.48)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <GlobalOutlined />
                          {detail.onlineCnt ?? 0} 个版本
                        </span>
                        {(detail.downloadCount ?? 0) > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <DownloadOutlined />
                            下载 {detail.downloadCount}
                          </span>
                        ) : null}
                        {detail.updateTime ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ClockCircleOutlined />
                            {formatAgentTime(new Date(detail.updateTime).toISOString())}
                          </span>
                        ) : null}
                        {detail.workspaceName ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <TagOutlined />
                            所属空间：{detail.workspaceName}
                          </span>
                        ) : null}
                      </div>

                      {!isReadOnly ? (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: '1px solid rgba(9,25,64,0.08)',
                          }}
                        >
                          {!detail.enable ? (
                            <Alert
                              type="warning"
                              showIcon
                              style={{ marginBottom: 8 }}
                              message="Skill 已禁用，版本状态变更不会生效"
                            />
                          ) : null}
                          {renderHeroActions()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <div
                style={{
                  opacity: actionLoading ? 0.55 : 1,
                  pointerEvents: actionLoading ? 'none' : undefined,
                }}
              >
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={[
                    {
                      key: 'overview',
                      label: (
                        <span>
                          <FileTextOutlined /> SKILL.md
                        </span>
                      ),
                      children: (
                        <div
                          className={
                            isEditingDraft
                              ? 'grid grid-cols-1 gap-3'
                              : 'grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]'
                          }
                        >
                          <AgentSection
                            title="SKILL.md"
                            extra={
                              !isEditingDraft && !isReadOnly ? (
                                <Space size={4}>
                                  <Tooltip title="复制文件内容">
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<CopyOutlined />}
                                      disabled={!hasSkillMdContent}
                                      onClick={() => void handleCopySkillMd()}
                                    />
                                  </Tooltip>
                                  <Tooltip title="下载文件">
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<DownloadOutlined />}
                                      disabled={!hasSkillMdContent}
                                      onClick={handleDownloadSkillMd}
                                    />
                                  </Tooltip>
                                </Space>
                              ) : null
                            }
                          >
                            <div style={{ minHeight: 480 }}>
                              {docLoading ? (
                                <Skeleton active paragraph={{ rows: 6 }} title={false} />
                              ) : isEditingDraft ? (
                                <div
                                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                                  data-color-mode="light"
                                >
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: 12,
                                      color: 'rgba(9,25,64,0.48)',
                                    }}
                                  >
                                    当 Agent 加载该 Skill 时，将注入完整的 SKILL.md 内容（包含
                                    frontmatter 与正文）作为执行上下文。
                                  </p>
                                  <div
                                    style={{
                                      border: '1px solid #f1f2f4',
                                      borderRadius: 4,
                                      padding: 12,
                                      background: '#fafbfc',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        marginBottom: 6,
                                        fontWeight: 500,
                                        color: '#091940',
                                      }}
                                    >
                                      提交说明
                                    </div>
                                    <Input.TextArea
                                      rows={2}
                                      value={draftCommitMsg}
                                      onChange={(e) => setDraftCommitMsg(e.target.value)}
                                      placeholder="可选：说明本草稿版本的变更内容"
                                      disabled={draftSaving}
                                    />
                                    <div
                                      style={{
                                        marginTop: 6,
                                        fontSize: 11,
                                        color: 'rgba(9,25,64,0.48)',
                                      }}
                                    >
                                      保存草稿时可填写本次变更说明，便于后续追溯。
                                    </div>
                                  </div>
                                  <MDEditor
                                    value={editInstruction}
                                    onChange={handleInstructionChange}
                                    height={500}
                                    preview="live"
                                    highlightEnable={false}
                                    previewOptions={{
                                      remarkPlugins: [remarkGfm, remarkFrontmatter],
                                    }}
                                  />
                                </div>
                              ) : versionDoc?.skillMd ? (
                                <div className="app-markdown prose prose-sm max-w-none">
                                  <Markdown remarkPlugins={[remarkGfm, remarkFrontmatter]}>
                                    {prepareSkillMarkdownPreview(versionDoc.skillMd)}
                                  </Markdown>
                                </div>
                              ) : (
                                <p style={{ margin: 0, fontSize: 13, color: 'rgba(9,25,64,0.48)' }}>
                                  暂无描述
                                </p>
                              )}
                            </div>
                          </AgentSection>

                          {!isEditingDraft ? (
                            <div className="flex flex-col gap-3 lg:w-[320px]">
                              <CliCommandCard
                                commands={currentVersion?.status !== 'draft' ? cliCommands : []}
                                onDownload={selectedVersion ? () => handleDownload(selectedVersion) : undefined}
                                downloadFileName={selectedVersion ? downloadZipName : undefined}
                              />

                              <AgentSection title="基础信息">
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    margin: '-4px -4px 0',
                                  }}
                                >
                                  <div style={{ borderBottom: '1px solid #f1f2f4' }}>
                                    <InfoCell
                                      label="状态"
                                      icon={<TagOutlined />}
                                      value={
                                        currentVersion ? (
                                          <Tag color={statusColor(currentVersion.status)}>
                                            {VERSION_STATUS_LABEL[currentVersion.status] ??
                                              currentVersion.status}
                                          </Tag>
                                        ) : (
                                          '-'
                                        )
                                      }
                                    />
                                  </div>
                                  <div
                                    style={{
                                      borderBottom: '1px solid #f1f2f4',
                                      borderLeft: '1px solid #f1f2f4',
                                    }}
                                  >
                                    <InfoCell
                                      label="创建人"
                                      icon={<GlobalOutlined />}
                                      value={currentVersion?.author || '-'}
                                    />
                                  </div>
                                  <div style={{ borderBottom: '1px solid #f1f2f4' }}>
                                    <InfoCell
                                      label="下载量"
                                      icon={<DownloadOutlined />}
                                      value={String(detail.downloadCount ?? 0)}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      borderBottom: '1px solid #f1f2f4',
                                      borderLeft: '1px solid #f1f2f4',
                                    }}
                                  >
                                    <InfoCell
                                      label="版本下载量"
                                      icon={<DownloadOutlined />}
                                      value={String(currentVersion?.downloadCount ?? 0)}
                                    />
                                  </div>
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <InfoCell
                                      label="提交说明"
                                      icon={<MessageOutlined />}
                                      colSpan={2}
                                      value={
                                        <span
                                          style={{
                                            fontSize: 12,
                                            color: 'rgba(9,25,64,0.48)',
                                            whiteSpace: 'pre-wrap',
                                          }}
                                        >
                                          {currentVersion?.commitMsg?.trim()
                                            ? currentVersion.commitMsg
                                            : '-'}
                                        </span>
                                      }
                                    />
                                  </div>
                                </div>
                              </AgentSection>

                              {pipelineInfo ? (
                                <AgentSection title="流水线状态">
                                  <PipelineStatusDisplay
                                    pipelineInfo={pipelineInfo}
                                    onRefresh={() => void loadDetail()}
                                  />
                                </AgentSection>
                              ) : null}

                              <AgentSection
                                title="业务标签"
                                extra={
                                  !isReadOnly ? (
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => setBizTagDialogOpen(true)}
                                    />
                                  ) : null
                                }
                              >
                                {bizTags.length > 0 ? (
                                  <Space wrap size={[6, 6]}>
                                    {bizTags.map((tag) => (
                                      <Tag key={tag}>{tag}</Tag>
                                    ))}
                                  </Space>
                                ) : (
                                  <span style={{ fontSize: 12, color: 'rgba(9,25,64,0.48)' }}>
                                    暂无业务标签
                                  </span>
                                )}
                              </AgentSection>

                              <AgentSection
                                title="版本标签"
                                extra={
                                  !isReadOnly &&
                                  selectedVersion &&
                                  currentVersion?.status !== 'draft' &&
                                  currentVersion?.status !== 'reviewing' ? (
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => setLabelDialogOpen(true)}
                                    />
                                  ) : null
                                }
                              >
                                {currentVersionLabels.length > 0 ? (
                                  <Space wrap size={[6, 6]}>
                                    {currentVersionLabels.map(([key]) => (
                                      <Tag key={key}>{key}</Tag>
                                    ))}
                                  </Space>
                                ) : (
                                  <span style={{ fontSize: 12, color: 'rgba(9,25,64,0.48)' }}>
                                    暂无版本标签
                                  </span>
                                )}
                              </AgentSection>
                            </div>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      key: 'resources',
                      label: (
                        <span>
                          资源文件
                          {resourceEntries.length > 0 ? (
                            <Tag style={{ marginLeft: 6 }}>{resourceEntries.length}</Tag>
                          ) : null}
                        </span>
                      ),
                      children: (
                        <AgentSection title="资源文件">
                          <SkillResourcePanel
                            resources={
                              isEditingDraft ? editResources : versionDoc?.resource || {}
                            }
                            editable={isEditingDraft}
                            onChange={isEditingDraft ? setEditResources : undefined}
                          />
                        </AgentSection>
                      ),
                    },
                  ]}
                />
              </div>
            </>
          ) : null}
        </Spin>

        <Drawer
          title="版本历史"
          placement="right"
          width={420}
          open={versionDrawerOpen}
          onClose={() => setVersionDrawerOpen(false)}
          destroyOnClose
        >
          {detail ? (
            <>
              <div style={{ marginBottom: 12, color: 'rgba(9,25,64,0.55)', fontSize: 13 }}>
                {`共 ${versions.length} 个版本`}
              </div>
              <SkillVersionTimeline
                versions={versions}
                currentVersion={selectedVersion}
                hasEditingVersion={!!detail.editingVersion}
                hasReviewingVersion={!!detail.reviewingVersion}
                onSelectVersion={handleSelectVersion}
                onCreateDraft={openCreateDraft}
                onDeleteDraft={async () => {
                  await runAction(
                    () => adminSkillApi.deleteDraft({ namespaceId, skillName }),
                    '草稿已删除',
                    true,
                  );
                }}
                onSubmit={(version) => void handleSubmit(version)}
                onPublish={(version) =>
                  void runAction(
                    () => adminSkillApi.publish({ namespaceId, skillName, version }),
                    '发布成功',
                  )
                }
                onOnline={(version) =>
                  void runAction(
                    () =>
                      adminSkillApi.online({
                        namespaceId,
                        skillName,
                        scope: 'version',
                        version,
                      }),
                    '上线成功',
                  )
                }
                onOffline={(version) =>
                  void runAction(
                    () =>
                      adminSkillApi.offline({
                        namespaceId,
                        skillName,
                        scope: 'version',
                        version,
                      }),
                    '下线成功',
                  )
                }
                onDownload={(version) => void handleDownload(version)}
                showCreateDraftButton={!isReadOnly}
                allLabels={detail.labels}
                onSaveLabels={
                  isReadOnly
                    ? undefined
                    : async (labels) => {
                        await adminSkillApi.updateLabels({
                          namespaceId,
                          skillName,
                          labels: JSON.stringify(labels),
                        });
                        message.success('标签已更新');
                        await loadDetail();
                      }
                }
                skillEnabled={detail.enable}
                readOnly={isReadOnly}
              />
            </>
          ) : null}
        </Drawer>

        {!isReadOnly && selectedVersion ? (
          <LabelBindDialog
            open={labelDialogOpen}
            onOpenChange={setLabelDialogOpen}
            version={selectedVersion}
            allLabels={detail?.labels || {}}
            onSave={async (labels) => {
              await adminSkillApi.updateLabels({
                namespaceId,
                skillName,
                labels: JSON.stringify(labels),
              });
              message.success('标签已更新');
              await loadDetail();
            }}
          />
        ) : null}

        {!isReadOnly ? (
          <BizTagEditDialog
            open={bizTagDialogOpen}
            onOpenChange={setBizTagDialogOpen}
            tags={bizTags}
            placeholder="添加标签"
            emptyText="暂无业务标签"
            onSave={async (next) => {
              await adminSkillApi.updateBizTags({
                namespaceId,
                skillName,
                bizTags: next,
              });
              message.success('业务标签更新成功');
              await loadDetail();
            }}
          />
        ) : null}

        <Modal
          title="创建草稿"
          open={!isReadOnly && createDraftOpen}
          onCancel={() => setCreateDraftOpen(false)}
          onOk={() => void handleCreateDraftFrom()}
          confirmLoading={actionLoading}
          okText="创建草稿"
          cancelText="取消"
        >
          <p style={{ marginBottom: 12 }}>
            {`基于版本 ${createDraftFromVersion} 创建新草稿，请输入新版本号`}
          </p>
          <Input
            placeholder="例如: 1.0.1 或 v2"
            value={createDraftTargetVersion}
            onChange={(e) => setCreateDraftTargetVersion(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Input.TextArea
            rows={2}
            placeholder="可选：说明本草稿版本的变更内容"
            value={createDraftCommitMsg}
            onChange={(e) => setCreateDraftCommitMsg(e.target.value)}
          />
        </Modal>
      </div>
    </div>
  );
}
