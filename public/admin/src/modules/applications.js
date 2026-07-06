// src/modules/applications.js
import { initLayout, getRole } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';
import {
  fetchLoanApplications,
  syncAllOfferedApplications,
  createWalkInClient,
  fetchBranches,
  getCurrentAdminProfile
} from '../services/dataService.js';
import { formatCurrency, formatDate, STATUS_DISPLAY } from '../shared/utils.js';
const getStatusDisplay = (s) => STATUS_DISPLAY[s] || { label: s, color: '#6b7280', bg: '#f3f4f6' };

// --- CONFIGURATION ---
const USER_PORTAL_URL = 'https://zw-express-6ulf9yybu-mps-projects-81dea2b0.vercel.app';

// Universal branch codes — must match public/user-portal/pages-js/documents.js BRANCH_CODES.
// Freeform branch code entry caused invalid codes (e.g. "1021" for Standard Bank, which should
// be "051001") to reach SureSystems mandate requests and get rejected.
const BANK_BRANCH_CODES = {
  'FNB': '250655',
  'Standard Bank': '051001',
  'ABSA': '632005',
  'Nedbank': '198765',
  'Capitec': '470010',
  'Investec': '580105',
  'TymeBank': '678910',
  'Discovery Bank': '679000',
  'African Bank': '430000',
};

const ALL_STATUSES = [
  'STARTED',
  'BUREAU_CHECKING',
  'BUREAU_OK',
  'BUREAU_REFER',
  'BUREAU_DECLINE',
  'BANK_LINKING',
  'AFFORD_OK',
  'AFFORD_REFER',
  'AFFORD_FAIL',
  'OFFERED',
  'OFFER_ACCEPTED',
  'CONTRACT_SIGN',
  'DEBICHECK_AUTH',
  'APPROVED',
  'DISBURSED',
  'DECLINED',
  'ERROR'
];

// --- State ---
let allApplications = [];
let filteredApplications = [];
let userRole = 'borrower';
let currentAdminProfile = null;
let branches = [];
let searchTerm = '';
let statusFilter = 'all';
let currentPageApps = 1;
const itemsPerPageApps = 20;

let inBranchState = {
  active: false,
  step: 1,
  targetUser: null,
  loanHistoryCount: 0,
  loanConfig: {
    amount: 1000,
    period: 1,
    startDate: null,
    reason: 'Personal Loan',
    maxAllowedPeriod: 1,
    interestRate: 0.20
  },
  documents: {
    idcard: 'pending',
    till_slip: 'pending',
    bank_statement: 'pending'
  },
  creditCheck: {
      applicationId: null,
      status: 'pending',
      score: null
  }
};



// --- Credit Check Globals ---
const CREDIT_MODAL_ID = 'admin-credit-check-modal';
let creditModalInitialized = false;
let latestCreditZipData = null;

// --- Toast Notification Helper ---
function showToast(message, type = 'success') {

    
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    
    // Colors based on type
    let colors = 'bg-gray-900 text-white'; // Default
    let icon = '<i class="fa-solid fa-circle-check"></i>';
    
    if (type === 'error') {
        colors = 'bg-red-600 text-white';
        icon = '<i class="fa-solid fa-circle-xmark"></i>';
    } else if (type === 'warning') {
        colors = 'bg-orange-500 text-white';
        icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    }

    toast.className = `${colors} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full pointer-events-auto`;
    toast.innerHTML = `${icon}<span class="text-sm font-medium">${message}</span>`;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.remove('translate-x-full'));
    
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Status Colors ---
const getBadgeColor = (status) => {
  switch (status) {
    case 'DISBURSED': 
    case 'APPROVED': 
    case 'AFFORD_OK': 
    case 'BUREAU_OK': 
        return 'bg-green-100 text-green-800';
    case 'DECLINED': 
    case 'AFFORD_FAIL': 
    case 'BUREAU_DECLINE': 
    case 'ERROR': 
        return 'bg-red-100 text-red-800';
    case 'STARTED': 
    case 'BUREAU_CHECKING': 
    case 'BANK_LINKING': 
    case 'OFFER_ACCEPTED': 
    case 'CONTRACT_SIGN': 
    case 'DEBICHECK_AUTH': 
        return 'bg-blue-100 text-blue-800';
    case 'OFFERED': 
    case 'BUREAU_REFER': 
    case 'AFFORD_REFER': 
        return 'bg-yellow-100 text-yellow-800';
    default: 
        return 'bg-gray-100 text-gray-800';
  }
};

// ==========================================
//   CREDIT CHECK MODAL LOGIC (ADMIN)
// ==========================================

function setupCreditCheckModal() {
    if (creditModalInitialized) return;
    
    const modalHtml = `
        <div id="${CREDIT_MODAL_ID}" class="hidden fixed inset-0 bg-black/70 z-[1000] items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="flex items-start justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 class="text-xl font-semibold text-gray-900">Run Credit Check</h2>
                        <p class="text-sm text-gray-500">Powered by Experian SOAP Integration</p>
                    </div>
                    <button id="credit-check-close" class="text-3xl leading-none text-gray-400 hover:text-gray-700">&times;</button>
                </div>
                <div class="px-6 py-4 space-y-4">
                    <div id="credit-form-content" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Personal Information</h3>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ID Number <span class="text-red-500">*</span></label>
                                <input type="text" id="identity_number" maxlength="13" class="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:ring-brand-accent">
                                
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Surname <span class="text-red-500">*</span></label>
                                        <input type="text" id="surname" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">First Name <span class="text-red-500">*</span></label>
                                        <input type="text" id="forename" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                    </div>
                                </div>
                                
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Gender <span class="text-red-500">*</span></label>
                                        <select id="gender" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                            <option value="">Select</option>
                                            <option value="M">Male</option>
                                            <option value="F">Female</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span class="text-red-500">*</span></label>
                                        <input type="date" id="date_of_birth" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Address Information</h3>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Street Address <span class="text-red-500">*</span></label>
                                        <input type="text" id="address1" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Postal Code <span class="text-red-500">*</span></label>
                                        <input type="text" id="postal_code" maxlength="4" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Suburb / Area</label>
                                        <input type="text" id="address2" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Cell Number</label>
                                        <input type="tel" id="cell_tel_no" maxlength="10" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                    </div>
                                </div>
                                <div class="flex items-start gap-3 mt-4 p-3 rounded-md bg-orange-50 border border-orange-100">
                                    <input type="checkbox" id="credit_consent" class="mt-1 h-4 w-4 text-brand-accent focus:ring-brand-accent">
                                    <label for="credit_consent" class="text-sm text-gray-700">I confirm the client consented to this bureau enquiry.</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="credit-loading" class="hidden text-center py-8">
                        <i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand-accent"></i>
                        <p class="mt-3 text-sm text-gray-600">Contacting Experian...</p>
                    </div>
                    
                    <div id="credit-result" class="hidden text-center py-8">
                        <i class="fa-solid fa-circle-check text-4xl text-green-500 mb-3"></i>
                        <h3 class="text-lg font-semibold text-gray-900">Credit Check Complete</h3>
                        <p class="text-sm text-gray-500">Score and risk band:</p>
                        <div id="credit-score-value" class="text-3xl font-bold text-gray-900 mt-2"></div>
                    </div>
                </div>
                
                <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-200">
                    <span class="text-xs text-gray-500"><i class="fa-solid fa-shield-halved"></i> Data encrypted via Supabase Edge</span>
                    <div class="flex items-center gap-2">
                        <button id="credit-check-download" class="hidden px-4 py-2 border border-gray-300 rounded-md text-sm">Download Report</button>
                        <button id="credit-check-complete" class="hidden px-4 py-2 bg-green-600 text-white rounded-md text-sm">Done</button>
                        <button id="credit-check-cancel" class="px-4 py-2 border border-gray-300 rounded-md text-sm">Cancel</button>
                        <button id="credit-check-submit" class="px-4 py-2 bg-brand-accent text-white rounded-md text-sm">Run Credit Check</button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('credit-check-close').addEventListener('click', closeCreditCheckModal);
    document.getElementById('credit-check-cancel').addEventListener('click', closeCreditCheckModal);
    document.getElementById('credit-check-submit').addEventListener('click', handleCreditCheckSubmit);
    
    document.getElementById('credit-check-complete').addEventListener('click', () => {
        closeCreditCheckModal();
        const wizardContent = document.getElementById('wizard-content');
        if (wizardContent && inBranchState.step === 2) {
            renderCreditCheck(wizardContent);
        }
    });

    document.getElementById('credit-check-download').addEventListener('click', () => {
        if (latestCreditZipData && inBranchState.creditCheck.applicationId) {
            downloadCreditZip(latestCreditZipData, inBranchState.creditCheck.applicationId);
        }
    });
    
    creditModalInitialized = true;
}

window.openCreditCheckModal = function() {
    if (!inBranchState.targetUser) return;
    setupCreditCheckModal();
    resetCreditCheckFormState();
    prefillCreditFormFields();
    const modal = document.getElementById(CREDIT_MODAL_ID);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

function closeCreditCheckModal() {
    const modal = document.getElementById(CREDIT_MODAL_ID);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    resetCreditCheckFormState();
}

function resetCreditCheckFormState() {
    document.getElementById('credit-form-content').classList.remove('hidden');
    document.getElementById('credit-loading').classList.add('hidden');
    document.getElementById('credit-result').classList.add('hidden');
    
    const submitBtn = document.getElementById('credit-check-submit');
    submitBtn.disabled = false; 
    submitBtn.innerHTML = 'Run Credit Check'; 
    submitBtn.classList.remove('hidden');
    
    document.getElementById('credit-check-cancel').classList.remove('hidden');
    document.getElementById('credit-check-complete').classList.add('hidden');
    document.getElementById('credit-check-download').classList.add('hidden');
    
    latestCreditZipData = null;
}

function prefillCreditFormFields() {
    const user = inBranchState.targetUser || {};
    const { firstName, lastName } = splitName(user.full_name);
    
    if (!document.getElementById('identity_number')) return;

    document.getElementById('identity_number').value = user.identity_number || user.id_number || '';
    document.getElementById('surname').value = user.last_name || lastName || '';
    document.getElementById('forename').value = user.first_name || firstName || '';
    document.getElementById('cell_tel_no').value = user.phone_number || user.contact_number || '';
    
    // Attempt to prefill extra fields
    const gender = (user.gender || '').toUpperCase();
    document.getElementById('gender').value = gender.startsWith('F') ? 'F' : (gender.startsWith('M') ? 'M' : '');
    document.getElementById('date_of_birth').value = formatDateForInput(user.date_of_birth);
    document.getElementById('address1').value = user.address_line1 || user.address || '';
    document.getElementById('address2').value = user.suburb_area || user.suburb || user.city || '';
    document.getElementById('postal_code').value = user.postal_code || user.zip_code || '';

    document.getElementById('credit_consent').checked = true;
}

async function handleCreditCheckSubmit() {
    const submitBtn = document.getElementById('credit-check-submit');
    const identity_number = document.getElementById('identity_number').value.trim();
    const surname = document.getElementById('surname').value.trim();
    const forename = document.getElementById('forename').value.trim();
    const gender = document.getElementById('gender').value;
    const date_of_birth = document.getElementById('date_of_birth').value;
    const address1 = document.getElementById('address1').value.trim();
    const address2 = document.getElementById('address2').value.trim();
    const postal_code = document.getElementById('postal_code').value.trim();
    const cell_tel_no = document.getElementById('cell_tel_no').value.trim();
    const consent = document.getElementById('credit_consent').checked;

    if (!identity_number || !surname || !forename || !gender || !date_of_birth || !address1 || !postal_code) { 
        showToast('Please fill in all required fields.', 'warning'); 
        return; 
    }
    if (!consent) { 
        showToast('Client consent is required.', 'warning'); 
        return; 
    }

    submitBtn.disabled = true; 
    submitBtn.innerHTML = 'Processing...';
    document.getElementById('credit-form-content').classList.add('hidden');
    document.getElementById('credit-loading').classList.remove('hidden');

    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        let applicationId = inBranchState.creditCheck?.applicationId;
        
        // 1. Ensure an application ID exists to attach the check to
        if (!applicationId) {
            const { data: newApp, error: newAppError } = await supabase.from('loan_applications').insert([{ 
                user_id: inBranchState.targetUser.id, 
                status: 'BUREAU_CHECKING', 
                amount: 0, 
                term_months: 0, 
                loan_purpose: inBranchState.loanConfig?.reason || 'Personal Loan',
                source: 'IN_BRANCH',
                created_by_admin: session.user?.id
            }]).select().single();
            
            if (newAppError) throw newAppError;
            applicationId = newApp.id;
            inBranchState.creditCheck.applicationId = applicationId;
        }

        const userData = { 
            user_id: inBranchState.targetUser.id, 
            identity_number, surname, forename, 
            gender, date_of_birth: date_of_birth.replace(/-/g, ''),
            address1, address2, postal_code, cell_tel_no 
        };
        
        // 2. Perform the API call
        const result = await performAdminCreditCheck(applicationId, userData, session.access_token);

        const score = result.creditScore?.score || 0;
        
        // 3. Update DB
        await supabase
            .from('loan_applications')
            .update({ bureau_score_band: score, status: 'BUREAU_OK' })
            .eq('id', applicationId);
        
        inBranchState.creditCheck = { applicationId, status: 'completed', score };
        latestCreditZipData = result.zipData || null;

        // 4. Show Result
        document.getElementById('credit-loading').classList.add('hidden');
        document.getElementById('credit-result').classList.remove('hidden');
        document.getElementById('credit-score-value').textContent = `Score: ${score}`;
        document.getElementById('credit-check-complete').classList.remove('hidden');
        
        if (latestCreditZipData) {
            document.getElementById('credit-check-download').classList.remove('hidden');
        }
        
        submitBtn.classList.add('hidden');

    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
        resetCreditCheckFormState();
    }
}

async function performAdminCreditCheck(applicationId, userData, authToken) {
    const response = await fetch('/api/credit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ applicationId, userData })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
        // Mark as declined if API fails logically
        await supabase.from('loan_applications').update({ status: 'BUREAU_DECLINE' }).eq('id', applicationId);
        throw new Error(result.error || 'Credit check failed');
    }
    return result;
}

function downloadCreditZip(base64Data, applicationId) {
    try {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) { 
            byteNumbers[i] = byteCharacters.charCodeAt(i); 
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `credit-report-${applicationId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        showToast('Unable to download the credit report.', 'error');
    }
}

