import { initLayout } from '../shared/layout.js';
import { apiFetch } from '../shared/apiFetch.js';

const state = {
  mandates: [],
  currentMandate: null,
  currentFilter: 'all',
  config: null,
  diagnosticsOpen: false
};

// ── Plain-English status mapping ──────────────────────────────────────────────

const STATUS_LABEL = {
  success: 'Bank approved',
  failed: 'Rejected',
  pending: 'Awaiting bank',
  unknown: 'Not sent'
};

const STATUS_THEME = {
  success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', dot: 'bg-green-500' },
  failed:  { bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-red-200',   dot: 'bg-red-500'   },
  pending: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-400' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-600',  border: 'border-gray-200',  dot: 'bg-gray-400'  }
};

function normalizeStatus(raw) {
  const s = (raw || '').toLowerCase();
  if (s === 'success') return 'success';
  if (s === 'failed')  return 'failed';
  if (s === 'pending') return 'pending';
  return 'unknown';
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const escapeHtml = (value = '') => `${value}`
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const prettyJson = (value) => {
  if (!value) return 'No data recorded.';
  try { return JSON.stringify(value, null, 2); } catch (_) { return String(value); }
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R 0.00';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function setButtonLoading(button, loadingText) {
  if (!button) return () => {};
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>${loadingText}`;
  return () => { button.disabled = false; button.innerHTML = original; };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload.details || null;
    error.payload = payload;
    throw error;
  }
  return payload;
}

// ── Diagnostics log (hidden panel) ───────────────────────────────────────────

const diagLogs = [];

function addDiagLog(label, payload = null, level = 'info') {
  diagLogs.unshift({ at: new Date().toISOString(), label, payload, level });
  if (diagLogs.length > 120) diagLogs.length = 120;
  renderDiagLogs();
}

function renderDiagLogs() {
  const output = document.getElementById('diag-log-output');
  if (!output) return;
  if (!diagLogs.length) { output.textContent = 'No logs yet.'; return; }
  output.textContent = diagLogs.map((e) => {
    const stamp = new Date(e.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const body  = e.payload ? prettyJson(e.payload) : '';
    return `[${stamp}] [${e.level.toUpperCase()}] ${e.label}${body ? `\n${body}` : ''}`;
  }).join('\n\n');
}

function setDiagOutput(label, payload, tone = 'idle') {
  const output = document.getElementById('diag-lab-output');
  const badge  = document.getElementById('diag-lab-badge');
  if (output) output.textContent = typeof payload === 'string' ? payload : prettyJson(payload);
  if (badge) {
    const cls = { idle: 'bg-gray-800 text-gray-200', success: 'bg-green-900 text-green-100', error: 'bg-red-900 text-red-100', info: 'bg-blue-900 text-blue-100' };
    badge.className = `px-2.5 py-1 rounded-full text-[10px] font-bold ${cls[tone] || cls.idle}`;
    badge.textContent = label;
  }
}

// ── Page render ───────────────────────────────────────────────────────────────

function renderPage() {
  return `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p class="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">DebiCheck / SureSystems</p>
          <h1 class="text-2xl font-extrabold text-gray-900">Mandates</h1>
        </div>
        <div class="flex gap-3">
          <button id="refresh-btn" class="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition font-semibold text-sm flex items-center gap-2 shadow-sm">
            <i class="fa-solid fa-rotate-right"></i> Refresh
          </button>
          <button id="btn-sync-mandates" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl transition font-semibold text-sm flex items-center gap-2 shadow-sm">
            <i class="fa-solid fa-cloud-arrow-down"></i> Load from SureSystems
          </button>
        </div>
      </div>

      <!-- Health banner -->
      <div id="health-banner" class="mb-6"></div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" id="summary-cards"></div>

      <!-- Mandate table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h2 class="text-base font-bold text-gray-900">All Mandates</h2>
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="relative">
              <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input id="mandate-search" type="text" placeholder="Search name, ref, app ID…"
                class="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none w-64">
            </div>
            <div class="flex gap-2">
              <button class="filter-btn active px-3 py-1.5 rounded-full text-xs font-bold bg-gray-900 text-white" data-filter="all">All</button>
              <button class="filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="pending">Awaiting bank</button>
              <button class="filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="success">Approved</button>
              <button class="filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="failed">Rejected</button>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Applicant</th>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                <th class="px-5 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody id="mandates-tbody" class="bg-white divide-y divide-gray-100">
              <tr><td colspan="5" class="px-5 py-12 text-center text-gray-400">
                <i class="fa-solid fa-spinner fa-spin text-xl mb-2 text-orange-400 block"></i>Loading…
              </td></tr>
            </tbody>
          </table>
        </div>
        <div id="empty-state" class="hidden px-5 py-12 text-center text-gray-500">
          <i class="fa-solid fa-folder-open text-3xl text-gray-300 block mb-3"></i>
          No mandates match your filters.
        </div>
      </div>

      <!-- Diagnostics toggle -->
      <div class="mb-2">
        <button id="toggle-diagnostics" class="text-sm font-semibold text-gray-400 hover:text-gray-700 transition flex items-center gap-2">
          <i id="diag-chevron" class="fa-solid fa-chevron-right text-xs transition-transform"></i>
          Advanced diagnostics
        </button>
      </div>

      <!-- Diagnostics panel (hidden by default) -->
      <div id="diagnostics-panel" class="hidden space-y-6">

        <!-- Test lab -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <h2 class="text-sm font-bold text-gray-900">Payload Test Lab</h2>
            <p class="text-xs text-gray-500 mt-0.5">Preview or dry-run mandate payloads without hitting SureSystems live.</p>
          </div>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Application ID</span>
              <input id="diag-application-id" type="number" min="1" placeholder="e.g. 1234"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Collection Date</span>
              <input id="diag-collection-date" type="date"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Contract Reference (override)</span>
              <input id="diag-contract-reference" type="text" placeholder="Optional"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Front End User</span>
              <input id="diag-front-end-user" type="text" placeholder="webuser"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <div class="md:col-span-2 flex flex-wrap gap-3">
              <button id="btn-dry-run" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition shadow-sm">
                <i class="fa-solid fa-flask-vial mr-1.5"></i> Dry-run payload
              </button>
              <button id="btn-direct-load" class="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition shadow-sm">
                <i class="fa-solid fa-plug-circle-bolt mr-1.5"></i> Hit DebiCheck endpoint
              </button>
              <button id="btn-connectivity-probe" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 transition shadow-sm">
                <i class="fa-solid fa-network-wired mr-1.5"></i> Test connectivity
              </button>
            </div>
            <div class="md:col-span-2 rounded-xl border border-gray-200 bg-gray-950 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Output</span>
                <span id="diag-lab-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-200">Idle</span>
              </div>
              <pre id="diag-lab-output" class="text-xs text-green-400 font-mono whitespace-pre-wrap break-words min-h-[180px]">Use the buttons above to inspect payloads or run a connectivity probe.</pre>
            </div>
          </div>
        </div>

        <!-- Dev log -->
        <div class="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800">
          <div class="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Request log</span>
            <button id="btn-clear-logs" class="text-xs font-semibold text-gray-400 hover:text-gray-200 transition">Clear</button>
          </div>
          <pre id="diag-log-output" class="text-xs text-emerald-300 font-mono whitespace-pre-wrap break-words p-5 min-h-[140px] max-h-[320px] overflow-y-auto">No logs yet.</pre>
        </div>

      </div>

    </div>

    <!-- Mandate detail modal -->
    <div id="mandate-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-transform duration-200 scale-95">

        <!-- Modal header -->
        <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 class="text-lg font-bold text-gray-900">Mandate details</h2>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 transition">
            <i class="fa-solid fa-times fa-lg"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-5">

          <!-- Status banner -->
          <div id="modal-status-banner" class="rounded-xl px-4 py-3 flex items-center gap-3 border">
            <span id="modal-status-dot" class="w-2.5 h-2.5 rounded-full flex-shrink-0"></span>
            <div>
              <div id="modal-status-label" class="font-bold text-sm"></div>
              <div id="modal-status-msg" class="text-xs opacity-80 mt-0.5"></div>
            </div>
          </div>

          <!-- Key fields -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Applicant</div>
              <div id="modal-applicant" class="font-semibold text-gray-900 truncate"></div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Amount</div>
              <div id="modal-amount" class="font-semibold text-gray-900"></div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Contract ref</div>
              <div id="modal-contract-ref" class="font-mono text-xs text-gray-700 truncate"></div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Last updated</div>
              <div id="modal-updated" class="text-gray-700"></div>
            </div>
          </div>

          <!-- Action buttons -->
          <div id="modal-actions" class="flex flex-wrap gap-2"></div>

          <!-- Raw payload (collapsed) -->
          <div>
            <button id="toggle-raw-payload" class="text-xs font-semibold text-gray-400 hover:text-gray-600 transition flex items-center gap-1.5">
              <i id="raw-chevron" class="fa-solid fa-chevron-right text-[10px] transition-transform"></i>
              Raw payload
            </button>
            <div id="raw-payload-panel" class="hidden mt-3 space-y-3">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Request</div>
                <div class="bg-gray-950 rounded-xl p-3 overflow-x-auto max-h-48">
                  <pre id="modal-req-payload" class="text-[11px] text-green-400 font-mono whitespace-pre-wrap break-words"></pre>
                </div>
              </div>
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Response</div>
                <div class="bg-gray-950 rounded-xl p-3 overflow-x-auto max-h-48">
                  <pre id="modal-res-payload" class="text-[11px] text-blue-400 font-mono whitespace-pre-wrap break-words"></pre>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="px-6 py-4 border-t border-gray-100 flex justify-end">
          <a id="modal-open-app" href="#" class="text-sm font-semibold text-orange-600 hover:text-orange-700 transition flex items-center gap-1.5">
            Open application <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
          </a>
        </div>
      </div>
    </div>
  `;
}

// ── Health banner ─────────────────────────────────────────────────────────────

function renderHealthBanner() {
  const target = document.getElementById('health-banner');
  if (!target) return;
  const cfg = state.config;
  if (!cfg) { target.innerHTML = ''; return; }

  const ok = Boolean(cfg.configured);
  target.innerHTML = `
    <div class="rounded-xl border ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} px-4 py-3 flex items-center gap-3">
      <i class="fa-solid ${ok ? 'fa-circle-check text-green-600' : 'fa-circle-exclamation text-red-600'} text-lg flex-shrink-0"></i>
      <div class="flex-1 min-w-0">
        <span class="font-bold text-sm ${ok ? 'text-green-900' : 'text-red-900'}">
          ${ok ? 'SureSystems is configured and ready' : 'SureSystems is not fully configured'}
        </span>
        <span class="text-xs ${ok ? 'text-green-700' : 'text-red-700'} ml-2">
          ${ok
            ? `Merchant ${escapeHtml(cfg.merchantGid || '')} · ${cfg.useMtls ? 'mTLS on' : 'mTLS off'}`
            : `Missing: ${escapeHtml((cfg.missing || []).join(', ') || 'unknown fields')}`
          }
        </span>
      </div>
      <button id="refresh-health-btn" class="text-xs font-semibold ${ok ? 'text-green-700 hover:text-green-900' : 'text-red-700 hover:text-red-900'} transition flex-shrink-0">
        Re-check
      </button>
    </div>
  `;
  document.getElementById('refresh-health-btn')?.addEventListener('click', loadConfig);
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function renderSummaryCards() {
  const target = document.getElementById('summary-cards');
  if (!target) return;

  const counts = { total: state.mandates.length, success: 0, pending: 0, failed: 0 };
  state.mandates.forEach((m) => {
    const s = normalizeStatus(m.status);
    if (s === 'success') counts.success++;
    else if (s === 'failed') counts.failed++;
    else counts.pending++;
  });

  const cards = [
    { label: 'Total mandates',  value: counts.total,   cls: 'border-gray-200 text-gray-900' },
    { label: 'Bank approved',   value: counts.success, cls: 'border-green-200 bg-green-50 text-green-900' },
    { label: 'Awaiting bank',   value: counts.pending, cls: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Rejected / failed', value: counts.failed, cls: 'border-red-200 bg-red-50 text-red-900' }
  ];

  target.innerHTML = cards.map((c) => `
    <div class="rounded-2xl border ${c.cls} bg-white p-5 shadow-sm">
      <div class="text-2xl font-extrabold">${c.value}</div>
      <div class="text-xs font-semibold text-current opacity-70 mt-1">${c.label}</div>
    </div>
  `).join('');
}

// ── Table ─────────────────────────────────────────────────────────────────────

function getFilteredMandates() {
  const term = (document.getElementById('mandate-search')?.value || '').trim().toLowerCase();
  return state.mandates.filter((item) => {
    const s = normalizeStatus(item.status);
    const matchesFilter = state.currentFilter === 'all' || s === state.currentFilter;
    const searchable = [
      item.profiles?.full_name,
      item.profiles?.email,
      item.contract_reference,
      item.application_id,
      item.message
    ].filter(Boolean).join(' ').toLowerCase();
    return matchesFilter && (!term || searchable.includes(term));
  });
}

function renderTable() {
  const tbody = document.getElementById('mandates-tbody');
  const empty = document.getElementById('empty-state');
  if (!tbody || !empty) return;

  const rows = getFilteredMandates();
  if (!rows.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = rows.map((item) => {
    const s = normalizeStatus(item.status);
    const theme = STATUS_THEME[s];
    const label = STATUS_LABEL[s];
    const name   = item.profiles?.full_name || 'Unknown';
    const amount = item.loan_applications?.amount ? formatCurrency(item.loan_applications.amount) : '—';

    // Inline action buttons — contextual to status
    const hasContract = Boolean(item.contract_reference);
    const actions = [];
    if (s !== 'success') {
      actions.push(`<button class="row-action-btn text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition whitespace-nowrap"
        data-id="${escapeHtml(item.id)}" data-action="retry">
        <i class="fa-solid fa-rotate-right mr-1"></i>Send / Retry
      </button>`);
    }
    if (hasContract) {
      actions.push(`<button class="row-action-btn text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition whitespace-nowrap"
        data-id="${escapeHtml(item.id)}" data-action="enquiry">
        <i class="fa-solid fa-rotate mr-1"></i>Check status
      </button>`);
    }

    return `
      <tr class="hover:bg-gray-50 transition-colors cursor-pointer mandate-row" data-id="${escapeHtml(item.id)}">
        <td class="px-5 py-4">
          <div class="font-semibold text-sm text-gray-900">${escapeHtml(name)}</div>
          <div class="text-xs text-gray-400 mt-0.5">App ${escapeHtml(String(item.application_id || '—'))}</div>
        </td>
        <td class="px-5 py-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${theme.bg} ${theme.text} border ${theme.border}">
            <span class="w-1.5 h-1.5 rounded-full ${theme.dot}"></span>
            ${label}
          </span>
        </td>
        <td class="px-5 py-4 text-sm font-medium text-gray-900">${amount}</td>
        <td class="px-5 py-4 text-sm text-gray-500">${formatDate(item.updated_at)}</td>
        <td class="px-5 py-4 text-right">
          <div class="flex items-center justify-end gap-2">
            ${actions.join('')}
            <button class="mandate-row text-gray-300 hover:text-gray-500 transition" data-id="${escapeHtml(item.id)}">
              <i class="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Row click → open modal
  document.querySelectorAll('tr.mandate-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.row-action-btn')) return; // action btn handles itself
      openModal(row.dataset.id);
    });
  });

  // Inline action buttons
  document.querySelectorAll('.row-action-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      const item   = state.mandates.find((m) => String(m.id) === String(id));
      if (!item) return;
      state.currentMandate = item;
      if (action === 'retry')   handleRetry(btn);
      if (action === 'enquiry') handleCheckStatus(btn, 'enquiry');
    });
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function buildModalActions(item) {
  const s = normalizeStatus(item.status);
  const hasContract = Boolean(item.contract_reference);
  const btns = [];

  if (s !== 'success') {
    btns.push(`<button id="modal-btn-retry"
      class="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 transition">
      <i class="fa-solid fa-rotate-right mr-1.5"></i>Send / Retry mandate
    </button>`);
  }
  if (hasContract) {
    btns.push(`<button id="modal-btn-check"
      class="px-4 py-2 rounded-xl bg-sky-50 text-sky-700 font-bold text-sm hover:bg-sky-100 border border-sky-200 transition">
      <i class="fa-solid fa-rotate mr-1.5"></i>Check status
    </button>`);
    btns.push(`<button id="modal-btn-finalfate"
      class="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-sm hover:bg-indigo-100 border border-indigo-200 transition">
      <i class="fa-solid fa-satellite-dish mr-1.5"></i>Confirm fate
    </button>`);
    btns.push(`<button id="modal-btn-cancel"
      class="px-4 py-2 rounded-xl bg-red-50 text-red-700 font-bold text-sm hover:bg-red-100 border border-red-200 transition">
      <i class="fa-solid fa-ban mr-1.5"></i>Cancel mandate
    </button>`);
  }

  return btns.join('');
}

