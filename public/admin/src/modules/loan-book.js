// Loan Book Analysis — full portfolio view with tracking days
import { initLayout }    from '../shared/layout.js';
import { fetchLoanBook, fetchBranches } from '../services/dataService.js';
import { formatCurrency, formatDate, STATUS_DISPLAY } from '../shared/utils.js';

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
    const spinner = document.getElementById('lb-spinner');
    if (spinner) spinner.classList.remove('hidden');
    const { data } = await fetchLoanBook(activeBranch);
    allLoans = data || [];
    applyFilters();
    if (spinner) spinner.classList.add('hidden');
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
        </div>
      </div>

      <!-- Summary cards -->
      <div id="lb-summary" class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"></div>

      <!-- Spinner -->
      <div id="lb-spinner" class="text-center py-12 text-gray-400 hidden">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3"></i>
        <p class="text-sm">Loading loan book...</p>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[1200px]">
            <thead>
              <tr class="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
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
}

function renderSummary() {
    const el = document.getElementById('lb-summary');
    if (!el) return;
    const total      = filteredLoans.length;
    const totalBook  = filteredLoans.reduce((s,l) => s + l.amount, 0);
    const inArrears  = filteredLoans.filter(l => l.status === 'IN_ARREARS').length;
    const inDefault  = filteredLoans.filter(l => l.status === 'IN_DEFAULT').length;
    const avgDays    = filteredLoans.filter(l => l.days_active !== null).reduce((s,l,_,a) => s + l.days_active/a.length, 0);

    el.innerHTML = [
        { label: 'Total Loans',      value: total,                     color: '#E7762E', bg: '#fff3ea', icon: 'receipt_long' },
        { label: 'Loan Book Value',  value: formatCurrency(totalBook), color: '#10b981', bg: '#d1fae5', icon: 'payments' },
        { label: 'In Arrears',       value: inArrears,                 color: '#f59e0b', bg: '#fef3c7', icon: 'warning' },
        { label: 'In Default',       value: inDefault,                 color: '#ef4444', bg: '#fee2e2', icon: 'error' },
        { label: 'Avg Days Active',  value: Math.round(avgDays) || '—',color: '#6b7280', bg: '#f3f4f6', icon: 'schedule' },
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

        return `
        <tr class="hover:bg-gray-50 transition-colors ${isDefault ? 'bg-red-50/30' : isArrears ? 'bg-yellow-50/30' : ''}">
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
        const res = await fetch('/api/notifications/status-change', {
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
