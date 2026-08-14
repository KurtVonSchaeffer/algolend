import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';
import { useCountUp } from '../hooks/useCountUp';
import { useToast } from '../components/ui/Toast';
import {
  fetchDashboardData,
  fetchPipelineApplications,
  fetchMonthlyLoanPerformance,
  fetchFinancialTrends,
  fetchAdvancedAnalytics,
  fetchComplianceTasks,
} from '../services/adminData';

/* ─── constants ─── */
declare global { interface Window { ApexCharts: any } }

const PRIMARY = '#6D28D9';
const PALETTE = {
  orange:  '#E7762E',
  teal:    '#0D9488',
  indigo:  '#6366F1',
  rose:    '#F43F5E',
  amber:   '#F59E0B',
  sky:     '#0EA5E9',
  emerald: '#10B981',
  purple:  '#A855F7',
};
const ANIM = { enabled: true, easing: 'easeinout' as const, speed: 900, animateGradually: { enabled: true, delay: 120 } };

const fmtCompact = (n: number) => {
  if (!n) return 'R 0';
  if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `R ${(n / 1_000).toFixed(0)}K`;
  return `R ${n}`;
};
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const today = new Date().toLocaleDateString('en-ZA', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});

function loadApex(): Promise<void> {
  if (window.ApexCharts) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/apexcharts';
    s.onload = () => res();
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function filterByRange<T extends Record<string, any>>(data: T[], key: string, range: string): T[] {
  if (!data || range === 'ALL') return data;
  const now = new Date();
  let start = new Date();
  if (range === '1M')  start.setMonth(now.getMonth() - 1);
  if (range === '3M')  start.setMonth(now.getMonth() - 3);
  if (range === '6M')  start.setMonth(now.getMonth() - 6);
  if (range === '1Y')  start.setFullYear(now.getFullYear() - 1);
  if (range === 'YTD') start = new Date(now.getFullYear(), 0, 1);
  return data.filter(d => new Date(d[key]) >= start);
}

/* ─── TabGroup ─── */
function TabGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="dash-tab-group">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          className={`dash-tab-btn${value === opt ? ' active' : ''}`}
          onClick={() => onChange(opt)}
        >{opt}</button>
      ))}
    </div>
  );
}

