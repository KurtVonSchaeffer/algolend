import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';

const showToast = (msg, type) => window.showToast?.(msg, type);

const fmtR  = v => `R ${Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN  = v => Number(v || 0).toLocaleString('en-ZA');
const fmtPct = v => `${Number(v || 0).toFixed(2)}%`;

let settings = {};
let currentPeriod = null;
let form39Data = null;
let form40Data = null;

// ── Period helpers ────────────────────────────────────────────────────────────

function getQuarterlyPeriods(year) {
    return [
        { label: `Q1 ${year} (Jan–Mar)`, from: `${year}-01-01`, to: `${year}-03-31`, due: `15 May ${year}` },
        { label: `Q2 ${year} (Apr–Jun)`, from: `${year}-04-01`, to: `${year}-06-30`, due: `15 Aug ${year}` },
        { label: `Q3 ${year} (Jul–Sep)`, from: `${year}-07-01`, to: `${year}-09-30`, due: `15 Nov ${year}` },
        { label: `Q4 ${year} (Oct–Dec)`, from: `${year}-10-01`, to: `${year}-12-31`, due: `15 Feb ${Number(year)+1}` },
    ];
}

function getAnnualPeriod(year) {
    return [{ label: `${year} (Jan–Dec)`, from: `${year}-01-01`, to: `${year}-12-31`, due: `15 Feb ${Number(year)+1}` }];
}

function buildPeriodOptions() {
    const freq = settings.ncr_submission_frequency || 'annually';
    const thisYear = new Date().getFullYear();
    const years = [thisYear, thisYear - 1, thisYear - 2];
    const periods = [];
    for (const y of years) {
        const ps = freq === 'quarterly' ? getQuarterlyPeriods(y) : getAnnualPeriod(y);
        periods.push(...ps);
    }
    return periods;
}

// ── Auth token ────────────────────────────────────────────────────────────────

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
}

// ── Fetch data ────────────────────────────────────────────────────────────────

async function fetchForm39(from, to) {
    const token = await getToken();
    const res = await fetch(`/api/compliance/form39?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
}

async function fetchForm40(year) {
    const token = await getToken();
    const res = await fetch(`/api/compliance/form40?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
}

async function saveStaffCount(year, staffCount) {
    const token = await getToken();
    const res = await fetch(`/api/admin/ncr/statutory-registers/${year}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_count: staffCount }),
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
}

