import { initLayout } from '../shared/layout.js';
import { formatCurrency, formatDate } from '../shared/utils.js';
import {
  fetchApplicationDetail,
  updateApplicationStatus,
  createPayout,
  createDisbursement,
  getDisbursementsByApplication,
  getCashSendConfig,
  deletePayout,
  updateApplicationNotes
} from '../services/dataService.js';
import { supabase } from '../services/supabaseClient.js';
import { apiFetch } from '../shared/apiFetch.js';
import { 
  sendContract, 
  getSubmissionStatus, 
  getApplicationSubmissions, 
  getEmbedUrl, 
  resendContract, 
  voidSubmission, 
  isDocuSealConfigured,
  getSubmitterIdFromSubmission,
  getSubmitterDetails
} from '../services/docusealService.js';

let currentApplication = null;
let actionToConfirm = null;

// ─────────────────────────────────────────────────────────────────────────────
// SACRRA COMPLIANCE GATE
// Runs before any disbursement/approval to ensure all Layout 700v2 fields exist
// ─────────────────────────────────────────────────────────────────────────────
function _luhnOk(id) {
    if (!/^\d{13}$/.test(id)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        let n = parseInt(id[i]);
        if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
    }
    return (10 - sum % 10) % 10 === parseInt(id[12]);
}
function _dobFromId(id) {
    if (!/^\d{13}$/.test(id)) return null;
    const yy = parseInt(id.slice(0,2)), mm = parseInt(id.slice(2,4)), dd = parseInt(id.slice(4,6));
    const cent = yy >= 26 ? 1900 : 2000;
    const d = new Date(cent + yy, mm - 1, dd);
    if (d.getMonth() !== mm - 1) return null;
    return `${cent + yy}${String(mm).padStart(2,'0')}${String(dd).padStart(2,'0')}`;
}
function _genderFromId(id) {
    return !/^\d{13}$/.test(id) ? null : parseInt(id[6]) < 5 ? 'F' : 'M';
}

function sacrraGate(app, profile) {
    const id = String(profile?.identity_number || '').replace(/\s/g, '');
    const issues = [];

    // 1. SA ID — 13 digits + Luhn
    if (!id || id.length !== 13) {
        issues.push({ field: 'identity_number', source: 'profile', label: 'SA ID Number', hint: '13-digit SA ID', value: id || '', type: 'text', pattern: '\\d{13}' });
    } else if (!_luhnOk(id)) {
        issues.push({ field: 'identity_number', source: 'profile', label: 'SA ID Number', hint: 'ID fails Luhn checksum — check for typo', value: id, type: 'text', pattern: '\\d{13}' });
    }

    // 2. Date of birth — derived from ID if possible
    const dobRaw   = String(profile?.date_of_birth || '').replace(/[-\/\s]/g, '').slice(0, 8);
    const expectedDob = id.length === 13 ? _dobFromId(id) : null;
    if (!dobRaw || dobRaw.length !== 8) {
        issues.push({ field: 'date_of_birth', source: 'profile', label: 'Date of Birth', hint: 'YYYY-MM-DD', value: expectedDob ? `${expectedDob.slice(0,4)}-${expectedDob.slice(4,6)}-${expectedDob.slice(6,8)}` : '', type: 'date' });
    }

    // 3. Gender — must match ID
    const gender = String(profile?.gender || '').toUpperCase().charAt(0);
    const expectedGender = id.length === 13 ? _genderFromId(id) : null;
    if (!gender || !['M','F'].includes(gender)) {
        issues.push({ field: 'gender', source: 'profile', label: 'Gender', hint: 'Must be M or F', value: expectedGender || '', type: 'select', options: ['M','F'] });
    } else if (expectedGender && gender !== expectedGender) {
        issues.push({ field: 'gender', source: 'profile', label: 'Gender', hint: `ID says ${expectedGender} — please correct`, value: expectedGender, type: 'select', options: ['M','F'] });
    }

    // 4. Surname (max 25 chars)
    const surname = String(profile?.last_name || profile?.full_name?.split(' ').pop() || '').trim();
    if (!surname) {
        issues.push({ field: 'last_name', source: 'profile', label: 'Surname', hint: 'Max 25 characters', value: '', type: 'text', maxlength: 25 });
    } else if (surname.length > 25) {
        issues.push({ field: 'last_name', source: 'profile', label: 'Surname', hint: `Too long: ${surname.length}/25 chars`, value: surname.slice(0, 25), type: 'text', maxlength: 25 });
    }

    // 5. First names (max 14 chars)
    const firstName = String(profile?.first_name || profile?.full_name?.split(' ')[0] || '').trim();
    if (!firstName) {
        issues.push({ field: 'first_name', source: 'profile', label: 'First Name(s)', hint: 'Max 14 characters', value: '', type: 'text', maxlength: 14 });
    } else if (firstName.length > 14) {
        issues.push({ field: 'first_name', source: 'profile', label: 'First Name(s)', hint: `Too long: ${firstName.length}/14 chars`, value: firstName.slice(0, 14), type: 'text', maxlength: 14 });
    }

    // 6. Residential address
    if (!String(profile?.address || '').trim()) {
        issues.push({ field: 'address', source: 'profile', label: 'Street Address', hint: 'Required for SACRRA submission', value: '', type: 'text' });
    }

    // 7. Suburb
    if (!String(profile?.suburb_area || '').trim()) {
        issues.push({ field: 'suburb_area', source: 'profile', label: 'Suburb / Area', hint: 'Required — Experian also needs this', value: '', type: 'text' });
    }

    // 8. Postal code (4 digits)
    const postal = String(profile?.postal_code || '').replace(/\s/g, '');
    if (!postal || !/^\d{4}$/.test(postal)) {
        issues.push({ field: 'postal_code', source: 'profile', label: 'Postal Code', hint: 'Exactly 4 digits', value: postal || '', type: 'text', pattern: '\\d{4}' });
    }

    // 9. Monthly installment
    if (!app?.offer_monthly_repayment || Number(app.offer_monthly_repayment) <= 0) {
        issues.push({ field: 'offer_monthly_repayment', source: 'application', label: 'Monthly Installment', hint: 'Run affordability & generate offer first', value: '', type: 'number', readonly: true });
    }

    // 10. Repayment start date (date opened)
    if (!app?.repayment_start_date) {
        issues.push({ field: 'repayment_start_date', source: 'application', label: 'Loan Start Date', hint: 'Set from the sidebar date picker', value: '', type: 'date', readonly: true });
    }

    return { passed: issues.length === 0, issues };
}
let isContractDeclinedUI = false;
let originalStatusBeforeDecline = null;
let contractStatusPoller = null;
let hasAutoAdvancedToSigned = false;
let isHandlingContractCompletion = false;
const CONTRACT_POLL_INTERVAL = 5000;

// --- 1. Status Options (RESTRICTED) ---
const ALL_STATUS_OPTIONS = [
    { value: 'STARTED', label: 'Step 1: New Application' },
    { value: 'BANK_LINKING', label: 'Bank Analysis' },
    { value: 'AFFORD_OK', label: 'Step 3: Affordability OK' },
    { value: 'AFFORD_REFER', label: 'Affordability Refer' },
    { value: 'OFFERED', label: 'Step 4: Contract Sent' },
    { value: 'OFFER_ACCEPTED', label: 'Contract Signed' },
    { value: 'READY_TO_DISBURSE', label: 'Step 6: Approved — Queue Disburse' },
    { value: 'DECLINED', label: 'Declined' }
];

