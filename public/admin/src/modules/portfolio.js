import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
}

const fmtR   = v => `R ${Number(v||0).toLocaleString('en-ZA', { minimumFractionDigits:2 })}`;
const fmtPct = v => `${Number(v||0).toFixed(1)}%`;
const fmtN   = v => Number(v||0).toLocaleString('en-ZA');

function kpi(label, value, sub, color = '#E7762E', icon = 'payments') {
    return `
    <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div class="flex items-start justify-between mb-3">
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">${label}</span>
            <span class="material-symbols-outlined text-[20px]" style="color:${color}">${icon}</span>
        </div>
        <div class="text-2xl font-black" style="color:${color}">${value}</div>
        ${sub ? `<div class="text-xs text-gray-400 mt-1">${sub}</div>` : ''}
    </div>`;
}

function agingBar(label, value, total, color) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return `
    <div class="flex items-center gap-3">
        <div class="w-20 text-xs font-medium text-gray-500 flex-shrink-0">${label}</div>
        <div class="flex-1 bg-gray-100 rounded-full h-2">
            <div class="h-2 rounded-full transition-all" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="w-8 text-xs font-bold text-right" style="color:${color}">${value}</div>
    </div>`;
}

async function init() {
    await initLayout();
    const token = await getToken();

    const main = document.getElementById('main-content');
    if (main) main.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-8">
        <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-2xl" style="color:var(--color-primary)">analytics</span>
            <div>
                <h1 class="text-2xl font-black text-on-surface">Portfolio Dashboard</h1>
                <p class="text-sm text-gray-400">Live book metrics, NPL aging, yield, and disbursement trends</p>
            </div>
        </div>
        <div class="flex items-center justify-center py-16 text-gray-400">
            <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Loading…
        </div>
    </div>`;

    const res = await fetch('/api/admin/portfolio/metrics', {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        main.querySelector('div').innerHTML += `<p class="text-red-500 text-sm">Failed to load metrics.</p>`;
        return;
    }
    const { summary, aging, monthly_disbursements } = await res.json();

    const nplColor = summary.npl_ratio_pct > 10 ? '#ef4444' : summary.npl_ratio_pct > 5 ? '#f59e0b' : '#10b981';
    const totalNpl = Object.values(aging).reduce((s,v)=>s+v,0);

    // Monthly bars
    const maxAmt = Math.max(...monthly_disbursements.map(m => m.amount), 1);
    const monthBars = monthly_disbursements.map(m => {
        const pct = (m.amount / maxAmt * 100).toFixed(1);
        const label = m.month ? new Date(m.month + '-01').toLocaleDateString('en-ZA', { month:'short', year:'2-digit' }) : m.month;
        return `
        <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div class="text-[9px] text-gray-400 font-medium">${m.count > 0 ? fmtR(m.amount).replace('R ','R') : ''}</div>
            <div class="w-full flex items-end justify-center" style="height:80px">
                <div class="w-full max-w-[32px] rounded-t-lg transition-all"
                     style="height:${pct}%;background:${m.amount > 0 ? 'var(--color-secondary)' : '#f3f4f6'};min-height:${m.amount > 0 ? '4px' : '0'}"
                     title="${label}: ${fmtR(m.amount)} (${m.count} loans)"></div>
            </div>
            <div class="text-[9px] text-gray-400 text-center">${label}</div>
        </div>`;
    }).join('');

    main.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-8">
        <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-2xl" style="color:var(--color-primary)">analytics</span>
            <div>
                <h1 class="text-2xl font-black text-on-surface">Portfolio Dashboard</h1>
                <p class="text-sm text-gray-400">Live book metrics, NPL aging, yield, and disbursement trends</p>
            </div>
        </div>

        <!-- KPI grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            ${kpi('Active Loans',   fmtN(summary.active_count),  null,                                '#E7762E', 'receipt_long')}
            ${kpi('Book Value',     fmtR(summary.book_value),    `Principal: ${fmtR(summary.principal_book)}`, '#10b981', 'account_balance')}
            ${kpi('NPL Ratio',      fmtPct(summary.npl_ratio_pct), `${fmtN(summary.npl_count)} loans · ${fmtR(summary.npl_value)}`, nplColor, 'trending_down')}
            ${kpi('Portfolio Yield',fmtPct(summary.yield_pct),  'Total interest / principal',         '#8b5cf6', 'percent')}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            <!-- Disbursement trend -->
            <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Monthly Disbursements — Last 12 Months</h3>
                <div class="flex items-end gap-1" style="height:100px">
                    ${monthBars}
                </div>
            </div>

            <!-- NPL Aging -->
            <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Arrears Aging Buckets</h3>
                ${totalNpl === 0
                    ? '<p class="text-sm text-gray-400 text-center py-6">No accounts in arrears.</p>'
                    : `<div class="space-y-3">
                        ${agingBar('1–30 days',  aging.d1_30,   totalNpl, '#f59e0b')}
                        ${agingBar('31–60 days', aging.d31_60,  totalNpl, '#f97316')}
                        ${agingBar('61–90 days', aging.d61_90,  totalNpl, '#ef4444')}
                        ${agingBar('90+ days',   aging.d90plus, totalNpl, '#7f1d1d')}
                    </div>
                    <p class="text-xs text-gray-400 mt-4">${fmtN(totalNpl)} accounts in arrears or default</p>`}
            </div>
        </div>

        <!-- Quick actions -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/admin/loan-book" class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-orange-300 transition-colors flex items-center gap-3">
                <span class="material-symbols-outlined text-2xl text-orange-500">menu_book</span>
                <div>
                    <div class="font-semibold text-gray-800">Loan Book</div>
                    <div class="text-xs text-gray-400">Full portfolio with aging, collections mode</div>
                </div>
            </a>
            <a href="/admin/ncr-reporting" class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-orange-300 transition-colors flex items-center gap-3">
                <span class="material-symbols-outlined text-2xl text-purple-500">assignment</span>
                <div>
                    <div class="font-semibold text-gray-800">NCR Reporting</div>
                    <div class="text-xs text-gray-400">Form 39 &amp; 40 statutory returns</div>
                </div>
            </a>
            <a href="/admin/compliance-tracker" class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-orange-300 transition-colors flex items-center gap-3">
                <span class="material-symbols-outlined text-2xl text-green-500">checklist</span>
                <div>
                    <div class="font-semibold text-gray-800">Compliance Tracker</div>
                    <div class="text-xs text-gray-400">Annual NCR/FICA compliance checklist</div>
                </div>
            </a>
        </div>
    </div>`;
}

init();
