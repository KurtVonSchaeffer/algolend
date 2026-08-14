import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';
import { apiFetch } from '../shared/apiFetch.js';

const state = {
    role: '',
    isAdmin: false,
    tab: 'leads',
    agents: [],
    tiers: [],
    leads: [],
    calls: [],
    commissions: []
};

const STATUS_LABEL = {
    LEAD: 'Lead',
    CONTACTED: 'Contacted',
    CONTRACT_SIGNED: 'Contract Signed',
    COMPLIANCE_PENDING: 'Compliance Pending',
    COMPLIANCE_APPROVED: 'Approved / Live',
    REJECTED: 'Rejected'
};

const STATUS_BADGE = {
    LEAD: 'bg-gray-100 text-gray-700',
    CONTACTED: 'bg-blue-100 text-blue-700',
    CONTRACT_SIGNED: 'bg-amber-100 text-amber-700',
    COMPLIANCE_PENDING: 'bg-orange-100 text-orange-700',
    COMPLIANCE_APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700'
};

const escapeHtml = (v = '') => `${v}`
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const formatCurrency = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'R 0.00';
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMonth = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
};

// ── Data loading ─────────────────────────────────────────────────────────
async function loadAll() {
    const calls = [apiFetch('/api/telemarketing/tiers'), apiFetch('/api/telemarketing/leads'), apiFetch('/api/telemarketing/commissions')];
    if (state.isAdmin) calls.push(apiFetch('/api/telemarketing/agents'));
    else calls.push(apiFetch('/api/telemarketing/calls'));

    const [tiersRes, leadsRes, commissionsRes, fourthRes] = await Promise.all(calls);
    state.tiers = await tiersRes.json();
    state.leads = await leadsRes.json();
    state.commissions = await commissionsRes.json();
    if (state.isAdmin) state.agents = await fourthRes.json();
    else state.calls = await fourthRes.json();
}

// ── Render: shell ────────────────────────────────────────────────────────
function renderPage() {
    const tabs = state.isAdmin
        ? [['leads', 'Leads & Clients'], ['agents', 'Agents'], ['tiers', 'Commission Tiers']]
        : [['leads', 'My Leads'], ['calls', 'Call Log'], ['commissions', 'My Commission Statement']];

    return `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div class="flex items-center justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-gray-900">Telemarketing</h1>
                <p class="text-sm text-gray-400">${state.isAdmin ? 'Agents, leads and commission payroll' : 'Track your calls, leads and commission'}</p>
            </div>
            ${state.tab === 'leads' ? `
            <button id="btn-add-lead" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style="background:var(--color-primary)">
                <span class="material-symbols-outlined text-[18px]">add</span> Add Lead
            </button>` : ''}
            ${state.tab === 'agents' ? `
            <button id="btn-add-agent" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style="background:var(--color-primary)">
                <span class="material-symbols-outlined text-[18px]">person_add</span> Add Agent
            </button>` : ''}
            ${state.tab === 'tiers' ? `
            <button id="btn-add-tier" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style="background:var(--color-primary)">
                <span class="material-symbols-outlined text-[18px]">add</span> Add Tier
            </button>` : ''}
            ${state.tab === 'calls' ? `
            <button id="btn-log-call" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style="background:var(--color-primary)">
                <span class="material-symbols-outlined text-[18px]">call</span> Log Call
            </button>` : ''}
        </div>

        <div class="flex gap-1 mb-6 border-b border-gray-200">
            ${tabs.map(([key, label]) => `
                <button data-tab="${key}" class="tab-btn px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${state.tab === key ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}">
                    ${label}
                </button>
            `).join('')}
        </div>

        <div id="tab-content"></div>
    </div>
    `;
}

