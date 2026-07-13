// Shared placeholder used by compliance sub-pages that embed the legacy dist.
// Each page passes its legacyPath so we can deep-link into the legacy admin.
interface Props {
  title: string;
  subtitle: string;
  icon: string;
  legacyPath: string;
}

export function CompliancePlaceholder({ title, subtitle, icon, legacyPath }: Props) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <a className="btn btn-secondary" href={legacyPath} target="_blank" rel="noopener noreferrer">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
          Open Full Page
        </a>
      </div>

      <div style={{
        background: 'var(--color-surface-card)',
        border: '2px dashed var(--color-border)',
        borderRadius: 16,
        padding: '60px 40px',
        textAlign: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'var(--color-primary)', opacity: 0.4, display: 'block', marginBottom: 16 }}>
          {icon}
        </span>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-text)' }}>{title}</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: 480, marginInline: 'auto' }}>
          This module has complex reporting and data-processing features. Click below to open the full legacy interface,
          or use the link above to open it in a new tab.
        </p>
        <a className="btn btn-primary" href={legacyPath} target="_blank" rel="noopener noreferrer">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>launch</span>
          Open {title}
        </a>
      </div>
    </>
  );
}

export function SACRRAPage() {
  return <CompliancePlaceholder title="SACRRA" subtitle="Credit bureau submission and reporting" icon="verified_user" legacyPath="/admin/sacrra.html" />;
}

export function SACRRAValidatorPage() {
  return <CompliancePlaceholder title="Migration Validator" subtitle="SACRRA data migration validation tool" icon="rule_folder" legacyPath="/admin/sacrra-validator.html" />;
}

export function NCRReportingPage() {
  return <CompliancePlaceholder title="NCR Reporting" subtitle="National Credit Regulator quarterly submissions" icon="assignment" legacyPath="/admin/ncr-reporting.html" />;
}

export function NCRRegistersPage() {
  return <CompliancePlaceholder title="NCR Registers" subtitle="Credit provider and agreement registers" icon="manage_accounts" legacyPath="/admin/ncr-registers.html" />;
}

export function ComplianceTrackerPage() {
  return <CompliancePlaceholder title="Compliance Tracker" subtitle="Regulatory task tracking and audit trail" icon="checklist" legacyPath="/admin/compliance-tracker.html" />;
}

export function GoAMLPage() {
  return <CompliancePlaceholder title="FIC goAML" subtitle="Financial Intelligence Centre reporting" icon="security" legacyPath="/admin/goaml.html" />;
}