function openModal(id) {
  const item = state.mandates.find((m) => String(m.id) === String(id));
  if (!item) return;
  state.currentMandate = item;

  const s = normalizeStatus(item.status);
  const theme = STATUS_THEME[s];

  // Status banner
  const banner = document.getElementById('modal-status-banner');
  if (banner) {
    banner.className = `rounded-xl px-4 py-3 flex items-center gap-3 border ${theme.bg} ${theme.text} ${theme.border}`;
  }
  const dot = document.getElementById('modal-status-dot');
  if (dot) dot.className = `w-2.5 h-2.5 rounded-full flex-shrink-0 ${theme.dot}`;
  const lbl = document.getElementById('modal-status-label');
  if (lbl) lbl.textContent = STATUS_LABEL[s];
  const msg = document.getElementById('modal-status-msg');
  if (msg) msg.textContent = item.message || 'No message recorded.';

  // Fields
  const setEl = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };
  setEl('modal-applicant',    item.profiles?.full_name || item.user_id || '—');
  setEl('modal-amount',       item.loan_applications?.amount ? formatCurrency(item.loan_applications.amount) : '—');
  setEl('modal-contract-ref', item.contract_reference || 'No contract reference');
  setEl('modal-updated',      formatDate(item.updated_at));

  // Raw payloads
  const reqPre = document.getElementById('modal-req-payload');
  const resPre = document.getElementById('modal-res-payload');
  if (reqPre) reqPre.textContent = prettyJson(item.request_payload);
  if (resPre) {
    resPre.textContent = prettyJson(item.error_payload || item.response_payload);
    resPre.className   = `text-[11px] font-mono whitespace-pre-wrap break-words ${s === 'failed' ? 'text-red-400' : 'text-blue-400'}`;
  }

  // Open application link
  const appLink = document.getElementById('modal-open-app');
  if (appLink) {
    appLink.href = item.application_id ? `/admin/application-detail?id=${item.application_id}` : '#';
  }

  // Action buttons
  const actionsEl = document.getElementById('modal-actions');
  if (actionsEl) {
    actionsEl.innerHTML = buildModalActions(item);
    document.getElementById('modal-btn-retry')?.addEventListener('click', (e) => handleRetry(e.target.closest('button')));
    document.getElementById('modal-btn-check')?.addEventListener('click', (e) => handleCheckStatus(e.target.closest('button'), 'enquiry'));
    document.getElementById('modal-btn-finalfate')?.addEventListener('click', (e) => handleCheckStatus(e.target.closest('button'), 'finalfate'));
    document.getElementById('modal-btn-cancel')?.addEventListener('click', (e) => handleCancel(e.target.closest('button')));
  }

  // Reset raw payload collapse
  document.getElementById('raw-payload-panel')?.classList.add('hidden');
  const rc = document.getElementById('raw-chevron');
  if (rc) rc.style.transform = '';

  // Show modal
  const modal = document.getElementById('mandate-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.firstElementChild?.classList.remove('scale-95'), 10);
  }
}

