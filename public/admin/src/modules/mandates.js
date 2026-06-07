import { initLayout } from '../shared/layout.js';

const state = {
  mandates: [],
  currentMandate: null,
  currentFilter: 'all',
  config: null,
  logs: []
};

const STATUS_THEME = {
  success: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', icon: 'fa-check-circle' },
  failed: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: 'fa-circle-xmark' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: 'fa-clock' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', icon: 'fa-circle-question' }
};

const getStatusTheme = (status) => STATUS_THEME[(status || 'unknown').toLowerCase()] || STATUS_THEME.unknown;

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'R 0.00';
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const escapeHtml = (value = '') => `${value}`
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const prettyJson = (value) => {
  if (!value) return 'No payload recorded.';
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

function addLog(label, payload = null, level = 'info') {
  const entry = {
    at: new Date().toISOString(),
    label,
    payload,
    level
  };
  state.logs.unshift(entry);
  if (state.logs.length > 120) {
    state.logs = state.logs.slice(0, 120);
  }
  renderLogs();
}

function renderLogs() {
  const output = document.getElementById('dev-log-output');
  const count = document.getElementById('dev-log-count');
  if (count) {
    count.textContent = `${state.logs.length} entr${state.logs.length === 1 ? 'y' : 'ies'}`;
  }
  if (!output) return;

  if (!state.logs.length) {
    output.textContent = 'No logs yet. Run a connectivity probe or a SureSystems action.';
    return;
  }

  output.textContent = state.logs.map((entry) => {
    const stamp = new Date(entry.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const body = entry.payload ? prettyJson(entry.payload) : '';
    return `[${stamp}] [${entry.level.toUpperCase()}] ${entry.label}${body ? `\n${body}` : ''}`;
  }).join('\n\n');
}

async function fetchJson(url, options = {}) {
  addLog(`HTTP ${options.method || 'GET'} ${url} - request`, options.body ? JSON.parse(options.body) : null, 'info');
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    addLog(`HTTP ${options.method || 'GET'} ${url} - failed`, {
      status: response.status,
      payload
    }, 'error');
    const error = new Error(payload.error || payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload.details || null;
    error.payload = payload;
    throw error;
  }
  addLog(`HTTP ${options.method || 'GET'} ${url} - success`, {
    status: response.status,
    payload
  }, 'success');
  return payload;
}

function setButtonLoading(button, loadingText) {
  if (!button) return () => {};
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>${loadingText}`;
  return () => {
    button.disabled = false;
    button.innerHTML = original;
  };
}

function renderPage() {
  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div class="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 mb-8">
        <div>
          <a href="/admin/dashboard" class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition mb-3 group">
            <i class="fa-solid fa-arrow-left text-[10px] group-hover:-translate-x-0.5 transition-transform"></i>
            Back to Dashboard
          </a>
          <p class="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-2">SureSystems / DebiCheck</p>
          <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <i class="fa-solid fa-file-invoice text-orange-600"></i> Mandate Control Room
          </h1>
          <p class="mt-3 text-sm text-gray-500 max-w-3xl">
            Operate SureSystems DebiCheck mandates, inspect raw payloads, run safe dry-runs, and diagnose provider failures without leaving the admin desk.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button id="refresh-mandates-btn" class="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition shadow-sm font-semibold flex items-center gap-2">
            <i class="fa-solid fa-rotate-right"></i> Refresh data
          </button>
          <button id="refresh-config-btn" class="bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-black transition shadow-sm font-semibold flex items-center gap-2">
            <i class="fa-solid fa-shield-heart"></i> Refresh health
          </button>
        </div>
      </div>

      <div id="mandates-health-banner" class="mb-6"></div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8" id="mandates-summary-cards"></div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <section class="xl:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/70">
            <h2 class="text-lg font-bold text-gray-900">Mandate Test Lab</h2>
            <p class="text-sm text-gray-500 mt-1">Use dry-run mode to preview the exact payload without hitting SureSystems. Use live mode only when configuration is healthy.</p>
          </div>
          <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Application ID</span>
              <input id="test-application-id" type="number" min="1" placeholder="e.g. 1234" class="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Front End User</span>
              <input id="test-front-end-user" type="text" placeholder="ops@company.co.za" class="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Collection Date</span>
              <input id="test-collection-date" type="date" class="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Contract Reference</span>
              <input id="test-contract-reference" type="text" placeholder="Optional override" class="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <div class="md:col-span-2 flex flex-wrap gap-3 pt-2">
              <button id="btn-preview-mandate" class="px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-sm">
                <i class="fa-solid fa-flask-vial mr-2"></i> Dry-run payload
              </button>
              <button id="btn-direct-provider-load" class="px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-sm">
                <i class="fa-solid fa-plug-circle-bolt mr-2"></i> Hit DebiCheck endpoint
              </button>
              <button id="btn-live-activate" class="px-4 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all shadow-sm">
                <i class="fa-solid fa-bolt mr-2"></i> Load live mandate
              </button>
            </div>
            <div class="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-950 p-4">
              <div class="flex items-center justify-between gap-3 mb-3">
                <h3 class="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Preview / Diagnostics</h3>
                <span id="test-lab-badge" class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-200">Idle</span>
              </div>
              <pre id="test-lab-output" class="text-xs text-green-400 font-mono whitespace-pre-wrap break-words min-h-[240px]"></pre>
            </div>
          </div>
        </section>

        <section class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/70">
            <h2 class="text-lg font-bold text-gray-900">Provider Actions</h2>
            <p class="text-sm text-gray-500 mt-1">Use the contract reference from a selected record or type one manually.</p>
          </div>
          <div class="p-6 space-y-4">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Application ID</span>
              <input id="action-application-id" type="number" min="1" placeholder="Used for DB write-back" class="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Contract Reference</span>
              <input id="action-contract-reference" type="text" placeholder="Paste contract reference" class="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Front End User</span>
              <input id="action-front-end-user" type="text" placeholder="webuser" class="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button id="btn-final-fate" class="px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-sm">
                <i class="fa-solid fa-satellite-dish mr-2"></i> Final fate
              </button>
              <button id="btn-enquiry" class="px-4 py-3 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-all shadow-sm">
                <i class="fa-solid fa-magnifying-glass mr-2"></i> Mandate enquiry
              </button>
              <button id="btn-cancel-mandate" class="px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-sm">
                <i class="fa-solid fa-ban mr-2"></i> Cancel mandate
              </button>
              <a id="btn-open-application" href="#" class="px-4 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-all shadow-sm text-center">
                <i class="fa-solid fa-arrow-up-right-from-square mr-2"></i> Open application
              </a>
            </div>
            <div class="rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-4">
              <h3 class="text-sm font-bold text-orange-900 mb-2">Operational Notes</h3>
              <ul class="space-y-2 text-sm text-orange-800">
                <li>DebiCheck requires the payer’s bank to authenticate the mandate; it is not the same as a plain EFT debit order.</li>
                <li>SureSystems advertises TT1 real-time, TT1 delayed, TT2 delayed batch, and TT3 POS flows.</li>
                <li>If you see HTTP 503 here, it usually means the provider config is missing or unavailable before any bank action begins.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Dev Console</h2>
            <p class="text-sm text-gray-500 mt-1">Run host connectivity checks and inspect raw logs from this page without opening browser dev tools.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button id="btn-connectivity-probe" class="px-4 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-all shadow-sm">
              <i class="fa-solid fa-network-wired mr-2"></i> Test connectivity
            </button>
            <button id="btn-clear-dev-logs" class="px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-all shadow-sm">
              <i class="fa-solid fa-broom mr-2"></i> Clear logs
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-0">
          <div class="border-r border-gray-100 p-6 bg-gray-50/40">
            <div id="connectivity-summary" class="space-y-3 text-sm text-gray-600">
              <div class="rounded-2xl border border-dashed border-gray-200 bg-white p-4">
                Connectivity checks have not run yet.
              </div>
            </div>
          </div>
          <div class="p-6 bg-gray-950">
            <div class="flex items-center justify-between gap-3 mb-3">
              <h3 class="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Live Logs</h3>
              <span id="dev-log-count" class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-200">0 entries</span>
            </div>
            <pre id="dev-log-output" class="text-xs text-emerald-300 font-mono whitespace-pre-wrap break-words min-h-[240px] max-h-[420px] overflow-y-auto"></pre>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-1 2xl:grid-cols-[1.8fr,1fr] gap-6">
        <section class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div>
              <h2 class="text-lg font-bold text-gray-900">Mandate Audit Trail</h2>
              <p class="text-sm text-gray-500 mt-1">Recent SureSystems mandate activity stored in your audit table.</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="relative w-full sm:w-80">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i class="fa-solid fa-search text-gray-400"></i>
                </div>
                <input id="mandate-search" type="text" placeholder="Search by name, contract ref, or app ID..." class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-gray-50">
              </div>
              <div class="flex gap-2 overflow-x-auto">
                <button class="filter-btn active px-4 py-2 rounded-full text-xs font-bold bg-gray-900 text-white" data-filter="all">All</button>
                <button class="filter-btn px-4 py-2 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="pending">Pending</button>
                <button class="filter-btn px-4 py-2 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="success">Success</button>
                <button class="filter-btn px-4 py-2 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="failed">Failed</button>
              </div>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Applicant / App</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lifecycle</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contract / Amount</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Update</th>
                  <th class="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody id="mandates-table-body" class="bg-white divide-y divide-gray-100">
                <tr><td colspan="5" class="px-6 py-12 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-orange-500"></i><p>Loading mandates...</p></td></tr>
              </tbody>
            </table>
          </div>
          <div id="empty-state" class="hidden px-6 py-12 text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <i class="fa-solid fa-folder-open text-2xl text-gray-400"></i>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">No mandates found</h3>
            <p class="text-sm text-gray-500">No SureSystems mandate records match your current filters.</p>
          </div>
        </section>

        <section class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/70">
            <h2 class="text-lg font-bold text-gray-900">Standards Cheat Sheet</h2>
            <p class="text-sm text-gray-500 mt-1">Practical reminders for operators handling DebiCheck mandates.</p>
          </div>
          <div class="p-6 space-y-5 text-sm text-gray-700">
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 class="font-bold text-gray-900 mb-2">Mandate Flow</h3>
              <p>Customer agrees to debit terms, their bank authenticates the DebiCheck mandate, and collections should then stay within the agreed parameters.</p>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 class="font-bold text-gray-900 mb-2">SureSystems Modes</h3>
              <p>TT1 real-time and delayed, TT2 delayed batch, and TT3 POS are the provider-side transaction patterns publicly described by SureSystems.</p>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 class="font-bold text-gray-900 mb-2">What 503 Usually Means</h3>
              <p>A 503 here generally points to missing provider configuration, certificate setup, or an upstream SureSystems outage rather than a debtor-bank rejection.</p>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 class="font-bold text-gray-900 mb-2">Good Operational Practice</h3>
              <p>Dry-run the payload before go-live, keep contract references visible, and use final fate or enquiry before retrying duplicate loads.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function buildSummary() {
  const summary = {
    total: state.mandates.length,
    success: 0,
    failed: 0,
    pending: 0
  };

  state.mandates.forEach((item) => {
    const normalized = (item.status || 'unknown').toLowerCase();
    if (normalized === 'success') summary.success += 1;
    else if (normalized === 'failed') summary.failed += 1;
    else summary.pending += 1;
  });

  return summary;
}

function renderHealthBanner() {
  const target = document.getElementById('mandates-health-banner');
  if (!target) return;
  const config = state.config;

  if (!config) {
    target.innerHTML = `
      <div class="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-500">
        Configuration status has not loaded yet.
      </div>
    `;
    return;
  }

  const missing = Array.isArray(config.missing) ? config.missing : [];
  const isConfigured = Boolean(config.configured);
  target.innerHTML = `
    <div class="rounded-2xl border ${isConfigured ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} px-5 py-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.18em] ${isConfigured ? 'text-green-700' : 'text-red-700'}">Provider Health</p>
          <h2 class="text-lg font-bold ${isConfigured ? 'text-green-900' : 'text-red-900'} mt-1">
            ${isConfigured ? 'SureSystems configuration looks ready' : 'SureSystems is not fully configured'}
          </h2>
          <p class="text-sm ${isConfigured ? 'text-green-800' : 'text-red-800'} mt-2">
            ${isConfigured
              ? `Merchant GID ${escapeHtml(config.merchantGid)} / Remote GID ${escapeHtml(config.remoteGid)} ${config.useMtls ? 'with mTLS enabled' : 'without mTLS'}.`
              : `Missing setup: ${escapeHtml(missing.join(', ') || 'unknown configuration values')}. Live actions will likely return 503 until this is fixed.`}
          </p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 font-bold">Header Prefix: ${escapeHtml(config.headerPrefix || 'N/A')}</span>
          <span class="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 font-bold">mTLS: ${config.useMtls ? 'On' : 'Off'}</span>
          <span class="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 font-bold">Configured: ${isConfigured ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </div>
  `;
}

function renderSummaryCards() {
  const target = document.getElementById('mandates-summary-cards');
  if (!target) return;
  const summary = buildSummary();
  const cards = [
    { label: 'Tracked Mandates', value: summary.total, icon: 'fa-database', tone: 'bg-white border-gray-200 text-gray-900' },
    { label: 'Successful Loads', value: summary.success, icon: 'fa-check-double', tone: 'bg-green-50 border-green-200 text-green-900' },
    { label: 'Pending / Unknown', value: summary.pending, icon: 'fa-hourglass-half', tone: 'bg-yellow-50 border-yellow-200 text-yellow-900' },
    { label: 'Failed Attempts', value: summary.failed, icon: 'fa-bug', tone: 'bg-red-50 border-red-200 text-red-900' }
  ];

  target.innerHTML = cards.map((card) => `
    <div class="rounded-2xl border ${card.tone} p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.18em] opacity-70">${card.label}</p>
          <div class="text-3xl font-extrabold mt-2">${card.value}</div>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-white/80 border border-white/60 flex items-center justify-center">
          <i class="fa-solid ${card.icon} text-lg"></i>
        </div>
      </div>
    </div>
  `).join('');
}

function renderConnectivitySummary(payload = null) {
  const target = document.getElementById('connectivity-summary');
  if (!target) return;
  if (!payload) {
    target.innerHTML = `
      <div class="rounded-2xl border border-dashed border-gray-200 bg-white p-4">
        Connectivity checks have not run yet.
      </div>
    `;
    return;
  }

  const reachable = Boolean(payload.reachable);
  target.innerHTML = `
    <div class="rounded-2xl border ${reachable ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} p-4">
      <p class="text-[10px] font-black uppercase tracking-[0.18em] ${reachable ? 'text-green-700' : 'text-red-700'}">Connectivity</p>
      <h3 class="text-base font-bold ${reachable ? 'text-green-900' : 'text-red-900'} mt-2">
        ${reachable ? 'Provider host reachable' : 'Connectivity problem detected'}
      </h3>
      <p class="text-sm mt-2 ${reachable ? 'text-green-800' : 'text-red-800'}">${escapeHtml(payload.error || payload.statusText || 'Probe completed.')}</p>
    </div>
    <div class="rounded-2xl border border-gray-200 bg-white p-4">
      <p class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">Base URL</p>
      <p class="text-sm font-mono text-gray-800 break-all">${escapeHtml(payload.baseUrl || 'N/A')}</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">HTTP Status</p>
        <p class="text-sm font-bold text-gray-900">${escapeHtml(payload.status ?? 'N/A')}</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">mTLS</p>
        <p class="text-sm font-bold text-gray-900">${payload.useMtls ? 'Enabled' : 'Disabled'}</p>
      </div>
    </div>
    <div class="rounded-2xl border border-gray-200 bg-white p-4">
      <p class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">Missing Config</p>
      <p class="text-sm text-gray-700">${escapeHtml((payload.missing || []).join(', ') || 'None')}</p>
    </div>
  `;
}

function getFilteredMandates() {
  const term = (document.getElementById('mandate-search')?.value || '').trim().toLowerCase();
  return state.mandates.filter((item) => {
    const status = (item.status || 'unknown').toLowerCase();
    const matchesFilter = state.currentFilter === 'all' || status === state.currentFilter;
    const searchable = [
      item.profiles?.full_name,
      item.profiles?.email,
      item.contract_reference,
      item.application_id,
      item.message
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesTerm = !term || searchable.includes(term);
    return matchesFilter && matchesTerm;
  });
}

function renderTable() {
  const tbody = document.getElementById('mandates-table-body');
  const emptyState = document.getElementById('empty-state');
  if (!tbody || !emptyState) return;

  const rows = getFilteredMandates();
  if (!rows.length) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tbody.innerHTML = rows.map((item) => {
    const theme = getStatusTheme(item.status);
    const applicantName = item.profiles?.full_name || item.user_id || 'Unknown User';
    const amount = item.loan_applications?.amount ? formatCurrency(item.loan_applications.amount) : 'Unknown Amount';
    const contractReference = item.contract_reference || 'No contract reference';
    const message = item.message || 'No message recorded';
    return `
      <tr class="hover:bg-gray-50 transition-colors group">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-600 shadow-inner">
              ${escapeHtml((applicantName || 'U').charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="font-bold text-gray-900 text-sm">${escapeHtml(applicantName)}</div>
              <div class="text-xs text-gray-500 font-mono mt-0.5">App ID: ${escapeHtml(item.application_id)}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${theme.bg} ${theme.text} border ${theme.border}">
            <i class="fa-solid ${theme.icon}"></i> ${escapeHtml((item.status || 'unknown').toUpperCase())}
          </span>
          <div class="text-xs text-gray-500 mt-2 max-w-xs truncate" title="${escapeHtml(message)}">${escapeHtml(message)}</div>
        </td>
        <td class="px-6 py-4">
          <div class="text-sm font-bold text-gray-900 font-mono">${escapeHtml(contractReference)}</div>
          <div class="text-xs text-gray-500 mt-0.5">${amount}</div>
        </td>
        <td class="px-6 py-4">
          <div class="text-sm text-gray-900 font-medium">${formatDate(item.updated_at)}</div>
          <div class="text-xs text-gray-500 mt-0.5">Created: ${formatDate(item.created_at)}</div>
        </td>
        <td class="px-6 py-4 text-right">
          <button class="view-mandate-btn text-gray-400 hover:text-orange-600 transition-colors bg-white hover:bg-orange-50 w-9 h-9 rounded-xl border border-transparent hover:border-orange-200" data-id="${escapeHtml(item.id)}">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.view-mandate-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openMandateModal(button.dataset.id);
    });
  });
}

function syncActionPanel(mandate) {
  const applicationIdInput = document.getElementById('action-application-id');
  const contractInput = document.getElementById('action-contract-reference');
  const userInput = document.getElementById('action-front-end-user');
  const link = document.getElementById('btn-open-application');
  if (!applicationIdInput || !contractInput || !userInput || !link) return;

  applicationIdInput.value = mandate?.application_id || '';
  contractInput.value = mandate?.contract_reference || '';
  userInput.value = mandate?.profiles?.email || 'webuser';
  if (mandate?.application_id) {
    link.href = `/admin/application-detail?id=${mandate.application_id}`;
    link.classList.remove('pointer-events-none', 'opacity-50');
  } else {
    link.href = '#';
    link.classList.add('pointer-events-none', 'opacity-50');
  }
}

function openMandateModal(id) {
  const mandate = state.mandates.find((item) => String(item.id) === String(id));
  if (!mandate) return;
  state.currentMandate = mandate;
  syncActionPanel(mandate);

  const modal = document.getElementById('payload-modal');
  const container = modal?.firstElementChild;
  if (!modal || !container) return;

  const theme = getStatusTheme(mandate.status);
  const banner = document.getElementById('modal-status-banner');
  const icon = document.getElementById('modal-status-icon');
  const statusText = document.getElementById('modal-status-text');
  const messageText = document.getElementById('modal-message-text');
  const requestPre = document.getElementById('modal-request-payload');
  const responsePre = document.getElementById('modal-response-payload');
  const retryBtn = document.getElementById('btn-retry-mandate');
  const fateBtn = document.getElementById('btn-check-fate');
  const enquiryBtn = document.getElementById('btn-run-enquiry');
  const cancelBtn = document.getElementById('btn-run-cancel');

  banner.className = `p-4 rounded-xl font-semibold flex items-start gap-3 border ${theme.bg} ${theme.text} ${theme.border}`;
  icon.className = `fa-solid ${theme.icon} text-xl mt-0.5`;
  statusText.textContent = `Status: ${(mandate.status || 'unknown').toUpperCase()}`;
  messageText.textContent = mandate.message || 'No additional message provided.';
  requestPre.textContent = prettyJson(mandate.request_payload);
  responsePre.textContent = prettyJson(mandate.error_payload || mandate.response_payload);
  responsePre.className = `text-xs font-mono whitespace-pre-wrap break-words ${mandate.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`;

  retryBtn?.classList.toggle('hidden', mandate.status === 'success');
  fateBtn?.classList.toggle('hidden', !mandate.contract_reference);
  enquiryBtn?.classList.toggle('hidden', !mandate.contract_reference);
  cancelBtn?.classList.toggle('hidden', !mandate.contract_reference);

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => container.classList.remove('scale-95'), 10);
}

