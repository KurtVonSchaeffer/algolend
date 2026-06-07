import { initLayout } from '../shared/layout.js';
import { formatCurrency, formatDate } from '../shared/utils.js';
import { 
  fetchPayouts,
  approvePayout, 
  updateApplicationStatus,
  getCurrentAdminProfile
} from '../services/dataService.js';

// --- State ---
let allPayouts = [];
let selectedPayoutIds = new Set();
let activeTab = 'pending'; // 'pending' vs 'history'
let searchTerm = '';
let currentPagePayouts = 1;
const itemsPerPagePayouts = 20;
let userRole = 'borrower';
let currentAdminProfile = null;

// --- Main Page Rendering ---

function renderPageContent() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // Layout: Stats Cards -> Tabs -> Table
  mainContent.innerHTML = `
    <div id="payout-list-view" class="flex flex-col h-full animate-fade-in space-y-6">
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div class="glass-card p-8 rounded-2xl flex items-center justify-between">
            <div>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">Total Disbursed</p>
                <h2 id="stat-total-disbursed" class="text-3xl font-black text-on-surface mt-2">R 0.00</h2>
            </div>
            <div class="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined">payments</span>
            </div>
        </div>

        <div class="glass-card p-8 rounded-2xl flex items-center justify-between">
            <div>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">Pending Value</p>
                <h2 id="stat-pending-value" class="text-3xl font-black text-yellow-600 mt-2">R 0.00</h2>
            </div>
            <div class="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined">schedule</span>
            </div>
        </div>

        <div class="glass-card p-8 rounded-2xl flex items-center justify-between">
            <div>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">Pending Queue</p>
                <h2 id="stat-pending-queue" class="text-3xl font-black text-on-surface mt-2">0</h2>
            </div>
            <div class="w-12 h-12 rounded-xl bg-surface-container text-outline flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined">checklist</span>
            </div>
        </div>

      </div>

      <div class="glass-card rounded-2xl flex flex-col overflow-hidden flex-1 min-h-0">

        <div class="p-6 border-b border-outline-variant/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
                <h3 class="text-lg font-headline font-bold text-on-surface uppercase tracking-tight">Transaction View</h3>
                <div class="flex gap-6 mt-2">
                    <button id="tab-pending" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${activeTab === 'pending' ? 'border-[var(--color-primary)]' : 'text-outline border-transparent hover:text-on-surface'}" style="${activeTab === 'pending' ? 'color:var(--color-primary)' : ''}">
                        Ready to Pay
                    </button>
                    <button id="tab-history" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${activeTab === 'history' ? 'border-[var(--color-primary)]' : 'text-outline border-transparent hover:text-on-surface'}" style="${activeTab === 'history' ? 'color:var(--color-primary)' : ''}">
                        Paid History
                    </button>
                    <button id="tab-comparison" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${activeTab === 'comparison' ? 'border-[var(--color-primary)]' : 'text-outline border-transparent hover:text-on-surface'}" style="${activeTab === 'comparison' ? 'color:var(--color-primary)' : ''}">
                        Monthly Comparison
                    </button>
                </div>
            </div>
            
            <div class="flex items-center gap-3 w-full lg:w-auto">
                <div class="relative flex-1 lg:w-64">
                    <input type="text" id="payout-search-input" placeholder="Search ID or Name..." 
                           class="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-orange-500 text-sm focus:bg-white transition-colors">
                    <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
                </div>
                <button id="btn-bulk-disburse" class="px-6 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-30 transition-all flex items-center gap-2 shadow-sm" style="background:var(--color-primary)" disabled>
                    <span class="material-symbols-outlined text-[16px]">file_download</span> <span>Export Data</span>
                </button>
            </div>
        </div>

        <div class="overflow-auto custom-scrollbar flex-1">
          <table class="min-w-full divide-y divide-outline-variant/10">
            <thead class="bg-surface-container sticky top-0 z-10 backdrop-blur-md">
                <tr>
                    <th class="px-6 py-4 text-left w-10">
                        <input type="checkbox" id="select-all-checkbox" class="rounded border-outline-variant/30 cursor-pointer" style="accent-color:var(--color-primary)">
                    </th>
                    <th class="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Date</th>
                    <th class="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Transaction ID</th>
                    <th class="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Recipient</th>
                    <th class="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Amount</th>
                    <th class="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Method</th>
                    <th class="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Status</th>
                    <th class="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-widest text-outline">Action</th>
                </tr>
            </thead>
            <tbody id="payouts-table-body" class="bg-white divide-y divide-outline-variant/10">
                <tr><td colspan="7" class="p-10 text-center text-gray-400 italic">
                    <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Loading transaction queue...
                </td></tr>
            </tbody>
          </table>
        </div>
        
        <div id="payout-pagination-container"></div>
      </div>
      
      <div class="mt-1 text-[10px] text-gray-400 text-right font-bold uppercase tracking-tight">
        Total Records Found: <span id="visible-count">0</span>
      </div>
    </div>
  `;
  
  attachEventListeners();

  // Inject payout editor modal once
  if (!document.getElementById('payout-editor-modal')) {
    const modal = document.createElement('div');
    modal.id = 'payout-editor-modal';
    modal.className = 'hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-900">Edit Payout Method</h3>
          <button onclick="window.closePayoutEditor()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
            <i class="fa-solid fa-times text-xs"></i>
          </button>
        </div>
        <input type="hidden" id="pe-payout-id">
        <input type="hidden" id="pe-amount">

        <!-- Payment Method -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Payment Method</label>
          <div class="grid grid-cols-2 gap-2">
            ${[
              { v: 'bank_transfer', l: 'Bank Transfer',  i: 'fa-building-columns', c: 'blue' },
              { v: 'cashsend',      l: 'CashSend',       i: 'fa-mobile-screen',    c: 'purple' },
              { v: 'third_party',   l: 'Third Party',    i: 'fa-arrow-right-arrow-left', c: 'orange' },
              { v: 'cash',          l: 'Cash',           i: 'fa-money-bill',       c: 'green' },
            ].map(m => `
              <button type="button" data-method="${m.v}" onclick="window.selectPayoutMethod('${m.v}')"
                class="pe-method-btn flex items-center gap-2 p-3 rounded-xl border-2 border-gray-200 hover:border-${m.c}-400 text-left text-sm font-semibold text-gray-700 transition-all">
                <i class="fa-solid ${m.i} text-${m.c}-500 w-4"></i> ${m.l}
              </button>`).join('')}
          </div>
        </div>

        <!-- Cashsend info -->
        <div id="pe-cashsend-info" class="hidden mb-4 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700 font-medium"></div>

        <!-- Third party fields -->
        <div id="pe-third-party-fields" class="hidden space-y-3 mb-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Recipient Name</label>
              <input id="pe-third-party-name" type="text" placeholder="Full name"
                class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Bank Name</label>
              <input id="pe-third-party-bank" type="text" placeholder="e.g. Capitec"
                class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Account Number</label>
              <input id="pe-third-party-account" type="text" placeholder="Account number"
                class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none font-mono">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Reference</label>
              <input id="pe-third-party-ref" type="text" placeholder="Payment reference"
                class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Payout Notes</label>
          <input id="pe-notes" type="text" placeholder="Optional internal note..."
            class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
        </div>

        <div class="flex gap-3">
          <button type="button" onclick="window.closePayoutEditor()"
            class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
          <button type="button" id="pe-save-btn" onclick="window.savePayoutMethod()"
            class="flex-1 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            style="background:var(--color-primary)">Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
}