// --- 2. Page Template ---
const pageTemplate = `
<div id="application-detail-content" class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div id="loading-state" class="text-center p-20">
    <span class="material-symbols-outlined text-4xl animate-spin" style="color:var(--color-primary)">progress_activity</span>
    <p class="mt-4 text-outline font-medium animate-pulse">Loading Complete Application Data...</p>
  </div>

  <div id="page-header" class="mb-8 hidden animate-fade-in">
    <nav class="flex items-center gap-2 text-sm text-outline mb-4">
       <a href="/admin/applications" class="hover:text-on-surface transition-colors">Applications</a>
       <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
       <span id="breadcrumb-name" class="font-medium text-on-surface">Applicant</span>
    </nav>
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
       <div>
         <h1 id="applicant-name-header" class="text-3xl font-headline font-bold text-on-surface tracking-tight">Loading...</h1>
         <div class="flex items-center gap-3 mt-2">
            <p class="text-sm text-outline bg-surface-container px-2 py-1 rounded-xl font-mono">ID: <span id="header-id-val">...</span></p>
            <span id="header-date" class="text-sm text-outline"></span>
         </div>
       </div>
       <span id="header-status-badge" class="px-5 py-2 text-sm font-bold rounded-full bg-gray-200 text-gray-700 shadow-sm uppercase tracking-wide">Status</span>
    </div>
  </div>

  <div id="content-grid" class="grid grid-cols-1 lg:grid-cols-12 gap-8 hidden animate-slide-up">
    
    <div class="lg:col-span-8 flex flex-col gap-6">
      
       <div class="glass-card rounded-2xl overflow-hidden">
         <div class="flex overflow-x-auto scrollbar-hide border-b border-outline-variant/10">
            <button class="tab-btn active flex-1 py-4 px-4 text-sm font-bold text-center border-b-2 transition-all whitespace-nowrap" style="border-color:var(--color-primary);color:var(--color-primary)" data-tab="personal">Personal</button>
            <button class="tab-btn flex-1 py-4 px-4 text-sm font-medium text-center border-b-2 border-transparent text-outline hover:text-on-surface hover:bg-surface-container-low transition-all whitespace-nowrap" data-tab="financial">Financial & Credit</button>
            <button class="tab-btn flex-1 py-4 px-4 text-sm font-medium text-center border-b-2 border-transparent text-outline hover:text-on-surface hover:bg-surface-container-low transition-all whitespace-nowrap" data-tab="documents">Documents</button>
            <button class="tab-btn flex-1 py-4 px-4 text-sm font-medium text-center border-b-2 border-transparent text-outline hover:text-on-surface hover:bg-surface-container-low transition-all whitespace-nowrap" data-tab="loan">Loan & History</button>
            <button class="tab-btn flex-1 py-4 px-4 text-sm font-medium text-center border-b-2 border-transparent text-outline hover:text-on-surface hover:bg-surface-container-low transition-all whitespace-nowrap" data-tab="audit">Audit Trail</button>
         </div>
       </div>

       <div id="tab-contents" class="relative min-h-[400px]">
       
          <div id="personal-tab" class="tab-pane glass-card rounded-2xl p-8">
             <h3 class="text-lg font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
                <span class="material-symbols-outlined text-outline">account_circle</span> Personal Information
             </h3>
             
             <div class="flex flex-col md:flex-row gap-8 mb-8 pb-8 border-b border-outline-variant/10">
                <div class="shrink-0 mx-auto md:mx-0">
                   <div class="w-32 h-32 bg-surface-container rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                      <img id="profile-image" src="" alt="Profile" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=User&background=random'">
                   </div>
                </div>
                <div class="flex-grow min-w-0 flex flex-col gap-4">
                   <div class="flex items-center gap-4">
                      <span class="text-sm font-medium text-outline w-28 shrink-0">Full Name</span>
                      <div class="flex-1 min-w-0">
                         <div id="detail-fullname" class="w-full p-3 bg-surface-container border border-outline-variant/20 rounded-xl text-on-surface text-sm font-semibold truncate"></div>
                      </div>
                   </div>
                   <div class="flex items-center gap-4">
                      <span class="text-sm font-medium text-outline w-28 shrink-0">Email Address</span>
                      <div class="flex-1 min-w-0">
                         <div id="detail-email" class="w-full p-3 bg-surface-container border border-outline-variant/20 rounded-xl text-on-surface text-sm truncate"></div>
                      </div>
                   </div>
                   <div class="flex items-center gap-4">
                      <span class="text-sm font-medium text-outline w-28 shrink-0">Mobile Number</span>
                      <div class="flex-1 min-w-0">
                         <div id="detail-mobile" class="w-full p-3 bg-surface-container border border-outline-variant/20 rounded-xl text-on-surface text-sm"></div>
                      </div>
                   </div>
                   <div class="flex items-center gap-4">
                      <span class="text-sm font-medium text-outline w-28 shrink-0">ID Number</span>
                      <div class="flex-1 min-w-0">
                         <div id="detail-identity-number" class="w-full p-3 bg-surface-container border border-outline-variant/20 rounded-xl text-on-surface text-sm font-mono"></div>
                      </div>
                   </div>
                   <div class="sm:col-span-3">
                      <div class="mt-2 p-5 bg-orange-50 border border-orange-100 rounded-2xl">
                        <div class="flex items-center justify-between mb-3">
                          <span class="text-sm font-bold text-orange-800 flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[16px]">people</span>Next of Kin
                          </span>
                          <span id="nok-saved-badge" class="hidden text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Saved</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                          <input id="nok-name-input" type="text" placeholder="Full name" class="border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
                          <input id="nok-relationship-input" type="text" placeholder="Relationship (e.g. Spouse)" class="border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
                          <input id="nok-phone-input" type="tel" placeholder="Phone number" class="border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
                        </div>
                        <button onclick="window.saveNOK()" class="text-xs font-bold text-white px-4 py-2 rounded-xl transition-colors" style="background:var(--color-primary)">Save Next of Kin</button>
                      </div>
                   </div>
                </div>
             </div>
             <!-- Employer Verification -->
             <div class="mt-6 p-5 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest">
               <div class="flex items-center justify-between mb-4">
                 <h4 class="text-md font-headline font-bold text-on-surface">Employer Verification</h4>
                 <span id="employer-verified-badge" class="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Unverified</span>
               </div>
               <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                 <div>
                   <label class="text-[10px] font-semibold text-outline uppercase tracking-wide">Employer Name</label>
                   <input id="employer-name-input" type="text" placeholder="Company name..."
                     class="w-full mt-1 border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:outline-none bg-white"
                     style="--tw-ring-color:var(--color-primary)">
                 </div>
                 <div>
                   <label class="text-[10px] font-semibold text-outline uppercase tracking-wide">Employer Phone</label>
                   <input id="employer-phone-input" type="tel" placeholder="010 000 0000"
                     class="w-full mt-1 border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:outline-none bg-white"
                     style="--tw-ring-color:var(--color-primary)">
                 </div>
                 <div class="sm:col-span-2">
                   <label class="text-[10px] font-semibold text-outline uppercase tracking-wide">Employer Address</label>
                   <input id="employer-address-input" type="text" placeholder="Work address..."
                     class="w-full mt-1 border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:outline-none bg-white"
                     style="--tw-ring-color:var(--color-primary)">
                 </div>
               </div>
               <div class="flex gap-3">
                 <button id="btn-save-employer" onclick="window.saveEmployerDetails()"
                   class="flex-1 py-2 rounded-xl text-white text-sm font-bold transition-colors"
                   style="background:var(--color-primary)">Save Details</button>
                 <button id="btn-verify-employer" onclick="window.toggleEmployerVerified()"
                   class="flex-1 py-2 rounded-xl border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-bold transition-colors">
                   Mark Verified
                 </button>
               </div>
               <p id="employer-verified-note" class="text-[10px] text-outline mt-2 italic hidden"></p>
             </div>

             <!-- Client Credit Cap -->
             <div class="mt-4 p-5 rounded-2xl border border-orange-100 bg-orange-50/30">
               <div class="flex items-center gap-3 mb-3">
                 <span class="material-symbols-outlined text-[18px]" style="color:var(--color-primary)">lock</span>
                 <h4 class="text-md font-headline font-bold text-on-surface">Individual Credit Cap</h4>
               </div>
               <p class="text-xs text-outline mb-3">Override the credit band rules for this specific client. Leave blank to use standard band limits.</p>
               <div class="flex gap-3 items-end">
                 <div class="flex-1">
                   <label class="text-[10px] font-semibold text-outline uppercase tracking-wide">Max Loan Override (R)</label>
                   <input id="credit-cap-input" type="number" min="0" step="100" placeholder="e.g. 5000"
                     class="w-full mt-1 border border-orange-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:outline-none bg-white"
                     style="--tw-ring-color:var(--color-primary)">
                 </div>
                 <div class="flex-1">
                   <label class="text-[10px] font-semibold text-outline uppercase tracking-wide">Reason / Note</label>
                   <input id="credit-cap-note" type="text" placeholder="Reason for cap..."
                     class="w-full mt-1 border border-orange-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:outline-none bg-white">
                 </div>
                 <button onclick="window.saveClientCap()"
                   class="px-4 py-2 rounded-xl text-white text-sm font-bold flex-shrink-0 mb-0.5"
                   style="background:var(--color-primary)">Apply Cap</button>
               </div>
               <div id="credit-cap-current" class="mt-2 text-xs text-outline"></div>
             </div>

             <h4 class="text-md font-headline font-bold text-on-surface mb-4 mt-6">Linked Bank Accounts</h4>
             <div id="bank-accounts-container" class="space-y-3">
                </div>
          </div>

          <div id="financial-tab" class="tab-pane hidden glass-card rounded-2xl p-8">
             <h3 class="text-lg font-headline font-bold text-on-surface mb-6">Financial Snapshot</h3>
             <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="p-5 bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 shadow-sm">
                   <div class="flex items-center gap-3 mb-2">
                      <div class="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">trending_up</span></div>
                      <span class="text-xs font-bold text-green-700 uppercase tracking-wider">Monthly Income</span>
                   </div>
                   <div id="fin-income" class="text-2xl font-bold text-on-surface">R 0.00</div>
                </div>
                <div class="p-5 bg-gradient-to-br from-red-50 to-white rounded-2xl border border-red-100 shadow-sm">
                   <div class="flex items-center gap-3 mb-2">
                      <div class="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">trending_down</span></div>
                      <span class="text-xs font-bold text-red-700 uppercase tracking-wider">Monthly Expenses</span>
                   </div>
                   <div id="fin-expenses" class="text-2xl font-bold text-on-surface">R 0.00</div>
                </div>
             </div>
             <div class="pt-8 border-t border-outline-variant/10">
                <div class="flex justify-between items-center mb-6">
                   <h4 class="text-lg font-headline font-bold text-on-surface">Credit Bureau Report</h4>
                   <div class="flex items-center gap-3">
                      <span id="credit-date" class="text-sm text-outline font-medium"></span>
                      <button id="btn-download-xml" class="hidden text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium flex items-center gap-2">
                         <span class="material-symbols-outlined text-[16px]">code</span> Download XML
                      </button>
                   </div>
                </div>
                <div id="credit-check-content" class="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                   </div>
                <div id="credit-score-trend" class="mt-4 hidden"></div>
             </div>
          </div>

          <div id="documents-tab" class="tab-pane hidden glass-card rounded-2xl p-8">
             <div class="flex justify-between items-center mb-6">
                <h3 class="text-lg font-headline font-bold text-on-surface">All User Documents</h3>
                <span id="doc-count" class="bg-surface-container text-outline text-xs font-semibold px-3 py-1 rounded-full">0</span>
             </div>
             <div id="documents-list" class="grid grid-cols-1 gap-4">
                </div>
          </div>

          <div id="loan-tab" class="tab-pane hidden glass-card rounded-2xl p-8">
             <h3 class="text-lg font-headline font-bold text-on-surface mb-6">Current Application Data</h3>
             <div class="space-y-6 mb-10">
                <div class="grid grid-cols-1 sm:grid-cols-3 items-center border-b border-outline-variant/10 pb-4">
                   <span class="text-sm font-medium text-outline">Agreement / Reference No.</span>
                   <div class="sm:col-span-2 font-mono text-sm font-bold text-on-surface bg-orange-50 p-2 rounded-xl inline-block border border-orange-100" id="detail-app-id" style="color:var(--color-primary)"></div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 items-center border-b border-outline-variant/10 pb-4">
                   <span class="text-sm font-medium text-outline">Submitted Date</span>
                   <div class="sm:col-span-2 text-sm text-on-surface" id="detail-date"></div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 items-center border-b border-outline-variant/10 pb-4">
                   <span class="text-sm font-medium text-outline">Loan Purpose</span>
                   <div class="sm:col-span-2 text-sm text-on-surface font-medium" id="detail-purpose"></div>
                </div>
                <div class="pt-2">
                   <label class="text-sm font-medium text-gray-700 block mb-2">Admin Notes</label>
                   
                   <textarea id="detail-notes" class="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-on-surface h-32 focus:ring-2 focus:border-transparent transition-all outline-none" style="--tw-ring-color:var(--color-primary)" placeholder="Add internal notes here..."></textarea>
                   <div class="mt-2 text-right">
                       <button id="btn-save-notes" class="px-4 py-2 rounded-xl font-semibold text-xs text-white transition-all shadow-sm" style="background:var(--color-primary)">
                           <span class="material-symbols-outlined text-[14px] align-middle mr-1">save</span> Save Notes
                       </button>
                   </div>

                </div>
             </div>

             <div id="credit-life-contract-panel" class="mb-10 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6">
                <div class="flex items-start justify-between gap-4 mb-5">
                   <div>
                      <h3 class="text-lg font-headline font-bold text-on-surface">Credit Life Contract</h3>
                      <p class="text-sm text-outline mt-1">Optional insurance consent, signed snapshot, and supporting signatures.</p>
                   </div>
                   <span id="credit-life-status-badge" class="px-3 py-1 text-xs font-bold rounded-full bg-gray-200 text-gray-700">Not selected</span>
                </div>
                <div id="credit-life-contract-content" class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                   <div class="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                      <h4 class="text-[10px] font-semibold uppercase tracking-widest text-outline mb-3">Contract Snapshot</h4>
                      <div class="flex items-center justify-end gap-2 mb-3">
                         <button id="credit-life-view-contract-btn" class="hidden px-3 py-1.5 text-xs font-semibold rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low transition-all flex items-center gap-1">
                           <span class="material-symbols-outlined text-[14px]">open_in_full</span> View full contract
                         </button>
                         <button id="credit-life-download-contract-btn" class="hidden px-3 py-1.5 text-xs font-semibold rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 transition-all flex items-center gap-1">
                           <span class="material-symbols-outlined text-[14px]">download</span> Download file
                         </button>
                      </div>
                      <div id="credit-life-contract-summary" class="space-y-3 text-sm text-outline"></div>
                   </div>
                   <div class="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                      <h4 class="text-[10px] font-semibold uppercase tracking-widest text-outline mb-3">Captured Signatures</h4>
                      <div id="credit-life-signature-gallery" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                   </div>
                </div>
             </div>
             
             <h3 class="text-lg font-headline font-bold text-on-surface mb-4 border-t border-outline-variant/10 pt-8">Client History</h3>
             <div class="mb-6">
                <h4 class="text-[11px] font-semibold text-outline mb-3 uppercase tracking-widest">Previous Loans</h4>
                <div id="loan-history-list" class="space-y-2">
                   <p class="text-sm text-gray-400 italic">No previous loan history found.</p>
                </div>
             </div>
             <div>
                <h4 class="text-[11px] font-semibold text-outline mb-3 uppercase tracking-widest">Other Applications</h4>
                <div id="app-history-list" class="space-y-2">
                   <p class="text-sm text-gray-400 italic">No other applications on record.</p>
                </div>
             </div>
          </div>
       </div>

           <div id="contract-status-card" class="glass-card rounded-2xl p-6">
            <h3 class="font-headline font-bold text-on-surface mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
              <span class="material-symbols-outlined text-[16px]" style="color:var(--color-primary)">draw</span> Contract Status
            </h3>
            <div id="contract-status-empty" class="text-sm text-outline bg-surface-container border border-dashed border-outline-variant/30 rounded-xl px-4 py-6 text-center">
              No contracts sent yet.
            </div>
              <div id="contract-repayment-section" class="mt-4 border-t border-outline-variant/10 pt-4">
                <h4 class="text-[10px] font-semibold text-outline uppercase tracking-widest mb-3">Repayment Date</h4>
                <div class="bg-surface-container border border-outline-variant/20 rounded-xl p-3">
                  <div class="mb-2 flex items-center justify-end">
                    <span id="contract-date-status-badge" class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-100 text-yellow-700">Not set</span>
                  </div>
                  <div id="contract-date-view" class="flex items-center justify-between gap-3">
                    <span class="text-xs text-outline font-medium">First Repayment:</span>
                    <div class="flex items-center gap-2">
                      <span id="contract-date-label" class="text-xs font-bold text-on-surface">Not Scheduled</span>
                      <button id="contract-set-date-btn" onclick="window.toggleContractDateEdit()" class="px-2.5 py-1 text-[11px] font-semibold rounded-xl text-white transition-colors" style="background:var(--color-primary)">
                        Set date
                      </button>
                    </div>
                  </div>
                  <div id="contract-date-edit" class="hidden mt-2">
                    <div class="flex items-center gap-2">
                      <input type="date" id="new-repayment-date"
                             class="flex-1 text-xs p-1.5 rounded-xl border border-outline-variant/30 bg-white focus:ring-2 outline-none">
                      <button id="btn-save-date" onclick="window.saveRepaymentDate()" class="px-3 py-1.5 text-white text-xs font-semibold rounded-xl shadow-sm" style="background:var(--color-primary)">
                        Save
                      </button>
                      <button onclick="window.toggleContractDateEdit()" class="px-2 py-1.5 text-outline hover:text-on-surface">
                        <span class="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            <div id="contract-status-section" class="hidden mt-4 border-t border-outline-variant/10 pt-4">
              <h4 class="text-[10px] font-semibold text-outline uppercase tracking-widest mb-3">History</h4>
              <div id="contract-status-content" class="space-y-2">
                </div>
            </div>
           </div>

           <div id="mandate-status-card" class="glass-card rounded-2xl p-6">
            <h3 class="font-headline font-bold text-on-surface mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
              <span class="material-symbols-outlined text-[16px]" style="color:var(--color-primary)">autorenew</span> Debit Order
            </h3>
            <div id="mandate-card-body" class="text-sm text-outline bg-surface-container border border-dashed border-outline-variant/30 rounded-xl px-4 py-6 text-center">
              Loading debit order status...
            </div>
           </div>

           <!-- FICA Compliance card -->
           <div id="fica-compliance-card" class="glass-card rounded-2xl p-6">
            <h3 class="font-headline font-bold text-on-surface mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
              <span class="material-symbols-outlined text-[16px]" style="color:var(--color-primary)">shield</span> FICA Compliance
            </h3>
            <div id="fica-card-body" class="space-y-3 text-sm text-outline">
              <div class="flex items-center justify-center py-4">
                <i class="fa-solid fa-circle-notch fa-spin text-gray-300"></i>
              </div>
            </div>
           </div>
    </div>

    <div class="lg:col-span-4">
       <div class="glass-card rounded-2xl sticky top-28 overflow-hidden">
          <div class="p-6 border-b border-outline-variant/10 bg-surface-container-lowest">
             <h3 class="font-headline font-bold text-on-surface">Loan Status</h3>
             <div id="status-alert" class="mt-3 p-3 rounded-xl text-xs font-medium leading-relaxed hidden animate-pulse">
                </div>
          </div>

          <div class="p-6 space-y-6">
             <div>
                <label class="text-[10px] font-semibold uppercase tracking-widest text-outline">Requested Amount</label>
                <div id="sidebar-amount" class="text-3xl font-bold text-on-surface mt-1 tracking-tight">R 0.00</div>
             </div>
             <div>
                <label class="text-[10px] font-semibold uppercase tracking-widest text-outline">Term Length</label>
                <div class="mt-2 flex items-center gap-2">
                   <div class="w-10 h-10 rounded-xl bg-surface-container text-outline flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">calendar_month</span></div>
                   <div id="sidebar-term" class="text-lg font-semibold text-on-surface">0 Months</div>
                </div>
             </div>

             <div>
                <label class="text-xs text-gray-500 uppercase font-bold tracking-wider">Est. Monthly Payment</label>
                <div class="mt-2 p-4 bg-surface-container rounded-xl border border-outline-variant/20">
                   <div id="sidebar-payment" class="text-xl font-bold text-on-surface">R 0.00</div>
                   <div class="text-xs text-outline mt-1">(Principal Only)</div>
                </div>
             </div>

             <div id="financial-breakdown" class="pt-4 border-t border-gray-100 space-y-4">
                </div>

             <div>
                <label class="text-[10px] font-semibold uppercase tracking-widest text-outline">Current Status</label>
                <div id="sidebar-status" class="mt-2 text-lg font-bold" style="color:var(--color-primary)">Pending</div>
             </div>
          </div>

          <div class="p-6 bg-surface-container-lowest border-t border-outline-variant/10 flex flex-col gap-3" id="action-buttons-container">
              </div>

          <div class="p-6 bg-surface-container-lowest border-t border-outline-variant/10">
              <label class="text-[10px] font-semibold uppercase tracking-widest text-outline mb-2 block">Manual Override (Restricted)</label>
              <div class="flex gap-2">
                  <select id="status-override-select" class="flex-1 text-xs border-outline-variant/30 rounded-xl">
                      ${ALL_STATUS_OPTIONS.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                  </select>
                  <button id="manual-update-btn" onclick="manualStatusChange()" class="px-3 py-2 text-white text-xs font-semibold rounded-xl transition" style="background:var(--color-primary)">
                      Update
                  </button>
              </div>
              <p id="override-hint" class="text-[10px] text-outline mt-1 italic">Use only for corrections. Bureau statuses locked.</p>
          </div>

       </div>
    </div>

    <!-- Audit Trail Tab -->
    <div id="audit-tab" class="tab-pane hidden glass-card rounded-2xl p-8 col-span-2">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-headline font-bold text-on-surface">Audit Trail</h3>
          <p class="text-sm text-outline mt-0.5">Complete history of all changes to this application</p>
        </div>
        <button onclick="window.exportAuditTrail()" class="flex items-center gap-2 text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 rounded-xl text-gray-600 transition-colors">
          <span class="material-symbols-outlined text-[14px]">download</span> Export
        </button>
      </div>
      <div id="audit-trail-list" class="space-y-3">
        <div class="text-center py-8 text-sm text-gray-400">Loading audit history...</div>
      </div>
    </div>

  </div>


  <div id="feedback-container" class="fixed bottom-6 right-6 z-50 hidden"></div>

  <!-- SACRRA Compliance Gate Modal -->
  <div id="sacrra-gate-modal" class="hidden fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
      <div class="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6">
        <div class="flex items-center gap-3 mb-1">
          <span class="material-symbols-outlined text-white text-[28px]">gpp_maybe</span>
          <h2 class="text-xl font-black text-white">SACRRA Fields Incomplete</h2>
        </div>
        <p class="text-amber-100 text-sm">Some fields required for the monthly SACRRA bureau submission are missing. <strong class="text-white">The loan can still be approved now</strong> — fix before submission day, or fill in below.</p>
      </div>
      <div class="px-8 py-6 max-h-[55vh] overflow-y-auto" id="sacrra-gate-fields"></div>
      <div class="px-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <button onclick="window.closeSACRRAGate()" class="px-5 py-2.5 text-sm font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
          Cancel
        </button>
        <div class="flex items-center gap-3 flex-wrap">
          <button onclick="window.approveAnywaySkipSACRRA()" id="sacrra-approve-anyway-btn"
            class="px-5 py-2.5 text-sm font-bold text-amber-700 border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">bolt</span>
            Approve Now — Fix SACRRA Later
          </button>
          <button onclick="window.saveSACRRAAndApprove()" id="sacrra-gate-save-btn"
            class="px-6 py-2.5 text-sm font-black text-white rounded-xl transition-colors flex items-center gap-2"
            style="background:var(--color-primary)">
            <span class="material-symbols-outlined text-[18px]">save</span>
            Fix &amp; Approve
          </button>
        </div>
      </div>
    </div>
  </div>
  <div id="credit-life-contract-modal" class="fixed inset-0 z-[80] hidden items-center justify-center bg-gray-900/70 p-4">
    <div class="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div class="flex items-center justify-between gap-4 border-b border-outline-variant/10 px-6 py-4">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-widest text-outline">Credit Life Contract</p>
          <h3 class="text-lg font-headline font-bold text-on-surface">Signed Contract Snapshot</h3>
        </div>
        <button id="credit-life-contract-modal-close" class="w-10 h-10 rounded-full text-outline hover:bg-surface-container-low transition-all flex items-center justify-center">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div id="credit-life-contract-modal-body" class="max-h-[calc(90vh-80px)] overflow-y-auto px-6 py-5"></div>
    </div>
  </div>
</div>
`;

// --- 2. Utilities & Helpers ---

const getBadgeColor = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800 border border-gray-200';
  switch (status) {
    case 'APPROVED': 
    case 'approved': 
    case 'DISBURSED':
    case 'AFFORD_OK':
    case 'BUREAU_OK':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'declined':
    case 'DECLINED':
    case 'AFFORD_FAIL':
      return 'bg-red-100 text-red-800 border border-red-200';
    case 'OFFERED':
    case 'OFFER_ACCEPTED':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    default:
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  }
};

const updateHeaderStatusBadge = (status) => {
  const badge = document.getElementById('header-status-badge');
  if (!badge || !status) return;
  badge.textContent = status;
  badge.className = `px-4 py-1.5 text-sm font-bold rounded-full shadow-sm ${getBadgeColor(status)}`;
};

const downloadBlob = (content, filename, contentType) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value = '') => `${value}`
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Helper to render base64 bureau data as a viewable PDF
window.viewBureauReport = (base64Data) => {
    try {
        // Decode the base64 string provided by the bureau API
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        // Create a Blob for the PDF
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Open in a new tab for the original bureau view
        window.open(url, '_blank');
    } catch (error) {
        console.error("PDF Render Error:", error);
        alert("Unable to display the PDF format. Please ensure the bureau data is valid.");
    }
};

window.viewTruidReport = () => {
    if (!currentApplication?.truid_info) {
        showFeedback("No TruID data available for this applicant.", "error");
        return;
    }
    
    // Extracts the capture data (summary_payload is usually the most readable)
    const displayData = currentApplication.truid_info.summary_payload || currentApplication.truid_info;
    
    const t  = currentApplication.truid_info;
    const sp = t.summary_payload || {};
    const id = sp.id_document || sp.identity || {};
    const bank = sp.bank_accounts || sp.banking || [];
    const income = sp.income_summary || sp.income || {};
    const employer = sp.employment || sp.employer || {};

    const row = (label, val, highlight = false) => val
        ? `<tr><td style="color:#888;font-size:12px;padding:5px 10px;width:35%">${label}</td><td style="font-weight:${highlight?'700':'500'};font-size:13px;padding:5px 10px;color:${highlight?'#E7762E':'#1a1a1a'}">${val}</td></tr>`
        : '';

    const x = window.open('', '_blank');
    x.document.write(`<!DOCTYPE html>
<html><head><title>TruID Report</title>
<style>
  body{font-family:sans-serif;background:#f4f7f6;padding:24px;color:#333}
  .card{background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.07);border:1px solid #e5e7eb}
  h1{font-size:20px;font-weight:800;margin-bottom:4px;color:#1a1a1a}
  h3{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:10px}
  table{width:100%;border-collapse:collapse}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}
  .green{background:#d1fae5;color:#065f46} .blue{background:#dbeafe;color:#1e3a8a} .orange{background:#fff3cd;color:#92400e}
  details{margin-top:12px} summary{cursor:pointer;font-size:12px;font-weight:600;color:#3b82f6}
  pre{background:#1e1e2e;color:#cdd6f4;padding:14px;border-radius:8px;font-size:11px;overflow-x:auto;margin-top:8px}
</style></head><body>
<div style="max-width:780px;margin:0 auto">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><h1>TruID Digital Verification</h1><p style="color:#888;font-size:12px">Collection ID: ${t.collection_id || '—'}</p></div>
      <span class="badge ${t.verified ? 'green' : 'orange'}">${t.verified ? '✓ Verified' : 'Pending'}</span>
    </div>
  </div>

  ${id.full_name || id.surname ? `
  <div class="card">
    <h3>Identity Details</h3>
    <table>
      ${row('Full Name', id.full_name || [id.forenames, id.surname].filter(Boolean).join(' '), true)}
      ${row('ID Number', id.id_number || id.identity_number)}
      ${row('Date of Birth', id.date_of_birth || id.dob)}
      ${row('Gender', id.gender)}
      ${row('Nationality', id.nationality || 'South African')}
      ${row('Verified', id.verified ? '✓ Yes' : 'Pending')}
    </table>
  </div>` : ''}

  ${income.gross_income || income.net_income || income.monthly_income ? `
  <div class="card">
    <h3>Income Summary (from bank statements)</h3>
    <table>
      ${row('Monthly Gross Income', income.gross_income ? 'R ' + Number(income.gross_income).toLocaleString('en-ZA', {minimumFractionDigits:2}) : null, true)}
      ${row('Monthly Net Income', income.net_income ? 'R ' + Number(income.net_income).toLocaleString('en-ZA', {minimumFractionDigits:2}) : null)}
      ${row('Average Monthly Income', income.average_monthly ? 'R ' + Number(income.average_monthly).toLocaleString('en-ZA', {minimumFractionDigits:2}) : null)}
      ${row('Income Source', income.source || income.income_type)}
      ${row('Employer', income.employer_name || employer.name)}
    </table>
  </div>` : ''}

  ${Array.isArray(bank) && bank.length ? `
  <div class="card">
    <h3>Bank Accounts (${bank.length})</h3>
    ${bank.map(b => `
    <div style="background:#f9fafb;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
      <table>
        ${row('Bank', b.bank_name || b.institution)}
        ${row('Account No', b.account_number)}
        ${row('Account Type', b.account_type)}
        ${row('Balance', b.current_balance ? 'R ' + Number(b.current_balance).toLocaleString('en-ZA', {minimumFractionDigits:2}) : null)}
      </table>
    </div>`).join('')}
  </div>` : ''}

  <div class="card">
    <h3>Raw Payload</h3>
    <details><summary>Show raw JSON</summary>
    <pre>${JSON.stringify(displayData, null, 2)}</pre>
    </details>
  </div>
</div>
</body></html>`);
    x.document.close();
};
//Toast Feedback

