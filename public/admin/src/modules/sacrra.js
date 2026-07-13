import { supabase } from '../services/supabaseClient.js';
import { ensureThemeLoaded, getCompanyName } from '../shared/theme.js';
import * as openpgp from 'openpgp';
import { apiFetch } from '../shared/apiFetch.js';

const sacrraState = {
    view: 'overview',
    environment: 'PRODUCTION',
    loading: false,
    members: [],
    submissions: [],
    rejections: [],
    stats: {
        score: '0%',
        activeIssues: '0',
        totalRecords: '0',
        bureauAcceptance: {
            experian: 'PENDING',
            transunion: 'PENDING',
            xds: 'PENDING'
        }
    },
    exportSettings: {
        type: 'MONTHLY', 
        prefix: 'D'     
    }
};

export async function init(container) {
    const theme = await ensureThemeLoaded();
    const companyName = getCompanyName(theme) || 'Company';
    const logoUrl = (theme?.company_logo_url || '').trim();
    const logoMarkup = logoUrl
        ? `<img src="${logoUrl}" alt="${companyName}" class="h-12 w-auto object-contain mb-2">`
        : `<div class="text-base font-black text-slate-900 uppercase tracking-tight mb-2">${companyName}</div>`;

    container.innerHTML = `
        <div id="sacrra-portal" class="flex min-h-screen font-sans text-slate-800" style="background:#f8f9fa">
            <aside id="sacrra-sidebar" class="fixed left-0 top-0 h-full w-[260px] z-40 bg-white border-r border-gray-100 flex flex-col">
                <!-- Logo -->
                <div class="px-6 py-5 border-b border-gray-100">
                    ${logoMarkup}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">SACRRA Compliance Engine</p>
                    </div>
                </div>

                <!-- Nav items -->
                <nav id="sacrra-nav" class="flex-1 px-4 py-4 overflow-y-auto"></nav>

                <!-- Footer -->
                <div class="px-4 py-4 border-t border-gray-100">
                    <div class="flex items-center gap-2 px-3 py-2">
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span class="text-xs font-semibold text-gray-500">Layout 700v2 Engine Live</span>
                    </div>
                </div>
            </aside>

            <main class="flex-1 ml-[260px] min-h-screen flex flex-col">
                <header class="sticky top-0 z-30 bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
                    <div id="sacrra-header-title">
                        <h2 class="text-xl font-bold text-gray-900">Compliance Dashboard</h2>
                        <p class="text-xs text-gray-400 mt-0.5">SACRRA Layout 700v2 · Fixed-Width Format</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="window.refreshSacrraData()" class="p-2.5 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-xl transition-all">
                            <span class="material-symbols-outlined text-[18px] ${sacrraState.loading ? 'animate-spin' : ''}">refresh</span>
                        </button>
                        <a href="/admin/sacrra-validator" class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-700 rounded-xl font-bold text-sm transition-all">
                            <span class="material-symbols-outlined text-[18px]" style="color:var(--color-primary)">rule_folder</span>
                            Migration Validator
                        </a>
                        <button onclick="window.showExportModal()" class="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5" style="background:var(--color-primary)">
                            <span class="material-symbols-outlined text-[18px]">ios_share</span>
                            Generate Compliance File
                        </button>
                    </div>
                </header>

                <div id="sacrra-canvas" class="p-8 flex-1"></div>
            </main>
        </div>

        <div id="export-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm hidden opacity-0 transition-all duration-300">
            <div class="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10 transform scale-95 transition-all">
                <div class="flex justify-between items-center mb-8">
                    <h3 class="text-2xl font-black text-slate-900">Export Parameters</h3>
                    <button onclick="window.hideExportModal()" class="text-slate-400 hover:text-slate-900 transition-all">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="space-y-6">
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Submission Type</label>
                        <div class="grid grid-cols-2 gap-4">
                            <button onclick="window.setExportType('MONTHLY')" id="btn-monthly" class="p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2">
                                <span class="material-symbols-outlined text-3xl">calendar_month</span>
                                <span class="font-bold text-slate-900">Monthly</span>
                            </button>
                            <button onclick="window.setExportType('DAILY')" id="btn-daily" class="p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2">
                                <span class="material-symbols-outlined text-3xl">timer</span>
                                <span class="font-bold text-slate-900">Daily</span>
                            </button>
                        </div>
                    </div>
                    <!-- Backdating: reporting period override -->
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                            Reporting Period
                            <span class="ml-1 font-normal text-slate-400 normal-case tracking-normal">(leave blank for current month)</span>
                        </label>
                        <input type="month" id="sacrra-backdate-month"
                            class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:outline-none bg-white"
                            style="--tw-ring-color:var(--color-primary)"
                            title="Select a past month to generate a backdated SACRRA submission">
                        <p class="text-[10px] text-slate-400 mt-1.5">Used for backdating submissions to correct prior-period data.</p>
                    </div>

                    <div id="daily-options" class="hidden">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Record Prefix</label>
                        <div class="flex gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                            <button onclick="window.setExportPrefix('R')" id="prefix-r" class="flex-1 py-3 rounded-xl font-bold text-xs">R (Registration)</button>
                            <button onclick="window.setExportPrefix('C')" id="prefix-c" class="flex-1 py-3 rounded-xl font-bold text-xs">C (Correction)</button>
                            <button onclick="window.setExportPrefix('D')" id="prefix-d" class="flex-1 py-3 rounded-xl font-bold text-xs">D (Data)</button>
                        </div>
                    </div>
                </div>
                <div class="mt-12 flex gap-4">
                    <button onclick="window.hideExportModal()" class="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                    <button onclick="window.generateSacrraFile()" class="flex-1 py-4 bg-[#a04100] text-white font-black rounded-2xl shadow-xl shadow-orange-900/20 hover:scale-[1.02] active:scale-95 transition-all">Download .TXT</button>
                </div>
            </div>
        </div>
    `;
    
    setupGlobalHandlers();

    try {
        await fetchData();
        renderView();
    } catch (e) {
        console.error("SACRRA Initialization Failed:", e);
    }
}

function setupGlobalHandlers() {
    window.switchSacrraView = (view) => { sacrraState.view = view; renderView(); };
    window.buildSacrraFileContent = buildSacrraFileContent;
    window.refreshSacrraData = async () => { await fetchData(); renderView(); };
    window.setExportType = (type) => { 
        sacrraState.exportSettings.type = type; 
        renderExportModalUI(); 
    };
    window.setExportPrefix = (prefix) => { 
        sacrraState.exportSettings.prefix = prefix; 
        renderExportModalUI(); 
    };
    window.showExportModal = () => { 
        const modal = document.getElementById('export-modal');
        modal.classList.remove('hidden');
        renderExportModalUI();
        setTimeout(() => { 
            modal.classList.remove('opacity-0'); 
            modal.children[0].classList.remove('scale-95'); 
        }, 10);
    };
    window.hideExportModal = () => {
        const modal = document.getElementById('export-modal');
        modal.classList.add('opacity-0');
        modal.children[0].classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    window.resolveRejection = async (id) => {
        if (!confirm('Mark this rejection as resolved?')) return;
        await supabase.from('sacrra_rejections').update({
            resolved: true,
            resolved_at: new Date().toISOString()
        }).eq('id', id);
        await fetchData();
        renderView();
    };

    window.processBureauFile = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            const lines = content.split('\n');
            const newRejections = [];
            
            for (const line of lines) {
                if (line.startsWith('R') || line.startsWith('E')) { // Error/Rejection markers
                    const matchKey = line.substring(1, 41).trim();
                    const errorCode = line.substring(41, 45).trim();
                    const errorMessage = line.substring(45, 100).trim();
                    
                    if (matchKey && errorCode) {
                        newRejections.push({
                            match_key: matchKey,
                            error_code: errorCode,
                            error_message: errorMessage
                        });
                    }
                }
            }
            
            if (newRejections.length > 0) {
                await supabase.from('sacrra_rejections').insert(newRejections);
                alert(`Successfully parsed ${newRejections.length} bureau rejections.`);
                await fetchData();
                renderView();
            } else {
                alert("No rejection codes found in file.");
            }
        };
        reader.readAsText(file);
    };
}

