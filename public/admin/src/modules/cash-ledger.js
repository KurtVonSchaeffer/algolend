// Cash Ledger — Read-only view with daily journal entry capability
import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';
import { formatCurrency, formatDate } from '../shared/utils.js';

let entries     = [];
let branches    = [];
let activeBranch = 'all';
// Default: show current month
const _today = new Date().toISOString().slice(0,10);
const _monthStart = _today.slice(0,8) + '01';
let dateFrom  = _monthStart;
let dateTo    = _today;

// ─────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initLayout({ pageTitle: 'Cash Ledger', activeNav: 'cash-ledger' });
    await loadBranches();
    renderPage();
    await loadEntries();
});

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────
async function loadBranches() {
    const { data } = await supabase.from('branches').select('id, name').order('name');
    branches = data || [];
}

async function loadEntries() {
    let query = supabase
        .from('cash_journal')
        .select('*')
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo)
        .order('entry_date', { ascending: false })
        .order('created_at',  { ascending: false });

    if (activeBranch !== 'all') query = query.eq('branch_id', activeBranch);

    const { data, error } = await query;
    if (error) { console.error('[cash-ledger]', error); return; }
    entries = data || [];
    renderTable();
    renderSummary();
}

async function addJournalEntry(payload) {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile }     = await supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle();
    const { error } = await supabase.from('cash_journal').insert([{
        ...payload,
        created_by:      session.user.id,
        created_by_name: profile?.full_name || session.user.email
    }]);
    if (error) throw error;
    await loadEntries();
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function renderPage() {
    const shell = document.getElementById('app-shell');
    const main  = shell.querySelector('main') || shell;
    let content = main.querySelector('#cl-content');
    if (!content) {
        content = document.createElement('div');
        content.id        = 'cl-content';
        content.className = 'p-6 max-w-6xl mx-auto';
        main.appendChild(content);
    }

    content.innerHTML = `
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Cash Ledger</h1>
          <p class="text-sm text-gray-500 mt-0.5">Daily cash flow journal — read-only. Entries cannot be deleted.</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <select id="branch-select" onchange="window.clSwitchBranch(this.value)"
            class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
            <option value="all">All Branches</option>
            ${branches.map(b => `<option value="${b.id}" ${b.id===activeBranch?'selected':''}>${b.name}</option>`).join('')}
          </select>
          <div class="flex items-center gap-2">
            <input type="date" id="date-from" value="${dateFrom}"
              onchange="window.clSetDateFrom(this.value)"
              class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
            <span class="text-gray-400 text-xs font-bold">to</span>
            <input type="date" id="date-to" value="${dateTo}"
              onchange="window.clSetDateTo(this.value)"
              class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
          </div>
          <div class="flex gap-1">
            ${['Today','Week','Month','All'].map(p => `
            <button onclick="window.clSetPeriod('${p}')"
              class="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors">
              ${p}
            </button>`).join('')}
          </div>
          <button onclick="window.clOpenJournal()"
            class="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <i class="fas fa-plus text-xs"></i> Add Journal Entry
          </button>
          <button onclick="window.clExport()"
            class="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <i class="fas fa-download text-xs"></i> Export
          </button>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6" id="cl-summary"></div>

      <!-- Ledger table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th class="px-5 py-3 text-left">Date</th>
                <th class="px-5 py-3 text-left">Type</th>
                <th class="px-5 py-3 text-left">Category</th>
                <th class="px-5 py-3 text-left">Description</th>
                <th class="px-5 py-3 text-left">Reference</th>
                <th class="px-5 py-3 text-right">Cash In</th>
                <th class="px-5 py-3 text-right">Cash Out</th>
                <th class="px-5 py-3 text-right">Running Balance</th>
                <th class="px-5 py-3 text-left">By</th>
              </tr>
            </thead>
            <tbody id="cl-table-body" class="divide-y divide-gray-50">
              <tr><td colspan="9" class="p-10 text-center text-sm text-gray-400">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Journal Entry Modal -->
      <div id="cl-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-bold text-gray-900">New Journal Entry</h3>
            <button onclick="window.clCloseJournal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>
          <form id="cl-form" onsubmit="window.clSaveEntry(event)" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date</label>
                <input name="entry_date" type="date" value="${dateTo}" required
                  class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Type</label>
                <select name="entry_type" required class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="cash_in">Cash In</option>
                  <option value="cash_out">Cash Out</option>
                  <option value="opening_balance">Opening Balance</option>
                  <option value="closing_balance">Closing Balance</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Category</label>
                <select name="category" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="loan_disbursement">Loan Disbursement</option>
                  <option value="repayment">Repayment Received</option>
                  <option value="petty_cash">Petty Cash</option>
                  <option value="expense">Expense</option>
                  <option value="bank_deposit">Bank Deposit</option>
                  <option value="bank_withdrawal">Bank Withdrawal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Branch</label>
                <select name="branch_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="">— Select —</option>
                  ${branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Amount (R) *</label>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Description *</label>
              <input name="description" type="text" required placeholder="e.g. Cash received from client John Smith"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Reference</label>
              <input name="reference" type="text" placeholder="e.g. C1234-L0042, receipt #001"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="window.clCloseJournal()"
                class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
              <button type="submit" id="cl-save-btn"
                class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Save Entry</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Expose window functions
    window.clSwitchBranch = (v) => { activeBranch = v; loadEntries(); };
    window.clSetDateFrom  = (v) => { dateFrom = v; loadEntries(); };
    window.clSetDateTo    = (v) => { dateTo = v; loadEntries(); };
    window.clSetPeriod    = (period) => {
        const t = new Date(); const f = new Date();
        if (period === 'Today') { dateFrom = dateTo = t.toISOString().slice(0,10); }
        else if (period === 'Week') { f.setDate(t.getDate()-6); dateFrom = f.toISOString().slice(0,10); dateTo = t.toISOString().slice(0,10); }
        else if (period === 'Month') { dateFrom = t.toISOString().slice(0,8)+'01'; dateTo = t.toISOString().slice(0,10); }
        else if (period === 'All') { dateFrom = '2020-01-01'; dateTo = t.toISOString().slice(0,10); }
        document.getElementById('date-from').value = dateFrom;
        document.getElementById('date-to').value   = dateTo;
        loadEntries();
    };
    window.clOpenJournal  = () => document.getElementById('cl-modal').classList.remove('hidden');
    window.clCloseJournal = () => document.getElementById('cl-modal').classList.add('hidden');
    window.clSaveEntry    = saveEntry;
    window.clExport       = exportLedger;
}

function renderSummary() {
    const el = document.getElementById('cl-summary');
    if (!el) return;

    // entries are already filtered by date range + branch from loadEntries()
    const cashIn   = entries.filter(e => ['cash_in','opening_balance'].includes(e.entry_type)).reduce((s,e) => s + Number(e.amount), 0);
    const cashOut  = entries.filter(e => ['cash_out','closing_balance'].includes(e.entry_type)).reduce((s,e) => s + Number(e.amount), 0);
    const net      = cashIn - cashOut;
    const disbursed = entries.filter(e => e.category === 'loan_disbursement').reduce((s,e) => s + Number(e.amount), 0);
    const repaid    = entries.filter(e => e.category === 'repayment').reduce((s,e) => s + Number(e.amount), 0);

    const rangeLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`;

    el.innerHTML = [
        { label: `Cash In (${rangeLabel})`,  value: formatCurrency(cashIn),     color: '#10b981', bg: '#d1fae5', icon: 'arrow_downward'  },
        { label: `Cash Out (${rangeLabel})`, value: formatCurrency(cashOut),    color: '#ef4444', bg: '#fee2e2', icon: 'arrow_upward'    },
        { label: 'Net Position',             value: formatCurrency(net),        color: net >= 0 ? '#10b981' : '#ef4444', bg: net >= 0 ? '#d1fae5' : '#fee2e2', icon: 'balance' },
        { label: 'Loans Disbursed',          value: formatCurrency(disbursed),  color: '#E7762E', bg: '#fff3ea', icon: 'payments'        },
        { label: 'Repayments Collected',     value: formatCurrency(repaid),     color: '#6366f1', bg: '#eef2ff', icon: 'savings'         },
        { label: 'Entries',                  value: entries.length,             color: '#6b7280', bg: '#f3f4f6', icon: 'receipt_long'    }
    ].map(c => `
      <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.bg}">
          <span class="material-symbols-outlined text-[20px]" style="color:${c.color}">${c.icon}</span>
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${c.label}</p>
          <p class="text-xl font-black mt-0.5" style="color:${c.color}">${c.value}</p>
        </div>
      </div>`).join('');
}

