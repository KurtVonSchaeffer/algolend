import { initLayout } from '../shared/layout.js';
import { apiFetch } from '../shared/apiFetch.js';

let products = [];
let editingId = null;

const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initLayout({ pageTitle: 'Loan Products', activeNav: 'products' });
    await load();
    render();
    attachListeners();
});

// ── Data ──────────────────────────────────────────────────────────────────────
async function load() {
    try {
        const res = await apiFetch('/api/admin/products');
        const json = await res.json();
        products = json.data || [];
    } catch (e) {
        console.error('Failed to load products:', e);
        products = [];
    }
}

async function save(payload) {
    const method = editingId ? 'PUT' : 'POST';
    const url    = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
    const res    = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
    return res.json();
}

async function remove(id) {
    const res = await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
}

async function toggleActive(id, current) {
    await apiFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current })
    });
    await load(); render();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
    const main = document.getElementById('main-content');
    if (!main) return;

    const cards = products.length
        ? products.map(p => productCard(p)).join('')
        : `<div class="col-span-full flex flex-col items-center justify-center py-24 text-outline/60">
             <span class="material-symbols-outlined text-5xl mb-4">inventory_2</span>
             <p class="text-sm font-medium">No loan products yet</p>
             <p class="text-xs mt-1">Click "New Product" to create your first.</p>
           </div>`;

    main.innerHTML = `
      <div class="max-w-6xl mx-auto space-y-6">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-headline font-bold text-on-surface">Loan Products</h2>
            <p class="text-sm text-outline mt-0.5">Define the loan types your branch offers</p>
          </div>
          <button id="btn-new" class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md hover:opacity-90 transition-opacity" style="background:var(--color-primary)">
            <span class="material-symbols-outlined text-[18px]">add</span>
            New Product
          </button>
        </div>

        <!-- Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          ${cards}
        </div>
      </div>

      <!-- Modal -->
      <div id="modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg border border-outline-variant/20 overflow-hidden">
          <div class="px-6 py-5 border-b border-outline-variant/10 flex items-center justify-between">
            <h3 id="modal-title" class="font-headline font-bold text-on-surface text-base">New Loan Product</h3>
            <button id="modal-close" class="text-outline hover:text-on-surface transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <form id="product-form" class="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

            <div>
              <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Product Name</label>
              <input id="f-name" type="text" required placeholder="e.g. Personal Loan"
                class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Min Amount (R)</label>
                <input id="f-min-amount" type="number" min="0" step="100" required placeholder="500"
                  class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              </div>
              <div>
                <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Max Amount (R)</label>
                <input id="f-max-amount" type="number" min="0" step="100" required placeholder="50000"
                  class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Min Term (months)</label>
                <input id="f-min-term" type="number" min="1" required placeholder="1"
                  class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              </div>
              <div>
                <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Max Term (months)</label>
                <input id="f-max-term" type="number" min="1" required placeholder="36"
                  class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Monthly Interest Rate (%)</label>
                <input id="f-interest" type="number" min="0" max="100" step="0.1" required placeholder="5"
                  class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              </div>
              <div>
                <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Initiation Fee (%)</label>
                <input id="f-initiation" type="number" min="0" max="100" step="0.1" required placeholder="15"
                  class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Monthly Admin Fee (R)</label>
                <input id="f-admin-fee" type="number" min="0" step="1" required placeholder="60"
                  class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              </div>
              <div class="flex flex-col justify-end pb-0.5">
                <label class="flex items-center gap-3 cursor-pointer select-none">
                  <div class="relative">
                    <input id="f-credit-life" type="checkbox" class="sr-only peer">
                    <div class="w-10 h-5 rounded-full bg-outline-variant/40 peer-checked:bg-primary transition-colors"></div>
                    <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <span class="text-xs font-semibold text-outline uppercase tracking-wider">Sanlam Credit Life</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-outline uppercase tracking-wider mb-1.5">Description <span class="normal-case font-normal">(optional)</span></label>
              <textarea id="f-description" rows="2" placeholder="Short description visible to staff..."
                class="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
            </div>

          </form>
          <div class="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between gap-3">
            <p id="form-error" class="text-xs text-red-500 hidden"></p>
            <div class="flex gap-3 ml-auto">
              <button id="modal-cancel" class="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-variant/40 transition-colors">Cancel</button>
              <button id="modal-save" type="submit" form="product-form" class="px-5 py-2 rounded-xl text-sm font-bold text-white shadow hover:opacity-90 transition-opacity" style="background:var(--color-primary)">Save Product</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-new')?.addEventListener('click', () => openModal(null));
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
    document.getElementById('product-form')?.addEventListener('submit', handleSubmit);

    document.querySelectorAll('[data-edit]').forEach(btn =>
        btn.addEventListener('click', () => openModal(products.find(p => p.id === btn.dataset.edit)))
    );
    document.querySelectorAll('[data-delete]').forEach(btn =>
        btn.addEventListener('click', () => handleDelete(btn.dataset.delete))
    );
    document.querySelectorAll('[data-toggle]').forEach(btn =>
        btn.addEventListener('click', () => {
            const p = products.find(x => x.id === btn.dataset.toggle);
            if (p) toggleActive(p.id, p.is_active);
        })
    );
}

function productCard(p) {
    const active = p.is_active !== false;
    const statusDot = active
        ? `<span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span><span class="text-green-600 text-[11px] font-semibold">Active</span>`
        : `<span class="w-2 h-2 rounded-full bg-gray-300 inline-block"></span><span class="text-outline text-[11px] font-semibold">Inactive</span>`;

    return `
      <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm hover:shadow-md transition-shadow flex flex-col">
        <div class="px-5 pt-5 pb-4 flex-1">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 class="font-headline font-bold text-on-surface text-base leading-tight">${p.name}</h3>
              ${p.description ? `<p class="text-xs text-outline mt-1 leading-relaxed">${p.description}</p>` : ''}
            </div>
            <div class="flex items-center gap-1.5 shrink-0 mt-0.5">${statusDot}</div>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Amount Range</p>
              <p class="text-xs font-semibold text-on-surface">${fmt(p.min_amount)} – ${fmt(p.max_amount)}</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Term Range</p>
              <p class="text-xs font-semibold text-on-surface">${p.min_term_months}–${p.max_term_months} months</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Monthly Interest</p>
              <p class="text-xs font-semibold text-on-surface">${pct(p.interest_rate_monthly)}/mo</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Initiation Fee</p>
              <p class="text-xs font-semibold text-on-surface">${pct(p.initiation_fee_rate)}</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Admin Fee</p>
              <p class="text-xs font-semibold text-on-surface">${fmt(p.monthly_admin_fee)}/mo</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Credit Life</p>
              <p class="text-xs font-semibold text-on-surface">${p.has_credit_life ? 'Sanlam (R4.50/R1k)' : 'None'}</p>
            </div>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-outline-variant/10 flex items-center gap-2">
          <button data-toggle="${p.id}" class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${active ? 'bg-gray-100 text-outline hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}">
            ${active ? 'Deactivate' : 'Activate'}
          </button>
          <button data-edit="${p.id}" class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant/70 transition-colors">
            Edit
          </button>
          <button data-delete="${p.id}" class="py-1.5 px-3 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
            <span class="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(product) {
    editingId = product?.id || null;
    document.getElementById('modal-title').textContent = product ? 'Edit Loan Product' : 'New Loan Product';
    document.getElementById('f-name').value          = product?.name || '';
    document.getElementById('f-min-amount').value   = product?.min_amount || '';
    document.getElementById('f-max-amount').value   = product?.max_amount || '';
    document.getElementById('f-min-term').value     = product?.min_term_months || '';
    document.getElementById('f-max-term').value     = product?.max_term_months || '';
    document.getElementById('f-interest').value     = product ? (Number(product.interest_rate_monthly) * 100).toFixed(1) : '';
    document.getElementById('f-initiation').value   = product ? (Number(product.initiation_fee_rate) * 100).toFixed(1) : '';
    document.getElementById('f-admin-fee').value    = product?.monthly_admin_fee || '';
    document.getElementById('f-credit-life').checked = !!product?.has_credit_life;
    document.getElementById('f-description').value  = product?.description || '';
    document.getElementById('form-error').classList.add('hidden');
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('f-name').focus();
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    editingId = null;
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleSubmit(e) {
    e.preventDefault();
    const errEl  = document.getElementById('form-error');
    const saveBtn = document.getElementById('modal-save');
    errEl.classList.add('hidden');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
        const payload = {
            name:                  document.getElementById('f-name').value.trim(),
            min_amount:            Number(document.getElementById('f-min-amount').value),
            max_amount:            Number(document.getElementById('f-max-amount').value),
            min_term_months:       Number(document.getElementById('f-min-term').value),
            max_term_months:       Number(document.getElementById('f-max-term').value),
            interest_rate_monthly: Number(document.getElementById('f-interest').value) / 100,
            initiation_fee_rate:   Number(document.getElementById('f-initiation').value) / 100,
            monthly_admin_fee:     Number(document.getElementById('f-admin-fee').value),
            has_credit_life:       document.getElementById('f-credit-life').checked,
            description:           document.getElementById('f-description').value.trim() || null,
        };
        await save(payload);
        closeModal();
        await load();
        render();
        window.showToast(editingId ? 'Product updated' : 'Product created', 'success');
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Product';
    }
}

async function handleDelete(id) {
    if (!confirm('Delete this loan product? This cannot be undone.')) return;
    try {
        await remove(id);
        await load();
        render();
        window.showToast('Product deleted', 'success');
    } catch (err) {
        window.showToast(err.message, 'error');
    }
}

function attachListeners() {}