// --- Utils ---
function splitName(fullName = '') {
    const parts = fullName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
    const lastName = parts.pop();
    return { firstName: parts.join(' '), lastName };
}

function formatDateForInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
}

// ==========================================
//   MAIN PAGE RENDERING
// ==========================================

function renderPageContent() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div id="applications-list-view" class="flex flex-col h-full animate-fade-in">
      
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 shrink-0">
        <div>
          <h1 class="text-2xl font-headline font-bold text-on-surface">Loan Applications</h1>
          <p class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-outline">Manage reviews and create in-branch applications.</p>
        </div>
        
        <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button id="create-app-btn" class="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2" style="background:var(--color-primary)">
                <span class="material-symbols-outlined text-[18px]">computer</span> In-Branch App
            </button>
            <button id="btn-export-applications" class="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-sm border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-700 transition-colors">
                <span class="material-symbols-outlined text-[18px]">download</span> Export
            </button>

            <select id="status-filter" class="bg-white border border-outline-variant/30 text-on-surface-variant py-2 pl-4 pr-8 rounded-xl text-sm font-medium cursor-pointer">
                <option value="all">All Statuses</option>
                <option value="pending">⏳ Needs Review</option>
                <option value="DISBURSED">✅ Disbursed</option>
                <option value="DECLINED">❌ Declined</option>
                <optgroup label="── Pipeline ──">
                ${ALL_STATUSES.filter(s => !['DISBURSED','DECLINED','ERROR'].includes(s)).map(s => `<option value="${s}">${s}</option>`).join('')}
                </optgroup>
                <optgroup label="── Final ──">
                <option value="ERROR">ERROR</option>
                </optgroup>
            </select>

            <div class="relative w-full sm:w-64">
                <input type="text" id="search-input" placeholder="Search applications..."
                       class="w-full pl-10 pr-4 py-2 border border-outline-variant/30 rounded-xl text-sm">
                <span class="material-symbols-outlined absolute left-3 top-2 text-outline text-[18px]">search</span>
                <div id="search-suggestions" class="absolute z-20 w-full bg-white border border-outline-variant/20 rounded-xl mt-1 hidden max-h-72 overflow-y-auto shadow-xl"></div>
            </div>
        </div>
      </div>

      <div class="glass-card rounded-2xl flex flex-col overflow-hidden flex-1 min-h-0">
        <div class="overflow-auto custom-scrollbar">
          <table class="min-w-full divide-y divide-outline-variant/10 relative">
            <thead class="bg-surface-container sticky top-0 z-10 shadow-sm">
                <tr>
                    <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline bg-surface-container">Applicant</th>
                    <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline bg-surface-container">Amount</th>
                    <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline bg-surface-container">Status</th>
                    <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline bg-surface-container">Date</th>
                    <th class="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-outline bg-surface-container">Action</th>
                </tr>
            </thead>
            <tbody id="applications-table-body" class="bg-white divide-y divide-outline-variant/10">
                <tr><td colspan="5" class="p-10 text-center text-outline">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-2 text-xs text-gray-400 text-right">Showing <span id="visible-count">0</span> records</div>
    </div>

    <div id="in-branch-view" class="hidden glass-card rounded-2xl h-full flex flex-col">
       <div class="flex justify-between items-center px-6 py-4 border-b border-outline-variant/10 bg-surface-container rounded-t-2xl">
            <div class="flex items-center gap-3">
                <button id="back-to-list-btn" class="flex items-center gap-2 text-on-surface-variant hover:text-on-surface font-medium transition-colors">
                    <span class="material-symbols-outlined text-[18px]">arrow_back</span> Cancel
                </button>
                <span class="h-6 w-px bg-outline-variant/30"></span>
                <span class="text-sm font-bold text-on-surface">In-Branch Application Mode</span>
            </div>
            <div class="text-xs font-bold flex items-center gap-2 px-3 py-1.5 rounded-full border" style="color:var(--color-primary);border-color:var(--color-primary);opacity:0.7;background:rgba(var(--color-primary-rgb,160,65,0),0.06)">
                <span class="material-symbols-outlined text-[16px]">store</span> Branch Terminal
            </div>
        </div>
        
        <div class="px-6 pt-6 pb-2">
            <div class="flex items-center justify-center w-full max-w-6xl mx-auto mb-8 overflow-x-auto pb-2">
                <div id="wizard-stepper-container" class="flex items-center min-w-max"></div>
            </div>
        </div>
        
        <div id="wizard-content" class="flex-1 overflow-y-auto px-6 pb-6 bg-surface-container-lowest"></div>

        <div class="px-6 py-4 border-t border-outline-variant/10 bg-white rounded-b-2xl flex justify-end gap-3">
            <button id="wizard-prev-btn" class="hidden px-4 py-2 rounded-xl border border-outline-variant/30 text-on-surface-variant text-sm font-medium">Back</button>
            <button id="wizard-next-btn" class="px-6 py-2.5 rounded-xl font-semibold text-sm text-white" style="background:var(--color-primary)">Next Step</button>
        </div>
    </div>
  `;
  
  attachEventListeners();
  setupCreditCheckModal();
}

// ==========================================
//   WIZARD LOGIC (CONTROLLER)
// ==========================================

const WIZARD_STEPS = [
    { id: 1, title: 'Client', icon: 'fa-user' },
    { id: 2, title: 'Bureau', icon: 'fa-search-dollar' },
    { id: 3, title: 'Financials', icon: 'fa-chart-pie' },
    { id: 4, title: 'Declarations', icon: 'fa-file-contract' },
    { id: 5, title: 'Loan', icon: 'fa-sliders' },
    { id: 6, title: 'Docs', icon: 'fa-file-invoice' },
    { id: 7, title: 'Confirm', icon: 'fa-check-circle' }
];

async function startInBranchFlow() {
    inBranchState.active = true; 
    inBranchState.step = 1; 
    inBranchState.targetUser = null; 
    inBranchState.loanHistoryCount = 0;
    inBranchState.creditCheck = { applicationId: null, status: 'pending', score: null };
    
    const defaultDate = new Date(); 
    defaultDate.setDate(defaultDate.getDate() + 7);
    
    inBranchState.loanConfig = { 
        amount: 1000, 
        period: 1, 
        startDate: defaultDate, 
        reason: 'Personal Loan', 
        maxAllowedPeriod: 1, 
        interestRate: 0.20 
    };
    
    document.getElementById('applications-list-view').classList.add('hidden');
    document.getElementById('in-branch-view').classList.remove('hidden');
    renderWizard();
}

function renderWizard() { 
    renderStepper(); 
    renderStepContent(); 
    updateWizardButtons(); 
}

function renderStepper() {
    const container = document.getElementById('wizard-stepper-container'); 
    if(!container) return;
    
    container.innerHTML = WIZARD_STEPS.map((step, index) => {
        const isActive = step.id === inBranchState.step; 
        const isCompleted = step.id < inBranchState.step; 
        const isLast = index === WIZARD_STEPS.length - 1;
        
        let circleClass = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ";
        if (isActive) circleClass += "border-brand-accent bg-brand-accent text-white shadow-md";
        else if (isCompleted) circleClass += "border-green-500 bg-green-500 text-white";
        else circleClass += "border-gray-300 bg-white text-gray-400";
        
        return `
            <div class="flex flex-col items-center px-2">
                <div class="${circleClass}">
                    ${isCompleted ? '<i class="fa-solid fa-check"></i>' : `<i class="fa-solid ${step.icon}"></i>`}
                </div>
                <span class="text-xs font-semibold whitespace-nowrap mt-1 ${isActive ? 'text-brand-accent' : 'text-gray-400'}">
                    ${step.title}
                </span>
            </div>
            ${!isLast ? `<div class="w-8 h-1 mx-1 rounded bg-gray-200"></div>` : ''}
        `;
    }).join('');
}

async function renderStepContent() {
    const content = document.getElementById('wizard-content');
    content.innerHTML = '<div class="flex justify-center p-10"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand-accent"></i></div>';
    
    switch(inBranchState.step) {
        case 1: await renderUserSelection(content); break;
        case 2: await renderCreditCheck(content); break;
        case 3: await renderFinancialsForm(content); break;    
        case 4: await renderDeclarationsForm(content); break;  
        case 5: await renderLoanConfiguration(content); break;
        case 6: await renderDocumentCheck(content); break;
        case 7: await renderConfirmation(content); break;
    }
}

function updateWizardButtons() {
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');
    
    if(inBranchState.step === 1) { 
        prevBtn.classList.add('hidden'); 
        nextBtn.disabled = !inBranchState.targetUser; 
    } else { 
        prevBtn.classList.remove('hidden'); 
        nextBtn.disabled = false; 
    }
    
    // Hide Next button on form steps where internal submit handles progress
    if(inBranchState.step === 3 || inBranchState.step === 4) { 
        nextBtn.classList.add('hidden'); 
    } else { 
        nextBtn.classList.remove('hidden'); 
    }

    if(inBranchState.step === 7) { 
        nextBtn.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i> Submit Application'; 
        nextBtn.onclick = handleFinalSubmit; 
    } else { 
        nextBtn.innerHTML = 'Next Step <i class="fa-solid fa-arrow-right ml-2"></i>'; 
        nextBtn.onclick = handleNextStep; 
    }
}

// ==========================================
//   STEP 1: USER SELECTION (BRANCH 100 = ONLINE)
// ==========================================

async function renderUserSelection(container) {
    const canCreateWalkIn = ['admin', 'super_admin', 'base_admin'].includes(userRole);
    
    // --- CONFIGURATION ---
    const ONLINE_BRANCH_ID = 100; 

    container.innerHTML = `
        <div class="max-w-2xl mx-auto bg-white p-8 rounded-lg border border-gray-200 shadow-sm mt-4">
            <div class="flex border-b border-gray-200 mb-6">
                <button id="tab-search" class="flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600">
                    <i class="fa-solid fa-magnifying-glass mr-2"></i>Search Existing
                </button>
                ${canCreateWalkIn ? `
                <button id="tab-create" class="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors">
                    <i class="fa-solid fa-user-plus mr-2"></i>New Walk-in Client
                </button>` : ''}
            </div>
            
            <div id="view-search">
                <h3 class="text-xl font-bold text-gray-800 mb-2">Find Client</h3>
                <p class="text-sm text-gray-500 mb-6">Search by name, email, or ID number.</p>
                <div class="relative mb-6">
                    <input type="text" id="user-search" class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm" placeholder="Start typing name or ID...">
                    <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <div id="search-spinner" class="hidden absolute right-3 top-1/2 -translate-y-1/2 text-orange-500">
                        <i class="fa-solid fa-circle-notch fa-spin"></i>
                    </div>
                </div>
                <div id="user-results" class="hidden absolute z-10 w-full max-w-[36rem] bg-white border border-gray-200 rounded-lg shadow-xl mt-[-20px] max-h-60 overflow-y-auto"></div>
            </div>
            
            ${canCreateWalkIn ? `
            <div id="view-create" class="hidden animate-fade-in">
                <div class="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6">
                    <div class="flex">
                        <div class="flex-shrink-0"><i class="fa-solid fa-store text-orange-600"></i></div>
                        <div class="ml-3">
                            <p class="text-sm text-orange-700">You are registering a <strong>Walk-in Client</strong>. Physical branch selection is required.</p>
                        </div>
                    </div>
                </div>
                <div class="space-y-5">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name <span class="text-red-500">*</span></label>
                        <input type="text" id="new-fullname" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500" placeholder="e.g. John Doe">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">ID Number <span class="text-red-500">*</span></label>
                        <input type="text" id="new-idnumber" maxlength="13" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500" placeholder="13-digit SA ID">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Phone</label>
                            <input type="tel" id="new-phone" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500" placeholder="082...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Email (Optional)</label>
                            <input type="email" id="new-email" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500" placeholder="Leave empty if none">
                        </div>
                    </div>

                    <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Select Physical Branch <span class="text-red-500">*</span></label>
                        <select id="new-branch-id" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500 bg-white">
                            <option value="">-- Choose Location --</option>
                            ${branches.filter(b => b.id !== ONLINE_BRANCH_ID).map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                        </select>
                        <p class="text-[10px] text-gray-500 mt-2 font-medium">
                            <i class="fa-solid fa-circle-info"></i> Please specify the branch where this walk-in application is taking place.
                        </p>
                    </div>

                    <button id="btn-create-client" class="w-full py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition-all shadow-md mt-2 flex justify-center items-center gap-2">
                        <i class="fa-solid fa-user-plus"></i> Create & Select Client
                    </button>
                </div>
            </div>` : ''}
            
            <div id="selected-user-card" class="${inBranchState.targetUser ? '' : 'hidden'} mt-6 space-y-4 animate-fade-in">
                <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-xl shadow-sm">
                            ${inBranchState.targetUser?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900">${inBranchState.targetUser?.full_name || ''}</h4>
                            <p class="text-xs text-gray-600 font-mono">ID: ${inBranchState.targetUser?.identity_number || 'N/A'}</p>
                        </div>
                    </div>
                    <button id="clear-user-btn" class="text-gray-400 hover:text-red-500 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>

                <div id="action-new-loan" class="bg-white border-2 border-orange-600 border-dashed rounded-2xl p-6 shadow-md hover:bg-orange-50 cursor-pointer transition-all group">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg"><i class="fa-solid fa-plus"></i></div>
                            <div>
                                <h5 class="font-black text-gray-900 uppercase">Start New Loan Application</h5>
                                <div id="outstanding-balance-warning">
                                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Fresh credit check & financials</p>
                                </div>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-orange-600"></i>
                    </div>
                </div>

                <div id="existing-loans-container" class="space-y-2">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Resume / Update Existing</p>
                    <div id="user-loan-history-list" class="space-y-2">
                        <div class="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <i class="fa-solid fa-spinner fa-spin text-gray-400"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- DOM Elements & Listeners ---
    const tabSearch = document.getElementById('tab-search'); 
    const tabCreate = document.getElementById('tab-create');
    const viewSearch = document.getElementById('view-search'); 
    const viewCreate = document.getElementById('view-create');
    const input = document.getElementById('user-search'); 
    const results = document.getElementById('user-results');
    const spinner = document.getElementById('search-spinner');

    if (canCreateWalkIn && tabCreate) {
        tabSearch.onclick = () => { 
            viewSearch.classList.remove('hidden'); viewCreate.classList.add('hidden'); 
            tabSearch.className = "flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600";
            tabCreate.className = "flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors";
        };
        tabCreate.onclick = () => { 
            viewSearch.classList.add('hidden'); viewCreate.classList.remove('hidden'); 
            tabCreate.className = "flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600";
            tabSearch.className = "flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors";
        };
    }

    if(input) {
        let timer;
        input.oninput = (e) => {
            clearTimeout(timer);
            const val = e.target.value.trim(); 
            if(val.length < 2) { results.classList.add('hidden'); return; }
            spinner.classList.remove('hidden');
            timer = setTimeout(async () => {
                const { data: matches } = await supabase.from('profiles').select('*').or(`full_name.ilike.%${val}%,identity_number.ilike.%${val}%`).limit(5);
                spinner.classList.add('hidden');
                if(matches?.length > 0) {
                    results.innerHTML = matches.map(u => `<div class="p-3 hover:bg-orange-50 cursor-pointer border-b last:border-0 user-option" data-id="${u.id}"><div class="font-bold text-gray-800">${u.full_name}</div><div class="text-xs text-gray-500 font-mono">ID: ${u.identity_number || 'N/A'}</div></div>`).join('');
                    results.classList.remove('hidden');
                    document.querySelectorAll('.user-option').forEach(el => el.onclick = () => { inBranchState.targetUser = matches.find(u => u.id === el.dataset.id); renderUserSelection(container); updateWizardButtons(); });
                } else { results.innerHTML = `<div class="p-4 text-sm text-gray-500">No clients found.</div>`; results.classList.remove('hidden'); }
            }, 400);
        };
    }

    // --- UPDATED CREATE HANDLER (MANDATORY BRANCH SELECTION) ---
    document.getElementById('btn-create-client')?.addEventListener('click', async (e) => {
        const fullName = document.getElementById('new-fullname').value.trim(); 
        const idNumber = document.getElementById('new-idnumber').value.trim();
        const phone = document.getElementById('new-phone').value.trim(); 
        const email = document.getElementById('new-email').value.trim();
        const branchSelect = document.getElementById('new-branch-id');
        
        // Forced branch selection logic
        const branchId = branchSelect ? branchSelect.value : null;

        if (!branchId) {
            return showToast("Manual branch selection is required to proceed.", 'warning');
        }

        if(!fullName || !idNumber) return showToast("Name and ID Number are required.", 'warning');

        e.target.disabled = true;
        e.target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

        try {
            const { data, error } = await createWalkInClient({ fullName, idNumber, phone, email: email || null, branchId });
            if(error) throw error;
            inBranchState.targetUser = data; 
            renderUserSelection(container); 
            updateWizardButtons(); 
        } catch (err) {
            showToast(err.message, 'error');
            e.target.disabled = false; 
            e.target.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create & Select Client';
        }
    });

    if (inBranchState.targetUser) {
        const listContainer = document.getElementById('user-loan-history-list');
        const warningContainer = document.getElementById('outstanding-balance-warning');
        const actionNewBtn = document.getElementById('action-new-loan');

        supabase.from('loan_applications').select('*').eq('user_id', inBranchState.targetUser.id).order('created_at', { ascending: false }).then(({ data: apps, error }) => {
            if (error) return;
            const activeLoan = apps?.find(a => !['REPAID', 'DECLINED', 'ERROR', 'DISBURSED'].includes(a.status));
            if (activeLoan) {
                warningContainer.innerHTML = `<p class="text-[10px] text-red-600 font-bold uppercase flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> Active: ${activeLoan.status}</p>`;
                actionNewBtn.classList.add('opacity-50', 'bg-gray-50', 'cursor-not-allowed');
                actionNewBtn.onclick = () => showToast(`Cannot start new. Application active.`, "warning");
            } else {
                warningContainer.innerHTML = `<p class="text-[10px] text-green-600 font-bold uppercase">Ready for new application</p>`;
                actionNewBtn.onclick = () => handleNextStep();
            }
            if (!apps || apps.length === 0) listContainer.innerHTML = `<p class="text-xs text-gray-400 p-4 text-center italic">No history found.</p>`;
            else listContainer.innerHTML = apps.map(app => `<div class="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center text-sm shadow-sm"><div><span class="font-bold text-gray-700">${formatCurrency(app.amount)}</span><span class="text-[10px] ml-2 text-gray-400 font-mono">${formatDate(app.created_at)}</span><div class="mt-1"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeColor(app.status)}">${app.status}</span></div></div>${!['REPAID', 'DECLINED', 'ERROR', 'DISBURSED'].includes(app.status) ? `<button class="resume-app-btn px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-md hover:bg-orange-700 transition" data-id="${app.id}">Resume</button>` : ''}</div>`).join('');
            document.querySelectorAll('.resume-app-btn').forEach(btn => { btn.onclick = (e) => { const appId = e.target.dataset.id; const appData = apps.find(a => a.id == appId); inBranchState.creditCheck.applicationId = appId; inBranchState.loanConfig = { ...inBranchState.loanConfig, amount: appData.amount, period: appData.term_months, reason: appData.purpose }; showToast(`Resuming Application...`); handleNextStep(); }; });
        });
    }
    document.getElementById('clear-user-btn')?.addEventListener('click', () => { inBranchState.targetUser = null; renderUserSelection(container); updateWizardButtons(); });
}
// ==========================================
//   STEP 2: BUREAU (MERGED DESIGN & LOGIC)
// ==========================================

