import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';

const state = {
  mandates: [],
  currentMandate: null,
  currentFilter: 'all',
  config: null,
  accessToken: null
};

const STATUS_THEME = {
  success: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', icon: 'fa-check-circle', label: 'Active' },
  failed:  { bg: 'bg-red-100',   text: 'text-red-800',   border: 'border-red-200',   icon: 'fa-circle-xmark', label: 'Failed' },
  pending: { bg: 'bg-yellow-100',text: 'text-yellow-800',border: 'border-yellow-200',icon: 'fa-clock',        label: 'Awaiting bank' },
  unknown: { bg: 'bg-gray-100',  text: 'text-gray-800',  border: 'border-gray-200',  icon: 'fa-circle-question', label: 'Unknown' }
};

const getStatusTheme = (status) => STATUS_THEME[(status || 'unknown').toLowerCase()] || STATUS_THEME.unknown;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R 0.00';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const escapeHtml = (v = '') => `${v}`
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MANDATE_ERROR_MAP = [
  [/account.not.found|invalid.account/i, 'The client\'s bank account number was not found. Please ask them to check their account details and update.'],
  [/insufficient.funds|no.funds/i, 'The account did not have enough funds when we tried. Please try again or contact the client.'],
  [/account.closed|closed.account/i, 'This bank account is closed. Please ask the client to provide a new account.'],
  [/wrong.branch|invalid.branch/i, 'The branch code does not match the selected bank. Please update the bank details.'],
  [/not.authenticated|authentication.failed/i, 'The client\'s bank needs to approve this. This usually happens within 1–2 business days.'],
  [/duplicate/i, 'A debit order for this client already exists.'],
  [/config|credentials|503|unavailable/i, 'We could not reach the payment provider right now. Please try again in a few minutes.']
];

function mandateFriendlyError(raw) {
  if (!raw) return '';
  for (const [pattern, msg] of MANDATE_ERROR_MAP) {
    if (pattern.test(raw)) return msg;
  }
  return raw;
}

function renderPage() {
  return `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      <div class="flex items-center justify-between gap-4 mb-8">
        <div>
          <a href="/admin/dashboard" class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition mb-2 group">
            <i class="fa-solid fa-arrow-left text-[10px] group-hover:-translate-x-0.5 transition-transform"></i>
            Back to Dashboard
          </a>
          <h1 class="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <i class="fa-solid fa-file-invoice text-orange-500"></i> Debit Mandates
          </h1>
          <p class="text-sm text-gray-500 mt-1">Manage monthly debit collection for client loans.</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-download-collections" class="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition shadow-sm font-semibold flex items-center gap-2 whitespace-nowrap">
            <i class="fa-solid fa-download"></i> Download report
          </button>
          <button id="btn-load-mandates" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl transition shadow-sm font-semibold flex items-center gap-2 whitespace-nowrap">
            <i class="fa-solid fa-cloud-arrow-down"></i> Load from SureSystems
          </button>
          <button id="refresh-mandates-btn" class="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition shadow-sm font-semibold flex items-center gap-2 whitespace-nowrap">
            <i class="fa-solid fa-rotate-right"></i> Refresh
          </button>
        </div>
      </div>

      <div id="mandates-health-banner" class="mb-6"></div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" id="mandates-summary-cards"></div>

      <!-- Hidden fields used by modal action functions -->
      <input type="hidden" id="action-application-id">
      <input type="hidden" id="action-contract-reference">
      <input type="hidden" id="action-front-end-user" value="webuser">

      <!-- Mandate history -->
      <section class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Mandate History</h2>
            <p class="text-sm text-gray-500 mt-0.5">Click a row to check status or cancel.</p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="relative">
              <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input id="mandate-search" type="text" placeholder="Search client or reference..."
                class="w-full sm:w-64 pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none">
            </div>
            <div class="flex gap-2">
              <button class="filter-btn px-3 py-2 rounded-full text-xs font-bold bg-gray-900 text-white" data-filter="all">All</button>
              <button class="filter-btn px-3 py-2 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="pending">Pending</button>
              <button class="filter-btn px-3 py-2 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="success">Active</button>
              <button class="filter-btn px-3 py-2 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="failed">Failed</button>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Loan Amount</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Updated</th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody id="mandates-table-body" class="bg-white divide-y divide-gray-100">
              <tr><td colspan="5" class="px-6 py-12 text-center text-gray-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-orange-400 mb-3 block"></i>
                Loading mandates...
              </td></tr>
            </tbody>
          </table>
        </div>
        <div id="empty-state" class="hidden px-6 py-16 text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <i class="fa-solid fa-folder-open text-2xl text-gray-400"></i>
          </div>
          <h3 class="text-base font-bold text-gray-900 mb-1">No mandates yet</h3>
          <p class="text-sm text-gray-500">Mandates will appear here once they have been submitted.</p>
        </div>
      </section>
    </div>
  `;
}