// ── Payout method editor ──────────────────────────────────────────
let _currentEditMethod = 'bank_transfer';

window.openPayoutEditor = async function(payoutId) {
    const p = allPayouts.find(x => x.id === payoutId);
    if (!p) return;
    _currentEditMethod = p.payment_method || 'bank_transfer';
    document.getElementById('pe-payout-id').value = payoutId;
    document.getElementById('pe-amount').value     = p.amount || 0;
    document.getElementById('pe-notes').value      = p.payout_notes || '';
    document.getElementById('pe-third-party-name').value    = p.third_party_name    || '';
    document.getElementById('pe-third-party-bank').value    = p.third_party_bank    || '';
    document.getElementById('pe-third-party-account').value = p.third_party_account || '';
    document.getElementById('pe-third-party-ref').value     = p.third_party_ref     || '';
    window.selectPayoutMethod(_currentEditMethod);
    document.getElementById('payout-editor-modal').classList.remove('hidden');
};

window.closePayoutEditor = function() {
    document.getElementById('payout-editor-modal').classList.add('hidden');
};

window.selectPayoutMethod = async function(method) {
    _currentEditMethod = method;
    document.querySelectorAll('.pe-method-btn').forEach(btn => {
        const active = btn.dataset.method === method;
        btn.classList.toggle('border-orange-400', active);
        btn.classList.toggle('bg-orange-50', active);
        btn.classList.toggle('border-gray-200', !active);
    });

    // Show/hide fields
    document.getElementById('pe-third-party-fields').classList.toggle('hidden', method !== 'third_party');

    // CashSend — fetch fee
    const csInfo = document.getElementById('pe-cashsend-info');
    if (method === 'cashsend') {
        const amount = parseFloat(document.getElementById('pe-amount').value || 0);
        if (amount > 0) {
            try {
                const res  = await fetch(`/api/cashsend/fee?amount=${amount}`);
                const data = await res.json();
                csInfo.classList.remove('hidden');
                csInfo.innerHTML = data.eligible
                    ? `CashSend Fee: <strong>R${data.fee.toFixed(2)}</strong> | Net to client: <strong>R${data.net_payout.toFixed(2)}</strong>`
                    : `<span class="text-red-600">${data.reason}</span>`;
            } catch { csInfo.classList.add('hidden'); }
        }
    } else {
        csInfo.classList.add('hidden');
    }
};