function closeModal() {
  const modal = document.getElementById('mandate-modal');
  if (!modal) return;
  modal.firstElementChild?.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    state.currentMandate = null;
  }, 200);
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function handleRetry(button) {
  const item = state.currentMandate;
  if (!item?.application_id) {
    window.showToast?.('No application ID on this record', 'error');
    return;
  }
  const restore = setButtonLoading(button, 'Sending…');
  try {
    const payload = await fetchJson('/api/suresystems/activate-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: item.application_id })
    });
    addDiagLog('Mandate sent', payload, 'success');
    window.showToast?.(payload.message || 'Mandate sent to bank', 'success');
    await loadMandates();
    closeModal();
  } catch (error) {
    addDiagLog('Send mandate failed', { error: error.message, details: error.details }, 'error');
    window.showToast?.(error.message || 'Failed to send mandate', 'error');
  } finally {
    restore();
  }
}

async function handleCheckStatus(button, mode) {
  const item = state.currentMandate;
  if (!item?.contract_reference) {
    window.showToast?.('No contract reference on this record', 'error');
    return;
  }
  const label   = mode === 'finalfate' ? 'Confirming…' : 'Checking…';
  const restore = setButtonLoading(button, label);
  try {
    const payload = await fetchJson('/api/suresystems/mandates/check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId:    item.application_id || null,
        contractReference: item.contract_reference,
        frontEndUserName: item.profiles?.email || 'webuser',
        mode
      })
    });
    addDiagLog(`Status check (${mode})`, payload, 'success');
    window.showToast?.(payload.message || 'Status updated', 'success');
    await loadMandates();
    // Refresh modal with updated record
    const updated = state.mandates.find((m) => String(m.id) === String(item.id));
    if (updated) { state.currentMandate = updated; openModal(updated.id); }
    else closeModal();
  } catch (error) {
    addDiagLog(`Status check failed (${mode})`, { error: error.message }, 'error');
    window.showToast?.(error.message || 'Status check failed', 'error');
  } finally {
    restore();
  }
}