async function renderCreditCheck(container) {
    if(!inBranchState.targetUser) return;
    
    // Fetch the latest completed check (Logic from snippet 2)
    const { data: checks } = await supabase
        .from('credit_checks')
        .select('*')
        .eq('user_id', inBranchState.targetUser.id)
        .eq('status', 'completed')
        .order('checked_at', { ascending: false })
        .limit(1);

    const latestCheck = checks?.[0];
    
    // Calculate validity based on age (90 days) and status (Logic from snippet 1)
    const checkAgeDays = latestCheck ? (Date.now() - new Date(latestCheck.checked_at)) / (1000 * 3600 * 24) : 999;
    const isValid = latestCheck && checkAgeDays <= 90;

    let contentHtml = '';
    let canProceed = false;

    if (isValid) {
        // Prepare data for state (Logic from snippet 2)
        const score = latestCheck.credit_score;
        inBranchState.creditScore = score;
        inBranchState.creditCheck = { applicationId: latestCheck.application_id, status: 'completed', score };
        canProceed = true;
        
        // Styling logic (Styling from snippet 1)
        let color = score < 600 ? '#EF4444' : score < 700 ? '#F59E0B' : '#10B981';
        let rating = score < 600 ? 'Poor' : score < 700 ? 'Average' : 'Excellent';
        const expiryDate = new Date(new Date(latestCheck.checked_at).getTime() + 90*24*60*60*1000).toLocaleDateString();

        contentHtml = `
            <div class="text-center p-6">
                <div class="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="80" stroke="#f3f4f6" stroke-width="12" fill="none"/>
                        <circle cx="96" cy="96" r="80" stroke="${color}" stroke-width="12" fill="none" 
                            stroke-dasharray="502" 
                            stroke-dashoffset="${502 - (502 * (score/800))}"
                            style="transition: stroke-dashoffset 1s ease-in-out;"/>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-4xl font-extrabold text-gray-900">${score}</span>
                        <span class="text-xs font-bold uppercase tracking-widest" style="color: ${color}">${rating}</span>
                    </div>
                </div>
                <h3 class="text-lg font-bold text-gray-800">Bureau Report Verified</h3>
                <p class="text-sm text-gray-500 mt-1">Valid until ${expiryDate}</p>
            </div>`;
    } else {
        // Fallback for missing or expired report (Logic from snippet 1/2)
        inBranchState.creditCheck = { applicationId: null, status: 'pending', score: null };
        
        contentHtml = `
            <div class="text-center py-10">
                <div class="w-20 h-20 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-3xl mx-auto mb-4">
                    <i class="fa-solid fa-user-clock"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-900">New Credit Check Required</h3>
                <p class="text-gray-600 mt-2">No valid bureau report found from the last 3 months.</p>
                <button id="run-check-btn" class="mt-8 bg-brand-accent text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-brand-accent-hover transition">
                    Launch Experian Module
                </button>
            </div>`;
    }

    // Render Container
    container.innerHTML = `<div class="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-xl mt-4">${contentHtml}</div>`;
    
    // Event Listeners
    const btn = document.getElementById('run-check-btn');
    if (btn) btn.onclick = () => window.openCreditCheckModal();
    
    // Update Wizard Navigation
    const nextBtn = document.getElementById('wizard-next-btn');
    if (nextBtn) nextBtn.disabled = !canProceed;
}