function setButtonLoading(button, loadingText) {
  if (!button) return () => {};
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>${loadingText}`;
  return () => { button.disabled = false; button.innerHTML = original; };
}

async function fetchJson(url, options = {}, _retry = true) {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed?.session ?? null;
  }
  if (!session?.access_token) {
    window.location.replace('/auth/login.html');
    throw new Error('Session expired. Please log in again.');
  }
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${session.access_token}` };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && _retry) {
    // Token accepted client-side but rejected server-side — force refresh and retry once
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) {
      return fetchJson(url, options, false);
    }
    window.location.replace('/auth/login.html');
    throw new Error('Session expired. Please log in again.');
  }
  if (response.status === 401) {
    window.location.replace('/auth/login.html');
    throw new Error('Session expired. Please log in again.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload.details || null;
    throw error;
  }
  return payload;
}

function renderHealthBanner() {
  const target = document.getElementById('mandates-health-banner');
  if (!target) return;
  const config = state.config;
  if (!config) return;

  const missing = Array.isArray(config.missing) ? config.missing : [];
  const isConfigured = Boolean(config.configured);
  target.innerHTML = `
    <div class="rounded-2xl border ${isConfigured ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} px-5 py-4 flex items-center gap-3">
      <i class="fa-solid ${isConfigured ? 'fa-circle-check text-green-600' : 'fa-circle-xmark text-red-500'} text-xl flex-shrink-0"></i>
      <div>
        <p class="font-bold text-sm ${isConfigured ? 'text-green-900' : 'text-red-900'}">
          ${isConfigured ? 'Bank connection is ready' : 'Bank connection is not set up'}
        </p>
        <p class="text-xs mt-0.5 ${isConfigured ? 'text-green-700' : 'text-red-700'}">
          ${isConfigured
            ? 'Debit mandates can be submitted and collected normally.'
            : 'Mandates cannot be submitted until this is resolved — contact your system administrator.'}
        </p>
      </div>
    </div>
  `;
}

function renderSummaryCards() {
  const target = document.getElementById('mandates-summary-cards');
  if (!target) return;
  const total   = state.mandates.length;
  const success = state.mandates.filter(m => (m.status || '').toLowerCase() === 'success').length;
  const failed  = state.mandates.filter(m => (m.status || '').toLowerCase() === 'failed').length;
  const pending = total - success - failed;

  const cards = [
    { label: 'Total',          value: total,   icon: 'fa-file-contract', bg: 'bg-white',       text: 'text-gray-900',  border: 'border-gray-200' },
    { label: 'Active',         value: success, icon: 'fa-check-double',  bg: 'bg-green-50',    text: 'text-green-900', border: 'border-green-200' },
    { label: 'Awaiting bank',  value: pending, icon: 'fa-hourglass-half',bg: 'bg-yellow-50',   text: 'text-yellow-900',border: 'border-yellow-200' },
    { label: 'Failed',         value: failed,  icon: 'fa-circle-xmark',  bg: 'bg-red-50',      text: 'text-red-900',   border: 'border-red-200' }
  ];

  target.innerHTML = cards.map(c => `
    <div class="rounded-2xl border ${c.border} ${c.bg} p-5 shadow-sm">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="text-xs font-bold uppercase tracking-wide opacity-60 ${c.text}">${c.label}</p>
        <i class="fa-solid ${c.icon} ${c.text} opacity-40"></i>
      </div>
      <div class="text-3xl font-extrabold ${c.text}">${c.value}</div>
    </div>
  `).join('');
}

