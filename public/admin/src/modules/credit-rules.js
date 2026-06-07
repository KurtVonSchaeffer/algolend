// src/modules/credit-rules.js — Credit Rules Engine Admin UI
import { initLayout } from '../shared/layout.js';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let organizations = [];
let currentOrgId  = null;
let bands         = [];
let rules         = [];
let editingBandId = null;

// ─────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initLayout({ pageTitle: 'Credit Rules', activeNav: 'credit-rules' });
    await loadOrganizations();
    render();
});

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────
async function loadOrganizations() {
    const res = await fetch('/api/organizations');
    const json = await res.json();
    organizations = json.data || [];
    if (organizations.length) currentOrgId = organizations[0].id;
}

async function loadRules() {
    if (!currentOrgId) return;
    const res = await fetch(`/api/credit-rules/${currentOrgId}`);
    const json = await res.json();
    bands = json.bands || [];
    rules = json.rules || [];
}

// Check if any bands have overlapping score ranges
function getOverlaps() {
    const overlaps = [];
    for (let i = 0; i < bands.length; i++) {
        for (let j = i + 1; j < bands.length; j++) {
            const a = bands[i], b = bands[j];
            if (a.min_score <= b.max_score && b.min_score <= a.max_score) {
                overlaps.push(`"${a.label}" (${a.min_score}–${a.max_score}) overlaps with "${b.label}" (${b.min_score}–${b.max_score})`);
            }
        }
    }
    return overlaps;
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
async function render() {
    await loadRules();
    const shell = document.getElementById('app-shell');
    const main  = shell.querySelector('main') || shell;
    const content = main.querySelector('#cr-content') || (() => {
        const d = document.createElement('div');
        d.id = 'cr-content';
        d.className = 'p-6 max-w-6xl mx-auto';
        main.appendChild(d);
        return d;
    })();

    const overlaps = getOverlaps();

    content.innerHTML = `
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Credit Rules</h1>
          <p class="text-sm text-gray-500 mt-1">Configure per-client score bands and eligibility criteria</p>
        </div>
        <div class="flex items-center gap-3">
          ${organizations.length > 1 ? `
          <select id="orgSelector" onchange="window.crSwitchOrg(this.value)"
            class="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-orange-400 focus:outline-none">
            ${organizations.map(o => `<option value="${o.id}" ${o.id===currentOrgId?'selected':''}>${o.name}</option>`).join('')}
          </select>` : `<span class="text-sm font-semibold text-gray-700">${organizations[0]?.name || ''}</span>`}
          <button onclick="window.crOpenSimulator()"
            class="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <i class="fas fa-flask text-xs"></i> Simulate
          </button>
        </div>
      </div>

      <!-- Overlap Warning -->
      ${overlaps.length ? `
      <div class="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <i class="fas fa-triangle-exclamation text-red-500 mt-0.5"></i>
        <div>
          <p class="text-sm font-bold text-red-700">Score Band Overlap Detected</p>
          <ul class="mt-1 space-y-0.5">
            ${overlaps.map(o => `<li class="text-xs text-red-600">• ${o}</li>`).join('')}
          </ul>
          <p class="text-xs text-red-500 mt-1">Overlapping bands may produce unpredictable decisions. Fix the score ranges.</p>
        </div>
      </div>` : ''}

      <!-- Score Bands -->
      <section class="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <i class="fas fa-layer-group text-orange-500 text-sm"></i>
            </div>
            <div>
              <h2 class="font-semibold text-gray-900">Credit Score Bands</h2>
              <p class="text-xs text-gray-400">Define risk levels, max loan amounts and interest rates per score range</p>
            </div>
          </div>
          <button onclick="window.crOpenBandModal()"
            class="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <i class="fas fa-plus text-xs"></i> Add Band
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                <th class="px-6 py-3 text-left">Band</th>
                <th class="px-6 py-3 text-left">Score Range</th>
                <th class="px-6 py-3 text-left">Risk</th>
                <th class="px-6 py-3 text-right">Max Loan</th>
                <th class="px-6 py-3 text-right">Rate (p.a.)</th>
                <th class="px-6 py-3 text-right">Max Term</th>
                <th class="px-6 py-3 text-center">Decision</th>
                <th class="px-6 py-3 text-center">1st Loan Term</th>
                <th class="px-6 py-3 text-left">Decline Message</th>
                <th class="px-6 py-3 text-center">Active</th>
                <th class="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${bands.map(b => {
                const isOverlap = overlaps.some(o => o.includes(`"${b.label}"`));
                return `
              <tr class="hover:bg-gray-50 transition-colors ${isOverlap ? 'bg-red-50/40' : ''}">
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-2 font-semibold text-gray-800">
                    <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${b.color}"></span>
                    ${b.label}
                    ${isOverlap ? '<i class="fas fa-triangle-exclamation text-red-400 text-xs"></i>' : ''}
                  </span>
                </td>
                <td class="px-6 py-4 text-gray-600 font-mono text-xs">${b.min_score} – ${b.max_score}</td>
                <td class="px-6 py-4">
                  <span class="px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
                    style="background:${b.color}20;color:${b.color}">${b.risk_level}</span>
                </td>
                <td class="px-6 py-4 text-right font-semibold text-gray-800">R ${Number(b.max_loan_amount).toLocaleString()}</td>
                <td class="px-6 py-4 text-right text-gray-600">${b.interest_rate_pa}%</td>
                <td class="px-6 py-4 text-right text-gray-600">${b.max_term_months} mo</td>
                <td class="px-6 py-4 text-center">
                  <span class="px-2 py-1 rounded-lg text-xs font-bold uppercase ${
                    b.auto_decision==='approve' ? 'bg-green-50 text-green-700' :
                    b.auto_decision==='decline' ? 'bg-red-50 text-red-600' :
                    'bg-yellow-50 text-yellow-700'}">
                    ${b.auto_decision}
                  </span>
                </td>
                <td class="px-6 py-4 text-center">
                  ${b.first_loan_max_term_months
                    ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                        <i class="fas fa-star text-xs"></i> ${b.first_loan_max_term_months} mo</span>`
                    : `<span class="text-gray-300 text-xs">—</span>`}
                </td>
                <td class="px-6 py-4 text-xs text-gray-400 max-w-[160px] truncate" title="${b.decline_reason || ''}">
                  ${b.decline_reason ? `<span class="italic">"${b.decline_reason}"</span>` : '<span class="text-gray-200">—</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                  <button onclick="window.crToggleBand('${b.id}', ${!b.is_active})"
                    class="relative w-10 h-6 rounded-full transition-colors duration-200 ${b.is_active ? 'bg-orange-500' : 'bg-gray-200'}">
                    <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${b.is_active ? 'translate-x-4' : ''}"></span>
                  </button>
                </td>
                <td class="px-6 py-4 text-center">
                  <div class="flex items-center justify-center gap-2">
                    <button onclick="window.crOpenBandModal('${b.id}')"
                      class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-orange-50 hover:text-orange-600 text-gray-500 transition-colors flex items-center justify-center">
                      <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="window.crDeleteBand('${b.id}')"
                      class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors flex items-center justify-center">
                      <i class="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </td>
              </tr>`}).join('')}
            </tbody>
          </table>
          ${!bands.length ? `<div class="text-center py-12 text-gray-400">No bands configured yet. <button onclick="window.crOpenBandModal()" class="text-orange-500 font-semibold">Add your first band</button>.</div>` : ''}
        </div>
      </section>

      <!-- Eligibility Rules -->
      <section class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div class="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
            <i class="fas fa-shield-check text-purple-500 text-sm"></i>
          </div>
          <div>
            <h2 class="font-semibold text-gray-900">Eligibility Rules</h2>
            <p class="text-xs text-gray-400">Hard pass/fail criteria checked before score bands</p>
          </div>
        </div>
        <div class="divide-y divide-gray-50">
          ${rules.map(r => `
          <div class="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group">
            <button onclick="window.crToggleRule('${r.id}', ${!r.is_active})"
              class="mt-0.5 relative w-10 h-6 flex-shrink-0 rounded-full transition-colors duration-200 ${r.is_active ? 'bg-orange-500' : 'bg-gray-200'}">
              <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${r.is_active ? 'translate-x-4' : ''}"></span>
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="font-semibold text-gray-900 ${!r.is_active ? 'opacity-40' : ''}">${r.rule_label}</span>
                ${r.threshold_value ? `
                <span class="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                  ${r.operator === 'gte' ? '≥' : r.operator === 'lte' ? '≤' : '='} ${r.threshold_value}${r.rule_key.includes('pct') ? '%' : ''}
                </span>` : ''}
                <span class="text-xs font-bold px-2 py-0.5 rounded-lg ${r.fail_action==='decline' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'}">
                  Fail → ${r.fail_action.toUpperCase()}
                </span>
              </div>
              ${r.description ? `<p class="text-xs text-gray-400 mt-0.5">${r.description}</p>` : ''}
              ${r.decline_reason ? `<p class="text-xs text-gray-500 mt-1 italic">"${r.decline_reason}"</p>` : ''}
            </div>
            <button onclick="window.crOpenRuleEditor('${r.id}')"
              class="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-gray-100 hover:bg-orange-50 hover:text-orange-600 text-gray-400 transition-all flex items-center justify-center flex-shrink-0">
              <i class="fas fa-pen text-xs"></i>
            </button>
          </div>`).join('')}
        </div>
      </section>

      <!-- ── SIMULATE MODAL ───────────────────────────────────── -->
      <div id="cr-sim-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                <i class="fas fa-flask text-purple-500"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Credit Decision Simulator</h3>
                <p class="text-xs text-gray-400">Test what decision a borrower would get</p>
              </div>
            </div>
            <button onclick="window.crCloseSimulator()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Credit Score</label>
              <input id="sim-score" type="number" min="0" max="999" placeholder="e.g. 650"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-400 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Gross Monthly Income (R)</label>
              <input id="sim-income" type="number" min="0" placeholder="e.g. 12000"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-400 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Monthly Debt (R)</label>
              <input id="sim-debt" type="number" min="0" placeholder="e.g. 3000"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-400 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Age</label>
              <input id="sim-age" type="number" min="18" max="99" placeholder="e.g. 35"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-400 outline-none">
            </div>
            <div class="flex items-center gap-3 col-span-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input id="sim-employed" type="checkbox" checked class="w-4 h-4 rounded accent-purple-500">
                <span class="text-sm font-semibold text-gray-700">Employed</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input id="sim-judgment" type="checkbox" class="w-4 h-4 rounded accent-red-500">
                <span class="text-sm font-semibold text-gray-700">Has Judgments</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input id="sim-debtreview" type="checkbox" class="w-4 h-4 rounded accent-red-500">
                <span class="text-sm font-semibold text-gray-700">Under Debt Review</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input id="sim-firstloan" type="checkbox" class="w-4 h-4 rounded accent-blue-500">
                <span class="text-sm font-semibold text-gray-700">First Loan</span>
              </label>
            </div>
          </div>
          <button onclick="window.crRunSimulation()"
            class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors text-sm mb-4">
            Run Simulation
          </button>
          <div id="sim-result" class="hidden"></div>
        </div>
      </div>

      <!-- Band Modal -->
      <div id="bandModal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900" id="bandModalTitle">Add Score Band</h3>
            <button onclick="window.crCloseBandModal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>
          <form id="bandForm" onsubmit="window.crSaveBand(event)" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Band Label</label>
                <input name="label" required placeholder="e.g. Excellent"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Min Score</label>
                <input name="min_score" type="number" min="0" max="999" required placeholder="300"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Max Score</label>
                <input name="max_score" type="number" min="0" max="999" required placeholder="999"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Risk Level</label>
                <select name="risk_level" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Auto Decision</label>
                <select name="auto_decision" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="approve">Approve</option>
                  <option value="review">Manual Review</option>
                  <option value="decline">Decline</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Max Loan Amount (R)</label>
                <input name="max_loan_amount" type="number" min="0" step="500" placeholder="10000"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Interest Rate p.a. (%)</label>
                <input name="interest_rate_pa" type="number" min="0" max="100" step="0.5" placeholder="22.00"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Max Term (months)</label>
                <input name="max_term_months" type="number" min="1" max="84" placeholder="12"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Monthly Service Fee (R)</label>
                <input name="monthly_service_fee" type="number" min="0" step="5" placeholder="69"
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Band Colour</label>
                <div class="flex items-center gap-2">
                  <input name="color" type="color" value="#10b981"
                    class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5">
                  <span class="text-xs text-gray-400">Shown in UI badges</span>
                </div>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Decline Message (shown to applicant)</label>
                <input name="decline_reason" type="text" placeholder="e.g. Your credit score does not meet our minimum requirements."
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
                <p class="text-xs text-gray-400 mt-1">Only shown when auto_decision = Decline.</p>
              </div>
              <div class="col-span-2 border-t border-gray-100 pt-4">
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-star text-blue-500 text-xs"></i>
                  </div>
                  <span class="text-xs font-semibold text-gray-700 uppercase tracking-wide">First Loan Restrictions</span>
                </div>
                <div class="bg-blue-50 rounded-xl p-4">
                  <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Max Term — First Loan Only (months)
                  </label>
                  <input name="first_loan_max_term_months" type="number" min="1" max="24" placeholder="1"
                    class="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white">
                  <p class="text-xs text-gray-400 mt-1.5">Leave blank to allow full term. Set to 1 to restrict new borrowers to 1-month loans first.</p>
                </div>
              </div>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="window.crCloseBandModal()"
                class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">Cancel</button>
              <button type="submit" id="bandSaveBtn"
                class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">Save Band</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Rule Editor Modal -->
      <div id="ruleModal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900">Edit Rule</h3>
            <button onclick="window.crCloseRuleModal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>
          <form id="ruleForm" onsubmit="window.crSaveRule(event)" class="space-y-4">
            <input type="hidden" name="rule_id">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rule</label>
              <input name="rule_label" readonly class="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-500">
            </div>
            <div id="thresholdGroup">
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Threshold Value</label>
              <input name="threshold_value" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">If Fails</label>
              <select name="fail_action" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                <option value="decline">Decline immediately</option>
                <option value="review">Send to manual review</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Message shown to applicant</label>
              <textarea name="decline_reason" rows="2" placeholder="Reason displayed to the borrower..."
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-none"></textarea>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="window.crCloseRuleModal()"
                class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">Cancel</button>
              <button type="submit"
                class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">Save Rule</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Expose all actions
    window.crSwitchOrg      = switchOrg;
    window.crOpenBandModal  = openBandModal;
    window.crCloseBandModal = closeBandModal;
    window.crSaveBand       = saveBand;
    window.crDeleteBand     = deleteBand;
    window.crToggleBand     = toggleBand;
    window.crToggleRule     = toggleRule;
    window.crOpenRuleEditor = openRuleEditor;
    window.crCloseRuleModal = closeRuleModal;
    window.crSaveRule       = saveRule;
    window.crOpenSimulator  = openSimulator;
    window.crCloseSimulator = closeSimulator;
    window.crRunSimulation  = runSimulation;
}

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────
async function switchOrg(id) { currentOrgId = id; await render(); }

