import{supabase as x}from"./supabaseClient-BXSct5lo.js";import{e as _,b as k,D as L}from"./theme-CYs9TE7o.js";const h=document.getElementById("app-shell");let v=null;const $="https://placehold.co/240x80/E7762E/ffffff?text=AlgoLend",y=(e="")=>e?e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):"";async function M(){const{data:{session:e}}=await x.auth.getSession();if(!e)return window.location.replace("/auth/login.html"),null;const a=["base_admin","admin","super_admin","owner"],t=(e.user?.app_metadata?.role||e.user?.user_metadata?.role||"borrower").toLowerCase();if(!a.includes(t))return await x.auth.signOut(),window.location.replace("/auth/login.html"),null;const{data:r}=await x.from("profiles").select("*").eq("id",e.user.id).maybeSingle(),s={id:e.user.id,email:e.user.email,full_name:r?.full_name||e.user?.user_metadata?.full_name||e.user.email,avatar_url:r?.avatar_url||null,...r||{}};v=s;const o=await _();return E(s,t,o),S(),B(),I(t,s.id),{profile:s,role:t}}function j(){return v}window.showToast=(e,a="success")=>{let t=document.getElementById("toast-container");t||(t=document.createElement("div"),t.id="toast-container",t.className="fixed bottom-8 right-8 z-[100] flex flex-col items-end pointer-events-none",document.body.appendChild(t));const n=document.createElement("div"),r=a==="success",s=r?"bg-green-600":"bg-red-600",o=r?"fa-check-circle":"fa-circle-exclamation";n.className=`${s} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 mb-3 pointer-events-auto animate-fade-in-up border border-white/10`,n.innerHTML=`
        <i class="fa-solid ${o} text-lg"></i>
        <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-widest opacity-70">${a}</span>
            <span class="text-xs font-bold uppercase tracking-tight">${e}</span>
        </div>
    `,t.appendChild(n),setTimeout(()=>{n.classList.add("opacity-0","translate-y-4"),setTimeout(()=>n.remove(),500)},4e3)};function E(e,a,t=null){if(!h)return;const n=e?.full_name||"Admin",r=n.split(" ").map(i=>i[0]).join("").slice(0,2).toUpperCase(),s=k(t)||L.company_name,o=(t?.company_logo_url||"").trim(),d=y(o||$),p=y(s||"Company"),u=d?`<img src="${d}" alt="${p}" class="h-10 w-auto object-contain max-w-[180px]">`:`<div class="flex items-center gap-3">
         <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style="background-color: var(--color-primary);">
           ${(s||"A").charAt(0)}
         </div>
         <span class="font-headline font-semibold text-base tracking-tight" style="color: var(--color-primary);">${p||"Admin"}</span>
       </div>`;h.innerHTML=`
    <!-- Sidebar -->
    <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] bg-surface-container-lowest border-r border-outline-variant/20 transition-transform duration-300 ease-in-out md:translate-x-0 -translate-x-full">

      <!-- Logo -->
      <div class="px-8 py-8 flex items-center min-h-[80px]">
        ${u}
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
        ${A(a)}
      </nav>

      <!-- Sign out -->
      <div class="p-4 border-t border-outline-variant/10">
        <button id="sign-out-btn" class="w-full flex items-center justify-center gap-2 px-4 py-3 text-error bg-error-container/30 rounded-xl hover:bg-error-container/50 transition-all text-xs font-semibold tracking-wide uppercase">
          <span class="material-symbols-outlined text-[18px]">logout</span>
          Sign Out
        </button>
        <p class="text-[10px] text-center mt-4 text-outline opacity-60">Powered by Mint Platforms</p>
      </div>
    </aside>

    <div id="sidebar-overlay" class="fixed inset-0 z-40 bg-black/20 overlay-transition overlay-hidden md:hidden"></div>

    <!-- Main -->
    <div class="flex flex-col flex-1 md:pl-[280px] min-h-screen bg-surface relative">

      <!-- Atmospheric blobs -->
      <div class="fixed top-0 right-0 -z-10 opacity-30 pointer-events-none">
        <div class="w-[600px] h-[600px] rounded-full blur-[120px]" style="background: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 70%);"></div>
      </div>
      <div class="fixed bottom-0 left-[280px] -z-10 opacity-20 pointer-events-none">
        <div class="w-[400px] h-[400px] rounded-full blur-[100px]" style="background: radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 25%, transparent), transparent 70%);"></div>
      </div>

      <!-- Top bar -->
      <header class="sticky top-0 z-30 h-16 flex items-center justify-between px-8 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/15">
        <div class="flex items-center gap-4">
          <button id="sidebar-toggle" class="md:hidden p-2 -ml-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <h1 id="page-title" class="hidden md:block text-lg font-headline font-semibold text-on-surface"></h1>
        </div>

        <div class="flex items-center gap-5">
          <!-- Notifications -->
          <div class="relative">
            <button id="notif-btn" class="relative p-2 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none">
              <span class="material-symbols-outlined">notifications</span>
              <span id="notif-badge" class="hidden absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white border-2 border-white"></span>
            </button>
            <div id="notif-dropdown" class="hidden absolute right-0 mt-3 w-80 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden z-50">
              <div class="px-5 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
                <h3 class="font-semibold text-on-surface text-sm">Notifications</h3>
                <button id="mark-all-read" class="text-[10px] font-semibold uppercase tracking-wide" style="color: var(--color-primary);">Mark all read</button>
              </div>
              <div id="notif-list" class="max-h-80 overflow-y-auto">
                <div class="p-6 text-center text-outline text-xs italic">Loading…</div>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="h-7 w-px bg-outline-variant/30"></div>

          <!-- Avatar -->
          <div class="flex items-center gap-3">
            <div class="text-right hidden sm:block">
              <p class="text-sm font-semibold text-on-surface leading-none">${n.split(" ")[0]}</p>
              <p class="text-[10px] uppercase tracking-wider text-outline mt-0.5">${a.replace("_"," ")}</p>
            </div>
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background-color: var(--color-primary);">${r}</div>
          </div>
        </div>
      </header>

      <main id="main-content" class="flex-1 p-8 relative z-10"></main>
    </div>
  `}function m(e,a,t){return`<li>
    <a href="${e}" class="nav-link flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface text-sm font-medium">
      <span class="material-symbols-outlined text-[22px] leading-none">${a}</span>
      <span>${t}</span>
    </a>
  </li>`}function g(e){return`<p class="px-4 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-outline">${e}</p>`}function A(e){const a=["base_admin","admin","super_admin"].includes(e),t=["admin","super_admin"].includes(e),n=e==="super_admin";return`
    <ul class="space-y-0.5">
      ${a?`
        ${g("Overview")}
        ${m("/admin/dashboard","dashboard","Dashboard")}
        <li>
          <button type="button" id="analytics-toggle" class="nav-link w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface text-sm font-medium">
            <span class="flex items-center gap-4">
              <span class="material-symbols-outlined text-[22px] leading-none">bar_chart</span>
              Analytics
            </span>
            <span class="material-symbols-outlined text-[16px] transition-transform duration-200" id="analytics-chevron">expand_more</span>
          </button>
          <ul id="analytics-submenu" class="nav-submenu ml-10 mt-0.5 space-y-0.5 border-l-2 border-outline-variant/30 pl-3">
            <li><a href="/admin/analytics.html" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Customer Analytics</a></li>
            <li><a href="/admin/financials.html" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Financials</a></li>
          </ul>
        </li>
        ${m("/admin/applications","assignment","Applications")}
        ${m("/admin/reminders","notifications_active","Reminders")}
      `:""}

      ${t?`
        ${g("Finance")}
        ${m("/admin/users","group","Users")}
        ${m("/admin/mandates","receipt_long","Mandates")}
        <li>
          <button type="button" id="payments-toggle" class="nav-link w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface text-sm font-medium">
            <span class="flex items-center gap-4">
              <span class="material-symbols-outlined text-[22px] leading-none">payments</span>
              Payments
            </span>
            <span class="material-symbols-outlined text-[16px] transition-transform duration-200" id="payments-chevron">expand_more</span>
          </button>
          <ul id="payments-submenu" class="nav-submenu ml-10 mt-0.5 space-y-0.5 border-l-2 border-outline-variant/30 pl-3">
            <li><a href="/admin/incoming-payments" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Incoming</a></li>
            <li><a href="/admin/outgoing-payments" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Outgoing</a></li>
          </ul>
        </li>
      `:""}

      ${t?`
        ${g("Tools")}
        ${m("/admin/products","inventory_2","Loan Products")}
        ${m("/admin/credit-rules","rule","Credit Rules")}
        ${m("/admin/loan-book","menu_book","Loan Book")}
        ${m("/admin/cash-ledger","account_balance_wallet","Cash Ledger")}
      `:""}

      ${t?`
        ${g("Compliance")}
        ${m("/admin/sacrra","verified_user","SACRRA")}
        ${m("/admin/sacrra-validator","rule_folder","Migration Validator")}
      `:""}

      ${n?`
        ${g("System")}
        ${m("/admin/settings","settings","Settings")}
      `:""}
    </ul>
  `}function S(){const e=document.getElementById("sign-out-btn");e&&e.addEventListener("click",d=>{d.preventDefault();try{x.auth.signOut()}catch{}try{sessionStorage.clear()}catch{}try{localStorage.clear()}catch{}window.location.replace("/auth/login.html")});const a=document.getElementById("sidebar-toggle"),t=document.getElementById("sidebar"),n=document.getElementById("sidebar-overlay");a&&t&&(a.addEventListener("click",()=>{t.classList.toggle("-translate-x-full"),n&&(n.classList.toggle("overlay-hidden"),n.classList.toggle("overlay-visible"))}),n?.addEventListener("click",()=>{t.classList.add("-translate-x-full"),n&&(n.classList.add("overlay-hidden"),n.classList.remove("overlay-visible"))}));const r=(d,p,u)=>{const i=document.getElementById(d),c=document.getElementById(p),l=document.getElementById(u);i&&c&&i.addEventListener("click",()=>{c.classList.toggle("expanded"),l&&l.classList.toggle("rotate-180")})};r("payments-toggle","payments-submenu","payments-chevron"),r("analytics-toggle","analytics-submenu","analytics-chevron");const s=document.getElementById("notif-btn"),o=document.getElementById("notif-dropdown");s&&o&&(s.addEventListener("click",d=>{d.stopPropagation(),o.classList.toggle("hidden")}),document.addEventListener("click",d=>{!s.contains(d.target)&&!o.contains(d.target)&&o.classList.add("hidden")}))}function B(){const e=window.location.pathname;document.querySelectorAll(".nav-link, .nav-sublink").forEach(a=>{if(a.tagName!=="A")return;const t=a.getAttribute("href");if(!t||!(e===t||e.startsWith(t+"/")||e.startsWith(t+".html")))return;if(a.classList.contains("nav-sublink")){a.classList.add("font-semibold","text-on-surface"),a.classList.remove("text-outline");const s=a.closest('ul[id$="-submenu"]');if(s){s.classList.add("expanded");const o=document.getElementById(s.id.replace("-submenu","-chevron"));o&&o.classList.add("rotate-180")}}else a.classList.remove("text-on-surface-variant","hover:bg-surface-variant/50","hover:text-on-surface"),a.classList.add("nav-link-active","text-white","shadow-md"),a.style.backgroundColor="var(--color-primary)",a.style.boxShadow="0 4px 14px -2px color-mix(in srgb, var(--color-primary) 40%, transparent)"})}async function I(e,a){const t=document.getElementById("notif-badge"),n=document.getElementById("notif-list"),r=document.getElementById("mark-all-read"),s=v?.branch_id||null,o=async()=>{const{data:u,error:i}=await x.from("admin_notifications").select("*");if(i){console.error("Notification Fetch Error:",i);return}const c=u.filter(l=>{let f=!1;e==="super_admin"?f=!0:e==="admin"?f=["admin","base_admin"].includes(l.target_role):e==="base_admin"&&(f=l.target_role==="base_admin");const b=l.branch_id===null||l.branch_id===s,w=!(l.read_by||[]).includes(a);return f&&b&&w}).sort((l,f)=>new Date(f.created_at)-new Date(l.created_at));d(c)},d=u=>{const i=u.length;if(i>0?(t.classList.remove("hidden"),t.textContent=i>9?"9+":i,t.className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white border-2 border-white animate-bounce"):t.classList.add("hidden"),i===0){n.innerHTML=`
            <div class="flex flex-col items-center justify-center p-10 text-center">
                <div class="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
                    <i class="fa-solid fa-check-double text-xl"></i>
                </div>
                <p class="text-xs font-bold text-gray-800 uppercase tracking-tighter">You're all caught up!</p>
            </div>`;return}n.innerHTML=u.map(c=>{const l=c.title.toLowerCase().includes("failed")||c.title.toLowerCase().includes("overdue");return`
                <div class="p-4 border-b border-gray-50 hover:bg-gray-50 transition-all relative group" data-id="${c.id}">
                    <div class="flex gap-4 pr-6">
                        <div class="shrink-0 w-10 h-10 rounded-xl ${l?"bg-red-50 text-red-600":"bg-blue-50 text-blue-600"} flex items-center justify-center shadow-sm">
                            <i class="fa-solid ${l?"fa-triangle-exclamation":"fa-bolt"} text-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <a href="${c.link||"#"}" class="block">
                                <div class="flex justify-between items-start mb-0.5">
                                    <p class="text-xs font-black text-gray-900 truncate pr-2 uppercase tracking-tight">${c.title}</p>
                                    <p class="text-[9px] font-bold text-gray-400 uppercase">${p(c.created_at)}</p>
                                </div>
                                <p class="text-[10px] text-gray-600 leading-relaxed line-clamp-2">${c.message}</p>
                            </a>
                        </div>
                    </div>
                    <button class="dismiss-notif absolute right-2 top-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            `}).join(""),n.querySelectorAll(".dismiss-notif").forEach(c=>{c.addEventListener("click",async l=>{const f=l.currentTarget.closest("[data-id]").dataset.id,{error:b}=await x.rpc("mark_notification_read_single",{p_notif_id:parseInt(f)});b||await o()})})},p=u=>{const i=Math.floor((new Date-new Date(u))/1e3);return i<60?"Just now":i<3600?`${Math.floor(i/60)}m ago`:i<86400?`${Math.floor(i/3600)}h ago`:`${Math.floor(i/86400)}d ago`};await o(),x.channel("admin_notif_channel").on("postgres_changes",{event:"INSERT",schema:"public",table:"admin_notifications"},()=>o()).subscribe(),r&&r.addEventListener("click",async()=>{const{error:u}=await x.rpc("mark_notifications_read",{p_target_role:e});u||await o()})}export{j as g,M as i};
