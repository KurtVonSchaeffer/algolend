import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';

let token = '';
let currentYear = new Date().getFullYear();
let checkpoints = [];

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || '';
    return token;
}

function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS = { complete: 'Complete', in_progress: 'In Progress', pending: 'Pending', na: 'N/A' };
const STATUS_COLORS = {
    complete:    'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    pending:     'bg-red-100 text-red-600',
    na:          'bg-gray-100 text-gray-500',
};

// ── Load & render ─────────────────────────────────────────────────────────────

async function load() {
    const res = await fetch(`/api/admin/compliance/checkpoints?year=${currentYear}`, { headers: authHeaders() });
    if (!res.ok) return;
    const json = await res.json();
    checkpoints = json.checkpoints || [];
    render();
}

function render() {
    const main = document.getElementById('tracker-content');
    if (!main) return;

    const total    = checkpoints.length;
    const complete = checkpoints.filter(c => c.status === 'complete').length;
    const naCount  = checkpoints.filter(c => c.status === 'na').length;
    const applicable = total - naCount;
    const pct      = applicable > 0 ? Math.round((complete / applicable) * 100) : 0;

    const scoreColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626';
    const scoreBg    = pct >= 80 ? 'bg-green-50 border-green-200' : pct >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

    const categories = [...new Set(checkpoints.map(c => c.category))];

    main.innerHTML = `
    <!-- Year selector + score -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-3">
            <label class="text-sm font-medium text-gray-600">Financial Year:</label>
            <select id="year-select" class="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400">
                ${[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y =>
                    `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
        </div>
        <div class="flex gap-3">
            <a href="/api/admin/compliance/report/${currentYear}"
               target="_blank"
               class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 hover:bg-gray-50">
                <span class="material-symbols-outlined text-[18px]">print</span>Export Report
            </a>
        </div>
    </div>

    <!-- Score card -->
    <div class="rounded-2xl border p-5 mb-6 flex items-center justify-between ${scoreBg}">
        <div>
            <div class="text-sm font-semibold text-gray-700">Overall Compliance Score — FY${currentYear}</div>
            <div class="text-xs text-gray-500 mt-0.5">${complete} of ${applicable} applicable items complete${naCount ? ` · ${naCount} marked N/A` : ''}</div>
        </div>
        <div class="text-5xl font-black" style="color:${scoreColor}">${pct}%</div>
    </div>

    <!-- Checkpoint categories -->
    ${categories.map(cat => {
        const items = checkpoints.filter(c => c.category === cat);
        const catDone = items.filter(c => c.status === 'complete').length;
        return `
        <div class="bg-white rounded-2xl border border-gray-200 mb-4 overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 class="font-semibold text-gray-800">${cat}</h3>
                <span class="text-xs text-gray-400">${catDone}/${items.length} complete</span>
            </div>
            <div class="divide-y divide-gray-50">
                ${items.map(c => `
                <div class="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <!-- Status toggle -->
                    <button onclick="cycleStatus('${c.checkpoint_key}')"
                        class="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                            ${c.status === 'complete' ? 'bg-green-500 border-green-500' : c.status === 'in_progress' ? 'bg-yellow-400 border-yellow-400' : c.status === 'na' ? 'bg-gray-300 border-gray-300' : 'border-gray-300 bg-white'}"
                        title="Click to cycle status">
                        ${c.status === 'complete' ? '<span class="material-symbols-outlined text-white text-[14px]">check</span>' : c.status === 'in_progress' ? '<span class="material-symbols-outlined text-white text-[14px]">hourglass_empty</span>' : c.status === 'na' ? '<span class="material-symbols-outlined text-white text-[14px]">remove</span>' : ''}
                    </button>

                    <!-- Label + meta -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-medium text-gray-800 ${c.status === 'complete' ? 'line-through text-gray-400' : ''}">${c.label}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.pending}">
                                ${STATUS_LABELS[c.status] || 'Pending'}
                            </span>
                        </div>
                        <div class="text-xs text-gray-400 mt-0.5">Due: ${c.due}
                            ${c.completed_at ? ` · Completed ${new Date(c.completed_at).toLocaleDateString('en-ZA')}` : ''}
                            ${c.evidence_ref ? ` · Ref: <span class="text-gray-600">${c.evidence_ref}</span>` : ''}
                        </div>
                        ${c.notes ? `<div class="text-xs text-gray-500 mt-1 italic">${c.notes}</div>` : ''}
                    </div>

                    <!-- Edit button -->
                    <button onclick="openEdit('${c.checkpoint_key}')"
                        class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Add notes / evidence">
                        <span class="material-symbols-outlined text-[18px]">edit_note</span>
                    </button>
                </div>`).join('')}
            </div>
        </div>`;
    }).join('')}`;

    // Bind year change
    document.getElementById('year-select')?.addEventListener('change', e => {
        currentYear = parseInt(e.target.value, 10);
        document.querySelectorAll('.export-link').forEach(a => {
            a.href = `/api/admin/compliance/report/${currentYear}`;
        });
        load();
    });
}

// ── Status cycling (pending → in_progress → complete → na → pending) ──────────

const STATUS_CYCLE = ['pending', 'in_progress', 'complete', 'na'];

window.cycleStatus = async function(key) {
    const cp = checkpoints.find(c => c.checkpoint_key === key);
    if (!cp) return;
    const current = cp.status || 'pending';
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    await saveCheckpoint(key, { status: next });
};

window.openEdit = function(key) {
    const cp = checkpoints.find(c => c.checkpoint_key === key) || {};
    document.getElementById('edit-key').value           = key;
    document.getElementById('edit-status').value        = cp.status || 'pending';
    document.getElementById('edit-evidence').value      = cp.evidence_ref || '';
    document.getElementById('edit-notes').value         = cp.notes || '';
    document.getElementById('edit-label').textContent   = cp.label || key;
    document.getElementById('edit-modal').classList.remove('hidden');
};

async function saveCheckpoint(key, updates) {
    const res = await fetch(`/api/admin/compliance/checkpoints/${currentYear}/${key}`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(updates),
    });
    if (res.ok) await load();
    else alert('Failed to save.');
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    await initLayout();
    await getToken();

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <button onclick="window.location.href='/admin/dashboard'"
                class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-slate-700 transition-colors mb-4">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to Admin
            </button>
            <div class="flex items-center gap-3 mb-6">
                <span class="material-symbols-outlined text-2xl" style="color:var(--color-primary)">checklist</span>
                <div>
                    <h1 class="text-2xl font-black text-on-surface">Compliance Tracker</h1>
                    <p class="text-sm text-gray-400">Annual NCR / NCA / FICA compliance checklist — audit-ready report at year-end</p>
                </div>
            </div>
            <div id="tracker-content">
                <div class="flex items-center justify-center py-16 text-gray-400">
                    <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Loading…
                </div>
            </div>
        </div>

        <!-- Edit modal -->
        <div id="edit-modal" class="modal-backdrop hidden">
          <div class="modal-box">
            <h2 class="text-sm font-semibold text-gray-500 mb-1">Update Checkpoint</h2>
            <h3 id="edit-label" class="text-base font-bold text-gray-800 mb-4"></h3>
            <input type="hidden" id="edit-key" />
            <div class="form-group">
              <label>Status</label>
              <select id="edit-status">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="na">N/A (Not Applicable)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Evidence / Reference</label>
              <input type="text" id="edit-evidence" placeholder="e.g. Form 39 Ref #2025-Q1, email to ncr@ncr.org.za…" />
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea id="edit-notes" rows="3" placeholder="Internal notes…"></textarea>
            </div>
            <div class="flex gap-3 justify-end mt-2">
              <button id="edit-cancel" class="btn-secondary">Cancel</button>
              <button id="edit-save" class="btn-primary">Save</button>
            </div>
          </div>
        </div>`;
    }

    await load();

    document.getElementById('edit-cancel')?.addEventListener('click', () => {
        document.getElementById('edit-modal').classList.add('hidden');
    });

    document.getElementById('edit-save')?.addEventListener('click', async () => {
        const key = document.getElementById('edit-key').value;
        await saveCheckpoint(key, {
            status:       document.getElementById('edit-status').value,
            evidence_ref: document.getElementById('edit-evidence').value || null,
            notes:        document.getElementById('edit-notes').value || null,
        });
        document.getElementById('edit-modal').classList.add('hidden');
    });
}

init();
