import { initLayout } from '../shared/layout.js';
import { fetchUsers, fetchBranches, claimClientProtocol, getCurrentAdminProfile, fetchFullUserProfile } from '../services/dataService.js';
import { supabase } from '../services/supabaseClient.js'; 
import { formatDate, formatCurrency, validateSAID } from '../shared/utils.js';
import { renderProfileCard } from '../components/profile-card.js';

// --- STATE ---
let allUsers = [];
let branches = [];
let currentAdmin = null;
let currentUserDetail = null;
let currentPageUsers = 1;
const itemsPerPageUsers = 20;

// Filters
let searchFilter = '';
let branchFilter = 'all';
let roleFilter = 'all';

// --- TEMPLATES ---

const LIST_VIEW_HTML = `
<div id="view-list" class="flex flex-col h-full animate-fade-in">

  <!-- Header -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4 shrink-0">
    <div>
      <h1 class="text-2xl font-headline font-bold text-on-surface tracking-tight">Users</h1>
      <p class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-outline">Clients · Staff · Admins</p>
    </div>
    <div class="flex items-center gap-3">
      <button id="btn-invite-staff"
        class="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5"
        style="background:var(--color-primary)">
        <span class="material-symbols-outlined text-[16px]">person_add</span> Invite Staff
      </button>
    </div>
  </div>

  <!-- Tabs: Clients | Staff -->
  <div class="flex items-center gap-1 mb-5 bg-gray-100 rounded-2xl p-1 w-fit shrink-0">
    <button id="tab-clients" onclick="window.switchUserTab('clients')"
      class="user-tab-btn px-5 py-2 rounded-xl text-sm font-bold transition-all bg-white shadow-sm text-on-surface">
      Clients
    </button>
    <button id="tab-staff" onclick="window.switchUserTab('staff')"
      class="user-tab-btn px-5 py-2 rounded-xl text-sm font-bold transition-all text-outline hover:text-on-surface">
      Staff &amp; Admins
    </button>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3 mb-5 shrink-0">
    <select id="branch-filter" class="bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-xl text-sm font-semibold focus:outline-none shadow-sm">
      <option value="all">All Branches</option>
      <option disabled>Loading...</option>
    </select>
    <div class="relative flex-1 min-w-[200px]">
      <input type="text" id="user-search" placeholder="Search name, email, ID number..."
        class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none shadow-sm bg-white">
      <span class="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-[16px]">search</span>
    </div>
  </div>

  <div class="glass-card rounded-2xl flex flex-col overflow-hidden flex-1 min-h-0">
    <div class="overflow-auto custom-scrollbar"> 
      <table class="min-w-full divide-y divide-slate-50 relative">
        <thead class="bg-white sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"> 
          <tr>
            <th class="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</th>
            <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Key</th>
            <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</th>
            <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance</th>
            <th class="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
          </tr>
        </thead>
        <tbody id="users-table-body" class="bg-white divide-y divide-slate-50">
          <tr><td colspan="5" class="p-20 text-center text-slate-300 font-bold">Initialising Directory...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="mt-4 flex justify-between items-center px-2">
    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry <span id="visible-count">0</span></div>
    <div id="user-pagination-container"></div>
  </div>
</div>
`;