function getFilteredMandates() {
  const term = (document.getElementById('mandate-search')?.value || '').trim().toLowerCase();
  return state.mandates.filter(item => {
    const status = (item.status || 'unknown').toLowerCase();
    if (state.currentFilter !== 'all' && status !== state.currentFilter) return false;
    if (!term) return true;
    return [item.profiles?.full_name, item.profiles?.email, item.contract_reference, item.application_id, item.message]
      .filter(Boolean).join(' ').toLowerCase().includes(term);
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

  tbody.innerHTML = rows.map(item => {
    const theme = getStatusTheme(item.status);
    const name   = item.profiles?.full_name || 'Unknown client';
    const amount = item.loan_applications?.amount ? formatCurrency(item.loan_applications.amount) : '—';
    return `
      <tr class="hover:bg-gray-50 transition-colors cursor-pointer view-mandate-row" data-id="${escapeHtml(item.id)}">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-sm flex-shrink-0">
              ${escapeHtml((name).charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="font-semibold text-gray-900 text-sm">${escapeHtml(name)}</div>
              <div class="text-xs text-gray-400">App #${escapeHtml(item.application_id)}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${theme.bg} ${theme.text} border ${theme.border}">
            <i class="fa-solid ${theme.icon}"></i> ${theme.label}
          </span>
          ${item.message ? `<div class="text-xs text-gray-400 mt-1 max-w-[180px] truncate" title="${escapeHtml(mandateFriendlyError(item.message))}">${escapeHtml(mandateFriendlyError(item.message))}</div>` : ''}
        </td>
        <td class="px-6 py-4">
          <div class="text-sm font-semibold text-gray-900">${amount}</div>
          <div class="text-xs text-gray-400 font-mono mt-0.5">${escapeHtml(item.contract_reference || '—')}</div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.updated_at)}</td>
        <td class="px-6 py-4 text-right">
          <i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-orange-500"></i>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.view-mandate-row').forEach(row => {
    row.addEventListener('click', () => openMandateModal(row.dataset.id));
  });
}

function openMandateModal(id) {
  const mandate = state.mandates.find(m => String(m.id) === String(id));
  if (!mandate) return;
  state.currentMandate = mandate;

  // Populate hidden action inputs
  document.getElementById('action-application-id').value  = mandate.application_id || '';
  document.getElementById('action-contract-reference').value = mandate.contract_reference || '';
  document.getElementById('action-front-end-user').value  = mandate.profiles?.email || 'webuser';

  const theme = getStatusTheme(mandate.status);

  // Status banner
  const banner = document.getElementById('modal-status-banner');
  const icon   = document.getElementById('modal-status-icon');
  const statusText = document.getElementById('modal-status-text');
  const messageText = document.getElementById('modal-message-text');
  if (banner) {
    banner.className = `p-4 rounded-2xl flex items-start gap-3 border ${theme.bg} ${theme.text} ${theme.border}`;
  }
  if (icon) icon.className = `fa-solid ${theme.icon} text-xl mt-0.5`;
  if (statusText) statusText.textContent = theme.label;
  if (messageText) messageText.textContent = mandateFriendlyError(mandate.message) || 'No further details from the bank.';

  // Details grid
  const grid = document.getElementById('modal-details-grid');
  if (grid) {
    const name   = mandate.profiles?.full_name || 'Unknown';
    const amount = mandate.loan_applications?.amount ? formatCurrency(mandate.loan_applications.amount) : '—';
    const ref    = mandate.contract_reference || '—';
    const updated = formatDate(mandate.updated_at);
    grid.innerHTML = [
      ['Client',     escapeHtml(name)],
      ['Loan amount',escapeHtml(amount)],
      ['Reference',  `<span class="font-mono text-xs">${escapeHtml(ref)}</span>`],
      ['Last updated',escapeHtml(updated)]
    ].map(([label, val]) => `
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3">
        <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">${label}</div>
        <div class="text-sm font-semibold text-gray-800">${val}</div>
      </div>
    `).join('');
  }

  // Show/hide action buttons
  const hasRef = Boolean(mandate.contract_reference);
  document.getElementById('btn-check-fate')?.classList.toggle('hidden', !hasRef);
  document.getElementById('btn-run-enquiry')?.classList.toggle('hidden', !hasRef);
  document.getElementById('btn-run-cancel')?.classList.toggle('hidden', !hasRef);
  const isFailed = mandate.status === 'failed';
  const retryBtn = document.getElementById('btn-retry-mandate');
  if (retryBtn) {
    retryBtn.classList.toggle('hidden', !isFailed);
    retryBtn.onclick = () => retryMandate(mandate.application_id);
  }

  const openAppBtn = document.getElementById('btn-open-application');
  if (openAppBtn) {
    if (mandate.application_id) {
      openAppBtn.href = `/admin/application-detail?id=${mandate.application_id}`;
      openAppBtn.classList.remove('pointer-events-none', 'opacity-40');
    } else {
      openAppBtn.href = '#';
      openAppBtn.classList.add('pointer-events-none', 'opacity-40');
    }
  }

  // Show/hide installment section and reset sub-forms
  const installmentsSection = document.getElementById('modal-installments-section');
  if (installmentsSection) {
    installmentsSection.classList.toggle('hidden', !hasRef);
    document.getElementById('change-date-form')?.classList.add('hidden');
    document.getElementById('cancel-payment-form')?.classList.add('hidden');
    document.getElementById('schedule-results')?.classList.add('hidden');
  }

  // TT3 signature section — show for any mandate with a contract reference
  const tt3Section = document.getElementById('modal-tt3-section');
  if (tt3Section) {
    tt3Section.classList.toggle('hidden', !hasRef);
    clearSignaturePad();
  }

  const modal = document.getElementById('payload-modal');
  const container = modal?.firstElementChild;
  if (modal && container) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      container.classList.remove('scale-95');
      // Init pad after modal becomes visible so canvas has layout dimensions
      const canvas = document.getElementById('tt3-signature-canvas');
      if (canvas) { canvas._padInit = false; }
      initSignaturePad();
    }, 10);
  }
}

async function retryMandate(applicationId) {
  if (!applicationId) return;
  const btn = document.getElementById('btn-retry-mandate');
  if (btn) { btn.disabled = true; btn.textContent = 'Retrying…'; }
  try {
    const res = await fetchJson('/api/suresystems/activate-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId })
    });
    if (res.success) {
      closePayloadModal();
      window.showToast?.('Mandate activated successfully', 'success');
      await loadMandates();
    } else {
      throw new Error(res.error || 'Activation failed');
    }
  } catch (err) {
    window.showToast?.(`Retry failed: ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Retry Activation'; }
  }
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
  try {
    state.config = await fetchJson('/api/suresystems/config');
    renderHealthBanner();
  } catch (_) { /* banner stays hidden */ }
}

async function loadMandates() {
  const tbody = document.getElementById('mandates-table-body');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-400">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-orange-400 mb-3 block"></i>Loading mandates...</td></tr>`;
  }
  const payload = await fetchJson('/api/suresystems/mandates/history');
  state.mandates = payload.data || [];
  renderSummaryCards();
  renderTable();
}

async function runStatusAction(mode) {
  const btnId = mode === 'enquiry' ? 'btn-run-enquiry' : 'btn-check-fate';
  const button = document.getElementById(btnId);
  const label  = mode === 'enquiry' ? 'Checking status...' : 'Checking outcome...';
  const restore = setButtonLoading(button, label);
  try {
    const applicationId = Number(document.getElementById('action-application-id')?.value || 0) || null;
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName  = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    if (!contractReference) throw new Error('This mandate has no reference number yet.');

    await fetchJson('/api/suresystems/mandates/check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, contractReference, frontEndUserName, mode })
    });
    window.showToast?.('Status updated', 'success');
    await loadMandates();
    if (state.currentMandate?.id) openMandateModal(state.currentMandate.id);
  } catch (error) {
    window.showToast?.(error.message || 'Status check failed', 'error');
  } finally {
    restore();
  }
}

async function handleCancelMandate() {
  const button = document.getElementById('btn-run-cancel');
  const restore = setButtonLoading(button, 'Cancelling...');
  try {
    const applicationId = Number(document.getElementById('action-application-id')?.value || 0) || null;
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName  = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    if (!contractReference) throw new Error('This mandate has no reference number to cancel.');

    await fetchJson('/api/suresystems/mandates/cancel-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, contractReference, frontEndUserName })
    });
    window.showToast?.('Mandate cancelled', 'success');
    await loadMandates();
    closePayloadModal();
  } catch (error) {
    window.showToast?.(error.message || 'Cancel failed', 'error');
  } finally {
    restore();
  }
}

async function handleDownloadCollections() {
  const button = document.getElementById('btn-download-collections');
  const restore = setButtonLoading(button, 'Downloading...');
  try {
    const frontEndUserName = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    const result = await fetchJson('/api/suresystems/payments/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frontEndUserName })
    });
    // Offer as download if there's file content, otherwise show a toast
    const content = result.content || result.data || result.fileContent;
    if (content) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `collections-${new Date().toISOString().slice(0,10)}.txt` });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.('Collection report downloaded', 'success');
    } else {
      window.showToast?.('Report downloaded — check your bank portal for the file', 'success');
    }
  } catch (error) {
    window.showToast?.(error.message || 'Download failed', 'error');
  } finally {
    restore();
  }
}

async function handleGetSchedule() {
  const button = document.getElementById('btn-view-schedule');
  const restore = setButtonLoading(button, 'Loading...');
  const resultsEl = document.getElementById('schedule-results');
  try {
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName  = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    if (!contractReference) throw new Error('No contract reference for this mandate.');

    const result = await fetchJson('/api/suresystems/installments/batch/installment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractReference, frontEndUserName })
    });

    const items = result.installment || result.installments || result.data || [];
    if (!resultsEl) return;

    if (!items.length) {
      resultsEl.innerHTML = `<p class="text-sm text-gray-500 py-2">No scheduled payments found.</p>`;
    } else {
      resultsEl.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-gray-200 mt-2">
          <table class="min-w-full divide-y divide-gray-100 text-xs">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">#</th>
                <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              ${items.map(inst => {
                const raw = String(inst.collectionDate || inst.date || '');
                const dateStr = raw.length === 8
                  ? `${raw.slice(6,8)}/${raw.slice(4,6)}/${raw.slice(0,4)}`
                  : (raw || '—');
                const amount = inst.installmentAmount != null
                  ? formatCurrency(inst.installmentAmount)
                  : (inst.amount != null ? formatCurrency(inst.amount) : '—');
                const status = escapeHtml(inst.status || inst.installmentStatus || '—');
                return `<tr>
                  <td class="px-3 py-2 font-mono">${escapeHtml(String(inst.installmentNo ?? inst.no ?? ''))}</td>
                  <td class="px-3 py-2">${escapeHtml(dateStr)}</td>
                  <td class="px-3 py-2 font-semibold">${amount}</td>
                  <td class="px-3 py-2">${status}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    resultsEl.classList.remove('hidden');
  } catch (error) {
    if (resultsEl) {
      resultsEl.innerHTML = `<p class="text-sm text-red-600 py-2">${escapeHtml(error.message || 'Could not load schedule')}</p>`;
      resultsEl.classList.remove('hidden');
    }
  } finally {
    restore();
  }
}

async function handleGetDateList() {
  const button    = document.getElementById('btn-view-datelist');
  const restore   = setButtonLoading(button, 'Loading...');
  const resultsEl = document.getElementById('schedule-results');
  try {
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName  = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    if (!contractReference) throw new Error('No contract reference for this mandate.');

    const result = await fetchJson('/api/suresystems/mandates/datelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractReference, frontEndUserName })
    });

    const dates = result.dateList || result.dates || result.data || [];
    if (!resultsEl) return;

    if (!dates.length) {
      resultsEl.innerHTML = `<p class="text-sm text-gray-500 py-2">No date list entries found.</p>`;
    } else {
      const rows = Array.isArray(dates)
        ? dates.map(d => `<li class="text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">${escapeHtml(String(d))}</li>`).join('')
        : `<li class="text-sm text-gray-700 py-1">${escapeHtml(JSON.stringify(dates))}</li>`;
      resultsEl.innerHTML = `
        <div class="rounded-xl border border-gray-200 mt-2 bg-white px-4 py-2">
          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Collection date list</p>
          <ul>${rows}</ul>
        </div>`;
    }
    resultsEl.classList.remove('hidden');
  } catch (error) {
    if (resultsEl) {
      resultsEl.innerHTML = `<p class="text-sm text-red-600 py-2">${escapeHtml(error.message || 'Could not load date list')}</p>`;
      resultsEl.classList.remove('hidden');
    }
  } finally {
    restore();
  }
}

async function handleUpdateInstallmentDate() {
  const button = document.getElementById('btn-confirm-date-change');
  const restore = setButtonLoading(button, 'Updating...');
  try {
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName  = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    const installmentNo     = Number(document.getElementById('update-installment-no')?.value || 0);
    const rawDate           = document.getElementById('update-installment-date')?.value || '';

    if (!contractReference) throw new Error('No contract reference for this mandate.');
    if (!installmentNo)     throw new Error('Please enter the payment number to update.');
    if (!rawDate)           throw new Error('Please select a new payment date.');

    // Convert YYYY-MM-DD → YYYYMMDD for SureSystems
    const collectionDate = rawDate.replace(/-/g, '');

    await fetchJson('/api/suresystems/installments/batch/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frontEndUserName,
        installments: [{ contractReference, installmentNo, collectionDate }]
      })
    });
    window.showToast?.(`Payment #${installmentNo} date updated`, 'success');
    document.getElementById('change-date-form')?.classList.add('hidden');
  } catch (error) {
    window.showToast?.(error.message || 'Update failed', 'error');
  } finally {
    restore();
  }
}

