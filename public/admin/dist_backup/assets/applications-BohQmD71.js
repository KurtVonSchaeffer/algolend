import{s as y}from"./supabaseClient-Ki9k9WNi.js";import{i as X}from"./layout-P4Epjfxm.js";/* empty css               */import{o as ee,p as te,q as ae,s as ne,r as se}from"./dataService-OY041MzK.js";import{a as v,b as O}from"./utils-D6Z1B7Jq.js";const re=["STARTED","BUREAU_CHECKING","BUREAU_OK","BUREAU_REFER","BUREAU_DECLINE","BANK_LINKING","AFFORD_OK","AFFORD_REFER","AFFORD_FAIL","OFFERED","OFFER_ACCEPTED","CONTRACT_SIGN","DEBICHECK_AUTH","READY_TO_DISBURSE","DISBURSED","DECLINED","ERROR"];let j=[],S="borrower",R=null,q=[],_=1;const $=20;let a={active:!1,step:1,targetUser:null,loanHistoryCount:0,loanConfig:{amount:1e3,period:1,startDate:null,reason:"Personal Loan",maxAllowedPeriod:1,interestRate:.2},documents:{idcard:"pending",till_slip:"pending",bank_statement:"pending"},creditCheck:{applicationId:null,status:"pending",score:null}};const T="admin-credit-check-modal";let F=!1,B=null;function x(e,t="success"){let n=document.getElementById("toast-container");n||(n=document.createElement("div"),n.id="toast-container",n.className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none",document.body.appendChild(n));const s=document.createElement("div");let r="bg-gray-900 text-white",c='<i class="fa-solid fa-circle-check"></i>';t==="error"?(r="bg-red-600 text-white",c='<i class="fa-solid fa-circle-xmark"></i>'):t==="warning"&&(r="bg-orange-500 text-white",c='<i class="fa-solid fa-triangle-exclamation"></i>'),s.className=`${r} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full pointer-events-auto`,s.innerHTML=`${c}<span class="text-sm font-medium">${e}</span>`,n.appendChild(s),requestAnimationFrame(()=>s.classList.remove("translate-x-full")),setTimeout(()=>{s.classList.add("translate-x-full","opacity-0"),setTimeout(()=>s.remove(),300)},3e3)}const z=e=>{switch(e){case"DISBURSED":case"READY_TO_DISBURSE":case"AFFORD_OK":case"BUREAU_OK":return"bg-green-100 text-green-800";case"DECLINED":case"AFFORD_FAIL":case"BUREAU_DECLINE":case"ERROR":return"bg-red-100 text-red-800";case"STARTED":case"BUREAU_CHECKING":case"BANK_LINKING":case"OFFER_ACCEPTED":case"CONTRACT_SIGN":case"DEBICHECK_AUTH":return"bg-blue-100 text-blue-800";case"OFFERED":case"BUREAU_REFER":case"AFFORD_REFER":return"bg-yellow-100 text-yellow-800";default:return"bg-gray-100 text-gray-800"}};function K(){if(F)return;const e=`
        <div id="${T}" class="hidden fixed inset-0 bg-black/70 z-[1000] items-center justify-center p-4">
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
        </div>`;document.body.insertAdjacentHTML("beforeend",e),document.getElementById("credit-check-close").addEventListener("click",D),document.getElementById("credit-check-cancel").addEventListener("click",D),document.getElementById("credit-check-submit").addEventListener("click",oe),document.getElementById("credit-check-complete").addEventListener("click",()=>{D();const t=document.getElementById("wizard-content");t&&a.step===2&&W(t)}),document.getElementById("credit-check-download").addEventListener("click",()=>{B&&a.creditCheck.applicationId&&le(B,a.creditCheck.applicationId)}),F=!0}window.openCreditCheckModal=function(){if(!a.targetUser)return;K(),N(),ie();const e=document.getElementById(T);e.classList.remove("hidden"),e.classList.add("flex")};function D(){const e=document.getElementById(T);e&&(e.classList.add("hidden"),e.classList.remove("flex"),N())}function N(){document.getElementById("credit-form-content").classList.remove("hidden"),document.getElementById("credit-loading").classList.add("hidden"),document.getElementById("credit-result").classList.add("hidden");const e=document.getElementById("credit-check-submit");e.disabled=!1,e.innerHTML="Run Credit Check",e.classList.remove("hidden"),document.getElementById("credit-check-cancel").classList.remove("hidden"),document.getElementById("credit-check-complete").classList.add("hidden"),document.getElementById("credit-check-download").classList.add("hidden"),B=null}function ie(){const e=a.targetUser||{},{firstName:t,lastName:n}=ce(e.full_name);if(!document.getElementById("identity_number"))return;document.getElementById("identity_number").value=e.identity_number||e.id_number||"",document.getElementById("surname").value=e.last_name||n||"",document.getElementById("forename").value=e.first_name||t||"",document.getElementById("cell_tel_no").value=e.phone_number||e.contact_number||"";const s=(e.gender||"").toUpperCase();document.getElementById("gender").value=s.startsWith("F")?"F":s.startsWith("M")?"M":"",document.getElementById("date_of_birth").value=ue(e.date_of_birth),document.getElementById("address1").value=e.address_line1||e.address||"",document.getElementById("postal_code").value=e.postal_code||e.zip_code||"",document.getElementById("credit_consent").checked=!0}async function oe(){const e=document.getElementById("credit-check-submit"),t=document.getElementById("identity_number").value.trim(),n=document.getElementById("surname").value.trim(),s=document.getElementById("forename").value.trim(),r=document.getElementById("gender").value,c=document.getElementById("date_of_birth").value,i=document.getElementById("address1").value.trim(),d=document.getElementById("address2").value.trim(),o=document.getElementById("postal_code").value.trim(),l=document.getElementById("cell_tel_no").value.trim(),u=document.getElementById("credit_consent").checked;if(!t||!n||!s||!r||!c||!i||!o){x("Please fill in all required fields.","warning");return}if(!u){x("Client consent is required.","warning");return}e.disabled=!0,e.innerHTML="Processing...",document.getElementById("credit-form-content").classList.add("hidden"),document.getElementById("credit-loading").classList.remove("hidden");try{const{data:{session:m}}=await y.auth.getSession();let p=a.creditCheck?.applicationId;if(!p){const{data:h,error:w}=await y.from("loan_applications").insert([{user_id:a.targetUser.id,status:"BUREAU_CHECKING",amount:0,term_months:0,purpose:"In-branch",source:"IN_BRANCH",created_by_admin:m.user?.id}]).select().single();if(w)throw w;p=h.id,a.creditCheck.applicationId=p}const f={user_id:a.targetUser.id,identity_number:t,surname:n,forename:s,gender:r,date_of_birth:c.replace(/-/g,""),address1:i,address2:d,postal_code:o,cell_tel_no:l},b=await de(p,f,m.access_token),g=b.creditScore?.score||0;await y.from("loan_applications").update({bureau_score_band:g,status:"BUREAU_OK"}).eq("id",p),a.creditCheck={applicationId:p,status:"completed",score:g},B=b.zipData||null,document.getElementById("credit-loading").classList.add("hidden"),document.getElementById("credit-result").classList.remove("hidden"),document.getElementById("credit-score-value").textContent=`Score: ${g}`,document.getElementById("credit-check-complete").classList.remove("hidden"),B&&document.getElementById("credit-check-download").classList.remove("hidden"),e.classList.add("hidden")}catch(m){console.error(m),x(m.message,"error"),N()}}async function de(e,t,n){const s=await fetch("/api/credit-check",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify({applicationId:e,userData:t})}),r=await s.json();if(!s.ok||!r.success)throw await y.from("loan_applications").update({status:"BUREAU_DECLINE"}).eq("id",e),new Error(r.error||"Credit check failed");return r}function le(e,t){try{const n=atob(e),s=new Array(n.length);for(let o=0;o<n.length;o++)s[o]=n.charCodeAt(o);const r=new Uint8Array(s),c=new Blob([r],{type:"application/zip"}),i=window.URL.createObjectURL(c),d=document.createElement("a");d.href=i,d.download=`credit-report-${t}.zip`,document.body.appendChild(d),d.click(),window.URL.revokeObjectURL(i),document.body.removeChild(d)}catch{x("Unable to download the credit report.","error")}}function ce(e=""){const t=e.trim().split(" ").filter(Boolean);if(t.length===0)return{firstName:"",lastName:""};if(t.length===1)return{firstName:t[0],lastName:t[0]};const n=t.pop();return{firstName:t.join(" "),lastName:n}}function ue(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?"":t.toISOString().split("T")[0]}function me(){const e=document.getElementById("main-content");e&&(e.innerHTML=`
    <div id="applications-list-view" class="flex flex-col h-full animate-fade-in">
      
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 shrink-0">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Loan Applications</h1>
          <p class="mt-1 text-sm text-gray-500">Manage reviews and create in-branch applications.</p>
        </div>
        
        <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button id="create-app-btn" class="w-full sm:w-auto bg-gray-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-black transition flex items-center justify-center gap-2 shadow-sm text-sm">
                <i class="fa-solid fa-desktop"></i> In-Branch App
            </button>

            <select id="status-filter" class="bg-white border border-gray-300 text-gray-700 py-2 pl-4 pr-8 rounded-lg text-sm font-medium focus:ring-orange-500 focus:border-orange-500 cursor-pointer">
                <option value="all">All Statuses</option>
                ${re.map(t=>`<option value="${t}">${t}</option>`).join("")}
            </select>

            <div class="relative w-full sm:w-64">
                <input type="text" id="search-input" placeholder="Search applications..." 
                       class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm">
                <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
                <div id="search-suggestions" class="absolute z-20 w-full bg-white border border-gray-300 rounded-lg mt-1 hidden max-h-72 overflow-y-auto shadow-xl"></div>
            </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden flex-1 min-h-0">
        <div class="overflow-auto custom-scrollbar">
          <table class="min-w-full divide-y divide-gray-200 relative">
            <thead class="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Applicant</th>
                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Amount</th>
                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Date</th>
                    <th class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Action</th>
                </tr>
            </thead>
            <tbody id="applications-table-body" class="bg-white divide-y divide-gray-200">
                <tr><td colspan="5" class="p-10 text-center text-gray-400">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-2 text-xs text-gray-400 text-right">Showing <span id="visible-count">0</span> records</div>
    </div>

    <div id="in-branch-view" class="hidden bg-white rounded-xl shadow-lg h-full flex flex-col border border-gray-200">
       <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <div class="flex items-center gap-3">
                <button id="back-to-list-btn" class="flex items-center gap-2 text-gray-600 hover:text-orange-600 font-medium transition-colors">
                    <i class="fa-solid fa-arrow-left"></i> Cancel
                </button>
                <span class="h-6 w-px bg-gray-300"></span>
                <span class="text-sm font-bold text-gray-800">In-Branch Application Mode</span>
            </div>
            <div class="text-xs text-orange-600 font-bold flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                <i class="fa-solid fa-store"></i> Branch Terminal
            </div>
        </div>
        
        <div class="px-6 pt-6 pb-2">
            <div class="flex items-center justify-center w-full max-w-6xl mx-auto mb-8 overflow-x-auto pb-2">
                <div id="wizard-stepper-container" class="flex items-center min-w-max"></div>
            </div>
        </div>
        
        <div id="wizard-content" class="flex-1 overflow-y-auto px-6 pb-6 bg-gray-50"></div>
        
        <div class="px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl flex justify-end gap-3">
            <button id="wizard-prev-btn" class="hidden px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 text-sm">Back</button>
            <button id="wizard-next-btn" class="px-6 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-black shadow-sm text-sm">Next Step</button>
        </div>
    </div>
  `,_e(),K())}const P=[{id:1,title:"Client",icon:"fa-user"},{id:2,title:"Bureau",icon:"fa-search-dollar"},{id:3,title:"Financials",icon:"fa-chart-pie"},{id:4,title:"Declarations",icon:"fa-file-contract"},{id:5,title:"Loan",icon:"fa-sliders"},{id:6,title:"Docs",icon:"fa-file-invoice"},{id:7,title:"Confirm",icon:"fa-check-circle"}];async function pe(){a.active=!0,a.step=1,a.targetUser=null,a.loanHistoryCount=0,a.creditCheck={applicationId:null,status:"pending",score:null};const e=new Date;e.setDate(e.getDate()+7),a.loanConfig={amount:1e3,period:1,startDate:e,reason:"Personal Loan",maxAllowedPeriod:1,interestRate:.2},document.getElementById("applications-list-view").classList.add("hidden"),document.getElementById("in-branch-view").classList.remove("hidden"),M()}function M(){ge(),fe(),C()}function ge(){const e=document.getElementById("wizard-stepper-container");e&&(e.innerHTML=P.map((t,n)=>{const s=t.id===a.step,r=t.id<a.step,c=n===P.length-1;let i="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ";return s?i+="border-brand-accent bg-brand-accent text-white shadow-md":r?i+="border-green-500 bg-green-500 text-white":i+="border-gray-300 bg-white text-gray-400",`
            <div class="flex flex-col items-center px-2">
                <div class="${i}">
                    ${r?'<i class="fa-solid fa-check"></i>':`<i class="fa-solid ${t.icon}"></i>`}
                </div>
                <span class="text-xs font-semibold whitespace-nowrap mt-1 ${s?"text-brand-accent":"text-gray-400"}">
                    ${t.title}
                </span>
            </div>
            ${c?"":'<div class="w-8 h-1 mx-1 rounded bg-gray-200"></div>'}
        `}).join(""))}async function fe(){const e=document.getElementById("wizard-content");switch(e.innerHTML='<div class="flex justify-center p-10"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand-accent"></i></div>',a.step){case 1:await L(e);break;case 2:await W(e);break;case 3:await be(e);break;case 4:await xe(e);break;case 5:await V(e);break;case 6:await Y(e);break;case 7:await G(e);break}}function C(){const e=document.getElementById("wizard-prev-btn"),t=document.getElementById("wizard-next-btn");a.step===1?(e.classList.add("hidden"),t.disabled=!a.targetUser):(e.classList.remove("hidden"),t.disabled=!1),a.step===3||a.step===4?t.classList.add("hidden"):t.classList.remove("hidden"),a.step===7?(t.innerHTML='<i class="fa-solid fa-paper-plane mr-2"></i> Submit Application',t.onclick=J):(t.innerHTML='Next Step <i class="fa-solid fa-arrow-right ml-2"></i>',t.onclick=I)}async function L(e){const t=["admin","super_admin","base_admin"].includes(S),n=100;e.innerHTML=`
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
                            ${q.filter(u=>u.id!==n).map(u=>`<option value="${u.id}">${u.name}</option>`).join("")}
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
    `;const s=document.getElementById("tab-search"),r=document.getElementById("tab-create"),c=document.getElementById("view-search"),i=document.getElementById("view-create"),d=document.getElementById("user-search"),o=document.getElementById("user-results"),l=document.getElementById("search-spinner");if(t&&r&&(s.onclick=()=>{c.classList.remove("hidden"),i.classList.add("hidden"),s.className="flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600",r.className="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors"},r.onclick=()=>{c.classList.add("hidden"),i.classList.remove("hidden"),r.className="flex-1 py-2 text-sm font-medium text-orange-600 border-b-2 border-orange-600",s.className="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors"}),d){let u;d.oninput=m=>{clearTimeout(u);const p=m.target.value.trim();if(p.length<2){o.classList.add("hidden");return}l.classList.remove("hidden"),u=setTimeout(async()=>{const{data:f}=await y.from("profiles").select("*").or(`full_name.ilike.%${p}%,identity_number.ilike.%${p}%`).limit(5);l.classList.add("hidden"),f?.length>0?(o.innerHTML=f.map(b=>`<div class="p-3 hover:bg-orange-50 cursor-pointer border-b last:border-0 user-option" data-id="${b.id}"><div class="font-bold text-gray-800">${b.full_name}</div><div class="text-xs text-gray-500 font-mono">ID: ${b.identity_number||"N/A"}</div></div>`).join(""),o.classList.remove("hidden"),document.querySelectorAll(".user-option").forEach(b=>b.onclick=()=>{a.targetUser=f.find(g=>g.id===b.dataset.id),L(e),C()})):(o.innerHTML='<div class="p-4 text-sm text-gray-500">No clients found.</div>',o.classList.remove("hidden"))},400)}}if(document.getElementById("btn-create-client")?.addEventListener("click",async u=>{const m=document.getElementById("new-fullname").value.trim(),p=document.getElementById("new-idnumber").value.trim(),f=document.getElementById("new-phone").value.trim(),b=document.getElementById("new-email").value.trim(),g=document.getElementById("new-branch-id"),h=g?g.value:null;if(!h)return x("Manual branch selection is required to proceed.","warning");if(!m||!p)return x("Name and ID Number are required.","warning");u.target.disabled=!0,u.target.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Creating...';try{const{data:w,error:E}=await se({fullName:m,idNumber:p,phone:f,email:b||null,branchId:h});if(E)throw E;a.targetUser=w,L(e),C()}catch(w){x(w.message,"error"),u.target.disabled=!1,u.target.innerHTML='<i class="fa-solid fa-user-plus"></i> Create & Select Client'}}),a.targetUser){const u=document.getElementById("user-loan-history-list"),m=document.getElementById("outstanding-balance-warning"),p=document.getElementById("action-new-loan");y.from("loan_applications").select("*").eq("user_id",a.targetUser.id).order("created_at",{ascending:!1}).then(({data:f,error:b})=>{if(b)return;const g=f?.find(h=>!["REPAID","DECLINED","ERROR","DISBURSED"].includes(h.status));g?(m.innerHTML=`<p class="text-[10px] text-red-600 font-bold uppercase flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> Active: ${g.status}</p>`,p.classList.add("opacity-50","bg-gray-50","cursor-not-allowed"),p.onclick=()=>x("Cannot start new. Application active.","warning")):(m.innerHTML='<p class="text-[10px] text-green-600 font-bold uppercase">Ready for new application</p>',p.onclick=()=>I()),!f||f.length===0?u.innerHTML='<p class="text-xs text-gray-400 p-4 text-center italic">No history found.</p>':u.innerHTML=f.map(h=>`<div class="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center text-sm shadow-sm"><div><span class="font-bold text-gray-700">${v(h.amount)}</span><span class="text-[10px] ml-2 text-gray-400 font-mono">${O(h.created_at)}</span><div class="mt-1"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${z(h.status)}">${h.status}</span></div></div>${["REPAID","DECLINED","ERROR","DISBURSED"].includes(h.status)?"":`<button class="resume-app-btn px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-md hover:bg-orange-700 transition" data-id="${h.id}">Resume</button>`}</div>`).join(""),document.querySelectorAll(".resume-app-btn").forEach(h=>{h.onclick=w=>{const E=w.target.dataset.id,k=f.find(Q=>Q.id==E);a.creditCheck.applicationId=E,a.loanConfig={...a.loanConfig,amount:k.amount,period:k.term_months,reason:k.purpose},x("Resuming Application..."),I()}})})}document.getElementById("clear-user-btn")?.addEventListener("click",()=>{a.targetUser=null,L(e),C()})}async function W(e){if(!a.targetUser)return;const{data:t}=await y.from("credit_checks").select("*").eq("user_id",a.targetUser.id).eq("status","completed").order("checked_at",{ascending:!1}).limit(1),n=t?.[0],s=n?(Date.now()-new Date(n.checked_at))/(1e3*3600*24):999,r=n&&s<=90;let c="",i=!1;if(r){const l=n.credit_score;a.creditScore=l,a.creditCheck={applicationId:n.application_id,status:"completed",score:l},i=!0;let u=l<600?"#EF4444":l<700?"#F59E0B":"#10B981",m=l<600?"Poor":l<700?"Average":"Excellent";const p=new Date(new Date(n.checked_at).getTime()+90*24*60*60*1e3).toLocaleDateString();c=`
            <div class="text-center p-6">
                <div class="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="80" stroke="#f3f4f6" stroke-width="12" fill="none"/>
                        <circle cx="96" cy="96" r="80" stroke="${u}" stroke-width="12" fill="none" 
                            stroke-dasharray="502" 
                            stroke-dashoffset="${502-502*(l/800)}"
                            style="transition: stroke-dashoffset 1s ease-in-out;"/>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-4xl font-extrabold text-gray-900">${l}</span>
                        <span class="text-xs font-bold uppercase tracking-widest" style="color: ${u}">${m}</span>
                    </div>
                </div>
                <h3 class="text-lg font-bold text-gray-800">Bureau Report Verified</h3>
                <p class="text-sm text-gray-500 mt-1">Valid until ${p}</p>
            </div>`}else a.creditCheck={applicationId:null,status:"pending",score:null},c=`
            <div class="text-center py-10">
                <div class="w-20 h-20 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-3xl mx-auto mb-4">
                    <i class="fa-solid fa-user-clock"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-900">New Credit Check Required</h3>
                <p class="text-gray-600 mt-2">No valid bureau report found from the last 3 months.</p>
                <button id="run-check-btn" class="mt-8 bg-brand-accent text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-brand-accent-hover transition">
                    Launch Experian Module
                </button>
            </div>`;e.innerHTML=`<div class="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-xl mt-4">${c}</div>`;const d=document.getElementById("run-check-btn");d&&(d.onclick=()=>window.openCreditCheckModal());const o=document.getElementById("wizard-next-btn");o&&(o.disabled=!i)}async function be(e){if(!a.targetUser)return;const{data:t}=await y.from("financial_profiles").select("*").eq("user_id",a.targetUser.id).maybeSingle(),n=t?.parsed_data||{income:{},expenses:{}};e.innerHTML=`
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
        </div>`;const s=()=>{const r=parseFloat(document.getElementById("fin_salary").value)||0,c=parseFloat(document.getElementById("fin_other").value)||0,i=r+c,d=parseFloat(document.getElementById("exp_housing").value)||0,o=parseFloat(document.getElementById("exp_school").value)||0,l=parseFloat(document.getElementById("exp_transport").value)||0,u=parseFloat(document.getElementById("exp_food").value)||0,m=d+o+l+u,p=Math.max(0,i-m);return document.getElementById("disp-income").textContent=v(p),{totalIncome:i,totalExpenses:m,surplus:p}};document.querySelectorAll("#financials-form input").forEach(r=>{r.addEventListener("input",s)}),s(),document.getElementById("financials-form").onsubmit=async r=>{r.preventDefault();const{totalIncome:c,totalExpenses:i,surplus:d}=s();if(c<=0)return x("Please enter a valid salary.","warning");const o={user_id:a.targetUser.id,monthly_income:c,monthly_expenses:i,affordability_ratio:d,parsed_data:{income:{salary:document.getElementById("fin_salary").value,other_monthly_earnings:document.getElementById("fin_other").value},expenses:{housing_rent:document.getElementById("exp_housing").value,school:document.getElementById("exp_school").value,petrol:document.getElementById("exp_transport").value,groceries:document.getElementById("exp_food").value}}},{error:l}=await y.from("financial_profiles").upsert(o,{onConflict:"user_id"});l?x(l.message,"error"):(a.affordabilityLimit=d,x("Financial Profile Updated","success"),I())}}async function xe(e){if(!a.targetUser)return;const{data:t}=await y.from("declarations").select("*").eq("user_id",a.targetUser.id).maybeSingle();e.innerHTML=`
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
        </div>`;const n=()=>{const s=document.getElementById("decl_referral_provided").checked,r=document.getElementById("referral-fields");s?r.classList.remove("hidden"):r.classList.add("hidden")};document.getElementById("decl_referral_provided").addEventListener("change",n),t&&(document.getElementById("decl_marital").value=t.marital_status||"single",document.getElementById("decl_home").value=t.home_ownership||"rent",document.getElementById("decl_qual").value=t.highest_qualification||"matric",document.getElementById("decl_disadvantaged").checked=!!t.historically_disadvantaged,t.referral_provided&&(document.getElementById("decl_referral_provided").checked=!0,n(),document.getElementById("decl_ref_name").value=t.referral_name||"",document.getElementById("decl_ref_phone").value=t.referral_phone||"")),document.getElementById("save-declarations").onclick=async()=>{const s=document.getElementById("decl_terms").checked,r=document.getElementById("decl_truth").checked;if(!s||!r)return x("Statutory declarations must be confirmed.","warning");const c=document.getElementById("decl_referral_provided").checked,i={user_id:a.targetUser.id,marital_status:document.getElementById("decl_marital").value,home_ownership:document.getElementById("decl_home").value,highest_qualification:document.getElementById("decl_qual").value,historically_disadvantaged:document.getElementById("decl_disadvantaged").checked,referral_provided:c,referral_name:c?document.getElementById("decl_ref_name").value:null,referral_phone:c?document.getElementById("decl_ref_phone").value:null,accepted_std_conditions:!0,metadata:{marital_status:document.getElementById("decl_marital").value,home_ownership:document.getElementById("decl_home").value}},{error:d}=await y.from("declarations").upsert(i,{onConflict:"user_id"});d?x(d.message,"error"):(x("Declarations Verified","success"),I())}}function ye(e){return[`${e}-01-01`,`${e}-03-21`,`${e}-04-18`,`${e}-04-21`,`${e}-04-27`,`${e}-04-28`,`${e}-05-01`,`${e}-06-16`,`${e}-08-09`,`${e}-09-24`,`${e}-12-16`,`${e}-12-25`,`${e}-12-26`]}function H(e){if(!e)return{valid:!0};const t=new Date(e),n=t.getUTCDay(),s=t.getUTCFullYear(),r=t.toISOString().split("T")[0],c=ye(s);return n===0||n===6?{valid:!1,reason:"Repayments cannot be scheduled on weekends."}:c.includes(r)?{valid:!1,reason:"The selected date is a South African Public Holiday."}:{valid:!0}}function U(e,t,n,s){let d=s<3?.2:.18,o=d-.15,l=0;if(n){const b=new Date,g=new Date(n),h=Math.max(1,Math.ceil((g-b)/(1e3*60*60*24))),w=Math.min(h,30),E=60/30*w,k=t>1?60*(t-1):0;l=E+k}else l=60*t;const u=e*o*(t/12),m=e*.15*t,p=e+u+l+m,f=p/t;return{totalInterest:u,totalRepayment:p,monthlyPayment:f,totalMonthlyFees:l,totalInitiationFees:m,totalRate:d,interestPortion:o,initiationRate:.15}}async function V(e){if(a.targetUser&&(a.loanHistoryCount===void 0||a.loanHistoryCount===0)){const{data:b}=await y.from("loan_applications").select("id").eq("user_id",a.targetUser.id).eq("status","");a.loanHistoryCount=b?.length||0;const{data:g}=await y.from("financial_profiles").select("affordability_ratio").eq("user_id",a.targetUser.id).single();a.affordabilityLimit=g?.affordability_ratio||0}const t=a.loanHistoryCount||0,n=a.affordabilityLimit||0;t<3?a.loanConfig.maxAllowedPeriod=1:a.loanConfig.maxAllowedPeriod=24;const{amount:s,period:r,reason:c,startDate:i}=a.loanConfig,d=U(s,r,i,t),o=d.totalRate/12;let l=1e4;n>0&&(o>0?l=n*((1-Math.pow(1+o,-r))/o):l=n*r),l=Math.floor(l/100)*100;const u=n>0&&d.monthlyPayment>n,m=H(document.getElementById("loan-start-date")?.value||i);e.innerHTML=`
        <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-800">Configure Loan</h3>
                    <div class="text-right">
                        <span class="block text-[10px] uppercase text-gray-400 font-bold tracking-tight">Max for ${r} Month${r>1?"s":""}</span>
                        <span class="text-sm font-black text-brand-accent">R ${l.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Amount (ZAR)</label>
                    <input type="number" id="loan-amount" value="${s}" min="100" class="w-full border-gray-300 rounded-md focus:ring-brand-accent ${u?"border-red-500 ring-1 ring-red-500":""}">
                    ${u?`
                    <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-start gap-2">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5"></i> 
                        <span><strong>Limit Exceeded:</strong> Max monthly payment is ${v(n)}. This loan requires ${v(d.monthlyPayment)}.</span>
                    </div>`:""}
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period (Months)</label>
                    <select id="loan-period" class="w-full border-gray-300 rounded-md focus:ring-brand-accent">
                        <option value="1" ${r==1?"selected":""}>1 Month</option>
                        ${a.loanConfig.maxAllowedPeriod>1?`
                            <option value="3" ${r==3?"selected":""}>3 Months</option>
                            <option value="6" ${r==6?"selected":""}>6 Months</option>
                            <option value="12" ${r==12?"selected":""}>12 Months</option>
                        `:""}
                    </select>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">First Repayment Date</label>
                    <input type="date" id="loan-start-date" class="w-full border-gray-300 rounded-md focus:ring-brand-accent" 
                        value="${i?i instanceof Date?i.toISOString().split("T")[0]:i.split("T")[0]:""}">
                    <div id="date-error-msg" class="${m?.valid===!1?"":"hidden"} text-xs text-red-600 mt-1 font-semibold flex items-center gap-1">
                        <i class="fa-solid fa-circle-exclamation"></i> <span id="error-text">${m?.reason||""}</span>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-800 text-white p-6 rounded-lg shadow-md flex flex-col justify-between">
                <div>
                    <h4 class="text-gray-400 text-sm uppercase tracking-wider mb-2">Quote Summary</h4>
                    <div class="flex justify-between items-end border-b border-gray-700 pb-4 mb-4">
                        <span class="text-3xl font-bold text-white">${v(s)}</span>
                        <span class="text-gray-400 mb-1">Principal</span>
                    </div>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400">Total Annual Rate</span> 
                            <span class="text-lg font-bold text-orange-400">${(d.totalRate*100).toFixed(0)}%</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pl-4 py-2 bg-gray-900/50 rounded border-l-2 border-orange-500/50">
                            <div>
                                <span class="block text-[10px] uppercase text-gray-500 font-bold">Interest</span>
                                <span class="text-white font-medium">${(d.interestPortion*100).toFixed(1)}%</span>
                            </div>
                            <div>
                                <span class="block text-[10px] uppercase text-gray-500 font-bold">Initiation</span>
                                <span class="text-white font-medium">${(d.initiationRate*100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <span class="text-gray-400">Duration</span> 
                            <span>${r} Month${r>1?"s":""}</span>
                        </div>
                        <div class="flex justify-between border-t border-gray-600 pt-2">
                            <span class="text-gray-300 font-semibold">Total Interest</span> 
                            <span class="font-bold">${v(d.totalInterest)}</span>
                        </div>
                    </div>
                </div>
                <div class="mt-6 pt-4 border-t border-gray-700">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400 font-medium">Total Repayment</span>
                        <span class="text-xl font-bold text-green-400">${v(d.totalRepayment)}</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-xs text-gray-500">Monthly Installment</span>
                        <span class="text-sm ${u?"text-red-400 font-bold":"text-gray-300"}">${v(d.monthlyPayment)}</span>
                    </div>
                </div>
            </div>
        </div>`;const p=document.getElementById("wizard-next-btn");p&&(p.disabled=!1,p.onclick=()=>{const b=document.getElementById("loan-start-date").value,g=H(b);if(!b)return x("Please select a first repayment date.","warning");if(!g.valid)return x(`Invalid Date: ${g.reason}`,"error");if(u)return x(`Loan Unaffordable: Max allowed is R ${l.toLocaleString()}`,"error");if(s<100)return x("Minimum loan amount is R 100.00","warning");I()});const f=b=>{const g=b.target.id,h=b.target.value;g==="loan-amount"&&(a.loanConfig.amount=Number(h)),g==="loan-period"&&(a.loanConfig.period=Number(h)),g==="loan-start-date"&&(a.loanConfig.startDate=h),g==="loan-reason"&&(a.loanConfig.reason=h),V(e)};["loan-amount","loan-period","loan-start-date","loan-reason"].forEach(b=>{const g=document.getElementById(b);g&&g.addEventListener("change",f)})}async function Y(e){if(!a.targetUser)return;const{data:{session:t}}=await y.auth.getSession(),n=t?.user?.id;if(!n){x("Error: Could not identify Admin user","error");return}let s=a.creditCheck?.applicationId;if(!s)try{const{data:i,error:d}=await y.from("loan_applications").insert([{user_id:a.targetUser.id,status:"STARTED",amount:a.loanConfig.amount||0,term_months:a.loanConfig.period||1,purpose:"In-branch",source:"IN_BRANCH",created_by_admin:n}]).select().single();if(d)throw d;s=i.id,a.creditCheck.applicationId=s}catch(i){console.error(i)}e.innerHTML=`
        <div class="max-w-2xl mx-auto bg-white p-6 rounded-lg border border-gray-200 mt-4">
            <h3 class="text-lg font-bold text-gray-800 mb-6">Required Documents</h3>
            <div class="space-y-4" id="docs-list"><div class="p-4 text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div></div>
        </div>`;const r=[{key:"idcard",label:"ID Document"},{key:"till_slip",label:"Latest Payslip"},{key:"bank_statement",label:"Bank Statement"}],c=await Promise.all(r.map(async i=>{const{data:d}=await y.from("document_uploads").select("*").eq("user_id",a.targetUser.id).eq("file_type",i.key).order("created_at",{ascending:!1}).limit(1),o=d?.[0],l=!!o,u=l?"text-green-600 bg-green-100":"text-gray-500 bg-gray-200",m=l?"fa-check-circle":"fa-upload";let p="";return o?.file_path&&(p=`<button class="text-xs text-blue-600 underline self-center mr-2 view-doc-btn" data-path="${o.file_path}">View</button>`),`
            <div class="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${u}"><i class="fa-solid ${m}"></i></div>
                    <div><p class="font-medium text-gray-900">${i.label}</p><p class="text-xs text-gray-500">${l?"Uploaded":"Missing"}</p></div>
                </div>
                <div class="flex gap-2">${p}
                    <label class="cursor-pointer bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50">
                        ${l?"Replace":"Upload"}
                        <input type="file" class="hidden doc-upload" data-type="${i.key}" accept=".pdf,.jpg,.png,.jpeg">
                    </label>
                </div>
            </div>`}));document.getElementById("docs-list").innerHTML=c.join(""),document.querySelectorAll(".view-doc-btn").forEach(i=>{i.addEventListener("click",async d=>{try{const{data:o,error:l}=await y.storage.from("client_docs").createSignedUrl(d.target.dataset.path,60);if(l)throw l;window.open(o.signedUrl,"_blank")}catch(o){x(o.message,"error")}})}),document.querySelectorAll(".doc-upload").forEach(i=>{i.addEventListener("change",async d=>{const o=d.target.files[0];if(!o)return;const l=d.target.dataset.type,u=d.target.parentElement;u.childNodes[0].textContent="Uploading...";try{const m=o.name.split(".").pop(),p=`${l}_${Date.now()}.${m}`,f=`${n}/${a.targetUser.id}_${p}`,{error:b}=await y.storage.from("client_docs").upload(f,o,{upsert:!0});if(b)throw new Error("Storage: "+b.message);const{error:g}=await y.rpc("register_admin_upload",{p_user_id:a.targetUser.id,p_app_id:s,p_file_name:p,p_original_name:o.name,p_file_path:f,p_file_type:l,p_mime_type:o.type,p_file_size:o.size});if(g)throw new Error("Database: "+g.message);x("Uploaded!","success"),await Y(e)}catch(m){console.error(m),x(m.message,"error")}finally{u.childNodes[0].textContent="Upload"}})})}async function G(e){if(!a.targetUser)return;const{amount:t,period:n,startDate:s}=a.loanConfig,r=a.loanHistoryCount||0,c=U(t,n,s,r),i=a.targetUser.full_name,{data:d}=await y.from("bank_accounts").select("*").eq("user_id",a.targetUser.id),o=s?new Date(s).toLocaleDateString("en-ZA",{day:"numeric",month:"long",year:"numeric"}):"Not set";e.innerHTML=`
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
                                ${d?.map(f=>`<option value="${f.id}">${f.bank_name} - ****${f.account_number.slice(-4)}</option>`).join("")}
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
                        <span class="text-xs text-gray-700 leading-tight">I confirm I have physically verified the identity of <strong>${i}</strong> and confirmed the banking details.</span>
                    </label>
                </div>
            </div>

            <div class="md:col-span-2">
                <div class="bg-gray-800 text-white rounded-2xl shadow-xl overflow-hidden sticky top-4 border border-gray-700">
                    <div class="p-4 bg-gray-900/50 border-b border-gray-700 text-center"><h4 class="text-[10px] font-bold uppercase text-brand-accent">Loan Offer Summary</h4></div>
                    <div class="p-8">
                        <div class="flex justify-between items-end border-b border-gray-700 pb-6 mb-6">
                            <span class="text-4xl font-black text-white">${v(t)}</span>
                            <span class="text-gray-400 text-xs font-bold mb-1 uppercase">Principal</span>
                        </div>
                        <div class="space-y-4 text-sm">
                            <div class="flex justify-between items-center"><span class="text-gray-400">Monthly Payout</span><span class="text-2xl font-black text-brand-accent">${v(c.monthlyPayment)}</span></div>
                            <div class="flex justify-between items-center"><span class="text-gray-400">Total Repayable</span><span class="font-bold text-green-400 text-lg">${v(c.totalRepayment)}</span></div>
                            <div class="flex justify-between pt-2 border-t border-gray-700"><span class="text-gray-400">Term Duration</span><span class="font-medium">${n} Month${n>1?"s":""}</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">First Debit Date</span><span class="font-bold text-orange-300">${o}</span></div>
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
        </div>`;const l=document.getElementById("bank-select"),u=document.getElementById("new-bank-form"),m=document.getElementById("bank-preview-container"),p=()=>{const f=l.value,b=!u.classList.contains("hidden");if(!f&&!b){m.classList.add("hidden");return}if(m.classList.remove("hidden"),b)document.getElementById("preview-bank-name").innerText=document.getElementById("new-bank-name").value||"...",document.getElementById("preview-acc-number").innerText=document.getElementById("new-acc-number").value||"...";else{const g=d.find(h=>h.id==f);g&&(document.getElementById("preview-bank-name").innerText=g.bank_name,document.getElementById("preview-acc-number").innerText=g.account_number)}};document.getElementById("toggle-new-bank").onclick=()=>{u.classList.toggle("hidden"),l.value="",p()},l.onchange=()=>{u.classList.add("hidden"),p()},["new-bank-name","new-acc-number"].forEach(f=>document.getElementById(f).oninput=p),document.getElementById("admin-consent").onchange=f=>{document.getElementById("wizard-next-btn").disabled=!f.target.checked},document.getElementById("wizard-next-btn").onclick=J,document.getElementById("btn-save-bank").onclick=async()=>{const f={user_id:a.targetUser.id,bank_name:document.getElementById("new-bank-name").value,account_holder:i,account_number:document.getElementById("new-acc-number").value,branch_code:document.getElementById("new-branch-code").value,account_type:document.getElementById("new-acc-type").value,is_verified:!0,created_by_admin:(await y.auth.getUser()).data.user.id},{data:b,error:g}=await y.from("bank_accounts").insert([f]).select().single();g||(await G(e),document.getElementById("bank-select").value=b.id,p())}}function I(){a.step<7&&(a.step++,M())}document.addEventListener("click",e=>{e.target.id==="wizard-prev-btn"&&a.step>1&&(a.step--,M());const t=e.target.closest("#back-to-list-btn");t&&(t.dataset.confirming?(document.getElementById("in-branch-view").classList.add("hidden"),document.getElementById("applications-list-view").classList.remove("hidden"),t.dataset.confirming="",t.innerHTML='<i class="fa-solid fa-arrow-left"></i> Cancel',t.classList.remove("text-red-600","font-bold")):(t.dataset.confirming="true",t.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> Click again to Confirm',t.classList.add("text-red-600","font-bold"),x("Unsaved progress will be lost. Click again to exit.","warning"),setTimeout(()=>{t.dataset.confirming="",t.innerHTML='<i class="fa-solid fa-arrow-left"></i> Cancel',t.classList.remove("text-red-600","font-bold")},3e3))),(e.target.id==="sign-out-btn"||e.target.closest("#sign-out-btn"))&&(e.preventDefault(),y.auth.signOut().then(()=>{localStorage.clear(),sessionStorage.clear(),window.location.href="/"}))});async function he(){const e=document.getElementById("sync-offered-btn");if(e&&confirm("Sync all OFFERED applications?")){e.disabled=!0,e.innerHTML="Syncing...";try{await ne(),x("Synced!","success"),await Z()}catch(t){x(t.message,"error")}finally{e.disabled=!1,e.innerHTML="Sync Offered"}}}const ve=e=>{const t=document.getElementById("applications-table-body"),n=document.getElementById("visible-count");if(t){if(n&&(n.textContent=e.length),e.length===0){t.innerHTML='<tr><td colspan="5" class="p-10 text-center text-sm text-gray-400">No applications match your criteria.</td></tr>';return}t.innerHTML=e.map(s=>`
        <tr class="hover:bg-gray-50 transition-colors group">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold mr-3 border border-gray-200 bg-gray-100 text-gray-500">
                        ${(s.profiles?.full_name||"A").charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-gray-900">${s.profiles?.full_name||"N/A"}</div>
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ID: ${s.id}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-mono font-medium text-gray-900">${v(s.amount)}</div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-transparent ${z(s.status)}">
                    ${s.status}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs text-gray-500 font-medium">${O(s.created_at)}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <a href="/admin/application-detail?id=${s.id}" 
                   class="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50 inline-block">
                    <i class="fa-solid fa-eye"></i>
                </a>
            </td>
        </tr>
    `).join("")}},we=e=>{const t=document.getElementById("search-suggestions");if(t){if(e.length===0){t.innerHTML="",t.classList.add("hidden");return}t.innerHTML=e.map(n=>`
        <a href="/admin/application-detail?id=${n.id}" class="block p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-200 last:border-b-0">
            <p class="font-semibold text-gray-800">${n.profiles?.full_name||"N/A"}</p>
            <p class="text-xs text-gray-500">ID: ${n.id} | Status: ${n.status}</p>
        </a>
    `).join(""),t.classList.remove("hidden")}},A=(e=!0)=>{e&&(_=1);const t=document.getElementById("search-input")?.value.toLowerCase().trim()||"",n=document.getElementById("status-filter")?.value||"all",s=j.filter(o=>{const l=n==="all"||o.status===n,u=!t||(o.profiles?.full_name||"").toLowerCase().includes(t)||String(o.id).toLowerCase().includes(t)||String(o.amount).includes(t);let m=!1;return S==="super_admin"?m=!0:m=o.branch_id===R?.branch_id,l&&u&&m}),r=Math.ceil(s.length/$)||1,c=(_-1)*$,i=s.slice(c,c+$);ve(i),Ee(r,s.length);const d=document.getElementById("search-input");document.activeElement===d&&t.length>1?we(s.slice(0,5)):document.getElementById("search-suggestions")?.classList.add("hidden")};async function Z(){const{data:e,error:t}=await ae();t?console.error(t):(j=e,A())}function _e(){document.getElementById("search-input")?.addEventListener("input",()=>A(!0)),document.getElementById("status-filter")?.addEventListener("change",()=>A(!0)),document.getElementById("create-app-btn")?.addEventListener("click",pe),document.getElementById("sync-offered-btn")?.addEventListener("click",he),document.addEventListener("click",e=>{const t=document.getElementById("search-suggestions");t&&!document.getElementById("search-input").contains(e.target)&&!t.contains(e.target)&&t.classList.add("hidden")})}document.addEventListener("DOMContentLoaded",async()=>{const e=await X();if(e){S=e.role;const[t,n]=await Promise.all([ee(),te()]);R=t,q=n||[],me(),await Z()}});async function J(){const e=document.getElementById("wizard-next-btn");if(e){e.disabled=!0,e.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Processing...';try{const{amount:t,period:n,startDate:s}=a.loanConfig,r=a.loanHistoryCount||0,c=U(t,n,s,r);let i=document.getElementById("bank-select").value;if(i==="new"){const l={user_id:a.targetUser.id,bank_name:document.getElementById("new-bank-name").value,account_holder:a.targetUser.full_name,account_number:document.getElementById("new-account-number").value,branch_code:document.getElementById("new-branch-code").value,account_type:document.getElementById("new-account-type").value.toLowerCase(),is_verified:!0,created_by_admin:(await y.auth.getUser()).data.user.id},{data:u,error:m}=await y.from("bank_accounts").insert([l]).select().single();if(m)throw new Error("Bank Save Failed: "+m.message);i=u.id}if(!i)throw new Error("Please select or add a bank account.");const d={status:"AFFORD_OK",amount:t,term_months:n,bank_account_id:i,updated_at:new Date().toISOString(),offer_principal:t,offer_interest_rate:c.totalRate,offer_total_interest:c.totalInterest,offer_total_initiation_fees:c.totalInitiationFees,offer_monthly_repayment:c.monthlyPayment,offer_total_repayment:c.totalRepayment,offer_total_admin_fees:c.totalMonthlyFees,branch_id:a.targetUser?.branch_id||R?.branch_id,offer_details:{first_repayment_date:s,interest_portion:c.interestPortion,initiation_rate:c.initiationRate,source:"In-Branch Admin Terminal"},notes:`In-branch application for ${a.targetUser.full_name}. Verified by Admin.`},{error:o}=await y.from("loan_applications").update(d).eq("id",a.creditCheck.applicationId);if(o)throw o;x("Application Submitted Successfully!","success"),setTimeout(()=>window.location.reload(),1500)}catch(t){console.error("Submission Error:",t),x(t.message,"error"),e.disabled=!1,e.innerHTML="Submit Application"}}}function Ee(e,t){let n=document.getElementById("app-pagination-container");const s=document.getElementById("applications-list-view"),r=document.getElementById("visible-count");if(r&&(r.textContent=t),n||(n=document.createElement("div"),n.id="app-pagination-container",n.className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50",s.appendChild(n)),e<=1){n.innerHTML='<span class="text-xs text-gray-400">Showing all records</span>';return}n.innerHTML=`
        <span class="text-xs font-bold text-gray-500 uppercase tracking-tight">Page ${_} of ${e}</span>
        <div class="flex gap-2">
            <button onclick="window.changePageApps(${_-1})" ${_===1?"disabled":""} 
                class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
                Prev
            </button>
            <button onclick="window.changePageApps(${_+1})" ${_===e?"disabled":""} 
                class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
                Next
            </button>
        </div>
    `}window.changePageApps=e=>{_=e,A(!1)};