// ── Render: leads tab ───────────────────────────────────────────────────
function renderLeads() {
    if (state.leads.length === 0) {
        return `<div class="text-center py-16 text-gray-400"><p>No leads yet.</p></div>`;
    }
    return `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                    <th class="px-4 py-3">Client</th>
                    ${state.isAdmin ? '<th class="px-4 py-3">Agent</th>' : ''}
                    <th class="px-4 py-3">Tier</th>
                    <th class="px-4 py-3">Status</th>
                    <th class="px-4 py-3">First Deduction</th>
                    <th class="px-4 py-3">Signed Doc</th>
                    <th class="px-4 py-3">Commission</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                ${state.leads.map(l => `
                <tr class="hover:bg-gray-50/50">
                    <td class="px-4 py-3">
                        <p class="font-semibold text-gray-900">${escapeHtml(l.client_name)}</p>
                        <p class="text-xs text-gray-400">${escapeHtml(l.contact_number || l.email || '')}</p>
                    </td>
                    ${state.isAdmin ? `<td class="px-4 py-3 text-gray-600">${escapeHtml(l.telemarketing_agents?.full_name || '—')}</td>` : ''}
                    <td class="px-4 py-3">
                        <select data-lead-id="${l.id}" data-field="tier_id" class="lead-field text-xs border border-gray-200 rounded-lg px-2 py-1">
                            <option value="">—</option>
                            ${state.tiers.map(t => `<option value="${t.id}" ${t.id === l.tier_id ? 'selected' : ''}>${escapeHtml(t.name)} (${formatCurrency(t.commission_amount)})</option>`).join('')}
                        </select>
                    </td>
                    <td class="px-4 py-3">
                        <select data-lead-id="${l.id}" data-field="status" class="lead-field text-xs font-semibold rounded-lg px-2 py-1 border-0 ${STATUS_BADGE[l.status] || 'bg-gray-100'}">
                            ${Object.entries(STATUS_LABEL).map(([k, v]) => {
                                if (k === 'COMPLIANCE_APPROVED' && !state.isAdmin) return `<option value="${k}" ${l.status === k ? 'selected' : ''} disabled>${v} (compliance only)</option>`;
                                return `<option value="${k}" ${l.status === k ? 'selected' : ''}>${v}</option>`;
                            }).join('')}
                        </select>
                    </td>
                    <td class="px-4 py-3">
                        <input type="date" data-lead-id="${l.id}" data-field="first_deduction_date" value="${l.first_deduction_date || ''}" class="lead-field text-xs border border-gray-200 rounded-lg px-2 py-1" />
                    </td>
                    <td class="px-4 py-3">
                        ${l.signed_document_url
                            ? `<a href="${escapeHtml(l.signed_document_url)}" target="_blank" class="text-orange-600 text-xs font-semibold hover:underline">View doc</a>`
                            : `<button data-lead-id="${l.id}" class="btn-add-doc text-xs text-gray-400 hover:text-orange-600 font-semibold">+ Add link</button>`}
                    </td>
                    <td class="px-4 py-3 text-gray-600 font-semibold">
                        ${l.status === 'COMPLIANCE_APPROVED' ? formatCurrency(l.client_tiers?.commission_amount) : '—'}
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// ── Render: agents tab (admin) ──────────────────────────────────────────
function renderAgents() {
    if (state.agents.length === 0) return `<div class="text-center py-16 text-gray-400"><p>No agents yet.</p></div>`;
    return `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <tr><th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Phone</th><th class="px-4 py-3">Status</th></tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                ${state.agents.map(a => `
                <tr class="hover:bg-gray-50/50">
                    <td class="px-4 py-3 font-semibold text-gray-900">${escapeHtml(a.full_name)}</td>
                    <td class="px-4 py-3 text-gray-600">${escapeHtml(a.email || '—')}</td>
                    <td class="px-4 py-3 text-gray-600">${escapeHtml(a.phone || '—')}</td>
                    <td class="px-4 py-3">
                        <select data-agent-id="${a.id}" class="agent-status-field text-xs font-semibold rounded-lg px-2 py-1 border-0 ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                            <option value="ACTIVE" ${a.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
                            <option value="INACTIVE" ${a.status === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// ── Render: tiers tab (admin) ────────────────────────────────────────────
function renderTiers() {
    return `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <tr><th class="px-4 py-3">Tier</th><th class="px-4 py-3">Commission (once-off, per signed client)</th></tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                ${state.tiers.map(t => `
                <tr class="hover:bg-gray-50/50">
                    <td class="px-4 py-3 font-semibold text-gray-900">${escapeHtml(t.name)}</td>
                    <td class="px-4 py-3">
                        <input type="number" step="0.01" data-tier-id="${t.id}" class="tier-amount-field text-sm border border-gray-200 rounded-lg px-2 py-1 w-32" value="${t.commission_amount}" />
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// ── Render: calls tab (agent) ────────────────────────────────────────────
function renderCalls() {
    if (state.calls.length === 0) return `<div class="text-center py-16 text-gray-400"><p>No calls logged yet.</p></div>`;
    return `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <tr><th class="px-4 py-3">Date</th><th class="px-4 py-3">Client</th><th class="px-4 py-3">Outcome</th><th class="px-4 py-3">Notes</th></tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                ${state.calls.map(c => `
                <tr class="hover:bg-gray-50/50">
                    <td class="px-4 py-3 text-gray-600">${formatDate(c.call_date)}</td>
                    <td class="px-4 py-3 font-semibold text-gray-900">${escapeHtml(c.telemarketing_leads?.client_name || 'Ad-hoc')}</td>
                    <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-700">${escapeHtml(c.outcome || '—')}</span></td>
                    <td class="px-4 py-3 text-gray-500">${escapeHtml(c.notes || '')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// ── Render: commissions tab (agent's own statement) ──────────────────────
function renderCommissions() {
    if (state.commissions.length === 0) return `<div class="text-center py-16 text-gray-400"><p>No commission earned yet.</p></div>`;

    const byPeriod = new Map();
    for (const c of state.commissions) {
        if (!byPeriod.has(c.payroll_period)) byPeriod.set(c.payroll_period, []);
        byPeriod.get(c.payroll_period).push(c);
    }

    return Array.from(byPeriod.entries()).map(([period, rows]) => {
        const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
        return `
        <div class="mb-6">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-bold text-gray-900">${formatMonth(period)}</h3>
                <p class="text-sm font-bold" style="color:var(--color-primary)">${formatCurrency(total)}</p>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-400">
                        <tr><th class="px-4 py-3">Client</th><th class="px-4 py-3">Tier</th><th class="px-4 py-3">Amount</th><th class="px-4 py-3">Status</th></tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${rows.map(r => `
                        <tr>
                            <td class="px-4 py-3 font-semibold text-gray-900">${escapeHtml(r.telemarketing_leads?.client_name || '—')}</td>
                            <td class="px-4 py-3 text-gray-600">${escapeHtml(r.client_tiers?.name || '—')}</td>
                            <td class="px-4 py-3 font-semibold">${formatCurrency(r.amount)}</td>
                            <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-1 rounded-lg ${r.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${r.status}</span></td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }).join('');
}

function renderTab() {
    const target = document.getElementById('tab-content');
    if (!target) return;
    if (state.tab === 'leads') target.innerHTML = renderLeads();
    else if (state.tab === 'agents') target.innerHTML = renderAgents();
    else if (state.tab === 'tiers') target.innerHTML = renderTiers();
    else if (state.tab === 'calls') target.innerHTML = renderCalls();
    else if (state.tab === 'commissions') target.innerHTML = renderCommissions();
    bindTabEvents();
}

// ── Events ───────────────────────────────────────────────────────────────
function bindShellEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.tab = btn.dataset.tab;
            const main = document.getElementById('main-content');
            if (main) main.innerHTML = renderPage();
            bindShellEvents();
            renderTab();
        });
    });

    document.getElementById('btn-add-lead')?.addEventListener('click', handleAddLead);
    document.getElementById('btn-add-agent')?.addEventListener('click', handleAddAgent);
    document.getElementById('btn-add-tier')?.addEventListener('click', handleAddTier);
    document.getElementById('btn-log-call')?.addEventListener('click', handleLogCall);
}

function bindTabEvents() {
    document.querySelectorAll('.lead-field').forEach(el => {
        el.addEventListener('change', async () => {
            const leadId = el.dataset.leadId;
            const field = el.dataset.field;
            const value = el.value || null;
            try {
                const res = await apiFetch(`/api/telemarketing/leads/${leadId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [field]: value })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Update failed');
                }
                await loadAll();
                renderTab();
            } catch (e) {
                alert(e.message);
            }
        });
    });

    document.querySelectorAll('.btn-add-doc').forEach(btn => {
        btn.addEventListener('click', async () => {
            const url = prompt('Paste the signed document link:');
            if (!url) return;
            await apiFetch(`/api/telemarketing/leads/${btn.dataset.leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signed_document_url: url, signed_at: new Date().toISOString() })
            });
            await loadAll();
            renderTab();
        });
    });

    document.querySelectorAll('.agent-status-field').forEach(el => {
        el.addEventListener('change', async () => {
            await apiFetch(`/api/telemarketing/agents/${el.dataset.agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: el.value })
            });
        });
    });

    document.querySelectorAll('.tier-amount-field').forEach(el => {
        el.addEventListener('change', async () => {
            await apiFetch(`/api/telemarketing/tiers/${el.dataset.tierId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commission_amount: Number(el.value) })
            });
        });
    });
}