const DETAIL_VIEW_HTML = `
<div id="view-detail" class="hidden flex flex-col h-full animate-fade-in bg-gray-50 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between mb-6">
        <button onclick="window.switchView('list')" class="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium transition-colors">
            <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <i class="fa-solid fa-arrow-left"></i>
            </div>
            Back to Directory
        </button>
        <div class="flex gap-2">
            <button id="btn-transfer-branch" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 shadow-sm">
                <i class="fa-solid fa-building-columns mr-2 text-[#a04100]"></i> Transfer Branch
            </button>
        </div>
    </div>

    <div class="grid grid-cols-12 gap-8 h-full overflow-hidden">
        
        <div id="profile-card-container" class="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">
            <!-- Profile Card Injected Here -->
        </div>

        <div class="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">

            <div class="glass-card p-6 rounded-2xl">
                <h3 class="text-sm font-semibold uppercase tracking-widest text-outline mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span> Financial Snapshot
                </h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-surface-container p-3 rounded-xl">
                        <p class="text-[10px] text-outline uppercase">Gross Income</p>
                        <p id="detail-income" class="text-sm font-bold text-on-surface">-</p>
                    </div>
                    <div class="bg-surface-container p-3 rounded-xl">
                        <p class="text-[10px] text-outline uppercase">Expenses</p>
                        <p id="detail-expenses" class="text-sm font-bold text-on-surface">-</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">
            
            <div class="grid grid-cols-3 gap-4">
                <div class="glass-card p-4 rounded-2xl">
                    <div class="text-[10px] font-semibold uppercase tracking-widest text-outline">Total Loans</div>
                    <div id="stat-total-loans" class="text-2xl font-extrabold text-on-surface mt-1">0</div>
                </div>
                <div class="glass-card p-4 rounded-2xl">
                    <div class="text-[10px] font-semibold uppercase tracking-widest text-outline">Active Debt</div>
                    <div id="stat-active-debt" class="text-2xl font-extrabold mt-1" style="color:var(--color-primary)">R 0.00</div>
                </div>
                <div class="glass-card p-4 rounded-2xl">
                    <div class="text-[10px] font-semibold uppercase tracking-widest text-outline">Uploaded Docs</div>
                    <div id="stat-total-docs" class="text-2xl font-extrabold text-blue-600 mt-1">0</div>
                </div>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
                    <h3 class="font-headline font-bold text-on-surface">Application History</h3>
                    <span class="text-[11px] font-semibold uppercase tracking-widest text-outline">Most recent first</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-outline-variant/10">
                        <thead class="bg-surface-container">
                            <tr>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">ID</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Date</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Amount</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Status</th>
                                <th class="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-outline">Action</th>
                            </tr>
                        </thead>
                        <tbody id="detail-loans-body" class="bg-white divide-y divide-outline-variant/10">
                            </tbody>
                    </table>
                </div>
            </div>

            <div class="glass-card p-6 rounded-2xl">
                 <h3 class="font-headline font-bold text-on-surface mb-4">Uploaded Documents</h3>
                 <div id="detail-docs-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    </div>
            </div>

        </div>
    </div>
</div>

<div id="branch-modal" class="hidden fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center backdrop-blur-sm">
    <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4 animate-scale-in">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Transfer User Branch</h3>
        <p class="text-sm text-gray-500 mb-4">Select the new branch for <span id="modal-username" class="font-bold text-gray-800"></span>.</p>
        
        <select id="modal-branch-select" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm mb-6 focus:ring-orange-500"></select>
        
        <div class="flex justify-end gap-3">
            <button onclick="document.getElementById('branch-modal').classList.add('hidden')" class="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button id="btn-confirm-transfer" onclick="window.confirmBranchTransfer()" class="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm" style="background:var(--color-primary)">Confirm Transfer</button>
        </div>
    </div>
</div>
`;

// --- HELPER FUNCTIONS ---

const isStaff = (role) => ['admin', 'super_admin', 'base_admin'].includes(role);

const getRoleLabel = (role) => {
    const roles = { 'super_admin': 'SUPER ADMIN', 'admin': 'BRANCH MANAGER', 'base_admin': 'LOAN OFFICER' };
    return roles[role] || 'CLIENT';
};

const getStatusBadge = (status) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    let color = 'bg-gray-100 text-gray-600';
    if(s === 'DISBURSED') color = 'bg-green-100 text-green-700';
    if(s === 'DECLINED') color = 'bg-red-100 text-red-700';
    if(['STARTED', 'SUBMITTED'].includes(s)) color = 'bg-blue-50 text-blue-700';
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${color}">${s}</span>`;
};

// --- CORE LOGIC ---

window.switchView = (viewName) => {
    const list = document.getElementById('view-list');
    const detail = document.getElementById('view-detail');
    
    if (viewName === 'detail') {
        list.classList.add('hidden');
        detail.classList.remove('hidden');
    } else {
        list.classList.remove('hidden');
        detail.classList.add('hidden');
        currentUserDetail = null; // Clear memory
    }
};

