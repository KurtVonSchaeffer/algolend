import"./supabaseClient-Ki9k9WNi.js";import{c as E,i as I,a as A}from"./layout-P4Epjfxm.js";import{a as c}from"./utils-D6Z1B7Jq.js";import{z as B}from"./dataService-OY041MzK.js";const R=(e="")=>`${e}`.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),_=()=>E(A()),S=()=>_().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").substring(0,60)||"company";window.XLSX||(window.XLSX={utils:{json_to_sheet:e=>e,book_new:()=>({Sheets:{},SheetNames:[]}),book_append_sheet:(e,t,r)=>{e.Sheets[r]=t,e.SheetNames.push(r)}},writeFile:(e,t)=>{const r=e.SheetNames[0],a=e.Sheets[r];if(!a||a.length===0)return;const n=Object.keys(a[0]),i=[n.join(","),...a.map(o=>n.map(d=>{const h=o[d]===null||o[d]===void 0?"":o[d];return typeof h=="string"?`"${h.replace(/"/g,'""')}"`:h}).join(","))].join(`
`),l=new Blob(["\uFEFF"+i],{type:"text/csv;charset=utf-8;"}),p=document.createElement("a"),f=URL.createObjectURL(l);p.setAttribute("href",f),p.setAttribute("download",t.replace(".xlsx",".csv")),p.style.visibility="hidden",document.body.appendChild(p),p.click(),document.body.removeChild(p)}});let s={rawData:[],processedData:[],filterArrears:!1,sortMode:"month_desc",hiddenRows:new Set,flaggedRows:new Set,exportPeriod:"all"};const y=e=>`${e.loan_id}-${e.month}`,x=(e,t=[])=>{for(const r of t){const a=e?.[r],n=Number(a);if(!Number.isNaN(n)&&a!==null&&a!==void 0)return n}return 0},g=e=>x(e,["principal_collected_month","principal_outstanding"]),v=e=>x(e,["interest_collected_month","interest_receivable"]),w=e=>x(e,["fees_collected_month","fee_receivable","admin_collected_month","initiation_collected_month"]),b=e=>x(e,["arrears_amount","principal_outstanding"]);function $(){if(typeof XLSX>"u")return alert("Excel library not loaded.");const e=s.processedData.map(a=>({"Loan ID":a.loan_id,Customer:a.customer||"N/A","Statement Period":a.month,"Principal (ZAR)":g(a),"Interest (ZAR)":v(a),"Fees (ZAR)":w(a),"Arrears (ZAR)":b(a)})),t=XLSX.utils.json_to_sheet(e),r=XLSX.utils.book_new();XLSX.utils.book_append_sheet(r,t,"Analytics"),XLSX.writeFile(r,`${S()}_Analytics_${s.exportPeriod}.xlsx`)}const D=R(_()),T=`
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
                <h1 class="text-2xl font-bold text-gray-900">${D}</h1>
                <p class="text-sm text-gray-500 uppercase font-semibold">Revenue Analytics Report</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold">Generated: ${new Date().toLocaleDateString("en-GB")}</p>
            </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 pb-6 gap-4 print:hidden">
            <div>
                <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Revenue Analytics</h1>
                <p class="text-sm text-gray-500 mt-2">Portfolio Revenue & Amortisation Statement</p>
            </div>
            
            <div class="flex items-center space-x-4">
                <div class="bg-gray-100 p-1 rounded-lg flex space-x-1 period-tab-container">
                    <button id="tab-current_month" class="period-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all text-gray-500">1M</button>
                    <button id="tab-last_3_months" class="period-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all text-gray-500">3M</button>
                    <button id="tab-ytd" class="period-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all text-gray-500">YTD</button>
                    <button id="tab-all" class="period-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all bg-white text-blue-600 shadow-sm">ALL</button>
                </div>

                <div class="relative group">
                    <button class="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 shadow-md">
                        <i class="fa-solid fa-file-export mr-2"></i> Export <i class="fa-solid fa-chevron-down ml-2 text-xs opacity-70"></i>
                    </button>
                    <div class="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                        <button id="printPdfBtn" class="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center border-b border-gray-100">
                            <i class="fa-solid fa-file-pdf mr-3 text-red-500"></i> Save as PDF
                        </button>
                        <button id="exportExcelBtn" class="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                            <i class="fa-solid fa-file-excel mr-3 text-green-600"></i> Download Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center print:hidden">
            <div class="flex items-center gap-4 w-full md:w-auto">
                <div class="relative w-full md:w-96">
                    <i class="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="searchInput" placeholder="Search customer or loan ID..." class="w-full pl-10 pr-4 py-2 text-sm border-none bg-gray-50 rounded-lg outline-none">
                </div>
                <button id="resetViewBtn" class="hidden items-center px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all whitespace-nowrap">
                    <i class="fa-solid fa-rotate-left mr-2"></i> Reset View
                </button>
            </div>
            
            <div class="flex items-center gap-2">
                <button id="filterBtn" class="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <i class="fa-solid fa-filter mr-2"></i> <span>Filter: All</span>
                </button>
                <button id="sortBtn" class="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <i class="fa-solid fa-sort mr-2"></i> <span>Sort: Date (Newest)</span>
                </button>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative print:border-none">
            <div class="overflow-x-auto max-h-[75vh] print:max-h-none print:overflow-visible">
                <table class="w-full text-sm text-left relative border-collapse">
                    <thead class="bg-gray-50 text-gray-500 font-semibold text-[11px] border-b border-gray-200 uppercase sticky-header shadow-sm print:static">
                        <tr>
                            <th class="pl-6 py-4 bg-gray-50">Loan ID</th>
                            <th class="px-4 py-4 bg-gray-50">Customer</th>
                            <th class="px-4 py-4 bg-gray-50">Month</th>
                            <th class="px-4 py-4 text-right bg-gray-50">Principal</th>
                            <th class="px-4 py-4 text-right bg-gray-50">Interest</th>
                            <th class="px-4 py-4 text-right bg-gray-50">Fees</th>
                            <th class="px-4 py-4 text-right bg-gray-50">Arrears</th>
                            <th class="px-4 py-4 text-center bg-gray-50 print:hidden">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="analytics-table-body" class="divide-y divide-gray-100 bg-white">
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
`;function k(e){s.exportPeriod=e,document.querySelectorAll(".period-tab").forEach(r=>{r.classList.remove("bg-white","text-blue-600","shadow-sm"),r.classList.add("text-gray-500")});const t=document.getElementById(`tab-${e}`);t&&(t.classList.remove("text-gray-500"),t.classList.add("bg-white","text-blue-600","shadow-sm")),u(document.getElementById("searchInput")?.value)}function u(e=""){let t=[...s.rawData];const r=new Date;if(s.exportPeriod!=="all"&&(t=t.filter(a=>{const[n,i]=a.month.split("-").map(Number),l=new Date(n,i-1,1);return s.exportPeriod==="current_month"?l.getMonth()===r.getMonth()&&l.getFullYear()===r.getFullYear():s.exportPeriod==="last_3_months"?l>=new Date(r.getFullYear(),r.getMonth()-2,1):s.exportPeriod==="ytd"?n===r.getFullYear():!0})),e){const a=e.toLowerCase();t=t.filter(n=>n.customer&&String(n.customer).toLowerCase().includes(a)||n.loan_id&&String(n.loan_id).toLowerCase().includes(a))}s.filterArrears&&(t=t.filter(a=>b(a)>0)),t.sort((a,n)=>{switch(s.sortMode){case"month_desc":return n.month.localeCompare(a.month);case"month_asc":return a.month.localeCompare(n.month);case"amount_desc":return g(n)-g(a);case"amount_asc":return g(a)-g(n);default:return 0}}),s.processedData=t,m()}function m(){const e=document.getElementById("analytics-table-body"),t=s.processedData,r=document.getElementById("resetViewBtn");if(!t.length){e.innerHTML='<tr><td colspan="8" class="text-center py-12 text-gray-400">No records found.</td></tr>';return}s.hiddenRows.size>0||s.flaggedRows.size>0?(r?.classList.remove("hidden"),r?.classList.add("flex")):r?.classList.add("hidden");let a=t.filter(o=>!s.hiddenRows.has(y(o)));const n=s.flaggedRows.size>0;n&&(a=a.filter(o=>s.flaggedRows.has(y(o))));const i=a.reduce((o,d)=>(o.p+=g(d),o.i+=v(d),o.f+=w(d),o.a+=b(d),o),{p:0,i:0,f:0,a:0,count:a.length}),f=`
        <tr class="bg-gray-50 font-bold border-b-2 border-gray-200 sticky-totals shadow-sm print:static">
            <td class="pl-6 py-4 text-xs uppercase ${n?"text-orange-600":"text-gray-900"}">${n?"HIGHLIGHTED TOTALS":"VISIBLE TOTALS"}</td>
            <td class="px-4 py-4 text-xs text-gray-500">${i.count} Items</td>
            <td></td>
            <td class="px-4 py-4 text-right text-gray-900">${c(i.p)}</td>
            <td class="px-4 py-4 text-right text-gray-900">${c(i.i)}</td>
            <td class="px-4 py-4 text-right text-blue-700">${c(i.f)}</td>
            <td class="px-4 py-4 text-right text-red-600">${c(i.a)}</td>
            <td class="print:hidden"></td>
        </tr>`;e.innerHTML=f+t.map(o=>C(o)).join(""),N()}const C=e=>{const t=y(e),r=s.hiddenRows.has(t),a=s.flaggedRows.has(t),n=b(e),i=n>0?"text-red-600 font-bold":"text-gray-400";let l="border-b border-gray-50 transition-colors group";return r?l+=" bg-gray-50 opacity-40 grayscale":a?l+=" bg-yellow-50 border-l-4 border-l-orange-400":l+=" hover:bg-gray-50",`
        <tr class="${l}">
            <td class="pl-6 py-4 font-medium text-gray-900">${e.loan_id}</td>
            <td class="px-4 py-4 text-gray-700 font-medium">${e.customer||"N/A"}</td>
            <td class="px-4 py-4 text-gray-500 font-mono text-xs">${e.month}</td>
            <td class="px-4 py-4 text-right text-gray-700">${c(g(e))}</td>
            <td class="px-4 py-4 text-right text-gray-600">${c(v(e))}</td>
            <td class="px-4 py-4 text-right text-blue-600 font-medium">${c(w(e))}</td>
            <td class="px-4 py-4 text-right ${i}">${c(n)}</td>
            <td class="px-4 py-4 text-center print:hidden">
                <div class="flex items-center justify-center gap-2">
                    <button class="hide-btn p-1.5 hover:bg-gray-200 rounded-md" data-id="${t}">
                        <i class="${r?"fa-solid fa-eye text-gray-600":"fa-regular fa-eye-slash text-gray-400"}"></i>
                    </button>
                    <button class="flag-btn p-1.5 hover:bg-orange-100 rounded-md" data-id="${t}">
                        <i class="${a?"fa-solid fa-flag text-orange-600":"fa-regular fa-flag text-gray-400"}"></i>
                    </button>
                </div>
            </td>
        </tr>`};function M(){["current_month","last_3_months","ytd","all"].forEach(t=>{document.getElementById(`tab-${t}`)?.addEventListener("click",()=>k(t))}),document.getElementById("resetViewBtn")?.addEventListener("click",()=>{s.hiddenRows.clear(),s.flaggedRows.clear(),m()});let e;document.getElementById("searchInput")?.addEventListener("input",t=>{clearTimeout(e),e=setTimeout(()=>u(t.target.value),300)}),document.getElementById("filterBtn")?.addEventListener("click",()=>{s.filterArrears=!s.filterArrears;const t=document.getElementById("filterBtn");t.innerHTML=s.filterArrears?'<i class="fa-solid fa-filter mr-2"></i> <span>Filter: Arrears Only</span>':'<i class="fa-solid fa-filter mr-2"></i> <span>Filter: All</span>',t.className=s.filterArrears?"px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg":"px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50",u(document.getElementById("searchInput")?.value)}),document.getElementById("sortBtn")?.addEventListener("click",()=>{const t=["month_desc","month_asc","amount_desc","amount_asc"],r=["Date (Newest)","Date (Oldest)","Principal (High)","Principal (Low)"],a=(t.indexOf(s.sortMode)+1)%t.length;s.sortMode=t[a],document.getElementById("sortBtn").innerHTML=`<i class="fa-solid fa-sort mr-2"></i> <span>Sort: ${r[a]}</span>`,u(document.getElementById("searchInput")?.value)}),document.getElementById("printPdfBtn")?.addEventListener("click",()=>window.print()),document.getElementById("exportExcelBtn")?.addEventListener("click",()=>$())}function N(){document.querySelectorAll(".hide-btn").forEach(e=>{e.addEventListener("click",t=>{const r=t.currentTarget.dataset.id;s.hiddenRows.has(r)?s.hiddenRows.delete(r):s.hiddenRows.add(r),m()})}),document.querySelectorAll(".flag-btn").forEach(e=>{e.addEventListener("click",t=>{const r=t.currentTarget.dataset.id;s.flaggedRows.has(r)?s.flaggedRows.delete(r):s.flaggedRows.add(r),m()})})}async function L(){const e=setTimeout(()=>{const t=document.getElementById("main-content");t&&t.innerHTML.includes("Initializing")&&(t.innerHTML='<div class="p-12 text-center text-red-500"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><p>Network Error. Please refresh.</p></div>')},8e3);try{await I(),document.getElementById("main-content").innerHTML=T,M();const{data:t,error:r}=await B();if(clearTimeout(e),r)throw r;s.rawData=t||[],u()}catch(t){console.error("Init Error:",t)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",L):L();