function closePayloadModal() {
  const modal = document.getElementById('payload-modal');
  const container = modal?.firstElementChild;
  if (!modal || !container) return;
  container.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    state.currentMandate = null;
  }, 200);
}

async function loadConfig() {
  state.config = await fetchJson('/api/suresystems/config');
  addLog('SureSystems config loaded', state.config, state.config?.configured ? 'success' : 'error');
  renderHealthBanner();
}

async function loadMandates() {
  const tbody = document.getElementById('mandates-table-body');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-orange-500"></i><p>Loading mandates...</p></td></tr>`;
  }
  const payload = await fetchJson('/api/suresystems/mandates/history');
  state.mandates = payload.data || [];
  addLog('Mandate history loaded', { count: state.mandates.length }, 'info');
  renderSummaryCards();
  renderTable();
}

async function refreshAll() {
  try {
    await Promise.all([loadConfig(), loadMandates()]);
  } catch (error) {
    window.showToast?.(error.message || 'Unable to refresh mandates', 'error');
  }
}

async function handleConnectivityProbe() {
  const button = document.getElementById('btn-connectivity-probe');
  const restore = setButtonLoading(button, 'Probing...');
  try {
    const payload = await fetchJson('/api/suresystems/debug/connectivity');
    renderConnectivitySummary(payload);
    setLabOutput('Connectivity probe complete', payload, payload.reachable ? 'success' : 'error');
    window.showToast?.(payload.reachable ? 'SureSystems host reachable' : 'SureSystems connectivity issue detected', payload.reachable ? 'success' : 'error');
  } catch (error) {
    const payload = {
      error: error.message,
      details: error.details || null
    };
    renderConnectivitySummary({
      reachable: false,
      error: error.message,
      status: error.status || null,
      baseUrl: state.config?.baseUrl || '',
      useMtls: state.config?.useMtls || false,
      missing: state.config?.missing || []
    });
    setLabOutput('Connectivity probe failed', payload, 'error');
    window.showToast?.(error.message || 'SureSystems connectivity probe failed', 'error');
  } finally {
    restore();
  }
}

