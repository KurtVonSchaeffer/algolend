import{supabase as y}from"./supabaseClient-DdIec1HK.js";/* empty css              *//* empty css               */import{i as se}from"./layout-Nmoyu__-.js";import{o as ie,p as re,q as oe,s as le,r as de}from"./dataService-C6RIvcSC.js";import{S as ce,a as E,b as V}from"./utils-CZwHw4kl.js";import"https://esm.sh/@supabase/supabase-js@2";import"./theme-CYs9TE7o.js";const K=e=>ce[e]||{label:e,color:"#6b7280",bg:"#f3f4f6"},ue=["STARTED","BUREAU_CHECKING","BUREAU_OK","BUREAU_REFER","BUREAU_DECLINE","BANK_LINKING","AFFORD_OK","AFFORD_REFER","AFFORD_FAIL","OFFERED","OFFER_ACCEPTED","CONTRACT_SIGN","DEBICHECK_AUTH","APPROVED","DISBURSED","DECLINED","ERROR"];let N=[],B=[],F="borrower",U=null,Y=[],k=1;const D=20;let a={active:!1,step:1,targetUser:null,loanHistoryCount:0,loanConfig:{amount:1e3,period:1,startDate:null,reason:"Personal Loan",maxAllowedPeriod:1,interestRate:.2},documents:{idcard:"pending",till_slip:"pending",bank_statement:"pending"},creditCheck:{applicationId:null,status:"pending",score:null}};const M="admin-credit-check-modal";let j=!1,L=null;function b(e,t="success"){let n=document.getElementById("toast-container");n||(n=document.createElement("div"),n.id="toast-container",n.className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none",document.body.appendChild(n));const s=document.createElement("div");let o="bg-gray-900 text-white",d='<i class="fa-solid fa-circle-check"></i>';t==="error"?(o="bg-red-600 text-white",d='<i class="fa-solid fa-circle-xmark"></i>'):t==="warning"&&(o="bg-orange-500 text-white",d='<i class="fa-solid fa-triangle-exclamation"></i>'),s.className=`${o} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full pointer-events-auto`,s.innerHTML=`${d}<span class="text-sm font-medium">${e}</span>`,n.appendChild(s),requestAnimationFrame(()=>s.classList.remove("translate-x-full")),setTimeout(()=>{s.classList.add("translate-x-full","opacity-0"),setTimeout(()=>s.remove(),300)},3e3)}const me=e=>{switch(e){case"DISBURSED":case"APPROVED":case"AFFORD_OK":case"BUREAU_OK":return"bg-green-100 text-green-800";case"DECLINED":case"AFFORD_FAIL":case"BUREAU_DECLINE":case"ERROR":return"bg-red-100 text-red-800";case"STARTED":case"BUREAU_CHECKING":case"BANK_LINKING":case"OFFER_ACCEPTED":case"CONTRACT_SIGN":case"DEBICHECK_AUTH":return"bg-blue-100 text-blue-800";case"OFFERED":case"BUREAU_REFER":case"AFFORD_REFER":return"bg-yellow-100 text-yellow-800";default:return"bg-gray-100 text-gray-800"}};function G(){if(j)return;const e=`
        <div id="${M}" class="hidden fixed inset-0 bg-black/70 z-[1000] items-center justify-center p-4">
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
        </div>`;document.body.insertAdjacentHTML("beforeend",e),document.getElementById("credit-check-close").addEventListener("click",T),document.getElementById("credit-check-cancel").addEventListener("click",T),document.getElementById("credit-check-submit").addEventListener("click",ge),document.getElementById("credit-check-complete").addEventListener("click",()=>{T();const t=document.getElementById("wizard-content");t&&a.step===2&&W(t)}),document.getElementById("credit-check-download").addEventListener("click",()=>{L&&a.creditCheck.applicationId&&be(L,a.creditCheck.applicationId)}),j=!0}window.openCreditCheckModal=function(){if(!a.targetUser)return;G(),P(),pe();const e=document.getElementById(M);e.classList.remove("hidden"),e.classList.add("flex")};function T(){const e=document.getElementById(M);e&&(e.classList.add("hidden"),e.classList.remove("flex"),P())}function P(){document.getElementById("credit-form-content").classList.remove("hidden"),document.getElementById("credit-loading").classList.add("hidden"),document.getElementById("credit-result").classList.add("hidden");const e=document.getElementById("credit-check-submit");e.disabled=!1,e.innerHTML="Run Credit Check",e.classList.remove("hidden"),document.getElementById("credit-check-cancel").classList.remove("hidden"),document.getElementById("credit-check-complete").classList.add("hidden"),document.getElementById("credit-check-download").classList.add("hidden"),L=null}function pe(){const e=a.targetUser||{},{firstName:t,lastName:n}=xe(e.full_name);if(!document.getElementById("identity_number"))return;document.getElementById("identity_number").value=e.identity_number||e.id_number||"",document.getElementById("surname").value=e.last_name||n||"",document.getElementById("forename").value=e.first_name||t||"",document.getElementById("cell_tel_no").value=e.phone_number||e.contact_number||"";const s=(e.gender||"").toUpperCase();document.getElementById("gender").value=s.startsWith("F")?"F":s.startsWith("M")?"M":"",document.getElementById("date_of_birth").value=ye(e.date_of_birth),document.getElementById("address1").value=e.address_line1||e.address||"",document.getElementById("address2").value=e.suburb_area||e.suburb||e.city||"",document.getElementById("postal_code").value=e.postal_code||e.zip_code||"",document.getElementById("credit_consent").checked=!0}async function ge(){const e=document.getElementById("credit-check-submit"),t=document.getElementById("identity_number").value.trim(),n=document.getElementById("surname").value.trim(),s=document.getElementById("forename").value.trim(),o=document.getElementById("gender").value,d=document.getElementById("date_of_birth").value,l=document.getElementById("address1").value.trim(),i=document.getElementById("address2").value.trim(),r=document.getElementById("postal_code").value.trim(),u=document.getElementById("cell_tel_no").value.trim(),m=document.getElementById("credit_consent").checked;if(!t||!n||!s||!o||!d||!l||!r){b("Please fill in all required fields.","warning");return}if(!m){b("Client consent is required.","warning");return}e.disabled=!0,e.innerHTML="Processing...",document.getElementById("credit-form-content").classList.add("hidden"),document.getElementById("credit-loading").classList.remove("hidden");try{const{data:{session:p}}=await y.auth.getSession();let c=a.creditCheck?.applicationId;if(!c){const{data:v,error:_}=await y.from("loan_applications").insert([{user_id:a.targetUser.id,status:"BUREAU_CHECKING",amount:0,term_months:0,loan_purpose:a.loanConfig?.reason||"Personal Loan",source:"IN_BRANCH",created_by_admin:p.user?.id}]).select().single();if(_)throw _;c=v.id,a.creditCheck.applicationId=c}const g={user_id:a.targetUser.id,identity_number:t,surname:n,forename:s,gender:o,date_of_birth:d.replace(/-/g,""),address1:l,address2:i,postal_code:r,cell_tel_no:u},f=await fe(c,g,p.access_token),x=f.creditScore?.score||0;await y.from("loan_applications").update({bureau_score_band:x,status:"BUREAU_OK"}).eq("id",c),a.creditCheck={applicationId:c,status:"completed",score:x},L=f.zipData||null,document.getElementById("credit-loading").classList.add("hidden"),document.getElementById("credit-result").classList.remove("hidden"),document.getElementById("credit-score-value").textContent=`Score: ${x}`,document.getElementById("credit-check-complete").classList.remove("hidden"),L&&document.getElementById("credit-check-download").classList.remove("hidden"),e.classList.add("hidden")}catch(p){console.error(p),b(p.message,"error"),P()}}async function fe(e,t,n){const s=await fetch("/api/credit-check",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify({applicationId:e,userData:t})}),o=await s.json();if(!s.ok||!o.success)throw await y.from("loan_applications").update({status:"BUREAU_DECLINE"}).eq("id",e),new Error(o.error||"Credit check failed");return o}function be(e,t){try{const n=atob(e),s=new Array(n.length);for(let r=0;r<n.length;r++)s[r]=n.charCodeAt(r);const o=new Uint8Array(s),d=new Blob([o],{type:"application/zip"}),l=window.URL.createObjectURL(d),i=document.createElement("a");i.href=l,i.download=`credit-report-${t}.zip`,document.body.appendChild(i),i.click(),window.URL.revokeObjectURL(l),document.body.removeChild(i)}catch{b("Unable to download the credit report.","error")}}function xe(e=""){const t=e.trim().split(" ").filter(Boolean);if(t.length===0)return{firstName:"",lastName:""};if(t.length===1)return{firstName:t[0],lastName:t[0]};const n=t.pop();return{firstName:t.join(" "),lastName:n}}function ye(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?"":t.toISOString().split("T")[0]}function ve(){const e=document.getElementById("main-content");e&&(e.innerHTML=`
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
                <option value="pending">Needs Review</option>
                ${ue.map(t=>`<option value="${t}">${t}</option>`).join("")}
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
  `,Re(),G())}const q=[{id:1,title:"Client",icon:"fa-user"},{id:2,title:"Bureau",icon:"fa-search-dollar"},{id:3,title:"Financials",icon:"fa-chart-pie"},{id:4,title:"Declarations",icon:"fa-file-contract"},{id:5,title:"Loan",icon:"fa-sliders"},{id:6,title:"Docs",icon:"fa-file-invoice"},{id:7,title:"Confirm",icon:"fa-check-circle"}];async function he(){a.active=!0,a.step=1,a.targetUser=null,a.loanHistoryCount=0,a.creditCheck={applicationId:null,status:"pending",score:null};const e=new Date;e.setDate(e.getDate()+7),a.loanConfig={amount:1e3,period:1,startDate:e,reason:"Personal Loan",maxAllowedPeriod:1,interestRate:.2},document.getElementById("applications-list-view").classList.add("hidden"),document.getElementById("in-branch-view").classList.remove("hidden"),O()}function O(){we(),_e(),A()}function we(){const e=document.getElementById("wizard-stepper-container");e&&(e.innerHTML=q.map((t,n)=>{const s=t.id===a.step,o=t.id<a.step,d=n===q.length-1;let l="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ";return s?l+="border-brand-accent bg-brand-accent text-white shadow-md":o?l+="border-green-500 bg-green-500 text-white":l+="border-gray-300 bg-white text-gray-400",`
            <div class="flex flex-col items-center px-2">
                <div class="${l}">
                    ${o?'<i class="fa-solid fa-check"></i>':`<i class="fa-solid ${t.icon}"></i>`}
                </div>
                <span class="text-xs font-semibold whitespace-nowrap mt-1 ${s?"text-brand-accent":"text-gray-400"}">
                    ${t.title}
                </span>
            </div>
            ${d?"":'<div class="w-8 h-1 mx-1 rounded bg-gray-200"></div>'}
        `}).join(""))}async function _e(){const e=document.getElementById("wizard-content");switch(e.innerHTML='<div class="flex justify-center p-10"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand-accent"></i></div>',a.step){case 1:await R(e);break;case 2:await W(e);break;case 3:await Ee(e);break;case 4:await Ie(e);break;case 5:await Z(e);break;case 6:await J(e);break;case 7:await Q(e);break}}function A(){const e=document.getElementById("wizard-prev-btn"),t=document.getElementById("wizard-next-btn");a.step===1?(e.classList.add("hidden"),t.disabled=!a.targetUser):(e.classList.remove("hidden"),t.disabled=!1),a.step===3||a.step===4?t.classList.add("hidden"):t.classList.remove("hidden"),a.step===7?(t.innerHTML='<i class="fa-solid fa-paper-plane mr-2"></i> Submit Application',t.onclick=ee):(t.innerHTML='Next Step <i class="fa-solid fa-arrow-right ml-2"></i>',t.onclick=C)}async function R(e){const t=["admin","super_admin","base_admin"].includes(F),n=100;e.innerHTML=`
        <div class="max-w-2xl mx-auto bg-white p-8 rounded-lg border border-gray-200 shadow-sm mt-4">
            <div class="flex border-b border-gray-200 mb-6">
                <button id="tab-search" class="flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600">
                    <i class="fa-solid fa-magnifying-glass mr-2"></i>Search Existing
                </button>
                ${t?`
                <button id="tab-create" class="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors">
                    <i class="fa-solid fa-user-plus mr-2"></i>New Walk-in Client
                </button>`:""}
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
            
            ${t?`
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
                            ${Y.filter(m=>m.id!==n).map(m=>`<option value="${m.id}">${m.name}</option>`).join("")}
                        </select>
                        <p class="text-[10px] text-gray-500 mt-2 font-medium">
                            <i class="fa-solid fa-circle-info"></i> Please specify the branch where this walk-in application is taking place.
                        </p>
                    </div>

                    <button id="btn-create-client" class="w-full py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition-all shadow-md mt-2 flex justify-center items-center gap-2">
                        <i class="fa-solid fa-user-plus"></i> Create & Select Client
                    </button>
                </div>
            </div>`:""}
            
            <div id="selected-user-card" class="${a.targetUser?"":"hidden"} mt-6 space-y-4 animate-fade-in">
                <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-xl shadow-sm">
                            ${a.targetUser?.full_name?.charAt(0)||"U"}
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900">${a.targetUser?.full_name||""}</h4>
                            <p class="text-xs text-gray-600 font-mono">ID: ${a.targetUser?.identity_number||"N/A"}</p>
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
    `;const s=document.getElementById("tab-search"),o=document.getElementById("tab-create"),d=document.getElementById("view-search"),l=document.getElementById("view-create"),i=document.getElementById("user-search"),r=document.getElementById("user-results"),u=document.getElementById("search-spinner");if(t&&o&&(s.onclick=()=>{d.classList.remove("hidden"),l.classList.add("hidden"),s.className="flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600",o.className="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors"},o.onclick=()=>{d.classList.add("hidden"),l.classList.remove("hidden"),o.className="flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600",s.className="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors"}),i){let m;i.oninput=p=>{clearTimeout(m);const c=p.target.value.trim();if(c.length<2){r.classList.add("hidden");return}u.classList.remove("hidden"),m=setTimeout(async()=>{const{data:g}=await y.from("profiles").select("*").or(`full_name.ilike.%${c}%,identity_number.ilike.%${c}%`).limit(5);u.classList.add("hidden"),g?.length>0?(r.innerHTML=g.map(f=>`<div class="p-3 hover:bg-orange-50 cursor-pointer border-b last:border-0 user-option" data-id="${f.id}"><div class="font-bold text-gray-800">${f.full_name}</div><div class="text-xs text-gray-500 font-mono">ID: ${f.identity_number||"N/A"}</div></div>`).join(""),r.classList.remove("hidden"),document.querySelectorAll(".user-option").forEach(f=>f.onclick=()=>{a.targetUser=g.find(x=>x.id===f.dataset.id),R(e),A()})):(r.innerHTML='<div class="p-4 text-sm text-gray-500">No clients found.</div>',r.classList.remove("hidden"))},400)}}if(document.getElementById("btn-create-client")?.addEventListener("click",async m=>{const p=document.getElementById("new-fullname").value.trim(),c=document.getElementById("new-idnumber").value.trim(),g=document.getElementById("new-phone").value.trim(),f=document.getElementById("new-email").value.trim(),x=document.getElementById("new-branch-id"),v=x?x.value:null;if(!v)return b("Manual branch selection is required to proceed.","warning");if(!p||!c)return b("Name and ID Number are required.","warning");m.target.disabled=!0,m.target.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Creating...';try{const{data:_,error:h}=await de({fullName:p,idNumber:c,phone:g,email:f||null,branchId:v});if(h)throw h;a.targetUser=_,R(e),A()}catch(_){b(_.message,"error"),m.target.disabled=!1,m.target.innerHTML='<i class="fa-solid fa-user-plus"></i> Create & Select Client'}}),a.targetUser){const m=document.getElementById("user-loan-history-list"),p=document.getElementById("outstanding-balance-warning"),c=document.getElementById("action-new-loan");y.from("loan_applications").select("*").eq("user_id",a.targetUser.id).order("created_at",{ascending:!1}).then(({data:g,error:f})=>{if(f)return;const x=g?.find(v=>!["REPAID","DECLINED","ERROR","DISBURSED"].includes(v.status));x?(p.innerHTML=`<p class="text-[10px] text-red-600 font-bold uppercase flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> Active: ${x.status}</p>`,c.classList.add("opacity-50","bg-gray-50","cursor-not-allowed"),c.onclick=()=>b("Cannot start new. Application active.","warning")):(p.innerHTML='<p class="text-[10px] text-green-600 font-bold uppercase">Ready for new application</p>',c.onclick=()=>C()),!g||g.length===0?m.innerHTML='<p class="text-xs text-gray-400 p-4 text-center italic">No history found.</p>':m.innerHTML=g.map(v=>`<div class="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center text-sm shadow-sm"><div><span class="font-bold text-gray-700">${E(v.amount)}</span><span class="text-[10px] ml-2 text-gray-400 font-mono">${V(v.created_at)}</span><div class="mt-1"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${me(v.status)}">${v.status}</span></div></div>${["REPAID","DECLINED","ERROR","DISBURSED"].includes(v.status)?"":`<button class="resume-app-btn px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-md hover:bg-orange-700 transition" data-id="${v.id}">Resume</button>`}</div>`).join(""),document.querySelectorAll(".resume-app-btn").forEach(v=>{v.onclick=_=>{const h=_.target.dataset.id,w=g.find(I=>I.id==h);a.creditCheck.applicationId=h,a.loanConfig={...a.loanConfig,amount:w.amount,period:w.term_months,reason:w.purpose},b("Resuming Application..."),C()}})})}document.getElementById("clear-user-btn")?.addEventListener("click",()=>{a.targetUser=null,R(e),A()})}async function W(e){if(!a.targetUser)return;const{data:t}=await y.from("credit_checks").select("*").eq("user_id",a.targetUser.id).eq("status","completed").order("checked_at",{ascending:!1}).limit(1),n=t?.[0],s=n?(Date.now()-new Date(n.checked_at))/(1e3*3600*24):999,o=n&&s<=90;let d="",l=!1;if(o){const u=n.credit_score;a.creditScore=u,a.creditCheck={applicationId:n.application_id,status:"completed",score:u},l=!0;let m=u<600?"#EF4444":u<700?"#F59E0B":"#10B981",p=u<600?"Poor":u<700?"Average":"Excellent";const c=new Date(new Date(n.checked_at).getTime()+90*24*60*60*1e3).toLocaleDateString();d=`
            <div class="text-center p-6">
                <div class="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="80" stroke="#f3f4f6" stroke-width="12" fill="none"/>
                        <circle cx="96" cy="96" r="80" stroke="${m}" stroke-width="12" fill="none" 
                            stroke-dasharray="502" 
                            stroke-dashoffset="${502-502*(u/800)}"
                            style="transition: stroke-dashoffset 1s ease-in-out;"/>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-4xl font-extrabold text-gray-900">${u}</span>
                        <span class="text-xs font-bold uppercase tracking-widest" style="color: ${m}">${p}</span>
                    </div>
                </div>
                <h3 class="text-lg font-bold text-gray-800">Bureau Report Verified</h3>
                <p class="text-sm text-gray-500 mt-1">Valid until ${c}</p>
            </div>`}else a.creditCheck={applicationId:null,status:"pending",score:null},d=`
            <div class="text-center py-10">
                <div class="w-20 h-20 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-3xl mx-auto mb-4">
                    <i class="fa-solid fa-user-clock"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-900">New Credit Check Required</h3>
                <p class="text-gray-600 mt-2">No valid bureau report found from the last 3 months.</p>
                <button id="run-check-btn" class="mt-8 bg-brand-accent text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-brand-accent-hover transition">
                    Launch Experian Module
                </button>
            </div>`;e.innerHTML=`<div class="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-xl mt-4">${d}</div>`;const i=document.getElementById("run-check-btn");i&&(i.onclick=()=>window.openCreditCheckModal());const r=document.getElementById("wizard-next-btn");r&&(r.disabled=!l)}async function Ee(e){if(!a.targetUser)return;const{data:t}=await y.from("financial_profiles").select("*").eq("user_id",a.targetUser.id).maybeSingle(),n=t?.parsed_data||{income:{},expenses:{}};e.innerHTML=`
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
                                <input type="number" id="fin_salary" value="${n.income.salary||""}" 
                                    class="w-full pl-8 border-gray-300 rounded-lg focus:ring-brand-accent" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">Other Earnings</label>
                            <div class="relative">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                                <input type="number" id="fin_other" value="${n.income.other_monthly_earnings||""}" 
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
                                <input type="number" id="exp_housing" value="${n.expenses.housing_rent||""}" 
                                    class="w-full border-gray-300 rounded-lg text-sm" placeholder="0">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1">School Fees</label>
                                <input type="number" id="exp_school" value="${n.expenses.school||""}" 
                                    class="w-full border-gray-300 rounded-lg text-sm" placeholder="0">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1">Transport</label>
                                <input type="number" id="exp_transport" value="${n.expenses.petrol||""}" 
                                    class="w-full border-gray-300 rounded-lg text-sm" placeholder="0">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1">Groceries</label>
                                <input type="number" id="exp_food" value="${n.expenses.groceries||""}" 
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
        </div>`;const s=()=>{const o=parseFloat(document.getElementById("fin_salary").value)||0,d=parseFloat(document.getElementById("fin_other").value)||0,l=o+d,i=parseFloat(document.getElementById("exp_housing").value)||0,r=parseFloat(document.getElementById("exp_school").value)||0,u=parseFloat(document.getElementById("exp_transport").value)||0,m=parseFloat(document.getElementById("exp_food").value)||0,p=i+r+u+m,c=Math.max(0,l-p);return document.getElementById("disp-income").textContent=E(c),{totalIncome:l,totalExpenses:p,surplus:c}};document.querySelectorAll("#financials-form input").forEach(o=>{o.addEventListener("input",s)}),s(),document.getElementById("financials-form").onsubmit=async o=>{o.preventDefault();const{totalIncome:d,totalExpenses:l,surplus:i}=s();if(d<=0)return b("Please enter a valid salary.","warning");const r={user_id:a.targetUser.id,monthly_income:d,monthly_expenses:l,affordability_ratio:i,parsed_data:{income:{salary:document.getElementById("fin_salary").value,other_monthly_earnings:document.getElementById("fin_other").value},expenses:{housing_rent:document.getElementById("exp_housing").value,school:document.getElementById("exp_school").value,petrol:document.getElementById("exp_transport").value,groceries:document.getElementById("exp_food").value}}},{error:u}=await y.from("financial_profiles").upsert(r,{onConflict:"user_id"});u?b(u.message,"error"):(a.affordabilityLimit=i,b("Financial Profile Updated","success"),C())}}async function Ie(e){if(!a.targetUser)return;const{data:t}=await y.from("declarations").select("*").eq("user_id",a.targetUser.id).maybeSingle();e.innerHTML=`
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
        </div>`;const n=()=>{const s=document.getElementById("decl_referral_provided").checked,o=document.getElementById("referral-fields");s?o.classList.remove("hidden"):o.classList.add("hidden")};document.getElementById("decl_referral_provided").addEventListener("change",n),t&&(document.getElementById("decl_marital").value=t.marital_status||"single",document.getElementById("decl_home").value=t.home_ownership||"rent",document.getElementById("decl_qual").value=t.highest_qualification||"matric",document.getElementById("decl_disadvantaged").checked=!!t.historically_disadvantaged,t.referral_provided&&(document.getElementById("decl_referral_provided").checked=!0,n(),document.getElementById("decl_ref_name").value=t.referral_name||"",document.getElementById("decl_ref_phone").value=t.referral_phone||"")),document.getElementById("save-declarations").onclick=async()=>{const s=document.getElementById("decl_terms").checked,o=document.getElementById("decl_truth").checked;if(!s||!o)return b("Statutory declarations must be confirmed.","warning");const d=document.getElementById("decl_referral_provided").checked,l={user_id:a.targetUser.id,marital_status:document.getElementById("decl_marital").value,home_ownership:document.getElementById("decl_home").value,highest_qualification:document.getElementById("decl_qual").value,historically_disadvantaged:document.getElementById("decl_disadvantaged").checked,referral_provided:d,referral_name:d?document.getElementById("decl_ref_name").value:null,referral_phone:d?document.getElementById("decl_ref_phone").value:null,accepted_std_conditions:!0,metadata:{marital_status:document.getElementById("decl_marital").value,home_ownership:document.getElementById("decl_home").value}},{error:i}=await y.from("declarations").upsert(l,{onConflict:"user_id"});i?b(i.message,"error"):(b("Declarations Verified","success"),C())}}function ke(e){return[`${e}-01-01`,`${e}-03-21`,`${e}-04-18`,`${e}-04-21`,`${e}-04-27`,`${e}-04-28`,`${e}-05-01`,`${e}-06-16`,`${e}-08-09`,`${e}-09-24`,`${e}-12-16`,`${e}-12-25`,`${e}-12-26`]}function z(e){if(!e)return{valid:!0};const t=new Date(e),n=t.getUTCDay(),s=t.getUTCFullYear(),o=t.toISOString().split("T")[0],d=ke(s);return n===0||n===6?{valid:!1,reason:"Repayments cannot be scheduled on weekends."}:d.includes(o)?{valid:!1,reason:"The selected date is a South African Public Holiday."}:{valid:!0}}function H(e,t,n,s=0,o=!1){const p=o||s===0;let c=0;if(n){const S=new Date,te=new Date(n),ae=Math.max(1,Math.ceil((te-S)/(1e3*60*60*24))),ne=Math.min(ae,30);c=69/30*ne+(t>1?69*(t-1):0)}else c=69*t;const g=e*.05*t,f=p?0:e*.15,x=e*.0045*t,v=e*.0045,_=(f+c)*.15,h=g+f+c+x+_,w=e+h,I=w/t;return{principal:e,period:t,totalInterest:g,totalInitiationFees:f,totalServiceFees:c,totalCreditLife:x,monthlyCreditLife:v,vatAmount:_,totalCostOfCredit:h,totalRepayment:w,monthlyPayment:I,interestRateMonthly:.05,initiationRate:p?0:.15,waiveInitiation:p,totalMonthlyFees:c,totalRate:.05+(p?0:.15),interestPortion:.05}}async function Z(e){if(a.targetUser&&a.loanHistoryCount===void 0){const{data:h}=await y.from("loan_applications").select("id, created_at").eq("user_id",a.targetUser.id).in("status",["DISBURSED","OFFER_ACCEPTED","READY_TO_DISBURSE","ACTIVE","CONTRACT_SIGN","DEBICHECK_AUTH"]);a.loanHistoryCount=h?.length||0;const w=new Date().getFullYear();a.isFirstLoanOfYear=!h?.some(S=>new Date(S.created_at).getFullYear()===w);const{data:I}=await y.from("financial_profiles").select("affordability_ratio").eq("user_id",a.targetUser.id).single();a.affordabilityLimit=I?.affordability_ratio||0}const t=a.loanHistoryCount||0,n=a.affordabilityLimit||0,s=a.isFirstLoanOfYear??!0;t===0||t<3?a.loanConfig.maxAllowedPeriod=1:t>=3&&(a.loanConfig.maxAllowedPeriod=6);const{amount:o,period:d,reason:l,startDate:i}=a.loanConfig,r=H(o,d,i,t,s),u=.05,m=.0045,p=r.waiveInitiation?0:.15,c=.15;let g=1e4;if(n>0){const h=1+u*d+m*d+p*(1+c)+69*d*(1+c)/Math.max(o,1);g=n*d/h}g=Math.floor(g/100)*100;const f=n>0&&r.monthlyPayment>n,x=z(document.getElementById("loan-start-date")?.value||i);e.innerHTML=`
        <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-800">Configure Loan</h3>
                    <div class="text-right">
                        <span class="block text-[10px] uppercase text-gray-400 font-bold tracking-tight">Max for ${d} Month${d>1?"s":""}</span>
                        <span class="text-sm font-black text-brand-accent">R ${g.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Amount (ZAR)</label>
                    <input type="number" id="loan-amount" value="${o}" min="100" class="w-full border-gray-300 rounded-md focus:ring-brand-accent ${f?"border-red-500 ring-1 ring-red-500":""}">
                    ${f?`
                    <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-start gap-2">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5"></i> 
                        <span><strong>Limit Exceeded:</strong> Max monthly payment is ${E(n)}. This loan requires ${E(r.monthlyPayment)}.</span>
                    </div>`:""}
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period (Months)</label>
                    <select id="loan-period" class="w-full border-gray-300 rounded-md focus:ring-brand-accent">
                        <option value="1" ${d==1?"selected":""}>1 Month</option>
                        ${a.loanConfig.maxAllowedPeriod>1?`
                            <option value="3" ${d==3?"selected":""}>3 Months</option>
                            <option value="6" ${d==6?"selected":""}>6 Months</option>
                            <option value="12" ${d==12?"selected":""}>12 Months</option>
                        `:""}
                    </select>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">First Repayment Date</label>
                    <input type="date" id="loan-start-date" class="w-full border-gray-300 rounded-md focus:ring-brand-accent"
                        value="${i?i instanceof Date?i.toISOString().split("T")[0]:i.split("T")[0]:""}">
                    <div id="date-error-msg" class="${x?.valid===!1?"":"hidden"} text-xs text-red-600 mt-1 font-semibold flex items-center gap-1">
                        <i class="fa-solid fa-circle-exclamation"></i> <span id="error-text">${x?.reason||""}</span>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Purpose of Loan</label>
                    <select id="loan-reason" class="w-full border-gray-300 rounded-md focus:ring-brand-accent">
                        <option value="Personal Loan"        ${(l||"Personal Loan")==="Personal Loan"?"selected":""}>Personal Loan</option>
                        <option value="Medical Expenses"     ${l==="Medical Expenses"?"selected":""}>Medical Expenses</option>
                        <option value="Education"            ${l==="Education"?"selected":""}>Education / School Fees</option>
                        <option value="Home Improvement"     ${l==="Home Improvement"?"selected":""}>Home Improvement</option>
                        <option value="Debt Consolidation"   ${l==="Debt Consolidation"?"selected":""}>Debt Consolidation</option>
                        <option value="Funeral"              ${l==="Funeral"?"selected":""}>Funeral Costs</option>
                        <option value="Vehicle"              ${l==="Vehicle"?"selected":""}>Vehicle / Transport</option>
                        <option value="Business"             ${l==="Business"?"selected":""}>Business / Working Capital</option>
                        <option value="Emergency"            ${l==="Emergency"?"selected":""}>Emergency</option>
                        <option value="Other"                ${l==="Other"?"selected":""}>Other</option>
                    </select>
                </div>
            </div>
            
            <div class="bg-gray-800 text-white p-6 rounded-lg shadow-md flex flex-col justify-between">
                <div>
                    <h4 class="text-gray-400 text-sm uppercase tracking-wider mb-2">Quote Summary</h4>
                    <div class="flex justify-between items-end border-b border-gray-700 pb-4 mb-4">
                        <span class="text-3xl font-bold text-white">${E(o)}</span>
                        <span class="text-gray-400 mb-1">Principal</span>
                    </div>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400">Total Annual Rate</span> 
                            <span class="text-lg font-bold text-orange-400">${(r.totalRate*100).toFixed(0)}%</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pl-4 py-2 bg-gray-900/50 rounded border-l-2 border-orange-500/50">
                            <div>
                                <span class="block text-[10px] uppercase text-gray-500 font-bold">Interest</span>
                                <span class="text-white font-medium">${(r.interestPortion*100).toFixed(1)}%</span>
                            </div>
                            <div>
                                <span class="block text-[10px] uppercase text-gray-500 font-bold">Initiation</span>
                                <span class="text-white font-medium">${(r.initiationRate*100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <span class="text-gray-400">Duration</span> 
                            <span>${d} Month${d>1?"s":""}</span>
                        </div>
                        <div class="flex justify-between border-t border-gray-600 pt-2">
                            <span class="text-gray-300 font-semibold">Total Interest</span> 
                            <span class="font-bold">${E(r.totalInterest)}</span>
                        </div>
                    </div>
                </div>
                <div class="mt-6 pt-4 border-t border-gray-700">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400 font-medium">Total Repayment</span>
                        <span class="text-xl font-bold text-green-400">${E(r.totalRepayment)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-xs text-gray-500">Monthly Installment</span>
                        <span class="text-sm ${f?"text-red-400 font-bold":"text-gray-300"}">${E(r.monthlyPayment)}</span>
                    </div>
                </div>
            </div>
        </div>`;const v=document.getElementById("wizard-next-btn");v&&(v.disabled=!1,v.onclick=()=>{const h=document.getElementById("loan-start-date").value,w=z(h);if(!h)return b("Please select a first repayment date.","warning");if(!w.valid)return b(`Invalid Date: ${w.reason}`,"error");if(f)return b(`Loan Unaffordable: Max allowed is R ${g.toLocaleString()}`,"error");if(o<100)return b("Minimum loan amount is R 100.00","warning");C()});const _=h=>{const w=h.target.id,I=h.target.value;w==="loan-amount"&&(a.loanConfig.amount=Number(I)),w==="loan-period"&&(a.loanConfig.period=Number(I)),w==="loan-start-date"&&(a.loanConfig.startDate=I),w==="loan-reason"&&(a.loanConfig.reason=I),Z(e)};["loan-amount","loan-period","loan-start-date","loan-reason"].forEach(h=>{const w=document.getElementById(h);w&&w.addEventListener("change",_)})}async function J(e){if(!a.targetUser)return;const{data:{session:t}}=await y.auth.getSession(),n=t?.user?.id;if(!n){b("Error: Could not identify Admin user","error");return}let s=a.creditCheck?.applicationId;if(!s)try{const{data:l,error:i}=await y.from("loan_applications").insert([{user_id:a.targetUser.id,status:"STARTED",amount:a.loanConfig.amount||0,term_months:a.loanConfig.period||1,loan_purpose:a.loanConfig?.reason||"Personal Loan",source:"IN_BRANCH",created_by_admin:n}]).select().single();if(i)throw i;s=l.id,a.creditCheck.applicationId=s}catch(l){console.error(l)}e.innerHTML=`
        <div class="max-w-2xl mx-auto bg-white p-6 rounded-lg border border-gray-200 mt-4">
            <h3 class="text-lg font-bold text-gray-800 mb-6">Required Documents</h3>
            <div class="space-y-4" id="docs-list"><div class="p-4 text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div></div>
        </div>`;const o=[{key:"idcard",label:"ID Document"},{key:"till_slip",label:"Latest Payslip"},{key:"bank_statement",label:"Bank Statement"}],d=await Promise.all(o.map(async l=>{const{data:i}=await y.from("document_uploads").select("*").eq("user_id",a.targetUser.id).eq("file_type",l.key).order("created_at",{ascending:!1}).limit(1),r=i?.[0],u=!!r,m=u?"text-green-600 bg-green-100":"text-gray-500 bg-gray-200",p=u?"fa-check-circle":"fa-upload";let c="";return r?.file_path&&(c=`<button class="text-xs text-blue-600 underline self-center mr-2 view-doc-btn" data-path="${r.file_path}">View</button>`),`
            <div class="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${m}"><i class="fa-solid ${p}"></i></div>
                    <div><p class="font-medium text-gray-900">${l.label}</p><p class="text-xs text-gray-500">${u?"Uploaded":"Missing"}</p></div>
                </div>
                <div class="flex gap-2">${c}
                    <label class="cursor-pointer bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50">
                        ${u?"Replace":"Upload"}
                        <input type="file" class="hidden doc-upload" data-type="${l.key}" accept=".pdf,.jpg,.png,.jpeg">
                    </label>
                </div>
            </div>`}));document.getElementById("docs-list").innerHTML=d.join(""),document.querySelectorAll(".view-doc-btn").forEach(l=>{l.addEventListener("click",async i=>{try{const{data:r,error:u}=await y.storage.from("client_docs").createSignedUrl(i.target.dataset.path,60);if(u)throw u;window.open(r.signedUrl,"_blank")}catch(r){b(r.message,"error")}})}),document.querySelectorAll(".doc-upload").forEach(l=>{l.addEventListener("change",async i=>{const r=i.target.files[0];if(!r)return;const u=i.target.dataset.type,m=i.target.parentElement;m.childNodes[0].textContent="Uploading...";try{const p=r.name.split(".").pop(),c=`${u}_${Date.now()}.${p}`,g=`${n}/${a.targetUser.id}_${c}`,{error:f}=await y.storage.from("client_docs").upload(g,r,{upsert:!0});if(f)throw new Error("Storage: "+f.message);const{error:x}=await y.rpc("register_admin_upload",{p_user_id:a.targetUser.id,p_app_id:s,p_file_name:c,p_original_name:r.name,p_file_path:g,p_file_type:u,p_mime_type:r.type,p_file_size:r.size});if(x)throw new Error("Database: "+x.message);b("Uploaded!","success"),await J(e)}catch(p){console.error(p),b(p.message,"error")}finally{m.childNodes[0].textContent="Upload"}})})}async function Q(e){if(!a.targetUser)return;const{amount:t,period:n,startDate:s}=a.loanConfig,o=a.loanHistoryCount||0,d=H(t,n,s,o),l=a.targetUser.full_name,{data:i}=await y.from("bank_accounts").select("*").eq("user_id",a.targetUser.id),r=s?new Date(s).toLocaleDateString("en-ZA",{day:"numeric",month:"long",year:"numeric"}):"Not set";e.innerHTML=`
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
                                ${i?.map(g=>`<option value="${g.id}">${g.bank_name} - ****${g.account_number.slice(-4)}</option>`).join("")}
                            </select>
                        </div>

                        <div id="new-bank-form" class="hidden p-6 bg-gray-900 rounded-2xl border border-gray-700 space-y-4 animate-fade-in">
                            <div class="grid grid-cols-2 gap-4">
                                <input type="text" id="new-bank-name" placeholder="Bank Name" class="bg-gray-800 text-white rounded-lg py-2 px-3">
                                <select id="new-acc-type" class="bg-gray-800 text-white rounded-lg py-2 px-3">
                                    <option value="savings">Savings</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <input type="text" id="new-acc-number" inputmode="numeric" placeholder="Account Number" class="bg-gray-800 text-white rounded-lg py-2 px-3">
                                <input type="text" id="new-branch-code" inputmode="numeric" placeholder="Branch Code" class="bg-gray-800 text-white rounded-lg py-2 px-3">
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
                        <span class="text-xs text-gray-700 leading-tight">I confirm I have physically verified the identity of <strong>${l}</strong> and confirmed the banking details.</span>
                    </label>
                </div>
            </div>

            <div class="md:col-span-2">
                <div class="bg-gray-800 text-white rounded-2xl shadow-xl overflow-hidden sticky top-4 border border-gray-700">
                    <div class="p-4 bg-gray-900/50 border-b border-gray-700 text-center"><h4 class="text-[10px] font-bold uppercase text-brand-accent">Loan Offer Summary</h4></div>
                    <div class="p-8">
                        <div class="flex justify-between items-end border-b border-gray-700 pb-6 mb-6">
                            <span class="text-4xl font-black text-white">${E(t)}</span>
                            <span class="text-gray-400 text-xs font-bold mb-1 uppercase">Principal</span>
                        </div>
                        <div class="space-y-4 text-sm">
                            <div class="flex justify-between items-center"><span class="text-gray-400">Monthly Payout</span><span class="text-2xl font-black text-brand-accent">${E(d.monthlyPayment)}</span></div>
                            <div class="flex justify-between items-center"><span class="text-gray-400">Total Repayable</span><span class="font-bold text-green-400 text-lg">${E(d.totalRepayment)}</span></div>
                            <div class="flex justify-between pt-2 border-t border-gray-700"><span class="text-gray-400">Term Duration</span><span class="font-medium">${n} Month${n>1?"s":""}</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">First Debit Date</span><span class="font-bold text-orange-300">${r}</span></div>
                        </div>
                    </div>
                    <div class="p-6 bg-gray-900/80 border-t border-gray-700">
                        <button id="wizard-next-btn" class="w-full bg-brand-accent hover:bg-orange-600 text-white py-4 rounded-xl font-black text-lg shadow-2xl transition-all disabled:opacity-50">SUBMIT APPLICATION</button>
                        <p class="text-[9px] text-gray-500 mt-4 italic text-center uppercase tracking-tighter">
                            ${a.creditCheck.applicationId?`Managing Application #${a.creditCheck.applicationId}`:"New Loan Application"}
                        </p>
                    </div>
                </div>
            </div>
        </div>`;const u=document.getElementById("bank-select"),m=document.getElementById("new-bank-form"),p=document.getElementById("bank-preview-container"),c=()=>{const g=u.value,f=!m.classList.contains("hidden");if(!g&&!f){p.classList.add("hidden");return}if(p.classList.remove("hidden"),f)document.getElementById("preview-bank-name").innerText=document.getElementById("new-bank-name").value||"...",document.getElementById("preview-acc-number").innerText=document.getElementById("new-acc-number").value||"...";else{const x=i.find(v=>v.id==g);x&&(document.getElementById("preview-bank-name").innerText=x.bank_name,document.getElementById("preview-acc-number").innerText=x.account_number)}};document.getElementById("toggle-new-bank").onclick=()=>{m.classList.toggle("hidden"),u.value="",c()},u.onchange=()=>{m.classList.add("hidden"),c()},["new-bank-name","new-acc-number"].forEach(g=>document.getElementById(g).oninput=c),document.getElementById("admin-consent").onchange=g=>{document.getElementById("wizard-next-btn").disabled=!g.target.checked},document.getElementById("wizard-next-btn").onclick=ee,document.getElementById("btn-save-bank").onclick=async()=>{const g={user_id:a.targetUser.id,bank_name:document.getElementById("new-bank-name").value,account_holder:l,account_number:document.getElementById("new-acc-number").value,branch_code:document.getElementById("new-branch-code").value,account_type:document.getElementById("new-acc-type").value,is_verified:!0,created_by_admin:(await y.auth.getUser()).data.user.id},{data:f,error:x}=await y.from("bank_accounts").insert([g]).select().single();x||(await Q(e),document.getElementById("bank-select").value=f.id,c())}}function C(){a.step<7&&(a.step++,O())}document.addEventListener("click",e=>{e.target.id==="wizard-prev-btn"&&a.step>1&&(a.step--,O());const t=e.target.closest("#back-to-list-btn");t&&(t.dataset.confirming?(document.getElementById("in-branch-view").classList.add("hidden"),document.getElementById("applications-list-view").classList.remove("hidden"),t.dataset.confirming="",t.innerHTML='<i class="fa-solid fa-arrow-left"></i> Cancel',t.classList.remove("text-red-600","font-bold")):(t.dataset.confirming="true",t.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> Click again to Confirm',t.classList.add("text-red-600","font-bold"),b("Unsaved progress will be lost. Click again to exit.","warning"),setTimeout(()=>{t.dataset.confirming="",t.innerHTML='<i class="fa-solid fa-arrow-left"></i> Cancel',t.classList.remove("text-red-600","font-bold")},3e3))),(e.target.id==="sign-out-btn"||e.target.closest("#sign-out-btn"))&&(e.preventDefault(),y.auth.signOut().then(()=>{localStorage.clear(),sessionStorage.clear(),window.location.href="/"}))});async function Be(){const e=document.getElementById("sync-offered-btn");if(e&&confirm("Sync all OFFERED applications?")){e.disabled=!0,e.innerHTML="Syncing...";try{await le(),b("Synced!","success"),await X()}catch(t){b(t.message,"error")}finally{e.disabled=!1,e.innerHTML="Sync Offered"}}}const Ce=e=>{const t=document.getElementById("applications-table-body"),n=document.getElementById("visible-count");if(t){if(n&&(n.textContent=e.length),e.length===0){t.innerHTML='<tr><td colspan="5" class="p-10 text-center text-sm text-gray-400">No applications match your criteria.</td></tr>';return}t.innerHTML=e.map(s=>{const o=s.profiles||{},d=o.client_number?String(o.client_number):"",l=s.loan_number?`L${String(s.loan_number).padStart(4,"0")}`:"",i=d&&l?`${d}-${l}`:l||s.id.slice(0,8),r=K(s.status),u=["IN_ARREARS","IN_DEFAULT"].includes(s.status),m=s.loan_purpose||s.purpose||"";return`
        <tr class="hover:bg-surface-container-low transition-colors group border-b border-outline-variant/10 ${u?"bg-red-50":""}">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border border-outline-variant/20 bg-surface-container text-outline flex-shrink-0">
                        ${(o.full_name||"A").charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-on-surface">${o.full_name||"N/A"}</div>
                        <div class="text-[10px] font-mono text-outline tracking-wide">${i}</div>
                        ${m?`<div class="text-[10px] text-gray-400 mt-0.5">${m}</div>`:""}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-mono font-semibold text-on-surface">${E(s.amount)}</div>
                <div class="text-[10px] text-outline">${s.term_months?s.term_months+" mo":""}</div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-full text-[11px] font-bold" style="background:${r.bg};color:${r.color};">
                    ${r.label}
                </span>
                ${u?'<div class="text-[10px] text-red-600 font-bold mt-1">⚠ 3% default applies</div>':""}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs text-outline font-medium">${V(s.created_at)}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <a href="/admin/application-detail?id=${s.id}"
                   class="text-outline hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-container-low inline-block">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                </a>
            </td>
        </tr>`}).join("")}},Le=e=>{const t=document.getElementById("search-suggestions");if(t){if(e.length===0){t.innerHTML="",t.classList.add("hidden");return}t.innerHTML=e.map(n=>`
        <a href="/admin/application-detail?id=${n.id}" class="block p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-200 last:border-b-0">
            <p class="font-semibold text-gray-800">${n.profiles?.full_name||"N/A"}</p>
            <p class="text-xs text-gray-500">ID: ${n.id} | Status: ${n.status}</p>
        </a>
    `).join(""),t.classList.remove("hidden")}},$=(e=!0)=>{e&&(k=1);const t=document.getElementById("search-input")?.value.toLowerCase().trim()||"",n=document.getElementById("status-filter")?.value||"all",s=new Set(["STARTED","BUREAU_CHECKING","BUREAU_OK","BUREAU_REFER","BANK_LINKING","AFFORD_OK","AFFORD_REFER","AFFORD_FAIL","OFFERED","OFFER_ACCEPTED","CONTRACT_SIGN","DEBICHECK_AUTH","APPROVED"]);B=N.filter(r=>{const u=n==="all"?!0:n==="pending"?s.has(r.status):r.status===n,m=!t||(r.profiles?.full_name||"").toLowerCase().includes(t)||String(r.id).toLowerCase().includes(t)||String(r.amount).includes(t);let p=!1;return F==="super_admin"?p=!0:p=r.branch_id===U?.branch_id,u&&m&&p});const o=Math.ceil(B.length/D)||1,d=(k-1)*D,l=B.slice(d,d+D);Ce(l),$e(o,B.length);const i=document.getElementById("search-input");document.activeElement===i&&t.length>1?Le(B.slice(0,5)):document.getElementById("search-suggestions")?.classList.add("hidden")};async function X(){const{data:e,error:t}=await oe();t?console.error(t):(N=e,$())}function Ae(){const e=B.length?B:N;if(!e.length){alert("No data to export.");return}const t=["Reference","Client Name","ID Number","Loan Amount","Term (months)","Status","Purpose","Date Applied","Next of Kin","NOK Phone"],n=e.map(i=>{const r=i.profiles||{},u=r.client_number||"",m=i.loan_number?`L${String(i.loan_number).padStart(4,"0")}`:i.id.slice(0,8),p=u?`${u}-${m}`:m,c=K(i.status).label;return[`"${p}"`,`"${(r.full_name||"").replace(/"/g,'""')}"`,r.identity_number||"",i.amount||0,i.term_months||"",`"${c}"`,`"${(i.loan_purpose||i.purpose||"").replace(/"/g,'""')}"`,i.created_at?.slice(0,10)||"",`"${(r.nok_name||"").replace(/"/g,'""')}"`,r.nok_phone||""].join(",")}),s=[t.join(","),...n].join(`
`),o=new Blob([s],{type:"text/csv;charset=utf-8;"}),d=URL.createObjectURL(o),l=document.createElement("a");l.href=d,l.download=`applications_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(l),l.click(),document.body.removeChild(l),URL.revokeObjectURL(d)}function Re(){document.getElementById("search-input")?.addEventListener("input",()=>$(!0)),document.getElementById("status-filter")?.addEventListener("change",()=>$(!0)),document.getElementById("create-app-btn")?.addEventListener("click",he),document.getElementById("btn-export-applications")?.addEventListener("click",Ae),document.getElementById("sync-offered-btn")?.addEventListener("click",Be),document.addEventListener("click",e=>{const t=document.getElementById("search-suggestions");t&&!document.getElementById("search-input").contains(e.target)&&!t.contains(e.target)&&t.classList.add("hidden")})}document.addEventListener("DOMContentLoaded",async()=>{const e=await se();if(e){F=e.role;const[t,n]=await Promise.all([ie(),re()]);U=t,Y=n.data||[],ve();const s=new URLSearchParams(window.location.search).get("filter");if(s){const o=document.getElementById("status-filter");o&&(o.value=s)}await X()}});async function ee(){const e=document.getElementById("wizard-next-btn");if(e){e.disabled=!0,e.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Processing...';try{const{amount:t,period:n,startDate:s,reason:o}=a.loanConfig,d=a.loanHistoryCount||0,l=a.isFirstLoanOfYear??!0,i=H(t,n,s,d,l);let r=document.getElementById("bank-select").value;if(r==="new"){const p={user_id:a.targetUser.id,bank_name:document.getElementById("new-bank-name").value,account_holder:a.targetUser.full_name,account_number:document.getElementById("new-account-number").value,branch_code:document.getElementById("new-branch-code").value,account_type:document.getElementById("new-account-type").value.toLowerCase(),is_verified:!0,created_by_admin:(await y.auth.getUser()).data.user.id},{data:c,error:g}=await y.from("bank_accounts").insert([p]).select().single();if(g)throw new Error("Bank Save Failed: "+g.message);r=c.id}if(!r)throw new Error("Please select or add a bank account.");const u={status:"AFFORD_OK",amount:t,term_months:n,bank_account_id:r,updated_at:new Date().toISOString(),offer_principal:t,offer_interest_rate:i.interestRateMonthly,offer_total_interest:i.totalInterest,offer_total_initiation_fees:i.totalInitiationFees,offer_monthly_repayment:i.monthlyPayment,offer_total_repayment:i.totalRepayment,offer_total_admin_fees:i.totalServiceFees,offer_credit_life_monthly:i.monthlyCreditLife,offer_credit_life_total:i.totalCreditLife,repayment_start_date:s,loan_purpose:o||"Personal Loan",branch_id:a.targetUser?.branch_id||U?.branch_id,offer_details:{first_repayment_date:s,interest_rate_monthly:i.interestRateMonthly,initiation_rate:i.initiationRate,credit_life_rate:.0045,vat_amount:i.vatAmount,total_cost_of_credit:i.totalCostOfCredit,waive_initiation:i.waiveInitiation,source:"In-Branch Admin Terminal"},notes:`In-branch application for ${a.targetUser.full_name}. Purpose: ${o||"Personal Loan"}. Verified by Admin.`},{error:m}=await y.from("loan_applications").update(u).eq("id",a.creditCheck.applicationId);if(m)throw m;b("Application Submitted Successfully!","success"),setTimeout(()=>window.location.reload(),1500)}catch(t){console.error("Submission Error:",t),b(t.message,"error"),e.disabled=!1,e.innerHTML="Submit Application"}}}function $e(e,t){let n=document.getElementById("app-pagination-container");const s=document.getElementById("applications-list-view"),o=document.getElementById("visible-count");if(o&&(o.textContent=t),n||(n=document.createElement("div"),n.id="app-pagination-container",n.className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50",s.appendChild(n)),e<=1){n.innerHTML='<span class="text-xs text-gray-400">Showing all records</span>';return}n.innerHTML=`
        <span class="text-xs font-bold text-gray-500 uppercase tracking-tight">Page ${k} of ${e}</span>
        <div class="flex gap-2">
            <button onclick="window.changePageApps(${k-1})" ${k===1?"disabled":""} 
                class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
                Prev
            </button>
            <button onclick="window.changePageApps(${k+1})" ${k===e?"disabled":""} 
                class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
                Next
            </button>
        </div>
    `}window.changePageApps=e=>{k=e,$(!1)};
