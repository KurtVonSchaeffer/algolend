// Loan Book Analysis — full portfolio view with tracking days
import { initLayout }    from '../shared/layout.js';
import { fetchLoanBook, fetchBranches } from '../services/dataService.js';
import { formatCurrency, formatDate, STATUS_DISPLAY } from '../shared/utils.js';
import { apiFetch } from '../shared/apiFetch.js';

let allLoans      = [];
let filteredLoans = [];
let branches      = [];
let activeBranch  = 'all';
let activeStatus  = 'all';
let searchTerm    = '';
let dateFrom      = '';
let dateTo        = '';
let sortKey       = 'created_at';
let sortDir       = 'desc';
let collectionsMode = false;
let selectedIds   = new Set();
let activeNotesId = null;

// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await initLayout({ pageTitle: 'Loan Book', activeNav: 'loan-book' });
    await loadBranches();
    // Non-super-admins default to their own branch
    if (auth?.role && auth.role !== 'super_admin' && auth.profile?.branch_id) {
        activeBranch = String(auth.profile.branch_id);
    }
    renderShell();
    await loadLoans();
});

async function loadBranches() {
    const { data } = await fetchBranches();
    branches = data || [];
}

async function loadLoans() {
    try {
        const { data } = await fetchLoanBook(activeBranch);
        allLoans = data || [];
        applyFilters();
    } catch (err) {
        console.error('loadLoans error:', err);
    } finally {
        document.getElementById('lb-shimmer')?.remove();
    }
}

function applyFilters() {
    filteredLoans = allLoans.filter(l => {
        const matchStatus = activeStatus === 'all' || l.status === activeStatus;
        const s = searchTerm.toLowerCase();
        const matchSearch = !s ||
            (l.client_name || '').toLowerCase().includes(s) ||
            (l.reference   || '').toLowerCase().includes(s) ||
            (l.identity_number || '').includes(s);
        const disbDate = (l.disbursed_date || '').slice(0,10);
        const matchFrom = !dateFrom || disbDate >= dateFrom;
        const matchTo   = !dateTo   || disbDate <= dateTo;
        return matchStatus && matchSearch && matchFrom && matchTo;
    });

    // Sort
    filteredLoans.sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable();
    renderSummary();
}

