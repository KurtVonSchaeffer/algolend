import"./supabaseClient-DdIec1HK.js";/* empty css              *//* empty css               */import{i as C}from"./layout-Nmoyu__-.js";import{b as E,a as b}from"./utils-CZwHw4kl.js";import{C as B,o as D}from"./dataService-CkuKBXml.js";import"https://esm.sh/@supabase/supabase-js@2";import"./theme-CYs9TE7o.js";const M="modulepreload",T=function(a){return"/"+a},I={},j=function(n,t,s){let d=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),e=o?.nonce||o?.getAttribute("nonce");d=Promise.allSettled(t.map(i=>{if(i=T(i),i in I)return;I[i]=!0;const l=i.endsWith(".css"),y=l?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${i}"]${y}`))return;const p=document.createElement("link");if(p.rel=l?"stylesheet":M,l||(p.as="script"),p.crossOrigin="",p.href=i,e&&p.setAttribute("nonce",e),document.head.appendChild(p),l)return new Promise((P,L)=>{p.addEventListener("load",P),p.addEventListener("error",()=>L(new Error(`Unable to preload CSS for ${i}`)))})}))}function r(o){const e=new Event("vite:preloadError",{cancelable:!0});if(e.payload=o,window.dispatchEvent(e),!e.defaultPrevented)throw o}return d.then(o=>{for(const e of o||[])e.status==="rejected"&&r(e.reason);return n().catch(r)})};let g=[],u=new Set,c="pending",v="",m=1;const $=20;function w(){const a=document.getElementById("main-content");if(a&&(a.innerHTML=`
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
                    <button id="tab-pending" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${c==="pending"?"border-[var(--color-primary)]":"text-outline border-transparent hover:text-on-surface"}" style="${c==="pending"?"color:var(--color-primary)":""}">
                        Ready to Pay
                    </button>
                    <button id="tab-history" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${c==="history"?"border-[var(--color-primary)]":"text-outline border-transparent hover:text-on-surface"}" style="${c==="history"?"color:var(--color-primary)":""}">
                        Paid History
                    </button>
                    <button id="tab-comparison" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${c==="comparison"?"border-[var(--color-primary)]":"text-outline border-transparent hover:text-on-surface"}" style="${c==="comparison"?"color:var(--color-primary)":""}">
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
  `,N(),!document.getElementById("payout-editor-modal"))){const n=document.createElement("div");n.id="payout-editor-modal",n.className="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4",n.innerHTML=`
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
            ${[{v:"bank_transfer",l:"Bank Transfer",i:"fa-building-columns",c:"blue"},{v:"cashsend",l:"CashSend",i:"fa-mobile-screen",c:"purple"},{v:"third_party",l:"Third Party",i:"fa-arrow-right-arrow-left",c:"orange"},{v:"cash",l:"Cash",i:"fa-money-bill",c:"green"}].map(t=>`
              <button type="button" data-method="${t.v}" onclick="window.selectPayoutMethod('${t.v}')"
                class="pe-method-btn flex items-center gap-2 p-3 rounded-xl border-2 border-gray-200 hover:border-${t.c}-400 text-left text-sm font-semibold text-gray-700 transition-all">
                <i class="fa-solid ${t.i} text-${t.c}-500 w-4"></i> ${t.l}
              </button>`).join("")}
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
      </div>`,document.body.appendChild(n)}}let k="bank_transfer";window.openPayoutEditor=async function(a){const n=g.find(t=>t.id===a);n&&(k=n.payment_method||"bank_transfer",document.getElementById("pe-payout-id").value=a,document.getElementById("pe-amount").value=n.amount||0,document.getElementById("pe-notes").value=n.payout_notes||"",document.getElementById("pe-third-party-name").value=n.third_party_name||"",document.getElementById("pe-third-party-bank").value=n.third_party_bank||"",document.getElementById("pe-third-party-account").value=n.third_party_account||"",document.getElementById("pe-third-party-ref").value=n.third_party_ref||"",window.selectPayoutMethod(k),document.getElementById("payout-editor-modal").classList.remove("hidden"))};window.closePayoutEditor=function(){document.getElementById("payout-editor-modal").classList.add("hidden")};window.selectPayoutMethod=async function(a){k=a,document.querySelectorAll(".pe-method-btn").forEach(t=>{const s=t.dataset.method===a;t.classList.toggle("border-orange-400",s),t.classList.toggle("bg-orange-50",s),t.classList.toggle("border-gray-200",!s)}),document.getElementById("pe-third-party-fields").classList.toggle("hidden",a!=="third_party");const n=document.getElementById("pe-cashsend-info");if(a==="cashsend"){const t=parseFloat(document.getElementById("pe-amount").value||0);if(t>0)try{const d=await(await fetch(`/api/cashsend/fee?amount=${t}`)).json();n.classList.remove("hidden"),n.innerHTML=d.eligible?`CashSend Fee: <strong>R${d.fee.toFixed(2)}</strong> | Net to client: <strong>R${d.net_payout.toFixed(2)}</strong>`:`<span class="text-red-600">${d.reason}</span>`}catch{n.classList.add("hidden")}}else n.classList.add("hidden")};window.savePayoutMethod=async function(){const a=document.getElementById("pe-payout-id").value,n=parseFloat(document.getElementById("pe-amount").value||0),t=k,s=document.getElementById("pe-save-btn");let d=0;if(t==="cashsend"){const e=await(await fetch(`/api/cashsend/fee?amount=${n}`)).json();if(!e.eligible){alert(e.reason);return}d=e.fee}const r={payment_method:t,cashsend_fee:d,third_party_name:document.getElementById("pe-third-party-name").value.trim()||null,third_party_bank:document.getElementById("pe-third-party-bank").value.trim()||null,third_party_account:document.getElementById("pe-third-party-account").value.trim()||null,third_party_ref:document.getElementById("pe-third-party-ref").value.trim()||null,payout_notes:document.getElementById("pe-notes").value.trim()||null};s.textContent="Saving…",s.disabled=!0;try{const{supabase:o}=await j(async()=>{const{supabase:i}=await import("./supabaseClient-DdIec1HK.js");return{supabase:i}},[]),{error:e}=await o.from("payouts").update(r).eq("id",a);if(e)throw e;window.closePayoutEditor(),await h()}catch(o){alert("Save failed: "+o.message)}finally{s.textContent="Save",s.disabled=!1}};const x=(a=!0)=>{a&&(m=1),v=document.getElementById("payout-search-input")?.value.toLowerCase().trim()||"";const n=new Set,t=g.filter(e=>{const i=e.status==="pending_disbursement",l=e.status==="disbursed",y=c==="pending"?i:l,p=!v||(e.profile?.full_name||"").toLowerCase().includes(v)||String(e.id).includes(v);return y&&p&&!n.has(e.application_id)?(n.add(e.application_id),!0):!1}),s=Math.ceil(t.length/$)||1,d=(m-1)*$,r=t.slice(d,d+$);R(r),A(s,t.length);const o=document.getElementById("visible-count");o&&(o.textContent=t.length)};function R(a){const n=document.getElementById("payouts-table-body");if(n){if(a.length===0){n.innerHTML='<tr><td colspan="7" class="p-10 text-center text-sm text-gray-400 italic">No transactions found for the selected view.</td></tr>';return}n.innerHTML=a.map(t=>{const s=u.has(t.id),d=E(t.created_at),r=t.payment_method||"bank_transfer",o=r==="cashsend",e=r==="third_party",i=Number(t.cashsend_fee||0),l={bank_transfer:{label:"Bank Transfer",bg:"bg-blue-50 text-blue-700 border-blue-100"},cashsend:{label:"CashSend",bg:"bg-purple-50 text-purple-700 border-purple-100"},third_party:{label:"Third Party",bg:"bg-orange-50 text-orange-700 border-orange-100"},cash:{label:"Cash",bg:"bg-gray-50 text-gray-700 border-gray-100"}}[r]||{label:r,bg:"bg-gray-50 text-gray-700 border-gray-100"};return`
        <tr class="hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0">
            <td class="px-6 py-4">
                <input type="checkbox" class="payout-checkbox rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer" data-id="${t.id}" ${s?"checked":""}>
            </td>
            <td class="px-6 py-4 text-xs text-gray-600 font-medium whitespace-nowrap">${d}</td>
            <td class="px-6 py-4">
                <div class="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block border border-gray-100">#${t.id.slice(0,8)}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-bold text-gray-900">${e?t.third_party_name||"Third Party":t.profile?.full_name||"N/A"}</div>
                ${e?`<div class="text-[10px] text-orange-600 font-semibold">→ ${t.third_party_bank||""} ${t.third_party_account||""}</div>`:""}
                ${e?"":`<div class="text-[10px] text-gray-400">${t.profile?.full_name||""}</div>`}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-black text-gray-900">${b(t.amount)}</div>
                ${o&&i?`<div class="text-[10px] text-purple-600">Fee: ${b(i)} | Net: ${b(Number(t.amount)-i)}</div>`:""}
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${l.bg}">${l.label}</span>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${c==="pending"?"bg-orange-50 text-orange-600 border-orange-100":"bg-green-50 text-green-600 border-green-100"}">
                    ${c==="pending"?"Pending":"Paid"}
                </span>
            </td>
            <td class="px-6 py-4 text-right flex items-center justify-end gap-2">
                <button onclick="window.openPayoutEditor('${t.id}')" class="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50" title="Edit payout method">
                    <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <a href="/admin/application-detail?id=${t.application_id}" class="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50 inline-block">
                    <i class="fa-solid fa-eye text-xs"></i>
                </a>
            </td>
        </tr>
    `}).join(""),n.querySelectorAll(".payout-checkbox").forEach(t=>{t.addEventListener("change",s=>{const d=parseInt(s.target.dataset.id);s.target.checked?u.add(d):u.delete(d),f()})})}}function f(){const a=document.getElementById("btn-bulk-disburse");if(!a)return;const n=u.size;a.disabled=n===0,n>0?(a.innerHTML=`<i class="fa-solid fa-file-csv"></i> <span class="ml-2">Export & Process (${n})</span>`,a.classList.remove("bg-gray-900"),a.classList.add("bg-orange-600")):(a.innerHTML='<i class="fa-solid fa-file-csv"></i> <span class="ml-2">Export Data</span>',a.classList.add("bg-gray-900"),a.classList.remove("bg-orange-600"))}function A(a,n){const t=document.getElementById("payout-pagination-container");if(t){if(a<=1){t.innerHTML='<div class="p-4 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">End of Records</div>';return}t.innerHTML=`
        <div class="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50">
            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Page ${m} of ${a}</span>
            <div class="flex gap-2">
                <button onclick="window.changePagePayouts(${m-1})" ${m===1?"disabled":""} 
                    class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm text-gray-700">Prev</button>
                <button onclick="window.changePagePayouts(${m+1})" ${m===a?"disabled":""} 
                    class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm text-gray-700">Next</button>
            </div>
        </div>
    `}}window.changePagePayouts=a=>{m=a,x(!1),c==="comparison"&&S()};function N(){document.getElementById("payout-search-input")?.addEventListener("input",()=>x(!0)),document.getElementById("tab-pending")?.addEventListener("click",()=>{c="pending",u.clear(),f(),w(),_(g),x(!0)}),document.getElementById("tab-comparison")?.addEventListener("click",()=>{c="comparison",w(),h().then(()=>S())}),document.getElementById("tab-history")?.addEventListener("click",()=>{c="history",u.clear(),f(),w(),_(g),x(!0)}),document.getElementById("select-all-checkbox")?.addEventListener("change",a=>{document.querySelectorAll(".payout-checkbox").forEach(t=>{t.checked=a.target.checked;const s=parseInt(t.dataset.id);a.target.checked?u.add(s):u.delete(s)}),f()}),document.getElementById("btn-bulk-disburse")?.addEventListener("click",()=>{c==="pending"?U():V()})}function _(a){const t=a.filter(l=>l.status==="disbursed"||l.application?.status==="DISBURSED").reduce((l,y)=>l+Number(y.amount||0),0),s=a.filter(l=>l.status==="pending_disbursement"||l.application?.status==="APPROVED"),d=s.reduce((l,y)=>l+Number(y.amount||0),0),r=s.length,o=document.getElementById("stat-total-disbursed"),e=document.getElementById("stat-pending-value"),i=document.getElementById("stat-pending-queue");o&&(o.textContent=b(t)),e&&(e.textContent=b(d)),i&&(i.textContent=r)}async function U(){if(u.size===0)return;const a=window.prompt(`🔒 Enter the CSV download PIN to generate the Capitec payout file.

This will mark ${u.size} payout(s) as DISBURSED.`,"");if(a===null)return;if(!a.trim()){alert("PIN is required to download the CSV.");return}if(!confirm(`Mark ${u.size} payout(s) as DISBURSED and download Capitec CSV?`))return;const n=g.filter(r=>u.has(r.id)),t=n.map(r=>r.application_id).filter(Boolean),s=document.getElementById("btn-bulk-disburse"),d=s.innerHTML;s.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Generating CSV...',s.disabled=!0;try{const r=await fetch("/api/payouts/capitec-csv",{method:"POST",headers:{"Content-Type":"application/json","x-csv-pin":a.trim()},body:JSON.stringify({applicationIds:t,markDisbursed:!0})});if(!r.ok){const l=await r.json().catch(()=>({error:"Unknown error"}));throw new Error(l.error||`Server error ${r.status}`)}const o=await r.blob(),e=URL.createObjectURL(o),i=document.createElement("a");i.href=e,i.download=`capitec_payout_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(e),alert(`${n.length} payout(s) marked as DISBURSED and CSV downloaded.`),u.clear(),await h()}catch(r){console.error("Capitec CSV error:",r),alert(`CSV generation failed: ${r.message}`),await h()}finally{s.innerHTML=d,s.disabled=!1}}function S(){const a=document.querySelector(".overflow-auto.custom-scrollbar");if(!a)return;const n=g.filter(r=>r.status==="DISBURSED"||r.status==="APPROVED"),t={};n.forEach(r=>{const o=new Date(r.created_at||r.approved_at),e=`${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,"0")}`,i=o.toLocaleDateString("en-ZA",{year:"numeric",month:"long"});t[e]||(t[e]={label:i,count:0,total:0,items:[]}),t[e].count++,t[e].total+=Number(r.amount||0),t[e].items.push(r)});const s=Object.keys(t).sort().reverse(),d=n.reduce((r,o)=>r+Number(o.amount||0),0);if(!s.length){a.innerHTML='<div class="p-16 text-center text-sm text-gray-400">No disbursement history yet.</div>';return}a.innerHTML=`
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
            ${s.map((r,o)=>{const e=t[r],i=s[o+1]?t[s[o+1]]:null,l=i?(e.total-i.total)/i.total*100:null,y=e.count?e.total/e.count:0,p=l>0;return`
                <tr class="hover:bg-orange-50/30 transition-colors">
                  <td class="px-4 py-3 font-semibold text-gray-800">${e.label}</td>
                  <td class="px-4 py-3 text-right text-gray-600">${e.count}</td>
                  <td class="px-4 py-3 text-right font-bold text-gray-900">${b(e.total)}</td>
                  <td class="px-4 py-3 text-right text-gray-500">${b(y)}</td>
                  <td class="px-4 py-3 text-right">
                    ${l!==null?`<span class="font-bold ${p?"text-green-600":"text-red-500"}">${p?"▲":"▼"} ${Math.abs(l).toFixed(1)}%</span>`:'<span class="text-gray-300">—</span>'}
                  </td>
                </tr>`}).join("")}
          </tbody>
          <tfoot>
            <tr class="bg-gray-900 text-white font-bold text-sm">
              <td class="px-4 py-3 rounded-bl-xl">ALL TIME</td>
              <td class="px-4 py-3 text-right">${n.length}</td>
              <td class="px-4 py-3 text-right">${b(d)}</td>
              <td class="px-4 py-3 text-right">${b(n.length?d/n.length:0)}</td>
              <td class="px-4 py-3 rounded-br-xl"></td>
            </tr>
          </tfoot>
        </table>

        <!-- Per-month detail breakdown -->
        <div class="mt-6 space-y-3">
          ${s.slice(0,3).map(r=>{const o=t[r];return`
              <details class="border border-gray-100 rounded-xl overflow-hidden">
                <summary class="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 flex justify-between">
                  <span>${o.label} — ${o.count} payouts</span>
                  <span class="font-bold" style="color:var(--color-primary)">${b(o.total)}</span>
                </summary>
                <table class="w-full text-xs">
                  <thead><tr class="bg-gray-50 text-gray-400 font-bold uppercase">
                    <th class="px-4 py-2 text-left">Client</th>
                    <th class="px-4 py-2 text-right">Amount</th>
                    <th class="px-4 py-2 text-right">Date</th>
                  </tr></thead>
                  <tbody class="divide-y divide-gray-50">
                    ${o.items.map(e=>`
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-2 text-gray-700">${e.profile?.full_name||"—"}</td>
                      <td class="px-4 py-2 text-right font-semibold text-gray-900">${b(e.amount)}</td>
                      <td class="px-4 py-2 text-right text-gray-400">${E(e.created_at)}</td>
                    </tr>`).join("")}
                  </tbody>
                </table>
              </details>`}).join("")}
        </div>
      </div>`}window.exportComparisonCSV=function(){const a=g.filter(e=>e.status==="DISBURSED"||e.status==="APPROVED"),n=["Month","Client Name","Amount","Date","Reference","Bank","Account Number"],t=a.map(e=>[`"${new Date(e.created_at).toLocaleDateString("en-ZA",{year:"numeric",month:"long"})}"`,`"${(e.profile?.full_name||"").replace(/"/g,'""')}"`,e.amount||0,E(e.created_at),`"${e.id}"`,`"${e.application?.bank_account?.bank_name||""}"`,`"${e.application?.bank_account?.account_number||""}"`].join(",")),s=[n.join(","),...t].join(`
`),d=new Blob([s],{type:"text/csv;charset=utf-8;"}),r=URL.createObjectURL(d),o=document.createElement("a");o.href=r,o.download=`payout_comparison_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(r)};function V(){if(u.size===0)return;const a=g.filter(t=>u.has(t.id));O(a),u.clear(),f();const n=document.getElementById("select-all-checkbox");n&&(n.checked=!1),document.querySelectorAll(".payout-checkbox").forEach(t=>t.checked=!1)}function O(a){const n=["Payout ID","Recipient","Amount","Status","Date","Application ID","Bank","Account"],t=a.map(e=>[e.id,`"${e.profile?.full_name||"N/A"}"`,e.amount,c==="pending"?"Pending":"Paid",E(e.created_at),e.application_id,`"${e.application?.bank_account?.bank_name||"N/A"}"`,`"${e.application?.bank_account?.account_number||"N/A"}"`]),s=[n.join(","),...t.map(e=>e.join(","))].join(`
`),d=new Blob([s],{type:"text/csv;charset=utf-8;"}),r=URL.createObjectURL(d),o=document.createElement("a");o.href=r,o.download=`payout_export_${c}_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(o),o.click(),document.body.removeChild(o)}async function h(){try{const{data:a,error:n}=await B();if(n)throw n;g=a,_(g),x(!0)}catch(a){console.error("Payout Load Error:",a)}}document.addEventListener("DOMContentLoaded",async()=>{const a=await C();a&&(a.role,await D(),w(),await h())});