window.savePayoutMethod = async function() {
    const payoutId = document.getElementById('pe-payout-id').value;
    const amount   = parseFloat(document.getElementById('pe-amount').value || 0);
    const method   = _currentEditMethod;
    const btn      = document.getElementById('pe-save-btn');

    let cashsendFee = 0;
    if (method === 'cashsend') {
        const res  = await fetch(`/api/cashsend/fee?amount=${amount}`);
        const data = await res.json();
        if (!data.eligible) { alert(data.reason); return; }
        cashsendFee = data.fee;
    }

    const payload = {
        payment_method:      method,
        cashsend_fee:        cashsendFee,
        third_party_name:    document.getElementById('pe-third-party-name').value.trim()    || null,
        third_party_bank:    document.getElementById('pe-third-party-bank').value.trim()    || null,
        third_party_account: document.getElementById('pe-third-party-account').value.trim() || null,
        third_party_ref:     document.getElementById('pe-third-party-ref').value.trim()     || null,
        payout_notes:        document.getElementById('pe-notes').value.trim()               || null,
    };

    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
        const { supabase } = await import('../services/supabaseClient.js');
        const { error } = await supabase.from('payouts').update(payload).eq('id', payoutId);
        if (error) throw error;
        window.closePayoutEditor();
        await loadData();
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { btn.textContent = 'Save'; btn.disabled = false; }
};

