import { initLayout } from '../shared/layout.js';
import { formatCurrency } from '../shared/utils.js';
import { fetchFinancialsData, fetchBranches, DEFAULT_SYSTEM_SETTINGS } from '../services/dataService.js';
import { getCachedTheme, getCompanyName } from '../shared/theme.js';

const escapeHtml = (value = '') => `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const getBrandName = () => getCompanyName(getCachedTheme()) || DEFAULT_SYSTEM_SETTINGS.company_name;

const getBrandSlug = () => {
    const slug = (getBrandName() || 'Company')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 60);
    return slug || 'company';
};

/**
 * HARDCODED EXCEL ENGINE (No External Dependencies)
 * Generates a UTF-8 CSV compatible with Excel for offline exports.
 */
if (!window.XLSX) {
    window.XLSX = {
        utils: {
            json_to_sheet: (data) => data,
            book_new: () => ({ Sheets: {}, SheetNames: [] }),
            book_append_sheet: (wb, ws, name) => {
                wb.Sheets[name] = ws;
                wb.SheetNames.push(name);
            }
        },
        writeFile: (wb, filename) => {
            const sheetName = wb.SheetNames[0];
            const data = wb.Sheets[sheetName];
            if (!data || data.length === 0) return;

            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(","),
                ...data.map(row => headers.map(header => {
                    const cell = row[header] === null || row[header] === undefined ? "" : row[header];
                    return typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell;
                }).join(","))
            ].join("\n");

            const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename.replace(".xlsx", ".csv"));
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
}

let currentRange = 'YTD'; 

// --- HTML TEMPLATE ---
const companyNameHtml = escapeHtml(getBrandName());

const pageTemplate = `
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
                <h1 class="text-2xl font-bold text-gray-900">${companyNameHtml}</h1>
                <p class="text-sm text-gray-500 uppercase font-semibold">Financial Performance Statement</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold">Report Period: ${currentRange}</p>
                <p class="text-xs text-gray-400">Issued: ${new Date().toLocaleDateString('en-GB')}</p>
            </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-end border-b border-outline-variant/20 pb-6 gap-4 print:hidden">
            <div>
                <h1 class="text-3xl font-headline font-bold text-on-surface tracking-tight">${companyNameHtml}</h1>
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
`;

// --- DATA UTILITIES ---
const safeNum = (val) => (val === undefined || val === null || isNaN(val) ? 0 : val);

function exportFinancialsToExcel() {
    const tables = ['income-table-body', 'ratios-table-body', 'bs-table-body'];
    let combinedData = [];
    
    tables.forEach(id => {
        const rows = document.getElementById(id)?.querySelectorAll('tr');
        rows?.forEach(row => {
            const cells = row.querySelectorAll('td');
            if(cells.length >= 2) {
                combinedData.push({ 
                    "Section": id.replace('-table-body', '').toUpperCase(),
                    "Item": cells[0].innerText.trim(), 
                    "Value": cells[1].innerText.trim() 
                });
            }
        });
    });

    const ws = XLSX.utils.json_to_sheet(combinedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financials");
    XLSX.writeFile(wb, `${getBrandSlug()}_Financial_Report_${currentRange}.xlsx`);
}

const renderRow = (label, value, isBold = false, isTotal = false, customColorClass = "") => {
    let rowStyle = "border-b border-gray-100 hover:bg-gray-50 transition-colors";
    let labelStyle = "px-8 py-4 text-gray-700";
    let valStyle = "px-8 py-4 text-right font-mono text-gray-800";

    if (isTotal) {
        rowStyle = "bg-gray-50 font-bold border-t-2 border-gray-100";
        labelStyle = "px-8 py-4 text-gray-900 font-extrabold uppercase text-xs tracking-wider";
        valStyle = "px-8 py-4 text-right font-bold text-gray-900 text-lg";
    } else if (isBold) {
        labelStyle = "px-8 py-4 font-bold text-gray-900";
        valStyle = "px-8 py-4 text-right font-bold text-gray-900";
    }

    if (customColorClass) valStyle += ` ${customColorClass}`;

    return `
        <tr class="${rowStyle}">
            <td class="${labelStyle}">${label}</td>
            <td class="${valStyle}">${value}</td>
        </tr>`;
};

async function loadFinancials(range) {
    const loader = document.getElementById('loading-indicator');
    const content = document.getElementById('report-content');

    if(loader) loader.classList.remove('hidden');
    if(content) content.classList.add('opacity-50');

    const branchId = document.getElementById('branch-filter')?.value || 'all';

    try {
        const { data, error } = await fetchFinancialsData(branchId);
        
        // Ensure 0 is rendered even if data is missing
        const fallback = {
            incomeStatement: { interestIncome: 0, nii: 0, feeIncome: 0, nir: 0, totalRevenue: 0 },
            ratios: { clr: 0, niiToRevenue: 0, nirToRevenue: 0 },
            balanceSheet: { totalLoanBook: 0, activeClients: 0, avgLoanPerClient: 0, arrearsPercentage: 0 }
        };

        const result = (error || !data) ? fallback : data;
        const { incomeStatement, ratios, balanceSheet } = result;

        content.innerHTML = `
            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="px-8 py-5 border-b border-outline-variant/10 bg-surface-container-lowest flex justify-between items-center">
                    <h3 class="font-headline font-bold text-lg text-on-surface">Income Statement</h3>
                    <span class="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">${range} Performance</span>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="income-table-body">
                        ${renderRow("Interest Income", formatCurrency(safeNum(incomeStatement.interestIncome)))}
                        ${renderRow("Net Interest Income (NII)", formatCurrency(safeNum(incomeStatement.nii)), true)}
                        ${renderRow("Non-Interest Revenue (NIR)", formatCurrency(safeNum(incomeStatement.nir + incomeStatement.feeIncome)))}
                        ${renderRow("Total Revenue", formatCurrency(safeNum(incomeStatement.totalRevenue)), false, true)}
                    </tbody>
                </table>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="px-8 py-5 border-b border-outline-variant/10 bg-surface-container-lowest">
                    <h3 class="font-headline font-bold text-lg text-on-surface">Key Ratios</h3>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="ratios-table-body">
                        ${renderRow("Credit Loss Ratio (CLR)", safeNum(ratios.clr), false, false, "text-red-600")}
                        ${renderRow("NII % of Total Revenue", safeNum(ratios.niiToRevenue).toFixed(1) + "%")}
                        ${renderRow("NIR % of Total Revenue", safeNum(ratios.nirToRevenue).toFixed(1) + "%")}
                    </tbody>
                </table>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="px-8 py-5 border-b border-outline-variant/10 bg-surface-container-lowest flex justify-between items-center">
                    <h3 class="font-headline font-bold text-lg text-on-surface">Balance Sheet Snapshot</h3>
                </div>
                <table class="w-full text-sm text-left">
                    <tbody id="bs-table-body">
                        ${renderRow("Total Loan Book Value", formatCurrency(safeNum(balanceSheet.totalLoanBook)), true)}
                        ${renderRow("Total Active Clients", safeNum(balanceSheet.activeClients))}
                        ${renderRow("Arrears Rate", safeNum(balanceSheet.arrearsPercentage).toFixed(1) + "%", false, false, "text-red-600")}
                    </tbody>
                </table>
            </div>`;

    } catch (e) {
        console.error("Financial Load Error:", e);
    } finally {
        if(loader) loader.classList.add('hidden');
        if(content) content.classList.remove('opacity-50');
    }
}

// --- LISTENERS ---
function attachListeners() {
    ['1M', '3M', '6M', 'YTD'].forEach(range => {
        document.getElementById(`tab-${range}`)?.addEventListener('click', () => {
            currentRange = range;
            document.querySelectorAll('.time-tab').forEach(b => b.classList.remove('bg-white', 'text-blue-600', 'shadow-sm'));
            document.getElementById(`tab-${range}`)?.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            loadFinancials(range);
        });
    });

    document.getElementById('printPdfBtn')?.addEventListener('click', () => window.print());
    document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportFinancialsToExcel());
    document.getElementById('branch-filter')?.addEventListener('change', () => loadFinancials(currentRange));
}

async function populateBranchDropdown() {
    const select = document.getElementById('branch-filter');
    if (!select) return;
    try {
        const { data: branches } = await fetchBranches();
        if (branches?.length) {
            branches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id; opt.textContent = b.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { /* branches optional */ }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Safety Timer (8 Seconds)
    const safetyTimer = setTimeout(() => {
        const content = document.getElementById('report-content');
        if (content && content.innerHTML.trim() === "") {
            content.innerHTML = `<div class="p-12 text-center text-red-500"><p>Network Timeout. Rendering default view...</p></div>`;
            loadFinancials('YTD'); 
        }
    }, 8000);

    await initLayout();
    document.getElementById('main-content').innerHTML = pageTemplate;
    attachListeners();
    await populateBranchDropdown();
    await loadFinancials('YTD');
    clearTimeout(safetyTimer);
});
