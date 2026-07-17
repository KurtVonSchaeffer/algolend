import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { Loader } from '../components/ui/loader';
import { usePageCSS } from '../hooks/usePageCSS';
import dashboardCssUrl from '../legacy-css/10-dashboard.css?url';
import { isDemoMode, DEMO_DASHBOARD } from '../demo/demoData';

// ─── types ───────────────────────────────────────────────────────────────────

interface EnrichedLoan {
  id: string;
  displayId: string;
  amount: string;
  remaining: string;
  nextPayment: string;
  dueDate: string;
  interestRate: string;
  progress: number;
  daysUntilDue: number | null;
}

interface AppItem {
  rawId: string;
  type: string;
  amount: string;
  date: string;
  status: string;
}

interface TxItem {
  id: string;
  description: string;
  date: string;
  amount: string;
}

interface Eligibility {
  eligible: boolean;
  credit_score?: number;
  band?: { label: string; color?: string; max_loan_amount: number; interest_rate_pa: number; max_term_months: number };
  first_loan_restriction?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `R ${(Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

function calcMonthly(principal: number, rate: number, months: number): number {
  const r = rate / 12;
  if (r === 0 || months === 0) return months ? principal / months : 0;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const CREDIT_SCORE_MAX = 999;

// ─── data ─────────────────────────────────────────────────────────────────────

async function fetchDashboard() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const uid = session.user.id;
  const userName = (session.user.user_metadata?.full_name as string) || '';

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
    supabase.from('loan_applications').select('id, status, amount, purpose, created_at').eq('user_id', uid).neq('status', 'OFFERED').neq('status', 'DISBURSED').order('created_at', { ascending: false }).limit(5),
    supabase.from('loan_applications').select('id, amount').eq('user_id', uid).in('status', ['OFFERED', 'CONTRACT_SIGN']).is('contract_signed_at', null).order('created_at', { ascending: false }).limit(1),
  ]);

  const paidByLoan = (payments ?? []).reduce<Record<string, number>>((a, p) => {
    a[p.loan_id] = (a[p.loan_id] ?? 0) + Number(p.amount);
    return a;
  }, {});
  const totalRepaidAll = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const now = new Date(); now.setUTCHours(0, 0, 0, 0);

  let totalBorrowed = 0, currentBalance = 0, totalRepaid = 0;
  let nextPayment = { amount: 0, date: null as string | null, hasUpcoming: false };
  let bestDue: Date | null = null;

  const loans: EnrichedLoan[] = (rawLoans ?? []).map(l => {
    const principal = Number(l.principal_amount) || 0;
    const months    = Number(l.term_months) || 1;
    const rawRate   = Number(l.interest_rate) || 0;
    const rate      = rawRate > 1 ? rawRate / 100 : rawRate;
    const monthly   = Number(l.monthly_payment) || calcMonthly(principal, rate, months);
    const totalRepayment = Number(l.total_repayment) || monthly * months || principal;
    const paid      = paidByLoan[l.id] ?? 0;
    const outstanding = Math.max(totalRepayment - paid, 0);
    const nextDue   = monthly > 0 ? Math.min(monthly, outstanding) : outstanding;

    const ds = l.next_payment_date || l.first_payment_date || l.repayment_start_date;
    let due: Date | null = ds ? new Date(ds) : null;
    if (!due && l.start_date) { due = new Date(l.start_date); due.setDate(due.getDate() + 30); }
    if (due && isNaN(due.getTime())) due = null;
    if (due) due.setUTCHours(0, 0, 0, 0);

    totalBorrowed  += principal;
    currentBalance += outstanding;
    totalRepaid    += paid;

    if (due && outstanding > 0 && (!bestDue || due < bestDue)) {
      bestDue = due;
      nextPayment = { amount: nextDue, date: due.toISOString(), hasUpcoming: true };
    }

    return {
      id: l.id,
      displayId: `LOAN-${String(l.id).slice(-6).toUpperCase()}`,
      amount: fmt(totalRepayment),
      remaining: fmt(outstanding),
      nextPayment: fmt(nextDue),
      dueDate: due ? due.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'TBD',
      interestRate: `${(rate * 100).toFixed(2)}%`,
      progress: totalRepayment > 0 ? Math.min(100, Math.round((paid / totalRepayment) * 100)) : 0,
      daysUntilDue: due ? Math.round((due.getTime() - now.getTime()) / 86400000) : null,
    };
  });

  if (!nextPayment.hasUpcoming) {
    totalRepaid = totalRepaid || totalRepaidAll;
    nextPayment.date = payments?.[0]?.payment_date ?? null;
  }

  const transactions: TxItem[] = (payments ?? []).slice(0, 5).map((p, i) => ({
    id: `${p.loan_id}-${i}`,
    description: 'Loan Repayment',
    date: new Date(p.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    amount: fmt(Number(p.amount)),
  }));

  const applications: AppItem[] = (rawApps ?? []).map(a => ({
    rawId: a.id,
    type: a.purpose || 'Personal Loan',
    amount: fmt(Number(a.amount)),
    date: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: a.status,
  }));

  // repayment series for the chart — payments bucketed by month (last 6)
  const monthly: { label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const total = (payments ?? []).filter(p => {
      const pd = new Date(p.payment_date);
      return `${pd.getFullYear()}-${pd.getMonth()}` === key;
    }).reduce((s, p) => s + Number(p.amount), 0);
    monthly.push({ label, total });
  }

  // eligibility — replicated server logic, direct Supabase (no Express needed)
  let eligibility: Eligibility | null = null;
  try {
    const { data: cc } = await supabase
      .from('credit_checks')
      .select('credit_score, checked_at')
      .eq('user_id', uid)
      .eq('status', 'completed')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cc?.credit_score) {
      const { count: prevLoans } = await supabase
        .from('loan_applications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .in('status', ['APPROVED', 'ACTIVE', 'SETTLED', 'COMPLETED']);
      const isFirstLoan = (prevLoans ?? 0) === 0;

      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      const orgId = orgs?.[0]?.id;

      if (orgId) {
        const { data: band } = await supabase
          .from('credit_score_bands')
          .select('*')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .lte('min_score', cc.credit_score)
          .gte('max_score', cc.credit_score)
          .maybeSingle();

        if (band && band.risk_level !== 'declined') {
          const effectiveTerm = (isFirstLoan && band.first_loan_max_term_months)
            ? band.first_loan_max_term_months
            : band.max_term_months;
          eligibility = {
            eligible: true,
            credit_score: cc.credit_score,
            band: {
              label: band.label,
              color: band.color,
              max_loan_amount: band.max_loan_amount,
              interest_rate_pa: band.interest_rate_pa,
              max_term_months: effectiveTerm,
            },
            first_loan_restriction: (isFirstLoan && band.first_loan_max_term_months)
              ? `First loan: max ${band.first_loan_max_term_months} month term`
              : undefined,
          };
        }
      }
    }
  } catch { /* eligibility card stays hidden */ }

  return {
    userName,
    loans, transactions, applications,
    totalBorrowed, currentBalance, totalRepaid, nextPayment,
    creditScore: creditChecks?.[0]?.credit_score ?? 0,
    unsignedOffer: unsignedOffers?.[0] ?? null,
    repaymentSeries: monthly,
    eligibility: eligibility?.eligible ? eligibility : null,
  };
}

// ─── charts (canvas, matches legacy fallback painters) ───────────────────────

function primaryColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#7C3AED';
}

function LineChart({ series }: { series: { label: string; total: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = canvas.offsetHeight * 2;
    if (W === 0 || H === 0) return;
    const pad = 40;
    const color = primaryColor();
    const max = Math.max(1, ...series.map(s => s.total));

    ctx.clearRect(0, 0, W, H);

    const pts = series.map((s, i) => ({
      x: pad + ((W - pad * 2) / Math.max(1, series.length - 1)) * i,
      y: H - pad - ((H - pad * 2) * (s.total / max)),
    }));

    // area fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `${color}44`);
    grad.addColorStop(1, `${color}00`);
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H - pad);
    ctx.lineTo(pts[0].x, H - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // points + labels
    ctx.font = '20px IBM Plex Sans, sans-serif';
    ctx.fillStyle = '#8E8E93';
    ctx.textAlign = 'center';
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#8E8E93';
      ctx.fillText(series[i].label, p.x, H - pad + 26);
    });
  }, [series]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />;
}

function DoughnutChart({ repaid, outstanding }: { repaid: number; outstanding: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = canvas.offsetHeight * 2;
    if (W === 0 || H === 0) return;
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) / 2 - 30;
    if (r <= 0) return;
    const color = primaryColor();
    const total = Math.max(1, repaid + outstanding);
    const repaidAngle = (repaid / total) * Math.PI * 2;

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = r * 0.42;

    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + repaidAngle);
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2 + repaidAngle, Math.PI * 1.5);
    ctx.strokeStyle = '#f1f5f9';
    ctx.stroke();

    ctx.font = 'bold 30px IBM Plex Sans, sans-serif';
    ctx.fillStyle = '#1C1C1E';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round((repaid / total) * 100)}%`, cx, cy - 12);
    ctx.font = '18px IBM Plex Sans, sans-serif';
    ctx.fillStyle = '#8E8E93';
    ctx.fillText('Repaid', cx, cy + 20);
  }, [repaid, outstanding]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />;
}