const filterAndSearch = (resetPage = true) => { 
    if (resetPage) currentPagePayouts = 1;
    searchTerm = document.getElementById('payout-search-input')?.value.toLowerCase().trim() || ''; 
    
    // FIX: Track Application IDs to ignore duplicates in the list
    const seenApplications = new Set();

    const filtered = allPayouts.filter(p => {
        // 1. Status Check: Only look at the payout record's status
        const isPending = p.status === 'pending_disbursement';
        const isPaid = p.status === 'disbursed';
        const statusMatch = (activeTab === 'pending') ? isPending : isPaid;

        // 2. Text Match
        const textMatch = !searchTerm || 
            (p.profile?.full_name || '').toLowerCase().includes(searchTerm) || 
            String(p.id).includes(searchTerm);

        const isMatch = statusMatch && textMatch;

        // 3. DUPLICATE GUARD: If we match, but already saw this App ID, skip it
        if (isMatch && !seenApplications.has(p.application_id)) {
            seenApplications.add(p.application_id);
            return true;
        }
        return false;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPagePayouts) || 1;
    const start = (currentPagePayouts - 1) * itemsPerPagePayouts;
    const paginatedData = filtered.slice(start, start + itemsPerPagePayouts);

    renderPayoutTable(paginatedData); 
    renderPayoutPaginationControls(totalPages, filtered.length);
    
    const countEl = document.getElementById('visible-count');
    if(countEl) countEl.textContent = filtered.length;
};

function renderPayoutTable(payouts) {
    const tb = document.getElementById('payouts-table-body');
    if (!tb) return;

    if (payouts.length === 0) {
        tb.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-sm text-gray-400 italic">No transactions found for the selected view.</td></tr>`;
        return;
    }

    tb.innerHTML = payouts.map(p => {
        const isSelected  = selectedPayoutIds.has(p.id);
        const dateStr     = formatDate(p.created_at);
        const method      = p.payment_method || 'bank_transfer';
        const isCashsend  = method === 'cashsend';
        const isThirdParty= method === 'third_party';
        const fee         = Number(p.cashsend_fee || 0);

        const methodBadge = {
            bank_transfer: { label: 'Bank Transfer', bg: 'bg-blue-50 text-blue-700 border-blue-100' },
            cashsend:      { label: 'CashSend',      bg: 'bg-purple-50 text-purple-700 border-purple-100' },
            third_party:   { label: 'Third Party',   bg: 'bg-orange-50 text-orange-700 border-orange-100' },
            cash:          { label: 'Cash',           bg: 'bg-gray-50 text-gray-700 border-gray-100' },
        }[method] || { label: method, bg: 'bg-gray-50 text-gray-700 border-gray-100' };

        return `
        <tr class="hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0">
            <td class="px-6 py-4">
                <input type="checkbox" class="payout-checkbox rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer" data-id="${p.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td class="px-6 py-4 text-xs text-gray-600 font-medium whitespace-nowrap">${dateStr}</td>
            <td class="px-6 py-4">
                <div class="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block border border-gray-100">#${p.id.slice(0,8)}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-bold text-gray-900">${isThirdParty ? (p.third_party_name || 'Third Party') : (p.profile?.full_name || 'N/A')}</div>
                ${isThirdParty ? `<div class="text-[10px] text-orange-600 font-semibold">→ ${p.third_party_bank || ''} ${p.third_party_account || ''}</div>` : ''}
                ${!isThirdParty ? `<div class="text-[10px] text-gray-400">${p.profile?.full_name || ''}</div>` : ''}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-black text-gray-900">${formatCurrency(p.amount)}</div>
                ${isCashsend && fee ? `<div class="text-[10px] text-purple-600">Fee: ${formatCurrency(fee)} | Net: ${formatCurrency(Number(p.amount) - fee)}</div>` : ''}
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${methodBadge.bg}">${methodBadge.label}</span>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${activeTab === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-600 border-green-100'}">
                    ${activeTab === 'pending' ? 'Pending' : 'Paid'}
                </span>
            </td>
            <td class="px-6 py-4 text-right flex items-center justify-end gap-2">
                <button onclick="window.openPayoutEditor('${p.id}')" class="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50" title="Edit payout method">
                    <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <a href="/admin/application-detail?id=${p.application_id}" class="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50 inline-block">
                    <i class="fa-solid fa-eye text-xs"></i>
                </a>
            </td>
        </tr>
    `}).join('');

    // Attach row-specific checkbox listeners
    tb.querySelectorAll('.payout-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) selectedPayoutIds.add(id);
            else selectedPayoutIds.delete(id);
            updateBulkUI();
        });
    });
}

function updateBulkUI() {
    const btn = document.getElementById('btn-bulk-disburse');
    if (!btn) return;
    const count = selectedPayoutIds.size;
    btn.disabled = count === 0;
    
    // Change Button Text based on selection
    if (count > 0) {
        btn.innerHTML = `<i class="fa-solid fa-file-csv"></i> <span class="ml-2">Export & Process (${count})</span>`;
        btn.classList.remove('bg-gray-900');
        btn.classList.add('bg-orange-600');
    } else {
        btn.innerHTML = `<i class="fa-solid fa-file-csv"></i> <span class="ml-2">Export Data</span>`;
        btn.classList.add('bg-gray-900');
        btn.classList.remove('bg-orange-600');
    }
}

