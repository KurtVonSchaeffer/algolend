import{supabase as g}from"./supabaseClient-DdIec1HK.js";/* empty css              *//* empty css               */import{i as U}from"./layout-Nmoyu__-.js";import{b as _,a as v}from"./utils-CZwHw4kl.js";import{t as L,v as H,w as F,x as M,y as V,z as q}from"./dataService-CkuKBXml.js";import"https://esm.sh/@supabase/supabase-js@2";import"./theme-CYs9TE7o.js";let d=null,I=null;function K(e){if(!/^\d{13}$/.test(e))return!1;let n=0;for(let t=0;t<12;t++){let a=parseInt(e[t]);t%2===1&&(a*=2,a>9&&(a-=9)),n+=a}return(10-n%10)%10===parseInt(e[12])}function z(e){if(!/^\d{13}$/.test(e))return null;const n=parseInt(e.slice(0,2)),t=parseInt(e.slice(2,4)),a=parseInt(e.slice(4,6)),s=n>=26?1900:2e3;return new Date(s+n,t-1,a).getMonth()!==t-1?null:`${s+n}${String(t).padStart(2,"0")}${String(a).padStart(2,"0")}`}function G(e){return/^\d{13}$/.test(e)?parseInt(e[6])<5?"F":"M":null}function Z(e,n){const t=String(n?.identity_number||"").replace(/\s/g,""),a=[];!t||t.length!==13?a.push({field:"identity_number",source:"profile",label:"SA ID Number",hint:"13-digit SA ID",value:t||"",type:"text",pattern:"\\d{13}"}):K(t)||a.push({field:"identity_number",source:"profile",label:"SA ID Number",hint:"ID fails Luhn checksum — check for typo",value:t,type:"text",pattern:"\\d{13}"});const s=String(n?.date_of_birth||"").replace(/[-\/\s]/g,"").slice(0,8),o=t.length===13?z(t):null;(!s||s.length!==8)&&a.push({field:"date_of_birth",source:"profile",label:"Date of Birth",hint:"YYYY-MM-DD",value:o?`${o.slice(0,4)}-${o.slice(4,6)}-${o.slice(6,8)}`:"",type:"date"});const r=String(n?.gender||"").toUpperCase().charAt(0),i=t.length===13?G(t):null;!r||!["M","F"].includes(r)?a.push({field:"gender",source:"profile",label:"Gender",hint:"Must be M or F",value:i||"",type:"select",options:["M","F"]}):i&&r!==i&&a.push({field:"gender",source:"profile",label:"Gender",hint:`ID says ${i} — please correct`,value:i,type:"select",options:["M","F"]});const c=String(n?.last_name||n?.full_name?.split(" ").pop()||"").trim();c?c.length>25&&a.push({field:"last_name",source:"profile",label:"Surname",hint:`Too long: ${c.length}/25 chars`,value:c.slice(0,25),type:"text",maxlength:25}):a.push({field:"last_name",source:"profile",label:"Surname",hint:"Max 25 characters",value:"",type:"text",maxlength:25});const l=String(n?.first_name||n?.full_name?.split(" ")[0]||"").trim();l?l.length>14&&a.push({field:"first_name",source:"profile",label:"First Name(s)",hint:`Too long: ${l.length}/14 chars`,value:l.slice(0,14),type:"text",maxlength:14}):a.push({field:"first_name",source:"profile",label:"First Name(s)",hint:"Max 14 characters",value:"",type:"text",maxlength:14}),String(n?.address||"").trim()||a.push({field:"address",source:"profile",label:"Street Address",hint:"Required for SACRRA submission",value:"",type:"text"}),String(n?.suburb_area||"").trim()||a.push({field:"suburb_area",source:"profile",label:"Suburb / Area",hint:"Required — Experian also needs this",value:"",type:"text"});const u=String(n?.postal_code||"").replace(/\s/g,"");return(!u||!/^\d{4}$/.test(u))&&a.push({field:"postal_code",source:"profile",label:"Postal Code",hint:"Exactly 4 digits",value:u||"",type:"text",pattern:"\\d{4}"}),(!e?.offer_monthly_repayment||Number(e.offer_monthly_repayment)<=0)&&a.push({field:"offer_monthly_repayment",source:"application",label:"Monthly Installment",hint:"Run affordability & generate offer first",value:"",type:"number",readonly:!0}),e?.repayment_start_date||a.push({field:"repayment_start_date",source:"application",label:"Loan Start Date",hint:"Set from the sidebar date picker",value:"",type:"date",readonly:!0}),{passed:a.length===0,issues:a}}const Y=[{value:"STARTED",label:"Step 1: New Application"},{value:"BANK_LINKING",label:"Bank Analysis"},{value:"AFFORD_OK",label:"Step 3: Affordability OK"},{value:"AFFORD_REFER",label:"Affordability Refer"},{value:"OFFERED",label:"Step 4: Contract Sent"},{value:"OFFER_ACCEPTED",label:"Contract Signed"},{value:"READY_TO_DISBURSE",label:"Step 6: Approved — Queue Disburse"},{value:"DECLINED",label:"Declined"}],J=`
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
                <div class="flex-grow grid grid-cols-1 gap-y-5">
                   <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                      <span class="text-sm font-medium text-outline">Full Name</span>
                      <div class="sm:col-span-2">
                         <div id="detail-fullname" class="w-full p-3 bg-surface-container border border-outline-variant/20 rounded-xl text-on-surface text-sm font-semibold"></div>
                      </div>
                   </div>
                   <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                      <span class="text-sm font-medium text-outline">Email Address</span>
                      <div class="sm:col-span-2">
                         <div id="detail-email" class="w-full p-3 bg-surface-container border border-outline-variant/20 rounded-xl text-on-surface text-sm"></div>
                      </div>
                   </div>
                   <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                      <span class="text-sm font-medium text-outline">Mobile Number</span>
                      <div class="sm:col-span-2">
                         <div id="detail-mobile" class="w-full p-3 bg-surface-container border border-outline-variant/20 rounded-xl text-on-surface text-sm"></div>
                      </div>
                   </div>
                   <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                      <span class="text-sm font-medium text-outline">ID Number</span>
                      <div class="sm:col-span-2">
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
                      ${Y.map(e=>`<option value="${e.value}">${e.label}</option>`).join("")}
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
`,j=e=>{if(!e)return"bg-gray-100 text-gray-800 border border-gray-200";switch(e){case"APPROVED":case"approved":case"DISBURSED":case"AFFORD_OK":case"BUREAU_OK":return"bg-green-100 text-green-800 border border-green-200";case"declined":case"DECLINED":case"AFFORD_FAIL":return"bg-red-100 text-red-800 border border-red-200";case"OFFERED":case"OFFER_ACCEPTED":return"bg-purple-100 text-purple-800 border border-purple-200";default:return"bg-yellow-100 text-yellow-800 border border-yellow-200"}},E=(e="")=>`${e}`.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");window.viewBureauReport=e=>{try{const n=atob(e),t=new Array(n.length);for(let r=0;r<n.length;r++)t[r]=n.charCodeAt(r);const a=new Uint8Array(t),s=new Blob([a],{type:"application/pdf"}),o=URL.createObjectURL(s);window.open(o,"_blank")}catch(n){console.error("PDF Render Error:",n),alert("Unable to display the PDF format. Please ensure the bureau data is valid.")}};window.viewTruidReport=()=>{if(!d?.truid_info){p("No TruID data available for this applicant.","error");return}const e=d.truid_info.summary_payload||d.truid_info,n=d.truid_info,t=n.summary_payload||{},a=t.id_document||t.identity||{},s=t.bank_accounts||t.banking||[],o=t.income_summary||t.income||{},r=t.employment||t.employer||{},i=(l,u,f=!1)=>u?`<tr><td style="color:#888;font-size:12px;padding:5px 10px;width:35%">${l}</td><td style="font-weight:${f?"700":"500"};font-size:13px;padding:5px 10px;color:${f?"#E7762E":"#1a1a1a"}">${u}</td></tr>`:"",c=window.open("","_blank");c.document.write(`<!DOCTYPE html>
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
      <div><h1>TruID Digital Verification</h1><p style="color:#888;font-size:12px">Collection ID: ${n.collection_id||"—"}</p></div>
      <span class="badge ${n.verified?"green":"orange"}">${n.verified?"✓ Verified":"Pending"}</span>
    </div>
  </div>

  ${a.full_name||a.surname?`
  <div class="card">
    <h3>Identity Details</h3>
    <table>
      ${i("Full Name",a.full_name||[a.forenames,a.surname].filter(Boolean).join(" "),!0)}
      ${i("ID Number",a.id_number||a.identity_number)}
      ${i("Date of Birth",a.date_of_birth||a.dob)}
      ${i("Gender",a.gender)}
      ${i("Nationality",a.nationality||"South African")}
      ${i("Verified",a.verified?"✓ Yes":"Pending")}
    </table>
  </div>`:""}

  ${o.gross_income||o.net_income||o.monthly_income?`
  <div class="card">
    <h3>Income Summary (from bank statements)</h3>
    <table>
      ${i("Monthly Gross Income",o.gross_income?"R "+Number(o.gross_income).toLocaleString("en-ZA",{minimumFractionDigits:2}):null,!0)}
      ${i("Monthly Net Income",o.net_income?"R "+Number(o.net_income).toLocaleString("en-ZA",{minimumFractionDigits:2}):null)}
      ${i("Average Monthly Income",o.average_monthly?"R "+Number(o.average_monthly).toLocaleString("en-ZA",{minimumFractionDigits:2}):null)}
      ${i("Income Source",o.source||o.income_type)}
      ${i("Employer",o.employer_name||r.name)}
    </table>
  </div>`:""}

  ${Array.isArray(s)&&s.length?`
  <div class="card">
    <h3>Bank Accounts (${s.length})</h3>
    ${s.map(l=>`
    <div style="background:#f9fafb;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
      <table>
        ${i("Bank",l.bank_name||l.institution)}
        ${i("Account No",l.account_number)}
        ${i("Account Type",l.account_type)}
        ${i("Balance",l.current_balance?"R "+Number(l.current_balance).toLocaleString("en-ZA",{minimumFractionDigits:2}):null)}
      </table>
    </div>`).join("")}
  </div>`:""}

  <div class="card">
    <h3>Raw Payload</h3>
    <details><summary>Show raw JSON</summary>
    <pre>${JSON.stringify(e,null,2)}</pre>
    </details>
  </div>
