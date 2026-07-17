import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConsumers,
  fetchNcrReportingData,
  fetchNcrRegisters,
  fetchComplianceTasks,
  upsertComplianceTask,
  fetchGoAMLReports,
  createGoAMLReport,
  fetchLoans,
} from '../services/adminData';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function AvatarCircle({ name }: { name: string }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: 'rgba(124,58,237,0.12)', color: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 12, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <div className="stat-value" style={{ color, fontSize: typeof value === 'string' && value.length > 6 ? 16 : undefined }}>
        {value}
      </div>
    </div>
  );
}

function exportCsv(rows: any[], columns: { key: string; label: string }[], filename: string) {
  const headers = columns.map(c => c.label);
  const lines = rows.map(r => columns.map(c => {
    const val = c.key.split('.').reduce((o: any, k) => o?.[k], r) ?? '';
    return `"${String(val).replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob(['﻿' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── SACRRA ──────────────────────────────────────────────────────────────────

export function SACRRAPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-consumers'],
    queryFn: fetchConsumers,
    staleTime: 60_000,
  });

  const consumers = data?.data ?? [];
  const filtered = consumers.filter((c: any) =>
    !search ||
    (c.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.id_number ?? c.identity_number ?? '').includes(search)
  );

  const COLS = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'id_number', label: 'ID Number' },
    { key: 'credit_score', label: 'Credit Score' },
    { key: 'submission_status', label: 'Status' },
    { key: 'created_at', label: 'Date' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">SACRRA</h1>
          <p className="page-subtitle">Credit bureau submission and consumer credit data</p>
        </div>
        <button className="btn btn-secondary" onClick={() => exportCsv(filtered, COLS, 'sacrra_consumers.csv')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export CSV
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Records" value={consumers.length} />
        <KpiCard label="Submitted" value={consumers.filter((c: any) => c.submission_status === 'submitted').length} color="#10B981" />
        <KpiCard label="Pending" value={consumers.filter((c: any) => !c.submission_status || c.submission_status === 'pending').length} color="#F59E0B" />
        <KpiCard label="Failed" value={consumers.filter((c: any) => c.submission_status === 'failed').length} color="#EF4444" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search by name or ID number…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>{filtered.length} records</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Consumer</th>
                <th>ID Number</th>
                <th>Credit Score</th>
                <th>Employer / Income</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-id-card" /><p>No consumer records found</p></div></td></tr>
                : filtered.map((c: any) => {
                  const status = c.submission_status ?? 'pending';
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AvatarCircle name={c.full_name ?? '?'} />
                          <span style={{ fontWeight: 600 }}>{c.full_name ?? '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.id_number ?? c.identity_number ?? '—'}</td>
                      <td>
                        {c.credit_score
                          ? <span style={{ fontWeight: 700, color: c.credit_score >= 650 ? '#10B981' : c.credit_score >= 500 ? '#F59E0B' : '#EF4444' }}>
                              {c.credit_score}
                            </span>
                          : '—'
                        }
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {c.employer ?? c.employment_status ?? '—'}
                      </td>
                      <td>
                        <span className={`badge ${status === 'submitted' ? 'badge-green' : status === 'failed' ? 'badge-red' : 'badge-yellow'}`} style={{ textTransform: 'capitalize' }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {new Date(c.created_at).toLocaleDateString('en-ZA')}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── SACRRA Validator ────────────────────────────────────────────────────────

export function SACRRAValidatorPage() {
  const [ran, setRan] = useState(false);

  const loansQ = useQuery({ queryKey: ['admin-loans'], queryFn: fetchLoans, staleTime: 60_000, enabled: ran });
  const consumersQ = useQuery({ queryKey: ['admin-consumers'], queryFn: fetchConsumers, staleTime: 60_000, enabled: ran });

  const loans = loansQ.data?.data ?? [];
  const consumers = consumersQ.data?.data ?? [];

  const checks = useMemo(() => {
    if (!ran) return [];
    const missingId = consumers.filter((c: any) => !c.id_number && !c.identity_number).length;
    const missingScore = consumers.filter((c: any) => !c.credit_score).length;
    const loansNoProfile = loans.filter((l: any) => !l.profiles?.full_name).length;
    const loansNoRate = loans.filter((l: any) => l.interest_rate == null).length;
    const orphanedLoans = loans.filter((l: any) => !l.user_id).length;

    return [
      { rule: 'Consumer ID numbers present', total: consumers.length, issues: missingId, pass: missingId === 0 },
      { rule: 'Credit scores populated', total: consumers.length, issues: missingScore, pass: missingScore === 0 },
      { rule: 'Loans linked to profiles', total: loans.length, issues: loansNoProfile, pass: loansNoProfile === 0 },
      { rule: 'Interest rates on all loans', total: loans.length, issues: loansNoRate, pass: loansNoRate === 0 },
      { rule: 'No orphaned loans (no user_id)', total: loans.length, issues: orphanedLoans, pass: orphanedLoans === 0 },
    ];
  }, [ran, consumers, loans]);

  const isLoading = loansQ.isLoading || consumersQ.isLoading;
  const passCount = checks.filter(c => c.pass).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Migration Validator</h1>
          <p className="page-subtitle">SACRRA data quality checks — run before submission</p>
        </div>
        <button className="btn btn-primary" onClick={() => setRan(true)} disabled={isLoading}>
          {isLoading ? 'Running…' : 'Run Validation'}
        </button>
      </div>

      {!ran ? (
        <div style={{ background: 'var(--color-surface-card)', border: '2px dashed var(--color-border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--color-primary)', opacity: 0.4, display: 'block', marginBottom: 16 }}>rule_folder</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Ready to validate</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>Click "Run Validation" to check data quality across consumers and loans.</p>
          <button className="btn btn-primary" onClick={() => setRan(true)}>Run Validation</button>
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
            <KpiCard label="Total Checks" value={checks.length} />
            <KpiCard label="Passed" value={passCount} color="#10B981" />
            <KpiCard label="Failed" value={checks.length - passCount} color={checks.length - passCount > 0 ? '#EF4444' : '#10B981'} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Validation Rule</th><th>Records Checked</th><th>Issues Found</th><th>Result</th></tr>
              </thead>
              <tbody>
                {checks.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.rule}</td>
                    <td>{c.total}</td>
                    <td style={{ fontWeight: c.issues > 0 ? 700 : 400, color: c.issues > 0 ? '#EF4444' : 'inherit' }}>{c.issues}</td>
                    <td>
                      <span className={`badge ${c.pass ? 'badge-green' : 'badge-red'}`}>
                        {c.pass ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ─── NCR Reporting ───────────────────────────────────────────────────────────

export function NCRReportingPage() {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ncr-reporting'],
    queryFn: fetchNcrReportingData,
    staleTime: 60_000,
  });

  const submissions = data?.data ?? [];

  const filtered = useMemo(() => {
    return submissions.filter((s: any) => {
      const matchSearch = !search || (s.report_type ?? '').toLowerCase().includes(search.toLowerCase()) || (s.period ?? '').includes(search);
      const matchPeriod = period === 'ALL' || (s.period ?? '').startsWith(period);
      return matchSearch && matchPeriod;
    });
  }, [submissions, search, period]);

  const years = [...new Set(submissions.map((s: any) => (s.period ?? '').slice(0, 4)))].filter(Boolean).sort().reverse() as string[];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">NCR Reporting</h1>
          <p className="page-subtitle">National Credit Regulator quarterly submissions</p>
        </div>
        <button className="btn btn-secondary" onClick={() => exportCsv(filtered, [
          { key: 'period', label: 'Period' },
          { key: 'report_type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'submitted_by', label: 'Submitted By' },
          { key: 'created_at', label: 'Date' },
        ], 'ncr_submissions.csv')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Submissions" value={submissions.length} />
        <KpiCard label="Approved" value={submissions.filter((s: any) => s.status === 'approved').length} color="#10B981" />
        <KpiCard label="Pending" value={submissions.filter((s: any) => s.status === 'pending').length} color="#F59E0B" />
        <KpiCard label="Rejected" value={submissions.filter((s: any) => s.status === 'rejected').length} color="#EF4444" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search by type or period…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="ALL">All Periods</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{filtered.length} submission{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Period</th><th>Report Type</th><th>Submitted By</th><th>Reference</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-file-lines" /><p>No NCR submissions found</p></div></td></tr>
                : filtered.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.period ?? '—'}</td>
                    <td>{s.report_type ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.submitted_by ?? '—'}</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{s.reference ?? s.id?.slice(0, 8) ?? '—'}</td>
                    <td>
                      <span className={`badge ${s.status === 'approved' ? 'badge-green' : s.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`} style={{ textTransform: 'capitalize' }}>
                        {s.status ?? 'pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(s.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── NCR Registers ───────────────────────────────────────────────────────────

export function NCRRegistersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ncr-registers'],
    queryFn: fetchNcrRegisters,
    staleTime: 60_000,
  });

  const agreements = data?.data ?? [];
  const filtered = agreements.filter((a: any) => {
    const name = a.profiles?.full_name ?? '';
    const ln = a.loan_number ?? '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || ln.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

  const totalActive = agreements.filter((a: any) => a.status === 'active').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">NCR Registers</h1>
          <p className="page-subtitle">Credit agreement register — all loan agreements on record</p>
        </div>
        <button className="btn btn-secondary" onClick={() => exportCsv(filtered, [
          { key: 'loan_number', label: 'Agreement #' },
          { key: 'profiles.full_name', label: 'Consumer' },
          { key: 'profiles.identity_number', label: 'ID Number' },
          { key: 'principal_amount', label: 'Principal' },
          { key: 'interest_rate', label: 'Rate %' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Date' },
        ], 'ncr_registers.csv')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Agreements" value={agreements.length} />
        <KpiCard label="Active" value={totalActive} color="#10B981" />
        <KpiCard label="Closed / Settled" value={agreements.filter((a: any) => a.status === 'repaid' || a.status === 'settled').length} color="#6B7280" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search consumer or agreement #…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {['active', 'arrears', 'default', 'repaid', 'settled', 'cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{filtered.length} agreement{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Consumer</th>
                <th>Agreement #</th>
                <th style={{ textAlign: 'right' }}>Principal</th>
                <th>Rate</th>
                <th>Term</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><i className="fa-solid fa-file-contract" /><p>No agreements found</p></div></td></tr>
                : filtered.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AvatarCircle name={a.profiles?.full_name ?? '?'} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.profiles?.full_name ?? '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{a.profiles?.identity_number ?? ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{a.loan_number ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(Number(a.principal_amount) || 0)}</td>
                    <td>{a.interest_rate != null ? `${a.interest_rate}%` : '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{a.term_months ? `${a.term_months}m` : '—'}</td>
                    <td>
                      <span className={`badge ${a.status === 'active' ? 'badge-green' : a.status === 'arrears' ? 'badge-yellow' : a.status === 'default' ? 'badge-red' : 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                        {a.status ?? '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(a.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Compliance Tracker ───────────────────────────────────────────────────────

const DEFAULT_TASKS = [
  { category: 'NCR', title: 'Q1 NCR Submission', due_date: `${new Date().getFullYear()}-04-30`, status: 'pending', priority: 'high' },
  { category: 'NCR', title: 'Q2 NCR Submission', due_date: `${new Date().getFullYear()}-07-31`, status: 'pending', priority: 'high' },
  { category: 'NCR', title: 'Q3 NCR Submission', due_date: `${new Date().getFullYear()}-10-31`, status: 'pending', priority: 'high' },
  { category: 'NCR', title: 'Q4 NCR Submission', due_date: `${new Date().getFullYear()}-01-31`, status: 'pending', priority: 'high' },
  { category: 'SACRRA', title: 'Monthly SACRRA data submission', due_date: '', status: 'pending', priority: 'medium' },
  { category: 'FIC', title: 'goAML STR/CTR review', due_date: '', status: 'pending', priority: 'medium' },
  { category: 'Internal', title: 'Credit policy annual review', due_date: '', status: 'pending', priority: 'low' },
  { category: 'Internal', title: 'Staff compliance training', due_date: '', status: 'pending', priority: 'low' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function ComplianceTrackerPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [newTask, setNewTask] = useState({ category: 'NCR', title: '', due_date: '', priority: 'medium', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-compliance-tasks'],
    queryFn: fetchComplianceTasks,
    staleTime: 60_000,
  });

  const updateMut = useMutation({
    mutationFn: (task: Record<string, unknown>) => upsertComplianceTask(task),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-compliance-tasks'] }),
  });

  const createMut = useMutation({
    mutationFn: (task: Record<string, unknown>) => upsertComplianceTask(task),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-compliance-tasks'] }); setShowModal(false); setNewTask({ category: 'NCR', title: '', due_date: '', priority: 'medium', notes: '' }); },
  });

  const tasks = data?.data?.length ? data.data : DEFAULT_TASKS as any[];

  const filtered = tasks
    .filter((t: any) => categoryFilter === 'ALL' || t.category === categoryFilter)
    .sort((a: any, b: any) => (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 3) - (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 3));

  const categories = [...new Set(tasks.map((t: any) => t.category))] as string[];
  const done = tasks.filter((t: any) => t.status === 'completed').length;
  const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;

  function toggleStatus(task: any) {
    if (!task.id) return;
    updateMut.mutate({ ...task, status: task.status === 'completed' ? 'pending' : 'completed' });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Tracker</h1>
          <p className="page-subtitle">Regulatory task tracking and audit trail</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Add Task
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Tasks" value={tasks.length} />
        <KpiCard label="Completed" value={done} color="#10B981" />
        <KpiCard label="Pending" value={tasks.length - done} color="#F59E0B" />
        <KpiCard label="Overdue" value={overdue} color={overdue > 0 ? '#EF4444' : '#10B981'} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="admin-select" style={{ width: 'auto' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="ALL">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>{filtered.length} tasks</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0
            ? <div style={{ background: 'var(--color-surface-card)', borderRadius: 12, padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No tasks found</div>
            : filtered.map((t: any, i: number) => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
              return (
                <div key={t.id ?? i} style={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: t.status === 'completed' ? 0.6 : 1,
                }}>
                  <input
                    type="checkbox"
                    checked={t.status === 'completed'}
                    onChange={() => toggleStatus(t)}
                    style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: t.id ? 'pointer' : 'default', flexShrink: 0 }}
                    disabled={!t.id}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>
                      {t.title}
                    </div>
                    {t.notes && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.notes}</div>}
                  </div>
                  <span className={`badge ${t.category === 'NCR' ? 'badge-blue' : t.category === 'SACRRA' ? 'badge-green' : t.category === 'FIC' ? 'badge-yellow' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                    {t.category}
                  </span>
                  <span className={`badge ${t.priority === 'high' ? 'badge-red' : t.priority === 'medium' ? 'badge-yellow' : 'badge-gray'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                    {t.priority}
                  </span>
                  {t.due_date && (
                    <span style={{ fontSize: 12, color: isOverdue ? '#EF4444' : 'var(--color-text-muted)', whiteSpace: 'nowrap', fontWeight: isOverdue ? 700 : 400 }}>
                      {isOverdue ? 'Overdue · ' : ''}{new Date(t.due_date).toLocaleDateString('en-ZA')}
                    </span>
                  )}
                </div>
              );
            })
          }
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>New Compliance Task</h3>
              <button className="admin-icon-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Task Title</label>
                <input className="admin-input" type="text" required placeholder="e.g. Q1 NCR Submission…" value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Category</label>
                  <select className="admin-select" value={newTask.category} onChange={e => setNewTask(t => ({ ...t, category: e.target.value }))}>
                    {['NCR', 'SACRRA', 'FIC', 'Internal', 'POPIA', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Priority</label>
                  <select className="admin-select" value={newTask.priority} onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Due Date</label>
                <input className="admin-input" type="date" value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Notes</label>
                <input className="admin-input" type="text" placeholder="Optional notes…" value={newTask.notes} onChange={e => setNewTask(t => ({ ...t, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!newTask.title || createMut.isPending} onClick={() => createMut.mutate({ ...newTask, status: 'pending' })}>
                {createMut.isPending ? 'Saving…' : 'Save Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── FIC goAML ───────────────────────────────────────────────────────────────

const REPORT_TYPES = ['STR', 'CTR', 'SAR', 'EFT', 'PCR'];

export function GoAMLPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [reportForm, setReportForm] = useState({ report_type: 'STR', subject_name: '', amount: '', description: '', reference: '', report_date: new Date().toISOString().slice(0, 10) });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-goaml-reports'],
    queryFn: fetchGoAMLReports,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (r: Record<string, unknown>) => createGoAMLReport(r),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-goaml-reports'] }); setShowModal(false); setReportForm(f => ({ ...f, subject_name: '', amount: '', description: '', reference: '' })); },
  });

  const reports = data?.data ?? [];
  const filtered = reports.filter((r: any) => typeFilter === 'ALL' || r.report_type === typeFilter);

  const strCount = reports.filter((r: any) => r.report_type === 'STR').length;
  const ctrCount = reports.filter((r: any) => r.report_type === 'CTR').length;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">FIC goAML</h1>
          <p className="page-subtitle">Financial Intelligence Centre — suspicious and cash transaction reports</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Report
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Reports" value={reports.length} />
        <KpiCard label="STRs Filed" value={strCount} color="#EF4444" />
        <KpiCard label="CTRs Filed" value={ctrCount} color="#F59E0B" />
        <KpiCard label="Other Reports" value={reports.length - strCount - ctrCount} color="#6B7280" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <select className="admin-select" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="ALL">All Types</option>
          {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => exportCsv(filtered, [
          { key: 'report_type', label: 'Type' },
          { key: 'subject_name', label: 'Subject' },
          { key: 'amount', label: 'Amount' },
          { key: 'reference', label: 'Reference' },
          { key: 'report_date', label: 'Date' },
        ], 'goaml_reports.csv')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export
        </button>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Type</th><th>Subject</th><th style={{ textAlign: 'right' }}>Amount</th><th>Description</th><th>Reference</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-shield-halved" /><p>No goAML reports filed</p></div></td></tr>
                : filtered.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`badge ${r.report_type === 'STR' ? 'badge-red' : r.report_type === 'CTR' ? 'badge-yellow' : 'badge-blue'}`}>
                        {r.report_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.subject_name ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.amount ? fmt(Number(r.amount)) : '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 240, color: 'var(--color-text-muted)' }}>{r.description ?? '—'}</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{r.reference ?? r.id?.slice(0, 8) ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(r.report_date ?? r.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>New FIC Report</h3>
              <button className="admin-icon-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Report Type</label>
                <select className="admin-select" value={reportForm.report_type} onChange={e => setReportForm(f => ({ ...f, report_type: e.target.value }))}>
                  {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Report Date</label>
                <input className="admin-input" type="date" value={reportForm.report_date} onChange={e => setReportForm(f => ({ ...f, report_date: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Subject Name</label>
                <input className="admin-input" type="text" required placeholder="Individual or entity name…" value={reportForm.subject_name} onChange={e => setReportForm(f => ({ ...f, subject_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Amount (R)</label>
                <input className="admin-input" type="number" min="0" step="0.01" placeholder="e.g. 25000" value={reportForm.amount} onChange={e => setReportForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Reference</label>
                <input className="admin-input" type="text" placeholder="Optional ref…" value={reportForm.reference} onChange={e => setReportForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Description</label>
                <input className="admin-input" type="text" required placeholder="Brief description of suspicious activity…" value={reportForm.description} onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!reportForm.subject_name || !reportForm.description || createMut.isPending} onClick={() => createMut.mutate({ ...reportForm, amount: reportForm.amount ? Number(reportForm.amount) : null })}>
                {createMut.isPending ? 'Saving…' : 'File Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
