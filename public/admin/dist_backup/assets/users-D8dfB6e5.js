import{s as h}from"./supabaseClient-Ki9k9WNi.js";import{i as L}from"./layout-P4Epjfxm.js";/* empty css               */import{n as C,o as U,j as _,p as D}from"./dataService-OY041MzK.js";import{b as v,a as p}from"./utils-D6Z1B7Jq.js";let b=[],y=[],m=null,x=null,i=1;const u=20,T=`
<div id="view-list" class="flex flex-col h-full animate-fade-in">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 shrink-0">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">User Directory</h1>
      <p class="mt-1 text-sm text-gray-500">Manage clients, staff, and assignments.</p>
    </div>
    
    <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <select id="role-filter" class="bg-white border border-gray-300 text-gray-700 py-2 pl-4 pr-8 rounded-lg text-sm font-medium focus:ring-orange-500">
            <option value="all">All Roles</option>
            <option value="client">Clients</option>
            <option value="staff">Staff</option>
        </select>

        <select id="branch-filter" class="bg-white border border-gray-300 text-gray-700 py-2 pl-4 pr-8 rounded-lg text-sm font-medium focus:ring-orange-500 w-full sm:w-48">
            <option value="all">All Branches</option>
            <option disabled>Loading...</option>
        </select>

        <div class="relative w-full sm:w-72">
            <input type="text" id="user-search" placeholder="Search Name, Email, ID or UUID..." 
                   class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 text-sm">
            <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
        </div>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden flex-1 min-h-0">
    <div class="overflow-auto custom-scrollbar"> 
      <table class="min-w-full divide-y divide-gray-200 relative">
        <thead class="bg-gray-50 sticky top-0 z-10 shadow-sm"> 
          <tr>
            <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">User Identity</th>
            <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">System ID</th>
            <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Branch</th>
            <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Email / Contact</th>
            <th class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Action</th>
          </tr>
        </thead>
        <tbody id="users-table-body" class="bg-white divide-y divide-gray-200">
          <tr><td colspan="5" class="p-10 text-center text-gray-400">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="mt-2 text-xs text-gray-400 text-right">Showing <span id="visible-count">0</span> records</div>
</div>
`,k=`
<div id="view-detail" class="hidden flex flex-col h-full animate-fade-in bg-gray-50 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between mb-6">
        <button onclick="window.switchView('list')" class="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium transition-colors">
            <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <i class="fa-solid fa-arrow-left"></i>
            </div>
            Back to Directory
        </button>
        <div class="flex gap-2">
            <button id="btn-transfer-branch" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 shadow-sm">
                <i class="fa-solid fa-building-columns mr-2 text-orange-600"></i> Transfer Branch
            </button>
        </div>
    </div>

    <div class="grid grid-cols-12 gap-6 h-full overflow-hidden">
        
        <div class="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">
            
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-orange-600"></div>
                
                <div class="flex flex-col items-center text-center">
                    <div class="w-24 h-24 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-3xl font-bold mb-4 border-4 border-white shadow-md">
                        <span id="detail-avatar">U</span>
                    </div>
                    <h2 id="detail-name" class="text-xl font-bold text-gray-900">Loading...</h2>
                    <span id="detail-role-badge" class="mt-2 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">CLIENT</span>
                    
                    <div class="mt-6 w-full border-t border-gray-100 pt-4 grid grid-cols-2 gap-4 text-left">
                        <div>
                            <p class="text-[10px] uppercase font-bold text-gray-400">System ID (UUID)</p>
                            <p id="detail-uuid" class="text-xs font-mono text-gray-600 break-all select-all cursor-pointer hover:text-orange-600" title="Click to Copy">...</p>
                        </div>
                        <div>
                            <p class="text-[10px] uppercase font-bold text-gray-400">Joined</p>
                            <p id="detail-joined" class="text-xs font-medium text-gray-700">...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <i class="fa-solid fa-address-card text-gray-400"></i> Contact Details
                </h3>
                <div class="space-y-4">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-envelope"></i></div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs text-gray-400 font-bold">Email Address</p>
                            <p id="detail-email" class="text-sm font-medium text-gray-900 truncate">...</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-id-card"></i></div>
                        <div class="flex-1">
                            <p class="text-xs text-gray-400 font-bold">Identity Number</p>
                            <p id="detail-idnum" class="text-sm font-mono font-medium text-gray-900">...</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-location-dot"></i></div>
                        <div class="flex-1">
                            <p class="text-xs text-gray-400 font-bold">Assigned Branch</p>
                            <p id="detail-branch" class="text-sm font-bold text-gray-900">...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <i class="fa-solid fa-wallet text-gray-400"></i> Financial Snapshot
                </h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-[10px] text-gray-500 uppercase">Gross Income</p>
                        <p id="detail-income" class="text-sm font-bold text-gray-900">-</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-[10px] text-gray-500 uppercase">Expenses</p>
                        <p id="detail-expenses" class="text-sm font-bold text-gray-900">-</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">
            
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div class="text-xs text-gray-500 font-bold uppercase">Total Loans</div>
                    <div id="stat-total-loans" class="text-2xl font-extrabold text-gray-900 mt-1">0</div>
                </div>
                <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div class="text-xs text-gray-500 font-bold uppercase">Active Debt</div>
                    <div id="stat-active-debt" class="text-2xl font-extrabold text-orange-600 mt-1">R 0.00</div>
                </div>
                <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div class="text-xs text-gray-500 font-bold uppercase">Uploaded Docs</div>
                    <div id="stat-total-docs" class="text-2xl font-extrabold text-blue-600 mt-1">0</div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 class="font-bold text-gray-900">Application History</h3>
                    <span class="text-xs text-gray-400">Most recent first</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-100">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                                <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                                <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Amount</th>
                                <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                                <th class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody id="detail-loans-body" class="bg-white divide-y divide-gray-50">
                            </tbody>
                    </table>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                 <h3 class="font-bold text-gray-900 mb-4">Uploaded Documents</h3>
                 <div id="detail-docs-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    </div>
            </div>

        </div>
    </div>
</div>

<div id="branch-modal" class="hidden fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center backdrop-blur-sm">
    <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4 animate-scale-in">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Transfer User Branch</h3>
        <p class="text-sm text-gray-500 mb-4">Select the new branch for <span id="modal-username" class="font-bold text-gray-800"></span>.</p>
        
        <select id="modal-branch-select" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm mb-6 focus:ring-orange-500"></select>
        
        <div class="flex justify-end gap-3">
            <button onclick="document.getElementById('branch-modal').classList.add('hidden')" class="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onclick="window.confirmBranchTransfer()" class="px-4 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm">Confirm Transfer</button>
        </div>
    </div>
</div>
`,E=t=>["admin","super_admin","base_admin"].includes(t),I=t=>({super_admin:"SUPER ADMIN",admin:"BRANCH MANAGER",base_admin:"LOAN OFFICER"})[t]||"CLIENT",M=t=>{const e=(t||"UNKNOWN").toUpperCase();let a="bg-gray-100 text-gray-600";return e==="DISBURSED"&&(a="bg-green-100 text-green-700"),e==="DECLINED"&&(a="bg-red-100 text-red-700"),["STARTED","SUBMITTED"].includes(e)&&(a="bg-blue-50 text-blue-700"),`<span class="px-2 py-0.5 rounded text-[10px] font-bold ${a}">${e}</span>`};window.switchView=t=>{const e=document.getElementById("view-list"),a=document.getElementById("view-detail");t==="detail"?(e.classList.add("hidden"),a.classList.remove("hidden")):(e.classList.remove("hidden"),a.classList.add("hidden"),x=null)};window.openUserDetail=async t=>{try{document.body.style.cursor="wait";const e=await C(t);x=e;const a=e.profile,s=a.branches?.name||"Online / Unassigned";document.getElementById("detail-avatar").textContent=(a.full_name||"U").charAt(0),document.getElementById("detail-name").textContent=a.full_name||"Unknown User",document.getElementById("detail-role-badge").textContent=I(a.role),document.getElementById("detail-uuid").textContent=a.id,document.getElementById("detail-joined").textContent=v(a.created_at),document.getElementById("detail-email").textContent=a.email||"No Email",document.getElementById("detail-email").title=a.email||"",document.getElementById("detail-idnum").textContent=a.identity_number||"N/A",document.getElementById("detail-branch").textContent=s;const d=e.financials||{};document.getElementById("detail-income").textContent=p(d.monthly_income||0),document.getElementById("detail-expenses").textContent=p(d.monthly_expenses||0),document.getElementById("stat-total-loans").textContent=e.loans.length,document.getElementById("stat-total-docs").textContent=e.documents.length;const l=e.loans.filter(r=>["DISBURSED","ACTIVE"].includes(r.status)).reduce((r,f)=>r+Number(f.amount),0);document.getElementById("stat-active-debt").textContent=p(l);const n=document.getElementById("detail-loans-body");e.loans.length===0?n.innerHTML='<tr><td colspan="5" class="p-6 text-center text-sm text-gray-400">No application history found.</td></tr>':n.innerHTML=e.loans.map(r=>`
                <tr class="hover:bg-gray-50 transition-colors cursor-pointer" onclick="window.location.href='/admin/application-detail?id=${r.id}'">
                    <td class="px-6 py-3 text-xs font-mono text-gray-600">#${r.id}</td>
                    <td class="px-6 py-3 text-xs text-gray-600">${v(r.created_at)}</td>
                    <td class="px-6 py-3 text-xs font-bold text-gray-900">${p(r.amount)}</td>
                    <td class="px-6 py-3 text-xs">${M(r.status)}</td>
                    <td class="px-6 py-3 text-right">
                        <i class="fa-solid fa-chevron-right text-gray-300"></i>
                    </td>
                </tr>
            `).join("");const c=document.getElementById("detail-docs-grid");e.documents.length===0?c.innerHTML='<div class="col-span-3 text-center text-sm text-gray-400 py-4 border-2 border-dashed border-gray-100 rounded-lg">No documents uploaded.</div>':c.innerHTML=e.documents.map(r=>`
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                    <div class="w-10 h-10 rounded bg-white border border-gray-200 flex items-center justify-center text-orange-500">
                        <i class="fa-solid fa-file-lines"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-gray-900 truncate" title="${r.file_name}">${r.file_name}</p>
                        <p class="text-[10px] text-gray-400 uppercase">${r.file_type||"DOC"}</p>
                    </div>
                    <a href="${r.file_path}" target="_blank" class="text-gray-300 hover:text-orange-600 p-2"><i class="fa-solid fa-download"></i></a>
                </div>
            `).join("");const o=document.getElementById("btn-transfer-branch");o.onclick=()=>window.openBranchModal(),window.switchView("detail")}catch(e){console.error("Detail Error:",e),alert("Could not load user details: "+e.message)}finally{document.body.style.cursor="default"}};window.openBranchModal=()=>{if(!x)return;const t=x.profile;document.getElementById("modal-username").textContent=t.full_name;const e=document.getElementById("modal-branch-select");e.innerHTML='<option value="online">Online / Unassigned</option>',y.forEach(a=>{const s=document.createElement("option");s.value=a.id,s.textContent=a.name,t.branch_id===a.id&&(s.selected=!0),e.appendChild(s)}),document.getElementById("branch-modal").classList.remove("hidden")};window.confirmBranchTransfer=async()=>{const t=document.querySelector("#branch-modal button.bg-orange-600"),e=document.getElementById("modal-branch-select").value,a=x.profile;try{t.disabled=!0,t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Moving...';const s=e==="online"?null:e,{error:d}=await h.from("profiles").update({branch_id:s}).eq("id",a.id);if(d)throw d;await h.from("loan_applications").update({branch_id:s}).eq("user_id",a.id),alert("Success! User transferred."),document.getElementById("branch-modal").classList.add("hidden"),window.location.reload()}catch(s){alert("Transfer failed: "+s.message),t.disabled=!1,t.textContent="Confirm Transfer"}};const B=t=>{const e=document.getElementById("users-table-body"),a=document.getElementById("visible-count");if(!e)return;const s=Math.ceil(t.length/u)||1,d=(i-1)*u,l=t.slice(d,d+u);if(a&&(a.textContent=t.length),l.length===0){e.innerHTML='<tr><td colspan="5" class="p-8 text-center text-sm text-gray-400">No users found.</td></tr>',w(0);return}e.innerHTML=l.map(n=>{const c=n.branches?.name||"Online",o=E(n.role);let r=o?"bg-purple-100 text-purple-700":"bg-green-50 text-green-700";!o&&m.role!=="super_admin"&&n.branch_id!==m.branch_id&&(r="bg-yellow-50 text-yellow-700");const f=n.id.substring(0,6)+"...";return`
        <tr class="hover:bg-gray-50 transition-colors group">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold mr-3 border border-gray-200 ${o?"bg-purple-50 text-purple-600":"bg-gray-100 text-gray-500"}">
                        ${(n.full_name||"U").charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-gray-900">${n.full_name||"Unknown"}</div>
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">${I(n.role)}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block border border-gray-100" title="Full UUID: ${n.id}">
                    ${f}
                </div>
            </td>
            <td class="px-6 py-4">
                 <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-transparent ${r}">
                    ${c}
                 </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs text-gray-900 font-medium">${n.email||"-"}</div>
                <div class="text-[10px] text-gray-400">${n.identity_number||""}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.openUserDetail('${n.id}')" class="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
        </tr>`}).join(""),w(s)},g=(t=!0)=>{t&&(i=1);const e=document.getElementById("user-search").value.toLowerCase(),a=document.getElementById("role-filter").value,s=document.getElementById("branch-filter").value,d=b.filter(l=>{const n=!e||(l.full_name||"").toLowerCase().includes(e)||(l.email||"").toLowerCase().includes(e)||(l.identity_number||"").includes(e)||(l.id||"").includes(e),c=E(l.role);let o=!0;a==="client"&&(o=!c),a==="staff"&&(o=c);const r=s==="all"||l.branch_id?.toString()===s||s==="online"&&!l.branch_id;return n&&o&&r});B(d)};document.addEventListener("DOMContentLoaded",async()=>{await L();const t=document.getElementById("main-content");t.innerHTML=T+k,t.className="flex-1 p-4 sm:p-6 lg:p-8 h-screen overflow-hidden flex flex-col";try{const[e,a,s]=await Promise.all([U(),_(),D()]);m=e,b=a,y=s;const d=document.getElementById("branch-filter");d.innerHTML='<option value="all">All Branches</option><option value="online">Online / Unassigned</option>',y.forEach(n=>d.innerHTML+=`<option value="${n.id}">${n.name}</option>`);const l=document.getElementById("role-filter");m.role!=="super_admin"?(l.innerHTML='<option value="client">Clients</option>',l.value="client",l.disabled=!0,l.classList.add("bg-gray-100","text-gray-500","cursor-not-allowed"),g(!0)):B(b),document.getElementById("user-search").addEventListener("input",()=>g(!0)),document.getElementById("role-filter").addEventListener("change",()=>g(!0)),document.getElementById("branch-filter").addEventListener("change",()=>g(!0))}catch(e){console.error(e),t.innerHTML=`<div class="p-8 text-center text-red-500">Failed to load directory: ${e.message}</div>`}});function w(t){let e=document.getElementById("user-pagination-container");if(e||(e=document.createElement("div"),e.id="user-pagination-container",e.className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50",document.getElementById("view-list").appendChild(e)),t<=1){e.innerHTML='<span class="text-xs text-gray-400">Showing all users</span>';return}e.innerHTML=`
        <span class="text-xs font-bold text-gray-500 uppercase tracking-tight">Page ${i} of ${t}</span>
        <div class="flex gap-2">
            <button onclick="window.changePageUsers(${i-1})" ${i===1?"disabled":""} class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">Prev</button>
            <button onclick="window.changePageUsers(${i+1})" ${i===t?"disabled":""} class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">Next</button>
        </div>
    `}window.changePageUsers=t=>{i=t,g(!1)};