async function handleAddLead() {
    const client_name = prompt('Client name:');
    if (!client_name) return;
    const contact_number = prompt('Contact number (optional):') || null;
    let agent_id = null;
    if (state.isAdmin) {
        const names = state.agents.map(a => `${a.id}: ${a.full_name}`).join('\n');
        agent_id = prompt(`Assign to which agent ID?\n${names}`);
        if (!agent_id) return;
    }
    try {
        const res = await apiFetch('/api/telemarketing/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_name, contact_number, agent_id: agent_id ? Number(agent_id) : undefined })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to add lead'); }
        await loadAll();
        renderTab();
    } catch (e) { alert(e.message); }
}

async function handleAddAgent() {
    const full_name = prompt('Agent full name:');
    if (!full_name) return;
    const email = prompt('Email (optional):') || null;
    const phone = prompt('Phone (optional):') || null;
    try {
        const res = await apiFetch('/api/telemarketing/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, phone })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to add agent'); }
        await loadAll();
        renderTab();
    } catch (e) { alert(e.message); }
}

async function handleAddTier() {
    const name = prompt('Tier name:');
    if (!name) return;
    const commission_amount = prompt('Commission amount (R):');
    if (!commission_amount) return;
    try {
        const res = await apiFetch('/api/telemarketing/tiers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, commission_amount: Number(commission_amount) })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to add tier'); }
        await loadAll();
        renderTab();
    } catch (e) { alert(e.message); }
}

