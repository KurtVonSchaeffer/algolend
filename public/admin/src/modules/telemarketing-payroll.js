import { initLayout } from '../shared/layout.js';
import { apiFetch } from '../shared/apiFetch.js';

const state = {
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    agents: [],
    drilldown: null, // agent_id currently expanded
    commissions: []
};

const escapeHtml = (v = '') => `${v}`
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const formatCurrency = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'R 0.00';
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatMonthLabel = (period) => {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
};

async function loadPayroll() {
    const res = await apiFetch(`/api/telemarketing/payroll?period=${state.period}`);
    const data = await res.json();
    state.agents = data.agents || [];
}

async function loadAgentCommissions(agentId) {
    const res = await apiFetch(`/api/telemarketing/commissions?agent_id=${agentId}&period=${state.period}`);
    state.commissions = await res.json();
}

function renderPage() {
    const grandTotal = state.agents.reduce((sum, a) => sum + a.total, 0);
    const grandPending = state.agents.reduce((sum, a) => sum + a.pending, 0);

    return `
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div class="flex items-center justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-gray-900">Commission Payroll</h1>
                <p class="text-sm text-gray-400">Per-agent commission owed for ${formatMonthLabel(state.period)}</p>
            </div>
            <input type="month" id="period-picker" value="${state.period}" class="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold" />
        </div>

        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-white rounded-2xl border border-gray-100 p-5">
                <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Total payroll this month</p>
                <p class="text-2xl font-black text-gray-900">${formatCurrency(grandTotal)}</p>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 p-5">
                <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Still pending</p>
                <p class="text-2xl font-black text-amber-600">${formatCurrency(grandPending)}</p>
            </div>
        </div>

        <div id="agents-table"></div>
    </div>`;
}

function renderAgentsTable() {
    const target = document.getElementById('agents-table');
    if (!target) return;

    if (state.agents.length === 0) {
        target.innerHTML = `<div class="text-center py-16 text-gray-400"><p>No commissions for this month yet.</p></div>`;
        return;
    }

    target.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                    <th class="px-4 py-3">Agent</th>
                    <th class="px-4 py-3">Clients Signed</th>
                    <th class="px-4 py-3">Total Owed</th>
                    <th class="px-4 py-3">Paid</th>
                    <th class="px-4 py-3">Pending</th>
                    <th class="px-4 py-3"></th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                ${state.agents.map(a => `
                <tr class="hover:bg-gray-50/50 cursor-pointer agent-row" data-agent-id="${a.agent_id}">
                    <td class="px-4 py-3 font-semibold text-gray-900">${escapeHtml(a.agent_name)}</td>
                    <td class="px-4 py-3 text-gray-600">${a.client_count}</td>
                    <td class="px-4 py-3 font-bold text-gray-900">${formatCurrency(a.total)}</td>
                    <td class="px-4 py-3 text-green-600 font-semibold">${formatCurrency(a.paid)}</td>
                    <td class="px-4 py-3 text-amber-600 font-semibold">${formatCurrency(a.pending)}</td>
                    <td class="px-4 py-3 text-right"><span class="material-symbols-outlined text-gray-300">chevron_right</span></td>
                </tr>
                <tr class="drilldown-row hidden" data-drilldown-for="${a.agent_id}">
                    <td colspan="6" class="p-0"><div class="drilldown-content bg-gray-50 px-6 py-4"></div></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;

    bindAgentRows();
}

function renderDrilldown(agentId) {
    const row = document.querySelector(`.drilldown-row[data-drilldown-for="${agentId}"] .drilldown-content`);
    if (!row) return;
    if (state.commissions.length === 0) {
        row.innerHTML = `<p class="text-sm text-gray-400">No commission records for this period.</p>`;
        return;
    }
    row.innerHTML = `
    <table class="w-full text-sm">
        <thead class="text-left text-[11px] uppercase tracking-wider text-gray-400">
            <tr><th class="py-2">Client</th><th class="py-2">Tier</th><th class="py-2">Amount</th><th class="py-2">Status</th><th class="py-2"></th></tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
            ${state.commissions.map(c => `
            <tr>
                <td class="py-2 font-semibold text-gray-900">${escapeHtml(c.telemarketing_leads?.client_name || '—')}</td>
                <td class="py-2 text-gray-600">${escapeHtml(c.client_tiers?.name || '—')}</td>
                <td class="py-2 font-semibold">${formatCurrency(c.amount)}</td>
                <td class="py-2"><span class="text-xs font-semibold px-2 py-1 rounded-lg ${c.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${c.status}</span></td>
                <td class="py-2 text-right">
                    ${c.status === 'PENDING'
                        ? `<button data-commission-id="${c.id}" class="btn-mark-paid text-xs font-semibold text-orange-600 hover:underline">Mark paid</button>`
                        : ''}
                </td>
            </tr>
            `).join('')}
        </tbody>
    </table>`;

    row.querySelectorAll('.btn-mark-paid').forEach(btn => {
        btn.addEventListener('click', async () => {
            await apiFetch(`/api/telemarketing/commissions/${btn.dataset.commissionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PAID' })
            });
            await loadPayroll();
            const main = document.getElementById('main-content');
            if (main) main.innerHTML = renderPage();
            bindPeriodPicker();
            renderAgentsTable();
            // Re-open this agent's drilldown so the payer can keep working down the list
            document.querySelector(`.agent-row[data-agent-id="${agentId}"]`)?.click();
        });
    });
}

function bindAgentRows() {
    document.querySelectorAll('.agent-row').forEach(row => {
        row.addEventListener('click', async () => {
            const agentId = row.dataset.agentId;
            const drilldownRow = document.querySelector(`.drilldown-row[data-drilldown-for="${agentId}"]`);
            const isOpen = !drilldownRow.classList.contains('hidden');

            document.querySelectorAll('.drilldown-row').forEach(r => r.classList.add('hidden'));
            if (isOpen) {
                state.drilldown = null;
                return;
            }
            state.drilldown = agentId;
            drilldownRow.classList.remove('hidden');
            await loadAgentCommissions(agentId);
            renderDrilldown(agentId);
        });
    });
}

function bindPeriodPicker() {
    document.getElementById('period-picker')?.addEventListener('change', async (e) => {
        state.period = e.target.value;
        const main = document.getElementById('main-content');
        if (main) main.innerHTML = renderPage();
        bindPeriodPicker();
        await loadPayroll();
        renderAgentsTable();
    });
}

async function init() {
    await initLayout();

    const main = document.getElementById('main-content');
    if (!main) return;
    main.innerHTML = renderPage();
    bindPeriodPicker();

    try {
        await loadPayroll();
    } catch (e) {
        console.error('[telemarketing-payroll] failed to load', e);
    }
    renderAgentsTable();
}

document.addEventListener('DOMContentLoaded', init);