// ==========================================
//   STEP 3: FINANCIAL AFFORDABILITY
// ==========================================

async function renderFinancialsForm(container) {
    if (!inBranchState.targetUser) return;

    // 1. Fetch existing financial profile
    const { data: profile } = await supabase
        .from('financial_profiles')
        .select('*')
        .eq('user_id', inBranchState.targetUser.id)
        .maybeSingle();

    const parsed = profile?.parsed_data || { income: {}, expenses: {} };
    
    container.innerHTML = `
        <div class="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-xl mt-4 animate-fade-in">
            <h3 class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i class="fa-solid fa-scale-balanced text-brand-accent"></i> 
                Financial Affordability Assessment
            </h3>
            
            <form id="financials-form" class="space-y-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    <div class="space-y-4">
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                            <i class="fa-solid fa-wallet"></i> Monthly Income
                        </h4>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">Basic Salary (Net)</label>
                            <div class="relative">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                                <input type="number" id="fin_salary" value="${parsed.income.salary || ''}" 
                                    class="w-full pl-8 border-gray-300 rounded-lg focus:ring-brand-accent" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">Other Earnings</label>
                            <div class="relative">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                                <input type="number" id="fin_other" value="${parsed.income.other_monthly_earnings || ''}" 
                                    class="w-full pl-8 border-gray-300 rounded-lg focus:ring-brand-accent" placeholder="0.00">
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                            <i class="fa-solid fa-receipt"></i> Monthly Expenses
                        </h4>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1">Housing/Rent</label>
                                <input type="number" id="exp_housing" value="${parsed.expenses.housing_rent || ''}" 
                                    class="w-full border-gray-300 rounded-lg text-sm" placeholder="0">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1">School Fees</label>
                                <input type="number" id="exp_school" value="${parsed.expenses.school || ''}" 
                                    class="w-full border-gray-300 rounded-lg text-sm" placeholder="0">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1">Transport</label>
                                <input type="number" id="exp_transport" value="${parsed.expenses.petrol || ''}" 
                                    class="w-full border-gray-300 rounded-lg text-sm" placeholder="0">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1">Groceries</label>
                                <input type="number" id="exp_food" value="${parsed.expenses.groceries || ''}" 
                                    class="w-full border-gray-300 rounded-lg text-sm" placeholder="0">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-50 rounded-xl p-6 border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <span class="text-xs font-bold text-gray-500 uppercase tracking-tighter">Maximum Monthly Affordability</span>
                        <div class="flex items-baseline gap-2">
                            <h2 id="disp-income" class="text-4xl font-black text-brand-accent">R 0.00</h2>
                            <span class="text-xs text-gray-400 font-medium">(Surplus Income)</span>
                        </div>
                    </div>
                    <button type="submit" class="w-full md:w-auto bg-gray-900 text-white px-10 py-4 rounded-xl font-extrabold hover:bg-black transition shadow-lg flex items-center justify-center gap-2">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Save & Analyze Profile
                    </button>
                </div>
            </form>
        </div>`;
    
    // 2. Real-time calculation logic
    const calculateAffordability = () => {
        const salary = parseFloat(document.getElementById('fin_salary').value) || 0;
        const other = parseFloat(document.getElementById('fin_other').value) || 0;
        const totalIncome = salary + other;

        const housing = parseFloat(document.getElementById('exp_housing').value) || 0;
        const school = parseFloat(document.getElementById('exp_school').value) || 0;
        const transport = parseFloat(document.getElementById('exp_transport').value) || 0;
        const food = parseFloat(document.getElementById('exp_food').value) || 0;
        const totalExpenses = housing + school + transport + food;

        const surplus = Math.max(0, totalIncome - totalExpenses);
        document.getElementById('disp-income').textContent = formatCurrency(surplus);
        
        return { totalIncome, totalExpenses, surplus };
    };
    
    // Attach real-time listeners
    document.querySelectorAll('#financials-form input').forEach(input => {
        input.addEventListener('input', calculateAffordability);
    });
    
    // Initial run to show values if data existed
    calculateAffordability();

    // 3. Save logic with affordability_ratio calculation
    document.getElementById('financials-form').onsubmit = async (e) => {
        e.preventDefault();
        const { totalIncome, totalExpenses, surplus } = calculateAffordability();

        if (totalIncome <= 0) {
            return showToast("Please enter a valid salary.", 'warning');
        }

        const payload = { 
            user_id: inBranchState.targetUser.id, 
            monthly_income: totalIncome, 
            monthly_expenses: totalExpenses, 
            affordability_ratio: surplus, // PERSISTED FOR STEP 5 DYNAMIC CALCS
            parsed_data: { 
                income: { 
                    salary: document.getElementById('fin_salary').value, 
                    other_monthly_earnings: document.getElementById('fin_other').value 
                }, 
                expenses: { 
                    housing_rent: document.getElementById('exp_housing').value, 
                    school: document.getElementById('exp_school').value, 
                    petrol: document.getElementById('exp_transport').value, 
                    groceries: document.getElementById('exp_food').value 
                } 
            } 
        };

        const { error } = await supabase
            .from('financial_profiles')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) {
            showToast(error.message, 'error');
        } else {
            // Update global state so Step 5 has the limit ready
            inBranchState.affordabilityLimit = surplus; 
            showToast('Financial Profile Updated', 'success'); 
            handleNextStep(); 
        }
    };
}
// ==========================================
//   STEP 4: COMPLIANCE & DECLARATIONS
// ==========================================

async function renderDeclarationsForm(container) {
    if (!inBranchState.targetUser) return;

    // 1. Fetch existing declaration data
    const { data: existing } = await supabase
        .from('declarations')
        .select('*')
        .eq('user_id', inBranchState.targetUser.id)
        .maybeSingle();

    container.innerHTML = `
        <div class="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-xl mt-4 animate-fade-in">
            <h3 class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i class="fa-solid fa-file-shield text-brand-accent"></i> 
                Compliance & Statutory Declarations
            </h3>

            <div class="space-y-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Marital Status</label>
                        <select id="decl_marital" class="w-full border-gray-300 rounded-lg focus:ring-brand-accent">
                            <option value="single">Single</option>
                            <option value="married">Married</option>
                            <option value="divorced">Divorced</option>
                            <option value="widowed">Widowed</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Residential Status</label>
                        <select id="decl_home" class="w-full border-gray-300 rounded-lg focus:ring-brand-accent">
                            <option value="rent">Rent</option>
                            <option value="own">Own Home</option>
                            <option value="family">Living with Family</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Highest Qualification</label>
                        <select id="decl_qual" class="w-full border-gray-300 rounded-lg focus:ring-brand-accent">
                            <option value="none">None / Primary</option>
                            <option value="matric">Matric / Grade 12</option>
                            <option value="diploma">Diploma</option>
                            <option value="degree">Bachelor's Degree</option>
                            <option value="postgrad">Postgraduate</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-3 pt-6">
                        <input type="checkbox" id="decl_disadvantaged" class="w-5 h-5 text-brand-accent border-gray-300 rounded focus:ring-brand-accent">
                        <label for="decl_disadvantaged" class="text-sm font-semibold text-gray-700 cursor-pointer">Historically Disadvantaged?</label>
                    </div>
                </div>

                <div class="p-5 bg-gray-50 rounded-xl border border-gray-200">
                    <label class="flex items-center gap-3 cursor-pointer mb-3">
                        <input type="checkbox" id="decl_referral_provided" class="w-5 h-5 text-brand-accent border-gray-300 rounded">
                        <span class="text-sm font-bold text-gray-700 uppercase tracking-tighter">Was a referral provided for this client?</span>
                    </label>
                    <div id="referral-fields" class="grid grid-cols-1 md:grid-cols-2 gap-4 hidden mt-4 animate-fade-in">
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Referral Name</label>
                            <input type="text" id="decl_ref_name" class="w-full border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-brand-accent" placeholder="Full Name">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Referral Phone</label>
                            <input type="tel" id="decl_ref_phone" class="w-full border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-brand-accent" placeholder="081...">
                        </div>
                    </div>
                </div>

                <div class="p-5 bg-orange-50 border border-orange-100 rounded-xl space-y-4">
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" id="decl_terms" class="mt-1 w-5 h-5 text-orange-600 border-orange-200 rounded focus:ring-orange-500">
                        <span class="text-sm text-gray-700 leading-tight">
                            Client has read and accepts the <strong>Standard Conditions of the Credit Agreement</strong> and the <strong>Pre-Agreement Statement</strong>.
                        </span>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" id="decl_truth" class="mt-1 w-5 h-5 text-orange-600 border-orange-200 rounded focus:ring-orange-500">
                        <span class="text-sm text-gray-700 leading-tight">
                            Client declares that all information provided is true, correct, and that they are not currently under debt review or insolvent.
                        </span>
                    </label>
                </div>

                <button id="save-declarations" class="w-full bg-gray-900 text-white py-4 rounded-xl font-black hover:bg-black shadow-lg transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-check-double"></i> Verify Compliance & Continue
                </button>
            </div>
        </div>`;

    // 2. Logic: Handle Referral Toggle
    const toggleReferral = () => {
        const checked = document.getElementById('decl_referral_provided').checked;
        const fields = document.getElementById('referral-fields');
        if (checked) {
            fields.classList.remove('hidden');
        } else {
            fields.classList.add('hidden');
        }
    };
    document.getElementById('decl_referral_provided').addEventListener('change', toggleReferral);

    // 3. Logic: Pre-fill existing data
    if (existing) {
        document.getElementById('decl_marital').value = existing.marital_status || 'single';
        document.getElementById('decl_home').value = existing.home_ownership || 'rent';
        document.getElementById('decl_qual').value = existing.highest_qualification || 'matric';
        document.getElementById('decl_disadvantaged').checked = !!existing.historically_disadvantaged;
        
        if (existing.referral_provided) {
            document.getElementById('decl_referral_provided').checked = true;
            toggleReferral();
            document.getElementById('decl_ref_name').value = existing.referral_name || '';
            document.getElementById('decl_ref_phone').value = existing.referral_phone || '';
        }
    }

    // 4. Logic: Save to Database
    document.getElementById('save-declarations').onclick = async () => {
        const termsChecked = document.getElementById('decl_terms').checked;
        const truthChecked = document.getElementById('decl_truth').checked;

        if (!termsChecked || !truthChecked) {
            return showToast("Statutory declarations must be confirmed.", 'warning');
        }

        const refChecked = document.getElementById('decl_referral_provided').checked;
        const payload = {
            user_id: inBranchState.targetUser.id,
            marital_status: document.getElementById('decl_marital').value,
            home_ownership: document.getElementById('decl_home').value,
            highest_qualification: document.getElementById('decl_qual').value,
            historically_disadvantaged: document.getElementById('decl_disadvantaged').checked,
            referral_provided: refChecked,
            referral_name: refChecked ? document.getElementById('decl_ref_name').value : null,
            referral_phone: refChecked ? document.getElementById('decl_ref_phone').value : null,
            accepted_std_conditions: true,
            metadata: {
                marital_status: document.getElementById('decl_marital').value,
                home_ownership: document.getElementById('decl_home').value
            }
        };

        const { error } = await supabase
            .from('declarations')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('Declarations Verified', 'success');
            handleNextStep();
        }
    };
}
// ==========================================
//   LOAN CONFIGURATION HELPERS
// ==========================================

