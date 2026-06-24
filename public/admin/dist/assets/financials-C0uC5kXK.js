import"./supabaseClient-DdIec1HK.js";/* empty css              */import{i as h}from"./layout-Nmoyu__-.js";import{a as b}from"./utils-CZwHw4kl.js";import{c as v,p as w}from"./dataService-gd72TqA3.js";import{b as E,D as I,g as L}from"./theme-CYs9TE7o.js";import"https://esm.sh/@supabase/supabase-js@2";const S=(e="")=>`${e}`.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),g=()=>E(L())||I.company_name,T=()=>(g()||"Company").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").substring(0,60)||"company";window.XLSX||(window.XLSX={utils:{json_to_sheet:e=>e,book_new:()=>({Sheets:{},SheetNames:[]}),book_append_sheet:(e,t,n)=>{e.Sheets[n]=t,e.SheetNames.push(n)}},writeFile:(e,t)=>{const n=e.SheetNames[0],a=e.Sheets[n];if(!a||a.length===0)return;const i=Object.keys(a[0]),d=[i.join(","),...a.map(p=>i.map(m=>{const f=p[m]===null||p[m]===void 0?"":p[m];return typeof f=="string"?`"${f.replace(/"/g,'""')}"`:f}).join(","))].join(`
`),l=new Blob(["\uFEFF"+d],{type:"text/csv;charset=utf-8;"}),o=document.createElement("a"),c=URL.createObjectURL(l);o.setAttribute("href",c),o.setAttribute("download",t.replace(".xlsx",".csv")),o.style.visibility="hidden",document.body.appendChild(o),o.click(),document.body.removeChild(o)}});let u="YTD";const y=S(g()),R=`
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
                <h1 class="text-2xl font-bold text-gray-900">${y}</h1>
                <p class="text-sm text-gray-500 uppercase font-semibold">Financial Performance Statement</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold">Report Period: ${u}</p>
                <p class="text-xs text-gray-400">Issued: ${new Date().toLocaleDateString("en-GB")}</p>
            </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-end border-b border-outline-variant/20 pb-6 gap-4 print:hidden">
            <div>
                <h1 class="text-3xl font-headline font-bold text-on-surface tracking-tight">${y}</h1>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Financial Reports & Performance Metrics</p>
            </div>

            <div class="flex items-center space-x-4">
                <select id="branch-filter" class="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:ring-orange-400 focus:outline-none bg-white font-semibold text-gray-700">
                    <option value="all">All Branches</option>
                </select>
                <div class="bg-surface-container p-1 rounded-xl flex space-x-1">
                    <button id="tab-1M" class="time-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-outline">1M</button>
                    <button id="tab-3M" class="time-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-outline">3M</button>
                    <button id="tab-6M" class="time-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-outline">6M</button>
                    <button id="tab-YTD" class="time-tab px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-white shadow-sm" style="color:var(--color-primary)">YTD</button>
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

        <div id="loading-indicator" class="hidden py-12 flex justify-center">
            <i class="fa-solid fa-circle-notch fa-spin text-blue-600 text-2xl"></i>
        </div>

        <div id="report-content" class="grid grid-cols-1 gap-8 transition-opacity duration-300">
            </div>
    </div>
`,r=e=>e==null||isNaN(e)?0:e;function $(){const e=["income-table-body","ratios-table-body","bs-table-body"];let t=[];e.forEach(i=>{document.getElementById(i)?.querySelectorAll("tr")?.forEach(l=>{const o=l.querySelectorAll("td");o.length>=2&&t.push({Section:i.replace("-table-body","").toUpperCase(),Item:o[0].innerText.trim(),Value:o[1].innerText.trim()})})});const n=XLSX.utils.json_to_sheet(t),a=XLSX.utils.book_new();XLSX.utils.book_append_sheet(a,n,"Financials"),XLSX.writeFile(a,`${T()}_Financial_Report_${u}.xlsx`)}const s=(e,t,n=!1,a=!1,i="")=>{let d="border-b border-gray-100 hover:bg-gray-50 transition-colors",l="px-8 py-4 text-gray-700",o="px-8 py-4 text-right font-mono text-gray-800";return a?(d="bg-gray-50 font-bold border-t-2 border-gray-100",l="px-8 py-4 text-gray-900 font-extrabold uppercase text-xs tracking-wider",o="px-8 py-4 text-right font-bold text-gray-900 text-lg"):n&&(l="px-8 py-4 font-bold text-gray-900",o="px-8 py-4 text-right font-bold text-gray-900"),i&&(o+=` ${i}`),`
        <tr class="${d}">
            <td class="${l}">${e}</td>
            <td class="${o}">${t}</td>
        </tr>`};async function x(e){const t=document.getElementById("loading-indicator"),n=document.getElementById("report-content");t&&t.classList.remove("hidden"),n&&n.classList.add("opacity-50");const a=document.getElementById("branch-filter")?.value||"all";try{const{data:i,error:d}=await v(a),o=d||!i?{incomeStatement:{interestIncome:0,nii:0,feeIncome:0,nir:0,totalRevenue:0},ratios:{clr:0,niiToRevenue:0,nirToRevenue:0},balanceSheet:{totalLoanBook:0,activeClients:0,avgLoanPerClient:0,arrearsPercentage:0}}:i,{incomeStatement:c,ratios:p,balanceSheet:m}=o;n.innerHTML=`
            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="px-8 py-5 border-b border-outline-variant/10 bg-surface-container-lowest flex justify-between items-center">
                    <h3 class="font-headline font-bold text-lg text-on-surface">Income Statement</h3>
                    <span class="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">${e} Performance</span>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="income-table-body">
                        ${s("Interest Income",b(r(c.interestIncome)))}
                        ${s("Net Interest Income (NII)",b(r(c.nii)),!0)}
                        ${s("Non-Interest Revenue (NIR)",b(r(c.nir+c.feeIncome)))}
                        ${s("Total Revenue",b(r(c.totalRevenue)),!1,!0)}
                    </tbody>
                </table>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="px-8 py-5 border-b border-outline-variant/10 bg-surface-container-lowest">
                    <h3 class="font-headline font-bold text-lg text-on-surface">Key Ratios</h3>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="ratios-table-body">
                        ${s("Credit Loss Ratio (CLR)",r(p.clr),!1,!1,"text-red-600")}
                        ${s("NII % of Total Revenue",r(p.niiToRevenue).toFixed(1)+"%")}
                        ${s("NIR % of Total Revenue",r(p.nirToRevenue).toFixed(1)+"%")}
                    </tbody>
                </table>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="px-8 py-5 border-b border-outline-variant/10 bg-surface-container-lowest flex justify-between items-center">
                    <h3 class="font-headline font-bold text-lg text-on-surface">Balance Sheet Snapshot</h3>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="bs-table-body">
                        ${s("Total Loan Book Value",b(r(m.totalLoanBook)),!0)}
                        ${s("Total Active Clients",r(m.activeClients))}
                        ${s("Arrears Rate",r(m.arrearsPercentage).toFixed(1)+"%",!1,!1,"text-red-600")}
                    </tbody>
                </table>
            </div>`}catch(i){console.error("Financial Load Error:",i)}finally{t&&t.classList.add("hidden"),n&&n.classList.remove("opacity-50")}}function B(){["1M","3M","6M","YTD"].forEach(e=>{document.getElementById(`tab-${e}`)?.addEventListener("click",()=>{u=e,document.querySelectorAll(".time-tab").forEach(t=>t.classList.remove("bg-white","text-blue-600","shadow-sm")),document.getElementById(`tab-${e}`)?.classList.add("bg-white","text-blue-600","shadow-sm"),x(e)})}),document.getElementById("printPdfBtn")?.addEventListener("click",()=>window.print()),document.getElementById("exportExcelBtn")?.addEventListener("click",()=>$()),document.getElementById("branch-filter")?.addEventListener("change",()=>x(u))}async function k(){const e=document.getElementById("branch-filter");if(e)try{const{data:t}=await w();t?.length&&t.forEach(n=>{const a=document.createElement("option");a.value=n.id,a.textContent=n.name,e.appendChild(a)})}catch{}}document.addEventListener("DOMContentLoaded",async()=>{const e=setTimeout(()=>{const t=document.getElementById("report-content");t&&t.innerHTML.trim()===""&&(t.innerHTML='<div class="p-12 text-center text-red-500"><p>Network Timeout. Rendering default view...</p></div>',x("YTD"))},8e3);await h(),document.getElementById("main-content").innerHTML=R,B(),await k(),await x("YTD"),clearTimeout(e)});
