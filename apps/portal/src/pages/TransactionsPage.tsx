import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';

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

// ── utils (verbatim from legacy documents.js) ─────────────────────────────────

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

// ── universal modal (legacy modern-modal markup) ──────────────────────────────

function UniversalModal({ title, onClose, fullScreen, children }: { title: string; onClose: () => void; fullScreen?: boolean; children: ReactNode }) {
  return (
    <div className={`modern-modal-overlay${fullScreen ? ' is-full-screen' : ''}`} onClick={onClose}>
      <div className="modern-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modern-modal-header">
          <h2 className="modern-modal-title">{title}</h2>
          <button className="modern-modal-close" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className="modern-modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── bank row (legacy renderBankAccounts markup) ───────────────────────────────

function BankRow({ account, onDelete }: { account: BankAccount; onDelete: (a: BankAccount) => void }) {
  return (
    <div className="modern-list-item" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-white, #fff)', boxShadow: 'var(--shadow-soft, 0 12px 32px rgba(0,0,0,0.04))', display: 'grid', placeItems: 'center', color: 'var(--text-main, #1C1C1E)', fontSize: 20 }}>
          <i className="fas fa-university" />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-main, #1C1C1E)', fontSize: 16 }}>{account.bankName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted, #8E8E93)', marginTop: 4, fontWeight: 500 }}>
            {account.accountType || 'Account'} •••• {account.accountNumber.slice(-4)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {account.isPrimary && (
          <span className="status-badge completed" style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)' }}>Primary</span>
        )}
        <button
          className="btn-icon"
          title="Remove Account"
          onClick={() => onDelete(account)}
          style={{ color: '#ef4444', width: 36, height: 36, background: '#fff1f2', border: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: '0.2s' }}
        >
          <i className="fas fa-trash" />
        </button>
      </div>
    </div>
  );
}

// ── add bank modal (legacy openAddBankAccountModal form markup) ───────────────

function AddBankModal({ hasAccounts, onClose, onSaved }: { hasAccounts: boolean; onClose: () => void; onSaved: () => void }) {
  const [bankName, setBankName]           = useState('');
  const [holder, setHolder]               = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode]       = useState('');
  const [accountType, setAccountType]     = useState('');
  const [isPrimary, setIsPrimary]         = useState(false);
  const [saving, setSaving]               = useState(false);
  const [status, setStatus]               = useState<{ ok: boolean; text: string } | null>(null);

  const branchLocked = !!BRANCH_CODES[bankName];

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
      setTimeout(() => { onSaved(); onClose(); }, 1500);
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Failed to save account. Check details.' });
      setSaving(false);
    }
  }

  return (
    <UniversalModal title="Add Bank Account" onClose={onClose}>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="form-group">
          <label>Bank Name</label>
          <select
            required className="modern-input" value={bankName}
            onChange={e => { setBankName(e.target.value); setBranchCode(BRANCH_CODES[e.target.value] ?? ''); }}
          >
            <option value="" disabled>Select your bank</option>
            <option value="FNB">First National Bank (FNB)</option>
            <option value="Standard Bank">Standard Bank</option>
            <option value="ABSA">ABSA</option>
            <option value="Nedbank">Nedbank</option>
            <option value="Capitec">Capitec</option>
            <option value="Investec">Investec</option>
            <option value="TymeBank">TymeBank</option>
            <option value="Discovery Bank">Discovery Bank</option>
            <option value="African Bank">African Bank</option>
          </select>
        </div>
        <div className="form-group">
          <label>Account Holder Name</label>
          <input type="text" required className="modern-input" placeholder="e.g. John Doe" value={holder} onChange={e => setHolder(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Account Number</label>
          <input type="text" required className="modern-input" pattern="[0-9]+" title="Numbers only" placeholder="e.g. 62000000000" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Branch Code</label>
          <input
            type="text" required className="modern-input" placeholder="Auto-filled when you pick your bank"
            value={branchCode} readOnly={branchLocked}
            onChange={e => setBranchCode(e.target.value)}
            style={branchLocked ? { background: 'var(--surface-container, #f3f4f6)', color: 'var(--outline, #6b7280)' } : undefined}
          />
        </div>
        <div className="form-group">
          <label>Account Type</label>
          <select required className="modern-input" value={accountType} onChange={e => setAccountType(e.target.value)}>
            <option value="" disabled>Select account type</option>
            <option value="cheque">Cheque / Current</option>
            <option value="savings">Savings</option>
            <option value="transmission">Transmission</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', paddingTop: 8 }}>
          <input
            type="checkbox" id="isPrimary" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
          <label htmlFor="isPrimary" style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Set as default account for payments</label>
        </div>
        {status && (
          <div className={`status-message ${status.ok ? 'success' : 'error'}`} style={{ display: 'block' }}>
            {status.text}
          </div>
        )}
        <button type="submit" disabled={saving} className="action-btn primary" style={{ width: '100%', marginTop: 10 }}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Saving...</> : 'Save Bank Account'}
        </button>
      </form>
    </UniversalModal>
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
  doc.setTextColor(124, 58, 237);
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
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { fontSize: 10, cellPadding: 6, textColor: [28, 28, 30] },
  });

  doc.save(`AlgoLend_Statement_${uidShort}.pdf`);
}

