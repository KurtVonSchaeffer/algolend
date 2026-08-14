import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLoanApplications,
  syncOfferedApplications,
  searchClients,
  createWalkInApplication,
} from '../services/adminData';

// ── Status display map (mirrors Zwane STATUS_DISPLAY) ─────────────────────────
const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  STARTED:           { label: 'In Progress',   color: '#f59e0b', bg: '#fef3c7' },
  BUREAU_CHECKING:   { label: 'Credit Check',  color: '#3b82f6', bg: '#dbeafe' },
  BUREAU_OK:         { label: 'Credit Passed', color: '#3b82f6', bg: '#dbeafe' },
  BUREAU_DECLINE:    { label: 'Declined',      color: '#ef4444', bg: '#fee2e2' },
  BUREAU_REFER:      { label: 'Under Review',  color: '#f59e0b', bg: '#fef3c7' },
  BANK_LINKING:      { label: 'Bank Linking',  color: '#3b82f6', bg: '#dbeafe' },
  AFFORD_OK:         { label: 'Approved',      color: '#10b981', bg: '#d1fae5' },
  AFFORD_REFER:      { label: 'Under Review',  color: '#f59e0b', bg: '#fef3c7' },
  AFFORD_FAIL:       { label: 'Afford Fail',   color: '#ef4444', bg: '#fee2e2' },
  OFFERED:           { label: 'Offer Sent',    color: '#8b5cf6', bg: '#ede9fe' },
  OFFER_ACCEPTED:    { label: 'Accepted',      color: '#10b981', bg: '#d1fae5' },
  CONTRACT_SIGN:     { label: 'Signing',       color: '#f59e0b', bg: '#fef3c7' },
  DEBICHECK_AUTH:    { label: 'DebiCheck',     color: '#3b82f6', bg: '#dbeafe' },
  APPROVED:          { label: 'Approved',      color: '#10b981', bg: '#d1fae5' },
  DISBURSED:         { label: 'Disbursed',     color: '#10b981', bg: '#d1fae5' },
  DECLINED:          { label: 'Declined',      color: '#ef4444', bg: '#fee2e2' },
  ERROR:             { label: 'Error',         color: '#6b7280', bg: '#f3f4f6' },
  IN_ARREARS:        { label: 'In Arrears',    color: '#ef4444', bg: '#fee2e2' },
  IN_DEFAULT:        { label: 'In Default',    color: '#dc2626', bg: '#fee2e2' },
};

const getStatusDisplay = (s: string) =>
  STATUS_DISPLAY[s] ?? { label: s.replace(/_/g, ' '), color: '#6b7280', bg: '#f3f4f6' };

const PIPELINE_STATUSES = [
  'STARTED', 'BUREAU_CHECKING', 'BUREAU_OK', 'BUREAU_REFER', 'BUREAU_DECLINE',
  'BANK_LINKING', 'AFFORD_OK', 'AFFORD_REFER', 'AFFORD_FAIL',
  'OFFERED', 'OFFER_ACCEPTED', 'CONTRACT_SIGN', 'DEBICHECK_AUTH', 'APPROVED',
];
const PENDING_STATUSES = new Set([
  'STARTED', 'BUREAU_CHECKING', 'BUREAU_OK', 'BUREAU_REFER',
  'BANK_LINKING', 'AFFORD_OK', 'AFFORD_REFER', 'OFFERED',
  'OFFER_ACCEPTED', 'CONTRACT_SIGN', 'DEBICHECK_AUTH', 'APPROVED',
]);

const LOAN_PURPOSES = [
  'Personal Loan', 'Medical Expenses', 'Education', 'Home Improvement',
  'Debt Consolidation', 'Funeral', 'Vehicle', 'Business', 'Emergency', 'Other',
];

const ITEMS_PER_PAGE = 20;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

// ── In-Branch Wizard ──────────────────────────────────────────────────────────

