import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPortfolioAnalytics } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

declare global { interface Window { ApexCharts: any } }

export function PortfolioPage() {
  const barRef = useRef<HTMLDivElement>(null);
  const barChart = useRef<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-portfolio'],
    queryFn: fetchPortfolioAnalytics,
    staleTime: 60_000,
  });

  const loans = data?.loans ?? [];
  const totalPrincipal = loans.reduce((s: number, l: any) => s + (Number(l.principal_amount) || 0), 0);
  const totalOutstanding = loans.filter((l: any) => l.status === 'active').reduce((s: number, l: any) => s + (Number(l.outstanding_balance ?? l.principal_amount) || 0), 0);
  const nplCount = loans.filter((l: any) => l.status === 'default' || l.status === 'arrears').length;
  const nplRatio = loans.length > 0 ? ((nplCount / loans.length) * 100).toFixed(1) : '0.0';

  // Monthly disbursement bar chart
  useEffect(() => {
    if (!data || !barRef.current || !window.ApexCharts) return;

    const byMonth: Record<string, number> = {};
    loans.forEach((l: any) => {
      const key = new Date(l.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short' });
      byMonth[key] = (byMonth[key] || 0) + (Number(l.principal_amount) || 0);
    });
    const entries = Object.entries(byMonth).slice(-12);

    if (barChart.current) barChart.current.destroy();
    barChart.current = new window.ApexCharts(barRef.current, {
      chart: { type: 'bar', height: 240, toolbar: { show: false }, animations: { enabled: true, speed: 700 } },
      series: [{ name: 'Disbursed', data: entries.map(([, v]) => v) }],
      xaxis: { categories: entries.map(([k]) => k), labels: { style: { fontSize: '11px' } } },
      yaxis: { labels: { formatter: (v: number) => `R${(v / 1000).toFixed(0)}k` } },
      colors: ['var(--color-primary)'],
      plotOptions: { bar: { borderRadius: 6 } },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v: number) => fmt(v) } },
    });
    barChart.current.render();
    return () => { barChart.current?.destroy(); barChart.current = null; };
  }, [data, loans]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-subtitle">Loan portfolio analytics and health</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
            <div className="stat-card"><span className="stat-label">Total Loans</span><div className="stat-value">{loans.length}</div></div>
            <div className="stat-card"><span className="stat-label">Total Disbursed</span><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalPrincipal)}</div></div>
            <div className="stat-card"><span className="stat-label">Outstanding</span><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalOutstanding)}</div></div>
            <div className="stat-card"><span className="stat-label">NPL Ratio</span><div className="stat-value" style={{ color: Number(nplRatio) > 5 ? '#EF4444' : '#10B981' }}>{nplRatio}%</div></div>
          </div>

          <div className="chart-card">
            <p className="chart-title">Monthly Disbursements (Last 12 months)</p>
            <div ref={barRef} />
          </div>
        </>
      )}
    </>
  );
}