function renderTable() {
    const tbody = document.getElementById('cl-table-body');
    if (!tbody) return;

    // entries already filtered by date range + branch from loadEntries()
    const filtered = entries;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-10 text-center text-sm text-gray-400">No entries for this date. <button onclick="window.clOpenJournal()" class="text-orange-500 font-semibold">Add the first entry.</button></td></tr>`;
        return;
    }

    // Calculate running balance (oldest first)
    let balance = 0;
    const sorted = [...filtered].reverse();
    const withBalance = sorted.map(e => {
        if (['cash_in','opening_balance'].includes(e.entry_type))  balance += Number(e.amount);
        if (['cash_out','closing_balance'].includes(e.entry_type)) balance -= Number(e.amount);
        return { ...e, runningBalance: balance };
    }).reverse();

    const TYPE_LABELS = {
        cash_in:         { label: 'Cash In',          color: '#10b981', bg: '#d1fae5' },
        cash_out:        { label: 'Cash Out',          color: '#ef4444', bg: '#fee2e2' },
        opening_balance: { label: 'Opening Balance',   color: '#3b82f6', bg: '#dbeafe' },
        closing_balance: { label: 'Closing Balance',   color: '#8b5cf6', bg: '#ede9fe' },
        adjustment:      { label: 'Adjustment',        color: '#f59e0b', bg: '#fef3c7' }
    };

    tbody.innerHTML = withBalance.map(e => {
        const t       = TYPE_LABELS[e.entry_type] || { label: e.entry_type, color: '#6b7280', bg: '#f3f4f6' };
        const isIn    = ['cash_in','opening_balance'].includes(e.entry_type);
        const isOut   = ['cash_out','closing_balance'].includes(e.entry_type);
        const balColor= e.runningBalance >= 0 ? '#10b981' : '#ef4444';
        return `
        <tr class="hover:bg-gray-50/50 transition-colors">
          <td class="px-5 py-3 text-xs font-mono text-gray-500">${e.entry_date}</td>
          <td class="px-5 py-3">
            <span class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:${t.bg};color:${t.color}">${t.label}</span>
          </td>
          <td class="px-5 py-3 text-xs text-gray-500 capitalize">${(e.category||'').replace(/_/g,' ')}</td>
          <td class="px-5 py-3 text-sm text-gray-800 font-medium max-w-xs truncate">${e.description}</td>
          <td class="px-5 py-3 text-xs font-mono text-gray-400">${e.reference || '—'}</td>
          <td class="px-5 py-3 text-right text-sm font-bold text-green-600">${isIn  ? formatCurrency(e.amount) : '—'}</td>
          <td class="px-5 py-3 text-right text-sm font-bold text-red-500">${isOut ? formatCurrency(e.amount) : '—'}</td>
          <td class="px-5 py-3 text-right text-sm font-black" style="color:${balColor}">${formatCurrency(e.runningBalance)}</td>
          <td class="px-5 py-3 text-xs text-gray-400">${e.created_by_name || '—'}</td>
        </tr>`;
    }).join('');
}

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────
async function saveEntry(e) {
    e.preventDefault();
    const btn  = document.getElementById('cl-save-btn');
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.amount = parseFloat(data.amount);

    btn.textContent = 'Saving…';
    btn.disabled    = true;
    try {
        await addJournalEntry(data);
        window.clCloseJournal();
        form.reset();
        form.elements['entry_date'].value = dateTo;
    } catch (err) {
        alert('Error saving entry: ' + err.message);
    } finally {
        btn.textContent = 'Save Entry';
        btn.disabled    = false;
    }
}

function exportLedger() {
    if (!entries.length) { alert('No entries to export.'); return; }
    const headers = ['Date','Type','Category','Description','Reference','Amount','Cash In','Cash Out','Created By','Branch'];
    const rows = entries.map(e => {
        const isIn  = ['cash_in','opening_balance'].includes(e.entry_type);
        const isOut = ['cash_out','closing_balance'].includes(e.entry_type);
        return [
            e.entry_date,
            e.entry_type,
            e.category || '',
            `"${(e.description||'').replace(/"/g,'""')}"`,
            e.reference || '',
            e.amount,
            isIn  ? e.amount : 0,
            isOut ? e.amount : 0,
            e.created_by_name || '',
            e.branch_id || ''
        ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `cash_ledger_${dateFrom}_to_${dateTo}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
