import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  RightOutlined,
  LeftOutlined,
} from '@ant-design/icons';
import { adminAgentApi } from '@/api/admin';
import { adminSkillApi } from '@/api/admin/skill';
import { datasetApi } from '@/api/langfuse';
import { useNamespaceStore } from '@/stores/namespace-store';
import type { HttpAgentListItem } from '@/types/adminAgent';
import type { Dataset } from '@/types/dataset';
import type { SkillListItem } from '@/types/skill';
import { formatDatasetTime } from '@/pages/dataset/datasetManagement/utils';
import { formatAgentTime } from '@/pages/agentManagement/AgentPageShell';
import { resolveNacosNamespaceId } from '@/lib/resolve-nacos-namespace';
import { EvaluatorAgentSelector } from './EvaluatorAgentSelector';

const { TextArea } = Input;

type StepKey = 'agent' | 'dataset' | 'evaluators' | 'review';
type AgentKind = 'http' | 'nacos';

interface SelectableAgent {
  key: string;
  kind: AgentKind;
  name: string;
  description?: string;
  agentId?: number;
  workspace?: string;
  enabled?: boolean;
  createdTime?: string;
  /** 列表侧已知的最新版本，作兜底 */
  latestVersion?: string;
  /** Nacos 列表可能直接带回的版本明细 */
  knownVersionDetails?: AgentVersionOption[];
}

interface AgentVersionOption {
  version: string;
  deliveryVersionId?: number;
  createdTime?: string;
  updateTime?: string;
}

interface RunExperimentModalProps {
  open: boolean;
  onClose: () => void;
  dataset: Dataset | null;
  onSuccess?: (payload: { runName: string }) => void;
}

