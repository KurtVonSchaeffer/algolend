import"./supabaseClient-BXSct5lo.js";/* empty css              */import{i as x}from"./layout-Ci9LpN5w.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";import"./theme-CYs9TE7o.js";let m=[],c=[],u={};function h(e){if(!/^\d{13}$/.test(e))return!1;let t=0;for(let r=0;r<12;r++){let a=parseInt(e[r]);r%2===1&&(a*=2,a>9&&(a-=9)),t+=a}return(10-t%10)%10===parseInt(e[12])}function y(e){if(!/^\d{13}$/.test(e))return null;const t=parseInt(e.slice(0,2)),r=parseInt(e.slice(2,4)),a=parseInt(e.slice(4,6)),n=t>=25?1900:2e3;return new Date(n+t,r-1,a).getMonth()!==r-1?null:`${n+t}${String(r).padStart(2,"0")}${String(a).padStart(2,"0")}`}function _(e){return/^\d{13}$/.test(e)?parseInt(e[6])<5?"F":"M":null}const v=[{field:"identity_number",label:"SA ID Number",check:e=>{if(!e)return"Required";const t=String(e).replace(/\s/g,"");return/^\d{13}$/.test(t)?h(t)?null:"Invalid checksum (Luhn fails)":`Must be 13 digits (got ${t.length})`}},{field:"date_of_birth",label:"Date of Birth",check:(e,t)=>{if(!e)return"Required";const r=String(e).replace(/[-\/\s]/g,"");if(!/^\d{8}$/.test(r))return"Must be YYYYMMDD format";const a=String(t.identity_number||"").replace(/\s/g,""),n=y(a);return n&&n!==r?`Doesn't match SA ID (expected ${n})`:null}},{field:"gender",label:"Gender",check:(e,t)=>{if(!e)return"Required";const r=String(e).toUpperCase().charAt(0);if(!["M","F"].includes(r))return`Must be M or F (got "${e}")`;const a=String(t.identity_number||"").replace(/\s/g,""),n=_(a);return n&&n!==r?`Doesn't match SA ID (expected ${n})`:null}},{field:"surname",label:"Surname",check:e=>!e||!String(e).trim()?"Required":String(e).length>25?`Max 25 chars (got ${String(e).length})`:null},{field:"first_names",label:"First Names",check:e=>!e||!String(e).trim()?"Required":String(e).length>14?`Max 14 chars (got ${String(e).length})`:null},{field:"address",label:"Address",check:e=>!e||!String(e).trim()?"Required (no SACRRA submission without address)":null},{field:"cell_tel_no",label:"Mobile Number",check:e=>{if(!e)return null;const t=String(e).replace(/[\s\-+]/g,"");return/^(0|27)\d{9}$/.test(t)?null:"Invalid SA mobile format"}},{field:"postal_code",label:"Postal Code",check:e=>e?/^\d{4}$/.test(String(e).trim())?null:"Must be 4 digits":null},{field:"account_number",label:"Account/Loan Number",check:e=>e?null:"Required"},{field:"status_code",label:"Status Code",check:e=>{const t=["C","P","D","T","V","L","W","E","G","K","M","S","I","O","R","N"];if(!e)return null;const r=String(e).trim().toUpperCase();return t.includes(r)?null:`Invalid status. Valid: ${t.join(", ")}`}},{field:"opening_balance",label:"Opening Balance",check:e=>{if(e==null||e==="")return"Required";const t=parseFloat(String(e).replace(/[R,\s]/g,""));return isNaN(t)?`Not a number: "${e}"`:t<0?"Must be >= 0":t>999999999?"Exceeds N9 max (R999,999,999)":null}},{field:"current_balance",label:"Current Balance",check:e=>{if(e==null||e==="")return"Required";const t=parseFloat(String(e).replace(/[R,\s]/g,""));return isNaN(t)?`Not a number: "${e}"`:t<0?"Must be >= 0":t>999999999?"Exceeds N9 max":null}},{field:"installment",label:"Monthly Installment",check:e=>{if(e==null||e==="")return null;const t=parseFloat(String(e).replace(/[R,\s]/g,""));return isNaN(t)?`Not a number: "${e}"`:t<0?"Must be >= 0":null}},{field:"date_opened",label:"Date Account Opened",check:e=>{if(!e)return"Required";const t=String(e).replace(/[-\/\s]/g,"");if(!/^\d{8}$/.test(t))return"Must be YYYYMMDD format";const r=new Date(`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`);return isNaN(r.getTime())?"Invalid date":r>new Date?"Cannot be in future":null}},{field:"term_months",label:"Term (Months)",check:e=>{if(!e)return"Required";const t=parseInt(e);return isNaN(t)||t<1?"Must be >= 1":t>9999?"Max 4 digits":null}},{field:"months_in_arrears",label:"Months In Arrears",check:(e,t)=>{const r=parseInt(e||0);if(isNaN(r)||r<0)return"Must be >= 0";if(r>99)return"Max 99";const a=String(t.status_code||"").trim().toUpperCase();return["C","P","T","V"].includes(a)&&r>0?`Arrears > 0 but status is "${a}" (current/closed)`:a==="D"&&r===0?'Status is "D" (defaulted) but arrears = 0':null}}],g={identity_number:["id_number","idnumber","sa_id","said","identity_number","identity","rsa_id","national_id"],date_of_birth:["dob","date_of_birth","birth_date","birthdate"],gender:["gender","sex"],surname:["surname","last_name","lastname","family_name"],first_names:["first_name","firstname","first_names","given_name","name","forename"],address:["address","address_1","address1","street_address","residential_address","res_address"],cell_tel_no:["cell","cellphone","mobile","phone","tel_no","contact_number","cell_tel_no"],postal_code:["postal","postal_code","postcode","zip"],account_number:["account_number","account","loan_number","loan_no","ref","reference","contract_no","contract_reference"],status_code:["status","status_code","loan_status","account_status"],opening_balance:["opening_balance","principal","original_amount","loan_amount","amount","disbursed"],current_balance:["current_balance","outstanding","balance","outstanding_balance","remaining_balance"],installment:["installment","instalment","monthly_payment","monthly","repayment","emi"],date_opened:["date_opened","open_date","start_date","disbursed_date","disbursement_date","effective_date"],term_months:["term","term_months","duration","months","number_of_installments","n_installments"],months_in_arrears:["months_in_arrears","arrears_months","m_in_arrears","overdue_months"]};function w(e){const t={},r=e.map(a=>String(a).toLowerCase().replace(/[\s_\-\.]/g,"_").replace(/__+/g,"_"));return Object.entries(g).forEach(([a,n])=>{for(let s=0;s<r.length;s++){const o=r[s];if(n.some(l=>o===l||o.includes(l))){t[a]=e[s];break}}}),t}function S(e){const t=e.split(/\r?\n/).filter(s=>s.trim());if(t.length===0)return{headers:[],rows:[]};function r(s){const o=[];let l="",d=!1;for(let i=0;i<s.length;i++){const p=s[i];p==='"'?d&&s[i+1]==='"'?(l+='"',i++):d=!d:p===","&&!d?(o.push(l),l=""):l+=p}return o.push(l),o}const a=r(t[0]).map(s=>s.trim().replace(/^"|"$/g,"")),n=t.slice(1).map(s=>{const o=r(s),l={};return a.forEach((d,i)=>l[d]=(o[i]||"").trim().replace(/^"|"$/g,"")),l});return{headers:a,rows:n}}function $(e,t){return e.map((r,a)=>{const n={};Object.entries(t).forEach(([l,d])=>{n[l]=r[d]});const s=[],o=[];return v.forEach(l=>{const d=l.check(n[l.field],n);d&&s.push({field:l.label,error:d})}),{row:a+2,valid:s.length===0,errors:s,warnings:o,original:r,mapped:n}})}function k(){const e=document.getElementById("app-shell"),t=e.querySelector("main")||e;let r=t.querySelector("#validator-content");r||(r=document.createElement("div"),r.id="validator-content",r.className="p-6 max-w-[1400px] mx-auto",t.appendChild(r)),r.innerHTML=`
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span class="material-symbols-outlined" style="color:var(--color-primary,#E7762E)">fact_check</span>
            SACRRA Migration Validator
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">Validate external loan book against Layout 700v2 rules before importing</p>
        </div>
        <a href="/admin/sacrra" class="text-xs font-bold text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span> Back to SACRRA
        </a>
      </div>

      <!-- Step 1: Upload -->
      <section id="step-upload" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center font-black text-orange-600">1</div>
          <h2 class="font-bold text-gray-900">Upload Loan Book</h2>
        </div>
        <p class="text-sm text-gray-500 mb-4">Upload the loan book CSV from AlgoLend. Auto-detects. Auto-detects common column names.</p>
        <input type="file" id="csv-upload" accept=".csv,.txt"
          class="block w-full text-sm border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
        <p class="text-xs text-gray-400 mt-2">Max 50MB. CSV with header row required.</p>
      </section>

      <!-- Step 2: Column mapping -->
      <section id="step-map" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 hidden">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center font-black text-orange-600">2</div>
          <h2 class="font-bold text-gray-900">Column Mapping</h2>
        </div>
        <p class="text-sm text-gray-500 mb-4">Match the columns from the uploaded file to SACRRA fields. Required fields are bold.</p>
        <div id="mapping-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
        <button id="run-validation"
          class="mt-6 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">play_arrow</span>
          Validate Records
        </button>
      </section>

      <!-- Step 3: Results -->
      <section id="step-results" class="hidden mb-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Total Records</p>
            <p id="stat-total" class="text-2xl font-black text-gray-900 mt-1">0</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-green-500">Valid</p>
            <p id="stat-valid" class="text-2xl font-black text-green-600 mt-1">0</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-red-500">Errors</p>
            <p id="stat-errors" class="text-2xl font-black text-red-600 mt-1">0</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-orange-500">Compliance %</p>
            <p id="stat-compliance" class="text-2xl font-black text-orange-600 mt-1">0%</p>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div class="flex gap-1">
              <button data-filter="all" class="filter-tab active px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100">All</button>
              <button data-filter="failed" class="filter-tab px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">Failed Only</button>
              <button data-filter="passed" class="filter-tab px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">Passed Only</button>
            </div>
            <div class="flex gap-2">
              <button id="btn-download-errors" class="text-xs font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">download</span> Errors CSV
              </button>
              <button id="btn-download-valid" class="text-xs font-bold text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">download</span> Valid CSV
              </button>
            </div>
          </div>
          <div class="overflow-x-auto max-h-[600px]">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Row</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">SA ID</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Balance</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Issues</th>
                </tr>
              </thead>
              <tbody id="results-tbody" class="divide-y divide-gray-50"></tbody>
            </table>
          </div>
        </div>
      </section>
    `,document.getElementById("csv-upload").addEventListener("change",I),document.getElementById("run-validation").addEventListener("click",E),document.getElementById("btn-download-errors").addEventListener("click",()=>b("errors")),document.getElementById("btn-download-valid").addEventListener("click",()=>b("valid")),document.querySelectorAll(".filter-tab").forEach(a=>{a.addEventListener("click",n=>{document.querySelectorAll(".filter-tab").forEach(s=>{s.classList.remove("active","bg-gray-100")}),n.target.classList.add("active","bg-gray-100"),f(n.target.dataset.filter)})})}function I(e){const t=e.target.files[0];if(!t)return;const r=new FileReader;r.onload=a=>{const{headers:n,rows:s}=S(a.target.result);if(s.length===0){alert("No rows found in file.");return}m=s,u=w(n),R(n),document.getElementById("step-map").classList.remove("hidden"),document.getElementById("step-map").scrollIntoView({behavior:"smooth"})},r.readAsText(t)}function R(e){const t=document.getElementById("mapping-grid"),r=["identity_number","surname","first_names","address","account_number","opening_balance","current_balance","date_opened","term_months"];t.innerHTML=Object.entries(g).map(([a,n])=>{const s=r.includes(a),o=a.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase());return`
          <div class="border border-gray-100 rounded-xl p-3">
            <label class="block text-xs ${s?"font-black text-gray-900":"font-semibold text-gray-500"} uppercase tracking-wide mb-1">
              ${o} ${s?'<span class="text-red-500">*</span>':'<span class="text-gray-300 normal-case">(optional)</span>'}
            </label>
            <select data-field="${a}" class="map-select w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
              <option value="">— Skip —</option>
              ${e.map(l=>`<option value="${l}" ${u[a]===l?"selected":""}>${l}</option>`).join("")}
            </select>
          </div>`}).join(""),t.querySelectorAll(".map-select").forEach(a=>{a.addEventListener("change",n=>{u[n.target.dataset.field]=n.target.value})})}function E(){if(m.length===0)return;c=$(m,u);const e=c.filter(a=>a.valid).length,t=c.length-e,r=Math.round(e/c.length*100);document.getElementById("stat-total").textContent=c.length,document.getElementById("stat-valid").textContent=e,document.getElementById("stat-errors").textContent=t,document.getElementById("stat-compliance").textContent=r+"%",document.getElementById("step-results").classList.remove("hidden"),f("all"),document.getElementById("step-results").scrollIntoView({behavior:"smooth"})}function f(e="all"){const t=document.getElementById("results-tbody");let r=c;if(e==="failed"&&(r=r.filter(n=>!n.valid)),e==="passed"&&(r=r.filter(n=>n.valid)),r.length===0){t.innerHTML='<tr><td colspan="6" class="p-12 text-center text-gray-400 text-sm">No records match this filter.</td></tr>';return}const a=r.slice(0,500);t.innerHTML=a.map(n=>{const s=n.mapped.identity_number||"—",o=(n.mapped.first_names||"")+" "+(n.mapped.surname||""),l=n.mapped.current_balance?"R"+Number(String(n.mapped.current_balance).replace(/[R,\s]/g,"")).toLocaleString("en-ZA"):"—",d=n.mapped.status_code||"—";return`
          <tr class="${n.valid?"hover:bg-green-50/20":"bg-red-50/20 hover:bg-red-50/40"}">
            <td class="px-4 py-2 text-xs font-mono ${n.valid?"text-gray-400":"text-red-500 font-bold"}">${n.row}</td>
            <td class="px-4 py-2 text-xs font-mono text-gray-700">${s}</td>
            <td class="px-4 py-2 text-xs font-semibold text-gray-900 truncate max-w-[200px]" title="${o}">${o.trim()||"—"}</td>
            <td class="px-4 py-2 text-xs font-bold text-gray-700">${l}</td>
            <td class="px-4 py-2 text-xs">${d==="—"?"—":`<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">${d}</span>`}</td>
            <td class="px-4 py-2">
              ${n.valid?'<span class="inline-flex items-center gap-1 text-xs font-bold text-green-600"><span class="material-symbols-outlined text-[14px]">check_circle</span>OK</span>':`<div class="space-y-0.5">${n.errors.slice(0,3).map(i=>`<div class="text-[10px] text-red-600"><strong>${i.field}:</strong> ${i.error}</div>`).join("")}${n.errors.length>3?`<div class="text-[10px] text-gray-400">+${n.errors.length-3} more</div>`:""}</div>`}
            </td>
          </tr>`}).join(""),r.length>500&&(t.innerHTML+=`<tr><td colspan="6" class="p-4 text-center text-xs text-gray-400 bg-gray-50">Showing first 500 of ${r.length}. Download CSV for full list.</td></tr>`)}function b(e){const t=e==="valid"?c.filter(o=>o.valid):c.filter(o=>!o.valid);if(t.length===0){alert("No records to export.");return}let r;if(e==="valid"){const o=Object.keys(g);r=o.join(",")+`
`,r+=t.map(l=>o.map(d=>`"${(l.mapped[d]||"").toString().replace(/"/g,'""')}"`).join(",")).join(`
`)}else r=`Row,SA_ID,Name,Errors
`,r+=t.map(o=>{const l=`${o.mapped.first_names||""} ${o.mapped.surname||""}`.trim(),d=o.errors.map(i=>`${i.field}: ${i.error}`).join("; ");return`${o.row},"${o.mapped.identity_number||""}","${l}","${d.replace(/"/g,'""')}"`}).join(`
`);const a=new Blob([r],{type:"text/csv;charset=utf-8;"}),n=URL.createObjectURL(a),s=document.createElement("a");s.href=n,s.download=`sacrra_${e}_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(s),s.click(),document.body.removeChild(s),URL.revokeObjectURL(n)}document.addEventListener("DOMContentLoaded",async()=>{await x(),k()});
