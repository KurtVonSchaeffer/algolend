import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCashLedger, createCashLedgerEntry } from '../services/adminData';
import { AdminStatCard } from '../components/ui/AdminPage';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';

// ── Constants ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_START = TODAY.slice(0, 8) + '01';

const ENTRY_TYPES = [
  { value: 'credit',          label: 'Cash In'          },
  { value: 'debit',           label: 'Cash Out'         },
  { value: 'opening_balance', label: 'Opening Balance'  },
  { value: 'closing_balance', label: 'Closing Balance'  },
] as const;

const CATEGORIES = [
  { value: 'loan_disbursement', label: 'Loan Disbursement'   },
  { value: 'loan_repayment',    label: 'Repayment Received'  },
  { value: 'petty_cash',        label: 'Petty Cash'          },
  { value: 'expense',           label: 'Expense'             },
  { value: 'bank_deposit',      label: 'Bank Deposit'        },
  { value: 'bank_withdrawal',   label: 'Bank Withdrawal'     },
  { value: 'transfer',          label: 'Transfer'            },
  { value: 'other',             label: 'Other'               },
] as const;

type TypeFilter = 'ALL' | 'income' | 'expense' | 'transfer';
const TYPE_FILTER_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'ALL',      label: 'All'      },
  { key: 'income',   label: 'Income'   },
  { key: 'expense',  label: 'Expense'  },
  { key: 'transfer', label: 'Transfer' },
];

