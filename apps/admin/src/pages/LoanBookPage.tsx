import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchLoans } from '../services/adminData';
import { supabase } from '../api/supabaseClient';

// ── Status display (as required) ──────────────────────────────────────────────

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:      { label: 'Active',     color: '#10b981', bg: '#d1fae5' },
  SETTLED:     { label: 'Settled',    color: '#6b7280', bg: '#f3f4f6' },
  IN_ARREARS:  { label: 'In Arrears', color: '#ef4444', bg: '#fee2e2' },
  IN_DEFAULT:  { label: 'In Default', color: '#dc2626', bg: '#fee2e2' },
  CANCELLED:   { label: 'Cancelled',  color: '#6b7280', bg: '#f3f4f6' },
  DISBURSED:   { label: 'Disbursed',  color: '#10b981', bg: '#d1fae5' },
};

// ── Demo fallback data ────────────────────────────────────────────────────────

interface LoanRow {
  id: string;
  reference: string;
  client_name: string;
  identity_number: string;
  amount: number;
  outstanding: number;
  monthly_payment: number;
  total_repayable: number;
  status: string;
  days_active: number;
  days_overdue: number;
  days_to_maturity: number;
  disbursed_date: string;
  maturity_date: string;
  band: string;
  purpose: string;
  bank: string;
  account: string;
  interest_rate: number;
  term_months: number;
  branch_id: number | null;
}

interface CollectionNote {
  note_type: string;
  body: string;
  author: string;
  created_at: string;
}

const DEMO_LOANS: LoanRow[] = [
  { id: 'loan-001', reference: 'ALG-2025-0342', client_name: 'Sipho Dlamini',      identity_number: '8506015800083', amount: 15000, outstanding: 12420, monthly_payment: 1800, total_repayable: 18000, status: 'ACTIVE',     days_active: 374, days_overdue: 0,  days_to_maturity: 122, disbursed_date: '2025-07-20', maturity_date: '2026-07-20', band: 'B', purpose: 'Personal Loan',       bank: 'FNB',           account: '62345678901', interest_rate: 24, term_months: 12, branch_id: 1 },
  { id: 'loan-002', reference: 'ALG-2025-0287', client_name: 'Thandi Nkosi',        identity_number: '9201144800080', amount: 8500,  outstanding: 5100,  monthly_payment: 1200, total_repayable: 10800, status: 'IN_ARREARS', days_active: 280, days_overdue: 35, days_to_maturity: 85,  disbursed_date: '2025-04-28', maturity_date: '2026-04-28', band: 'C', purpose: 'Medical Expenses',    bank: 'Standard Bank', account: '27345678901', interest_rate: 30, term_months: 12, branch_id: 2 },
  { id: 'loan-003', reference: 'ALG-2025-0198', client_name: 'James Mokoena',       identity_number: '8812185800081', amount: 25000, outstanding: 22000, monthly_payment: 3100, total_repayable: 30000, status: 'IN_DEFAULT', days_active: 210, days_overdue: 92, days_to_maturity: 155, disbursed_date: '2025-01-18', maturity_date: '2026-01-18', band: 'D', purpose: 'Business',           bank: 'ABSA',          account: '40123456789', interest_rate: 36, term_months: 12, branch_id: 1 },
  { id: 'loan-004', reference: 'ALG-2024-0901', client_name: 'Nomsa Zulu',          identity_number: '0001014800085', amount: 12000, outstanding: 0,     monthly_payment: 1500, total_repayable: 14400, status: 'SETTLED',    days_active: 365, days_overdue: 0,  days_to_maturity: 0,   disbursed_date: '2024-07-10', maturity_date: '2025-07-10', band: 'A', purpose: 'Education',          bank: 'Nedbank',       account: '11223344556', interest_rate: 18, term_months: 12, branch_id: 2 },
  { id: 'loan-005', reference: 'ALG-2025-0421', client_name: 'Ayanda Sithole',      identity_number: '9503055800087', amount: 6000,  outstanding: 5500,  monthly_payment: 900,  total_repayable: 7200,  status: 'ACTIVE',     days_active: 22,  days_overdue: 0,  days_to_maturity: 338, disbursed_date: '2025-07-06', maturity_date: '2026-07-06', band: 'B', purpose: 'Home Improvement',   bank: 'Capitec',       account: '10987654321', interest_rate: 22, term_months: 12, branch_id: 3 },
  { id: 'loan-006', reference: 'ALG-2025-0356', client_name: 'Pieter van der Berg', identity_number: '7804125800082', amount: 50000, outstanding: 38000, monthly_payment: 5200, total_repayable: 60000, status: 'ACTIVE',     days_active: 180, days_overdue: 0,  days_to_maturity: 185, disbursed_date: '2025-01-28', maturity_date: '2026-01-28', band: 'A', purpose: 'Debt Consolidation', bank: 'FNB',           account: '62987654321', interest_rate: 20, term_months: 18, branch_id: 1 },
  { id: 'loan-007', reference: 'ALG-2025-0189', client_name: 'Lerato Dube',         identity_number: '9108234800084', amount: 3500,  outstanding: 1200,  monthly_payment: 750,  total_repayable: 4500,  status: 'IN_ARREARS', days_active: 310, days_overdue: 18, days_to_maturity: 55,  disbursed_date: '2024-09-25', maturity_date: '2025-09-25', band: 'C', purpose: 'Emergency',          bank: 'Standard Bank', account: '27456789012', interest_rate: 28, term_months: 6,  branch_id: 3 },
  { id: 'loan-008', reference: 'ALG-2024-0777', client_name: 'Zanele Mthembu',      identity_number: '8711085800086', amount: 18000, outstanding: 0,     monthly_payment: 2100, total_repayable: 21600, status: 'SETTLED',    days_active: 420, days_overdue: 0,  days_to_maturity: 0,   disbursed_date: '2024-05-01', maturity_date: '2025-05-01', band: 'A', purpose: 'Vehicle',            bank: 'ABSA',          account: '40234567890', interest_rate: 18, term_months: 12, branch_id: 2 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s?: string | null) =>
  s ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s)) : '—';

