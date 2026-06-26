import{supabase as u}from"./supabaseClient-BXSct5lo.js";/* empty css              *//* empty css               */import{i as D}from"./layout-l3iKOyZ9.js";import{a as x,b as B}from"./utils-CZwHw4kl.js";import{A as L,B as S}from"./dataService-Q65e7z4o.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";import"./theme-CYs9TE7o.js";let f=[];async function $(){const{data:t,error:n}=await u.from("manual_payments").select("*").eq("status","pending").order("created_at",{ascending:!1});if(n){console.warn("[manual-payments]",n.message),f=[],w();return}const e=t||[];if(e.length>0){const o=[...new Set(e.map(r=>r.user_id).filter(Boolean))],l=[...new Set(e.map(r=>r.application_id).filter(Boolean))],[i,a]=await Promise.all([o.length?u.from("profiles").select("id, full_name, cell_tel_no, identity_number").in("id",o):Promise.resolve({data:[]}),l.length?u.from("loan_applications").select("id, loan_number, amount, status").in("id",l):Promise.resolve({data:[]})]),s=Object.fromEntries((i.data||[]).map(r=>[r.id,r])),d=Object.fromEntries((a.data||[]).map(r=>[r.id,r]));e.forEach(r=>{r.profiles=s[r.user_id]||null,r.loan_applications=d[r.application_id]||null})}f=e,w()}function w(){const t=document.getElementById("pending-manual-payments");if(!t)return;if(!f.length){t.innerHTML=`
      <div class="flex items-center gap-2 text-sm text-slate-400 py-4">
        <span class="material-symbols-outlined text-[18px]">check_circle</span>
        No pending manual payments
      </div>`;return}const n=document.getElementById("pending-count-badge");n&&(n.textContent=f.length,n.classList.remove("hidden")),t.innerHTML=f.map(e=>{const o=e.profiles?.full_name||"Unknown",l=e.profiles?.cell_tel_no||"—",i=e.loan_applications?.loan_number||e.application_id?.toString().slice(0,8)||"—",a=e.payment_type==="settlement"?"Settlement":e.payment_type==="arrears"?"Arrears Payment":"Payment",s=e.payment_type==="settlement"?"text-purple-600 bg-purple-50":"text-green-700 bg-green-50",d=Math.floor((Date.now()-new Date(e.created_at))/36e5),r=d<1?"Just now":d<24?`${d}h ago`:`${Math.floor(d/24)}d ago`;return`
      <div class="border border-slate-100 rounded-2xl p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-all" id="mp-${e.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 text-sm flex-shrink-0">
              ${o.charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 text-sm truncate">${o}</p>
              <p class="text-xs text-slate-400">${l} · Loan ${i}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="font-black text-lg text-slate-900">R ${Number(e.amount).toLocaleString("en-ZA",{minimumFractionDigits:2})}</p>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${s}">${a}</span>
          </div>
        </div>

        ${e.reference?`<p class="text-xs text-slate-500 mt-2"><span class="font-semibold">Ref:</span> ${e.reference}</p>`:""}
        ${e.proof_url?`<p class="text-xs text-slate-500 mt-1"><span class="font-semibold">Proof:</span> <a href="${e.proof_url}" target="_blank" class="text-orange-600 underline">${e.proof_url.length>40?e.proof_url.slice(0,40)+"…":e.proof_url}</a></p>`:""}
        ${e.notes?`<p class="text-xs text-slate-500 mt-1 italic">"${e.notes}"</p>`:""}

        <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span class="text-[10px] text-slate-400">${r}</span>
          <div class="flex gap-2">
            <button onclick="window.rejectManualPayment('${e.id}')"
              class="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
              Reject
            </button>
            <button onclick="window.confirmManualPayment('${e.id}','${e.payment_type}','${o}')"
              class="px-3 py-1.5 text-xs font-bold text-white rounded-xl transition-colors flex items-center gap-1.5"
              style="background:var(--color-primary)">
              <span class="material-symbols-outlined text-[14px]">check</span> Confirm
            </button>
          </div>
        </div>
      </div>`}).join("")}window.confirmManualPayment=async(t,n,e)=>{if(!confirm(`Confirm ${n==="settlement"?"SETTLEMENT":"payment"} from ${e}?

This will:
• Mark as confirmed
• Post to Cash Ledger
• Send SMS to client${n==="settlement"?`
• Set loan status to SETTLED`:""}`))return;const{data:{session:o}}=await u.auth.getSession(),i=await(await fetch(`/api/admin/payment/confirm/${t}`,{method:"POST",headers:{Authorization:`Bearer ${o.access_token}`,"Content-Type":"application/json"}})).json();if(i.success){const a=document.getElementById(`mp-${t}`);a&&(a.style.opacity="0",a.style.transform="scale(0.95)",a.style.transition="all .3s",setTimeout(()=>a.remove(),300)),f=f.filter(s=>s.id!==t),w()}else alert("Error: "+(i.error||"Could not confirm"))};window.rejectManualPayment=async t=>{const n=prompt("Reason for rejection (sent to client):");if(n===null)return;const{data:{session:e}}=await u.auth.getSession(),{error:o}=await u.from("manual_payments").update({status:"rejected",rejection_reason:n,confirmed_at:new Date().toISOString()}).eq("id",t);if(!o){const l=document.getElementById(`mp-${t}`);l&&(l.style.opacity="0",l.style.transition="all .3s",setTimeout(()=>l.remove(),300)),f=f.filter(i=>i.id!==t),w()}};let v=[],E=[],p="30days",I="",b=1;const k=15;function C(){const t=document.getElementById("main-content");t&&(t.innerHTML=`
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
                        <button id="tab-today"   class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${p==="today"?"border-[var(--color-primary)] text-on-surface":"text-outline border-transparent hover:text-on-surface"}">Today</button>
                        <button id="tab-7days"   class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${p==="7days"?"border-[var(--color-primary)] text-on-surface":"text-outline border-transparent hover:text-on-surface"}">7 Days</button>
                        <button id="tab-30days"  class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${p==="30days"?"border-[var(--color-primary)] text-on-surface":"text-outline border-transparent hover:text-on-surface"}">30 Days</button>
                        <button id="tab-all"     class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${p==="all"?"border-[var(--color-primary)] text-on-surface":"text-outline border-transparent hover:text-on-surface"}">All</button>
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
  `,A())}async function P(){try{const[t,n]=await Promise.all([L(),S()]);if(t.error)throw t.error;if(n.error)throw n.error;v=t.data||[],E=n.data||[],R(),y(!0)}catch(t){console.error("Load Error:",t);const n=t.message||"Unable to connect to the database. Please check your connection.",e=document.getElementById("payments-table-body");e&&(e.innerHTML=`
        <tr>
          <td colspan="6" class="p-10 text-center text-xs text-red-500 italic border-2 border-dashed border-red-50 rounded-xl">
            <i class="fa-solid fa-triangle-exclamation mb-2 text-lg"></i><br>
            Error Loading Data: ${n}
          </td>
        </tr>`),window.showToast&&window.showToast("Failed to load recovery data","error")}}function R(){const n=new Date().toISOString().slice(0,7),e=v.filter(c=>(c.payment_date||c.created_at||"").startsWith(n)),o=e.reduce((c,m)=>c+Number(m.amount||0),0),l=new Set(e.map(c=>c.loan_id||c.application_id)).size,i=E.filter(c=>c.month===n),a=i.reduce((c,m)=>c+(m.profit_collected_month||0),0),s=i.reduce((c,m)=>c+(m.principal_collected_month||0),0),d=i.reduce((c,m)=>c+(m.overpayment_collected_month||0),0);document.getElementById("stat-mtd-recoveries").textContent=x(o),document.getElementById("stat-revenue-yield").textContent=x(a),document.getElementById("stat-active-payers").textContent=l,document.getElementById("stat-mtd-count").innerHTML=`<i class="fa-solid fa-arrow-trend-up"></i> <span>${e.length}</span> transactions`,document.getElementById("label-principal-split").textContent=x(s),document.getElementById("label-interest-split").textContent=x(a),document.getElementById("label-overpayment-split").textContent=x(d);const r=o>0?Math.round(a/o*100):0;document.getElementById("chart-profit-percent").textContent=`${r}%`,document.getElementById("chart-interest-ring").setAttribute("stroke-dasharray",`${r}, 100`),T(e.length>0?e:v.slice(0,10))}function T(t){const n=document.getElementById("top-payments-list");if(!n)return;const e=[...t].sort((o,l)=>Number(l.amount)-Number(o.amount)).slice(0,5);if(e.length===0){n.innerHTML='<div class="text-center py-10 text-xs text-gray-400">No data for period</div>';return}n.innerHTML=e.map(o=>{const l=o.profile?.full_name||o.profiles?.full_name||"Unknown",i=o.loan_id||o.application_id||"",a=o.loan_number||i.slice(0,8).toUpperCase();return`
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all cursor-pointer" onclick="window.location.href='/admin/application-detail?id=${i}'">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-black">${l.charAt(0)||"$"}</div>
                <div>
                    <p class="text-xs font-bold text-gray-900 truncate w-24">${l}</p>
                    <p class="text-[10px] text-gray-400 font-mono">${a}</p>
                </div>
            </div>
            <span class="text-xs font-black text-green-600">+${x(o.amount)}</span>
        </div>`}).join("")}function M(){let t=v;if(p==="today"){const e=new Date().toISOString().slice(0,10);t=t.filter(o=>o.payment_date?.slice(0,10)===e)}else if(p==="7days"){const e=new Date;e.setDate(e.getDate()-7),t=t.filter(o=>new Date(o.payment_date)>=e)}else if(p==="30days"){const e=new Date;e.setDate(e.getDate()-30),t=t.filter(o=>new Date(o.payment_date)>=e)}else if(p==="custom"){const e=document.getElementById("filter-date-from")?.value,o=document.getElementById("filter-date-to")?.value;e&&(t=t.filter(l=>l.payment_date?.slice(0,10)>=e)),o&&(t=t.filter(l=>l.payment_date?.slice(0,10)<=o))}const n=(document.getElementById("search-input")?.value||"").toLowerCase();return n&&(t=t.filter(e=>(e.profile?.full_name||e.profiles?.full_name||"").toLowerCase().includes(n)||(e.reference||"").toLowerCase().includes(n)||(e.loan_number||"").toLowerCase().includes(n))),t}function y(t=!0){t&&(b=1);let n=v;if(p==="today"){const a=new Date().toISOString().slice(0,10);n=n.filter(s=>s.payment_date?.slice(0,10)===a)}else if(p==="7days"){const a=new Date;a.setDate(a.getDate()-7),n=n.filter(s=>new Date(s.payment_date)>=a)}else if(p==="30days"){const a=new Date;a.setDate(a.getDate()-30),n=n.filter(s=>new Date(s.payment_date)>=a)}else if(p==="custom"){const a=document.getElementById("filter-date-from")?.value,s=document.getElementById("filter-date-to")?.value;a&&(n=n.filter(d=>d.payment_date?.slice(0,10)>=a)),s&&(n=n.filter(d=>d.payment_date?.slice(0,10)<=s))}const e=I.toLowerCase();e&&(n=n.filter(a=>(a.profile?.full_name||a.profiles?.full_name||"").toLowerCase().includes(e)||(a.reference||"").toLowerCase().includes(e)||String(a.id).includes(e)||String(a.loan_id||a.application_id||"").includes(e)||(a.loan_number||"").toLowerCase().includes(e)));const o=(b-1)*k,l=n.slice(o,o+k),i=document.getElementById("payments-table-body");i&&(l.length===0?i.innerHTML='<tr><td colspan="6" class="p-10 text-center text-xs text-gray-400 italic">No transactions found.</td></tr>':i.innerHTML=l.map(a=>{const s=a.loan?.outstanding_balance||0,d=a.loan?.application?.offer_monthly_repayment||0,r=Number(a.amount);let c="",m="";s<-1?(c=`<span class="text-[10px] font-bold px-2 py-1 rounded bg-purple-50 text-purple-700 uppercase">Credit: ${x(Math.abs(s))}</span>`,m='<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Overpaid</span>'):s<=1?(c='<span class="text-[10px] font-bold px-2 py-1 rounded bg-green-50 text-green-700 uppercase tracking-tighter">Fully Settled</span>',m='<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">Complete</span>'):(c=`<span class="text-[10px] font-bold px-2 py-1 rounded bg-red-50 text-red-700 uppercase tracking-tighter">Due: ${x(s)}</span>`,m=r<d?'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">Partial</span>':'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">On Track</span>');const h=a.profile?.full_name||a.profiles?.full_name||"Unknown",g=a.loan_id||a.application_id||"",_=a.loan_number||(g?g.slice(0,8).toUpperCase():"—");return`
                <tr class="hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0">
                    <td class="px-6 py-4 text-xs text-gray-500 font-medium whitespace-nowrap">${B(a.payment_date||a.created_at)}</td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col">
                            <span class="text-xs font-bold text-gray-900">${h}</span>
                            <span class="text-[10px] text-gray-400 font-mono tracking-tighter">${a.reference||"REF-"+a.id?.slice(0,8).toUpperCase()}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <a href="/admin/application-detail?id=${g}" class="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100">
                            ${_}
                        </a>
                    </td>
                    <td class="px-6 py-4 text-center">${m}</td>
                    <td class="px-6 py-4 text-right">
                        <span class="text-xs font-black text-gray-900">+ ${x(a.amount)}</span>
                    </td>
                    <td class="px-6 py-4 text-right">${c}</td>
                </tr>`}).join("")),j(n.length)}function j(t){const n=document.getElementById("pagination-controls");if(!n)return;const e=Math.ceil(t/k)||1;n.innerHTML=`
        <div class="flex justify-between items-center">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Page ${b} of ${e}</span>
            <div class="flex gap-2">
                <button onclick="window.changePageRecovery(${b-1})" ${b===1?"disabled":""} class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all text-gray-700">Prev</button>
                <button onclick="window.changePageRecovery(${b+1})" ${b===e?"disabled":""} class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all text-gray-700">Next</button>
            </div>
        </div>`}function A(){document.getElementById("search-input")?.addEventListener("input",n=>{I=n.target.value.trim(),y(!0)});const t=n=>{p=n,y(!0)};document.getElementById("tab-today")?.addEventListener("click",()=>t("today")),document.getElementById("tab-7days")?.addEventListener("click",()=>t("7days")),document.getElementById("tab-30days")?.addEventListener("click",()=>t("30days")),document.getElementById("tab-all")?.addEventListener("click",()=>t("all")),document.getElementById("filter-date-from")?.addEventListener("change",()=>{p="custom",y(!0)}),document.getElementById("filter-date-to")?.addEventListener("change",()=>{p="custom",y(!0)}),document.getElementById("btn-export-payments")?.addEventListener("click",O)}function O(){const t=M();if(!t.length){alert("No payments to export for this period.");return}const n=["Date","Client","ID Number","Reference","Loan Ref","Amount Paid","Type","Method"],e=t.map(s=>[(s.payment_date||s.created_at||"").slice(0,10),`"${(s.profile?.full_name||s.profiles?.full_name||"").replace(/"/g,'""')}"`,s.profile?.identity_number||s.profiles?.identity_number||"",s.reference||s.id||"",s.loan_number||(s.loan_id||s.application_id||"").toString().slice(0,8),s.amount||0,s.payment_type||s.status||"",s.payment_method||"Manual EFT"].join(",")),o=[n.join(","),...e].join(`
`),l=new Blob([o],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(l),a=document.createElement("a");a.href=i,a.download=`incoming_payments_${p}_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(i)}window.changePageRecovery=t=>{b=t,y(!1)};document.addEventListener("DOMContentLoaded",async()=>{await D()&&(C(),await Promise.all([P(),$()]))});window.loadPendingManualPayments=$;window.toggleRecordPaymentForm=()=>{const t=document.getElementById("record-payment-form");t&&t.classList.toggle("hidden")};window.submitAdminPayment=async()=>{const t=document.getElementById("rp-app-id")?.value.trim(),n=parseFloat(document.getElementById("rp-amount")?.value||"0"),e=document.getElementById("rp-date")?.value,o=document.getElementById("rp-type")?.value||"installment",l=document.getElementById("rp-ref")?.value.trim(),i=document.getElementById("rp-notes")?.value.trim(),a=document.getElementById("rp-feedback"),s=(d,r)=>{a&&(a.className=`mt-3 p-3 rounded-xl text-sm font-semibold ${r==="error"?"bg-red-50 text-red-700":"bg-green-50 text-green-700"}`,a.textContent=d,a.classList.remove("hidden"))};if(!t||!n||n<=0||!e)return s("Please fill in the Loan ID, amount, and date.","error");try{let d=t;const{data:r}=await u.from("loan_applications").select("id, user_id, loan_number, profiles:user_id(full_name)").or(`id.eq.${t},loan_number.eq.${t}`).maybeSingle();if(!r)return s("Application not found. Check the loan number or ID.","error");d=r.id;const c=l||`ADM-${Date.now().toString(36).toUpperCase()}`,m=["settlement","arrears","partial"].includes(o)?o:"partial",{error:h}=await u.from("manual_payments").insert([{application_id:Number(d),user_id:r.user_id,amount:n,payment_type:m,reference:c,notes:i?`${i} (date: ${e})`:`Payment date: ${e}`,status:"confirmed",confirmed_at:new Date().toISOString()}]);if(h)throw h;await u.from("cash_journal").insert([{entry_date:e,entry_type:"cash_in",category:o==="settlement"?"settlement":"repayment",description:`Admin-recorded ${o} from ${r.profiles?.full_name||"Client"} — Ref: ${c}`,reference:c,amount:n,application_id:String(d),created_by_name:"Admin (manual entry)"}]);const{data:g}=await u.from("loans").select("id, outstanding_balance").eq("application_id",d).maybeSingle();if(g){const _=o==="settlement"?0:Math.max(0,Number(g.outstanding_balance||0)-n);await u.from("loans").update({outstanding_balance:_,updated_at:new Date().toISOString()}).eq("id",g.id),o==="settlement"&&await u.from("loan_applications").update({status:"SETTLED",updated_at:new Date().toISOString()}).eq("id",d)}s(`✓ Payment of R${n.toFixed(2)} recorded for ${r.profiles?.full_name||t} (${e}).`,"success"),document.getElementById("rp-app-id").value="",document.getElementById("rp-amount").value="",document.getElementById("rp-ref").value="",document.getElementById("rp-notes").value="",document.getElementById("rp-date").value=new Date().toISOString().slice(0,10),await Promise.all([P(),$()])}catch(d){s("Error: "+d.message,"error")}};
