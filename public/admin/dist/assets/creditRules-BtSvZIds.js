import"./supabaseClient-BXSct5lo.js";/* empty css              *//* empty css               */import{i as C}from"./layout-Ci9LpN5w.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";import"./theme-CYs9TE7o.js";let h=[],w=null,d=[],k=[],v=null;document.addEventListener("DOMContentLoaded",async()=>{await C(),await L(),x()});async function L(){h=(await(await fetch("/api/organizations")).json()).data||[],h.length&&(w=h[0].id)}async function O(){if(!w)return;const s=await(await fetch(`/api/credit-rules/${w}`)).json();d=s.bands||[],k=s.rules||[]}function D(){const a=[];for(let s=0;s<d.length;s++)for(let l=s+1;l<d.length;l++){const t=d[s],e=d[l];t.min_score<=e.max_score&&e.min_score<=t.max_score&&a.push(`"${t.label}" (${t.min_score}–${t.max_score}) overlaps with "${e.label}" (${e.min_score}–${e.max_score})`)}return a}async function x(){await O();const a=document.getElementById("app-shell"),s=a.querySelector("main")||a,l=s.querySelector("#cr-content")||(()=>{const e=document.createElement("div");return e.id="cr-content",e.className="p-6 max-w-6xl mx-auto",s.appendChild(e),e})(),t=D();l.innerHTML=`
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Credit Rules</h1>
          <p class="text-sm text-gray-500 mt-1">Configure per-client score bands and eligibility criteria</p>
        </div>
        <div class="flex items-center gap-3">
          ${h.length>1?`
          <select id="orgSelector" onchange="window.crSwitchOrg(this.value)"
            class="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-orange-400 focus:outline-none">
            ${h.map(e=>`<option value="${e.id}" ${e.id===w?"selected":""}>${e.name}</option>`).join("")}
          </select>`:`<span class="text-sm font-semibold text-gray-700">${h[0]?.name||""}</span>`}
          <button onclick="window.crOpenSimulator()"
            class="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <i class="fas fa-flask text-xs"></i> Simulate
          </button>
        </div>
      </div>

      <!-- Overlap Warning -->
      ${t.length?`
      <div class="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <i class="fas fa-triangle-exclamation text-red-500 mt-0.5"></i>
        <div>
          <p class="text-sm font-bold text-red-700">Score Band Overlap Detected</p>
          <ul class="mt-1 space-y-0.5">
            ${t.map(e=>`<li class="text-xs text-red-600">• ${e}</li>`).join("")}
          </ul>
          <p class="text-xs text-red-500 mt-1">Overlapping bands may produce unpredictable decisions. Fix the score ranges.</p>
        </div>
      </div>`:""}

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
              ${d.map(e=>{const o=t.some(m=>m.includes(`"${e.label}"`));return`
              <tr class="hover:bg-gray-50 transition-colors ${o?"bg-red-50/40":""}">
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-2 font-semibold text-gray-800">
                    <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${e.color}"></span>
                    ${e.label}
                    ${o?'<i class="fas fa-triangle-exclamation text-red-400 text-xs"></i>':""}
                  </span>
                </td>
                <td class="px-6 py-4 text-gray-600 font-mono text-xs">${e.min_score} – ${e.max_score}</td>
                <td class="px-6 py-4">
                  <span class="px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
                    style="background:${e.color}20;color:${e.color}">${e.risk_level}</span>
                </td>
                <td class="px-6 py-4 text-right font-semibold text-gray-800">R ${Number(e.max_loan_amount).toLocaleString()}</td>
                <td class="px-6 py-4 text-right text-gray-600">${e.interest_rate_pa}%</td>
                <td class="px-6 py-4 text-right text-gray-600">${e.max_term_months} mo</td>
                <td class="px-6 py-4 text-center">
                  <span class="px-2 py-1 rounded-lg text-xs font-bold uppercase ${e.auto_decision==="approve"?"bg-green-50 text-green-700":e.auto_decision==="decline"?"bg-red-50 text-red-600":"bg-yellow-50 text-yellow-700"}">
                    ${e.auto_decision}
                  </span>
                </td>
                <td class="px-6 py-4 text-center">
                  ${e.first_loan_max_term_months?`<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                        <i class="fas fa-star text-xs"></i> ${e.first_loan_max_term_months} mo</span>`:'<span class="text-gray-300 text-xs">—</span>'}
                </td>
                <td class="px-6 py-4 text-xs text-gray-400 max-w-[160px] truncate" title="${e.decline_reason||""}">
                  ${e.decline_reason?`<span class="italic">"${e.decline_reason}"</span>`:'<span class="text-gray-200">—</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                  <button onclick="window.crToggleBand('${e.id}', ${!e.is_active})"
                    class="relative w-10 h-6 rounded-full transition-colors duration-200 ${e.is_active?"bg-orange-500":"bg-gray-200"}">
                    <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${e.is_active?"translate-x-4":""}"></span>
                  </button>
                </td>
                <td class="px-6 py-4 text-center">
                  <div class="flex items-center justify-center gap-2">
                    <button onclick="window.crOpenBandModal('${e.id}')"
                      class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-orange-50 hover:text-orange-600 text-gray-500 transition-colors flex items-center justify-center">
                      <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="window.crDeleteBand('${e.id}')"
                      class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors flex items-center justify-center">
                      <i class="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </td>
              </tr>`}).join("")}
            </tbody>
          </table>
          ${d.length?"":'<div class="text-center py-12 text-gray-400">No bands configured yet. <button onclick="window.crOpenBandModal()" class="text-orange-500 font-semibold">Add your first band</button>.</div>'}
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
          ${k.map(e=>`
          <div class="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group">
            <button onclick="window.crToggleRule('${e.id}', ${!e.is_active})"
              class="mt-0.5 relative w-10 h-6 flex-shrink-0 rounded-full transition-colors duration-200 ${e.is_active?"bg-orange-500":"bg-gray-200"}">
              <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${e.is_active?"translate-x-4":""}"></span>
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="font-semibold text-gray-900 ${e.is_active?"":"opacity-40"}">${e.rule_label}</span>
                ${e.threshold_value?`
                <span class="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                  ${e.operator==="gte"?"≥":e.operator==="lte"?"≤":"="} ${e.threshold_value}${e.rule_key.includes("pct")?"%":""}
                </span>`:""}
                <span class="text-xs font-bold px-2 py-0.5 rounded-lg ${e.fail_action==="decline"?"bg-red-50 text-red-600":"bg-yellow-50 text-yellow-700"}">
                  Fail → ${e.fail_action.toUpperCase()}
                </span>
              </div>
              ${e.description?`<p class="text-xs text-gray-400 mt-0.5">${e.description}</p>`:""}
              ${e.decline_reason?`<p class="text-xs text-gray-500 mt-1 italic">"${e.decline_reason}"</p>`:""}
            </div>
            <button onclick="window.crOpenRuleEditor('${e.id}')"
              class="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-gray-100 hover:bg-orange-50 hover:text-orange-600 text-gray-400 transition-all flex items-center justify-center flex-shrink-0">
              <i class="fas fa-pen text-xs"></i>
            </button>
          </div>`).join("")}
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
    `,window.crSwitchOrg=T,window.crOpenBandModal=F,window.crCloseBandModal=S,window.crSaveBand=A,window.crDeleteBand=N,window.crToggleBand=U,window.crToggleRule=P,window.crOpenRuleEditor=z,window.crCloseRuleModal=E,window.crSaveRule=H,window.crOpenSimulator=q,window.crCloseSimulator=J,window.crRunSimulation=G}async function T(a){w=a,await x()}function F(a=null){v=a;const s=document.getElementById("bandModal"),l=document.getElementById("bandForm"),t=document.getElementById("bandModalTitle");if(l.reset(),a){const e=d.find(o=>o.id===a);e&&(t.textContent="Edit Score Band",Object.entries(e).forEach(([o,m])=>{const c=l.elements[o];c&&m!==null&&m!==void 0&&(c.value=m)}))}else t.textContent="Add Score Band";s.classList.remove("hidden")}function S(){document.getElementById("bandModal").classList.add("hidden"),v=null}async function A(a){a.preventDefault();const s=document.getElementById("bandSaveBtn"),l=a.target,t=Object.fromEntries(new FormData(l));if(t.organization_id=w,t.min_score=parseInt(t.min_score),t.max_score=parseInt(t.max_score),t.max_loan_amount=parseFloat(t.max_loan_amount||0),t.interest_rate_pa=parseFloat(t.interest_rate_pa||0),t.max_term_months=parseInt(t.max_term_months||12),t.monthly_service_fee=parseFloat(t.monthly_service_fee||0),t.first_loan_max_term_months=t.first_loan_max_term_months?parseInt(t.first_loan_max_term_months):null,!(d.filter(o=>o.id!==v).some(o=>t.min_score<=o.max_score&&o.min_score<=t.max_score)&&!confirm("⚠️ This score range overlaps with an existing band. Save anyway?"))){s.textContent="Saving…",s.disabled=!0;try{const o=v?`/api/credit-bands/${v}`:"/api/credit-bands",c=await fetch(o,{method:v?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!c.ok)throw new Error(await c.text());S(),await x()}catch(o){alert("Error saving band: "+o.message)}finally{s.textContent="Save Band",s.disabled=!1}}}async function N(a){confirm("Delete this score band? This cannot be undone.")&&(await fetch(`/api/credit-bands/${a}`,{method:"DELETE"}),await x())}async function U(a,s){await fetch(`/api/credit-bands/${a}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:s})}),await x()}async function P(a,s){await fetch(`/api/eligibility-rules/${a}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:s})}),await x()}function z(a){const s=k.find(e=>e.id===a);if(!s)return;const l=document.getElementById("ruleModal"),t=document.getElementById("ruleForm");t.elements.rule_id.value=s.id,t.elements.rule_label.value=s.rule_label,t.elements.threshold_value.value=s.threshold_value||"",t.elements.fail_action.value=s.fail_action,t.elements.decline_reason.value=s.decline_reason||"",document.getElementById("thresholdGroup").style.display=["is_true","is_false"].includes(s.operator)?"none":"block",l.classList.remove("hidden")}function E(){document.getElementById("ruleModal").classList.add("hidden")}async function H(a){a.preventDefault();const s=a.target,l=s.elements.rule_id.value,t={threshold_value:s.elements.threshold_value.value,fail_action:s.elements.fail_action.value,decline_reason:s.elements.decline_reason.value};if(!(await fetch(`/api/eligibility-rules/${l}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)})).ok){alert("Save failed");return}E(),await x()}function q(){document.getElementById("cr-sim-modal").classList.remove("hidden")}function J(){document.getElementById("cr-sim-modal").classList.add("hidden")}async function G(){const a=parseInt(document.getElementById("sim-score").value)||0,s=parseFloat(document.getElementById("sim-income").value)||0,l=parseFloat(document.getElementById("sim-debt").value)||0,t=parseInt(document.getElementById("sim-age").value)||30,e=document.getElementById("sim-employed").checked,o=document.getElementById("sim-judgment").checked,m=document.getElementById("sim-debtreview").checked,c=document.getElementById("sim-firstloan").checked;if(!a){alert("Enter a credit score to simulate.");return}const $=s>0?Math.round(l/s*100):999,_=[],M=k.filter(n=>n.is_active);for(const n of M){const u=n.rule_key;let i;if(u==="min_credit_score")i=a;else if(u==="min_age")i=t;else if(u==="max_dti_pct")i=$;else if(u==="min_income")i=s;else if(u==="is_employed")i=e;else if(u==="no_judgments")i=!o;else if(u==="not_under_debt_review")i=!m;else continue;let y;n.operator==="gte"?y=i>=Number(n.threshold_value):n.operator==="lte"?y=i<=Number(n.threshold_value):n.operator==="is_true"?y=i===!0:n.operator==="is_false"?y=i===!1:y=!0,y||_.push({label:n.rule_label,action:n.fail_action,reason:n.decline_reason})}const r=d.filter(n=>n.is_active).sort((n,u)=>n.min_score-u.min_score).find(n=>a>=n.min_score&&a<=n.max_score),R=_.filter(n=>n.action==="decline"),j=_.filter(n=>n.action==="review");let g,p,b,f;R.length?(g="DECLINED",p="#ef4444",b="#fef2f2",f="cancel"):j.length||r?.auto_decision==="review"?(g="MANUAL REVIEW",p="#f59e0b",b="#fffbeb",f="person_search"):r?.auto_decision==="decline"?(g="DECLINED",p="#ef4444",b="#fef2f2",f="cancel"):r?.auto_decision==="approve"?(g="APPROVED",p="#10b981",b="#f0fdf4",f="check_circle"):(g="NO MATCHING BAND",p="#6b7280",b="#f9fafb",f="help");const I=c&&r?.first_loan_max_term_months?Math.min(r.max_term_months,r.first_loan_max_term_months):r?.max_term_months,B=document.getElementById("sim-result");B.classList.remove("hidden"),B.innerHTML=`
      <div class="rounded-2xl p-4 border" style="background:${b};border-color:${p}40">
        <div class="flex items-center gap-3 mb-3">
          <span class="material-symbols-outlined text-3xl" style="color:${p}">${f}</span>
          <div>
            <p class="text-xs font-bold uppercase tracking-widest" style="color:${p}">Decision</p>
            <p class="text-2xl font-black" style="color:${p}">${g}</p>
          </div>
        </div>
        ${r?`
        <div class="grid grid-cols-3 gap-3 mb-3">
          <div class="bg-white rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400 font-semibold">Band</p>
            <p class="font-bold text-gray-800 text-sm mt-0.5">${r.label}</p>
          </div>
          <div class="bg-white rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400 font-semibold">Max Loan</p>
            <p class="font-bold text-gray-800 text-sm mt-0.5">R ${Number(r.max_loan_amount).toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400 font-semibold">Max Term${c&&r.first_loan_max_term_months?" (1st loan)":""}</p>
            <p class="font-bold text-gray-800 text-sm mt-0.5">${I} mo</p>
          </div>
        </div>`:'<p class="text-sm text-gray-500 mb-3">No band matched score '+a+". Check your band ranges.</p>"}
        ${_.length?`
        <div class="space-y-1">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Rule Failures</p>
          ${_.map(n=>`
          <div class="flex items-center gap-2 text-xs">
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${n.action==="decline"?"#ef4444":"#f59e0b"}"></span>
            <span class="font-semibold text-gray-700">${n.label}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${n.action==="decline"?"bg-red-100 text-red-600":"bg-yellow-100 text-yellow-700"}">${n.action.toUpperCase()}</span>
            ${n.reason?`<span class="text-gray-400 italic">"${n.reason}"</span>`:""}
          </div>`).join("")}
        </div>`:'<p class="text-xs text-green-600 font-semibold">✓ All eligibility rules passed</p>'}
        <div class="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs text-gray-500">
          <span>Score: <strong>${a}</strong></span>
          <span>DTI: <strong>${$}%</strong></span>
          <span>Income: <strong>R ${s.toLocaleString()}</strong></span>
          <span>First loan: <strong>${c?"Yes":"No"}</strong></span>
        </div>
      </div>`}
