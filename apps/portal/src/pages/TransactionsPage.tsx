import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';

const SHADOW_SOFT = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)';
const RADIUS = 24;
const PAYMENTS_PER_PAGE = 10;

const BRANCH_CODES: Record<string, string> = {
  'FNB': '250655',
  'Standard Bank': '051001',
  'ABSA': '632005',
  'Nedbank': '198765',
  'Capitec': '470010',
  'Investec': '580105',
  'TymeBank': '678910',
  'Discovery Bank': '679000',
  'African Bank': '430000',
};

const BANKS = Object.keys(BRANCH_CODES).map(name => ({
  value: name,
  label: name === 'FNB' ? 'First National Bank (FNB)' : name,
}));

// ── types ─────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: number;
  bankName: string;
  accountNumber: string;
  accountType: string | null;
  isPrimary: boolean;
}

interface ActiveLoan {
  id: string;
  applicationId: string | null;
  principal: number;
  outstanding: number;
  monthlyPayment: number;
  nextDueAmount: number;
  dueDateObj: Date | null;
}

interface Payment {
  id: string;
  loanId: string;
  applicationId: string | null;
  amount: number;
  date: string;
  status: string;
  method: string;
}

// ── utils ─────────────────────────────────────────────────────────────────────

const fmt = (v: number) => `R ${(Number(v) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = (v: string | Date | null) => {
  if (!v) return '--';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '--' : d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
};

function calcMonthly(principal: number, annualRate: number, months: number): number {
  if (!principal || !months) return 0;
  const r = (annualRate || 0) / 12;
  if (!r) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#d1fae5', text: '#065f46' },
  pending:   { bg: '#fef3c7', text: '#92400e' },
  failed:    { bg: '#fee2e2', text: '#991b1b' },
};

// ── data ──────────────────────────────────────────────────────────────────────

async function fetchPaymentsData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const uid = session.user.id;

  const [{ data: rawPayments }, { data: rawAccounts }, { data: rawLoans }] = await Promise.all([
    supabase.from('payments').select('*, loans:loan_id(application_id)').eq('user_id', uid).order('payment_date', { ascending: false }),
    supabase.from('bank_accounts').select('*').eq('user_id', uid).order('is_primary', { ascending: false }),
    supabase.from('loans').select('*').eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false }),
  ]);

  const payments: Payment[] = (rawPayments ?? []).map(p => ({
    id: p.id,
    loanId: p.loan_id,
    applicationId: (p.loans as { application_id?: string } | null)?.application_id ?? null,
    amount: parseFloat(p.amount) || 0,
    date: p.payment_date,
    status: p.status || 'completed',
    method: p.payment_method || 'Card',
  }));

  const paidByLoan = payments.reduce<Record<string, number>>((a, p) => {
    a[p.loanId] = (a[p.loanId] ?? 0) + p.amount;
    return a;
  }, {});

  const accounts: BankAccount[] = (rawAccounts ?? []).map(a => ({
    id: a.id,
    bankName: a.bank_name,
    accountNumber: String(a.account_number),
    accountType: a.account_type,
    isPrimary: !!a.is_primary,
  }));

  const loans: ActiveLoan[] = (rawLoans ?? []).map(l => {
    const principal  = parseFloat(l.principal_amount) || 0;
    const months     = parseInt(l.term_months, 10) || 1;
    const rawRate    = parseFloat(l.interest_rate) || 0;
    const rate       = rawRate > 1 ? rawRate / 100 : rawRate;
    const stored     = parseFloat(l.monthly_payment) || 0;
    const monthly    = Number.isFinite(stored) && stored > 0 ? stored : calcMonthly(principal, rate, months);
    const totalRepay = parseFloat(l.total_repayment) || monthly * months || principal;
    const outstanding = Math.max(totalRepay - (paidByLoan[l.id] ?? 0), 0);

    const ds = l.next_payment_date || l.first_payment_date || l.repayment_start_date;
    let due: Date | null = ds ? new Date(ds) : null;
    if (!due && l.start_date) { due = new Date(l.start_date); due.setDate(due.getDate() + 30); }
    if (due && isNaN(due.getTime())) due = null;
    if (due) due.setUTCHours(0, 0, 0, 0);

    return {
      id: l.id,
      applicationId: l.application_id ?? null,
      principal,
      outstanding,
      monthlyPayment: monthly,
      nextDueAmount: Math.min(monthly, outstanding || monthly),
      dueDateObj: due,
    };
  });

  return { payments, accounts, loans, userName: session.user.user_metadata?.full_name as string | undefined, userId: uid };
}

// ── modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(244,240,234,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.10)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '28px 32px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', margin: 0, letterSpacing: '-0.5px' }}>{title}</h2>
          <button onClick={onClose} style={{ background: '#FAFAFA', border: 'none', width: 40, height: 40, borderRadius: '50%', color: '#1C1C1E', cursor: 'pointer', fontSize: 15 }}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div style={{ padding: '0 32px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── bank account row ──────────────────────────────────────────────────────────

function BankRow({ account, onDelete }: { account: BankAccount; onDelete: (a: BankAccount) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'grid', placeItems: 'center', fontSize: 17, color: '#1C1C1E' }}>
          <i className="fas fa-university" />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: '#1C1C1E', fontSize: 15 }}>{account.bankName}</div>
          <div style={{ fontSize: 12.5, color: '#8E8E93', marginTop: 2, fontWeight: 500, textTransform: 'capitalize' }}>
            {account.accountType || 'Account'} •••• {account.accountNumber.slice(-4)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {account.isPrimary && (
          <span style={{ background: 'rgba(91,33,182,0.10)', color: 'var(--color-primary)', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>Primary</span>
        )}
        <button
          onClick={() => onDelete(account)}
          title="Remove Account"
          style={{ color: '#ef4444', width: 34, height: 34, background: '#fff1f2', border: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 13 }}
        >
          <i className="fas fa-trash" />
        </button>
      </div>
    </div>
  );
}

// ── add bank modal ────────────────────────────────────────────────────────────

function AddBankModal({ hasAccounts, onClose, onSaved }: { hasAccounts: boolean; onClose: () => void; onSaved: () => void }) {
  const [bankName, setBankName]       = useState('');
  const [holder, setHolder]           = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode]   = useState('');
  const [accountType, setAccountType] = useState('');
  const [isPrimary, setIsPrimary]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [status, setStatus]           = useState<{ ok: boolean; text: string } | null>(null);

  const branchLocked = !!BRANCH_CODES[bankName];

  function pickBank(name: string) {
    setBankName(name);
    setBranchCode(BRANCH_CODES[name] ?? '');
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please sign in again.');

      if (isPrimary && hasAccounts) {
        await supabase.from('bank_accounts').update({ is_primary: false }).eq('user_id', session.user.id);
      }

      const { error } = await supabase.from('bank_accounts').insert([{
        user_id: session.user.id,
        bank_name: bankName,
        account_holder: holder,
        account_number: accountNumber,
        branch_code: branchCode,
        account_type: accountType,
        is_primary: isPrimary || !hasAccounts,
      }]);
      if (error) throw error;

      setStatus({ ok: true, text: 'Bank account added successfully!' });
      setTimeout(() => { onSaved(); onClose(); }, 1200);
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Failed to save account. Check details.' });
      setSaving(false);
    }
  }

  const fieldStyle = { width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: '#6b7280', marginBottom: 6 };

  return (
    <Modal title="Add Bank Account" onClose={onClose}>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Bank Name</label>
          <select required value={bankName} onChange={e => pickBank(e.target.value)} style={fieldStyle}>
            <option value="" disabled>Select your bank</option>
            {BANKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Account Holder Name</label>
          <input type="text" required value={holder} onChange={e => setHolder(e.target.value)} placeholder="e.g. John Doe" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Account Number</label>
          <input type="text" required pattern="[0-9]+" title="Numbers only" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 62000000000" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Branch Code</label>
          <input
            type="text" required value={branchCode}
            onChange={e => setBranchCode(e.target.value)}
            readOnly={branchLocked}
            placeholder="Auto-filled when you pick your bank"
            style={{ ...fieldStyle, background: branchLocked ? '#f3f4f6' : '#fff', color: branchLocked ? '#6b7280' : '#1C1C1E' }}
          />
        </div>
        <div>
          <label style={labelStyle}>Account Type</label>
          <select required value={accountType} onChange={e => setAccountType(e.target.value)} style={fieldStyle}>
            <option value="" disabled>Select account type</option>
            <option value="cheque">Cheque / Current</option>
            <option value="savings">Savings</option>
            <option value="transmission">Transmission</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
          Set as default account for payments
        </label>
        {status && (
          <div style={{
            background: status.ok ? '#f0fdf4' : '#fff1f2',
            border: `1px solid ${status.ok ? '#bbf7d0' : '#fecdd3'}`,
            borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600,
            color: status.ok ? '#166534' : '#be123c',
          }}>
            {status.text}
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          style={{ width: '100%', padding: 14, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          {saving ? 'Saving…' : 'Save Bank Account'}
        </button>
      </form>
    </Modal>
  );
}

// ── PDF statement (lazy-loads jsPDF from CDN like legacy) ─────────────────────

declare global {
  interface Window {
    jspdf?: { jsPDF: new () => JsPdfDoc };
  }
}

interface JsPdfDoc {
  setFontSize(n: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setFont(name: string, style: string): void;
  text(s: string, x: number, y: number): void;
  autoTable(opts: Record<string, unknown>): void;
  save(name: string): void;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function generateStatement(payments: Payment[], userName: string | undefined, userId: string) {
  if (!window.jspdf) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  }
  const { jsPDF } = window.jspdf!;
  const doc = new jsPDF();
  const uidShort = userId.substring(0, 6).toUpperCase();

  doc.setFontSize(24);
  doc.setTextColor(91, 33, 182);
  doc.setFont('helvetica', 'bold');
  doc.text('AlgoLend', 14, 22);

  doc.setFontSize(16);
  doc.setTextColor(28, 28, 30);
  doc.setFont('helvetica', 'normal');
  doc.text('Payment History Statement', 14, 34);

  doc.setFontSize(10);
  doc.setTextColor(142, 142, 147);
  doc.text(`Account Holder: ${userName || 'Account Holder'}`, 14, 44);
  doc.text(`Account Reference: #${uidShort}`, 14, 50);
  doc.text(`Date Generated: ${new Date().toLocaleDateString('en-ZA')}`, 14, 56);

  doc.autoTable({
    startY: 64,
    head: [['Date', 'Reference', 'Amount', 'Status', 'Method']],
    body: payments.map(p => [fmtDate(p.date), `#${p.applicationId || p.loanId}`, fmt(p.amount), p.status.toUpperCase(), p.method]),
    theme: 'grid',
    headStyles: { fillColor: [91, 33, 182], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { fontSize: 10, cellPadding: 6, textColor: [28, 28, 30] },
  });

  doc.save(`AlgoLend_Statement_${uidShort}.pdf`);
}

