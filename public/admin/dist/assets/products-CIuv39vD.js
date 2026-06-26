import"./supabaseClient-BXSct5lo.js";/* empty css              *//* empty css               */import{i as p}from"./layout-l3iKOyZ9.js";import{a as s}from"./apiFetch-CEHFyE_J.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";import"./theme-CYs9TE7o.js";let o=[],a=null;const c=e=>`R ${Number(e||0).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})}`,u=e=>`${(Number(e||0)*100).toFixed(1)}%`;document.addEventListener("DOMContentLoaded",async()=>{await p(),await r(),l()});async function r(){try{o=(await(await s("/api/admin/products")).json()).data||[]}catch(e){console.error("Failed to load products:",e),o=[]}}async function x(e){const n=a?"PUT":"POST",t=a?`/api/admin/products/${a}`:"/api/admin/products",i=await s(t,{method:n,headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!i.ok){const d=await i.json();throw new Error(d.error||"Save failed")}return i.json()}async function b(e){const n=await s(`/api/admin/products/${e}`,{method:"DELETE"});if(!n.ok){const t=await n.json();throw new Error(t.error||"Delete failed")}}async function v(e,n){await s(`/api/admin/products/${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:!n})}),await r(),l()}function l(){const e=document.getElementById("main-content");if(!e)return;const n=o.length?o.map(t=>g(t)).join(""):`<div class="col-span-full flex flex-col items-center justify-center py-24 text-outline/60">
             <span class="material-symbols-outlined text-5xl mb-4">inventory_2</span>
             <p class="text-sm font-medium">No loan products yet</p>
             <p class="text-xs mt-1">Click "New Product" to create your first.</p>
           </div>`;e.innerHTML=`
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
          ${n}
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
    `,document.getElementById("btn-new")?.addEventListener("click",()=>f(null)),document.getElementById("modal-close")?.addEventListener("click",m),document.getElementById("modal-cancel")?.addEventListener("click",m),document.getElementById("product-form")?.addEventListener("submit",y),document.querySelectorAll("[data-edit]").forEach(t=>t.addEventListener("click",()=>f(o.find(i=>i.id===t.dataset.edit)))),document.querySelectorAll("[data-delete]").forEach(t=>t.addEventListener("click",()=>h(t.dataset.delete))),document.querySelectorAll("[data-toggle]").forEach(t=>t.addEventListener("click",()=>{const i=o.find(d=>d.id===t.dataset.toggle);i&&v(i.id,i.is_active)}))}function g(e){const n=e.is_active!==!1,t=n?'<span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span><span class="text-green-600 text-[11px] font-semibold">Active</span>':'<span class="w-2 h-2 rounded-full bg-gray-300 inline-block"></span><span class="text-outline text-[11px] font-semibold">Inactive</span>';return`
      <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm hover:shadow-md transition-shadow flex flex-col">
        <div class="px-5 pt-5 pb-4 flex-1">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 class="font-headline font-bold text-on-surface text-base leading-tight">${e.name}</h3>
              ${e.description?`<p class="text-xs text-outline mt-1 leading-relaxed">${e.description}</p>`:""}
            </div>
            <div class="flex items-center gap-1.5 shrink-0 mt-0.5">${t}</div>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Amount Range</p>
              <p class="text-xs font-semibold text-on-surface">${c(e.min_amount)} – ${c(e.max_amount)}</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Term Range</p>
              <p class="text-xs font-semibold text-on-surface">${e.min_term_months}–${e.max_term_months} months</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Monthly Interest</p>
              <p class="text-xs font-semibold text-on-surface">${u(e.interest_rate_monthly)}/mo</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Initiation Fee</p>
              <p class="text-xs font-semibold text-on-surface">${u(e.initiation_fee_rate)}</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Admin Fee</p>
              <p class="text-xs font-semibold text-on-surface">${c(e.monthly_admin_fee)}/mo</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-outline mb-0.5">Credit Life</p>
              <p class="text-xs font-semibold text-on-surface">${e.has_credit_life?"Sanlam (R4.50/R1k)":"None"}</p>
            </div>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-outline-variant/10 flex items-center gap-2">
          <button data-toggle="${e.id}" class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${n?"bg-gray-100 text-outline hover:bg-gray-200":"bg-green-50 text-green-700 hover:bg-green-100"}">
            ${n?"Deactivate":"Activate"}
          </button>
          <button data-edit="${e.id}" class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant/70 transition-colors">
            Edit
          </button>
          <button data-delete="${e.id}" class="py-1.5 px-3 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
            <span class="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>`}function f(e){a=e?.id||null,document.getElementById("modal-title").textContent=e?"Edit Loan Product":"New Loan Product",document.getElementById("f-name").value=e?.name||"",document.getElementById("f-min-amount").value=e?.min_amount||"",document.getElementById("f-max-amount").value=e?.max_amount||"",document.getElementById("f-min-term").value=e?.min_term_months||"",document.getElementById("f-max-term").value=e?.max_term_months||"",document.getElementById("f-interest").value=e?(Number(e.interest_rate_monthly)*100).toFixed(1):"",document.getElementById("f-initiation").value=e?(Number(e.initiation_fee_rate)*100).toFixed(1):"",document.getElementById("f-admin-fee").value=e?.monthly_admin_fee||"",document.getElementById("f-credit-life").checked=!!e?.has_credit_life,document.getElementById("f-description").value=e?.description||"",document.getElementById("form-error").classList.add("hidden"),document.getElementById("modal").classList.remove("hidden"),document.getElementById("f-name").focus()}function m(){document.getElementById("modal").classList.add("hidden"),a=null}async function y(e){e.preventDefault();const n=document.getElementById("form-error"),t=document.getElementById("modal-save");n.classList.add("hidden"),t.disabled=!0,t.textContent="Saving…";try{const i={name:document.getElementById("f-name").value.trim(),min_amount:Number(document.getElementById("f-min-amount").value),max_amount:Number(document.getElementById("f-max-amount").value),min_term_months:Number(document.getElementById("f-min-term").value),max_term_months:Number(document.getElementById("f-max-term").value),interest_rate_monthly:Number(document.getElementById("f-interest").value)/100,initiation_fee_rate:Number(document.getElementById("f-initiation").value)/100,monthly_admin_fee:Number(document.getElementById("f-admin-fee").value),has_credit_life:document.getElementById("f-credit-life").checked,description:document.getElementById("f-description").value.trim()||null};await x(i),m(),await r(),l(),window.showToast(a?"Product updated":"Product created","success")}catch(i){n.textContent=i.message,n.classList.remove("hidden")}finally{t.disabled=!1,t.textContent="Save Product"}}async function h(e){if(confirm("Delete this loan product? This cannot be undone."))try{await b(e),await r(),l(),window.showToast("Product deleted","success")}catch(n){window.showToast(n.message,"error")}}
