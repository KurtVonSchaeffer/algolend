import"./supabaseClient-Ki9k9WNi.js";import{i as L}from"./layout-P4Epjfxm.js";/* empty css               */import{b as E,a as m}from"./utils-D6Z1B7Jq.js";import{o as D,A as S,B,t as $}from"./dataService-OY041MzK.js";let u=[],o=new Set,c="pending",y="",l=1;const h=20;function v(){const t=document.getElementById("main-content");t&&(t.innerHTML=`
    <div id="payout-list-view" class="flex flex-col h-full animate-fade-in space-y-6">
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Disbursed</p>
                <h2 id="stat-total-disbursed" class="text-3xl font-black text-gray-900 mt-2">R 0.00</h2>
            </div>
            <div class="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-xl shadow-sm">
                <i class="fa-solid fa-money-bill-wave"></i>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending Value</p>
                <h2 id="stat-pending-value" class="text-3xl font-black text-yellow-600 mt-2">R 0.00</h2>
            </div>
            <div class="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center text-xl shadow-sm">
                <i class="fa-solid fa-clock"></i>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending Queue</p>
                <h2 id="stat-pending-queue" class="text-3xl font-black text-gray-900 mt-2">0</h2>
            </div>
            <div class="w-12 h-12 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center text-xl shadow-sm">
                <i class="fa-solid fa-list-check"></i>
            </div>
        </div>

      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden flex-1 min-h-0">
        
        <div class="p-6 border-b border-gray-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
                <h3 class="text-lg font-bold text-gray-900 uppercase tracking-tight">Transaction View</h3>
                <div class="flex gap-6 mt-2">
                    <button id="tab-pending" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${c==="pending"?"text-orange-600 border-orange-600":"text-gray-400 border-transparent hover:text-gray-600"}">
                        Ready to Pay
                    </button>
                    <button id="tab-history" class="text-xs font-bold uppercase transition-colors pb-1 border-b-2 ${c==="history"?"text-orange-600 border-orange-600":"text-gray-400 border-transparent hover:text-gray-600"}">
                        Paid History
                    </button>
                </div>
            </div>
            
            <div class="flex items-center gap-3 w-full lg:w-auto">
                <div class="relative flex-1 lg:w-64">
                    <input type="text" id="payout-search-input" placeholder="Search ID or Name..." 
                           class="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-orange-500 text-sm focus:bg-white transition-colors">
                    <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
                </div>
                <button id="btn-bulk-disburse" class="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black disabled:opacity-30 transition-all flex items-center gap-2 shadow-sm" disabled>
                    <i class="fa-solid fa-file-csv"></i> <span>Export Data</span>
                </button>
            </div>
        </div>

        <div class="overflow-auto custom-scrollbar flex-1">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                    <th class="px-6 py-4 text-left w-10">
                        <input type="checkbox" id="select-all-checkbox" class="rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer">
                    </th>
                    <th class="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                    <th class="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transaction ID</th>
                    <th class="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recipient</th>
                    <th class="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                    <th class="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th class="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
            </thead>
            <tbody id="payouts-table-body" class="bg-white divide-y divide-gray-50">
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
  `,T())}const b=(t=!0)=>{t&&(l=1),y=document.getElementById("payout-search-input")?.value.toLowerCase().trim()||"";const a=new Set,e=u.filter(s=>{const f=s.status==="pending_disbursement",d=s.status==="disbursed",g=c==="pending"?f:d,I=!y||(s.profile?.full_name||"").toLowerCase().includes(y)||String(s.id).includes(y);return g&&I&&!a.has(s.application_id)?(a.add(s.application_id),!0):!1}),n=Math.ceil(e.length/h)||1,i=(l-1)*h,p=e.slice(i,i+h);_(p),A(n,e.length);const r=document.getElementById("visible-count");r&&(r.textContent=e.length)};function _(t){const a=document.getElementById("payouts-table-body");if(a){if(t.length===0){a.innerHTML='<tr><td colspan="7" class="p-10 text-center text-sm text-gray-400 italic">No transactions found for the selected view.</td></tr>';return}a.innerHTML=t.map(e=>{const n=o.has(e.id),i=E(e.created_at);return`
        <tr class="hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0">
            <td class="px-6 py-4">
                <input type="checkbox" class="payout-checkbox rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer" data-id="${e.id}" ${n?"checked":""}>
            </td>
            <td class="px-6 py-4 text-xs text-gray-600 font-medium whitespace-nowrap">
                ${i}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block border border-gray-100">
                    #${e.id}
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-bold text-gray-900">${e.profile?.full_name||"N/A"}</div>
                <div class="text-[10px] text-gray-400">App ID: ${e.application_id}</div>
            </td>
            <td class="px-6 py-4 text-xs font-black text-gray-900">
                ${m(e.amount)}
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${c==="pending"?"bg-orange-50 text-orange-600 border-orange-100":"bg-green-50 text-green-600 border-green-100"}">
                    ${c==="pending"?"Pending":"Paid"}
                </span>
            </td>
            <td class="px-6 py-4 text-right">
                <a href="/admin/application-detail?id=${e.application_id}" class="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50 inline-block">
                    <i class="fa-solid fa-eye"></i>
                </a>
            </td>
        </tr>
    `}).join(""),a.querySelectorAll(".payout-checkbox").forEach(e=>{e.addEventListener("change",n=>{const i=parseInt(n.target.dataset.id);n.target.checked?o.add(i):o.delete(i),x()})})}}function x(){const t=document.getElementById("btn-bulk-disburse");if(!t)return;const a=o.size;t.disabled=a===0,a>0?(t.innerHTML=`<i class="fa-solid fa-file-csv"></i> <span class="ml-2">Export & Process (${a})</span>`,t.classList.remove("bg-gray-900"),t.classList.add("bg-orange-600")):(t.innerHTML='<i class="fa-solid fa-file-csv"></i> <span class="ml-2">Export Data</span>',t.classList.add("bg-gray-900"),t.classList.remove("bg-orange-600"))}function A(t,a){const e=document.getElementById("payout-pagination-container");if(e){if(t<=1){e.innerHTML='<div class="p-4 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">End of Records</div>';return}e.innerHTML=`
        <div class="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50">
            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Page ${l} of ${t}</span>
            <div class="flex gap-2">
                <button onclick="window.changePagePayouts(${l-1})" ${l===1?"disabled":""} 
                    class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm text-gray-700">Prev</button>
                <button onclick="window.changePagePayouts(${l+1})" ${l===t?"disabled":""} 
                    class="px-3 py-1 text-[10px] font-bold border rounded-lg bg-white disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm text-gray-700">Next</button>
            </div>
        </div>
    `}}window.changePagePayouts=t=>{l=t,b(!1)};function T(){document.getElementById("payout-search-input")?.addEventListener("input",()=>b(!0)),document.getElementById("tab-pending")?.addEventListener("click",()=>{c="pending",o.clear(),x(),v(),w(u),b(!0)}),document.getElementById("tab-history")?.addEventListener("click",()=>{c="history",o.clear(),x(),v(),w(u),b(!0)}),document.getElementById("select-all-checkbox")?.addEventListener("change",t=>{document.querySelectorAll(".payout-checkbox").forEach(e=>{e.checked=t.target.checked;const n=parseInt(e.dataset.id);t.target.checked?o.add(n):o.delete(n)}),x()}),document.getElementById("btn-bulk-disburse")?.addEventListener("click",()=>{c==="pending"?C():M()})}function w(t){const e=t.filter(d=>d.status==="disbursed"||d.application?.status==="DISBURSED").reduce((d,g)=>d+Number(g.amount||0),0),n=t.filter(d=>d.status==="pending_disbursement"||d.application?.status==="READY_TO_DISBURSE"),i=n.reduce((d,g)=>d+Number(g.amount||0),0),p=n.length,r=document.getElementById("stat-total-disbursed"),s=document.getElementById("stat-pending-value"),f=document.getElementById("stat-pending-queue");r&&(r.textContent=m(e)),s&&(s.textContent=m(i)),f&&(f.textContent=p)}async function C(){if(o.size===0||!confirm(`Are you sure you want to mark ${o.size} items as DISBURSED and download the CSV?`))return;const t=u.filter(n=>o.has(n.id));P(t);const a=document.getElementById("btn-bulk-disburse"),e=a.innerHTML;a.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...',a.disabled=!0;try{for(const n of t)await B(n.id),await $(n.application_id,"DISBURSED");alert("Disbursement processed successfully!"),o.clear(),await k()}catch(n){console.error(n),alert("Some updates failed. Please refresh and check."),await k()}finally{a.innerHTML=e}}function M(){if(o.size===0)return;const t=u.filter(e=>o.has(e.id));P(t),o.clear(),x();const a=document.getElementById("select-all-checkbox");a&&(a.checked=!1),document.querySelectorAll(".payout-checkbox").forEach(e=>e.checked=!1)}function P(t){const a=["Payout ID","Recipient","Amount","Status","Date","Application ID","Bank","Account"],e=t.map(s=>[s.id,`"${s.profile?.full_name||"N/A"}"`,s.amount,c==="pending"?"Pending":"Paid",E(s.created_at),s.application_id,`"${s.application?.bank_account?.bank_name||"N/A"}"`,`"${s.application?.bank_account?.account_number||"N/A"}"`]),n=[a.join(","),...e.map(s=>s.join(","))].join(`
`),i=new Blob([n],{type:"text/csv;charset=utf-8;"}),p=URL.createObjectURL(i),r=document.createElement("a");r.href=p,r.download=`payout_export_${c}_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(r),r.click(),document.body.removeChild(r)}async function k(){try{const{data:t,error:a}=await S();if(a)throw a;u=t,w(u),b(!0)}catch(t){console.error("Payout Load Error:",t)}}document.addEventListener("DOMContentLoaded",async()=>{const t=await L();t&&(t.role,await D(),v(),await k())});
