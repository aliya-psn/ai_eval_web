import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import './agent.css';

interface AgentPageShellProps {
  children: ReactNode;
  title: string;
  extra?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function formatAgentTime(value?: string | null): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value;
}

export function AgentPageShell({
  children,
  title,
  extra,
  onBack,
  backLabel,
}: AgentPageShellProps) {
  const resolvedBackLabel = backLabel ?? '返回';

  return (
    <div className="agent">
      <div className="agent-shell">
        <header className="agent-page-header">
          <div className="agent-page-header-main">
            {onBack ? (
              <button type="button" className="agent-back" onClick={onBack}>
                ← {resolvedBackLabel}
              </button>
            ) : null}
            <h1 className="agent-title">{title}</h1>
          </div>
          {extra ? <div className="agent-page-header-extra">{extra}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function AgentSection({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="agent-section">
      <div className="agent-section-head">
        <h2 className="agent-section-title">{title}</h2>
        {extra}
      </div>
      <div className="agent-section-body">{children}</div>
    </section>
  );
}

// agent name 简称
export function agentInitials(name?: string): string {
  if (!name) return 'A';
  // const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  // if (parts.length >= 2) {
  //   return `${parts[0][0]}${parts[1][0]}`.slice(0, 2);
  // }
  return name.slice(0, 2);
}
