import"./supabaseClient-BXSct5lo.js";/* empty css              */import{i as E}from"./layout-l3iKOyZ9.js";import{a as c}from"./utils-CZwHw4kl.js";import{B as I}from"./dataService-Q65e7z4o.js";import{b as A,D as B,g as S}from"./theme-CYs9TE7o.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";const R=(e="")=>`${e}`.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),L=()=>A(S())||B.company_name,D=()=>(L()||"Company").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").substring(0,60)||"company";window.XLSX||(window.XLSX={utils:{json_to_sheet:e=>e,book_new:()=>({Sheets:{},SheetNames:[]}),book_append_sheet:(e,t,n)=>{e.Sheets[n]=t,e.SheetNames.push(n)}},writeFile:(e,t)=>{const n=e.SheetNames[0],a=e.Sheets[n];if(!a||a.length===0)return;const r=Object.keys(a[0]),i=[r.join(","),...a.map(o=>r.map(d=>{const h=o[d]===null||o[d]===void 0?"":o[d];return typeof h=="string"?`"${h.replace(/"/g,'""')}"`:h}).join(","))].join(`
`),l=new Blob(["\uFEFF"+i],{type:"text/csv;charset=utf-8;"}),p=document.createElement("a"),b=URL.createObjectURL(l);p.setAttribute("href",b),p.setAttribute("download",t.replace(".xlsx",".csv")),p.style.visibility="hidden",document.body.appendChild(p),p.click(),document.body.removeChild(p)}});let s={rawData:[],processedData:[],filterArrears:!1,sortMode:"month_desc",hiddenRows:new Set,flaggedRows:new Set,exportPeriod:"all"};const y=e=>`${e.loan_id}-${e.month}`,g=(e,t=[])=>{for(const n of t){const a=e?.[n],r=Number(a);if(!Number.isNaN(r)&&a!==null&&a!==void 0)return r}return 0},u=e=>g(e,["principal_collected_month","principal_outstanding"]),v=e=>g(e,["interest_collected_month","interest_receivable"]),w=e=>g(e,["fees_collected_month","fee_receivable","admin_collected_month","initiation_collected_month"]),f=e=>g(e,["arrears_amount","principal_outstanding"]);function T(){if(typeof XLSX>"u")return alert("Excel library not loaded.");const e=s.processedData.map(a=>({"Loan ID":a.loan_id,Customer:a.customer||"N/A","Statement Period":a.month,"Principal (ZAR)":u(a),"Interest (ZAR)":v(a),"Fees (ZAR)":w(a),"Arrears (ZAR)":f(a)})),t=XLSX.utils.json_to_sheet(e),n=XLSX.utils.book_new();XLSX.utils.book_append_sheet(n,t,"Analytics"),XLSX.writeFile(n,`${D()}_Analytics_${s.exportPeriod}.xlsx`)}const $=R(L()),k=`
    <div class="flex flex-col space-y-6">
        <style>
            /* UI PRIVACY: Hides sidebar and nav ONLY during print/export */
            @media print {
                @page { size: landscape; margin: 10mm; }
                body { background: white !important; }
                nav, aside, header, .hamburger, .sidebar, .notification-bell, .user-profile, 
                .rounded-full, .print\\:hidden, #searchInput, .period-tab-container, .hide-btn, .flag-btn { 
                    display: none !important; 
                }
                table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
                th, td { border: 1px solid #e5e7eb !important; padding: 6px !important; }
            }

            /* FIXED TOTALS ROW & HEADER */
            .sticky-header { position: sticky; top: 0; z-index: 30; }
            .sticky-totals { position: sticky; top: 41px; z-index: 25; background: #f9fafb; border-bottom: 2px solid #e5e7eb; }
        </style>

        <div class="hidden print:flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">${$}</h1>
                <p class="text-sm text-gray-500 uppercase font-semibold">Revenue Analytics Report</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold">Generated: ${new Date().toLocaleDateString("en-GB")}</p>
            </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-end border-b border-outline-variant/20 pb-6 gap-4 print:hidden">
            <div>
                <h1 class="text-3xl font-headline font-bold text-on-surface tracking-tight">Revenue Analytics</h1>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Portfolio Revenue & Amortisation Statement</p>
            </div>
            
            <div class="flex items-center space-x-4">
                <div class="bg-surface-container p-1 rounded-xl flex space-x-1 period-tab-container">
                    <button id="tab-current_month" class="period-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-outline">1M</button>
                    <button id="tab-last_3_months" class="period-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-outline">3M</button>
                    <button id="tab-ytd" class="period-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-outline">YTD</button>
                    <button id="tab-all" class="period-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-white shadow-sm" style="color:var(--color-primary)">ALL</button>
                </div>

                <div class="relative group">
                    <button class="flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md" style="background:var(--color-primary)">
                        <span class="material-symbols-outlined text-[16px] mr-2">file_export</span> Export <span class="material-symbols-outlined text-[14px] ml-2 opacity-70">expand_more</span>
                    </button>
                    <div class="absolute right-0 mt-2 w-48 bg-white border border-outline-variant/20 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                        <button id="printPdfBtn" class="w-full text-left px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low flex items-center border-b border-outline-variant/10">
                            <span class="material-symbols-outlined text-[16px] mr-3 text-red-500">picture_as_pdf</span> Save as PDF
                        </button>
                        <button id="exportExcelBtn" class="w-full text-left px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low flex items-center">
                            <span class="material-symbols-outlined text-[16px] mr-3 text-green-600">table_chart</span> Download Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="glass-card p-3 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center print:hidden">
            <div class="flex items-center gap-4 w-full md:w-auto">
                <div class="relative w-full md:w-96">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-outline text-[18px]">search</span>
                    <input type="text" id="searchInput" placeholder="Search customer or loan ID..." class="w-full pl-10 pr-4 py-2 text-sm border-none bg-surface-container rounded-xl outline-none">
                </div>
                <button id="resetViewBtn" class="hidden items-center px-3 py-2 text-xs font-bold rounded-xl hover:bg-surface-container-low transition-all whitespace-nowrap" style="color:var(--color-primary);background:rgba(var(--color-primary-rgb,160,65,0),0.06)">
                    <span class="material-symbols-outlined text-[14px] mr-2">refresh</span> Reset View
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button id="filterBtn" class="px-4 py-2 text-sm text-on-surface-variant bg-white border border-outline-variant/30 rounded-xl hover:bg-surface-container-low transition-colors">
                    <span class="material-symbols-outlined text-[14px] mr-2 align-middle">filter_list</span><span>Filter: All</span>
                </button>
                <button id="sortBtn" class="px-4 py-2 text-sm text-on-surface-variant bg-white border border-outline-variant/30 rounded-xl hover:bg-surface-container-low transition-colors">
                    <span class="material-symbols-outlined text-[14px] mr-2 align-middle">sort</span><span>Sort: Date (Newest)</span>
                </button>
            </div>
        </div>

        <div class="glass-card rounded-2xl overflow-hidden relative print:border-none">
            <div class="overflow-x-auto max-h-[75vh] print:max-h-none print:overflow-visible">
                <table class="w-full text-sm text-left relative border-collapse">
                    <thead class="bg-surface-container text-outline font-semibold text-[10px] border-b border-outline-variant/20 uppercase sticky-header shadow-sm print:static">
                        <tr>
                            <th class="pl-6 py-4 bg-surface-container">Loan ID</th>
                            <th class="px-4 py-4 bg-surface-container">Customer</th>
                            <th class="px-4 py-4 bg-surface-container">Month</th>
                            <th class="px-4 py-4 text-right bg-surface-container">Principal</th>
                            <th class="px-4 py-4 text-right bg-surface-container">Interest</th>
                            <th class="px-4 py-4 text-right bg-surface-container">Fees</th>
                            <th class="px-4 py-4 text-right bg-surface-container">Arrears</th>
                            <th class="px-4 py-4 text-center bg-surface-container print:hidden">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="analytics-table-body" class="divide-y divide-outline-variant/10 bg-white">
                        <tr>
                            <td colspan="8" class="text-center py-20 text-gray-400">
                                <i class="fa-solid fa-circle-notch fa-spin text-2xl text-blue-600"></i>
                                <p class="mt-2">Initializing Financial Data...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
`;function C(e){s.exportPeriod=e,document.querySelectorAll(".period-tab").forEach(n=>{n.classList.remove("bg-white","text-blue-600","shadow-sm"),n.classList.add("text-gray-500")});const t=document.getElementById(`tab-${e}`);t&&(t.classList.remove("text-gray-500"),t.classList.add("bg-white","text-blue-600","shadow-sm")),m(document.getElementById("searchInput")?.value)}function m(e=""){let t=[...s.rawData];const n=new Date;if(s.exportPeriod!=="all"&&(t=t.filter(a=>{if(!a||!a.month)return!1;const[r,i]=a.month.split("-").map(Number),l=new Date(r,i-1,1);return s.exportPeriod==="current_month"?l.getMonth()===n.getMonth()&&l.getFullYear()===n.getFullYear():s.exportPeriod==="last_3_months"?l>=new Date(n.getFullYear(),n.getMonth()-2,1):s.exportPeriod==="ytd"?r===n.getFullYear():!0})),e){const a=e.toLowerCase();t=t.filter(r=>r.customer&&String(r.customer).toLowerCase().includes(a)||r.loan_id&&String(r.loan_id).toLowerCase().includes(a))}s.filterArrears&&(t=t.filter(a=>f(a)>0)),t=t.filter(a=>a&&a.month),t.sort((a,r)=>{switch(s.sortMode){case"month_desc":return(r.month||"").localeCompare(a.month||"");case"month_asc":return(a.month||"").localeCompare(r.month||"");case"amount_desc":return u(r)-u(a);case"amount_asc":return u(a)-u(r);default:return 0}}),s.processedData=t,x()}function x(){const e=document.getElementById("analytics-table-body"),t=s.processedData,n=document.getElementById("resetViewBtn");if(!t.length){e.innerHTML='<tr><td colspan="8" class="text-center py-12 text-gray-400">No records found.</td></tr>';return}s.hiddenRows.size>0||s.flaggedRows.size>0?(n?.classList.remove("hidden"),n?.classList.add("flex")):n?.classList.add("hidden");let a=t.filter(o=>!s.hiddenRows.has(y(o)));const r=s.flaggedRows.size>0;r&&(a=a.filter(o=>s.flaggedRows.has(y(o))));const i=a.reduce((o,d)=>(o.p+=u(d),o.i+=v(d),o.f+=w(d),o.a+=f(d),o),{p:0,i:0,f:0,a:0,count:a.length}),b=`
        <tr class="bg-gray-50 font-bold border-b-2 border-gray-200 sticky-totals shadow-sm print:static">
            <td class="pl-6 py-4 text-xs uppercase ${r?"text-orange-600":"text-gray-900"}">${r?"HIGHLIGHTED TOTALS":"VISIBLE TOTALS"}</td>
            <td class="px-4 py-4 text-xs text-gray-500">${i.count} Items</td>
            <td></td>
            <td class="px-4 py-4 text-right text-gray-900">${c(i.p)}</td>
            <td class="px-4 py-4 text-right text-gray-900">${c(i.i)}</td>
            <td class="px-4 py-4 text-right text-blue-700">${c(i.f)}</td>
            <td class="px-4 py-4 text-right text-red-600">${c(i.a)}</td>
            <td class="print:hidden"></td>
        </tr>`;e.innerHTML=b+t.map(o=>M(o)).join(""),P()}const M=e=>{const t=y(e),n=s.hiddenRows.has(t),a=s.flaggedRows.has(t),r=f(e),i=r>0?"text-red-600 font-bold":"text-gray-400";let l="border-b border-gray-50 transition-colors group";return n?l+=" bg-gray-50 opacity-40 grayscale":a?l+=" bg-yellow-50 border-l-4 border-l-orange-400":l+=" hover:bg-gray-50",`
        <tr class="${l}">
            <td class="pl-6 py-4 font-medium text-gray-900">${e.loan_id}</td>
            <td class="px-4 py-4 text-gray-700 font-medium">${e.customer||"N/A"}</td>
            <td class="px-4 py-4 text-gray-500 font-mono text-xs">${e.month}</td>
            <td class="px-4 py-4 text-right text-gray-700">${c(u(e))}</td>
            <td class="px-4 py-4 text-right text-gray-600">${c(v(e))}</td>
            <td class="px-4 py-4 text-right text-blue-600 font-medium">${c(w(e))}</td>
            <td class="px-4 py-4 text-right ${i}">${c(r)}</td>
            <td class="px-4 py-4 text-center print:hidden">
                <div class="flex items-center justify-center gap-2">
                    <button class="hide-btn p-1.5 hover:bg-gray-200 rounded-md" data-id="${t}">
                        <i class="${n?"fa-solid fa-eye text-gray-600":"fa-regular fa-eye-slash text-gray-400"}"></i>
                    </button>
                    <button class="flag-btn p-1.5 hover:bg-orange-100 rounded-md" data-id="${t}">
                        <i class="${a?"fa-solid fa-flag text-orange-600":"fa-regular fa-flag text-gray-400"}"></i>
                    </button>
                </div>
            </td>
        </tr>`};function N(){["current_month","last_3_months","ytd","all"].forEach(t=>{document.getElementById(`tab-${t}`)?.addEventListener("click",()=>C(t))}),document.getElementById("resetViewBtn")?.addEventListener("click",()=>{s.hiddenRows.clear(),s.flaggedRows.clear(),x()});let e;document.getElementById("searchInput")?.addEventListener("input",t=>{clearTimeout(e),e=setTimeout(()=>m(t.target.value),300)}),document.getElementById("filterBtn")?.addEventListener("click",()=>{s.filterArrears=!s.filterArrears;const t=document.getElementById("filterBtn");t.innerHTML=s.filterArrears?'<i class="fa-solid fa-filter mr-2"></i> <span>Filter: Arrears Only</span>':'<i class="fa-solid fa-filter mr-2"></i> <span>Filter: All</span>',t.className=s.filterArrears?"px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg":"px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50",m(document.getElementById("searchInput")?.value)}),document.getElementById("sortBtn")?.addEventListener("click",()=>{const t=["month_desc","month_asc","amount_desc","amount_asc"],n=["Date (Newest)","Date (Oldest)","Principal (High)","Principal (Low)"],a=(t.indexOf(s.sortMode)+1)%t.length;s.sortMode=t[a],document.getElementById("sortBtn").innerHTML=`<i class="fa-solid fa-sort mr-2"></i> <span>Sort: ${n[a]}</span>`,m(document.getElementById("searchInput")?.value)}),document.getElementById("printPdfBtn")?.addEventListener("click",()=>window.print()),document.getElementById("exportExcelBtn")?.addEventListener("click",()=>T())}function P(){document.querySelectorAll(".hide-btn").forEach(e=>{e.addEventListener("click",t=>{const n=t.currentTarget.dataset.id;s.hiddenRows.has(n)?s.hiddenRows.delete(n):s.hiddenRows.add(n),x()})}),document.querySelectorAll(".flag-btn").forEach(e=>{e.addEventListener("click",t=>{const n=t.currentTarget.dataset.id;s.flaggedRows.has(n)?s.flaggedRows.delete(n):s.flaggedRows.add(n),x()})})}async function _(){const e=setTimeout(()=>{const t=document.getElementById("main-content");t&&t.innerHTML.includes("Initializing")&&(t.innerHTML='<div class="p-12 text-center text-red-500"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><p>Network Error. Please refresh.</p></div>')},8e3);try{await E(),document.getElementById("main-content").innerHTML=k,N();const{data:t,error:n}=await I();if(clearTimeout(e),n)throw n;s.rawData=t||[],m()}catch(t){console.error("Init Error:",t)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",_):_();