function getTestOverrides() {
  const frontEndUserName = document.getElementById('test-front-end-user')?.value?.trim() || '';
  const contractReference = document.getElementById('test-contract-reference')?.value?.trim() || '';
  const rawDate = document.getElementById('test-collection-date')?.value || '';
  const collectionDate = rawDate ? rawDate.replace(/-/g, '') : '';
  return {
    ...(frontEndUserName ? { frontEndUserName } : {}),
    ...(contractReference ? { contractReference } : {}),
    ...(collectionDate ? { collectionDate } : {})
  };
}

function setLabOutput(label, payload, tone = 'idle') {
  const output = document.getElementById('test-lab-output');
  const badge = document.getElementById('test-lab-badge');
  if (output) {
    output.textContent = typeof payload === 'string' ? payload : prettyJson(payload);
  }
  if (badge) {
    const classes = {
      idle: 'bg-gray-800 text-gray-200',
      success: 'bg-green-900 text-green-100',
      error: 'bg-red-900 text-red-100',
      info: 'bg-blue-900 text-blue-100'
    };
    badge.className = `px-2.5 py-1 rounded-full text-[10px] font-bold ${classes[tone] || classes.idle}`;
    badge.textContent = label;
  }
}

async function handlePreviewPayload() {
  const button = document.getElementById('btn-preview-mandate');
  const restore = setButtonLoading(button, 'Preparing...');
  try {
    const applicationId = Number(document.getElementById('test-application-id')?.value || 0) || null;
    const payload = await fetchJson('/api/suresystems/mandates/test-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        overrides: getTestOverrides()
      })
    });
    setLabOutput(payload.warnings?.length ? 'Preview with warnings' : 'Preview ready', payload, payload.warnings?.length ? 'info' : 'success');
    if (applicationId) {
      document.getElementById('action-application-id').value = applicationId;
    }
  } catch (error) {
    setLabOutput('Preview failed', { error: error.message, details: error.details || null }, 'error');
    window.showToast?.(error.message || 'Unable to build test payload', 'error');
  } finally {
    restore();
  }
}