// ── main page (legacy documents.html markup) ──────────────────────────────────

type ModalKind = 'addBank' | 'allBanks' | 'allLoans' | 'payment' | { deleteAccount: BankAccount } | null;

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [modal, setModal]       = useState<ModalKind>(null);
  const [page, setPage]         = useState(1);
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

  // metrics (verbatim calculateMetrics logic)
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
    return (
      <div className="page-container">
        <div className="content-wrapper" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="content-wrapper">
          <p style={{ color: '#ef4444', padding: 24 }}>
            {error instanceof Error ? error.message : 'Unable to load payments.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="content-wrapper">

        <header className="minimal-header">
          <div className="header-text">
            <h1>Payments &amp; Transactions</h1>
            <p className="page-subtitle">Manage your loan settlements and banking information</p>
          </div>
        </header>

        {/* Metric cards (legacy metrics-carousel markup) */}
        <section className="carousel-section">
          <div className="metrics-carousel">
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Total Outstanding</span>
                <span className="metric-value">{fmt(totalOutstanding)}</span>
              </div>
              <div className="metric-icon"><i className="fas fa-wallet" /></div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Next Payment</span>
                <span className="metric-value">{fmt(nextPaymentAmount)}</span>
                <span className="metric-subtext">{nextPaymentLabel}</span>
              </div>
              <div className="metric-icon"><i className="fas fa-calendar-check" /></div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Paid This Month</span>
                <span className="metric-value">{fmt(paidThisMonth)}</span>
              </div>
              <div className="metric-icon"><i className="fas fa-chart-line" /></div>
            </div>

            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Total Paid</span>
                <span className="metric-value">{fmt(totalPaid)}</span>
              </div>
              <div className="metric-icon"><i className="fas fa-check-circle" /></div>
            </div>
          </div>
        </section>

        {/* Quick actions bar (legacy markup) */}
        <nav className="quick-actions-bar">
          <button className="action-btn" onClick={() => setModal('addBank')}>
            <i className="fas fa-plus" />
            <span>Add Bank</span>
          </button>

          <div className="action-dropdown-wrapper">
            <select
              className="action-select"
              value={accounts.find(a => a.isPrimary)?.id ?? ''}
              onChange={e => { if (e.target.value) setDefaultAccount(Number(e.target.value)); }}
            >
              {accounts.length === 0
                ? <option value="" disabled>No accounts linked</option>
                : accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.bankName} (•••• {a.accountNumber.slice(-4)})</option>
                ))}
            </select>
          </div>

          <button className="action-btn primary" onClick={() => setModal('payment')}>
            <i className="fas fa-credit-card" />
            <span>Make Payment</span>
          </button>
        </nav>

        {/* Loans + banks grid (legacy payments-grid markup) */}
        <div className="payments-grid">
          <div className="section-card">
            <div className="section-header">
              <h3>Active Loans</h3>
              <span className="count-pill">{loans.length}</span>
            </div>
            <div className="list-content">
              {loans.length === 0 ? (
                <div className="empty-state">No active loans found</div>
              ) : (
                <>
                  {loans.slice(0, 3).map(loan => (
                    <div className="modern-list-item" key={loan.id} onClick={() => setModal('allLoans')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main, #1C1C1E)', fontSize: 16 }}>
                            Loan #{String(loan.applicationId || loan.id).slice(-6).toUpperCase()}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted, #8E8E93)', marginTop: 4 }}>
                            Next: {loan.dueDateObj ? fmtDate(loan.dueDateObj) : 'TBD'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main, #1C1C1E)', fontSize: 18 }}>{fmt(loan.outstanding)}</div>
                          <span style={{ display: 'inline-block', marginTop: 6, padding: '4px 12px', background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)', borderRadius: 50, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Active</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loans.length > 3 && (
                    <button
                      className="text-btn"
                      onClick={() => setModal('allLoans')}
                      style={{ width: '100%', textAlign: 'center', marginTop: 16, padding: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(124,58,237,0.05)', borderRadius: 16, transition: '0.2s', cursor: 'pointer', border: 'none' }}
                    >
                      View All {loans.length} Active Loans
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">
              <h3>Bank Accounts</h3>
            </div>
            <div className="list-content">
              {accounts.length === 0 ? (
                <div className="empty-state">No saved bank accounts</div>
              ) : (
                <>
                  {accounts.slice(0, 3).map(a => (
                    <BankRow key={a.id} account={a} onDelete={acc => setModal({ deleteAccount: acc })} />
                  ))}
                  {accounts.length > 3 && (
                    <button
                      className="text-btn"
                      onClick={() => setModal('allBanks')}
                      style={{ width: '100%', textAlign: 'center', marginTop: 16, padding: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(124,58,237,0.05)', borderRadius: 16, transition: '0.2s', cursor: 'pointer', border: 'none' }}
                    >
                      View All {accounts.length} Accounts
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Payment history (legacy payments-table markup) */}
        <div className="section-card full-width" style={{ marginBottom: 40 }}>
          <div className="section-header">
            <h3>Payment History</h3>
            <div className="header-btns">
              <button className="text-btn" onClick={handleDownload} disabled={downloading || payments.length === 0}>
                {downloading ? 'Generating…' : 'Download'}
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagePayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted, #8E8E93)', padding: 30, fontWeight: 500 }}>
                      No payment history yet
                    </td>
                  </tr>
                ) : pagePayments.map(p => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td style={{ color: 'var(--text-muted, #8E8E93)' }}>#{String(p.applicationId || p.loanId).slice(-6).toUpperCase()}</td>
                    <td style={{ color: 'var(--text-main, #1C1C1E)', fontWeight: 700 }}>{fmt(p.amount)}</td>
                    <td><span className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</span></td>
                    <td style={{ color: 'var(--text-muted, #8E8E93)' }}>{p.method}</td>
                    <td><button className="btn-icon"><i className="fas fa-receipt" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {maxPage > 1 && (
              <div className="pagination-controls">
                <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <i className="fas fa-chevron-left" />
                </button>
                <span className="page-indicator">Page {page} of {maxPage}</span>
                <button className="page-btn" onClick={() => setPage(p => Math.min(maxPage, p + 1))} disabled={page === maxPage}>
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── modals ── */}

      {modal === 'addBank' && (
        <AddBankModal hasAccounts={accounts.length > 0} onClose={() => setModal(null)} onSaved={refresh} />
      )}

      {modal === 'allBanks' && (
        <UniversalModal title="All Bank Accounts" onClose={() => setModal(null)}>
          {accounts.map(a => <BankRow key={a.id} account={a} onDelete={acc => setModal({ deleteAccount: acc })} />)}
        </UniversalModal>
      )}

      {modal === 'allLoans' && (
        <UniversalModal title="Active Loans Details" onClose={() => setModal(null)} fullScreen>
          <div className="full-screen-content-wrapper">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted, #8E8E93)', fontWeight: 600, textTransform: 'uppercase' }}>Active Balance</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-main, #1C1C1E)', letterSpacing: -1 }}>{fmt(totalOutstanding)}</div>
            </div>
            {loans.length === 0 ? (
              <div className="empty-state">No active loans found.</div>
            ) : loans.map(loan => (
              <div className="modern-list-item" key={loan.id} style={{ border: '1px solid #eee', background: 'var(--color-white, #fff)', boxShadow: 'var(--shadow-soft, 0 12px 32px rgba(0,0,0,0.04))' }}>
                <div className="modern-item-header">
                  <span className="modern-item-id">Loan #{String(loan.applicationId || loan.id).slice(-6).toUpperCase()}</span>
                  <span className="status-badge" style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)' }}>Active</span>
                </div>
                <div className="modern-item-grid">
                  <div className="modern-grid-col"><div className="label">Principal</div><div className="val">{fmt(loan.principal)}</div></div>
                  <div className="modern-grid-col"><div className="label">Remaining</div><div className="val">{fmt(loan.outstanding)}</div></div>
                  <div className="modern-grid-col"><div className="label">Next Due</div><div className="val">{fmt(loan.nextDueAmount)}</div></div>
                  <div className="modern-grid-col"><div className="label">Due Date</div><div className="val">{loan.dueDateObj ? fmtDate(loan.dueDateObj) : 'TBD'}</div></div>
                </div>
              </div>
            ))}
          </div>
        </UniversalModal>
      )}

      {modal === 'payment' && (
        <UniversalModal title="Payment Gateway" onClose={() => setModal(null)}>
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <p style={{ color: 'var(--text-main, #1C1C1E)', fontSize: 15, lineHeight: 1.6, margin: '0 0 8px' }}>
              Online payments are <strong>coming soon</strong>.
            </p>
            <p style={{ color: 'var(--text-sub, #8E8E93)', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
              Please contact your loan officer or visit a branch to make a payment at this time.
            </p>
            <button className="action-btn primary" onClick={() => setModal(null)} style={{ width: '100%', maxWidth: 200 }}>
              Got it
            </button>
          </div>
        </UniversalModal>
      )}

      {modal && typeof modal === 'object' && 'deleteAccount' in modal && (
        <UniversalModal title="Confirm Removal" onClose={() => setModal(null)}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 64, height: 64, background: '#fff1f2', color: '#ef4444', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 24, margin: '0 auto 16px' }}>
              <i className="fas fa-exclamation-triangle" />
            </div>
            <h3 style={{ marginBottom: 8, fontSize: 20, fontWeight: 700, color: 'var(--text-main, #1C1C1E)' }}>Remove Account?</h3>
            <p style={{ color: 'var(--text-muted, #8E8E93)', fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{modal.deleteAccount.bankName} (•••• {modal.deleteAccount.accountNumber.slice(-4)})</strong>?
              <br />This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="action-btn"
                onClick={() => setModal(null)}
                style={{ flex: 1, background: '#FAFAFA', border: '1px solid #E5E5EA', color: 'var(--text-main, #1C1C1E)' }}
              >
                Cancel
              </button>
              <button
                className="action-btn"
                onClick={() => deleteAccount(modal.deleteAccount)}
                disabled={deleting}
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }}
              >
                {deleting ? <><i className="fas fa-spinner fa-spin" /> Removing...</> : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </UniversalModal>
      )}
    </div>
  );
}