async function fetchData() {
    sacrraState.loading = true;
    try {
        const [membersRes, historyRes, rejectionsRes] = await Promise.all([
            supabase.from('sacrra_700_view').select('*'),
            supabase.from('sacrra_submissions').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('sacrra_rejections').select('*').eq('resolved', false)
        ]);
        
        if (membersRes.error) throw membersRes.error;
        
        sacrraState.members = (membersRes.data || []).map(m => ({
            ...m,
            isValidId: validateSAID(m.f10_id_number),
            // Match key = SRN (6 chars) + Account Number — used for bureau rejection linking
            matchKey: (m.f02_supplier_ref?.trim() || '').slice(0, 6).padEnd(6, ' ')
                    + (m.f40_account_number || m.internal_id || '').replace(/\s/g, '')
        }));
        
        sacrraState.submissions = historyRes.data || [];
        sacrraState.rejections = rejectionsRes.data || [];
        
        const total = sacrraState.members.length;
        const issues = sacrraState.members.filter(m => !m.isValidId).length;
        
        sacrraState.stats = {
            score: total > 0 ? `${(((total - issues) / total) * 100).toFixed(1)}%` : '100%',
            activeIssues: issues.toString(),
            totalRecords: total.toString(),
            bureauAcceptance: {
                experian:   sacrraState.submissions.some(s => s.status === 'ACCEPTED') ? 'VERIFIED' : 'PENDING',
                transunion: 'PENDING',
                xds:        'PENDING'
            }
        };
    } catch (e) {
        console.error("Data Load Error", e);
    } finally {
        sacrraState.loading = false;
    }
}

function validateSAID(id) {
    if (!id || id.trim().length !== 13) return false;
    let nCheck = 0, bEven = false;
    for (let n = id.trim().length - 1; n >= 0; n--) {
        let nDigit = parseInt(id.trim().charAt(n), 10);
        if (bEven && (nDigit *= 2) > 9) nDigit -= 9;
        nCheck += nDigit;
        bEven = !bEven;
    }
    return (nCheck % 10) === 0;
}

function renderView() {
    const nav = document.getElementById('sacrra-nav');
    const canvas = document.getElementById('sacrra-canvas');
    if (!nav || !canvas) return;

    nav.innerHTML = `
        <!-- Nav items -->
        <div class="space-y-1 mb-6">
            ${renderNavItem('overview', 'dashboard', 'Dashboard')}
            ${renderNavItem('pipeline', 'account_tree', 'Submissions')}
            ${renderNavItem('bureaux',  'verified',     'Bureaux')}
            ${renderNavItem('parser',   'error',        'Rejections')}
        </div>
        <!-- Back to admin -->
        <div class="border-t border-slate-100 pt-4">
            <button onclick="window.location.href='/admin/dashboard'" 
                class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all text-xs font-semibold">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to Admin
            </button>
        </div>
    `;

    // Populate company name from theme (avoids hardcoding)
    const nameEl = document.getElementById('sacrra-company-name');
    if (nameEl) {
        ensureThemeLoaded().then(t => { nameEl.textContent = getCompanyName(t) || ''; });
    }

    switch (sacrraState.view) {
        case 'overview': renderOverview(canvas); break;
        case 'pipeline': renderPipeline(canvas); break;
        case 'bureaux':  renderBureaux(canvas); break;
        case 'parser':   renderParser(canvas); break;
        default: renderOverview(canvas);
    }
}

function renderNavItem(view, icon, label) {
    const active = sacrraState.view === view;
    return `
        <button onclick="window.switchSacrraView('${view}')" class="w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${active ? 'bg-orange-50 text-[#a04100] shadow-sm shadow-orange-900/5' : 'text-slate-500 hover:bg-slate-50'}">
            <span class="material-symbols-outlined ${active ? 'fill-1' : ''}">${icon}</span>
            <span class="font-black text-xs uppercase tracking-widest">${label}</span>
            ${active ? '<div class="ml-auto w-1.5 h-1.5 rounded-full bg-[#a04100]"></div>' : ''}
        </button>
    `;
}

function renderOverview(container) {
    const total  = Number(sacrraState.stats.totalRecords) || 0;
    const issues = Number(sacrraState.stats.activeIssues) || 0;
    const clean  = total - issues;
    const scorePct = total > 0 ? Math.round((clean / total) * 100) : 100;
    // SVG donut: r=54 → circumference = 2π×54 ≈ 339.3
    const CIRC = 339.3;
    const dash = (scorePct / 100) * CIRC;

    container.innerHTML = `
        <div class="grid grid-cols-12 gap-8 mb-10">

            <!-- Compliance score ring -->
            <div class="col-span-12 lg:col-span-4 bg-gradient-to-br from-[#a04100] to-[#6a2b00] p-8 rounded-[32px] shadow-2xl shadow-orange-900/20 text-white relative overflow-hidden">
                <p class="text-white/70 font-bold uppercase tracking-widest text-[10px] mb-6">Compliance Score</p>
                <div class="flex items-center gap-6">
                    <div class="relative w-32 h-32 shrink-0">
                        <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="10"/>
                            <circle id="score-ring" cx="60" cy="60" r="54" fill="none"
                                stroke="white" stroke-width="10"
                                stroke-linecap="round"
                                stroke-dasharray="${CIRC}"
                                stroke-dashoffset="${CIRC}"
                                style="transition: stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)"/>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span id="score-pct" class="text-2xl font-black text-white">0%</span>
                        </div>
                    </div>
                    <div>
                        <div class="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Clean records</div>
                        <div id="count-clean" class="text-4xl font-black">0</div>
                        <div class="text-white/60 text-xs mt-2">${issues} issue${issues !== 1 ? 's' : ''} detected</div>
                        <div class="flex items-center gap-2 text-white/80 text-xs font-bold mt-3">
                            <span class="material-symbols-outlined text-sm">verified</span>
                            Layout 700v2 · v2.8
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bureau health bars -->
            <div class="col-span-12 md:col-span-6 lg:col-span-4 bg-white p-8 rounded-[32px] border border-slate-200/60 shadow-sm">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-12 h-12 bg-orange-50 text-[#a04100] rounded-2xl flex items-center justify-center">
                        <span class="material-symbols-outlined">account_balance</span>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Bureau Health</span>
                </div>
                <div class="space-y-5">
                    ${renderBureauStatus('Experian',   sacrraState.stats.bureauAcceptance.experian,   scorePct)}
                    ${renderBureauStatus('TransUnion', sacrraState.stats.bureauAcceptance.transunion, scorePct)}
                    ${renderBureauStatus('XDS',        sacrraState.stats.bureauAcceptance.xds,        scorePct)}
                </div>
            </div>

            <!-- Live records count-up -->
            <div class="col-span-12 md:col-span-6 lg:col-span-4 bg-white p-8 rounded-[32px] border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                        <span class="material-symbols-outlined">database</span>
                    </div>
                    <p class="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-1">Live Records</p>
                    <h3 id="count-total" class="text-5xl font-black text-slate-900">0</h3>
                </div>
                <div class="mt-6">
                    <div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        <span>Clean</span><span>Issues</span>
                    </div>
                    <div class="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div id="split-bar" class="h-full bg-emerald-400 rounded-full"
                             style="width:0%; transition: width 1.2s cubic-bezier(0.22,1,0.36,1)"></div>
                    </div>
                    <div class="flex justify-between text-[10px] font-bold text-slate-500 mt-1">
                        <span>${clean}</span><span>${issues}</span>
                    </div>
                </div>
            </div>
        </div>

        <div id="sacrra-issue-workspace" class="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div class="px-8 py-8 border-b border-slate-50 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-black text-slate-900 tracking-tight">Issue Workspace</h3>
                    <p class="text-xs font-medium text-slate-500 mt-1">High-priority records requiring institutional correction</p>
                </div>
            </div>
            <div id="issue-list-container"></div>
        </div>
    `;

    renderIssueList();

    // Animate after paint
    requestAnimationFrame(() => setTimeout(() => {
        // Ring
        const ring = document.getElementById('score-ring');
        if (ring) ring.style.strokeDashoffset = String(CIRC - dash);

        // Score % count-up
        animateCount('score-pct', 0, scorePct, 1400, v => v + '%');

        // Clean records count-up
        animateCount('count-clean', 0, clean, 1400);

        // Total count-up
        animateCount('count-total', 0, total, 1200);

        // Split bar
        const bar = document.getElementById('split-bar');
        if (bar) bar.style.width = (total > 0 ? (clean / total) * 100 : 100) + '%';

        // Bureau bar animations (staggered)
        document.querySelectorAll('.bureau-bar-fill').forEach((el, i) => {
            setTimeout(() => { el.style.width = el.dataset.target; }, i * 150);
        });
    }, 60));
}