/** Map a raw DB loan row to LoanRow shape */
function mapDbLoan(l: any): LoanRow {
  const profile      = l.profiles ?? {};
  const disbursedAt  = l.disbursed_at ?? l.created_at ?? '';
  const disbDate     = disbursedAt ? disbursedAt.slice(0, 10) : '';
  const termMonths   = Number(l.term_months) || 12;
  let matDate = '';
  if (disbDate) {
    const d = new Date(disbDate);
    d.setMonth(d.getMonth() + termMonths);
    matDate = d.toISOString().slice(0, 10);
  }
  const now          = Date.now();
  const daysActive   = disbDate ? Math.floor((now - new Date(disbDate).getTime()) / 86_400_000) : 0;
  const daysToMat    = matDate ? Math.floor((new Date(matDate).getTime() - now) / 86_400_000) : 0;
  const st           = (l.status ?? '').toUpperCase();
  const daysOverdue  = (st === 'IN_ARREARS' || st === 'IN_DEFAULT') ? Math.max(0, -daysToMat) : 0;

  return {
    id:              l.id,
    reference:       l.loan_number ? `ALG-${String(l.loan_number).padStart(7, '0')}` : `ALG-${String(l.id).substring(0, 6).toUpperCase()}`,
    client_name:     profile.full_name ?? 'Unknown',
    identity_number: profile.identity_number ?? '',
    amount:          Number(l.principal_amount) || 0,
    outstanding:     Number(l.outstanding_balance ?? l.principal_amount) || 0,
    monthly_payment: Number(l.monthly_repayment ?? 0),
    total_repayable: Number(l.total_repayable ?? l.principal_amount) || 0,
    status:          st,
    days_active:     daysActive,
    days_overdue:    daysOverdue,
    days_to_maturity: daysToMat,
    disbursed_date:  disbDate,
    maturity_date:   matDate,
    band:            l.band ?? '',
    purpose:         l.loan_purpose ?? l.purpose ?? '—',
    bank:            l.bank ?? '',
    account:         l.account_number ?? '',
    interest_rate:   Number(l.interest_rate) || 0,
    term_months:     termMonths,
    branch_id:       l.branch_id ?? null,
  };
}

// ── Sort helper ───────────────────────────────────────────────────────────────

type SortKey = keyof LoanRow;