const showFeedback = (message, type = 'success') => {
  const feedbackContainer = document.getElementById('feedback-container');
  if (!feedbackContainer) return;

  const isSuccess = type === 'success';
  feedbackContainer.innerHTML = `
    <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${isSuccess ? 'bg-white border-green-100' : 'bg-white border-red-100'} transform transition-all duration-300">
        <div class="w-8 h-8 rounded-full ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} flex items-center justify-center">
            <span class="material-symbols-outlined text-[18px]">${isSuccess ? 'check' : 'error'}</span>
        </div>
        <div>
            <p class="text-sm font-bold text-on-surface">${isSuccess ? 'Success' : 'Error'}</p>
            <p class="text-xs text-outline">${message}</p>
        </div>
    </div>
  `;
  feedbackContainer.classList.remove('hidden');
  setTimeout(() => { feedbackContainer.classList.add('hidden'); }, 5000);
};

// --- 3. Logic Implementation ---
// ===== DocuSeal Functions =====
const initDocuSealCard = async () => {
  const emptyState = document.getElementById('contract-status-empty');
  const statusSection = document.getElementById('contract-status-section');
  if (!currentApplication) return;

  const signedAt   = currentApplication.contract_signed_at;
  const sigUrl     = currentApplication.contract_signature_url;
  const contractUrl= currentApplication.contract_pdf_url;

  if (signedAt) {
    if (statusSection) statusSection.classList.add('hidden');
    if (emptyState) {
      emptyState.classList.remove('hidden');
      const date = new Date(signedAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const viewHref = contractUrl || `/api/contracts/${currentApplication.id}/preview`;
      emptyState.innerHTML = `
        <div class="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-green-600">verified</span>
            <span class="text-sm font-bold text-green-900">Agreement Signed</span>
          </div>
          <div class="flex items-center justify-between text-xs border-t border-green-200 pt-2">
            <span class="text-outline">Signed on</span>
            <span class="font-semibold text-on-surface">${date}</span>
          </div>
          ${sigUrl ? `
          <div class="border-t border-green-200 pt-2">
            <p class="text-[10px] text-outline uppercase tracking-widest mb-2">Client Signature</p>
            <img src="${sigUrl}" alt="Client signature" class="max-h-16 border border-outline-variant/20 rounded-lg bg-white p-1">
          </div>` : ''}
          <div class="flex gap-2 border-t border-green-200 pt-2">
            <a href="${viewHref}" target="_blank"
              class="flex-1 py-2 text-xs font-bold rounded-xl border border-green-300 text-green-800 hover:bg-green-100 transition-all flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-[14px]">open_in_new</span> View Signed Contract
            </a>
            <a href="/api/contracts/${currentApplication.id}/preview" target="_blank"
              class="flex-1 py-2 text-xs font-bold rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low transition-all flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-[14px]">description</span> Preview Template
            </a>
          </div>
        </div>`;
    }
    return;
  }

  // Not yet signed — show preview + status
  if (statusSection) statusSection.classList.add('hidden');
  if (emptyState) {
    emptyState.classList.remove('hidden');
    const canSend = ['BUREAU_OK', 'APPROVED', 'OFFERED', 'CONTRACT_SIGN'].includes(currentApplication.status);
    emptyState.innerHTML = `
      <div class="space-y-3">
        <p class="text-sm text-outline text-center py-2">Not yet signed by client.</p>
        <button onclick="window.open('/api/contracts/${currentApplication.id}/preview','_blank')"
          class="w-full py-2.5 text-xs font-bold rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low transition-all flex items-center justify-center gap-1">
          <span class="material-symbols-outlined text-[14px]">open_in_new</span> Preview Agreement
        </button>
        ${canSend ? `
        <button onclick="window.notifyClientToSign(${currentApplication.id})" id="notify-sign-btn"
          class="w-full py-2.5 text-xs font-bold rounded-xl text-white transition-all flex items-center justify-center gap-1"
          style="background:var(--color-primary)">
          <span class="material-symbols-outlined text-[14px]">send</span> Send Signing Link to Client
        </button>` : ''}
      </div>`;
  }
};

window.notifyClientToSign = async (appId) => {
  const btn = document.getElementById('notify-sign-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-[14px] align-middle animate-spin">progress_activity</span> Sending...'; }
  try {
    const res = await apiFetch('/api/contracts/notify-to-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: currentApplication?.id })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'Send failed');
    const channels = payload.sent?.join(' & ') || 'SMS/email';
    showFeedback(`Signing link sent to client via ${channels}.`, 'success');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">check_circle</span> Sent'; }
  } catch (err) {
    showFeedback('Could not send signing link: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">send</span> Send Signing Link to Client'; }
  }
};

const handleSendContract = async (triggerButton = null) => {
  if (!currentApplication || !currentApplication.profiles) {
    alert('Error: Application data not loaded');
    return;
  }
  const btn = triggerButton || document.getElementById('btn-send-contract');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin align-middle">progress_activity</span> Sending...';
  }
  try {
    const submission = await sendContract(currentApplication, currentApplication.profiles);
    // Show success message
    alert(`✅ Contract sent successfully to ${currentApplication.profiles.email}`);
    await updateApplicationStatus(currentApplication.id, 'OFFERED');
    // Reload contract status
    await loadContractStatus();
    await loadApplicationData();
  } catch (error) {
    console.error('Send contract error:', error);
    alert(`❌ Failed to send contract: ${error.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
};

const handlePreviewContract = () => {
  if (!currentApplication?.id) return;
  // Open full NCA pre-agreement quote in new tab (print-ready)
  window.open(`/api/contracts/${currentApplication.id}/preview`, '_blank');
};

const shouldPollContractStatus = () => {
  if (!currentApplication) return false;
  const status = currentApplication.status || '';
  return ['OFFERED'].includes(status);
};

const startContractStatusPolling = () => {
  if (contractStatusPoller || !shouldPollContractStatus()) return;
  contractStatusPoller = setInterval(() => {
    loadContractStatus(true);
  }, CONTRACT_POLL_INTERVAL);
};

const stopContractStatusPolling = () => {
  if (contractStatusPoller) {
    clearInterval(contractStatusPoller);
    contractStatusPoller = null;
  }
};

const handleContractCompleted = async () => {
  if (isHandlingContractCompletion || hasAutoAdvancedToSigned || !currentApplication) return;
  isHandlingContractCompletion = true;
  hasAutoAdvancedToSigned = true;
  stopContractStatusPolling();
  try {
    let statusChangedToOfferAccepted = false;
    if (currentApplication.status !== 'OFFER_ACCEPTED') {
      const { error } = await updateApplicationStatus(currentApplication.id, 'OFFER_ACCEPTED');
      if (error) {
        console.error('Auto advance to Contract Signed failed:', error);
        hasAutoAdvancedToSigned = false;
        return;
      }
      currentApplication.status = 'OFFER_ACCEPTED';
      currentApplication.contract_signed_at = new Date().toISOString();
      statusChangedToOfferAccepted = true;
    }

    if (statusChangedToOfferAccepted) {
      try {
        const activationResponse = await apiFetch('/api/suresystems/activate-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: currentApplication.id })
        });
        const activationPayload = await activationResponse.json().catch(() => ({}));
        if (!activationResponse.ok || activationPayload?.success === false) {
          const activationError = new Error(activationPayload?.error || activationPayload?.message || 'SureSystems mandate activation failed');
          activationError.details = activationPayload?.details || null;
          throw activationError;
        }
      } catch (activationError) {
        console.error('SureSystems activation failed during contract auto-complete:', {
          message: activationError?.message || 'Unknown activation error',
          details: activationError?.details || null
        });
        showFeedback(activationError?.message || 'SureSystems mandate activation failed', 'error');
      }
    }

    renderSidePanel(currentApplication);
    updateHeaderStatusBadge('OFFER_ACCEPTED');
    showFeedback('Contract signed! Advanced to approval phase.', 'success');
    await loadApplicationData();
  } catch (error) {
    console.error('handleContractCompleted error:', error);
    hasAutoAdvancedToSigned = false;
  } finally {
    isHandlingContractCompletion = false;
  }
};

const loadContractStatus = async (isPoll = false) => {
  if (!currentApplication?.id) return;
  try {
    const submissions = await getApplicationSubmissions(currentApplication.id);
    const statusSection = document.getElementById('contract-status-section');
    const emptyState = document.getElementById('contract-status-empty');
    if (submissions.length === 0) {
      if (statusSection) statusSection.classList.add('hidden');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.textContent = 'No contracts sent yet.';
      }
      stopContractStatusPolling();
      markContractDeclinedState(false);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');
    if (statusSection) statusSection.classList.remove('hidden');
    // Render submissions
    renderContractSubmissions(submissions);
    const latestStatus = submissions[0]?.status?.toLowerCase?.() || '';
    markContractDeclinedState(latestStatus === 'declined');
    if (latestStatus === 'completed' && !hasAutoAdvancedToSigned) {
      await handleContractCompleted();
    } else if (latestStatus !== 'completed' && !isPoll) {
      startContractStatusPolling();
    }
  } catch (error) {
    console.error('Load contract status error:', error);
  }
};

const renderContractSubmissions = (submissions) => {
  const container = document.getElementById('contract-status-content');
  if (!container) return;
  container.innerHTML = submissions.map(sub => {
    const statusColor = getSubmissionStatusColor(sub.status);
    const statusIcon = getSubmissionStatusIcon(sub.status);
    return `
      <div class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${statusColor.bg} ${statusColor.text} flex items-center justify-center">
              <span class="material-symbols-outlined text-[20px]">${statusIcon}</span>
            </div>
            <div>
              <div class="font-semibold text-on-surface text-sm">Contract #${sub.submission_id.slice(-8)}</div>
              <div class="text-xs text-outline">Sent ${formatDate(sub.created_at)}</div>
            </div>
          </div>
          <span class="px-3 py-1 text-xs font-semibold rounded-full ${statusColor.badge}">${sub.status}</span>
        </div>
        <div class="flex gap-2">
          <button onclick="window.viewSubmission('${sub.slug || ''}', '${sub.submitter_id || ''}', '${sub.embed_src || ''}')" class="flex-1 px-3 py-2 bg-surface-container border border-outline-variant/30 text-on-surface-variant rounded-xl hover:bg-surface-container-low text-xs font-semibold flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-[14px]">visibility</span> View
          </button>
          ${sub.status === 'pending' ? `
            <button onclick="window.resendSubmission('${sub.submitter_id}', '${sub.submission_id}')" class="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 text-xs font-semibold flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-[14px]">send</span> Resend
            </button>
          ` : ''}
          ${sub.status !== 'completed' && sub.status !== 'voided' ? `
            <button onclick="window.voidSubmission('${sub.submission_id}')" class="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl hover:bg-red-100 text-xs font-semibold flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">block</span> Void
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

const markContractDeclinedState = (isDeclined) => {
  if (typeof isDeclined !== 'boolean' || !currentApplication) return;

  if (isDeclined === isContractDeclinedUI) return;
  isContractDeclinedUI = isDeclined;

  const bannerId = 'contract-declined-banner';
  const existingBanner = document.getElementById(bannerId);
  const contractCard = document.getElementById('contract-status-card');

  if (isDeclined) {
    if (!originalStatusBeforeDecline && currentApplication.status !== 'DECLINED') {
      originalStatusBeforeDecline = currentApplication.status;
    }
    currentApplication.status = 'DECLINED';
    updateHeaderStatusBadge('DECLINED');
    renderSidePanel(currentApplication);

    if (!existingBanner && contractCard) {
      const banner = document.createElement('div');
      banner.id = bannerId;
      banner.className = 'mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2';
      banner.innerHTML = `
        <span class="material-symbols-outlined text-red-500 text-[16px]">cancel</span>
        <span>Contract was declined by the applicant.</span>
      `;
      const heading = contractCard.querySelector('h3');
      if (heading && heading.parentNode) {
        heading.parentNode.insertBefore(banner, heading.nextSibling);
      } else {
        contractCard.prepend(banner);
      }
    }
  } else {
    if (existingBanner) existingBanner.remove();
    if (originalStatusBeforeDecline) {
      currentApplication.status = originalStatusBeforeDecline;
    }
    originalStatusBeforeDecline = null;
    renderSidePanel(currentApplication);
    updateHeaderStatusBadge(currentApplication.status);
  }
};

const getSubmissionStatusColor = (status) => {
  const normalized = (status || '').toLowerCase();
  const colors = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700' },
    completed: { bg: 'bg-green-100', text: 'text-green-600', badge: 'bg-green-100 text-green-700' },
    expired: { bg: 'bg-red-100', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
    voided: { bg: 'bg-gray-100', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-700' },
    declined: { bg: 'bg-red-100', text: 'text-red-600', badge: 'bg-red-100 text-red-700' }
  };
  return colors[normalized] || colors.pending;
};

const getSubmissionStatusIcon = (status) => {
  const normalized = (status || '').toLowerCase();
  const icons = {
    pending: 'schedule',
    completed: 'check_circle',
    expired: 'error',
    voided: 'block',
    declined: 'cancel'
  };
  return icons[normalized] || icons.pending;
};

// Global functions for button onclick handlers
window.viewSubmission = async (slug, submitterId, embedSrc) => {
  const cleanStr = (v) => (v && v !== 'undefined' && v !== 'null' ? v : null);
  // Open the tab synchronously so popup blockers don't kill it during the async fetch.
  const newTab = window.open('', '_blank');
  try {
    let url = null;
    // Prefer a live lookup via the DocuSeal API: the stored "slug" field has historically
    // been the submission slug (not the submitter signing slug), which yields a 404.
    if (cleanStr(submitterId)) {
      try {
        const details = await getSubmitterDetails(submitterId);
        const resolvedSlug = details?.slug || details?.submitter?.slug;
        const resolvedEmbed = details?.embed_src || details?.submitter?.embed_src;
        url = cleanStr(resolvedEmbed) || (cleanStr(resolvedSlug) ? getEmbedUrl(resolvedSlug) : null);
      } catch (apiErr) {
        console.warn('Live submitter lookup failed, falling back to stored values:', apiErr);
      }
    }
    // Fallbacks
    if (!url) url = cleanStr(embedSrc);
    if (!url && cleanStr(slug)) url = getEmbedUrl(slug);

    if (!url) {
      if (newTab) newTab.close();
      alert('Unable to open this contract — the signing link is missing. Try resending the contract.');
      return;
    }
    if (newTab) {
      newTab.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  } catch (err) {
    console.error('viewSubmission error:', err);
    if (newTab) newTab.close();
    alert(`Could not open contract: ${err.message || err}`);
  }
};
window.resendSubmission = async (submitterId, submissionId = null) => {
  if (!confirm('Resend contract email to the applicant?')) return;
  try {
    let targetSubmitterId = submitterId;
    if (!targetSubmitterId) {
      if (!submissionId) {
        throw new Error('Unable to determine DocuSeal submitter');
      }
      targetSubmitterId = await getSubmitterIdFromSubmission(submissionId);
    }

    await resendContract(targetSubmitterId);
    alert('✅ Contract email resent successfully');
    await loadContractStatus();
  } catch (error) {
    alert(`❌ Failed to resend: ${error.message}`);
  }
};
window.voidSubmission = async (submissionId) => {
  if (!confirm('Void this contract submission? This cannot be undone.')) return;
  try {
    await voidSubmission(submissionId);
    alert('✅ Submission voided successfully');
    await loadContractStatus();
  } catch (error) {
    alert(`❌ Failed to void: ${error.message}`);
  }
};

const initTabs = () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabBtns.forEach(btn => {
     btn.addEventListener('click', () => {
        tabBtns.forEach(b => {
           b.classList.remove('active');
           b.style.borderColor = '';
           b.style.color = '';
           b.classList.add('text-outline', 'border-transparent');
        });
        btn.classList.remove('text-outline', 'border-transparent');
        btn.classList.add('active');
        btn.style.borderColor = 'var(--color-primary)';
        btn.style.color = 'var(--color-primary)';
        tabPanes.forEach(pane => pane.classList.add('hidden'));
        const targetId = btn.getAttribute('data-tab') + '-tab';
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.remove('hidden');
        // Reload audit trail when that tab is opened
        if (btn.getAttribute('data-tab') === 'audit') {
            const urlParams = new URLSearchParams(window.location.search);
            loadAuditTrail(urlParams.get('id'));
        }
     });
  });
};

// --- Status Update Logic ---
window.updateStatus = async (newStatus) => {
    // ── Status transition gates ───────────────────────────────────
    if (newStatus === 'AFFORD_OK') {
        const isPartnerApp = currentApplication.source === 'PARTNER_API';
        if (!isPartnerApp) {
            const hasBureau = currentApplication.bureau_score_band ||
                ['BUREAU_OK', 'BANK_LINKING'].includes(currentApplication.status);
            if (!hasBureau) {
                showFeedback('Cannot confirm affordability — no bureau result on record. Run the credit check first.', 'error');
                return;
            }
            const { data: fp } = await supabase
                .from('financial_profiles')
                .select('monthly_income, monthly_debt_repayments')
                .eq('user_id', currentApplication.user_id)
                .maybeSingle();
            if (!fp?.monthly_income) {
                showFeedback('Cannot confirm affordability — no income on record. Complete open banking first.', 'error');
                return;
            }

            // Persist DTI assessment for NCA s81 audit trail
            const income     = Number(fp.monthly_income || 0);
            const debt       = Number(fp.monthly_debt_repayments || 0);
            const instalment = Number(currentApplication.offer_monthly_repayment || 0);
            const totalDebt  = debt + instalment;
            const dtiPct     = income > 0 ? (totalDebt / income) * 100 : 999;
            const passed     = dtiPct <= 40; // NCA-aligned: total debt service ≤ 40% of gross income
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(`/api/admin/applications/${currentApplication.id}/affordability`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    monthly_income: income,
                    monthly_debt:   totalDebt,
                    dti_pct:        Math.round(dtiPct * 100) / 100,
                    passed,
                    under_debt_review: false,
                })
            });
        }
    }

    if (newStatus === 'OFFERED') {
        if (!currentApplication.offer_principal || currentApplication.offer_principal <= 0) {
            showFeedback('Cannot send contract — loan offer not configured yet.', 'error');
            return;
        }
    }

    if (newStatus === 'READY_TO_DISBURSE') {
        if (currentApplication.status !== 'OFFER_ACCEPTED' && !currentApplication.contract_signed_at) {
            showFeedback('Cannot queue for disbursement — contract has not been signed yet.', 'error');
            return;
        }
        if (!currentApplication.bank_account_id) {
            showFeedback('Cannot queue for disbursement — no bank account linked.', 'error');
            return;
        }
    }
    // ── End gates ─────────────────────────────────────────────────

    const { error } = await updateApplicationStatus(currentApplication.id, newStatus);
    if (error) {
        showFeedback(error.message, 'error');
    } else {
        showFeedback(`Status updated to ${newStatus}`, 'success');
        loadApplicationData();
    }
    closeModal();
};

window.declineApplication = async () => {
  const { error } = await updateApplicationStatus(currentApplication.id, 'DECLINED');
  if (error) {
    showFeedback(error.message, 'error');
  } else {
    showFeedback('Application declined.', 'success');
    loadApplicationData();
  }
  closeModal();
};

// --- Save Notes Logic (NEW) ---
window.saveNotes = async () => {
    const noteText = document.getElementById('detail-notes').value;
    const btn = document.getElementById('btn-save-notes');
    
    if(!noteText.trim()) return; // Don't save empty

    // UX State
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-[14px] align-middle animate-spin mr-1">progress_activity</span> Saving...`;

    try {
        const { error } = await updateApplicationNotes(currentApplication.id, noteText);
        if (error) throw error;
        
        showFeedback('Notes saved successfully', 'success');
        
        // Optional: Blink success
        btn.innerHTML = `<span class="material-symbols-outlined text-[14px] align-middle mr-1">check</span> Saved!`;
        btn.style.background = '#16a34a';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.background = 'var(--color-primary)';
        }, 2000);

    } catch (err) {
        showFeedback(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// --- NEW: Update Repayment Date Logic ---
window.saveRepaymentDate = async () => {
    const dateInput = document.getElementById('new-repayment-date');
    if (!dateInput || !dateInput.value) return;

    const newDate = dateInput.value;
    const btn = document.getElementById('btn-save-date');
    const originalText = btn.innerHTML;

    // 1. UI Loading State
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>';

    try {
        // 2. Prepare the updated JSON object
        // We clone the existing details or create a new object if empty
        const currentDetails = currentApplication.offer_details || {};
        const updatedDetails = {
            ...currentDetails,
            first_payment_date: newDate // This updates the specific key in the JSON
        };

        // 3. Send to Supabase
        // We also update 'repayment_start_date' column to keep SQL queries consistent
        const { error } = await supabase
            .from('loan_applications')
            .update({ 
                offer_details: updatedDetails,
                repayment_start_date: newDate 
            })
            .eq('id', currentApplication.id);

        if (error) throw error;

        showFeedback('First repayment date updated successfully', 'success');
        
        // 4. Refresh Data
        await loadApplicationData();

    } catch (error) {
        console.error('Date Update Error:', error);
        showFeedback(error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

const renderContractRepaymentScheduler = (app) => {
  const label = document.getElementById('contract-date-label');
  const badge = document.getElementById('contract-date-status-badge');
  const setBtn = document.getElementById('contract-set-date-btn');
  const input = document.getElementById('new-repayment-date');
  const viewMode = document.getElementById('contract-date-view');
  const editMode = document.getElementById('contract-date-edit');

  if (!label || !badge || !setBtn || !input || !viewMode || !editMode || !app) {
    return;
  }

  const scheduledDate = app.repayment_start_date || app.offer_details?.first_payment_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  label.textContent = scheduledDate ? formatDate(scheduledDate) : 'Not Scheduled';
  badge.textContent = scheduledDate ? 'Date set' : 'Not set';
  badge.className = scheduledDate
    ? 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700'
    : 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-100 text-yellow-700';
  input.value = scheduledDate ? new Date(scheduledDate).toISOString().split('T')[0] : '';
  input.min = today.toISOString().split('T')[0];

  const isLocked = app.status === 'DISBURSED';
  setBtn.disabled = isLocked;
  setBtn.classList.toggle('opacity-50', isLocked);
  setBtn.classList.toggle('cursor-not-allowed', isLocked);

  viewMode.classList.remove('hidden');
  editMode.classList.add('hidden');
};

window.toggleContractDateEdit = () => {
    const viewMode = document.getElementById('contract-date-view');
    const editMode = document.getElementById('contract-date-edit');
    if (viewMode && editMode) {
        viewMode.classList.toggle('hidden');
        editMode.classList.toggle('hidden');
    }
};
// --- Manual Override Logic ---
window.manualStatusChange = async () => {
    if (currentApplication.status === 'DISBURSED') {
        alert("⛔ ACTION BLOCKED\n\nThis application has already been disbursed. To maintain financial integrity, you cannot change the status of an active loan.");
        return;
    }

    const select = document.getElementById('status-override-select');
    const newStatus = select.value;
    
    if(newStatus === currentApplication.status) return;

    if(newStatus.includes('BUREAU')) {
        alert("Cannot manually override Bureau statuses. These are automated.");
        return;
    }

    if(confirm(`Are you sure you want to manually force status to "${newStatus}"?`)) {
      const { error } = await updateApplicationStatus(currentApplication.id, newStatus);
      if(error) {
        showFeedback(error.message, 'error');
        return;
      }

      if (newStatus === 'OFFER_ACCEPTED') {
        showFeedback('Status manually updated. Activating SureSystems mandate...', 'success');
        try {
          const response = await apiFetch('/api/suresystems/activate-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: currentApplication.id })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload?.success === false) {
            const activationError = new Error(payload?.error || payload?.message || 'SureSystems mandate activation failed');
            activationError.details = payload?.details || null;
            throw activationError;
          }

          alert(
            `✅ SureSystems mandate activated successfully.\n\nApplication ID: ${currentApplication.id}` +
            `${payload?.contractReference ? `\nContract Reference: ${payload.contractReference}` : ''}` +
            `${payload?.activatedAt ? `\nActivated At: ${new Date(payload.activatedAt).toLocaleString()}` : ''}`
          );
        } catch (activationError) {
          const detailText = activationError?.details
            ? `\n\nDetails:\n${JSON.stringify(activationError.details, null, 2)}`
            : '';
          console.error('SureSystems activation failed:', {
            message: activationError?.message || 'Unknown activation error',
            details: activationError?.details || null
          });
          alert(
            `⚠️ Status changed to OFFER_ACCEPTED, but mandate activation failed.\n\n` +
            `${activationError?.message || 'Unknown activation error'}` +
            detailText
          );
          showFeedback(activationError?.message || 'SureSystems mandate activation failed', 'error');
        }
      } else {
        showFeedback('Status manually updated.', 'success');
      }

      await loadApplicationData();
    }
};

const modal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

const openModal = (title, body, confirmAction) => {
  if(modalTitle) modalTitle.textContent = title;
  if(modalBody) modalBody.textContent = body;
  actionToConfirm = confirmAction;
  if(modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
  } else {
      if(confirm(body)) confirmAction();
  }
};

const closeModal = () => {
  if(modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
  }
  actionToConfirm = null;
};

// ── SACRRA Gate helpers ───────────────────────────────────────────────────────
window.closeSACRRAGate = () => {
    document.getElementById('sacrra-gate-modal')?.classList.add('hidden');
};

window.approveAnywaySkipSACRRA = async () => {
    window.closeSACRRAGate();
    showFeedback('Approving loan — remember to complete SACRRA fields before monthly submission.', 'success');
    // Flag the application so the SACRRA Rejection Parser surfaces it
    await supabase.from('sacrra_rejections').upsert([{
        match_key:     `PENDING-${currentApplication?.id}`,
        error_code:    'W00',
        error_message: `Application ${currentApplication?.loan_number || currentApplication?.id} approved with incomplete SACRRA fields. Fix before monthly submission.`,
        resolved:      false,
    }], { onConflict: 'match_key,error_code', ignoreDuplicates: true }).catch(() => {});
    _doApprove();
};

window.saveSACRRAAndApprove = async () => {
    const btn = document.getElementById('sacrra-gate-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Saving…';

    try {
        const profileUpdates = {};
        const appUpdates = {};

        document.querySelectorAll('#sacrra-gate-fields [data-source][data-field]').forEach(input => {
            const field  = input.dataset.field;
            const source = input.dataset.source;
            const val    = input.value?.trim();
            if (!val) return;
            if (source === 'profile') profileUpdates[field] = val;
            if (source === 'application') appUpdates[field] = val;
        });

        if (Object.keys(profileUpdates).length) {
            // Rebuild full_name if first/last were set
            if (profileUpdates.first_name || profileUpdates.last_name) {
                const fn = profileUpdates.first_name || currentApplication.profiles?.first_name || '';
                const ln = profileUpdates.last_name  || currentApplication.profiles?.last_name  ||
                           currentApplication.profiles?.full_name?.split(' ').pop() || '';
                profileUpdates.full_name = `${fn} ${ln}`.trim();
            }
            const { error } = await supabase.from('profiles')
                .update({ ...profileUpdates, updated_at: new Date().toISOString() })
                .eq('id', currentApplication.user_id);
            if (error) throw new Error('Profile save failed: ' + error.message);
        }

        if (Object.keys(appUpdates).length) {
            const { error } = await supabase.from('loan_applications')
                .update({ ...appUpdates, updated_at: new Date().toISOString() })
                .eq('id', currentApplication.id);
            if (error) throw new Error('Application save failed: ' + error.message);
        }

        window.closeSACRRAGate();
        showFeedback('SACRRA fields saved — proceeding with approval…', 'success');

        // Reload and proceed
        await loadApplicationData();
        setTimeout(() => _doApprove(), 600);

    } catch (err) {
        showFeedback('Save failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">save</span> Save & Approve Loan';
    }
};

// Internal: perform the actual approval (called after gate passes)
const _doApprove = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: existingDisbursements } = await getDisbursementsByApplication(currentApplication.id);
  if (existingDisbursements && existingDisbursements.length > 0) {
    showFeedback('Disbursement already exists for this application.', 'error');
    return;
  }
  const { data: updatedApp, error } = await updateApplicationStatus(currentApplication.id, 'APPROVED');
  if (error) { showFeedback(error.message, 'error'); return; }
  const { data: cashsendConfig } = await getCashSendConfig();
  const bankAccountId = currentApplication.bank_account?.id || null;
  const { data: disbursement, error: disbursementError } = await createDisbursement({
    applicationId: currentApplication.id,
    userId: currentApplication.user_id,
    amount: updatedApp.amount,
    bankAccountId,
    createdBy: user.id
  });
  if (disbursementError) {
    showFeedback('Status updated but disbursement creation failed: ' + disbursementError.message, 'error');
  } else {
    let message = 'Application approved & disbursement created.';
    if (disbursement?.payout_method === 'cashsend' && disbursement?.cashsend_fee) {
      message += ` CashSend fee: R${disbursement.cashsend_fee.toFixed(2)}`;
    }
    showFeedback(message, 'success');
  }
  loadApplicationData();
};

// Final Approval with Disbursement — now runs SACRRA gate first
const approveApplication = async () => {
  closeModal();

  const profile = currentApplication?.profiles || {};
  const app     = currentApplication || {};
  const gate    = sacrraGate(app, profile);

  if (!gate.passed) {
    // Render the gate modal with missing fields
    const fieldsEl = document.getElementById('sacrra-gate-fields');
    const profileIssues = gate.issues.filter(i => i.source === 'profile');
    const appIssues     = gate.issues.filter(i => i.source === 'application');

    const renderGroup = (title, issues) => issues.length === 0 ? '' : `
      <div class="mb-6">
        <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">${title}</p>
        <div class="space-y-3">
          ${issues.map(f => `
            <div class="p-4 rounded-2xl border-2 ${f.readonly ? 'border-gray-100 bg-gray-50' : 'border-orange-100 bg-orange-50/30'}">
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-black text-gray-800">${f.label}</label>
                ${f.readonly ? '<span class="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Fix in sidebar</span>' : '<span class="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Required</span>'}
              </div>
              <p class="text-[11px] text-gray-500 mb-2">${f.hint}</p>
              ${f.readonly
                ? `<div class="text-xs text-gray-400 italic">${f.value || 'Not set'}</div>`
                : f.type === 'select'
                  ? `<select data-field="${f.field}" data-source="${f.source}"
                        class="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
                        <option value="">— Select —</option>
                        ${f.options.map(o => `<option value="${o}" ${f.value === o ? 'selected' : ''}>${o}</option>`).join('')}
                      </select>`
                  : `<input type="${f.type}" data-field="${f.field}" data-source="${f.source}"
                        value="${f.value || ''}" ${f.pattern ? `pattern="${f.pattern}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''}
                        class="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">`
              }
            </div>`).join('')}
        </div>
      </div>`;

    fieldsEl.innerHTML = `
      <div class="mb-4 flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
        <span class="material-symbols-outlined text-amber-500 text-[20px]">warning</span>
        <div>
          <p class="text-sm font-bold text-amber-800">${gate.issues.length} field${gate.issues.length > 1 ? 's' : ''} needed for the monthly SACRRA submission.</p>
          <p class="text-xs text-amber-600 mt-0.5">You can approve the loan now and fix these before submission day, or fill them in below.</p>
        </div>
      </div>
      ${renderGroup('Client Profile Fields', profileIssues)}
      ${renderGroup('Loan / Application Fields', appIssues)}
    `;

    document.getElementById('sacrra-gate-modal').classList.remove('hidden');
    return;
  }

  // Gate passed — approve immediately
  _doApprove();
};

// (legacy stub kept for reference — logic moved to approveApplication + _doApprove above)
// Legacy stub removed — logic consolidated into approveApplication + _doApprove above

const declineApplication = async () => {
  const { error } = await updateApplicationStatus(currentApplication.id, 'DECLINED');
  if (error) {
    showFeedback(error.message, 'error');
  } else {
    showFeedback('Application declined.', 'success');
    loadApplicationData();
  }
  closeModal();
};

// --- 4. Render Functions ---

const renderPersonalDetails = (profile, bankAccounts) => {
  const name = profile?.full_name || 'Unknown User';
  const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=random`;
  document.getElementById('profile-image').src = avatarUrl;
  document.getElementById('detail-fullname').textContent = name;
  document.getElementById('detail-email').textContent = profile?.email || 'N/A';
  document.getElementById('detail-mobile').textContent = profile?.contact_number || profile?.cell_tel_no || 'N/A';

  // Employer + Client Cap
  populateEmployerFields(profile);
  populateClientCap(profile);

  // Next of Kin — populate edit inputs
  const nokName = document.getElementById('nok-name-input');
  const nokRel  = document.getElementById('nok-relationship-input');
  const nokPhone = document.getElementById('nok-phone-input');
  if (nokName) nokName.value = profile?.nok_name || '';
  if (nokRel)  nokRel.value  = profile?.nok_relationship || '';
  if (nokPhone) nokPhone.value = profile?.nok_phone || '';

  // Identity number
  const idEl = document.getElementById('detail-identity-number');
  if (idEl) idEl.textContent = profile?.identity_number || 'N/A';

  const bankContainer = document.getElementById('bank-accounts-container');
  if (!bankContainer) return;
  bankContainer.innerHTML = '';

  if (bankAccounts && bankAccounts.length > 0) {
    bankAccounts.forEach(acc => {
      const div = document.createElement('div');
      div.className = 'p-4 border border-outline-variant/20 rounded-xl bg-surface-container-lowest flex justify-between items-center hover:border-[var(--color-primary)] hover:shadow-sm transition-all';
      div.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline">
                <span class="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
            <div>
                <p class="text-sm font-bold text-on-surface">${acc.bank_name || 'Unknown Bank'}</p>
                <p class="text-xs text-outline font-mono">${acc.account_number || '----'} • ${acc.account_type || 'Savings'}</p>
            </div>
        </div>
        ${acc.is_primary ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold border border-green-200">Primary</span>' : ''}
      `;
      bankContainer.appendChild(div);
    });
  } else {
    bankContainer.innerHTML = '<div class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 rounded-xl text-center">No bank accounts linked to this profile.</div>';
  }
};

const renderComplianceDetails = async (userId) => {
    const container = document.getElementById('personal-tab');
    if (!container || !userId) return;

    // FIX: Remove existing compliance sections to prevent stacking
    const existingCompliance = container.querySelector('.compliance-section');
    if (existingCompliance) existingCompliance.remove();

    // Fetch the declarations data for this specific user
    const { data: decl } = await supabase
        .from('declarations')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (!decl) return;

    // Create the Compliance section
    const complianceDiv = document.createElement('div');
    // FIX: Added 'compliance-section' class for targeting during cleanup
    complianceDiv.className = "mt-8 pt-8 border-t border-outline-variant/10 compliance-section";
    complianceDiv.innerHTML = `
        <h4 class="text-md font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-outline text-[20px]">shield</span> Compliance & Statutory Data
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                <p class="text-[10px] text-outline uppercase font-semibold tracking-widest">Marital Status</p>
                <p class="text-sm font-semibold text-on-surface capitalize">${decl.marital_status || 'Not Set'}</p>
            </div>
            <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                <p class="text-[10px] text-outline uppercase font-semibold tracking-widest">Residential Status</p>
                <p class="text-sm font-semibold text-on-surface capitalize">${decl.home_ownership || 'Not Set'}</p>
            </div>
        </div>

        ${decl.referral_provided ? `
        <div class="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p class="text-[10px] text-blue-400 uppercase font-bold mb-2">Referral Information</p>
            <div class="flex flex-col sm:flex-row gap-4">
                <div><span class="text-xs text-blue-600">Name:</span> <span class="text-sm font-bold text-blue-900">${decl.referral_name}</span></div>
                <div><span class="text-xs text-blue-600">Phone:</span> <span class="text-sm font-bold text-blue-900">${decl.referral_phone}</span></div>
            </div>
        </div>` : ''}
    `;
    container.appendChild(complianceDiv);
};

// Credit score trend — a compact single-series line chart plotting every
// historical credit_checks row for this borrower (not just the latest one).
// The data has always existed (every check inserts a new row rather than
// overwriting), it just wasn't rendered — this is the first place it's shown.
function renderScoreTrend(creditChecks) {
  const el = document.getElementById('credit-score-trend');
  if (!el) return;

  const points = (creditChecks || [])
    .filter(c => Number.isFinite(c.credit_score) || Number.isFinite(Number(c.credit_score)))
    .map(c => ({
      score: Number(c.credit_score),
      date: new Date(c.checked_at || c.created_at),
    }))
    .filter(p => Number.isFinite(p.score) && !isNaN(p.date.getTime()))
    .sort((a, b) => a.date - b.date);

  // A single point has nothing to trend — hide the section entirely rather
  // than show an empty/degenerate chart.
  if (points.length < 2) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');

  const W = 600, H = 140, PAD_L = 34, PAD_R = 16, PAD_T = 16, PAD_B = 24;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const scores = points.map(p => p.score);
  const dataMin = Math.min(...scores);
  const dataMax = Math.max(...scores);
  // Pad the range so the line never touches the top/bottom edge, clamped to
  // the real bureau score domain (300-999) so padding never invents a
  // misleading floor/ceiling.
  const yMin = Math.max(300, dataMin - 20);
  const yMax = Math.min(999, Math.max(dataMax + 20, yMin + 40));

  const tMin = points[0].date.getTime();
  const tMax = points[points.length - 1].date.getTime();
  const tSpan = Math.max(1, tMax - tMin);

  const xAt = (p) => PAD_L + ((p.date.getTime() - tMin) / tSpan) * plotW;
  const yAt = (score) => PAD_T + (1 - (score - yMin) / (yMax - yMin)) * plotH;

  const coords = points.map(p => ({ x: xAt(p), y: yAt(p.score), ...p }));

  // Single points get spread evenly on the x-axis if every check happened on
  // the same timestamp (tSpan would otherwise collapse every x to PAD_L).
  if (tMax === tMin) {
    coords.forEach((c, i) => { c.x = PAD_L + (points.length === 1 ? 0 : (i / (points.length - 1)) * plotW); });
  }

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${H - PAD_B} L ${coords[0].x.toFixed(1)} ${H - PAD_B} Z`;

  // 3 evenly spaced y gridlines/ticks, rounded to clean-ish score values.
  const tickCount = 3;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const v = yMin + (i / (tickCount - 1)) * (yMax - yMin);
    return Math.round(v / 10) * 10;
  });

  const first = coords[0];
  const last = coords[coords.length - 1];
  const delta = last.score - first.score;
  const deltaColor = delta > 0 ? '#16a34a' : (delta < 0 ? '#dc2626' : 'var(--color-outline)');
  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;

  el.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <h5 class="text-xs font-bold text-outline uppercase tracking-widest">Score History</h5>
      <span class="text-xs font-bold" style="color:${deltaColor}">
        ${deltaLabel} since ${formatDate(first.date)}
      </span>
    </div>
    <div class="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-3">
      <svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:${H}px" role="img" aria-label="Credit score history from ${first.score} to ${last.score}">
        ${ticks.map(t => {
          const y = yAt(t);
          return `
            <line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}" stroke="var(--color-outline-variant, #e5e7eb)" stroke-width="1" opacity="0.5" />
            <text x="${PAD_L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--color-outline, #9ca3af)">${t}</text>
          `;
        }).join('')}
        <path d="${areaPath}" fill="var(--color-primary)" opacity="0.08" />
        <path d="${linePath}" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        ${coords.map((c, i) => `
          <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="var(--color-primary)" stroke="var(--color-surface-container-lowest, #fff)" stroke-width="2">
            <title>${formatDate(c.date)} — score ${c.score}</title>
          </circle>
        `).join('')}
        <text x="${first.x.toFixed(1)}" y="${H - 6}" text-anchor="start" font-size="9" fill="var(--color-outline, #9ca3af)">${formatDate(first.date)}</text>
        <text x="${last.x.toFixed(1)}" y="${H - 6}" text-anchor="end" font-size="9" fill="var(--color-outline, #9ca3af)">${formatDate(last.date)}</text>
      </svg>
    </div>
    <div class="flex gap-2 mt-2 overflow-x-auto pb-1">
      ${coords.map(c => `
        <div class="shrink-0 px-2.5 py-1 rounded-lg bg-surface-container text-[10px] font-semibold text-outline border border-outline-variant/10">
          ${formatDate(c.date)} · <span class="text-on-surface">${c.score}</span>
        </div>
      `).join('')}
    </div>
  `;
}

const renderFinancials = (financials, creditChecks) => {
  // 1. Fetch Financial Profile Data
  const profile = (financials && financials[0]) ? financials[0] : {};
  const parsed = profile.parsed_data || { income: {}, expenses: {} };

  // Update Primary Snapshot
  document.getElementById('fin-income').textContent = formatCurrency(profile.monthly_income || 0);
  document.getElementById('fin-expenses').textContent = formatCurrency(profile.monthly_expenses || 0);
  
  const creditContainer = document.getElementById('credit-check-content');
  const creditDate = document.getElementById('credit-date');
  const reportBtn = document.getElementById('btn-download-xml'); // Repurposing ID
  
  if (!creditContainer) return;

  // --- NEW: Detailed Affordability Table (Step 3 Data) ---
  
  let breakdownContainer = document.getElementById('affordability-breakdown-list');
  if (!breakdownContainer) {
      const grid = document.querySelector('#financial-tab .grid');
      const div = document.createElement('div');
      div.id = 'affordability-breakdown-list';
      div.className = "mt-6 p-6 bg-surface-container rounded-2xl border border-outline-variant/10";
      grid.after(div);
      breakdownContainer = div;
  }

  const salary = Number(parsed.income.salary || 0);
  const otherIncome = Number(parsed.income.other_monthly_earnings || 0);
  const totalIncome = salary + otherIncome;
  const totalExpenses = Object.values(parsed.expenses || {}).reduce((s, v) => s + Number(v || 0), 0);
  const disposable = Number(profile.affordability_ratio || (totalIncome - totalExpenses));

  breakdownContainer.innerHTML = `
    <h4 class="text-[10px] font-semibold text-outline uppercase tracking-widest mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px]">checklist</span> Monthly Budget Breakdown
    </h4>

    <div class="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
      <p class="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Income Sources — tick to include in affordability</p>
      <div class="space-y-2">
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" id="inc-salary-toggle" class="w-4 h-4 rounded accent-orange-500" ${salary > 0 ? 'checked' : ''} onchange="window.recalcAffordability()">
            Basic Salary (Net)
          </span>
          <span class="text-sm font-bold text-slate-900">${formatCurrency(salary)}</span>
        </label>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" id="inc-other-toggle" class="w-4 h-4 rounded accent-orange-500" ${otherIncome > 0 ? 'checked' : ''} onchange="window.recalcAffordability()">
            Other Earnings
          </span>
          <span class="text-sm font-bold text-slate-900">${formatCurrency(otherIncome)}</span>
        </label>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">Housing / Rent</span>
            <span class="text-sm font-bold text-on-surface">${formatCurrency(parsed.expenses.housing_rent || 0)}</span>
        </div>
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">School Fees</span>
            <span class="text-sm font-bold text-on-surface">${formatCurrency(parsed.expenses.school || 0)}</span>
        </div>
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">Transport / Fuel</span>
            <span class="text-sm font-bold text-on-surface">${formatCurrency(parsed.expenses.petrol || 0)}</span>
        </div>
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">Total Expenses</span>
            <span class="text-sm font-bold text-red-600">${formatCurrency(totalExpenses)}</span>
        </div>
    </div>

    <div class="mt-4 p-4 rounded-xl border-2 border-dashed" style="border-color:var(--color-primary);background:color-mix(in srgb, var(--color-primary) 5%, white)">
      <div class="flex justify-between items-center">
        <span class="text-sm font-bold text-on-surface">Disposable Surplus</span>
        <span id="calc-disposable" class="text-lg font-black" style="color:var(--color-primary)">${formatCurrency(disposable)}</span>
      </div>
      <p class="text-[10px] text-outline mt-1">Included income minus total expenses</p>
    </div>
  `;

  // Store income data on window for the toggle recalc
  window._incomeData = { salary, otherIncome, totalExpenses };
  
  const latest = (creditChecks && creditChecks.length > 0) ? creditChecks[0] : null;

  if (latest) {
      const score = latest.credit_score || 0;
      const scoreColor = score > 600 ? 'text-green-600' : (score > 500 ? 'text-yellow-600' : 'text-red-600');
      if(creditDate) creditDate.textContent = `Checked on ${formatDate(latest.checked_at || latest.created_at || new Date())}`;

      // --- BUREAU PDF LOGIC (Step 2 Data) ---
      if (reportBtn) {
        // Use raw_xml_data which stores the base64 string from Experian
        const pdfData = latest.raw_xml_data; 

        if (pdfData) {
            reportBtn.classList.remove('hidden');
            reportBtn.innerHTML = `<span class="material-symbols-outlined text-[16px] mr-1">picture_as_pdf</span> View Bureau Report`;
            reportBtn.className = "text-sm text-white px-4 py-2 rounded-xl transition-colors shadow-sm font-semibold flex items-center gap-1";
            reportBtn.style.background = 'var(--color-primary)';
            reportBtn.onclick = () => window.viewBureauReport(pdfData); // Calling helper from Part 2
        } else {
            reportBtn.classList.add('hidden');
        }
      }

      creditContainer.innerHTML = `
        <div class="p-6 border-b border-outline-variant/10 text-center bg-surface-container-lowest">
            <div class="text-6xl font-extrabold ${scoreColor} mb-2 tracking-tighter">${score}</div>
            <p class="font-bold text-outline uppercase tracking-widest text-[10px]">Bureau Score</p>
            <span class="inline-block mt-2 px-3 py-1 rounded-full bg-surface-container text-outline text-xs font-semibold border border-outline-variant/20">${latest.score_band || 'Standard'}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-surface-container">
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold text-on-surface">${latest.total_accounts || 0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Total Acc</span>
            </div>
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold text-red-600">${latest.accounts_with_arrears || 0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Arrears</span>
            </div>
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold" style="color:var(--color-primary)">${latest.total_enquiries || 0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Enquiries</span>
            </div>
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold text-on-surface">${latest.total_judgments || 0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Judgments</span>
            </div>
        </div>
        <div class="p-6 bg-surface-container-lowest border-t border-outline-variant/10 space-y-3">
            <div class="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                <span class="text-sm text-outline">Total Balance</span>
                <span class="font-bold text-on-surface">${formatCurrency(latest.total_balance || 0)}</span>
            </div>
            <div class="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                <span class="text-sm text-outline">Judgment Value</span>
                <span class="font-bold text-red-600">${formatCurrency(latest.total_judgment_amount || 0)}</span>
            </div>
            ${latest.ncr_reference ? `
            <div class="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                <span class="text-sm text-outline flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[14px] text-green-600">verified</span>
                    NCR Reporting Reference
                </span>
                <span class="font-mono text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg">${latest.ncr_reference}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-sm text-outline">Reported to NCR</span>
                <span class="font-bold ${latest.reported_to_ncr ? 'text-green-600' : 'text-gray-400'}">
                    ${latest.reported_to_ncr ? '✓ Yes — ' + (latest.reported_at ? formatDate(latest.reported_at) : 'Confirmed') : 'Pending'}
                </span>
            </div>` : `
            <div class="flex justify-between items-center">
                <span class="text-sm text-outline flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[14px] text-yellow-500">warning</span>
                    NCR Reference
                </span>
                <span class="text-xs text-yellow-600 font-semibold">Not yet generated — run credit check</span>
            </div>`}
        </div>
      `;
  } else {
      if(creditDate) creditDate.textContent = '';
      if(reportBtn) reportBtn.classList.add('hidden');
      creditContainer.innerHTML = `<div class="py-12 text-center text-gray-400"><p>No bureau data available.</p></div>`;
  }

  renderScoreTrend(creditChecks);

  // ── Decline reasons ───────────────────────────────────────────
  const declineReasons = currentApplication?.credit_decline_reasons;
  if (Array.isArray(declineReasons) && declineReasons.length > 0) {
      let existing = document.getElementById('decline-reasons-panel');
      if (!existing) {
          existing = document.createElement('div');
          existing.id = 'decline-reasons-panel';
          existing.className = 'mt-6 p-5 rounded-2xl border border-red-200 bg-red-50';
          const creditSection = document.querySelector('#financial-tab .pt-8');
          if (creditSection) creditSection.after(existing);
          else document.getElementById('financial-tab')?.appendChild(existing);
      }
      existing.innerHTML = `
        <h4 class="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">cancel</span>
          Decline Reasons (${declineReasons.length})
        </h4>
        <div class="space-y-2">
          ${declineReasons.map(r => `
            <div class="flex items-start gap-3 p-3 bg-white rounded-xl border border-red-100">
              <span class="material-symbols-outlined text-[16px] text-red-500 mt-0.5">block</span>
              <div>
                <p class="text-sm font-semibold text-red-900">${r.label || r.rule_key || 'Rule Failed'}</p>
                ${r.reason ? `<p class="text-xs text-red-600 mt-0.5">${r.reason}</p>` : ''}
              </div>
            </div>`).join('')}
        </div>`;
  }
};
/**
 * Renders Document List with Admin Upload/Replace capability
 */
const renderDocuments = (docs, truidInfo, kycInfo) => {
  const docList = document.getElementById('documents-list');
  const docCount = document.getElementById('doc-count');
  if (!docList || !docCount) return;

  const docTypes = [
      { key: 'idcard', label: 'ID Document' },
      { key: 'till_slip', label: 'Latest Payslip' },
      { key: 'bank_statement', label: 'Bank Statement' },
      { key: 'proof_of_residence', label: 'Proof of Residence', maxAgeDays: 90 },
      { key: 'credit_life_contract', label: 'Credit Life Contract' }
  ];
  
  let kycCount = 0;
  if (kycInfo) {
    if (kycInfo.id_front_image_url) kycCount++;
    if (kycInfo.id_back_image_url) kycCount++;
    if (kycInfo.selfie_image_url) kycCount++;
  }
  
  docCount.textContent = (docs?.length || 0) + (truidInfo ? 1 : 0) + kycCount;
  docList.innerHTML = '';

  // 1. Render Manual Uploads (with KYC awareness for the ID)
  docTypes.forEach(type => {
      const manualDoc = docs.find(d => d.file_type === type.key);
      
      // NEW LOGIC: Check if this is an ID card AND if we have KYC session images
      const hasKycId = type.key === 'idcard' && (kycInfo?.id_front_image_url || kycInfo?.id_back_image_url);
      
      // Check max-age (e.g. proof of residence must be < 90 days old — FICA requirement)
      let porExpired = false;
      if (manualDoc && type.maxAgeDays && manualDoc.created_at) {
          const ageMs  = Date.now() - new Date(manualDoc.created_at).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          if (ageDays > type.maxAgeDays) porExpired = true;
      }

      const isVerified = (manualDoc || hasKycId) && !porExpired;
      const statusColor = porExpired ? 'text-yellow-600 bg-yellow-100'
          : isVerified ? 'text-green-600 bg-green-100' : 'text-gray-400 bg-gray-100';
      const icon = porExpired ? 'fa-triangle-exclamation'
          : isVerified ? 'fa-check-circle' : 'fa-upload';
      const subtext = hasKycId ? 'Verified via KYC Session'
          : porExpired ? `Expired — older than ${type.maxAgeDays} days (FICA). Please re-upload.`
          : manualDoc ? 'File Verified' : 'Missing Document';

      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-300 transition-all group';
      
      div.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl ${statusColor} flex items-center justify-center">
                <i class="fa-solid ${icon} text-xl"></i>
            </div>
            <div class="flex-grow min-w-0">
                <p class="text-sm font-bold text-gray-900">${type.label}</p>
                <p class="text-xs text-gray-500">${subtext}</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${manualDoc ? `
            <button onclick="handleSmartDownload('${manualDoc.file_path}')" class="w-10 h-10 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all">
                <i class="fa-solid fa-eye"></i>
            </button>` : ''}
            
            <label class="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-all">
                ${isVerified ? 'Replace' : 'Upload'}
                <input type="file" class="hidden admin-doc-upload" data-type="${type.key}" accept=".pdf,.jpg,.png,.jpeg">
            </label>
        </div>
      `;
      docList.appendChild(div);
  });

  // 2. Render TruID Card
  if (truidInfo) {
    const isVerified = truidInfo.verified === true;
    const truidStatus = truidInfo.normalized_status || truidInfo.status || 'Linked';
    
    const truidDiv = document.createElement('div');
    // We use a distinct blue background to separate Digital Data from manual PDF uploads
    truidDiv.className = 'flex items-center justify-between p-4 bg-blue-50/50 border border-blue-200 rounded-xl hover:border-blue-400 transition-all mt-4';
    
    truidDiv.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl ${isVerified ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'} flex items-center justify-center shadow-sm">
                <i class="fa-solid fa-shield-halved text-xl"></i>
            </div>
            <div class="flex-grow min-w-0">
                <p class="text-sm font-bold text-gray-900">TruID Digital Verification</p>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">${truidStatus}</span>
                    <p class="text-[10px] text-gray-400 font-medium">Ref: ${(truidInfo.collection_id || '').slice(0,8)}</p>
                </div>
            </div>
        </div>
        <button onclick="window.viewTruidReport()" class="px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all">
            Inspect Data
        </button>
    `;
    docList.appendChild(truidDiv);
  }

  // 3. Render Detailed KYC Image Cards
  if (kycInfo) {
    const kycDocs = [
      { key: 'id_front', label: 'KYC ID Front', url: kycInfo.id_front_image_url },
      { key: 'id_back', label: 'KYC ID Back', url: kycInfo.id_back_image_url },
      { key: 'selfie', label: 'KYC Selfie', url: kycInfo.selfie_image_url }
    ].filter(d => d.url);

    kycDocs.forEach(doc => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-4 bg-purple-50/50 border border-purple-200 rounded-xl hover:border-purple-400 transition-all mt-4';
      
      div.innerHTML = `
          <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                  <i class="fa-solid fa-id-card text-xl"></i>
              </div>
              <div class="flex-grow min-w-0">
                  <p class="text-sm font-bold text-gray-900">${doc.label}</p>
                  <div class="flex items-center gap-2">
                      <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700">Digital KYC</span>
                      <p class="text-[10px] text-gray-400 font-medium">Session ID: ${(kycInfo.session_id || '').slice(0,8)}</p>
                  </div>
              </div>
          </div>
          <button onclick="window.open('${doc.url}', '_blank')" class="px-4 py-2 bg-white border border-purple-600 text-blue-600 rounded-lg text-xs font-bold hover:bg-purple-50 transition-all">
              <i class="fa-solid fa-external-link-alt mr-1"></i> View
          </button>
      `;
      docList.appendChild(div);
    });
  }

  attachAdminUploadListeners();
};

/**
 * Handles the Admin Folder Strategy Uploads
 */
const attachAdminUploadListeners = () => {
    document.querySelectorAll('.admin-doc-upload').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0]; 
            if(!file || !currentApplication) return;
            const type = e.target.dataset.type;
            
            const label = e.target.parentElement; 
            const originalText = label.childNodes[0].textContent;
            label.childNodes[0].textContent = 'Processing...';
            
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const adminId = session.user.id;
                const fileExt = file.name.split('.').pop();
                const fileName = `${type}_${Date.now()}.${fileExt}`;
                
                // Upload to ADMIN folder (ID) using the Client ID in the filename
                const filePath = `${adminId}/${currentApplication.user_id}_${fileName}`;
                
                // 1. Storage Upload
                const { error: uploadError } = await supabase.storage
                    .from('client_docs')
                    .upload(filePath, file, { upsert: true });
                
                if (uploadError) throw uploadError;

                // 2. Database Registration via RPC
                const { error: dbError } = await supabase.rpc('register_admin_upload', {
                    p_user_id: currentApplication.user_id,
                    p_app_id: currentApplication.id,
                    p_file_name: fileName,
                    p_original_name: file.name,
                    p_file_path: filePath,
                    p_file_type: type,
                    p_mime_type: file.type,
                    p_file_size: file.size
                });

                if (dbError) throw dbError;
                
                showFeedback('Document Updated Successfully', 'success');
                loadApplicationData(); // Refresh view
                
            } catch (err) { 
                console.error(err);
                showFeedback(err.message, 'error'); 
            } finally {
                label.childNodes[0].textContent = originalText;
            }
        });
    });
};

window.handleSmartDownload = async (inputPath) => {
    try {
        // 1. Clean the path in case it's still a full URL
        let cleanPath = inputPath;
        if (inputPath.includes('/storage/v1/object/')) {
            // Split after the bucket name to get the relative path
            const parts = inputPath.split('/');
            // Usually, the path starts after the 8th segment in Supabase storage URLs
            cleanPath = parts.slice(8).join('/');
        }

        // 2. Try 'client_docs' bucket first (In-Branch Admin Folder strategy)
        let { data, error } = await supabase.storage
            .from('client_docs')
            .createSignedUrl(cleanPath, 60);

        // 3. Fallback: If not found, try the 'documents' bucket (User-uploaded files)
        if (error || !data) {
             ({ data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(cleanPath, 60));
        }

        if (error) throw error;
        
        window.open(data.signedUrl, '_blank');

    } catch (err) {
        console.error("Smart Download Error:", err);
        showFeedback("File not found in any bucket. Please check storage manually.", "error");
    }
};

/**
 * Renders metadata and history for the Loan & History tab
 */
const renderLoanHistory = async (loans, appHistory, currentApp) => {
  const loanList = document.getElementById('loan-history-list');
  const appList = document.getElementById('app-history-list');
  
  // --- 1. RESTORED: Admin Metadata Fetching via UUID ---
  let adminSection = document.getElementById('admin-metadata-container');
  if (currentApp) {
      const container = document.getElementById('loan-tab');
      
      // Ensure container exists for injection
      if (!adminSection) {
          adminSection = document.createElement('div');
          adminSection.id = 'admin-metadata-container';
          adminSection.className = 'mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-8';
          
          // Policy: Inject above the "Client History" heading for accountability
          const historyHeading = Array.from(container.querySelectorAll('h3')).find(h => h.textContent.includes('Client History'));
          if (historyHeading) {
              container.insertBefore(adminSection, historyHeading);
          } else {
              container.appendChild(adminSection);
          }
      }

      try {
          // Identify UUIDs for lookup
          const adminIds = [currentApp.created_by_admin, currentApp.reviewed_by_admin].filter(Boolean);
          
          // Query the profiles table for names
          const { data: admins } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', adminIds);

          const creatorName = admins?.find(a => a.id === currentApp.created_by_admin)?.full_name || 'System / User';
          const reviewerName = admins?.find(a => a.id === currentApp.reviewed_by_admin)?.full_name || 'Pending Review';

          adminSection.innerHTML = `
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">Created By</p>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold">
                        ${creatorName.charAt(0)}
                    </div>
                    <span class="text-sm font-bold text-gray-800">${creatorName}</span>
                </div>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">Reviewed By</p>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">
                        ${reviewerName.charAt(0)}
                    </div>
                    <span class="text-sm font-bold text-gray-800">${reviewerName}</span>
                </div>
            </div>
          `;
      } catch (err) {
          console.error("Admin UUID Lookup Error:", err);
      }
  }

  // --- 2. RENDER HISTORY LISTS ---
  if (loanList) {
      loanList.innerHTML = '';
      if (loans && loans.length > 0) {
        loans.forEach(loan => {
            const div = document.createElement('div');
            div.className = 'p-3 border-b border-gray-100 last:border-0';
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <span class="block font-bold text-gray-800 text-sm">Loan #${loan.id}</span>
                        <span class="text-xs text-gray-500">${formatDate(loan.start_date || loan.created_at)}</span>
                    </div>
                    <div class="text-right">
                        <span class="block font-bold text-gray-900 text-sm">${formatCurrency(loan.principal_amount || 0)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold uppercase">${loan.status || 'Active'}</span>
                    </div>
                </div>
            `;
            loanList.appendChild(div);
        });
      } else {
        loanList.innerHTML = `<p class="text-sm text-gray-400 italic p-2">No previous loan history found.</p>`;
      }
  }

  if (appList) {
      appList.innerHTML = '';
      if (appHistory && appHistory.length > 0) {
        appHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 border-b border-gray-100 last:border-0';
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-bold block text-gray-800 text-sm">App #${item.id}</span>
                        <span class="text-xs text-gray-500">${formatDate(item.created_at)}</span>
                    </div>
                    <div class="text-right">
                        <span class="block text-gray-600 font-medium text-sm">${formatCurrency(item.amount || 0)}</span>
                        <span class="text-[10px] uppercase font-bold text-orange-500">${item.status}</span>
                    </div>
                </div>
            `;
            appList.appendChild(div);
        });
      } else {
        appList.innerHTML = `<p class="text-sm text-gray-400 italic p-2">No other applications on record.</p>`;
      }
  }
};

const renderCreditLifeContractPanel = (app) => {
  const badge = document.getElementById('credit-life-status-badge');
  const summary = document.getElementById('credit-life-contract-summary');
  const gallery = document.getElementById('credit-life-signature-gallery');
  const viewBtn = document.getElementById('credit-life-view-contract-btn');
  const downloadBtn = document.getElementById('credit-life-download-contract-btn');
  if (!badge || !summary || !gallery) return;

  const offerDetails = app?.offer_details || {};
  const hasCreditLife = Boolean(app?.has_credit_life_insurance || offerDetails.credit_life_enabled);
  const contractSigned = Boolean(offerDetails.credit_life_contract_signed && offerDetails.credit_life_signature_data);
  const signedAt = offerDetails.credit_life_signed_at ? formatDate(offerDetails.credit_life_signed_at) : 'Not signed';
  const contractVersion = offerDetails.credit_life_contract_version || 'v1';
  const contractText = offerDetails.credit_life_contract_text || 'No signed contract snapshot stored.';
  const contractFilePath = offerDetails.credit_life_contract_file_path || null;
  const creditLifeTotal = Number(
    offerDetails.credit_life_total
    ?? app?.offer_credit_life_total
    ?? 0
  );

  badge.textContent = hasCreditLife
    ? (contractSigned ? 'Selected and signed' : 'Selected, signature missing')
    : 'Not selected';
  badge.className = `px-3 py-1 text-xs font-bold rounded-full ${
    !hasCreditLife
      ? 'bg-gray-200 text-gray-700'
      : contractSigned
        ? 'bg-green-100 text-green-700'
        : 'bg-yellow-100 text-yellow-700'
  }`;

  summary.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Insurance Status</p>
        <p class="font-semibold text-gray-900">${hasCreditLife ? 'Opted in' : 'Not added'}</p>
      </div>
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Signed At</p>
        <p class="font-semibold text-gray-900">${escapeHtml(signedAt)}</p>
      </div>
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Contract Version</p>
        <p class="font-semibold text-gray-900">${escapeHtml(contractVersion)}</p>
      </div>
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Credit Life Premium</p>
        <p class="font-semibold text-gray-900">${formatCurrency(creditLifeTotal)}</p>
      </div>
    </div>
    <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
      <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Signed Contract Text</p>
      <div class="text-sm leading-6 text-gray-700 whitespace-pre-wrap">${escapeHtml(contractText)}</div>
    </div>
  `;

  const loanSignature = offerDetails.signature_data;
  const creditLifeSignature = offerDetails.credit_life_signature_data;
  const renderSignatureCard = (title, signature, subtitle) => `
    <div class="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">${title}</p>
      <p class="text-xs text-gray-500 mb-3">${subtitle}</p>
      ${
        signature
          ? `<img src="${signature}" alt="${title}" class="w-full h-40 object-contain rounded-lg border border-gray-200 bg-white">`
          : `<div class="h-40 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center text-sm text-gray-400">No signature captured</div>`
      }
    </div>
  `;

  gallery.innerHTML = [
    renderSignatureCard('Main Loan Signature', loanSignature, 'Captured from the standard loan acknowledgement step.'),
    renderSignatureCard('Credit Life Signature', creditLifeSignature, 'Captured only when the Credit Life contract is signed.')
  ].join('');

  if (viewBtn) {
    viewBtn.classList.toggle('hidden', !hasCreditLife);
    viewBtn.onclick = () => openCreditLifeContractModal(app);
  }

  if (downloadBtn) {
    downloadBtn.classList.toggle('hidden', !contractFilePath);
    downloadBtn.onclick = () => {
      if (!contractFilePath) return;
      if (/^https?:\/\//i.test(contractFilePath)) {
        window.open(contractFilePath, '_blank');
      } else {
        handleSmartDownload(contractFilePath);
      }
    };
  }
};

const openCreditLifeContractModal = (app) => {
  const modal = document.getElementById('credit-life-contract-modal');
  const body = document.getElementById('credit-life-contract-modal-body');
  if (!modal || !body) return;

  const offerDetails = app?.offer_details || {};
  const signedAt = offerDetails.credit_life_signed_at ? formatDate(offerDetails.credit_life_signed_at) : 'Not signed';
  const contractVersion = offerDetails.credit_life_contract_version || 'v1';
  const contractText = offerDetails.credit_life_contract_text || 'No signed contract snapshot stored.';
  const loanSignature = offerDetails.signature_data;
  const creditLifeSignature = offerDetails.credit_life_signature_data;

  const renderSignaturePreview = (title, signature) => `
    <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">${title}</p>
      ${
        signature
          ? `<img src="${signature}" alt="${title}" class="w-full h-56 object-contain rounded-xl border border-gray-200 bg-white">`
          : `<div class="w-full h-56 rounded-xl border border-dashed border-gray-300 bg-white flex items-center justify-center text-sm text-gray-400">No signature captured</div>`
      }
    </div>
  `;

  body.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">Application</p>
        <p class="text-sm font-bold text-gray-900">${escapeHtml(app?.id || '')}</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">Signed At</p>
        <p class="text-sm font-bold text-gray-900">${escapeHtml(signedAt)}</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">Version</p>
        <p class="text-sm font-bold text-gray-900">${escapeHtml(contractVersion)}</p>
      </div>
    </div>
    <div class="rounded-3xl border border-gray-200 bg-white p-5 mb-6">
      <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-3">Contract Text</p>
      <div class="whitespace-pre-wrap text-sm leading-7 text-gray-700">${escapeHtml(contractText)}</div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${renderSignaturePreview('Main Loan Signature', loanSignature)}
      ${renderSignaturePreview('Credit Life Signature', creditLifeSignature)}
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

const closeCreditLifeContractModal = () => {
  const modal = document.getElementById('credit-life-contract-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
};


const renderDisbursementSection = async (app) => {
  const container = document.getElementById('action-buttons-container');
  if (!container) return;

  try {
    const { data: disbursements } = await getDisbursementsByApplication(app.id);
    const { data: cashsendConfig } = await getCashSendConfig();

    if (!disbursements || disbursements.length === 0) {
      container.innerHTML = `
        <div class="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-center">
          <p class="text-sm font-bold text-yellow-800">Disbursement Not Found</p>
        </div>
      `;
      return;
    }

    const disb = disbursements[0];
    let feeInfo = '';
    if (disb.payout_method === 'cashsend' && disb.cashsend_fee) {
      feeInfo = `
        <div class="rounded-lg bg-orange-50 border border-orange-200 p-3 mt-3">
          <p class="text-xs font-bold text-orange-700 uppercase mb-2">CashSend Fees</p>
          <p class="text-sm text-orange-800">R${disb.cashsend_fee.toFixed(2)}</p>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="space-y-3">
        <div class="p-4 bg-green-50 border border-green-100 rounded-xl">
          <p class="text-xs font-bold text-green-700 uppercase mb-2">Disbursement Details</p>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-green-600">Amount</p>
              <p class="font-bold text-green-900">R${disb.amount.toFixed(2)}</p>
            </div>
            <div>
              <p class="text-xs text-green-600">Payout Method</p>
              <p class="font-bold text-green-900 capitalize">${disb.payout_method}</p>
            </div>
            <div>
              <p class="text-xs text-green-600">Status</p>
              <p class="font-bold text-green-900 capitalize">${disb.status}</p>
            </div>
            <div>
              <p class="text-xs text-green-600">Date</p>
              <p class="font-bold text-green-900">${formatDate(disb.created_at)}</p>
            </div>
          </div>
        </div>
        ${feeInfo}
        <button onclick="handleDisbursementExport(${app.id})" class="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-colors">
          <i class="fa-solid fa-file-csv mr-2"></i> Export CSV
        </button>
      </div>
    `;
  } catch (error) {
    console.error('Error rendering disbursement section:', error);
    container.innerHTML = `<div class="p-4 bg-red-50 border border-red-100 rounded-xl text-center"><p class="text-sm font-bold text-red-800">Error loading disbursement</p></div>`;
  }
};

const renderSidePanel = (app) => {
  if (!app) return;
  const status = app.status || 'pending';
  const statusEl = document.getElementById('sidebar-status');
  const alertEl = document.getElementById('status-alert');
  const actionsContainer = document.getElementById('action-buttons-container');

  // --- 1. DATABASE-DRIVEN FINANCIAL LOGIC ---
  // We prioritize the 'offer_' columns which are pre-calculated and stored in Supabase
  const principal = parseFloat(app.offer_principal || app.amount || 0);
  const term = parseInt(app.term_months || 1);
  const totalInterest = parseFloat(app.offer_total_interest || 0);
  const totalInitiationFees = parseFloat(app.offer_total_initiation_fees || 0);
  const totalMonthlyFees = parseFloat(app.offer_total_admin_fees || 0);
  const totalCreditLife = parseFloat(app.offer_details?.credit_life_total || app.offer_credit_life_total || 0);
  const totalRepayment = parseFloat(app.offer_total_repayment || 0);
  const monthlyPayment = parseFloat(app.offer_monthly_repayment || 0);
  const annualRate = parseFloat(app.offer_interest_rate || 0);

  // --- 2. FETCH REPAYMENT DATE FROM DB ---
  const scheduledDate = app.repayment_start_date || (app.offer_details?.first_payment_date);

  // --- 3. UPDATE PRIMARY SIDEBAR FIELDS ---
  document.getElementById('sidebar-amount').textContent = formatCurrency(principal);
  document.getElementById('sidebar-term').textContent = `${term} Month${term > 1 ? 's' : ''}`;
  document.getElementById('sidebar-payment').textContent = formatCurrency(monthlyPayment);

  // --- 4. INJECT DETAILED BREAKDOWN FROM DB ---
  let breakdown = document.getElementById('financial-breakdown');
  if (!breakdown) {
      const paymentBlock = document.getElementById('sidebar-payment').parentElement.parentElement;
      breakdown = document.createElement('div');
      breakdown.id = 'financial-breakdown';
      breakdown.className = "pt-4 border-t border-gray-100 space-y-4";
      paymentBlock.after(breakdown);
  }

  breakdown.innerHTML = `
    <div class="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Tiered Interest (${(annualRate * 100).toFixed(1)}%)</span>
            <span class="font-bold text-gray-900">${formatCurrency(totalInterest)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Initiation Fee</span>
            <span class="font-bold text-gray-900">${formatCurrency(totalInitiationFees)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Monthly Service Fee</span>
            <span class="font-bold text-gray-900">${formatCurrency(totalMonthlyFees)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Credit Life Insurance</span>
            <span class="font-bold text-gray-900">${formatCurrency(totalCreditLife)}</span>
        </div>
        <div class="pt-2 border-t border-gray-200 flex justify-between items-center">
            <span class="text-xs font-black uppercase text-gray-700">Total Repayable</span>
            <span class="text-sm font-black text-green-600">${formatCurrency(totalRepayment)}</span>
        </div>
    </div>
    
    <div class="mt-4">
      <label class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1 block">Scheduled Payout Info</label>
      <div class="p-3 bg-orange-50 border border-orange-100 rounded-xl transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs text-orange-800 font-medium">First Repayment:</span>
          <span class="text-xs font-bold text-orange-900">
            ${scheduledDate ? formatDate(scheduledDate) : 'Not Scheduled'}
          </span>
        </div>
      </div>
    </div>

    <div class="mt-4">
      <label class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1 block">Admin Override: Loan Term</label>
      <div class="flex gap-2 items-end">
        <div class="flex-1">
          <input
            type="number"
            id="admin-loan-term-override"
            min="1"
            max="36"
            value="${term}"
            class="w-full px-3 py-2 border border-blue-300 rounded-lg bg-blue-50 text-sm font-bold"
            placeholder="Months"
          />
          <small class="text-blue-600 mt-1 block">Leave loan term open for admin review</small>
        </div>
        <button
          type="button"
          id="admin-update-loan-term-btn"
          class="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
          onclick="handleAdminLoanTermOverride(${app.id})"
        >
          <i class="fa-solid fa-check"></i> Set
        </button>
      </div>
    </div>
  `;

  // --- 5. STATUS BADGE & MANUAL OVERRIDE ---
  if (statusEl) {
      statusEl.textContent = status.replace('_', ' ');
      statusEl.className = `mt-2 text-lg font-bold uppercase tracking-wide ${getBadgeColor(status).split(' ')[0].replace('bg-', 'text-').replace('-100', '-600')}`;
  }

  const manualSelect = document.getElementById('status-override-select');
  const manualBtn = document.getElementById('manual-update-btn');
  const hint = document.getElementById('override-hint');
  
  if (status === 'DISBURSED') {
      if (manualSelect) manualSelect.disabled = true;
      if (manualBtn) {
          manualBtn.disabled = true;
          manualBtn.classList.add('opacity-50', 'cursor-not-allowed');
          manualBtn.innerText = "Locked";
      }
      if (hint) hint.textContent = "🔒 Application is active. Modifications disabled.";
  } else {
      if (manualSelect) { manualSelect.disabled = false; manualSelect.value = status; }
      if (manualBtn) { manualBtn.disabled = false; manualBtn.innerText = "Update"; }
  }

  // --- 6. ALERTS & DYNAMIC ACTION BUTTONS ---
  if (alertEl) {
      alertEl.className = 'mt-3 p-3 rounded-lg text-xs font-medium leading-relaxed hidden';
      if (status === 'OFFERED') {
          alertEl.textContent = "Contract Sent. Waiting for user to sign.";
          alertEl.classList.add('bg-purple-50', 'text-purple-700', 'block');
      } else if (status === 'APPROVED') {
          alertEl.textContent = "Application is queued for disbursement.";
          alertEl.classList.add('bg-green-50', 'text-green-700', 'block');
      }
  }

  if (actionsContainer) {
      actionsContainer.innerHTML = '';

      if (['BUREAU_OK', 'BANK_LINKING', 'STARTED', 'AFFORD_REFER', 'BUREAU_REFER'].includes(status)) {
          const referMessage = (status === 'AFFORD_REFER' || status === 'BUREAU_REFER') 
            ? `<div class="p-3 bg-orange-50 border border-orange-100 rounded-lg mb-3 text-xs text-orange-700 font-bold"><i class="fa-solid fa-circle-exclamation mr-1"></i> Currently Under Manual Review</div>` 
            : '';

          actionsContainer.innerHTML = `
            ${referMessage}
            <h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Assessment</h4>
            <button onclick="updateStatus('AFFORD_OK')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl mb-2 shadow-lg"><i class="fa-solid fa-check-circle mr-2"></i> Confirm Affordability</button>
            ${!status.includes('REFER') ? `<button onclick="updateStatus('AFFORD_REFER')" class="w-full py-3 bg-white border border-orange-200 text-orange-600 text-sm font-bold rounded-xl mb-2"><i class="fa-solid fa-magnifying-glass mr-2"></i> Refer</button>` : ''}
            
            <button onclick="openModal('Decline', 'Are you sure you want to decline this application?', declineApplication)" class="w-full py-3 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-xl">
                <i class="fa-solid fa-xmark mr-2"></i> Decline
            </button>
          `;
      } 
      else if (status === 'AFFORD_OK') {
          actionsContainer.innerHTML = `
            <div class="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-3 text-xs text-blue-700">Client passed assessment. Ready for Contract.</div>
            <button id="action-send-contract" class="w-full py-3 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><i class="fa-solid fa-paper-plane"></i> Send Contract</button>
            <button id="action-preview-contract" class="w-full py-3 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl shadow-sm flex items-center justify-center gap-2"><i class="fa-solid fa-eye"></i> Preview Template</button>
          `;
          document.getElementById('action-send-contract')?.addEventListener('click', (event) => handleSendContract(event.currentTarget));
          document.getElementById('action-preview-contract')?.addEventListener('click', handlePreviewContract);
      }
      else if (status === 'OFFER_ACCEPTED') {
          actionsContainer.innerHTML = `
             <div class="p-3 bg-purple-50 border border-purple-100 rounded-lg mb-3 text-xs text-purple-700"><i class="fa-solid fa-signature mr-1"></i> Client Signed.</div>
             <button id="btn-approve-contract" class="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-lg"><i class="fa-solid fa-file-signature mr-2"></i> Approve & Queue Payout</button>
          `;
          // Confirmation modal for approval
          document.getElementById('btn-approve-contract').onclick = () => openModal('Approve', 'Mark contract as valid and ready for payout?', approveApplication);
      }
      else if (status === 'APPROVED') {
          renderDisbursementSection(currentApplication);
      }
      else if (status === 'DISBURSED') {
          actionsContainer.innerHTML = `
            <div class="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center mb-2"><p class="text-sm font-bold text-gray-600">Loan Active</p></div>
            <button onclick="window.open('/api/letters-of-demand/${app.id}', '_blank')"
              class="w-full py-2.5 bg-white border border-orange-200 text-orange-700 text-sm font-bold rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[16px]">description</span> Letter of Demand
            </button>
            ${!app.routed_to_head_office ? `<button onclick="window.routeToHeadOffice('${app.id}')"
              class="w-full py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 mt-2">
              <span class="material-symbols-outlined text-[16px]">corporate_fare</span> Route to Head Office
            </button>` : `<div class="mt-2 text-xs text-center text-green-700 font-semibold bg-green-50 rounded-xl py-2 border border-green-100">✓ Routed to Head Office</div>`}`;
      }
      else if (status === 'IN_ARREARS') {
          actionsContainer.innerHTML = `
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-xl mb-3 text-xs text-yellow-800 font-bold">
              <i class="fa-solid fa-triangle-exclamation mr-1"></i> Account In Arrears — follow up required
            </div>
            <button onclick="window.open('/api/letters-of-demand/${app.id}', '_blank')"
              class="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
              <i class="fa-solid fa-file-lines"></i> Generate Letter of Demand
            </button>`;
      }
      else if (status === 'IN_DEFAULT') {
          const balance = parseFloat(app.offer_principal || app.amount || 0);
          const defaultInterest = (balance * 0.03).toLocaleString('en-ZA', {minimumFractionDigits:2});
          actionsContainer.innerHTML = `
            <div class="p-3 bg-red-50 border border-red-200 rounded-xl mb-3 text-xs text-red-800 font-bold">
              <i class="fa-solid fa-circle-exclamation mr-1"></i> IN DEFAULT — 3% interest applies
              <div class="font-normal mt-1 text-red-700">Default interest: R ${defaultInterest}</div>
            </div>
            <button onclick="window.open('/api/letters-of-demand/${app.id}', '_blank')"
              class="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 mb-2">
              <i class="fa-solid fa-file-lines"></i> Generate Letter of Demand
            </button>
            <button onclick="updateStatus('ACTIVE')"
              class="w-full py-3 bg-white border border-green-200 text-green-700 text-sm font-bold rounded-xl flex items-center justify-center gap-2">
              <i class="fa-solid fa-check"></i> Mark Payment Received
            </button>`;
      }
  }
};

const renderHeader = (app) => {
  if (!app) return;
  document.getElementById('applicant-name-header').textContent = app.profiles?.full_name || 'Unknown';

  // Build reference: C{clientNum}-L{loanNum}
  const profile   = app.profiles || {};
  const clientNum = profile.client_number ? String(profile.client_number) : '';
  const loanSeq   = app.loan_number ? `L${String(app.loan_number).padStart(4,'0')}` : '';
  const reference = clientNum && loanSeq ? `${clientNum}-${loanSeq}` : (loanSeq || app.id.slice(0,8).toUpperCase());
  const agreementNum = app.agreement_number || reference;

  document.getElementById('header-id-val').textContent = reference;
  document.getElementById('header-date').textContent = formatDate(app.created_at);

  // Populate detail tab fields
  document.getElementById('detail-app-id').textContent = agreementNum;
  document.getElementById('detail-date').textContent = formatDate(app.created_at);
  document.getElementById('detail-purpose').textContent = app.loan_purpose || app.purpose || 'Personal Loan';
  document.getElementById('detail-notes').value = app.notes || '';

  const badge = document.getElementById('header-status-badge');
  if (badge) {
      badge.textContent = app.status;
      badge.className = `px-4 py-1.5 text-sm font-bold rounded-full shadow-sm ${getBadgeColor(app.status)}`;
  }
};

// ── Next of Kin ───────────────────────────────────────────────────
// ── Income toggle recalc ──────────────────────────────────────────
window.recalcAffordability = function() {
    if (!window._incomeData) return;
    const { salary, otherIncome, totalExpenses } = window._incomeData;
    const inclSalary = document.getElementById('inc-salary-toggle')?.checked ? salary : 0;
    const inclOther  = document.getElementById('inc-other-toggle')?.checked ? otherIncome : 0;
    const disposable = (inclSalary + inclOther) - totalExpenses;
    const el = document.getElementById('calc-disposable');
    if (el) {
        el.textContent = `R ${Math.max(0, disposable).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        el.style.color = disposable < 0 ? '#ef4444' : 'var(--color-primary)';
    }
};

// ── Route to Head Office ──────────────────────────────────────────
window.routeToHeadOffice = async function(appId) {
    if (!confirm('Route this application to Head Office?')) return;
    try {
        const res = await apiFetch(`/api/applications/${appId}/route-to-head-office`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed');
        showFeedback('Routed to Head Office.', 'success');
        await loadApplicationData();
    } catch (err) { showFeedback('Error: ' + err.message, 'error'); }
};

// ── Next of Kin ───────────────────────────────────────────────────
window.saveNOK = async function() {
    if (!currentApplication?.user_id) return;
    const name         = document.getElementById('nok-name-input')?.value.trim();
    const relationship = document.getElementById('nok-relationship-input')?.value.trim();
    const phone        = document.getElementById('nok-phone-input')?.value.trim();
    try {
        const { error } = await supabase.from('profiles').update({
            nok_name: name || null,
            nok_relationship: relationship || null,
            nok_phone: phone || null,
            updated_at: new Date().toISOString()
        }).eq('id', currentApplication.user_id);
        if (error) throw error;
        const badge = document.getElementById('nok-saved-badge');
        if (badge) { badge.classList.remove('hidden'); setTimeout(() => badge.classList.add('hidden'), 2500); }
        showFeedback('Next of kin saved.', 'success');
    } catch (err) { showFeedback('Failed to save: ' + err.message, 'error'); }
};

// ── Employer Verification ─────────────────────────────────────────
window.saveEmployerDetails = async function() {
    if (!currentApplication?.user_id) return;
    const name    = document.getElementById('employer-name-input')?.value.trim();
    const phone   = document.getElementById('employer-phone-input')?.value.trim();
    const address = document.getElementById('employer-address-input')?.value.trim();
    const btn = document.getElementById('btn-save-employer');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
        const { error } = await supabase.from('profiles').update({
            employer_name: name || null,
            employer_phone: phone || null,
            employer_address: address || null
        }).eq('id', currentApplication.user_id);
        if (error) throw error;
        showFeedback('Employer details saved.', 'success');
    } catch (e) { showFeedback(e.message, 'error'); }
    finally { btn.textContent = 'Save Details'; btn.disabled = false; }
};

window.toggleEmployerVerified = async function() {
    if (!currentApplication?.user_id) return;
    const badge    = document.getElementById('employer-verified-badge');
    const note     = document.getElementById('employer-verified-note');
    const btn      = document.getElementById('btn-verify-employer');
    const isVerified = badge?.textContent === 'Verified';
    const newVal   = !isVerified;
    const { data: { session } } = await supabase.auth.getSession();
    const { data: admin } = session ? await supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle() : { data: null };
    const { error } = await supabase.from('profiles').update({
        employer_verified: newVal,
        employer_verified_at: newVal ? new Date().toISOString() : null,
        employer_verified_by: newVal ? (admin?.full_name || session?.user?.email || 'Admin') : null
    }).eq('id', currentApplication.user_id);
    if (error) { showFeedback(error.message, 'error'); return; }
    if (badge) { badge.textContent = newVal ? 'Verified' : 'Unverified'; badge.className = `px-2 py-1 rounded-full text-xs font-bold ${newVal ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`; }
    if (btn)  btn.textContent = newVal ? 'Revoke Verification' : 'Mark Verified';
    if (note) { note.textContent = newVal ? `Verified by ${admin?.full_name || 'Admin'} on ${new Date().toLocaleDateString('en-ZA')}` : ''; note.classList.toggle('hidden', !newVal); }
    showFeedback(newVal ? 'Employer verified.' : 'Verification revoked.', 'success');
};

function populateEmployerFields(profile) {
    const nameEl    = document.getElementById('employer-name-input');
    const phoneEl   = document.getElementById('employer-phone-input');
    const addrEl    = document.getElementById('employer-address-input');
    const badge     = document.getElementById('employer-verified-badge');
    const note      = document.getElementById('employer-verified-note');
    const btn       = document.getElementById('btn-verify-employer');
    if (nameEl)  nameEl.value  = profile?.employer_name    || '';
    if (phoneEl) phoneEl.value = profile?.employer_phone   || '';
    if (addrEl)  addrEl.value  = profile?.employer_address || '';
    const verified = profile?.employer_verified === true;
    if (badge) { badge.textContent = verified ? 'Verified' : 'Unverified'; badge.className = `px-2 py-1 rounded-full text-xs font-bold ${verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`; }
    if (btn)  btn.textContent = verified ? 'Revoke Verification' : 'Mark Verified';
    if (note && verified && profile.employer_verified_at) { note.textContent = `Verified by ${profile.employer_verified_by || 'Admin'} on ${new Date(profile.employer_verified_at).toLocaleDateString('en-ZA')}`; note.classList.remove('hidden'); }
}

// ── Client Credit Cap ─────────────────────────────────────────────
window.saveClientCap = async function() {
    if (!currentApplication?.user_id) return;
    const capVal  = document.getElementById('credit-cap-input')?.value;
    const noteVal = document.getElementById('credit-cap-note')?.value.trim();
    const cap     = capVal ? parseFloat(capVal) : null;
    const { error } = await supabase.from('profiles').update({
        credit_limit_override: cap,
        credit_limit_note:     noteVal || null
    }).eq('id', currentApplication.user_id);
    if (error) { showFeedback(error.message, 'error'); return; }
    const capDisplay = document.getElementById('credit-cap-current');
    if (capDisplay) capDisplay.textContent = cap ? `Current cap: R${cap.toLocaleString('en-ZA')} — ${noteVal || ''}` : 'No cap set — using standard band rules.';
    showFeedback(cap ? `Credit cap set to R${cap.toLocaleString('en-ZA')}.` : 'Credit cap removed.', 'success');
    // Audit it
    await supabase.from('audit_log').insert([{
        entity_type: 'profile', entity_id: currentApplication.user_id,
        action: 'credit_cap_set', new_value: { cap, note: noteVal },
        description: cap ? `Credit cap set to R${cap.toLocaleString('en-ZA')}` : 'Credit cap removed'
    }]).catch(() => {});
};

function populateClientCap(profile) {
    const capInput  = document.getElementById('credit-cap-input');
    const noteInput = document.getElementById('credit-cap-note');
    const display   = document.getElementById('credit-cap-current');
    if (capInput && profile?.credit_limit_override) capInput.value = profile.credit_limit_override;
    if (noteInput && profile?.credit_limit_note) noteInput.value = profile.credit_limit_note;
    if (display) display.textContent = profile?.credit_limit_override
        ? `Current cap: R${Number(profile.credit_limit_override).toLocaleString('en-ZA')}${profile.credit_limit_note ? ' — ' + profile.credit_limit_note : ''}`
        : 'No cap set — using standard band rules.';
}
// ─────────────────────────────────────────────────────────────────

// ── Audit trail ──────────────────────────────────────────────────
let auditEntries = [];

async function loadAuditTrail(applicationId) {
    try {
        const res  = await apiFetch(`/api/audit-log/loan_application/${applicationId}`);
        const json = await res.json();
        auditEntries = json.data || [];
        renderAuditTrail();
    } catch (e) {
        console.warn('[audit-trail]', e.message);
    }
}

function renderAuditTrail() {
    const container = document.getElementById('audit-trail-list');
    if (!container) return;
    if (!auditEntries.length) {
        container.innerHTML = `<div class="text-center py-8 text-sm text-gray-400">No audit entries yet. Changes will appear here.</div>`;
        return;
    }

    const ACTION_ICONS = {
        status_change: { icon: 'swap_horiz',    color: '#3b82f6' },
        field_update:  { icon: 'edit',           color: '#f59e0b' },
        created:       { icon: 'add_circle',     color: '#10b981' },
        viewed:        { icon: 'visibility',     color: '#8b5cf6' },
        default:       { icon: 'history',        color: '#6b7280' }
    };

    container.innerHTML = auditEntries.map(e => {
        const ai = ACTION_ICONS[e.action] || ACTION_ICONS.default;
        const dt = new Date(e.created_at);
        const dateStr = dt.toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
        const timeStr = dt.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' });

        let detail = '';
        if (e.action === 'status_change' && e.old_value?.status && e.new_value?.status) {
            detail = `<span class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">${e.old_value.status}</span>
                      <span class="text-gray-400 mx-1">→</span>
                      <span class="font-mono text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">${e.new_value.status}</span>`;
        } else if (e.description) {
            detail = `<span class="text-xs text-gray-500">${e.description}</span>`;
        }

        return `
        <div class="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
          <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
               style="background:${ai.color}18">
            <span class="material-symbols-outlined text-[16px]" style="color:${ai.color}">${ai.icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-gray-800">${e.performed_by_name || 'System'}</span>
              <span class="text-xs text-gray-400">${e.action.replace(/_/g,' ')}</span>
              ${detail}
            </div>
            <div class="text-xs text-gray-400 mt-1">${dateStr} at ${timeStr}</div>
          </div>
        </div>`;
    }).join('');
}

window.exportAuditTrail = function() {
    if (!auditEntries.length) { alert('No audit entries to export.'); return; }
    const headers = ['Date','Time','Action','Description','Old Value','New Value','Performed By'];
    const rows = auditEntries.map(e => {
        const dt = new Date(e.created_at);
        return [
            dt.toLocaleDateString('en-ZA'),
            dt.toLocaleTimeString('en-ZA'),
            e.action,
            `"${(e.description||'').replace(/"/g,'""')}"`,
            e.old_value ? JSON.stringify(e.old_value) : '',
            e.new_value ? JSON.stringify(e.new_value) : '',
            e.performed_by_name || 'System'
        ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `audit_trail_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
};
// ─────────────────────────────────────────────────────────────────

const MANDATE_ERROR_MAP = [
  [/account.not.found|invalid.account/i, 'The client\'s bank account number was not found. Please ask them to check their account details and update.'],
  [/insufficient.funds|no.funds/i, 'The account did not have enough funds when we tried. Please try again or contact the client.'],
  [/account.closed|closed.account/i, 'This bank account is closed. Please ask the client to provide a new account.'],
  [/wrong.branch|invalid.branch/i, 'The branch code does not match the selected bank. Please update the bank details.'],
  [/not.authenticated|authentication.failed/i, 'The client\'s bank needs to approve this. This usually happens within 1–2 business days.'],
  [/duplicate/i, 'A debit order for this client already exists.'],
  [/config|credentials|503|unavailable/i, 'We could not reach the payment provider right now. Please try again in a few minutes.'],
];

function mandateFriendlyError(raw) {
  if (!raw) return 'Something went wrong. Please try again or contact support.';
  for (const [pattern, msg] of MANDATE_ERROR_MAP) {
    if (pattern.test(raw)) return msg;
  }
  return 'Something went wrong. Please try again or contact support.';
}

const renderMandateCard = async (app) => {
  const body = document.getElementById('mandate-card-body');
  if (!body) return;

  const isEligible = ['OFFER_ACCEPTED', 'READY_TO_DISBURSE', 'ACTIVE', 'DISBURSED'].includes(app?.status);

  if (!isEligible) {
    body.className = 'text-sm text-outline text-center py-4';
    body.innerHTML = 'Debit order will be set up after the client signs the agreement.';
    return;
  }

  try {
    const { data: records, error } = await supabase
      .from('suresystems_mandates')
      .select('status, contract_reference, message, activated_at, updated_at')
      .eq('application_id', app.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const mandate = records?.[0];

    if (!mandate) {
      body.className = '';
      body.innerHTML = `
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div class="flex items-center gap-3 mb-3">
            <span class="material-symbols-outlined text-amber-500 text-[22px]">pending_actions</span>
            <div>
              <p class="text-sm font-bold text-amber-900">Debit order not set up yet</p>
              <p class="text-xs text-amber-700 mt-0.5">Click the button below to set up the client's monthly debit order.</p>
            </div>
          </div>
          <div class="mb-3">
            <label class="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">Mandate type</label>
            <select id="tt-type-select" class="w-full px-3 py-2 text-sm border border-amber-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="realtime">TT1 Real-time (bank responds immediately)</option>
              <option value="delay">TT1 Delay (bank responds next business day)</option>
              <option value="tt3">TT3 Paper/POS (physical signed form)</option>
            </select>
          </div>
          <button onclick="window.setupMandate(${app.id})" id="mandate-action-btn"
            class="w-full py-2.5 text-sm font-bold rounded-xl text-white transition-all active:scale-95"
            style="background:var(--color-primary)">
            Set Up Debit Order
          </button>
        </div>`;
      return;
    }

    const status = (mandate.status || 'unknown').toLowerCase();
    const activatedAt = mandate.activated_at
      ? new Date(mandate.activated_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
      : mandate.updated_at
        ? new Date(mandate.updated_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;

    if (status === 'success') {
      body.className = '';
      body.innerHTML = `
        <div class="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-3">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-green-600 text-[22px]">check_circle</span>
            <div>
              <p class="text-sm font-bold text-green-900">Debit order is active</p>
              <p class="text-xs text-green-700">Monthly collections are set up and ready.</p>
            </div>
          </div>
          ${activatedAt ? `
          <div class="flex items-center justify-between text-xs pt-1 border-t border-green-200">
            <span class="text-green-800 font-medium">Activated on</span>
            <span class="font-semibold text-green-900">${activatedAt}</span>
          </div>` : ''}
        </div>`;
      return;
    }

    if (status === 'pending') {
      body.className = '';
      body.innerHTML = `
        <div class="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-blue-500 text-[22px]" style="animation:spin 2s linear infinite">progress_activity</span>
            <div>
              <p class="text-sm font-bold text-blue-900">Waiting for bank approval</p>
              <p class="text-xs text-blue-700">The client's bank is reviewing the debit order. This usually takes 1–2 business days.</p>
            </div>
          </div>
          ${activatedAt ? `
          <div class="flex items-center justify-between text-xs pt-1 border-t border-blue-200">
            <span class="text-blue-800 font-medium">Submitted on</span>
            <span class="font-semibold text-blue-900">${activatedAt}</span>
          </div>` : ''}
        </div>`;
      return;
    }

    // failed or unknown
    const friendlyMsg = mandateFriendlyError(mandate.message);
    body.className = '';
    body.innerHTML = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-red-500 text-[22px] mt-0.5">error</span>
          <div>
            <p class="text-sm font-bold text-red-900">Debit order failed</p>
            <p class="text-xs text-red-700 mt-1">${friendlyMsg}</p>
          </div>
        </div>
        <div class="mb-3">
          <label class="text-[10px] font-bold uppercase tracking-wider text-red-800 block mb-1">Mandate type</label>
          <select id="tt-type-select" class="w-full px-3 py-2 text-sm border border-red-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="realtime">TT1 Real-time (bank responds immediately)</option>
            <option value="delay">TT1 Delay (bank responds next business day)</option>
          </select>
        </div>
        <button onclick="window.setupMandate(${app.id})" id="mandate-action-btn"
          class="w-full py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all active:scale-95">
          Try Again
        </button>
      </div>`;

  } catch (err) {
    console.error('renderMandateCard error:', err);
    body.className = 'text-sm text-outline text-center py-4';
    body.innerHTML = 'Could not load debit order status.';
  }
};

// ── FICA Compliance Card (PEP/Sanctions + CIPC) ───────────────────────────────

const renderFicaCard = async (app) => {
    const body = document.getElementById('fica-card-body');
    if (!body) return;

    // Fetch profile for CIPC fields
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_juristic_person, entity_name, cipc_reg_number, cipc_verified, cipc_verified_at')
        .eq('id', app.user_id)
        .maybeSingle();

    const pepCleared   = app.pep_sanctions_cleared;
    const pepChecked   = app.pep_sanctions_checked;
    const pepDate      = app.pep_sanctions_checked_at ? new Date(app.pep_sanctions_checked_at).toLocaleDateString('en-ZA') : null;
    const isJuristic   = profile?.is_juristic_person;
    const cipcVerified = profile?.cipc_verified;

    body.innerHTML = `
    <!-- PEP / Sanctions -->
    <div class="flex items-start justify-between gap-3 pb-3 border-b border-outline-variant/10">
        <div>
            <div class="text-xs font-semibold text-gray-700">PEP / Sanctions Screening</div>
            <div class="text-xs text-gray-400 mt-0.5">${pepDate ? `Checked ${pepDate}` : 'Not yet checked'}</div>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${
                pepCleared ? 'bg-green-100 text-green-700'
              : pepChecked ? 'bg-red-100 text-red-600'
              : 'bg-gray-100 text-gray-500'}">
                ${pepCleared ? 'Cleared' : pepChecked ? 'Not Cleared' : 'Pending'}
            </span>
            <button onclick="openPepModal()" class="text-xs text-blue-600 hover:underline font-medium">${pepChecked ? 'Update' : 'Screen'}</button>
        </div>
    </div>

    <!-- CIPC (juristic) -->
    <div class="flex items-start justify-between gap-3 pt-1">
        <div>
            <div class="text-xs font-semibold text-gray-700">Juristic Person / CIPC</div>
            <div class="text-xs text-gray-400 mt-0.5">${isJuristic ? (profile?.entity_name || 'Business client') + (profile?.cipc_reg_number ? ' · ' + profile.cipc_reg_number : '') : 'Natural person'}</div>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${
                !isJuristic ? 'bg-gray-100 text-gray-400'
              : cipcVerified ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'}">
                ${!isJuristic ? 'N/A' : cipcVerified ? 'Verified' : 'Unverified'}
            </span>
            <button onclick="openCipcModal()" class="text-xs text-blue-600 hover:underline font-medium">Edit</button>
        </div>
    </div>

    <!-- PEP modal (inline, hidden) -->
    <div id="pep-modal" class="hidden mt-3 pt-3 border-t border-outline-variant/10">
        <div class="text-xs font-semibold text-gray-600 mb-2">PEP / Sanctions Screening Result</div>
        <div class="flex gap-2 mb-2">
            <button onclick="savePep(true)"  class="flex-1 py-2 text-xs font-bold rounded-lg bg-green-100 text-green-700 hover:bg-green-200">✓ Clear — No Match</button>
            <button onclick="savePep(false)" class="flex-1 py-2 text-xs font-bold rounded-lg bg-red-100 text-red-600 hover:bg-red-200">✗ Match Found</button>
        </div>
        <input id="pep-ref"   type="text" placeholder="Screening reference (optional)" class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 outline-none focus:border-orange-400" />
        <textarea id="pep-notes" rows="2" placeholder="Notes…" class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-orange-400"></textarea>
        <button onclick="document.getElementById('pep-modal').classList.add('hidden')" class="text-xs text-gray-400 hover:text-gray-600 mt-1">Cancel</button>
    </div>

    <!-- CIPC modal (inline, hidden) -->
    <div id="cipc-modal" class="hidden mt-3 pt-3 border-t border-outline-variant/10">
        <div class="text-xs font-semibold text-gray-600 mb-2">Juristic Person / CIPC Details</div>
        <label class="flex items-center gap-2 mb-2 text-xs">
            <input type="checkbox" id="cipc-is-juristic" ${isJuristic ? 'checked' : ''} class="w-4 h-4" style="accent-color:var(--color-secondary)" />
            Business / Juristic Person
        </label>
        <input id="cipc-entity-name"   type="text" placeholder="Registered entity name" value="${profile?.entity_name || ''}" class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 outline-none focus:border-orange-400" />
        <input id="cipc-reg-number"    type="text" placeholder="CIPC registration number" value="${profile?.cipc_reg_number || ''}" class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 outline-none focus:border-orange-400" />
        <label class="flex items-center gap-2 mb-2 text-xs">
            <input type="checkbox" id="cipc-verified-check" ${cipcVerified ? 'checked' : ''} class="w-4 h-4" style="accent-color:var(--color-secondary)" />
            CIPC registration verified
        </label>
        <div class="flex gap-2 mt-1">
            <button onclick="saveCipc('${app.user_id}')" class="flex-1 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
            <button onclick="document.getElementById('cipc-modal').classList.add('hidden')" class="flex-1 py-2 text-xs font-bold rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Cancel</button>
        </div>
    </div>`;
};

window.openPepModal = () => document.getElementById('pep-modal')?.classList.remove('hidden');
window.openCipcModal = () => document.getElementById('cipc-modal')?.classList.remove('hidden');

window.savePep = async (cleared) => {
    const { data: { session } } = await supabase.auth.getSession();
    const ref   = document.getElementById('pep-ref')?.value  || null;
    const notes = document.getElementById('pep-notes')?.value || null;
    const res = await fetch(`/api/admin/applications/${currentApplication.id}/pep-sanctions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ cleared, provider: 'manual', ref, notes }),
    });
    if (res.ok) {
        // Update local state and re-render card
        currentApplication.pep_sanctions_cleared = cleared;
        currentApplication.pep_sanctions_checked = true;
        currentApplication.pep_sanctions_checked_at = new Date().toISOString();
        await renderFicaCard(currentApplication);
        showFeedback(cleared ? 'PEP/Sanctions cleared.' : 'PEP match recorded — do not proceed.', cleared ? 'success' : 'error');
    } else {
        showFeedback('Failed to save PEP result.', 'error');
    }
};

window.saveCipc = async (userId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/users/${userId}/cipc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
            is_juristic_person: document.getElementById('cipc-is-juristic')?.checked,
            entity_name:        document.getElementById('cipc-entity-name')?.value  || null,
            cipc_reg_number:    document.getElementById('cipc-reg-number')?.value   || null,
            cipc_verified:      document.getElementById('cipc-verified-check')?.checked,
        }),
    });
    if (res.ok) {
        await renderFicaCard(currentApplication);
        showFeedback('CIPC details saved.', 'success');
    } else {
        showFeedback('Failed to save CIPC details.', 'error');
    }
};

window.setupMandate = async (appId) => {
  const btn = document.getElementById('mandate-action-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Setting up...';
  }
  try {
    const transactionType = document.getElementById('tt-type-select')?.value || 'realtime';
    const res = await apiFetch('/api/suresystems/activate-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: appId, transactionType })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || 'Setup failed');
    }
    showFeedback('Debit order has been set up successfully.', 'success');
    await renderMandateCard(currentApplication);
  } catch (err) {
    showFeedback(mandateFriendlyError(err.message), 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Try Again';
    }
  }
};

const loadApplicationData = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const appId = urlParams.get('id');
  if (!appId) return;

  try {
      const data = await fetchApplicationDetail(appId);
      currentApplication = data;
      
      // 1. Reset UI States
      stopContractStatusPolling(); 
      document.getElementById('contract-declined-banner')?.remove();

      // 2. Trigger Specialized Rendering Sections
      renderHeader(data);
      renderPersonalDetails(data.profiles || {}, data.bank_accounts);
      
      // Part 4a: Compliance & Declarations (Step 4)
      await renderComplianceDetails(data.user_id); 

      // Part 3: Financials & Bureau PDF (Steps 2 & 3)
      renderFinancials(data.financial_profiles, data.credit_checks); 

      // --- UPDATED: Passing manual documents, truid_info, and kyc_info ---
      renderDocuments(data.documents, data.truid_info, data.kyc_info); 
      
      await renderLoanHistory(data.loan_history, data.application_history, data);
      renderCreditLifeContractPanel(data);
      loadAuditTrail(appId); // non-blocking
      
      // Part 1: Side Panel with Tiered Rates (Step 5)
      renderSidePanel(data); 
      renderContractRepaymentScheduler(data);
      renderMandateCard(data); // non-blocking
      renderFicaCard(data);   // non-blocking

      // 3. Initialize Signatures & Visibility
      await initDocuSealCard();
      document.getElementById('loading-state')?.classList.add('hidden');
      document.getElementById('content-grid')?.classList.remove('hidden');
      document.getElementById('page-header')?.classList.remove('hidden');

  } catch (error) {
      console.error("Integration Error:", error);
      showFeedback("Failed to load full application data.", "error");
  }
};

// Global function for admin loan term override
window.handleAdminLoanTermOverride = async (applicationId) => {
  const input = document.getElementById('admin-loan-term-override');
  const newTerm = parseInt(input.value);

  if (!newTerm || newTerm < 1 || newTerm > 36) {
    showFeedback('Please enter a valid loan term (1-36 months)', 'error');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('loan_applications')
      .update({ term_months: newTerm })
      .eq('id', applicationId)
      .select();

    if (error) throw error;

    showFeedback(`✅ Loan term updated to ${newTerm} month${newTerm > 1 ? 's' : ''}`, 'success');
    await loadApplicationData();
  } catch (error) {
    console.error('Error updating loan term:', error);
    showFeedback(`❌ Error: ${error.message}`, 'error');
  }
};

// Global function for disbursement CSV export
window.handleDisbursementExport = async (applicationId) => {
  try {
    const response = await apiFetch('/api/disbursements/payout-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationIds: [applicationId]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      showFeedback(error.error || 'Failed to generate CSV', 'error');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `disbursement-${applicationId}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showFeedback('Disbursement CSV exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    showFeedback(error.message || 'Failed to export CSV', 'error');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout();
  let mainContent = document.getElementById('main-content');
  if (!mainContent) {
      mainContent = document.createElement('main');
      mainContent.id = 'main-content';
      mainContent.className = 'flex-1 p-6 pt-24';
      document.getElementById('app-shell').appendChild(mainContent);
  }
  mainContent.innerHTML = pageTemplate;
  initTabs();
  await loadApplicationData();

  // Event Listeners
  document.getElementById('btn-save-notes')?.addEventListener('click', saveNotes);
  const btnConfirm = document.getElementById('modal-confirm-btn');
  const btnCancel = document.getElementById('modal-cancel-btn');
  if (btnConfirm) btnConfirm.addEventListener('click', () => { if (typeof actionToConfirm === 'function') actionToConfirm(); });
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  document.getElementById('credit-life-contract-modal-close')?.addEventListener('click', closeCreditLifeContractModal);
  document.getElementById('credit-life-contract-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'credit-life-contract-modal') {
      closeCreditLifeContractModal();
    }
  });
});
