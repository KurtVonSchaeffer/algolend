import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPayouts } from '../services/adminData';
import { supabase } from '../api/supabaseClient';

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (v: string | null | undefined) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:    { label: 'Pending',    color: '#f59e0b', bg: '#fef3c7' },
  CONFIRMED:  { label: 'Confirmed',  color: '#10b981', bg: '#d1fae5' },
  REJECTED:   { label: 'Rejected',   color: '#ef4444', bg: '#fee2e2' },
  PROCESSING: { label: 'Processing', color: '#3b82f6', bg: '#dbeafe' },
  FAILED:     { label: 'Failed',     color: '#ef4444', bg: '#fee2e2' },
  COMPLETED:  { label: 'Completed',  color: '#10b981', bg: '#d1fae5' },
};

type PayoutTab = 'pending' | 'history' | 'comparison';
type PayMethod = 'bank_transfer' | 'cashsend' | 'third_party' | 'cash';

const METHOD_META: Record<PayMethod, { label: string; icon: string; bg: string; color: string; border: string }> = {
  bank_transfer: { label: 'Bank Transfer', icon: 'account_balance', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  cashsend:      { label: 'CashSend',      icon: 'smartphone',      bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  third_party:   { label: 'Third Party',   icon: 'swap_horiz',      bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  cash:          { label: 'Cash',          icon: 'payments',         bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
};

// ── Monthly Comparison View ──────────────────────────────────────────────────

function ComparisonView({ payouts }: { payouts: any[] }) {
  const disbursed = payouts.filter(p =>
    ['disbursed', 'DISBURSED', 'APPROVED', 'approved'].includes(p.status),
  );

  const byMonth: Record<string, { label: string; count: number; total: number; items: any[] }> = {};
  disbursed.forEach(p => {
    const d     = new Date(p.created_at || p.approved_at);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' });
    if (!byMonth[key]) byMonth[key] = { label, count: 0, total: 0, items: [] };
    byMonth[key].count++;
    byMonth[key].total += Number(p.amount || 0);
    byMonth[key].items.push(p);
  });

  const months    = Object.keys(byMonth).sort().reverse();
  const grandTotal = disbursed.reduce((s, p) => s + Number(p.amount || 0), 0);

  function exportComparisonCSV() {
    const headers = ['Month', 'Client Name', 'Amount', 'Date', 'Reference', 'Bank', 'Account Number'];
    const rows = disbursed.map(p => {
      const d = new Date(p.created_at);
      return [
        `"${d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' })}"`,
        `"${(p.profile?.full_name || '').replace(/"/g, '""')}"`,
        p.amount || 0,
        fmtDate(p.created_at),
        `"${p.id}"`,
        `"${p.application?.bank_account?.bank_name || ''}"`,
        `"${p.application?.bank_account?.account_number || ''}"`,
      ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `payout_comparison_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!months.length) {
    return (
      <div style={{ padding: 64, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
        No disbursement history yet.
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
          Month-over-Month Disbursement Comparison
        </h4>
        <button onClick={exportComparisonCSV}
          style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9', border: '1px solid rgba(109,40,217,0.3)', background: 'rgba(109,40,217,0.06)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span> Export Report
        </button>
      </div>

      {/* Summary Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Month', '# Payouts', 'Total Disbursed', 'Avg per Payout', 'MoM Change'].map((h, i) => (
              <th key={h} style={{ padding: '12px 16px', textAlign: i > 0 ? 'right' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', borderBottom: '1px solid #f3f4f6', borderRadius: i === 0 ? '8px 0 0 0' : i === 4 ? '0 8px 0 0' : 0 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((key, i) => {
            const m    = byMonth[key];
            const prev = months[i + 1] ? byMonth[months[i + 1]] : null;
            const change = prev ? ((m.total - prev.total) / prev.total * 100) : null;
            const avg  = m.count ? m.total / m.count : 0;
            const isUp = (change ?? 0) > 0;
            return (
              <tr key={key} style={{ borderBottom: '1px solid #f9fafb', transition: 'background .1s' }}
                onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseOut={e => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6b7280' }}>{m.count}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>{fmt(m.total)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6b7280' }}>{fmt(avg)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {change !== null
                    ? <span style={{ fontWeight: 700, color: isUp ? '#16a34a' : '#dc2626' }}>{isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#111827', color: '#fff', fontWeight: 700 }}>
            <td style={{ padding: '12px 16px', borderRadius: '0 0 0 8px' }}>ALL TIME</td>
            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{disbursed.length}</td>
            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmt(grandTotal)}</td>
            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmt(disbursed.length ? grandTotal / disbursed.length : 0)}</td>
            <td style={{ padding: '12px 16px', borderRadius: '0 0 8px 0' }}></td>
          </tr>
        </tfoot>
      </table>

      {/* Per-month expandable detail (last 3 months) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {months.slice(0, 3).map(key => {
          const m = byMonth[key];
          return (
            <details key={key} style={{ border: '1px solid #f3f4f6', borderRadius: 12, overflow: 'hidden' }}>
              <summary style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', listStyle: 'none', background: '#f9fafb' }}>
                <span>{m.label} — {m.count} payouts</span>
                <span style={{ fontWeight: 700, color: '#6D28D9' }}>{fmt(m.total)}</span>
              </summary>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '8px 16px', textAlign: 'left', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>Client</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>Amount</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {m.items.map((p: any) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #f9fafb' }}>
                      <td style={{ padding: '8px 16px', color: '#374151' }}>{p.profile?.full_name || '—'}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>{fmt(Number(p.amount))}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: '#9ca3af' }}>{fmtDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
    </div>
  );
}

// ── Payout Editor Modal ──────────────────────────────────────────────────────

interface EditorState {
  payout:       any;
  method:       PayMethod;
  notes:        string;
  thirdName:    string;
  thirdBank:    string;
  thirdAccount: string;
  thirdRef:     string;
  csInfo:       { fee: number; net: number; eligible: boolean } | null;
  saving:       boolean;
}

function PayoutEditorModal({ state, onChange, onClose, onSaved }: {
  state:    EditorState;
  onChange: (patch: Partial<EditorState>) => void;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const { payout, method, notes, thirdName, thirdBank, thirdAccount, thirdRef, csInfo, saving } = state;
  if (!payout) return null;

  async function fetchCashSendFee(amount: number) {
    try {
      const res  = await fetch(`/api/cashsend/fee?amount=${amount}`);
      const data = await res.json();
      onChange({ csInfo: { fee: data.fee ?? 0, net: data.net_payout ?? amount, eligible: !!data.eligible } });
    } catch {
      onChange({ csInfo: null });
    }
  }

  function selectMethod(m: PayMethod) {
    onChange({ method: m, csInfo: null });
    if (m === 'cashsend' && payout.amount) {
      fetchCashSendFee(Number(payout.amount));
    }
  }

  async function handleSave() {
    onChange({ saving: true });
    try {
      const payload: Record<string, any> = {
        payment_method:      method,
        payout_notes:        notes || null,
        third_party_name:    method === 'third_party' ? (thirdName || null)    : null,
        third_party_bank:    method === 'third_party' ? (thirdBank || null)    : null,
        third_party_account: method === 'third_party' ? (thirdAccount || null) : null,
        third_party_ref:     method === 'third_party' ? (thirdRef || null)     : null,
        cashsend_fee:        method === 'cashsend' && csInfo ? csInfo.fee : 0,
      };
      const { error } = await supabase.from('payouts').update(payload).eq('id', payout.id);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err: any) {
      alert('Save failed: ' + (err?.message || 'Unknown error'));
    } finally {
      onChange({ saving: false });
    }
  }

  const inputSt: any = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box', outline: 'none' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 20, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', width: '100%', maxWidth: 520, padding: 24 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--color-text)' }}>Edit Payout Method</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Payment Method buttons */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', display: 'block', marginBottom: 10 }}>Payment Method</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(Object.entries(METHOD_META) as [PayMethod, typeof METHOD_META[PayMethod]][]).map(([key, meta]) => (
              <button key={key} onClick={() => selectMethod(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `2px solid ${method === key ? '#6D28D9' : '#e5e7eb'}`, background: method === key ? 'rgba(109,40,217,0.06)' : '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: method === key ? '#6D28D9' : '#374151', transition: 'all .15s' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: method === key ? '#6D28D9' : meta.color }}>
                  {meta.icon}
                </span>
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        {/* CashSend info */}
        {method === 'cashsend' && csInfo && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, fontSize: 12, color: '#5b21b6', fontWeight: 600 }}>
            {csInfo.eligible
              ? <>CashSend Fee: <strong>R{csInfo.fee.toFixed(2)}</strong> | Net to client: <strong>R{csInfo.net.toFixed(2)}</strong></>
              : <span style={{ color: '#dc2626' }}>Amount not eligible for CashSend</span>}
          </div>
        )}

        {/* Third Party fields */}
        {method === 'third_party' && (
          <div style={{ marginBottom: 16, padding: 16, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', display: 'block', marginBottom: 6 }}>Recipient Name</label>
                <input style={inputSt} type="text" placeholder="Full name" value={thirdName} onChange={e => onChange({ thirdName: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', display: 'block', marginBottom: 6 }}>Bank Name</label>
                <input style={inputSt} type="text" placeholder="e.g. Capitec" value={thirdBank} onChange={e => onChange({ thirdBank: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', display: 'block', marginBottom: 6 }}>Account Number</label>
                <input style={{ ...inputSt, fontFamily: 'monospace' }} type="text" placeholder="Account number" value={thirdAccount} onChange={e => onChange({ thirdAccount: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', display: 'block', marginBottom: 6 }}>Reference</label>
                <input style={inputSt} type="text" placeholder="Payment reference" value={thirdRef} onChange={e => onChange({ thirdRef: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', display: 'block', marginBottom: 6 }}>Payout Notes</label>
          <input style={inputSt} type="text" placeholder="Optional internal note…" value={notes} onChange={e => onChange({ notes: e.target.value })} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose}
            style={{ flex: 1, border: '1px solid #e5e7eb', color: '#374151', fontWeight: 600, padding: '10px 0', borderRadius: 12, cursor: 'pointer', background: '#fff', fontSize: 13, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, background: '#6D28D9', color: '#fff', fontWeight: 700, padding: '10px 0', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', fontSize: 13, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function OutgoingPaymentsPage() {
  const qc = useQueryClient();

  const [activeTab,   setActiveTab]   = useState<PayoutTab>('pending');
  const [search,      setSearch]      = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS = 20;

  // Payout editor modal state
  const [editor, setEditor] = useState<EditorState>({
    payout: null, method: 'bank_transfer', notes: '', thirdName: '', thirdBank: '',
    thirdAccount: '', thirdRef: '', csInfo: null, saving: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: fetchPayouts,
    staleTime: 60_000,
  });

  const allPayouts: any[] = data?.data ?? [];

  // Stats
  const disbursedItems = allPayouts.filter(p => ['disbursed', 'DISBURSED', 'APPROVED', 'approved'].includes(p.status));
  const pendingItems   = allPayouts.filter(p => ['pending_disbursement', 'PENDING_DISBURSEMENT'].includes(p.status));
  const totalDisbursed = disbursedItems.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingValue   = pendingItems.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingQueue   = pendingItems.length;

  // Filtered payouts (with dedup by application_id)
  const filteredPayouts = useMemo(() => {
    const term = search.toLowerCase().trim();
    const seen = new Set<string>();

    return allPayouts.filter(p => {
      const isPending = p.status === 'pending_disbursement' || p.status === 'PENDING_DISBURSEMENT';
      const isPaid    = ['disbursed', 'DISBURSED', 'APPROVED', 'approved'].includes(p.status);
      const statusMatch =
        activeTab === 'pending'     ? isPending :
        activeTab === 'history'     ? isPaid    :
        activeTab === 'comparison'  ? isPaid    : false;

      const textMatch = !term ||
        (p.profile?.full_name || '').toLowerCase().includes(term) ||
        String(p.id).toLowerCase().includes(term);

      if (!statusMatch || !textMatch) return false;

      // dedup by application_id
      const key = String(p.application_id || p.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allPayouts, activeTab, search]);

  const totalPages     = Math.max(1, Math.ceil(filteredPayouts.length / ITEMS));
  const paginatedItems = filteredPayouts.slice((currentPage - 1) * ITEMS, currentPage * ITEMS);

  // Select all logic for current page
  const pageIds    = paginatedItems.map(p => String(p.id));
  const allChecked = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const someChecked = pageIds.some(id => selectedIds.has(id)) && !allChecked;

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      pageIds.forEach(id => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function downloadCSV(items: any[], label: string) {
    const headers = ['Payout ID', 'Recipient', 'Amount', 'Status', 'Date', 'Application ID', 'Bank', 'Account'];
    const rows = items.map(p => [
      p.id,
      `"${(p.profile?.full_name || 'N/A').replace(/"/g, '""')}"`,
      p.amount,
      activeTab === 'pending' ? 'Pending' : 'Paid',
      fmtDate(p.created_at),
      p.application_id,
      `"${p.application?.bank_account?.bank_name || 'N/A'}"`,
      `"${p.application?.bank_account?.account_number || 'N/A'}"`,
    ].join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `payout_export_${label}_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleBulkExport() {
    if (!selectedIds.size) return;
    const items = allPayouts.filter(p => selectedIds.has(String(p.id)));
    downloadCSV(items, activeTab);
    setSelectedIds(new Set());
  }

  function openEditor(payout: any) {
    setEditor({
      payout,
      method:       (payout.payment_method || 'bank_transfer') as PayMethod,
      notes:        payout.payout_notes || '',
      thirdName:    payout.third_party_name    || '',
      thirdBank:    payout.third_party_bank    || '',
      thirdAccount: payout.third_party_account || '',
      thirdRef:     payout.third_party_ref     || '',
      csInfo:       null,
      saving:       false,
    });
  }

  const tabBtnStyle = (tab: PayoutTab) => ({
    fontSize: 11, fontWeight: 700 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    paddingBottom: 4, border: 'none', background: 'none', cursor: 'pointer' as const, fontFamily: 'inherit',
    color:        activeTab === tab ? '#6D28D9' : '#9ca3af',
    borderBottom: `2px solid ${activeTab === tab ? '#6D28D9' : 'transparent'}`,
    transition:   'all .15s',
  });

  const selCount = selectedIds.size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease' }}>

      {/* ── Page Header ── */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Outgoing Payments</h1>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
          Disbursement queue · ready to pay and payment history
        </p>
      </div>

      {/* ── 3 KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="glass-card" style={{ padding: 24, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: 0 }}>Total Disbursed</p>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text)', margin: '8px 0 0' }}>{fmt(totalDisbursed)}</h2>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#10b981' }}>payments</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: 0 }}>Pending Value</p>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: '#d97706', margin: '8px 0 0' }}>{fmt(pendingValue)}</h2>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#d97706' }}>schedule</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: 0 }}>Pending Queue</p>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text)', margin: '8px 0 0' }}>{pendingQueue}</h2>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#6b7280' }}>checklist</span>
          </div>
        </div>
      </div>

      {/* ── Main Table Card ── */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Table Header / Toolbar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                Transaction View
              </h3>
              <div style={{ display: 'flex', gap: 24 }}>
                <button style={tabBtnStyle('pending')} onClick={() => { setActiveTab('pending'); setCurrentPage(1); setSelectedIds(new Set()); }}>
                  Ready to Pay
                </button>
                <button style={tabBtnStyle('history')} onClick={() => { setActiveTab('history'); setCurrentPage(1); setSelectedIds(new Set()); }}>
                  Paid History
                </button>
                <button style={tabBtnStyle('comparison')} onClick={() => { setActiveTab('comparison'); setCurrentPage(1); setSelectedIds(new Set()); }}>
                  Monthly Comparison
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {activeTab !== 'comparison' && (
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af', pointerEvents: 'none' }}>search</span>
                  <input type="text" placeholder="Search ID or Name..." value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                    style={{ paddingLeft: 34, paddingRight: 12, height: 38, border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', width: 240, background: '#f9fafb' }} />
                </div>
              )}

              {activeTab !== 'comparison' && (
                <button
                  onClick={handleBulkExport}
                  disabled={selCount === 0}
                  style={{ padding: '9px 18px', borderRadius: 10, background: selCount > 0 ? '#6D28D9' : '#374151', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: selCount > 0 ? 'pointer' : 'not-allowed', opacity: selCount === 0 ? 0.3 : 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'background .2s' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>file_download</span>
                  {selCount > 0 ? `Export & Process (${selCount})` : 'Export Data'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table content */}
        {activeTab === 'comparison' ? (
          <ComparisonView payouts={allPayouts} />
        ) : isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>Loading…</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '14px 16px 14px 24px', width: 40 }}>
                      <input type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked; }}
                        onChange={e => toggleSelectAll(e.target.checked)}
                        style={{ accentColor: '#6D28D9', cursor: 'pointer', width: 15, height: 15 }} />
                    </th>
                    {['Date', 'Transaction ID', 'Recipient', 'Amount', 'Method', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '14px 24px 14px 16px', textAlign: h === 'Action' ? 'right' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 48, textAlign: 'center', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                        No transactions found for the selected view.
                      </td>
                    </tr>
                  ) : paginatedItems.map((p: any) => {
                    const id         = String(p.id);
                    const isSelected = selectedIds.has(id);
                    const method     = (p.payment_method || 'bank_transfer') as PayMethod;
                    const meta       = METHOD_META[method] || METHOD_META.bank_transfer;
                    const isThird    = method === 'third_party';
                    const isCash     = method === 'cashsend';
                    const fee        = Number(p.cashsend_fee || 0);
                    const isPending  = activeTab === 'pending';
                    const recipientName = isThird ? (p.third_party_name || 'Third Party') : (p.profile?.full_name || 'N/A');
                    const statusSd   = isPending
                      ? { label: 'Pending', color: '#d97706', bg: '#fef3c7' }
                      : { label: 'Paid',    color: '#10b981', bg: '#d1fae5' };

                    return (
                      <tr key={p.id}
                        style={{ borderBottom: '1px solid #f9fafb', background: isSelected ? 'rgba(109,40,217,0.03)' : '#fff', transition: 'background .1s' }}
                        onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseOut={e => { e.currentTarget.style.background = isSelected ? 'rgba(109,40,217,0.03)' : '#fff'; }}>

                        <td style={{ padding: '14px 8px 14px 24px' }}>
                          <input type="checkbox" checked={isSelected}
                            onChange={e => toggleSelect(id, e.target.checked)}
                            style={{ accentColor: '#6D28D9', cursor: 'pointer', width: 15, height: 15 }} />
                        </td>

                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {fmtDate(p.created_at)}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', background: '#f9fafb', padding: '3px 8px', borderRadius: 6, border: '1px solid #f3f4f6', display: 'inline-block' }}>
                            #{String(p.id || '').slice(0, 8).toUpperCase()}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{recipientName}</div>
                          {isThird && p.third_party_bank && (
                            <div style={{ fontSize: 10, color: '#c2410c', fontWeight: 600 }}>→ {p.third_party_bank} {p.third_party_account}</div>
                          )}
                          {!isThird && p.profile?.full_name && (
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{p.profile?.email || ''}</div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 900, fontSize: 13, color: 'var(--color-text)' }}>{fmt(Number(p.amount) || 0)}</div>
                          {isCash && fee > 0 && (
                            <div style={{ fontSize: 10, color: '#7c3aed' }}>Fee: {fmt(fee)} | Net: {fmt(Number(p.amount) - fee)}</div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                            {meta.label}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: statusSd.bg, color: statusSd.color }}>
                            {statusSd.label}
                          </span>
                        </td>

                        <td style={{ padding: '14px 24px 14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                            <button
                              onClick={() => openEditor(p)}
                              title="Edit payout method"
                              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', transition: 'all .15s' }}
                              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(109,40,217,0.1)'; (e.currentTarget as HTMLElement).style.color = '#6D28D9'; }}
                              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af'; }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                            <a href={`/applications/${p.application_id}`}
                              title="View application"
                              style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', textDecoration: 'none', transition: 'all .15s' }}
                              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(109,40,217,0.1)'; (e.currentTarget as HTMLElement).style.color = '#6D28D9'; }}
                              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af'; }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ borderTop: '1px solid #f3f4f6', background: 'rgba(249,250,251,0.5)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Page {currentPage} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1, fontFamily: 'inherit' }}>
                  Prev
                </button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', opacity: currentPage === totalPages ? 0.3 : 1, fontFamily: 'inherit' }}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Record count */}
      <div style={{ textAlign: 'right', fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Total Records Found: <span style={{ color: 'var(--color-text)' }}>{filteredPayouts.length}</span>
      </div>

      {/* Payout Editor Modal */}
      {editor.payout && (
        <PayoutEditorModal
          state={editor}
          onChange={patch => setEditor(prev => ({ ...prev, ...patch }))}
          onClose={() => setEditor(prev => ({ ...prev, payout: null }))}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-payouts'] })}
        />
      )}
    </div>
  );
}
