import { HttpAgentList } from './HttpAgentList';
import './agent.css';

export default function AgentManagementV2Page() {
  return (
    <div className="agent">
      <div className="agent-shell">
        <header className="agent-page-header">
          <h1 className="agent-title">Agent 管理</h1>
        </header>

        <div className="agent-panel">
          <div className="agent-panel-inner">
            <HttpAgentList />
          </div>
        </div>
      </div>
    </div>
  );
}
