import { initLayout } from '../shared/layout.js';
import { formatCurrency, formatDate } from '../shared/utils.js';
import { supabase } from '../services/supabaseClient.js';
import {
  fetchPayments,
  fetchAnalyticsData
} from '../services/dataService.js';

// ── Manual / EFT Payment Review ─────────────────────────────────
let pendingManualPayments = [];

async function loadPendingManualPayments() {
  const { data, error } = await supabase
    .from('manual_payments')
    .select('*, profiles:user_id(full_name, phone, identity_number), loan_applications:application_id(loan_number, amount, status)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) { console.warn('[manual-payments]', error.message); return; }
  pendingManualPayments = data || [];
  renderPendingPanel();
}

function renderPendingPanel() {
  const el = document.getElementById('pending-manual-payments');
  if (!el) return;

  if (!pendingManualPayments.length) {
    el.innerHTML = `
      <div class="flex items-center gap-2 text-sm text-slate-400 py-4">
        <span class="material-symbols-outlined text-[18px]">check_circle</span>
        No pending manual payments
      </div>`;
    return;
  }

  const badge = document.getElementById('pending-count-badge');
  if (badge) { badge.textContent = pendingManualPayments.length; badge.classList.remove('hidden'); }

  el.innerHTML = pendingManualPayments.map(p => {
    const name    = p.profiles?.full_name || 'Unknown';
    const phone   = p.profiles?.phone || '—';
    const loanRef = p.loan_applications?.loan_number || p.application_id?.toString().slice(0,8) || '—';
    const typeLabel = p.payment_type === 'settlement' ? 'Settlement' : p.payment_type === 'arrears' ? 'Arrears Payment' : 'Payment';
    const typeColor = p.payment_type === 'settlement' ? 'text-purple-600 bg-purple-50' : 'text-green-700 bg-green-50';
    const age = Math.floor((Date.now() - new Date(p.created_at)) / 3600000);
    const ageLabel = age < 1 ? 'Just now' : age < 24 ? `${age}h ago` : `${Math.floor(age/24)}d ago`;

    return `
      <div class="border border-slate-100 rounded-2xl p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-all" id="mp-${p.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 text-sm flex-shrink-0">
              ${name.charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 text-sm truncate">${name}</p>
              <p class="text-xs text-slate-400">${phone} · Loan ${loanRef}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="font-black text-lg text-slate-900">R ${Number(p.amount).toLocaleString('en-ZA',{minimumFractionDigits:2})}</p>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${typeColor}">${typeLabel}</span>
          </div>
        </div>

        ${p.reference ? `<p class="text-xs text-slate-500 mt-2"><span class="font-semibold">Ref:</span> ${p.reference}</p>` : ''}
        ${p.proof_url ? `<p class="text-xs text-slate-500 mt-1"><span class="font-semibold">Proof:</span> <a href="${p.proof_url}" target="_blank" class="text-orange-600 underline">${p.proof_url.length > 40 ? p.proof_url.slice(0,40)+'…' : p.proof_url}</a></p>` : ''}
        ${p.notes    ? `<p class="text-xs text-slate-500 mt-1 italic">"${p.notes}"</p>` : ''}

        <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span class="text-[10px] text-slate-400">${ageLabel}</span>
          <div class="flex gap-2">
            <button onclick="window.rejectManualPayment('${p.id}')"
              class="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
              Reject
            </button>
            <button onclick="window.confirmManualPayment('${p.id}','${p.payment_type}','${name}')"
              class="px-3 py-1.5 text-xs font-bold text-white rounded-xl transition-colors flex items-center gap-1.5"
              style="background:var(--color-primary)">
              <span class="material-symbols-outlined text-[14px]">check</span> Confirm
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.confirmManualPayment = async (id, payType, clientName) => {
  if (!confirm(`Confirm ${payType === 'settlement' ? 'SETTLEMENT' : 'payment'} from ${clientName}?\n\nThis will:\n• Mark as confirmed\n• Post to Cash Ledger\n• Send SMS to client${payType === 'settlement' ? '\n• Set loan status to SETTLED' : ''}`)) return;

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/admin/payment/confirm/${id}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  });
  const json = await res.json();
  if (json.success) {
    // Animate out
    const el = document.getElementById(`mp-${id}`);
    if (el) { el.style.opacity = '0'; el.style.transform = 'scale(0.95)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }
    pendingManualPayments = pendingManualPayments.filter(p => p.id !== id);
    renderPendingPanel();
  } else {
    alert('Error: ' + (json.error || 'Could not confirm'));
  }
};

window.rejectManualPayment = async (id) => {
  const reason = prompt('Reason for rejection (sent to client):');
  if (reason === null) return;

  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('manual_payments')
    .update({ status: 'rejected', rejection_reason: reason, confirmed_at: new Date().toISOString() })
    .eq('id', id);

  if (!error) {
    const el = document.getElementById(`mp-${id}`);
    if (el) { el.style.opacity='0'; el.style.transition='all .3s'; setTimeout(()=>el.remove(),300); }
    pendingManualPayments = pendingManualPayments.filter(p => p.id !== id);
    renderPendingPanel();
  }
};

// --- State ---
let allPayments = [];
let analyticsData = [];
let activeTab = '30days'; 
let searchTerm = '';
let currentPage = 1;
const itemsPerPage = 15;

/**
 * Main Page Rendering
 * Implements the brand guide layout: 3 Cards -> Table (Left) & Analytics (Right)
 */
function renderPageContent() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div id="recovery-dashboard" class="flex flex-col h-full animate-fade-in space-y-6">

      <!-- Admin Record Payment (with back-date) -->
      <div class="glass-card rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px] text-green-600">add_circle</span>
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Record Payment</h3>
              <p class="text-xs text-slate-400">Admin: manually record a payment with any date</p>
            </div>
          </div>
          <button onclick="window.toggleRecordPaymentForm()" class="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-colors" style="background:var(--color-primary)">+ Record</button>
        </div>
        <div id="record-payment-form" class="hidden p-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Loan / App ID or Ref</label>
              <input id="rp-app-id" type="text" placeholder="Loan number or application ID" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Amount (R)</label>
              <input id="rp-amount" type="number" min="1" placeholder="e.g. 1500" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Payment Date</label>
              <input id="rp-date" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)" value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Payment Type</label>
              <select id="rp-type" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
                <option value="partial">Regular Installment</option>
                <option value="settlement">Settlement (Full)</option>
                <option value="arrears">Arrears Payment</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Reference</label>
              <input id="rp-ref" type="text" placeholder="Bank ref / receipt no." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Notes</label>
              <input id="rp-notes" type="text" placeholder="Optional notes" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
            </div>
          </div>
          <div class="flex gap-3">
            <button onclick="window.submitAdminPayment()" class="px-6 py-2.5 text-white text-sm font-bold rounded-xl transition-colors shadow-sm" style="background:var(--color-primary)">
              <span class="material-symbols-outlined text-[16px] align-middle mr-1">save</span> Save Payment
            </button>
            <button onclick="window.toggleRecordPaymentForm()" class="px-4 py-2.5 text-sm font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
          <div id="rp-feedback" class="hidden mt-3 p-3 rounded-xl text-sm font-semibold"></div>
        </div>
      </div>

      <!-- Pending Manual Payments Banner -->
      <div class="glass-card rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]" style="color:var(--color-primary)">payments</span>
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Manual Payment Proofs</h3>
              <p class="text-xs text-slate-400">EFT / self-submitted payments awaiting confirmation</p>
            </div>
            <span id="pending-count-badge" class="hidden ml-1 px-2 py-0.5 text-xs font-black text-white rounded-full" style="background:var(--color-primary)">0</span>
          </div>
          <button onclick="window.loadPendingManualPayments()" class="text-xs font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors">
            <span class="material-symbols-outlined text-[14px]">refresh</span> Refresh
          </button>
        </div>
        <div id="pending-manual-payments" class="p-4 space-y-3">
          <div class="text-sm text-slate-400 py-4 text-center">Loading...</div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="glass-card p-8 rounded-2xl flex items-center justify-between relative overflow-hidden group">
            <div class="z-10">
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">Total Recoveries (MTD)</p>
                <h2 id="stat-mtd-recoveries" class="text-3xl font-black text-on-surface mt-2">R 0.00</h2>
                <p id="stat-mtd-count" class="text-xs text-green-600 font-bold mt-1 flex items-center gap-1"></p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shadow-sm z-10">
                <span class="material-symbols-outlined">payments</span>
            </div>
        </div>

        <div class="glass-card p-8 rounded-2xl flex items-center justify-between relative overflow-hidden">
            <div class="z-10">
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">Realized Profit (MTD)</p>
                <h2 id="stat-revenue-yield" class="text-3xl font-black text-indigo-900 mt-2">R 0.00</h2>
                <p class="text-xs text-indigo-400 font-bold mt-1 tracking-tight">Contractual Fees & Interest</p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm z-10">
                <span class="material-symbols-outlined">donut_large</span>
            </div>
        </div>

        <div class="glass-card p-8 rounded-2xl flex items-center justify-between relative overflow-hidden">
            <div class="z-10">
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">Active Payers</p>
                <h2 id="stat-active-payers" class="text-3xl font-black text-on-surface mt-2">0</h2>
                <p class="text-xs text-outline font-bold mt-1">Unique clients this period</p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-surface-container text-outline flex items-center justify-center shadow-sm z-10">
                <span class="material-symbols-outlined">group</span>
            </div>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        <div class="lg:w-3/4 glass-card rounded-2xl flex flex-col overflow-hidden">

            <div class="p-5 border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 class="text-lg font-headline font-bold text-on-surface uppercase tracking-tight">Recovery Detail</h3>
                    <div class="flex gap-6 mt-2">
                        <button id="tab-today"   class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${activeTab === 'today'   ? 'border-[var(--color-primary)] text-on-surface' : 'text-outline border-transparent hover:text-on-surface'}">Today</button>
                        <button id="tab-7days"   class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${activeTab === '7days'   ? 'border-[var(--color-primary)] text-on-surface' : 'text-outline border-transparent hover:text-on-surface'}">7 Days</button>
                        <button id="tab-30days"  class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${activeTab === '30days'  ? 'border-[var(--color-primary)] text-on-surface' : 'text-outline border-transparent hover:text-on-surface'}">30 Days</button>
                        <button id="tab-all"     class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${activeTab === 'all'     ? 'border-[var(--color-primary)] text-on-surface' : 'text-outline border-transparent hover:text-on-surface'}">All</button>
                        <span class="text-outline text-xs">|</span>
                        <input type="date" id="filter-date-from" class="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-orange-400 focus:outline-none" title="From date">
                        <span class="text-xs text-outline">→</span>
                        <input type="date" id="filter-date-to" class="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-orange-400 focus:outline-none" title="To date">
                    </div>
                    <div style="margin-top:6px;">
                      <button id="btn-export-payments" class="text-xs font-bold text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                        <i class="fa-solid fa-download text-xs"></i> Export CSV
                      </button>
                    </div>
                </div>
                <div class="relative flex-1 sm:w-64">
                    <input type="text" id="search-input" placeholder="Search client or ID..." 
                           class="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-orange-500 text-xs focus:bg-white transition-colors">
                    <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                </div>
            </div>

            <div class="flex-1 overflow-auto custom-scrollbar relative">
                <table class="min-w-full divide-y divide-outline-variant/10">
                    <thead class="bg-surface-container sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Date</th>
                            <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Client & ID</th>
                            <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Loan Ref</th>
                            <th class="px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-outline">Status</th>
                            <th class="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-outline">Paid In</th>
                            <th class="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-outline">Balance</th>
                        </tr>
                    </thead>
                    <tbody id="payments-table-body" class="bg-white divide-y divide-outline-variant/10">
                        <tr><td colspan="6" class="p-10 text-center text-xs text-gray-400 italic">Initializing transaction view...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div id="pagination-controls" class="border-t border-gray-100 bg-gray-50/50 p-3"></div>
        </div>

        <div class="lg:w-1/4 flex flex-col gap-6">
            
            <div class="glass-card p-8 rounded-2xl">
                <h4 class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-4">Allocation (MTD)</h4>
                
                <div class="relative w-40 h-40 mx-auto mb-6">
                    <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
                        <path class="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.8" />
                        <path id="chart-interest-ring" class="text-indigo-500 transition-all duration-1000" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.8" />
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-[10px] text-gray-400 font-bold uppercase">Profit</span>
                        <span id="chart-profit-percent" class="text-xl font-black text-gray-900">0%</span>
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Capital Back</span>
                        <span id="label-principal-split" class="text-xs font-black text-gray-900">R 0</span>
                    </div>
                    <div class="flex justify-between items-center p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                        <span class="text-[10px] font-bold text-indigo-600 uppercase">Interest/Fees</span>
                        <span id="label-interest-split" class="text-xs font-black text-indigo-900">R 0</span>
                    </div>
                    <div class="flex justify-between items-center p-2 bg-purple-50 rounded-lg border border-purple-100">
                        <span class="text-[10px] font-bold text-purple-600 uppercase">Credit/Extra</span>
                        <span id="label-overpayment-split" class="text-xs font-black text-purple-900">R 0</span>
                    </div>
                </div>
            </div>

            <div class="glass-card p-8 rounded-2xl flex-1">
                <h4 class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-4">Top Period Recoveries</h4>
                <div id="top-payments-list" class="space-y-3 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar"></div>
            </div>

        </div>
      </div>
    </div>
  `;

  attachEventListeners();
}

/**
 * Data Orchestrator
 * Pulls both raw payments (for the table) and analytics (for the metrics).
 */
async function loadData() {
  try {
    
    const [paymentsRes, analyticsRes] = await Promise.all([ 
      fetchPayments(), 
      fetchAnalyticsData() 
    ]);

    
    if (paymentsRes.error) throw paymentsRes.error;
    if (analyticsRes.error) throw analyticsRes.error;
    
    
    allPayments = paymentsRes.data || [];
    analyticsData = analyticsRes.data || [];

    
    calculateAndRenderMetrics();
    filterAndRender(true);

  } catch (error) {
    console.error("Load Error:", error);
    
 
    const errorMsg = error.message || "Unable to connect to the database. Please check your connection.";
    const tbody = document.getElementById('payments-table-body');
    
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-10 text-center text-xs text-red-500 italic border-2 border-dashed border-red-50 rounded-xl">
            <i class="fa-solid fa-triangle-exclamation mb-2 text-lg"></i><br>
            Error Loading Data: ${errorMsg}
          </td>
        </tr>`;
    }
    
    
    if (window.showToast) window.showToast("Failed to load recovery data", "error");
  }
}

/**
 * Real-time Financial Breakdown
 * Uses the waterfall data to fill cards and charts.
 */
function calculateAndRenderMetrics() {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); 

    const mtdPayments = allPayments.filter(p => (p.payment_date || p.created_at || '').startsWith(currentMonth));
    const mtdTotal = mtdPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const uniquePayers = new Set(mtdPayments.map(p => p.loan_id || p.application_id)).size;

    // Calculation using CONTRACTUAL collected fields
    const currentMonthAnalytics = analyticsData.filter(row => row.month === currentMonth);
    const profitTotal = currentMonthAnalytics.reduce((sum, row) => sum + (row.profit_collected_month || 0), 0);
    const principalTotal = currentMonthAnalytics.reduce((sum, row) => sum + (row.principal_collected_month || 0), 0);
    const extraTotal = currentMonthAnalytics.reduce((sum, row) => sum + (row.overpayment_collected_month || 0), 0);
    
    // Update DOM
    document.getElementById('stat-mtd-recoveries').textContent = formatCurrency(mtdTotal);
    document.getElementById('stat-revenue-yield').textContent = formatCurrency(profitTotal);
    document.getElementById('stat-active-payers').textContent = uniquePayers;
    document.getElementById('stat-mtd-count').innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> <span>${mtdPayments.length}</span> transactions`;

    document.getElementById('label-principal-split').textContent = formatCurrency(principalTotal);
    document.getElementById('label-interest-split').textContent = formatCurrency(profitTotal);
    document.getElementById('label-overpayment-split').textContent = formatCurrency(extraTotal);
    
    const profitPercent = mtdTotal > 0 ? Math.round((profitTotal / mtdTotal) * 100) : 0;
    document.getElementById('chart-profit-percent').textContent = `${profitPercent}%`;
    document.getElementById('chart-interest-ring').setAttribute('stroke-dasharray', `${profitPercent}, 100`);

    renderTopRecentWidget(mtdPayments.length > 0 ? mtdPayments : allPayments.slice(0, 10));
}

function renderTopRecentWidget(payments) {
    const list = document.getElementById('top-payments-list');
    if(!list) return;

    const top5 = [...payments].sort((a,b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
    if (top5.length === 0) {
        list.innerHTML = `<div class="text-center py-10 text-xs text-gray-400">No data for period</div>`;
        return;
    }

    list.innerHTML = top5.map(p => {
        const name = p.profile?.full_name || p.profiles?.full_name || 'Unknown';
        const appId = p.loan_id || p.application_id || '';
        const ref = p.loan_number || appId.slice(0,8).toUpperCase();
        return `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all cursor-pointer" onclick="window.location.href='/admin/application-detail?id=${appId}'">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-black">${name.charAt(0) || '$'}</div>
                <div>
                    <p class="text-xs font-bold text-gray-900 truncate w-24">${name}</p>
                    <p class="text-[10px] text-gray-400 font-mono">${ref}</p>
                </div>
            </div>
            <span class="text-xs font-black text-green-600">+${formatCurrency(p.amount)}</span>
        </div>`;
    }).join('');
}

/**
 * Filter & Table Logic
 * Handles Balance States: Overpaid, Complete, Partial
 */
function getFilteredPayments() {
    let filtered = allPayments;
    if (activeTab === 'today') {
        const today = new Date().toISOString().slice(0,10);
        filtered = filtered.filter(p => p.payment_date?.slice(0,10) === today);
    } else if (activeTab === '7days') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        filtered = filtered.filter(p => new Date(p.payment_date) >= d);
    } else if (activeTab === '30days') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        filtered = filtered.filter(p => new Date(p.payment_date) >= d);
    } else if (activeTab === 'custom') {
        const from = document.getElementById('filter-date-from')?.value;
        const to   = document.getElementById('filter-date-to')?.value;
        if (from) filtered = filtered.filter(p => p.payment_date?.slice(0,10) >= from);
        if (to)   filtered = filtered.filter(p => p.payment_date?.slice(0,10) <= to);
    }
    const s = (document.getElementById('search-input')?.value || '').toLowerCase();
    if (s) filtered = filtered.filter(p =>
        (p.profile?.full_name || p.profiles?.full_name || '').toLowerCase().includes(s) ||
        (p.reference || '').toLowerCase().includes(s) ||
        (p.loan_number || '').toLowerCase().includes(s)
    );
    return filtered;
}

function filterAndRender(resetPage = true) {
    if (resetPage) currentPage = 1;
    
    let filtered = allPayments;
    
    if (activeTab === 'today') {
        const today = new Date().toISOString().slice(0,10);
        filtered = filtered.filter(p => p.payment_date?.slice(0,10) === today);
    } else if (activeTab === '7days') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        filtered = filtered.filter(p => new Date(p.payment_date) >= d);
    } else if (activeTab === '30days') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        filtered = filtered.filter(p => new Date(p.payment_date) >= d);
    } else if (activeTab === 'custom') {
        const from = document.getElementById('filter-date-from')?.value;
        const to   = document.getElementById('filter-date-to')?.value;
        if (from) filtered = filtered.filter(p => p.payment_date?.slice(0,10) >= from);
        if (to)   filtered = filtered.filter(p => p.payment_date?.slice(0,10) <= to);
    }

    const term = searchTerm.toLowerCase();
    if (term) {
        filtered = filtered.filter(p =>
            (p.profile?.full_name || p.profiles?.full_name || '').toLowerCase().includes(term) ||
            (p.reference || '').toLowerCase().includes(term) ||
            String(p.id).includes(term) ||
            String(p.loan_id || p.application_id || '').includes(term) ||
            (p.loan_number || '').toLowerCase().includes(term)
        );
    }
    
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);
    
    const tbody = document.getElementById('payments-table-body');
    if(tbody) {
        if (paginated.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-xs text-gray-400 italic">No transactions found.</td></tr>`;
        } else {
            tbody.innerHTML = paginated.map(p => {
                // CONTRACTUAL LOGIC: Handle Balance & Installment
                const balance = p.loan?.outstanding_balance || 0;
                const monthlyRequired = p.loan?.application?.offer_monthly_repayment || 0;
                const amountPaid = Number(p.amount);
                
                let balanceHtml = '';
                let statusHtml = '';

                // Identify Overpaid/Settled/Partial
                if (balance < -1) { 
                    balanceHtml = `<span class="text-[10px] font-bold px-2 py-1 rounded bg-purple-50 text-purple-700 uppercase">Credit: ${formatCurrency(Math.abs(balance))}</span>`;
                    statusHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Overpaid</span>`;
                } else if (balance <= 1) { 
                    balanceHtml = `<span class="text-[10px] font-bold px-2 py-1 rounded bg-green-50 text-green-700 uppercase tracking-tighter">Fully Settled</span>`;
                    statusHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">Complete</span>`;
                } else { 
                    balanceHtml = `<span class="text-[10px] font-bold px-2 py-1 rounded bg-red-50 text-red-700 uppercase tracking-tighter">Due: ${formatCurrency(balance)}</span>`;
                    // Highlight if they underpaid the MONTHLY commitment
                    statusHtml = (amountPaid < monthlyRequired) 
                        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">Partial</span>`
                        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">On Track</span>`;
                }

                const clientName = p.profile?.full_name || p.profiles?.full_name || 'Unknown';
                const appId = p.loan_id || p.application_id || '';
                const loanRef = p.loan_number || (appId ? appId.slice(0,8).toUpperCase() : '—');
                return `
                <tr class="hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0">
                    <td class="px-6 py-4 text-xs text-gray-500 font-medium whitespace-nowrap">${formatDate(p.payment_date || p.created_at)}</td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col">
                            <span class="text-xs font-bold text-gray-900">${clientName}</span>
                            <span class="text-[10px] text-gray-400 font-mono tracking-tighter">${p.reference || ('REF-' + p.id?.slice(0,8).toUpperCase())}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <a href="/admin/application-detail?id=${appId}" class="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100">
                            ${loanRef}
                        </a>
                    </td>
                    <td class="px-6 py-4 text-center">${statusHtml}</td>
                    <td class="px-6 py-4 text-right">
                        <span class="text-xs font-black text-gray-900">+ ${formatCurrency(p.amount)}</span>
                    </td>
                    <td class="px-6 py-4 text-right">${balanceHtml}</td>
                </tr>`;
            }).join('');
        }
    }
    
    renderPaginationControls(filtered.length);
}

function renderPaginationControls(totalRecords) {
    const controls = document.getElementById('pagination-controls');
    if(!controls) return;
    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

    controls.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Page ${currentPage} of ${totalPages}</span>
            <div class="flex gap-2">
                <button onclick="window.changePageRecovery(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all text-gray-700">Prev</button>
                <button onclick="window.changePageRecovery(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all text-gray-700">Next</button>
            </div>
        </div>`;
}

function attachEventListeners() {
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchTerm = e.target.value.trim();
        filterAndRender(true);
    });

    const setTab = (tab) => { activeTab = tab; filterAndRender(true); };
    document.getElementById('tab-today')?.addEventListener('click',  () => setTab('today'));
    document.getElementById('tab-7days')?.addEventListener('click',  () => setTab('7days'));
    document.getElementById('tab-30days')?.addEventListener('click', () => setTab('30days'));
    document.getElementById('tab-all')?.addEventListener('click',    () => setTab('all'));

    // Custom date range
    document.getElementById('filter-date-from')?.addEventListener('change', () => { activeTab = 'custom'; filterAndRender(true); });
    document.getElementById('filter-date-to')?.addEventListener('change',   () => { activeTab = 'custom'; filterAndRender(true); });

    // Export filtered payments as CSV
    document.getElementById('btn-export-payments')?.addEventListener('click', exportPaymentsCSV);
}

function exportPaymentsCSV() {
    const visible = getFilteredPayments();
    if (!visible.length) { alert('No payments to export for this period.'); return; }
    const headers = ['Date', 'Client', 'ID Number', 'Reference', 'Loan Ref', 'Amount Paid', 'Type', 'Method'];
    const rows = visible.map(p => [
        (p.payment_date || p.created_at || '').slice(0,10),
        `"${(p.profile?.full_name || p.profiles?.full_name || '').replace(/"/g,'""')}"`,
        p.profile?.identity_number || p.profiles?.identity_number || '',
        p.reference || p.id || '',
        p.loan_number || (p.loan_id || p.application_id || '').toString().slice(0,8),
        p.amount || 0,
        p.payment_type || p.status || '',
        p.payment_method || 'Manual EFT'
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `incoming_payments_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

window.changePageRecovery = (p) => {
    currentPage = p;
    filterAndRender(false);
};

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await initLayout();
  if (auth) {
      renderPageContent();
      await Promise.all([
        loadData(),
        loadPendingManualPayments()
      ]);
  }
});

// Expose for refresh button
window.loadPendingManualPayments = loadPendingManualPayments;

// ── Admin Record Payment (with back-date) ─────────────────────────
window.toggleRecordPaymentForm = () => {
    const form = document.getElementById('record-payment-form');
    if (form) form.classList.toggle('hidden');
};

window.submitAdminPayment = async () => {
    const appIdRaw  = document.getElementById('rp-app-id')?.value.trim();
    const amount    = parseFloat(document.getElementById('rp-amount')?.value || '0');
    const payDate   = document.getElementById('rp-date')?.value;
    const payType   = document.getElementById('rp-type')?.value || 'installment';
    const ref       = document.getElementById('rp-ref')?.value.trim();
    const notes     = document.getElementById('rp-notes')?.value.trim();
    const feedback  = document.getElementById('rp-feedback');

    const showRpFeedback = (msg, type) => {
        if (!feedback) return;
        feedback.className = `mt-3 p-3 rounded-xl text-sm font-semibold ${type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`;
        feedback.textContent = msg;
        feedback.classList.remove('hidden');
    };

    if (!appIdRaw || !amount || amount <= 0 || !payDate) {
        return showRpFeedback('Please fill in the Loan ID, amount, and date.', 'error');
    }

    try {
        // Try to find application by loan_number or ID
        let appId = appIdRaw;
        const { data: found } = await supabase.from('loan_applications')
            .select('id, user_id, loan_number, profiles:user_id(full_name)')
            .or(`id.eq.${appIdRaw},loan_number.eq.${appIdRaw}`)
            .maybeSingle();

        if (!found) return showRpFeedback('Application not found. Check the loan number or ID.', 'error');
        appId = found.id;

        const reference = ref || `ADM-${Date.now().toString(36).toUpperCase()}`;
        // payment_type must be one of: partial, settlement, arrears
        const validType = ['settlement','arrears','partial'].includes(payType) ? payType : 'partial';
        const { error } = await supabase.from('manual_payments').insert([{
            application_id: Number(appId),
            user_id:        found.user_id,
            amount,
            payment_type:   validType,
            reference,
            notes:          notes ? `${notes} (date: ${payDate})` : `Payment date: ${payDate}`,
            status:         'confirmed',
            confirmed_at:   new Date().toISOString()
        }]);
        if (error) throw error;

        // Post to cash ledger
        await supabase.from('cash_journal').insert([{
            entry_date:      payDate,
            entry_type:      'cash_in',
            category:        payType === 'settlement' ? 'settlement' : 'repayment',
            description:     `Admin-recorded ${payType} from ${found.profiles?.full_name || 'Client'} — Ref: ${reference}`,
            reference,
            amount,
            application_id:  String(appId),
            created_by_name: 'Admin (manual entry)'
        }]);

        // Decrement loan balance
        const { data: loan } = await supabase.from('loans').select('id, outstanding_balance')
            .eq('application_id', appId).maybeSingle();
        if (loan) {
            const newBal = payType === 'settlement' ? 0 : Math.max(0, Number(loan.outstanding_balance || 0) - amount);
            await supabase.from('loans').update({ outstanding_balance: newBal, updated_at: new Date().toISOString() }).eq('id', loan.id);
            if (payType === 'settlement') {
                await supabase.from('loan_applications').update({ status: 'SETTLED', updated_at: new Date().toISOString() }).eq('id', appId);
            }
        }

        showRpFeedback(`✓ Payment of R${amount.toFixed(2)} recorded for ${found.profiles?.full_name || appIdRaw} (${payDate}).`, 'success');
        document.getElementById('rp-app-id').value = '';
        document.getElementById('rp-amount').value = '';
        document.getElementById('rp-ref').value = '';
        document.getElementById('rp-notes').value = '';
        document.getElementById('rp-date').value = new Date().toISOString().slice(0, 10);
        await Promise.all([loadData(), loadPendingManualPayments()]);
    } catch (err) {
        showRpFeedback('Error: ' + err.message, 'error');
    }
};