// ─── ring progress (legacy buildRingProgress) ─────────────────────────────────

function RingProgress({ progress, size = 52 }: { progress: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--color-primary)" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${(progress / 100) * circ} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="50%" y="54%" textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="var(--color-primary)">{progress}%</text>
    </svg>
  );
}

// ─── loan health (legacy Feature 2) ───────────────────────────────────────────

function loanHealth(days: number | null) {
  if (days === null) return { label: 'Active', icon: 'fa-circle', color: 'var(--color-primary)', bg: 'rgba(124,58,237,0.1)' };
  if (days < 0)  return { label: 'Overdue',  icon: 'fa-circle-exclamation', color: '#ef4444', bg: '#fee2e2' };
  if (days <= 5) return { label: 'Due soon', icon: 'fa-clock', color: '#d97706', bg: '#fef3c7' };
  return { label: 'On track', icon: 'fa-circle-check', color: '#059669', bg: '#d1fae5' };
}

// ─── main page (legacy dashboard.html desktop-view markup) ───────────────────

export function DashboardPage() {
  usePageCSS(dashboardCssUrl);
  const navigate = useNavigate();
  const [mobileModal, setMobileModal] = useState<'transactions' | 'applications' | null>(null);
  const [activeDot, setActiveDot] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: isDemoMode() ? () => Promise.resolve(DEMO_DASHBOARD) : fetchDashboard,
    staleTime: 60_000,
    retry: 1,
  });

  // animate credit score meter like legacy
  const scorePct = data ? Math.min(100, Math.round(((data.creditScore || 0) / CREDIT_SCORE_MAX) * 100)) : 0;

  // carousel dot tracking
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => setActiveDot(Math.round(el.scrollLeft / (el.offsetWidth || 1)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [data]);

  if (isLoading) {
    return <Loader screen size={140} />;
  }

  if (isError || !data) {
    return (
      <div className="page-container">
        <div className="content-wrapper">
          <p style={{ color: '#ef4444', padding: 24 }}>
            Could not load dashboard: {error instanceof Error ? error.message : 'unknown error'}
          </p>
        </div>
      </div>
    );
  }

  const np = data.nextPayment;
  let npDateLabel = 'No upcoming payment';
  let npDateColor = '';
  if (np.hasUpcoming && np.date) {
    const dueDate = new Date(np.date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    npDateLabel = `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    if (daysLeft < 0)       { npDateLabel = `${Math.abs(daysLeft)} days overdue`; npDateColor = '#ef4444'; }
    else if (daysLeft === 0){ npDateLabel = 'Due today!';    npDateColor = '#f59e0b'; }
    else if (daysLeft === 1){ npDateLabel = 'Due tomorrow';  npDateColor = '#f59e0b'; }
    else if (daysLeft <= 5) { npDateLabel = `Due in ${daysLeft} days`; npDateColor = '#f59e0b'; }
  } else if (np.date) {
    npDateLabel = `Last paid ${new Date(np.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  const elig = data.eligibility;

  const noActivity = data.loans.length === 0 && data.applications.length === 0;

  return (
    <div className="page-container">
      <div className="content-wrapper">

        {/* Sign agreement banner */}
        {data.unsignedOffer && (
          <div style={{ padding: '0 0 16px' }}>
            <div style={{ background: 'linear-gradient(135deg,#fff7ed,#fef3c7)', border: '2px solid #f97316', borderRadius: 18, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, background: '#f97316', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fas fa-file-signature" style={{ fontSize: 20, color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#9a3412', margin: '0 0 2px' }}>Action Required: Sign Your Agreement</p>
                  <p style={{ fontSize: 13, color: '#c2410c', margin: 0 }}>
                    Your loan offer of <strong>{fmt(Number(data.unsignedOffer.amount))}</strong> is ready — sign to proceed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/user-portal/apply')}
                style={{ background: '#f97316', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}
              >
                Sign Now <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} />
              </button>
            </div>
          </div>
        )}

        {noActivity && (
          <div style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(124,58,237,0.07), rgba(167,139,250,0.05))', border: '1.5px solid rgba(124,58,237,0.18)', borderRadius: 18, padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, background: 'rgba(124,58,237,0.12)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-rocket" style={{ fontSize: 20, color: 'var(--color-primary)' }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 3px', color: 'var(--text-main, #1C1C1E)' }}>Welcome to AlgoLend</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted, #8E8E93)', margin: 0, lineHeight: 1.5 }}>You have no active loans yet. Apply online in minutes — no paperwork, no branch visits.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/user-portal/apply')}
              style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}
            >
              Apply for a Loan <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} />
            </button>
          </div>
        )}

        <div className="dashboard-wrapper">
          <div className="dashboard-container">

            {/* ── Mobile view ── */}
            <div id="mobile-view">
              <section className="welcome-section">
                <p className="greeting-line">{greeting()}{data.userName ? `, ${data.userName.split(' ')[0]}` : ''}</p>
                <h1 className="main-title">Portfolio Overview</h1>
                <p className="date-label">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </section>

              <section className="hero-carousel-wrapper">
                <div className="hero-carousel" ref={carouselRef}>
                  {/* Card 1 — Next Payment (matches legacy order) */}
                  <div className="snap-card card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Next Payment Due</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#3b82f6', ['--badge-bg' as string]: 'rgba(59,130,246,0.10)' }}><i className="fas fa-calendar-alt" /></div>
                    </div>
                    <div className="card-value">{fmt(np.amount)}</div>
                    <div className="card-subtitle" style={npDateColor ? { color: npDateColor } : {}}>{npDateLabel}</div>
                  </div>
                  {/* Card 2 — Outstanding Balance */}
                  <div className="snap-card card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Outstanding Balance</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#7C3AED', ['--badge-bg' as string]: 'rgba(124,58,237,0.10)' }}><i className="fas fa-wallet" /></div>
                    </div>
                    <div className="card-value">{fmt(data.currentBalance)}</div>
                    <div className="card-subtitle">Total principal remaining</div>
                  </div>
                  {/* Card 3 — Total Repaid */}
                  <div className="snap-card card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Total Repaid</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#8b5cf6', ['--badge-bg' as string]: 'rgba(139,92,246,0.10)' }}><i className="fas fa-circle-check" /></div>
                    </div>
                    <div className="card-value">{fmt(data.totalRepaid)}</div>
                    <div className="card-subtitle">Successfully settled</div>
                  </div>
                  {/* Card 4 — Total Borrowed */}
                  <div className="snap-card card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Total Borrowed</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#10b981', ['--badge-bg' as string]: 'rgba(16,185,129,0.10)' }}><i className="fas fa-arrow-trend-up" /></div>
                    </div>
                    <div className="card-value">{fmt(data.totalBorrowed)}</div>
                    <div className="card-subtitle">Lifetime capacity</div>
                  </div>
                  {/* Card 5 — Credit Score */}
                  <div className="snap-card card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Credit Score</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#7C3AED', ['--badge-bg' as string]: 'rgba(124,58,237,0.10)' }}><i className="fas fa-chart-line" /></div>
                    </div>
                    <div className="card-value">{data.creditScore || '---'}</div>
                    <div className="card-subtitle">Experian Financial Standing</div>
                  </div>
                </div>
                <div className="carousel-indicators">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className={`dot${activeDot === i ? ' active' : ''}`} />
                  ))}
                </div>
              </section>

              <section className="quick-actions-row">
                <button className={`action-btn-item${noActivity ? ' btn-coach-pulse' : ''}`} onClick={() => navigate('/user-portal/apply')}>
                  <div className="action-icon-circle"><i className="fas fa-plus" /></div>
                  <span>New Loan</span>
                </button>
                <button className="action-btn-item" onClick={() => navigate('/user-portal/transactions')}>
                  <div className="action-icon-circle"><i className="fas fa-wallet" /></div>
                  <span>Pay</span>
                </button>
                <button className="action-btn-item" onClick={() => setMobileModal('transactions')}>
                  <div className="action-icon-circle"><i className="fas fa-list-ul" /></div>
                  <span>Transactions</span>
                </button>
                <button className="action-btn-item" onClick={() => setMobileModal('applications')}>
                  <div className="action-icon-circle"><i className="fas fa-file-alt" /></div>
                  <span>Applications</span>
                </button>
              </section>

              <section className="loans-section">
                <div className="section-header">
                  <h2 className="section-title">Active Loans</h2>
                  <button className="view-all-link" onClick={() => navigate('/user-portal/transactions')}>View All</button>
                </div>
                {data.loans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ width: 72, height: 72, background: 'rgba(124,58,237,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <i className="fas fa-file-contract" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main, #1C1C1E)', margin: '0 0 8px' }}>No active loans</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted, #8E8E93)', margin: '0 0 20px', lineHeight: 1.5 }}>
                      Ready to apply? Get a decision in minutes.
                    </p>
                    <button
                      onClick={() => navigate('/user-portal/apply')}
                      style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-soft))', color: 'white', border: 'none', padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.3)', fontFamily: 'inherit' }}
                    >
                      Apply for a Loan <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} />
                    </button>
                  </div>
                ) : data.loans.map(loan => (
                  <div className="loan-card-hifi" key={loan.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Loan</p>
                        <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{loan.amount}</p>
                      </div>
                      <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>Active</span>
                    </div>
                    <div className="loan-hifi-details">
                      <div className="detail-item"><span className="label">Remaining</span><span className="val">{loan.remaining}</span></div>
                      <div className="detail-item"><span className="label">Next Payment</span><span className="val">{loan.nextPayment}</span></div>
                      <div className="detail-item"><span className="label">Due Date</span><span className="val">{loan.dueDate}</span></div>
                      <div className="detail-item"><span className="label">Interest</span><span className="val">{loan.interestRate}</span></div>
                    </div>
                    <div style={{ background: '#f3f4f6', borderRadius: 100, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${loan.progress}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 100, transition: 'width 1s ease' }} />
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, textAlign: 'right' }}>{loan.progress}% repaid</p>
                  </div>
                ))}
              </section>

              {/* Slide-up modal */}
              <div id="fullScreenModal" className={`full-modal${mobileModal ? '' : ' hidden'}`}>
                <div className="modal-header-hifi">
                  <button className="modal-close-btn" onClick={() => setMobileModal(null)}>
                    <i className="fas fa-chevron-left" />
                  </button>
                  <h2 className="modal-title-mobile">
                    {mobileModal === 'transactions' ? 'Recent Transactions' : 'Applications'}
                  </h2>
                  <div style={{ width: 36 }} />
                </div>
                <div className="modal-body-content">
                  {mobileModal === 'transactions' && (
                    data.transactions.length === 0
                      ? <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>No transactions yet</p>
                      : data.transactions.map(tx => (
                          <div key={tx.id} style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px' }}>{tx.description}</p>
                              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{tx.date}</p>
                            </div>
                            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>{tx.amount}</p>
                          </div>
                        ))
                  )}
                  {mobileModal === 'applications' && (
                    data.applications.length === 0
                      ? <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>No applications yet</p>
                      : data.applications.map(app => (
                          <div key={app.rawId} style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{app.type}</p>
                              <span style={{ fontSize: 12, fontWeight: 700, background: '#f3f4f6', padding: '2px 8px', borderRadius: 10 }}>{app.status}</span>
                            </div>
                            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{app.amount} · {app.date}</p>
                          </div>
                        ))
                  )}
                </div>
              </div>
            </div>

            {/* ── Desktop view ── */}
            <div id="desktop-view">

              <div className="dashboard-header">
                <div className="header-left">
                  <p className="greeting-line">{greeting()}{data.userName ? `, ${data.userName.split(' ')[0]}` : ''}</p>
                  <h1>Portfolio Overview</h1>
                  <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="top-section">
                <div className="metrics-grid">
                  <div className="card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Outstanding Balance</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#7C3AED', ['--badge-bg' as string]: 'rgba(124,58,237,0.10)' }}><i className="fas fa-wallet" /></div>
                    </div>
                    <div className="card-value">{fmt(data.currentBalance)}</div>
                    <div className="card-subtitle">Total principal remaining</div>
                  </div>
                  <div className="card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Next Payment Due</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#3b82f6', ['--badge-bg' as string]: 'rgba(59,130,246,0.10)' }}><i className="fas fa-calendar-alt" /></div>
                    </div>
                    <div className="card-value">{fmt(np.amount)}</div>
                    <div className="card-subtitle" style={npDateColor ? { color: npDateColor } : undefined}>{npDateLabel}</div>
                  </div>
                  <div className="card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Total Borrowed</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#10b981', ['--badge-bg' as string]: 'rgba(16,185,129,0.10)' }}><i className="fas fa-arrow-trend-up" /></div>
                    </div>
                    <div className="card-value">{fmt(data.totalBorrowed)}</div>
                    <div className="card-subtitle">Lifetime capacity</div>
                  </div>
                  <div className="card ds-metric-card">
                    <div className="ds-card-header">
                      <span className="card-label">Total Repaid</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#8b5cf6', ['--badge-bg' as string]: 'rgba(139,92,246,0.10)' }}><i className="fas fa-circle-check" /></div>
                    </div>
                    <div className="card-value">{fmt(data.totalRepaid)}</div>
                    <div className="card-subtitle">Successfully settled</div>
                  </div>
                </div>

                <div className="credit-score-card card ds-metric-card">
                  <div className="ds-card-header">
                    <span className="card-label">Credit Score</span>
                    <div className="card-icon-badge" style={{ ['--badge-color' as string]: '#7C3AED', ['--badge-bg' as string]: 'rgba(124,58,237,0.10)' }}><i className="fas fa-chart-line" /></div>
                  </div>
                  <div className="card-value">{data.creditScore || 0}</div>
                  <div className="card-subtitle">Experian Financial Standing</div>
                  <div className="score-meter">
                    <div className="score-fill" style={{ width: `${scorePct}%` }} />
                  </div>
                </div>

                {elig?.band && (
                  <div className="card ds-metric-card" id="eligibilityCard">
                    <div className="ds-card-header">
                      <span className="card-label">My Eligibility</span>
                      <div className="card-icon-badge" style={{ ['--badge-color' as string]: elig.band.color || '#10b981', ['--badge-bg' as string]: `${elig.band.color || '#10b981'}1a` }}><i className="fas fa-shield-halved" /></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: elig.band.color || '#10b981', flexShrink: 0 }} />
                      <span className="card-value" style={{ fontSize: 22 }}>{elig.band.label}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: 'Max Loan', value: `R ${Number(elig.band.max_loan_amount || 0).toLocaleString()}` },
                        { label: 'Rate p.a.', value: `${elig.band.interest_rate_pa || 0}%` },
                        { label: 'Max Term', value: `${elig.band.max_term_months || 0} mo` },
                        { label: 'Score', value: String(elig.credit_score ?? '—') },
                      ].map(i => (
                        <div key={i.label} style={{ background: '#f8f8f8', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '.05em' }}>{i.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{i.value}</div>
                        </div>
                      ))}
                    </div>
                    {elig.first_loan_restriction && (
                      <div style={{ background: '#fff8ed', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                        <i className="fas fa-star" /> {elig.first_loan_restriction}
                      </div>
                    )}
                    <button
                      onClick={() => navigate('/user-portal/apply')}
                      style={{ marginTop: 10, width: '100%', padding: 10, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-soft))', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Apply Now <i className="fas fa-arrow-right" />
                    </button>
                  </div>
                )}
              </div>

              <div className="quick-actions-section">
                <div className="section-title-bar">
                  <h2>Quick Actions</h2>
                </div>
                <div className="quick-actions-grid">
                  <button className={`action-card${noActivity ? ' btn-coach-pulse' : ''}`} onClick={() => navigate('/user-portal/apply')}>
                    <div className="action-icon-wrapper"><i className="fas fa-plus" /></div>
                    <div className="action-text-block">
                      <div className="action-title">New Loan</div>
                      <div className="action-subtitle">Apply for a new loan</div>
                    </div>
                  </button>
                  <button className="action-card" onClick={() => navigate('/user-portal/transactions')}>
                    <div className="action-icon-wrapper"><i className="fas fa-wallet" /></div>
                    <div className="action-text-block">
                      <div className="action-title">Make Payment</div>
                      <div className="action-subtitle">Process a payment</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="loans-section">
                <div className="section-title-bar">
                  <h2>Active Loans</h2>
                  <button className="btn-view-all" onClick={() => navigate('/user-portal/transactions')}>View All →</button>
                </div>
                <div id="activeLoansGridWrapper">
                  <div className="loans-grid">
                    {data.loans.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px', gridColumn: '1/-1' }}>
                        <div style={{ width: 72, height: 72, background: 'rgba(124,58,237,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <i className="fas fa-file-contract" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main, #1C1C1E)', margin: '0 0 8px' }}>No active loans</h3>
                        <p style={{ fontSize: 14, color: 'var(--text-muted, #8E8E93)', margin: '0 0 20px', lineHeight: 1.5 }}>
                          Ready to apply? Get a decision in minutes.
                        </p>
                        <button
                          onClick={() => navigate('/user-portal/apply')}
                          style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-soft))', color: 'white', border: 'none', padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.3)', fontFamily: 'inherit' }}
                        >
                          Apply for a Loan <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} />
                        </button>
                      </div>
                    ) : data.loans.map(loan => {
                      const health = loanHealth(loan.daysUntilDue);
                      const urgent = loan.daysUntilDue !== null && loan.daysUntilDue < 0;
                      return (
                        <div className="loan-card" key={loan.id} style={urgent ? { border: '2px solid #fecaca' } : undefined}>
                          <div className="loan-header">
                            <span className="loan-id">{loan.displayId}</span>
                            <span style={{ background: health.bg, color: health.color, padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <i className={`fas ${health.icon}`} style={{ fontSize: 9 }} />{health.label}
                            </span>
                          </div>

                          <div className="loan-amount">{loan.amount}</div>

                          <div className="loan-details-grid">
                            <div className="loan-detail"><div className="loan-detail-label">Remaining</div><div className="loan-detail-value">{loan.remaining}</div></div>
                            <div className="loan-detail"><div className="loan-detail-label">Next Payment</div><div className="loan-detail-value">{loan.nextPayment}</div></div>
                            <div className="loan-detail"><div className="loan-detail-label">Due Date</div><div className="loan-detail-value">{loan.dueDate}</div></div>
                            <div className="loan-detail"><div className="loan-detail-label">Interest Rate</div><div className="loan-detail-value">{loan.interestRate}</div></div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 4px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, flexShrink: 0 }}>
                              <RingProgress progress={loan.progress} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #8E8E93)', marginBottom: 6 }}>
                                <span>Repayment Progress</span><span>{loan.progress}%</span>
                              </div>
                              <div className="progress-bar"><div className="progress-fill" style={{ width: `${loan.progress}%` }} /></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bottom-grid">
                <div className="transactions-section">
                  <div className="section-title-bar">
                    <h2>Recent Transactions</h2>
                    <button className="btn-view-all" onClick={() => navigate('/user-portal/transactions')}>View All →</button>
                  </div>
                  <div className="transaction-list">
                    {data.transactions.length === 0 ? (
                      <p style={{ color: 'var(--text-muted, #8E8E93)', textAlign: 'center', padding: 20 }}>No transactions yet</p>
                    ) : data.transactions.map(tx => (
                      <div className="transaction-item" key={tx.id}>
                        <div className="transaction-icon outbound"><i className="fas fa-arrow-up" /></div>
                        <div className="item-details">
                          <div className="item-title">{tx.description}</div>
                          <div className="item-date">{tx.date}</div>
                        </div>
                        <div className="item-amount outbound">{tx.amount}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="applications-section">
                  <div className="section-title-bar">
                    <h2>Recent Applications</h2>
                    <button className="btn-view-all" onClick={() => navigate('/user-portal/transactions')}>View All →</button>
                  </div>
                  <div className="application-list">
                    {data.applications.length === 0 ? (
                      <p style={{ color: 'var(--text-muted, #8E8E93)', textAlign: 'center', padding: 20 }}>No applications yet</p>
                    ) : data.applications.map(app => (
                      <div className="application-item" key={app.rawId}>
                        <div className={`application-icon ${app.status.toLowerCase()}`}>
                          <i className={`fas fa-${app.status === 'APPROVED' ? 'check' : app.status === 'PENDING' ? 'clock' : 'file-alt'}`} />
                        </div>
                        <div className="item-details">
                          <div className="item-title">{app.type}</div>
                          <div className="item-date">{app.date}</div>
                        </div>
                        <span className="status-badge" style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)', padding: '4px 12px', borderRadius: 50, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                          {app.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="charts-section">
                <div className="chart-card">
                  <div className="section-title-bar">
                    <h2>Repayment Trends</h2>
                  </div>
                  <div className="chart-container">
                    <LineChart series={data.repaymentSeries} />
                  </div>
                </div>

                <div className="chart-card">
                  <div className="section-title-bar">
                    <h2>Loan Breakdown</h2>
                  </div>
                  <div className="chart-container">
                    <DoughnutChart repaid={data.totalRepaid} outstanding={data.currentBalance} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>

  );
}