</div>
</body></html>`),c.document.close()};const p=(e,n="success")=>{const t=document.getElementById("feedback-container");if(!t)return;const a=n==="success";t.innerHTML=`
    <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${a?"bg-white border-green-100":"bg-white border-red-100"} transform transition-all duration-300">
        <div class="w-8 h-8 rounded-full ${a?"bg-green-100 text-green-600":"bg-red-100 text-red-600"} flex items-center justify-center">
            <span class="material-symbols-outlined text-[18px]">${a?"check":"error"}</span>
        </div>
        <div>
            <p class="text-sm font-bold text-on-surface">${a?"Success":"Error"}</p>
            <p class="text-xs text-outline">${e}</p>
        </div>
    </div>
  `,t.classList.remove("hidden"),setTimeout(()=>{t.classList.add("hidden")},5e3)},W=async()=>{const e=document.getElementById("contract-status-empty"),n=document.getElementById("contract-status-section");if(!e)return;const t=d?.offer_details||{},a=d?.contract_signed_at||t.contract_signed_at,s=t.contract_signed_name,o=t.signature_data_url;if(!a){e.classList.remove("hidden"),e.innerHTML=`
      <div class="flex flex-col items-center gap-2 py-2">
        <span class="material-symbols-outlined text-3xl text-outline">draw</span>
        <p class="text-sm text-outline">Awaiting client signature</p>
        <p class="text-xs text-outline-variant">The client will sign in the app once an offer is accepted.</p>
      </div>`,n&&n.classList.add("hidden");return}const r=new Date(a).toLocaleString("en-ZA",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});e.classList.remove("hidden"),e.innerHTML=`
    <div class="space-y-3">
      <div class="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
        <span class="material-symbols-outlined text-green-600 text-[18px]">verified</span>
        <div class="flex-1">
          <p class="text-sm font-semibold text-green-800">Contract Signed</p>
          <p class="text-xs text-green-600">${s?`By ${s} · `:""}${r}</p>
        </div>
      </div>
      ${o?`
      <div>
        <p class="text-[10px] font-semibold text-outline uppercase tracking-widest mb-2">Client Signature</p>
        <div class="border border-outline-variant/30 rounded-xl bg-white p-3">
          <img src="${o}" alt="Client signature" class="w-full h-24 object-contain">
        </div>
      </div>`:""}
    </div>`,n&&n.classList.add("hidden")},Q=()=>{},X=()=>{const e=document.querySelectorAll(".tab-btn"),n=document.querySelectorAll(".tab-pane");e.forEach(t=>{t.addEventListener("click",()=>{e.forEach(o=>{o.classList.remove("active"),o.style.borderColor="",o.style.color="",o.classList.add("text-outline","border-transparent")}),t.classList.remove("text-outline","border-transparent"),t.classList.add("active"),t.style.borderColor="var(--color-primary)",t.style.color="var(--color-primary)",n.forEach(o=>o.classList.add("hidden"));const a=t.getAttribute("data-tab")+"-tab",s=document.getElementById(a);if(s&&s.classList.remove("hidden"),t.getAttribute("data-tab")==="audit"){const o=new URLSearchParams(window.location.search);O(o.get("id"))}})})};window.updateStatus=async e=>{if(e==="AFFORD_OK"){if(!(d.bureau_score_band||["BUREAU_OK","BANK_LINKING"].includes(d.status))){p("Cannot confirm affordability — no bureau result on record. Run the credit check first.","error");return}const{data:a}=await g.from("financial_profiles").select("monthly_income").eq("user_id",d.user_id).maybeSingle();if(!a?.monthly_income){p("Cannot confirm affordability — no income on record. Complete open banking first.","error");return}}if(e==="OFFERED"&&(!d.offer_principal||d.offer_principal<=0)){p("Cannot send contract — loan offer not configured yet.","error");return}if(e==="READY_TO_DISBURSE"){if(d.status!=="OFFER_ACCEPTED"&&!d.contract_signed_at){p("Cannot queue for disbursement — contract has not been signed yet.","error");return}if(!d.bank_account_id){p("Cannot queue for disbursement — no bank account linked.","error");return}}const{error:n}=await L(d.id,e);n?p(n.message,"error"):(p(`Status updated to ${e}`,"success"),k()),D()};window.declineApplication=async()=>{const{error:e}=await L(d.id,"DECLINED");e?p(e.message,"error"):(p("Application declined.","success"),k()),D()};window.saveNotes=async()=>{const e=document.getElementById("detail-notes").value,n=document.getElementById("btn-save-notes");if(!e.trim())return;const t=n.innerHTML;n.disabled=!0,n.innerHTML='<span class="material-symbols-outlined text-[14px] align-middle animate-spin mr-1">progress_activity</span> Saving...';try{const{error:a}=await H(d.id,e);if(a)throw a;p("Notes saved successfully","success"),n.innerHTML='<span class="material-symbols-outlined text-[14px] align-middle mr-1">check</span> Saved!',n.style.background="#16a34a",setTimeout(()=>{n.innerHTML=t,n.disabled=!1,n.style.background="var(--color-primary)"},2e3)}catch(a){p(a.message,"error"),n.disabled=!1,n.innerHTML=t}};window.saveRepaymentDate=async()=>{const e=document.getElementById("new-repayment-date");if(!e||!e.value)return;const n=e.value,t=document.getElementById("btn-save-date"),a=t.innerHTML;t.disabled=!0,t.innerHTML='<span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>';try{const o={...d.offer_details||{},first_payment_date:n},{error:r}=await g.from("loan_applications").update({offer_details:o,repayment_start_date:n}).eq("id",d.id);if(r)throw r;p("First repayment date updated successfully","success"),await k()}catch(s){console.error("Date Update Error:",s),p(s.message,"error"),t.disabled=!1,t.innerHTML=a}};const ee=e=>{const n=document.getElementById("contract-date-label"),t=document.getElementById("contract-date-status-badge"),a=document.getElementById("contract-set-date-btn"),s=document.getElementById("new-repayment-date"),o=document.getElementById("contract-date-view"),r=document.getElementById("contract-date-edit");if(!n||!t||!a||!s||!o||!r||!e)return;const i=e.repayment_start_date||e.offer_details?.first_payment_date,c=new Date;c.setHours(0,0,0,0),n.textContent=i?_(i):"Not Scheduled",t.textContent=i?"Date set":"Not set",t.className=i?"px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700":"px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-100 text-yellow-700",s.value=i?new Date(i).toISOString().split("T")[0]:"",s.min=c.toISOString().split("T")[0];const l=e.status==="DISBURSED";a.disabled=l,a.classList.toggle("opacity-50",l),a.classList.toggle("cursor-not-allowed",l),o.classList.remove("hidden"),r.classList.add("hidden")};window.toggleContractDateEdit=()=>{const e=document.getElementById("contract-date-view"),n=document.getElementById("contract-date-edit");e&&n&&(e.classList.toggle("hidden"),n.classList.toggle("hidden"))};window.manualStatusChange=async()=>{if(d.status==="DISBURSED"){alert(`⛔ ACTION BLOCKED