// ─────────────────────────────────────────────
function renderShell() {
    const shell = document.getElementById('app-shell');
    const main  = shell.querySelector('main') || shell;
    let content = main.querySelector('#lb-content');
    if (!content) {
        content = document.createElement('div');
        content.id = 'lb-content';
        content.className = 'p-6 max-w-[1600px] mx-auto';
        main.appendChild(content);
    }

    content.innerHTML = `
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Loan Book</h1>
          <p class="text-sm text-gray-500 mt-0.5">Full portfolio — tracking days, arrears, maturity dates</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <select id="lb-branch" onchange="window.lbSetBranch(this.value)"
            class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
            <option value="all">All Branches</option>
            ${branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
          </select>
          <select id="lb-status" onchange="window.lbSetStatus(this.value)"
            class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
            <option value="all">All Statuses</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="IN_ARREARS">In Arrears</option>
            <option value="IN_DEFAULT">In Default</option>
            <option value="READY_TO_DISBURSE">Approved</option>
          </select>
          <input type="date" id="lb-date-from" onchange="window.lbSetDateFrom(this.value)"
            title="Disbursed from"
            class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
          <input type="date" id="lb-date-to" onchange="window.lbSetDateTo(this.value)"
            title="Disbursed to"
            class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
          <input type="text" id="lb-search" placeholder="Search client, reference..."
            oninput="window.lbSearch(this.value)"
            class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-orange-400 focus:outline-none w-56">
          <button onclick="window.lbExport()"
            class="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <i class="fas fa-download text-xs"></i> Export
          </button>
          <button id="btn-collections-mode" onclick="window.lbToggleCollections()"
            class="flex items-center gap-2 border border-gray-200 bg-white hover:bg-orange-50 hover:border-orange-300 text-gray-700 text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <span class="material-symbols-outlined text-[16px]">checklist</span> Collections
          </button>
        </div>
      </div>

      <!-- Bulk action bar (hidden until collections mode active with selection) -->
      <div id="lb-bulk-bar" class="hidden mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 flex-wrap">
        <span id="lb-selected-count" class="text-sm font-bold text-orange-700">0 selected</span>
        <div class="flex-1"></div>
        <button onclick="window.lbBulkSMS()" class="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700">
            <span class="material-symbols-outlined text-[15px]">sms</span> Bulk SMS Reminder
        </button>
        <button onclick="window.lbSelectAll()" class="text-xs font-semibold text-orange-600 hover:underline">Select All</button>
        <button onclick="window.lbClearSelection()" class="text-xs font-semibold text-gray-500 hover:underline">Clear</button>
      </div>

      <!-- Collection notes panel -->
      <div id="lb-notes-panel" class="hidden mb-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span class="text-sm font-bold text-gray-800" id="lb-notes-title">Collection Notes</span>
            <button onclick="window.lbCloseNotes()" class="text-gray-400 hover:text-gray-600">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
        </div>
        <div class="p-4">
            <div id="lb-notes-list" class="space-y-2 max-h-48 overflow-y-auto mb-3"></div>
            <div class="flex gap-2">
                <select id="lb-note-type" class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-orange-400">
                    <option value="note">Note</option>
                    <option value="call">Call</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="promise_to_pay">Promise to Pay</option>
                    <option value="legal">Legal</option>
                </select>
                <input id="lb-note-body" type="text" placeholder="Add note…" class="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-orange-400" />
                <button onclick="window.lbAddNote()" class="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700">Add</button>
            </div>
        </div>
      </div>

      <!-- Summary cards -->
      <div id="lb-summary" class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        ${Array(5).fill(0).map(() => `
          <div class="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 animate-pulse">
            <div class="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-2.5 bg-gray-100 rounded-full w-3/4"></div>
              <div class="h-5 bg-gray-200 rounded-full w-1/2"></div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Shimmer table skeleton (hidden once data loads) -->
      <div id="lb-shimmer" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <div class="animate-pulse">
          <div class="bg-gray-50 border-b border-gray-100 px-4 py-3 flex gap-6">
            ${Array(7).fill(0).map(() => `<div class="h-3 bg-gray-200 rounded-full" style="width:${60 + Math.random()*60|0}px"></div>`).join('')}
          </div>
          ${Array(8).fill(0).map((_, i) => `
            <div class="flex gap-6 px-4 py-4 border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}">
              <div class="h-3 bg-gray-100 rounded-full w-24"></div>
              <div class="h-3 bg-gray-100 rounded-full w-32"></div>
              <div class="h-3 bg-gray-100 rounded-full w-20"></div>
              <div class="h-3 bg-gray-100 rounded-full w-20"></div>
              <div class="h-3 bg-gray-100 rounded-full w-16"></div>
              <div class="h-5 bg-gray-200 rounded-full w-20"></div>
              <div class="h-3 bg-gray-100 rounded-full w-14"></div>
              <div class="h-3 bg-gray-100 rounded-full w-14"></div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[1200px]">
            <thead>
              <tr class="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th id="lb-check-th" class="px-4 py-3 hidden"><input type="checkbox" id="lb-select-all-chk" onchange="window.lbToggleAll(this.checked)" class="w-3.5 h-3.5 accent-orange-500"></th>
                ${[
                  ['reference',       'Reference'],
                  ['client_name',     'Client'],
                  ['amount',          'Principal'],
                  ['outstanding',     'Outstanding'],
                  ['monthly_payment', 'Monthly'],
                  ['status',          'Status'],
                  ['days_active',     'Days Active'],
                  ['days_overdue',    'Days Overdue'],
                  ['days_to_maturity','Maturity In'],
                  ['disbursed_date',  'Disbursed'],
                  ['maturity_date',   'Maturity Date'],
                  ['band',            'Band'],
                  ['purpose',         'Purpose'],
                ].map(([k,l]) => `
                  <th class="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onclick="window.lbSort('${k}')">
                    ${l} <span id="sort-${k}" class="ml-1 text-gray-300">↕</span>
                  </th>`).join('')}
                <th class="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody id="lb-table-body" class="divide-y divide-gray-50">
              <tr><td colspan="13" class="p-10 text-center text-sm text-gray-400">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;

    // Expose handlers
    window.lbSetBranch   = (v) => { activeBranch = v; loadLoans(); };
    window.lbSetStatus   = (v) => { activeStatus = v; applyFilters(); };
    window.lbSearch      = (v) => { searchTerm = v; applyFilters(); };
    window.lbSetDateFrom = (v) => { dateFrom = v; applyFilters(); };
    window.lbSetDateTo   = (v) => { dateTo = v; applyFilters(); };
    window.lbSort        = sortBy;
    window.lbExport      = exportLoanBook;
    window.lbSendReminder = sendReminder;
    window.lbToggleCollections = toggleCollectionsMode;
    window.lbToggleRow   = toggleRow;
    window.lbToggleAll   = toggleAll;
    window.lbSelectAll   = () => { filteredLoans.forEach(l => selectedIds.add(String(l.id))); updateBulkBar(); renderTable(); };
    window.lbClearSelection = () => { selectedIds.clear(); updateBulkBar(); renderTable(); };
    window.lbBulkSMS     = bulkSMS;
    window.lbOpenNotes   = openNotes;
    window.lbCloseNotes  = () => { document.getElementById('lb-notes-panel').classList.add('hidden'); activeNotesId = null; };
    window.lbAddNote     = addNote;
    window.lbFilterAging = filterAging;
}

function renderSummary() {
    const el = document.getElementById('lb-summary');
    if (!el) return;
    const total      = filteredLoans.length;
    const totalBook  = filteredLoans.reduce((s,l) => s + l.amount, 0);
    const inArrears  = filteredLoans.filter(l => l.status === 'IN_ARREARS').length;
    const inDefault  = filteredLoans.filter(l => l.status === 'IN_DEFAULT').length;
    const avgDays    = filteredLoans.filter(l => l.days_active !== null).reduce((s,l,_,a) => s + l.days_active/a.length, 0);

    // Aging buckets
    const nplLoans = filteredLoans.filter(l => l.status === 'IN_ARREARS' || l.status === 'IN_DEFAULT');
    const aging = { d1_30:0, d31_60:0, d61_90:0, d90plus:0 };
    for (const l of nplLoans) {
        const d = l.days_overdue || 0;
        if (d <= 30)       aging.d1_30++;
        else if (d <= 60)  aging.d31_60++;
        else if (d <= 90)  aging.d61_90++;
        else               aging.d90plus++;
    }
    const nplRatio = total > 0 ? ((inArrears + inDefault) / total * 100).toFixed(1) : '0.0';

    el.innerHTML = [
        { label: 'Total Loans',      value: total,                     color: '#E7762E', bg: '#fff3ea', icon: 'receipt_long' },
        { label: 'Loan Book Value',  value: formatCurrency(totalBook), color: '#10b981', bg: '#d1fae5', icon: 'payments' },
        { label: 'In Arrears',       value: inArrears,                 color: '#f59e0b', bg: '#fef3c7', icon: 'warning' },
        { label: 'In Default',       value: inDefault,                 color: '#ef4444', bg: '#fee2e2', icon: 'error' },
        { label: 'NPL Ratio',        value: nplRatio + '%',            color: '#8b5cf6', bg: '#ede9fe', icon: 'trending_down' },
    ].map(c => `
      <div class="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.bg}">
          <span class="material-symbols-outlined text-[18px]" style="color:${c.color}">${c.icon}</span>
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${c.label}</p>
          <p class="text-lg font-black mt-0.5" style="color:${c.color}">${c.value}</p>
        </div>
      </div>`).join('');

    // Aging buckets strip (only if there are arrears)
    let agingEl = document.getElementById('lb-aging');
    if (!agingEl) {
        agingEl = document.createElement('div');
        agingEl.id = 'lb-aging';
        agingEl.className = 'grid grid-cols-4 gap-3 mb-6';
        el.parentNode.insertBefore(agingEl, el.nextSibling);
    }
    if (nplLoans.length === 0) { agingEl.innerHTML = ''; return; }
    agingEl.innerHTML = [
        { label:'1–30 days',  value: aging.d1_30,   color:'#f59e0b', bg:'#fef3c7' },
        { label:'31–60 days', value: aging.d31_60,  color:'#f97316', bg:'#ffedd5' },
        { label:'61–90 days', value: aging.d61_90,  color:'#ef4444', bg:'#fee2e2' },
        { label:'90+ days',   value: aging.d90plus, color:'#7f1d1d', bg:'#fecaca' },
    ].map(a => `
      <div class="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center cursor-pointer hover:border-orange-300 transition-colors"
           title="Filter to ${a.label}" onclick="window.lbFilterAging(${a.label === '1–30 days' ? 30 : a.label === '31–60 days' ? 60 : a.label === '61–90 days' ? 90 : 999})">
        <p class="text-xs font-semibold text-gray-400 mb-1">${a.label}</p>
        <p class="text-xl font-black" style="color:${a.color}">${a.value}</p>
      </div>`).join('');
}

function renderTable() {
    const tbody = document.getElementById('lb-table-body');
    if (!tbody) return;

    if (!filteredLoans.length) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-10 text-center text-sm text-gray-400">No loans match your filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredLoans.map(l => {
        const st      = STATUS_DISPLAY[l.status] || { label: l.status, color: '#6b7280', bg: '#f3f4f6' };
        const isDefault  = l.status === 'IN_DEFAULT';
        const isArrears  = l.status === 'IN_ARREARS';
        const daysOverdueCell = l.days_overdue > 0
            ? `<span class="font-bold ${isDefault ? 'text-red-600' : 'text-yellow-600'}">${l.days_overdue}d</span>`
            : '<span class="text-gray-300">—</span>';
        const daysMaturity = l.days_to_maturity !== null
            ? (l.days_to_maturity < 0
                ? `<span class="font-bold text-red-500">${Math.abs(l.days_to_maturity)}d overdue</span>`
                : `<span class="${l.days_to_maturity < 30 ? 'font-bold text-orange-500' : 'text-gray-600'}">${l.days_to_maturity}d</span>`)
            : '<span class="text-gray-300">—</span>';

        const checked = selectedIds.has(String(l.id));
        return `
        <tr class="hover:bg-gray-50 transition-colors ${isDefault ? 'bg-red-50/30' : isArrears ? 'bg-yellow-50/30' : ''}">
          <td class="px-4 py-3 lb-check-cell hidden">
            <input type="checkbox" class="lb-row-chk w-3.5 h-3.5 accent-orange-500" data-id="${l.id}" ${checked ? 'checked' : ''}
              onchange="window.lbToggleRow('${l.id}', this.checked)">
          </td>
          <td class="px-4 py-3"><span class="font-mono text-xs font-bold text-orange-600">${l.reference}</span></td>
          <td class="px-4 py-3">
            <div class="font-semibold text-gray-900 text-xs">${l.client_name}</div>
            <div class="text-[10px] text-gray-400 font-mono">${l.identity_number || ''}</div>
          </td>
          <td class="px-4 py-3 font-bold text-gray-900">${formatCurrency(l.amount)}</td>
          <td class="px-4 py-3 font-bold ${l.outstanding > 0 ? 'text-orange-600' : 'text-green-600'}">${formatCurrency(l.outstanding ?? l.total_repayable ?? l.amount)}</td>
          <td class="px-4 py-3 text-gray-600">${formatCurrency(l.monthly_payment)}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:${st.bg};color:${st.color}">${st.label}</span>
          </td>
          <td class="px-4 py-3 text-gray-600">${l.days_active !== null ? l.days_active + 'd' : '—'}</td>
          <td class="px-4 py-3">${daysOverdueCell}</td>
          <td class="px-4 py-3">${daysMaturity}</td>
          <td class="px-4 py-3 text-xs text-gray-500">${l.disbursed_date}</td>
          <td class="px-4 py-3 text-xs text-gray-500">${l.maturity_date}</td>
          <td class="px-4 py-3">
            ${l.band ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-600">${l.band}</span>` : '—'}
          </td>
          <td class="px-4 py-3 text-xs text-gray-500">${l.purpose}</td>
          <td class="px-4 py-3 text-center">
            <div class="flex items-center justify-center gap-1">
              ${(l.status === 'IN_ARREARS' || l.status === 'IN_DEFAULT') ? `
              <button onclick="window.lbSendReminder('${l.id}','${(l.client_name||'').replace(/'/g,"\\'")}','${l.monthly_payment}')"
                title="Send SMS reminder"
                class="p-1.5 rounded-lg text-yellow-500 hover:bg-yellow-50 transition-colors">
                <span class="material-symbols-outlined text-[16px]">sms</span>
              </button>
              <button onclick="window.lbOpenNotes('${l.id}','${(l.client_name||'').replace(/'/g,"\\'")}')"
                title="Collection notes"
                class="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 transition-colors">
                <span class="material-symbols-outlined text-[16px]">edit_note</span>
              </button>` : ''}
              <a href="/admin/application-detail?id=${l.id}"
                class="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors inline-block">
                <span class="material-symbols-outlined text-[16px]">visibility</span>
              </a>
            </div>
          </td>
        </tr>`;
    }).join('');

    // Update sort indicators
    document.querySelectorAll('[id^="sort-"]').forEach(el => el.textContent = '↕');
    const sortEl = document.getElementById(`sort-${sortKey}`);
    if (sortEl) sortEl.textContent = sortDir === 'asc' ? '↑' : '↓';
}

function sortBy(key) {
    if (sortKey === key) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
    else { sortKey = key; sortDir = key === 'client_name' ? 'asc' : 'desc'; }
    applyFilters();
}

async function sendReminder(applicationId, clientName, monthly) {
    if (!confirm(`Send SMS payment reminder to ${clientName}?`)) return;
    try {
        const res = await apiFetch('/api/notifications/status-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId, newStatus: 'IN_ARREARS' })
        });
        const json = await res.json();
        if (json.sent) {
            alert(`✅ Reminder sent to ${clientName}`);
        } else {
            alert(`Could not send: ${json.reason || 'unknown error'}`);
        }
    } catch (e) {
        alert('SMS failed: ' + e.message);
    }
}

// ── Collections mode ──────────────────────────────────────────────────────────

function toggleCollectionsMode() {
    collectionsMode = !collectionsMode;
    selectedIds.clear();
    const btn = document.getElementById('btn-collections-mode');
    if (btn) {
        btn.classList.toggle('bg-orange-600', collectionsMode);
        btn.classList.toggle('text-white', collectionsMode);
        btn.classList.toggle('border-orange-600', collectionsMode);
    }
    // Show/hide checkbox column
    document.querySelectorAll('#lb-check-th, .lb-check-cell').forEach(el => {
        el.classList.toggle('hidden', !collectionsMode);
    });
    if (collectionsMode) {
        // Auto-filter to arrears/default
        activeStatus = 'IN_ARREARS';
        const statusSel = document.getElementById('lb-status');
        if (statusSel) statusSel.value = 'IN_ARREARS';
        applyFilters();
    }
    updateBulkBar();
}

function toggleRow(id, checked) {
    if (checked) selectedIds.add(String(id));
    else         selectedIds.delete(String(id));
    updateBulkBar();
}

function toggleAll(checked) {
    filteredLoans.forEach(l => checked ? selectedIds.add(String(l.id)) : selectedIds.delete(String(l.id)));
    renderTable();
    updateBulkBar();
}

function updateBulkBar() {
    const bar   = document.getElementById('lb-bulk-bar');
    const count = document.getElementById('lb-selected-count');
    if (!bar) return;
    const n = selectedIds.size;
    bar.classList.toggle('hidden', !collectionsMode || n === 0);
    if (count) count.textContent = `${n} selected`;
}

async function bulkSMS() {
    if (!selectedIds.size) return;
    const ids = [...selectedIds];
    if (!confirm(`Send SMS payment reminder to ${ids.length} borrower${ids.length > 1 ? 's' : ''}?`)) return;
    const { data: { session } } = await import('../services/supabaseClient.js').then(m => m.supabase.auth.getSession()).catch(() => ({ data: {} }));
    // Resolve token via supabase client
    const { supabase } = await import('../services/supabaseClient.js');
    const { data: { session: sess } } = await supabase.auth.getSession();
    try {
        const res = await fetch('/api/admin/collections/bulk-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.access_token}` },
            body: JSON.stringify({ applicationIds: ids }),
        });
        const json = await res.json();
        alert(`✅ SMS sent to ${json.sent} borrower${json.sent !== 1 ? 's' : ''}${json.failed ? ` (${json.failed} failed — no phone number)` : ''}.`);
        selectedIds.clear();
        updateBulkBar();
        renderTable();
    } catch (err) {
        alert('Bulk SMS failed: ' + err.message);
    }
}