async function handleCancel(button) {
  const item = state.currentMandate;
  if (!item?.contract_reference) {
    window.showToast?.('No contract reference on this record', 'error');
    return;
  }
  if (!confirm(`Cancel the mandate for ${item.profiles?.full_name || 'this applicant'}? This cannot be undone.`)) return;
  const restore = setButtonLoading(button, 'Cancelling…');
  try {
    const payload = await fetchJson('/api/suresystems/mandates/cancel-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId:    item.application_id || null,
        contractReference: item.contract_reference,
        frontEndUserName: item.profiles?.email || 'webuser'
      })
    });
    addDiagLog('Mandate cancelled', payload, 'success');
    window.showToast?.(payload.message || 'Mandate cancelled', 'success');
    await loadMandates();
    closeModal();
  } catch (error) {
    addDiagLog('Cancel failed', { error: error.message }, 'error');
    window.showToast?.(error.message || 'Cancel failed', 'error');
  } finally {
    restore();
  }
}

// ── Diagnostics actions ───────────────────────────────────────────────────────

function getDiagOverrides() {
  const contractReference = document.getElementById('diag-contract-reference')?.value?.trim();
  const rawDate = document.getElementById('diag-collection-date')?.value || '';
  const collectionDate = rawDate ? rawDate.replace(/-/g, '') : '';
  const frontEndUserName = document.getElementById('diag-front-end-user')?.value?.trim();
  return {
    ...(contractReference ? { contractReference } : {}),
    ...(collectionDate    ? { collectionDate }    : {}),
    ...(frontEndUserName  ? { frontEndUserName }  : {})
  };
}

