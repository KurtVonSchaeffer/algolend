import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';
import { Loader } from '../components/ui/loader';

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
  paidToDate: number;
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

// ─── constants ───────────────────────────────────────────────────────────────

const ZAR = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 });
const fmt = (n: number) => ZAR.format(n);

const SHADOW_SOFT = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)';
const RADIUS = 24;

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

const APP_ICON: Record<string, { icon: string; bg: string; color: string }> = {
  PENDING:       { icon: 'fa-clock',          bg: '#fef3c7', color: '#d97706' },
  APPROVED:      { icon: 'fa-circle-check',   bg: '#d1fae5', color: '#059669' },
  DECLINED:      { icon: 'fa-circle-xmark',   bg: '#fee2e2', color: '#dc2626' },
  OFFERED:       { icon: 'fa-file-signature', bg: '#dbeafe', color: '#2563eb' },
  CONTRACT_SIGN: { icon: 'fa-file-signature', bg: '#dbeafe', color: '#2563eb' },
  DISBURSED:     { icon: 'fa-money-bill-wave',bg: '#d1fae5', color: '#059669' },
  CANCELLED:     { icon: 'fa-ban',            bg: '#f3f4f6', color: '#9ca3af' },
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function calcMonthly(principal: number, rate: number, months: number): number {
  const r = rate / 12;
  if (r === 0 || months === 0) return months ? principal / months : 0;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShortDate(d: Date) {
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function nextPaymentSub(np: DashboardData['nextPayment']): { label: string; color: string } {
  if (!np.date) return { label: 'No upcoming payment', color: '#9ca3af' };
  if (!np.hasUpcoming) return { label: `Last paid ${fmtDate(np.date)}`, color: '#9ca3af' };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(np.date).getTime() - now.getTime()) / 86400000);
  if (days < 0)   return { label: `${Math.abs(days)} days overdue`, color: '#ef4444' };
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
      paidToDate: paid,
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

function StatCard({ label, value, sub, subColor, icon, iconColor }: {
  label: string; value: string; sub?: string; subColor?: string; icon: string; iconColor: string;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: RADIUS, padding: 24,
      boxShadow: SHADOW_SOFT, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 130,
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = SHADOW_SOFT; }}
    >
      {/* warm orb */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${iconColor}18 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8E8E93', margin: 0 }}>{label}</p>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${iconColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fa-solid ${icon}`} style={{ color: iconColor, fontSize: 15 }} />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: '8px 0 4px', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 12, fontWeight: 500, color: subColor ?? '#9ca3af', margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
}

function SignBanner({ offer }: { offer: NonNullable<DashboardData['unsignedOffer']> }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#fff7ed,#fef3c7)',
      border: '2px solid #f97316', borderRadius: RADIUS,
      padding: '20px 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: '#f97316', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fa-solid fa-file-signature" style={{ fontSize: 20, color: '#fff' }} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#9a3412', margin: '0 0 2px' }}>Action Required: Sign Your Agreement</p>
          <p style={{ fontSize: 13, color: '#c2410c', margin: 0 }}>
            Your loan offer of <strong>{fmt(Number(offer.amount))}</strong> is ready — sign to proceed.
          </p>
        </div>
      </div>
      <button style={{ background: '#f97316', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
        Sign Now <i className="fa-solid fa-arrow-right" style={{ marginLeft: 6 }} />
      </button>
    </div>
  );
}

function LoanCard({ loan }: { loan: EnrichedLoan }) {
  const d = loan.daysUntilDue;
  const dueColor = d !== null && d < 0 ? '#ef4444' : d !== null && d <= 5 ? '#f59e0b' : '#1C1C1E';
  const dueLabel = loan.dueDateObj
    ? (d !== null && d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : fmtShortDate(loan.dueDateObj))
    : 'TBD';

  const progress = loan.totalRepaymentCalc > 0
    ? Math.min(100, Math.round((loan.paidToDate / loan.totalRepaymentCalc) * 100))
    : 0;

  return (
    <div style={{
      background: '#fff', borderRadius: RADIUS, padding: 24, boxShadow: SHADOW_SOFT,
      display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = SHADOW_SOFT; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.04em' }}>
          LOAN-{loan.id.slice(-6).toUpperCase()}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(91,33,182,0.10)', color: 'var(--color-primary)', letterSpacing: '0.04em' }}>
          ACTIVE
        </span>
      </div>

      <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>
        {fmt(loan.outstandingBalance)}
      </p>

      <div style={{ background: '#FAFAFA', borderRadius: 14, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Next Payment', value: fmt(loan.nextDueAmount) },
          { label: 'Due Date',     value: dueLabel, color: dueColor },
          { label: 'Rate p.a.',    value: `${(loan.normalizedRate * 100).toFixed(2)}%` },
          { label: 'Term',         value: `${loan.term_months} months` },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8E8E93', margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: color ?? '#1C1C1E', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Repayment Progress</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1C1C1E' }}>{progress}%</span>
        </div>
        <div style={{ height: 6, background: '#FAFAFA', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-primary)', borderRadius: 10, transition: 'width 0.6s ease' }} />
        </div>
      </div>
    </div>
  );
}

function AppItem({ app }: { app: Application }) {
  const s = STATUS_STYLE[app.status] ?? { bg: '#f3f4f6', text: '#6b7280' };
  const ic = APP_ICON[app.status] ?? { icon: 'fa-file', bg: '#f3f4f6', color: '#9ca3af' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 14,
      background: '#FAFAFA', transition: 'background 0.2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F0F0F0'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA'; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fa-solid ${ic.icon}`} style={{ color: ic.color, fontSize: 14 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {app.purpose ?? 'Personal Loan'}
        </p>
        <p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>
          APP-{app.id.slice(-6).toUpperCase()} · {fmtDate(app.created_at)}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{fmt(Number(app.amount))}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.text, letterSpacing: '0.04em' }}>
          {app.status.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader size={140} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: RADIUS, padding: 24, color: '#be123c', fontSize: 14 }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>
            Welcome back — here's your financial overview
          </p>
        </div>
        {creditCheck && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fff', borderRadius: 16, padding: '10px 18px',
            boxShadow: SHADOW_SOFT,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: scoreColor, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8E8E93', margin: 0 }}>Credit Score</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: scoreColor, margin: 0, lineHeight: 1.1 }}>
                {creditCheck.credit_score} <span style={{ fontSize: 12, fontWeight: 500, color: '#8E8E93', textTransform: 'capitalize' }}>· {creditCheck.risk_category}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sign banner */}
      {unsignedOffer && <SignBanner offer={unsignedOffer} />}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
        <StatCard label="Total Borrowed"      value={fmt(totalBorrowed)}  icon="fa-arrow-up-from-bracket" iconColor="var(--color-primary)" />
        <StatCard label="Outstanding Balance" value={fmt(currentBalance)} icon="fa-scale-balanced"        iconColor="#f59e0b" />
        <StatCard label="Total Repaid"        value={fmt(totalRepaid)}    icon="fa-circle-check"          iconColor="#10b981" />
        <StatCard
          label="Next Payment"
          value={nextPayment.hasUpcoming ? fmt(nextPayment.amount) : '—'}
          icon="fa-calendar-days"
          iconColor="#3b82f6"
          sub={npSub.label}
          subColor={npSub.color}
        />
      </div>

      {/* Active loans */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: '#1C1C1E', margin: 0 }}>Active Loans</h2>
        </div>
        {loans.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: '32px 24px', boxShadow: SHADOW_SOFT, textAlign: 'center' }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 32, color: '#e5e7eb', marginBottom: 12, display: 'block' }} />
            <p style={{ color: '#8E8E93', fontSize: 14, margin: 0 }}>No active loans at the moment.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {loans.map(loan => <LoanCard key={loan.id} loan={loan} />)}
          </div>
        )}
      </section>

      {/* Recent applications */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: '#1C1C1E', margin: 0 }}>Recent Applications</h2>
        </div>
        {applications.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: '32px 24px', boxShadow: SHADOW_SOFT, textAlign: 'center' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: 32, color: '#e5e7eb', marginBottom: 12, display: 'block' }} />
            <p style={{ color: '#8E8E93', fontSize: 14, margin: 0 }}>No applications yet.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 20, boxShadow: SHADOW_SOFT, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {applications.map(app => <AppItem key={app.id} app={app} />)}
          </div>
        )}
      </section>

    </div>
  );
}