async function logExport(kind, payload) {
    // Best-effort — a failed audit log shouldn't block the user from getting
    // their CSV, but it's awaited (not fire-and-forget) so a failure is at
    // least visible in the console rather than silently dropped.
    try {
        const token = await getToken();
        await fetch(`/api/compliance/${kind}/log-export`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        console.warn(`[ncr-reporting] log-export failed for ${kind}:`, err.message);
    }
}

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCsv(rows, filename) {
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

async function exportForm39Csv() {
    if (!form39Data) return;
    const p = currentPeriod;
    const d = form39Data;
    await logExport('form39', { from: p.from, to: p.to, figures: d });
    const rows = [
        ['NCR Form 39 — Statistical Return'],
        ['Period', `${p.from} to ${p.to}`],
        ['Due Date', p.due],
        ...(d.is_live_snapshot ? [[], ['NOTE: Book Snapshot and Arrears/Defaults figures reflect account statuses at export time, not a true snapshot as of the period end date. See admin notes.']] : []),
        [],
        ['SECTION A — NEW CREDIT AGREEMENTS'],
        ['Number of new agreements', d.new_agreements.count],
        ['Total principal advanced (R)', d.new_agreements.total_principal],
        ['Total interest (R)',           d.new_agreements.total_interest],
        ['Total initiation fees (R)',    d.new_agreements.total_initiation],
        ['Total service fees (R)',       d.new_agreements.total_service_fees],
        ['Total credit life insurance (R)', d.new_agreements.total_credit_life],
        ['Total amount repayable (R)',   d.new_agreements.total_repayable],
        ['  — of which: organic applicants', d.new_agreements.by_source.organic],
        ['  — of which: marketplace (PARTNER_API)', d.new_agreements.by_source.marketplace],
        [],
        ['SECTION B — BOOK SNAPSHOT (at query date)'],
        ['Total active accounts',        d.active_book.count],
        ['Total principal outstanding (R)', d.active_book.total_principal],
        [],
        ['SECTION C — ARREARS & DEFAULTS'],
        ['Accounts in arrears/default',  d.in_arrears.count],
        ['Principal in arrears (R)',      d.in_arrears.total_principal],
        ['Accounts written off in period', d.written_off_period.count],
        ['Principal written off (R)',     d.written_off_period.total_principal],
        [],
        ['SECTION D — SETTLEMENTS & CANCELLATIONS'],
        ['Accounts settled in period',   d.settled_period.count],
        ['Principal settled (R)',         d.settled_period.total_principal],
        ['Accounts cancelled in period', d.cancelled_period.count],
        ['Principal cancelled (R)',       d.cancelled_period.total_principal],
    ];
    downloadCsv(rows, `Form39_${p.from}_${p.to}.csv`);
}

async function exportForm40Csv() {
    if (!form40Data) return;
    const d = form40Data;
    await logExport('form40', { year: d.year, figures: d });
    const rows = [
        ['NCR Form 40 — Annual Financial & Operational Return'],
        ['Financial Year', d.year],
        ...(d.is_live_snapshot ? [[], ['NOTE: Credit Book figures reflect account statuses at export time, not a true snapshot as of the financial year-end. See admin notes.']] : []),
        [],
        ['SECTION A — CREDIT BOOK'],
        ['Total principal outstanding (R)',     d.credit_book.total_principal_outstanding],
        ['Total active accounts',               d.credit_book.total_accounts],
        ['Non-performing loans (NPL) amount (R)', d.credit_book.npl_amount],
        ['NPL ratio (%)',                        d.credit_book.npl_ratio_pct],
        [],
        ['SECTION B — REVENUE (year)'],
        ['Total interest income (R)',     d.revenue_year.total_interest],
        ['Total initiation fees (R)',     d.revenue_year.total_initiation],
        ['Total service fees (R)',        d.revenue_year.total_service_fees],
        ['Total credit life premiums (R)', d.revenue_year.total_credit_life],
        ['Total revenue (R)',             d.revenue_year.total_revenue],
        [],
        ['SECTION C — IMPAIRMENTS & WRITE-OFFS (year)'],
        ['Accounts written off',          d.impairments_year.count],
        ['Total written off (R)',         d.impairments_year.total_principal],
        [],
        ['SECTION D — OPERATIONAL'],
        ['Number of branches',            d.operational.branches],
        ['Number of staff',               document.getElementById('f40-staff-count')?.value || ''],
        [],
        ['SECTION E — COMPLIANCE'],
        ['Complaints received',           d.compliance?.complaints_received ?? ''],
        ['Complaints resolved',           d.compliance?.complaints_resolved ?? ''],
        ['Debt review referrals',         d.compliance?.debt_review_referrals ?? ''],
        ['Submitted to NCR',              d.compliance?.submitted_to_ncr ? 'Yes' : 'No'],
        ['Submission reference',          d.compliance?.submission_reference ?? ''],
    ];
    downloadCsv(rows, `Form40_${d.year}.csv`);
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderPeriodSelector() {
    const periods = buildPeriodOptions();
    const freq    = settings.ncr_submission_frequency || 'annually';
    return `
<div class="glass-card p-6 rounded-2xl mb-6">
    <div class="flex flex-wrap items-end gap-4">
        <div class="flex-1 min-w-[220px]">
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Reporting Period</label>
            <select id="period-select" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                ${periods.map((p, i) => `<option value="${i}">${p.label} — due ${p.due}</option>`).join('')}
            </select>
            <p class="text-xs text-gray-400 mt-1">Frequency: <strong>${freq === 'quarterly' ? 'Quarterly' : 'Annual'}</strong> — change in Settings → NCR Statutory Reporting.</p>
        </div>
        <button id="load-btn" class="px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow" style="background:var(--color-primary)">
            <span class="material-symbols-outlined text-[16px] align-middle mr-1">search</span>Load Period
        </button>
    </div>
</div>`;
}

function renderForm39(d, period) {
    if (!d) return '';
    const na = d.new_agreements;
    const ab = d.active_book;
    const ar = d.in_arrears;
    const wo = d.written_off_period;
    const st = d.settled_period;
    const ca = d.cancelled_period;
    return `
<div class="glass-card p-6 rounded-2xl mb-6">
    <div class="flex items-center justify-between mb-4">
        <div>
            <h3 class="text-base font-bold text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]" style="color:var(--color-primary)">assignment</span>
                Form 39 — Statistical Return
            </h3>
            <p class="text-xs text-gray-400 mt-0.5">Period: ${period.from} → ${period.to} &nbsp;|&nbsp; Due: <strong>${period.due}</strong></p>
        </div>
        <button onclick="window._exportF39()" class="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">download</span>Download CSV
        </button>
    </div>

    ${d.is_live_snapshot ? `
    <div class="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
        <span class="material-symbols-outlined text-[16px] text-amber-600 mt-0.5">warning</span>
        <p class="text-xs text-amber-800">
            <strong>Book Snapshot and Arrears/Defaults reflect today's account statuses</strong>, not a true snapshot as of ${period.to}.
            This app doesn't yet log every status change with a timestamp, so a past period's book state can't be reliably reconstructed.
            These figures are safe to use for the current/most recent period, but treat them as an approximation for older periods.
        </p>
    </div>` : ''}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Section A -->
        <div class="bg-white rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-bold text-gray-400 uppercase mb-3">A — New Agreements</p>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Count</span><span class="font-bold">${fmtN(na.count)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Principal advanced</span><span class="font-semibold">${fmtR(na.total_principal)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Interest</span><span>${fmtR(na.total_interest)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Initiation fees</span><span>${fmtR(na.total_initiation)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Service fees</span><span>${fmtR(na.total_service_fees)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Credit life</span><span>${fmtR(na.total_credit_life)}</span></div>
                <div class="flex justify-between border-t pt-2 mt-2"><span class="text-gray-500">Total repayable</span><span class="font-bold">${fmtR(na.total_repayable)}</span></div>
                <div class="flex justify-between text-xs text-gray-400 mt-2 pt-1 border-t">
                    <span>Organic / Marketplace</span>
                    <span>${fmtN(na.by_source.organic)} / ${fmtN(na.by_source.marketplace)}</span>
                </div>
            </div>
        </div>

        <!-- Section B -->
        <div class="bg-white rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-bold text-gray-400 uppercase mb-3">B — Book Snapshot</p>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Active accounts</span><span class="font-bold">${fmtN(ab.count)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Principal outstanding</span><span class="font-bold">${fmtR(ab.total_principal)}</span></div>
            </div>
            <p class="text-xs font-bold text-gray-400 uppercase mb-3 mt-5">C — Arrears &amp; Defaults</p>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Accounts in arrears/default</span><span class="font-bold text-amber-600">${fmtN(ar.count)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Principal in arrears</span><span class="text-amber-600">${fmtR(ar.total_principal)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Written off (period)</span><span class="font-bold text-red-600">${fmtN(wo.count)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Principal written off</span><span class="text-red-600">${fmtR(wo.total_principal)}</span></div>
            </div>
        </div>

        <!-- Section D -->
        <div class="bg-white rounded-xl border border-gray-100 p-4 md:col-span-2">
            <p class="text-xs font-bold text-gray-400 uppercase mb-3">D — Settlements &amp; Cancellations</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p class="text-gray-400 text-xs">Settled (count)</p><p class="font-bold text-green-600">${fmtN(st.count)}</p></div>
                <div><p class="text-gray-400 text-xs">Settled (value)</p><p class="font-semibold">${fmtR(st.total_principal)}</p></div>
                <div><p class="text-gray-400 text-xs">Cancelled (count)</p><p class="font-bold text-gray-600">${fmtN(ca.count)}</p></div>
                <div><p class="text-gray-400 text-xs">Cancelled (value)</p><p class="font-semibold">${fmtR(ca.total_principal)}</p></div>
            </div>
        </div>
    </div>
</div>`;
}

function renderForm40(d) {
    if (!d) return '';
    const cb = d.credit_book;
    const rv = d.revenue_year;
    const im = d.impairments_year;
    const op = d.operational;
    const co = d.compliance || {};
    return `
<div class="glass-card p-6 rounded-2xl mb-6">
    <div class="flex items-center justify-between mb-4">
        <div>
            <h3 class="text-base font-bold text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]" style="color:var(--color-primary)">bar_chart</span>
                Form 40 — Annual Financial &amp; Operational Return
            </h3>
            <p class="text-xs text-gray-400 mt-0.5">Financial year: <strong>${d.year}</strong> &nbsp;|&nbsp; Due: 6 months after financial year-end</p>
        </div>
        <button onclick="window._exportF40()" class="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">download</span>Download CSV
        </button>
    </div>

    ${d.is_live_snapshot ? `
    <div class="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
        <span class="material-symbols-outlined text-[16px] text-amber-600 mt-0.5">warning</span>
        <p class="text-xs text-amber-800">
            <strong>Credit Book figures reflect today's account statuses</strong>, not a true snapshot as of ${d.year}-12-31.
            This app doesn't yet log every status change with a timestamp, so a past year-end book state can't be reliably reconstructed.
            Safe to use for the current financial year; treat as an approximation for prior years.
        </p>
    </div>` : ''}

    ${co.submitted_to_ncr !== undefined ? `
    <div class="mb-4 p-3 rounded-xl border flex items-center gap-2 ${co.submitted_to_ncr ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}">
        <span class="material-symbols-outlined text-[16px] ${co.submitted_to_ncr ? 'text-green-600' : 'text-gray-400'}">${co.submitted_to_ncr ? 'verified' : 'schedule'}</span>
        <p class="text-xs ${co.submitted_to_ncr ? 'text-green-800' : 'text-gray-500'}">
            ${co.submitted_to_ncr
                ? `Marked submitted to NCR${co.submitted_at ? ` on ${new Date(co.submitted_at).toLocaleDateString('en-ZA')}` : ''}${co.submission_reference ? ` — ref ${co.submission_reference}` : ''}.`
                : 'Not yet marked as submitted to NCR.'}
            Manage submission status on the <a href="/admin/ncr-registers" class="underline font-semibold">NCR Registers</a> page.
        </p>
    </div>` : ''}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Credit book -->
        <div class="bg-white rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-bold text-gray-400 uppercase mb-3">A — Credit Book</p>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Total active accounts</span><span class="font-bold">${fmtN(cb.total_accounts)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Principal outstanding</span><span class="font-bold">${fmtR(cb.total_principal_outstanding)}</span></div>
                <div class="flex justify-between border-t pt-2 mt-2"><span class="text-gray-500">NPL amount</span><span class="text-amber-600 font-semibold">${fmtR(cb.npl_amount)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">NPL ratio</span><span class="font-bold ${Number(cb.npl_ratio_pct) > 10 ? 'text-red-600' : 'text-green-600'}">${fmtPct(cb.npl_ratio_pct)}</span></div>
            </div>
        </div>

        <!-- Revenue -->
        <div class="bg-white rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-bold text-gray-400 uppercase mb-3">B — Revenue (year)</p>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Interest income</span><span>${fmtR(rv.total_interest)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Initiation fees</span><span>${fmtR(rv.total_initiation)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Service fees</span><span>${fmtR(rv.total_service_fees)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Credit life premiums</span><span>${fmtR(rv.total_credit_life)}</span></div>
                <div class="flex justify-between border-t pt-2 mt-2 font-bold"><span>Total revenue</span><span>${fmtR(rv.total_revenue)}</span></div>
            </div>
        </div>

        <!-- Impairments + Operational -->
        <div class="bg-white rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-bold text-gray-400 uppercase mb-3">C — Impairments &amp; Write-offs (year)</p>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Accounts written off</span><span class="font-bold text-red-600">${fmtN(im.count)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Total written off</span><span class="text-red-600">${fmtR(im.total_principal)}</span></div>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-bold text-gray-400 uppercase mb-3">D — Operational</p>
            <div class="space-y-3 text-sm">
                <div class="flex justify-between items-center"><span class="text-gray-500">Branches</span><span class="font-bold">${fmtN(op.branches)}</span></div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">Staff count</label>
                    <div class="flex gap-2">
                        <input id="f40-staff-count" type="number" min="0" placeholder="e.g. 12" value="${op.staff_count ?? ''}"
                            class="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent">
                        <button id="f40-staff-save" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0" style="background:var(--color-primary)">Save</button>
                    </div>
                    <p id="f40-staff-status" class="text-[10px] text-gray-400 mt-1">${op.staff_count != null ? 'Saved — persists across reloads.' : 'Not yet saved.'}</p>
                </div>
                ${co.complaints_received != null || co.complaints_resolved != null ? `
                <div class="pt-2 border-t">
                    <div class="flex justify-between"><span class="text-gray-500">Complaints received</span><span class="font-semibold">${fmtN(co.complaints_received)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Complaints resolved</span><span class="font-semibold">${fmtN(co.complaints_resolved)}</span></div>
                </div>` : ''}
                ${co.debt_review_referrals != null ? `
                <div class="flex justify-between"><span class="text-gray-500">Debt review referrals</span><span class="font-semibold">${fmtN(co.debt_review_referrals)}</span></div>` : ''}
                ${(co.complaints_received == null && co.debt_review_referrals == null) ? `
                <p class="text-[10px] text-gray-400 pt-2 border-t">Complaints and debt review referrals aren't recorded for ${d.year} yet — add them on the <a href="/admin/ncr-registers" class="underline">NCR Registers</a> page.</p>` : ''}
            </div>
        </div>
    </div>
</div>`;
}

function renderPage(loaded = false) {
    const periods = buildPeriodOptions();
    return `
<div class="max-w-5xl mx-auto px-4 py-8">
    <button onclick="window.location.href='/admin/dashboard'"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-slate-700 transition-colors mb-4">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Admin
    </button>
    <div class="flex items-center gap-3 mb-6">
        <span class="material-symbols-outlined text-2xl" style="color:var(--color-primary)">assignment</span>
        <div>
            <h1 class="text-2xl font-black text-on-surface">NCR Statutory Reporting</h1>
            <p class="text-sm text-gray-400">Form 39 (Statistical Return) &amp; Form 40 (Annual Financial &amp; Operational Return)</p>
        </div>
    </div>

    ${renderPeriodSelector()}

    <div id="results-container">
        ${loaded ? renderForm39(form39Data, currentPeriod) + renderForm40(form40Data) : `
        <div class="glass-card p-12 rounded-2xl text-center text-gray-400">
            <span class="material-symbols-outlined text-4xl mb-3 block">analytics</span>
            <p class="text-sm">Select a reporting period and click <strong>Load Period</strong> to generate your NCR returns.</p>
        </div>`}
    </div>
</div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    const shell = document.getElementById('app-shell');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/auth/login.html'; return; }

    const role = session.user.app_metadata?.role || session.user.user_metadata?.role;
    if (!['admin', 'super_admin'].includes(role)) {
        shell.innerHTML = `<div class="flex items-center justify-center h-screen text-gray-400">Access restricted to admins.</div>`;
        return;
    }

    // Load system settings for frequency + year-end month
    try {
        const r = await fetch('/api/system-settings');
        const j = await r.json();
        settings = j.data || {};
    } catch (_) {}

    await initLayout(shell, session);

    const content = document.getElementById('page-content') || shell;
    content.innerHTML = renderPage(false);
    bindEvents(buildPeriodOptions());

    // Export callbacks
    window._exportF39 = exportForm39Csv;
    window._exportF40 = exportForm40Csv;
}

function bindStaffCountSave(year) {
    const btn    = document.getElementById('f40-staff-save');
    const input  = document.getElementById('f40-staff-count');
    const status = document.getElementById('f40-staff-status');
    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
        const raw = input.value.trim();
        const val = raw === '' ? null : Number(raw);
        if (raw !== '' && (!Number.isFinite(val) || val < 0)) {
            showToast('Staff count must be a non-negative number', 'error');
            return;
        }
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            await saveStaffCount(year, val);
            if (form40Data) form40Data.operational.staff_count = val;
            status.textContent = 'Saved — persists across reloads.';
            showToast('Staff count saved', 'success');
        } catch (err) {
            showToast('Failed to save staff count: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save';
        }
    });
}

function bindEvents(periods) {
    document.getElementById('load-btn')?.addEventListener('click', async () => {
        const idx = Number(document.getElementById('period-select').value);
        currentPeriod = periods[idx];
        const year    = currentPeriod.from.slice(0, 4);

        const btn = document.getElementById('load-btn');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i>Loading…`;

        try {
            [form39Data, form40Data] = await Promise.all([
                fetchForm39(currentPeriod.from, currentPeriod.to),
                fetchForm40(year),
            ]);
            document.getElementById('results-container').innerHTML =
                renderForm39(form39Data, currentPeriod) + renderForm40(form40Data);
            bindStaffCountSave(year);
        } catch (err) {
            showToast('Failed to load data: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-[16px] align-middle mr-1">search</span>Load Period`;
        }
    });
}

init();