async function handleDryRun() {
  const button = document.getElementById('btn-dry-run');
  const restore = setButtonLoading(button, 'Preparing…');
  try {
    const applicationId = Number(document.getElementById('diag-application-id')?.value || 0) || null;
    const payload = await fetchJson('/api/suresystems/mandates/test-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, overrides: getDiagOverrides() })
    });
    addDiagLog('Dry-run', payload, 'success');
    setDiagOutput(payload.warnings?.length ? 'Preview with warnings' : 'Preview ready', payload, payload.warnings?.length ? 'info' : 'success');
  } catch (error) {
    addDiagLog('Dry-run failed', { error: error.message }, 'error');
    setDiagOutput('Preview failed', { error: error.message, details: error.details }, 'error');
  } finally {
    restore();
  }
}

async function handleDirectLoad() {
  const button = document.getElementById('btn-direct-load');
  const restore = setButtonLoading(button, 'Sending…');
  try {
    const applicationId = Number(document.getElementById('diag-application-id')?.value || 0);
    if (!applicationId) throw new Error('Application ID is required.');
    const payload = await fetchJson('/api/suresystems/mandates/load-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, overrides: getDiagOverrides() })
    });
    addDiagLog('Direct provider load', payload, 'success');
    setDiagOutput('Load complete', payload, 'success');
    window.showToast?.(payload.message || 'Load completed', 'success');
    await loadMandates();
  } catch (error) {
    addDiagLog('Direct load failed', { error: error.message }, 'error');
    setDiagOutput('Load failed', { error: error.message, details: error.details }, 'error');
    window.showToast?.(error.message || 'Load failed', 'error');
  } finally {
    restore();
  }
}

