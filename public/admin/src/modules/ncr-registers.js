import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';

let token = '';

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || '';
    return token;
}

function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const fmtR    = v => `R ${Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// ── Page skeleton ─────────────────────────────────────────────────────────────

function renderSkeleton() {
    return `
<div class="max-w-5xl mx-auto px-4 py-8">
    <button onclick="window.location.href='/admin/dashboard'"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-slate-700 transition-colors mb-4">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Admin
    </button>
    <div class="flex items-center gap-3 mb-6">
        <span class="material-symbols-outlined text-2xl" style="color:var(--color-primary)">manage_accounts</span>
        <div>
            <h1 class="text-2xl font-black text-on-surface">NCR Registers</h1>
            <p class="text-sm text-gray-400">Agent / Representative Register (Reg 39) &amp; Statutory Registers (Reg 40)</p>
        </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 mb-6 gap-6">
        <button data-tab="agents" class="pb-3 text-sm tab-active">
            <span class="material-symbols-outlined text-[16px] align-middle mr-1">group</span>Agent Register
        </button>
        <button data-tab="statutory" class="pb-3 text-sm text-gray-500">
            <span class="material-symbols-outlined text-[16px] align-middle mr-1">library_books</span>Statutory Registers
        </button>
    </div>

    <!-- Agent Panel -->
    <div id="panel-agents" data-panel>
        <div class="flex justify-between items-center mb-4">
            <p class="text-sm text-gray-500">All appointed credit provider representatives and compliance officers (NCR Reg 39).</p>
            <button id="btn-add-agent" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style="background:var(--color-secondary)">
                <span class="material-symbols-outlined text-[18px]">person_add</span>Add Agent
            </button>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <tr>
                        <th class="px-4 py-3">Name</th>
                        <th class="px-4 py-3">ID Number</th>
                        <th class="px-4 py-3">Role</th>
                        <th class="px-4 py-3">Branch</th>
                        <th class="px-4 py-3">Appointed</th>
                        <th class="px-4 py-3">Terminated</th>
                        <th class="px-4 py-3">Status</th>
                        <th class="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody id="agent-tbody">
                    <tr><td colspan="8" class="text-center py-8 text-gray-400 text-sm">
                        <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Loading…
                    </td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Statutory Panel -->
    <div id="panel-statutory" data-panel class="hidden">
        <p class="text-sm text-gray-500 mb-4">Annual financial and operational data for NCR Form 40 submission (Reg 40).</p>
        <div id="registers-container">
            <div class="text-center py-8 text-gray-400 text-sm">
                <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Loading…
            </div>
        </div>
    </div>
</div>

<!-- ── Agent Add Modal ────────────────────────────────────────────────── -->
<div id="agent-add-modal" class="modal-backdrop hidden">
  <div class="modal-box">
    <h2 class="text-base font-semibold mb-4">Add Agent / Representative</h2>
    <form id="agent-add-form">
      <div class="grid grid-cols-2 gap-3">
        <div class="form-group col-span-2">
          <label>Full Name *</label>
          <input type="text" name="full_name" required />
        </div>
        <div class="form-group">
          <label>ID Number *</label>
          <input type="text" name="id_number" required />
        </div>
        <div class="form-group">
          <label>NCR Registration #</label>
          <input type="text" name="ncr_number" />
        </div>
        <div class="form-group">
          <label>Role *</label>
          <select name="role" required>
            <option value="">Select…</option>
            <option>Credit Provider Representative</option>
            <option>Compliance Officer</option>
            <option>Debt Counsellor</option>
            <option>Branch Manager</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Branch</label>
          <input type="text" name="branch" />
        </div>
        <div class="form-group">
          <label>Appointment Date *</label>
          <input type="date" name="appointment_date" required />
        </div>
        <div class="form-group col-span-2">
          <label>Notes</label>
          <textarea name="notes" rows="2"></textarea>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-2">
        <button type="button" class="btn-secondary" data-close-modal="agent-add-modal">Cancel</button>
        <button type="submit" class="btn-primary">Add Agent</button>
      </div>
    </form>
  </div>
</div>

