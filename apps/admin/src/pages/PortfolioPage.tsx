import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

declare global { interface Window { ApexCharts: any } }

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtR   = (v: number) => `R ${Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${Number(v || 0).toFixed(1)}%`;
const fmtN   = (v: number) => Number(v || 0).toLocaleString('en-ZA');
const fmt    = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

// ── Mock data ────────────────────────────────────────────────────────────────

interface PortfolioSummary {
  active_count: number;
  book_value: number;
  principal_book: number;
  npl_ratio_pct: number;
  npl_count: number;
  npl_value: number;
  yield_pct: number;
}

interface AgingBuckets {
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
}

interface MonthlyDisbursement {
  month: string;
  amount: number;
  count: number;
}

interface PortfolioMetrics {
  summary: PortfolioSummary;
  aging: AgingBuckets;
  monthly_disbursements: MonthlyDisbursement[];
}

const MOCK_PORTFOLIO: PortfolioMetrics = {
  summary: {
    active_count:    487,
    book_value:      4_720_000,
    principal_book:  3_890_000,
    npl_ratio_pct:   6.2,
    npl_count:       31,
    npl_value:       283_000,
    yield_pct:       22.4,
  },
  aging: {
    d1_30:   14,
    d31_60:   9,
    d61_90:   5,
    d90plus:  3,
  },
  monthly_disbursements: [
    { month: '2025-08', amount: 285_000, count: 18 },
    { month: '2025-09', amount: 312_000, count: 21 },
    { month: '2025-10', amount: 298_000, count: 19 },
    { month: '2025-11', amount: 345_000, count: 24 },
    { month: '2025-12', amount: 278_000, count: 17 },
    { month: '2026-01', amount: 421_000, count: 28 },
    { month: '2026-02', amount: 389_000, count: 26 },
    { month: '2026-03', amount: 412_000, count: 27 },
    { month: '2026-04', amount: 456_000, count: 31 },
    { month: '2026-05', amount: 498_000, count: 33 },
    { month: '2026-06', amount: 523_000, count: 35 },
    { month: '2026-07', amount: 487_000, count: 32 },
  ],
};

// ── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
}

function KpiCard({ label, value, sub, color = '#6D28D9', icon = 'payments' }: KpiCardProps) {
  return (
    <div className="glass-card" style={{ borderRadius: 20, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color }}>
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

interface AgingBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function AgingBar({ label, value, total, color }: AgingBarProps) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 72, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, background: 'var(--color-surface-muted)', borderRadius: 999, height: 8 }}>
        <div style={{ height: 8, borderRadius: 999, width: `${pct}%`, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ width: 28, fontSize: 12, fontWeight: 700, textAlign: 'right', color }}>{value}</div>
    </div>
  );
}

