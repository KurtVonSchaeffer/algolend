import type { ReactNode } from 'react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export function AdminPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`admin-z-page animate-fade-in ${className}`.trim()}>{children}</div>;
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-z-page-header">
      <div>
        <h1 className="admin-z-page-title">{title}</h1>
        {subtitle && <p className="admin-z-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="admin-z-page-actions">{actions}</div>}
    </div>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-z-toolbar">{children}</div>;
}

export function AdminStatCard({
  label,
  value,
  icon,
  tone = 'brand',
  meta,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  tone?: Tone;
  meta?: ReactNode;
}) {
  return (
    <section className={`admin-z-card admin-z-stat admin-z-tone-${tone}`}>
      <div className="admin-z-stat-head">
        <span className="admin-z-stat-label">{label}</span>
        {icon && <span className="material-symbols-outlined admin-z-icon-badge">{icon}</span>}
      </div>
      <div className="admin-z-stat-value">{value}</div>
      {meta && <div className="admin-z-stat-meta">{meta}</div>}
    </section>
  );
}

export function AdminChartCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-z-card admin-z-chart ${className}`.trim()}>
      <div className="admin-z-card-header">
        <div className="admin-z-card-title-row">
          {icon && <span className="material-symbols-outlined admin-z-icon-badge">{icon}</span>}
          <div>
            <h2 className="admin-z-card-title">{title}</h2>
            {subtitle && <p className="admin-z-card-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return <div className="admin-z-table-shell">{children}</div>;
}

export function AdminEmptyState({ icon = 'inbox', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div className="admin-z-empty">
      <span className="material-symbols-outlined">{icon}</span>
      <p>{title}</p>
      {text && <small>{text}</small>}
    </div>
  );
}

export function AdminLoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="admin-z-loading" aria-live="polite">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function AdminStatusBadge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`admin-z-badge admin-z-tone-${tone}`}>{children}</span>;
}