async function handleLiveActivation() {
  const button = document.getElementById('btn-live-activate');
  const restore = setButtonLoading(button, 'Loading...');
  try {
    const applicationId = Number(document.getElementById('test-application-id')?.value || 0);
    if (!applicationId) {
      throw new Error('Application ID is required for live mandate loading.');
    }

    const payload = await fetchJson('/api/suresystems/activate-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId })
    });
    setLabOutput('Live load complete', payload, 'success');
    window.showToast?.(payload.message || 'SureSystems mandate loaded', 'success');
    await loadMandates();
  } catch (error) {
    setLabOutput(error.status === 503 ? 'Provider unavailable' : 'Live load failed', { error: error.message, details: error.details || null }, 'error');
    window.showToast?.(error.message || 'SureSystems mandate load failed', 'error');
  } finally {
    restore();
  }
}

async function handleDirectProviderLoad() {
  const button = document.getElementById('btn-direct-provider-load');
  const restore = setButtonLoading(button, 'Sending...');
  try {
    const applicationId = Number(document.getElementById('test-application-id')?.value || 0);
    if (!applicationId) {
      throw new Error('Application ID is required before hitting the DebiCheck endpoint.');
    }

    const payload = await fetchJson('/api/suresystems/mandates/load-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        overrides: getTestOverrides()
      })
    });

    setLabOutput('Direct provider load complete', payload, 'success');
    window.showToast?.(payload.message || 'SureSystems direct load completed', 'success');
    document.getElementById('action-application-id').value = applicationId;
    if (payload.contractReference) {
      document.getElementById('action-contract-reference').value = payload.contractReference;
    }
    if (payload.profile?.email) {
      document.getElementById('action-front-end-user').value = payload.profile.email;
    }
    await loadMandates();
  } catch (error) {
    setLabOutput(error.status === 503 ? 'Provider unavailable' : 'Direct provider load failed', {
      error: error.message,
      details: error.details || null
    }, 'error');
    window.showToast?.(error.message || 'SureSystems direct load failed', 'error');
  } finally {
    restore();
  }
}

