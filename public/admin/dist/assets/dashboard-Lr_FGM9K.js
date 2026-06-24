import{supabase as L}from"./supabaseClient-DdIec1HK.js";/* empty css              *//* empty css               */import{i as $,g as H}from"./layout-Nmoyu__-.js";import{f as y,a as F}from"./utils-CZwHw4kl.js";import{f as W,a as Y,b as U,c as q,d as K,e as G}from"./dataService-gd72TqA3.js";import"https://esm.sh/@supabase/supabase-js@2";import"./theme-CYs9TE7o.js";let D=!1;async function V(){if(!D){D=!0;try{const{data:{session:e},error:o}=await L.auth.getSession();if(o||!e){console.log("🔒 Admin session invalid - redirecting to login"),window.location.replace("/auth/login.html");return}const n=["base_admin","admin","super_admin","owner"],r=(e.user?.app_metadata?.role||e.user?.user_metadata?.role||"").toLowerCase();let t=n.includes(r);if(!t){const{data:a,error:s}=await L.rpc("is_role_or_higher",{p_min_role:"base_admin"});!s&&a&&(t=!0)}if(!t){console.log("🔒 Not an admin - access denied. Role:",r),await L.auth.signOut(),window.location.replace("/auth/login.html");return}console.log("✅ Admin session validated")}catch(e){console.error("Admin session guard error:",e),window.location.replace("/auth/login.html")}finally{D=!1}}}V();class X{constructor(){this.isOpen=!1,this.currentExportType=null,this.userId=null}init(o){this.userId=o,this.createModal()}createModal(){document.body.insertAdjacentHTML("beforeend",`
      <div id="export-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center" style="display: none;">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-download text-white text-lg"></i>
              <h2 class="text-xl font-bold text-white">Export Data</h2>
            </div>
            <button id="export-modal-close" class="text-white hover:text-blue-100 transition">
              <i class="fa-solid fa-times text-xl"></i>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6">
            <!-- Format Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold text-gray-700 mb-3">Format</label>
              <div class="flex gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="export-format" value="csv" checked class="w-4 h-4">
                  <span class="text-sm text-gray-700">CSV</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="export-format" value="json" class="w-4 h-4">
                  <span class="text-sm text-gray-700">JSON</span>
                </label>
              </div>
            </div>

            <!-- Date Range -->
            <div class="mb-6">
              <label class="block text-sm font-semibold text-gray-700 mb-3">Date Range</label>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input type="date" id="export-start-date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <div>
                  <label class="block text-xs text-gray-600 mb-1">End Date</label>
                  <input type="date" id="export-end-date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">Leave empty for all records</p>
            </div>

            <!-- Export Info -->
            <div id="export-info" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 hidden">
              <p class="text-sm text-blue-700">
                <i class="fa-solid fa-info-circle mr-2"></i>
                <span id="export-info-text"></span>
              </p>
            </div>

            <!-- Status Message -->
            <div id="export-status" class="hidden mb-4 p-3 rounded-lg text-sm"></div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-200">
            <button id="export-modal-cancel" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium text-sm">
              Cancel
            </button>
            <button id="export-modal-submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm flex items-center gap-2">
              <i class="fa-solid fa-download"></i>
              Export
            </button>
          </div>
        </div>
      </div>
    `),this.attachEventListeners()}attachEventListeners(){document.getElementById("export-modal");const o=document.getElementById("export-modal-close"),n=document.getElementById("export-modal-cancel"),r=document.getElementById("export-modal-submit");o.addEventListener("click",()=>this.close()),n.addEventListener("click",()=>this.close()),r.addEventListener("click",()=>this.performExport());const t=new Date,a=new Date(t.getTime()-30*24*60*60*1e3);document.getElementById("export-start-date").value=a.toISOString().split("T")[0],document.getElementById("export-end-date").value=t.toISOString().split("T")[0]}open(o,n){this.currentExportType=o;const r=document.getElementById("export-modal");r.style.display="flex",this.isOpen=!0;const t=document.getElementById("export-info-text");t.textContent=`Exporting ${n}. Your file will download automatically.`,document.getElementById("export-info").classList.remove("hidden")}close(){const o=document.getElementById("export-modal");o.style.display="none",this.isOpen=!1,this.currentExportType=null,document.getElementById("export-status").classList.add("hidden")}async performExport(){if(!this.currentExportType)return;const o=document.querySelector('input[name="export-format"]:checked').value,n=document.getElementById("export-start-date").value,r=document.getElementById("export-end-date").value,t=document.getElementById("export-modal-submit"),a=document.getElementById("export-status");t.disabled=!0,t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';try{const s=await fetch(`/api/export/${this.currentExportType}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start_date:n||null,end_date:r||null,format:o,userId:this.userId})});if(!s.ok){const f=await s.json();throw new Error(f.error||"Export failed")}const u=s.headers.get("content-disposition")?.split('filename="')[1]?.split('"')[0]||`export-${this.currentExportType}.${o==="json"?"json":"csv"}`,l=await s.blob(),p=window.URL.createObjectURL(l),d=document.createElement("a");d.href=p,d.download=u,document.body.appendChild(d),d.click(),window.URL.revokeObjectURL(p),document.body.removeChild(d),a.className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm",a.innerHTML=`<i class="fa-solid fa-check-circle mr-2"></i>Export successful! File: ${u}`,a.classList.remove("hidden"),setTimeout(()=>this.close(),2e3)}catch(s){a.className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm",a.innerHTML=`<i class="fa-solid fa-exclamation-circle mr-2"></i>${s.message}`,a.classList.remove("hidden")}finally{t.disabled=!1,t.innerHTML='<i class="fa-solid fa-download"></i> Export'}}}window.exportManager=new X;const B=window.exportManager,J={enabled:!0,easing:"easeinout",speed:900,animateGradually:{enabled:!0,delay:120},dynamicAnimation:{enabled:!0,speed:400}};function b(e){return e.chart||(e.chart={}),e.chart.animations={...J,...e.chart.animations||{}},e}const Z=()=>new Promise((e,o)=>{if(window.ApexCharts)return e();const n=document.createElement("script");n.src="https://cdn.jsdelivr.net/npm/apexcharts",n.onload=e,n.onerror=o,document.head.appendChild(n)}),j="admin-dashboard-analytics-style",h=()=>{const e=getComputedStyle(document.documentElement),o=(e.getPropertyValue("--color-primary")||"#0ea5e9").trim()||"#0ea5e9",n=(e.getPropertyValue("--color-secondary")||"#f97316").trim()||"#f97316";return{primary:o,secondary:n}};async function Q(){try{const e=await fetch("/api/suresystems/activation-status");if(!e.ok)throw new Error(`SureSystems status fetch failed (${e.status})`);return await e.json()}catch(e){return console.warn("SureSystems activation status unavailable:",e.message||e),null}}document.addEventListener("DOMContentLoaded",async()=>{try{await Z()}catch(i){console.error("ApexCharts failed to load:",i);const m=document.getElementById("main-content");m&&(m.innerHTML='<div class="p-8 text-center text-red-600 font-semibold">Charts failed to load. Check your connection and refresh.</div>');return}if(!await $())return;const o=H(),n=document.getElementById("main-content");if(!document.getElementById(j)){const i=document.createElement("style");i.id=j,i.innerHTML=`
      @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
      @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } }
      .analytics-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.25s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; }
      .analytics-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: var(--color-primary); transform: translateY(-2px); }
      .analytics-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--color-primary, #0ea5e9), var(--color-secondary, #f97316)); opacity: 0; transition: opacity 0.25s; }
      .analytics-card:hover::before { opacity: 1; }
      .kpi-card { background: linear-gradient(135deg, var(--color-primary, #0ea5e9) 0%, var(--color-secondary, #f97316) 100%); border-radius: 12px; padding: 1.5rem; color: #fff; position: relative; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.12); transition: transform 0.25s ease, box-shadow 0.25s ease; }
      .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
      .kpi-card::after { content: ''; position: absolute; top: -50%; right: -50%; width: 200%; height: 200%; background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%); animation: shimmer 3s infinite; }
      .kpi-icon { width: 48px; height: 48px; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 1rem; }
      .kpi-value { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1; margin-bottom: 0.5rem; }
      .kpi-label { font-size: 0.875rem; font-weight: 600; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; }
      .kpi-trend { position: absolute; top: 1.5rem; right: 1.5rem; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; background: rgba(255,255,255,0.2); border-radius: 20px; backdrop-filter: blur(8px); }
      .section-header { border-bottom: 2px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.5rem; }
      .section-title { font-size: 1.125rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
      .section-subtitle { font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
      .tab-group { display: inline-flex; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 2px; gap: 2px; }
      .tab-button { padding: 0.5rem 1rem; font-size: 0.8125rem; font-weight: 600; color: #64748b; border-radius: 6px; transition: all 0.2s; cursor: pointer; border: none; background: transparent; }
      .tab-button:hover { color: var(--color-primary, #0ea5e9); background: #ffffff; }
      .tab-button.active { background: #ffffff; color: var(--color-primary, #0ea5e9); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .chart-wrapper { min-height: 350px; width: 100%; position: relative; }
      .status-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse-dot 2s ease-in-out infinite; }
      .fade-in { animation: slideInUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards; opacity: 0; }
      .delay-100 { animation-delay: 0.1s; } .delay-200 { animation-delay: 0.2s; } .delay-300 { animation-delay: 0.3s; } .delay-400 { animation-delay: 0.4s; }
    `,document.head.appendChild(i)}let r={text:"Operational",color:"#10b981"},t,a,s,c,u,l,p=null;try{[t,a,s,c,u,l,p]=await Promise.all([W().catch(()=>({financials:{},portfolioStatus:[]})),Y().catch(()=>({data:[]})),U().catch(()=>({data:[]})),q().catch(()=>({data:{}})),K().catch(()=>({data:null})),G().catch(()=>({data:[]})),Q()])}catch(i){console.error("System Fetch Error:",i),r={text:"System Error",color:"#ef4444",dot:"bg-red-500"}}const d=t?.financials||{},f=a?.data||[],T=s?.data||[],O=l?.data||[],M=c?.data||{},g=u?.data||ce(f,T);h();const v=(()=>{if(!p?.configured)return{text:"SureSystems: Not Configured",color:"#f59e0b",dot:"bg-amber-500"};const i=Number(p?.recent?.failed||0),m=Number(p?.recent?.success||0),R=p?.recent?.lastAttemptAt,z=R?(Date.now()-new Date(R).getTime())/(1e3*60*60*24):999;return i>0&&m===0&&z<=7?{text:"SureSystems: Activation Errors",color:"#ef4444",dot:"bg-red-500"}:i>0&&m===0&&z>7?{text:"SureSystems: Connected",color:"#10b981",dot:"bg-emerald-500"}:{text:m>0?`SureSystems: ${m} mandates activated`:"SureSystems: Connected",color:"#10b981",dot:"bg-emerald-500"}})(),A=t?.financials?.pending_apps||0,P=new Date().toLocaleDateString("en-ZA",{weekday:"long",month:"long",day:"numeric",year:"numeric"});n.innerHTML=`
    <div class="max-w-[1600px] mx-auto p-10 space-y-10">

      <!-- Welcome Header -->
      <section class="flex flex-col md:flex-row md:items-end justify-between gap-6 fade-in">
        <div>
          <h2 class="font-headline text-3xl font-bold text-on-surface mb-1">Welcome back, ${o?.full_name?.split(" ")[0]||"Admin"}</h2>
          <p class="text-secondary flex items-center gap-2 text-sm">
            Your portfolio overview for <span class="font-semibold" style="color:var(--color-primary)">${P}</span>
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full border border-outline-variant/30 text-xs font-semibold">
            <span class="w-2 h-2 rounded-full animate-pulse" style="background:${r.color}"></span>
            <span style="color:${r.color}">${r.text}</span>
          </div>
          <div class="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full border border-outline-variant/30 text-xs font-semibold">
            <span class="w-2 h-2 rounded-full" style="background:${v.color}"></span>
            <span style="color:${v.color}">${v.text}</span>
          </div>
          <button id="btn-export-dashboard" class="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/30 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
            <span class="material-symbols-outlined text-[14px]">download</span> Export Dashboard
          </button>
        </div>
      </section>

      <style>
        @keyframes bannerSlideDown {
          from { opacity:0; transform:translateY(-18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes borderPulse {
          0%,100% { box-shadow: -4px 0 0 var(--color-primary), 0 0 0 0 color-mix(in srgb,var(--color-primary) 0%,transparent); }
          50%      { box-shadow: -4px 0 0 var(--color-primary), 0 0 24px 4px color-mix(in srgb,var(--color-primary) 35%,transparent); }
        }
        @keyframes iconRing {
          0%,100% { transform:scale(1); opacity:1; }
          40%     { transform:scale(1.22); opacity:.85; }
        }
        @keyframes dotBlink {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:.4; transform:scale(.7); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .action-banner {
          animation: bannerSlideDown .5s cubic-bezier(.22,1,.36,1) both,
                     borderPulse 2.8s ease-in-out 1s infinite;
          position:relative; overflow:hidden;
        }
        /* Shimmer runs BEHIND content via z-index — never covers text */
        .action-banner::after {
          content:''; pointer-events:none;
          position:absolute; top:0; left:0; width:40%; height:100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          z-index: 0;
          animation: shimmer 2s ease-in-out 0.6s 2;
        }
        /* All direct children sit above the shimmer */
        .action-banner > * { position:relative; z-index:1; }
        .banner-icon-ring {
          animation: iconRing 2.2s ease-in-out 0.8s infinite;
          transform-origin:center;
        }
        .banner-dot {
          animation: dotBlink 1.4s ease-in-out infinite;
        }
        .banner-cta {
          transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease, opacity .2s;
        }
        .banner-cta:hover {
          transform: translateY(-2px) scale(1.04);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 45%, transparent);
          opacity:.92;
        }
        .banner-cta:active { transform: scale(.97); transition-duration:.1s; }
      </style>

      <!-- Action Banner — top of dashboard, always visible -->
      ${A>0?`
      <section class="action-banner glass-card rounded-2xl border-l-4 flex items-center justify-between gap-4 p-5"
               style="border-color:var(--color-primary); background:color-mix(in srgb,var(--color-primary) 5%,white);">
        <div class="flex items-center gap-4 min-w-0">
          <!-- Animated icon -->
          <div class="relative flex-shrink-0">
            <div class="p-3 rounded-full banner-icon-ring" style="background:color-mix(in srgb,var(--color-primary) 14%,transparent)">
              <span class="material-symbols-outlined text-[22px]" style="color:var(--color-primary)">notification_important</span>
            </div>
            <!-- Live dot -->
            <span class="banner-dot absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                  style="background:var(--color-primary)"></span>
          </div>
          <!-- Text -->
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h5 class="font-bold text-on-surface">
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-black mr-1"
                      style="background:var(--color-primary)">${A}</span>
                application${A>1?"s":""} pending review
              </h5>
            </div>
            <p class="text-secondary text-sm mt-0.5 truncate">${v.text}. Complete setup to automate disbursements.</p>
          </div>
        </div>
        <!-- CTA -->
        <a href="/admin/applications?filter=pending"
           class="banner-cta flex-shrink-0 flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white"
           style="background:var(--color-primary)">
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          Review Now
        </a>
      </section>`:""}

      <!-- KPI Cards -->
      <section id="cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 fade-in delay-100"></section>

      <!-- Charts Row -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in delay-200">
        <div class="lg:col-span-2 glass-card p-8 rounded-2xl">
          <div class="flex items-center justify-between pb-4 mb-6 border-b border-outline-variant/10">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:var(--color-primary-container,#ede9fe)">
                <span class="material-symbols-outlined text-[18px]" style="color:var(--color-primary)">swap_horiz</span>
              </div>
              <div>
                <h4 class="font-headline font-bold text-on-surface">Money In vs Money Out</h4>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">How much we've lent out vs how much has been paid back</p>
              </div>
            </div>
            <div id="tabs-velocity" class="tab-group"></div>
          </div>
          <div id="velocityChart" class="chart-wrapper"></div>
        </div>

        <div class="glass-card p-8 rounded-2xl">
          <div class="pb-4 mb-6 border-b border-outline-variant/10 flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
              <span class="material-symbols-outlined text-[18px] text-blue-600">donut_large</span>
            </div>
            <div>
              <h4 class="font-headline font-bold text-on-surface">Where Loans Stand</h4>
              <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Current status of every loan in the portfolio</p>
            </div>
          </div>
          <div id="donutChart" class="chart-wrapper" style="min-height:320px;"></div>
        </div>
      </section>

      <!-- Analytics Row -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in delay-300">
        <div class="glass-card p-8 rounded-2xl">
          <div class="flex items-center justify-between pb-4 mb-6 border-b border-outline-variant/10">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50">
                <span class="material-symbols-outlined text-[18px] text-green-600">calendar_month</span>
              </div>
              <div>
                <h4 class="font-headline font-bold text-on-surface">Repayment by Month</h4>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Green = paying well · Red = at risk</p>
              </div>
            </div>
            <div id="tabs-vintage" class="tab-group"></div>
          </div>
          <div id="vintageChart" class="chart-wrapper"></div>
        </div>

        <div class="glass-card p-8 rounded-2xl">
          <div class="pb-4 mb-6 border-b border-outline-variant/10 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50">
                <span class="material-symbols-outlined text-[18px] text-orange-500">bubble_chart</span>
              </div>
              <div>
                <h4 class="font-headline font-bold text-on-surface">Loan Risk Overview</h4>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Each bubble = one loan · Red = defaulted</p>
              </div>
            </div>
            <div class="flex items-center gap-3 text-[11px] font-semibold">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span>Paid</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:var(--color-primary)"></span>Active</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span>Default</span>
            </div>
          </div>
          <div id="riskChart" class="chart-wrapper"></div>
        </div>
      </section>

      <!-- Funnel -->
      <section class="glass-card p-8 rounded-2xl fade-in delay-400">
        <div class="flex items-center justify-between pb-4 mb-6 border-b border-outline-variant/10">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50">
              <span class="material-symbols-outlined text-[18px] text-purple-600">filter_alt</span>
            </div>
            <div>
              <h4 class="font-headline font-bold text-on-surface">Application Pipeline</h4>
              <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">How many applicants make it through each step</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold text-on-surface font-headline">${g.funnel?.STARTED||0}</div>
            <div class="text-[11px] uppercase tracking-widest text-outline font-semibold">Total Started</div>
          </div>
        </div>
        <div id="funnelChart" class="chart-wrapper" style="min-height:300px;"></div>
      </section>

      <!-- Historical Trends -->
      <section class="fade-in delay-400">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-headline text-xl font-bold text-on-surface">How We're Trending</h3>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Performance over time</p>
          </div>
          <div id="tabs-trends" class="tab-group"></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="lg:col-span-2 glass-card p-8 rounded-2xl">
            <div class="pb-4 mb-6 border-b border-outline-variant/10 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50">
                <span class="material-symbols-outlined text-[18px] text-indigo-600">stacked_bar_chart</span>
              </div>
              <div>
                <h4 class="font-headline font-bold text-on-surface mb-0.5">Book Growth Over Time</h4>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">How the loan book has grown month by month</p>
              </div>
            </div>
            <div id="comboChart" class="chart-wrapper"></div>
          </div>
          <div class="glass-card p-8 rounded-2xl">
            <div class="pb-4 mb-6 border-b border-outline-variant/10 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50">
                <span class="material-symbols-outlined text-[18px] text-teal-600">speed</span>
              </div>
              <div>
                <h4 class="font-headline font-bold text-on-surface mb-0.5">Portfolio Health Score</h4>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">How healthy the book is right now</p>
              </div>
            </div>
            <div id="radialChart" class="chart-wrapper" style="min-height:320px;"></div>
          </div>
          <div class="glass-card p-8 rounded-2xl">
            <div class="pb-4 mb-6 border-b border-outline-variant/10 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50">
                <span class="material-symbols-outlined text-[18px] text-amber-600">trending_up</span>
              </div>
              <div>
                <h4 class="font-headline font-bold text-on-surface mb-0.5">Total Exposure Growth</h4>
                <p class="text-[11px] font-semibold uppercase tracking-widest text-outline">Total amount at risk in the market over time</p>
              </div>
            </div>
            <div id="growthChart" class="chart-wrapper" style="min-height:320px;"></div>
          </div>
        </div>
      </section>

    </div>
  `,le(d),B.init(o.id),document.getElementById("export-dashboard-btn")?.addEventListener("click",()=>{B.open("dashboard","Dashboard Metrics")}),x("tabs-velocity",["1M","3M","6M","1Y","YTD"],"1Y",()=>{}),x("tabs-vintage",["3M","6M","1Y","ALL"],"ALL",()=>{}),x("tabs-trends",["3M","6M","1Y","ALL"],"1Y",()=>{}),ee(t,M,a,s);const N=g.risk_matrix?.length?g.risk_matrix:[];requestAnimationFrame(()=>requestAnimationFrame(()=>{try{de(t?.portfolioStatus)}catch(i){console.warn("donut",i)}try{ne(N)}catch(i){console.warn("risk",i)}try{ae(f)}catch(i){console.warn("funnel",i)}try{oe(M,g.vintage)}catch(i){console.warn("radial",i)}x("tabs-velocity",["1M","3M","6M","1Y","YTD"],"1Y",i=>{try{re(_(T,"month_year",i))}catch(m){console.warn("velocity",m)}}),x("tabs-vintage",["3M","6M","1Y","ALL"],"ALL",i=>{try{se(_(g.vintage,"cohort",i))}catch(m){console.warn("vintage",m)}}),x("tabs-trends",["3M","6M","1Y","ALL"],"1Y",i=>{try{ie(_(O,"month",i))}catch(m){console.warn("trends",m)}})}))});function _(e,o,n){if(!e||n==="ALL")return e;const r=new Date;let t=new Date;return n==="1M"&&t.setMonth(r.getMonth()-1),n==="3M"&&t.setMonth(r.getMonth()-3),n==="6M"&&t.setMonth(r.getMonth()-6),n==="1Y"&&t.setFullYear(r.getFullYear()-1),n==="YTD"&&(t=new Date(r.getFullYear(),0,1)),e.filter(a=>new Date(a[o])>=t)}let I=null;function ee(e,o,n,r){I={dash:e,fin:o,pipeline:n,perf:r,capturedAt:new Date().toISOString()},setTimeout(()=>{document.getElementById("btn-export-dashboard")?.addEventListener("click",te)},500)}function te(){if(!I){alert("Dashboard data not loaded yet.");return}const{dash:e,fin:o,pipeline:n,capturedAt:r}=I,a=[["DASHBOARD EXPORT",new Date(r).toLocaleDateString("en-ZA"),"",""],["","","",""],["KPI SUMMARY","","",""],["Metric","Value","",""],["Total Disbursed",o?.data?.balanceSheet?.totalLoanBook||0,"",""],["Active Clients",o?.data?.balanceSheet?.activeClients||0,"",""],["Avg Loan Per Client",o?.data?.balanceSheet?.avgLoanPerClient?.toFixed(2)||0,"",""],["Arrears Rate",(o?.data?.balanceSheet?.arrearsPercentage||0).toFixed(1)+"%","",""],["Interest Income",o?.data?.incomeStatement?.interestIncome||0,"",""],["Fee Income",o?.data?.incomeStatement?.feeIncome||0,"",""],["Total Revenue",o?.data?.incomeStatement?.totalRevenue||0,"",""],["","","",""],["PIPELINE SUMMARY","","",""],["Status","Count","",""]],s={};(n?.data||[]).forEach(d=>{s[d.status]=(s[d.status]||0)+1}),Object.entries(s).forEach(([d,f])=>a.push([d,f,"",""]));const c=a.map(d=>d.map(f=>`"${String(f).replace(/"/g,'""')}"`).join(",")).join(`
`),u=new Blob([c],{type:"text/csv;charset=utf-8;"}),l=URL.createObjectURL(u),p=document.createElement("a");p.href=l,p.download=`dashboard_export_${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(p),p.click(),document.body.removeChild(p),URL.revokeObjectURL(l)}function x(e,o,n,r){const t=document.getElementById(e);t&&(t.innerHTML=o.map(a=>`<button class="tab-button ${a===n?"active":""}" data-range="${a}">${a}</button>`).join(""),t.querySelectorAll("button").forEach(a=>{a.addEventListener("click",s=>{t.querySelectorAll("button").forEach(c=>c.classList.remove("active")),s.target.classList.add("active"),r(s.target.dataset.range)})}),r(n))}function E(e,o="No data yet"){const n=document.querySelector(`#${e}`);n&&(n.innerHTML=`<div class="h-full flex flex-col items-center justify-center gap-2 text-slate-400" style="min-height:280px">
    <span class="material-symbols-outlined text-4xl opacity-30">bar_chart</span>
    <p class="text-sm font-semibold">${o}</p>
    <p class="text-xs opacity-70">Data will appear once loans are processed</p>
  </div>`)}function ae(e){const{primary:o}=h(),n=e||[],r=["STARTED"],t=["BUREAU_CHECKING","BUREAU_OK","BUREAU_REFER","BANK_LINKING","AFFORD_OK","AFFORD_REFER"],a=["OFFERED","OFFER_ACCEPTED","CONTRACT_SIGN","DEBICHECK_AUTH"],s=["APPROVED"],u={series:[{name:"Applications",data:[n.filter(l=>r.includes(l.status)).length,n.filter(l=>t.includes(l.status)).length,n.filter(l=>a.includes(l.status)).length,n.filter(l=>s.includes(l.status)).length]}],chart:{type:"bar",height:300,toolbar:{show:!1},fontFamily:"Inter"},plotOptions:{bar:{borderRadius:8,horizontal:!0,barHeight:"60%"}},colors:[o],dataLabels:{enabled:!0,style:{fontSize:"12px",fontWeight:"700",colors:["#fff"]}},xaxis:{categories:["Just Applied","Being Checked","Almost Ready","Approved"],labels:{style:{colors:"#64748b",fontSize:"12px",fontWeight:"600"}}},yaxis:{labels:{style:{colors:"#64748b",fontSize:"12px",fontWeight:"600"}}},grid:{borderColor:"#f1f5f9",strokeDashArray:4},legend:{show:!1}};new ApexCharts(document.querySelector("#funnelChart"),b(u)).render()}function oe(e,o){const{primary:n,secondary:r}=h(),t=e?.ratios?.niiToRevenue||0,a=e?.balanceSheet?.arrearsPercentage||0,s=Math.max(0,100-a);let c=0;if(o&&o.length>0){const l=o.slice(0,3);c=l.reduce((d,f)=>d+parseFloat(f.recovery_rate),0)/l.length}const u={series:[Math.round(t),Math.round(s),Math.round(c)],chart:{type:"radialBar",height:350,fontFamily:"Inter"},plotOptions:{radialBar:{hollow:{size:"45%",background:"transparent"},track:{margin:10,background:"#f1f5f9"},dataLabels:{name:{fontSize:"14px",fontWeight:"700",color:"#64748b"},value:{fontSize:"24px",fontWeight:"800",color:"#0f172a"},total:{show:!0,label:"Avg Health",fontSize:"13px",fontWeight:"700",color:"#64748b",formatter:()=>Math.round(s)+"%"}}}},stroke:{lineCap:"round"},labels:["Profit Margin","Portfolio Health","Recovery Rate"],colors:[n,"#10b981",r]};new ApexCharts(document.querySelector("#radialChart"),b(u)).render()}let w=null;function re(e){const{primary:o,secondary:n}=h(),r=e||[];if(!r.length){E("velocityChart","No cash flow data yet");return}const t={series:[{name:"Lent Out",type:"area",data:r.map(a=>a.disbursed_amount)},{name:"Paid Back",type:"area",data:r.map(a=>a.repaid_amount)}],chart:{type:"line",height:350,fontFamily:"Inter",zoom:{enabled:!1},toolbar:{show:!1}},stroke:{width:3,curve:"smooth"},fill:{type:"gradient",gradient:{shadeIntensity:1,opacityFrom:.4,opacityTo:.1}},colors:[o,n],dataLabels:{enabled:!1},labels:r.map(a=>a.month_year),xaxis:{labels:{style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},yaxis:{labels:{formatter:a=>y(a),style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},grid:{borderColor:"#f1f5f9",strokeDashArray:4},legend:{position:"top",horizontalAlign:"right",fontSize:"12px",fontWeight:"600"}};w&&w.destroy(),w=new ApexCharts(document.querySelector("#velocityChart"),b(t)),w.render()}function ne(e){const{primary:o}=h();if(!e?.length){E("riskChart","No risk data yet");return}const r={series:[{name:"Loans",data:e?.length?e.map(t=>({x:t.credit_score||0,y:t.dti_ratio,z:t.principal_amount/100,fillColor:t.status==="defaulted"?"#ef4444":o})):[]}],chart:{type:"bubble",height:350,fontFamily:"Inter",zoom:{enabled:!1},toolbar:{show:!1}},dataLabels:{enabled:!1},fill:{opacity:.7},xaxis:{title:{text:"Credit Score",style:{fontSize:"12px",fontWeight:"700",color:"#64748b"}},min:0,max:850,labels:{style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},yaxis:{title:{text:"DTI Ratio (%)",style:{fontSize:"12px",fontWeight:"700",color:"#64748b"}},max:100,labels:{style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},grid:{borderColor:"#f1f5f9",strokeDashArray:4}};new ApexCharts(document.querySelector("#riskChart"),b(r)).render()}let S=null;function se(e){const{primary:o}=h();if(!e||e.length===0){document.querySelector("#vintageChart").innerHTML='<div class="h-full flex items-center justify-center text-slate-400 font-medium text-sm">No vintage data available</div>';return}const n={series:[{name:"Recovery Rate",data:e.map(r=>({x:r.cohort,y:r.recovery_rate}))}],chart:{type:"bar",height:350,fontFamily:"Inter",toolbar:{show:!1}},plotOptions:{bar:{borderRadius:8,columnWidth:"55%",colors:{ranges:[{from:0,to:60,color:"#ef4444"},{from:61,to:90,color:"#f59e0b"},{from:91,to:150,color:"#10b981"}]}}},dataLabels:{enabled:!0,formatter:r=>r+"%",style:{fontSize:"11px",fontWeight:"700",colors:["#fff"]}},yaxis:{max:120,labels:{style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},xaxis:{labels:{style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},colors:[o],grid:{borderColor:"#f1f5f9",strokeDashArray:4}};S&&S.destroy(),S=new ApexCharts(document.querySelector("#vintageChart"),b(n)),S.render()}let k=null,C=null;function ie(e){const{primary:o,secondary:n}=h();if(!e?.length){E("comboChart","No trend data yet"),E("growthChart","No growth data yet");return}const r=[...e||[]].reverse();if(r.length===1){const a=new Date(r[0].month),c=new Date(a.setMonth(a.getMonth()-1)).toISOString().slice(0,7);r.unshift({month:c,total_principal:0,projected_interest:0,active_loans:0})}const t=r.map(a=>a.month);k&&k.destroy(),k=new ApexCharts(document.querySelector("#comboChart"),b({series:[{name:"Principal",data:r.map(a=>a.total_principal||0)},{name:"Projected Interest",data:r.map(a=>a.projected_interest||0)}],chart:{height:350,type:"bar",stacked:!0,toolbar:{show:!1},fontFamily:"Inter"},plotOptions:{bar:{borderRadius:6,columnWidth:"50%"}},colors:[o,n],labels:t,xaxis:{labels:{style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},yaxis:{labels:{formatter:a=>F(a),style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},grid:{borderColor:"#f1f5f9",strokeDashArray:4},tooltip:{shared:!0,intersect:!1},legend:{position:"top",horizontalAlign:"right",fontSize:"12px",fontWeight:"600"},dataLabels:{enabled:!1}})),k.render(),C&&C.destroy(),C=new ApexCharts(document.querySelector("#growthChart"),b({series:[{name:"Total Exposure",data:r.map(a=>(a.total_principal||0)+(a.projected_interest||0))}],chart:{height:300,type:"area",toolbar:{show:!1},fontFamily:"Inter",dropShadow:{enabled:!0,color:o,top:8,blur:10,opacity:.2}},colors:[o],stroke:{curve:"smooth",width:3},fill:{type:"gradient",gradient:{shadeIntensity:1,opacityFrom:.5,opacityTo:.1,stops:[0,90,100]}},xaxis:{categories:t,labels:{style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},yaxis:{labels:{formatter:a=>y(a),style:{colors:"#64748b",fontSize:"11px",fontWeight:"600"}}},grid:{borderColor:"#f1f5f9",strokeDashArray:4},dataLabels:{enabled:!1},tooltip:{y:{formatter:a=>F(a)}}})),C.render()}function le(e){const o=document.getElementById("cards-container"),n=[{title:"Total Revenue",value:y(e.total_collected),sub:"Lifetime Collections",icon:"payments"},{title:"Total Disbursed",value:y(e.total_disbursed),sub:"Principal Lent",icon:"send_money"},{title:"Cash Flow",value:y(e.realized_cash_flow),sub:"Net Collections",icon:"account_balance"},{title:"Active Loans",value:e.active_loans_count??0,sub:"Current Portfolio",icon:"assignment_turned_in"}];o.innerHTML=n.map(r=>`
    <div class="glass-card p-8 rounded-2xl flex flex-col justify-between h-[200px] relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-8 -mt-8" style="background:color-mix(in srgb, var(--color-primary) 6%, transparent)"></div>
      <div class="flex items-center justify-between">
        <span class="material-symbols-outlined text-[32px]" style="color:var(--color-primary)">${r.icon}</span>
      </div>
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-1">${r.title}</p>
        <h3 class="font-headline text-4xl font-bold text-on-surface leading-none">${r.value}</h3>
        <p class="text-[11px] text-outline mt-1">${r.sub}</p>
      </div>
    </div>`).join("")}function de(e){const o=e&&e.length?e:[{name:"No Data",value:1}],{primary:n,secondary:r}=h(),t={series:o.map(a=>a.value),labels:o.map(a=>a.name),chart:{type:"donut",height:320,fontFamily:"Inter"},colors:[n,r,"#10b981","#f59e0b"],plotOptions:{pie:{donut:{size:"70%",labels:{show:!0,total:{show:!0,label:"Total Loans",fontSize:"14px",fontWeight:"700",color:"#64748b",formatter:a=>a.globals.seriesTotals.reduce((s,c)=>s+c,0)},value:{fontSize:"28px",fontWeight:"800",color:"#0f172a"}}}}},legend:{position:"bottom",fontSize:"12px",fontWeight:"600",labels:{colors:"#64748b"}},dataLabels:{enabled:!1},stroke:{show:!1}};new ApexCharts(document.querySelector("#donutChart"),b(t)).render()}function ce(e,o){const n={STARTED:e.filter(t=>t.status==="STARTED").length,BANK_LINKING:e.filter(t=>["BANK_LINKING","AFFORD_OK"].includes(t.status)).length,OFFERED:e.filter(t=>t.status==="OFFERED").length,CONTRACT_SIGN:e.filter(t=>["CONTRACT_SIGN","OFFER_ACCEPTED"].includes(t.status)).length,APPROVED:e.filter(t=>t.status==="APPROVED").length},r=(o||[]).map(t=>({cohort:t.month_year,recovery_rate:t.disbursed_amount>0?Math.round(t.repaid_amount/t.disbursed_amount*100):0})).filter(t=>t.cohort>="2024-01");return{funnel:n,vintage:r,risk_matrix:[]}}