async function handleCancelInstallmentBtn() {
  const button = document.getElementById('btn-confirm-cancel-payment');
  const restore = setButtonLoading(button, 'Cancelling...');
  try {
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName  = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    const installmentNo     = Number(document.getElementById('cancel-installment-no')?.value || 0);

    if (!contractReference) throw new Error('No contract reference for this mandate.');
    if (!installmentNo)     throw new Error('Please enter the payment number to cancel.');

    await fetchJson('/api/suresystems/installments/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractReference, installmentNo, frontEndUserName })
    });
    window.showToast?.(`Payment #${installmentNo} cancelled`, 'success');
    document.getElementById('cancel-payment-form')?.classList.add('hidden');
  } catch (error) {
    window.showToast?.(error.message || 'Cancel failed', 'error');
  } finally {
    restore();
  }
}

// ─── TT3 Signature pad ────────────────────────────────────────────────────────

let tt3SignaturePadActive = false;
let tt3FileBase64 = null;
let tt3FileMime   = null;

function initSignaturePad() {
  const canvas = document.getElementById('tt3-signature-canvas');
  if (!canvas || canvas._padInit) return;
  canvas._padInit = true;

  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return [
      (src.clientX - rect.left) * (canvas.width / rect.width),
      (src.clientY - rect.top)  * (canvas.height / rect.height)
    ];
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    [lastX, lastY] = pos(e);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    [lastX, lastY] = [x, y];
  }

  function stop() { drawing = false; }

  canvas.addEventListener('mousedown',  start);
  canvas.addEventListener('mousemove',  draw);
  canvas.addEventListener('mouseup',    stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove',  draw,  { passive: false });
  canvas.addEventListener('touchend',   stop);
}