async function runStatusAction(mode) {
  const button = mode === 'enquiry' ? document.getElementById('btn-enquiry') : document.getElementById('btn-final-fate');
  const restore = setButtonLoading(button, mode === 'enquiry' ? 'Enquiring...' : 'Checking...');
  try {
    const applicationId = Number(document.getElementById('action-application-id')?.value || 0) || null;
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    if (!contractReference) {
      throw new Error('Contract reference is required.');
    }

    const payload = await fetchJson('/api/suresystems/mandates/check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, contractReference, frontEndUserName, mode })
    });
    setLabOutput(mode === 'enquiry' ? 'Enquiry complete' : 'Final fate complete', payload, 'success');
    window.showToast?.(payload.message || 'Status check complete', 'success');
    await loadMandates();
    if (state.currentMandate?.id) {
      openMandateModal(state.currentMandate.id);
    }
  } catch (error) {
    setLabOutput(mode === 'enquiry' ? 'Enquiry failed' : 'Final fate failed', { error: error.message, details: error.details || null }, 'error');
    window.showToast?.(error.message || 'SureSystems status check failed', 'error');
  } finally {
    restore();
  }
}

async function handleCancelMandate() {
  const button = document.getElementById('btn-cancel-mandate');
  const restore = setButtonLoading(button, 'Cancelling...');
  try {
    const applicationId = Number(document.getElementById('action-application-id')?.value || 0) || null;
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    if (!contractReference) {
      throw new Error('Contract reference is required.');
    }

    const payload = await fetchJson('/api/suresystems/mandates/cancel-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, contractReference, frontEndUserName })
    });
    setLabOutput('Cancel complete', payload, 'success');
    window.showToast?.(payload.message || 'Mandate cancel submitted', 'success');
    await loadMandates();
    closePayloadModal();
  } catch (error) {
    setLabOutput('Cancel failed', { error: error.message, details: error.details || null }, 'error');
    window.showToast?.(error.message || 'Cancel mandate failed', 'error');
  } finally {
    restore();
  }
}