function InBranchWizard({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loanConfig, setLoanConfig] = useState({
    amount: 1000,
    period: 1,
    purpose: 'Personal Loan',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientSearch.trim() || clientSearch.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setLoadingSearch(true);
      const { data } = await searchClients(clientSearch);
      setSuggestions(data ?? []);
      setLoadingSearch(false);
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  async function handleSubmit() {
    if (!selectedClient) { setError('Please select a client.'); return; }
    setSubmitting(true); setError('');
    const { error: err } = await createWalkInApplication({
      user_id: selectedClient.id,
      amount: loanConfig.amount,
      term_months: loanConfig.period,
      loan_purpose: loanConfig.purpose,
      status: 'STARTED',
      source: 'IN_BRANCH',
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
    onClose();
  }

  return (
    <div style={{ background: 'var(--color-surface-card)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Cancel
          </button>
          <span style={{ height: 20, width: 1, background: 'var(--color-border)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>In-Branch Application Mode</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 999, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>store</span> Branch Terminal
        </span>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 24px 0', gap: 8 }}>
        {['Client', 'Loan Config', 'Review'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, background: step > i + 1 ? '#10b981' : step === i + 1 ? 'var(--color-primary)' : 'var(--color-border)', color: step >= i + 1 ? '#fff' : 'var(--color-text-muted)' }}>
                {step > i + 1 ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span> : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: step === i + 1 ? 'var(--color-primary)' : 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
            {i < 2 && <div style={{ width: 40, height: 2, background: step > i + 1 ? '#10b981' : 'var(--color-border)', borderRadius: 2, marginBottom: 16 }} />}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Search for client</p>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--color-text-muted)' }}>search</span>
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Search by name or ID number…"
                style={{ width: '100%', paddingLeft: 40, paddingRight: 16, height: 42, border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            {loadingSearch && <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Searching…</p>}
            {suggestions.length > 0 && !selectedClient && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                {suggestions.map((u: any) => (
                  <div key={u.id} onClick={() => { setSelectedClient(u); setSuggestions([]); setClientSearch(u.full_name); }}
                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-card)' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--color-surface-muted)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'var(--color-surface-card)')}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{u.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>ID: {u.identity_number ?? 'N/A'}</div>
                  </div>
                ))}
              </div>
            )}
            {selectedClient && (
              <div style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.2)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700 }}>{selectedClient.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{selectedClient.identity_number}</div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--color-text)' }}>Loan Amount (ZAR)</label>
              <input type="number" value={loanConfig.amount} min={500} step={500}
                onChange={e => setLoanConfig(c => ({ ...c, amount: Number(e.target.value) }))}
                style={{ width: '100%', height: 42, padding: '0 14px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--color-text)' }}>Loan Period (months)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1, 2, 3, 6, 12, 18, 24].map(m => (
                  <button key={m} type="button" onClick={() => setLoanConfig(c => ({ ...c, period: m }))}
                    style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, border: `2px solid ${loanConfig.period === m ? 'var(--color-primary)' : 'var(--color-border)'}`, background: loanConfig.period === m ? 'var(--color-primary)' : 'transparent', color: loanConfig.period === m ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--color-text)' }}>Loan Purpose</label>
              <select value={loanConfig.purpose} onChange={e => setLoanConfig(c => ({ ...c, purpose: e.target.value }))}
                style={{ width: '100%', height: 42, padding: '0 14px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}>
                {LOAN_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>Review & Submit</p>
            <div style={{ background: 'var(--color-surface-muted)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Client', selectedClient?.full_name],
                ['ID Number', selectedClient?.identity_number ?? '—'],
                ['Loan Amount', fmt(loanConfig.amount)],
                ['Period', `${loanConfig.period} month${loanConfig.period !== 1 ? 's' : ''}`],
                ['Purpose', loanConfig.purpose],
                ['Status', 'STARTED (In-Branch)'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{v}</span>
                </div>
              ))}
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 12, fontWeight: 600 }}>{error}</p>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border)', background: '#fff', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {step > 1 && (
          <button type="button" onClick={() => setStep(s => s - 1)} style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid var(--color-border)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent' }}>
            Back
          </button>
        )}
        {step < 3 ? (
          <button type="button"
            onClick={() => { if (step === 1 && !selectedClient) { setError('Select a client first.'); return; } setError(''); setStep(s => s + 1); }}
            style={{ padding: '9px 24px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Next Step
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            style={{ padding: '9px 24px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit' }}>
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function ApplicationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showWizard, setShowWizard] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const DEMO_APPLICATIONS = [
    { id: 'DEMO-001', amount: 15000, status: 'BUREAU_OK',      created_at: '2025-07-01T09:00:00Z', profiles: { full_name: 'Thabo Nkosi',      identity_number: '8901155800083' } },
    { id: 'DEMO-002', amount: 8000,  status: 'STARTED',        created_at: '2025-07-10T11:30:00Z', profiles: { full_name: 'Ayanda Sithole',    identity_number: '9503055800087' } },
    { id: 'DEMO-003', amount: 25000, status: 'OFFERED',        created_at: '2025-06-28T08:15:00Z', profiles: { full_name: 'Sipho Dlamini',     identity_number: '8506015800083' } },
    { id: 'DEMO-004', amount: 5000,  status: 'DISBURSED',      created_at: '2025-06-15T14:00:00Z', profiles: { full_name: 'Nomsa Khumalo',     identity_number: '7812250800082' } },
    { id: 'DEMO-005', amount: 12000, status: 'BANK_LINKING',   created_at: '2025-07-18T10:00:00Z', profiles: { full_name: 'Bongani Zulu',      identity_number: '9105185800085' } },
    { id: 'DEMO-006', amount: 20000, status: 'DECLINED',       created_at: '2025-07-05T16:00:00Z', profiles: { full_name: 'Lerato Molefe',     identity_number: '8803055800089' } },
    { id: 'DEMO-007', amount: 7500,  status: 'BUREAU_CHECKING',created_at: '2025-07-20T09:30:00Z', profiles: { full_name: 'Precious Mokoena',  identity_number: '9209145800081' } },
    { id: 'DEMO-008', amount: 18000, status: 'CONTRACT_SIGN',  created_at: '2025-07-22T13:00:00Z', profiles: { full_name: 'Sandile Ngcobo',    identity_number: '8711235800084' } },
    { id: 'DEMO-009', amount: 10000, status: 'AFFORD_OK',      created_at: '2025-07-25T08:00:00Z', profiles: { full_name: 'Zanele Mthembu',    identity_number: '9006095800086' } },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications'],
    queryFn: async () => {
      try {
        const res = await fetchLoanApplications();
        return res.data?.length ? res : { data: DEMO_APPLICATIONS, error: null };
      } catch { return { data: DEMO_APPLICATIONS, error: null }; }
    },
    staleTime: 60_000,
  });

  const apps: any[] = data?.data ?? [];

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return apps.filter(app => {
      const name = (app.profiles?.full_name ?? '').toLowerCase();
      const id = String(app.id ?? '').toLowerCase();
      const amount = String(app.amount ?? '');
      const textMatch = !term || name.includes(term) || id.includes(term) || amount.includes(term);
      const statusMatch =
        statusFilter === 'all' ? true :
        statusFilter === 'pending' ? PENDING_STATUSES.has(app.status) :
        app.status === statusFilter;
      return textMatch && statusMatch;
    });
  }, [apps, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function handleSync() {
    setSyncing(true);
    await syncOfferedApplications();
    queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
    setSyncing(false);
  }

  function exportCSV() {
    const rows = [
      ['Applicant', 'Amount', 'Term', 'Status', 'Date Applied'],
      ...filtered.map((a: any) => [
        a.profiles?.full_name ?? '',
        a.amount ?? '',
        a.term_months ?? '',
        a.status ?? '',
        a.created_at ? fmtDate(a.created_at) : '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `applications_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  if (showWizard) {
    return <InBranchWizard onClose={() => setShowWizard(false)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s ease' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Loan Applications</h1>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Manage reviews and create in-branch applications.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* In-Branch App */}
          <button
            type="button"
            onClick={() => navigate('/create-application')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>computer</span>
            In-Branch App
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: '#fff', color: 'var(--color-text)', fontWeight: 600, fontSize: 13, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>download</span>
            Export
          </button>

          {/* Status filter select */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ height: 40, padding: '0 32px 0 14px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: 'var(--color-text)', cursor: 'pointer', appearance: 'auto' }}>
            <option value="all">All Statuses</option>
            <option value="pending">⏳ Needs Review</option>
            <option value="DISBURSED">✅ Disbursed</option>
            <option value="DECLINED">❌ Declined</option>
            <optgroup label="── Pipeline ──">
              {PIPELINE_STATUSES.filter(s => !['DISBURSED', 'DECLINED'].includes(s)).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </optgroup>
            <optgroup label="── Final ──">
              <option value="ERROR">ERROR</option>
            </optgroup>
          </select>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--color-text-muted)' }}>search</span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search applications…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ height: 40, paddingLeft: 36, paddingRight: 12, borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', width: 220 }}
            />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Loading applications…
            </div>
          ) : (
            <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--color-surface-muted)', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  {['Applicant', 'Amount', 'Status', 'Date', 'Action'].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: h === 'Action' ? 'right' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: '#fff' }}>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 48, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                      No applications match your criteria.
                    </td>
                  </tr>
                ) : paginated.map((app: any) => {
                  const profile = app.profiles ?? {};
                  const loanSeq = app.loan_number ? `L${String(app.loan_number).padStart(4, '0')}` : '';
                  const clientNum = profile.client_number ? String(profile.client_number) : '';
                  const reference = clientNum && loanSeq ? `${clientNum}-${loanSeq}` : (loanSeq || String(app.id).slice(0, 8));
                  const statusInfo = getStatusDisplay(app.status ?? '');
                  const isDefault = ['IN_ARREARS', 'IN_DEFAULT'].includes(app.status ?? '');

                  return (
                    <tr key={app.id}
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: isDefault ? '#fef2f2' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => navigate(`/applications/${app.id}`)}
                      onMouseOver={e => { if (!isDefault) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-muted)'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = isDefault ? '#fef2f2' : 'transparent'; }}>

                      {/* Applicant */}
                      <td style={{ padding: '14px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                            {(profile.full_name ?? 'A').charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{profile.full_name ?? 'N/A'}</div>
                            <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>{reference}</div>
                            {app.loan_purpose && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{app.loan_purpose}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '14px 24px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: 'var(--color-text)' }}>{fmt(Number(app.amount) || 0)}</div>
                        {app.term_months && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{app.term_months} mo</div>}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 24px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                        {isDefault && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>⚠ 3% default applies</div>}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 24px' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                          {app.created_at ? fmtDate(app.created_at) : '—'}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 24px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/applications/${app.id}`)}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseOver={e => (e.currentTarget.style.background = 'var(--color-surface-muted)')}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page === 1 ? 0.5 : 1 }}>
              Prev
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '0 8px' }}>Page {page} of {totalPages}</span>
            <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page === totalPages ? 0.5 : 1 }}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