function getSouthAfricanHolidays(year) {
    return [
        `${year}-01-01`, `${year}-03-21`, `${year}-04-18`, `${year}-04-21`, 
        `${year}-04-27`, `${year}-04-28`, `${year}-05-01`, `${year}-06-16`, 
        `${year}-08-09`, `${year}-09-24`, `${year}-12-16`, `${year}-12-25`, `${year}-12-26`
    ];
}

function validateRepaymentDate(dateString) {
    if (!dateString) return { valid: true };
    const selectedDate = new Date(dateString);
    const day = selectedDate.getUTCDay();
    const year = selectedDate.getUTCFullYear();
    const formattedDate = selectedDate.toISOString().split('T')[0];
    const holidays = getSouthAfricanHolidays(year);

    if (day === 0 || day === 6) {
        return { valid: false, reason: "Repayments cannot be scheduled on weekends." };
    }
    if (holidays.includes(formattedDate)) {
        return { valid: false, reason: "The selected date is a South African Public Holiday." };
    }
    return { valid: true };
}

/**
 * NCA-compliant loan calculation.
 *
 * Rules (South Africa, short-term credit):
 *  - Interest:         5% per month on principal
 *  - Initiation fee:   15% of principal — ONE-TIME (not per month)
 *                      Waived for the borrower's first loan of the calendar year
 *  - Service fee:      R69/month (capped NCA); prorated first month if startDate given
 *  - Credit life (CPI):0.45% of principal per month
 *  - VAT:              15% on (initiation fee + service fees); not on interest or CPI
 *
 * @param {number}  amount       Loan principal (ZAR)
 * @param {number}  period       Loan term in months
 * @param {string}  [startDate]  First repayment date ISO string (for proration)
 * @param {number}  [historyCount]  Number of completed loans (used for first-of-year rule)
 * @param {boolean} [isFirstLoanOfYear]  Override flag from server-side check
 */
function calculateLoanDetails(amount, period, startDate, historyCount = 0, isFirstLoanOfYear = false) {
    const INTEREST_RATE_MONTHLY = 0.05;        // 5% per month (NCA max for short-term)
    const INITIATION_FEE_RATE   = 0.15;        // 15% of principal, ONE-TIME
    const CREDIT_LIFE_RATE      = 0.0045;      // 0.45% per month
    const SERVICE_FEE_MONTHLY   = 69;          // R69/month (NCA cap; previously R60 — bumped to NCA max)
    const VAT_RATE              = 0.15;
    const DAYS_PER_MONTH        = 30;

    // First loan of the year = no initiation fee
    const waiveInitiation = isFirstLoanOfYear || historyCount === 0;

    // ── Service fee (prorated first month) ──────────────────────────
    let totalServiceFees = 0;
    if (startDate) {
        const now = new Date();
        const paymentDate = new Date(startDate);
        const daysUntilPayment = Math.max(1, Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24)));
        const proratedDays = Math.min(daysUntilPayment, DAYS_PER_MONTH);
        const firstMonthFee = (SERVICE_FEE_MONTHLY / DAYS_PER_MONTH) * proratedDays;
        totalServiceFees = firstMonthFee + (period > 1 ? SERVICE_FEE_MONTHLY * (period - 1) : 0);
    } else {
        totalServiceFees = SERVICE_FEE_MONTHLY * period;
    }

    // ── Core components ─────────────────────────────────────────────
    const totalInterest       = amount * INTEREST_RATE_MONTHLY * period;
    const totalInitiationFees = waiveInitiation ? 0 : amount * INITIATION_FEE_RATE;
    const totalCreditLife     = amount * CREDIT_LIFE_RATE * period;
    const monthlyCreditLife   = amount * CREDIT_LIFE_RATE;

    // ── VAT on fees (NOT on interest, NOT on credit life) ───────────
    const vatAmount = (totalInitiationFees + totalServiceFees) * VAT_RATE;

    // ── Totals ──────────────────────────────────────────────────────
    const totalCostOfCredit = totalInterest + totalInitiationFees + totalServiceFees + totalCreditLife + vatAmount;
    const totalRepayment    = amount + totalCostOfCredit;
    const monthlyPayment    = totalRepayment / period;

    return {
        principal:            amount,
        period,
        totalInterest,
        totalInitiationFees,
        totalServiceFees,
        totalCreditLife,
        monthlyCreditLife,
        vatAmount,
        totalCostOfCredit,
        totalRepayment,
        monthlyPayment,
        interestRateMonthly:  INTEREST_RATE_MONTHLY,
        initiationRate:       waiveInitiation ? 0 : INITIATION_FEE_RATE,
        waiveInitiation,
        // Legacy aliases so existing callers that read these names don't break
        totalMonthlyFees:     totalServiceFees,
        totalRate:            INTEREST_RATE_MONTHLY + (waiveInitiation ? 0 : INITIATION_FEE_RATE),
        interestPortion:      INTEREST_RATE_MONTHLY,
    };
}

// ==========================================
//   STEP 5: RENDER LOAN CONFIGURATION
// ==========================================

