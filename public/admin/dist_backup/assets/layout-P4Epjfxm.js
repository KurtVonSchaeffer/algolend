import{s as p}from"./supabaseClient-Ki9k9WNi.js";const I="#EA580C",N="Your Company",T=[{title:`A Leap to
Financial Freedom`,text:"We offer credit of up to R200,000, with repayment terms extending up to a maximum of 36 months."},{title:"Flexible Repayments",text:"Repayment terms are tailored to each client's cash flow, risk profile, and agreed-upon conditions."},{title:"Save on Interest",text:"Our interest rates and fees are highly competitive, ensuring great value for our clients."}],g={id:"global",company_name:N,primary_color:"#E7762E",secondary_color:"#F97316",tertiary_color:"#FACC15",theme_mode:"light",company_logo_url:null,auth_background_url:null,auth_background_flip:!1,auth_overlay_color:I,auth_overlay_enabled:!0,carousel_slides:T.map(t=>({...t}))},F=5*60*1e3,B="/api/system-settings";let b=null,C=0,y=null;const w=(t,r=0,e=255)=>Math.max(r,Math.min(e,t)),h=t=>{if(!t)return{r:0,g:0,b:0};let r=t.replace("#","");r.length===3&&(r=r.split("").map(a=>a+a).join(""));const e=parseInt(r,16);return Number.isNaN(e)?{r:0,g:0,b:0}:{r:e>>16&255,g:e>>8&255,b:e&255}},P=(t,r,e)=>{const a=o=>o.toString(16).padStart(2,"0");return`#${a(w(Math.round(t)))}${a(w(Math.round(r)))}${a(w(Math.round(e)))}`.toUpperCase()},x=(t,r=0)=>{const{r:e,g:a,b:o}=h(t),n=s=>r>=0?s+(255-s)*r:s*(1+r);return P(n(e),n(a),n(o))},D=t=>{const{r,g:e,b:a}=h(t);return(.299*r+.587*e+.114*a)/255>.5?"#0F172A":"#FFFFFF"},L=(t,r=!1)=>{if(typeof t=="boolean")return t;if(typeof t=="string"){const e=t.toLowerCase();if(e==="true")return!0;if(e==="false")return!1}if(typeof t=="number"){if(t===1)return!0;if(t===0)return!1}return r},$=t=>(typeof t=="string"?t.trim():"")||g.company_name,M=(t,r)=>{if(!t)return r;let e=`${t}`.trim().replace("#","");return e.length===3&&(e=e.split("").map(a=>a+a).join("")),/^[0-9A-Fa-f]{6}$/.test(e)?`#${e.toUpperCase()}`:r},R=(t={},r={})=>{const e=typeof t.title=="string"?t.title.trim():"",a=typeof t.text=="string"?t.text.trim():"";return{title:e||r.title,text:a||r.text}},j=t=>{const r=Array.isArray(t)?t:[];return T.map((e,a)=>R(r[a]||{},e))},z=(t={})=>({...g,...t,company_name:$(t?.company_name),auth_background_flip:L(t?.auth_background_flip,g.auth_background_flip),auth_overlay_color:M(t?.auth_overlay_color,g.auth_overlay_color),auth_overlay_enabled:L(t?.auth_overlay_enabled,g.auth_overlay_enabled),carousel_slides:j(t.carousel_slides)}),O=t=>{if(typeof document>"u")return;const r=$(t),e=document.title||"";if(!e)return;const a=e.replace(/zwane/gi,r);a!==e&&(document.title=a)},v=(t,r)=>{const e=z(t),a=document.documentElement,o=h(e.primary_color),n=h(e.secondary_color),s=h(e.tertiary_color);a.style.setProperty("--color-primary",e.primary_color),a.style.setProperty("--color-primary-rgb",`${o.r} ${o.g} ${o.b}`),a.style.setProperty("--color-primary-hover",x(e.primary_color,-.15)),a.style.setProperty("--color-primary-soft",x(e.primary_color,.2)),a.style.setProperty("--color-primary-strong",x(e.primary_color,-.35)),a.style.setProperty("--color-secondary",e.secondary_color),a.style.setProperty("--color-secondary-rgb",`${n.r} ${n.g} ${n.b}`),a.style.setProperty("--color-secondary-soft",x(e.secondary_color,.15)),a.style.setProperty("--color-tertiary",e.tertiary_color),a.style.setProperty("--color-tertiary-rgb",`${s.r} ${s.g} ${s.b}`),a.style.setProperty("--gradient-brand",`linear-gradient(120deg, ${e.primary_color}, ${e.secondary_color}, ${e.tertiary_color})`),a.style.setProperty("--color-primary-contrast",D(e.primary_color)),a.style.setProperty("--auth-overlay-color",e.auth_overlay_color),a.style.setProperty("--auth-overlay-enabled",e.auth_overlay_enabled?"1":"0");const c=e.theme_mode==="dark"?"dark":"light";return a.setAttribute("data-theme",c),O(e.company_name),r&&(b=e,C=Date.now()),e},U=async t=>!t&&b&&Date.now()-C<F?b:y||(y=(async()=>{try{const r=await fetch(B,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error(`Failed to load theme (${r.status})`);const e=await r.json(),a=e?.data||e;return v(a,!0)}catch(r){console.error("Theme load failed:",r);const e=b||{...g};return v(e,!0)}finally{y=null}})(),y),H=()=>b,q=t=>$(t?.company_name);async function Y(t={}){const r=t.force===!0;return U(r)}function G(t={}){return v({...b||g,...t},!1)}function V(t){return v(t,!0)}const W=(t={})=>Y(t),rt=(t={})=>G(t),ot=t=>V(t),nt=()=>H(),J=t=>q(t),k=document.getElementById("app-shell");let E=null;const K="https://static.wixstatic.com/media/f82622_cde1fbd5680141c5b0fccca81fb92ad6~mv2.png",A=(t="")=>t?t.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):"";async function st(){const{data:{session:t}}=await p.auth.getSession();if(!t)return window.location.replace("/auth/login.html"),null;const[r,e,a]=await Promise.all([p.rpc("get_my_role"),p.rpc("get_my_profile").single(),p.rpc("is_role_or_higher",{p_min_role:"base_admin"})]),{data:o,error:n}=r,{data:s,error:c}=e,{data:u,error:l}=a;if(n||c||l||!u)return await p.auth.signOut(),window.location.replace("/auth/login.html"),null;E=s;const i=await W();return Q(s,o,i),Z(),tt(),et(o,s.id),{profile:s,role:o}}function it(){return E}window.showToast=(t,r="success")=>{let e=document.getElementById("toast-container");e||(e=document.createElement("div"),e.id="toast-container",e.className="fixed bottom-8 right-8 z-[100] flex flex-col items-end pointer-events-none",document.body.appendChild(e));const a=document.createElement("div"),o=r==="success",n=o?"bg-green-600":"bg-red-600",s=o?"fa-check-circle":"fa-circle-exclamation";a.className=`${n} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 mb-3 pointer-events-auto animate-fade-in-up border border-white/10`,a.innerHTML=`
        <i class="fa-solid ${s} text-lg"></i>
        <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-widest opacity-70">${r}</span>
            <span class="text-xs font-bold uppercase tracking-tight">${t}</span>
        </div>
    `,e.appendChild(a),setTimeout(()=>{a.classList.add("opacity-0","translate-y-4"),setTimeout(()=>a.remove(),500)},4e3)};function Q(t,r,e=null){if(!k)return;const a=t?.full_name||"Admin",n=(e?.primary_color||"var(--color-primary)").replace("#","")||"ea580c",s=t?.avatar_url||`https://ui-avatars.com/api/?name=${encodeURIComponent(a.replace(" ","+"))}&background=${n}&color=fff`,c=J(e),u=(e?.company_logo_url||"").trim(),l=A(u||K),i=A(c),d=l?`<img src="${l}" alt="${i}" class="h-12 w-auto object-contain max-w-[200px]">`:`<div class="text-xl font-bold text-gray-800">${i}</div>`;k.innerHTML=`
    <div id="sidebar" class="fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-gray-100 border-r border-gray-200 text-gray-600 transition-transform duration-300 ease-in-out md:translate-x-0 -translate-x-full shadow-xl">
      <div class="flex items-center justify-center h-24 px-6 border-b border-gray-200 bg-gray-100">
        ${d}
      </div>

      <nav class="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        <div class="mb-6">
          <p class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Overview</p>
          ${X(r)}
        </div>
      </nav>

      <div class="p-4 border-t border-gray-200 bg-gray-200/50">
        <button id="sign-out-btn" class="sign-out-btn flex items-center w-full p-3 rounded-xl border border-transparent transition-all group hover:bg-brand-accent hover:shadow-lg">
           <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs text-gray-700 font-bold mr-3 shadow-sm">
              ${a.charAt(0)}
           </div>
           <div class="flex-1 text-left">
            <p class="text-sm font-bold text-gray-800 transition-colors group-hover:text-white">Sign Out</p>
            <p class="text-[10px] text-gray-500 truncate w-32 transition-colors group-hover:text-white/80">${t.email||""}</p>
           </div>
          <i class="fa-solid fa-arrow-right-from-bracket text-gray-400 transition-colors group-hover:text-white"></i>
        </button>
      </div>
    </div>
    
    <div id="sidebar-overlay" class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden hidden"></div>

    <div class="flex flex-col flex-1 md:pl-72 min-h-screen relative overflow-hidden bg-gray-50 font-sans">
      
      <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div class="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[120px]" style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);"></div>
        <div class="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full blur-[100px]" style="background-color: color-mix(in srgb, var(--color-secondary) 10%, transparent);"></div>
      </div>

      <header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div class="flex items-center justify-between h-20 px-8">
          <button id="sidebar-toggle" class="text-gray-500 hover:text-brand-accent md:hidden p-2 -ml-2 transition-colors">
            <i class="fa-solid fa-bars text-xl"></i>
          </button>
          
          <div class="hidden md:block">
            <h1 id="page-title" class="text-xl font-bold text-gray-900">Dashboard</h1>
            <p class="text-xs text-gray-500 mt-0.5">Welcome back, <span class="font-medium text-brand-accent">${a}</span></p>
          </div>

          <div class="flex items-center gap-6">
             <div class="relative">
                 <button id="notif-btn" class="relative p-2 text-gray-400 hover:text-brand-accent transition-colors focus:outline-none">
                    <i class="fa-solid fa-bell text-xl"></i>
                    <span id="notif-badge" class="hidden absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                 </button>
                 
                 <div id="notif-dropdown" class="hidden absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 origin-top-right transition-all">
                    <div class="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50">
                        <h3 class="font-bold text-gray-800 text-sm">Notifications</h3>
                        <button id="mark-all-read" class="text-[10px] text-brand-accent font-medium hover:text-brand-accent-hover uppercase tracking-wide">Mark all read</button>
                    </div>
                    <div id="notif-list" class="max-h-80 overflow-y-auto bg-white">
                        <div class="p-6 text-center text-gray-400 text-xs italic">Loading...</div>
                    </div>
                 </div>
             </div>

             <div class="h-8 w-[1px] bg-gray-200 mx-2"></div>
             <img src="${s}" class="w-10 h-10 rounded-full border-2 shadow-sm" style="border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);" alt="Profile">
          </div>
        </div>
      </header>
      
      <main id="main-content" class="flex-1 p-8 relative z-10"></main>
    </div>
  `}function X(t){const r=t==="base_admin"||t==="admin"||t==="super_admin",e=t==="admin"||t==="super_admin",a=t==="super_admin",o="nav-link flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 mb-1 group",n="text-gray-600 hover:bg-white hover:text-brand-accent hover:shadow-sm";return`
    <ul class="space-y-1">
      ${r?`
        <li>
            <a href="/admin/dashboard" class="${o} ${n}">
                <i class="fa-solid fa-chart-line w-5 h-5 mr-3 sidebar-nav-icon transition-colors"></i>Dashboard
            </a>
        </li>
        <li>
          <button type="button" id="analytics-toggle" class="w-full flex items-center justify-between ${o} ${n}">
            <span class="flex items-center"><i class="fa-solid fa-chart-pie w-5 h-5 mr-3 sidebar-nav-icon transition-colors"></i>Analytics</span>
            <i class="fa-solid fa-chevron-down text-xs transition-transform duration-200"></i>
          </button>
          <ul id="analytics-submenu" class="hidden pl-4 space-y-1 mt-1">
            <li><a href="/admin/analytics.html" class="block px-4 py-2 text-sm text-gray-500 hover:text-brand-accent border-l-2 border-gray-200 ml-4 hover:border-tertiary transition-all">Customer Analytics</a></li>
            <li><a href="/admin/financials.html" class="block px-4 py-2 text-sm text-gray-500 hover:text-brand-accent border-l-2 border-gray-200 ml-4 hover:border-tertiary transition-all">Financials</a></li>
          </ul>
        </li>
        <li>
            <a href="/admin/applications" class="${o} ${n}">
                <i class="fa-solid fa-file-signature w-5 h-5 mr-3 sidebar-nav-icon transition-colors"></i>Applications
            </a>
        </li>
      `:""}
      
      ${e?`
        <p class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mt-8 mb-3">Finance</p>
        <li><a href="/admin/users" class="${o} ${n}"><i class="fa-solid fa-users w-5 h-5 mr-3 sidebar-nav-icon transition-colors"></i>Customers</a></li>
        <li>
          <button type="button" id="payments-toggle" class="w-full flex items-center justify-between ${o} ${n}">
            <span class="flex items-center"><i class="fa-solid fa-coins w-5 h-5 mr-3 sidebar-nav-icon transition-colors"></i>Payments</span>
            <i class="fa-solid fa-chevron-down text-xs transition-transform duration-200"></i>
          </button>
          <ul id="payments-submenu" class="hidden pl-4 space-y-1 mt-1">
            <li><a href="/admin/incoming-payments" class="block px-4 py-2 text-sm text-gray-500 hover:text-brand-accent border-l-2 border-gray-200 ml-4 hover:border-tertiary transition-all">Incoming</a></li>
            <li><a href="/admin/outgoing-payments" class="block px-4 py-2 text-sm text-gray-500 hover:text-brand-accent border-l-2 border-gray-200 ml-4 hover:border-tertiary transition-all">Outgoing</a></li>
          </ul>
        </li>
      `:""}
      
      ${e?`
        <p class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mt-8 mb-3">Compliance</p>
        <li><a href="/admin/sacrra" class="${o} ${n}"><i class="fa-solid fa-file-contract w-5 h-5 mr-3 sidebar-nav-icon transition-colors"></i>SACRRA</a></li>
      `:""}
      
      ${a?`
        <p class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mt-8 mb-3">System</p>
        <li><a href="/admin/settings" class="${o} ${n}"><i class="fa-solid fa-sliders w-5 h-5 mr-3 sidebar-nav-icon transition-colors"></i>Config</a></li>
      `:""}
    </ul>
  `}function Z(){const t=document.getElementById("sign-out-btn");t&&t.addEventListener("click",c=>{c.preventDefault();try{p.auth.signOut()}catch{}try{sessionStorage.clear()}catch{}try{localStorage.clear()}catch{}window.location.replace("/auth/login.html")});const r=document.getElementById("sidebar-toggle"),e=document.getElementById("sidebar"),a=document.getElementById("sidebar-overlay");r&&e&&(r.addEventListener("click",()=>{e.classList.toggle("-translate-x-full"),a?.classList.toggle("hidden")}),a?.addEventListener("click",()=>{e.classList.add("-translate-x-full"),a.classList.add("hidden")}));const o=(c,u)=>{const l=document.getElementById(c),i=document.getElementById(u);l&&i&&l.addEventListener("click",()=>{i.classList.toggle("hidden"),l.querySelector(".fa-chevron-down").classList.toggle("rotate-180")})};o("payments-toggle","payments-submenu"),o("analytics-toggle","analytics-submenu");const n=document.getElementById("notif-btn"),s=document.getElementById("notif-dropdown");n&&s&&(n.addEventListener("click",c=>{c.stopPropagation(),s.classList.toggle("hidden")}),document.addEventListener("click",c=>{!n.contains(c.target)&&!s.contains(c.target)&&s.classList.add("hidden")}))}function tt(){const t=window.location.pathname;document.querySelectorAll("a").forEach(e=>{if(e.getAttribute("href")===t)if(e.classList.remove("text-gray-600","hover:bg-white","hover:text-brand-accent"),e.parentElement.parentElement.id==="payments-submenu"||e.parentElement.parentElement.id==="analytics-submenu")e.classList.add("text-brand-accent","font-bold","border-brand-accent","bg-white"),e.classList.remove("text-gray-500","border-gray-200"),e.parentElement.parentElement.classList.remove("hidden");else{e.classList.add("bg-brand-accent","text-white","shadow-md"),e.style.boxShadow="0 15px 35px -20px var(--color-shadow)";const a=e.querySelector("i");a&&(a.classList.remove("sidebar-nav-icon"),a.classList.add("text-white"))}})}async function et(t,r){const e=document.getElementById("notif-badge"),a=document.getElementById("notif-list"),o=document.getElementById("mark-all-read"),n=E?.branch_id||null,s=async()=>{const{data:l,error:i}=await p.from("admin_notifications").select("*");if(i){console.error("Notification Fetch Error:",i);return}const d=l.filter(m=>{let f=!1;t==="super_admin"?f=!0:t==="admin"?f=["admin","base_admin"].includes(m.target_role):t==="base_admin"&&(f=m.target_role==="base_admin");const _=m.branch_id===null||m.branch_id===n,S=!(m.read_by||[]).includes(r);return f&&_&&S}).sort((m,f)=>new Date(f.created_at)-new Date(m.created_at));c(d)},c=l=>{const i=l.length;if(i>0?(e.classList.remove("hidden"),e.textContent=i>9?"9+":i,e.className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white border-2 border-white animate-bounce"):e.classList.add("hidden"),i===0){a.innerHTML=`
            <div class="flex flex-col items-center justify-center p-10 text-center">
                <div class="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
                    <i class="fa-solid fa-check-double text-xl"></i>
                </div>
                <p class="text-xs font-bold text-gray-800 uppercase tracking-tighter">You're all caught up!</p>
            </div>`;return}a.innerHTML=l.map(d=>{const m=d.title.toLowerCase().includes("failed")||d.title.toLowerCase().includes("overdue");return`
                <div class="p-4 border-b border-gray-50 hover:bg-gray-50 transition-all relative group" data-id="${d.id}">
                    <div class="flex gap-4 pr-6">
                        <div class="shrink-0 w-10 h-10 rounded-xl ${m?"bg-red-50 text-red-600":"bg-blue-50 text-blue-600"} flex items-center justify-center shadow-sm">
                            <i class="fa-solid ${m?"fa-triangle-exclamation":"fa-bolt"} text-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <a href="${d.link||"#"}" class="block">
                                <div class="flex justify-between items-start mb-0.5">
                                    <p class="text-xs font-black text-gray-900 truncate pr-2 uppercase tracking-tight">${d.title}</p>
                                    <p class="text-[9px] font-bold text-gray-400 uppercase">${u(d.created_at)}</p>
                                </div>
                                <p class="text-[10px] text-gray-600 leading-relaxed line-clamp-2">${d.message}</p>
                            </a>
                        </div>
                    </div>
                    <button class="dismiss-notif absolute right-2 top-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            `}).join(""),a.querySelectorAll(".dismiss-notif").forEach(d=>{d.addEventListener("click",async m=>{const f=m.currentTarget.closest("[data-id]").dataset.id,{error:_}=await p.rpc("mark_notification_read_single",{p_notif_id:parseInt(f)});_||await s()})})},u=l=>{const i=Math.floor((new Date-new Date(l))/1e3);return i<60?"Just now":i<3600?`${Math.floor(i/60)}m ago`:i<86400?`${Math.floor(i/3600)}h ago`:`${Math.floor(i/86400)}d ago`};await s(),p.channel("admin_notif_channel").on("postgres_changes",{event:"INSERT",schema:"public",table:"admin_notifications"},()=>s()).subscribe(),o&&o.addEventListener("click",async()=>{const{error:l}=await p.rpc("mark_notifications_read",{p_target_role:t});l||await s()})}export{g as D,nt as a,rt as b,J as c,W as e,it as g,st as i,ot as p};
