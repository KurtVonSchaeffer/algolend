import{supabase as g}from"./supabaseClient-DdIec1HK.js";/* empty css              *//* empty css               */import{i as v}from"./layout-Nmoyu__-.js";import{a as p}from"./utils-CZwHw4kl.js";import"https://esm.sh/@supabase/supabase-js@2";import"./theme-CYs9TE7o.js";let u=[],y=[],m="all";const x=new Date().toISOString().slice(0,10),w=x.slice(0,8)+"01";let c=w,s=x;document.addEventListener("DOMContentLoaded",async()=>{await v(),await _(),k(),await b()});async function _(){const{data:a}=await g.from("branches").select("id, name").order("name");y=a||[]}async function b(){let a=g.from("cash_journal").select("*").gte("entry_date",c).lte("entry_date",s).order("entry_date",{ascending:!1}).order("created_at",{ascending:!1});m!=="all"&&(a=a.eq("branch_id",m));const{data:r,error:o}=await a;if(o){console.error("[cash-ledger]",o);return}u=r||[],C(),S()}async function $(a){const{data:{session:r}}=await g.auth.getSession(),{data:o}=await g.from("profiles").select("full_name").eq("id",r.user.id).maybeSingle(),{error:t}=await g.from("cash_journal").insert([{...a,created_by:r.user.id,created_by_name:o?.full_name||r.user.email}]);if(t)throw t;await b()}function k(){const a=document.getElementById("app-shell"),r=a.querySelector("main")||a;let o=r.querySelector("#cl-content");o||(o=document.createElement("div"),o.id="cl-content",o.className="p-6 max-w-6xl mx-auto",r.appendChild(o)),o.innerHTML=`
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Cash Ledger</h1>
          <p class="text-sm text-gray-500 mt-0.5">Daily cash flow journal — read-only. Entries cannot be deleted.</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <select id="branch-select" onchange="window.clSwitchBranch(this.value)"
            class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
            <option value="all">All Branches</option>
            ${y.map(t=>`<option value="${t.id}" ${t.id===m?"selected":""}>${t.name}</option>`).join("")}
          </select>
          <div class="flex items-center gap-2">
            <input type="date" id="date-from" value="${c}"
              onchange="window.clSetDateFrom(this.value)"
              class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
            <span class="text-gray-400 text-xs font-bold">to</span>
            <input type="date" id="date-to" value="${s}"
              onchange="window.clSetDateTo(this.value)"
              class="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white font-semibold focus:ring-orange-400 focus:outline-none">
          </div>
          <div class="flex gap-1">
            ${["Today","Week","Month","All"].map(t=>`
            <button onclick="window.clSetPeriod('${t}')"
              class="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors">
              ${t}
            </button>`).join("")}
          </div>
          <button onclick="window.clOpenJournal()"
            class="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <i class="fas fa-plus text-xs"></i> Add Journal Entry
          </button>
          <button onclick="window.clExport()"
            class="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <i class="fas fa-download text-xs"></i> Export
          </button>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6" id="cl-summary"></div>

      <!-- Ledger table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th class="px-5 py-3 text-left">Date</th>
                <th class="px-5 py-3 text-left">Type</th>
                <th class="px-5 py-3 text-left">Category</th>
                <th class="px-5 py-3 text-left">Description</th>
                <th class="px-5 py-3 text-left">Reference</th>
                <th class="px-5 py-3 text-right">Cash In</th>
                <th class="px-5 py-3 text-right">Cash Out</th>
                <th class="px-5 py-3 text-right">Running Balance</th>
                <th class="px-5 py-3 text-left">By</th>
              </tr>
            </thead>
            <tbody id="cl-table-body" class="divide-y divide-gray-50">
              <tr><td colspan="9" class="p-10 text-center text-sm text-gray-400">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Journal Entry Modal -->
      <div id="cl-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-bold text-gray-900">New Journal Entry</h3>
            <button onclick="window.clCloseJournal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>
          <form id="cl-form" onsubmit="window.clSaveEntry(event)" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date</label>
                <input name="entry_date" type="date" value="${s}" required
                  class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Type</label>
                <select name="entry_type" required class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="cash_in">Cash In</option>
                  <option value="cash_out">Cash Out</option>
                  <option value="opening_balance">Opening Balance</option>
                  <option value="closing_balance">Closing Balance</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Category</label>
                <select name="category" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="loan_disbursement">Loan Disbursement</option>
                  <option value="repayment">Repayment Received</option>
                  <option value="petty_cash">Petty Cash</option>
                  <option value="expense">Expense</option>
                  <option value="bank_deposit">Bank Deposit</option>
                  <option value="bank_withdrawal">Bank Withdrawal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Branch</label>
                <select name="branch_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="">— Select —</option>
                  ${y.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Amount (R) *</label>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Description *</label>
              <input name="description" type="text" required placeholder="e.g. Cash received from client John Smith"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Reference</label>
              <input name="reference" type="text" placeholder="e.g. C1234-L0042, receipt #001"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="window.clCloseJournal()"
                class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
              <button type="submit" id="cl-save-btn"
                class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Save Entry</button>
            </div>
          </form>
        </div>
      </div>
    `,window.clSwitchBranch=t=>{m=t,b()},window.clSetDateFrom=t=>{c=t,b()},window.clSetDateTo=t=>{s=t,b()},window.clSetPeriod=t=>{const l=new Date,i=new Date;t==="Today"?c=s=l.toISOString().slice(0,10):t==="Week"?(i.setDate(l.getDate()-6),c=i.toISOString().slice(0,10),s=l.toISOString().slice(0,10)):t==="Month"?(c=l.toISOString().slice(0,8)+"01",s=l.toISOString().slice(0,10)):t==="All"&&(c="2020-01-01",s=l.toISOString().slice(0,10)),document.getElementById("date-from").value=c,document.getElementById("date-to").value=s,b()},window.clOpenJournal=()=>document.getElementById("cl-modal").classList.remove("hidden"),window.clCloseJournal=()=>document.getElementById("cl-modal").classList.add("hidden"),window.clSaveEntry=E,window.clExport=B}function S(){const a=document.getElementById("cl-summary");if(!a)return;const r=u.filter(n=>["cash_in","opening_balance"].includes(n.entry_type)).reduce((n,d)=>n+Number(d.amount),0),o=u.filter(n=>["cash_out","closing_balance"].includes(n.entry_type)).reduce((n,d)=>n+Number(d.amount),0),t=r-o,l=u.filter(n=>n.category==="loan_disbursement").reduce((n,d)=>n+Number(d.amount),0),i=u.filter(n=>n.category==="repayment").reduce((n,d)=>n+Number(d.amount),0),e=c===s?c:`${c} – ${s}`;a.innerHTML=[{label:`Cash In (${e})`,value:p(r),color:"#10b981",bg:"#d1fae5",icon:"arrow_downward"},{label:`Cash Out (${e})`,value:p(o),color:"#ef4444",bg:"#fee2e2",icon:"arrow_upward"},{label:"Net Position",value:p(t),color:t>=0?"#10b981":"#ef4444",bg:t>=0?"#d1fae5":"#fee2e2",icon:"balance"},{label:"Loans Disbursed",value:p(l),color:"#E7762E",bg:"#fff3ea",icon:"payments"},{label:"Repayments Collected",value:p(i),color:"#6366f1",bg:"#eef2ff",icon:"savings"},{label:"Entries",value:u.length,color:"#6b7280",bg:"#f3f4f6",icon:"receipt_long"}].map(n=>`
      <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${n.bg}">
          <span class="material-symbols-outlined text-[20px]" style="color:${n.color}">${n.icon}</span>
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${n.label}</p>
          <p class="text-xl font-black mt-0.5" style="color:${n.color}">${n.value}</p>
        </div>
      </div>`).join("")}function C(){const a=document.getElementById("cl-table-body");if(!a)return;const r=u;if(!r.length){a.innerHTML='<tr><td colspan="9" class="p-10 text-center text-sm text-gray-400">No entries for this date. <button onclick="window.clOpenJournal()" class="text-orange-500 font-semibold">Add the first entry.</button></td></tr>';return}let o=0;const l=[...r].reverse().map(e=>(["cash_in","opening_balance"].includes(e.entry_type)&&(o+=Number(e.amount)),["cash_out","closing_balance"].includes(e.entry_type)&&(o-=Number(e.amount)),{...e,runningBalance:o})).reverse(),i={cash_in:{label:"Cash In",color:"#10b981",bg:"#d1fae5"},cash_out:{label:"Cash Out",color:"#ef4444",bg:"#fee2e2"},opening_balance:{label:"Opening Balance",color:"#3b82f6",bg:"#dbeafe"},closing_balance:{label:"Closing Balance",color:"#8b5cf6",bg:"#ede9fe"},adjustment:{label:"Adjustment",color:"#f59e0b",bg:"#fef3c7"}};a.innerHTML=l.map(e=>{const n=i[e.entry_type]||{label:e.entry_type,color:"#6b7280",bg:"#f3f4f6"},d=["cash_in","opening_balance"].includes(e.entry_type),f=["cash_out","closing_balance"].includes(e.entry_type),h=e.runningBalance>=0?"#10b981":"#ef4444";return`
        <tr class="hover:bg-gray-50/50 transition-colors">
          <td class="px-5 py-3 text-xs font-mono text-gray-500">${e.entry_date}</td>
          <td class="px-5 py-3">
            <span class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:${n.bg};color:${n.color}">${n.label}</span>
          </td>
          <td class="px-5 py-3 text-xs text-gray-500 capitalize">${(e.category||"").replace(/_/g," ")}</td>
          <td class="px-5 py-3 text-sm text-gray-800 font-medium max-w-xs truncate">${e.description}</td>
          <td class="px-5 py-3 text-xs font-mono text-gray-400">${e.reference||"—"}</td>
          <td class="px-5 py-3 text-right text-sm font-bold text-green-600">${d?p(e.amount):"—"}</td>
          <td class="px-5 py-3 text-right text-sm font-bold text-red-500">${f?p(e.amount):"—"}</td>
          <td class="px-5 py-3 text-right text-sm font-black" style="color:${h}">${p(e.runningBalance)}</td>
          <td class="px-5 py-3 text-xs text-gray-400">${e.created_by_name||"—"}</td>
        </tr>`}).join("")}async function E(a){a.preventDefault();const r=document.getElementById("cl-save-btn"),o=a.target,t=Object.fromEntries(new FormData(o));t.amount=parseFloat(t.amount),r.textContent="Saving…",r.disabled=!0;try{await $(t),window.clCloseJournal(),o.reset(),o.elements.entry_date.value=s}catch(l){alert("Error saving entry: "+l.message)}finally{r.textContent="Save Entry",r.disabled=!1}}function B(){if(!u.length){alert("No entries to export.");return}const a=["Date","Type","Category","Description","Reference","Amount","Cash In","Cash Out","Created By","Branch"],r=u.map(e=>{const n=["cash_in","opening_balance"].includes(e.entry_type),d=["cash_out","closing_balance"].includes(e.entry_type);return[e.entry_date,e.entry_type,e.category||"",`"${(e.description||"").replace(/"/g,'""')}"`,e.reference||"",e.amount,n?e.amount:0,d?e.amount:0,e.created_by_name||"",e.branch_id||""].join(",")}),o=[a.join(","),...r].join(`
`),t=new Blob([o],{type:"text/csv;charset=utf-8;"}),l=URL.createObjectURL(t),i=document.createElement("a");i.href=l,i.download=`cash_ledger_${c}_to_${s}.csv`,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(l)}
