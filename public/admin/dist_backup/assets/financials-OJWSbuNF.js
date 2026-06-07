import"./supabaseClient-Ki9k9WNi.js";import{c as h,i as v,a as w}from"./layout-P4Epjfxm.js";import{a as m}from"./utils-D6Z1B7Jq.js";import{c as L}from"./dataService-OY041MzK.js";const I=(e="")=>`${e}`.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),y=()=>h(w()),S=()=>y().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").substring(0,60)||"company";window.XLSX||(window.XLSX={utils:{json_to_sheet:e=>e,book_new:()=>({Sheets:{},SheetNames:[]}),book_append_sheet:(e,o,a)=>{e.Sheets[a]=o,e.SheetNames.push(a)}},writeFile:(e,o)=>{const a=e.SheetNames[0],n=e.Sheets[a];if(!n||n.length===0)return;const i=Object.keys(n[0]),c=[i.join(","),...n.map(d=>i.map(p=>{const x=d[p]===null||d[p]===void 0?"":d[p];return typeof x=="string"?`"${x.replace(/"/g,'""')}"`:x}).join(","))].join(`
`),l=new Blob(["\uFEFF"+c],{type:"text/csv;charset=utf-8;"}),t=document.createElement("a"),b=URL.createObjectURL(l);t.setAttribute("href",b),t.setAttribute("download",o.replace(".xlsx",".csv")),t.style.visibility="hidden",document.body.appendChild(t),t.click(),document.body.removeChild(t)}});let f="YTD";const g=I(y()),T=`
    <div class="flex flex-col space-y-8 max-w-5xl mx-auto">
        <style>
            /* UI PRIVACY & PRINT REFINEMENT */
            @media print {
                @page { size: portrait; margin: 12mm; }
                
                /* 1. Remove App Shell */
                nav, aside, header, .hamburger, .sidebar, .notification-bell, .user-profile, 
                .rounded-full, .print\\:hidden, button, .bg-gray-100 { 
                    display: none !important; 
                }

                /* 2. Fix Empty Page Issue: Force Visibility */
                body, html { background: white !important; margin: 0 !important; padding: 0 !important; }
                #main-content, #report-content, .max-w-5xl { 
                    display: block !important; 
                    width: 100% !important; 
                    max-width: none !important; 
                    opacity: 1 !important;
                    visibility: visible !important;
                }

                /* 3. Professional Paper Styling */
                .shadow-sm { border: 1px solid #e5e7eb !important; box-shadow: none !important; border-radius: 12px !important; }
                .bg-gray-50\\/50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; }
                tr { page-break-inside: avoid; }
            }
        </style>

        <div class="hidden print:flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">${g}</h1>
                <p class="text-sm text-gray-500 uppercase font-semibold">Financial Performance Statement</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold">Report Period: ${f}</p>
                <p class="text-xs text-gray-400">Issued: ${new Date().toLocaleDateString("en-GB")}</p>
            </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 pb-6 gap-4 print:hidden">
            <div>
                <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">${g}</h1>
                <p class="text-sm text-gray-500 mt-2">Financial Reports & Performance Metrics</p>
            </div>
            
            <div class="flex items-center space-x-4">
                <div class="bg-gray-100 p-1 rounded-lg flex space-x-1">
                    <button id="tab-1M" class="time-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all text-gray-500">1M</button>
                    <button id="tab-3M" class="time-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all text-gray-500">3M</button>
                    <button id="tab-6M" class="time-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all text-gray-500">6M</button>
                    <button id="tab-YTD" class="time-tab px-3 py-1.5 text-xs font-medium rounded-md transition-all bg-white text-blue-600 shadow-sm">YTD</button>
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

        <div id="loading-indicator" class="hidden py-12 flex justify-center">
            <i class="fa-solid fa-circle-notch fa-spin text-blue-600 text-2xl"></i>
        </div>

        <div id="report-content" class="grid grid-cols-1 gap-8 transition-opacity duration-300">
            </div>
    </div>
`,r=e=>e==null||isNaN(e)?0:e;function E(){const e=["income-table-body","ratios-table-body","bs-table-body"];let o=[];e.forEach(i=>{document.getElementById(i)?.querySelectorAll("tr")?.forEach(l=>{const t=l.querySelectorAll("td");t.length>=2&&o.push({Section:i.replace("-table-body","").toUpperCase(),Item:t[0].innerText.trim(),Value:t[1].innerText.trim()})})});const a=XLSX.utils.json_to_sheet(o),n=XLSX.utils.book_new();XLSX.utils.book_append_sheet(n,a,"Financials"),XLSX.writeFile(n,`${S()}_Financial_Report_${f}.xlsx`)}const s=(e,o,a=!1,n=!1,i="")=>{let c="border-b border-gray-100 hover:bg-gray-50 transition-colors",l="px-8 py-4 text-gray-700",t="px-8 py-4 text-right font-mono text-gray-800";return n?(c="bg-gray-50 font-bold border-t-2 border-gray-100",l="px-8 py-4 text-gray-900 font-extrabold uppercase text-xs tracking-wider",t="px-8 py-4 text-right font-bold text-gray-900 text-lg"):a&&(l="px-8 py-4 font-bold text-gray-900",t="px-8 py-4 text-right font-bold text-gray-900"),i&&(t+=` ${i}`),`
        <tr class="${c}">
            <td class="${l}">${e}</td>
            <td class="${t}">${o}</td>
        </tr>`};async function u(e){const o=document.getElementById("loading-indicator"),a=document.getElementById("report-content");o&&o.classList.remove("hidden"),a&&a.classList.add("opacity-50");try{const{data:n,error:i}=await L(e),l=i||!n?{incomeStatement:{interestIncome:0,nii:0,feeIncome:0,nir:0,totalRevenue:0},ratios:{clr:0,niiToRevenue:0,nirToRevenue:0},balanceSheet:{totalLoanBook:0,activeClients:0,avgLoanPerClient:0,arrearsPercentage:0}}:n,{incomeStatement:t,ratios:b,balanceSheet:d}=l;a.innerHTML=`
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="px-8 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 class="font-bold text-lg text-gray-800">Income Statement</h3>
                    <span class="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">${e} Performance</span>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="income-table-body">
                        ${s("Interest Income",m(r(t.interestIncome)))}
                        ${s("Net Interest Income (NII)",m(r(t.nii)),!0)}
                        ${s("Non-Interest Revenue (NIR)",m(r(t.nir+t.feeIncome)))}
                        ${s("Total Revenue",m(r(t.totalRevenue)),!1,!0)}
                    </tbody>
                </table>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="px-8 py-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 class="font-bold text-lg text-gray-800">Key Ratios</h3>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="ratios-table-body">
                        ${s("Credit Loss Ratio (CLR)",r(b.clr),!1,!1,"text-red-600")}
                        ${s("NII % of Total Revenue",r(b.niiToRevenue).toFixed(1)+"%")}
                        ${s("NIR % of Total Revenue",r(b.nirToRevenue).toFixed(1)+"%")}
                    </tbody>
                </table>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="px-8 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 class="font-bold text-lg text-gray-800">Balance Sheet Snapshot</h3>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="bs-table-body">
                        ${s("Total Loan Book Value",m(r(d.totalLoanBook)),!0)}
                        ${s("Total Active Clients",r(d.activeClients))}
                        ${s("Arrears Rate",r(d.arrearsPercentage).toFixed(1)+"%",!1,!1,"text-red-600")}
                    </tbody>
                </table>
            </div>`}catch(n){console.error("Financial Load Error:",n)}finally{o&&o.classList.add("hidden"),a&&a.classList.remove("opacity-50")}}function R(){["1M","3M","6M","YTD"].forEach(e=>{document.getElementById(`tab-${e}`)?.addEventListener("click",()=>{f=e,document.querySelectorAll(".time-tab").forEach(o=>o.classList.remove("bg-white","text-blue-600","shadow-sm")),document.getElementById(`tab-${e}`)?.classList.add("bg-white","text-blue-600","shadow-sm"),u(e)})}),document.getElementById("printPdfBtn")?.addEventListener("click",()=>window.print()),document.getElementById("exportExcelBtn")?.addEventListener("click",()=>E())}document.addEventListener("DOMContentLoaded",async()=>{const e=setTimeout(()=>{const o=document.getElementById("report-content");o&&o.innerHTML.trim()===""&&(o.innerHTML='<div class="p-12 text-center text-red-500"><p>Network Timeout. Rendering default view...</p></div>',u("YTD"))},8e3);await v(),document.getElementById("main-content").innerHTML=T,R(),await u("YTD"),clearTimeout(e)});
