import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';

let token = '';
let reports = [];

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || '';
    return token;
}

function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const fmtR    = v => v != null ? `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const STATUS_COLORS = {
    draft:        'bg-gray-100 text-gray-600',
    submitted:    'bg-blue-100 text-blue-700',
    acknowledged: 'bg-green-100 text-green-700',
};

const TYPE_COLORS = {
    STR: 'bg-red-100 text-red-700',
    CTR: 'bg-orange-100 text-orange-700',
    TPR: 'bg-purple-100 text-purple-700',
};

// ── Load & render ─────────────────────────────────────────────────────────────

async function load() {
    const res = await fetch('/api/admin/goaml', { headers: authHeaders() });
    reports = res.ok ? await res.json() : [];
    render();
}

function render() {
    const tbody = document.getElementById('goaml-tbody');
    if (!tbody) return;

    if (!reports.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400 text-sm">No FIC reports logged yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = reports.map(r => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
            <td class="px-4 py-3 text-xs">
                <span class="px-2 py-0.5 rounded font-bold ${TYPE_COLORS[r.report_type] || 'bg-gray-100 text-gray-600'}">${r.report_type}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700">${r.profiles?.full_name || '—'}<br>
                <span class="text-xs text-gray-400">${r.profiles?.identity_number || ''}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${fmtR(r.amount)}</td>
            <td class="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title="${r.description}">${r.description}</td>
            <td class="px-4 py-3 text-xs">
                <span class="px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}">${r.status}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">${r.goaml_ref || '—'}</td>
            <td class="px-4 py-3 text-sm text-gray-500">${fmtDate(r.submitted_at)}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="openEdit('${r.id}')" class="text-xs text-blue-600 hover:underline">Edit</button>
            </td>
        </tr>`).join('');
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveNew(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (!body.amount) delete body.amount;

    const res = await fetch('/api/admin/goaml', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) {
        e.target.reset();
        document.getElementById('add-modal').classList.add('hidden');
        await load();
    } else {
        const err = await res.json();
        alert(err.error || 'Failed to save.');
    }
}

window.openEdit = function(id) {
    const r = reports.find(x => x.id === id);
    if (!r) return;
    document.getElementById('edit-id').value       = r.id;
    document.getElementById('edit-status').value   = r.status;
    document.getElementById('edit-ref').value      = r.goaml_ref || '';
    document.getElementById('edit-notes').value    = r.notes || '';
    document.getElementById('edit-modal').classList.remove('hidden');
};