function clearSignaturePad() {
  const canvas = document.getElementById('tt3-signature-canvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  tt3FileBase64 = null;
  tt3FileMime   = null;
  const nameEl = document.getElementById('tt3-file-name');
  if (nameEl) nameEl.textContent = '';
}

function isCanvasBlank(canvas) {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  return pixels.every((v, i) => i % 4 === 3 ? v === 0 : true);
}

function handleTT3FileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const result = ev.target.result; // data:image/png;base64,...
    const commaIdx = result.indexOf(',');
    tt3FileBase64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
    tt3FileMime   = file.type || 'image/png';
    const nameEl  = document.getElementById('tt3-file-name');
    if (nameEl) nameEl.textContent = file.name;
    // Clear the canvas when a file is selected
    const canvas = document.getElementById('tt3-signature-canvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };
  reader.readAsDataURL(file);
}

async function handleSubmitTT3Signature() {
  const button  = document.getElementById('btn-submit-tt3-signature');
  const restore = setButtonLoading(button, 'Submitting...');
  try {
    const contractReference = document.getElementById('action-contract-reference')?.value?.trim();
    const frontEndUserName  = document.getElementById('action-front-end-user')?.value?.trim() || 'webuser';
    if (!contractReference) throw new Error('No contract reference for this mandate.');

    let signatureImageBase64 = tt3FileBase64;
    let signatureMimeType    = tt3FileMime || 'image/png';

    if (!signatureImageBase64) {
      const canvas = document.getElementById('tt3-signature-canvas');
      if (!canvas || isCanvasBlank(canvas)) {
        throw new Error('Please draw or upload the client\'s signature before submitting.');
      }
      signatureImageBase64 = canvas.toDataURL('image/png').split(',')[1];
    }

    await fetchJson('/api/suresystems/mandates/tt3-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractReference, frontEndUserName, signatureImageBase64, signatureMimeType })
    });

    window.showToast?.('TT3 signature submitted successfully', 'success');
    clearSignaturePad();
    await loadMandates();
    if (state.currentMandate?.id) openMandateModal(state.currentMandate.id);
  } catch (error) {
    window.showToast?.(error.message || 'Signature submission failed', 'error');
  } finally {
    restore();
  }
}