function openBandModal(bandId = null) {
    editingBandId = bandId;
    const modal = document.getElementById('bandModal');
    const form  = document.getElementById('bandForm');
    const title = document.getElementById('bandModalTitle');
    form.reset();
    if (bandId) {
        const band = bands.find(b => b.id === bandId);
        if (band) {
            title.textContent = 'Edit Score Band';
            Object.entries(band).forEach(([k, v]) => {
                const el = form.elements[k];
                if (el && v !== null && v !== undefined) el.value = v;
            });
        }
    } else { title.textContent = 'Add Score Band'; }
    modal.classList.remove('hidden');
}

function closeBandModal() {
    document.getElementById('bandModal').classList.add('hidden');
    editingBandId = null;
}

async function saveBand(e) {
    e.preventDefault();
    const btn  = document.getElementById('bandSaveBtn');
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.organization_id     = currentOrgId;
    data.min_score           = parseInt(data.min_score);
    data.max_score           = parseInt(data.max_score);
    data.max_loan_amount     = parseFloat(data.max_loan_amount || 0);
    data.interest_rate_pa    = parseFloat(data.interest_rate_pa || 0);
    data.max_term_months     = parseInt(data.max_term_months || 12);
    data.monthly_service_fee = parseFloat(data.monthly_service_fee || 0);
    data.first_loan_max_term_months = data.first_loan_max_term_months ? parseInt(data.first_loan_max_term_months) : null;

    // Overlap pre-check
    const wouldOverlap = bands.filter(b => b.id !== editingBandId)
        .some(b => data.min_score <= b.max_score && b.min_score <= data.max_score);
    if (wouldOverlap && !confirm('⚠️ This score range overlaps with an existing band. Save anyway?')) return;

    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
        const url    = editingBandId ? `/api/credit-bands/${editingBandId}` : '/api/credit-bands';
        const method = editingBandId ? 'PUT' : 'POST';
        const res    = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(await res.text());
        closeBandModal();
        await render();
    } catch (err) { alert('Error saving band: ' + err.message); }
    finally { btn.textContent = 'Save Band'; btn.disabled = false; }
}