This application has already been disbursed. To maintain financial integrity, you cannot change the status of an active loan.`);return}const n=document.getElementById("status-override-select").value;if(n!==d.status){if(n.includes("BUREAU")){alert("Cannot manually override Bureau statuses. These are automated.");return}if(confirm(`Are you sure you want to manually force status to "${n}"?`)){const{error:t}=await L(d.id,n);if(t){p(t.message,"error");return}if(n==="OFFER_ACCEPTED"){p("Status manually updated. Activating SureSystems mandate...","success");try{const a=await fetch("/api/suresystems/activate-application",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:d.id})}),s=await a.json().catch(()=>({}));if(!a.ok||s?.success===!1){const o=new Error(s?.error||s?.message||"SureSystems mandate activation failed");throw o.details=s?.details||null,o}alert(`✅ SureSystems mandate activated successfully.

Application ID: ${d.id}${s?.contractReference?`
Contract Reference: ${s.contractReference}`:""}${s?.activatedAt?`
Activated At: ${new Date(s.activatedAt).toLocaleString()}`:""}`)}catch(a){const s=a?.details?`

Details:
${JSON.stringify(a.details,null,2)}`:"";console.error("SureSystems activation failed:",{message:a?.message||"Unknown activation error",details:a?.details||null}),alert(`⚠️ Status changed to OFFER_ACCEPTED, but mandate activation failed.