function sortLoans(loans: LoanRow[], key: SortKey, dir: 'asc' | 'desc'): LoanRow[] {
  return [...loans].sort((a, b) => {
    let av: any = a[key], bv: any = b[key];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(loans: LoanRow[]) {
  if (!loans.length) { alert('No data to export.'); return; }
  const headers = [
    'Reference', 'Client', 'ID Number', 'Amount', 'Monthly', 'Total Repayable',
    'Status', 'Band', 'Rate (%)', 'Term', 'Purpose',
    'Disbursed Date', 'Maturity Date',
    'Days Active', 'Days Overdue', 'Days to Maturity',
    'Bank', 'Account Number',
  ];
  const rows = loans.map(l => [
    l.reference,
    `"${l.client_name.replace(/"/g, '""')}"`,
    l.identity_number,
    l.amount,
    l.monthly_payment,
    l.total_repayable,
    l.status,
    l.band,
    l.interest_rate,
    l.term_months,
    `"${l.purpose.replace(/"/g, '""')}"`,
    l.disbursed_date,
    l.maturity_date,
    l.days_active,
    l.days_overdue,
    l.days_to_maturity,
    `"${l.bank.replace(/"/g, '""')}"`,
    l.account,
  ].join(','));
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `algolend_loan_book_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Collection Notes Panel ────────────────────────────────────────────────────

const NOTE_TYPE_ICONS: Record<string, string> = {
  note:            'edit_note',
  call:            'call',
  sms:             'sms',
  email:           'email',
  promise_to_pay:  'handshake',
  legal:           'gavel',
};

function NotesPanel({
  loanId, clientName, onClose,
}: {
  loanId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [notes,    setNotes]    = useState<CollectionNote[]>([]);
  const [noteType, setNoteType] = useState('note');
  const [noteBody, setNoteBody] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Load notes on mount
  useState(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin/collections/notes/${loanId}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotes(data ?? []);
        }
      } catch {/* ignore */}
      setLoading(false);
    })();
  });

  async function addNote() {
    if (!noteBody.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/collections/notes/${loanId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ note_type: noteType, body: noteBody.trim() }),
      });
      if (res.ok) {
        const added: CollectionNote = { note_type: noteType, body: noteBody.trim(), author: 'Admin', created_at: new Date().toISOString() };
        setNotes(n => [added, ...n]);
        setNoteBody('');
      } else {
        alert('Failed to save note.');
      }
    } catch {
      alert('Error saving note.');
    }
    setSaving(false);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Notes — {clientName}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Loading…</p>
          ) : notes.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>No notes yet.</p>
          ) : notes.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0, marginTop: 1 }}>
                {NOTE_TYPE_ICONS[n.note_type] ?? 'edit_note'}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: '#111827' }}>{n.body}</span>
                <span style={{ color: '#94a3b8', marginLeft: 6 }}>· {n.author} · {new Date(n.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={noteType} onChange={e => setNoteType(e.target.value)}
            style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', outline: 'none', fontFamily: 'inherit', background: '#fff' }}>
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="promise_to_pay">Promise to Pay</option>
            <option value="legal">Legal</option>
          </select>
          <input
            type="text"
            placeholder="Add note…"
            value={noteBody}
            onChange={e => setNoteBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
            style={{ flex: 1, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={addNote} disabled={saving}
            style={{ padding: '6px 14px', background: '#6D28D9', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sortable Column Header ────────────────────────────────────────────────────

function SortTh({
  label, sortKey, currentKey, currentDir, onSort, align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ padding: '12px 14px', textAlign: align, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', color: active ? '#6D28D9' : '#94a3b8', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', transition: 'color 0.12s' }}
    >
      {label}{' '}
      <span style={{ color: active ? '#6D28D9' : '#d1d5db' }}>
        {active ? (currentDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LoanBookPage() {
  const navigate = useNavigate();

  // ── Filter state ───────────────────────────────────────────────────────────
  const [activeStatus,  setActiveStatus]  = useState('all');
  const [activeBranch,  setActiveBranch]  = useState('all');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [sortKey,       setSortKey]       = useState<SortKey>('disbursed_date');
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc');

  // ── Collections mode ───────────────────────────────────────────────────────
  const [collectionsMode, setCollectionsMode] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [bulkSending,     setBulkSending]     = useState(false);

  // ── Notes panel ────────────────────────────────────────────────────────────
  const [notesLoanId,    setNotesLoanId]    = useState<string | null>(null);
  const [notesClientName,setNotesClientName]= useState('');

  // ── Aging filter (clicks on aging bucket) ─────────────────────────────────
  const [agingMaxDays, setAgingMaxDays] = useState<number | null>(null);
  const [agingMinDays, setAgingMinDays] = useState<number | null>(null);

  // ── Data ───────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['admin-loan-book'],
    queryFn: async () => {
      try {
        const result = await fetchLoans();
        if (result.data && result.data.length > 0) {
          return result.data.map(mapDbLoan);
        }
      } catch {/* fall through */}
      return DEMO_LOANS;
    },
    staleTime: 60_000,
  });

  const allLoans: LoanRow[] = data ?? [];

  // ── Derived: unique branches ───────────────────────────────────────────────
  const branches = useMemo(() => {
    const seen = new Set<number>();
    const res: { id: number; name: string }[] = [];
    // We don't have branch names from the loan row, but branch_id is there
    allLoans.forEach(l => { if (l.branch_id != null && !seen.has(l.branch_id)) { seen.add(l.branch_id); res.push({ id: l.branch_id, name: `Branch ${l.branch_id}` }); } });
    return res;
  }, [allLoans]);

  // ── Filter + sort ──────────────────────────────────────────────────────────

  const filteredLoans = useMemo(() => {
    let result = allLoans.filter(l => {
      const matchStatus = activeStatus === 'all' || l.status === activeStatus;
      const s = searchTerm.toLowerCase();
      const matchSearch = !s ||
        l.client_name.toLowerCase().includes(s) ||
        l.reference.toLowerCase().includes(s) ||
        l.identity_number.includes(s);
      const matchFrom   = !dateFrom || l.disbursed_date >= dateFrom;
      const matchTo     = !dateTo   || l.disbursed_date <= dateTo;
      const matchBranch = activeBranch === 'all' || String(l.branch_id) === activeBranch;
      let matchAging    = true;
      if (agingMaxDays !== null) {
        matchAging = (l.status === 'IN_ARREARS' || l.status === 'IN_DEFAULT') &&
          l.days_overdue <= agingMaxDays &&
          (agingMinDays === null || l.days_overdue > agingMinDays);
      }
      return matchStatus && matchSearch && matchFrom && matchTo && matchBranch && matchAging;
    });
    return sortLoans(result, sortKey, sortDir);
  }, [allLoans, activeStatus, searchTerm, dateFrom, dateTo, activeBranch, sortKey, sortDir, agingMaxDays, agingMinDays]);

  // ── Summary stats ──────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const total     = filteredLoans.length;
    const totalBook = filteredLoans.reduce((s, l) => s + l.amount, 0);
    const inArrears = filteredLoans.filter(l => l.status === 'IN_ARREARS').length;
    const inDefault = filteredLoans.filter(l => l.status === 'IN_DEFAULT').length;
    const nplRatio  = total > 0 ? (((inArrears + inDefault) / total) * 100).toFixed(1) : '0.0';
    return { total, totalBook, inArrears, inDefault, nplRatio };
  }, [filteredLoans]);

  // ── Aging buckets (only if NPL loans exist) ────────────────────────────────

  const aging = useMemo(() => {
    const npl = allLoans.filter(l => l.status === 'IN_ARREARS' || l.status === 'IN_DEFAULT');
    return {
      d1_30:   npl.filter(l => l.days_overdue >= 1  && l.days_overdue <= 30).length,
      d31_60:  npl.filter(l => l.days_overdue >= 31 && l.days_overdue <= 60).length,
      d61_90:  npl.filter(l => l.days_overdue >= 61 && l.days_overdue <= 90).length,
      d90plus: npl.filter(l => l.days_overdue > 90).length,
      total:   npl.length,
    };
  }, [allLoans]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
      setSortDir(key === 'client_name' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  function setStatus(val: string) {
    setActiveStatus(val);
    setAgingMaxDays(null);
    setAgingMinDays(null);
  }

  function filterAging(minDays: number, maxDays: number) {
    setActiveStatus('IN_ARREARS');
    setAgingMinDays(minDays);
    setAgingMaxDays(maxDays);
  }

  function clearAgingFilter() {
    setAgingMaxDays(null);
    setAgingMinDays(null);
  }

  function toggleCollections() {
    setCollectionsMode(prev => {
      const next = !prev;
      setSelectedIds(new Set());
      if (next) setActiveStatus('IN_ARREARS');
      return next;
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredLoans.map(l => l.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(filteredLoans.map(l => l.id)) : new Set());
  }

  async function sendReminder(loanId: string, clientName: string) {
    if (!confirm(`Send SMS payment reminder to ${clientName}?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/notifications/status-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ applicationId: loanId, newStatus: 'IN_ARREARS' }),
      });
      const json = await res.json();
      if (json.sent) alert(`Reminder sent to ${clientName}.`);
      else alert(`Could not send: ${json.reason ?? 'Unknown error'}`);
    } catch (e: any) {
      alert('SMS failed: ' + e.message);
    }
  }

  async function bulkSMS() {
    if (!selectedIds.size) return;
    const ids = [...selectedIds];
    if (!confirm(`Send SMS payment reminder to ${ids.length} borrower${ids.length > 1 ? 's' : ''}?`)) return;
    setBulkSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/collections/bulk-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ applicationIds: ids }),
      });
      const json = await res.json();
      alert(`SMS sent to ${json.sent ?? ids.length} borrower${(json.sent ?? ids.length) !== 1 ? 's' : ''}${json.failed ? ` (${json.failed} failed — no phone)` : ''}.`);
      clearSelection();
    } catch (err: any) {
      alert('Bulk SMS failed: ' + err.message);
    }
    setBulkSending(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasNpl = aging.total > 0;
  const hasSelection = selectedIds.size > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.3s ease' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Loan Book</h1>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Full portfolio — tracking days, arrears, maturity dates
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Branch */}
            <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)}
              style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', background: '#fff', fontFamily: 'inherit', outline: 'none', fontWeight: 600 }}>
              <option value="all">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            {/* Status */}
            <select value={activeStatus} onChange={e => setStatus(e.target.value)}
              style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', background: '#fff', fontFamily: 'inherit', outline: 'none', fontWeight: 600 }}>
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISBURSED">Disbursed</option>
              <option value="READY_TO_DISBURSE">Approved</option>
              <option value="IN_ARREARS">In Arrears</option>
              <option value="IN_DEFAULT">In Default</option>
              <option value="SETTLED">Settled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Date from */}
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Disbursed from"
              style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', background: '#fff', fontFamily: 'inherit', outline: 'none', fontWeight: 500, color: '#374151' }} />

            {/* Date to */}
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Disbursed to"
              style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', background: '#fff', fontFamily: 'inherit', outline: 'none', fontWeight: 500, color: '#374151' }} />

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: '#94a3b8', pointerEvents: 'none' }}>search</span>
              <input type="text" placeholder="Search client, reference…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px 8px 34px', background: '#fff', fontFamily: 'inherit', outline: 'none', width: 220 }} />
            </div>

            {/* Export */}
            <button onClick={() => exportCSV(filteredLoans)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s' }}
              onMouseOver={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseOut={e  => (e.currentTarget.style.background = '#fff')}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              Export
            </button>

            {/* Collections mode */}
            <button onClick={toggleCollections}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: collectionsMode ? '1px solid #6D28D9' : '1px solid #e5e7eb', background: collectionsMode ? '#6D28D9' : '#fff', color: collectionsMode ? '#fff' : '#374151', fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>checklist</span>
              Collections
            </button>
          </div>
        </div>

        {/* Aging filter active indicator */}
        {agingMaxDays !== null && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', padding: '4px 10px', background: '#fee2e2', borderRadius: 8 }}>
              Filtering: {agingMinDays ?? 0}–{agingMaxDays === 999 ? '90+' : agingMaxDays} days overdue
            </span>
            <button onClick={clearAgingFilter} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              Clear ×
            </button>
          </div>
        )}
      </div>

      {/* ── Bulk action bar (collections) ── */}
      {collectionsMode && hasSelection && (
        <div style={{ padding: '10px 16px', background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#6D28D9' }}>{selectedIds.size} selected</span>
          <div style={{ flex: 1 }} />
          <button onClick={bulkSMS} disabled={bulkSending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#6D28D9', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 10, cursor: bulkSending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: bulkSending ? 0.7 : 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sms</span>
            {bulkSending ? 'Sending…' : 'Bulk SMS Reminder'}
          </button>
          <button onClick={selectAll}  style={{ fontSize: 12, fontWeight: 600, color: '#6D28D9', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Select All</button>
          <button onClick={clearSelection} style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
        </div>
      )}

      {/* ── Notes panel ── */}
      {notesLoanId && (
        <NotesPanel loanId={notesLoanId} clientName={notesClientName} onClose={() => { setNotesLoanId(null); setNotesClientName(''); }} />
      )}

      {/* ── KPI Summary cards ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Loans',     value: isLoading ? '—' : summary.total,               icon: 'receipt_long',  color: '#6D28D9' },
          { label: 'Loan Book Value', value: isLoading ? '—' : fmtCurrency(summary.totalBook), icon: 'payments',     color: '#10b981' },
          { label: 'In Arrears',      value: isLoading ? '—' : summary.inArrears,            icon: 'warning',       color: '#f59e0b' },
          { label: 'In Default',      value: isLoading ? '—' : summary.inDefault,            icon: 'error',         color: '#ef4444' },
          { label: 'NPL Ratio',       value: isLoading ? '—' : summary.nplRatio + '%',       icon: 'trending_down', color: '#8b5cf6' },
        ].map((c, i) => (
          <div key={c.label} className={`dash-kpi-card animate-fade-in-up delay-${i * 100 + 100}`}>
            <div className="dash-kpi-corner" />
            <div>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: c.color }}>{c.icon}</span>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 4 }}>{c.label}</p>
              <h3 style={{ fontSize: '1.7rem', fontWeight: 900, color: c.color, lineHeight: 1, letterSpacing: '-0.02em', margin: 0 }}>{c.value}</h3>
            </div>
          </div>
        ))}
      </section>

      {/* ── Aging buckets strip (only when NPL loans exist) ── */}
      {hasNpl && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: '1–30 days',  min: 1,  max: 30,  value: aging.d1_30,   color: '#f59e0b', bg: '#fef3c7' },
            { label: '31–60 days', min: 31, max: 60,  value: aging.d31_60,  color: '#f97316', bg: '#ffedd5' },
            { label: '61–90 days', min: 61, max: 90,  value: aging.d61_90,  color: '#ef4444', bg: '#fee2e2' },
            { label: '90+ days',   min: 91, max: 999, value: aging.d90plus, color: '#7f1d1d', bg: '#fecaca' },
          ].map(a => (
            <div
              key={a.label}
              onClick={() => filterAging(a.min, a.max)}
              style={{ background: '#fff', borderRadius: 14, border: agingMinDays === a.min ? `2px solid ${a.color}` : '1px solid #f1f5f9', padding: 14, textAlign: 'center', cursor: 'pointer', transition: 'border 0.12s, box-shadow 0.12s', boxShadow: agingMinDays === a.min ? `0 0 0 3px ${a.bg}` : '0 1px 3px rgba(0,0,0,0.04)' }}
              title={`Filter to ${a.label} overdue`}
            >
              <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', margin: '0 0 4px' }}>{a.label}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: a.color, margin: 0 }}>{a.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />Loading loan book…
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1300 }}>
              <thead>
                <tr>
                  {/* Checkbox column (collections mode only) */}
                  {collectionsMode && (
                    <th style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', width: 36 }}>
                      <input type="checkbox"
                        checked={filteredLoans.length > 0 && filteredLoans.every(l => selectedIds.has(l.id))}
                        onChange={e => toggleAll(e.target.checked)}
                        style={{ width: 14, height: 14, accentColor: '#6D28D9' }} />
                    </th>
                  )}
                  <SortTh label="Reference"    sortKey="reference"       currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortTh label="Client"       sortKey="client_name"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortTh label="Principal"    sortKey="amount"          currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Outstanding"  sortKey="outstanding"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Monthly"      sortKey="monthly_payment" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Status"       sortKey="status"          currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortTh label="Days Active"  sortKey="days_active"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Days Overdue" sortKey="days_overdue"    currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Maturity In"  sortKey="days_to_maturity"currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Disbursed"    sortKey="disbursed_date"  currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortTh label="Maturity Date"sortKey="maturity_date"   currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortTh label="Band"         sortKey="band"            currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortTh label="Purpose"      sortKey="purpose"         currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={collectionsMode ? 15 : 14} style={{ padding: '48px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                      No loans match your filters.
                    </td>
                  </tr>
                ) : filteredLoans.map(l => {
                  const st          = STATUS_DISPLAY[l.status] ?? { label: l.status, color: '#6b7280', bg: '#f3f4f6' };
                  const isDefault   = l.status === 'IN_DEFAULT';
                  const isArrears   = l.status === 'IN_ARREARS';
                  const isRisky     = isDefault || isArrears;
                  const rowBg       = isDefault ? 'rgba(220,38,38,0.025)' : isArrears ? 'rgba(245,158,11,0.025)' : 'transparent';
                  const isChecked   = selectedIds.has(l.id);
                  const daysOverdueCell = l.days_overdue > 0
                    ? <span style={{ fontWeight: 700, color: isDefault ? '#dc2626' : '#d97706' }}>{l.days_overdue}d</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>;
                  const daysMatCell = l.days_to_maturity < 0
                    ? <span style={{ fontWeight: 700, color: '#ef4444' }}>{Math.abs(l.days_to_maturity)}d late</span>
                    : <span style={{ color: l.days_to_maturity < 30 ? '#f97316' : '#374151', fontWeight: l.days_to_maturity < 30 ? 700 : 400 }}>{l.days_to_maturity}d</span>;

                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: rowBg, transition: 'background 0.1s' }}
                      onMouseOver={e => { if (!isRisky) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                      onMouseOut={e  => { (e.currentTarget as HTMLElement).style.background = rowBg; }}>

                      {/* Checkbox (collections) */}
                      {collectionsMode && (
                        <td style={{ padding: '10px 14px' }}>
                          <input type="checkbox" checked={isChecked} onChange={e => toggleRow(l.id, e.target.checked)}
                            style={{ width: 14, height: 14, accentColor: '#6D28D9' }} />
                        </td>
                      )}

                      {/* Reference */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#6D28D9' }}>{l.reference}</span>
                      </td>

                      {/* Client */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{l.client_name}</div>
                        {l.identity_number && <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>{l.identity_number}</div>}
                      </td>

                      {/* Principal */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#111827' }}>
                        {fmtCurrency(l.amount)}
                      </td>

                      {/* Outstanding */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: l.outstanding > 0 ? (isRisky ? '#dc2626' : '#6D28D9') : '#10b981' }}>
                        {fmtCurrency(l.outstanding)}
                      </td>

                      {/* Monthly */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: '#374151' }}>
                        {fmtCurrency(l.monthly_payment)}
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                          {st.label}
                        </span>
                      </td>

                      {/* Days active */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: '#374151' }}>
                        {l.days_active > 0 ? `${l.days_active}d` : '—'}
                      </td>

                      {/* Days overdue */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>{daysOverdueCell}</td>

                      {/* Maturity in */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>{l.maturity_date ? daysMatCell : <span style={{ color: '#d1d5db' }}>—</span>}</td>

                      {/* Disbursed */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {l.disbursed_date || '—'}
                      </td>

                      {/* Maturity date */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {l.maturity_date || '—'}
                      </td>

                      {/* Band */}
                      <td style={{ padding: '12px 14px' }}>
                        {l.band
                          ? <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#475569' }}>{l.band}</span>
                          : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>

                      {/* Purpose */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b' }}>
                        {l.purpose}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          {isRisky && (
                            <>
                              <button
                                onClick={() => sendReminder(l.id, l.client_name)}
                                title="Send SMS reminder"
                                style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#d97706', transition: 'background 0.1s' }}
                                onMouseOver={e => (e.currentTarget.style.background = '#fef3c7')}
                                onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sms</span>
                              </button>
                              <button
                                onClick={() => { setNotesLoanId(l.id); setNotesClientName(l.client_name); }}
                                title="Collection notes"
                                style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: notesLoanId === l.id ? '#dbeafe' : 'transparent', cursor: 'pointer', color: '#3b82f6', transition: 'background 0.1s' }}
                                onMouseOver={e => (e.currentTarget.style.background = '#dbeafe')}
                                onMouseOut={e  => (e.currentTarget.style.background = notesLoanId === l.id ? '#dbeafe' : 'transparent')}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/applications/${l.id}`)}
                            title="View loan detail"
                            style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', transition: 'background 0.1s, color 0.1s' }}
                            onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = '#ede9fe'; (e.currentTarget as HTMLElement).style.color = '#6D28D9'; }}
                            onMouseOut={e  => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Footer count */}
      {!isLoading && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
            Showing {filteredLoans.length} loan{filteredLoans.length !== 1 ? 's' : ''}
          </span>
          {(dateFrom || dateTo || searchTerm || activeStatus !== 'all' || agingMaxDays !== null) && (
            <button
              onClick={() => { setActiveStatus('all'); setSearchTerm(''); setDateFrom(''); setDateTo(''); clearAgingFilter(); setActiveBranch('all'); }}
              style={{ fontSize: 12, fontWeight: 600, color: '#6D28D9', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