window.openUserDetail = async (userId) => {
    try {
        document.body.style.cursor = 'wait';
        const data = await fetchFullUserProfile(userId);
        if (!data?.profile) throw new Error('Profile not found for this user.');
        currentUserDetail = data;

        const p = data.profile;
        const isLuhnValid = validateSAID(p?.identity_number || p?.id_number);
        
        // Inject Premium Profile Card
        const container = document.getElementById('profile-card-container');
        if (container) container.innerHTML = renderProfileCard(p, { isLuhnValid });
        
        // Financials — safe setters (elements may not be in DOM yet on first render)
        const fins = data.financials || {};
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setText('detail-income',    formatCurrency(fins.monthly_income   || 0));
        setText('detail-expenses',  formatCurrency(fins.monthly_expenses  || 0));
        setText('stat-total-loans', data.loans.length);
        setText('stat-total-docs',  data.documents.length);

        const activeDebt = data.loans
            .filter(l => ['DISBURSED', 'ACTIVE'].includes(l.status))
            .reduce((sum, l) => sum + Number(l.amount), 0);
        setText('stat-active-debt', formatCurrency(activeDebt));

        // Render Loans Table
        const loanBody = document.getElementById('detail-loans-body');
        if (!loanBody) console.warn('[users] #detail-loans-body not found in DOM');
        if (loanBody && data.loans.length === 0) {
            loanBody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-xs font-bold text-slate-300">No applications found.</td></tr>`;
        } else if (loanBody) {
            loanBody.innerHTML = data.loans.map(l => `
                <tr class="hover:bg-slate-50 transition-colors cursor-pointer group" onclick="window.location.href='/admin/application-detail?id=${l.id}'">
                    <td class="px-8 py-5 text-[10px] font-black text-slate-400 font-mono">#${String(l.id).substring(0, 8)}</td>
                    <td class="px-6 py-5 text-xs font-bold text-slate-600">${formatDate(l.created_at)}</td>
                    <td class="px-6 py-5 text-sm font-black text-slate-900">${formatCurrency(l.amount)}</td>
                    <td class="px-6 py-5">${getStatusBadge(l.status)}</td>
                    <td class="px-8 py-5 text-right">
                        <span class="material-symbols-outlined text-slate-300 group-hover:text-[#a04100] transition-colors">chevron_right</span>
                    </td>
                </tr>
            `).join('');
        }

        // Render Docs Grid
        const docGrid = document.getElementById('detail-docs-grid');
        if (!docGrid) console.warn('[users] #detail-docs-grid not found in DOM');
        if (docGrid && data.documents.length === 0) {
            docGrid.innerHTML = `<div class="col-span-3 text-center text-[10px] font-black text-slate-400 py-8 border-2 border-dashed border-slate-50 rounded-3xl">No documents found</div>`;
        } else if (docGrid) {
            docGrid.innerHTML = data.documents.map(d => `
                <div class="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/20 transition-all group">
                    <div class="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-[#a04100] shadow-sm">
                        <span class="material-symbols-outlined">description</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-black text-slate-900 truncate" title="${d.file_name}">${d.file_name}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${d.file_type || 'DOC'}</p>
                    </div>
                    <a href="${d.file_path}" target="_blank" class="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-[#a04100] transition-all"><span class="material-symbols-outlined text-[20px]">download</span></a>
                </div>
            `).join('');
        }

        const btnTransfer = document.getElementById('btn-transfer-branch');
        if (btnTransfer) btnTransfer.onclick = () => window.openBranchModal();

        window.switchView('detail');

    } catch (error) {
        console.error("Detail Error:", error?.message || error);
        alert(`Could not load user details: ${error?.message || 'Unknown error — check console'}`);
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.openBranchModal = () => {
    if(!currentUserDetail) return;
    const p = currentUserDetail.profile;
    
    document.getElementById('modal-username').textContent = p.full_name;
    const select = document.getElementById('modal-branch-select');
    
    select.innerHTML = '<option value="online">Online / Unassigned</option>';
    branches.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id;
        option.textContent = b.name;
        if(p.branch_id === b.id) option.selected = true;
        select.appendChild(option);
    });

    document.getElementById('branch-modal').classList.remove('hidden');
};

window.confirmBranchTransfer = async () => {
    const btn = document.getElementById('btn-confirm-transfer');
    const newBranchId = document.getElementById('modal-branch-select').value;
    const p = currentUserDetail.profile;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Moving...';

        const updateValue = (newBranchId === 'online' || !newBranchId) ? null : parseInt(newBranchId, 10);

        // 1. Update Profile
        const { error } = await supabase.from('profiles').update({ branch_id: updateValue }).eq('id', p.id);
        if (error) throw error;

        // 2. Update Loans
        await supabase.from('loan_applications').update({ branch_id: updateValue }).eq('user_id', p.id);

        alert('Success! User transferred.');
        document.getElementById('branch-modal').classList.add('hidden');
        window.location.reload(); 

    } catch (err) {
        alert('Transfer failed: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Confirm Transfer';
    }
};

