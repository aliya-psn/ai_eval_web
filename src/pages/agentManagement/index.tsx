import { HttpAgentList } from './HttpAgentList';
import '@/components/page/page.css';

export default function AgentManagementV2Page() {
  return (
    <div className="agent">
      <div className="agent-shell">
        <header className="agent-page-header">
          <h1 className="agent-title">Agent 管理</h1>
        </header>

        <div className="agent-panel">
            <HttpAgentList />
        </div>
      </div>
    </div>
  );
}
