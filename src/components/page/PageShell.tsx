import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { ArrowLeft } from 'lucide-react';
import './page.css';

interface PageShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function formatTime(value?: string | null): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value;
}

export function PageShell({
  children,
  title,
  subtitle,
  extra,
  onBack,
  backLabel,
}: PageShellProps) {
  const resolvedBackLabel = backLabel ?? '返回';

  return (
    <div className="agent">
      <div className="agent-shell">
        <header className="agent-page-header">
          <div className="agent-page-header-main">
            {onBack ? (
              <button type="button" className="agent-back" onClick={onBack}>
                <ArrowLeft size={15} strokeWidth={2.2} />
                {resolvedBackLabel}
              </button>
            ) : null}
            <div className="agent-page-header-text">
              <h1 className="agent-title">{title}</h1>
              {subtitle ? <p className="agent-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          {extra ? <div className="agent-page-header-extra">{extra}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function PageSection({
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

// 名称简称
export function nameInitials(name?: string): string {
  if (!name) return 'A';
  return name.slice(0, 2);
}