async function saveEdit(e) {
    e.preventDefault();
    const fd  = new FormData(e.target);
    const id  = fd.get('id');
    const res = await fetch(`/api/admin/goaml/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: fd.get('status'), goaml_ref: fd.get('goaml_ref'), notes: fd.get('notes') }),
    });
    if (res.ok) {
        document.getElementById('edit-modal').classList.add('hidden');
        await load();
    } else {
        const err = await res.json();
        alert(err.error || 'Failed to update.');
    }
}

// ── Summary counts ────────────────────────────────────────────────────────────

function renderSummary() {
    const counts = { STR: 0, CTR: 0, TPR: 0 };
    const pending = reports.filter(r => r.status === 'draft').length;
    reports.forEach(r => { if (counts[r.report_type] !== undefined) counts[r.report_type]++; });

    document.getElementById('summary-str').textContent = counts.STR;
    document.getElementById('summary-ctr').textContent = counts.CTR;
    document.getElementById('summary-tpr').textContent = counts.TPR;
    document.getElementById('summary-pending').textContent = pending;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    await initLayout();
    await getToken();

    const main = document.getElementById('main-content');
    if (main) main.innerHTML = `
    <div class="max-w-5xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-2xl" style="color:var(--color-primary)">security</span>
                <div>
                    <h1 class="text-2xl font-black text-on-surface">FIC goAML Reports</h1>
                    <p class="text-sm text-gray-400">Suspicious (STR), Cash (CTR) and Terrorist Property (TPR) transaction reports</p>
                </div>
            </div>
            <button id="btn-add" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style="background:var(--color-secondary)">
                <span class="material-symbols-outlined text-[18px]">add</span>Log Report
            </button>
        </div>

        <!-- Summary cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div class="text-2xl font-black text-red-600" id="summary-str">—</div>
                <div class="text-xs text-gray-500 mt-1">STR Reports</div>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div class="text-2xl font-black text-orange-500" id="summary-ctr">—</div>
                <div class="text-xs text-gray-500 mt-1">CTR Reports</div>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div class="text-2xl font-black text-purple-600" id="summary-tpr">—</div>
                <div class="text-xs text-gray-500 mt-1">TPR Reports</div>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div class="text-2xl font-black text-yellow-500" id="summary-pending">—</div>
                <div class="text-xs text-gray-500 mt-1">Awaiting Submission</div>
            </div>
        </div>

        <!-- FIC info banner -->
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
            <strong>goAML Portal:</strong> Submit reports at
            <a href="https://goaml.fic.gov.za" target="_blank" class="underline font-medium">goaml.fic.gov.za</a>.
            STRs must be filed within 15 days of forming suspicion · CTRs within 15 days of month-end · TPRs immediately.
            Log the goAML reference number here after submission.
        </div>

        <!-- Table -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <tr>
                        <th class="px-4 py-3">Type</th>
                        <th class="px-4 py-3">Client</th>
                        <th class="px-4 py-3">Amount</th>
                        <th class="px-4 py-3">Description</th>
                        <th class="px-4 py-3">Status</th>
                        <th class="px-4 py-3">goAML Ref</th>
                        <th class="px-4 py-3">Submitted</th>
                        <th class="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody id="goaml-tbody">
                    <tr><td colspan="8" class="text-center py-10 text-gray-400 text-sm">
                        <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Loading…
                    </td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Add modal -->
    <div id="add-modal" class="modal-backdrop hidden">
      <div class="modal-box">
        <h2 class="text-base font-semibold mb-4">Log FIC Report</h2>
        <form id="add-form">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label>Report Type *</label>
              <select name="report_type" required>
                <option value="">Select…</option>
                <option value="STR">STR — Suspicious Transaction</option>
                <option value="CTR">CTR — Cash Transaction</option>
                <option value="TPR">TPR — Terrorist Property</option>
              </select>
            </div>
            <div class="form-group">
              <label>Amount (R)</label>
              <input type="number" step="0.01" name="amount" placeholder="0.00" />
            </div>
            <div class="form-group col-span-2">
              <label>Client Name / ID (optional)</label>
              <input type="text" name="user_id" placeholder="Leave blank or paste user UUID" />
            </div>
            <div class="form-group col-span-2">
              <label>Description / Grounds for Report *</label>
              <textarea name="description" rows="3" required placeholder="Describe the suspicious activity or transaction…"></textarea>
            </div>
            <div class="form-group">
              <label>goAML Reference (if already submitted)</label>
              <input type="text" name="goaml_ref" placeholder="e.g. STR-2025-000123" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status">
                <option value="draft">Draft</option>
                <option value="submitted">Submitted to FIC</option>
                <option value="acknowledged">Acknowledged by FIC</option>
              </select>
            </div>
            <div class="form-group col-span-2">
              <label>Internal Notes</label>
              <textarea name="notes" rows="2"></textarea>
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-2">
            <button type="button" class="btn-secondary" id="add-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Save Report</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit modal -->
    <div id="edit-modal" class="modal-backdrop hidden">
      <div class="modal-box">
        <h2 class="text-base font-semibold mb-4">Update Report</h2>
        <form id="edit-form">
          <input type="hidden" name="id" id="edit-id" />
          <div class="form-group">
            <label>Status</label>
            <select name="status" id="edit-status">
              <option value="draft">Draft</option>
              <option value="submitted">Submitted to FIC</option>
              <option value="acknowledged">Acknowledged by FIC</option>
            </select>
          </div>
          <div class="form-group">
            <label>goAML Reference Number</label>
            <input type="text" name="goaml_ref" id="edit-ref" placeholder="e.g. STR-2025-000123" />
          </div>
          <div class="form-group">
            <label>Internal Notes</label>
            <textarea name="notes" id="edit-notes" rows="3"></textarea>
          </div>
          <div class="flex gap-3 justify-end mt-2">
            <button type="button" class="btn-secondary" id="edit-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>`;

    await load();
    renderSummary();

    document.getElementById('btn-add')?.addEventListener('click', () => {
        document.getElementById('add-form').reset();
        document.getElementById('add-modal').classList.remove('hidden');
    });
    document.getElementById('add-cancel')?.addEventListener('click',  () => document.getElementById('add-modal').classList.add('hidden'));
    document.getElementById('edit-cancel')?.addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
    document.getElementById('add-form')?.addEventListener('submit',  saveNew);
    document.getElementById('edit-form')?.addEventListener('submit', saveEdit);
}

init();