// ── main page ─────────────────────────────────────────────────────────────────

type ModalKind = 'addBank' | 'allBanks' | 'allLoans' | 'payment' | { deleteAccount: BankAccount } | null;

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalKind>(null);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payments-dashboard'],
    queryFn: fetchPaymentsData,
    staleTime: 60_000,
    retry: 1,
  });

  const payments = data?.payments ?? [];
  const accounts = data?.accounts ?? [];
  const loans    = data?.loans ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['payments-dashboard'] });

  // metrics
  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
  const upcoming = loans.reduce<ActiveLoan | null>((best, l) => {
    if (!l.dueDateObj || l.outstanding <= 0) return best;
    return !best?.dueDateObj || l.dueDateObj < best.dueDateObj ? l : best;
  }, null);
  const nextPaymentAmount = upcoming?.nextDueAmount ?? 0;
  const nextPaymentLabel = upcoming?.dueDateObj
    ? `Due ${upcoming.dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : payments.length > 0
      ? `Last paid ${new Date(payments[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'No upcoming payment';

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const paidThisMonth = payments.filter(p => new Date(p.date) >= firstOfMonth).reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  // pagination
  const maxPage = Math.ceil(payments.length / PAYMENTS_PER_PAGE) || 1;
  const pagePayments = payments.slice((page - 1) * PAYMENTS_PER_PAGE, page * PAYMENTS_PER_PAGE);

  async function setDefaultAccount(accountId: number) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('bank_accounts').update({ is_primary: false }).eq('user_id', session.user.id);
    await supabase.from('bank_accounts').update({ is_primary: true }).eq('id', accountId).eq('user_id', session.user.id);
    refresh();
  }

  async function deleteAccount(account: BankAccount) {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error: delErr } = await supabase.from('bank_accounts').delete().eq('id', account.id).eq('user_id', session.user.id);
      if (delErr) throw delErr;

      // re-assign primary if we deleted it
      const remaining = accounts.filter(a => a.id !== account.id);
      if (account.isPrimary && remaining.length > 0) {
        await supabase.from('bank_accounts').update({ is_primary: true }).eq('id', remaining[0].id).eq('user_id', session.user.id);
      }
      refresh();
      setModal(null);
    } catch {
      alert('Failed to remove account.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (!data) return;
    setDownloading(true);
    try {
      await generateStatement(payments, data.userName, data.userId);
    } catch {
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--color-primary)' }} /></div>;
  }

  if (isError) {
    return (
      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: RADIUS, padding: 24, color: '#be123c', fontSize: 14 }}>
        <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
        {error instanceof Error ? error.message : 'Unable to load payments.'}
      </div>
    );
  }

  const metrics = [
    { label: 'Total Outstanding', value: fmt(totalOutstanding),  icon: 'fa-wallet',         sub: undefined },
    { label: 'Next Payment',      value: fmt(nextPaymentAmount), icon: 'fa-calendar-check', sub: nextPaymentLabel },
    { label: 'Paid This Month',   value: fmt(paidThisMonth),     icon: 'fa-chart-line',     sub: undefined },
    { label: 'Total Paid',        value: fmt(totalPaid),         icon: 'fa-check-circle',   sub: undefined },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>Payments &amp; Transactions</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>
          Manage your loan settlements and banking information
        </p>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: '#fff', borderRadius: RADIUS, padding: 22, boxShadow: SHADOW_SOFT, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8E8E93', margin: '0 0 6px' }}>{m.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: '#1C1C1E', margin: 0 }}>{m.value}</p>
              {m.sub && <p style={{ fontSize: 11, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>{m.sub}</p>}
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(91,33,182,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fas ${m.icon}`} style={{ color: 'var(--color-primary)', fontSize: 15 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setModal('addBank')}
          style={{ padding: '12px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#1C1C1E', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <i className="fas fa-plus" style={{ marginRight: 8, color: 'var(--color-primary)' }} /> Add Bank
        </button>

        <select
          value={accounts.find(a => a.isPrimary)?.id ?? ''}
          onChange={e => { if (e.target.value) setDefaultAccount(Number(e.target.value)); }}
          style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', outline: 'none', minWidth: 220 }}
        >
          {accounts.length === 0
            ? <option value="" disabled>No accounts linked</option>
            : accounts.map(a => (
              <option key={a.id} value={a.id}>{a.bankName} (•••• {a.accountNumber.slice(-4)})</option>
            ))}
        </select>

        <button
          onClick={() => setModal('payment')}
          style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(91,33,182,0.35)' }}
        >
          <i className="fas fa-credit-card" style={{ marginRight: 8 }} /> Make Payment
        </button>
      </div>

      {/* Loans + banks grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

        <div style={{ background: '#fff', borderRadius: RADIUS, padding: 24, boxShadow: SHADOW_SOFT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Active Loans</h3>
            <span style={{ background: 'rgba(91,33,182,0.10)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>{loans.length}</span>
          </div>
          {loans.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: '20px 0', margin: 0 }}>No active loans found</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loans.slice(0, 3).map(loan => (
                <button
                  key={loan.id}
                  onClick={() => setModal('allLoans')}
                  style={{ background: '#FAFAFA', border: 'none', borderRadius: 16, padding: 16, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#1C1C1E', fontSize: 15 }}>Loan #{String(loan.applicationId || loan.id).slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 12.5, color: '#8E8E93', marginTop: 4 }}>Next: {loan.dueDateObj ? fmtDate(loan.dueDateObj) : 'TBD'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#1C1C1E', fontSize: 16 }}>{fmt(loan.outstanding)}</div>
                    <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', background: 'rgba(91,33,182,0.10)', color: 'var(--color-primary)', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Active</span>
                  </div>
                </button>
              ))}
              {loans.length > 3 && (
                <button
                  onClick={() => setModal('allLoans')}
                  style={{ width: '100%', textAlign: 'center', padding: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(91,33,182,0.05)', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                >
                  View All {loans.length} Active Loans
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: RADIUS, padding: 24, boxShadow: SHADOW_SOFT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Bank Accounts</h3>
          </div>
          {accounts.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: '20px 0', margin: 0 }}>No saved bank accounts</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accounts.slice(0, 3).map(a => (
                <BankRow key={a.id} account={a} onDelete={acc => setModal({ deleteAccount: acc })} />
              ))}
              {accounts.length > 3 && (
                <button
                  onClick={() => setModal('allBanks')}
                  style={{ width: '100%', textAlign: 'center', padding: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(91,33,182,0.05)', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                >
                  View All {accounts.length} Accounts
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div style={{ background: '#fff', borderRadius: RADIUS, padding: 24, boxShadow: SHADOW_SOFT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Payment History</h3>
          <button
            onClick={handleDownload}
            disabled={downloading || payments.length === 0}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {downloading ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Generating…</> : 'Download'}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Date', 'Reference', 'Amount', 'Status', 'Method'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8E8E93', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagePayments.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8E8E93', padding: 30, fontWeight: 500 }}>No payment history yet</td></tr>
              ) : pagePayments.map(p => {
                const sc = STATUS_COLORS[p.status.toLowerCase()] ?? { bg: '#f3f4f6', text: '#6b7280' };
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px' }}>{fmtDate(p.date)}</td>
                    <td style={{ padding: '12px', color: '#8E8E93' }}>#{String(p.applicationId || p.loanId).slice(-6).toUpperCase()}</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#1C1C1E' }}>{fmt(p.amount)}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: sc.bg, color: sc.text, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize' }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '12px', color: '#8E8E93' }}>{p.method}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {maxPage > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#fff', boxShadow: SHADOW_SOFT, color: '#1C1C1E', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
            >
              <i className="fas fa-chevron-left" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93' }}>Page {page} of {maxPage}</span>
            <button
              onClick={() => setPage(p => Math.min(maxPage, p + 1))}
              disabled={page === maxPage}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#fff', boxShadow: SHADOW_SOFT, color: '#1C1C1E', cursor: page === maxPage ? 'not-allowed' : 'pointer', opacity: page === maxPage ? 0.5 : 1 }}
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        )}
      </div>

      {/* ── modals ── */}

      {modal === 'addBank' && (
        <AddBankModal hasAccounts={accounts.length > 0} onClose={() => setModal(null)} onSaved={refresh} />
      )}

      {modal === 'allBanks' && (
        <Modal title="All Bank Accounts" onClose={() => setModal(null)}>
          {accounts.map(a => <BankRow key={a.id} account={a} onDelete={acc => setModal({ deleteAccount: acc })} />)}
        </Modal>
      )}

      {modal === 'allLoans' && (
        <Modal title="Active Loans Details" onClose={() => setModal(null)}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600, textTransform: 'uppercase' }}>Active Balance</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-1px' }}>{fmt(totalOutstanding)}</div>
          </div>
          {loans.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14 }}>No active loans found.</p>
          ) : loans.map(loan => (
            <div key={loan.id} style={{ background: '#FAFAFA', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>Loan #{String(loan.applicationId || loan.id).slice(-6).toUpperCase()}</span>
                <span style={{ background: 'rgba(91,33,182,0.10)', color: 'var(--color-primary)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Active</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#fff', padding: 14, borderRadius: 12 }}>
                {[
                  { label: 'Principal', value: fmt(loan.principal) },
                  { label: 'Remaining', value: fmt(loan.outstanding) },
                  { label: 'Next Due', value: fmt(loan.nextDueAmount) },
                  { label: 'Due Date', value: loan.dueDateObj ? fmtDate(loan.dueDateObj) : 'TBD' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#8E8E93' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Modal>
      )}

      {modal === 'payment' && (
        <Modal title="Payment Gateway" onClose={() => setModal(null)}>
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <i className="fas fa-credit-card" style={{ fontSize: 22, color: '#F59E0B' }} />
            </div>
            <p style={{ color: '#1C1C1E', fontSize: 15, lineHeight: 1.6, margin: '0 0 8px' }}>
              Online payments are <strong>coming soon</strong>.
            </p>
            <p style={{ color: '#8E8E93', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
              Please contact your loan officer or visit a branch to make a payment at this time.
            </p>
            <button
              onClick={() => setModal(null)}
              style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Got it
            </button>
          </div>
        </Modal>
      )}

      {modal && typeof modal === 'object' && 'deleteAccount' in modal && (
        <Modal title="Confirm Removal" onClose={() => setModal(null)}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 64, height: 64, background: '#fff1f2', color: '#ef4444', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 24, margin: '0 auto 16px' }}>
              <i className="fas fa-exclamation-triangle" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1C1C1E' }}>Remove Account?</h3>
            <p style={{ color: '#8E8E93', fontSize: 14, margin: '0 0 28px', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{modal.deleteAccount.bankName} (•••• {modal.deleteAccount.accountNumber.slice(-4)})</strong>?
              <br />This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setModal(null)}
                style={{ flex: 1, background: '#FAFAFA', border: '1px solid #E5E5EA', color: '#1C1C1E', padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAccount(modal.deleteAccount)}
                disabled={deleting}
                style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.7 : 1, fontFamily: 'inherit' }}
              >
                {deleting ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Removing…</> : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
