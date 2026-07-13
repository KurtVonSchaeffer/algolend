import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApplicationDetail, updateApplicationStatus } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-yellow', UNDER_REVIEW: 'badge-blue', APPROVED: 'badge-green',
  AWAITING_DISBURSEMENT: 'badge-purple', DISBURSED: 'badge-green', DECLINED: 'badge-red',
};

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ['UNDER_REVIEW', 'DECLINED'],
  UNDER_REVIEW: ['APPROVED', 'DECLINED'],
  APPROVED: ['AWAITING_DISBURSEMENT', 'DECLINED'],
  AWAITING_DISBURSEMENT: ['DISBURSED'],
  DISBURSED: [],
  DECLINED: [],
};

const TABS = ['Overview', 'Documents', 'Credit', 'Loans', 'Notes'];

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-app-detail', id],
    queryFn: () => fetchApplicationDetail(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      updateApplicationStatus(id!, status, notes || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-app-detail', id] }),
  });

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" /></div>;
  }

  if (!data) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-circle-exclamation" />
        <p>Application not found</p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/applications')}>Back to Applications</button>
      </div>
    );
  }

  const { application: app, financial, documents, creditChecks, loans } = data;
  const profile = (app.profiles as any) ?? {};
  const nextStatuses = NEXT_STATUSES[app.status] ?? [];

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="admin-icon-btn" onClick={() => navigate('/applications')} title="Back">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          </button>
          <div>
            <h1 className="page-title">{profile.full_name ?? 'Application'}</h1>
            <p className="page-subtitle">ID: {app.id}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${STATUS_BADGE[app.status] ?? 'badge-gray'}`} style={{ fontSize: 13, padding: '5px 14px' }}>
            {app.status?.replace(/_/g, ' ')}
          </span>
          {nextStatuses.map(s => (
            <button
              key={s}
              className={`btn ${s === 'DECLINED' ? 'btn-danger' : 'btn-primary'}`}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ status: s })}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Key figures */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: 'Loan Amount', value: fmt(Number(app.amount) || 0) },
          { label: 'Monthly Repayment', value: fmt(Number(app.offer_monthly_repayment) || 0) },
          { label: 'Total Repayment', value: fmt(Number(app.offer_total_repayment) || 0) },
          { label: 'Purpose', value: app.purpose ?? '—' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <span className="stat-label">{c.label}</span>
            <div className="stat-value" style={{ fontSize: 18 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="tab-bar">
        {TABS.map(t => <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Personal Info */}
          <div className="chart-card">
            <p className="chart-title">Personal Information</p>
            {[
              ['Full Name', profile.full_name],
              ['Email', profile.email],
              ['Phone', profile.cell_tel_no ?? profile.contact_number],
              ['ID Number', profile.identity_number],
              ['Role', profile.role],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
              </div>
            ))}
          </div>

          {/* Financial Info */}
          <div className="chart-card">
            <p className="chart-title">Financial Profile</p>
            {financial ? [
              ['Monthly Income', fmt(Number(financial.monthly_income) || 0)],
              ['Monthly Expenses', fmt(Number(financial.monthly_expenses) || 0)],
              ['Employment Type', financial.employment_type],
              ['Employer', financial.employer_name],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
              </div>
            )) : <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No financial profile on file</p>}
          </div>
        </div>
      )}

      {tab === 'Documents' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Document</th><th>Type</th><th>Uploaded</th><th></th></tr></thead>
            <tbody>
              {documents.length === 0
                ? <tr><td colSpan={4}><div className="empty-state"><i className="fa-solid fa-file" /><p>No documents uploaded</p></div></td></tr>
                : documents.map((d: any) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.file_name ?? 'Document'}</td>
                    <td><span className="badge badge-blue">{d.document_type ?? 'Unknown'}</span></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{new Date(d.uploaded_at).toLocaleDateString('en-ZA')}</td>
                    <td>
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}>View</a>
                      )}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Credit' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Date</th><th>Score</th><th>Bureau</th><th>Status</th></tr></thead>
            <tbody>
              {creditChecks.length === 0
                ? <tr><td colSpan={4}><div className="empty-state"><i className="fa-solid fa-chart-line" /><p>No credit checks on file</p></div></td></tr>
                : creditChecks.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(c.checked_at).toLocaleDateString('en-ZA')}</td>
                    <td style={{ fontWeight: 700, fontSize: 18 }}>{c.credit_score ?? '—'}</td>
                    <td>{c.bureau ?? '—'}</td>
                    <td><span className={`badge ${c.credit_score >= 600 ? 'badge-green' : 'badge-red'}`}>{c.credit_score >= 600 ? 'Pass' : 'Fail'}</span></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Loans' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Loan ID</th><th>Principal</th><th>Outstanding</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {loans.length === 0
                ? <tr><td colSpan={5}><div className="empty-state"><i className="fa-solid fa-money-bill" /><p>No loans found</p></div></td></tr>
                : loans.map((l: any) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{l.id}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(Number(l.principal_amount) || 0)}</td>
                    <td>{fmt(Number(l.outstanding_balance) || 0)}</td>
                    <td><span className={`badge ${l.status === 'active' ? 'badge-green' : l.status === 'repaid' ? 'badge-blue' : 'badge-red'}`}>{l.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(l.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Notes' && (
        <div className="chart-card">
          <p className="chart-title">Internal Notes</p>
          <textarea
            className="admin-input"
            style={{ height: 160, resize: 'vertical' }}
            placeholder="Add internal notes…"
            defaultValue={app.notes ?? ''}
            onChange={e => setNotes(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => updateApplicationStatus(id!, app.status, notes)}
            disabled={mutation.isPending}
          >
            Save Notes
          </button>
        </div>
      )}
    </>
  );
}
