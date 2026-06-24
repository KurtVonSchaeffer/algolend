import{supabase as h}from"./supabaseClient-DdIec1HK.js";/* empty css              *//* empty css               */import{i as L}from"./layout-Nmoyu__-.js";import{n as B,o as C,j as D,p as S}from"./dataService-gd72TqA3.js";import{a as w}from"./apiFetch-CaZjA5nC.js";import{v as k,b as T,a as f}from"./utils-CZwHw4kl.js";import"https://esm.sh/@supabase/supabase-js@2";import"./theme-CYs9TE7o.js";function U(e,t={}){const{showActions:a=!0,className:n="",isLuhnValid:l=!0}=t;let s=e.full_name||e.first_name+" "+e.surname;s=s.replace("NOT_PROVIDED","").trim();const i=s.split(" ").map(p=>p[0]).join("").substring(0,2).toUpperCase(),o=l?"bg-emerald-50 text-emerald-700 border-emerald-100":"bg-red-50 text-red-700 border-red-100",r=l?"check_circle":"warning",c=l?"Verified ID":"ID Error";return`
        <div class="bg-white rounded-[32px] border border-slate-200/60 shadow-sm overflow-hidden relative group transition-all hover:shadow-xl hover:shadow-slate-200/40 ${n}">
            <!-- Brand Accent -->
            <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#7C3AED] to-[#5B21B6]"></div>
            
            <div class="p-8">
                <div class="flex items-start justify-between mb-8">
                    <div class="flex items-center gap-5">
                        <div class="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-black text-slate-400 shadow-inner group-hover:scale-105 transition-transform">
                            ${i||"U"}
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-slate-900 tracking-tight leading-none">${s||"Unknown Client"}</h3>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">${e.role||"CLIENT"}</span>
                                <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span class="text-[10px] font-bold text-slate-500">${e.branches?.name||"Unassigned"}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="px-3 py-1.5 rounded-xl border ${o} flex items-center gap-2 animate-pulse-slow">
                        <span class="material-symbols-outlined text-[14px]">${r}</span>
                        <span class="text-[10px] font-black uppercase tracking-widest">${c}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Identity Number</p>
                        <p class="text-xs font-bold text-slate-700 font-mono">${e.identity_number||e.id_number||"---"}</p>
                    </div>
                    <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">System UUID</p>
                        <p class="text-[10px] font-bold text-slate-500 font-mono truncate">${e.id.substring(0,13)}...</p>
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="flex items-center gap-3 text-slate-600">
                        <span class="material-symbols-outlined text-[18px] text-slate-400">mail</span>
                        <span class="text-xs font-bold truncate">${e.email||"No email provided"}</span>
                    </div>
                    <div class="flex items-center gap-3 text-slate-600">
                        <span class="material-symbols-outlined text-[18px] text-slate-400">call</span>
                        <span class="text-xs font-bold">${e.contact_number||e.phone_mobile||"No contact"}</span>
                    </div>
                </div>

                ${a?`
                <div class="mt-8 pt-8 border-t border-slate-50 flex gap-3">
                    <button onclick="window.openUserDetail('${e.id}')" class="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/20 hover:bg-black transition-all">View Details</button>
                    <button class="w-12 h-12 flex items-center justify-center border border-slate-200 rounded-xl text-slate-400 hover:text-[#7C3AED] hover:border-[#7C3AED] transition-all">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                </div>
                `:""}
            </div>
        </div>
    `}let E=[],b=[],v=null,m=null,d=1;const g=20;let I="all";const A=`
<div id="view-list" class="flex flex-col h-full animate-fade-in">

  <!-- Header -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4 shrink-0">
    <div>
      <h1 class="text-2xl font-headline font-bold text-on-surface tracking-tight">Users</h1>
      <p class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-outline">Clients · Staff · Admins</p>
    </div>
    <div class="flex items-center gap-3">
      <button id="btn-invite-staff"
        class="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5"
        style="background:var(--color-primary)">
        <span class="material-symbols-outlined text-[16px]">person_add</span> Invite Staff
      </button>
    </div>
  </div>

  <!-- Tabs: Clients | Staff -->
  <div class="flex items-center gap-1 mb-5 bg-gray-100 rounded-2xl p-1 w-fit shrink-0">
    <button id="tab-clients" onclick="window.switchUserTab('clients')"
      class="user-tab-btn px-5 py-2 rounded-xl text-sm font-bold transition-all bg-white shadow-sm text-on-surface">
      Clients
    </button>
    <button id="tab-staff" onclick="window.switchUserTab('staff')"
      class="user-tab-btn px-5 py-2 rounded-xl text-sm font-bold transition-all text-outline hover:text-on-surface">
      Staff &amp; Admins
    </button>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3 mb-5 shrink-0">
    <select id="branch-filter" class="bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-xl text-sm font-semibold focus:outline-none shadow-sm">
      <option value="all">All Branches</option>
      <option disabled>Loading...</option>
    </select>
    <div class="relative flex-1 min-w-[200px]">
      <input type="text" id="user-search" placeholder="Search name, email, ID number..."
        class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none shadow-sm bg-white">
      <span class="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-[16px]">search</span>
    </div>
  </div>

  <div class="glass-card rounded-2xl flex flex-col overflow-hidden flex-1 min-h-0">
    <div class="overflow-auto custom-scrollbar"> 
      <table class="min-w-full divide-y divide-slate-50 relative">
        <thead class="bg-white sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"> 
          <tr>
            <th class="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</th>
            <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Key</th>
            <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</th>
            <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance</th>
            <th class="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
          </tr>
        </thead>
        <tbody id="users-table-body" class="bg-white divide-y divide-slate-50">
          <tr><td colspan="5" class="p-20 text-center text-slate-300 font-bold">Initialising Directory...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="mt-4 flex justify-between items-center px-2">
    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry <span id="visible-count">0</span></div>
    <div id="user-pagination-container"></div>
  </div>
</div>
`,M=`
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
                <i class="fa-solid fa-building-columns mr-2 text-[#a04100]"></i> Transfer Branch
            </button>
            <button id="btn-remove-staff" class="hidden px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 shadow-sm">
                <i class="fa-solid fa-user-minus mr-2"></i> Remove Staff
            </button>
        </div>
    </div>

    <div class="grid grid-cols-12 gap-8 h-full overflow-hidden">
        <div id="profile-card-container" class="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">
            <!-- Profile Card Injected Here -->
        </div>
        <div id="detail-right" class="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">
            <!-- Populated dynamically based on user role -->
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
            <button id="btn-confirm-transfer" onclick="window.confirmBranchTransfer()" class="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm" style="background:var(--color-primary)">Confirm Transfer</button>
        </div>
    </div>
</div>
`,_=e=>["admin","super_admin","base_admin"].includes(e),j=e=>({super_admin:"SUPER ADMIN",admin:"BRANCH MANAGER",base_admin:"LOAN OFFICER"})[e]||"CLIENT",N=e=>{const t=(e||"UNKNOWN").toUpperCase();let a="bg-gray-100 text-gray-600";return t==="DISBURSED"&&(a="bg-green-100 text-green-700"),t==="DECLINED"&&(a="bg-red-100 text-red-700"),["STARTED","SUBMITTED"].includes(t)&&(a="bg-blue-50 text-blue-700"),`<span class="px-2 py-0.5 rounded text-[10px] font-bold ${a}">${t}</span>`};window.switchView=e=>{const t=document.getElementById("view-list"),a=document.getElementById("view-detail");e==="detail"?(t.classList.add("hidden"),a.classList.remove("hidden")):(t.classList.remove("hidden"),a.classList.add("hidden"),m=null)};const R={super_admin:["Full access to everything","Manage all staff and branches","Change system settings","View all financial reports","Override credit decisions"],admin:["Manage staff in their branch","Approve and decline applications","View branch financials","Transfer clients between branches"],base_admin:["View and process loan applications","Upload and verify documents","Contact clients","Capture payments"]},P={super_admin:"Super Administrator",admin:"Branch Manager",base_admin:"Loan Officer"};function H(e,t){const a=R[e.role]||["Standard access"],n=P[e.role]||"Staff",l=t.find(i=>i.id===e.branch_id)?.name||"No branch assigned",s=a.map(i=>`
        <li class="flex items-center gap-2 text-sm text-slate-700">
            <span class="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <i class="fa-solid fa-check text-green-600" style="font-size:8px;"></i>
            </span>
            ${i}
        </li>`).join("");return`
        <div class="glass-card p-6 rounded-2xl">
            <h3 class="text-sm font-semibold uppercase tracking-widest text-outline mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">badge</span> Contact & Identity
            </h3>
            <div class="grid grid-cols-1 gap-3">
                <div class="bg-surface-container p-3 rounded-xl">
                    <p class="text-[10px] text-outline uppercase">Email</p>
                    <p class="text-sm font-bold text-on-surface">${e.email||"—"}</p>
                </div>
                <div class="bg-surface-container p-3 rounded-xl">
                    <p class="text-[10px] text-outline uppercase">Phone</p>
                    <p class="text-sm font-bold text-on-surface">${e.phone||e.mobile_number||"—"}</p>
                </div>
                <div class="bg-surface-container p-3 rounded-xl">
                    <p class="text-[10px] text-outline uppercase">Role</p>
                    <p class="text-sm font-bold text-on-surface">${n}</p>
                </div>
            </div>
        </div>

        <div class="glass-card p-6 rounded-2xl">
            <h3 class="text-sm font-semibold uppercase tracking-widest text-outline mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">corporate_fare</span> Branch Assignment
            </h3>
            <div class="bg-surface-container p-4 rounded-xl flex items-center justify-between">
                <div>
                    <p class="text-[10px] text-outline uppercase">Current Branch</p>
                    <p class="text-sm font-bold text-on-surface mt-0.5">${l}</p>
                </div>
                <button onclick="window.openBranchModal()"
                    class="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm">
                    Change
                </button>
            </div>
        </div>

        <div class="glass-card p-6 rounded-2xl">
            <h3 class="text-sm font-semibold uppercase tracking-widest text-outline mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">lock</span> Access Level
            </h3>
            <p class="text-xs text-slate-500 mb-4">What <strong>${e.full_name?.split(" ")[0]||"this user"}</strong> can do as a ${n}:</p>
            <ul class="space-y-2.5">${s}</ul>
        </div>
    `}function O(e){const t=e.financials||{},a=e.loans.filter(s=>["DISBURSED","ACTIVE"].includes(s.status)).reduce((s,i)=>s+Number(i.amount),0),n=e.loans.length===0?'<tr><td colspan="5" class="p-12 text-center text-xs font-bold text-slate-300">No applications found.</td></tr>':e.loans.map(s=>`
            <tr class="hover:bg-slate-50 transition-colors cursor-pointer group" onclick="window.location.href='/admin/application-detail?id=${s.id}'">
                <td class="px-8 py-5 text-[10px] font-black text-slate-400 font-mono">#${String(s.id).substring(0,8)}</td>
                <td class="px-6 py-5 text-xs font-bold text-slate-600">${T(s.created_at)}</td>
                <td class="px-6 py-5 text-sm font-black text-slate-900">${f(s.amount)}</td>
                <td class="px-6 py-5">${N(s.status)}</td>
                <td class="px-8 py-5 text-right">
                    <span class="material-symbols-outlined text-slate-300 group-hover:text-[#a04100] transition-colors">chevron_right</span>
                </td>
            </tr>`).join(""),l=e.documents.length===0?'<div class="col-span-3 text-center text-[10px] font-black text-slate-400 py-8 border-2 border-dashed border-slate-50 rounded-3xl">No documents found</div>':e.documents.map(s=>`
            <div class="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/20 transition-all group">
                <div class="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-[#a04100] shadow-sm">
                    <span class="material-symbols-outlined">description</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-black text-slate-900 truncate" title="${s.file_name}">${s.file_name}</p>
                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${s.file_type||"DOC"}</p>
                </div>
                <a href="${s.file_path}" target="_blank" class="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-[#a04100] transition-all">
                    <span class="material-symbols-outlined text-[20px]">download</span>
                </a>
            </div>`).join("");return`
        <div class="glass-card p-6 rounded-2xl">
            <h3 class="text-sm font-semibold uppercase tracking-widest text-outline mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span> Financial Snapshot
            </h3>
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-surface-container p-3 rounded-xl">
                    <p class="text-[10px] text-outline uppercase">Gross Income</p>
                    <p class="text-sm font-bold text-on-surface">${f(t.monthly_income||0)}</p>
                </div>
                <div class="bg-surface-container p-3 rounded-xl">
                    <p class="text-[10px] text-outline uppercase">Expenses</p>
                    <p class="text-sm font-bold text-on-surface">${f(t.monthly_expenses||0)}</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
            <div class="glass-card p-4 rounded-2xl">
                <div class="text-[10px] font-semibold uppercase tracking-widest text-outline">Total Loans</div>
                <div class="text-2xl font-extrabold text-on-surface mt-1">${e.loans.length}</div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
                <div class="text-[10px] font-semibold uppercase tracking-widest text-outline">Active Debt</div>
                <div class="text-2xl font-extrabold mt-1" style="color:var(--color-primary)">${f(a)}</div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
                <div class="text-[10px] font-semibold uppercase tracking-widest text-outline">Uploaded Docs</div>
                <div class="text-2xl font-extrabold text-blue-600 mt-1">${e.documents.length}</div>
            </div>
        </div>

        <div class="glass-card rounded-2xl overflow-hidden">
            <div class="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
                <h3 class="font-headline font-bold text-on-surface">Application History</h3>
                <span class="text-[11px] font-semibold uppercase tracking-widest text-outline">Most recent first</span>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-outline-variant/10">
                    <thead class="bg-surface-container">
                        <tr>
                            <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">ID</th>
                            <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Date</th>
                            <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Amount</th>
                            <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Status</th>
                            <th class="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-outline">Action</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-outline-variant/10">${n}</tbody>
                </table>
            </div>
        </div>

        <div class="glass-card p-6 rounded-2xl">
            <h3 class="font-headline font-bold text-on-surface mb-4">Uploaded Documents</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${l}</div>
        </div>
    `}const y={borrower:0,base_admin:1,admin:2,super_admin:3};window.openUserDetail=async e=>{try{document.body.style.cursor="wait";const t=await B(e);if(!t?.profile)throw new Error("Profile not found for this user.");m=t;const a=t.profile,n=k(a?.identity_number||a?.id_number),l=_(a.role),s=document.getElementById("profile-card-container");s&&(s.innerHTML=U(a,{isLuhnValid:n}));const i=document.getElementById("detail-right");i&&(i.innerHTML=l?H(a,b):O(t));const o=document.getElementById("btn-transfer-branch");o&&(o.onclick=()=>window.openBranchModal());const r=document.getElementById("btn-remove-staff");if(r){const c=y[v?.role]||0,p=y[a.role]||0,u=l&&c>p&&a.id!==v?.id;r.classList.toggle("hidden",!u),r.onclick=()=>window.removeStaff(a.id,a.full_name)}window.switchView("detail")}catch(t){console.error("Detail Error:",t?.message||t),alert(`Could not load user details: ${t?.message||"Unknown error — check console"}`)}finally{document.body.style.cursor="default"}};window.removeStaff=async(e,t)=>{if(confirm(`Remove ${t} from the platform? This cannot be undone.`))try{const a=await w(`/api/admin/remove-staff/${e}`,{method:"DELETE"}),n=await a.json();if(!a.ok)throw new Error(n.error||"Failed to remove staff");alert(`${t} has been removed.`),window.switchView("list"),window.location.reload()}catch(a){alert("Could not remove staff: "+a.message)}};window.openBranchModal=()=>{if(!m)return;const e=m.profile;document.getElementById("modal-username").textContent=e.full_name;const t=document.getElementById("modal-branch-select");t.innerHTML='<option value="online">Online / Unassigned</option>',b.forEach(a=>{const n=document.createElement("option");n.value=a.id,n.textContent=a.name,e.branch_id===a.id&&(n.selected=!0),t.appendChild(n)}),document.getElementById("branch-modal").classList.remove("hidden")};window.confirmBranchTransfer=async()=>{const e=document.getElementById("btn-confirm-transfer"),t=document.getElementById("modal-branch-select").value,a=m.profile;try{e.disabled=!0,e.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Moving...';const n=t==="online"||!t?null:parseInt(t,10),{error:l}=await h.from("profiles").update({branch_id:n}).eq("id",a.id);if(l)throw l;await h.from("loan_applications").update({branch_id:n}).eq("user_id",a.id),alert("Success! User transferred."),document.getElementById("branch-modal").classList.add("hidden"),window.location.reload()}catch(n){alert("Transfer failed: "+n.message),e.disabled=!1,e.textContent="Confirm Transfer"}};const V=e=>{const t=document.getElementById("users-table-body");if(!t)return;const a=(d-1)*g,n=e.slice(a,a+g);if(n.length===0){t.innerHTML='<tr><td colspan="5" class="p-20 text-center text-slate-300 font-bold">No results matching your query.</td></tr>';return}t.innerHTML=n.map(s=>{const i=s.branches?.name||"Online",o=k(s.identity_number||s.id_number);return`
        <tr class="hover:bg-slate-50/50 transition-colors group cursor-pointer" onclick="window.openUserDetail('${s.id}')">
            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-400">
                        ${(s.full_name||"U").charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-black text-slate-900">${s.full_name||"Unknown"}</div>
                        <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${j(s.role)}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-6">
                <div class="text-[10px] font-black text-slate-500 font-mono tracking-tighter">
                    ${s.id.substring(0,13).toUpperCase()}
                </div>
            </td>
            <td class="px-6 py-6">
                 <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                    ${i}
                 </span>
            </td>
            <td class="px-6 py-6">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full ${o?"bg-emerald-500":"bg-red-500"}"></span>
                        <span class="text-[10px] font-black uppercase tracking-widest ${o?"text-emerald-600":"text-red-600"}">
                            ${o?"ID Valid":"ID Invalid"}
                        </span>
                    </div>
                    ${s.employer_verified?'<div class="text-[10px] font-bold text-blue-600 flex items-center gap-1"><span>✓</span> Employer verified</div>':""}
                    ${s.credit_limit_override?`<div class="text-[10px] font-bold text-orange-600">Cap: R${Number(s.credit_limit_override).toLocaleString("en-ZA")}</div>`:""}
                    ${s.last_active_at?`<div class="text-[9px] text-slate-400">Active: ${new Date(s.last_active_at).toLocaleDateString("en-ZA")}</div>`:""}
                </div>
            </td>
            <td class="px-8 py-6 text-right">
                <button class="w-10 h-10 flex items-center justify-center text-slate-300 group-hover:text-[#a04100] transition-colors">
                    <span class="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
            </td>
        </tr>`}).join("");const l=document.getElementById("visible-count");l&&(l.textContent=e.length),q(Math.ceil(e.length/g)||1)},x=(e=!0)=>{e&&(d=1);const t=(document.getElementById("user-search")?.value||"").toLowerCase(),a=document.getElementById("role-filter")?.value||I||"client",n=document.getElementById("branch-filter")?.value||"all",l=E.filter(s=>{const i=!t||(s.full_name||"").toLowerCase().includes(t)||(s.email||"").toLowerCase().includes(t)||(s.identity_number||"").includes(t)||(s.id||"").includes(t),o=_(s.role);let r=!0;a==="client"&&(r=!o),a==="staff"&&(r=o);const c=n==="all"||s.branch_id?.toString()===n||n==="online"&&!s.branch_id;return i&&r&&c});V(l)};function F(e){if(document.getElementById("invite-staff-modal"))return;const t=document.createElement("div");t.id="invite-staff-modal",t.className="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4",t.innerHTML=`
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Invite Staff Member</h3>
            <p class="text-xs text-gray-500 mt-0.5">An email invite will be sent — they set their own password.</p>
          </div>
          <button onclick="document.getElementById('invite-staff-modal').classList.add('hidden')"
            class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <div id="invite-error" class="hidden mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium"></div>
        <div id="invite-success" class="hidden mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium"></div>

        <form id="invite-form" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Full Name *</label>
              <input name="full_name" type="text" required placeholder="Jane Smith"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Email Address *</label>
              <input name="email" type="email" required placeholder="jane@company.co.za"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Role *</label>
              <select name="role" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                <option value="base_admin">Loan Officer</option>
                <option value="admin">Branch Manager</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Branch</label>
              <select name="branch_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                <option value="">No branch</option>
                ${e.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
              </select>
            </div>
            <div class="col-span-2">
              <div class="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <i class="fa-solid fa-envelope text-blue-500 mt-0.5 flex-shrink-0"></i>
                <p class="text-xs text-blue-700">An invite email will be sent with a secure link to set their password. No temporary password needed.</p>
              </div>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button" onclick="document.getElementById('invite-staff-modal').classList.add('hidden')"
              class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
            <button type="submit" id="invite-submit-btn"
              class="flex-1 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              style="background:var(--color-primary)">Send Invite</button>
          </div>
        </form>
      </div>`,document.body.appendChild(t),t.addEventListener("click",()=>t.classList.add("hidden")),document.getElementById("invite-form").addEventListener("submit",async a=>{a.preventDefault();const n=document.getElementById("invite-submit-btn"),l=document.getElementById("invite-error"),s=document.getElementById("invite-success");l.classList.add("hidden"),s.classList.add("hidden"),n.textContent="Inviting…",n.disabled=!0;try{const i=new FormData(a.target),{full_name:o,email:r,role:c,branch_id:p}=Object.fromEntries(i),u=await w("/api/admin/invite-staff",{method:"POST",body:JSON.stringify({full_name:o,email:r,role:c,branch_id:p})}),$=await u.json();if(!u.ok)throw new Error($.error||"Failed");s.textContent=`✓ Invite sent to ${r}. They'll receive an email to set their password.`,s.classList.remove("hidden"),a.target.reset(),setTimeout(()=>{t.classList.add("hidden"),window.location.reload()},2e3)}catch(i){l.textContent=i.message,l.classList.remove("hidden")}finally{n.textContent="Send Invite",n.disabled=!1}})}document.addEventListener("DOMContentLoaded",async()=>{await L();const e=document.getElementById("main-content");e.innerHTML=A+M,e.className="flex-1 p-4 sm:p-6 lg:p-8 h-screen overflow-hidden flex flex-col";try{const[t,a,n]=await Promise.all([C(),D(),S()]);v=t,E=a,b=n.data||[];const l=document.getElementById("branch-filter");l.innerHTML='<option value="all">All Branches</option><option value="online">Online / Unassigned</option>',b.forEach(s=>l.innerHTML+=`<option value="${s.id}">${s.name}</option>`),x(!0),document.getElementById("user-search").addEventListener("input",()=>x(!0)),document.getElementById("branch-filter").addEventListener("change",()=>x(!0)),window.switchUserTab=s=>{I=s==="staff"?"staff":"client",document.querySelectorAll(".user-tab-btn").forEach(i=>{const o=i.id===`tab-${s}`;i.classList.toggle("bg-white",o),i.classList.toggle("shadow-sm",o),i.classList.toggle("text-on-surface",o),i.classList.toggle("text-outline",!o)}),x(!0)},window.switchUserTab("clients"),F(n.data||[]),document.getElementById("btn-invite-staff")?.addEventListener("click",()=>{document.getElementById("invite-staff-modal")?.classList.remove("hidden")})}catch(t){console.error(t),e.innerHTML=`<div class="p-8 text-center text-red-500">Failed to load directory: ${t.message}</div>`}});function q(e){let t=document.getElementById("user-pagination-container");if(t||(t=document.createElement("div"),t.id="user-pagination-container",t.className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/50",document.getElementById("view-list").appendChild(t)),e<=1){t.innerHTML='<span class="text-xs text-gray-400">Showing all users</span>';return}t.innerHTML=`
        <span class="text-xs font-bold text-gray-500 uppercase tracking-tight">Page ${d} of ${e}</span>
        <div class="flex gap-2">
            <button onclick="window.changePageUsers(${d-1})" ${d===1?"disabled":""} class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">Prev</button>
            <button onclick="window.changePageUsers(${d+1})" ${d===e?"disabled":""} class="px-4 py-2 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">Next</button>
        </div>
    `}window.changePageUsers=e=>{d=e,x(!1)};