async function handleRetryMandate() {
  if (!state.currentMandate?.application_id) {
    window.showToast?.('No application selected for retry', 'error');
    return;
  }
  document.getElementById('test-application-id').value = state.currentMandate.application_id;
  await handleLiveActivation();
}

function bindFilters() {
  document.getElementById('mandate-search')?.addEventListener('input', renderTable);
  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentFilter = button.dataset.filter || 'all';
      document.querySelectorAll('.filter-btn').forEach((item) => {
        item.classList.remove('bg-gray-900', 'text-white');
        item.classList.add('bg-gray-100', 'text-gray-600');
      });
      button.classList.add('bg-gray-900', 'text-white');
      button.classList.remove('bg-gray-100', 'text-gray-600');
      renderTable();
    });
  });
}

function ensureExtraModalActions() {
  const footer = document.querySelector('#payload-modal .mt-6.pt-4');
  if (!footer || document.getElementById('btn-run-enquiry')) return;
  footer.insertAdjacentHTML('afterbegin', `
    <button id="btn-run-cancel" class="px-5 py-2 bg-red-50 text-red-700 font-bold rounded-lg border border-red-200 hover:bg-red-100 transition-colors hidden">
      <i class="fa-solid fa-ban mr-2"></i> Cancel
    </button>
    <button id="btn-run-enquiry" class="px-5 py-2 bg-sky-50 text-sky-700 font-bold rounded-lg border border-sky-200 hover:bg-sky-100 transition-colors hidden">
      <i class="fa-solid fa-magnifying-glass mr-2"></i> Enquiry
    </button>
  `);
}