async function renderLoanConfiguration(container) {
    // 1. Fetch History and Affordability Data if not in state
    if (inBranchState.targetUser && inBranchState.loanHistoryCount === undefined) {
        // Count completed/active loans — not empty-status rows
        const { data: loanData } = await supabase
            .from('loan_applications')
            .select('id, created_at')
            .eq('user_id', inBranchState.targetUser.id)
            .in('status', ['DISBURSED', 'OFFER_ACCEPTED', 'READY_TO_DISBURSE', 'ACTIVE', 'CONTRACT_SIGN', 'DEBICHECK_AUTH']);

        inBranchState.loanHistoryCount = loanData?.length || 0;

        // First loan of the calendar year: no initiation fee
        const currentYear = new Date().getFullYear();
        inBranchState.isFirstLoanOfYear = !loanData?.some(
            (l) => new Date(l.created_at).getFullYear() === currentYear
        );

        const { data: profile } = await supabase.from('financial_profiles')
            .select('affordability_ratio')
            .eq('user_id', inBranchState.targetUser.id).single();
        inBranchState.affordabilityLimit = profile?.affordability_ratio || 0;
    }

    const history = inBranchState.loanHistoryCount || 0;
    const limit = inBranchState.affordabilityLimit || 0;
    const isFirstLoanOfYear = inBranchState.isFirstLoanOfYear ?? true;

    // Rules: 1st-time applicants max 1 month; >3 loans max 6 months (ROADMAP)
    if (history === 0)      inBranchState.loanConfig.maxAllowedPeriod = 1;
    else if (history < 3)   inBranchState.loanConfig.maxAllowedPeriod = 1;
    else if (history >= 3)  inBranchState.loanConfig.maxAllowedPeriod = 6;

    const { amount, period, reason, startDate } = inBranchState.loanConfig;
    const calc = calculateLoanDetails(amount, period, startDate, history, isFirstLoanOfYear);

    // Max loan: solve for P where monthly repayment = affordability limit
    // monthlyPayment = (P + P*r*n + one_time_fees + P*cpi*n + vat) / n
    // Approximation: P_max = limit * n / (1 + r*n + cpi*n + initiation*(1+vat))
    const r = 0.05, cpi = 0.0045, init = calc.waiveInitiation ? 0 : 0.15, vatR = 0.15;
    let maxLoan = 10000;
    if (limit > 0) {
        const divisor = 1 + r * period + cpi * period + init * (1 + vatR) + (69 * period * (1 + vatR)) / Math.max(amount, 1);
        maxLoan = (limit * period) / divisor;
    }
    maxLoan = Math.floor(maxLoan / 100) * 100; // Round to nearest R100

    const exceedsAffordability = limit > 0 && calc.monthlyPayment > limit;
    const dateValidation = validateRepaymentDate(document.getElementById('loan-start-date')?.value || startDate);

    container.innerHTML = `
        <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-800">Configure Loan</h3>
                    <div class="text-right">
                        <span class="block text-[10px] uppercase text-gray-400 font-bold tracking-tight">Max for ${period} Month${period > 1 ? 's' : ''}</span>
                        <span class="text-sm font-black text-brand-accent">R ${maxLoan.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Amount (ZAR)</label>
                    <input type="number" id="loan-amount" value="${amount}" min="100" class="w-full border-gray-300 rounded-md focus:ring-brand-accent ${exceedsAffordability ? 'border-red-500 ring-1 ring-red-500' : ''}">
                    ${exceedsAffordability ? `
                    <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-start gap-2">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5"></i> 
                        <span><strong>Limit Exceeded:</strong> Max monthly payment is ${formatCurrency(limit)}. This loan requires ${formatCurrency(calc.monthlyPayment)}.</span>
                    </div>` : ''}
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period (Months)</label>
                    <select id="loan-period" class="w-full border-gray-300 rounded-md focus:ring-brand-accent">
                        <option value="1" ${period == 1 ? 'selected' : ''}>1 Month</option>
                        ${inBranchState.loanConfig.maxAllowedPeriod > 1 ? `
                            <option value="3" ${period == 3 ? 'selected' : ''}>3 Months</option>
                            <option value="6" ${period == 6 ? 'selected' : ''}>6 Months</option>
                            <option value="12" ${period == 12 ? 'selected' : ''}>12 Months</option>
                        ` : ''}
                    </select>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">First Repayment Date</label>
                    <input type="date" id="loan-start-date" class="w-full border-gray-300 rounded-md focus:ring-brand-accent"
                        value="${startDate ? (startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate.split('T')[0]) : ''}">
                    <div id="date-error-msg" class="${dateValidation?.valid === false ? '' : 'hidden'} text-xs text-red-600 mt-1 font-semibold flex items-center gap-1">
                        <i class="fa-solid fa-circle-exclamation"></i> <span id="error-text">${dateValidation?.reason || ''}</span>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Purpose of Loan</label>
                    <select id="loan-reason" class="w-full border-gray-300 rounded-md focus:ring-brand-accent">
                        <option value="Personal Loan"        ${(reason||'Personal Loan')==='Personal Loan'        ? 'selected':''}>Personal Loan</option>
                        <option value="Medical Expenses"     ${reason==='Medical Expenses'     ? 'selected':''}>Medical Expenses</option>
                        <option value="Education"            ${reason==='Education'            ? 'selected':''}>Education / School Fees</option>
                        <option value="Home Improvement"     ${reason==='Home Improvement'     ? 'selected':''}>Home Improvement</option>
                        <option value="Debt Consolidation"   ${reason==='Debt Consolidation'   ? 'selected':''}>Debt Consolidation</option>
                        <option value="Funeral"              ${reason==='Funeral'              ? 'selected':''}>Funeral Costs</option>
                        <option value="Vehicle"              ${reason==='Vehicle'              ? 'selected':''}>Vehicle / Transport</option>
                        <option value="Business"             ${reason==='Business'             ? 'selected':''}>Business / Working Capital</option>
                        <option value="Emergency"            ${reason==='Emergency'            ? 'selected':''}>Emergency</option>
                        <option value="Other"                ${reason==='Other'                ? 'selected':''}>Other</option>
                    </select>
                </div>
            </div>
            
            <div class="bg-gray-800 text-white p-6 rounded-lg shadow-md flex flex-col justify-between">
                <div>
                    <h4 class="text-gray-400 text-sm uppercase tracking-wider mb-2">Quote Summary</h4>
                    <div class="flex justify-between items-end border-b border-gray-700 pb-4 mb-4">
                        <span class="text-3xl font-bold text-white">${formatCurrency(amount)}</span>
                        <span class="text-gray-400 mb-1">Principal</span>
                    </div>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400">Total Annual Rate</span> 
                            <span class="text-lg font-bold text-orange-400">${(calc.totalRate * 100).toFixed(0)}%</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pl-4 py-2 bg-gray-900/50 rounded border-l-2 border-orange-500/50">
                            <div>
                                <span class="block text-[10px] uppercase text-gray-500 font-bold">Interest</span>
                                <span class="text-white font-medium">${(calc.interestPortion * 100).toFixed(1)}%</span>
                            </div>
                            <div>
                                <span class="block text-[10px] uppercase text-gray-500 font-bold">Initiation</span>
                                <span class="text-white font-medium">${(calc.initiationRate * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <span class="text-gray-400">Duration</span> 
                            <span>${period} Month${period > 1 ? 's' : ''}</span>
                        </div>
                        <div class="flex justify-between border-t border-gray-600 pt-2">
                            <span class="text-gray-300 font-semibold">Total Interest</span> 
                            <span class="font-bold">${formatCurrency(calc.totalInterest)}</span>
                        </div>
                    </div>
                </div>
                <div class="mt-6 pt-4 border-t border-gray-700">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400 font-medium">Total Repayment</span>
                        <span class="text-xl font-bold text-green-400">${formatCurrency(calc.totalRepayment)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-xs text-gray-500">Monthly Installment</span>
                        <span class="text-sm ${exceedsAffordability ? 'text-red-400 font-bold' : 'text-gray-300'}">${formatCurrency(calc.monthlyPayment)}</span>
                    </div>
                </div>
            </div>
        </div>`;

    // --- OVERRIDE WIZARD NEXT BUTTON LOGIC ---
    const nextBtn = document.getElementById('wizard-next-btn');
    if (nextBtn) {
        // We keep the button enabled so it is clickable, but we gate the logic
        nextBtn.disabled = false; 
        nextBtn.onclick = () => {
            // Check Date Validity
            const dateVal = document.getElementById('loan-start-date').value;
            const validation = validateRepaymentDate(dateVal);
            
            if (!dateVal) {
                return showToast("Please select a first repayment date.", "warning");
            }
            if (!validation.valid) {
                return showToast(`Invalid Date: ${validation.reason}`, "error");
            }

            // Check Affordability
            if (exceedsAffordability) {
                return showToast(`Loan Unaffordable: Max allowed is R ${maxLoan.toLocaleString()}`, "error");
            }

            // Check Minimum Amount
            if (amount < 100) {
                return showToast("Minimum loan amount is R 100.00", "warning");
            }

            // If all good, proceed
            handleNextStep();
        };
    }

    const updateState = (e) => { 
        const id = e.target.id;
        const val = e.target.value;

        if (id === 'loan-amount') inBranchState.loanConfig.amount = Number(val);
        if (id === 'loan-period') inBranchState.loanConfig.period = Number(val);
        if (id === 'loan-start-date') inBranchState.loanConfig.startDate = val;
        if (id === 'loan-reason') inBranchState.loanConfig.reason = val;

        renderLoanConfiguration(container); 
    };
    
    ['loan-amount', 'loan-period', 'loan-start-date', 'loan-reason'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateState);
    });
}
// ==========================================
//   STEP 6: DOCUMENTS (ADMIN FOLDER STRATEGY)
// ==========================================

