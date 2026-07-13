import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPortfolioAnalytics } from '../services/adminData';

declare global { interface Window { ApexCharts: any } }

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

export function FinancialsPage() {
  const barRef = useRef<HTMLDivElement>(null);
  const barChart = useRef<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-portfolio'],
    queryFn: fetchPortfolioAnalytics,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data || !barRef.current || !window.ApexCharts) return;

    const payments = data.payments ?? [];
    const byMonth: Record<string, number> = {};
    payments.filter((p: any) => p.status === 'confirmed').forEach((p: any) => {
      const key = new Date(p.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short' });
      byMonth[key] = (byMonth[key] || 0) + (Number(p.amount) || 0);
    });
    const entries = Object.entries(byMonth).slice(-12);

    if (barChart.current) barChart.current.destroy();
    barChart.current = new window.ApexCharts(barRef.current, {
      chart: { type: 'bar', height: 260, toolbar: { show: false }, animations: { enabled: true, speed: 700 } },
      series: [{ name: 'Collections', data: entries.map(([, v]) => v) }],
      xaxis: { categories: entries.map(([k]) => k), labels: { style: { fontSize: '11px' } } },
      yaxis: { labels: { formatter: (v: number) => `R${(v / 1000).toFixed(0)}k` } },
      colors: ['#10B981'],
      plotOptions: { bar: { borderRadius: 6 } },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v: number) => fmt(v) } },
    });
    barChart.current.render();
    return () => { barChart.current?.destroy(); barChart.current = null; };
  }, [data]);

  const payments = data?.payments ?? [];
  const loans = data?.loans ?? [];
  const confirmed = payments.filter((p: any) => p.status === 'confirmed');
  const totalCollected = confirmed.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const totalDisbursed = loans.reduce((s: number, l: any) => s + (Number(l.principal_amount) || 0), 0);
  const margin = totalDisbursed > 0 ? (((totalCollected - totalDisbursed) / totalDisbursed) * 100).toFixed(1) : '0.0';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Financials</h1>
          <p className="page-subtitle">Revenue and collection performance</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
            <div className="stat-card"><span className="stat-label">Total Disbursed</span><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalDisbursed)}</div></div>
            <div className="stat-card"><span className="stat-label">Total Collected</span><div className="stat-value" style={{ fontSize: 18, color: '#10B981' }}>{fmt(totalCollected)}</div></div>
            <div className="stat-card"><span className="stat-label">Profit Margin</span><div className="stat-value" style={{ color: Number(margin) >= 0 ? '#10B981' : '#EF4444' }}>{margin}%</div></div>
            <div className="stat-card"><span className="stat-label">Total Payments</span><div className="stat-value">{confirmed.length}</div></div>
          </div>

          <div className="chart-card">
            <p className="chart-title">Monthly Collections (Last 12 months)</p>
            <div ref={barRef} />
          </div>
        </>
      )}
    </>
  );
}