/* ─── ChartHeader ─── */
function ChartHeader({
  icon, iconBg, iconColor = PRIMARY, title, subtitle, right,
}: {
  icon: string; iconBg?: string; iconColor?: string;
  title: string; subtitle: string; right?: React.ReactNode;
}) {
  return (
    <div className="dash-chart-header">
      <div className="dash-chart-header-left">
        <div className="dash-chart-icon" style={iconBg ? { background: iconBg } : undefined}>
          <span className="material-symbols-outlined" style={{ color: iconColor, fontSize: 20 }}>{icon}</span>
        </div>
        <div>
          <p className="dash-chart-title">{title}</p>
          <p className="dash-chart-subtitle">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

/* ─── Sparkline ─── */
function Sparkline({ data, color = '#7C3AED' }: { data: number[]; color?: string }) {
  const W = 80, H = 32;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / range) * (H - 4) - 2,
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fill = `${line} L ${W},${H} L 0,${H} Z`;
  const uid = color.replace(/[^a-z0-9]/gi, '');
  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── EmptyChart ─── */
function EmptyChart({ msg = 'No data yet' }: { msg?: string }) {
  return (
    <div className="chart-empty">
      <span className="material-symbols-outlined">bar_chart</span>
      <p>{msg}</p>
      <span>Data will appear once loans are processed</span>
    </div>
  );
}

/* ─── CountUpKPI: animates a number and formats it ─── */
function CountUpKPI({ raw, format }: { raw: number; format: (n: number) => string }) {
  const value = useCountUp(raw);
  return <>{format(value)}</>;
}

/* ─── KPI skeleton card ─── */
function KpiSkeleton() {
  return (
    <div className="dash-kpi-card" style={{ gap: 12 }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-text" style={{ width: '55%', marginBottom: 10 }} />
        <div className="skeleton" style={{ width: '70%', height: 36, borderRadius: 8, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function DashboardPage() {
  const navigate = useNavigate();
  const { success: toastSuccess } = useToast();
  const [userName,     setUserName]     = useState('Admin');
  const [apexReady,    setApexReady]    = useState(false);
  const [velRange,     setVelRange]     = useState('1Y');
  const [vinRange,     setVinRange]     = useState('ALL');
  const [trendRange,   setTrendRange]   = useState('1Y');

  /* chart refs */
  const velocityRef = useRef<HTMLDivElement>(null);
  const donutRef    = useRef<HTMLDivElement>(null);
  const vintageRef  = useRef<HTMLDivElement>(null);
  const riskRef     = useRef<HTMLDivElement>(null);
  const funnelRef   = useRef<HTMLDivElement>(null);
  const comboRef    = useRef<HTMLDivElement>(null);
  const radialRef   = useRef<HTMLDivElement>(null);
  const growthRef   = useRef<HTMLDivElement>(null);

  /* chart instances */
  const velChart    = useRef<any>(null);
  const donutChart  = useRef<any>(null);
  const vinChart    = useRef<any>(null);
  const riskChart   = useRef<any>(null);
  const funnelChart = useRef<any>(null);
  const comboChart  = useRef<any>(null);
  const radialChart = useRef<any>(null);
  const growthChart = useRef<any>(null);

  const DEMO_STATS = {
    totalDisbursed: 24000, totalCollected: 500, profitMargin: '0.0',
    activeLoans: 5, pendingApps: 9,
    portfolio: [{ name: 'Active', value: 5 }, { name: 'Default', value: 0 }, { name: 'Repaid', value: 0 }],
  };
  const isDemo = typeof localStorage !== 'undefined' && localStorage.getItem('algolend_demo') === '1';

  /* data */
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      if (isDemo) return DEMO_STATS;
      try { return await fetchDashboardData() ?? DEMO_STATS; } catch { return DEMO_STATS; }
    },
    staleTime: 60_000,
  });
  const { data: pipelineRes } = useQuery({ queryKey: ['admin-pipeline'], queryFn: fetchPipelineApplications, staleTime: 60_000 });
  const { data: monthlyRes } = useQuery({ queryKey: ['admin-monthly'], queryFn: fetchMonthlyLoanPerformance, staleTime: 300_000 });
  const { data: trendsRes } = useQuery({ queryKey: ['admin-trends'], queryFn: fetchFinancialTrends, staleTime: 300_000 });
  const { data: advancedRes } = useQuery({ queryKey: ['admin-advanced'], queryFn: fetchAdvancedAnalytics, staleTime: 300_000 });
  const { data: complianceRes } = useQuery({ queryKey: ['compliance-tasks'], queryFn: fetchComplianceTasks, staleTime: 60_000 });

  const pipeline   = pipelineRes?.data ?? [];
  const monthly    = monthlyRes?.data ?? [];
  const trends     = trendsRes?.data ?? [];
  const riskMatrix = advancedRes?.data?.risk_matrix ?? [];
  const vintage    = advancedRes?.data?.vintage ?? [];
  const pendingCount = stats?.pendingApps ?? 0;
  const cashFlow   = (stats?.totalCollected ?? 0) - (stats?.totalDisbursed ?? 0);

  const allComplianceTasks: any[] = complianceRes?.data ?? [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const activeTasks = allComplianceTasks.filter(t => t.status !== 'COMPLETED');
  const overdueAlerts = activeTasks.filter(t => new Date(t.due_date) < today).sort((a, b) => {
    const p: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (p[a.priority] ?? 3) - (p[b.priority] ?? 3);
  });
  const upcomingAlerts = activeTasks.filter(t => { const d = new Date(t.due_date); return d >= today && d <= in7; });
  const complianceAlerts = [...overdueAlerts, ...upcomingAlerts].slice(0, 3);

  /* load user name */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserName((user.user_metadata?.full_name as string)?.split(' ')[0] ?? 'Admin');
    });
  }, []);

  /* load ApexCharts */
  useEffect(() => { loadApex().then(() => setApexReady(true)).catch(() => {}); }, []);

  /* ── Velocity chart (line/area) ── */
  useEffect(() => {
    if (!apexReady || !velocityRef.current) return;
    const data = filterByRange(monthly, 'month_year', velRange);
    velChart.current?.destroy();
    if (!data.length) { if (velocityRef.current) velocityRef.current.innerHTML = ''; return; }
    velChart.current = new window.ApexCharts(velocityRef.current, {
      chart: { type: 'line', height: 300, toolbar: { show: false }, fontFamily: 'Inter', zoom: { enabled: false }, animations: ANIM },
      series: [
        { name: 'Lent Out',  type: 'area', data: data.map(d => d.disbursed_amount) },
        { name: 'Paid Back', type: 'area', data: data.map(d => d.repaid_amount) },
      ],
      colors: [PRIMARY, PALETTE.teal],
      stroke: { width: 3, curve: 'smooth' },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
      labels: data.map(d => d.month_year),
      xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      yaxis: { labels: { formatter: (v: number) => fmtCompact(v), style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', fontWeight: '600' },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v: number) => fmtCurrency(v) } },
    });
    velChart.current.render();
    return () => { velChart.current?.destroy(); velChart.current = null; };
  }, [apexReady, monthly, velRange]);

  /* ── Portfolio donut ── */
  useEffect(() => {
    if (!apexReady || !stats || !donutRef.current) return;
    donutChart.current?.destroy();
    const safeData = stats.portfolio?.length ? stats.portfolio : [{ name: 'No Data', value: 1 }];
    donutChart.current = new window.ApexCharts(donutRef.current, {
      chart: { type: 'donut', height: 300, fontFamily: 'Inter', animations: ANIM },
      series: safeData.map((s: any) => s.value),
      labels: safeData.map((s: any) => s.name),
      colors: [PALETTE.sky, PALETTE.rose, PALETTE.emerald, PALETTE.indigo],
      plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Total Loans', fontSize: '13px', fontWeight: '700', color: '#64748b', formatter: (w: any) => w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0) }, value: { fontSize: '28px', fontWeight: '800', color: '#0f172a' } } } } },
      legend: { position: 'bottom', fontSize: '12px', fontWeight: '600', labels: { colors: '#64748b' } },
      dataLabels: { enabled: false },
      stroke: { show: false },
    });
    donutChart.current.render();
    return () => { donutChart.current?.destroy(); donutChart.current = null; };
  }, [apexReady, stats]);

  /* ── Vintage / Repayment by Month ── */
  useEffect(() => {
    if (!apexReady || !vintageRef.current) return;
    const data = filterByRange(vintage, 'cohort', vinRange);
    vinChart.current?.destroy();
    if (!data.length) { if (vintageRef.current) vintageRef.current.innerHTML = ''; return; }
    vinChart.current = new window.ApexCharts(vintageRef.current, {
      chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Inter', animations: ANIM },
      series: [{ name: 'Repayment Rate', data: data.map(d => ({ x: d.cohort, y: d.recovery_rate })) }],
      plotOptions: {
        bar: {
          borderRadius: 8, columnWidth: '55%',
          colors: { ranges: [{ from: 0, to: 60, color: '#ef4444' }, { from: 61, to: 90, color: '#f59e0b' }, { from: 91, to: 150, color: '#10b981' }] },
        },
      },
      dataLabels: { enabled: true, formatter: (v: number) => v + '%', style: { fontSize: '11px', fontWeight: '700', colors: ['#fff'] } },
      yaxis: { max: 120, labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    });
    vinChart.current.render();
    return () => { vinChart.current?.destroy(); vinChart.current = null; };
  }, [apexReady, vintage, vinRange]);

  /* ── Risk bubble chart ── */
  useEffect(() => {
    if (!apexReady || !riskRef.current) return;
    riskChart.current?.destroy();
    if (!riskMatrix.length) { if (riskRef.current) riskRef.current.innerHTML = ''; return; }
    const points = riskMatrix.map((p: any) => ({
      x: p.credit_score, y: p.dti_ratio, z: p.principal_amount / 100,
      fillColor: p.status === 'defaulted' ? PALETTE.rose : p.status === 'repaid' ? PALETTE.emerald : PALETTE.sky,
    }));
    riskChart.current = new window.ApexCharts(riskRef.current, {
      chart: { type: 'bubble', height: 300, toolbar: { show: false }, fontFamily: 'Inter', animations: ANIM, zoom: { enabled: false } },
      series: [{ name: 'Loans', data: points }],
      dataLabels: { enabled: false },
      fill: { opacity: 0.7 },
      xaxis: { min: 0, max: 850, title: { text: 'Credit Score  →  Higher = Better', style: { fontSize: '11px', fontWeight: '700', color: '#64748b' } }, labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      yaxis: { max: 100, title: { text: 'DTI Ratio  →  Lower = Safer', style: { fontSize: '11px', fontWeight: '700', color: '#64748b' } }, labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    });
    riskChart.current.render();
    return () => { riskChart.current?.destroy(); riskChart.current = null; };
  }, [apexReady, riskMatrix]);

  /* ── Application Pipeline funnel ── */
  useEffect(() => {
    if (!apexReady || !funnelRef.current) return;
    funnelChart.current?.destroy();
    const bucket1 = ['STARTED'];
    const bucket2 = ['BUREAU_CHECKING','BUREAU_OK','BUREAU_REFER','BANK_LINKING','AFFORD_OK','AFFORD_REFER','UNDER_REVIEW'];
    const bucket3 = ['OFFERED','OFFER_ACCEPTED','CONTRACT_SIGN','DEBICHECK_AUTH','AWAITING_DISBURSEMENT'];
    const bucket4 = ['APPROVED'];
    const counts = [
      pipeline.filter((a: any) => bucket1.includes(a.status) || a.status === 'PENDING').length,
      pipeline.filter((a: any) => bucket2.includes(a.status)).length,
      pipeline.filter((a: any) => bucket3.includes(a.status)).length,
      pipeline.filter((a: any) => bucket4.includes(a.status)).length,
    ];
    funnelChart.current = new window.ApexCharts(funnelRef.current, {
      chart: { type: 'bar', height: 260, toolbar: { show: false }, fontFamily: 'Inter', animations: ANIM },
      series: [{ name: 'Applications', data: counts }],
      plotOptions: { bar: { borderRadius: 8, horizontal: true, barHeight: '60%', distributed: true } },
      colors: [PALETTE.sky, PALETTE.indigo, PRIMARY, PALETTE.emerald],
      dataLabels: { enabled: true, style: { fontSize: '12px', fontWeight: '700', colors: ['#fff'] } },
      xaxis: { categories: ['Just Applied', 'Being Checked', 'Almost Ready', 'Approved'], labels: { style: { colors: '#64748b', fontSize: '12px', fontWeight: '600' } } },
      yaxis: { labels: { style: { colors: '#64748b', fontSize: '12px', fontWeight: '600' } } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      legend: { show: false },
    });
    funnelChart.current.render();
    return () => { funnelChart.current?.destroy(); funnelChart.current = null; };
  }, [apexReady, pipeline]);

  /* ── Monthly Loan Book (stacked bar) ── */
  useEffect(() => {
    if (!apexReady || !comboRef.current) return;
    const data = filterByRange([...trends].reverse(), 'month', trendRange);
    comboChart.current?.destroy();
    if (!data.length) { if (comboRef.current) comboRef.current.innerHTML = ''; return; }
    comboChart.current = new window.ApexCharts(comboRef.current, {
      chart: { type: 'bar', height: 300, stacked: true, toolbar: { show: false }, fontFamily: 'Inter', animations: ANIM },
      series: [
        { name: 'Amount Lent',        data: data.map(d => d.total_principal || 0) },
        { name: 'Projected Earnings', data: data.map(d => d.projected_interest || 0) },
      ],
      colors: [PALETTE.indigo, PALETTE.amber],
      plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
      labels: data.map(d => d.month),
      xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      yaxis: { labels: { formatter: (v: number) => fmtCurrency(v), style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', fontWeight: '600' },
      dataLabels: { enabled: false },
      tooltip: { shared: true, intersect: false },
    });
    comboChart.current.render();
    return () => { comboChart.current?.destroy(); comboChart.current = null; };
  }, [apexReady, trends, trendRange]);

  /* ── Business Health radial ── */
  useEffect(() => {
    if (!apexReady || !radialRef.current) return;
    radialChart.current?.destroy();
    const totalDisbursed = stats?.totalDisbursed ?? 0;
    const totalCollected = stats?.totalCollected ?? 0;
    const nii = totalDisbursed > 0 ? Math.min(100, Math.round(((totalCollected - totalDisbursed) / totalDisbursed) * 100)) : 0;
    const health = stats?.activeLoans ?? 0 > 0 ? 80 : 0;
    const avgRecovery = vintage.length
      ? Math.round(vintage.slice(-3).reduce((s: number, v: any) => s + v.recovery_rate, 0) / Math.min(3, vintage.length))
      : 0;
    radialChart.current = new window.ApexCharts(radialRef.current, {
      chart: { type: 'radialBar', height: 300, fontFamily: 'Inter', animations: ANIM },
      series: [Math.max(0, nii), Math.max(0, health), Math.max(0, avgRecovery)],
      plotOptions: {
        radialBar: {
          hollow: { size: '45%', background: 'transparent' },
          track: { margin: 10, background: '#f1f5f9' },
          dataLabels: {
            name: { fontSize: '13px', fontWeight: '700', color: '#64748b' },
            value: { fontSize: '22px', fontWeight: '800', color: '#0f172a' },
            total: { show: true, label: 'Overall Health', fontSize: '12px', fontWeight: '700', color: '#64748b', formatter: () => Math.max(0, health) + '%' },
          },
        },
      },
      stroke: { lineCap: 'round' },
      labels: ['Profit Margin', 'On-Time Payments', 'Repayment Rate'],
      colors: [PRIMARY, PALETTE.emerald, PALETTE.indigo],
    });
    radialChart.current.render();
    return () => { radialChart.current?.destroy(); radialChart.current = null; };
  }, [apexReady, stats, vintage]);

  /* ── Portfolio Size Over Time (area) ── */
  useEffect(() => {
    if (!apexReady || !growthRef.current) return;
    const data = filterByRange([...trends].reverse(), 'month', trendRange);
    growthChart.current?.destroy();
    if (!data.length) { if (growthRef.current) growthRef.current.innerHTML = ''; return; }
    growthChart.current = new window.ApexCharts(growthRef.current, {
      chart: { type: 'area', height: 260, toolbar: { show: false }, fontFamily: 'Inter', animations: ANIM, dropShadow: { enabled: true, color: PALETTE.purple, top: 8, blur: 10, opacity: 0.2 } },
      series: [{ name: 'Total Portfolio Value', data: data.map(d => (d.total_principal || 0) + (d.projected_interest || 0)) }],
      colors: [PALETTE.purple],
      stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.05 } },
      xaxis: { categories: data.map(d => d.month), labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      yaxis: { labels: { formatter: (v: number) => fmtCompact(v), style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v: number) => fmtCurrency(v) } },
    });
    growthChart.current.render();
    return () => { growthChart.current?.destroy(); growthChart.current = null; };
  }, [apexReady, trends, trendRange]);

  /* ─── Export Dashboard CSV ─── */
  function exportDashboard() {
    const rows = [
      ['AlgoLend Dashboard Export', new Date().toLocaleDateString('en-ZA'), '', ''],
      ['', '', '', ''],
      ['KPI SUMMARY', '', '', ''],
      ['Metric', 'Value', '', ''],
      ['Total Revenue', stats?.totalCollected ?? 0, '', ''],
      ['Total Disbursed', stats?.totalDisbursed ?? 0, '', ''],
      ['Cash Flow', cashFlow, '', ''],
      ['Active Loans', stats?.activeLoans ?? 0, '', ''],
      ['Pending Applications', pendingCount, '', ''],
      ['', '', '', ''],
      ['PIPELINE SUMMARY', '', '', ''],
      ['Status', 'Count', '', ''],
      ...pipeline.map((a: any) => [a.status, 1, '', '']),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `algolend_dashboard_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toastSuccess('Export complete', 'Dashboard CSV downloaded successfully');
  }

  /* ─── KPI cards ─── */
  const kpiCards = [
    { label: 'TOTAL REVENUE',   raw: stats?.totalCollected ?? 0, format: fmtCompact, sub: 'Lifetime Collections', icon: 'payments' },
    { label: 'TOTAL DISBURSED', raw: stats?.totalDisbursed ?? 0, format: fmtCompact, sub: 'Principal Lent',       icon: 'send_money' },
    { label: 'CASH FLOW',       raw: Math.abs(cashFlow),         format: fmtCompact, sub: 'Net Collections',      icon: cashFlow >= 0 ? 'account_balance' : 'trending_down' },
    { label: 'ACTIVE LOANS',    raw: stats?.activeLoans ?? 0,    format: (n: number) => String(n), sub: 'Current Portfolio', icon: 'assignment_turned_in' },
  ];

  const totalStarted = pipeline.filter((a: any) => ['STARTED','PENDING'].includes(a.status)).length;

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <style>{`
        @keyframes bannerSlideDown { from { opacity:0; transform:translateY(-18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes borderPulse {
          0%,100% { box-shadow: -4px 0 0 var(--color-primary), 0 0 0 0 rgba(124,58,237,0); }
          50%      { box-shadow: -4px 0 0 var(--color-primary), 0 0 24px 4px rgba(124,58,237,0.35); }
        }
        @keyframes iconRing {
          0%,100% { transform:scale(1); opacity:1; }
          40%     { transform:scale(1.22); opacity:.85; }
        }
        @keyframes dotBlink {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:.4; transform:scale(.7); }
        }
        @keyframes shimmerBanner {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .action-banner {
          animation: bannerSlideDown .5s cubic-bezier(.22,1,.36,1) both,
                     borderPulse 2.8s ease-in-out 1s infinite;
          position:relative; overflow:hidden;
        }
        .action-banner::after {
          content:''; pointer-events:none;
          position:absolute; top:0; left:0; width:40%; height:100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          z-index: 0;
          animation: shimmerBanner 2s ease-in-out 0.6s 2;
        }
        .action-banner > * { position:relative; z-index:1; }
        .banner-icon-ring {
          animation: iconRing 2.2s ease-in-out 0.8s infinite;
          transform-origin:center;
        }
        .banner-dot { animation: dotBlink 1.4s ease-in-out infinite; }
        .banner-cta { transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease, opacity .2s; }
        .banner-cta:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 8px 24px rgba(124,58,237,0.45); opacity:.92; }
        .banner-cta:active { transform: scale(.97); transition-duration:.1s; }
      `}</style>

      {/* ── Welcome header ── */}
      <section className="animate-fade-in-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
            Welcome back, {userName} 👋
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
            Your portfolio overview for{' '}
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999, background: '#fff', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600 }}>
            <span className="status-dot green" style={{ width: 8, height: 8 }} />
            <span style={{ color: '#10B981' }}>System Operational</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999, background: '#fff', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: '#10B981' }}>SureSystems: Connected</span>
          </div>
          <button
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={exportDashboard}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
            Export Dashboard
          </button>
          <button
            className="btn btn-primary"
            style={{ borderRadius: 999, padding: '7px 18px', fontSize: 12 }}
            onClick={() => navigate('/create-application')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            New Application
          </button>
        </div>
      </section>

      {/* ── Action banner ── */}
      {pendingCount > 0 && (
        <section className="action-banner animate-fade-in-up delay-100" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '20px 24px', borderRadius: 16, marginBottom: 32,
          border: '1px solid rgba(124,58,237,0.15)',
          borderLeftWidth: 4,
          borderLeftColor: 'var(--color-primary)',
          borderLeftStyle: 'solid',
          background: 'rgba(124,58,237,0.05)',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div className="banner-icon-ring" style={{ padding: 12, borderRadius: '50%', background: 'rgba(124,58,237,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 22 }}>notification_important</span>
              </div>
              <span className="banner-dot" style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid #fff', display: 'block' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{pendingCount}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>application{pendingCount !== 1 ? 's' : ''} pending review</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>SureSystems: Connected. Complete setup to automate disbursements.</p>
            </div>
          </div>
          <button className="btn btn-primary banner-cta" style={{ borderRadius: 12, fontSize: 13, flexShrink: 0 }} onClick={() => navigate('/applications')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            Review Now
          </button>
        </section>
      )}

      {/* ── Compliance deadline alerts ── */}
      {complianceAlerts.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {complianceAlerts.map(task => {
              const dueDate = new Date(task.due_date);
              const isOverdue = dueDate < today;
              const diffDays = Math.round((today.getTime() - dueDate.getTime()) / 86_400_000);
              const priColor: Record<string, string> = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#6b7280' };
              const bgColor = isOverdue ? 'rgba(220,38,38,0.05)' : 'rgba(217,119,6,0.05)';
              const borderColor = isOverdue ? '#fca5a5' : '#fcd34d';
              return (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 12, gap: 12, flexWrap: 'wrap',
                  background: bgColor, border: `1px solid ${borderColor}`,
                  borderLeftWidth: 4, borderLeftColor: isOverdue ? '#dc2626' : '#d97706',
                  borderLeftStyle: 'solid',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: isOverdue ? '#dc2626' : '#d97706', flexShrink: 0 }}>
                      {isOverdue ? 'error' : 'schedule'}
                    </span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{task.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>{task.category}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: priColor[task.priority] ?? '#6b7280', color: '#fff' }}>{task.priority}</span>
                    <span style={{ fontSize: 12, color: isOverdue ? '#dc2626' : '#d97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {isOverdue ? `${diffDays}d overdue` : `Due in ${Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)}d`}
                    </span>
                    <button onClick={() => navigate('/compliance-tracker')} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid currentColor', background: 'transparent', color: isOverdue ? '#dc2626' : '#d97706', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      View
                    </button>
                  </div>
                </div>
              );
            })}
            {(overdueAlerts.length + upcomingAlerts.length) > 3 && (
              <button onClick={() => navigate('/compliance-tracker')} style={{ alignSelf: 'flex-end', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                View all {overdueAlerts.length + upcomingAlerts.length} compliance items →
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── KPI cards ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpiCards.map((c, i) => (
            <div key={c.label} className={`dash-kpi-card animate-fade-in-up delay-${i * 100 + 100}`}>
              <div className="dash-kpi-corner" />
              <div>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-primary)' }}>{c.icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 4 }}>{c.label}</p>
                <h3 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, letterSpacing: '-0.02em', margin: 0 }}>
                  <CountUpKPI raw={c.raw} format={c.format} />
                </h3>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{c.sub}</p>
              </div>
            </div>
          ))
        }
      </section>

      {/* ── Charts row: Velocity + Donut ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>

        <div className="dash-chart-card">
          <ChartHeader
            icon="swap_vert" title="Money In vs Money Out"
            subtitle="How much we lent vs how much clients paid back each month"
            right={<TabGroup options={['1M','3M','6M','1Y','YTD']} value={velRange} onChange={setVelRange} />}
          />
          <div style={{ padding: 20 }}>
            {!apexReady ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
              : monthly.length === 0 ? <EmptyChart msg="No cash flow data yet" />
              : <div ref={velocityRef} />}
          </div>
        </div>

        <div className="dash-chart-card">
          <ChartHeader icon="donut_large" title="Where Loans Stand" subtitle="Current breakdown of all loans by status" />
          <div style={{ padding: 20 }}>
            {!apexReady ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
              : <div ref={donutRef} />}
          </div>
        </div>
      </section>

      {/* ── Analytics row: Vintage + Risk ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>

        <div className="dash-chart-card">
          <ChartHeader
            icon="bar_chart" iconBg="#f0fdf4" iconColor="#16a34a"
            title="Repayment by Month"
            subtitle="Which month's loans are being paid back — green = good, red = at risk"
            right={<TabGroup options={['3M','6M','1Y','ALL']} value={vinRange} onChange={setVinRange} />}
          />
          <div style={{ padding: 20 }}>
            {!apexReady ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
              : vintage.length === 0 ? <EmptyChart msg="No vintage data available" />
              : <div ref={vintageRef} />}
          </div>
        </div>

        <div className="dash-chart-card">
          <ChartHeader
            icon="bubble_chart" iconBg="#fef2f2" iconColor="#f87171"
            title="Loan Risk Overview"
            subtitle="Each bubble is a loan — bigger = larger loan, red = in default"
            right={
              <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 600 }}>
                {[['#10b981','Repaid'],['#0ea5e9','Active'],['#f43f5e','Defaulted']].map(([c,l]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
                  </span>
                ))}
              </div>
            }
          />
          <div style={{ padding: 20 }}>
            {!apexReady ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
              : riskMatrix.length === 0 ? <EmptyChart msg="No risk data yet" />
              : <div ref={riskRef} />}
          </div>
        </div>
      </section>

      {/* ── Application Pipeline ── */}
      <section className="dash-chart-card" style={{ marginBottom: 24 }}>
        <div className="dash-chart-header">
          <div className="dash-chart-header-left">
            <div className="dash-chart-icon" style={{ background: '#eff6ff' }}>
              <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: 20 }}>filter_alt</span>
            </div>
            <div>
              <p className="dash-chart-title">Application Pipeline</p>
              <p className="dash-chart-subtitle">How many applications are at each stage right now</p>
            </div>
          </div>
          {totalStarted > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', fontWeight: 800, fontSize: 14 }}>
              {totalStarted} <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 4 }}>applications started</span>
            </div>
          )}
        </div>
        <div style={{ padding: 20 }}>
          {!apexReady ? <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
            : <div ref={funnelRef} style={{ minHeight: 260 }} />}
        </div>
      </section>

      {/* ── Business Trends & Activity ── */}
      <section className="animate-fade-in-up delay-400" style={{ marginBottom: 24 }}>
        <div className="dash-section-heading">
          <div>
            <h3>Business Trends</h3>
            <p>How the business has grown over time</p>
          </div>
          <TabGroup options={['3M','6M','1Y','ALL']} value={trendRange} onChange={setTrendRange} />
        </div>

        {/* 2-col grid: Monthly Loan Book spans full width; Health + Portfolio side-by-side below */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="dash-chart-card" style={{ gridColumn: 'span 2' }}>
            <ChartHeader
              icon="stacked_bar_chart" title="Monthly Loan Book"
              subtitle="Total loans issued each month — dark = principal lent, light = projected earnings"
            />
            <div style={{ padding: 20 }}>
              {!apexReady ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
                : trends.length === 0 ? <EmptyChart msg="No trend data yet" />
                : <div ref={comboRef} />}
            </div>
          </div>

          <div className="dash-chart-card">
            <ChartHeader icon="monitor_heart" iconBg="#ecfdf5" iconColor="#059669" title="Business Health" subtitle="Key metrics — higher is better, aim for all above 80%" />
            <div style={{ padding: 20 }}>
              {!apexReady ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
                : <div ref={radialRef} />}
            </div>
          </div>

          <div className="dash-chart-card">
            <ChartHeader icon="trending_up" iconBg="#f5f3ff" iconColor="#7c3aed" title="Portfolio Size Over Time" subtitle="Total value of active loans on the books each month" />
            <div style={{ padding: 20 }}>
              {!apexReady ? <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
                : trends.length === 0 ? <EmptyChart msg="No growth data yet" />
                : <div ref={growthRef} />}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Activity ── */}
      <section style={{ marginBottom: 24 }}>
        <div className="dash-chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <ChartHeader icon="history" iconBg="rgba(109,40,217,0.08)" iconColor="#6D28D9" title="Recent Activity" subtitle="Latest system events" />
          <div style={{ padding: '0 20px 20px', overflowY: 'auto', flex: 1, maxHeight: 300 }}>
            <div className="activity-item">
              <div className="activity-dot" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>System Backup Completed</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>2 hours ago</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" style={{ background: '#10b981' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Application Approved: #2450</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Today, 09:41 AM</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" style={{ background: '#f59e0b' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Disbursement Pending</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Today, 08:30 AM</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Weekly Report Generated</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Yesterday</div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