function renderPayoutPaginationControls(totalPages, totalRecords) {
    const container = document.getElementById('payout-pagination-container');
    if (!container) return; 

    if (totalPages <= 1) {
        container.innerHTML = `<div class="p-4 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">End of Records</div>`;
        return;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50">
            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Page ${currentPagePayouts} of ${totalPages}</span>
            <div class="flex gap-2">
                <button onclick="window.changePagePayouts(${currentPagePayouts - 1})" ${currentPagePayouts === 1 ? 'disabled' : ''} 
                    class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm text-gray-700">Prev</button>
                <button onclick="window.changePagePayouts(${currentPagePayouts + 1})" ${currentPagePayouts === totalPages ? 'disabled' : ''} 
                    class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm text-gray-700">Next</button>
            </div>
        </div>
    `;
}

// Global page changer attached to window
window.changePagePayouts = (page) => {
    currentPagePayouts = page;
    filterAndSearch(false);
    if (activeTab === 'comparison') renderComparisonView();
};

// --- Event Listeners ---
function attachEventListeners() {
    // Search Listener
    document.getElementById('payout-search-input')?.addEventListener('input', () => filterAndSearch(true));
    
    // Tab Listeners
    document.getElementById('tab-pending')?.addEventListener('click', () => { 
        activeTab = 'pending'; 
        selectedPayoutIds.clear();
        updateBulkUI();
        renderPageContent(); 
        updateDashboardStats(allPayouts); // Refresh stats
        filterAndSearch(true);
    });
    
    document.getElementById('tab-comparison')?.addEventListener('click', () => {
        activeTab = 'comparison';
        renderPageContent();
        loadData().then(() => renderComparisonView());
    });

    document.getElementById('tab-history')?.addEventListener('click', () => {
        activeTab = 'history'; 
        selectedPayoutIds.clear();
        updateBulkUI();
        renderPageContent(); 
        updateDashboardStats(allPayouts); // Refresh stats
        filterAndSearch(true);
    });

    // Select All Listener
    document.getElementById('select-all-checkbox')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.payout-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const id = parseInt(cb.dataset.id);
            if (e.target.checked) selectedPayoutIds.add(id);
            else selectedPayoutIds.delete(id);
        });
        updateBulkUI();
    });

    // Bulk Export/Process Button Listener
    document.getElementById('btn-bulk-disburse')?.addEventListener('click', () => {
        if (activeTab === 'pending') {
            handleBulkDisburse(); // Logic for processing payments
        } else {
            handleBulkExport(); // Logic for just exporting history
        }
    });
}

// --- Stats Logic ---
function updateDashboardStats(data) {
    // 1. Calculate Total Disbursed (All time)
    // Filter for disbursed status in history
    const disbursedItems = data.filter(p => p.status === 'disbursed' || p.application?.status === 'DISBURSED');
    const totalDisbursedVal = disbursedItems.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 2. Calculate Pending Value & Queue
    const pendingItems = data.filter(p => p.status === 'pending_disbursement' || p.application?.status === 'APPROVED');
    const pendingVal = pendingItems.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pendingCount = pendingItems.length;

    // 3. Update DOM
    const elTotal = document.getElementById('stat-total-disbursed');
    const elPendingVal = document.getElementById('stat-pending-value');
    const elPendingCount = document.getElementById('stat-pending-queue');

    if (elTotal) elTotal.textContent = formatCurrency(totalDisbursedVal);
    if (elPendingVal) elPendingVal.textContent = formatCurrency(pendingVal);
    if (elPendingCount) elPendingCount.textContent = pendingCount;
}

// --- Bulk Logic Actions ---

async function handleBulkDisburse() {
    if (selectedPayoutIds.size === 0) return;

    // PIN confirmation before generating locked CSV
    const pin = window.prompt(
        `🔒 Enter the CSV download PIN to generate the Capitec payout file.\n\nThis will mark ${selectedPayoutIds.size} payout(s) as DISBURSED.`,
        ''
    );
    if (pin === null) return; // cancelled
    if (!pin.trim()) { alert('PIN is required to download the CSV.'); return; }

    if (!confirm(`Mark ${selectedPayoutIds.size} payout(s) as DISBURSED and download Capitec CSV?`)) return;

    const selectedItems = allPayouts.filter(p => selectedPayoutIds.has(p.id));
    const applicationIds = selectedItems.map(p => p.application_id).filter(Boolean);

    const btn = document.getElementById('btn-bulk-disburse');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Generating CSV...`;
    btn.disabled = true;

    try {
        // Single server call — generates Capitec CSV + marks DISBURSED atomically
        const res = await fetch('/api/payouts/capitec-csv', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csv-pin': pin.trim()
            },
            body: JSON.stringify({ applicationIds, markDisbursed: true })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Server error ${res.status}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `capitec_payout_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`${selectedItems.length} payout(s) marked as DISBURSED and CSV downloaded.`);
        selectedPayoutIds.clear();
        await loadData();

    } catch (error) {
        console.error('Capitec CSV error:', error);
        alert(`CSV generation failed: ${error.message}`);
        await loadData();
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ── Monthly Comparison Report ─────────────────────────────────────
function renderComparisonView() {
    const tableWrapper = document.querySelector('.overflow-auto.custom-scrollbar');
    if (!tableWrapper) return;

    // Group disbursed payouts by month
    const disbursed = allPayouts.filter(p => p.status === 'DISBURSED' || p.status === 'APPROVED');
    const byMonth = {};

    disbursed.forEach(p => {
        const d    = new Date(p.created_at || p.approved_at);
        const key  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label= d.toLocaleDateString('en-ZA', { year:'numeric', month:'long' });
        if (!byMonth[key]) byMonth[key] = { label, count: 0, total: 0, items: [] };
        byMonth[key].count++;
        byMonth[key].total += Number(p.amount || 0);
        byMonth[key].items.push(p);
    });

    const months  = Object.keys(byMonth).sort().reverse();
    const grandTotal = disbursed.reduce((s,p) => s + Number(p.amount||0), 0);

    if (!months.length) {
        tableWrapper.innerHTML = `<div class="p-16 text-center text-sm text-gray-400">No disbursement history yet.</div>`;
        return;
    }

    tableWrapper.innerHTML = `
      <div class="p-6 space-y-4">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-bold text-gray-700">Month-over-Month Disbursement Comparison</h4>
          <button onclick="window.exportComparisonCSV()" class="text-xs font-bold text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[14px]">download</span> Export Report
          </button>
        </div>

        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <th class="px-4 py-3 text-left rounded-tl-xl">Month</th>
              <th class="px-4 py-3 text-right"># Payouts</th>
              <th class="px-4 py-3 text-right">Total Disbursed</th>
              <th class="px-4 py-3 text-right">Avg per Payout</th>
              <th class="px-4 py-3 text-right rounded-tr-xl">MoM Change</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${months.map((key, i) => {
                const m     = byMonth[key];
                const prev  = months[i+1] ? byMonth[months[i+1]] : null;
                const change= prev ? ((m.total - prev.total) / prev.total * 100) : null;
                const avg   = m.count ? m.total / m.count : 0;
                const isUp  = change > 0;
                return `
                <tr class="hover:bg-orange-50/30 transition-colors">
                  <td class="px-4 py-3 font-semibold text-gray-800">${m.label}</td>
                  <td class="px-4 py-3 text-right text-gray-600">${m.count}</td>
                  <td class="px-4 py-3 text-right font-bold text-gray-900">${formatCurrency(m.total)}</td>
                  <td class="px-4 py-3 text-right text-gray-500">${formatCurrency(avg)}</td>
                  <td class="px-4 py-3 text-right">
                    ${change !== null
                        ? `<span class="font-bold ${isUp ? 'text-green-600' : 'text-red-500'}">${isUp?'▲':'▼'} ${Math.abs(change).toFixed(1)}%</span>`
                        : '<span class="text-gray-300">—</span>'}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-gray-900 text-white font-bold text-sm">
              <td class="px-4 py-3 rounded-bl-xl">ALL TIME</td>
              <td class="px-4 py-3 text-right">${disbursed.length}</td>
              <td class="px-4 py-3 text-right">${formatCurrency(grandTotal)}</td>
              <td class="px-4 py-3 text-right">${formatCurrency(disbursed.length ? grandTotal/disbursed.length : 0)}</td>
              <td class="px-4 py-3 rounded-br-xl"></td>
            </tr>
          </tfoot>
        </table>

        <!-- Per-month detail breakdown -->
        <div class="mt-6 space-y-3">
          ${months.slice(0,3).map(key => {
              const m = byMonth[key];
              return `
              <details class="border border-gray-100 rounded-xl overflow-hidden">
                <summary class="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 flex justify-between">
                  <span>${m.label} — ${m.count} payouts</span>
                  <span class="font-bold" style="color:var(--color-primary)">${formatCurrency(m.total)}</span>
                </summary>
                <table class="w-full text-xs">
                  <thead><tr class="bg-gray-50 text-gray-400 font-bold uppercase">
                    <th class="px-4 py-2 text-left">Client</th>
                    <th class="px-4 py-2 text-right">Amount</th>
                    <th class="px-4 py-2 text-right">Date</th>
                  </tr></thead>
                  <tbody class="divide-y divide-gray-50">
                    ${m.items.map(p => `
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-2 text-gray-700">${p.profile?.full_name || '—'}</td>
                      <td class="px-4 py-2 text-right font-semibold text-gray-900">${formatCurrency(p.amount)}</td>
                      <td class="px-4 py-2 text-right text-gray-400">${formatDate(p.created_at)}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </details>`;
          }).join('')}
        </div>
      </div>`;
}

window.exportComparisonCSV = function() {
    const disbursed = allPayouts.filter(p => p.status === 'DISBURSED' || p.status === 'APPROVED');
    const headers = ['Month','Client Name','Amount','Date','Reference','Bank','Account Number'];
    const rows = disbursed.map(p => {
        const d = new Date(p.created_at);
        return [
            `"${d.toLocaleDateString('en-ZA',{year:'numeric',month:'long'})}"`,
            `"${(p.profile?.full_name||'').replace(/"/g,'""')}"`,
            p.amount || 0,
            formatDate(p.created_at),
            `"${p.id}"`,
            `"${p.application?.bank_account?.bank_name||''}"`,
            `"${p.application?.bank_account?.account_number||''}"`
        ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `payout_comparison_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
};

function handleBulkExport() {
    if (selectedPayoutIds.size === 0) return;
    const selectedItems = allPayouts.filter(p => selectedPayoutIds.has(p.id));
    downloadCSV(selectedItems);
    selectedPayoutIds.clear();
    updateBulkUI();
    // Uncheck select-all visually
    const selectAll = document.getElementById('select-all-checkbox');
    if(selectAll) selectAll.checked = false;
    document.querySelectorAll('.payout-checkbox').forEach(cb => cb.checked = false);
}

function downloadCSV(items) {
    const headers = ["Payout ID", "Recipient", "Amount", "Status", "Date", "Application ID", "Bank", "Account"];
    
    const rows = items.map(p => [
        p.id,
        `"${p.profile?.full_name || 'N/A'}"`,
        p.amount,
        activeTab === 'pending' ? 'Pending' : 'Paid',
        formatDate(p.created_at),
        p.application_id,
        // FIX: Reaching through 'application' to get the specific bank account
        `"${p.application?.bank_account?.bank_name || 'N/A'}"`,
        `"${p.application?.bank_account?.account_number || 'N/A'}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `payout_export_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// --- Data Loading ---

async function loadData() {
  try {
    const { data, error } = await fetchPayouts();
    if (error) throw error;
    allPayouts = data;
    
    // Update dashboard stats immediately
    updateDashboardStats(allPayouts);
    
    filterAndSearch(true); 
    
  } catch (error) {
    console.error("Payout Load Error:", error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await initLayout();
  if (auth) {
      userRole = auth.role;
      currentAdminProfile = await getCurrentAdminProfile();
      renderPageContent();
      await loadData();
  }
});