function animateCount(id, from, to, duration, fmt = v => String(v)) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = performance.now();
    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        el.textContent = fmt(Math.round(from + (to - from) * ease));
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderBureauStatus(name, status, scorePct = 0) {
    const isVerified = status === 'VERIFIED';
    const barPct = isVerified ? scorePct : Math.round(scorePct * 0.6);
    const barColor = isVerified ? 'bg-emerald-400' : 'bg-slate-200';
    const textColor = isVerified ? 'text-emerald-600' : 'text-slate-400';
    return `
        <div>
            <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold text-slate-700">${name}</span>
                <span class="text-[9px] font-black uppercase tracking-widest ${textColor}">${status}</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="bureau-bar-fill h-full ${barColor} rounded-full"
                     data-target="${barPct}%"
                     style="width:0%; transition: width 1s cubic-bezier(0.22,1,0.36,1)"></div>
            </div>
        </div>
    `;
}

function renderIssueList() {
    const container = document.getElementById('issue-list-container');
    if (!container) return;
    
    // DETECT DEEP COMPLIANCE ISSUES (Layout 700v2)
    const issues = sacrraState.members.filter(m => {
        m.issues = [];
        if (!m.isValidId)                                       m.issues.push('ID_LUHN_FAIL');
        if (!m.f10_id_number?.trim())                           m.issues.push('EMPTY_IDENTITY');
        if (!m.f06_surname?.trim())                             m.issues.push('MISSING_SURNAME');
        if (!m.f07_first_names?.trim())                         m.issues.push('MISSING_FIRST_NAME');
        if (!m.f13_address_1?.trim())                           m.issues.push('MISSING_ADDRESS');
        if (!m.f41_opening_balance || m.f41_opening_balance === '000000000000') m.issues.push('MISSING_OPENING_BALANCE');
        if (!m.f43_date_opened || m.f43_date_opened === '00000000') m.issues.push('MISSING_DATE_OPENED');
        // Status code '00' and 'X' are invalid in v2.8
        const sc = (m.f50_status_code || '').trim();
        if (!VALID_STATUS_CODES.has(sc))                        m.issues.push(`INVALID_STATUS_CODE:${sc || 'BLANK'}`);
        // Account number must exist and have no spaces
        const acct = (m.f40_account_number || '').trim();
        if (!acct)                                              m.issues.push('MISSING_ACCOUNT_NUMBER');
        else if (/\s/.test(acct))                               m.issues.push('ACCOUNT_NUMBER_HAS_SPACES');
        return m.issues.length > 0;
    });
    
    if (issues.length === 0) {
        container.innerHTML = `
            <div class="p-20 flex flex-col items-center justify-center text-center">
                <div class="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                    <span class="material-symbols-outlined text-4xl">check_circle</span>
                </div>
                <h4 class="text-lg font-black text-slate-900">Zero Integrity Issues</h4>
                <p class="text-slate-500 text-sm max-w-xs mt-2">All identity records are bureau-compliant and pass the Deep Compliance audit.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="w-full text-left">
            <thead>
                <tr class="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <th class="px-8 py-5">Record Member</th>
                    <th class="px-6 py-5">Detected Integrity Issues</th>
                    <th class="px-8 py-5 text-right">Surgical Action</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
                ${issues.map(i => `
                    <tr class="hover:bg-slate-50/80 transition-colors group">
                        <td class="px-8 py-6">
                            <div class="font-bold text-slate-900 text-sm">${i.f07_first_names.trim()} ${i.f06_surname.trim()}</div>
                            <div class="text-[10px] font-mono text-slate-400 mt-1">${i.f10_id_number || 'NO ID'}</div>
                        </td>
                        <td class="px-6 py-6">
                            <div class="flex flex-wrap gap-2">
                                ${i.issues.map(issue => `
                                    <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${issue.includes('MISSING') ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}">
                                        ${issue.replace(/_/g, ' ')}
                                    </span>
                                `).join('')}
                            </div>
                        </td>
                        <td class="px-8 py-6 text-right">
                            <button onclick="window.showSurgicalFix('${i.internal_id}')" class="px-4 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase hover:scale-[1.05] active:scale-95 shadow-lg shadow-slate-900/10 transition-all">Surgical Fix</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

window.showSurgicalFix = async (loanId) => {
    const member = sacrraState.members.find(m => m.internal_id === loanId);
    if (!member) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-10 relative overflow-hidden animate-in fade-in zoom-in duration-300">
            <div class="flex justify-between items-start mb-8">
                <div>
                    <h2 class="text-2xl font-black text-slate-900 tracking-tight">Surgical Correction</h2>
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Refining record: ${member.f07_first_names.trim()} ${member.f06_surname.trim()}</p>
                </div>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <div class="grid grid-cols-2 gap-6">
                <div class="col-span-2">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Full Residential Address</label>
                    <input id="fix-address" class="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" value="${member.f13_address_1.trim()}" placeholder="1 Main Street">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Employer Name</label>
                    <input id="fix-employer" class="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" value="${member.f35_employer.trim()}" placeholder="Oscorp">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Occupation</label>
                    <input id="fix-occupation" class="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" value="${member.f36_occupation.trim()}" placeholder="Clerk">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">ID Number</label>
                    <input id="fix-id" class="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" value="${member.f10_id_number.trim()}">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Middle Name</label>
                    <input id="fix-middle" class="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" value="${member.f09_middle_names.trim()}" placeholder="Batman">
                </div>
            </div>

            <div class="mt-10 flex gap-4">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl">Cancel</button>
                <button id="save-fix-btn" class="flex-1 py-4 bg-[#a04100] text-white font-black rounded-2xl shadow-xl shadow-orange-900/20 hover:scale-[1.02] active:scale-95 transition-all">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('save-fix-btn').onclick = async () => {
        const btn = document.getElementById('save-fix-btn');
        btn.disabled = true;
        btn.innerText = 'Syncing...';

        try {
            // Find the profile ID from the loan record
            const { data: loan } = await supabase.from('loans').select('user_id').eq('id', loanId).single();
            
            await supabase.from('profiles').update({
                address_line_1: document.getElementById('fix-address').value,
                employer_name: document.getElementById('fix-employer').value,
                occupation: document.getElementById('fix-occupation').value,
                id_number: document.getElementById('fix-id').value,
                middle_name: document.getElementById('fix-middle').value
            }).eq('id', loan.user_id);

            modal.remove();
            await fetchData();
            renderView();
        } catch (err) {
            alert('Failed to save correction.');
            btn.disabled = false;
            btn.innerText = 'Save Changes';
        }
    };
};

function renderPipeline(container) {
    const history = sacrraState.submissions || [];
    container.innerHTML = `
        <div class="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div class="px-8 py-8 border-b border-slate-50 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-black text-slate-900 tracking-tight">Submission Pipeline</h3>
                    <p class="text-xs font-medium text-slate-500 mt-1">Audit trail of bureau file transmissions</p>
                </div>
                <span class="px-4 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full uppercase">${history.length} Recent Files</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                            <th class="px-8 py-5">File Name</th>
                            <th class="px-6 py-5">Type</th>
                            <th class="px-6 py-5">Records</th>
                            <th class="px-6 py-5">Status</th>
                            <th class="px-6 py-5">Response</th>
                            <th class="px-8 py-5 text-right">Submitted At</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${history.map(s => {
                            const statusColor = s.status === 'ACCEPTED' ? 'bg-emerald-500' : s.status === 'REJECTED' ? 'bg-red-500' : 'bg-orange-400';
                            const statusText  = s.status === 'ACCEPTED' ? 'text-emerald-600' : s.status === 'REJECTED' ? 'text-red-600' : 'text-orange-600';
                            return `
                            <tr id="sub-row-${s.id}">
                                <td class="px-8 py-5 font-bold text-slate-900 text-sm max-w-[200px] truncate" title="${s.file_name}">${s.file_name}</td>
                                <td class="px-6 py-5"><span class="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase">${s.submission_type}</span></td>
                                <td class="px-6 py-5 font-black text-slate-700">${s.record_count}</td>
                                <td class="px-6 py-5">
                                    <div class="flex items-center gap-2">
                                        <span class="w-1.5 h-1.5 rounded-full ${statusColor}"></span>
                                        <span class="text-xs font-bold ${statusText}">${s.status}</span>
                                    </div>
                                    ${s.notes ? `<p class="text-[10px] text-slate-400 mt-0.5 max-w-[180px] truncate" title="${s.notes}">${s.notes}</p>` : ''}
                                </td>
                                <td class="px-6 py-5">
                                    ${s.status === 'PENDING' ? `
                                        <button onclick="window.checkSACRRAResponse(${s.id}, '${s.file_name}')"
                                            class="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors flex items-center gap-1">
                                            <span class="material-symbols-outlined text-[14px]">download</span>
                                            Check Response
                                        </button>` : `
                                        <label class="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1">
                                            <span class="material-symbols-outlined text-[14px]">upload_file</span>
                                            Re-import
                                            <input type="file" accept=".txt,.pgp" class="hidden" onchange="window.importResponseFile(event, ${s.id})">
                                        </label>`}
                                    <div id="response-status-${s.id}" class="hidden mt-1 text-[10px] text-slate-400"></div>
                                </td>
                                <td class="px-8 py-5 text-right text-xs font-bold text-slate-400">${new Date(s.created_at).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>

                <!-- Manual upload section for first-time use -->
                <div class="px-8 py-6 border-t border-slate-50 bg-slate-50/50">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Upload Bureau Response File</p>
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-slate-200 hover:border-orange-300 rounded-xl cursor-pointer text-sm font-bold text-slate-600 hover:text-orange-700 transition-colors">
                            <span class="material-symbols-outlined text-[18px]">cloud_upload</span>
                            Select .TXT Response File from SACRRA/Experian
                            <input type="file" accept=".txt,.pgp,.csv" class="hidden" onchange="window.importResponseFile(event, null)">
                        </label>
                        <p class="text-xs text-slate-400">Experian uploads response files to your MOVEit folder after processing. Download it, then upload here to see acceptance/rejection details.</p>
                    </div>
                    <div id="manual-response-status" class="hidden mt-3"></div>
                </div>
            </div>
        </div>
    `;
}

// ════════════════════════════════════════════════════════════════
// BUREAUX — configure & submit to each credit bureau
// ════════════════════════════════════════════════════════════════
async function renderBureaux(container) {
    container.innerHTML = `
        <div class="flex flex-col gap-6">
            <div class="bg-white p-8 rounded-[32px] border border-slate-100">
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <h2 class="text-2xl font-black text-slate-900 tracking-tight">Bureau Configuration</h2>
                        <p class="text-sm text-slate-500 mt-1">Each bureau needs: Supplier Reference Number, PGP public key, and submission method</p>
                    </div>
                    <button onclick="window.submitToAllBureaux()"
                        class="px-5 py-3 bg-[#a04100] text-white rounded-2xl font-bold text-sm hover:bg-[#7a3000] transition-all flex items-center gap-2 shadow-lg shadow-orange-900/20">
                        <span class="material-symbols-outlined text-[18px]">send</span>
                        Submit File to All Bureaux
                    </button>
                </div>
            </div>
            <div id="bureaux-list" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="text-slate-400 text-sm">Loading...</div>
            </div>
        </div>
    `;

    try {
        const res = await apiFetch('/api/sacrra/bureaux');
        const { data, error } = await res.json();
        if (error) throw new Error(error);
        renderBureauCards(data || []);
    } catch (err) {
        document.getElementById('bureaux-list').innerHTML = `
            <div class="col-span-2 bg-red-50 border border-red-200 p-6 rounded-2xl text-red-800 text-sm">
                <strong>Could not load bureaux.</strong><br>${err.message}<br><br>
                <em>Run <code class="bg-red-100 px-2 py-1 rounded">sql/sacrra_bureaux.sql</code> in Supabase first.</em>
            </div>`;
    }
}

function renderBureauCards(bureaux) {
    const el = document.getElementById('bureaux-list');
    if (!el) return;
    el.innerHTML = bureaux.map(b => {
        const lastSubmit = b.last_submitted_at
            ? new Date(b.last_submitted_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
            : '—';
        const statusColor = b.last_submission_status === 'success' ? 'green'
            : b.last_submission_status === 'failed' ? 'red' : 'slate';
        const hasKey = !!b.pgp_public_key;
        const ready  = hasKey && b.supplier_ref_number && (b.submission_email || b.submission_folder);
        return `
        <div class="bg-white p-6 rounded-[28px] border ${ready ? 'border-green-100' : 'border-orange-100'} relative">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <h3 class="text-lg font-black text-slate-900">${b.bureau_name}</h3>
                        ${ready ? '<span class="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Ready</span>'
                                : '<span class="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Setup needed</span>'}
                    </div>
                    <p class="text-xs text-slate-400 font-mono">${b.bureau_key}</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" ${b.is_enabled ? 'checked' : ''}
                        onchange="window.toggleBureau('${b.bureau_key}', this.checked)" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-200 peer-checked:bg-[#a04100] rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
            </div>

            <div class="space-y-3 mb-4">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Supplier Reference Number</label>
                    <input id="srn-${b.bureau_key}" value="${b.supplier_ref_number || ''}" placeholder="e.g. ZWN0001234"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono">
                </div>

                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Submission Method</label>
                    <select id="method-${b.bureau_key}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                        <option value="email"  ${b.submission_method === 'email'  ? 'selected' : ''}>Email (manual)</option>
                        <option value="moveit" ${b.submission_method === 'moveit' ? 'selected' : ''}>MOVEit MFT (automated)</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Submission Email</label>
                    <input id="email-${b.bureau_key}" type="email" value="${b.submission_email || ''}" placeholder="sacrra@${b.bureau_key}.co.za"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                </div>

                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">PGP Public Key</label>
                    <textarea id="pgp-${b.bureau_key}" rows="3" placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----..."
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono">${b.pgp_public_key && b.pgp_public_key.includes('...') ? '' : (b.pgp_public_key || '')}</textarea>
                    ${hasKey ? '<p class="text-[10px] text-green-600 mt-1">✓ Key configured (paste a new one to replace)</p>' : '<p class="text-[10px] text-orange-600 mt-1">No key set — encryption will fail</p>'}
                </div>
            </div>

            <div class="border-t border-slate-100 pt-4 flex items-center justify-between">
                <div class="text-[10px] text-slate-400">
                    Last submitted: <span class="text-${statusColor}-600 font-bold">${lastSubmit}</span>
                    ${b.last_submission_status === 'failed' && b.last_submission_note ? `<br><span class="text-red-500">${b.last_submission_note.slice(0,60)}</span>` : ''}
                </div>
                <div class="flex gap-2">
                    <button onclick="window.saveBureau('${b.bureau_key}')"
                        class="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700">Save</button>
                    <button onclick="window.submitOneBureau('${b.bureau_key}')" ${!ready ? 'disabled' : ''}
                        class="px-3 py-2 bg-[#a04100] hover:bg-[#7a3000] disabled:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400 rounded-lg text-xs font-bold text-white">Submit</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.toggleBureau = async (key, enabled) => {
    await apiFetch(`/api/sacrra/bureaux/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_enabled: enabled })
    });
};

window.saveBureau = async (key) => {
    const payload = {
        supplier_ref_number: document.getElementById(`srn-${key}`).value.trim() || null,
        submission_method:   document.getElementById(`method-${key}`).value,
        submission_email:    document.getElementById(`email-${key}`).value.trim() || null
    };
    const pgpVal = document.getElementById(`pgp-${key}`).value.trim();
    if (pgpVal && pgpVal.startsWith('-----')) payload.pgp_public_key = pgpVal;

    const res = await apiFetch(`/api/sacrra/bureaux/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
    });
    const { success, error } = await res.json();
    if (success) {
        renderBureaux(document.getElementById('sacrra-canvas') || document.querySelector('main'));
    } else {
        alert('Save failed: ' + error);
    }
};

window.submitOneBureau = async (key) => {
    if (!confirm(`Generate the SACRRA file and submit to ${key}?\n\nThis will encrypt the file with their PGP key and ${
        document.getElementById(`method-${key}`)?.value === 'email' ? 'send via email' : 'upload via MOVEit'
    }.`)) return;

    // Reuse existing file generation
    if (typeof window.buildSacrraFileContent !== 'function') {
        // Quick fix: import the build function from sacrra module if exposed
        alert('Generate the file from Dashboard first, then return here to submit.');
        return;
    }
    try {
        const settings = { type: 'MONTHLY', prefix: 'D' };
        const fileContent = await window.buildSacrraFileContent(settings);
        const fileName = `SACRRA_MONTHLY_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.txt`;
        const res = await apiFetch(`/api/sacrra/submit/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ fileContent, fileName })
        });
        const result = await res.json();
        if (result.success) {
            alert(`✅ Submitted to ${key} successfully\nMethod: ${result.method}\nDuration: ${result.durationMs}ms`);
            renderBureaux(document.getElementById('sacrra-canvas') || document.querySelector('main'));
        } else {
            alert(`❌ Failed: ${result.error}`);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.submitToAllBureaux = async () => {
    if (!confirm('Generate the SACRRA file and submit to ALL enabled bureaux?\n\nDisabled bureaux will be skipped.')) return;
    const res = await apiFetch('/api/sacrra/bureaux');
    const { data } = await res.json();
    const enabled = (data || []).filter(b => b.is_enabled);
    if (enabled.length === 0) { alert('No bureaux enabled.'); return; }
    for (const b of enabled) {
        await window.submitOneBureau(b.bureau_key);
    }
};

function renderParser(container) {
    container.innerHTML = `
        <div class="flex flex-col gap-8">
            <div class="bg-white p-12 rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center text-center relative group overflow-hidden">
                <input type="file" onchange="window.processBureauFile(event)" class="absolute inset-0 opacity-0 cursor-pointer z-10">
                <div class="w-24 h-24 bg-orange-50 text-[#a04100] rounded-[32px] flex items-center justify-center mb-8 shadow-xl shadow-orange-900/10 group-hover:scale-110 transition-transform">
                    <span class="material-symbols-outlined text-4xl">upload_file</span>
                </div>
                <h3 class="text-2xl font-black text-slate-900 tracking-tight">Rejection Parser</h3>
                <p class="text-slate-500 max-w-sm mt-2 font-medium">Drop the .TXT file provided by the Bureau here to automatically map and resolve rejection codes.</p>
                <div class="mt-8 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest">Select Bureau File</div>
            </div>
            
            <div id="rejection-results" class="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div class="px-8 py-8 border-b border-slate-50">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Bureau Rejections</h4>
                </div>
                ${sacrraState.rejections.length === 0 ? `
                    <div class="p-12 text-center text-slate-300 font-bold text-xs uppercase tracking-widest">No active rejections found</div>
                ` : `
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <th class="px-8 py-5">Match Key</th>
                                <th class="px-6 py-5">Error Code</th>
                                <th class="px-6 py-5">Message</th>
                                <th class="px-8 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${sacrraState.rejections.map(r => `
                                <tr>
                                    <td class="px-8 py-6 font-mono text-[10px] font-black text-slate-900">${r.match_key}</td>
                                    <td class="px-6 py-6 font-black text-red-600 text-xs">${r.error_code}</td>
                                    <td class="px-6 py-6 text-slate-500 text-xs font-medium">${r.error_message}</td>
                                    <td class="px-8 py-6 text-right">
                                        <button onclick="window.resolveRejection(${r.id})" class="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">Resolve</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;
}

function renderExportModalUI() {
    const settings = sacrraState.exportSettings;
    const btnMonthly = document.getElementById('btn-monthly');
    const btnDaily = document.getElementById('btn-daily');
    const dailyOptions = document.getElementById('daily-options');
    
    if (settings.type === 'MONTHLY') {
        btnMonthly.classList.add('border-[#a04100]', 'bg-orange-50/50');
        btnMonthly.querySelector('.material-symbols-outlined').classList.add('text-[#a04100]');
        btnDaily.classList.remove('border-[#a04100]', 'bg-orange-50/50');
        btnDaily.querySelector('.material-symbols-outlined').classList.remove('text-[#a04100]');
        dailyOptions.classList.add('hidden');
    } else {
        btnDaily.classList.add('border-[#a04100]', 'bg-orange-50/50');
        btnDaily.querySelector('.material-symbols-outlined').classList.add('text-[#a04100]');
        btnMonthly.classList.remove('border-[#a04100]', 'bg-orange-50/50');
        btnMonthly.querySelector('.material-symbols-outlined').classList.remove('text-[#a04100]');
        dailyOptions.classList.remove('hidden');
    }

    ['R', 'C', 'D'].forEach(p => {
        const btn = document.getElementById(`prefix-${p.toLowerCase()}`);
        if (btn) {
            if (settings.prefix === p) {
                btn.classList.add('bg-white', 'shadow-sm', 'text-[#a04100]');
                btn.classList.remove('text-slate-500');
            } else {
                btn.classList.remove('bg-white', 'shadow-sm', 'text-[#a04100]');
                btn.classList.add('text-slate-500');
            }
        }
    });
}

// Valid Layout 700v2 status codes — '00' and 'X' were removed in v2.8
const VALID_STATUS_CODES = new Set(['C','D','E','I','J','L','P','T','V','W','Z']);

function pad(val, len, char = ' ') {
    return String(val || '').slice(0, len).padEnd(len, char);
}
function zeroPad(val, len) {
    return String(val || '').slice(0, len).padStart(len, '0');
}

// ── Derive title from gender ──────────────────────────────────────────
function deriveTitle(gender) {
    const g = (gender || '').toUpperCase().trim();
    if (g === 'F') return 'MS';
    return 'MR';
}

// ── Build the fixed-width 700-char file content ───────────────────────
// Exposed on window for bureau-submit flows
async function buildSacrraFileContent(settings) {
    // Spec: SACRRA Layout 700v2 v2.8 — exact byte positions
    // Alpha fields: LEFT-aligned, space-padded
    // Numeric fields: RIGHT-aligned, zero-padded
    const aL  = (val, len) => String(val || '').replace(/\r?\n/g,'').slice(0, len).padEnd(len, ' ');
    // nR: right-align zero-pad WITHOUT bitwise | 0 (causes overflow on 13-digit SA IDs)
    const nR  = (val, len) => {
        const n = String(val || '').replace(/[^0-9]/g,'') || '0';
        return n.slice(-len).padStart(len, '0');
    };
    const dt  = (val) => (val || '00000000').replace(/-/g,'').slice(0,8).padStart(8,'0');

    // --- Reporting date ---
    const backdateInput = document.getElementById('sacrra-backdate-month')?.value;
    let reportingDate;
    if (backdateInput?.length === 7) {
        const [yr, mo] = backdateInput.split('-').map(Number);
        reportingDate = new Date(yr, mo, 0);
    } else {
        reportingDate = new Date();
    }
    const lastDay      = new Date(reportingDate.getFullYear(), reportingDate.getMonth() + 1, 0);
    const monthEnd     = dt(lastDay.toISOString().slice(0,10).replace(/-/g,''));
    const creationDate = dt(new Date().toISOString().slice(0,10).replace(/-/g,''));

    // Supplier Reference Number — 10 chars, RIGHT-aligned (leading spaces).
    // Confirmed against SACRRA's own dummy sample file
    // (TT0109_ALL_T702_M_20230302_1_01 1 - Dummy Data Examples_Monthly file):
    // the header record reads "H    TT0109..." — 4 leading spaces then TT0109,
    // not "TT0109    " as this previously assumed. This was almost certainly
    // the cause of "header SRN in file is still being populated incorrectly"
    // in the bureau's rejection feedback — every field after the SRN (month-end,
    // version, creation date, trading name) was 10 bytes further left than the
    // bureau's parser expected relative to a right-justified SRN.
    const srnRaw = (sacrraState.members[0]?.f02_supplier_ref || '').trim();
    const srn    = srnRaw.padStart(10, ' ').slice(-10);

    // Trading name — pulled from theme (same source as sidebar/navbar branding)
    const _theme = await ensureThemeLoaded().catch(() => null);
    const tradingName = aL(
        (getCompanyName(_theme) || 'ZWANE FINANCIAL SERVICES').toUpperCase(),
        60
    );

    // ── HEADER (700 chars) ────────────────────────────────────────────────
    // Pos 1:     H
    // Pos 2-11:  SRN (A10, RIGHT-aligned, e.g. "    TT0109")
    // Pos 12-19: MONTH END DATE (N8, CCYYMMDD)
    // Pos 20-21: VERSION NUMBER (N2) = "06" for Layout 700v2
    // Pos 22-29: FILE CREATION DATE (N8, CCYYMMDD)
    // Pos 30-89: TRADING NAME/BRAND NAME (A60)
    // Pos 90-700: FILLER spaces
    // Expected (after H):     TT0109202606030620260603ZWANE FINANCIAL SERVICES
    let content = ('H' + srn + monthEnd + '06' + creationDate + tradingName).padEnd(700, ' ').slice(0,700) + '\r\n';

    // Branch code (pos 40-47, 8 chars): SACRRA explicitly flagged that SRN must NOT appear here.
    // Leave blank unless a SACRRA-assigned branch code is stored in system_settings.sacrra_branch_code.
    // The f02b_branch_code field from the view is already pre-set to 8 spaces.
    const rawBranchCode = (sacrraState.members[0]?.f02b_branch_code || '').trim();
    const branchCode = rawBranchCode ? aL(rawBranchCode, 8) : aL('', 8);

    // Status codes where Status Date must not exceed monthEnd (SACRRA rejection rule)
    const STATUS_DATE_CAP_CODES = new Set(['B','C','D','G','H','K','M','P','S','T','V','X','Z']);
    // Status codes where Last Payment Date must not exceed monthEnd (SACRRA rejection rule)
    const LASTPAY_CAP_CODES = new Set(['','E','I','L','J','W','Y']);

    sacrraState.members.forEach(m => {
        // Monthly = 'D' (Data). Daily = 'R' (Registration) or 'C' (Closure) per prefix
        const recordType  = settings.type === 'DAILY' ? (settings.prefix || 'R') : 'D';
        const accountType = aL(m.f03_account_type || 'P', 2);

        // STATUS CODE: blank '  ' for active/current
        const rawStatus   = (m.f50_status_code || '').trim();
        const statusCode  = aL(rawStatus || '  ', 2);

        // LOAN REASON CODE
        const rawReason   = (m.f30_loan_reason || '').trim();
        const loanReason  = aL(rawReason || 'O', 2);

        // Closed/settled = zero-balance
        const isPositive  = ['C','T','V','P'].includes(rawStatus);
        const saId        = (m.f10_id_number || '').replace(/\D/g,'').padStart(13,'0').slice(0,13);
        const accountNo   = aL(m.f40_account_number || m.internal_id || '', 25);
        const ownerTenant = (m.f13_address_1 || '').trim() ? 'O' : 'T';

        // ── Date validation helpers ───────────────────────────────────────────
        const toInt8 = s => parseInt((s || '').replace(/\D/g,'').slice(0,8) || '0') || 0;
        const monthEndInt = toInt8(monthEnd);

        // DATE OPENED
        const rawDateOpened = (m.f43_date_opened || '').replace(/-/g,'').slice(0,8) || '0';
        const dateOpenedInt = toInt8(rawDateOpened);

        // STATUS DATE:
        //   - Must be 00000000 when Status Code is blank/active (SACRRA warning fix)
        //   - Must not exceed monthEnd for B,C,D,G,H,K,M,P,S,T,V,X,Z (SACRRA rejection fix)
        let statusDateStr = (m.f51_status_date || '').replace(/-/g,'').slice(0,8) || '0';
        if (!rawStatus) {
            statusDateStr = '0';
        } else if (STATUS_DATE_CAP_CODES.has(rawStatus) && toInt8(statusDateStr) > monthEndInt) {
            statusDateStr = monthEnd;
        }

        // LAST PAYMENT DATE:
        //   - Must not exceed monthEnd for blank/'',E,I,L,J,W,Y (SACRRA rejection fix)
        //   - Must not be before Date Opened (SACRRA warning fix)
        let lastPayStr = (m.f46_last_payment_date || '').replace(/-/g,'').slice(0,8) || '0';
        if (LASTPAY_CAP_CODES.has(rawStatus) && toInt8(lastPayStr) > monthEndInt) {
            lastPayStr = monthEnd;
        }
        if (toInt8(lastPayStr) > 0 && dateOpenedInt > 0 && toInt8(lastPayStr) < dateOpenedInt) {
            lastPayStr = '0'; // Cannot pay before account was opened
        }

        // Financial (N9, whole rands — zero for closed/settled/cancelled)
        const openBal    = nR(isPositive ? 0 : (m.f41_opening_balance || '0').replace(/\D/g,''), 9);
        const currBal    = nR(isPositive ? 0 : (m.f44_current_balance || '0').replace(/\D/g,''), 9);
        const instalment = nR(isPositive ? 0 : (m.f45_installment     || '0').replace(/\D/g,''), 9);
        const rawOverdue = isPositive ? 0 : parseInt((m.f49_arrears_amount || '0').replace(/\D/g,'')) || 0;

        // MONTHS IN ARREARS: cap to actual account age (SACRRA warning fix)
        const openYear   = dateOpenedInt ? Math.floor(dateOpenedInt / 10000) : 0;
        const openMonth  = dateOpenedInt ? Math.floor((dateOpenedInt % 10000) / 100) : 0;
        const endYear    = Math.floor(monthEndInt / 10000);
        const endMonth   = Math.floor((monthEndInt % 10000) / 100);
        const ageMonths  = openYear ? Math.max(0, (endYear - openYear) * 12 + (endMonth - openMonth)) : 999;
        const rawMthsArr = parseInt(m.f53_months_in_arrears || '0') || 0;
        let   mthsArrInt = isPositive ? 0 : Math.min(rawMthsArr, ageMonths);

        // SACRRA rejection: Amount Overdue and Months in Arrears must stay in sync —
        // one cannot be non-zero while the other is zero.
        let finalOverdue = rawOverdue;
        if (mthsArrInt === 0) finalOverdue = 0;
        else if (finalOverdue === 0) mthsArrInt = 0;

        const amtOverdue = nR(finalOverdue, 9);
        const mthsArr    = zeroPad(mthsArrInt, 2);

        // SURNAME: strip company suffixes and "& Co" patterns
        const cleanSurname = (m.f06_surname || '')
            .replace(/\s*(PTY\.?\s*LTD\.?|LTD\.?|\bCC\b|INC\.?|CORP\.?|\(PTY\)|BK|NPC|RF)\s*$/i, '')
            .replace(/\s*&.*$/, '')
            .trim();

        // Build 700-char data record — all positions verified against official SACRRA dummy data
        let r = '';
        r += aL(recordType, 1);               // 1:        MONTHLY='D', DAILY='R'/'C'
        r += saId;                             // 2-14:     SA ID (N13) — direct string, no JS Number() overflow
        r += aL('', 16);                       // 15-30:    NON-SA ID (blank for SA citizens)
        r += aL(m.f11_gender || 'M', 1);       // 31:       GENDER (M/F)
        r += nR((m.f12_date_of_birth||'').replace(/-/g,'') || '0', 8); // 32-39: DOB CCYYMMDD
        r += branchCode;                       // 40-47:    BRANCH CODE (SACRRA-assigned, 8 chars)
        r += accountNo.trim().padStart(25,' '); // 48-72:    ACCOUNT NO (right-aligned per dummy)
        r += aL('', 4);                        // 73-76:    SUB-ACCOUNT NO
        r += aL(cleanSurname, 25);             // 77-101:   SURNAME (company suffixes stripped)
        r += aL(deriveTitle(m.f11_gender), 5); // 102-106:  TITLE
        // FORENAME: SACRRA allows [A-Z], [a-z], [-], [`], ['], [ ] — strip everything else
        const cleanForename = (m.f07_first_names || '').replace(/[^A-Za-z\-`' ]/g, '').trim();
        r += aL(cleanForename, 14);            // 107-120:  FORENAME 1
        r += aL('', 14);                       // 121-134:  FORENAME 2
        r += aL('', 14);                       // 135-148:  FORENAME 3
        r += aL(m.f13_address_1 || '', 25);    // 149-173:  RES ADDRESS 1
        r += aL(m.f14_address_2 || '', 25);    // 174-198:  RES ADDRESS 2
        r += aL(m.f15_city || '', 25);         // 199-223:  RES ADDRESS 3 (suburb/city)
        r += aL(m.f16_province || '', 25);     // 224-248:  RES ADDRESS 4 (province)
        r += aL(m.f17_postal || '', 6);        // 249-254:  POSTAL CODE (residential)
        r += aL(ownerTenant, 1);               // 255:      O=Owner T=Tenant (derived from address presence)
        r += aL('', 25);                       // 256-280:  POSTAL ADDRESS 1
        r += aL('', 25);                       // 281-305:  POSTAL ADDRESS 2
        r += aL('', 25);                       // 306-330:  POSTAL ADDRESS 3
        r += aL('', 25);                       // 331-355:  POSTAL ADDRESS 4
        r += aL('', 6);                        // 356-361:  POSTAL CODE (postal)
        r += aL('00', 2);                      // 362-363:  OWNERSHIP TYPE (00=Individual per dummy)
        r += loanReason;                       // 364-365:  LOAN REASON: O=Standard, D=DebtReview, I=Insolvency, G=Guarantee
        r += aL('00', 2);                      // 366-367:  PAYMENT TYPE (00 per dummy standard)
        r += aL(accountType, 2);               // 368-369:  TYPE OF ACCOUNT (M=1-month, P=Personal)
        r += nR(rawDateOpened || '0', 8);      // 370-377:  DATE OPENED
        r += nR('0', 8);                       // 378-385:  DEFERRED PAYMENT DATE (00000000 unless deferred)
        r += nR(lastPayStr || '0', 8);         // 386-393:  DATE LAST PAYMENT (capped to monthEnd, validated vs opened)
        r += openBal;                          // 394-402:  OPENING BALANCE (N9 whole rands)
        r += currBal;                          // 403-411:  CURRENT BALANCE (N9 whole rands)
        // BALANCE INDICATOR — D=debit balance (money owed by borrower), C=credit balance
        // (borrower is owed money, e.g. overpayment). This book has no credit-balance
        // accounts, so it's always D. Using isPositive here was wrong: the bureau requires
        // that whenever indicator=C the Status Code must be C/P/T (not V) AND the balance
        // must be > 0 — but this code forces balance to 0 for every isPositive record and
        // also applies 'C' to V (cancelled/declined), which fails both bureau rules at once
        // (V07830, V07831 rejections) and triggers the balance=0-with-indicator=C warning
        // (V08427) on nearly every closed/settled record in the file.
        r += aL('D', 1);                      // 412:      BALANCE INDICATOR — always D for this book
        r += amtOverdue;                       // 413-421:  AMOUNT OVERDUE (N9)
        r += instalment;                       // 422-430:  INSTALMENT (N9)
        r += mthsArr;                          // 431-432:  MONTHS IN ARREARS (capped to account age)
        r += statusCode;                       // 433-434:  STATUS CODE: '  '=Active, C=Closed, T=Settled, L=Legal
        r += nR(m.f54_repayment_frequency || '03', 2); // 435-436: FREQ: 01=Weekly 02=Fortnight 03=Monthly
        // TERMS: must be 0000 for Account Type M (SACRRA rule — SACRRA warning fix)
        const termsVal = (accountType.trim() === 'M') ? '0' : (m.f42_terms || m.term_months || '1');
        r += nR(termsVal, 4);                  // 437-440: TERMS (months, 0000 for M type)
        r += nR(statusDateStr || '0', 8);      // 441-448: STATUS DATE (cleared for active, capped to monthEnd)
        r += aL('', 8);                        // 449-456:  OLD SUPPLIER BRANCH CODE
        r += aL('', 25);                       // 457-481:  OLD ACCOUNT NUMBER
        r += aL('', 4);                        // 482-485:  OLD SUB-ACCOUNT
        r += aL('', 10);                       // 486-495:  OLD SUPPLIER REFERENCE
        r += aL('', 16);                       // 496-511:  HOME TELEPHONE
        r += aL(m.f31_mobile || '', 16);       // 512-527:  CELLULAR TELEPHONE
        r += aL(m.f32_work || '', 16);         // 528-543:  WORK TELEPHONE
        r += aL(m.f35_employer || '', 60);     // 544-603:  EMPLOYER DETAIL
        r += nR('0', 9);                       // 604-612:  INCOME (N9)
        r += aL('M', 1);                       // 613:      INCOME FREQUENCY (M=Monthly — all 16 dummy records)
        r += aL('', 20);                       // 614-633:  OCCUPATION
        r += aL('', 60);                       // 634-693:  THIRD PARTY NAME
        r += nR('0', 2);                       // 694-695:  ACCOUNT SOLD TO THIRD PARTY
        r += nR('0', 3);                       // 696-698:  NO OF PARTICIPANTS (000 per all 16 dummy records)
        r += aL('', 2);                        // 699-700:  FILLER

        if (r.length !== 700) console.warn('[SACRRA] Record length', r.length, 'expected 700 for', m.internal_id);
        content += r + '\r\n';
    });

    // ── TRAILER (700 chars) ───────────────────────────────────────────────
    // Pos 1:     T
    // Pos 2-10:  NUMBER OF RECORDS (N9) — includes header + data + trailer
    // Pos 11-700: FILLER spaces
    const totalRecords = sacrraState.members.length + 2; // +header +trailer
    content += ('T' + String(totalRecords).padStart(9, '0')).padEnd(700, ' ').slice(0,700) + '\r\n';

    return content;
}


window.generateSacrraFile = async () => {
    if (sacrraState.members.length === 0) return alert("No data found.");

    // Guard: warn if no reporting period is selected — the header date will default to today's
    // month-end, which may not match the submission period SACRRA expects.
    const backdateInput = document.getElementById('sacrra-backdate-month')?.value;
    if (!backdateInput) {
        const now = new Date();
        const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const confirmed = confirm(
            `No reporting period selected.\n\n` +
            `The file header will use the current month-end (${defaultPeriod}).\n\n` +
            `If you are resubmitting for a prior month, click Cancel and set the Reporting Period first.`
        );
        if (!confirmed) return;
    }

    // Pre-flight validation
    const invalidStatus = sacrraState.members.filter(m => !VALID_STATUS_CODES.has((m.f50_status_code || '').trim()));
    const invalidId     = sacrraState.members.filter(m => !m.isValidId);
    if (invalidStatus.length > 0 || invalidId.length > 0) {
        const msg = [];
        if (invalidId.length)     msg.push(`${invalidId.length} records with invalid SA ID (Luhn fail)`);
        if (invalidStatus.length) msg.push(`${invalidStatus.length} records with invalid status code`);
        if (!confirm(`⚠️ Compliance issues detected:\n• ${msg.join('\n• ')}\n\nThese records will likely be rejected by the bureaux. Generate file anyway?`)) return;
    }

    const settings   = sacrraState.exportSettings;
    const dateStr    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const srnForFile = (sacrraState.members[0]?.f02_supplier_ref || '').trim();
    const typeChar   = settings.type === 'MONTHLY' ? 'M' : 'D';
    // Filename format per SACRRA/SureSystems: {SRN}_ALL_T702_{M|D}_{YYYYMMDD}_1_1
    const plainName  = `${srnForFile}_ALL_T702_${typeChar}_${dateStr}_1_1`;
    const pgpName    = `${srnForFile}_ALL_T702_${typeChar}_${dateStr}_1_1.pgp`;

    // Build fixed-width content
    const fileContent = await buildSacrraFileContent(settings);

    // ── PGP encryption ────────────────────────────────────────────────
    // Load bureau public key from Supabase system_settings.sacrra_bureau_public_key
    // Falls back to the test key if not configured (UAT mode)
    let downloadName = plainName;
    let downloadContent;
    let downloadType = 'text/plain';

    try {
        const { data: settingsRow } = await supabase
            .from('system_settings')
            .select('sacrra_bureau_public_key')
            .limit(1)
            .single();

        const armoredKey = settingsRow?.sacrra_bureau_public_key?.trim();

        if (armoredKey && armoredKey.includes('BEGIN PGP PUBLIC KEY')) {
            const publicKey   = await openpgp.readKey({ armoredKey });
            const message     = await openpgp.createMessage({ text: fileContent });
            const encrypted   = await openpgp.encrypt({ message, encryptionKeys: publicKey });

            downloadName    = pgpName;
            downloadContent = encrypted;
            downloadType    = 'application/octet-stream';

            console.log('[SACRRA] File PGP-encrypted successfully.');
        } else {
            // No bureau key configured — download plain .txt with a warning
            console.warn('[SACRRA] No bureau public key found in system_settings — downloading plain .TXT (UAT/debug mode).');
            downloadContent = fileContent;
        }
    } catch (pgpErr) {
        console.error('[SACRRA] PGP encryption failed:', pgpErr);
        if (!confirm('PGP encryption failed. Download unencrypted .TXT for debugging?')) return;
        downloadContent = fileContent;
    }

    // Log submission to sacrra_submissions
    await supabase.from('sacrra_submissions').insert([{
        file_name:       downloadName,
        submission_type: settings.type,
        record_count:    sacrraState.members.length,
        status:          'PENDING'
    }]);

    // Trigger download
    const blob = new Blob([downloadContent], { type: downloadType });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.hideExportModal();

    // ── Transmit to MOVEit ────────────────────────────────────────────
    if (confirm(`File downloaded. Transmit "${downloadName}" to Experian MOVEit now?`)) {
        await transmitToMoveIt(downloadName, downloadContent);
    }

    setTimeout(() => window.refreshSacrraData(), 1000);
};

async function transmitToMoveIt(fileName, fileContent) {
    const statusEl = showTransmitStatus('Authenticating with MOVEit...');

    try {
        // Step 1: Authenticate
        const authRes = await apiFetch('/api/moveit/auth', { method: 'POST' });
        const authData = await authRes.json();

        let accessToken;

        if (authData.requiresMfa) {
            // MFA required — prompt for OTP
            updateTransmitStatus(statusEl, 'MFA required — check your email for the OTP code.');
            const otp = prompt('Enter the OTP code sent to your email:');
            if (!otp) { updateTransmitStatus(statusEl, 'Transmission cancelled.', 'warn'); return; }

            const mfaRes  = await apiFetch('/api/moveit/auth/mfa', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ mfaToken: authData.mfaToken, otpCode: otp }),
            });
            const mfaData = await mfaRes.json();
            if (!mfaData.success) {
                updateTransmitStatus(statusEl, `MFA failed: ${mfaData.error}`, 'error'); return;
            }
            accessToken = mfaData.accessToken;
        } else if (authData.success) {
            accessToken = authData.accessToken;
        } else {
            updateTransmitStatus(statusEl, `Auth failed: ${authData.error}`, 'error'); return;
        }

        // Step 2: Upload
        updateTransmitStatus(statusEl, `Uploading ${fileName} to Experian MOVEit...`);
        const contentBase64 = typeof fileContent === 'string'
            ? btoa(unescape(encodeURIComponent(fileContent)))
            : btoa(String.fromCharCode(...new Uint8Array(await fileContent.arrayBuffer())));

        const uploadRes  = await apiFetch('/api/moveit/upload', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ accessToken, fileName, fileContent: contentBase64 }),
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
            updateTransmitStatus(statusEl, `✅ Transmitted successfully — File ID: ${uploadData.fileId || 'confirmed'}`, 'success');
        } else {
            updateTransmitStatus(statusEl, `Upload failed: ${uploadData.error}`, 'error');
        }

    } catch (err) {
        updateTransmitStatus(statusEl, `Transmission error: ${err.message}`, 'error');
        console.error('[MOVEit]', err);
    }
}

function showTransmitStatus(message) {
    const el = document.createElement('div');
    el.id = 'moveit-status';
    el.className = 'fixed bottom-6 right-6 z-[200] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 transition-all';
    el.innerHTML = `<span class="material-symbols-outlined animate-spin text-orange-400">sync</span><span id="moveit-status-text">${message}</span>`;
    document.body.appendChild(el);
    return el;
}

function updateTransmitStatus(el, message, type = 'loading') {
    if (!el) return;
    const icon = el.querySelector('.material-symbols-outlined');
    const text = el.querySelector('#moveit-status-text');
    if (text) text.textContent = message;
    if (icon) {
        icon.classList.remove('animate-spin', 'text-orange-400', 'text-emerald-400', 'text-red-400', 'text-yellow-400');
        if (type === 'success') { icon.textContent = 'check_circle'; icon.classList.add('text-emerald-400'); }
        else if (type === 'error') { icon.textContent = 'error'; icon.classList.add('text-red-400'); }
        else if (type === 'warn')  { icon.textContent = 'warning'; icon.classList.add('text-yellow-400'); }
        else { icon.textContent = 'sync'; icon.classList.add('animate-spin', 'text-orange-400'); }
    }
    if (type !== 'loading') setTimeout(() => el.remove(), 5000);
}

// ── SACRRA Response Check & Import ───────────────────────────────────────────

/**
 * Check MOVEit for a response file matching this submission, download & parse it.
 */
window.checkSACRRAResponse = async (submissionId, fileName) => {
    const statusEl = document.getElementById(`response-status-${submissionId}`);
    if (statusEl) { statusEl.textContent = 'Checking MOVEit for response…'; statusEl.classList.remove('hidden'); }

    try {
        const filesRes = await apiFetch('/api/sacrra/response-files');
        const filesData = await filesRes.json();

        if (!filesData.success) {
            if (statusEl) statusEl.textContent = `⚠️ ${filesData.error}`;
            return;
        }

        // Find the response file — look for one that matches or is a general response
        const files    = filesData.files || [];
        const allFiles = filesData.all_files || [];

        if (files.length === 0 && allFiles.length === 0) {
            if (statusEl) statusEl.textContent = '📭 No response file found yet — SACRRA may still be processing. Check back in 24hrs.';
            return;
        }

        // If response files found, use the most recent one
        const target = files[0] || allFiles[0];
        if (!target?.id) {
            if (statusEl) statusEl.textContent = '📂 Files found but unable to identify a response file. Upload manually below.';
            return;
        }

        if (statusEl) statusEl.textContent = `Downloading ${target.name || 'response file'}…`;

        const importRes = await apiFetch('/api/sacrra/import-response', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ fileId: target.id, submissionId })
        });
        const result = await importRes.json();
        _handleResponseResult(result, submissionId, statusEl);

    } catch (err) {
        if (statusEl) statusEl.textContent = `❌ Error: ${err.message}`;
    }
};

/**
 * Import a manually uploaded response .TXT file.
 */
window.importResponseFile = async (event, submissionId) => {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = submissionId
        ? document.getElementById(`response-status-${submissionId}`)
        : document.getElementById('manual-response-status');

    if (statusEl) { statusEl.textContent = `Reading ${file.name}…`; statusEl.classList.remove('hidden'); }

    const content = await file.text();

    try {
        const importRes = await apiFetch('/api/sacrra/import-response', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ content, fileName: file.name, submissionId: submissionId || null })
        });
        const result = await importRes.json();
        _handleResponseResult(result, submissionId, statusEl);
    } catch (err) {
        if (statusEl) statusEl.textContent = `❌ Error: ${err.message}`;
    }
};

function _handleResponseResult(result, submissionId, statusEl) {
    if (!result.success) {
        if (statusEl) statusEl.textContent = `❌ ${result.error}`;
        return;
    }

    const { total_records, rejections, accepted, status } = result;

    if (status === 'ACCEPTED') {
        if (statusEl) {
            statusEl.className = 'mt-1 text-[11px] font-bold text-emerald-600';
            statusEl.textContent = `✅ All ${total_records} records ACCEPTED by SACRRA`;
            statusEl.classList.remove('hidden');
        }
    } else {
        if (statusEl) {
            statusEl.className = 'mt-1 text-[11px] font-bold text-red-600';
            statusEl.textContent = `⚠️ ${rejections} rejection(s) — see Rejection Parser tab`;
            statusEl.classList.remove('hidden');
        }
    }

    // Update the submission status badge inline
    if (submissionId) {
        const row = document.getElementById(`sub-row-${submissionId}`);
        if (row) {
            const badge = row.querySelector('.flex.items-center.gap-2');
            if (badge) {
                const color = status === 'ACCEPTED' ? 'bg-emerald-500' : 'bg-red-500';
                const text  = status === 'ACCEPTED' ? 'text-emerald-600' : 'text-red-600';
                badge.innerHTML = `
                    <span class="w-1.5 h-1.5 rounded-full ${color}"></span>
                    <span class="text-xs font-bold ${text}">${status}</span>`;
            }
        }
    }

    // If there are rejections, switch to the rejection parser tab to show them
    if (rejections > 0) {
        setTimeout(() => {
            if (confirm(`${rejections} record(s) rejected by SACRRA. Switch to Rejection Parser tab to see and resolve them?`)) {
                window.switchSacrraView('parser');
                window.refreshSacrraData();
            }
        }, 500);
    }
}