function toggleSubForm(showId) {
  const ids = ['change-date-form', 'cancel-payment-form'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === showId) {
      el.classList.toggle('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

async function handleLoadFromSureSystems() {
  const btn = document.getElementById('btn-load-mandates');
  const orig = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading…'; }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res  = await fetch('/api/admin/mandates/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
    });
    const json = await res.json();
    if (!res.ok) {
      const ss = json.sureSystemsResponse || json.details?.providerResponse;
      const detail = ss ? '\n\nSureSystems said:\n' + JSON.stringify(ss, null, 2) : '';
      alert('Load failed: ' + (json.error || 'Unknown error') + detail);
      return;
    }
    window.showToast?.(json.message || 'Mandates loaded', 'success');
    await loadMandates();
  } catch (err) {
    window.showToast?.(err.message || 'Failed to load mandates', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

function bindFilters() {
  document.getElementById('mandate-search')?.addEventListener('input', renderTable);
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentFilter = btn.dataset.filter || 'all';
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('bg-gray-900', false);
        b.classList.toggle('text-white', false);
        b.classList.add('bg-gray-100', 'text-gray-600');
      });
      btn.classList.remove('bg-gray-100', 'text-gray-600');
      btn.classList.add('bg-gray-900', 'text-white');
      renderTable();
    });
  });
}

