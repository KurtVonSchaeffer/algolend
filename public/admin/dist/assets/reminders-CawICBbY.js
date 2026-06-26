import{supabase as u}from"./supabaseClient-BXSct5lo.js";/* empty css              *//* empty css               */import{i as f}from"./layout-Ci9LpN5w.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";import"./theme-CYs9TE7o.js";const g={STARTED:"Started — not submitted",BUREAU_CHECKING:"Bureau check in progress",BUREAU_OK:"Offer ready — not viewed",BUREAU_REFER:"Referred — awaiting action",OFFERED:"Offer not accepted",OFFER_ACCEPTED:"Contract not signed",CONTRACT_SIGN:"Contract signed — not finalised"},m={STARTED:"bg-slate-100 text-slate-700",BUREAU_CHECKING:"bg-blue-100 text-blue-700",BUREAU_OK:"bg-green-100 text-green-700",BUREAU_REFER:"bg-yellow-100 text-yellow-700",OFFERED:"bg-purple-100 text-purple-700",OFFER_ACCEPTED:"bg-orange-100 text-orange-700",CONTRACT_SIGN:"bg-red-100 text-red-700"};let o=[],l=24,i=new Set;async function d(){const{data:{session:t}}=await u.auth.getSession();return t?.access_token||""}async function x(){const t=await d(),e=await fetch(`/api/admin/stalled-applications?hours=${l}`,{headers:{Authorization:`Bearer ${t}`}});if(!e.ok)throw new Error(await e.text());return e.json()}async function b(t){const e=await d();return(await fetch("/api/admin/send-reminder",{method:"POST",headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/json"},body:JSON.stringify({applicationId:t})})).json()}function p(t){if(t<24)return`${t}h ago`;const e=Math.floor(t/24);return e===1?"1 day ago":`${e} days ago`}function h(t){return`R ${Number(t||0).toLocaleString("en-ZA",{minimumFractionDigits:0})}`}function y(t){const e=m[t.status]||"bg-gray-100 text-gray-700",s=g[t.status]||t.status,n=t.hours_stalled>=168?"text-red-600 font-semibold":t.hours_stalled>=48?"text-orange-600":"text-slate-500",a=`btn-${t.id}`;return`
    <div class="card-surface rounded-2xl p-4 flex flex-col gap-3" data-app-id="${t.id}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-on-surface truncate">${t.client_name}</p>
          <p class="text-sm text-on-surface-variant">${t.phone||"No phone on record"}</p>
        </div>
        <span class="text-xs font-medium px-2 py-1 rounded-full ${e} shrink-0">${s}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="${n}">Stalled ${p(t.hours_stalled)}</span>
        <span class="text-on-surface-variant">${h(t.amount)}</span>
      </div>
      <button id="${a}" data-id="${t.id}" ${t.phone?"":"disabled"}
        class="send-btn w-full py-2.5 rounded-xl text-sm font-semibold transition-all
               ${t.phone?"bg-secondary text-white hover:opacity-90 active:scale-95":"bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50"}">
        ${t.phone?"Send Reminder":"No phone number"}
      </button>
    </div>`}function v(){return`
    <div class="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-center">
      <span class="material-symbols-outlined text-5xl text-on-surface-variant">check_circle</span>
      <p class="text-lg font-semibold text-on-surface">All clear!</p>
      <p class="text-sm text-on-surface-variant">No applications have been stalled for more than ${l} hours.</p>
    </div>`}async function r(){const t=document.getElementById("reminders-grid"),e=document.getElementById("stall-count"),s=document.getElementById("send-all-btn");if(t){t.innerHTML='<div class="col-span-full flex justify-center py-16"><span class="material-symbols-outlined animate-spin text-3xl text-secondary">progress_activity</span></div>';try{o=await x();const n=o.filter(a=>a.phone);e.textContent=o.length,s.disabled=n.length===0,s.textContent=n.length>0?`Send All Reminders (${n.length})`:"No contactable apps",t.innerHTML=o.length?o.map(y).join(""):v(),t.querySelectorAll(".send-btn[data-id]").forEach(a=>{a.addEventListener("click",()=>c(a.dataset.id))})}catch(n){t.innerHTML=`<div class="col-span-full text-center py-12 text-red-500">Failed to load: ${n.message}</div>`}}}async function c(t){if(i.has(t))return;i.add(t);const e=document.querySelector(`[data-id="${t}"].send-btn`),s=e?.textContent;e&&(e.textContent="Sending…",e.disabled=!0);try{const n=await b(t);e&&(e.textContent=n.sent?"✓ Sent!":`✗ ${n.error||"Failed"}`,e.classList.toggle("bg-green-500",!!n.sent),e.classList.toggle("bg-red-400",!n.sent),e.classList.remove("bg-secondary"))}catch{e&&(e.textContent="✗ Error",e.classList.replace("bg-secondary","bg-red-400"))}finally{i.delete(t),setTimeout(()=>{e&&(e.textContent=s,e.disabled=!1,e.classList.add("bg-secondary"),e.classList.remove("bg-green-500","bg-red-400"))},3e3)}}async function E(){const t=document.getElementById("send-all-btn"),e=o.filter(n=>n.phone&&!i.has(n.id));if(!e.length)return;t.disabled=!0,t.textContent=`Sending 0 / ${e.length}…`;let s=0;for(const n of e)await c(n.id),s++,t.textContent=`Sending ${s} / ${e.length}…`;t.textContent=`✓ All sent (${e.length})`,setTimeout(()=>r(),2e3)}async function w(){await f();const t=document.getElementById("main-content");t&&(t.innerHTML=`
    <div class="px-4 py-6 max-w-2xl mx-auto space-y-6">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-on-surface">Application Reminders</h1>
        <p class="text-sm text-on-surface-variant mt-1">Clients who started but haven't completed their loan application.</p>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex rounded-xl overflow-hidden border border-outline-variant text-sm font-medium">
          ${[24,48,168].map(e=>`
            <button data-hours="${e}" class="filter-btn px-4 py-2 transition-colors ${e===l?"bg-secondary text-white":"text-on-surface-variant hover:bg-surface-variant"}">
              ${e===24?"24h+":e===48?"48h+":"7d+"}
            </button>`).join("")}
        </div>
        <span class="text-sm text-on-surface-variant">Stalled for more than</span>
        <div class="ml-auto">
          <span id="stall-count" class="text-2xl font-bold text-on-surface">—</span>
          <span class="text-sm text-on-surface-variant ml-1">stalled</span>
        </div>
      </div>

      <!-- Send All -->
      <button id="send-all-btn" disabled
        class="w-full py-3 rounded-2xl font-semibold text-sm bg-secondary text-white opacity-60 transition-all hover:opacity-100 disabled:cursor-not-allowed">
        Loading…
      </button>

      <!-- Grid -->
      <div id="reminders-grid" class="grid grid-cols-1 gap-4"></div>

    </div>`,t.querySelectorAll(".filter-btn").forEach(e=>{e.addEventListener("click",()=>{l=Number(e.dataset.hours),t.querySelectorAll(".filter-btn").forEach(s=>{s.classList.toggle("bg-secondary",s===e),s.classList.toggle("text-white",s===e),s.classList.toggle("text-on-surface-variant",s!==e)}),r()})}),document.getElementById("send-all-btn").addEventListener("click",E),r())}w();