interface QuickLinkProps {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

function QuickLink({ icon, iconColor, title, subtitle, onClick }: QuickLinkProps) {
  return (
    <div
      className="glass-card"
      onClick={onClick}
      style={{ borderRadius: 20, padding: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s, box-shadow 0.15s' }}
      onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(109,40,217,0.10)'; }}
      onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>
      <span className="material-symbols-outlined" style={{ fontSize: 24, color: iconColor }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function PortfolioPage() {
  const navigate = useNavigate();
  const chartRef  = useRef<HTMLDivElement>(null);
  const chartInst = useRef<any>(null);

  const { data, isLoading } = useQuery<PortfolioMetrics>({
    queryKey: ['admin-portfolio-metrics'],
    queryFn: () => Promise.resolve(MOCK_PORTFOLIO),
    staleTime: 60_000,
  });

  // Build ApexCharts disbursement bar chart
  useEffect(() => {
    if (!data || !chartRef.current || !window.ApexCharts) return;

    const months = data.monthly_disbursements;
    const categories = months.map(m => {
      const d = new Date(m.month + '-01');
      return d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
    });
    const amounts = months.map(m => m.amount);

    if (chartInst.current) chartInst.current.destroy();
    chartInst.current = new window.ApexCharts(chartRef.current, {
      chart: {
        type: 'bar',
        height: 200,
        toolbar: { show: false },
        animations: { enabled: true, speed: 700 },
        background: 'transparent',
      },
      series: [{ name: 'Disbursed', data: amounts }],
      xaxis: {
        categories,
        labels: { style: { fontSize: '10px', colors: '#9ca3af' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => `R${(v / 1000).toFixed(0)}k`,
          style: { fontSize: '10px', colors: '#9ca3af' },
        },
      },
      colors: ['#6D28D9'],
      plotOptions: { bar: { borderRadius: 5, columnWidth: '65%' } },
      dataLabels: { enabled: false },
      grid: { borderColor: 'rgba(0,0,0,0.05)', strokeDashArray: 4 },
      tooltip: {
        y: {
          formatter: (v: number, opts: any) => {
            const count = months[opts.dataPointIndex]?.count ?? 0;
            return `${fmt(v)}  (${count} loans)`;
          },
        },
      },
    });
    chartInst.current.render();

    return () => { chartInst.current?.destroy(); chartInst.current = null; };
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)' }}>analytics</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)', margin: 0 }}>Portfolio Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>Live book metrics, NPL aging, yield, and disbursement trends</p>
          </div>
        </div>
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading portfolio metrics…
        </div>
      </div>
    );
  }

  const { summary, aging, monthly_disbursements } = data ?? MOCK_PORTFOLIO;

  const nplColor =
    summary.npl_ratio_pct > 10 ? '#ef4444' :
    summary.npl_ratio_pct > 5  ? '#f59e0b' :
                                  '#10b981';

  const totalNpl = aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90plus;
  const totalMonths = monthly_disbursements.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)' }}>analytics</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)', margin: 0 }}>Portfolio Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Live book metrics, NPL aging, yield, and disbursement trends
            </p>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, paddingTop: 6 }}>
          {totalMonths} months · {fmtN(summary.active_count)} active loans
        </div>
      </div>

      {/* ── KPI grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
        <KpiCard
          label="Active Loans"
          value={fmtN(summary.active_count)}
          color="#6D28D9"
          icon="receipt_long"
        />
        <KpiCard
          label="Book Value"
          value={fmtR(summary.book_value)}
          sub={`Principal: ${fmtR(summary.principal_book)}`}
          color="#10b981"
          icon="account_balance"
        />
        <KpiCard
          label="NPL Ratio"
          value={fmtPct(summary.npl_ratio_pct)}
          sub={`${fmtN(summary.npl_count)} loans · ${fmtR(summary.npl_value)}`}
          color={nplColor}
          icon="trending_down"
        />
        <KpiCard
          label="Portfolio Yield"
          value={fmtPct(summary.yield_pct)}
          sub="Total interest / principal"
          color="#8b5cf6"
          icon="percent"
        />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

        {/* Monthly disbursements */}
        <div className="glass-card" style={{ borderRadius: 20, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>
            Monthly Disbursements — Last {totalMonths} Months
          </h3>
          <div ref={chartRef} />
        </div>

        {/* Arrears aging buckets */}
        <div className="glass-card" style={{ borderRadius: 20, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>
            Arrears Aging Buckets
          </h3>
          {totalNpl === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
              No accounts in arrears.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <AgingBar label="1–30 days"  value={aging.d1_30}   total={totalNpl} color="#f59e0b" />
                <AgingBar label="31–60 days" value={aging.d31_60}  total={totalNpl} color="#f97316" />
                <AgingBar label="61–90 days" value={aging.d61_90}  total={totalNpl} color="#ef4444" />
                <AgingBar label="90+ days"   value={aging.d90plus} total={totalNpl} color="#7f1d1d" />
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 14 }}>
                {fmtN(totalNpl)} accounts in arrears or default
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <QuickLink
          icon="menu_book"
          iconColor="#6D28D9"
          title="Loan Book"
          subtitle="Full portfolio with aging, collections mode"
          onClick={() => navigate('/loan-book')}
        />
        <QuickLink
          icon="assignment"
          iconColor="#8b5cf6"
          title="NCR Reporting"
          subtitle="Form 39 &amp; 40 statutory returns"
          onClick={() => navigate('/ncr-reporting')}
        />
        <QuickLink
          icon="checklist"
          iconColor="#10b981"
          title="Compliance Tracker"
          subtitle="Annual NCR/FICA compliance checklist"
          onClick={() => navigate('/compliance-tracker')}
        />
      </div>

    </div>
  );
}