async function renderDocumentCheck(container) {
    if(!inBranchState.targetUser) return;
    
    // 1. Get Current Admin ID (You)
    const { data: { session } } = await supabase.auth.getSession();
    const adminId = session?.user?.id;
    
    if (!adminId) {
        showToast("Error: Could not identify Admin user", "error");
        return;
    }

    // 2. Ensure Application ID Exists
    let applicationId = inBranchState.creditCheck?.applicationId;
    if (!applicationId) {
        // ... (Keep your existing auto-create logic here) ...
        try {
            const { data: newApp, error } = await supabase.from('loan_applications').insert([{ 
                user_id: inBranchState.targetUser.id, 
                status: 'STARTED', 
                amount: inBranchState.loanConfig.amount || 0, 
                term_months: inBranchState.loanConfig.period || 1, 
                loan_purpose: inBranchState.loanConfig?.reason || 'Personal Loan',
                source: 'IN_BRANCH',
                created_by_admin: adminId
            }]).select().single();
            if (error) throw error;
            applicationId = newApp.id;
            inBranchState.creditCheck.applicationId = applicationId;
        } catch (err) { console.error(err); }
    }

    container.innerHTML = `
        <div class="max-w-2xl mx-auto bg-white p-6 rounded-lg border border-gray-200 mt-4">
            <h3 class="text-lg font-bold text-gray-800 mb-6">Required Documents</h3>
            <div class="space-y-4" id="docs-list"><div class="p-4 text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div></div>
        </div>`;
        
    const docTypes = [
          { key: 'idcard', label: 'ID Document' }, 
          { key: 'till_slip', label: 'Latest Payslip' }, 
          { key: 'bank_statement', label: 'Bank Statement' }
    ];
    
    const listHtml = await Promise.all(docTypes.map(async (doc) => {
        // Fetch from DB
        const { data: dbRecords } = await supabase.from('document_uploads')
            .select('*').eq('user_id', inBranchState.targetUser.id).eq('file_type', doc.key)
            .order('created_at', { ascending: false }).limit(1);

        const record = dbRecords?.[0];
        const exists = !!record;
        const statusColor = exists ? 'text-green-600 bg-green-100' : 'text-gray-500 bg-gray-200';
        const icon = exists ? 'fa-check-circle' : 'fa-upload';
        
        let viewButton = '';
        if (record?.file_path) {
            viewButton = `<button class="text-xs text-blue-600 underline self-center mr-2 view-doc-btn" data-path="${record.file_path}">View</button>`;
        }

        return `
            <div class="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${statusColor}"><i class="fa-solid ${icon}"></i></div>
                    <div><p class="font-medium text-gray-900">${doc.label}</p><p class="text-xs text-gray-500">${exists ? 'Uploaded' : 'Missing'}</p></div>
                </div>
                <div class="flex gap-2">${viewButton}
                    <label class="cursor-pointer bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50">
                        ${exists ? 'Replace' : 'Upload'}
                        <input type="file" class="hidden doc-upload" data-type="${doc.key}" accept=".pdf,.jpg,.png,.jpeg">
                    </label>
                </div>
            </div>`;
    }));
    
    document.getElementById('docs-list').innerHTML = listHtml.join('');
    
    // VIEW HANDLER
    document.querySelectorAll('.view-doc-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            try {
                const { data, error } = await supabase.storage.from('client_docs').createSignedUrl(e.target.dataset.path, 60);
                if (error) throw error;
                window.open(data.signedUrl, '_blank');
            } catch (err) { showToast(err.message, 'error'); }
        });
    });
    
    // UPLOAD HANDLER
    document.querySelectorAll('.doc-upload').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0]; 
            if(!file) return;
            const type = e.target.dataset.type;
            
            // UI Update
            const label = e.target.parentElement; 
            label.childNodes[0].textContent = 'Uploading...';
            
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${type}_${Date.now()}.${fileExt}`;
                
                // --- THE KEY CHANGE IS HERE ---
                // Upload to ADMIN folder (You), but name it with CLIENT ID
                const filePath = `${adminId}/${inBranchState.targetUser.id}_${fileName}`;
                
                // 1. Upload to Storage
                const { error: uploadError } = await supabase.storage
                .from('client_docs')
                .upload(filePath, file, { 
                    upsert: true // Add this object here
                });
                
                if (uploadError) throw new Error("Storage: " + uploadError.message);

                // 2. Register in Database (Using the System Function)
                const { error: dbError } = await supabase.rpc('register_admin_upload', {
                    p_user_id: inBranchState.targetUser.id,
                    p_app_id: applicationId,
                    p_file_name: fileName,
                    p_original_name: file.name,
                    p_file_path: filePath, // Saving the Admin path so we can find it later
                    p_file_type: type,
                    p_mime_type: file.type,
                    p_file_size: file.size
                });

                if (dbError) throw new Error("Database: " + dbError.message);
                
                showToast('Uploaded!', 'success');
                await renderDocumentCheck(container); 
                
            } catch (err) { 
                console.error(err);
                showToast(err.message, 'error'); 
            } finally {
                label.childNodes[0].textContent = 'Upload';
            }
        });
    });
}

// ==========================================
//   STEP 7: SECURE CONFIRMATION & BANKING
// ==========================================
async function renderConfirmation(container) {
    if(!inBranchState.targetUser) return;

    // 1. Calculations
    const { amount, period, startDate } = inBranchState.loanConfig;
    const history = inBranchState.loanHistoryCount || 0;
    const calc = calculateLoanDetails(amount, period, startDate, history);
    const applicantName = inBranchState.targetUser.full_name;

    // Fetch existing bank accounts for dropdown
    const { data: accounts } = await supabase.from('bank_accounts').select('*').eq('user_id', inBranchState.targetUser.id);
    const firstDebitDate = startDate ? new Date(startDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set';

    container.innerHTML = `
        <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6 mt-4 animate-fade-in">
            <div class="md:col-span-3 space-y-6">
                <div class="bg-white p-8 rounded-2xl border border-gray-200 shadow-xl">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <i class="fa-solid fa-building-columns text-brand-accent"></i> Payout Account
                        </h3>
                        <button id="toggle-new-bank" class="text-xs font-bold text-brand-accent bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">+ ADD NEW</button>
                    </div>
                    
                    <div class="space-y-6">
                        <div>
                            <select id="bank-select" class="w-full border-gray-300 rounded-lg py-3 px-4 bg-white">
                                <option value="">-- Select Verified Account --</option>
                                ${accounts?.map(acc => `<option value="${acc.id}">${acc.bank_name} - ****${acc.account_number.slice(-4)}</option>`).join('')}
                            </select>
                        </div>

                        <div id="new-bank-form" class="hidden p-6 bg-gray-900 rounded-2xl border border-gray-700 space-y-4 animate-fade-in">
                            <div class="grid grid-cols-2 gap-4">
                                <select id="new-bank-name" class="bg-gray-800 text-white rounded-lg py-2 px-3">
                                    <option value="" disabled selected>Select bank</option>
                                    ${Object.keys(BANK_BRANCH_CODES).map(bank => `<option value="${bank}">${bank}</option>`).join('')}
                                </select>
                                <select id="new-acc-type" class="bg-gray-800 text-white rounded-lg py-2 px-3">
                                    <option value="savings">Savings</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <input type="text" id="new-acc-number" inputmode="numeric" placeholder="Account Number" class="bg-gray-800 text-white rounded-lg py-2 px-3">
                                <input type="text" id="new-branch-code" inputmode="numeric" placeholder="Branch Code (auto-filled)" readonly class="bg-gray-800 text-white rounded-lg py-2 px-3 opacity-70 cursor-not-allowed">
                            </div>
                            <button id="btn-save-bank" class="w-full bg-brand-accent text-white py-3 rounded-xl font-bold">Link Account</button>
                        </div>
                    </div>
                </div>

                <div id="bank-preview-container" class="hidden p-6 bg-white border-2 border-brand-accent rounded-2xl shadow-lg animate-fade-in">
                    <p class="text-[10px] font-bold text-brand-accent uppercase mb-1">Selected Payout Account</p>
                    <h4 id="preview-bank-name" class="text-xl font-black text-gray-900">---</h4>
                    <p id="preview-acc-number" class="text-sm text-gray-600 font-mono">---</p>
                </div>

                <div class="p-6 bg-orange-50 border border-orange-100 rounded-2xl">
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" id="admin-consent" class="mt-1 w-5 h-5 text-orange-600 rounded border-orange-300">
                        <span class="text-xs text-gray-700 leading-tight">I confirm I have physically verified the identity of <strong>${applicantName}</strong> and confirmed the banking details.</span>
                    </label>
                </div>
            </div>

            <div class="md:col-span-2">
                <div class="bg-gray-800 text-white rounded-2xl shadow-xl overflow-hidden sticky top-4 border border-gray-700">
                    <div class="p-4 bg-gray-900/50 border-b border-gray-700 text-center"><h4 class="text-[10px] font-bold uppercase text-brand-accent">Loan Offer Summary</h4></div>
                    <div class="p-8">
                        <div class="flex justify-between items-end border-b border-gray-700 pb-6 mb-6">
                            <span class="text-4xl font-black text-white">${formatCurrency(amount)}</span>
                            <span class="text-gray-400 text-xs font-bold mb-1 uppercase">Principal</span>
                        </div>
                        <div class="space-y-4 text-sm">
                            <div class="flex justify-between items-center"><span class="text-gray-400">Monthly Payout</span><span class="text-2xl font-black text-brand-accent">${formatCurrency(calc.monthlyPayment)}</span></div>
                            <div class="flex justify-between items-center"><span class="text-gray-400">Total Repayable</span><span class="font-bold text-green-400 text-lg">${formatCurrency(calc.totalRepayment)}</span></div>
                            <div class="flex justify-between pt-2 border-t border-gray-700"><span class="text-gray-400">Term Duration</span><span class="font-medium">${period} Month${period > 1 ? 's' : ''}</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">First Debit Date</span><span class="font-bold text-orange-300">${firstDebitDate}</span></div>
                        </div>
                    </div>
                    <div class="p-6 bg-gray-900/80 border-t border-gray-700">
                        <button id="wizard-next-btn" class="w-full bg-brand-accent hover:bg-orange-600 text-white py-4 rounded-xl font-black text-lg shadow-2xl transition-all disabled:opacity-50">SUBMIT APPLICATION</button>
                        <p class="text-[9px] text-gray-500 mt-4 italic text-center uppercase tracking-tighter">
                            ${inBranchState.creditCheck.applicationId ? `Managing Application #${inBranchState.creditCheck.applicationId}` : 'New Loan Application'}
                        </p>
                    </div>
                </div>
            </div>
        </div>`;

    // 3. Logic Listeners
    const bankSelect = document.getElementById('bank-select');
    const newBankForm = document.getElementById('new-bank-form');
    const preview = document.getElementById('bank-preview-container');

    const updatePreview = () => {
        const val = bankSelect.value;
        const isFormOpen = !newBankForm.classList.contains('hidden');
        if(!val && !isFormOpen) { preview.classList.add('hidden'); return; }
        preview.classList.remove('hidden');
        if(isFormOpen) {
            document.getElementById('preview-bank-name').innerText = document.getElementById('new-bank-name').value || '...';
            document.getElementById('preview-acc-number').innerText = document.getElementById('new-acc-number').value || '...';
        } else {
            const acc = accounts.find(a => a.id == val);
            if(acc) {
                document.getElementById('preview-bank-name').innerText = acc.bank_name;
                document.getElementById('preview-acc-number').innerText = acc.account_number;
            }
        }
    };

    document.getElementById('toggle-new-bank').onclick = () => { newBankForm.classList.toggle('hidden'); bankSelect.value = ""; updatePreview(); };
    bankSelect.onchange = () => { newBankForm.classList.add('hidden'); updatePreview(); };
    document.getElementById('new-bank-name').onchange = (e) => {
        document.getElementById('new-branch-code').value = BANK_BRANCH_CODES[e.target.value] || '';
        updatePreview();
    };
    document.getElementById('new-acc-number').oninput = updatePreview;

    document.getElementById('admin-consent').onchange = (e) => { document.getElementById('wizard-next-btn').disabled = !e.target.checked; };
    document.getElementById('wizard-next-btn').onclick = handleFinalSubmit;

    // Save Bank Handler
    document.getElementById('btn-save-bank').onclick = async () => {
        const payload = {
            user_id: inBranchState.targetUser.id,
            bank_name: document.getElementById('new-bank-name').value,
            account_holder: applicantName,
            account_number: document.getElementById('new-acc-number').value,
            branch_code: document.getElementById('new-branch-code').value,
            account_type: document.getElementById('new-acc-type').value,
            is_verified: true,
            created_by_admin: (await supabase.auth.getUser()).data.user.id
        };
        const { data: newAcc, error } = await supabase.from('bank_accounts').insert([payload]).select().single();
        if(!error) { await renderConfirmation(container); document.getElementById('bank-select').value = newAcc.id; updatePreview(); }
    };
}
// ==========================================
//   NAVIGATION & UTILS
// ==========================================

function handleNextStep() { 
    if(inBranchState.step < 7) { 
        inBranchState.step++; 
        renderWizard(); 
    } 
}

document.addEventListener('click', (e) => { 
    // Wizard Navigation
    if(e.target.id === 'wizard-prev-btn' && inBranchState.step > 1) { 
        inBranchState.step--; 
        renderWizard(); 
    }
      
    const cancelBtn = e.target.closest('#back-to-list-btn');
    if (cancelBtn) {
        if (!cancelBtn.dataset.confirming) {
            // First click: Change the button state and show a toast
            cancelBtn.dataset.confirming = "true";
            cancelBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Click again to Confirm';
            cancelBtn.classList.add('text-red-600', 'font-bold');
            
            showToast('Unsaved progress will be lost. Click again to exit.', 'warning');

            // Reset the button back to normal if they don't click again within 3 seconds
            setTimeout(() => {
                cancelBtn.dataset.confirming = "";
                cancelBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Cancel';
                cancelBtn.classList.remove('text-red-600', 'font-bold');
            }, 3000);
        } else {
            // Second click: The admin has confirmed, so exit now
            document.getElementById('in-branch-view').classList.add('hidden'); 
            document.getElementById('applications-list-view').classList.remove('hidden'); 
            
            // Cleanup button state for next time
            cancelBtn.dataset.confirming = "";
            cancelBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Cancel';
            cancelBtn.classList.remove('text-red-600', 'font-bold');
        }
    }

    // Localhost Logout Fix
    if(e.target.id === 'sign-out-btn' || e.target.closest('#sign-out-btn')) {
        e.preventDefault();
        supabase.auth.signOut().then(() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
        });
    }
});

async function handleBulkSync() {
  const syncButton = document.getElementById('sync-offered-btn'); 
  if (!syncButton) return;
  
  if (!confirm('Sync all OFFERED applications?')) return;
  
  syncButton.disabled = true; 
  syncButton.innerHTML = 'Syncing...';
  
  try { 
      await syncAllOfferedApplications(); 
      showToast('Synced!', 'success'); 
      await loadApplications(); 
  } catch (e) { 
      showToast(e.message, 'error'); 
  } finally { 
      syncButton.disabled = false; 
      syncButton.innerHTML = 'Sync Offered'; 
  }
}

const renderApplications = (apps) => { 
    const tb = document.getElementById('applications-table-body'); 
    const countEl = document.getElementById('visible-count');
    
    if(!tb) return; 
    
    if (countEl) countEl.textContent = apps.length;

    if (apps.length === 0) {
        tb.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-sm text-gray-400">No applications match your criteria.</td></tr>`;
        return;
    }
    
    tb.innerHTML = apps.map(app => {
        const profile    = app.profiles || {};
        const clientNum  = profile.client_number ? String(profile.client_number) : '';
        const loanSeq    = app.loan_number ? `L${String(app.loan_number).padStart(4,'0')}` : '';
        const reference  = clientNum && loanSeq ? `${clientNum}-${loanSeq}` : (loanSeq || app.id.slice(0,8));
        const statusInfo = getStatusDisplay(app.status);
        const isDefault  = ['IN_ARREARS','IN_DEFAULT'].includes(app.status);
        const purpose    = app.loan_purpose || app.purpose || '';

        return `
        <tr class="hover:bg-surface-container-low transition-colors group border-b border-outline-variant/10 ${isDefault ? 'bg-red-50' : ''}">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border border-outline-variant/20 bg-surface-container text-outline flex-shrink-0">
                        ${(profile.full_name || 'A').charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-on-surface">${profile.full_name || 'N/A'}</div>
                        <div class="text-[10px] font-mono text-outline tracking-wide">${reference}</div>
                        ${purpose ? `<div class="text-[10px] text-gray-400 mt-0.5">${purpose}</div>` : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-mono font-semibold text-on-surface">${formatCurrency(app.amount)}</div>
                <div class="text-[10px] text-outline">${app.term_months ? app.term_months + ' mo' : ''}</div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-full text-[11px] font-bold" style="background:${statusInfo.bg};color:${statusInfo.color};">
                    ${statusInfo.label}
                </span>
                ${isDefault ? '<div class="text-[10px] text-red-600 font-bold mt-1">⚠ 3% default applies</div>' : ''}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs text-outline font-medium">${formatDate(app.created_at)}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <a href="/admin/application-detail?id=${app.id}"
                   class="text-outline hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-container-low inline-block">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                </a>
            </td>
        </tr>`;
    }).join('');
};

