import '../shared/sessionGuard.js';
import { initLayout, getProfile } from '../shared/layout.js';
import { formatCompactNumber, formatCurrency } from '../shared/utils.js';
import exportManager from './export-manager.js';
import {
  fetchDashboardData,
  fetchPipelineApplications,
  fetchMonthlyLoanPerformance,
  fetchFinancialsData,
  fetchPortfolioAnalytics,
  fetchFinancialTrends
} from '../services/dataService.js';

// ---------- Shared Animation Config ----------
const APEX_ANIM = {
  enabled: true,
  easing: 'easeinout',
  speed: 900,
  animateGradually: { enabled: true, delay: 120 },
  dynamicAnimation: { enabled: true, speed: 400 }
};

// Sprinkle animation into any ApexCharts options object
function withAnim(chartOptions) {
  if (!chartOptions.chart) chartOptions.chart = {};
  chartOptions.chart.animations = { ...APEX_ANIM, ...(chartOptions.chart.animations || {}) };
  return chartOptions;
}

// ---------- Helpers ----------
const loadApexCharts = () =>
  new Promise((resolve, reject) => {
    if (window.ApexCharts) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/apexcharts';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

const STYLE_ID = 'admin-dashboard-analytics-style';
const getThemeColors = () => {
  const root = getComputedStyle(document.documentElement);
  const primary = (root.getPropertyValue('--color-primary') || '#0ea5e9').trim() || '#0ea5e9';
  const secondary = (root.getPropertyValue('--color-secondary') || '#f97316').trim() || '#f97316';
  return { primary, secondary };
};

async function fetchSureSystemsActivationStatus() {
  try {
    const response = await fetch('/api/suresystems/activation-status');
    if (!response.ok) {
      throw new Error(`SureSystems status fetch failed (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.warn('SureSystems activation status unavailable:', error.message || error);
    return null;
  }
}

// ---------- Bootstrap ----------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadApexCharts();
  } catch (err) {
    console.error('ApexCharts failed to load:', err);
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML =
        '<div class="p-8 text-center text-red-600 font-semibold">Charts failed to load. Check your connection and refresh.</div>';
    }
    return;
  }

  const authInfo = await initLayout();
  if (!authInfo) return;

  const profile = getProfile();
  const mainContent = document.getElementById('main-content');

  // Inject styles once
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.innerHTML = `
      @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
      @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } }
      .analytics-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.25s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; }
      .analytics-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: var(--color-primary); transform: translateY(-2px); }
      .analytics-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--color-primary, #0ea5e9), var(--color-secondary, #f97316)); opacity: 0; transition: opacity 0.25s; }
      .analytics-card:hover::before { opacity: 1; }
      .kpi-card { background: linear-gradient(135deg, var(--color-primary, #0ea5e9) 0%, var(--color-secondary, #f97316) 100%); border-radius: 12px; padding: 1.5rem; color: #fff; position: relative; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.12); transition: transform 0.25s ease, box-shadow 0.25s ease; }
      .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
      .kpi-card::after { content: ''; position: absolute; top: -50%; right: -50%; width: 200%; height: 200%; background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%); animation: shimmer 3s infinite; }
      .kpi-icon { width: 48px; height: 48px; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 1rem; }
      .kpi-value { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1; margin-bottom: 0.5rem; }
      .kpi-label { font-size: 0.875rem; font-weight: 600; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; }
      .kpi-trend { position: absolute; top: 1.5rem; right: 1.5rem; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; background: rgba(255,255,255,0.2); border-radius: 20px; backdrop-filter: blur(8px); }
      .section-header { border-bottom: 2px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.5rem; }
      .section-title { font-size: 1.125rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
      .section-subtitle { font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
      .tab-group { display: inline-flex; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 2px; gap: 2px; }
      .tab-button { padding: 0.5rem 1rem; font-size: 0.8125rem; font-weight: 600; color: #64748b; border-radius: 6px; transition: all 0.2s; cursor: pointer; border: none; background: transparent; }
      .tab-button:hover { color: var(--color-primary, #0ea5e9); background: #ffffff; }
      .tab-button.active { background: #ffffff; color: var(--color-primary, #0ea5e9); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .chart-wrapper { min-height: 350px; width: 100%; position: relative; }
      .status-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse-dot 2s ease-in-out infinite; }
      .fade-in { animation: slideInUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards; opacity: 0; }
      .delay-100 { animation-delay: 0.1s; } .delay-200 { animation-delay: 0.2s; } .delay-300 { animation-delay: 0.3s; } .delay-400 { animation-delay: 0.4s; }
    `;
    document.head.appendChild(style);
  }

  // Fetch data
  let systemStatus = { text: 'Operational', color: '#10b981', dot: 'bg-emerald-500' };
  let dashData, pipelineData, perfData, finData, advancedStats, trendsData;
  let sureSystemsActivation = null;
  try {
    [dashData, pipelineData, perfData, finData, advancedStats, trendsData, sureSystemsActivation] = await Promise.all([
      fetchDashboardData().catch(() => ({ financials: {}, portfolioStatus: [] })),
      fetchPipelineApplications().catch(() => ({ data: [] })),
      fetchMonthlyLoanPerformance().catch(() => ({ data: [] })),
      fetchFinancialsData().catch(() => ({ data: {} })),
      fetchPortfolioAnalytics().catch(() => ({ data: null })),
      fetchFinancialTrends().catch(() => ({ data: [] })),
      fetchSureSystemsActivationStatus()
    ]);
  } catch (error) {
    console.error('System Fetch Error:', error);
    systemStatus = { text: 'System Error', color: '#ef4444', dot: 'bg-red-500' };
  }

  const financials = dashData?.financials || {};
  const pipeline = pipelineData?.data || [];
  const perf = perfData?.data || [];
  const trends = trendsData?.data || [];
  const detailedFin = finData?.data || {};
  const analytics = advancedStats?.data || calculateFallbackStats(pipeline, perf);
  const { primary: primaryColor, secondary: secondaryColor } = getThemeColors();
  const sureSystemsState = (() => {
    if (!sureSystemsActivation?.configured) {
      return {
        text: 'SureSystems: Not Configured',
        color: '#f59e0b',
        dot: 'bg-amber-500'
      };
    }

    const failed = Number(sureSystemsActivation?.recent?.failed || 0);
    const success = Number(sureSystemsActivation?.recent?.success || 0);
    const lastAttempt = sureSystemsActivation?.recent?.lastAttemptAt;
    const daysSinceLastAttempt = lastAttempt
      ? (Date.now() - new Date(lastAttempt).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Only flag as error if there are recent failures (within last 7 days) with no successes
    if (failed > 0 && success === 0 && daysSinceLastAttempt <= 7) {
      return {
        text: 'SureSystems: Activation Errors',
        color: '#ef4444',
        dot: 'bg-red-500'
      };
    }

    if (failed > 0 && success === 0 && daysSinceLastAttempt > 7) {
      return {
        text: 'SureSystems: Connected',
        color: '#10b981',
        dot: 'bg-emerald-500'
      };
    }

    return {
      text: success > 0 ? `SureSystems: ${success} mandates activated` : 'SureSystems: Connected',
      color: '#10b981',
      dot: 'bg-emerald-500'
    };
  })();

  // Render layout (same structure as your draft but with theme colors)
  const pendingCount = dashData?.financials?.pending_apps || 0;
  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  mainContent.innerHTML = `
    <div class="max-w-[1600px] mx-auto p-10 space-y-10">

      <!-- Welcome Header -->
      <section class="flex flex-col md:flex-row md:items-end justify-between gap-6 fade-in">
        <div>
          <h2 class="font-headline text-3xl font-bold text-on-surface mb-1">Welcome back, ${profile?.full_name?.split(' ')[0] || 'Admin'}</h2>
          <p class="text-secondary flex items-center gap-2 text-sm">
            Your portfolio overview for <span class="font-semibold" style="color:var(--color-primary)">${today}</span>
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full border border-outline-variant/30 text-xs font-semibold">
            <span class="w-2 h-2 rounded-full animate-pulse" style="background:${systemStatus.color}"></span>
            <span style="color:${systemStatus.color}">${systemStatus.text}</span>
          </div>
          <div class="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full border border-outline-variant/30 text-xs font-semibold">
            <span class="w-2 h-2 rounded-full" style="background:${sureSystemsState.color}"></span>
            <span style="color:${sureSystemsState.color}">${sureSystemsState.text}</span>
          </div>
          <button id="btn-export-dashboard" class="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/30 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
            <span class="material-symbols-outlined text-[14px]">download</span> Export Dashboard
          </button>
        </div>
      </section>

      <style>
        @keyframes bannerSlideDown {
          from { opacity:0; transform:translateY(-18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes borderPulse {
          0%,100% { box-shadow: -4px 0 0 var(--color-primary), 0 0 0 0 color-mix(in srgb,var(--color-primary) 0%,transparent); }
          50%      { box-shadow: -4px 0 0 var(--color-primary), 0 0 24px 4px color-mix(in srgb,var(--color-primary) 35%,transparent); }
        }
        @keyframes iconRing {
          0%,100% { transform:scale(1); opacity:1; }
          40%     { transform:scale(1.22); opacity:.85; }
        }
        @keyframes dotBlink {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:.4; transform:scale(.7); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .action-banner {
          animation: bannerSlideDown .5s cubic-bezier(.22,1,.36,1) both,
                     borderPulse 2.8s ease-in-out 1s infinite;
          position:relative; overflow:hidden;
        }
        /* Shimmer runs BEHIND content via z-index — never covers text */
        .action-banner::after {
          content:''; pointer-events:none;
          position:absolute; top:0; left:0; width:40%; height:100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          z-index: 0;
          animation: shimmer 2s ease-in-out 0.6s 2;
        }
        /* All direct children sit above the shimmer */
        .action-banner > * { position:relative; z-index:1; }
        .banner-icon-ring {
          animation: iconRing 2.2s ease-in-out 0.8s infinite;
          transform-origin:center;
        }
        .banner-dot {
          animation: dotBlink 1.4s ease-in-out infinite;
        }
        .banner-cta {
          transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease, opacity .2s;
        }
        .banner-cta:hover {
          transform: translateY(-2px) scale(1.04);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 45%, transparent);
          opacity:.92;
        }
        .banner-cta:active { transform: scale(.97); transition-duration:.1s; }
      </style>

      <!-- Action Banner — top of dashboard, always visible -->
      ${pendingCount > 0 ? `
      <section class="action-banner glass-card rounded-2xl border-l-4 flex items-center justify-between gap-4 p-5"
               style="border-color:var(--color-primary); background:color-mix(in srgb,var(--color-primary) 5%,white);">
        <div class="flex items-center gap-4 min-w-0">
          <!-- Animated icon -->
          <div class="relative flex-shrink-0">
            <div class="p-3 rounded-full banner-icon-ring" style="background:color-mix(in srgb,var(--color-primary) 14%,transparent)">
              <span class="material-symbols-outlined text-[22px]" style="color:var(--color-primary)">notification_important</span>
            </div>
            <!-- Live dot -->
            <span class="banner-dot absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                  style="background:var(--color-primary)"></span>
          </div>
          <!-- Text -->
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h5 class="font-bold text-on-surface">
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-black mr-1"
                      style="background:var(--color-primary)">${pendingCount}</span>
                application${pendingCount > 1 ? 's' : ''} pending review
              </h5>
            </div>
            <p class="text-secondary text-sm mt-0.5 truncate">${sureSystemsState.text}. Complete setup to automate disbursements.</p>
          </div>
        </div>
        <!-- CTA -->
        <a href="/admin/applications"
           class="banner-cta flex-shrink-0 flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white"
           style="background:var(--color-primary)">
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          Review Now
        </a>
      </section>` : ''}

      <!-- KPI Cards -->
      <section id="cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 fade-in delay-100"></section>

      <!-- Charts Row -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in delay-200">
        <div class="lg:col-span-2 glass-card p-8 rounded-2xl">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h4 class="font-headline font-bold text-on-surface">Cash Flow Velocity</h4>
              <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Disbursed vs. Collected</p>
            </div>
            <div id="tabs-velocity" class="tab-group"></div>
          </div>
          <div id="velocityChart" class="chart-wrapper"></div>
        </div>

        <div class="glass-card p-8 rounded-2xl">
          <div class="mb-6">
            <h4 class="font-headline font-bold text-on-surface">Portfolio Composition</h4>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Loan Status Distribution</p>
          </div>
          <div id="donutChart" class="chart-wrapper" style="min-height:320px;"></div>
        </div>
      </section>

      <!-- Analytics Row -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in delay-300">
        <div class="glass-card p-8 rounded-2xl">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h4 class="font-headline font-bold text-on-surface">Vintage Analysis</h4>
              <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Recovery Rate by Cohort</p>
            </div>
            <div id="tabs-vintage" class="tab-group"></div>
          </div>
          <div id="vintageChart" class="chart-wrapper"></div>
        </div>

        <div class="glass-card p-8 rounded-2xl">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h4 class="font-headline font-bold text-on-surface">Risk vs. Affordability</h4>
              <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Credit Score vs. DTI Ratio</p>
            </div>
            <div class="flex items-center gap-3 text-[11px] font-semibold">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span>Paid</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:var(--color-primary)"></span>Active</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span>Default</span>
            </div>
          </div>
          <div id="riskChart" class="chart-wrapper"></div>
        </div>
      </section>

      <!-- Funnel -->
      <section class="glass-card p-8 rounded-2xl fade-in delay-400">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h4 class="font-headline font-bold text-on-surface">Conversion Funnel</h4>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Application Pipeline · 4 Stages</p>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold text-on-surface font-headline">${analytics.funnel?.STARTED || 0}</div>
            <div class="text-[11px] uppercase tracking-widest text-outline font-semibold">Total Starts</div>
          </div>
        </div>
        <div id="funnelChart" class="chart-wrapper" style="min-height:300px;"></div>
      </section>

      <!-- Historical Trends -->
      <section class="fade-in delay-400">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-headline text-xl font-bold text-on-surface">Historical Trends</h3>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Long-term Performance Metrics</p>
          </div>
          <div id="tabs-trends" class="tab-group"></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="lg:col-span-2 glass-card p-8 rounded-2xl">
            <h4 class="font-headline font-bold text-on-surface mb-1">Portfolio Growth</h4>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-6">Principal vs Interest Over Time</p>
            <div id="comboChart" class="chart-wrapper"></div>
          </div>
          <div class="glass-card p-8 rounded-2xl">
            <h4 class="font-headline font-bold text-on-surface mb-1">Performance Targets</h4>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-6">Key Health Indicators</p>
            <div id="radialChart" class="chart-wrapper" style="min-height:320px;"></div>
          </div>
          <div class="glass-card p-8 rounded-2xl">
            <h4 class="font-headline font-bold text-on-surface mb-1">Revenue Trajectory</h4>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-6">Total Exposure Growth</p>
            <div id="growthChart" class="chart-wrapper" style="min-height:320px;"></div>
          </div>
        </div>
      </section>

    </div>
  `;

  // Render KPI cards + export wiring (no canvas needed, safe to do immediately)
  renderKpiCards(financials);

  exportManager.init(profile.id);
  document.getElementById('export-dashboard-btn')?.addEventListener('click', () => {
    exportManager.open('dashboard', 'Dashboard Metrics');
  });

  // Set up tab groups FIRST (they only wire buttons, don't render charts yet)
  // We pass a no-op — actual first render happens inside rAF below
  setupDynamicChart('tabs-velocity', ['1M', '3M', '6M', '1Y', 'YTD'], '1Y', () => {});
  setupDynamicChart('tabs-vintage', ['3M', '6M', '1Y', 'ALL'], 'ALL', () => {});
  setupDynamicChart('tabs-trends', ['3M', '6M', '1Y', 'ALL'], '1Y', () => {});

  // Capture snapshot
  captureDashboardSnapshot(dashData, detailedFin, pipelineData, perfData);

  // All ApexCharts need the browser to finish layout FIRST — defer by two frames
  // so every chart container has real width/height when ApexCharts measures it.
  const riskData = analytics.risk_matrix?.length ? analytics.risk_matrix : [];
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { initStatusDonut(dashData?.portfolioStatus); } catch(e) { console.warn('donut', e); }
    try { initRiskScatter(riskData); } catch(e) { console.warn('risk', e); }
    try { initFunnelChart(pipeline); } catch(e) { console.warn('funnel', e); }
    try { initPerformanceRadial(detailedFin, analytics.vintage); } catch(e) { console.warn('radial', e); }

    // Velocity — wire tab clicks + render initial
    setupDynamicChart('tabs-velocity', ['1M', '3M', '6M', '1Y', 'YTD'], '1Y', (range) => {
      try { renderVelocityChart(filterDataByDate(perf, 'month_year', range)); } catch(e) { console.warn('velocity', e); }
    });
    // Vintage — wire tab clicks + render initial
    setupDynamicChart('tabs-vintage', ['3M', '6M', '1Y', 'ALL'], 'ALL', (range) => {
      try { renderVintageChart(filterDataByDate(analytics.vintage, 'cohort', range)); } catch(e) { console.warn('vintage', e); }
    });
    // Trends — wire tab clicks + render initial
    setupDynamicChart('tabs-trends', ['3M', '6M', '1Y', 'ALL'], '1Y', (range) => {
      try { renderTrendCharts(filterDataByDate(trends, 'month', range)); } catch(e) { console.warn('trends', e); }
    });
  }));
});

// ---------- Helpers ----------
function filterDataByDate(data, dateKey, range) {
  if (!data || range === 'ALL') return data;
  const now = new Date();
  let startDate = new Date();
  if (range === '1M') startDate.setMonth(now.getMonth() - 1);
  if (range === '3M') startDate.setMonth(now.getMonth() - 3);
  if (range === '6M') startDate.setMonth(now.getMonth() - 6);
  if (range === '1Y') startDate.setFullYear(now.getFullYear() - 1);
  if (range === 'YTD') startDate = new Date(now.getFullYear(), 0, 1);
  return data.filter((item) => new Date(item[dateKey]) >= startDate);
}

// Dashboard data snapshot for export
let _dashboardSnapshot = null;

function captureDashboardSnapshot(dash, fin, pipeline, perf) {
    _dashboardSnapshot = { dash, fin, pipeline, perf, capturedAt: new Date().toISOString() };
    // Wire export button once data is ready
    setTimeout(() => {
        document.getElementById('btn-export-dashboard')?.addEventListener('click', exportDashboardCSV);
    }, 500);
}

function exportDashboardCSV() {
    if (!_dashboardSnapshot) { alert('Dashboard data not loaded yet.'); return; }
    const { dash, fin, pipeline, capturedAt } = _dashboardSnapshot;
    const date = new Date(capturedAt).toLocaleDateString('en-ZA');

    const sections = [
        ['DASHBOARD EXPORT', date, '', ''],
        ['', '', '', ''],
        ['KPI SUMMARY', '', '', ''],
        ['Metric', 'Value', '', ''],
        ['Total Disbursed', fin?.data?.balanceSheet?.totalLoanBook || 0, '', ''],
        ['Active Clients', fin?.data?.balanceSheet?.activeClients || 0, '', ''],
        ['Avg Loan Per Client', fin?.data?.balanceSheet?.avgLoanPerClient?.toFixed(2) || 0, '', ''],
        ['Arrears Rate', (fin?.data?.balanceSheet?.arrearsPercentage || 0).toFixed(1) + '%', '', ''],
        ['Interest Income', fin?.data?.incomeStatement?.interestIncome || 0, '', ''],
        ['Fee Income', fin?.data?.incomeStatement?.feeIncome || 0, '', ''],
        ['Total Revenue', fin?.data?.incomeStatement?.totalRevenue || 0, '', ''],
        ['', '', '', ''],
        ['PIPELINE SUMMARY', '', '', ''],
        ['Status', 'Count', '', ''],
    ];

    const statusCounts = {};
    (pipeline?.data || []).forEach(a => { statusCounts[a.status] = (statusCounts[a.status]||0)+1; });
    Object.entries(statusCounts).forEach(([s,c]) => sections.push([s, c, '', '']));

    const csv  = sections.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `dashboard_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function setupDynamicChart(containerId, options, defaultOption, onRender) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = options
    .map((opt) => `<button class="tab-button ${opt === defaultOption ? 'active' : ''}" data-range="${opt}">${opt}</button>`)
    .join('');
  container.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      container.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      onRender(e.target.dataset.range);
    });
  });
  onRender(defaultOption);
}

// ---------- Charts ----------
function emptyState(id, msg = 'No data yet') {
  const el = document.querySelector(`#${id}`);
  if (el) el.innerHTML = `<div class="h-full flex flex-col items-center justify-center gap-2 text-slate-400" style="min-height:280px">
    <span class="material-symbols-outlined text-4xl opacity-30">bar_chart</span>
    <p class="text-sm font-semibold">${msg}</p>
    <p class="text-xs opacity-70">Data will appear once loans are processed</p>
  </div>`;
}

function initFunnelChart(apps) {
  const { primary: primaryColor } = getThemeColors();
  const data = apps || [];
  const bucket1 = ['STARTED'];
  const bucket2 = ['BUREAU_CHECKING', 'BUREAU_OK', 'BUREAU_REFER', 'BANK_LINKING', 'AFFORD_OK', 'AFFORD_REFER'];
  const bucket3 = ['OFFERED', 'OFFER_ACCEPTED', 'CONTRACT_SIGN', 'DEBICHECK_AUTH'];
  const bucket4 = ['APPROVED'];

  const counts = [
    data.filter((a) => bucket1.includes(a.status)).length,
    data.filter((a) => bucket2.includes(a.status)).length,
    data.filter((a) => bucket3.includes(a.status)).length,
    data.filter((a) => bucket4.includes(a.status)).length
  ];

  const options = {
    series: [{ name: 'Applications', data: counts }],
    chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Inter' },
    plotOptions: { bar: { borderRadius: 8, horizontal: true, barHeight: '60%' } },
    colors: [primaryColor],
    dataLabels: { enabled: true, style: { fontSize: '12px', fontWeight: '700', colors: ['#fff'] } },
    xaxis: { categories: ['Started', 'Processing', 'Finalizing', 'Ready'], labels: { style: { colors: '#64748b', fontSize: '12px', fontWeight: '600' } } },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '12px', fontWeight: '600' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { show: false }
  };
  new ApexCharts(document.querySelector('#funnelChart'), withAnim(options)).render();
}

function initPerformanceRadial(fin, vintage) {
  const { primary: primaryColor, secondary: secondaryColor } = getThemeColors();
  const nii = fin?.ratios?.niiToRevenue || 0;
  const arrears = fin?.balanceSheet?.arrearsPercentage || 0;
  const health = Math.max(0, 100 - arrears);
  let avgRecovery = 0;
  if (vintage && vintage.length > 0) {
    const recent = vintage.slice(0, 3);
    const sum = recent.reduce((acc, v) => acc + parseFloat(v.recovery_rate), 0);
    avgRecovery = sum / recent.length;
  }

  const options = {
    series: [Math.round(nii), Math.round(health), Math.round(avgRecovery)],
    chart: { type: 'radialBar', height: 350, fontFamily: 'Inter' },
    plotOptions: {
      radialBar: {
        hollow: { size: '45%', background: 'transparent' },
        track: { margin: 10, background: '#f1f5f9' },
        dataLabels: {
          name: { fontSize: '14px', fontWeight: '700', color: '#64748b' },
          value: { fontSize: '24px', fontWeight: '800', color: '#0f172a' },
          total: { show: true, label: 'Avg Health', fontSize: '13px', fontWeight: '700', color: '#64748b', formatter: () => Math.round(health) + '%' }
        }
      }
    },
    stroke: { lineCap: 'round' },
    labels: ['Profit Margin', 'Portfolio Health', 'Recovery Rate'],
    colors: [primaryColor, '#10b981', secondaryColor]
  };
  new ApexCharts(document.querySelector('#radialChart'), withAnim(options)).render();
}

let velocityChartInstance = null;
function renderVelocityChart(perf) {
  const { primary: primaryColor, secondary: secondaryColor } = getThemeColors();
  const data = perf || [];
  if (!data.length) { emptyState('velocityChart', 'No cash flow data yet'); return; }
  const options = {
    series: [
      { name: 'Disbursed', type: 'area', data: data.map((p) => p.disbursed_amount) },
      { name: 'Collected', type: 'area', data: data.map((p) => p.repaid_amount) }
    ],
    chart: { type: 'line', height: 350, fontFamily: 'Inter', zoom: { enabled: false }, toolbar: { show: false } },
    stroke: { width: 3, curve: 'smooth' },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
    colors: [primaryColor, secondaryColor],
    dataLabels: { enabled: false },
    labels: data.map((p) => p.month_year),
    xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    yaxis: { labels: { formatter: (val) => formatCompactNumber(val), style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', fontWeight: '600' }
  };
  if (velocityChartInstance) velocityChartInstance.destroy();
  velocityChartInstance = new ApexCharts(document.querySelector('#velocityChart'), withAnim(options));
  velocityChartInstance.render();
}

function initRiskScatter(data) {
  const { primary: primaryColor } = getThemeColors();
  if (!data?.length) { emptyState('riskChart', 'No risk data yet'); return; }
  const points = data?.length
    ? data.map((p) => ({
        x: p.credit_score || 0,
        y: p.dti_ratio,
        z: p.principal_amount / 100,
        fillColor: p.status === 'defaulted' ? '#ef4444' : primaryColor
      }))
    : [];
  const options = {
    series: [{ name: 'Loans', data: points }],
    chart: { type: 'bubble', height: 350, fontFamily: 'Inter', zoom: { enabled: false }, toolbar: { show: false } },
    dataLabels: { enabled: false },
    fill: { opacity: 0.7 },
    xaxis: { title: { text: 'Credit Score', style: { fontSize: '12px', fontWeight: '700', color: '#64748b' } }, min: 0, max: 850, labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    yaxis: { title: { text: 'DTI Ratio (%)', style: { fontSize: '12px', fontWeight: '700', color: '#64748b' } }, max: 100, labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 }
  };
  new ApexCharts(document.querySelector('#riskChart'), withAnim(options)).render();
}

let vintageChartInstance = null;
function renderVintageChart(data) {
  const { primary: primaryColor } = getThemeColors();
  if (!data || data.length === 0) {
    document.querySelector('#vintageChart').innerHTML =
      '<div class="h-full flex items-center justify-center text-slate-400 font-medium text-sm">No vintage data available</div>';
    return;
  }
  const options = {
    series: [{ name: 'Recovery Rate', data: data.map((d) => ({ x: d.cohort, y: d.recovery_rate })) }],
    chart: { type: 'bar', height: 350, fontFamily: 'Inter', toolbar: { show: false } },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '55%',
        colors: {
          ranges: [
            { from: 0, to: 60, color: '#ef4444' },
            { from: 61, to: 90, color: '#f59e0b' },
            { from: 91, to: 150, color: '#10b981' }
          ]
        }
      }
    },
    dataLabels: { enabled: true, formatter: (val) => val + '%', style: { fontSize: '11px', fontWeight: '700', colors: ['#fff'] } },
    yaxis: { max: 120, labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    colors: [primaryColor],
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 }
  };
  if (vintageChartInstance) vintageChartInstance.destroy();
  vintageChartInstance = new ApexCharts(document.querySelector('#vintageChart'), withAnim(options));
  vintageChartInstance.render();
}

let trendChart1 = null,
  trendChart3 = null;
function renderTrendCharts(data) {
  const { primary: primaryColor, secondary: secondaryColor } = getThemeColors();
  if (!data?.length) {
    emptyState('comboChart', 'No trend data yet');
    emptyState('growthChart', 'No growth data yet');
    return;
  }
  const sorted = [...(data || [])].reverse();
  if (sorted.length === 1) {
    const currentMonth = new Date(sorted[0].month);
    const prevMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() - 1));
    const prevLabel = prevMonth.toISOString().slice(0, 7);
    sorted.unshift({ month: prevLabel, total_principal: 0, projected_interest: 0, active_loans: 0 });
  }

  const months = sorted.map((d) => d.month);

  if (trendChart1) trendChart1.destroy();
  trendChart1 = new ApexCharts(document.querySelector('#comboChart'), withAnim({
    series: [
      { name: 'Principal', data: sorted.map((d) => d.total_principal || 0) },
      { name: 'Projected Interest', data: sorted.map((d) => d.projected_interest || 0) }
    ],
    chart: { height: 350, type: 'bar', stacked: true, toolbar: { show: false }, fontFamily: 'Inter' },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
    colors: [primaryColor, secondaryColor],
    labels: months,
    xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    yaxis: { labels: { formatter: (val) => formatCurrency(val), style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    tooltip: { shared: true, intersect: false },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', fontWeight: '600' },
    dataLabels: { enabled: false }
  }));
  trendChart1.render();

  if (trendChart3) trendChart3.destroy();
  trendChart3 = new ApexCharts(document.querySelector('#growthChart'), withAnim({
    series: [{ name: 'Total Exposure', data: sorted.map((d) => (d.total_principal || 0) + (d.projected_interest || 0)) }],
    chart: {
      height: 300,
      type: 'area',
      toolbar: { show: false },
      fontFamily: 'Inter',
      dropShadow: { enabled: true, color: primaryColor, top: 8, blur: 10, opacity: 0.2 }
    },
    colors: [primaryColor],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1, stops: [0, 90, 100] }
    },
    xaxis: { categories: months, labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    yaxis: { labels: { formatter: (val) => formatCompactNumber(val), style: { colors: '#64748b', fontSize: '11px', fontWeight: '600' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (val) => formatCurrency(val) } }
  }));
  trendChart3.render();
}

// ---------- Cards ----------
function renderKpiCards(fin) {
  const container = document.getElementById('cards-container');
  const cards = [
    { title: 'Total Revenue',   value: formatCompactNumber(fin.total_collected),   sub: 'Lifetime Collections', icon: 'payments' },
    { title: 'Total Disbursed', value: formatCompactNumber(fin.total_disbursed),   sub: 'Principal Lent',       icon: 'send_money' },
    { title: 'Cash Flow',       value: formatCompactNumber(fin.realized_cash_flow), sub: 'Net Collections',      icon: 'account_balance' },
    { title: 'Active Loans',    value: fin.active_loans_count ?? 0,                sub: 'Current Portfolio',    icon: 'assignment_turned_in' }
  ];

  container.innerHTML = cards.map((c) => `
    <div class="glass-card p-8 rounded-2xl flex flex-col justify-between h-[200px] relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-8 -mt-8" style="background:color-mix(in srgb, var(--color-primary) 6%, transparent)"></div>
      <div class="flex items-center justify-between">
        <span class="material-symbols-outlined text-[32px]" style="color:var(--color-primary)">${c.icon}</span>
      </div>
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-1">${c.title}</p>
        <h3 class="font-headline text-4xl font-bold text-on-surface leading-none">${c.value}</h3>
        <p class="text-[11px] text-outline mt-1">${c.sub}</p>
      </div>
    </div>`).join('');
}

function initStatusDonut(statusData) {
  const safeData = statusData && statusData.length ? statusData : [{ name: 'No Data', value: 1 }];
  const { primary: primaryColor, secondary: secondaryColor } = getThemeColors();
  const options = {
    series: safeData.map((s) => s.value),
    labels: safeData.map((s) => s.name),
    chart: { type: 'donut', height: 320, fontFamily: 'Inter' },
    colors: [primaryColor, secondaryColor, '#10b981', '#f59e0b'],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total Loans',
              fontSize: '14px',
              fontWeight: '700',
              color: '#64748b',
              formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
            },
            value: { fontSize: '28px', fontWeight: '800', color: '#0f172a' }
          }
        }
      }
    },
    legend: { position: 'bottom', fontSize: '12px', fontWeight: '600', labels: { colors: '#64748b' } },
    dataLabels: { enabled: false },
    stroke: { show: false }
  };
  new ApexCharts(document.querySelector('#donutChart'), withAnim(options)).render();
}

// ---------- Fallback stats ----------
function calculateFallbackStats(pipeline, perf) {
  const funnel = {
    STARTED: pipeline.filter((a) => a.status === 'STARTED').length,
    BANK_LINKING: pipeline.filter((a) => ['BANK_LINKING', 'AFFORD_OK'].includes(a.status)).length,
    OFFERED: pipeline.filter((a) => a.status === 'OFFERED').length,
    CONTRACT_SIGN: pipeline.filter((a) => ['CONTRACT_SIGN', 'OFFER_ACCEPTED'].includes(a.status)).length,
    APPROVED: pipeline.filter((a) => a.status === 'APPROVED').length
  };
  const vintage = (perf || [])
    .map((p) => ({ cohort: p.month_year, recovery_rate: p.disbursed_amount > 0 ? Math.round((p.repaid_amount / p.disbursed_amount) * 100) : 0 }))
    .filter((v) => v.cohort >= '2024-01');
  return { funnel, vintage, risk_matrix: [] };
}