// --- LIST RENDERER ---

const renderUserList = (data) => {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    const start = (currentPageUsers - 1) * itemsPerPageUsers;
    const paginatedData = data.slice(start, start + itemsPerPageUsers);

    if (paginatedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-20 text-center text-slate-300 font-bold">No results matching your query.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginatedData.map(u => {
        const branchName = u.branches?.name || 'Online';
        const isLuhnValid = validateSAID(u.identity_number || u.id_number);
        
        return `
        <tr class="hover:bg-slate-50/50 transition-colors group cursor-pointer" onclick="window.openUserDetail('${u.id}')">
            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-400">
                        ${(u.full_name || 'U').charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-black text-slate-900">${u.full_name || 'Unknown'}</div>
                        <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${getRoleLabel(u.role)}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-6">
                <div class="text-[10px] font-black text-slate-500 font-mono tracking-tighter">
                    ${u.id.substring(0, 13).toUpperCase()}
                </div>
            </td>
            <td class="px-6 py-6">
                 <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                    ${branchName}
                 </span>
            </td>
            <td class="px-6 py-6">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full ${isLuhnValid ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                        <span class="text-[10px] font-black uppercase tracking-widest ${isLuhnValid ? 'text-emerald-600' : 'text-red-600'}">
                            ${isLuhnValid ? 'ID Valid' : 'ID Invalid'}
                        </span>
                    </div>
                    ${u.employer_verified ? '<div class="text-[10px] font-bold text-blue-600 flex items-center gap-1"><span>✓</span> Employer verified</div>' : ''}
                    ${u.credit_limit_override ? `<div class="text-[10px] font-bold text-orange-600">Cap: R${Number(u.credit_limit_override).toLocaleString('en-ZA')}</div>` : ''}
                    ${u.last_active_at ? `<div class="text-[9px] text-slate-400">Active: ${new Date(u.last_active_at).toLocaleDateString('en-ZA')}</div>` : ''}
                </div>
            </td>
            <td class="px-8 py-6 text-right">
                <button class="w-10 h-10 flex items-center justify-center text-slate-300 group-hover:text-[#a04100] transition-colors">
                    <span class="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
            </td>
        </tr>`;
    }).join('');

    const countEl = document.getElementById('visible-count');
    if (countEl) countEl.textContent = data.length;

    renderUserPaginationControls(Math.ceil(data.length / itemsPerPageUsers) || 1);
};

// ✅ FIXED: applyFilters now handles page resets correctly
const applyFilters = (resetPage = true) => {
    if (resetPage) currentPageUsers = 1;

    const term   = (document.getElementById('user-search')?.value   || '').toLowerCase();
    const role   = document.getElementById('role-filter')?.value   || roleFilter || 'client';
    const branch = document.getElementById('branch-filter')?.value || 'all';

    const filtered = allUsers.filter(u => {
        // Search: Name, Email, ID Number, or UUID
        const textMatch = !term || 
            (u.full_name || '').toLowerCase().includes(term) ||
            (u.email || '').toLowerCase().includes(term) ||
            (u.identity_number || '').includes(term) ||
            (u.id || '').includes(term); 

        // Role Filter
        const isUserStaff = isStaff(u.role);
        let roleMatch = true;
        if(role === 'client') roleMatch = !isUserStaff;
        if(role === 'staff') roleMatch = isUserStaff;

        // Branch Filter
        const branchMatch = (branch === 'all') || (u.branch_id?.toString() === branch) || (branch === 'online' && !u.branch_id);

        return textMatch && roleMatch && branchMatch;
    });

    renderUserList(filtered);
};

// --- INIT ---

