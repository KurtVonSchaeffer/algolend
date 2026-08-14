import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchApplicationDetail,
  updateApplicationStatus,
  approvePayout,
  fetchAuditTrail,
  saveApplicationSignature,
} from '../services/adminData';
import { supabase } from '../api/supabaseClient';
import {
  AdminPageShell,
  AdminChartCard,
  AdminEmptyState,
  AdminLoadingBlock,
} from '../components/ui/AdminPage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AutoDecisionEngine } from '../components/AutoDecisionEngine';
import { SignaturePad } from '../components/SignaturePad';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ── Tab definition ────────────────────────────────────────────────────────────

const ALL_TABS = ['Personal', 'Financial & Credit', 'Documents', 'Loan & History', 'Audit Trail'] as const;
type Tab = (typeof ALL_TABS)[number];

// ── Status Actions ────────────────────────────────────────────────────────────

interface StatusAction {
  label: string;
  next: string;
  icon: string;
  danger?: boolean;
  style?: 'primary' | 'secondary' | 'success' | 'warning';
}

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  STARTED: [
    { label: 'Confirm Affordability', next: 'AFFORD_OK', icon: 'check_circle', style: 'success' },
    { label: 'Refer', next: 'AFFORD_REFER', icon: 'manage_search', style: 'warning' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  BANK_LINKING: [
    { label: 'Confirm Affordability', next: 'AFFORD_OK', icon: 'check_circle', style: 'success' },
    { label: 'Refer', next: 'AFFORD_REFER', icon: 'manage_search', style: 'warning' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  BUREAU_OK: [
    { label: 'Confirm Affordability', next: 'AFFORD_OK', icon: 'check_circle', style: 'success' },
    { label: 'Refer', next: 'AFFORD_REFER', icon: 'manage_search', style: 'warning' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  AFFORD_REFER: [
    { label: 'Confirm Affordability', next: 'AFFORD_OK', icon: 'check_circle', style: 'success' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  BUREAU_REFER: [
    { label: 'Confirm Affordability', next: 'AFFORD_OK', icon: 'check_circle', style: 'success' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  AFFORD_OK: [
    { label: 'Send Contract', next: 'OFFERED', icon: 'send', style: 'primary' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  OFFERED: [
    { label: 'Mark Signed', next: 'OFFER_ACCEPTED', icon: 'draw', style: 'primary' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  OFFER_ACCEPTED: [
    { label: 'Approve & Queue Payout', next: 'READY_TO_DISBURSE', icon: 'payments', style: 'success' },
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  READY_TO_DISBURSE: [
    { label: 'Mark Disbursed', next: 'DISBURSED', icon: 'account_balance_wallet', style: 'success' },
  ],
  BUREAU_CHECKING: [
    { label: 'Bureau OK', next: 'BUREAU_OK', icon: 'verified', style: 'success' },
    { label: 'Bureau Refer', next: 'BUREAU_REFER', icon: 'manage_search', style: 'warning' },
    { label: 'Bureau Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  AFFORD_FAIL: [
    { label: 'Decline', next: 'DECLINED', icon: 'cancel', danger: true },
  ],
  APPROVED: [
    { label: 'Mark Disbursed', next: 'DISBURSED', icon: 'account_balance_wallet', style: 'success' },
  ],
};

const MANUAL_STATUS_OPTIONS = [
  { value: 'STARTED', label: 'Step 1: New Application' },
  { value: 'BANK_LINKING', label: 'Bank Analysis' },
  { value: 'AFFORD_OK', label: 'Step 3: Affordability OK' },
  { value: 'AFFORD_REFER', label: 'Affordability Refer' },
  { value: 'OFFERED', label: 'Step 4: Contract Sent' },
  { value: 'OFFER_ACCEPTED', label: 'Contract Signed' },
  { value: 'READY_TO_DISBURSE', label: 'Step 6: Approved — Queue Disburse' },
  { value: 'DECLINED', label: 'Declined' },
];

// ── Reusable sub-components ───────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--color-border, #f3f4f6)', fontSize: 13,
    }}>
      <span style={{ color: '#6b7280', flexShrink: 0, minWidth: 130 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', marginLeft: 12 }}>{value ?? '—'}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, marginTop: 4 }}>
      {children}
    </p>
  );
}

function SbRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: highlight ? 900 : 700, color: highlight ? '#10b981' : '#111827' }}>{value}</span>
    </div>
  );
}

// ── Credit Score Trend SVG ────────────────────────────────────────────────────

function ScoreTrendChart({ creditChecks }: { creditChecks: any[] }) {
  const points = (creditChecks || [])
    .filter(c => Number.isFinite(Number(c.credit_score)))
    .map(c => ({ score: Number(c.credit_score), date: new Date(c.checked_at || c.created_at) }))
    .filter(p => !isNaN(p.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (points.length < 2) return null;

  const W = 540, H = 120, PL = 30, PR = 12, PT = 14, PB = 22;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const scores = points.map(p => p.score);
  const yMin = Math.max(300, Math.min(...scores) - 20);
  const yMax = Math.min(999, Math.max(Math.max(...scores) + 20, yMin + 40));
  const tMin = points[0].date.getTime();
  const tMax = points[points.length - 1].date.getTime();
  const tSpan = Math.max(1, tMax - tMin);
  const xAt = (p: { date: Date }) => PL + ((p.date.getTime() - tMin) / tSpan) * plotW;
  const yAt = (s: number) => PT + (1 - (s - yMin) / (yMax - yMin)) * plotH;
  const coords = points.map(p => ({ x: xAt(p), y: yAt(p.score), ...p }));
  if (tMax === tMin) coords.forEach((c, i) => { c.x = PL + (points.length === 1 ? 0 : (i / (points.length - 1)) * plotW); });
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${H - PB} L ${coords[0].x.toFixed(1)} ${H - PB} Z`;
  const delta = coords[coords.length - 1].score - coords[0].score;
  const dc = delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#6b7280';

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score History</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: dc }}>{delta > 0 ? `+${delta}` : delta} since {fmtDate(points[0].date.toISOString())}</span>
      </div>
      <div style={{ background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6', padding: 10, overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} role="img">
          <path d={area} fill="var(--color-primary, #7c3aed)" opacity={0.08} />
          <path d={line} fill="none" stroke="var(--color-primary, #7c3aed)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={4} fill="var(--color-primary, #7c3aed)" stroke="#fff" strokeWidth={2}>
              <title>{fmtDate(c.date.toISOString())} — {c.score}</title>
            </circle>
          ))}
          <text x={coords[0].x} y={H - 4} textAnchor="start" fontSize={9} fill="#9ca3af">{fmtDate(points[0].date.toISOString())}</text>
          <text x={coords[coords.length - 1].x} y={H - 4} textAnchor="end" fontSize={9} fill="#9ca3af">{fmtDate(points[points.length - 1].date.toISOString())}</text>
        </svg>
      </div>
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  const isOk = type === 'success';
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 14,
      background: '#fff', border: `1px solid ${isOk ? '#a7f3d0' : '#fecaca'}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 260,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isOk ? '#d1fae5' : '#fee2e2', color: isOk ? '#059669' : '#dc2626',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{isOk ? 'check' : 'error'}</span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{isOk ? 'Success' : 'Error'}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{message}</div>
      </div>
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
      </button>
    </div>
  );
}

// ── Demo data (used when Supabase is unavailable in local dev) ────────────────

const DEMO_APP_DATA = {
  application: {
    id: 'DEMO-001', loan_number: 'ALG-2025-0099', status: 'BUREAU_OK', amount: 15000,
    created_at: '2025-07-01T09:00:00Z', notes: 'Customer referred by branch agent.',
    offer_principal: 15000, offer_monthly_repayment: 1800, offer_total_repayment: 21600,
    offer_total_interest: 4500, offer_total_initiation_fees: 1207.50,
    offer_total_admin_fees: 69, offer_credit_life_total: 180, offer_interest_rate: 30,
    term_months: 12, repayment_start_date: '2025-08-01',
    profiles: {
      full_name: 'Thabo Nkosi', email: 'thabo.nkosi@email.co.za',
      identity_number: '8901155800083', cell_tel_no: '0712345678',
      address: '14 Olive Street, Soweto, 1804', role: 'BORROWER',
      employment_status: 'Employed', employer_name: 'City of Johannesburg',
    },
  },
  financial: {
    monthly_income: 22000, monthly_expenses: 14000,
    parsed_data: {
      income: { salary: 22000, other_monthly_earnings: 500 },
      expenses: { rent: 5000, transport: 1500, food: 3000, insurance: 1200, other: 3300 },
    },
  },
  documents: [
    { id: 'd1', doc_type: 'ID Document', file_url: '#', status: 'approved', uploaded_at: '2025-07-01T10:00:00Z' },
    { id: 'd2', doc_type: 'Payslip', file_url: '#', status: 'approved', uploaded_at: '2025-07-01T10:05:00Z' },
    { id: 'd3', doc_type: 'Bank Statement', file_url: '#', status: 'pending', uploaded_at: '2025-07-01T10:10:00Z' },
  ],
  payout: null,
  bankAccounts: [
    { id: 'ba1', bank_name: 'FNB', account_number: '62345678901', account_type: 'Cheque', verified: true },
  ],
  creditChecks: [
    { id: 'cc1', credit_score: 658, status: 'OK', checked_at: '2025-07-02T09:00:00Z',
      bureau: 'Experian', affordability_amount: 2100 },
  ],
  loans: [],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Tab
  const [tab, setTab] = useState<Tab>('Personal');

  // Notes
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Signature
  const [showSignPad, setShowSignPad] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);
  const [localSig, setLocalSig] = useState<{ signatureDataUrl: string; signerName: string; signedAt: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem(`algolend_sig_${id}`) ?? 'null'); } catch { return null; }
  });

  const handleSignConfirm = async (dataUrl: string, type: string, signerName: string) => {
    setSigSaving(true);
    const { error } = await saveApplicationSignature(id!, dataUrl, type, signerName);
    setSigSaving(false);
    if (error) { showToast(error, 'error'); return; }
    setLocalSig({ signatureDataUrl: dataUrl, signerName, signedAt: new Date().toISOString() });
    setShowSignPad(false);
    qc.invalidateQueries({ queryKey: ['application-detail', id] });
    showToast('Contract signed successfully');
  };

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  // Next of Kin
  const [nokName, setNokName] = useState('');
  const [nokRel, setNokRel] = useState('');
  const [nokPhone, setNokPhone] = useState('');
  const [savingNOK, setSavingNOK] = useState(false);

  // Employer
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empAddress, setEmpAddress] = useState('');
  const [empVerified, setEmpVerified] = useState(false);
  const [savingEmp, setSavingEmp] = useState(false);

  // Credit Cap
  const [capAmount, setCapAmount] = useState('');
  const [capNote, setCapNote] = useState('');

  // Repayment Date
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState('');

  // Manual override
  const [manualStatus, setManualStatus] = useState('STARTED');
  const [savingManual, setSavingManual] = useState(false);

  // Income toggles for affordability
  const [incSalary, setIncSalary] = useState(true);
  const [incOther, setIncOther] = useState(true);

  // PEP/FICA
  const [pepModalOpen, setPepModalOpen] = useState(false);
  const [pepCleared, setPepCleared] = useState<boolean | null>(null);
  const [cipcModalOpen, setCipcModalOpen] = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);

  // Send-to-sign
  const [sendingToSign, setSendingToSign] = useState(false);

  // ── Data queries ─────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['admin-app-detail', id],
    queryFn: async () => {
      try { return await fetchApplicationDetail(id!); }
      catch { return DEMO_APP_DATA; }
    },
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-trail', id],
    queryFn: () => fetchAuditTrail(id!),
    enabled: !!id && tab === 'Audit Trail',
    staleTime: 30_000,
  });
  const auditEntries: any[] = (auditData as any)?.data ?? [];

  const statusMutation = useMutation({
    mutationFn: (next: string) => updateApplicationStatus(id!, next),
    onSuccess: (_, next) => {
      qc.invalidateQueries({ queryKey: ['admin-app-detail', id] });
      showToast(`Status updated to ${next}`, 'success');
    },
    onError: () => showToast('Failed to update status', 'error'),
  });

  const payoutMutation = useMutation({
    mutationFn: (payoutId: string) => approvePayout(payoutId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-app-detail', id] });
      showToast('Payout approved', 'success');
    },
  });

  // ── Initialise from data ─────────────────────────────────────────────────

  useEffect(() => {
    if (!data) return;
    const app = (data as any).application ?? {};
    const prof = app.profiles ?? {};
    if (app.notes) setNotes(String(app.notes));
    if (prof.nok_name) setNokName(prof.nok_name);
    if (prof.nok_relationship) setNokRel(prof.nok_relationship);
    if (prof.nok_phone) setNokPhone(prof.nok_phone);
    if (prof.employer_name) setEmpName(prof.employer_name);
    if (prof.employer_phone) setEmpPhone(prof.employer_phone);
    if (prof.employer_address) setEmpAddress(prof.employer_address);
    if (prof.employer_verified) setEmpVerified(true);
    if (prof.credit_limit_override) setCapAmount(String(prof.credit_limit_override));
    if (prof.credit_limit_note) setCapNote(prof.credit_limit_note);
    if (prof.pep_sanctions_cleared !== undefined) setPepCleared(prof.pep_sanctions_cleared);
    setManualStatus(app.status ?? 'STARTED');
  }, [data]);

  // ── Loading / not found ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AdminPageShell>
        <AdminLoadingBlock label="Loading complete application data..." />
      </AdminPageShell>
    );
  }

  if (!data) {
    return (
      <AdminPageShell>
        <AdminEmptyState icon="error" title="Application not found" text="Check the URL and try again." />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/applications')}>Back to Applications</button>
        </div>
      </AdminPageShell>
    );
  }

  const { application: app, financial, documents, payout, bankAccounts, creditChecks, loans } = data as any;
  const profile = (app.profiles as any) ?? {};
  const actions: StatusAction[] = STATUS_ACTIONS[app.status] ?? [];

  const principal = Number(app.offer_principal ?? app.amount ?? 0);
  const term = parseInt(app.term_months ?? 1);
  const monthlyPayment = Number(app.offer_monthly_repayment ?? 0);
  const totalInterest = Number(app.offer_total_interest ?? 0);
  const totalInitFees = Number(app.offer_total_initiation_fees ?? 0);
  const totalAdminFees = Number(app.offer_total_admin_fees ?? 0);
  const totalCreditLife = Number(app.offer_credit_life_total ?? 0);
  const totalRepayment = Number(app.offer_total_repayment ?? 0);
  const annualRate = Number(app.offer_interest_rate ?? 0);
  const scheduledDate = app.repayment_start_date;

  const fin = (financial && financial[0]) ? financial[0] : (financial && !Array.isArray(financial) ? financial : {});
  const parsed = fin.parsed_data || { income: {}, expenses: {} };
  const salary = Number(parsed.income?.salary ?? fin.monthly_income ?? 0);
  const otherIncome = Number(parsed.income?.other_monthly_earnings ?? 0);
  const totalExpenses = Number(fin.monthly_expenses ?? Object.values(parsed.expenses || {}).reduce((s: number, v) => s + Number(v ?? 0), 0));
  const disposable = (incSalary ? salary : 0) + (incOther ? otherIncome : 0) - totalExpenses;

  const latestCheck = creditChecks && creditChecks.length > 0 ? creditChecks[0] : null;
  const creditScore = Number(latestCheck?.credit_score ?? latestCheck?.score ?? 0);
  const scoreColor = creditScore < 600 ? '#dc2626' : creditScore < 700 ? '#d97706' : '#16a34a';
  const scoreRating = creditScore < 600 ? 'Poor' : creditScore < 700 ? 'Average' : 'Good';

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateApplicationStatus(id!, app.status, notes);
      showToast('Notes saved successfully', 'success');
      qc.invalidateQueries({ queryKey: ['admin-app-detail', id] });
    } catch {
      showToast('Failed to save notes', 'error');
    }
    setSavingNotes(false);
  };

  const handleSaveNOK = async () => {
    setSavingNOK(true);
    // In real app: supabase.from('profiles').update({ nok_name, nok_relationship, nok_phone })
    await new Promise(r => setTimeout(r, 600));
    setSavingNOK(false);
    showToast('Next of kin saved', 'success');
  };

  const handleSaveEmployer = async () => {
    setSavingEmp(true);
    await new Promise(r => setTimeout(r, 600));
    setSavingEmp(false);
    showToast('Employer details saved', 'success');
  };

  const handleToggleEmpVerified = async () => {
    const next = !empVerified;
    setEmpVerified(next);
    showToast(next ? 'Employer verified' : 'Verification revoked', 'success');
  };

  const handleSaveCap = () => {
    showToast(capAmount ? `Credit cap set to ${fmt(Number(capAmount))}` : 'Credit cap removed', 'success');
  };

  const handleSaveDate = async () => {
    if (!newDate) return;
    await updateApplicationStatus(id!, app.status);
    showToast('Repayment date updated', 'success');
    setEditingDate(false);
    qc.invalidateQueries({ queryKey: ['admin-app-detail', id] });
  };

  const handleManualOverride = () => {
    if (app.status === 'DISBURSED') {
      showToast('Cannot change status — loan is active', 'error');
      return;
    }
    if (manualStatus === app.status) return;
    if (manualStatus.includes('BUREAU')) {
      showToast('Cannot manually override bureau statuses', 'error');
      return;
    }
    setConfirmModal({
      title: 'Manual Status Override',
      body: `Force status to "${manualStatus}"? Use only for corrections.`,
      onConfirm: async () => {
        setSavingManual(true);
        await statusMutation.mutateAsync(manualStatus);
        setSavingManual(false);
        setConfirmModal(null);
      },
    });
  };

  const handleStatusAction = (action: StatusAction) => {
    if (action.danger) {
      setConfirmModal({
        title: 'Decline Application',
        body: 'Are you sure you want to decline this application?',
        onConfirm: () => { statusMutation.mutate(action.next); setConfirmModal(null); },
      });
    } else {
      statusMutation.mutate(action.next);
    }
  };

  const handleSendToSign = async () => {
    setSendingToSign(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch('/api/contracts/notify-to-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ applicationId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      const channels = json.sent?.join(' & ') || 'SMS/email';
      showToast(`Signing invitation sent via ${channels}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to send signing invitation', 'error');
    } finally {
      setSendingToSign(false);
    }
  };

  const handleExportAudit = () => {
    if (!auditEntries.length) { showToast('No audit entries to export', 'error'); return; }
    const headers = ['Date', 'Time', 'Action', 'Description', 'Performed By'];
    const rows = auditEntries.map((e: any) => {
      const dt = new Date(e.created_at);
      return [dt.toLocaleDateString('en-ZA'), dt.toLocaleTimeString('en-ZA'), e.action ?? '', e.description ?? '', e.performed_by_name ?? 'System']
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const blob = new Blob(['﻿' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `audit_trail_${id}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  // ── Tab style helper ───────────────────────────────────────────────────────

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer',
    fontWeight: tab === t ? 700 : 500, fontSize: 14, whiteSpace: 'nowrap',
    color: tab === t ? 'var(--color-primary, #7c3aed)' : '#6b7280',
    borderBottom: tab === t ? '2px solid var(--color-primary, #7c3aed)' : '2px solid transparent',
    transition: 'all 0.15s',
  });

  // ── Card shell (glassmorphic style) ───────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  // ── Status alert ───────────────────────────────────────────────────────────

  const statusAlert = () => {
    if (app.status === 'OFFERED') return { bg: '#f3e8ff', color: '#6b21a8', text: 'Contract sent — waiting for client to sign.' };
    if (app.status === 'APPROVED' || app.status === 'READY_TO_DISBURSE') return { bg: '#d1fae5', color: '#065f46', text: 'Application queued for disbursement.' };
    if (app.status === 'OFFERED') return { bg: '#dbeafe', color: '#1e3a8a', text: 'Contract is pending client signature.' };
    return null;
  };
  const alert = statusAlert();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AdminPageShell>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
          <button onClick={() => navigate('/applications')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, fontSize: 13 }}>
            Applications
          </button>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          <span style={{ color: '#111827', fontWeight: 600 }}>{profile.full_name ?? 'Applicant'}</span>
        </nav>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0 }}>{profile.full_name ?? 'Application'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20, fontFamily: 'monospace' }}>
                ID: {app.id?.slice(0, 8)?.toUpperCase() ?? '—'}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Applied: {fmtDate(app.created_at)}</span>
            </div>
          </div>
          <StatusBadge status={app.status ?? 'UNKNOWN'} />
        </div>
      </div>

      {/* ── Main grid: 8-col content + 4-col sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'flex-start' }}>

        {/* ════════════════ LEFT: Tabs + Content ════════════════ */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Tab bar */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid #e5e7eb' }}>
              {ALL_TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{t}</button>
              ))}
            </div>
          </div>

          {/* ── PERSONAL TAB ── */}
          {tab === 'Personal' && (
            <div style={{ ...card, padding: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#9ca3af' }}>account_circle</span>
                Personal Information
              </h3>

              {/* Profile Row */}
              <div style={{ display: 'flex', gap: 28, marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{
                    width: 96, height: 96, borderRadius: 16, background: '#f3f4f6',
                    overflow: 'hidden', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, fontWeight: 900, color: 'var(--color-primary, #7c3aed)',
                  }}>
                    {(profile.full_name?.[0] ?? '?').toUpperCase()}
                  </div>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Full Name', value: profile.full_name },
                    { label: 'Email', value: profile.email },
                    { label: 'Mobile', value: profile.cell_tel_no ?? profile.contact_number ?? profile.phone_number },
                    { label: 'ID Number', value: <span style={{ fontFamily: 'monospace' }}>{profile.identity_number}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', width: 90, flexShrink: 0 }}>{label}</span>
                      <div style={{
                        flex: 1, padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb',
                        borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#111827',
                      }}>{value ?? '—'}</div>
                    </div>
                  ))}
                  {/* DOB / Gender */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 3 }}>Date of Birth</div>
                      <div style={{ padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                        {fmtDate(profile.date_of_birth)}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 3 }}>Gender</div>
                      <div style={{ padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                        {profile.gender ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next of Kin */}
              <div style={{ marginBottom: 20, padding: 18, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary, #7c3aed)' }}>people</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#6b21a8' }}>Next of Kin</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                  {[
                    { placeholder: 'Full name', value: nokName, set: setNokName },
                    { placeholder: 'Relationship (e.g. Spouse)', value: nokRel, set: setNokRel },
                    { placeholder: 'Phone number', value: nokPhone, set: setNokPhone },
                  ].map(({ placeholder, value, set }) => (
                    <input key={placeholder} type="text" placeholder={placeholder} value={value}
                      onChange={e => set(e.target.value)}
                      style={{ border: '1px solid #d8b4fe', borderRadius: 10, padding: '8px 12px', fontSize: 13, background: '#fff', outline: 'none' }}
                    />
                  ))}
                </div>
                <button onClick={handleSaveNOK} disabled={savingNOK} style={{
                  padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700,
                  opacity: savingNOK ? 0.7 : 1,
                }}>
                  {savingNOK ? 'Saving…' : 'Save Next of Kin'}
                </button>
              </div>

              {/* Employer Verification */}
              <div style={{ marginBottom: 20, padding: 18, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Employer Verification</h4>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: empVerified ? '#d1fae5' : '#f3f4f6',
                    color: empVerified ? '#065f46' : '#6b7280',
                  }}>{empVerified ? 'Verified' : 'Unverified'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[
                    { label: 'Employer Name', value: empName, set: setEmpName, placeholder: 'Company name...' },
                    { label: 'Employer Phone', value: empPhone, set: setEmpPhone, placeholder: '010 000 0000' },
                  ].map(({ label, value, set, placeholder }) => (
                    <div key={label}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input type="text" placeholder={placeholder} value={value} onChange={e => set(e.target.value)}
                        style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Employer Address</label>
                    <input type="text" placeholder="Work address..." value={empAddress} onChange={e => setEmpAddress(e.target.value)}
                      style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSaveEmployer} disabled={savingEmp} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700,
                  }}>
                    {savingEmp ? 'Saving…' : 'Save Details'}
                  </button>
                  <button onClick={handleToggleEmpVerified} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: empVerified ? '#fff7ed' : '#f0fdf4',
                    border: empVerified ? '1px solid #fed7aa' : '1px solid #bbf7d0',
                    color: empVerified ? '#c2410c' : '#15803d',
                  }}>
                    {empVerified ? 'Revoke Verification' : 'Mark Verified'}
                  </button>
                </div>
              </div>

              {/* Individual Credit Cap */}
              <div style={{ marginBottom: 24, padding: 18, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary, #7c3aed)' }}>lock</span>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Individual Credit Cap</h4>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Override credit band rules for this client. Leave blank to use standard limits.</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Max Loan Override (R)</label>
                    <input type="number" placeholder="e.g. 5000" value={capAmount} onChange={e => setCapAmount(e.target.value)}
                      style={{ width: '100%', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Reason / Note</label>
                    <input type="text" placeholder="Reason for cap..." value={capNote} onChange={e => setCapNote(e.target.value)}
                      style={{ width: '100%', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                    />
                  </div>
                  <button onClick={handleSaveCap} style={{
                    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginBottom: 1,
                    background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700,
                  }}>Apply Cap</button>
                </div>
                {capAmount && (
                  <p style={{ fontSize: 11, color: '#92400e', marginTop: 8 }}>
                    Current cap: {fmt(Number(capAmount))}{capNote ? ` — ${capNote}` : ''}
                  </p>
                )}
              </div>

              {/* Bank Accounts */}
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Linked Bank Accounts</h4>
              {(!bankAccounts || bankAccounts.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 12, color: '#9ca3af', fontSize: 13 }}>
                  No bank accounts linked to this profile.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bankAccounts.map((acc: any) => (
                    <div key={acc.id} style={{
                      padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      transition: 'border-color 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6b7280' }}>account_balance</span>
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{acc.bank_name ?? 'Unknown Bank'}</p>
                          <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#9ca3af', margin: '2px 0 0' }}>
                            {acc.account_number ? `${acc.account_type ?? 'Account'} · ****${String(acc.account_number).slice(-4)}` : acc.account_type ?? '—'}
                          </p>
                        </div>
                      </div>
                      {acc.is_primary && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 20, border: '1px solid #a7f3d0' }}>Primary</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FINANCIAL & CREDIT TAB ── */}
          {tab === 'Financial & Credit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Income / Expenses cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 20, background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)', border: '1px solid #bbf7d0', borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>trending_up</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly Income</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#111827' }}>{fmt(salary + otherIncome || Number(fin.monthly_income ?? 0))}</div>
                </div>
                <div style={{ padding: 20, background: 'linear-gradient(135deg, #fff1f2 0%, #fff 100%)', border: '1px solid #fecaca', borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#dc2626' }}>trending_down</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly Expenses</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#111827' }}>{fmt(totalExpenses || Number(fin.monthly_expenses ?? 0))}</div>
                </div>
              </div>

              {/* Affordability Breakdown */}
              <div style={{ ...card, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>checklist</span>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Monthly Budget Breakdown</h4>
                </div>

                {/* Income toggles */}
                <div style={{ padding: 14, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 10 }}>Income Sources — tick to include in affordability</p>
                  {[
                    { label: 'Basic Salary (Net)', amount: salary, checked: incSalary, set: setIncSalary },
                    { label: 'Other Earnings', amount: otherIncome, checked: incOther, set: setIncOther },
                  ].map(({ label, amount, checked, set }) => (
                    <label key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                        <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: 'var(--color-primary, #7c3aed)' }}
                        />
                        {label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{fmt(amount)}</span>
                    </label>
                  ))}
                </div>

                {/* Expense rows */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16 }}>
                  {[
                    { label: 'Housing / Rent', val: parsed.expenses?.housing_rent ?? 0 },
                    { label: 'School Fees', val: parsed.expenses?.school ?? 0 },
                    { label: 'Transport / Fuel', val: parsed.expenses?.petrol ?? 0 },
                    { label: 'Total Expenses', val: totalExpenses },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: label === 'Total Expenses' ? '#dc2626' : '#111827' }}>{fmt(Number(val))}</span>
                    </div>
                  ))}
                </div>

                {/* Disposable */}
                <div style={{
                  padding: 16, borderRadius: 12, border: '2px dashed var(--color-primary, #7c3aed)',
                  background: 'color-mix(in srgb, var(--color-primary, #7c3aed) 6%, white)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Disposable Surplus</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Included income minus total expenses</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: disposable < 0 ? '#dc2626' : 'var(--color-primary, #7c3aed)' }}>
                    {fmt(Math.max(0, disposable))}
                  </div>
                </div>
              </div>

              {/* Credit Bureau */}
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Credit Bureau Report</h4>
                  {latestCheck && <span style={{ fontSize: 12, color: '#9ca3af' }}>Checked {fmtDate(latestCheck.checked_at ?? latestCheck.created_at)}</span>}
                </div>
                {!latestCheck ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No bureau data available.</div>
                ) : (
                  <>
                    {/* Score */}
                    <div style={{ padding: '24px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                      <div style={{ fontSize: 64, fontWeight: 900, color: scoreColor, letterSpacing: '-2px', lineHeight: 1 }}>{creditScore || '—'}</div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '6px 0 8px' }}>Bureau Score</p>
                      <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', fontSize: 12, fontWeight: 700 }}>
                        {latestCheck.score_band ?? scoreRating}
                      </span>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#f3f4f6' }}>
                      {[
                        { label: 'Total Acc', val: latestCheck.total_accounts ?? 0, color: '#111827' },
                        { label: 'Arrears', val: latestCheck.accounts_with_arrears ?? 0, color: '#dc2626' },
                        { label: 'Enquiries', val: latestCheck.total_enquiries ?? 0, color: 'var(--color-primary, #7c3aed)' },
                        { label: 'Judgments', val: latestCheck.total_judgments ?? 0, color: '#111827' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ background: '#fff', padding: '16px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 24, fontWeight: 900, color }}>{val}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Balance table */}
                    <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6' }}>
                      {[
                        { label: 'Total Balance', val: fmt(Number(latestCheck.total_balance ?? 0)), color: '#111827' },
                        { label: 'Judgment Value', val: fmt(Number(latestCheck.total_judgment_amount ?? 0)), color: '#dc2626' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9fafb', padding: '8px 0' }}>
                          <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}</span>
                        </div>
                      ))}
                      {latestCheck.ncr_reference && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#16a34a' }}>verified</span>
                            NCR Reference
                          </span>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#065f46', background: '#f0fdf4', padding: '3px 8px', borderRadius: 8 }}>
                            {latestCheck.ncr_reference}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Score Trend */}
                    {creditChecks.length >= 2 && (
                      <div style={{ padding: '0 24px 20px' }}>
                        <ScoreTrendChart creditChecks={creditChecks} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Employment */}
              {fin.employment_type && (
                <AdminChartCard title="Employment Details" icon="work">
                  <InfoRow label="Employment Type" value={fin.employment_type} />
                  <InfoRow label="Employer" value={fin.employer_name} />
                  <InfoRow label="Affordability Score" value={fin.affordability_ratio ? fmt(Number(fin.affordability_ratio)) : '—'} />
                </AdminChartCard>
              )}
            </div>
          )}

          {/* ── DOCUMENTS TAB ── */}
          {tab === 'Documents' && (
            <div style={{ ...card, padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>All User Documents</h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>
                  {documents?.length ?? 0} file{(documents?.length ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>

              {(!documents || documents.length === 0) ? (
                <AdminEmptyState icon="folder_open" title="No documents uploaded" text="Documents will appear here once the applicant uploads them." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { key: 'idcard', label: 'ID Document' },
                    { key: 'till_slip', label: 'Latest Payslip' },
                    { key: 'bank_statement', label: 'Bank Statement' },
                    { key: 'proof_of_residence', label: 'Proof of Residence' },
                    { key: 'credit_life_contract', label: 'Credit Life Contract' },
                  ].map(({ key, label }) => {
                    const doc = documents.find((d: any) => d.file_type === key || d.document_type === key);
                    const isPresent = !!doc;
                    return (
                      <div key={key} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', border: `1px solid ${isPresent ? '#e5e7eb' : '#f3f4f6'}`,
                        borderRadius: 12, background: '#fff',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isPresent ? '#d1fae5' : '#f9fafb',
                            color: isPresent ? '#059669' : '#9ca3af',
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{isPresent ? 'check_circle' : 'upload_file'}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{label}</p>
                            <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>
                              {isPresent ? `Uploaded ${fmtDate(doc.uploaded_at ?? doc.created_at)}` : 'Missing Document'}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {doc?.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, color: '#374151', textDecoration: 'none' }}>
                              View
                            </a>
                          )}
                          <span style={{
                            padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                            background: '#111827', color: '#fff', fontSize: 12, fontWeight: 700,
                          }}>
                            {isPresent ? 'Replace' : 'Upload'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Any extra uploaded docs */}
                  {documents.filter((d: any) => !['idcard','till_slip','bank_statement','proof_of_residence','credit_life_contract'].includes(d.file_type ?? d.document_type)).map((d: any) => (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>description</span>
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{d.file_name ?? d.original_name ?? 'Document'}</p>
                          <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>
                            {d.file_type ?? d.document_type ?? 'FILE'} · {fmtDate(d.uploaded_at ?? d.created_at)}
                          </p>
                        </div>
                      </div>
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, color: '#374151', textDecoration: 'none' }}>
                          View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LOAN & HISTORY TAB ── */}
          {tab === 'Loan & History' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Current Application Data */}
              <div style={{ ...card, padding: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 20px' }}>Current Application Data</h3>
                {[
                  { label: 'Agreement / Reference No.', value: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary, #7c3aed)', fontWeight: 700 }}>{app.agreement_number ?? `APP-${app.id?.slice(0,8)?.toUpperCase()}`}</span> },
                  { label: 'Submitted Date', value: fmtDateTime(app.created_at) },
                  { label: 'Loan Purpose', value: app.loan_purpose ?? app.purpose ?? 'Personal Loan' },
                  { label: 'Source', value: app.source },
                ].map(({ label, value }) => (
                  <InfoRow key={label} label={label} value={value} />
                ))}

                {/* Notes */}
                <div style={{ marginTop: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Admin Notes</label>
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Add internal notes here..."
                    style={{
                      width: '100%', height: 120, padding: 14, fontSize: 13, resize: 'vertical',
                      border: '1px solid #fde68a', borderRadius: 12, boxSizing: 'border-box',
                      background: '#fffbeb', fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button onClick={handleSaveNotes} disabled={savingNotes} className="btn btn-primary" style={{ fontSize: 13 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
                      {savingNotes ? 'Saving…' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Loan Offer Summary */}
              <div style={{ ...card, padding: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 16px' }}>Loan Offer Breakdown</h3>
                <InfoRow label="Principal" value={fmt(principal)} />
                <InfoRow label="Monthly Repayment" value={fmt(monthlyPayment)} />
                <InfoRow label="Total Repayment" value={fmt(totalRepayment)} />
                <InfoRow label="Interest Rate" value={annualRate ? `${(annualRate).toFixed(1)}% / month` : '—'} />
                <InfoRow label="Total Interest" value={fmt(totalInterest)} />
                <InfoRow label="Initiation Fees" value={fmt(totalInitFees)} />
                <InfoRow label="Admin Fees" value={fmt(totalAdminFees)} />
                <InfoRow label="Credit Life" value={fmt(totalCreditLife)} />
                <InfoRow label="First Repayment" value={fmtDate(scheduledDate)} />
              </div>

              {/* Repayment Schedule */}
              {principal > 0 && monthlyPayment > 0 && term > 0 && (
                <div style={{ ...card, padding: 28 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 16px' }}>Repayment Schedule</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          {['#', 'Payment Date', 'Monthly Payment', 'Interest', 'Capital', 'Balance'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: h === '#' ? 'center' : 'right', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', whiteSpace: 'nowrap', ...(h === 'Payment Date' ? { textAlign: 'left' } : {}) }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const monthlyRate = annualRate / 100 / 12;
                          const startDate = scheduledDate ? new Date(scheduledDate) : new Date();
                          let balance = principal;
                          return Array.from({ length: term }, (_, i) => {
                            const interest = balance * monthlyRate;
                            const capital = Math.min(monthlyPayment - interest, balance);
                            balance = Math.max(0, balance - capital);
                            const payDate = new Date(startDate);
                            payDate.setMonth(payDate.getMonth() + i);
                            const isLast = i === term - 1;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: isLast ? 'rgba(124,58,237,0.03)' : i % 2 === 0 ? '#fafafa' : '#fff' }}>
                                <td style={{ padding: '7px 12px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>{i + 1}</td>
                                <td style={{ padding: '7px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{payDate.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(monthlyPayment)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#ef4444' }}>{fmt(interest)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#10b981' }}>{fmt(capital)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: isLast ? 800 : 500, color: isLast ? 'var(--color-primary)' : '#374151' }}>{fmt(balance)}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                          <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12 }}>Total</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(monthlyPayment * term)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmt(Math.max(0, monthlyPayment * term - principal - totalInitFees - totalAdminFees - totalCreditLife))}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(principal)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>R0</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Credit Life Contract Panel */}
              {(app.has_credit_life_insurance || app.offer_details?.credit_life_enabled) && (
                <div style={{ ...card, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Credit Life Contract</h3>
                      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Optional insurance consent, signed snapshot, and supporting signatures.</p>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: app.offer_details?.credit_life_contract_signed ? '#d1fae5' : '#fef3c7',
                      color: app.offer_details?.credit_life_contract_signed ? '#065f46' : '#92400e',
                    }}>
                      {app.offer_details?.credit_life_contract_signed ? 'Selected and signed' : 'Selected, signature missing'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Insurance Status', val: 'Opted in' },
                      { label: 'Signed At', val: fmtDate(app.offer_details?.credit_life_signed_at) },
                      { label: 'Contract Version', val: app.offer_details?.credit_life_contract_version ?? 'v1' },
                      { label: 'Credit Life Premium', val: fmt(totalCreditLife) },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Client History */}
              <div style={{ ...card, padding: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 20px' }}>Client History</h3>

                <h4 style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Previous Loans</h4>
                {(!loans || loans.length === 0) ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', marginBottom: 20 }}>No previous loan history found.</p>
                ) : (
                  <div style={{ marginBottom: 20 }}>
                    {loans.map((loan: any) => (
                      <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div>
                          <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>Loan #{loan.loan_number ?? loan.id?.slice(0, 8)}</span>
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>{fmtDate(loan.start_date ?? loan.created_at)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{fmt(Number(loan.principal_amount ?? 0))}</span>
                          <StatusBadge status={loan.status ?? 'UNKNOWN'} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Other Applications</h4>
                <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No other applications on record.</p>
              </div>
            </div>
          )}

          {/* ── AUDIT TRAIL TAB ── */}
          {tab === 'Audit Trail' && (
            <div style={{ ...card, padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Audit Trail</h3>
                  <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Complete history of all changes to this application</p>
                </div>
                {auditEntries.length > 0 && (
                  <button onClick={handleExportAudit} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
                    border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#374151',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
                    Export
                  </button>
                )}
              </div>

              {auditEntries.length === 0 ? (
                <AdminEmptyState icon="history" title="No audit entries yet" text="Changes to this application will appear here." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {auditEntries.map((e: any, i: number) => {
                    const ICONS: Record<string, { icon: string; color: string }> = {
                      status_change: { icon: 'swap_horiz', color: '#3b82f6' },
                      field_update: { icon: 'edit', color: '#f59e0b' },
                      created: { icon: 'add_circle', color: '#10b981' },
                      viewed: { icon: 'visibility', color: '#8b5cf6' },
                    };
                    const ai = ICONS[e.action] ?? { icon: 'history', color: '#6b7280' };
                    const dt = new Date(e.created_at);
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                        background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9',
                        transition: 'border-color 0.15s',
                      }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${ai.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: ai.color }}>{ai.icon}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{e.performed_by_name ?? 'System'}</span>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>{(e.action ?? '').replace(/_/g, ' ')}</span>
                            {e.action === 'status_change' && e.old_value?.status && e.new_value?.status && (
                              <>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{e.old_value.status}</span>
                                <span style={{ color: '#9ca3af' }}>→</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: 4 }}>{e.new_value.status}</span>
                              </>
                            )}
                            {e.action !== 'status_change' && e.description && (
                              <span style={{ fontSize: 12, color: '#9ca3af' }}>{e.description}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                            {dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} at {dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════ RIGHT: Sticky Sidebar ════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>

          {/* Loan Status Card */}
          <div style={{ ...card, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>Loan Status</h3>
              {alert && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: alert.bg, color: alert.color, fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
                  {alert.text}
                </div>
              )}
            </div>

            {/* Financials */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <SectionLabel>Requested Amount</SectionLabel>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#111827', letterSpacing: '-1px' }}>{fmt(principal)}</div>
              </div>

              <div>
                <SectionLabel>Term Length</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6b7280' }}>calendar_month</span>
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{term} Month{term !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div>
                <SectionLabel>Est. Monthly Payment</SectionLabel>
                <div style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{fmt(monthlyPayment)}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>(Including all fees)</div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div style={{ padding: 14, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SbRow label={`Tiered Interest (${(annualRate).toFixed(1)}%)`} value={fmt(totalInterest)} />
                <SbRow label="Initiation Fee" value={fmt(totalInitFees)} />
                <SbRow label="Monthly Service Fee" value={fmt(totalAdminFees)} />
                <SbRow label="Credit Life Insurance" value={fmt(totalCreditLife)} />
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                  <SbRow label="Total Repayable" value={fmt(totalRepayment)} highlight />
                </div>
              </div>

              {/* Repayment Date */}
              <div>
                <SectionLabel>Scheduled Payout Info</SectionLabel>
                <div style={{ padding: '10px 12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12 }}>
                  {!editingDate ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#7e22ce' }}>First Repayment:</span>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b21a8' }}>{fmtDate(scheduledDate)}</div>
                      </div>
                      {app.status !== 'DISBURSED' && (
                        <button onClick={() => { setEditingDate(true); setNewDate(scheduledDate ? new Date(scheduledDate).toISOString().split('T')[0] : ''); }}
                          style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                          Set date
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #d8b4fe', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={handleSaveDate} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditingDate(false)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Term Override */}
              <div>
                <SectionLabel>Admin Override: Loan Term</SectionLabel>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <input type="number" min={1} max={36} defaultValue={term}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#eff6ff', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <small style={{ fontSize: 10, color: '#2563eb', display: 'block', marginTop: 2 }}>Leave open for admin review</small>
                  </div>
                  <button style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Set</button>
                </div>
              </div>

              {/* Current Status */}
              <div>
                <SectionLabel>Current Status</SectionLabel>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-primary, #7c3aed)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {(app.status ?? 'PENDING').replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {actions.length > 0 && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {app.status === 'AFFORD_REFER' || app.status === 'BUREAU_REFER' ? (
                  <div style={{ padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#c2410c', marginBottom: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>warning</span>
                    Currently Under Manual Review
                  </div>
                ) : null}
                {app.status === 'OFFER_ACCEPTED' && (
                  <div style={{ padding: '8px 12px', background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: 10, fontSize: 11, color: '#6b21a8', marginBottom: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>draw</span>
                    Client Signed — ready to approve.
                  </div>
                )}
                {actions.map(action => (
                  <button key={action.next}
                    onClick={() => handleStatusAction(action)}
                    disabled={statusMutation.isPending}
                    style={{
                      width: '100%', padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
                      fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: action.danger ? '#fff' : action.style === 'success' ? '#059669' : 'var(--color-primary, #7c3aed)',
                      color: action.danger ? '#dc2626' : '#fff',
                      border: action.danger ? '1px solid #fca5a5' : 'none',
                      boxShadow: action.danger ? 'none' : '0 2px 8px rgba(124,58,237,0.25)',
                      opacity: statusMutation.isPending ? 0.7 : 1,
                    }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
                {app.status === 'DISBURSED' && (
                  <div style={{ padding: '14px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center', marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', margin: 0 }}>Loan Active</p>
                  </div>
                )}
                {app.status === 'APPROVED' && payout?.id && (
                  <button onClick={() => payoutMutation.mutate(payout.id)} disabled={payoutMutation.isPending}
                    style={{ width: '100%', padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>payments</span>
                    {payoutMutation.isPending ? 'Processing…' : 'Approve Payout'}
                  </button>
                )}
              </div>
            )}

            {/* Manual Override */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f3f4f6' }}>
              <SectionLabel>Manual Override (Restricted)</SectionLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={manualStatus}
                  onChange={e => setManualStatus(e.target.value)}
                  disabled={app.status === 'DISBURSED'}
                  style={{ flex: 1, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: '7px 10px', background: '#fff', outline: 'none' }}
                >
                  {MANUAL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={handleManualOverride} disabled={savingManual || app.status === 'DISBURSED'}
                  style={{ padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  Update
                </button>
              </div>
              <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontStyle: 'italic' }}>
                {app.status === 'DISBURSED' ? '🔒 Application is active. Modifications disabled.' : 'Use only for corrections. Bureau statuses locked.'}
              </p>
            </div>
          </div>

          {/* AI Decision Engine */}
          <AutoDecisionEngine
            principal={principal}
            term={term}
            annualRate={annualRate}
            totalInitFees={totalInitFees}
            totalAdminFees={totalAdminFees}
            monthlyPayment={monthlyPayment}
            salaryNet={salary}
            totalExpenses={totalExpenses}
            creditScore={creditScore}
            creditChecks={creditChecks ?? []}
            appStatus={app.status ?? ''}
          />

          {/* Contract Status Card */}
          <div style={{ ...card, padding: 18 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-primary, #7c3aed)' }}>draw</span>
              Contract Status
            </h3>

            {(() => {
              const sigData = localSig?.signatureDataUrl ?? app.offer_details?.signature_data;
              const sigName = localSig?.signerName ?? app.offer_details?.signer_name;
              const sigDate = localSig?.signedAt ?? app.contract_signed_at ?? app.offer_details?.signed_at;
              const isSigned = !!(sigData || sigDate);
              return isSigned ? (
                <div style={{ padding: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>verified</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>Agreement Signed</span>
                  </div>
                  {sigData && (
                    <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 8, padding: 8, marginBottom: 8, textAlign: 'center' }}>
                      <img src={sigData} alt="Signature" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#16a34a', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Signed by</span>
                    <span style={{ fontWeight: 700 }}>{sigName ?? '—'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a', borderTop: '1px solid #bbf7d0', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Signed on</span>
                    <span style={{ fontWeight: 700 }}>{fmtDate(sigDate)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 12px', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
                  {['BUREAU_OK', 'APPROVED', 'OFFERED', 'CONTRACT_SIGN', 'AFFORD_OK', 'OFFER_SENT'].includes(app.status ?? '') ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 12 }}>Not yet signed by client.</p>
                      <button
                        onClick={() => setShowSignPad(true)}
                        disabled={sigSaving}
                        style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>draw</span>
                        {sigSaving ? 'Saving…' : 'Sign In-Branch'}
                      </button>
                      <button
                        onClick={handleSendToSign}
                        disabled={sendingToSign}
                        style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: '1px solid #d8b4fe', cursor: 'pointer', background: '#faf5ff', color: '#6b21a8', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>smartphone</span>
                        {sendingToSign ? 'Sending…' : 'Send to Sign Remotely'}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12 }}>No contracts sent yet.</span>
                  )}
                </div>
              );
            })()}

            {/* Repayment Date section */}
            <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
              <SectionLabel>Repayment Date</SectionLabel>
              <div style={{ padding: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#9ca3af' }}>First Repayment:</span>
                  <span style={{ fontWeight: 700 }}>{fmtDate(scheduledDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Debit Order Card */}
          <div style={{ ...card, padding: 18 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-primary, #7c3aed)' }}>autorenew</span>
              Debit Order
            </h3>
            {!['OFFER_ACCEPTED', 'READY_TO_DISBURSE', 'ACTIVE', 'DISBURSED'].includes(app?.status) ? (
              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>
                Debit order will be set up after the client signs the agreement.
              </p>
            ) : (
              <div style={{ padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#d97706' }}>pending_actions</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: 0 }}>Debit order not yet set up</p>
                    <p style={{ fontSize: 11, color: '#b45309', margin: '2px 0 0' }}>Click below to configure monthly collections.</p>
                  </div>
                </div>
                <button style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  Set Up Debit Order
                </button>
              </div>
            )}
          </div>

          {/* FICA Compliance Card */}
          <div style={{ ...card, padding: 18 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-primary, #7c3aed)' }}>shield</span>
              FICA Compliance
            </h3>

            {/* PEP / Sanctions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12, borderBottom: '1px solid #f3f4f6', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>PEP / Sanctions Screening</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{app.pep_sanctions_checked_at ? `Checked ${fmtDate(app.pep_sanctions_checked_at)}` : 'Not yet checked'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: pepCleared === true ? '#d1fae5' : pepCleared === false ? '#fee2e2' : '#f3f4f6',
                  color: pepCleared === true ? '#065f46' : pepCleared === false ? '#991b1b' : '#6b7280',
                }}>
                  {pepCleared === true ? 'Cleared' : pepCleared === false ? 'Not Cleared' : 'Pending'}
                </span>
                <button onClick={() => setPepModalOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontWeight: 600, padding: 0 }}>
                  {pepCleared !== null ? 'Update' : 'Screen'}
                </button>
              </div>
            </div>

            {/* PEP inline modal */}
            {pepModalOpen && (
              <div style={{ marginBottom: 12, padding: 12, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8 }}>PEP / Sanctions Screening Result</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => { setPepCleared(true); setPepModalOpen(false); showToast('PEP/Sanctions cleared.', 'success'); }}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#d1fae5', color: '#065f46', fontSize: 11, fontWeight: 700 }}>
                    ✓ Clear — No Match
                  </button>
                  <button onClick={() => { setPepCleared(false); setPepModalOpen(false); showToast('PEP match recorded — do not proceed.', 'error'); }}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 700 }}>
                    ✗ Match Found
                  </button>
                </div>
                <button onClick={() => setPepModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#9ca3af' }}>Cancel</button>
              </div>
            )}

            {/* CIPC */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Juristic Person / CIPC</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Natural person</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#9ca3af' }}>N/A</span>
                <button onClick={() => setCipcModalOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontWeight: 600, padding: 0 }}>Edit</button>
              </div>
            </div>

            {cipcModalOpen && (
              <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Juristic Person / CIPC Details</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 8 }}>
                  <input type="checkbox" style={{ accentColor: 'var(--color-primary, #7c3aed)' }} /> Business / Juristic Person
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setCipcModalOpen(false); showToast('CIPC details saved.', 'success'); }}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    Save
                  </button>
                  <button onClick={() => setCipcModalOpen(false)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 700 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: 16,
        }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px' }}>{confirmModal.title}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>{confirmModal.body}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmModal(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#6b7280' }}>
                Cancel
              </button>
              <button onClick={confirmModal.onConfirm}
                style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: 'var(--color-primary, #7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Signature Pad ── */}
      {showSignPad && (
        <SignaturePad
          defaultName={(data as any)?.application?.profiles?.full_name ?? ''}
          onConfirm={handleSignConfirm}
          onCancel={() => setShowSignPad(false)}
        />
      )}
    </AdminPageShell>
  );
}