<!-- ── Agent Edit Modal ───────────────────────────────────────────────── -->
<div id="agent-edit-modal" class="modal-backdrop hidden">
  <div class="modal-box">
    <h2 class="text-base font-semibold mb-4">Edit Agent</h2>
    <form id="agent-edit-form">
      <input type="hidden" name="id" id="edit-agent-id" />
      <div class="grid grid-cols-2 gap-3">
        <div class="form-group col-span-2">
          <label>Full Name</label>
          <input type="text" name="full_name" id="edit-agent-name" required />
        </div>
        <div class="form-group">
          <label>ID Number</label>
          <input type="text" name="id_number" id="edit-agent-id-number" required />
        </div>
        <div class="form-group">
          <label>NCR Registration #</label>
          <input type="text" name="ncr_number" id="edit-agent-ncr" />
        </div>
        <div class="form-group">
          <label>Role</label>
          <select name="role" id="edit-agent-role">
            <option>Credit Provider Representative</option>
            <option>Compliance Officer</option>
            <option>Debt Counsellor</option>
            <option>Branch Manager</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Branch</label>
          <input type="text" name="branch" id="edit-agent-branch" />
        </div>
        <div class="form-group">
          <label>Appointment Date</label>
          <input type="date" name="appointment_date" id="edit-agent-appt" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select name="status" id="edit-agent-status">
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div class="form-group col-span-2">
          <label>Notes</label>
          <textarea name="notes" id="edit-agent-notes" rows="2"></textarea>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-2">
        <button type="button" class="btn-secondary" data-close-modal="agent-edit-modal">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  </div>
</div>

<!-- ── Statutory Register Modal ──────────────────────────────────────── -->
<div id="register-modal" class="modal-backdrop hidden">
  <div class="modal-box">
    <h2 id="register-modal-title" class="text-base font-semibold mb-4">Reg 40 Data</h2>
    <form id="register-form">
      <input type="hidden" name="financial_year" />
      <div class="grid grid-cols-2 gap-3">
        <div class="form-group"><label>Total Agreements</label><input type="number" name="total_agreements" /></div>
        <div class="form-group"><label>Total Book Value (R)</label><input type="number" step="0.01" name="total_book_value" /></div>
        <div class="form-group"><label>NPL Count</label><input type="number" name="npl_count" /></div>
        <div class="form-group"><label>NPL Value (R)</label><input type="number" step="0.01" name="npl_value" /></div>
        <div class="form-group"><label>Write-offs (R)</label><input type="number" step="0.01" name="write_offs" /></div>
        <div class="form-group"><label>Recoveries (R)</label><input type="number" step="0.01" name="recoveries" /></div>
        <div class="form-group"><label>Total Revenue (R)</label><input type="number" step="0.01" name="total_revenue" /></div>
        <div class="form-group"><label>Impairment Provision (R)</label><input type="number" step="0.01" name="impairment_provision" /></div>
        <div class="form-group"><label>Complaints Received</label><input type="number" name="complaints_received" /></div>
        <div class="form-group"><label>Complaints Resolved</label><input type="number" name="complaints_resolved" /></div>
        <div class="form-group"><label>Debt Review Referrals</label><input type="number" name="debt_review_referrals" /></div>
        <div class="form-group"><label>NCR Submission Reference</label><input type="text" name="submission_reference" /></div>
        <div class="form-group col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" name="submitted_to_ncr" id="submitted-to-ncr" class="w-4 h-4" style="accent-color:var(--color-secondary)" />
          <label for="submitted-to-ncr" style="margin:0;font-size:13px;font-weight:500">Submitted to NCR</label>
        </div>
        <div class="form-group col-span-2"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
      </div>
      <div class="flex gap-3 justify-end mt-2">
        <button type="button" class="btn-secondary" data-close-modal="register-modal">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  </div>
