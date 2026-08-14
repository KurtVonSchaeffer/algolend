import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchIncomingPayments,
  confirmIncomingPayment,
  rejectIncomingPayment,
} from '../services/adminData';
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

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:    { label: 'Pending',    color: '#f59e0b', bg: '#fef3c7', border: '#fde68a' },
  CONFIRMED:  { label: 'Confirmed',  color: '#10b981', bg: '#d1fae5', border: '#6ee7b7' },
  REJECTED:   { label: 'Rejected',   color: '#ef4444', bg: '#fee2e2', border: '#fca5a5' },
  PROCESSING: { label: 'Processing', color: '#3b82f6', bg: '#dbeafe', border: '#93c5fd' },
  FAILED:     { label: 'Failed',     color: '#ef4444', bg: '#fee2e2', border: '#fca5a5' },
  COMPLETED:  { label: 'Completed',  color: '#10b981', bg: '#d1fae5', border: '#6ee7b7' },
};

function getInitials(name: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function ageLabel(dateStr: string) {
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type DateTab = 'today' | '7days' | '30days' | 'all' | 'custom';

const inputBase: Record<string, string | number> = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '13px',
  fontFamily: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
};

// ── Page ────────────────────────────────────────────────────────────────────

export function IncomingPaymentsPage() {
  const qc = useQueryClient();

  // Record Payment form
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [rpAppId,   setRpAppId]   = useState('');
  const [rpAmount,  setRpAmount]  = useState('');
  const [rpDate,    setRpDate]    = useState(new Date().toISOString().slice(0, 10));
  const [rpType,    setRpType]    = useState('partial');
  const [rpRef,     setRpRef]     = useState('');
  const [rpNotes,   setRpNotes]   = useState('');
  const [rpFeedback, setRpFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rpBusy,    setRpBusy]    = useState(false);

  // Table filters
  const [activeTab,    setActiveTab]    = useState<DateTab>('30days');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [search,       setSearch]       = useState('');
  const [currentPage,  setCurrentPage]  = useState(1);
  const ITEMS = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-incoming-payments'],
    queryFn: fetchIncomingPayments,
    staleTime: 60_000,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmIncomingPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-incoming-payments'] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectIncomingPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-incoming-payments'] }),
  });

  const allPayments: any[] = data?.data ?? [];
  const pendingPayments = allPayments.filter(p => (p.status ?? '').toLowerCase() === 'pending');

  // MTD stats
  const currentMonth = new Date().toISOString().slice(0, 7);
  const mtdPayments  = allPayments.filter(p => (p.payment_date || p.created_at || '').startsWith(currentMonth));
  const mtdTotal     = mtdPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const uniquePayers = new Set(mtdPayments.map(p => p.user_id || p.application_id)).size;
  const profitPct    = mtdTotal > 0 ? 35 : 0; // demo split
  const interestSplit  = mtdTotal * 0.35;
  const principalSplit = mtdTotal * 0.65;

  // Top 5 by amount (for sidebar)
  const top5 = useMemo(
    () => [...allPayments].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
    [allPayments],
  );

  // Date + search filter
  const dateFiltered = useMemo(() => {
    let f = allPayments;
    const today = new Date().toISOString().slice(0, 10);
    if (activeTab === 'today') {
      f = f.filter(p => (p.payment_date || p.created_at || '').slice(0, 10) === today);
    } else if (activeTab === '7days') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      f = f.filter(p => new Date(p.payment_date || p.created_at) >= d);
    } else if (activeTab === '30days') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      f = f.filter(p => new Date(p.payment_date || p.created_at) >= d);
    } else if (activeTab === 'custom') {
      if (dateFrom) f = f.filter(p => (p.payment_date || p.created_at || '').slice(0, 10) >= dateFrom);
      if (dateTo)   f = f.filter(p => (p.payment_date || p.created_at || '').slice(0, 10) <= dateTo);
    }
    return f;
  }, [allPayments, activeTab, dateFrom, dateTo]);

  const searchFiltered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return dateFiltered;
    return dateFiltered.filter(p => {
      const name    = (p.profile?.full_name || p.profiles?.full_name || '').toLowerCase();
      const ref     = (p.reference || '').toLowerCase();
      const loanNum = (p.loan_applications?.loan_number || '').toLowerCase();
      return name.includes(term) || ref.includes(term) || String(p.id).includes(term) || loanNum.includes(term);
    });
  }, [dateFiltered, search]);

  const totalPages   = Math.max(1, Math.ceil(searchFiltered.length / ITEMS));
  const paginated    = searchFiltered.slice((currentPage - 1) * ITEMS, currentPage * ITEMS);

  function switchTab(tab: DateTab) { setActiveTab(tab); setCurrentPage(1); }

  function exportCSV() {
    if (!searchFiltered.length) { alert('No payments to export for this period.'); return; }
    const headers = ['Date', 'Client', 'ID Number', 'Reference', 'Loan Ref', 'Amount Paid', 'Type', 'Method'];
    const rows = searchFiltered.map(p => [
      (p.payment_date || p.created_at || '').slice(0, 10),
      `"${(p.profile?.full_name || p.profiles?.full_name || '').replace(/"/g, '""')}"`,
      p.profiles?.identity_number || '',
      p.reference || p.id || '',
      p.loan_applications?.loan_number || String(p.application_id || '').slice(0, 8),
      p.amount || 0,
      p.payment_type || p.status || '',
      p.payment_method || 'Manual EFT',
    ].join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `incoming_payments_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleRecordPayment() {
    const amount = parseFloat(rpAmount);
    if (!rpAppId.trim() || !amount || amount <= 0 || !rpDate) {
      setRpFeedback({ msg: 'Please fill in the Loan ID, amount, and date.', ok: false });
      return;
    }
    setRpBusy(true); setRpFeedback(null);
    try {
      const { data: found } = await supabase
        .from('loan_applications')
        .select('id, user_id, loan_number, profiles:user_id(full_name)')
        .or(`loan_number.eq.${rpAppId.trim()}`)
        .maybeSingle();

      if (!found) {
        setRpFeedback({ msg: 'Application not found. Check the loan number or ID.', ok: false });
        return;
      }
      const reference = rpRef.trim() || `ADM-${Date.now().toString(36).toUpperCase()}`;
      const validType = ['settlement', 'arrears', 'partial'].includes(rpType) ? rpType : 'partial';
      const { error } = await supabase.from('manual_payments').insert([{
        application_id: found.id,
        user_id:        found.user_id,
        amount,
        payment_type:   validType,
        reference,
        notes: rpNotes.trim() ? `${rpNotes.trim()} (date: ${rpDate})` : `Payment date: ${rpDate}`,
        status:         'confirmed',
        confirmed_at:   new Date().toISOString(),
      }]);
      if (error) throw error;
      await supabase.from('cash_journal').insert([{
        entry_date:      rpDate,
        entry_type:      'cash_in',
        category:        rpType === 'settlement' ? 'settlement' : 'repayment',
        description:     `Admin-recorded ${rpType} — Ref: ${reference}`,
        reference,
        amount,
        application_id:  String(found.id),
        created_by_name: 'Admin (manual entry)',
      }]);
      const clientName = (found.profiles as any)?.full_name || rpAppId.trim();
      setRpFeedback({ msg: `Payment of R${amount.toFixed(2)} recorded for ${clientName} (${rpDate}).`, ok: true });
      setRpAppId(''); setRpAmount(''); setRpRef(''); setRpNotes('');
      setRpDate(new Date().toISOString().slice(0, 10));
      qc.invalidateQueries({ queryKey: ['admin-incoming-payments'] });
    } catch (err: any) {
      setRpFeedback({ msg: 'Error: ' + (err?.message || 'Unknown error'), ok: false });
    } finally {
      setRpBusy(false);
    }
  }

  const actionBusy = confirmMutation.isPending || rejectMutation.isPending;

  const tabBtn = (tab: DateTab, label: string) => (
    <button
      key={tab}
      onClick={() => switchTab(tab)}
      style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        paddingBottom: 4, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
        color:       activeTab === tab ? '#6D28D9' : '#9ca3af',
        borderBottom: `2px solid ${activeTab === tab ? '#6D28D9' : 'transparent'}`,
        transition: 'all .15s',
      }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease' }}>

      {/* ── Page Header ── */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Incoming Payments</h1>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
          Recovery dashboard · EFT proofs and admin-recorded payments
        </p>
      </div>

      {/* ── Record Payment Panel ── */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: showRecordForm ? '1px solid #f3f4f6' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#059669' }}>add_circle</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>Record Payment</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Admin: manually record a payment with any date</div>
            </div>
          </div>
          <button
            onClick={() => { setShowRecordForm(v => !v); setRpFeedback(null); }}
            style={{ padding: '7px 16px', borderRadius: 10, background: '#6D28D9', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showRecordForm ? 'Cancel' : '+ Record'}
          </button>
        </div>

        {showRecordForm && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
              {([
                { label: 'Loan / App ID or Ref',
                  el: <input style={inputBase as any} type="text" value={rpAppId} placeholder="Loan number or application ID" onChange={e => setRpAppId(e.target.value)} /> },
                { label: 'Amount (R)',
                  el: <input style={inputBase as any} type="number" min="1" value={rpAmount} placeholder="e.g. 1500" onChange={e => setRpAmount(e.target.value)} /> },
                { label: 'Payment Date',
                  el: <input style={inputBase as any} type="date" value={rpDate} onChange={e => setRpDate(e.target.value)} /> },
                { label: 'Payment Type',
                  el: (
                    <select style={inputBase as any} value={rpType} onChange={e => setRpType(e.target.value)}>
                      <option value="partial">Regular Installment</option>
                      <option value="settlement">Settlement (Full)</option>
                      <option value="arrears">Arrears Payment</option>
                    </select>
                  )},
                { label: 'Reference',
                  el: <input style={inputBase as any} type="text" value={rpRef} placeholder="Bank ref / receipt no." onChange={e => setRpRef(e.target.value)} /> },
                { label: 'Notes',
                  el: <input style={inputBase as any} type="text" value={rpNotes} placeholder="Optional notes" onChange={e => setRpNotes(e.target.value)} /> },
              ] as { label: string; el: any }[]).map(({ label, el }) => (
                <div key={label}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                    {label}
                  </label>
                  {el}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={handleRecordPayment} disabled={rpBusy}
                style={{ padding: '9px 20px', background: '#6D28D9', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: rpBusy ? 'not-allowed' : 'pointer', opacity: rpBusy ? 0.7 : 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                {rpBusy ? 'Saving…' : 'Save Payment'}
              </button>
              <button onClick={() => setShowRecordForm(false)}
                style={{ padding: '9px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>

            {rpFeedback && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: rpFeedback.ok ? '#d1fae5' : '#fee2e2', color: rpFeedback.ok ? '#065f46' : '#991b1b' }}>
                {rpFeedback.msg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pending Manual Payments ── */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(109,40,217,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6D28D9' }}>payments</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>Manual Payment Proofs</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>EFT / self-submitted payments awaiting confirmation</div>
              </div>
              {pendingPayments.length > 0 && (
                <span style={{ background: '#6D28D9', color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>
                  {pendingPayments.length}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['admin-incoming-payments'] })}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span> Refresh
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</div>
          ) : pendingPayments.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9ca3af', padding: '16px 0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
              No pending manual payments
            </div>
          ) : pendingPayments.map((p: any) => {
            const name     = p.profiles?.full_name || 'Unknown';
            const phone    = p.profiles?.cell_tel_no || '—';
            const loanRef  = p.loan_applications?.loan_number || String(p.application_id || '').slice(0, 8) || '—';
            const payType  = p.payment_type || 'payment';
            const typeLabel = payType === 'settlement' ? 'Settlement' : payType === 'arrears' ? 'Arrears Payment' : 'Payment';
            const typeColor = payType === 'settlement'
              ? { color: '#7c3aed', bg: '#ede9fe' }
              : { color: '#059669', bg: '#d1fae5' };
            return (
              <div key={p.id} style={{ border: '1px solid #f3f4f6', borderRadius: 14, padding: 16, transition: 'border-color .15s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#6b7280', flexShrink: 0 }}>
                      {getInitials(name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{phone} · Loan {loanRef}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--color-text)' }}>{fmt(Number(p.amount) || 0)}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: typeColor.bg, color: typeColor.color }}>
                      {typeLabel}
                    </span>
                  </div>
                </div>

                {p.reference && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0' }}>
                    <strong>Ref:</strong> {p.reference}
                  </p>
                )}
                {p.proof_url && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                    <strong>Proof:</strong>{' '}
                    <a href={p.proof_url} target="_blank" rel="noreferrer" style={{ color: '#6D28D9', textDecoration: 'underline' }}>
                      {p.proof_url.length > 50 ? p.proof_url.slice(0, 50) + '…' : p.proof_url}
                    </a>
                  </p>
                )}
                {p.notes && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0', fontStyle: 'italic' }}>"{p.notes}"</p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{ageLabel(p.created_at)}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={actionBusy} onClick={() => rejectMutation.mutate(p.id)}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#dc2626', border: '1px solid #fca5a5', background: '#fee2e2', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', opacity: actionBusy ? 0.5 : 1 }}>
                      Reject
                    </button>
                    <button disabled={actionBusy} onClick={() => confirmMutation.mutate(p.id)}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#6D28D9', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: actionBusy ? 0.5 : 1 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> Confirm
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3 KPI Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="glass-card" style={{ padding: 24, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: 0 }}>Total Recoveries (MTD)</p>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text)', margin: '8px 0 0' }}>{fmt(mtdTotal)}</h2>
            <p style={{ fontSize: 11, color: '#10b981', fontWeight: 700, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>trending_up</span>
              {mtdPayments.length} transactions
            </p>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#10b981' }}>payments</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: 0 }}>Realized Profit (MTD)</p>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: '#4338ca', margin: '8px 0 0' }}>{fmt(interestSplit)}</h2>
            <p style={{ fontSize: 11, color: '#818cf8', fontWeight: 700, margin: '4px 0 0' }}>Contractual Fees & Interest</p>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#6366f1' }}>donut_large</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: 0 }}>Active Payers</p>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text)', margin: '8px 0 0' }}>{uniquePayers}</h2>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, margin: '4px 0 0' }}>Unique clients this period</p>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#6b7280' }}>group</span>
          </div>
        </div>
      </div>

      {/* ── Main Row: Recovery Table + Sidebar ── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Recovery Detail Table (3/4) */}
        <div className="glass-card" style={{ flex: 3, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Table toolbar */}
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  Recovery Detail
                </h3>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {tabBtn('today', 'Today')}
                  {tabBtn('7days', '7 Days')}
                  {tabBtn('30days', '30 Days')}
                  {tabBtn('all', 'All')}
                  <span style={{ color: '#e5e7eb', fontSize: 16, lineHeight: 1 }}>|</span>
                  <input type="date" value={dateFrom} title="From date"
                    onChange={e => { setDateFrom(e.target.value); switchTab('custom'); }}
                    style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>→</span>
                  <input type="date" value={dateTo} title="To date"
                    onChange={e => { setDateTo(e.target.value); switchTab('custom'); }}
                    style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }} />
                </div>
                <div style={{ marginTop: 10, paddingBottom: 14 }}>
                  <button onClick={exportCSV}
                    style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9', border: '1px solid rgba(109,40,217,0.3)', background: 'rgba(109,40,217,0.06)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
                    Export CSV
                  </button>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af', pointerEvents: 'none' }}>search</span>
                <input type="text" placeholder="Search client or ID..." value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  style={{ paddingLeft: 34, paddingRight: 12, height: 36, border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12, fontFamily: 'inherit', width: 220, background: '#f9fafb' }} />
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', flex: 1 }}>
            {isLoading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
            ) : (
              <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    {['Date', 'Client & ID', 'Loan Ref', 'Status', 'Paid In', 'Balance'].map(h => (
                      <th key={h} style={{ padding: '12px 24px', textAlign: ['Paid In', 'Balance'].includes(h) ? 'right' : h === 'Status' ? 'center' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 48, textAlign: 'center', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                        No transactions found.
                      </td>
                    </tr>
                  ) : paginated.map((p: any) => {
                    const clientName = p.profile?.full_name || p.profiles?.full_name || 'Unknown';
                    const appId      = p.loan_id || p.application_id || '';
                    const loanRef    = p.loan_applications?.loan_number || (appId ? String(appId).slice(0, 8).toUpperCase() : '—');
                    const balance    = p.loan_applications?.loans?.outstanding_balance ?? null;
                    const monthlyReq = Number(p.loan_applications?.offer_monthly_repayment) || 0;
                    const amountPaid = Number(p.amount) || 0;
                    const refLabel   = p.reference || ('REF-' + String(p.id || '').slice(0, 8).toUpperCase());

                    let balanceNode: any;
                    let statusNode: any;

                    if (balance === null) {
                      const sd = STATUS_DISPLAY[(p.status || '').toUpperCase()] || { label: p.status || 'Unknown', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
                      statusNode = <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: sd.bg, color: sd.color, border: `1px solid ${sd.border}` }}>{sd.label}</span>;
                      balanceNode = <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>;
                    } else if (balance < -1) {
                      balanceNode = <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#ede9fe', color: '#7c3aed', textTransform: 'uppercase' as const }}>Credit: {fmt(Math.abs(balance))}</span>;
                      statusNode  = <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#ede9fe', color: '#7c3aed', border: '1px solid #c4b5fd' }}>Overpaid</span>;
                    } else if (balance <= 1) {
                      balanceNode = <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#d1fae5', color: '#065f46', textTransform: 'uppercase' as const }}>Fully Settled</span>;
                      statusNode  = <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>Complete</span>;
                    } else {
                      balanceNode = <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase' as const }}>Due: {fmt(balance)}</span>;
                      statusNode  = amountPaid < monthlyReq
                        ? <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74' }}>Partial</span>
                        : <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>On Track</span>;
                    }

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f9fafb', background: '#fff', transition: 'background .1s' }}
                        onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseOut={e => (e.currentTarget.style.background = '#fff')}>
                        <td style={{ padding: '14px 24px', fontSize: 12, color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(p.payment_date || p.created_at)}</td>
                        <td style={{ padding: '14px 24px' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--color-text)' }}>{clientName}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{refLabel}</div>
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', background: '#eef2ff', padding: '3px 8px', borderRadius: 6 }}>{loanRef}</span>
                        </td>
                        <td style={{ padding: '14px 24px', textAlign: 'center' }}>{statusNode}</td>
                        <td style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: 'var(--color-text)' }}>+ {fmt(amountPaid)}</td>
                        <td style={{ padding: '14px 24px', textAlign: 'right' }}>{balanceNode}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
        </div>

        {/* Right Sidebar (1/4) */}
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Allocation Donut */}
          <div className="glass-card" style={{ padding: 24, borderRadius: 16 }}>
            <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
              Allocation (MTD)
            </h4>
            <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 20px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="#f3f4f6" strokeWidth="3.8" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="#6D28D9" strokeWidth="3.8"
                  strokeDasharray={`${profitPct}, 100`}
                  style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Profit</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)' }}>{profitPct}%</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { label: 'Capital Back',  value: fmt(principalSplit), bg: '#f9fafb', color: '#374151', border: '#e5e7eb' },
                { label: 'Interest/Fees', value: fmt(interestSplit),  bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
                { label: 'Credit/Extra',  value: fmt(0),              bg: '#ede9fe', color: '#7c3aed', border: '#ddd6fe' },
              ] as const).map(({ label, value, bg, color, border }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: bg, borderRadius: 8, border: `1px solid ${border}` }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '0.06em' }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Period Recoveries */}
          <div className="glass-card" style={{ padding: 24, borderRadius: 16 }}>
            <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
              Top Period Recoveries
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 300 }}>
              {top5.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: '#9ca3af' }}>No data for period</div>
              ) : top5.map((p: any) => {
                const name  = p.profile?.full_name || p.profiles?.full_name || 'Unknown';
                const appId = p.loan_id || p.application_id || '';
                const ref   = p.loan_applications?.loan_number || String(appId).slice(0, 8).toUpperCase();
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#fff')}
                    onMouseOut={e => (e.currentTarget.style.background = '#f9fafb')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>
                        {getInitials(name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: 9, color: '#9ca3af', fontFamily: 'monospace' }}>{ref}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#10b981' }}>+{fmt(Number(p.amount))}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