${a?.message||"Unknown activation error"}`+s),p(a?.message||"SureSystems mandate activation failed","error")}}else p("Status manually updated.","success");await k()}}};const $=document.getElementById("confirmation-modal"),B=document.getElementById("modal-title"),N=document.getElementById("modal-body"),te=(e,n,t)=>{B&&(B.textContent=e),N&&(N.textContent=n),I=t,$?($.classList.remove("hidden"),$.classList.add("flex")):confirm(n)&&t()},D=()=>{$&&($.classList.add("hidden"),$.classList.remove("flex")),I=null};window.closeSACRRAGate=()=>{document.getElementById("sacrra-gate-modal")?.classList.add("hidden")};window.approveAnywaySkipSACRRA=async()=>{window.closeSACRRAGate(),p("Approving loan — remember to complete SACRRA fields before monthly submission.","success"),await g.from("sacrra_rejections").upsert([{match_key:`PENDING-${d?.id}`,error_code:"W00",error_message:`Application ${d?.loan_number||d?.id} approved with incomplete SACRRA fields. Fix before monthly submission.`,resolved:!1}],{onConflict:"match_key,error_code",ignoreDuplicates:!0}).catch(()=>{}),R()};window.saveSACRRAAndApprove=async()=>{const e=document.getElementById("sacrra-gate-save-btn");e.disabled=!0,e.innerHTML='<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Saving…';try{const n={},t={};if(document.querySelectorAll("#sacrra-gate-fields [data-source][data-field]").forEach(a=>{const s=a.dataset.field,o=a.dataset.source,r=a.value?.trim();r&&(o==="profile"&&(n[s]=r),o==="application"&&(t[s]=r))}),Object.keys(n).length){if(n.first_name||n.last_name){const s=n.first_name||d.profiles?.first_name||"",o=n.last_name||d.profiles?.last_name||d.profiles?.full_name?.split(" ").pop()||"";n.full_name=`${s} ${o}`.trim()}const{error:a}=await g.from("profiles").update({...n,updated_at:new Date().toISOString()}).eq("id",d.user_id);if(a)throw new Error("Profile save failed: "+a.message)}if(Object.keys(t).length){const{error:a}=await g.from("loan_applications").update({...t,updated_at:new Date().toISOString()}).eq("id",d.id);if(a)throw new Error("Application save failed: "+a.message)}window.closeSACRRAGate(),p("SACRRA fields saved — proceeding with approval…","success"),await k(),setTimeout(()=>R(),600)}catch(n){p("Save failed: "+n.message,"error"),e.disabled=!1,e.innerHTML='<span class="material-symbols-outlined text-[18px]">save</span> Save & Approve Loan'}};const R=async()=>{const{data:{user:e}}=await g.auth.getUser(),{data:n}=await F(d.id);if(n&&n.length>0){p("Disbursement already exists for this application.","error");return}const{data:t,error:a}=await L(d.id,"APPROVED");if(a){p(a.message,"error");return}const{data:s}=await M(),o=d.bank_account?.id||null,{data:r,error:i}=await V({applicationId:d.id,userId:d.user_id,amount:t.amount,bankAccountId:o,createdBy:e.id});if(i)p("Status updated but disbursement creation failed: "+i.message,"error");else{let c="Application approved & disbursement created.";r?.payout_method==="cashsend"&&r?.cashsend_fee&&(c+=` CashSend fee: R${r.cashsend_fee.toFixed(2)}`),p(c,"success")}k()},ne=async()=>{D();const e=d?.profiles||{},t=Z(d||{},e);if(!t.passed){const a=document.getElementById("sacrra-gate-fields"),s=t.issues.filter(i=>i.source==="profile"),o=t.issues.filter(i=>i.source==="application"),r=(i,c)=>c.length===0?"":`
      <div class="mb-6">
        <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">${i}</p>
        <div class="space-y-3">
          ${c.map(l=>`
            <div class="p-4 rounded-2xl border-2 ${l.readonly?"border-gray-100 bg-gray-50":"border-orange-100 bg-orange-50/30"}">
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-black text-gray-800">${l.label}</label>
                ${l.readonly?'<span class="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Fix in sidebar</span>':'<span class="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Required</span>'}
              </div>
              <p class="text-[11px] text-gray-500 mb-2">${l.hint}</p>
              ${l.readonly?`<div class="text-xs text-gray-400 italic">${l.value||"Not set"}</div>`:l.type==="select"?`<select data-field="${l.field}" data-source="${l.source}"
                        class="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">
                        <option value="">— Select —</option>
                        ${l.options.map(u=>`<option value="${u}" ${l.value===u?"selected":""}>${u}</option>`).join("")}
                      </select>`:`<input type="${l.type}" data-field="${l.field}" data-source="${l.source}"
                        value="${l.value||""}" ${l.pattern?`pattern="${l.pattern}"`:""} ${l.maxlength?`maxlength="${l.maxlength}"`:""}
                        class="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm focus:ring-2 outline-none" style="--tw-ring-color:var(--color-primary)">`}
            </div>`).join("")}
        </div>
      </div>`;a.innerHTML=`
      <div class="mb-4 flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
        <span class="material-symbols-outlined text-amber-500 text-[20px]">warning</span>
        <div>
          <p class="text-sm font-bold text-amber-800">${t.issues.length} field${t.issues.length>1?"s":""} needed for the monthly SACRRA submission.</p>
          <p class="text-xs text-amber-600 mt-0.5">You can approve the loan now and fix these before submission day, or fill them in below.</p>
        </div>
      </div>
      ${r("Client Profile Fields",s)}
      ${r("Loan / Application Fields",o)}
    `,document.getElementById("sacrra-gate-modal").classList.remove("hidden");return}R()},ae=(e,n)=>{const t=e?.full_name||"Unknown User",a=e?.avatar_url||`https://ui-avatars.com/api/?name=${t.replace(" ","+")}&background=random`;document.getElementById("profile-image").src=a,document.getElementById("detail-fullname").textContent=t,document.getElementById("detail-email").textContent=e?.email||"N/A",document.getElementById("detail-mobile").textContent=e?.contact_number||e?.cell_tel_no||"N/A",be(e),xe(e);const s=document.getElementById("nok-name-input"),o=document.getElementById("nok-relationship-input"),r=document.getElementById("nok-phone-input");s&&(s.value=e?.nok_name||""),o&&(o.value=e?.nok_relationship||""),r&&(r.value=e?.nok_phone||"");const i=document.getElementById("detail-identity-number");i&&(i.textContent=e?.identity_number||"N/A");const c=document.getElementById("bank-accounts-container");c&&(c.innerHTML="",n&&n.length>0?n.forEach(l=>{const u=document.createElement("div");u.className="p-4 border border-outline-variant/20 rounded-xl bg-surface-container-lowest flex justify-between items-center hover:border-[var(--color-primary)] hover:shadow-sm transition-all",u.innerHTML=`
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline">
                <span class="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
            <div>
                <p class="text-sm font-bold text-on-surface">${l.bank_name||"Unknown Bank"}</p>
                <p class="text-xs text-outline font-mono">${l.account_number||"----"} • ${l.account_type||"Savings"}</p>
            </div>
        </div>
        ${l.is_primary?'<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold border border-green-200">Primary</span>':""}
      `,c.appendChild(u)}):c.innerHTML='<div class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 rounded-xl text-center">No bank accounts linked to this profile.</div>')},se=async e=>{const n=document.getElementById("personal-tab");if(!n||!e)return;const t=n.querySelector(".compliance-section");t&&t.remove();const{data:a}=await g.from("declarations").select("*").eq("user_id",e).maybeSingle();if(!a)return;const s=document.createElement("div");s.className="mt-8 pt-8 border-t border-outline-variant/10 compliance-section",s.innerHTML=`
        <h4 class="text-md font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-outline text-[20px]">shield</span> Compliance & Statutory Data
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                <p class="text-[10px] text-outline uppercase font-semibold tracking-widest">Marital Status</p>
                <p class="text-sm font-semibold text-on-surface capitalize">${a.marital_status||"Not Set"}</p>
            </div>
            <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                <p class="text-[10px] text-outline uppercase font-semibold tracking-widest">Residential Status</p>
                <p class="text-sm font-semibold text-on-surface capitalize">${a.home_ownership||"Not Set"}</p>
            </div>
        </div>

        ${a.referral_provided?`
        <div class="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p class="text-[10px] text-blue-400 uppercase font-bold mb-2">Referral Information</p>
            <div class="flex flex-col sm:flex-row gap-4">
                <div><span class="text-xs text-blue-600">Name:</span> <span class="text-sm font-bold text-blue-900">${a.referral_name}</span></div>
                <div><span class="text-xs text-blue-600">Phone:</span> <span class="text-sm font-bold text-blue-900">${a.referral_phone}</span></div>
            </div>
        </div>`:""}
    `,n.appendChild(s)},re=(e,n)=>{const t=e&&e[0]?e[0]:{},a=t.parsed_data||{income:{},expenses:{}};document.getElementById("fin-income").textContent=v(t.monthly_income||0),document.getElementById("fin-expenses").textContent=v(t.monthly_expenses||0);const s=document.getElementById("credit-check-content"),o=document.getElementById("credit-date"),r=document.getElementById("btn-download-xml");if(!s)return;let i=document.getElementById("affordability-breakdown-list");if(!i){const m=document.querySelector("#financial-tab .grid"),b=document.createElement("div");b.id="affordability-breakdown-list",b.className="mt-6 p-6 bg-surface-container rounded-2xl border border-outline-variant/10",m.after(b),i=b}const c=Number(a.income.salary||0),l=Number(a.income.other_monthly_earnings||0),u=c+l,f=Object.values(a.expenses||{}).reduce((m,b)=>m+Number(b||0),0),y=Number(t.affordability_ratio||u-f);i.innerHTML=`
    <h4 class="text-[10px] font-semibold text-outline uppercase tracking-widest mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px]">checklist</span> Monthly Budget Breakdown
    </h4>

    <div class="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
      <p class="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Income Sources — tick to include in affordability</p>
      <div class="space-y-2">
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" id="inc-salary-toggle" class="w-4 h-4 rounded accent-orange-500" ${c>0?"checked":""} onchange="window.recalcAffordability()">
            Basic Salary (Net)
          </span>
          <span class="text-sm font-bold text-slate-900">${v(c)}</span>
        </label>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" id="inc-other-toggle" class="w-4 h-4 rounded accent-orange-500" ${l>0?"checked":""} onchange="window.recalcAffordability()">
            Other Earnings
          </span>
          <span class="text-sm font-bold text-slate-900">${v(l)}</span>
        </label>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">Housing / Rent</span>
            <span class="text-sm font-bold text-on-surface">${v(a.expenses.housing_rent||0)}</span>
        </div>
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">School Fees</span>
            <span class="text-sm font-bold text-on-surface">${v(a.expenses.school||0)}</span>
        </div>
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">Transport / Fuel</span>
            <span class="text-sm font-bold text-on-surface">${v(a.expenses.petrol||0)}</span>
        </div>
        <div class="flex justify-between border-b border-outline-variant/10 pb-1">
            <span class="text-sm text-outline">Total Expenses</span>
            <span class="text-sm font-bold text-red-600">${v(f)}</span>
        </div>
    </div>

    <div class="mt-4 p-4 rounded-xl border-2 border-dashed" style="border-color:var(--color-primary);background:color-mix(in srgb, var(--color-primary) 5%, white)">
      <div class="flex justify-between items-center">
        <span class="text-sm font-bold text-on-surface">Disposable Surplus</span>
        <span id="calc-disposable" class="text-lg font-black" style="color:var(--color-primary)">${v(y)}</span>
      </div>
      <p class="text-[10px] text-outline mt-1">Included income minus total expenses</p>
    </div>
  `,window._incomeData={salary:c,otherIncome:l,totalExpenses:f};const x=n&&n.length>0?n[0]:null;if(x){const m=x.credit_score||0,b=m>600?"text-green-600":m>500?"text-yellow-600":"text-red-600";if(o&&(o.textContent=`Checked on ${_(x.checked_at||x.created_at||new Date)}`),r){const w=x.raw_xml_data;w?(r.classList.remove("hidden"),r.innerHTML='<span class="material-symbols-outlined text-[16px] mr-1">picture_as_pdf</span> View Bureau Report',r.className="text-sm text-white px-4 py-2 rounded-xl transition-colors shadow-sm font-semibold flex items-center gap-1",r.style.background="var(--color-primary)",r.onclick=()=>window.viewBureauReport(w)):r.classList.add("hidden")}s.innerHTML=`
        <div class="p-6 border-b border-outline-variant/10 text-center bg-surface-container-lowest">
            <div class="text-6xl font-extrabold ${b} mb-2 tracking-tighter">${m}</div>
            <p class="font-bold text-outline uppercase tracking-widest text-[10px]">Bureau Score</p>
            <span class="inline-block mt-2 px-3 py-1 rounded-full bg-surface-container text-outline text-xs font-semibold border border-outline-variant/20">${x.score_band||"Standard"}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-surface-container">
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold text-on-surface">${x.total_accounts||0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Total Acc</span>
            </div>
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold text-red-600">${x.accounts_with_arrears||0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Arrears</span>
            </div>
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold" style="color:var(--color-primary)">${x.total_enquiries||0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Enquiries</span>
            </div>
            <div class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-center">
                <span class="block text-2xl font-bold text-on-surface">${x.total_judgments||0}</span>
                <span class="text-[10px] text-outline font-semibold uppercase tracking-widest mt-1">Judgments</span>
            </div>
        </div>
        <div class="p-6 bg-surface-container-lowest border-t border-outline-variant/10 space-y-3">
            <div class="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                <span class="text-sm text-outline">Total Balance</span>
                <span class="font-bold text-on-surface">${v(x.total_balance||0)}</span>
            </div>
            <div class="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                <span class="text-sm text-outline">Judgment Value</span>
                <span class="font-bold text-red-600">${v(x.total_judgment_amount||0)}</span>
            </div>
            ${x.ncr_reference?`
            <div class="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                <span class="text-sm text-outline flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[14px] text-green-600">verified</span>
                    NCR Reporting Reference
                </span>
                <span class="font-mono text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg">${x.ncr_reference}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-sm text-outline">Reported to NCR</span>
                <span class="font-bold ${x.reported_to_ncr?"text-green-600":"text-gray-400"}">
                    ${x.reported_to_ncr?"✓ Yes — "+(x.reported_at?_(x.reported_at):"Confirmed"):"Pending"}
                </span>
            </div>`:`
            <div class="flex justify-between items-center">
                <span class="text-sm text-outline flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[14px] text-yellow-500">warning</span>
                    NCR Reference
                </span>
                <span class="text-xs text-yellow-600 font-semibold">Not yet generated — run credit check</span>
            </div>`}
        </div>
      `}else o&&(o.textContent=""),r&&r.classList.add("hidden"),s.innerHTML='<div class="py-12 text-center text-gray-400"><p>No bureau data available.</p></div>';const h=d?.credit_decline_reasons;if(Array.isArray(h)&&h.length>0){let m=document.getElementById("decline-reasons-panel");if(!m){m=document.createElement("div"),m.id="decline-reasons-panel",m.className="mt-6 p-5 rounded-2xl border border-red-200 bg-red-50";const b=document.querySelector("#financial-tab .pt-8");b?b.after(m):document.getElementById("financial-tab")?.appendChild(m)}m.innerHTML=`
        <h4 class="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">cancel</span>
          Decline Reasons (${h.length})
        </h4>
        <div class="space-y-2">
          ${h.map(b=>`
            <div class="flex items-start gap-3 p-3 bg-white rounded-xl border border-red-100">
              <span class="material-symbols-outlined text-[16px] text-red-500 mt-0.5">block</span>
              <div>
                <p class="text-sm font-semibold text-red-900">${b.label||b.rule_key||"Rule Failed"}</p>
                ${b.reason?`<p class="text-xs text-red-600 mt-0.5">${b.reason}</p>`:""}
              </div>
            </div>`).join("")}
        </div>`}},oe=(e,n,t)=>{const a=document.getElementById("documents-list"),s=document.getElementById("doc-count");if(!a||!s)return;const o=[{key:"idcard",label:"ID Document"},{key:"till_slip",label:"Latest Payslip"},{key:"bank_statement",label:"Bank Statement"},{key:"credit_life_contract",label:"Credit Life Contract"}];let r=0;if(t&&(t.id_front_image_url&&r++,t.id_back_image_url&&r++,t.selfie_image_url&&r++),s.textContent=(e?.length||0)+(n?1:0)+r,a.innerHTML="",o.forEach(i=>{const c=e.find(m=>m.file_type===i.key),l=i.key==="idcard"&&(t?.id_front_image_url||t?.id_back_image_url),u=c||l,f=u?"text-green-600 bg-green-100":"text-gray-400 bg-gray-100",y=u?"fa-check-circle":"fa-upload",x=l?"Verified via KYC Session":c?"File Verified":"Missing Document",h=document.createElement("div");h.className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-300 transition-all group",h.innerHTML=`
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl ${f} flex items-center justify-center">
                <i class="fa-solid ${y} text-xl"></i>
            </div>
            <div class="flex-grow min-w-0">
                <p class="text-sm font-bold text-gray-900">${i.label}</p>
                <p class="text-xs text-gray-500">${x}</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${c?`
            <button onclick="handleSmartDownload('${c.file_path}')" class="w-10 h-10 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all">
                <i class="fa-solid fa-eye"></i>
            </button>`:""}
            
            <label class="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-all">
                ${u?"Replace":"Upload"}
                <input type="file" class="hidden admin-doc-upload" data-type="${i.key}" accept=".pdf,.jpg,.png,.jpeg">
            </label>
        </div>
      `,a.appendChild(h)}),n){const i=n.verified===!0,c=n.normalized_status||n.status||"Linked",l=document.createElement("div");l.className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-200 rounded-xl hover:border-blue-400 transition-all mt-4",l.innerHTML=`
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl ${i?"bg-blue-600 text-white":"bg-blue-100 text-blue-600"} flex items-center justify-center shadow-sm">
                <i class="fa-solid fa-shield-halved text-xl"></i>
            </div>
            <div class="flex-grow min-w-0">
                <p class="text-sm font-bold text-gray-900">TruID Digital Verification</p>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">${c}</span>
                    <p class="text-[10px] text-gray-400 font-medium">Ref: ${(n.collection_id||"").slice(0,8)}</p>
                </div>
            </div>
        </div>
        <button onclick="window.viewTruidReport()" class="px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all">
            Inspect Data
        </button>
    `,a.appendChild(l)}t&&[{key:"id_front",label:"KYC ID Front",url:t.id_front_image_url},{key:"id_back",label:"KYC ID Back",url:t.id_back_image_url},{key:"selfie",label:"KYC Selfie",url:t.selfie_image_url}].filter(c=>c.url).forEach(c=>{const l=document.createElement("div");l.className="flex items-center justify-between p-4 bg-purple-50/50 border border-purple-200 rounded-xl hover:border-purple-400 transition-all mt-4",l.innerHTML=`
          <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                  <i class="fa-solid fa-id-card text-xl"></i>
              </div>
              <div class="flex-grow min-w-0">
                  <p class="text-sm font-bold text-gray-900">${c.label}</p>
                  <div class="flex items-center gap-2">
                      <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700">Digital KYC</span>
                      <p class="text-[10px] text-gray-400 font-medium">Session ID: ${(t.session_id||"").slice(0,8)}</p>
                  </div>
              </div>
          </div>
          <button onclick="window.open('${c.url}', '_blank')" class="px-4 py-2 bg-white border border-purple-600 text-blue-600 rounded-lg text-xs font-bold hover:bg-purple-50 transition-all">
              <i class="fa-solid fa-external-link-alt mr-1"></i> View
          </button>
      `,a.appendChild(l)}),ie()},ie=()=>{document.querySelectorAll(".admin-doc-upload").forEach(e=>{e.addEventListener("change",async n=>{const t=n.target.files[0];if(!t||!d)return;const a=n.target.dataset.type,s=n.target.parentElement,o=s.childNodes[0].textContent;s.childNodes[0].textContent="Processing...";try{const{data:{session:r}}=await g.auth.getSession(),i=r.user.id,c=t.name.split(".").pop(),l=`${a}_${Date.now()}.${c}`,u=`${i}/${d.user_id}_${l}`,{error:f}=await g.storage.from("client_docs").upload(u,t,{upsert:!0});if(f)throw f;const{error:y}=await g.rpc("register_admin_upload",{p_user_id:d.user_id,p_app_id:d.id,p_file_name:l,p_original_name:t.name,p_file_path:u,p_file_type:a,p_mime_type:t.type,p_file_size:t.size});if(y)throw y;p("Document Updated Successfully","success"),k()}catch(r){console.error(r),p(r.message,"error")}finally{s.childNodes[0].textContent=o}})})};window.handleSmartDownload=async e=>{try{let n=e;e.includes("/storage/v1/object/")&&(n=e.split("/").slice(8).join("/"));let{data:t,error:a}=await g.storage.from("client_docs").createSignedUrl(n,60);if((a||!t)&&({data:t,error:a}=await g.storage.from("documents").createSignedUrl(n,60)),a)throw a;window.open(t.signedUrl,"_blank")}catch(n){console.error("Smart Download Error:",n),p("File not found in any bucket. Please check storage manually.","error")}};const le=async(e,n,t)=>{const a=document.getElementById("loan-history-list"),s=document.getElementById("app-history-list");let o=document.getElementById("admin-metadata-container");if(t){const r=document.getElementById("loan-tab");if(!o){o=document.createElement("div"),o.id="admin-metadata-container",o.className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-8";const i=Array.from(r.querySelectorAll("h3")).find(c=>c.textContent.includes("Client History"));i?r.insertBefore(o,i):r.appendChild(o)}try{const i=[t.created_by_admin,t.reviewed_by_admin].filter(Boolean),{data:c}=await g.from("profiles").select("id, full_name").in("id",i),l=c?.find(f=>f.id===t.created_by_admin)?.full_name||"System / User",u=c?.find(f=>f.id===t.reviewed_by_admin)?.full_name||"Pending Review";o.innerHTML=`
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">Created By</p>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold">
                        ${l.charAt(0)}
                    </div>
                    <span class="text-sm font-bold text-gray-800">${l}</span>
                </div>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">Reviewed By</p>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">
                        ${u.charAt(0)}
                    </div>
                    <span class="text-sm font-bold text-gray-800">${u}</span>
                </div>
            </div>
          `}catch(i){console.error("Admin UUID Lookup Error:",i)}}a&&(a.innerHTML="",e&&e.length>0?e.forEach(r=>{const i=document.createElement("div");i.className="p-3 border-b border-gray-100 last:border-0",i.innerHTML=`
                <div class="flex justify-between items-center">
                    <div>
                        <span class="block font-bold text-gray-800 text-sm">Loan #${r.id}</span>
                        <span class="text-xs text-gray-500">${_(r.start_date||r.created_at)}</span>
                    </div>
                    <div class="text-right">
                        <span class="block font-bold text-gray-900 text-sm">${v(r.principal_amount||0)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold uppercase">${r.status||"Active"}</span>
                    </div>
                </div>
            `,a.appendChild(i)}):a.innerHTML='<p class="text-sm text-gray-400 italic p-2">No previous loan history found.</p>'),s&&(s.innerHTML="",n&&n.length>0?n.forEach(r=>{const i=document.createElement("div");i.className="p-3 border-b border-gray-100 last:border-0",i.innerHTML=`
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-bold block text-gray-800 text-sm">App #${r.id}</span>
                        <span class="text-xs text-gray-500">${_(r.created_at)}</span>
                    </div>
                    <div class="text-right">
                        <span class="block text-gray-600 font-medium text-sm">${v(r.amount||0)}</span>
                        <span class="text-[10px] uppercase font-bold text-orange-500">${r.status}</span>
                    </div>
                </div>
            `,s.appendChild(i)}):s.innerHTML='<p class="text-sm text-gray-400 italic p-2">No other applications on record.</p>')},de=e=>{const n=document.getElementById("credit-life-status-badge"),t=document.getElementById("credit-life-contract-summary"),a=document.getElementById("credit-life-signature-gallery"),s=document.getElementById("credit-life-view-contract-btn"),o=document.getElementById("credit-life-download-contract-btn");if(!n||!t||!a)return;const r=e?.offer_details||{},i=!!(e?.has_credit_life_insurance||r.credit_life_enabled),c=!!(r.credit_life_contract_signed&&r.credit_life_signature_data),l=r.credit_life_signed_at?_(r.credit_life_signed_at):"Not signed",u=r.credit_life_contract_version||"v1",f=r.credit_life_contract_text||"No signed contract snapshot stored.",y=r.credit_life_contract_file_path||null,x=Number(r.credit_life_total??e?.offer_credit_life_total??0);n.textContent=i?c?"Selected and signed":"Selected, signature missing":"Not selected",n.className=`px-3 py-1 text-xs font-bold rounded-full ${i?c?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700":"bg-gray-200 text-gray-700"}`,t.innerHTML=`
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Insurance Status</p>
        <p class="font-semibold text-gray-900">${i?"Opted in":"Not added"}</p>
      </div>
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Signed At</p>
        <p class="font-semibold text-gray-900">${E(l)}</p>
      </div>
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Contract Version</p>
        <p class="font-semibold text-gray-900">${E(u)}</p>
      </div>
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Credit Life Premium</p>
        <p class="font-semibold text-gray-900">${v(x)}</p>
      </div>
    </div>
    <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
      <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Signed Contract Text</p>
      <div class="text-sm leading-6 text-gray-700 whitespace-pre-wrap">${E(f)}</div>
    </div>
  `;const h=r.signature_data,m=r.credit_life_signature_data,b=(w,C,S)=>`
    <div class="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">${w}</p>
      <p class="text-xs text-gray-500 mb-3">${S}</p>
      ${C?`<img src="${C}" alt="${w}" class="w-full h-40 object-contain rounded-lg border border-gray-200 bg-white">`:'<div class="h-40 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center text-sm text-gray-400">No signature captured</div>'}
    </div>
  `;a.innerHTML=[b("Main Loan Signature",h,"Captured from the standard loan acknowledgement step."),b("Credit Life Signature",m,"Captured only when the Credit Life contract is signed.")].join(""),s&&(s.classList.toggle("hidden",!i),s.onclick=()=>ce(e)),o&&(o.classList.toggle("hidden",!y),o.onclick=()=>{y&&(/^https?:\/\//i.test(y)?window.open(y,"_blank"):handleSmartDownload(y))})},ce=e=>{const n=document.getElementById("credit-life-contract-modal"),t=document.getElementById("credit-life-contract-modal-body");if(!n||!t)return;const a=e?.offer_details||{},s=a.credit_life_signed_at?_(a.credit_life_signed_at):"Not signed",o=a.credit_life_contract_version||"v1",r=a.credit_life_contract_text||"No signed contract snapshot stored.",i=a.signature_data,c=a.credit_life_signature_data,l=(u,f)=>`
    <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">${u}</p>
      ${f?`<img src="${f}" alt="${u}" class="w-full h-56 object-contain rounded-xl border border-gray-200 bg-white">`:'<div class="w-full h-56 rounded-xl border border-dashed border-gray-300 bg-white flex items-center justify-center text-sm text-gray-400">No signature captured</div>'}
    </div>
  `;t.innerHTML=`
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">Application</p>
        <p class="text-sm font-bold text-gray-900">${E(e?.id||"")}</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">Signed At</p>
        <p class="text-sm font-bold text-gray-900">${E(s)}</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">Version</p>
        <p class="text-sm font-bold text-gray-900">${E(o)}</p>
      </div>
    </div>
    <div class="rounded-3xl border border-gray-200 bg-white p-5 mb-6">
      <p class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-3">Contract Text</p>
      <div class="whitespace-pre-wrap text-sm leading-7 text-gray-700">${E(r)}</div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${l("Main Loan Signature",i)}
      ${l("Credit Life Signature",c)}
    </div>
  `,n.classList.remove("hidden"),n.classList.add("flex")},T=()=>{const e=document.getElementById("credit-life-contract-modal");e&&(e.classList.add("hidden"),e.classList.remove("flex"))},pe=async e=>{const n=document.getElementById("action-buttons-container");if(n)try{const{data:t}=await F(e.id),{data:a}=await M();if(!t||t.length===0){n.innerHTML=`
        <div class="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-center">
          <p class="text-sm font-bold text-yellow-800">Disbursement Not Found</p>
        </div>
      `;return}const s=t[0];let o="";s.payout_method==="cashsend"&&s.cashsend_fee&&(o=`
        <div class="rounded-lg bg-orange-50 border border-orange-200 p-3 mt-3">
          <p class="text-xs font-bold text-orange-700 uppercase mb-2">CashSend Fees</p>
          <p class="text-sm text-orange-800">R${s.cashsend_fee.toFixed(2)}</p>
        </div>
      `),n.innerHTML=`
      <div class="space-y-3">
        <div class="p-4 bg-green-50 border border-green-100 rounded-xl">
          <p class="text-xs font-bold text-green-700 uppercase mb-2">Disbursement Details</p>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-green-600">Amount</p>
              <p class="font-bold text-green-900">R${s.amount.toFixed(2)}</p>
            </div>
            <div>
              <p class="text-xs text-green-600">Payout Method</p>
              <p class="font-bold text-green-900 capitalize">${s.payout_method}</p>
            </div>
            <div>
              <p class="text-xs text-green-600">Status</p>
              <p class="font-bold text-green-900 capitalize">${s.status}</p>
            </div>
            <div>
              <p class="text-xs text-green-600">Date</p>
              <p class="font-bold text-green-900">${_(s.created_at)}</p>
            </div>
          </div>
        </div>
        ${o}
        <button onclick="handleDisbursementExport(${e.id})" class="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-colors">
          <i class="fa-solid fa-file-csv mr-2"></i> Export CSV
        </button>
      </div>
    `}catch(t){console.error("Error rendering disbursement section:",t),n.innerHTML='<div class="p-4 bg-red-50 border border-red-100 rounded-xl text-center"><p class="text-sm font-bold text-red-800">Error loading disbursement</p></div>'}},ue=e=>{if(!e)return;const n=e.status||"pending",t=document.getElementById("sidebar-status"),a=document.getElementById("status-alert"),s=document.getElementById("action-buttons-container"),o=parseFloat(e.offer_principal||e.amount||0),r=parseInt(e.term_months||1),i=parseFloat(e.offer_total_interest||0),c=parseFloat(e.offer_total_initiation_fees||0),l=parseFloat(e.offer_total_admin_fees||0),u=parseFloat(e.offer_details?.credit_life_total||e.offer_credit_life_total||0),f=parseFloat(e.offer_total_repayment||0),y=parseFloat(e.offer_monthly_repayment||0),x=parseFloat(e.offer_interest_rate||0),h=e.repayment_start_date||e.offer_details?.first_payment_date;document.getElementById("sidebar-amount").textContent=v(o),document.getElementById("sidebar-term").textContent=`${r} Month${r>1?"s":""}`,document.getElementById("sidebar-payment").textContent=v(y);let m=document.getElementById("financial-breakdown");if(!m){const S=document.getElementById("sidebar-payment").parentElement.parentElement;m=document.createElement("div"),m.id="financial-breakdown",m.className="pt-4 border-t border-gray-100 space-y-4",S.after(m)}m.innerHTML=`
    <div class="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Tiered Interest (${(x*100).toFixed(1)}%)</span>
            <span class="font-bold text-gray-900">${v(i)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Initiation Fee</span>
            <span class="font-bold text-gray-900">${v(c)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Monthly Service Fee</span>
            <span class="font-bold text-gray-900">${v(l)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Credit Life Insurance</span>
            <span class="font-bold text-gray-900">${v(u)}</span>
        </div>
        <div class="pt-2 border-t border-gray-200 flex justify-between items-center">
            <span class="text-xs font-black uppercase text-gray-700">Total Repayable</span>
            <span class="text-sm font-black text-green-600">${v(f)}</span>
        </div>
    </div>
    
    <div class="mt-4">
      <label class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1 block">Scheduled Payout Info</label>
      <div class="p-3 bg-orange-50 border border-orange-100 rounded-xl transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs text-orange-800 font-medium">First Repayment:</span>
          <span class="text-xs font-bold text-orange-900">
            ${h?_(h):"Not Scheduled"}
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
            value="${r}"
            class="w-full px-3 py-2 border border-blue-300 rounded-lg bg-blue-50 text-sm font-bold"
            placeholder="Months"
          />
          <small class="text-blue-600 mt-1 block">Leave loan term open for admin review</small>
        </div>
        <button
          type="button"
          id="admin-update-loan-term-btn"
          class="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
          onclick="handleAdminLoanTermOverride(${e.id})"
        >
          <i class="fa-solid fa-check"></i> Set
        </button>
      </div>
    </div>
  `,t&&(t.textContent=n.replace("_"," "),t.className=`mt-2 text-lg font-bold uppercase tracking-wide ${j(n).split(" ")[0].replace("bg-","text-").replace("-100","-600")}`);const b=document.getElementById("status-override-select"),w=document.getElementById("manual-update-btn"),C=document.getElementById("override-hint");if(n==="DISBURSED"?(b&&(b.disabled=!0),w&&(w.disabled=!0,w.classList.add("opacity-50","cursor-not-allowed"),w.innerText="Locked"),C&&(C.textContent="🔒 Application is active. Modifications disabled.")):(b&&(b.disabled=!1,b.value=n),w&&(w.disabled=!1,w.innerText="Update")),a&&(a.className="mt-3 p-3 rounded-lg text-xs font-medium leading-relaxed hidden",n==="OFFERED"?(a.textContent="Contract Sent. Waiting for user to sign.",a.classList.add("bg-purple-50","text-purple-700","block")):n==="APPROVED"&&(a.textContent="Application is queued for disbursement.",a.classList.add("bg-green-50","text-green-700","block"))),s){if(s.innerHTML="",["BUREAU_OK","BANK_LINKING","STARTED","AFFORD_REFER","BUREAU_REFER"].includes(n)){const S=n==="AFFORD_REFER"||n==="BUREAU_REFER"?'<div class="p-3 bg-orange-50 border border-orange-100 rounded-lg mb-3 text-xs text-orange-700 font-bold"><i class="fa-solid fa-circle-exclamation mr-1"></i> Currently Under Manual Review</div>':"";s.innerHTML=`
            ${S}
            <h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Assessment</h4>
            <button onclick="updateStatus('AFFORD_OK')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl mb-2 shadow-lg"><i class="fa-solid fa-check-circle mr-2"></i> Confirm Affordability</button>
            ${n.includes("REFER")?"":`<button onclick="updateStatus('AFFORD_REFER')" class="w-full py-3 bg-white border border-orange-200 text-orange-600 text-sm font-bold rounded-xl mb-2"><i class="fa-solid fa-magnifying-glass mr-2"></i> Refer</button>`}
            
            <button onclick="openModal('Decline', 'Are you sure you want to decline this application?', declineApplication)" class="w-full py-3 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-xl">
                <i class="fa-solid fa-xmark mr-2"></i> Decline
            </button>
          `}else if(n==="AFFORD_OK")s.innerHTML=`
            <div class="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-3 text-xs text-blue-700">Client passed assessment. Issue an offer to allow them to sign the contract in-app.</div>
          `;else if(n==="OFFER_ACCEPTED")s.innerHTML=`
             <div class="p-3 bg-purple-50 border border-purple-100 rounded-lg mb-3 text-xs text-purple-700"><i class="fa-solid fa-signature mr-1"></i> Client Signed.</div>
             <button id="btn-approve-contract" class="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-lg"><i class="fa-solid fa-file-signature mr-2"></i> Approve & Queue Payout</button>
          `,document.getElementById("btn-approve-contract").onclick=()=>te("Approve","Mark contract as valid and ready for payout?",ne);else if(n==="APPROVED")pe(d);else if(n==="DISBURSED")s.innerHTML=`
            <div class="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center mb-2"><p class="text-sm font-bold text-gray-600">Loan Active</p></div>
            <button onclick="window.open('/api/letters-of-demand/${e.id}', '_blank')"
              class="w-full py-2.5 bg-white border border-orange-200 text-orange-700 text-sm font-bold rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[16px]">description</span> Letter of Demand
            </button>
            ${e.routed_to_head_office?'<div class="mt-2 text-xs text-center text-green-700 font-semibold bg-green-50 rounded-xl py-2 border border-green-100">✓ Routed to Head Office</div>':`<button onclick="window.routeToHeadOffice('${e.id}')"
              class="w-full py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 mt-2">
              <span class="material-symbols-outlined text-[16px]">corporate_fare</span> Route to Head Office
            </button>`}`;else if(n==="IN_ARREARS")s.innerHTML=`
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-xl mb-3 text-xs text-yellow-800 font-bold">
              <i class="fa-solid fa-triangle-exclamation mr-1"></i> Account In Arrears — follow up required
            </div>
            <button onclick="window.open('/api/letters-of-demand/${e.id}', '_blank')"
              class="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
              <i class="fa-solid fa-file-lines"></i> Generate Letter of Demand
            </button>`;else if(n==="IN_DEFAULT"){const P=(parseFloat(e.offer_principal||e.amount||0)*.03).toLocaleString("en-ZA",{minimumFractionDigits:2});s.innerHTML=`
            <div class="p-3 bg-red-50 border border-red-200 rounded-xl mb-3 text-xs text-red-800 font-bold">
              <i class="fa-solid fa-circle-exclamation mr-1"></i> IN DEFAULT — 3% interest applies
              <div class="font-normal mt-1 text-red-700">Default interest: R ${P}</div>
            </div>
            <button onclick="window.open('/api/letters-of-demand/${e.id}', '_blank')"
              class="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 mb-2">
              <i class="fa-solid fa-file-lines"></i> Generate Letter of Demand
            </button>
            <button onclick="updateStatus('ACTIVE')"
              class="w-full py-3 bg-white border border-green-200 text-green-700 text-sm font-bold rounded-xl flex items-center justify-center gap-2">
              <i class="fa-solid fa-check"></i> Mark Payment Received
            </button>`}}},me=e=>{if(!e)return;document.getElementById("applicant-name-header").textContent=e.profiles?.full_name||"Unknown";const n=e.profiles||{},t=n.client_number?String(n.client_number):"",a=e.loan_number?`L${String(e.loan_number).padStart(4,"0")}`:"",s=t&&a?`${t}-${a}`:a||e.id.slice(0,8).toUpperCase(),o=e.agreement_number||s;document.getElementById("header-id-val").textContent=s,document.getElementById("header-date").textContent=_(e.created_at),document.getElementById("detail-app-id").textContent=o,document.getElementById("detail-date").textContent=_(e.created_at),document.getElementById("detail-purpose").textContent=e.loan_purpose||e.purpose||"Personal Loan",document.getElementById("detail-notes").value=e.notes||"";const r=document.getElementById("header-status-badge");r&&(r.textContent=e.status,r.className=`px-4 py-1.5 text-sm font-bold rounded-full shadow-sm ${j(e.status)}`)};window.recalcAffordability=function(){if(!window._incomeData)return;const{salary:e,otherIncome:n,totalExpenses:t}=window._incomeData,a=document.getElementById("inc-salary-toggle")?.checked?e:0,s=document.getElementById("inc-other-toggle")?.checked?n:0,o=a+s-t,r=document.getElementById("calc-disposable");r&&(r.textContent=`R ${Math.max(0,o).toLocaleString("en-ZA",{minimumFractionDigits:2})}`,r.style.color=o<0?"#ef4444":"var(--color-primary)")};window.routeToHeadOffice=async function(e){if(confirm("Route this application to Head Office?"))try{const{data:{session:n}}=await g.auth.getSession(),t=await fetch(`/api/applications/${e}/route-to-head-office`,{method:"POST",headers:{Authorization:`Bearer ${n?.access_token}`,"Content-Type":"application/json"}}),a=await t.json();if(!t.ok)throw new Error(a.error||"Failed");p("Routed to Head Office.","success"),await k()}catch(n){p("Error: "+n.message,"error")}};window.saveNOK=async function(){if(!d?.user_id)return;const e=document.getElementById("nok-name-input")?.value.trim(),n=document.getElementById("nok-relationship-input")?.value.trim(),t=document.getElementById("nok-phone-input")?.value.trim();try{const{error:a}=await g.from("profiles").update({nok_name:e||null,nok_relationship:n||null,nok_phone:t||null,updated_at:new Date().toISOString()}).eq("id",d.user_id);if(a)throw a;const s=document.getElementById("nok-saved-badge");s&&(s.classList.remove("hidden"),setTimeout(()=>s.classList.add("hidden"),2500)),p("Next of kin saved.","success")}catch(a){p("Failed to save: "+a.message,"error")}};window.saveEmployerDetails=async function(){if(!d?.user_id)return;const e=document.getElementById("employer-name-input")?.value.trim(),n=document.getElementById("employer-phone-input")?.value.trim(),t=document.getElementById("employer-address-input")?.value.trim(),a=document.getElementById("btn-save-employer");a.textContent="Saving…",a.disabled=!0;try{const{error:s}=await g.from("profiles").update({employer_name:e||null,employer_phone:n||null,employer_address:t||null}).eq("id",d.user_id);if(s)throw s;p("Employer details saved.","success")}catch(s){p(s.message,"error")}finally{a.textContent="Save Details",a.disabled=!1}};window.toggleEmployerVerified=async function(){if(!d?.user_id)return;const e=document.getElementById("employer-verified-badge"),n=document.getElementById("employer-verified-note"),t=document.getElementById("btn-verify-employer"),s=!(e?.textContent==="Verified"),{data:{session:o}}=await g.auth.getSession(),{data:r}=o?await g.from("profiles").select("full_name").eq("id",o.user.id).maybeSingle():{data:null},{error:i}=await g.from("profiles").update({employer_verified:s,employer_verified_at:s?new Date().toISOString():null,employer_verified_by:s?r?.full_name||o?.user?.email||"Admin":null}).eq("id",d.user_id);if(i){p(i.message,"error");return}e&&(e.textContent=s?"Verified":"Unverified",e.className=`px-2 py-1 rounded-full text-xs font-bold ${s?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`),t&&(t.textContent=s?"Revoke Verification":"Mark Verified"),n&&(n.textContent=s?`Verified by ${r?.full_name||"Admin"} on ${new Date().toLocaleDateString("en-ZA")}`:"",n.classList.toggle("hidden",!s)),p(s?"Employer verified.":"Verification revoked.","success")};function be(e){const n=document.getElementById("employer-name-input"),t=document.getElementById("employer-phone-input"),a=document.getElementById("employer-address-input"),s=document.getElementById("employer-verified-badge"),o=document.getElementById("employer-verified-note"),r=document.getElementById("btn-verify-employer");n&&(n.value=e?.employer_name||""),t&&(t.value=e?.employer_phone||""),a&&(a.value=e?.employer_address||"");const i=e?.employer_verified===!0;s&&(s.textContent=i?"Verified":"Unverified",s.className=`px-2 py-1 rounded-full text-xs font-bold ${i?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`),r&&(r.textContent=i?"Revoke Verification":"Mark Verified"),o&&i&&e.employer_verified_at&&(o.textContent=`Verified by ${e.employer_verified_by||"Admin"} on ${new Date(e.employer_verified_at).toLocaleDateString("en-ZA")}`,o.classList.remove("hidden"))}window.saveClientCap=async function(){if(!d?.user_id)return;const e=document.getElementById("credit-cap-input")?.value,n=document.getElementById("credit-cap-note")?.value.trim(),t=e?parseFloat(e):null,{error:a}=await g.from("profiles").update({credit_limit_override:t,credit_limit_note:n||null}).eq("id",d.user_id);if(a){p(a.message,"error");return}const s=document.getElementById("credit-cap-current");s&&(s.textContent=t?`Current cap: R${t.toLocaleString("en-ZA")} — ${n||""}`:"No cap set — using standard band rules."),p(t?`Credit cap set to R${t.toLocaleString("en-ZA")}.`:"Credit cap removed.","success"),await g.from("audit_log").insert([{entity_type:"profile",entity_id:d.user_id,action:"credit_cap_set",new_value:{cap:t,note:n},description:t?`Credit cap set to R${t.toLocaleString("en-ZA")}`:"Credit cap removed"}]).catch(()=>{})};function xe(e){const n=document.getElementById("credit-cap-input"),t=document.getElementById("credit-cap-note"),a=document.getElementById("credit-cap-current");n&&e?.credit_limit_override&&(n.value=e.credit_limit_override),t&&e?.credit_limit_note&&(t.value=e.credit_limit_note),a&&(a.textContent=e?.credit_limit_override?`Current cap: R${Number(e.credit_limit_override).toLocaleString("en-ZA")}${e.credit_limit_note?" — "+e.credit_limit_note:""}`:"No cap set — using standard band rules.")}let A=[];async function O(e){try{A=(await(await fetch(`/api/audit-log/loan_application/${e}`)).json()).data||[],fe()}catch(n){console.warn("[audit-trail]",n.message)}}function fe(){const e=document.getElementById("audit-trail-list");if(!e)return;if(!A.length){e.innerHTML='<div class="text-center py-8 text-sm text-gray-400">No audit entries yet. Changes will appear here.</div>';return}const n={status_change:{icon:"swap_horiz",color:"#3b82f6"},field_update:{icon:"edit",color:"#f59e0b"},created:{icon:"add_circle",color:"#10b981"},viewed:{icon:"visibility",color:"#8b5cf6"},default:{icon:"history",color:"#6b7280"}};e.innerHTML=A.map(t=>{const a=n[t.action]||n.default,s=new Date(t.created_at),o=s.toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"}),r=s.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"});let i="";return t.action==="status_change"&&t.old_value?.status&&t.new_value?.status?i=`<span class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">${t.old_value.status}</span>
                      <span class="text-gray-400 mx-1">→</span>
                      <span class="font-mono text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">${t.new_value.status}</span>`:t.description&&(i=`<span class="text-xs text-gray-500">${t.description}</span>`),`
        <div class="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
          <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
               style="background:${a.color}18">
            <span class="material-symbols-outlined text-[16px]" style="color:${a.color}">${a.icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-gray-800">${t.performed_by_name||"System"}</span>
              <span class="text-xs text-gray-400">${t.action.replace(/_/g," ")}</span>
              ${i}
            </div>
            <div class="text-xs text-gray-400 mt-1">${o} at ${r}</div>
          </div>
        </div>`}).join("")}window.exportAuditTrail=function(){if(!A.length){alert("No audit entries to export.");return}const e=["Date","Time","Action","Description","Old Value","New Value","Performed By"],n=A.map(r=>{const i=new Date(r.created_at);return[i.toLocaleDateString("en-ZA"),i.toLocaleTimeString("en-ZA"),r.action,`"${(r.description||"").replace(/"/g,'""')}"`,r.old_value?JSON.stringify(r.old_value):"",r.new_value?JSON.stringify(r.new_value):"",r.performed_by_name||"System"].join(",")}),t=[e.join(","),...n].join(`
`),a=new Blob([t],{type:"text/csv;charset=utf-8;"}),s=URL.createObjectURL(a),o=document.createElement("a");o.href=s,o.download=`audit_trail_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(s)};const k=async()=>{const n=new URLSearchParams(window.location.search).get("id");if(n)try{const t=await q(n);d=t,Q(),document.getElementById("contract-declined-banner")?.remove(),me(t),ae(t.profiles||{},t.bank_accounts),await se(t.user_id),re(t.financial_profiles,t.credit_checks),oe(t.documents,t.truid_info,t.kyc_info),await le(t.loan_history,t.application_history,t),de(t),O(n),ue(t),ee(t),await W(),document.getElementById("loading-state")?.classList.add("hidden"),document.getElementById("content-grid")?.classList.remove("hidden"),document.getElementById("page-header")?.classList.remove("hidden")}catch(t){console.error("Integration Error:",t),p("Failed to load full application data.","error")}};window.handleAdminLoanTermOverride=async e=>{const n=document.getElementById("admin-loan-term-override"),t=parseInt(n.value);if(!t||t<1||t>36){p("Please enter a valid loan term (1-36 months)","error");return}try{const{data:a,error:s}=await g.from("loan_applications").update({term_months:t}).eq("id",e).select();if(s)throw s;p(`✅ Loan term updated to ${t} month${t>1?"s":""}`,"success"),await k()}catch(a){console.error("Error updating loan term:",a),p(`❌ Error: ${a.message}`,"error")}};window.handleDisbursementExport=async e=>{try{const n=await fetch("/api/disbursements/payout-csv",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationIds:[e]})});if(!n.ok){const o=await n.json();p(o.error||"Failed to generate CSV","error");return}const t=await n.blob(),a=URL.createObjectURL(t),s=document.createElement("a");s.href=a,s.download=`disbursement-${e}-${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(s),s.click(),document.body.removeChild(s),URL.revokeObjectURL(a),p("Disbursement CSV exported successfully","success")}catch(n){console.error("Error exporting CSV:",n),p(n.message||"Failed to export CSV","error")}};document.addEventListener("DOMContentLoaded",async()=>{await U();let e=document.getElementById("main-content");e||(e=document.createElement("main"),e.id="main-content",e.className="flex-1 p-6 pt-24",document.getElementById("app-shell").appendChild(e)),e.innerHTML=J,X(),await k(),document.getElementById("btn-save-notes")?.addEventListener("click",saveNotes);const n=document.getElementById("modal-confirm-btn"),t=document.getElementById("modal-cancel-btn");n&&n.addEventListener("click",()=>{typeof I=="function"&&I()}),t&&t.addEventListener("click",D),document.getElementById("credit-life-contract-modal-close")?.addEventListener("click",T),document.getElementById("credit-life-contract-modal")?.addEventListener("click",a=>{a.target?.id==="credit-life-contract-modal"&&T()})});