</div>`;
}

// ── Agent Register ────────────────────────────────────────────────────────────

let agents = [];

async function loadAgents() {
    const res = await fetch('/api/admin/ncr/agents', { headers: authHeaders() });
    agents = res.ok ? await res.json() : [];
    renderAgents();
}

function renderAgents() {
    const tbody = document.getElementById('agent-tbody');
    if (!tbody) return;
    if (!agents.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-400 text-sm">No agents on register yet. Click <strong>Add Agent</strong> to get started.</td></tr>`;
        return;
    }
    tbody.innerHTML = agents.map(a => `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
            <td class="px-4 py-3 text-sm font-medium">${a.full_name}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${a.id_number}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${a.role}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${a.branch || '—'}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${fmtDate(a.appointment_date)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${a.termination_date ? fmtDate(a.termination_date) : '—'}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${
                    a.status === 'active'     ? 'bg-green-100 text-green-700'
                  : a.status === 'suspended' ? 'bg-yellow-100 text-yellow-700'
                  :                           'bg-red-100 text-red-700'}">${a.status}</span>
            </td>
            <td class="px-4 py-3 text-sm flex gap-2">
                <button onclick="openEditAgent('${a.id}')" class="text-xs text-blue-600 hover:underline">Edit</button>
                ${a.status === 'active'
                    ? `<button onclick="terminateAgent('${a.id}')" class="text-xs text-red-500 hover:underline">Terminate</button>`
                    : ''}
            </td>
        </tr>`).join('');
}

window.openEditAgent = function(id) {
    const a = agents.find(x => x.id === id);
    if (!a) return;
    document.getElementById('edit-agent-id').value          = a.id;
    document.getElementById('edit-agent-name').value        = a.full_name;
    document.getElementById('edit-agent-id-number').value   = a.id_number;
    document.getElementById('edit-agent-ncr').value         = a.ncr_number || '';
    document.getElementById('edit-agent-role').value        = a.role;
    document.getElementById('edit-agent-branch').value      = a.branch || '';
    document.getElementById('edit-agent-appt').value        = a.appointment_date || '';
    document.getElementById('edit-agent-status').value      = a.status;
    document.getElementById('edit-agent-notes').value       = a.notes || '';
    document.getElementById('agent-edit-modal').classList.remove('hidden');
};

