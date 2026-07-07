import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';

// ─── types ───────────────────────────────────────────────────────────────────

interface EnrichedLoan {
  id: string;
  principal_amount: number;
  term_months: number;
  interest_rate: number;
  status: string;
  outstandingBalance: number;
  nextDueAmount: number;
  dueDateObj: Date | null;
  daysUntilDue: number | null;
  totalRepaymentCalc: number;
  normalizedRate: number;
}

interface Application {
  id: string;
  status: string;
  amount: number;
  purpose: string | null;
  created_at: string;
}

interface DashboardData {
  totalBorrowed: number;
  currentBalance: number;
  totalRepaid: number;
  nextPayment: { amount: number; date: string | null; hasUpcoming: boolean };
  loans: EnrichedLoan[];
  applications: Application[];
  creditCheck: { credit_score: number; risk_category: string } | null;
  unsignedOffer: { id: string; amount: number; purpose: string | null } | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const ZAR = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 });
const fmt = (n: number) => ZAR.format(n);

function calcMonthly(principal: number, rate: number, months: number): number {
  const r = rate / 12;
  if (r === 0 || months === 0) return months ? principal / months : 0;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

const RISK_COLOR: Record<string, string> = {
  'very low risk':  '#10b981',
  'low risk':       '#22c55e',
  'medium risk':    '#f59e0b',
  'high risk':      '#ef4444',
  'very high risk': '#dc2626',
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:       { bg: '#fef3c7', text: '#92400e' },
  APPROVED:      { bg: '#d1fae5', text: '#065f46' },
  DECLINED:      { bg: '#fee2e2', text: '#991b1b' },
  OFFERED:       { bg: '#dbeafe', text: '#1e40af' },
  CONTRACT_SIGN: { bg: '#dbeafe', text: '#1e40af' },
  DISBURSED:     { bg: '#d1fae5', text: '#065f46' },
  CANCELLED:     { bg: '#f3f4f6', text: '#6b7280' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nextPaymentSub(np: DashboardData['nextPayment']): { label: string; color: string } {
  if (!np.date) return { label: 'No upcoming payment', color: '#9ca3af' };
  if (!np.hasUpcoming) return { label: `Last paid ${fmtDate(np.date)}`, color: '#9ca3af' };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(np.date).getTime() - now.getTime()) / 86400000);
  if (days < 0)  return { label: `${Math.abs(days)} days overdue`, color: '#ef4444' };
  if (days === 0) return { label: 'Due today!',                     color: '#f59e0b' };
  if (days === 1) return { label: 'Due tomorrow',                   color: '#f59e0b' };
  if (days <= 5)  return { label: `Due in ${days} days`,            color: '#f59e0b' };
  return { label: `Due ${fmtDate(np.date)}`, color: '#6b7280' };
}

// ─── data fetcher ─────────────────────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const uid = session.user.id;

  const [
    { data: rawLoans },
    { data: payments },
    { data: creditChecks },
    { data: rawApps },
    { data: unsignedOffers },
  ] = await Promise.all([
    supabase.from('loans').select('*').eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('payments').select('loan_id, amount, payment_date').eq('user_id', uid).order('payment_date', { ascending: false }),
    supabase.from('credit_checks').select('credit_score, risk_category').eq('user_id', uid).order('checked_at', { ascending: false }).limit(1),
    supabase.from('loan_applications').select('id, status, amount, purpose, created_at').eq('user_id', uid).neq('status', 'OFFERED').neq('status', 'DISBURSED').order('created_at', { ascending: false }).limit(6),
    supabase.from('loan_applications').select('id, amount, purpose').eq('user_id', uid).in('status', ['OFFERED', 'CONTRACT_SIGN']).is('contract_signed_at', null).order('created_at', { ascending: false }).limit(1),
  ]);

  const paidByLoan = (payments ?? []).reduce<Record<string, number>>((a, p) => {
    a[p.loan_id] = (a[p.loan_id] ?? 0) + Number(p.amount);
    return a;
  }, {});
  const totalRepaidAll = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const latestPaid = payments?.[0]?.payment_date ?? null;
  const now = new Date(); now.setUTCHours(0, 0, 0, 0);

  const loans: EnrichedLoan[] = (rawLoans ?? []).map(l => {
    const principal = Number(l.principal_amount) || 0;
    const months    = Number(l.term_months) || 1;
    const rawRate   = Number(l.interest_rate) || 0;
    const rate      = rawRate > 1 ? rawRate / 100 : rawRate;
    const monthly   = Number(l.monthly_payment) || calcMonthly(principal, rate, months);
    const totalRepaymentCalc = Number(l.total_repayment) || monthly * months || principal;
    const paid      = paidByLoan[l.id] ?? 0;
    const outstanding = Math.max(totalRepaymentCalc - paid, 0);
    const nextDue   = monthly > 0 ? Math.min(monthly, outstanding) : outstanding;

    const ds = l.next_payment_date || l.first_payment_date || l.repayment_start_date;
    let due: Date | null = ds ? new Date(ds) : null;
    if (!due && l.start_date) { due = new Date(l.start_date); due.setDate(due.getDate() + 30); }
    if (due && isNaN(due.getTime())) due = null;
    if (due) due.setUTCHours(0, 0, 0, 0);

    return {
      ...l,
      outstandingBalance: outstanding,
      nextDueAmount: nextDue,
      dueDateObj: due,
      daysUntilDue: due ? Math.round((due.getTime() - now.getTime()) / 86400000) : null,
      totalRepaymentCalc,
      normalizedRate: rate,
    };
  });

  const totals = loans.reduce((a, l) => ({ b: a.b + l.principal_amount, o: a.o + l.outstandingBalance, r: a.r + (paidByLoan[l.id] ?? 0) }), { b: 0, o: 0, r: 0 });
  const upcoming = loans.reduce<EnrichedLoan | null>((best, l) => {
    if (!l.dueDateObj || l.outstandingBalance <= 0) return best;
    return !best?.dueDateObj || l.dueDateObj < best.dueDateObj ? l : best;
  }, null);

  return {
    totalBorrowed:  totals.b,
    currentBalance: totals.o,
    totalRepaid:    totals.r || totalRepaidAll,
    nextPayment: upcoming?.dueDateObj
      ? { amount: upcoming.nextDueAmount, date: upcoming.dueDateObj.toISOString(), hasUpcoming: true }
      : { amount: 0, date: latestPaid, hasUpcoming: false },
    loans,
    applications: rawApps ?? [],
    creditCheck:  creditChecks?.[0] ?? null,
    unsignedOffer: unsignedOffers?.[0] ?? null,
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs font-medium" style={{ color: subColor ?? '#9ca3af' }}>{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#f3f4f6', text: '#6b7280' };
  return (
    <span style={{ background: s.bg, color: s.text, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SignBanner({ offer }: { offer: NonNullable<DashboardData['unsignedOffer']> }) {
  const amt = fmt(Number(offer.amount));
  return (
    <div style={{ background: 'linear-gradient(135deg,#fff7ed,#fef3c7)', border: '2px solid #f97316', borderRadius: 16, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, background: '#f97316', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#9a3412', margin: '0 0 3px' }}>Action Required: Sign Your Agreement</p>
          <p style={{ fontSize: 13, color: '#c2410c', margin: 0 }}>Your loan offer of <strong>{amt}</strong> is ready — sign to proceed.</p>
        </div>
      </div>
      <button
        style={{ background: '#f97316', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        onClick={() => alert('Sign contract flow — coming soon')}
      >
        Sign Now →
      </button>
    </div>
  );
}

function ActiveLoans({ loans }: { loans: EnrichedLoan[] }) {
  if (loans.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-black text-gray-900">Active Loans</h2>
        <p className="text-sm text-gray-400">No active loans.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-black text-gray-900">Active Loans</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {['Loan ID', 'Outstanding', 'Next Payment', 'Due Date', 'Rate'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loans.map((loan, i) => {
              const due = loan.dueDateObj
                ? loan.dueDateObj.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                : 'TBD';
              const d = loan.daysUntilDue;
              const dueColor = d !== null && d < 0 ? '#ef4444' : d !== null && d <= 5 ? '#f59e0b' : '#374151';
              return (
                <tr key={loan.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">LOAN-{loan.id.slice(-6).toUpperCase()}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{fmt(loan.outstandingBalance)}</td>
                  <td className="px-6 py-4 text-gray-700">{fmt(loan.nextDueAmount)}</td>
                  <td className="px-6 py-4 font-semibold" style={{ color: dueColor }}>{due}</td>
                  <td className="px-6 py-4 text-gray-500">{(loan.normalizedRate * 100).toFixed(2)}% p.a.</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentApplications({ apps }: { apps: Application[] }) {
  if (apps.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-black text-gray-900">Recent Applications</h2>
        <p className="text-sm text-gray-400">No applications yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-black text-gray-900">Recent Applications</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {['Reference', 'Purpose', 'Amount', 'Date', 'Status'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apps.map((app, i) => (
              <tr key={app.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-6 py-4 font-mono text-xs text-gray-500">APP-{app.id.slice(-6).toUpperCase()}</td>
                <td className="px-6 py-4 text-gray-700">{app.purpose || 'Personal Loan'}</td>
                <td className="px-6 py-4 font-bold text-gray-900">{fmt(Number(app.amount))}</td>
                <td className="px-6 py-4 text-gray-500">{fmtDate(app.created_at)}</td>
                <td className="px-6 py-4"><StatusBadge status={app.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        Could not load dashboard: {error instanceof Error ? error.message : 'unknown error'}
      </div>
    );
  }

  if (!data) return null;

  const { totalBorrowed, currentBalance, totalRepaid, nextPayment, loans, applications, creditCheck, unsignedOffer } = data;
  const npSub = nextPaymentSub(nextPayment);
  const riskKey = (creditCheck?.risk_category ?? '').toLowerCase();
  const scoreColor = RISK_COLOR[riskKey] ?? '#6b7280';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
        {creditCheck && (
          <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: scoreColor }} />
            <span className="text-xs font-bold text-gray-700">Credit Score</span>
            <span className="text-sm font-black" style={{ color: scoreColor }}>{creditCheck.credit_score}</span>
            <span className="text-xs capitalize text-gray-400">· {creditCheck.risk_category}</span>
          </div>
        )}
      </div>

      {unsignedOffer && <SignBanner offer={unsignedOffer} />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Borrowed"    value={fmt(totalBorrowed)}  />
        <StatCard label="Outstanding Balance" value={fmt(currentBalance)}  />
        <StatCard label="Total Repaid"      value={fmt(totalRepaid)}    />
        <StatCard
          label="Next Payment"
          value={nextPayment.hasUpcoming ? fmt(nextPayment.amount) : '—'}
          sub={npSub.label}
          subColor={npSub.color}
        />
      </div>

      <ActiveLoans loans={loans} />
      <RecentApplications apps={applications} />
    </div>
  );
}