function bindEvents() {
  document.getElementById('refresh-mandates-btn')?.addEventListener('click', loadMandates);
  document.getElementById('refresh-config-btn')?.addEventListener('click', loadConfig);
  document.getElementById('btn-connectivity-probe')?.addEventListener('click', handleConnectivityProbe);
  document.getElementById('btn-clear-dev-logs')?.addEventListener('click', () => {
    state.logs = [];
    renderLogs();
  });
  document.getElementById('btn-preview-mandate')?.addEventListener('click', handlePreviewPayload);
  document.getElementById('btn-direct-provider-load')?.addEventListener('click', handleDirectProviderLoad);
  document.getElementById('btn-live-activate')?.addEventListener('click', handleLiveActivation);
  document.getElementById('btn-final-fate')?.addEventListener('click', () => runStatusAction('finalfate'));
  document.getElementById('btn-enquiry')?.addEventListener('click', () => runStatusAction('enquiry'));
  document.getElementById('btn-cancel-mandate')?.addEventListener('click', handleCancelMandate);
  document.getElementById('btn-retry-mandate')?.addEventListener('click', handleRetryMandate);
  document.getElementById('btn-check-fate')?.addEventListener('click', () => runStatusAction('finalfate'));
  document.getElementById('btn-run-enquiry')?.addEventListener('click', () => runStatusAction('enquiry'));
  document.getElementById('btn-run-cancel')?.addEventListener('click', handleCancelMandate);
  document.getElementById('close-modal-btn')?.addEventListener('click', closePayloadModal);
  document.getElementById('payload-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'payload-modal') {
      closePayloadModal();
    }
  });
  bindFilters();
}

document.addEventListener('DOMContentLoaded', async () => {
  const shell = document.getElementById('app-shell');
  if (!shell) return;

  await initLayout();
  shell.innerHTML = renderPage();
  ensureExtraModalActions();
  bindEvents();
  renderConnectivitySummary();
  renderLogs();
  addLog('Mandate page initialized', { page: 'admin/mandates.html' }, 'info');
  setLabOutput('Idle', 'Use the test lab to preview mandate payloads or inspect provider responses.', 'idle');
  await refreshAll();
});