function bindEvents() {
  document.getElementById('refresh-mandates-btn')?.addEventListener('click', () => {
    loadConfig();
    loadMandates();
  });
  document.getElementById('btn-load-mandates')?.addEventListener('click', handleLoadFromSureSystems);
  document.getElementById('btn-download-collections')?.addEventListener('click', handleDownloadCollections);
  document.getElementById('btn-check-fate')?.addEventListener('click', () => runStatusAction('finalfate'));
  document.getElementById('btn-run-enquiry')?.addEventListener('click', () => runStatusAction('enquiry'));
  document.getElementById('btn-run-cancel')?.addEventListener('click', handleCancelMandate);
  document.getElementById('close-modal-btn')?.addEventListener('click', closePayloadModal);
  document.getElementById('payload-modal')?.addEventListener('click', e => {
    if (e.target?.id === 'payload-modal') closePayloadModal();
  });
  // Installment schedule buttons
  document.getElementById('btn-view-schedule')?.addEventListener('click', handleGetSchedule);
  document.getElementById('btn-show-change-date')?.addEventListener('click', () => toggleSubForm('change-date-form'));
  document.getElementById('btn-show-cancel-payment')?.addEventListener('click', () => toggleSubForm('cancel-payment-form'));
  document.getElementById('btn-confirm-date-change')?.addEventListener('click', handleUpdateInstallmentDate);
  document.getElementById('btn-confirm-cancel-payment')?.addEventListener('click', handleCancelInstallmentBtn);
  // TT3 signature pad buttons
  document.getElementById('btn-view-datelist')?.addEventListener('click', handleGetDateList);
  document.getElementById('btn-clear-tt3-sig')?.addEventListener('click', clearSignaturePad);
  document.getElementById('tt3-signature-file')?.addEventListener('change', handleTT3FileUpload);
  document.getElementById('btn-submit-tt3-signature')?.addEventListener('click', handleSubmitTT3Signature);
  // Init signature pad (deferred so canvas is in DOM)
  setTimeout(initSignaturePad, 50);
  bindFilters();
}

document.addEventListener('DOMContentLoaded', async () => {
  const shell = document.getElementById('app-shell');
  if (!shell) return;

  await initLayout();
  const { data: { session } } = await supabase.auth.getSession();
  state.accessToken = session?.access_token || null;

  shell.innerHTML = renderPage();
  bindEvents();

  try {
    await Promise.all([loadConfig(), loadMandates()]);
  } catch (error) {
    window.showToast?.(error.message || 'Unable to load mandates', 'error');
  }
});
