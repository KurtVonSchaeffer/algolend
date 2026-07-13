import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPortfolioAnalytics } from '../services/adminData';

declare global { interface Window { ApexCharts: any } }

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

export function AnalyticsPage() {
  const pieRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const pieChart = useRef<any>(null);
  const lineChart = useRef<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-portfolio'],
    queryFn: fetchPortfolioAnalytics,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data || !window.ApexCharts) return;

    const apps = data.applications ?? [];
    const statusCounts: Record<string, number> = {};
    apps.forEach((a: any) => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

    if (pieRef.current) {
      if (pieChart.current) pieChart.current.destroy();
      pieChart.current = new window.ApexCharts(pieRef.current, {
        chart: { type: 'pie', height: 260, animations: { enabled: true, speed: 700 } },
        series: Object.values(statusCounts) as number[],
        labels: Object.keys(statusCounts),
        colors: ['#F59E0B','#3B82F6','#10B981','#8B5CF6','#10B981','#EF4444'],
        legend: { position: 'bottom', fontSize: '12px' },
        dataLabels: { enabled: true },
      });
      pieChart.current.render();
    }

    // Monthly application trend
    const byMonth: Record<string, number> = {};
    apps.forEach((a: any) => {
      const key = new Date(a.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short' });
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    const entries = Object.entries(byMonth).slice(-12);

    if (lineRef.current) {
      if (lineChart.current) lineChart.current.destroy();
      lineChart.current = new window.ApexCharts(lineRef.current, {
        chart: { type: 'area', height: 220, toolbar: { show: false }, animations: { enabled: true, speed: 700 } },
        series: [{ name: 'Applications', data: entries.map(([, v]) => v) }],
        xaxis: { categories: entries.map(([k]) => k), labels: { style: { fontSize: '11px' } } },
        colors: ['var(--color-primary)'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
        stroke: { width: 2, curve: 'smooth' },
        dataLabels: { enabled: false },
      });
      lineChart.current.render();
    }

    return () => {
      pieChart.current?.destroy(); pieChart.current = null;
      lineChart.current?.destroy(); lineChart.current = null;
    };
  }, [data]);

  const apps = data?.applications ?? [];
  const totalApps = apps.length;
  const approved = apps.filter((a: any) => ['APPROVED','AWAITING_DISBURSEMENT','DISBURSED'].includes(a.status)).length;
  const convRate = totalApps > 0 ? ((approved / totalApps) * 100).toFixed(1) : '0.0';
  const totalValue = apps.reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Analytics</h1>
          <p className="page-subtitle">Application trends and conversion metrics</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
            <div className="stat-card"><span className="stat-label">Total Applications</span><div className="stat-value">{totalApps}</div></div>
            <div className="stat-card"><span className="stat-label">Approved</span><div className="stat-value" style={{ color: '#10B981' }}>{approved}</div></div>
            <div className="stat-card"><span className="stat-label">Conversion Rate</span><div className="stat-value">{convRate}%</div></div>
            <div className="stat-card"><span className="stat-label">Total Applied Value</span><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalValue)}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            <div className="chart-card">
              <p className="chart-title">Application Trend (Last 12 months)</p>
              <div ref={lineRef} />
            </div>
            <div className="chart-card">
              <p className="chart-title">Status Breakdown</p>
              <div ref={pieRef} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