async function deleteBand(id) {
    if (!confirm('Delete this score band? This cannot be undone.')) return;
    await fetch(`/api/credit-bands/${id}`, { method: 'DELETE' });
    await render();
}

async function toggleBand(id, active) {
    await fetch(`/api/credit-bands/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ is_active: active }) });
    await render();
}

async function toggleRule(id, active) {
    await fetch(`/api/eligibility-rules/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ is_active: active }) });
    await render();
}

function openRuleEditor(ruleId) {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    const modal = document.getElementById('ruleModal');
    const form  = document.getElementById('ruleForm');
    form.elements['rule_id'].value        = rule.id;
    form.elements['rule_label'].value     = rule.rule_label;
    form.elements['threshold_value'].value = rule.threshold_value || '';
    form.elements['fail_action'].value    = rule.fail_action;
    form.elements['decline_reason'].value = rule.decline_reason || '';
    document.getElementById('thresholdGroup').style.display =
        ['is_true','is_false'].includes(rule.operator) ? 'none' : 'block';
    modal.classList.remove('hidden');
}

function closeRuleModal() { document.getElementById('ruleModal').classList.add('hidden'); }

async function saveRule(e) {
    e.preventDefault();
    const form = e.target;
    const id   = form.elements['rule_id'].value;
    const data = {
        threshold_value: form.elements['threshold_value'].value,
        fail_action:     form.elements['fail_action'].value,
        decline_reason:  form.elements['decline_reason'].value
    };
    const res = await fetch(`/api/eligibility-rules/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) { alert('Save failed'); return; }
    closeRuleModal();
    await render();
}

// ─────────────────────────────────────────────
// SIMULATOR
// ─────────────────────────────────────────────
function openSimulator()  { document.getElementById('cr-sim-modal').classList.remove('hidden'); }
function closeSimulator() { document.getElementById('cr-sim-modal').classList.add('hidden'); }

async function runSimulation() {
    const score      = parseInt(document.getElementById('sim-score').value) || 0;
    const income     = parseFloat(document.getElementById('sim-income').value) || 0;
    const debt       = parseFloat(document.getElementById('sim-debt').value) || 0;
    const age        = parseInt(document.getElementById('sim-age').value) || 30;
    const employed   = document.getElementById('sim-employed').checked;
    const judgment   = document.getElementById('sim-judgment').checked;
    const debtReview = document.getElementById('sim-debtreview').checked;
    const firstLoan  = document.getElementById('sim-firstloan').checked;

    if (!score) { alert('Enter a credit score to simulate.'); return; }

    const dti = income > 0 ? Math.round((debt / income) * 100) : 999;

    // Run rules engine client-side using loaded rules + bands
    const failures = [];
    const activeRules = rules.filter(r => r.is_active);

    for (const rule of activeRules) {
        const k = rule.rule_key;
        let val;
        if (k === 'min_credit_score')    val = score;
        else if (k === 'min_age')        val = age;
        else if (k === 'max_dti_pct')    val = dti;
        else if (k === 'min_income')     val = income;
        else if (k === 'is_employed')    val = employed;
        else if (k === 'no_judgments')   val = !judgment;
        else if (k === 'not_under_debt_review') val = !debtReview;
        else continue;

        let passes;
        if (rule.operator === 'gte')     passes = val >= Number(rule.threshold_value);
        else if (rule.operator === 'lte') passes = val <= Number(rule.threshold_value);
        else if (rule.operator === 'is_true')  passes = val === true;
        else if (rule.operator === 'is_false') passes = val === false;
        else passes = true;

        if (!passes) failures.push({ label: rule.rule_label, action: rule.fail_action, reason: rule.decline_reason });
    }

    // Find matching band
    const activeBands = bands.filter(b => b.is_active).sort((a,b) => a.min_score - b.min_score);
    const matchedBand = activeBands.find(b => score >= b.min_score && score <= b.max_score);

    const hardDeclines = failures.filter(f => f.action === 'decline');
    const reviewFlags  = failures.filter(f => f.action === 'review');

    let decision, decisionColor, decisionBg, icon;
    if (hardDeclines.length) {
        decision = 'DECLINED'; decisionColor = '#ef4444'; decisionBg = '#fef2f2'; icon = 'cancel';
    } else if (reviewFlags.length || matchedBand?.auto_decision === 'review') {
        decision = 'MANUAL REVIEW'; decisionColor = '#f59e0b'; decisionBg = '#fffbeb'; icon = 'person_search';
    } else if (matchedBand?.auto_decision === 'decline') {
        decision = 'DECLINED'; decisionColor = '#ef4444'; decisionBg = '#fef2f2'; icon = 'cancel';
    } else if (matchedBand?.auto_decision === 'approve') {
        decision = 'APPROVED'; decisionColor = '#10b981'; decisionBg = '#f0fdf4'; icon = 'check_circle';
    } else {
        decision = 'NO MATCHING BAND'; decisionColor = '#6b7280'; decisionBg = '#f9fafb'; icon = 'help';
    }

    const effectiveTerm = firstLoan && matchedBand?.first_loan_max_term_months
        ? Math.min(matchedBand.max_term_months, matchedBand.first_loan_max_term_months)
        : matchedBand?.max_term_months;

    const resultEl = document.getElementById('sim-result');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="rounded-2xl p-4 border" style="background:${decisionBg};border-color:${decisionColor}40">
        <div class="flex items-center gap-3 mb-3">
          <span class="material-symbols-outlined text-3xl" style="color:${decisionColor}">${icon}</span>
          <div>
            <p class="text-xs font-bold uppercase tracking-widest" style="color:${decisionColor}">Decision</p>
            <p class="text-2xl font-black" style="color:${decisionColor}">${decision}</p>
          </div>
        </div>
        ${matchedBand ? `
        <div class="grid grid-cols-3 gap-3 mb-3">
          <div class="bg-white rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400 font-semibold">Band</p>
            <p class="font-bold text-gray-800 text-sm mt-0.5">${matchedBand.label}</p>
          </div>
          <div class="bg-white rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400 font-semibold">Max Loan</p>
            <p class="font-bold text-gray-800 text-sm mt-0.5">R ${Number(matchedBand.max_loan_amount).toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400 font-semibold">Max Term${firstLoan && matchedBand.first_loan_max_term_months ? ' (1st loan)' : ''}</p>
            <p class="font-bold text-gray-800 text-sm mt-0.5">${effectiveTerm} mo</p>
          </div>
        </div>` : '<p class="text-sm text-gray-500 mb-3">No band matched score ' + score + '. Check your band ranges.</p>'}
        ${failures.length ? `
        <div class="space-y-1">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Rule Failures</p>
          ${failures.map(f => `
          <div class="flex items-center gap-2 text-xs">
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${f.action==='decline'?'#ef4444':'#f59e0b'}"></span>
            <span class="font-semibold text-gray-700">${f.label}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${f.action==='decline'?'bg-red-100 text-red-600':'bg-yellow-100 text-yellow-700'}">${f.action.toUpperCase()}</span>
            ${f.reason ? `<span class="text-gray-400 italic">"${f.reason}"</span>` : ''}
          </div>`).join('')}
        </div>` : '<p class="text-xs text-green-600 font-semibold">✓ All eligibility rules passed</p>'}
        <div class="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs text-gray-500">
          <span>Score: <strong>${score}</strong></span>
          <span>DTI: <strong>${dti}%</strong></span>
          <span>Income: <strong>R ${income.toLocaleString()}</strong></span>
          <span>First loan: <strong>${firstLoan ? 'Yes' : 'No'}</strong></span>
        </div>
      </div>`;
}