// ── Invite Staff Modal ──────────────────────────────────────────
function injectInviteModal(branches) {
    if (document.getElementById('invite-staff-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'invite-staff-modal';
    modal.className = 'hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Invite Staff Member</h3>
            <p class="text-xs text-gray-500 mt-0.5">Creates a login account and profile immediately.</p>
          </div>
          <button onclick="document.getElementById('invite-staff-modal').classList.add('hidden')"
            class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <div id="invite-error" class="hidden mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium"></div>
        <div id="invite-success" class="hidden mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium"></div>

        <form id="invite-form" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Full Name *</label>
              <input name="full_name" type="text" required placeholder="Jane Smith"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Email Address *</label>
              <input name="email" type="email" required placeholder="jane@company.co.za"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Role *</label>
              <select name="role" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                <option value="base_admin">Loan Officer</option>
                <option value="admin">Branch Manager</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Branch</label>
              <select name="branch_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                <option value="">No branch</option>
                ${branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Temporary Password *</label>
              <input name="password" type="password" required placeholder="Min 8 characters" minlength="8"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
              <p class="text-xs text-gray-400 mt-1">Staff member should change this on first login.</p>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button" onclick="document.getElementById('invite-staff-modal').classList.add('hidden')"
              class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
            <button type="submit" id="invite-submit-btn"
              class="flex-1 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              style="background:var(--color-primary)">Send Invite</button>
          </div>
        </form>
      </div>`;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', () => modal.classList.add('hidden'));

    // Submit handler
    document.getElementById('invite-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('invite-submit-btn');
        const errEl = document.getElementById('invite-error');
        const okEl  = document.getElementById('invite-success');
        errEl.classList.add('hidden');
        okEl.classList.add('hidden');
        btn.textContent = 'Inviting…'; btn.disabled = true;

        try {
            const fd = new FormData(e.target);
            const body = Object.fromEntries(fd);
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/invite-staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed');

            okEl.textContent = `✓ ${body.full_name} has been invited and can now log in.`;
            okEl.classList.remove('hidden');
            e.target.reset();
            // Refresh user list
            setTimeout(() => { modal.classList.add('hidden'); window.location.reload(); }, 2000);
        } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
        } finally {
            btn.textContent = 'Send Invite'; btn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout();
  
  // Inject Main Views
  const main = document.getElementById('main-content');
  main.innerHTML = LIST_VIEW_HTML + DETAIL_VIEW_HTML;
  main.className = 'flex-1 p-4 sm:p-6 lg:p-8 h-screen overflow-hidden flex flex-col'; 

  try {
      const [admin, usersData, branchesResult] = await Promise.all([
          getCurrentAdminProfile(),
          fetchUsers(),
          fetchBranches()
      ]);

      currentAdmin = admin;
      allUsers = usersData;
      branches = branchesResult.data || [];

      // Populate Branch Filters
      const branchSelect = document.getElementById('branch-filter');
      branchSelect.innerHTML = '<option value="all">All Branches</option><option value="online">Online / Unassigned</option>';
      branches.forEach(b => branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`);

      // Role is now controlled by tabs, not a select dropdown
      // Default to clients tab on load
      applyFilters(true);

      // Event Listeners
      document.getElementById('user-search').addEventListener('input', () => applyFilters(true));
      document.getElementById('branch-filter').addEventListener('change', () => applyFilters(true));

      // Tab switching
      window.switchUserTab = (tab) => {
          roleFilter = tab === 'staff' ? 'staff' : 'client';
          document.querySelectorAll('.user-tab-btn').forEach(b => {
              const isActive = b.id === `tab-${tab}`;
              b.classList.toggle('bg-white', isActive);
              b.classList.toggle('shadow-sm', isActive);
              b.classList.toggle('text-on-surface', isActive);
              b.classList.toggle('text-outline', !isActive);
          });
          applyFilters(true);
      };
      // Default to clients tab
      window.switchUserTab('clients');

      // Invite staff modal
      injectInviteModal(branchesResult.data || []);
      document.getElementById('btn-invite-staff')?.addEventListener('click', () => {
          document.getElementById('invite-staff-modal')?.classList.remove('hidden');
      });

  } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load directory: ${err.message}</div>`;
  }
});

function renderUserPaginationControls(totalPages) {
    let container = document.getElementById('user-pagination-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'user-pagination-container';
        container.className = 'flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50';
        document.getElementById('view-list').appendChild(container);
    }

    if (totalPages <= 1) {
        container.innerHTML = `<span class="text-xs text-gray-400">Showing all users</span>`;
        return;
    }

    container.innerHTML = `
        <span class="text-xs font-bold text-gray-500 uppercase tracking-tight">Page ${currentPageUsers} of ${totalPages}</span>
        <div class="flex gap-2">
            <button onclick="window.changePageUsers(${currentPageUsers - 1})" ${currentPageUsers === 1 ? 'disabled' : ''} class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">Prev</button>
            <button onclick="window.changePageUsers(${currentPageUsers + 1})" ${currentPageUsers === totalPages ? 'disabled' : ''} class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">Next</button>
        </div>
    `;
}

// Global function to switch pages
window.changePageUsers = (page) => {
    currentPageUsers = page;
    applyFilters(false); 
};