window.terminateAgent = async function(id) {
    if (!confirm('Mark this agent as terminated?')) return;
    const res = await fetch(`/api/admin/ncr/agents/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'terminated', termination_date: new Date().toISOString().slice(0,10) }),
    });
    if (res.ok) await loadAgents();
    else alert('Failed to update agent.');
};

async function saveNewAgent(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const res = await fetch('/api/admin/ncr/agents', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(fd),
    });
    if (res.ok) {
        e.target.reset();
        document.getElementById('agent-add-modal').classList.add('hidden');
        await loadAgents();
    } else {
        const err = await res.json();
        alert(err.error || 'Failed to add agent.');
    }
}

async function saveEditAgent(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    const body = {
        full_name: fd.get('full_name'), id_number: fd.get('id_number'),
        ncr_number: fd.get('ncr_number'), role: fd.get('role'),
        branch: fd.get('branch'), appointment_date: fd.get('appointment_date'),
        status: fd.get('status'), notes: fd.get('notes'),
    };
    const res = await fetch(`/api/admin/ncr/agents/${id}`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) {
        document.getElementById('agent-edit-modal').classList.add('hidden');
        await loadAgents();
    } else {
        const err = await res.json();
        alert(err.error || 'Failed to update agent.');
    }
}

// ── Statutory Registers ───────────────────────────────────────────────────────

let registers = [];

async function loadRegisters() {
    const res = await fetch('/api/admin/ncr/statutory-registers', { headers: authHeaders() });
    registers = res.ok ? await res.json() : [];
    renderRegisters();
}

function renderRegisters() {
    const container = document.getElementById('registers-container');
    if (!container) return;

    const currentYear = new Date().getFullYear();
    const years = Array.from(new Set([currentYear, currentYear - 1, ...registers.map(r => r.financial_year)])).sort((a, b) => b - a);

    container.innerHTML = years.map(year => {
        const reg = registers.find(r => r.financial_year === year) || {};
        const submitted = reg.submitted_to_ncr;
        return `
        <div class="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <h3 class="font-semibold text-gray-800">Financial Year ${year}</h3>
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium ${submitted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                        ${submitted ? `Submitted ${fmtDate(reg.submitted_at)}` : 'Not yet submitted'}
                    </span>
                </div>
                <button onclick="openRegisterEdit(${year})"
                    class="text-sm px-4 py-2 rounded-lg font-medium text-white"
                    style="background:var(--color-secondary)">
                    ${reg.id ? 'Edit' : 'Add Data'}
                </button>
            </div>
            ${reg.id ? `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                ${kv('Total Agreements', reg.total_agreements)}
                ${kv('Book Value', reg.total_book_value != null ? fmtR(reg.total_book_value) : null)}
                ${kv('NPL Value', reg.npl_value != null ? fmtR(reg.npl_value) : null)}
                ${kv('Write-offs', reg.write_offs != null ? fmtR(reg.write_offs) : null)}
                ${kv('Total Revenue', reg.total_revenue != null ? fmtR(reg.total_revenue) : null)}
                ${kv('Impairment Provision', reg.impairment_provision != null ? fmtR(reg.impairment_provision) : null)}
                ${kv('Complaints Received', reg.complaints_received)}
                ${kv('Debt Review Referrals', reg.debt_review_referrals)}
            </div>
            ${reg.notes ? `<p class="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">${reg.notes}</p>` : ''}
            ` : '<p class="text-sm text-gray-400">No data entered yet.</p>'}
        </div>`;
    }).join('');
}

function kv(label, value) {
    return `<div class="bg-gray-50 rounded-lg p-3">
        <div class="text-gray-500 text-xs mb-1">${label}</div>
        <div class="font-semibold text-sm">${value ?? '—'}</div>
    </div>`;
}

window.openRegisterEdit = function(year) {
    const reg = registers.find(r => r.financial_year === year) || {};
    const form = document.getElementById('register-form');
    form.elements['financial_year'].value = year;
    const numFields = ['total_agreements','total_book_value','npl_count','npl_value','write_offs',
        'recoveries','total_revenue','impairment_provision','complaints_received',
        'complaints_resolved','debt_review_referrals'];
    for (const f of numFields) {
        if (form.elements[f]) form.elements[f].value = reg[f] ?? '';
    }
    if (form.elements['submission_reference']) form.elements['submission_reference'].value = reg.submission_reference || '';
    if (form.elements['notes']) form.elements['notes'].value = reg.notes || '';
    document.getElementById('submitted-to-ncr').checked = !!reg.submitted_to_ncr;
    document.getElementById('register-modal-title').textContent = `Financial Year ${year} — Reg 40 Data`;
    document.getElementById('register-modal').classList.remove('hidden');
};

async function saveRegister(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const year = fd.get('financial_year');
    const body = {};
    for (const [k, v] of fd.entries()) {
        if (k === 'financial_year') continue;
        body[k] = v === '' ? null : v;
    }
    body.submitted_to_ncr = document.getElementById('submitted-to-ncr').checked;
    if (body.submitted_to_ncr && !body.submitted_at) body.submitted_at = new Date().toISOString();

    const res = await fetch(`/api/admin/ncr/statutory-registers/${year}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) {
        document.getElementById('register-modal').classList.add('hidden');
        await loadRegisters();
    } else {
        const err = await res.json();
        alert(err.error || 'Failed to save.');
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    await initLayout();
    await getToken();

    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.innerHTML = renderSkeleton();

    await Promise.all([loadAgents(), loadRegisters()]);

    // Tab switching
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('tab-active'));
            btn.classList.add('tab-active');
            document.querySelectorAll('[data-panel]').forEach(p => p.classList.add('hidden'));
            document.getElementById(`panel-${btn.dataset.tab}`).classList.remove('hidden');
        });
    });

    document.getElementById('btn-add-agent')?.addEventListener('click', () => {
        document.getElementById('agent-add-form').reset();
        document.getElementById('agent-add-modal').classList.remove('hidden');
    });
    document.getElementById('agent-add-form')?.addEventListener('submit', saveNewAgent);
    document.getElementById('agent-edit-form')?.addEventListener('submit', saveEditAgent);
    document.getElementById('register-form')?.addEventListener('submit', saveRegister);

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.closeModal)?.classList.add('hidden');
        });
    });
}

init();
