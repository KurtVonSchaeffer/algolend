import { initLayout } from '../shared/layout.js';
import { formatCurrency } from '../shared/utils.js';
import { fetchAnalyticsData, DEFAULT_SYSTEM_SETTINGS } from '../services/dataService.js';
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
 * Implements the specific XLSX methods required by this file's export logic.
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
            link.setAttribute("download", filename.replace(".xlsx", ".csv")); // Ensures compatibility across all Excel versions
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
}

// --- STATE MANAGEMENT ---
let appState = {
    rawData: [],
    processedData: [],
    filterArrears: false,
    sortMode: 'month_desc',
    hiddenRows: new Set(),
    flaggedRows: new Set(),
    exportPeriod: 'all' 
};

// --- HELPER FUNCTIONS ---
const getRowId = (row) => `${row.loan_id}-${row.month}`;

const getMetricValue = (row, keys = []) => {
    for (const key of keys) {
        const value = row?.[key];
        const numeric = Number(value);
        if (!Number.isNaN(numeric) && value !== null && value !== undefined) {
            return numeric;
        }
    }
    return 0;
};

const getPrincipalValue = (row) => getMetricValue(row, ['principal_collected_month', 'principal_outstanding']);
const getInterestValue = (row) => getMetricValue(row, ['interest_collected_month', 'interest_receivable']);
const getFeeValue = (row) => getMetricValue(row, ['fees_collected_month', 'fee_receivable', 'admin_collected_month', 'initiation_collected_month']);
const getArrearsValue = (row) => getMetricValue(row, ['arrears_amount', 'principal_outstanding']);