async function handleLogCall() {
    const names = state.leads.map(l => `${l.id}: ${l.client_name}`).join('\n');
    const lead_id = prompt(`Log a call against which lead ID? (leave blank for ad-hoc)\n${names}`) || null;
    const outcome = prompt('Outcome (NO_ANSWER / INTERESTED / NOT_INTERESTED / CALLBACK / SIGNED):');
    if (!outcome) return;
    const notes = prompt('Notes (optional):') || null;
    try {
        const res = await apiFetch('/api/telemarketing/calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: lead_id ? Number(lead_id) : null, outcome, notes })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to log call'); }
        await loadAll();
        renderTab();
    } catch (e) { alert(e.message); }
}

// ── Init ─────────────────────────────────────────────────────────────────
async function init() {
    await initLayout();
    const { data: { session } } = await supabase.auth.getSession();
    const role = (session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || '').toLowerCase();
    state.role = role;
    state.isAdmin = ['admin', 'super_admin', 'owner'].includes(role);
    state.tab = state.isAdmin ? 'leads' : 'leads';

    const main = document.getElementById('main-content');
    if (!main) return;
    main.innerHTML = renderPage();
    bindShellEvents();

    try {
        await loadAll();
    } catch (e) {
        console.error('[telemarketing] failed to load', e);
    }
    renderTab();
}

document.addEventListener('DOMContentLoaded', init);