function filterAging(maxDays) {
    activeStatus = 'IN_ARREARS';
    const statusSel = document.getElementById('lb-status');
    if (statusSel) statusSel.value = 'IN_ARREARS';
    filteredLoans = allLoans.filter(l =>
        (l.status === 'IN_ARREARS' || l.status === 'IN_DEFAULT') &&
        (l.days_overdue || 0) <= maxDays &&
        (maxDays === 999 || (l.days_overdue || 0) > maxDays - 30)
    );
    renderTable();
    renderSummary();
}

// ── Collection notes ──────────────────────────────────────────────────────────

async function openNotes(appId, clientName) {
    activeNotesId = appId;
    const panel = document.getElementById('lb-notes-panel');
    const title = document.getElementById('lb-notes-title');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (title) title.textContent = `Notes — ${clientName}`;
    await loadNotes();
}

async function loadNotes() {
    const list = document.getElementById('lb-notes-list');
    if (!list || !activeNotesId) return;
    const { supabase } = await import('../services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/collections/notes/${activeNotesId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const notes = res.ok ? await res.json() : [];
    const TYPE_ICONS = { note:'edit_note', call:'call', sms:'sms', email:'email', promise_to_pay:'handshake', legal:'gavel' };
    if (!notes.length) {
        list.innerHTML = '<p class="text-xs text-gray-400 text-center py-3">No notes yet.</p>';
        return;
    }
    list.innerHTML = notes.map(n => `
        <div class="flex gap-2 text-xs">
            <span class="material-symbols-outlined text-[14px] text-gray-400 flex-shrink-0 mt-0.5">${TYPE_ICONS[n.note_type] || 'edit_note'}</span>
            <div class="flex-1">
                <span class="font-medium text-gray-800">${n.body}</span>
                <span class="text-gray-400 ml-1">· ${n.profiles?.full_name || 'Admin'} · ${new Date(n.created_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short' })}</span>
            </div>
        </div>`).join('');
}

async function addNote() {
    if (!activeNotesId) return;
    const body = document.getElementById('lb-note-body')?.value?.trim();
    const type = document.getElementById('lb-note-type')?.value || 'note';
    if (!body) return;
    const { supabase } = await import('../services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/collections/notes/${activeNotesId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ note_type: type, body }),
    });
    if (res.ok) {
        document.getElementById('lb-note-body').value = '';
        await loadNotes();
    } else {
        alert('Failed to save note.');
    }
}

function exportLoanBook() {
    if (!filteredLoans.length) { alert('No data to export.'); return; }
    const headers = [
        'Reference','Client','ID Number','Amount','Monthly','Total Repayable',
        'Status','Band','Rate (%)','Term','Purpose',
        'Disbursed Date','Maturity Date',
        'Days Active','Days Overdue','Days to Maturity',
        'Bank','Account Number'
    ];
    const rows = filteredLoans.map(l => [
        l.reference,
        `"${l.client_name.replace(/"/g,'""')}"`,
        l.identity_number,
        l.amount,
        l.monthly_payment,
        l.total_repayable,
        l.status,
        l.band || '',
        l.interest_rate || '',
        l.term_months || '',
        `"${l.purpose.replace(/"/g,'""')}"`,
        l.disbursed_date,
        l.maturity_date,
        l.days_active ?? '',
        l.days_overdue ?? '',
        l.days_to_maturity ?? '',
        `"${l.bank.replace(/"/g,'""')}"`,
        l.account
    ].join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `loan_book_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
