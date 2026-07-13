import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData, fetchPipelineApplications } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_ORDER = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'AWAITING_DISBURSEMENT'];
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  AWAITING_DISBURSEMENT: 'Awaiting Disbursement',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  UNDER_REVIEW: '#3B82F6',
  APPROVED: '#10B981',
  AWAITING_DISBURSEMENT: '#8B5CF6',
};

declare global {
  interface Window {
    ApexCharts: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const donutRef = useRef<HTMLDivElement>(null);
  const donutChart = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [activeTab, setActiveTab] = useState<'pipeline' | 'table'>('pipeline');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 60_000,
  });

  const { data: pipelineData } = useQuery({
    queryKey: ['admin-pipeline'],
    queryFn: fetchPipelineApplications,
    staleTime: 60_000,
  });

  const pipeline = pipelineData?.data ?? [];

  // Group by status
  const grouped = STATUS_ORDER.reduce<Record<string, typeof pipeline>>((acc, s) => {
    acc[s] = pipeline.filter(a => a.status === s);
    return acc;
  }, {});

  // Portfolio donut chart
  useEffect(() => {
    if (!stats || !donutRef.current || !window.ApexCharts) return;
    const series = stats.portfolio.map(p => p.value);
    const labels = stats.portfolio.map(p => p.name);
    if (donutChart.current) donutChart.current.destroy();
    donutChart.current = new window.ApexCharts(donutRef.current, {
      chart: { type: 'donut', height: 200, animations: { enabled: true, easing: 'easeinout', speed: 800 } },
      series,
      labels,
      colors: ['#10B981', '#EF4444', '#6366F1'],
      legend: { position: 'bottom', fontSize: '12px' },
      plotOptions: { pie: { donut: { size: '65%' } } },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v: number) => `${v} loans` } },
    });
    donutChart.current.render();
    return () => { donutChart.current?.destroy(); donutChart.current = null; };
  }, [stats]);

  const statCards = stats
    ? [
        { label: 'Total Disbursed', value: fmt(stats.totalDisbursed), icon: 'payments', color: '#6366F1' },
        { label: 'Total Collected', value: fmt(stats.totalCollected), icon: 'savings', color: '#10B981' },
        { label: 'Active Loans', value: stats.activeLoans.toString(), icon: 'account_balance', color: '#F59E0B' },
        { label: 'Pending Apps', value: stats.pendingApps.toString(), icon: 'pending_actions', color: '#3B82F6' },
        { label: 'Profit Margin', value: `${stats.profitMargin}%`, icon: 'trending_up', color: '#8B5CF6' },
      ]
    : [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of AlgoLend operations</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/create-application')}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          New Application
        </button>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map(c => (
            <div key={c.label} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="stat-label">{c.label}</span>
                <span className="material-symbols-outlined" style={{ color: c.color, fontSize: 22 }}>{c.icon}</span>
              </div>
              <div className="stat-value">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
        {/* Pipeline / Table */}
        <div>
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            <button className={`tab-btn${activeTab === 'pipeline' ? ' active' : ''}`} onClick={() => setActiveTab('pipeline')}>Pipeline View</button>
            <button className={`tab-btn${activeTab === 'table' ? ' active' : ''}`} onClick={() => setActiveTab('table')}>Table View</button>
          </div>

          {activeTab === 'pipeline' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, paddingTop: 16 }}>
              {STATUS_ORDER.map(status => (
                <div key={status} className="pipeline-col">
                  <div className="pipeline-col-header">
                    <span>{STATUS_LABEL[status]}</span>
                    <span style={{
                      background: STATUS_COLOR[status] + '22',
                      color: STATUS_COLOR[status],
                      padding: '1px 8px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                    }}>{grouped[status]?.length ?? 0}</span>
                  </div>
                  {grouped[status]?.map(app => (
                    <div
                      key={app.id}
                      className="pipeline-card"
                      onClick={() => navigate(`/applications/${app.id}`)}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4, color: 'var(--color-text)' }}>
                        {(app.profiles as any)?.full_name ?? 'Unknown'}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[status] }}>
                        {fmt(Number(app.amount) || 0)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {new Date(app.created_at).toLocaleDateString('en-ZA')}
                      </div>
                    </div>
                  ))}
                  {grouped[status]?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--color-text-muted)', opacity: 0.5 }}>
                      Empty
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-table-wrap" style={{ marginTop: 16 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.length === 0 ? (
                    <tr><td colSpan={5} className="empty-state"><p>No active applications</p></td></tr>
                  ) : pipeline.map(app => (
                    <tr key={app.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/applications/${app.id}`)}>
                      <td>{(app.profiles as any)?.full_name ?? '—'}</td>
                      <td>{fmt(Number(app.amount) || 0)}</td>
                      <td>
                        <span className="badge" style={{
                          background: STATUS_COLOR[app.status] + '22',
                          color: STATUS_COLOR[app.status],
                        }}>
                          {STATUS_LABEL[app.status] ?? app.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                        {new Date(app.created_at).toLocaleDateString('en-ZA')}
                      </td>
                      <td>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>chevron_right</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Portfolio donut */}
        <div className="chart-card">
          <p className="chart-title">Portfolio Status</p>
          <div ref={donutRef} />
          {!stats && <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}
        </div>
      </div>
    </>
  );
}