// --- EXCEL EXPORT ---
function exportAnalyticsToExcel() {
    if (typeof XLSX === 'undefined') return alert("Excel library not loaded.");
    const data = appState.processedData.map(row => ({
        "Loan ID": row.loan_id,
        "Customer": row.customer || 'N/A',
        "Statement Period": row.month,
        "Principal (ZAR)": getPrincipalValue(row),
        "Interest (ZAR)": getInterestValue(row),
        "Fees (ZAR)": getFeeValue(row),
        "Arrears (ZAR)": getArrearsValue(row)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytics");
    XLSX.writeFile(wb, `${getBrandSlug()}_Analytics_${appState.exportPeriod}.xlsx`);
}

// --- HTML TEMPLATE ---
const companyNameHtml = escapeHtml(getBrandName());

const pageTemplate = `
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
                <h1 class="text-2xl font-bold text-gray-900">${companyNameHtml}</h1>
                <p class="text-sm text-gray-500 uppercase font-semibold">Revenue Analytics Report</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold">Generated: ${new Date().toLocaleDateString('en-GB')}</p>
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
`;

// --- DATA PROCESSING ---
function switchAnalyticsTab(period) {
    appState.exportPeriod = period;
    document.querySelectorAll('.period-tab').forEach(btn => {
        btn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
        btn.classList.add('text-gray-500');
    });
    const active = document.getElementById(`tab-${period}`);
    if(active) {
        active.classList.remove('text-gray-500');
        active.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
    }
    processData(document.getElementById('searchInput')?.value);
}

function processData(searchTerm = '') {
    let data = [...appState.rawData];
    const now = new Date();

    if (appState.exportPeriod !== 'all') {
        data = data.filter(row => {
            if (!row || !row.month) return false;
            const [year, month] = row.month.split('-').map(Number);
            const rowDate = new Date(year, month - 1, 1);
            if (appState.exportPeriod === 'current_month') return rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear();
            if (appState.exportPeriod === 'last_3_months') return rowDate >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
            if (appState.exportPeriod === 'ytd') return year === now.getFullYear();
            return true;
        });
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter(row => 
            (row.customer && String(row.customer).toLowerCase().includes(term)) || 
            (row.loan_id && String(row.loan_id).toLowerCase().includes(term))
        );
    }

    if (appState.filterArrears) {
        data = data.filter(row => getArrearsValue(row) > 0);
    }

    data = data.filter(row => row && row.month);
    data.sort((a, b) => {
        switch (appState.sortMode) {
            case 'month_desc': return (b.month || '').localeCompare(a.month || '');
            case 'month_asc':  return (a.month || '').localeCompare(b.month || '');
            case 'amount_desc': return getPrincipalValue(b) - getPrincipalValue(a);
            case 'amount_asc':  return getPrincipalValue(a) - getPrincipalValue(b);
            default: return 0;
        }
    });

    appState.processedData = data;
    renderTable();
}

function renderTable() {
    const tableBody = document.getElementById('analytics-table-body');
    const data = appState.processedData;
    const resetBtn = document.getElementById('resetViewBtn');

    if (!data.length) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-gray-400">No records found.</td></tr>`;
        return;
    }

    if (appState.hiddenRows.size > 0 || appState.flaggedRows.size > 0) {
        resetBtn?.classList.remove('hidden');
        resetBtn?.classList.add('flex');
    } else {
        resetBtn?.classList.add('hidden');
    }

    let visibleData = data.filter(row => !appState.hiddenRows.has(getRowId(row)));

    const isHighlightActive = appState.flaggedRows.size > 0;
    if (isHighlightActive) {
        visibleData = visibleData.filter(row => appState.flaggedRows.has(getRowId(row)));
    }

    const totals = visibleData.reduce((acc, row) => {
        acc.p += getPrincipalValue(row);
        acc.i += getInterestValue(row);
        acc.f += getFeeValue(row);
        acc.a += getArrearsValue(row);
        return acc;
    }, { p: 0, i: 0, f: 0, a: 0, count: visibleData.length });

    const totalLabel = isHighlightActive ? "HIGHLIGHTED TOTALS" : "VISIBLE TOTALS";
    const labelColor = isHighlightActive ? "text-orange-600" : "text-gray-900";

    const totalsHTML = `
        <tr class="bg-gray-50 font-bold border-b-2 border-gray-200 sticky-totals shadow-sm print:static">
            <td class="pl-6 py-4 text-xs uppercase ${labelColor}">${totalLabel}</td>
            <td class="px-4 py-4 text-xs text-gray-500">${totals.count} Items</td>
            <td></td>
            <td class="px-4 py-4 text-right text-gray-900">${formatCurrency(totals.p)}</td>
            <td class="px-4 py-4 text-right text-gray-900">${formatCurrency(totals.i)}</td>
            <td class="px-4 py-4 text-right text-blue-700">${formatCurrency(totals.f)}</td>
            <td class="px-4 py-4 text-right text-red-600">${formatCurrency(totals.a)}</td>
            <td class="print:hidden"></td>
        </tr>`;

    tableBody.innerHTML = totalsHTML + data.map(row => renderRow(row)).join('');
    attachRowListeners();
}

const renderRow = (row) => {
    const rowId = getRowId(row);
    const isHidden = appState.hiddenRows.has(rowId);
    const isFlagged = appState.flaggedRows.has(rowId);
    const arrearsValue = getArrearsValue(row);
    const arrearsClass = arrearsValue > 0 ? 'text-red-600 font-bold' : 'text-gray-400';

    let rowClasses = 'border-b border-gray-50 transition-colors group';
    if (isHidden) rowClasses += ' bg-gray-50 opacity-40 grayscale';
    else if (isFlagged) rowClasses += ' bg-yellow-50 border-l-4 border-l-orange-400';
    else rowClasses += ' hover:bg-gray-50';

    return `
        <tr class="${rowClasses}">
            <td class="pl-6 py-4 font-medium text-gray-900">${row.loan_id}</td>
            <td class="px-4 py-4 text-gray-700 font-medium">${row.customer || 'N/A'}</td>
            <td class="px-4 py-4 text-gray-500 font-mono text-xs">${row.month}</td>
            <td class="px-4 py-4 text-right text-gray-700">${formatCurrency(getPrincipalValue(row))}</td>
            <td class="px-4 py-4 text-right text-gray-600">${formatCurrency(getInterestValue(row))}</td>
            <td class="px-4 py-4 text-right text-blue-600 font-medium">${formatCurrency(getFeeValue(row))}</td>
            <td class="px-4 py-4 text-right ${arrearsClass}">${formatCurrency(arrearsValue)}</td>
            <td class="px-4 py-4 text-center print:hidden">
                <div class="flex items-center justify-center gap-2">
                    <button class="hide-btn p-1.5 hover:bg-gray-200 rounded-md" data-id="${rowId}">
                        <i class="${isHidden ? 'fa-solid fa-eye text-gray-600' : 'fa-regular fa-eye-slash text-gray-400'}"></i>
                    </button>
                    <button class="flag-btn p-1.5 hover:bg-orange-100 rounded-md" data-id="${rowId}">
                        <i class="${isFlagged ? 'fa-solid fa-flag text-orange-600' : 'fa-regular fa-flag text-gray-400'}"></i>
                    </button>
                </div>
            </td>
        </tr>`;
};

function attachGlobalListeners() {
    ['current_month', 'last_3_months', 'ytd', 'all'].forEach(p => {
        document.getElementById(`tab-${p}`)?.addEventListener('click', () => switchAnalyticsTab(p));
    });

    document.getElementById('resetViewBtn')?.addEventListener('click', () => {
        appState.hiddenRows.clear();
        appState.flaggedRows.clear();
        renderTable();
    });

    let searchTimeout;
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => processData(e.target.value), 300);
    });

    document.getElementById('filterBtn')?.addEventListener('click', () => {
        appState.filterArrears = !appState.filterArrears;
        const btn = document.getElementById('filterBtn');
        btn.innerHTML = appState.filterArrears ? 
            `<i class="fa-solid fa-filter mr-2"></i> <span>Filter: Arrears Only</span>` : 
            `<i class="fa-solid fa-filter mr-2"></i> <span>Filter: All</span>`;
        btn.className = appState.filterArrears ? 
            "px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg" : 
            "px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50";
        processData(document.getElementById('searchInput')?.value);
    });

    document.getElementById('sortBtn')?.addEventListener('click', () => {
        const modes = ['month_desc', 'month_asc', 'amount_desc', 'amount_asc'];
        const labels = ['Date (Newest)', 'Date (Oldest)', 'Principal (High)', 'Principal (Low)'];
        const nextIndex = (modes.indexOf(appState.sortMode) + 1) % modes.length;
        appState.sortMode = modes[nextIndex];
        document.getElementById('sortBtn').innerHTML = `<i class="fa-solid fa-sort mr-2"></i> <span>Sort: ${labels[nextIndex]}</span>`;
        processData(document.getElementById('searchInput')?.value);
    });

    document.getElementById('printPdfBtn')?.addEventListener('click', () => window.print());
    document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportAnalyticsToExcel());
}

function attachRowListeners() {
    document.querySelectorAll('.hide-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            appState.hiddenRows.has(id) ? appState.hiddenRows.delete(id) : appState.hiddenRows.add(id);
            renderTable();
        });
    });
    document.querySelectorAll('.flag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            appState.flaggedRows.has(id) ? appState.flaggedRows.delete(id) : appState.flaggedRows.add(id);
            renderTable();
        });
    });
}

async function init() {
    const safetyTimer = setTimeout(() => {
        const main = document.getElementById('main-content');
        if (main && main.innerHTML.includes('Initializing')) {
            main.innerHTML = `<div class="p-12 text-center text-red-500"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><p>Network Error. Please refresh.</p></div>`;
        }
    }, 8000);

    try {
        await initLayout();
        document.getElementById('main-content').innerHTML = pageTemplate;
        attachGlobalListeners();
        
        const { data, error } = await fetchAnalyticsData();
        clearTimeout(safetyTimer);

        if (error) throw error;
        appState.rawData = data || [];
        processData();
    } catch (e) { console.error("Init Error:", e); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