export function RunExperimentModal({
  open,
  onClose,
  dataset,
  onSuccess,
}: RunExperimentModalProps) {
  const { currentNamespace, namespaceShowName } = useNamespaceStore();
  const workspace = currentNamespace;

  const [step, setStep] = useState<StepKey>('agent');
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Agent（双下拉：Agent 名 + 版本，对齐 langfuse PromptModelStep）
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agents, setAgents] = useState<SelectableAgent[]>([]);
  const [agentKey, setAgentKey] = useState<string | undefined>();
  const [agentVersion, setAgentVersion] = useState<string | undefined>();
  const [agentVersions, setAgentVersions] = useState<AgentVersionOption[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Step 2 — Dataset
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetName, setDatasetName] = useState<string>('');

  // Step 3 — Evaluators (Agent-based)
  const [evaluatorsLoading, setEvaluatorsLoading] = useState(false);
  const [evaluatorAgents, setEvaluatorAgents] = useState<SelectableAgent[]>([]);
  const [selectedEvaluatorAgentKey, setSelectedEvaluatorAgentKey] = useState<string | undefined>();
  const [evaluatorAgentVersions, setEvaluatorAgentVersions] = useState<AgentVersionOption[]>([]);
  const [selectedEvaluatorAgentVersion, setSelectedEvaluatorAgentVersion] = useState<string | undefined>();
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | undefined>();
  // 记录用户是否手动选择过评估器版本，避免 evaluatorAgents 引用变化时被重置
  const evaluatorVersionTouchedRef = useRef(false);

  // Step 4 — Review / details
  const [experimentName, setExperimentName] = useState('');
  const [description, setDescription] = useState('');
  const [nameTouched, setNameTouched] = useState(false);

  const selectedAgentBase = useMemo(
    () => agents.find((a) => a.key === agentKey) ?? null,
    [agents, agentKey],
  );
  const selectedVersionOpt = useMemo(
    () => agentVersions.find((v) => v.version === agentVersion) ?? null,
    [agentVersions, agentVersion],
  );
  const selectedAgent = useMemo(() => {
    if (!selectedAgentBase || !agentVersion) return null;
    return { ...selectedAgentBase, version: agentVersion };
  }, [selectedAgentBase, agentVersion]);
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.name === datasetName) ?? dataset,
    [datasets, datasetName, dataset],
  );

  const steps: { key: StepKey; title: string }[] = [
    { key: 'agent', title: "选择 Agent" },
    { key: 'dataset', title: "选择数据集" },
    { key: 'evaluators', title: "选择评估器" },
    { key: 'review', title: "确认执行" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  const resetState = useCallback(() => {
    setStep('agent');
    setAgentKey(undefined);
    setAgentVersion(undefined);
    setAgentVersions([]);
    setDatasetName(dataset?.name || '');
    setSelectedEvaluatorAgentKey(undefined);
    setSelectedEvaluatorAgentVersion(undefined);
    setEvaluatorAgentVersions([]);
    setSkills([]);
    setSelectedSkill(undefined);
    setExperimentName('');
    setDescription('');
    setNameTouched(false);
    setSubmitting(false);
  }, [dataset?.name]);

  useEffect(() => {
    if (!open) return;
    resetState();
  }, [open, resetState]);

  // Load agents：与 agentManagement 相同数据源（HTTP + Nacos，当前 namespace）
  useEffect(() => {
    if (!open || !workspace) return;
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      try {
        const httpRes = await adminAgentApi.listHttpAgents({
          workspace,
          pageNo: 1,
          pageSize: 200,
        });
        const httpList: SelectableAgent[] = (httpRes?.records || []).map(
          (a: HttpAgentListItem) => ({
            key: `http:${a.agentId}`,
            kind: 'http' as const,
            name: a.name || String(a.agentId),
            description: a.description,
            agentId: a.agentId,
            workspace: a.workspace,
            enabled: a.enabled,
            createdTime: a.createdTime,
            latestVersion: a.latestDeliveryVersion,
          }),
        );
        // 先注释掉 nacos 的 agent 列表请求，会报错
        // const nacosRes = await adminAgentApi.listNacosAgents({
        //   namespaceId: 'public', // nacos agent 默认 namespaceId 固定为public
        //   pageNo: 1,
        //   pageSize: 200,
        // });
        // const nacosList: SelectableAgent[] = (nacosRes?.pageItems || []).map(
        //   (a: NacosAgentCardVersionInfo) => ({
        //     key: `nacos:${a.name}`,
        //     kind: 'nacos' as const,
        //     name: a.name || '-',
        //     description: a.description,
        //     latestVersion: a.version || a.latestPublishedVersion,
        //     knownVersionDetails: (a.versionDetails || []).flatMap((v) =>
        //       v.version
        //         ? [
        //             {
        //               version: v.version,
        //               createdTime: v.createdAt || v.updatedAt,
        //             } satisfies AgentVersionOption,
        //           ]
        //         : [],
        //     ),
        //   }),
        // );
        if (!cancelled) setAgents(httpList);
      } catch {
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspace]);

  const loadAgentVersions = useCallback(
    async (agent: SelectableAgent): Promise<AgentVersionOption[]> => {
      if (agent.kind === 'http' && agent.agentId != null) {
        const list = await adminAgentApi.listDeliveryVersions(agent.agentId);
        const versions = (list || []).flatMap((v) =>
          v.deliveryVersion
            ? [
                {
                  version: v.deliveryVersion,
                  deliveryVersionId: v.deliveryVersionId,
                  createdTime: v.createdTime,
                } satisfies AgentVersionOption,
              ]
            : [],
        );
        if (versions.length > 0) return versions;
        return agent.latestVersion
          ? [{ version: agent.latestVersion, createdTime: agent.createdTime }]
          : [];
      }

      if (agent.knownVersionDetails && agent.knownVersionDetails.length > 0) {
        return agent.knownVersionDetails;
      }

      const list = await adminAgentApi.getNacosVersionList({
        namespaceId: workspace,
        agentName: agent.name,
      });
      const versions = (list || []).flatMap((v) =>
        v.version
          ? [
              {
                version: v.version,
                createdTime: v.createdAt || v.updatedAt,
              } satisfies AgentVersionOption,
            ]
          : [],
      );
      if (versions.length > 0) return versions;
      return agent.latestVersion ? [{ version: agent.latestVersion }] : [];
    },
    [workspace],
  );

  // 选中 Agent 后加载版本，并默认选中最新（列表第一项）
  useEffect(() => {
    if (!agentKey) {
      setAgentVersions([]);
      setAgentVersion(undefined);
      return;
    }
    const agent = agents.find((a) => a.key === agentKey);
    if (!agent) return;

    let cancelled = false;
    (async () => {
      setVersionsLoading(true);
      try {
        const versions = await loadAgentVersions(agent);
        if (cancelled) return;
        setAgentVersions(versions);
        setAgentVersion((prev) =>
          prev && versions.some((v) => v.version === prev)
            ? prev
            : versions[0]?.version,
        );
      } catch {
        if (!cancelled) {
          setAgentVersions([]);
          setAgentVersion(undefined);
        }
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentKey, agents, loadAgentVersions]);

  // 加载数据集列表
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setDatasetsLoading(true);
      try {
        const all: Dataset[] = [];
        let page = 1;
        while (page <= 10) {
          const res = await datasetApi.listDatasets({ page, limit: 100 });
          all.push(...(res?.data ?? []));
          if (page >= (res?.meta?.totalPages ?? 1)) break;
          page += 1;
        }
        if (!cancelled) {
          setDatasets(all);
          if (dataset?.name) setDatasetName(dataset.name);
        }
      } catch {
        if (!cancelled) setDatasets(dataset ? [dataset] : []);
      } finally {
        if (!cancelled) setDatasetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, dataset]);

  // 加载评估器（Agent+Skill），仅在进入评估器步骤时加载一次
  useEffect(() => {
    if (!open || step !== 'evaluators') return;
    let cancelled = false;
    (async () => {
      setEvaluatorsLoading(true);
      try {
        // 加载评估器 Agent 集合
        const httpRes = await adminAgentApi.listHttpAgents({
          workspace: workspace || '',
          pageNo: 1,
          pageSize: 200,
        });
        if (!cancelled) {
          const agentList = (httpRes?.records || []).map(
            (a: HttpAgentListItem) => ({
              key: `http:${a.agentId}`,
              kind: 'http' as const,
              name: a.name || String(a.agentId),
              description: a.description,
              agentId: a.agentId,
              workspace: a.workspace,
              enabled: a.enabled,
              createdTime: a.createdTime,
              latestVersion: a.latestDeliveryVersion,
            }),
          );
          setEvaluatorAgents(agentList);
          
          // 加载当前空间下的 SKILL 集合（使用 Nacos namespace ID）
          const nacosNamespaceId = await resolveNacosNamespaceId(workspace, currentNamespace);
          const skillRes = await adminSkillApi.list({
            namespaceId: nacosNamespaceId,
            pageNo: 1,
            pageSize: 200,
          });
          setSkills(skillRes?.pageItems || []);
        }
      } catch {
        if (!cancelled) {
          setEvaluatorAgents([]);
          setSkills([]);
        }
      } finally {
        if (!cancelled) setEvaluatorsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, workspace]);

  // 选中评估 Agent 后加载版本
  useEffect(() => {
    if (!selectedEvaluatorAgentKey) {
      setEvaluatorAgentVersions([]);
      setSelectedEvaluatorAgentVersion(undefined);
      evaluatorVersionTouchedRef.current = false;
      return;
    }
    
    const agent = evaluatorAgents.find((a) => a.key === selectedEvaluatorAgentKey);
    if (!agent) return;
    
    let cancelled = false;
    (async () => {
      setVersionsLoading(true);
      try {
        const versions = await loadAgentVersions(agent);
        if (cancelled) return;
        setEvaluatorAgentVersions(versions);
        // 仅当用户尚未手动选择过版本时，才默认选中第一个版本
        if (!evaluatorVersionTouchedRef.current) {
          setSelectedEvaluatorAgentVersion(versions[0]?.version);
        }
      } catch {
        if (!cancelled) {
          setEvaluatorAgentVersions([]);
          setSelectedEvaluatorAgentVersion(undefined);
        }
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEvaluatorAgentKey, evaluatorAgents, loadAgentVersions]);

  // 当选择了 agent 和 数据集的时候，自动填充执行任务的名称
  useEffect(() => {
    if (!selectedAgent?.name || !selectedDataset?.name || nameTouched) return;
    setExperimentName(
      `Agent ${selectedAgent.name} 在数据集 ${selectedDataset.name} 上的执行`,
    );
    setDescription(
      `使用 Agent ${selectedAgent.name} 在数据集 ${selectedDataset.name} 上的执行`,
    );
  }, [selectedAgent?.name, selectedDataset?.name, nameTouched]);

  const canNext = (): boolean => {
    if (step === 'agent') return !!(agentKey && agentVersion);
    if (step === 'dataset') return !!datasetName;
    if (step === 'evaluators') return true;
    if (step === 'review') return !!experimentName.trim();
    return false;
  };

  const goNext = () => {
    if (!canNext()) {
      if (step === 'agent') message.warning("请先选择 Agent 及版本");
      if (step === 'dataset') message.warning("请先选择数据集");
      if (step === 'review') message.warning("请填写执行名称");
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) setStep(next.key);
  };

  const goPrev = () => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev.key);
  };

  const handleRun = async () => {
    if (!selectedAgent || !selectedDataset || !experimentName.trim()) {
      message.warning("请完善实验配置");
      return;
    }
    if (!workspace) {
      message.warning("当前空间为空，无法执行实验");
      return;
    }
    if (selectedAgent.kind === 'http' && selectedAgent.agentId == null) {
      message.warning("请选择有效的 HTTP Agent");
      return;
    }
    
    // 校验评估器（可选）：若选择了评估 Agent，则 Agent 与版本必须完整；Skill 可选
    if (selectedEvaluatorAgentKey || selectedEvaluatorAgentVersion) {
      if (!selectedEvaluatorAgentKey || !selectedEvaluatorAgentVersion) {
        message.warning("请选择评估器");
        return;
      }
    }
    
    setSubmitting(true);
    try {
      const runName = experimentName.trim();
      
      // 构建执行参数
      const agent = evaluatorAgents.find(a => a.key === selectedEvaluatorAgentKey);
      const version = evaluatorAgentVersions.find(v => v.version === selectedEvaluatorAgentVersion);
      const skill = skills.find(s => s.name === selectedSkill);

      if ((selectedEvaluatorAgentKey || selectedEvaluatorAgentVersion) && (!agent || !version)) {
        message.warning("请选择有效的评估器配置");
        return;
      }
      
      // 评估器为可选：仅当选择了评估 Agent 时才加入 evaluators
      const evaluators = selectedEvaluatorAgentKey && selectedEvaluatorAgentVersion && agent && version
        ? [
            {
              type: 1 as const,
              agentId: agent.agentId,
              deliveryVersionId: version.deliveryVersionId,
              namespace: skill?.namespaceId,
              skill: skill?.name,
            },
          ]
        : undefined;
      
      await datasetApi.createRunItem({
        projectName: workspace,
        datasetName: selectedDataset.name,
        runName,
        runDescription: description.trim() || undefined,
        agent: {
          type: selectedAgent.kind === 'http' ? 'HTTP_AGENT' : 'NACOS_AGENT',
          agentId: selectedAgent.agentId,
          deliveryVersionId: selectedVersionOpt?.deliveryVersionId,
          code: selectedAgent.name,
          version: selectedAgent.version,
        },
        evaluators,
      });

      message.success(`实验「${runName}」已提交执行，执行时间可能较长，稍后请点击查询按钮刷新页面查看结果`);
      onSuccess?.({ runName });
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "实验执行失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvaluatorAgentChange = (key: string | undefined) => {
    setSelectedEvaluatorAgentKey(key);
    setSelectedEvaluatorAgentVersion(undefined);
    setEvaluatorAgentVersions([]);
    evaluatorVersionTouchedRef.current = false;
  };

  const handleEvaluatorVersionChange = (version: string | undefined) => {
    evaluatorVersionTouchedRef.current = true;
    setSelectedEvaluatorAgentVersion(version);
  };

  const handleEvaluatorSkillChange = (skill: string | undefined) => {
    setSelectedSkill(skill);
  };

  const handleAgentChange = (key: string | undefined) => {
    setAgentKey(key);
    setAgentVersion(undefined);
    setAgentVersions([]);
  };

  const renderStepBody = () => {
    if (step === 'agent') {
      return (
        <div className="agent-run-exp-step">
          <div className="agent-run-exp-step-title">{"选择 Agent"}</div>
          <div className="agent-run-exp-step-desc">{"从 Agent 管理列表中选择要执行实验的 Agent（含 HTTP / Nacos），并指定版本。"}</div>
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label={"Agent"} required>
              <div className="agent-run-exp-agent-row">
                <Select
                  showSearch
                  loading={agentsLoading}
                  placeholder={"请选择 Agent"}
                  value={agentKey}
                  onChange={handleAgentChange}
                  allowClear
                  optionFilterProp="label"
                  optionLabelProp="label"
                  className="agent-run-exp-agent-select"
                  options={agents.map((a) => ({
                    value: a.key,
                    label: a.name,
                  }))}
                  filterOption={(input, option) => {
                    const agent = agents.find((a) => a.key === option?.value);
                    const text = agent?.name ?? String(option?.label ?? '');
                    return text.toLowerCase().includes(input.toLowerCase());
                  }}
                  optionRender={(option) => {
                    const a = agents.find((item) => item.key === option.value);
                    if (!a) return option.label;
                    return (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span>
                          {a.name}
                          {a.enabled === false
                            ? `（${"停用"}）`
                            : ''}
                        </span>
                        <Tag
                          color={a.kind === 'http' ? 'blue' : 'cyan'}
                          style={{ marginInlineEnd: 0, flexShrink: 0 }}
                        >
                          {a.kind === 'http'
                            ? "HTTP Agent"
                            : "Nacos Agent"}
                        </Tag>
                      </div>
                    );
                  }}
                />
                <Select
                  showSearch
                  loading={versionsLoading}
                  disabled={!agentKey}
                  placeholder={"版本"}
                  value={agentVersion}
                  onChange={(v) => setAgentVersion(v)}
                  optionFilterProp="label"
                  className="agent-run-exp-version-select"
                  notFoundContent={
                    versionsLoading
                      ? undefined
                      : "暂无可用版本"
                  }
                  options={agentVersions.map((ver) => ({
                    value: ver.version,
                    label: ver.version,
                  }))}
                />
              </div>
            </Form.Item>
            {selectedAgentBase && selectedVersionOpt ? (
              <div className="agent-run-exp-hint">
                <div>
                  <Typography.Text type="secondary">
                    {"类型"}：
                  </Typography.Text>
                  {selectedAgentBase.kind === 'http'
                    ? "HTTP Agent"
                    : "Nacos Agent"}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary">{"版本号"}：</Typography.Text>
                  {selectedVersionOpt.version}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary">
                    {"版本 ID"}：
                  </Typography.Text>
                  <span className="agent-mono">
                    {selectedVersionOpt.deliveryVersionId != null
                      ? selectedVersionOpt.deliveryVersionId
                      : '-'}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary">{"创建时间"}：</Typography.Text>
                  {formatAgentTime(selectedVersionOpt.createdTime)}
                </div>
              </div>
            ) : null}
          </Form>
        </div>
      );
    }

    if (step === 'dataset') {
      return (
        <div className="agent-run-exp-step">
          <div className="agent-run-exp-step-title">{"选择数据集"}</div>
          <div className="agent-run-exp-step-desc">{"确认或更换用于本次实验的数据集。"}</div>
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label={"数据集"} required>
              <Select
                showSearch
                loading={datasetsLoading}
                placeholder={"请选择数据集"}
                value={datasetName || undefined}
                onChange={(v) => setDatasetName(v)}
                optionFilterProp="label"
                options={datasets.map((d) => ({
                  value: d.name,
                  label: d.name,
                }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
            {selectedDataset ? (
              <div className="agent-run-exp-hint">
                <div>
                  <Typography.Text type="secondary">ID：</Typography.Text>
                  <span className="agent-mono">{selectedDataset.id}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary">{"创建时间"}：</Typography.Text>
                  {formatDatasetTime(selectedDataset.createdAt)}
                </div>
                {selectedDataset.description ? (
                  <div style={{ marginTop: 4, color: 'rgba(9,25,64,0.55)' }}>
                    {selectedDataset.description}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Form>
        </div>
      );
    }

    if (step === 'evaluators') {
      return (
        <EvaluatorAgentSelector
          loading={evaluatorsLoading}
          evaluatorAgents={evaluatorAgents}
          selectedEvaluatorAgentKey={selectedEvaluatorAgentKey}
          evaluatorAgentVersions={evaluatorAgentVersions}
          selectedEvaluatorAgentVersion={selectedEvaluatorAgentVersion}
          skills={skills}
          selectedSkill={selectedSkill}
          onAgentChange={handleEvaluatorAgentChange}
          onVersionChange={handleEvaluatorVersionChange}
          onSkillChange={handleEvaluatorSkillChange}
        />
      );
    }

    // review
    return (
      <div className="agent-run-exp-step">
        <div className="agent-run-exp-step-title">{"确认并执行"}</div>
        <div className="agent-run-exp-step-desc">{"确认实验配置后执行。点击卡片可返回对应步骤修改。"}</div>

        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={"执行名称"} required>
            <Input
              value={experimentName}
              onChange={(e) => {
                setNameTouched(true);
                setExperimentName(e.target.value);
              }}
              placeholder={"请输入执行名称"}
              maxLength={200}
            />
          </Form.Item>
          <Form.Item label={"描述"}>
            <TextArea
              value={description}
              onChange={(e) => {
                setNameTouched(true);
                setDescription(e.target.value);
              }}
              rows={3}
              maxLength={1000}
              placeholder={"可选描述"}
            />
          </Form.Item>
        </Form>

        <div className="agent-run-exp-summary">
          <button type="button" className="agent-run-exp-summary-card" onClick={() => setStep('agent')}>
            <div className="agent-run-exp-summary-label">{"选择 Agent"}</div>
            <div className="agent-run-exp-summary-value">
              {selectedAgent
                ? `${selectedAgent.name} / ${selectedAgent.version}`
                : '-'}
            </div>
          </button>
          <button type="button" className="agent-run-exp-summary-card" onClick={() => setStep('dataset')}>
            <div className="agent-run-exp-summary-label">{"选择数据集"}</div>
            <div className="agent-run-exp-summary-value">
              {selectedDataset?.name || '-'}
            </div>
          </button>
          <button type="button" className="agent-run-exp-summary-card" onClick={() => setStep('evaluators')}>
            <div className="agent-run-exp-summary-label">{"选择评估器"}</div>
            <div className="agent-run-exp-summary-value">
              {selectedEvaluatorAgentKey && selectedEvaluatorAgentVersion
                ? `${evaluatorAgents.find(a => a.key === selectedEvaluatorAgentKey)?.name}${selectedSkill ? ` - ${skills.find(s => s.name === selectedSkill)?.name}` : ''}`
                : "未选择（可选）"}
            </div>
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={880}
      destroyOnClose
      title={
        <Space>
          <ExperimentOutlined />
          <span>{"开始执行"}</span>
        </Space>
      }
      footer={
        <div className="agent-run-exp-footer">
          <Button onClick={goPrev} disabled={stepIndex === 0 || submitting} icon={<LeftOutlined />}>
            {"上一步"}
          </Button>
          <div style={{ flex: 1 }} />
          {step !== 'review' ? (
            <Button type="primary" onClick={goNext} disabled={!canNext()}>
              {"下一步"} <RightOutlined />
            </Button>
          ) : (
            <Button
              type="primary"
              loading={submitting}
              onClick={() => void handleRun()}
              icon={<CheckCircleOutlined />}
            >
              {"执行"}
            </Button>
          )}
        </div>
      }
    >
      <div className="agent-run-exp-desc">{"选择 Agent、数据集与评估器，配置并执行数据集实验。"}</div>
      <Steps
        size="small"
        current={stepIndex}
        style={{ margin: '16px 0 20px' }}
        items={steps.map((s, idx) => ({
          title: s.title,
          status:
            idx < stepIndex ? 'finish' : idx === stepIndex ? 'process' : 'wait',
          onClick: () => {
            if (idx <= stepIndex) setStep(s.key);
          },
          style: { cursor: idx <= stepIndex ? 'pointer' : 'default' },
        }))}
      />
      {renderStepBody()}
    </Modal>
  );
}