async function handleConnectivityProbe() {
  const button = document.getElementById('btn-connectivity-probe');
  const restore = setButtonLoading(button, 'Probing…');
  try {
    const payload = await fetchJson('/api/suresystems/debug/connectivity');
    addDiagLog('Connectivity probe', payload, payload.reachable ? 'success' : 'error');
    setDiagOutput(payload.reachable ? 'Host reachable' : 'Connectivity issue', payload, payload.reachable ? 'success' : 'error');
    window.showToast?.(payload.reachable ? 'SureSystems host reachable' : 'Connectivity issue detected', payload.reachable ? 'success' : 'error');
  } catch (error) {
    addDiagLog('Connectivity probe failed', { error: error.message }, 'error');
    setDiagOutput('Probe failed', { error: error.message }, 'error');
    window.showToast?.(error.message || 'Probe failed', 'error');
  } finally {
    restore();
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadConfig() {
  try {
    state.config = await fetchJson('/api/suresystems/config');
    addDiagLog('Config loaded', state.config, state.config?.configured ? 'success' : 'error');
    renderHealthBanner();
  } catch (error) {
    addDiagLog('Config load failed', { error: error.message }, 'error');
  }
}

async function loadMandates() {
  const tbody = document.getElementById('mandates-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-12 text-center text-gray-400">
      <i class="fa-solid fa-spinner fa-spin text-xl mb-2 text-orange-400 block"></i>Loading…
    </td></tr>`;
  }
  try {
    const payload = await fetchJson('/api/suresystems/mandates/history');
    state.mandates = payload.data || [];
    addDiagLog('Mandates loaded', { count: state.mandates.length }, 'info');
    renderSummaryCards();
    renderTable();
  } catch (error) {
    addDiagLog('Mandates load failed', { error: error.message }, 'error');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-red-500 text-sm">${escapeHtml(error.message)}</td></tr>`;
  }
}

// ── Event binding ─────────────────────────────────────────────────────────────

function bindEvents() {
  // Refresh
  document.getElementById('refresh-btn')?.addEventListener('click', () => Promise.all([loadConfig(), loadMandates()]));

  document.getElementById('btn-sync-mandates')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-mandates');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading…';
    try {
      const res  = await apiFetch('/api/admin/mandates/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sync failed');
      alert(`Mandates synced. ${json.synced ?? 0} records updated from SureSystems.`);
      await loadMandates();
    } catch (err) {
      alert('Sync error: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Load from SureSystems';
    }
  });

  // Filters
  document.getElementById('mandate-search')?.addEventListener('input', renderTable);
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentFilter = btn.dataset.filter || 'all';
      document.querySelectorAll('.filter-btn').forEach((b) => {
        b.classList.remove('bg-gray-900', 'text-white');
        b.classList.add('bg-gray-100', 'text-gray-600');
      });
      btn.classList.add('bg-gray-900', 'text-white');
      btn.classList.remove('bg-gray-100', 'text-gray-600');
      renderTable();
    });
  });

  // Modal close
  document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('mandate-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'mandate-modal') closeModal();
  });

  // Raw payload toggle in modal
  document.getElementById('toggle-raw-payload')?.addEventListener('click', () => {
    const panel  = document.getElementById('raw-payload-panel');
    const chevron = document.getElementById('raw-chevron');
    const open   = panel?.classList.toggle('hidden') === false;
    if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : '';
  });

  // Diagnostics toggle
  document.getElementById('toggle-diagnostics')?.addEventListener('click', () => {
    state.diagnosticsOpen = !state.diagnosticsOpen;
    const panel   = document.getElementById('diagnostics-panel');
    const chevron = document.getElementById('diag-chevron');
    panel?.classList.toggle('hidden', !state.diagnosticsOpen);
    if (chevron) chevron.style.transform = state.diagnosticsOpen ? 'rotate(90deg)' : '';
  });

  // Diagnostics buttons
  document.getElementById('btn-dry-run')?.addEventListener('click', handleDryRun);
  document.getElementById('btn-direct-load')?.addEventListener('click', handleDirectLoad);
  document.getElementById('btn-connectivity-probe')?.addEventListener('click', handleConnectivityProbe);
  document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
    diagLogs.length = 0;
    renderDiagLogs();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout();

  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = renderPage();
  bindEvents();
  renderDiagLogs();

  await Promise.all([loadConfig(), loadMandates()]);
});
