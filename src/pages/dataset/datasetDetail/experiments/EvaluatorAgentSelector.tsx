import { Form, Select, Tag } from 'antd';
import type { SkillListItem } from '@/types/skill';

// 从 RunExperimentModal 复制的类型定义（避免循环依赖）
interface AgentVersionOption {
  version: string;
  deliveryVersionId?: number;
  createdTime?: string;
  updateTime?: string;
}

export interface SelectableAgent {
  key: string;
  kind: 'http' | 'nacos';
  name: string;
  description?: string;
  agentId?: number;
  workspace?: string;
  enabled?: boolean;
  createdTime?: string;
  latestVersion?: string;
  knownVersionDetails?: AgentVersionOption[];
}

export interface EvaluatorAgentSelectorProps {
  loading: boolean;
  evaluatorAgents: SelectableAgent[];
  selectedEvaluatorAgentKey?: string;
  evaluatorAgentVersions: Array<{ version: string; deliveryVersionId?: number; createdTime?: string }>;
  selectedEvaluatorAgentVersion?: string;
  skills: SkillListItem[];
  selectedSkill?: string;
  onAgentChange?: (key: string | undefined) => void;
  onVersionChange?: (version: string | undefined) => void;
  onSkillChange?: (skill: string | undefined) => void;
}

export function EvaluatorAgentSelector({
  loading,
  evaluatorAgents,
  selectedEvaluatorAgentKey,
  evaluatorAgentVersions,
  selectedEvaluatorAgentVersion,
  skills,
  selectedSkill,
  onAgentChange,
  onVersionChange,
  onSkillChange,
}: EvaluatorAgentSelectorProps) {
  const agentOptions = evaluatorAgents.map((a) => ({
    value: a.key,
    label: a.name,
  }));

  const versionOptions = evaluatorAgentVersions.map((ver) => ({
    value: ver.version,
    label: ver.version,
  }));

  const skillOptions = skills.map((s) => ({
    value: s.name,
    label: s.name,
  }));

  const handleAgentChange = (key: string | undefined) => {
    onAgentChange?.(key);
  };

  const handleVersionChange = (version: string | undefined) => {
    onVersionChange?.(version);
  };

  const handleSkillChange = (skill: string | undefined) => {
    onSkillChange?.(skill);
  };

  // Skill 选择器的启用条件：必须先选择 Agent 和 Agent 版本
  const isSkillEnabled = !!selectedEvaluatorAgentKey && !!selectedEvaluatorAgentVersion;

  return (
    <div className="agent-run-exp-step">
      <div className="agent-run-exp-step-title">{"选择评估器（可选）"}</div>
      <div className="agent-run-exp-step-desc">{"选择评估用的 Agent 及其版本，并选择对应的 Skill。"}</div>
      
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label={"评估 Agent"} required>
          <div className="agent-run-exp-agent-row">
            <Select
              showSearch
              loading={loading}
              placeholder={"请选择评估 Agent"}
              value={selectedEvaluatorAgentKey}
              onChange={handleAgentChange}
              allowClear
              optionLabelProp="label"
              className="agent-run-exp-agent-select"
              options={agentOptions}
              optionRender={(option) => {
                const a = evaluatorAgents.find((item) => item.key === option.value);
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
                    <span>{a.name}</span>
                    <Tag
                      color="blue"
                      style={{ marginInlineEnd: 0, flexShrink: 0 }}
                    >
                      HTTP Agent
                    </Tag>
                  </div>
                );
              }}
            />
            <Select
              showSearch
              loading={loading}
              disabled={!selectedEvaluatorAgentKey}
              placeholder={"版本"}
              value={selectedEvaluatorAgentVersion}
              onChange={handleVersionChange}
              className="agent-run-exp-version-select"
              notFoundContent={
                loading
                  ? undefined
                  : "暂无可用版本"
              }
              options={versionOptions}
            />
          </div>
        </Form.Item>
        
        <Form.Item label={"Skill"}>
          <Select
            showSearch
            loading={loading}
            disabled={!isSkillEnabled}
            placeholder={"请选择 Skill（可选）"}
            value={selectedSkill}
            onChange={handleSkillChange}
            options={skillOptions}
            style={{ width: '100%' }}
            notFoundContent={
              loading
                ? undefined
                : !selectedEvaluatorAgentKey
                  ? "请先选择评估 Agent 及版本"
                  : !selectedEvaluatorAgentVersion
                    ? "请先选择评估 Agent 及版本"
                    : "暂无可用 Skill"
            }
          />
        </Form.Item>
      </Form>
      
      <div style={{ marginTop: 8, color: 'rgba(9,25,64,0.45)', fontSize: 12 }}>
        {`已选择 ${selectedEvaluatorAgentKey && selectedEvaluatorAgentVersion ? 1 : 0} 个评估器（可选）`}
      </div>
    </div>
  );
}