const renderSearchSuggestions = (apps) => {
    const searchSuggestions = document.getElementById('search-suggestions'); 
    if (!searchSuggestions) return;
    
    if (apps.length === 0) { 
        searchSuggestions.innerHTML = ''; 
        searchSuggestions.classList.add('hidden'); 
        return; 
    }
    
    searchSuggestions.innerHTML = apps.map(app => `
        <a href="/admin/application-detail?id=${app.id}" class="block p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-200 last:border-b-0">
            <p class="font-semibold text-gray-800">${app.profiles?.full_name || 'N/A'}</p>
            <p class="text-xs text-gray-500">ID: ${app.id} | Status: ${app.status}</p>
        </a>
    `).join('');
    
    searchSuggestions.classList.remove('hidden');
};

/**
 * @param {boolean} resetPage 
 */
/**
 * @param {boolean} resetPage - Set to true when filters change to return to page 1.
 */
const filterAndSearch = (resetPage = true) => { 
    if (resetPage) currentPageApps = 1;

    const term = document.getElementById('search-input')?.value.toLowerCase().trim() || ''; 
    const status = document.getElementById('status-filter')?.value || 'all'; 
    
    filteredApplications = allApplications.filter(app => {
        // 1. Status Match
        const PENDING_STATUSES = ['STARTED','BUREAU_CHECKING','BUREAU_OK','BUREAU_REFER','BANK_LINKING','AFFORD_OK','AFFORD_REFER','OFFERED','OFFER_ACCEPTED','CONTRACT_SIGN','DEBICHECK_AUTH','APPROVED'];
        const statusMatch = status === 'all' ? true
            : status === 'pending' ? PENDING_STATUSES.includes(app.status)
            : app.status === status;

        // 2. Text Match (Name, ID, or Amount)
        const textMatch = !term || 
            (app.profiles?.full_name || '').toLowerCase().includes(term) || 
            String(app.id).toLowerCase().includes(term) ||
            String(app.amount).includes(term);

        // 3. Branch Lock Logic
        let branchMatch = false;
        if (userRole === 'super_admin') {
            // Super Admins: Can see everything
            branchMatch = true; 
        } else {
            // Admins/Staff: Locked to their own branch_id from their profile
            branchMatch = (app.branch_id === currentAdminProfile?.branch_id);
        }

        return statusMatch && textMatch && branchMatch;
    }); 
    
    // Pagination Slicing
    const totalPages = Math.ceil(filteredApplications.length / itemsPerPageApps) || 1;
    const start = (currentPageApps - 1) * itemsPerPageApps;
    const paginatedData = filteredApplications.slice(start, start + itemsPerPageApps);

    renderApplications(paginatedData);
    renderAppPaginationControls(totalPages, filteredApplications.length);
    
    // Handle Search Suggestions (Dropdown)
    const searchInput = document.getElementById('search-input');
    if (document.activeElement === searchInput && term.length > 1) {
        renderSearchSuggestions(filteredApplications.slice(0, 5));
    } else {
        document.getElementById('search-suggestions')?.classList.add('hidden');
    }
};

async function loadApplications() { 
    const { data, error } = await fetchLoanApplications(); 
    if(!error) { 
        allApplications = data; 
        filterAndSearch(); 
    } else { 
        console.error(error); 
    }
}

// --- Init ---
function exportApplicationsCSV() {
    const data = filteredApplications.length ? filteredApplications : allApplications;
    if (!data.length) { alert('No data to export.'); return; }

    const headers = [
        'Reference', 'Client Name', 'ID Number', 'Loan Amount', 'Term (months)',
        'Status', 'Purpose', 'Date Applied', 'Next of Kin', 'NOK Phone'
    ];

    const rows = data.map(app => {
        const p = app.profiles || {};
        const clientNum = p.client_number || '';
        const loanSeq   = app.loan_number ? `L${String(app.loan_number).padStart(4,'0')}` : app.id.slice(0,8);
        const ref = clientNum ? `${clientNum}-${loanSeq}` : loanSeq;
        const status = getStatusDisplay(app.status).label;
        return [
            `"${ref}"`,
            `"${(p.full_name||'').replace(/"/g,'""')}"`,
            p.identity_number || '',
            app.amount || 0,
            app.term_months || '',
            `"${status}"`,
            `"${(app.loan_purpose||app.purpose||'').replace(/"/g,'""')}"`,
            app.created_at?.slice(0,10) || '',
            `"${(p.nok_name||'').replace(/"/g,'""')}"`,
            p.nok_phone || ''
        ].join(',');
    });

    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `applications_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

function attachEventListeners() {
    document.getElementById('search-input')?.addEventListener('input', () => filterAndSearch(true));
    document.getElementById('status-filter')?.addEventListener('change', () => filterAndSearch(true));
    document.getElementById('create-app-btn')?.addEventListener('click', startInBranchFlow);
    document.getElementById('btn-export-applications')?.addEventListener('click', exportApplicationsCSV);
    document.getElementById('sync-offered-btn')?.addEventListener('click', handleBulkSync);
    document.addEventListener('click', (e) => { 
        
        const sug = document.getElementById('search-suggestions'); 
        if (sug && !document.getElementById('search-input').contains(e.target) && !sug.contains(e.target)) {
            sug.classList.add('hidden'); 
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => { 
    // 1. Initialize the shared layout and check authentication
    const auth = await initLayout(); 
    
    if (auth) { 
        
        userRole = auth.role; 
        

        const [profile, branchesResult] = await Promise.all([
            getCurrentAdminProfile(),
            fetchBranches()
        ]);
        
        currentAdminProfile = profile;
        branches = branchesResult.data || [];

        renderPageContent();

        await loadApplications();

        // Pre-apply filter from URL param e.g. ?filter=pending (from dashboard "Review Now")
        const urlFilter = new URLSearchParams(window.location.search).get('filter');
        if (urlFilter === 'pending') {
            const sel = document.getElementById('status-filter');
            if (sel) { sel.value = 'pending'; filterAndSearch(true); }
        }
    }
});
// --- Final Application Submission ---
async function handleFinalSubmit() {
    const nextBtn = document.getElementById('wizard-next-btn');
    if (!nextBtn) return; 

    nextBtn.disabled = true;
    nextBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const { amount, period, startDate, reason } = inBranchState.loanConfig;
        const history = inBranchState.loanHistoryCount || 0;
        const isFirstLoanOfYear = inBranchState.isFirstLoanOfYear ?? true;

        // Generate the full NCA-compliant fee breakdown
        const calc = calculateLoanDetails(amount, period, startDate, history, isFirstLoanOfYear);
        
        let bankId = document.getElementById('bank-select').value;

        // Handle new bank account creation if needed
        if (bankId === 'new') {
            const newBank = {
                user_id: inBranchState.targetUser.id,
                bank_name: document.getElementById('new-bank-name').value,
                account_holder: inBranchState.targetUser.full_name,
                account_number: document.getElementById('new-account-number').value,
                branch_code: document.getElementById('new-branch-code').value,
                account_type: document.getElementById('new-account-type').value.toLowerCase(),
                is_verified: true,
                created_by_admin: (await supabase.auth.getUser()).data.user.id
            };

            const { data: savedBank, error: bankError } = await supabase
                .from('bank_accounts')
                .insert([newBank])
                .select()
                .single();

            if (bankError) throw new Error("Bank Save Failed: " + bankError.message);
            bankId = savedBank.id;
        }

        if (!bankId) throw new Error("Please select or add a bank account.");

        // --- PREPARE UPDATE PAYLOAD (With Branch ID) ---
        const updatePayload = {
            status: 'AFFORD_OK', 
            amount: amount,
            term_months: period,
            bank_account_id: bankId,
            updated_at: new Date().toISOString(),
            offer_principal: amount,
            offer_interest_rate: calc.interestRateMonthly,
            offer_total_interest: calc.totalInterest,
            offer_total_initiation_fees: calc.totalInitiationFees,
            offer_monthly_repayment: calc.monthlyPayment,
            offer_total_repayment: calc.totalRepayment,
            offer_total_admin_fees: calc.totalServiceFees,
            offer_credit_life_monthly: calc.monthlyCreditLife,
            offer_credit_life_total:   calc.totalCreditLife,
            repayment_start_date: startDate,
            loan_purpose: reason || 'Personal Loan',

            branch_id: inBranchState.targetUser?.branch_id || currentAdminProfile?.branch_id,

            offer_details: {
                first_repayment_date: startDate,
                interest_rate_monthly: calc.interestRateMonthly,
                initiation_rate: calc.initiationRate,
                credit_life_rate: 0.0045,
                vat_amount: calc.vatAmount,
                total_cost_of_credit: calc.totalCostOfCredit,
                waive_initiation: calc.waiveInitiation,
                source: "In-Branch Admin Terminal"
            },
            notes: `In-branch application for ${inBranchState.targetUser.full_name}. Purpose: ${reason || 'Personal Loan'}. Verified by Admin.`
        };

        // Update Supabase
        const { error: appError } = await supabase
            .from('loan_applications')
            .update(updatePayload)
            .eq('id', inBranchState.creditCheck.applicationId);

        if (appError) throw appError;

        showToast("Application Submitted Successfully!", "success");
        setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
        console.error("Submission Error:", err);
        showToast(err.message, "error");
        nextBtn.disabled = false;
        nextBtn.innerHTML = 'Submit Application';
    }
}
function renderAppPaginationControls(totalPages, totalRecords) {
    let container = document.getElementById('app-pagination-container');
    const listView = document.getElementById('applications-list-view');
    const visibleCount = document.getElementById('visible-count');

    // Update the record count displayed in the UI
    if (visibleCount) visibleCount.textContent = totalRecords;

    // Create the container if it doesn't exist yet
    if (!container) {
        container = document.createElement('div');
        container.id = 'app-pagination-container';
        container.className = 'flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50';
        listView.appendChild(container);
    }

    // If there is only one page, show status text but hide buttons
    if (totalPages <= 1) {
        container.innerHTML = `<span class="text-xs text-gray-400">Showing all records</span>`;
        return;
    }

    // Build the navigation buttons
    container.innerHTML = `
        <span class="text-xs font-bold text-gray-500 uppercase tracking-tight">Page ${currentPageApps} of ${totalPages}</span>
        <div class="flex gap-2">
            <button onclick="window.changePageApps(${currentPageApps - 1})" ${currentPageApps === 1 ? 'disabled' : ''} 
                class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
                Prev
            </button>
            <button onclick="window.changePageApps(${currentPageApps + 1})" ${currentPageApps === totalPages ? 'disabled' : ''} 
                class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
                Next
            </button>
        </div>
    `;
}

// Global function to handle page switching
window.changePageApps = (page) => {
    currentPageApps = page;
    filterAndSearch(false); 
};