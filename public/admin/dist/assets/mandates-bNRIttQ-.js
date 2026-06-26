import"./supabaseClient-BXSct5lo.js";/* empty css              *//* empty css               */import{i as R}from"./layout-l3iKOyZ9.js";import{a as q}from"./apiFetch-CEHFyE_J.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";import"./theme-CYs9TE7o.js";const s={mandates:[],currentMandate:null,currentFilter:"all",config:null,diagnosticsOpen:!1},_={success:"Bank approved",failed:"Rejected",pending:"Awaiting bank",unknown:"Not sent"},D={success:{bg:"bg-green-50",text:"text-green-800",border:"border-green-200",dot:"bg-green-500"},failed:{bg:"bg-red-50",text:"text-red-800",border:"border-red-200",dot:"bg-red-500"},pending:{bg:"bg-amber-50",text:"text-amber-800",border:"border-amber-200",dot:"bg-amber-400"},unknown:{bg:"bg-gray-100",text:"text-gray-600",border:"border-gray-200",dot:"bg-gray-400"}};function v(t){const e=(t||"").toLowerCase();return e==="success"?"success":e==="failed"?"failed":e==="pending"?"pending":"unknown"}const g=(t="")=>`${t}`.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),E=t=>{if(!t)return"No data recorded.";try{return JSON.stringify(t,null,2)}catch{return String(t)}},N=t=>{if(!t)return"—";const e=new Date(t);return Number.isNaN(e.getTime())?"—":e.toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"})},A=t=>{const e=Number(t);return Number.isFinite(e)?`R ${e.toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"R 0.00"};function x(t,e){if(!t)return()=>{};const n=t.innerHTML;return t.disabled=!0,t.innerHTML=`<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>${e}`,()=>{t.disabled=!1,t.innerHTML=n}}async function p(t,e={}){const n=await fetch(t,e),a=await n.json().catch(()=>({}));if(!n.ok||a.success===!1){const r=new Error(a.error||a.message||`Request failed (${n.status})`);throw r.status=n.status,r.details=a.details||null,r.payload=a,r}return a}const b=[];function d(t,e=null,n="info"){b.unshift({at:new Date().toISOString(),label:t,payload:e,level:n}),b.length>120&&(b.length=120),I()}function I(){const t=document.getElementById("diag-log-output");if(t){if(!b.length){t.textContent="No logs yet.";return}t.textContent=b.map(e=>{const n=new Date(e.at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),a=e.payload?E(e.payload):"";return`[${n}] [${e.level.toUpperCase()}] ${e.label}${a?`
${a}`:""}`}).join(`

`)}}function y(t,e,n="idle"){const a=document.getElementById("diag-lab-output"),r=document.getElementById("diag-lab-badge");if(a&&(a.textContent=typeof e=="string"?e:E(e)),r){const o={idle:"bg-gray-800 text-gray-200",success:"bg-green-900 text-green-100",error:"bg-red-900 text-red-100",info:"bg-blue-900 text-blue-100"};r.className=`px-2.5 py-1 rounded-full text-[10px] font-bold ${o[n]||o.idle}`,r.textContent=t}}function F(){return`
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p class="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">DebiCheck / SureSystems</p>
          <h1 class="text-2xl font-extrabold text-gray-900">Mandates</h1>
        </div>
        <div class="flex gap-3">
          <button id="refresh-btn" class="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition font-semibold text-sm flex items-center gap-2 shadow-sm">
            <i class="fa-solid fa-rotate-right"></i> Refresh
          </button>
          <button id="btn-sync-mandates" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl transition font-semibold text-sm flex items-center gap-2 shadow-sm">
            <i class="fa-solid fa-cloud-arrow-down"></i> Load from SureSystems
          </button>
        </div>
      </div>

      <!-- Health banner -->
      <div id="health-banner" class="mb-6"></div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" id="summary-cards"></div>

      <!-- Mandate table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h2 class="text-base font-bold text-gray-900">All Mandates</h2>
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="relative">
              <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input id="mandate-search" type="text" placeholder="Search name, ref, app ID…"
                class="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none w-64">
            </div>
            <div class="flex gap-2">
              <button class="filter-btn active px-3 py-1.5 rounded-full text-xs font-bold bg-gray-900 text-white" data-filter="all">All</button>
              <button class="filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="pending">Awaiting bank</button>
              <button class="filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="success">Approved</button>
              <button class="filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600" data-filter="failed">Rejected</button>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Applicant</th>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                <th class="px-5 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody id="mandates-tbody" class="bg-white divide-y divide-gray-100">
              <tr><td colspan="5" class="px-5 py-12 text-center text-gray-400">
                <i class="fa-solid fa-spinner fa-spin text-xl mb-2 text-orange-400 block"></i>Loading…
              </td></tr>
            </tbody>
          </table>
        </div>
        <div id="empty-state" class="hidden px-5 py-12 text-center text-gray-500">
          <i class="fa-solid fa-folder-open text-3xl text-gray-300 block mb-3"></i>
          No mandates match your filters.
        </div>
      </div>

      <!-- Diagnostics toggle -->
      <div class="mb-2">
        <button id="toggle-diagnostics" class="text-sm font-semibold text-gray-400 hover:text-gray-700 transition flex items-center gap-2">
          <i id="diag-chevron" class="fa-solid fa-chevron-right text-xs transition-transform"></i>
          Advanced diagnostics
        </button>
      </div>

      <!-- Diagnostics panel (hidden by default) -->
      <div id="diagnostics-panel" class="hidden space-y-6">

        <!-- Test lab -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <h2 class="text-sm font-bold text-gray-900">Payload Test Lab</h2>
            <p class="text-xs text-gray-500 mt-0.5">Preview or dry-run mandate payloads without hitting SureSystems live.</p>
          </div>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Application ID</span>
              <input id="diag-application-id" type="number" min="1" placeholder="e.g. 1234"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Collection Date</span>
              <input id="diag-collection-date" type="date"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Contract Reference (override)</span>
              <input id="diag-contract-reference" type="text" placeholder="Optional"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <label class="block">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Front End User</span>
              <input id="diag-front-end-user" type="text" placeholder="webuser"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
            </label>
            <div class="md:col-span-2 flex flex-wrap gap-3">
              <button id="btn-dry-run" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition shadow-sm">
                <i class="fa-solid fa-flask-vial mr-1.5"></i> Dry-run payload
              </button>
              <button id="btn-direct-load" class="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition shadow-sm">
                <i class="fa-solid fa-plug-circle-bolt mr-1.5"></i> Hit DebiCheck endpoint
              </button>
              <button id="btn-connectivity-probe" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 transition shadow-sm">
                <i class="fa-solid fa-network-wired mr-1.5"></i> Test connectivity
              </button>
            </div>
            <div class="md:col-span-2 rounded-xl border border-gray-200 bg-gray-950 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Output</span>
                <span id="diag-lab-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-200">Idle</span>
              </div>
              <pre id="diag-lab-output" class="text-xs text-green-400 font-mono whitespace-pre-wrap break-words min-h-[180px]">Use the buttons above to inspect payloads or run a connectivity probe.</pre>
            </div>
          </div>
        </div>

        <!-- Dev log -->
        <div class="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800">
          <div class="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Request log</span>
            <button id="btn-clear-logs" class="text-xs font-semibold text-gray-400 hover:text-gray-200 transition">Clear</button>
          </div>
          <pre id="diag-log-output" class="text-xs text-emerald-300 font-mono whitespace-pre-wrap break-words p-5 min-h-[140px] max-h-[320px] overflow-y-auto">No logs yet.</pre>
        </div>

      </div>

    </div>

    <!-- Mandate detail modal -->
    <div id="mandate-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-transform duration-200 scale-95">

        <!-- Modal header -->
        <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 class="text-lg font-bold text-gray-900">Mandate details</h2>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 transition">
            <i class="fa-solid fa-times fa-lg"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-5">

          <!-- Status banner -->
          <div id="modal-status-banner" class="rounded-xl px-4 py-3 flex items-center gap-3 border">
            <span id="modal-status-dot" class="w-2.5 h-2.5 rounded-full flex-shrink-0"></span>
            <div>
              <div id="modal-status-label" class="font-bold text-sm"></div>
              <div id="modal-status-msg" class="text-xs opacity-80 mt-0.5"></div>
            </div>
          </div>

          <!-- Key fields -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Applicant</div>
              <div id="modal-applicant" class="font-semibold text-gray-900 truncate"></div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Amount</div>
              <div id="modal-amount" class="font-semibold text-gray-900"></div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Contract ref</div>
              <div id="modal-contract-ref" class="font-mono text-xs text-gray-700 truncate"></div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Last updated</div>
              <div id="modal-updated" class="text-gray-700"></div>
            </div>
          </div>

          <!-- Action buttons -->
          <div id="modal-actions" class="flex flex-wrap gap-2"></div>

          <!-- Raw payload (collapsed) -->
          <div>
            <button id="toggle-raw-payload" class="text-xs font-semibold text-gray-400 hover:text-gray-600 transition flex items-center gap-1.5">
              <i id="raw-chevron" class="fa-solid fa-chevron-right text-[10px] transition-transform"></i>
              Raw payload
            </button>
            <div id="raw-payload-panel" class="hidden mt-3 space-y-3">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Request</div>
                <div class="bg-gray-950 rounded-xl p-3 overflow-x-auto max-h-48">
                  <pre id="modal-req-payload" class="text-[11px] text-green-400 font-mono whitespace-pre-wrap break-words"></pre>
                </div>
              </div>
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Response</div>
                <div class="bg-gray-950 rounded-xl p-3 overflow-x-auto max-h-48">
                  <pre id="modal-res-payload" class="text-[11px] text-blue-400 font-mono whitespace-pre-wrap break-words"></pre>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="px-6 py-4 border-t border-gray-100 flex justify-end">
          <a id="modal-open-app" href="#" class="text-sm font-semibold text-orange-600 hover:text-orange-700 transition flex items-center gap-1.5">
            Open application <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
          </a>
        </div>
      </div>
    </div>
  `}function U(){const t=document.getElementById("health-banner");if(!t)return;const e=s.config;if(!e){t.innerHTML="";return}const n=!!e.configured;t.innerHTML=`
    <div class="rounded-xl border ${n?"border-green-200 bg-green-50":"border-red-200 bg-red-50"} px-4 py-3 flex items-center gap-3">
      <i class="fa-solid ${n?"fa-circle-check text-green-600":"fa-circle-exclamation text-red-600"} text-lg flex-shrink-0"></i>
      <div class="flex-1 min-w-0">
        <span class="font-bold text-sm ${n?"text-green-900":"text-red-900"}">
          ${n?"SureSystems is configured and ready":"SureSystems is not fully configured"}
        </span>
        <span class="text-xs ${n?"text-green-700":"text-red-700"} ml-2">
          ${n?`Merchant ${g(e.merchantGid||"")} · ${e.useMtls?"mTLS on":"mTLS off"}`:`Missing: ${g((e.missing||[]).join(", ")||"unknown fields")}`}
        </span>
      </div>
      <button id="refresh-health-btn" class="text-xs font-semibold ${n?"text-green-700 hover:text-green-900":"text-red-700 hover:text-red-900"} transition flex-shrink-0">
        Re-check
      </button>
    </div>
  `,document.getElementById("refresh-health-btn")?.addEventListener("click",B)}function J(){const t=document.getElementById("summary-cards");if(!t)return;const e={total:s.mandates.length,success:0,pending:0,failed:0};s.mandates.forEach(a=>{const r=v(a.status);r==="success"?e.success++:r==="failed"?e.failed++:e.pending++});const n=[{label:"Total mandates",value:e.total,cls:"border-gray-200 text-gray-900"},{label:"Bank approved",value:e.success,cls:"border-green-200 bg-green-50 text-green-900"},{label:"Awaiting bank",value:e.pending,cls:"border-amber-200 bg-amber-50 text-amber-900"},{label:"Rejected / failed",value:e.failed,cls:"border-red-200 bg-red-50 text-red-900"}];t.innerHTML=n.map(a=>`
    <div class="rounded-2xl border ${a.cls} bg-white p-5 shadow-sm">
      <div class="text-2xl font-extrabold">${a.value}</div>
      <div class="text-xs font-semibold text-current opacity-70 mt-1">${a.label}</div>
    </div>
  `).join("")}function Z(){const t=(document.getElementById("mandate-search")?.value||"").trim().toLowerCase();return s.mandates.filter(e=>{const n=v(e.status),a=s.currentFilter==="all"||n===s.currentFilter,r=[e.profiles?.full_name,e.profiles?.email,e.contract_reference,e.application_id,e.message].filter(Boolean).join(" ").toLowerCase();return a&&(!t||r.includes(t))})}function L(){const t=document.getElementById("mandates-tbody"),e=document.getElementById("empty-state");if(!t||!e)return;const n=Z();if(!n.length){t.innerHTML="",e.classList.remove("hidden");return}e.classList.add("hidden"),t.innerHTML=n.map(a=>{const r=v(a.status),o=D[r],i=_[r],c=a.profiles?.full_name||"Unknown",u=a.loan_applications?.amount?A(a.loan_applications.amount):"—",w=!!a.contract_reference,m=[];return r!=="success"&&m.push(`<button class="row-action-btn text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition whitespace-nowrap"
        data-id="${g(a.id)}" data-action="retry">
        <i class="fa-solid fa-rotate-right mr-1"></i>Send / Retry
      </button>`),w&&m.push(`<button class="row-action-btn text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition whitespace-nowrap"
        data-id="${g(a.id)}" data-action="enquiry">
        <i class="fa-solid fa-rotate mr-1"></i>Check status
      </button>`),`
      <tr class="hover:bg-gray-50 transition-colors cursor-pointer mandate-row" data-id="${g(a.id)}">
        <td class="px-5 py-4">
          <div class="font-semibold text-sm text-gray-900">${g(c)}</div>
          <div class="text-xs text-gray-400 mt-0.5">App ${g(String(a.application_id||"—"))}</div>
        </td>
        <td class="px-5 py-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${o.bg} ${o.text} border ${o.border}">
            <span class="w-1.5 h-1.5 rounded-full ${o.dot}"></span>
            ${i}
          </span>
        </td>
        <td class="px-5 py-4 text-sm font-medium text-gray-900">${u}</td>
        <td class="px-5 py-4 text-sm text-gray-500">${N(a.updated_at)}</td>
        <td class="px-5 py-4 text-right">
          <div class="flex items-center justify-end gap-2">
            ${m.join("")}
            <button class="mandate-row text-gray-300 hover:text-gray-500 transition" data-id="${g(a.id)}">
              <i class="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `}).join(""),document.querySelectorAll("tr.mandate-row").forEach(a=>{a.addEventListener("click",r=>{r.target.closest(".row-action-btn")||j(a.dataset.id)})}),document.querySelectorAll(".row-action-btn").forEach(a=>{a.addEventListener("click",r=>{r.stopPropagation();const o=a.dataset.id,i=a.dataset.action,c=s.mandates.find(u=>String(u.id)===String(o));c&&(s.currentMandate=c,i==="retry"&&O(a),i==="enquiry"&&S(a,"enquiry"))})})}function z(t){const e=v(t.status),n=!!t.contract_reference,a=[];return e!=="success"&&a.push(`<button id="modal-btn-retry"
      class="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 transition">
      <i class="fa-solid fa-rotate-right mr-1.5"></i>Send / Retry mandate
    </button>`),n&&(a.push(`<button id="modal-btn-check"
      class="px-4 py-2 rounded-xl bg-sky-50 text-sky-700 font-bold text-sm hover:bg-sky-100 border border-sky-200 transition">
      <i class="fa-solid fa-rotate mr-1.5"></i>Check status
    </button>`),a.push(`<button id="modal-btn-finalfate"
      class="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-sm hover:bg-indigo-100 border border-indigo-200 transition">
      <i class="fa-solid fa-satellite-dish mr-1.5"></i>Confirm fate
    </button>`),a.push(`<button id="modal-btn-cancel"
      class="px-4 py-2 rounded-xl bg-red-50 text-red-700 font-bold text-sm hover:bg-red-100 border border-red-200 transition">
      <i class="fa-solid fa-ban mr-1.5"></i>Cancel mandate
    </button>`)),a.join("")}function j(t){const e=s.mandates.find(l=>String(l.id)===String(t));if(!e)return;s.currentMandate=e;const n=v(e.status),a=D[n],r=document.getElementById("modal-status-banner");r&&(r.className=`rounded-xl px-4 py-3 flex items-center gap-3 border ${a.bg} ${a.text} ${a.border}`);const o=document.getElementById("modal-status-dot");o&&(o.className=`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.dot}`);const i=document.getElementById("modal-status-label");i&&(i.textContent=_[n]);const c=document.getElementById("modal-status-msg");c&&(c.textContent=e.message||"No message recorded.");const u=(l,H)=>{const M=document.getElementById(l);M&&(M.textContent=H)};u("modal-applicant",e.profiles?.full_name||e.user_id||"—"),u("modal-amount",e.loan_applications?.amount?A(e.loan_applications.amount):"—"),u("modal-contract-ref",e.contract_reference||"No contract reference"),u("modal-updated",N(e.updated_at));const w=document.getElementById("modal-req-payload"),m=document.getElementById("modal-res-payload");w&&(w.textContent=E(e.request_payload)),m&&(m.textContent=E(e.error_payload||e.response_payload),m.className=`text-[11px] font-mono whitespace-pre-wrap break-words ${n==="failed"?"text-red-400":"text-blue-400"}`);const T=document.getElementById("modal-open-app");T&&(T.href=e.application_id?`/admin/application-detail?id=${e.application_id}`:"#");const C=document.getElementById("modal-actions");C&&(C.innerHTML=z(e),document.getElementById("modal-btn-retry")?.addEventListener("click",l=>O(l.target.closest("button"))),document.getElementById("modal-btn-check")?.addEventListener("click",l=>S(l.target.closest("button"),"enquiry")),document.getElementById("modal-btn-finalfate")?.addEventListener("click",l=>S(l.target.closest("button"),"finalfate")),document.getElementById("modal-btn-cancel")?.addEventListener("click",l=>G(l.target.closest("button")))),document.getElementById("raw-payload-panel")?.classList.add("hidden");const $=document.getElementById("raw-chevron");$&&($.style.transform="");const k=document.getElementById("mandate-modal");k&&(k.classList.remove("hidden"),k.classList.add("flex"),setTimeout(()=>k.firstElementChild?.classList.remove("scale-95"),10))}function h(){const t=document.getElementById("mandate-modal");t&&(t.firstElementChild?.classList.add("scale-95"),setTimeout(()=>{t.classList.add("hidden"),t.classList.remove("flex"),s.currentMandate=null},200))}async function O(t){const e=s.currentMandate;if(!e?.application_id){window.showToast?.("No application ID on this record","error");return}const n=x(t,"Sending…");try{const a=await p("/api/suresystems/activate-application",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:e.application_id})});d("Mandate sent",a,"success"),window.showToast?.(a.message||"Mandate sent to bank","success"),await f(),h()}catch(a){d("Send mandate failed",{error:a.message,details:a.details},"error"),window.showToast?.(a.message||"Failed to send mandate","error")}finally{n()}}async function S(t,e){const n=s.currentMandate;if(!n?.contract_reference){window.showToast?.("No contract reference on this record","error");return}const r=x(t,e==="finalfate"?"Confirming…":"Checking…");try{const o=await p("/api/suresystems/mandates/check-status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:n.application_id||null,contractReference:n.contract_reference,frontEndUserName:n.profiles?.email||"webuser",mode:e})});d(`Status check (${e})`,o,"success"),window.showToast?.(o.message||"Status updated","success"),await f();const i=s.mandates.find(c=>String(c.id)===String(n.id));i?(s.currentMandate=i,j(i.id)):h()}catch(o){d(`Status check failed (${e})`,{error:o.message},"error"),window.showToast?.(o.message||"Status check failed","error")}finally{r()}}async function G(t){const e=s.currentMandate;if(!e?.contract_reference){window.showToast?.("No contract reference on this record","error");return}if(!confirm(`Cancel the mandate for ${e.profiles?.full_name||"this applicant"}? This cannot be undone.`))return;const n=x(t,"Cancelling…");try{const a=await p("/api/suresystems/mandates/cancel-record",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:e.application_id||null,contractReference:e.contract_reference,frontEndUserName:e.profiles?.email||"webuser"})});d("Mandate cancelled",a,"success"),window.showToast?.(a.message||"Mandate cancelled","success"),await f(),h()}catch(a){d("Cancel failed",{error:a.message},"error"),window.showToast?.(a.message||"Cancel failed","error")}finally{n()}}function P(){const t=document.getElementById("diag-contract-reference")?.value?.trim(),e=document.getElementById("diag-collection-date")?.value||"",n=e?e.replace(/-/g,""):"",a=document.getElementById("diag-front-end-user")?.value?.trim();return{...t?{contractReference:t}:{},...n?{collectionDate:n}:{},...a?{frontEndUserName:a}:{}}}async function K(){const t=document.getElementById("btn-dry-run"),e=x(t,"Preparing…");try{const n=Number(document.getElementById("diag-application-id")?.value||0)||null,a=await p("/api/suresystems/mandates/test-payload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:n,overrides:P()})});d("Dry-run",a,"success"),y(a.warnings?.length?"Preview with warnings":"Preview ready",a,a.warnings?.length?"info":"success")}catch(n){d("Dry-run failed",{error:n.message},"error"),y("Preview failed",{error:n.message,details:n.details},"error")}finally{e()}}async function Q(){const t=document.getElementById("btn-direct-load"),e=x(t,"Sending…");try{const n=Number(document.getElementById("diag-application-id")?.value||0);if(!n)throw new Error("Application ID is required.");const a=await p("/api/suresystems/mandates/load-direct",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:n,overrides:P()})});d("Direct provider load",a,"success"),y("Load complete",a,"success"),window.showToast?.(a.message||"Load completed","success"),await f()}catch(n){d("Direct load failed",{error:n.message},"error"),y("Load failed",{error:n.message,details:n.details},"error"),window.showToast?.(n.message||"Load failed","error")}finally{e()}}async function V(){const t=document.getElementById("btn-connectivity-probe"),e=x(t,"Probing…");try{const n=await p("/api/suresystems/debug/connectivity");d("Connectivity probe",n,n.reachable?"success":"error"),y(n.reachable?"Host reachable":"Connectivity issue",n,n.reachable?"success":"error"),window.showToast?.(n.reachable?"SureSystems host reachable":"Connectivity issue detected",n.reachable?"success":"error")}catch(n){d("Connectivity probe failed",{error:n.message},"error"),y("Probe failed",{error:n.message},"error"),window.showToast?.(n.message||"Probe failed","error")}finally{e()}}async function B(){try{s.config=await p("/api/suresystems/config"),d("Config loaded",s.config,s.config?.configured?"success":"error"),U()}catch(t){d("Config load failed",{error:t.message},"error")}}async function f(){const t=document.getElementById("mandates-tbody");t&&(t.innerHTML=`<tr><td colspan="5" class="px-5 py-12 text-center text-gray-400">
      <i class="fa-solid fa-spinner fa-spin text-xl mb-2 text-orange-400 block"></i>Loading…
    </td></tr>`);try{const e=await p("/api/suresystems/mandates/history");s.mandates=e.data||[],d("Mandates loaded",{count:s.mandates.length},"info"),J(),L()}catch(e){d("Mandates load failed",{error:e.message},"error"),t&&(t.innerHTML=`<tr><td colspan="5" class="px-5 py-8 text-center text-red-500 text-sm">${g(e.message)}</td></tr>`)}}function W(){document.getElementById("refresh-btn")?.addEventListener("click",()=>Promise.all([B(),f()])),document.getElementById("btn-sync-mandates")?.addEventListener("click",async()=>{const t=document.getElementById("btn-sync-mandates");t.disabled=!0,t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Loading…';try{const e=await q("/api/admin/mandates/sync",{method:"POST"}),n=await e.json();if(!e.ok)throw new Error(n.error||"Sync failed");alert(`Mandates synced. ${n.synced??0} records updated from SureSystems.`),await f()}catch(e){alert("Sync error: "+e.message)}finally{t.disabled=!1,t.innerHTML='<i class="fa-solid fa-cloud-arrow-down"></i> Load from SureSystems'}}),document.getElementById("mandate-search")?.addEventListener("input",L),document.querySelectorAll(".filter-btn").forEach(t=>{t.addEventListener("click",()=>{s.currentFilter=t.dataset.filter||"all",document.querySelectorAll(".filter-btn").forEach(e=>{e.classList.remove("bg-gray-900","text-white"),e.classList.add("bg-gray-100","text-gray-600")}),t.classList.add("bg-gray-900","text-white"),t.classList.remove("bg-gray-100","text-gray-600"),L()})}),document.getElementById("close-modal-btn")?.addEventListener("click",h),document.getElementById("mandate-modal")?.addEventListener("click",t=>{t.target?.id==="mandate-modal"&&h()}),document.getElementById("toggle-raw-payload")?.addEventListener("click",()=>{const t=document.getElementById("raw-payload-panel"),e=document.getElementById("raw-chevron"),n=t?.classList.toggle("hidden")===!1;e&&(e.style.transform=n?"rotate(90deg)":"")}),document.getElementById("toggle-diagnostics")?.addEventListener("click",()=>{s.diagnosticsOpen=!s.diagnosticsOpen;const t=document.getElementById("diagnostics-panel"),e=document.getElementById("diag-chevron");t?.classList.toggle("hidden",!s.diagnosticsOpen),e&&(e.style.transform=s.diagnosticsOpen?"rotate(90deg)":"")}),document.getElementById("btn-dry-run")?.addEventListener("click",K),document.getElementById("btn-direct-load")?.addEventListener("click",Q),document.getElementById("btn-connectivity-probe")?.addEventListener("click",V),document.getElementById("btn-clear-logs")?.addEventListener("click",()=>{b.length=0,I()})}document.addEventListener("DOMContentLoaded",async()=>{await R();const t=document.getElementById("main-content");t&&(t.innerHTML=F(),W(),I(),await Promise.all([B(),f()]))});