const MOCK_BRANCHES = [
  { id: '1', name: 'Head Office' },
  { id: '2', name: 'Sandton' },
  { id: '3', name: 'Johannesburg' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

function isInflow(entry: any): boolean {
  return entry.type === 'credit' || entry.type === 'opening_balance';
}

function isOutflow(entry: any): boolean {
  return entry.type === 'debit' || entry.type === 'closing_balance';
}

function matchesTypeFilter(entry: any, filter: TypeFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'income')   return isInflow(entry);
  if (filter === 'expense')  return isOutflow(entry) && entry.category !== 'transfer';
  if (filter === 'transfer') return entry.category === 'transfer';
  return true;
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportLedger(entries: any[], dateFrom: string, dateTo: string) {
  if (!entries.length) { alert('No entries to export.'); return; }
  const headers = ['Date', 'Type', 'Category', 'Description', 'Reference', 'Amount', 'Cash In', 'Cash Out', 'Created By'];
  const rows = entries.map((e: any) => {
    const isIn  = isInflow(e);
    const isOut = isOutflow(e);
    const amt   = Math.abs(Number(e.amount) || 0);
    return [
      (e.transaction_date ?? e.created_at ?? '').slice(0, 10),
      e.type,
      e.category || '',
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.reference || '',
      amt,
      isIn  ? amt : 0,
      isOut ? amt : 0,
      e.created_by_name || '',
    ].join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cash_ledger_${dateFrom}_to_${dateTo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Type label chip ───────────────────────────────────────────────────────────

const TYPE_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  credit:          { label: 'Cash In',        color: '#059669', bg: 'rgba(5,150,105,0.12)'  },
  debit:           { label: 'Cash Out',        color: '#DC2626', bg: 'rgba(220,38,38,0.12)'  },
  opening_balance: { label: 'Opening Balance', color: '#2563EB', bg: 'rgba(37,99,235,0.12)'  },
  closing_balance: { label: 'Closing Balance', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
};

function EntryTypeBadge({ type }: { type: string }) {
  const d = TYPE_DISPLAY[type] ?? { label: type.replace(/_/g, ' '), color: '#64748B', bg: 'rgba(100,116,139,0.12)' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 11,
      fontWeight: 700, color: d.color, background: d.bg,
      whiteSpace: 'nowrap',
    }}>
      {d.label}
    </span>
  );
}

// ── Add Entry Modal ───────────────────────────────────────────────────────────

interface AddEntryModalProps {
  onClose: () => void;
  onSave: (entry: Record<string, unknown>) => void;
  isPending: boolean;
  error?: string | null;
}

function AddEntryModal({ onClose, onSave, isPending, error }: AddEntryModalProps) {
  const [form, setForm] = useState({
    transaction_date: TODAY,
    type: 'credit',
    category: 'other',
    amount: '',
    description: '',
    reference: '',
  });

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ ...form, amount: Number(form.amount) });
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>New Journal Entry</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Entries cannot be deleted once saved.
            </p>
          </div>
          <button className="admin-icon-btn" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input className="admin-input" type="date" required value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Type *</label>
              <select className="admin-select" required value={form.type} onChange={e => set('type', e.target.value)}>
                {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select className="admin-select" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount (R) *</label>
              <input
                className="admin-input"
                type="number" min="0.01" step="0.01" required
                placeholder="0.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description *</label>
              <input
                className="admin-input"
                type="text" required
                placeholder="e.g. Cash received from client"
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Reference</label>
              <input
                className="admin-input"
                type="text"
                placeholder="e.g. receipt #001, loan ref"
                value={form.reference}
                onChange={e => set('reference', e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--color-text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 5,
};

// ── Main Component ────────────────────────────────────────────────────────────

export function CashLedgerPage() {
  const qc = useQueryClient();

  const [typeFilter,    setTypeFilter]    = useState<TypeFilter>('ALL');
  const [dateFrom,      setDateFrom]      = useState(MONTH_START);
  const [dateTo,        setDateTo]        = useState(TODAY);
  const [activeBranch,  setActiveBranch]  = useState('all');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [mutError,      setMutError]      = useState<string | null>(null);
  const [syncing,       setSyncing]       = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-cash-ledger'],
    queryFn: fetchCashLedger,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (entry: Record<string, unknown>) => createCashLedgerEntry(entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cash-ledger'] });
      setShowModal(false);
      setMutError(null);
    },
    onError: (err: any) => {
      setMutError(err?.message ?? 'Failed to save entry');
    },
  });

  const allEntries: any[] = data?.data ?? [];

  // ── Period quick-select ────────────────────────────────────────────────────

  function setPeriod(period: string) {
    const t = new Date();
    const f = new Date();
    if (period === 'Today') {
      const d = t.toISOString().slice(0, 10);
      setDateFrom(d); setDateTo(d);
    } else if (period === 'Week') {
      f.setDate(t.getDate() - 6);
      setDateFrom(f.toISOString().slice(0, 10));
      setDateTo(t.toISOString().slice(0, 10));
    } else if (period === 'Month') {
      setDateFrom(t.toISOString().slice(0, 8) + '01');
      setDateTo(t.toISOString().slice(0, 10));
    } else if (period === 'All') {
      setDateFrom('2020-01-01');
      setDateTo(t.toISOString().slice(0, 10));
    }
  }

  // ── Sync from disbursements/repayments ────────────────────────────────────

  async function syncLedger() {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/ledger/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Sync failed');
      alert(json.message || 'Sync complete.');
      qc.invalidateQueries({ queryKey: ['admin-cash-ledger'] });
    } catch (err: any) {
      alert('Sync: ' + (err.message || 'Failed. Check server logs.'));
    } finally {
      setSyncing(false);
    }
  }

  // ── Stats (from date-range entries) ───────────────────────────────────────

  const stats = useMemo(() => {
    const inRange = allEntries.filter(e => {
      const d = (e.transaction_date ?? e.created_at ?? '').slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
    const cashIn     = inRange.filter(isInflow).reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
    const cashOut    = inRange.filter(isOutflow).reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
    const net        = cashIn - cashOut;
    const disbursed  = inRange.filter(e => e.category === 'loan_disbursement').reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
    const repaid     = inRange.filter(e => e.category === 'loan_repayment').reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
    const entryCount = inRange.length;
    return { cashIn, cashOut, net, disbursed, repaid, entryCount };
  }, [allEntries, dateFrom, dateTo]);

  // ── Filtered entries for table display ────────────────────────────────────

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      const d = (e.transaction_date ?? e.created_at ?? '').slice(0, 10);
      const inRange     = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
      const matchBranch = activeBranch === 'all' || String(e.branch_id) === activeBranch;
      const matchType   = matchesTypeFilter(e, typeFilter);
      const matchSearch = !searchTerm ||
        (e.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
      return inRange && matchBranch && matchType && matchSearch;
    });
  }, [allEntries, typeFilter, dateFrom, dateTo, activeBranch, searchTerm]);

  // ── Running balance over filtered entries (oldest → newest) ───────────────

  const filteredWithBalance = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const da = new Date(a.transaction_date ?? a.created_at ?? '1970').getTime();
      const db = new Date(b.transaction_date ?? b.created_at ?? '1970').getTime();
      return da - db;
    });
    let balance = 0;
    const result = sorted.map(e => {
      const amt = Math.abs(Number(e.amount) || 0);
      if (isInflow(e))  balance += amt;
      if (isOutflow(e)) balance -= amt;
      return { ...e, runningBalance: balance };
    });
    return result.reverse(); // newest first for display
  }, [filtered]);

  const rangeLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`;

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Cash Ledger</h1>
          <p className="page-subtitle">Daily cash flow journal — entries cannot be deleted once saved</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          {/* Branch */}
          <select
            value={activeBranch}
            onChange={e => setActiveBranch(e.target.value)}
            style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', background: '#fff', fontFamily: 'inherit', outline: 'none', fontWeight: 600, color: '#374151' }}
          >
            <option value="all">All Branches</option>
            {MOCK_BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {/* Date range */}
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', background: '#fff', fontFamily: 'inherit', outline: 'none', color: '#374151', fontWeight: 500 }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 700 }}>to</span>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', background: '#fff', fontFamily: 'inherit', outline: 'none', color: '#374151', fontWeight: 500 }}
          />

          {/* Period quick buttons */}
          <div style={{ display: 'flex', gap: 3 }}>
            {['Today', 'Week', 'Month', 'All'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{ fontSize: 11, fontWeight: 700, padding: '7px 11px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#374151', transition: 'all 0.12s' }}
                onMouseOver={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseOut={e  => (e.currentTarget.style.background = '#fff')}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Sync from Data */}
          <button
            onClick={syncLedger}
            disabled={syncing}
            title="Auto-populate from loan disbursements and confirmed repayments"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 12, border: '1px solid #99f6e4', background: '#f0fdfa', color: '#0f766e', cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: syncing ? 0.7 : 1, transition: 'all 0.12s' }}
            onMouseOver={e => { if (!syncing) (e.currentTarget as HTMLElement).style.background = '#ccfbf1'; }}
            onMouseOut={e  => (e.currentTarget as HTMLElement).style.background = '#f0fdfa'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync</span>
            {syncing ? 'Syncing…' : 'Sync from Data'}
          </button>

          {/* Export */}
          <button
            onClick={() => exportLedger(filteredWithBalance, dateFrom, dateTo)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s' }}
            onMouseOver={e => (e.currentTarget.style.background = '#f8fafc')}
            onMouseOut={e  => (e.currentTarget.style.background = '#fff')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
            Export
          </button>

          {/* Add Entry */}
          <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => { setMutError(null); setShowModal(true); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add Entry
          </button>
        </div>
      </div>

      {/* ── 6 Stats cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
        <AdminStatCard
          label={`Cash In (${rangeLabel})`}
          value={isLoading ? '—' : fmt(stats.cashIn)}
          icon="arrow_downward"
          tone="success"
        />
        <AdminStatCard
          label={`Cash Out (${rangeLabel})`}
          value={isLoading ? '—' : fmt(stats.cashOut)}
          icon="arrow_upward"
          tone="danger"
        />
        <AdminStatCard
          label="Net Position"
          value={isLoading ? '—' : fmt(stats.net)}
          icon="balance"
          tone={stats.net >= 0 ? 'success' : 'danger'}
        />
        <AdminStatCard
          label="Loans Disbursed"
          value={isLoading ? '—' : fmt(stats.disbursed)}
          icon="payments"
          tone="warning"
        />
        <AdminStatCard
          label="Repayments Collected"
          value={isLoading ? '—' : fmt(stats.repaid)}
          icon="savings"
          tone="info"
        />
        <AdminStatCard
          label="Entries"
          value={isLoading ? '—' : String(stats.entryCount)}
          icon="receipt_long"
          tone="default"
        />
      </div>

      {/* ── Type Tabs + Search ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 14, padding: 4 }}>
          {TYPE_FILTER_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTypeFilter(t.key)}
              style={{
                padding: '6px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                background: typeFilter === t.key ? '#fff' : 'transparent',
                color: typeFilter === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: typeFilter === t.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: '#94a3b8', pointerEvents: 'none' }}>search</span>
          <input
            type="text"
            placeholder="Search description, reference…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px 8px 34px', background: '#fff', fontFamily: 'inherit', outline: 'none', width: 240 }}
          />
        </div>

        <span style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {filteredWithBalance.length} entr{filteredWithBalance.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <SkeletonLoader type="table" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Category</th>
                <th>Reference</th>
                <th style={{ textAlign: 'right' }}>Cash In</th>
                <th style={{ textAlign: 'right' }}>Cash Out</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {filteredWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <span className="material-symbols-outlined">receipt_long</span>
                      <p>No ledger entries for this period</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12 }}
                          onClick={syncLedger}
                        >
                          Sync from disbursements/repayments
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 12 }}
                          onClick={() => { setMutError(null); setShowModal(true); }}
                        >
                          Add manually
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredWithBalance.map((e: any) => {
                const amt      = Math.abs(Number(e.amount) || 0);
                const inflow   = isInflow(e);
                const outflow  = isOutflow(e);
                const cashIn   = inflow  ? amt : 0;
                const cashOut  = outflow ? amt : 0;
                const balance  = e.runningBalance ?? 0;
                const dateStr  = fmtDate(e.transaction_date ?? e.created_at);
                const cat      = (e.category ?? '—').replace(/_/g, ' ');

                return (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      {dateStr}
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description ?? '—'}
                      </div>
                    </td>
                    <td>
                      <EntryTypeBadge type={e.type ?? 'credit'} />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                      {cat}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                      {e.reference || '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: cashIn > 0 ? 700 : 400, color: cashIn > 0 ? '#059669' : 'var(--color-text-muted)' }}>
                      {cashIn > 0 ? `+${fmt(cashIn)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: cashOut > 0 ? 700 : 400, color: cashOut > 0 ? '#DC2626' : 'var(--color-text-muted)' }}>
                      {cashOut > 0 ? `-${fmt(cashOut)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: balance >= 0 ? '#059669' : '#DC2626', whiteSpace: 'nowrap' }}>
                      {fmt(balance)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {e.created_by_name ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Entry Modal ── */}
      {showModal && (
        <AddEntryModal
          onClose={() => setShowModal(false)}
          onSave={entry => createMut.mutate(entry)}
          isPending={createMut.isPending}
          error={mutError}
        />
      )}
    </>
  );
}
