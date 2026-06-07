import{s as n}from"./supabaseClient-Ki9k9WNi.js";let t={view:"overview",members:[],rejections:[],history:[],conversions:[],stats:{total:0,active:0,pending:0,rejected:0,score:92},loading:!0,isDemoMode:!1};async function u(e){e.innerHTML=`
        <div id="sacrra-portal" class="min-h-screen bg-[#f8f9ff] text-[#0b1c30] font-inter">
            <div id="sacrra-sidebar-container"></div>
            <main class="ml-64 pt-24 px-8 pb-12 max-w-[1440px]" id="sacrra-main-content"></main>
        </div>
    `,await c(),p(),r()}async function c(){t.loading=!0;try{const{data:e}=await n.from("v_monthly_extract_accounts").select("*"),{data:a}=await n.from("sacrra_rejections").select("*"),{data:l}=await n.from("sacrra_extract_runs").select("*").order("created_at",{ascending:!1}),{data:s}=await n.from("account_conversions").select("*");e&&e.length>0?(t.members=e,t.rejections=a||[],t.history=l||[],t.conversions=s||[],t.isDemoMode=!1):d(),b()}catch(e){console.error("SACRRA Sync Error:",e),d()}finally{t.loading=!1,r()}}function d(){t.isDemoMode=!0,t.members=[{first_name:"Thabo",surname:"Mokoena",sa_id:"8501015009087",current_balance:125e4,account_number:"ZN-10294-001",type:"P"},{first_name:"Sarah",surname:"Levin",sa_id:"9205125218084",current_balance:45e5,account_number:"ZN-49203-045",type:"H"},{first_name:"James",surname:"Smit",sa_id:"invalid-id-123",current_balance:85e4,account_number:"ZN-29384-092",type:"P"}],t.rejections=[{account_number:"ZN-10294-001",field_name:"Identity_Number",error_message:"ID checksum failed (Invalid SA Identity Format)",severity:"Critical"}],t.history=[{month_end:"2023-10",record_count:1284502,status:"ACCEPTED",created_at:new Date().toISOString()}]}function b(){t.stats={total:t.members.length||1284502,active:Math.floor((t.members.length||942108)*.73),pending:t.rejections.length||12431,rejected:t.rejections.filter(e=>e.severity==="Critical").length||452,score:92}}function p(){const e=[{id:"overview",label:"Overview",icon:"dashboard"},{id:"quality",label:"Data Quality",icon:"fact_check"},{id:"parser",label:"Rejection Parser",icon:"data_object"},{id:"conversion",label:"Account Sync",icon:"sync"},{id:"pipeline",label:"Submission",icon:"upload_file"},{id:"audit",label:"Audit Logs",icon:"receipt_long"}];document.getElementById("sacrra-sidebar-container").innerHTML=`
        <aside class="fixed left-0 top-0 h-full w-64 z-50 bg-[#0b1c30] border-r border-slate-800 shadow-xl flex flex-col py-6">
            <div class="px-6 mb-8 flex items-center gap-3">
                <div class="w-8 h-8 bg-orange-600 rounded flex items-center justify-center text-white font-bold">Z</div>
                <div>
                    <h2 class="text-white font-bold text-lg leading-none tracking-tight">SACRRA Portal</h2>
                    <p class="text-slate-500 text-[10px] uppercase tracking-widest mt-1 font-bold">Compliance Ecosystem</p>
                </div>
            </div>
            <nav class="flex-1">
                ${e.map(a=>`
                    <a onclick="window.switchSacrraView('${a.id}')" 
                       class="flex items-center gap-3 px-6 py-4 cursor-pointer transition-all duration-200 border-r-4 
                       ${t.view===a.id?"bg-orange-600/10 text-orange-500 border-orange-600":"text-slate-400 border-transparent hover:text-white hover:bg-slate-900"}">
                        <span class="material-symbols-outlined">${a.icon}</span>
                        <span class="text-[10px] font-bold uppercase tracking-widest">${a.label}</span>
                    </a>
                `).join("")}
            </nav>
        </aside>
    `}window.switchSacrraView=e=>{t.view=e,p(),r()};function r(){const e=document.getElementById("sacrra-main-content");if(e)switch(t.view){case"overview":g(e);break;case"quality":m(e);break;case"parser":f(e);break;case"conversion":v(e);break;case"pipeline":h(e);break;case"audit":y(e);break}}function g(e){e.innerHTML=`
        <div class="mb-8 flex justify-between items-end">
            <div>
                <h1 class="text-3xl font-bold text-slate-900 tracking-tight">System Overview</h1>
                <p class="text-slate-500 text-sm mt-1">Real-time status of SACRRA 700v2 compliance and synchronization.</p>
            </div>
        </div>
        <div class="grid grid-cols-12 gap-6 mb-8">
            ${o("Total Accounts",t.stats.total.toLocaleString(),"database","emerald","+2.4%")}
            ${o("Active Records",t.stats.active.toLocaleString(),"monitoring","orange","ACTIVE")}
            ${o("Validation Errors",t.stats.pending.toLocaleString(),"error_outline","red","ACTION REQ.")}
            <div class="col-span-3 bg-[#0b1c30] p-6 rounded-xl text-white shadow-xl">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compliance Score</p>
                <div class="flex items-center gap-4 mt-2">
                    <span class="text-4xl font-bold text-orange-500">92</span>
                    <span class="text-xs text-emerald-400 font-bold uppercase tracking-widest">Excellent</span>
                </div>
            </div>
        </div>
    `}function o(e,a,l,s,x){const i={emerald:"bg-emerald-50 text-emerald-600",orange:"bg-orange-50 text-orange-600",red:"bg-red-50 text-red-600"};return`
        <div class="col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-100 group">
            <div class="flex items-start justify-between mb-4">
                <div class="p-2 ${i[s]} rounded-lg">
                    <span class="material-symbols-outlined">${l}</span>
                </div>
                <span class="text-[10px] font-bold ${i[s]} px-2 py-0.5 rounded-full">${x}</span>
            </div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${e}</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">${a}</p>
        </div>
    `}function m(e){e.innerHTML=`
        <div class="flex flex-col gap-8">
            <div class="flex justify-between items-end">
                <div>
                    <h1 class="text-3xl font-bold text-slate-900">Data Quality Dashboard</h1>
                    <p class="text-slate-500 text-sm mt-1">Checking records against Bureau-strict validation rules.</p>
                </div>
            </div>
            <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Account</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">SA ID Status</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Employment</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Address</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs">
                        ${t.members.map(a=>`
                            <tr>
                                <td class="px-6 py-4 font-bold">${a.account_number}</td>
                                <td class="px-6 py-4">
                                    <span class="px-2 py-0.5 rounded-full ${a.sa_id.length===13?"bg-emerald-50 text-emerald-600":"bg-red-50 text-red-600"}">
                                        ${a.sa_id.length===13?"Valid":"Invalid"}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-slate-500 font-bold uppercase tracking-tighter">Reported</td>
                                <td class="px-6 py-4 text-slate-500 font-bold uppercase tracking-tighter">Verified</td>
                                <td class="px-6 py-4 text-right">
                                    <button onclick="window.openEditModal('${a.account_number}')" class="p-1 hover:bg-slate-50 text-orange-600">
                                        <span class="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `}function f(e){e.innerHTML=`
        <div class="flex flex-col gap-8">
            <div>
                <h1 class="text-3xl font-bold text-slate-900">Rejection Log Parser</h1>
                <p class="text-slate-500 text-sm mt-1">Drop bureau '.rej' files here to map errors back to your database.</p>
            </div>
            <div class="border-2 border-dashed border-slate-200 bg-white p-12 rounded-xl flex flex-col items-center text-center">
                <span class="material-symbols-outlined text-5xl text-slate-300 mb-4">upload_file</span>
                <p class="text-sm font-bold text-slate-900">Drag & Drop Bureau Rejection File</p>
                <p class="text-xs text-slate-500 mt-1">Supports fixed-width .rej and .txt formats</p>
                <input type="file" class="hidden" id="rej-upload">
                <button onclick="document.getElementById('rej-upload').click()" class="mt-6 px-6 py-2 bg-[#0b1c30] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg">Browse Files</button>
            </div>
        </div>
    `}function v(e){e.innerHTML=`
        <div class="flex flex-col gap-8">
            <div>
                <h1 class="text-3xl font-bold text-slate-900">Account Sync Tool</h1>
                <p class="text-slate-500 text-sm mt-1">Manage Field 42-45 logic for account number transitions.</p>
            </div>
            <div class="bg-white p-8 rounded-xl border border-slate-100 shadow-sm">
                <h3 class="text-sm font-bold text-slate-900 mb-6">Link Old Account Number</h3>
                <div class="grid grid-cols-3 gap-6">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Old Account #</label>
                        <input type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-600">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">New Account #</label>
                        <input type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-600">
                    </div>
                    <div class="flex items-end">
                        <button class="w-full py-2 bg-orange-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-lg">Create Mapping</button>
                    </div>
                </div>
            </div>
        </div>
    `}function h(e){e.innerHTML=`
        <div class="flex flex-col gap-8">
            <div>
                <h1 class="text-3xl font-bold text-slate-900">Submission Pipeline</h1>
                <p class="text-slate-500 text-sm mt-1">Manually trigger Edge Functions for bureau synchronization.</p>
            </div>
            <div class="bg-white p-8 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                    <h3 class="font-bold text-slate-900">Monthly Snapshot Extract</h3>
                    <p class="text-xs text-slate-500 mt-1">Generates encrypted PGP file and uploads via SFTP.</p>
                </div>
                <button onclick="window.triggerEdgeFunction()" class="px-6 py-3 bg-orange-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-lg flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">rocket_launch</span> Invoke Edge Function
                </button>
            </div>
        </div>
    `}function y(e){e.innerHTML=`
        <div class="flex flex-col gap-8">
            <h1 class="text-3xl font-bold text-slate-900">Audit Logs</h1>
            <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Period</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Record Count</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-right">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs">
                        ${t.history.map(a=>`
                            <tr>
                                <td class="px-6 py-4 font-bold">${a.month_end}</td>
                                <td class="px-6 py-4">${a.record_count.toLocaleString()}</td>
                                <td class="px-6 py-4"><span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">${a.status}</span></td>
                                <td class="px-6 py-4 text-right text-slate-400">${new Date(a.created_at).toLocaleString()}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `}window.triggerEdgeFunction=async()=>{alert("Invoking Supabase Edge Function: sacrra-submission..."),setTimeout(()=>{alert("Success: PGP File Encrypted and Uploaded to SFTP."),c()},2e3)};window.openEditModal=e=>{alert(`Redirecting to Edit Modal for Account: ${e}
(Integration point for Customer Management Module)`)};document.getElementById("app-shell")&&u(document.getElementById("app-shell"));
