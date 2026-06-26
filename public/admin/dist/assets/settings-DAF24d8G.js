import{supabase as f}from"./supabaseClient-DdIec1HK.js";/* empty css              *//* empty css               */import{i as R}from"./layout-Nmoyu__-.js";import{g as M,u as H,h as j,i as z,j as q,k as O,l as W,m as Y}from"./dataService-C6RIvcSC.js";import{e as V,D as g,g as X,p as P,a as Z}from"./theme-CYs9TE7o.js";import"https://esm.sh/@supabase/supabase-js@2";let $="borrower",m=null,L=[],v={...g},s={...g},_=!1,w=!1,G=!1,J=!1;const C=[{key:"primary_color",label:"Primary Color",description:"Used for CTAs, highlights and primary focus states."},{key:"secondary_color",label:"Secondary Color",description:"Used for gradients, hover states and charts."},{key:"tertiary_color",label:"Tertiary Color",description:"Used for gradients and subtle accents."}],K=e=>{switch(e){case"super_admin":return"bg-purple-100 text-purple-700 border-purple-200";case"admin":return"bg-blue-100 text-blue-700 border-blue-200";case"base_admin":return"bg-orange-100 text-orange-700 border-orange-200";default:return"bg-green-50 text-green-700 border-green-200"}},k=e=>{switch(e){case"super_admin":return"SUPER ADMIN";case"admin":return"LOAN MANAGER";case"base_admin":return"LOAN OFFICER";default:return"CLIENT"}},N=(e,t={})=>{const{sizeClass:a="w-10 h-10",textClass:n="text-sm"}=t,o=e.full_name||"U";return e.avatar_url?`<img src="${e.avatar_url}" class="${a} rounded-full object-cover border border-gray-200 shadow-sm" alt="${o}">`:`
    <div class="${a} rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center ${n} font-bold text-gray-600">
      ${o.charAt(0).toUpperCase()}
    </div>
  `},i=(e,t="success")=>{let a=document.getElementById("toast-container");a||(a=document.createElement("div"),a.id="toast-container",a.className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none",document.body.appendChild(a));const n=document.createElement("div"),o=t==="success"?"bg-gray-900 text-white":"bg-red-600 text-white",d=t==="success"?'<i class="fa-solid fa-check-circle"></i>':'<i class="fa-solid fa-circle-exclamation"></i>';n.className=`${o} px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transform transition-all duration-300 translate-y-4 opacity-0 min-w-[300px] pointer-events-auto`,n.innerHTML=`${d}<span class="font-medium text-sm">${e}</span>`,a.appendChild(n),requestAnimationFrame(()=>n.classList.remove("translate-y-4","opacity-0")),setTimeout(()=>{n.classList.add("opacity-0","translate-y-2"),setTimeout(()=>n.remove(),300)},3e3)},Q=(e=[])=>Array.isArray(e)?e.map((t={})=>({title:typeof t.title=="string"?t.title:"",text:typeof t.text=="string"?t.text:""})):[],T=e=>{const t=g.carousel_slides||[],a=Q(Array.isArray(e)&&e.length?e:t),n=t.length||3;for(;a.length<n;){const o=t[a.length]||{title:"",text:""};a.push({...o})}return a.slice(0,n).map((o,d)=>({title:o.title?.trim()||t[d]?.title||"",text:o.text?.trim()||t[d]?.text||""}))},h=(e,t=!1)=>typeof e=="boolean"?e:typeof e=="string"?e.toLowerCase()==="true":t,x=e=>{if(!e)return null;let t=e.trim().replace("#","");return t.length===3&&(t=t.split("").map(a=>a+a).join("")),/^[0-9A-Fa-f]{6}$/.test(t)?`#${t.toUpperCase()}`:null},D=e=>(typeof e=="string"?e.trim():"")||g.company_name,b=(e={})=>({...g,...e,company_name:D(e?.company_name),auth_overlay_color:x(e?.auth_overlay_color)||g.auth_overlay_color,auth_overlay_enabled:h(e?.auth_overlay_enabled,g.auth_overlay_enabled),auth_background_flip:h(e?.auth_background_flip,g.auth_background_flip),carousel_slides:T(e?.carousel_slides)}),S=()=>T(s?.carousel_slides||[]),p=(e="")=>(e||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;"),ee=(e="")=>(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),te=()=>{C.forEach(({key:t})=>{const a=document.querySelector(`[data-color-picker="${t}"]`),n=document.querySelector(`[data-color-input="${t}"]`);a&&(a.value=s[t]),n&&(n.value=s[t])});const e=document.getElementById("brand-gradient-preview");e&&(e.style.backgroundImage=`linear-gradient(120deg, ${s.primary_color}, ${s.secondary_color}, ${s.tertiary_color})`),document.querySelectorAll("[data-theme-mode]").forEach(t=>{t.dataset.themeMode===s.theme_mode?(t.classList.add("bg-gray-900","text-white","shadow"),t.classList.remove("text-gray-600","bg-white")):(t.classList.remove("bg-gray-900","text-white","shadow"),t.classList.add("text-gray-600","bg-white"))}),ne(),se(),le(),de(),E()},E=()=>{const e=document.getElementById("save-system-settings"),t=document.getElementById("system-settings-status");e&&(e.disabled=!_||w,e.innerHTML=w?'<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Saving':"Save Changes"),t&&(t.textContent=_?"Unsaved changes":"Theme saved",t.className=_?"text-xs text-orange-600 font-bold":"text-xs text-green-600 font-bold")},ae=()=>{_=!0,E()},c=e=>{const t={...e};e.carousel_slides&&(t.carousel_slides=T(e.carousel_slides)),s=b({...s,...t}),ae(),Z(s),te()},re=()=>(s.company_logo_url||"").trim(),oe=()=>(s.auth_background_url||"").trim(),ne=()=>{const e=re(),t=document.getElementById("company-logo-preview"),a=document.getElementById("company-logo-empty"),n=document.getElementById("remove-logo-btn"),o=document.getElementById("logo-url-input");t&&(e?(t.src=e,t.classList.remove("hidden"),a&&a.classList.add("hidden")):(t.src="",t.classList.add("hidden"),a&&a.classList.remove("hidden"))),n&&(n.disabled=!e||G),o&&document.activeElement!==o&&(o.value=e)},se=()=>{const e=oe(),t=h(s.auth_background_flip,!1),a=document.getElementById("auth-bg-preview"),n=document.getElementById("auth-bg-empty"),o=document.getElementById("wallpaper-flip-toggle"),d=document.getElementById("remove-wallpaper-btn"),l=document.getElementById("wallpaper-url-input");a&&(a.style.backgroundImage=e?`url('${e}')`:"none",a.style.transform=t?"scaleX(-1)":"scaleX(1)",n&&n.classList.toggle("hidden",!!e)),o&&(o.checked=t),d&&(d.disabled=!e||J),l&&document.activeElement!==l&&(l.value=e)},le=()=>{const e=x(s.auth_overlay_color)||g.auth_overlay_color,t=h(s.auth_overlay_enabled,!0),a=document.getElementById("overlay-color-picker"),n=document.getElementById("overlay-color-input"),o=document.getElementById("overlay-disable-toggle");a&&(a.value=e),n&&(n.value=e),o&&(o.checked=!t)},de=()=>{S().forEach((t,a)=>{const n=document.querySelector(`[data-carousel-field="title"][data-carousel-index="${a}"]`),o=document.querySelector(`[data-carousel-field="text"][data-carousel-index="${a}"]`);n&&n!==document.activeElement&&(n.value=t.title),o&&o!==document.activeElement&&(o.value=t.text)})};function ce(){const e=document.getElementById("main-content");if(!e)return;e.innerHTML=`
    <div class="glass-card rounded-2xl h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
      <div class="flex border-b border-outline-variant/10 bg-surface-container-lowest px-6 overflow-x-auto">
        <button class="tab-btn active" data-tab="profile"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">badge</span>My Profile</button>
        <button class="tab-btn" data-tab="security"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">shield</span>Security</button>
        ${$==="super_admin"?`
          <button class="tab-btn" data-tab="users"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">manage_accounts</span>User Management</button>
          <button class="tab-btn" data-tab="billing"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">credit_card</span>Billing</button>
          <button class="tab-btn" data-tab="system"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">tune</span>System Branding</button>
        `:""}
      </div>

      <div id="tab-content" class="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar relative"></div>
    </div>

    <div id="role-modal" class="hidden fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Change User Role</h3>
            <div class="bg-blue-50 p-3 rounded-lg mb-4 flex items-start gap-3">
                <i class="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
                <div class="text-sm text-blue-800">
                    User: <strong id="modal-user-name">...</strong><br>
                    Current Role: <span id="modal-current-role" class="uppercase text-xs font-bold">...</span>
                </div>
            </div>
            <form id="role-form">
                <input type="hidden" id="modal-user-id">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">New Role Assignment</label>
                <select id="modal-role-select" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500 mb-6">
                    <option value="borrower">Client (Borrower)</option>
                    <option value="base_admin">Loan Officer (Base Admin)</option>
                    <option value="admin">Branch Manager (Admin)</option>
                    <option value="super_admin">Super Admin</option>
                </select>
                <div class="flex justify-end gap-3">
                    <button type="button" onclick="document.getElementById('role-modal').classList.add('hidden')" class="px-4 py-2 text-gray-600 font-bold text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black shadow-sm">Save Changes</button>
                </div>
            </form>
        </div>
    </div>
  `;const t=document.createElement("style");t.innerHTML=`
    .tab-btn { padding: 1rem 1.5rem; font-size: 0.875rem; font-weight: 600; color: #6B7280; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
    .tab-btn:hover { color: #111827; background: rgba(0,0,0,0.03); }
    .tab-btn.active { color: var(--color-primary, #EA580C); border-bottom-color: var(--color-primary, #EA580C); background: #FFF; }
  `,document.head.appendChild(t),ie(),A()}function ie(){const e=document.querySelectorAll(".tab-btn");e.forEach(a=>{a.onclick=()=>{e.forEach(o=>o.classList.remove("active")),a.classList.add("active");const n=a.dataset.tab;n==="profile"?A():n==="security"?ue():n==="users"?U():n==="billing"?pe():n==="system"&&me()}});const t=document.getElementById("role-form");t&&t.addEventListener("submit",async a=>{a.preventDefault();const n=document.getElementById("modal-user-id").value,o=document.getElementById("modal-role-select").value;try{const{error:d}=await H(n,o);if(d)throw new Error(d);i("Role updated successfully","success"),document.getElementById("role-modal").classList.add("hidden"),U()}catch(d){i(d.message,"error")}})}function A(){const e=document.getElementById("tab-content");e.innerHTML=`
        <div class="max-w-2xl animate-fade-in">
            <h2 class="text-2xl font-headline font-bold text-on-surface mb-1">My Profile</h2>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-8">Manage your personal account details.</p>
            <div class="glass-card p-8 rounded-2xl">
                <div class="flex items-center gap-6 mb-8">
                    <div class="relative group cursor-pointer w-20 h-20">
                        ${N({...m,avatar_url:m.avatar_url},{sizeClass:"w-20 h-20",textClass:"text-2xl"})} 
                        <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i class="fa-solid fa-camera text-white"></i>
                        </div>
                        <input type="file" id="avatar-input" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*">
                        <div id="avatar-spinner" class="absolute inset-0 w-full h-full bg-black/70 rounded-full flex items-center justify-center hidden"><i class="fa-solid fa-spinner fa-spin text-white"></i></div>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">${m.full_name||"User"}</h3>
                        <p class="text-sm text-gray-500">${m.email||""}</p>
                        <span class="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase border border-gray-200">
                            ${k(m.role)}
                        </span>
                    </div>
                </div>
                <form id="profile-form" class="space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label>
                            <input type="text" id="prof-name" value="${m.full_name||""}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Contact Number</label>
                            <input type="text" id="prof-phone" value="${m.contact_number||""}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                        </div>
                    </div>
                    <div class="flex justify-end pt-4">
                        <button type="submit" id="save-profile" class="px-6 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black shadow-lg transition-all">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `,document.getElementById("profile-form").addEventListener("submit",async t=>{t.preventDefault();const a=document.getElementById("save-profile"),n=a.innerHTML;a.disabled=!0,a.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';try{const o={full_name:document.getElementById("prof-name").value,contact_number:document.getElementById("prof-phone").value},{error:d}=await j(o);if(d)throw new Error(d);m={...m,...o},i("Profile Updated","success")}catch(o){i(o.message,"error")}finally{a.disabled=!1,a.innerHTML=n}}),document.getElementById("avatar-input").addEventListener("change",async t=>{const a=t.target.files[0];if(a){document.getElementById("avatar-spinner").classList.remove("hidden");try{const n=a.name.split(".").pop(),o=`${m.id}/${Date.now()}.${n}`,{error:d}=await f.storage.from("avatars").upload(o,a,{upsert:!0});if(d)throw d;const{data:l}=f.storage.from("avatars").getPublicUrl(o);await z(l.publicUrl),m.avatar_url=l.publicUrl,A(),i("Avatar updated","success")}catch(n){i("Failed to upload: "+n.message,"error")}finally{}}})}function ue(){const e=document.getElementById("tab-content");e.innerHTML=`
        <div class="max-w-2xl animate-fade-in">
            <h2 class="text-2xl font-headline font-bold text-on-surface mb-1">Security</h2>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-8">Update your password and security settings.</p>
            <div class="glass-card p-8 rounded-2xl">
                <form id="security-form" class="space-y-5">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">New Password</label>
                        <input type="password" id="sec-pass" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="••••••••">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Confirm Password</label>
                        <input type="password" id="sec-confirm" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="••••••••">
                    </div>
                    <div class="pt-4">
                        <button type="submit" class="px-6 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black shadow-lg transition-all">Update Password</button>
                    </div>
                </form>
            </div>
        </div>
    `,document.getElementById("security-form").addEventListener("submit",async t=>{t.preventDefault();const a=document.getElementById("sec-pass").value,n=document.getElementById("sec-confirm").value;if(a!==n)return i("Passwords do not match","error");if(a.length<6)return i("Password too short (min 6 chars)","error");const{error:o}=await f.auth.updateUser({password:a});o?i(o.message,"error"):(i("Password updated successfully","success"),t.target.reset())})}async function U(){const e=document.getElementById("tab-content");if(e){e.innerHTML=`
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 class="text-2xl font-headline font-bold text-on-surface">User Management</h2>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Manage permissions and roles for all users.</p>
        </div>
        <div class="relative w-full sm:w-72">
            <input type="text" id="user-search" placeholder="Search users..." 
                   class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm transition-shadow">
            <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
        </div>
    </div>
    
    <div class="glass-card rounded-2xl overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar">
            <table class="min-w-full divide-y divide-outline-variant/10">
                <thead class="bg-surface-container">
                    <tr>
                        <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">User Identity</th>
                        <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">System ID</th>
                        <th class="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-outline">Current Role</th>
                        <th class="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-outline">Actions</th>
                    </tr>
                </thead>
                <tbody id="user-management-list" class="bg-white divide-y divide-outline-variant/10">
                    <tr><td colspan="4" class="p-12 text-center text-gray-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br>Loading directory...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
    <div class="mt-4 text-xs text-gray-400 text-right" id="user-count"></div>
  `;try{const t=await q();L=Array.isArray(t)?t:[];const a=n=>{const o=document.getElementById("user-management-list"),d=document.getElementById("user-count");if(d&&(d.textContent=`Showing ${n.length} users`),n.length===0){o.innerHTML='<tr><td colspan="4" class="p-8 text-center text-sm text-gray-500">No users found.</td></tr>';return}o.innerHTML=n.map(l=>{const I=m?.id===l.id;return`
              <tr class="hover:bg-gray-50 transition-colors group">
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                          ${N(l,{sizeClass:"w-9 h-9",textClass:"text-xs"})}
                          <div>
                              <div class="text-sm font-bold text-gray-900">${l.full_name||"Unknown"}</div>
                              <div class="text-xs text-gray-500">${l.email||"No email"}</div>
                          </div>
                      </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block border border-gray-100" title="${l.id}">
                          ${l.id.substring(0,8)}...
                      </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${K(l.role)}">
                          ${k(l.role)}
                      </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                      ${I?'<span class="text-xs text-gray-400 italic">Current User</span>':`
                      <button class="change-role-btn text-on-surface-variant font-semibold text-xs bg-surface-container border border-outline-variant/30 px-3 py-1.5 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                          data-user-id="${l.id}"
                          data-user-name="${l.full_name||"User"}"
                          data-user-role="${l.role}">
                          <span class="material-symbols-outlined text-[14px]">manage_accounts</span> Change Role
                      </button>`}
                  </td>
              </tr>
            `}).join(""),o.querySelectorAll(".change-role-btn").forEach(l=>{l.onclick=()=>{document.getElementById("modal-user-id").value=l.dataset.userId,document.getElementById("modal-user-name").textContent=l.dataset.userName,document.getElementById("modal-current-role").textContent=k(l.dataset.userRole),document.getElementById("modal-role-select").value=l.dataset.userRole,document.getElementById("role-modal").classList.remove("hidden")}})};a(L),document.getElementById("user-search").addEventListener("input",n=>{const o=n.target.value.toLowerCase(),d=L.filter(l=>(l.full_name||"").toLowerCase().includes(o)||(l.email||"").toLowerCase().includes(o)||(l.id||"").toLowerCase().includes(o));a(d)})}catch(t){console.error(t),document.getElementById("user-management-list").innerHTML=`<tr><td colspan="4" class="p-8 text-center text-red-600">Error: ${t.message}</td></tr>`}}}window.openRoleModal=(e,t,a)=>{document.getElementById("modal-user-id").value=e,document.getElementById("modal-user-name").textContent=t,document.getElementById("modal-current-role").textContent=k(a),document.getElementById("modal-role-select").value=a,document.getElementById("role-modal").classList.remove("hidden")};async function pe(){const e=document.getElementById("tab-content");e.innerHTML=`
        <div class="max-w-4xl animate-fade-in">
            <h2 class="text-2xl font-headline font-bold text-on-surface mb-1">Billing & Payments</h2>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-8">Manage disbursement methods.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="glass-card p-8 rounded-2xl">
                    <h3 class="font-bold text-gray-800 mb-4">Add Payment Method</h3>
                    <form id="card-form" class="space-y-4">
                        <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Card Type</label><select id="card-type" class="w-full border-gray-300 rounded-lg text-sm p-2.5"><option value="visa">Visa</option><option value="mastercard">Mastercard</option></select></div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Last 4 Digits</label><input type="text" id="card-last4" maxlength="4" class="w-full border-gray-300 rounded-lg text-sm p-2.5" placeholder="1234"></div>
                        <div class="grid grid-cols-2 gap-4"><input type="text" id="card-mm" maxlength="2" placeholder="MM" class="w-full border-gray-300 rounded-lg text-sm p-2.5"><input type="text" id="card-yy" maxlength="4" placeholder="YYYY" class="w-full border-gray-300 rounded-lg text-sm p-2.5"></div>
                        <button type="submit" class="w-full py-2.5 rounded-xl font-semibold text-sm text-white mt-2" style="background:var(--color-primary)">Add Card</button>
                    </form>
                </div>
                <div class="bg-surface-container p-8 rounded-2xl border border-outline-variant/20">
                    <h3 class="font-bold text-gray-800 mb-4">Saved Cards</h3>
                    <div id="cards-list" class="space-y-3"><p class="text-sm text-gray-400 italic">Loading...</p></div>
                </div>
            </div>
        </div>
    `;const t=async()=>{const{data:a}=await Y(),n=document.getElementById("cards-list");if(!a||a.length===0){n.innerHTML='<p class="text-sm text-gray-400 italic">No cards saved.</p>';return}n.innerHTML=a.map(o=>`
            <div class="flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
                <span class="material-symbols-outlined text-outline">credit_card</span>
                <div class="flex-1"><p class="text-sm font-bold text-on-surface">•••• ${o.last_four}</p><p class="text-xs text-outline">Exp: ${o.expiry_month}/${o.expiry_year}</p></div>
                ${o.is_default?'<span class="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase">Default</span>':""}
            </div>
        `).join("")};t(),document.getElementById("card-form").addEventListener("submit",async a=>{a.preventDefault();const n={p_card_type:document.getElementById("card-type").value,p_last_four:document.getElementById("card-last4").value,p_expiry_month:document.getElementById("card-mm").value,p_expiry_year:document.getElementById("card-yy").value},{error:o}=await O(n);o?i(o.message,"error"):(i("Card Added","success"),a.target.reset(),t())})}async function me(){const e=document.getElementById("tab-content");if(!e)return;try{const{data:r}=await M();r&&(v=b(r),s=b(r))}catch(r){console.error("Settings Sync Error:",r)}const t=s.company_logo_url||"",a=s.auth_background_url||"",n=p(D(s.company_name)),o=x(s.auth_overlay_color)||g.auth_overlay_color,d=!h(s.auth_overlay_enabled,!0),l=h(s.auth_background_flip,!1),I=S();e.innerHTML=`
        <div class="max-w-5xl space-y-8 animate-fade-in">
            <div class="flex items-center justify-between">
                <div><h2 class="text-2xl font-headline font-bold text-on-surface">System Branding</h2><p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Customize the look and feel of the platform.</p></div>
                <div class="text-right">
                    <button id="save-system-settings" class="px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" style="background:var(--color-primary)">Save Changes</button>
                    <p id="system-settings-status" class="text-xs text-gray-400 mt-2 font-medium">No pending changes</p>
                </div>
            </div>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Company Identity</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Name</label>
                        <input type="text" id="company-name-input" value="${n}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Logo</label>
                        <div class="flex flex-col lg:flex-row gap-4">
                            <div class="h-20 w-20 bg-surface-container rounded-xl border border-outline-variant/20 flex items-center justify-center overflow-hidden shrink-0">
                                ${t?`<img src="${t}" class="h-full w-full object-contain">`:'<span class="material-symbols-outlined text-outline text-3xl">image</span>'}
                            </div>
                            <div class="space-y-3 flex-1">
                                <div class="flex gap-2">
                                    <label class="cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 text-center">
                                        Upload File <input type="file" id="logo-file-input" class="hidden" accept="image/*">
                                    </label>
                                    ${t?'<button id="remove-logo-btn" class="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Remove</button>':""}
                                </div>
                                <div class="flex gap-2">
                                    <input type="url" id="logo-url-input" value="${t}" class="flex-1 border-gray-300 rounded-lg p-1.5 text-xs focus:ring-orange-500" placeholder="https://...">
                                    <button id="apply-logo-url" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200">Use Link</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Company Legal Details</h4>
                <p class="text-xs text-gray-400 mb-4">These details appear in loan contracts and NCA disclosures generated via DocuSeal.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">NCR Registration Number</label>
                        <input type="text" id="ncr-number-input" value="${p(s.ncr_number||"")}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="NCRCP12345">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Registration Number</label>
                        <input type="text" id="company-reg-input" value="${p(s.company_reg_number||"")}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="2023/123456/07">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">VAT Number</label>
                        <input type="text" id="company-vat-input" value="${p(s.company_vat_number||"")}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="4012345678">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Branch Code (for contracts)</label>
                        <input type="text" id="provider-branch-code-input" value="${p(s.provider_branch_code||"")}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="ZFS">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Phone</label>
                        <input type="text" id="company-phone-input" value="${p(s.company_phone||"")}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="0691195046">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Physical Address</label>
                        <input type="text" id="company-physical-address-input" value="${p(s.company_physical_address||"")}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="123 Main Street, Johannesburg, 2001">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Postal Address</label>
                        <input type="text" id="company-postal-address-input" value="${p(s.company_postal_address||"")}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="PO Box 1234, Johannesburg, 2001">
                    </div>
                </div>
            </section>

            <!-- ── Banking Details ───────────────────────────────────── -->
            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-1 border-b border-outline-variant/10 pb-2 flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]" style="color:var(--color-primary)">account_balance</span>
                    Company Banking Details
                </h4>
                <p class="text-xs text-gray-400 mb-5">Displayed to clients when they make a manual EFT payment or settle a loan.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Bank Name</label>
                        <input type="text" id="bank-name-input" value="${p(s.company_bank_name||"")}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. FNB, ABSA, Standard Bank">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Account Holder Name</label>
                        <input type="text" id="bank-holder-input" value="${p(s.company_bank_account_holder||"")}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. AlgoLend">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Account Number</label>
                        <input type="text" id="bank-account-no-input" value="${p(s.company_bank_account_no||"")}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. 62812345678">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Branch Code</label>
                        <input type="text" id="bank-branch-code-input" value="${p(s.company_bank_branch_code||"")}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. 250655">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Account Type</label>
                        <select id="bank-account-type-input" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500 bg-white">
                            <option value="current"  ${(s.company_bank_account_type||"current")==="current"?"selected":""}>Current / Cheque</option>
                            <option value="savings"  ${(s.company_bank_account_type||"")==="savings"?"selected":""}>Savings</option>
                            <option value="business" ${(s.company_bank_account_type||"")==="business"?"selected":""}>Business</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Reference Prefix</label>
                        <input type="text" id="bank-ref-prefix-input" value="${p(s.company_bank_reference_prefix||"REF")}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. ZFS">
                        <p class="text-xs text-gray-400 mt-1">Client reference = PREFIX-LOANID (e.g. ZFS-1001)</p>
                    </div>
                </div>

                <!-- Live preview -->
                <div class="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Client will see:</p>
                    <div class="grid grid-cols-2 gap-y-1 text-sm">
                        ${[["Bank",s.company_bank_name||"—"],["Account Holder",s.company_bank_account_holder||s.company_name||"—"],["Account Number",s.company_bank_account_no||"—"],["Branch Code",s.company_bank_branch_code||"—"],["Account Type",s.company_bank_account_type||"current"],["Reference",`${s.company_bank_reference_prefix||"REF"}-LOANID`]].map(([r,u])=>`
                            <span class="text-gray-400 text-xs">${r}</span>
                            <span class="font-semibold text-gray-800 text-xs">${u}</span>
                        `).join("")}
                    </div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Theme Colors</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${C.map(r=>`
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">${r.label}</label>
                            <div class="flex items-center gap-2">
                                <input type="color" data-color-picker="${r.key}" value="${s[r.key]}" class="h-10 w-10 rounded cursor-pointer border border-gray-300 p-0 overflow-hidden">
                                <input type="text" data-color-input="${r.key}" value="${s[r.key]}" class="flex-1 border-gray-300 rounded-lg p-2 text-sm font-mono uppercase focus:ring-orange-500">
                            </div>
                        </div>`).join("")}
                </div>
                <div class="mt-6 p-4 bg-surface-container rounded-xl border border-outline-variant/20 flex items-center gap-4">
                    <span class="text-xs font-bold text-gray-500 uppercase">Preview:</span>
                    <div id="brand-gradient-preview" class="flex-1 h-8 rounded-lg shadow-inner" style="background: linear-gradient(90deg, ${s.primary_color}, ${s.secondary_color}, ${s.tertiary_color})"></div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Login Styling</h4>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Wallpaper</label>
                        <div id="auth-bg-preview" class="h-40 rounded-xl border border-gray-300 bg-gray-100 flex items-center justify-center relative overflow-hidden bg-cover bg-center mb-3" style="background-image: ${a?`url('${a}')`:"none"}; transform: scaleX(${l?"-1":"1"});">
                             ${a?"":'<span class="text-xs text-gray-400 font-bold">Default</span>'}
                        </div>
                        <div class="space-y-3">
                            <div class="flex gap-2">
                                <label class="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-semibold text-white" style="background:var(--color-primary)">
                                    <span class="material-symbols-outlined text-[14px] align-middle mr-1">cloud_upload</span> Upload
                                    <input type="file" id="wallpaper-file-input" class="hidden" accept="image/*">
                                </label>
                                ${a?'<button id="remove-wallpaper-btn" class="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Remove</button>':""}
                            </div>
                            <div class="flex gap-2">
                                <input type="url" id="wallpaper-url-input" value="${a}" class="flex-1 border-gray-300 rounded-lg p-1.5 text-xs focus:ring-orange-500" placeholder="https://...">
                                <button id="apply-wallpaper-url" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200">Use Link</button>
                            </div>
                            <label class="flex items-center gap-2 cursor-pointer pt-2">
                                <input type="checkbox" id="wallpaper-flip-toggle" class="rounded text-orange-600" ${l?"checked":""}>
                                <span class="text-xs font-medium text-gray-700">Flip Horizontal</span>
                            </label>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Overlay Tint</label>
                            <div class="flex items-center gap-2">
                                <input type="color" id="overlay-color-picker" value="${o}" class="h-10 w-10 rounded border border-gray-300 cursor-pointer">
                                <input type="text" id="overlay-color-input" value="${o}" class="w-32 border-gray-300 rounded-lg p-2 text-sm font-mono uppercase">
                            </div>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="overlay-disable-toggle" class="rounded text-orange-600" ${d?"checked":""}>
                            <span class="text-sm font-medium text-gray-700">Disable Overlay</span>
                        </label>
                    </div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Login Text</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${I.map((r,u)=>`
                        <div class="space-y-2 p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Slide ${u+1}</span>
                            <input type="text" value="${p(r.title)}" data-carousel-index="${u}" data-carousel-field="title" class="w-full border-gray-300 rounded-lg text-sm font-bold p-2 focus:ring-orange-500" placeholder="Title">
                            <textarea rows="3" data-carousel-index="${u}" data-carousel-field="text" class="w-full border-gray-300 rounded-lg text-xs p-2 focus:ring-orange-500 resize-none" placeholder="Description">${ee(r.text)}</textarea>
                        </div>
                    `).join("")}
                </div>
            </section>
        </div>
    `,C.forEach(({key:r})=>{document.querySelector(`[data-color-picker="${r}"]`)?.addEventListener("input",u=>{const y=x(u.target.value);y&&c({[r]:y})}),document.querySelector(`[data-color-input="${r}"]`)?.addEventListener("change",u=>{const y=x(u.target.value);y&&c({[r]:y})})}),document.getElementById("company-name-input")?.addEventListener("input",r=>c({company_name:r.target.value})),document.getElementById("ncr-number-input")?.addEventListener("input",r=>c({ncr_number:r.target.value})),document.getElementById("company-reg-input")?.addEventListener("input",r=>c({company_reg_number:r.target.value})),document.getElementById("company-vat-input")?.addEventListener("input",r=>c({company_vat_number:r.target.value})),document.getElementById("provider-branch-code-input")?.addEventListener("input",r=>c({provider_branch_code:r.target.value})),document.getElementById("company-phone-input")?.addEventListener("input",r=>c({company_phone:r.target.value})),document.getElementById("company-physical-address-input")?.addEventListener("input",r=>c({company_physical_address:r.target.value})),document.getElementById("company-postal-address-input")?.addEventListener("input",r=>c({company_postal_address:r.target.value})),document.getElementById("bank-name-input")?.addEventListener("input",r=>c({company_bank_name:r.target.value})),document.getElementById("bank-holder-input")?.addEventListener("input",r=>c({company_bank_account_holder:r.target.value})),document.getElementById("bank-account-no-input")?.addEventListener("input",r=>c({company_bank_account_no:r.target.value})),document.getElementById("bank-branch-code-input")?.addEventListener("input",r=>c({company_bank_branch_code:r.target.value})),document.getElementById("bank-account-type-input")?.addEventListener("change",r=>c({company_bank_account_type:r.target.value})),document.getElementById("bank-ref-prefix-input")?.addEventListener("input",r=>c({company_bank_reference_prefix:r.target.value})),document.getElementById("wallpaper-flip-toggle")?.addEventListener("change",r=>c({auth_background_flip:r.target.checked})),document.getElementById("overlay-disable-toggle")?.addEventListener("change",r=>c({auth_overlay_enabled:!r.target.checked})),document.getElementById("overlay-color-picker")?.addEventListener("input",r=>{const u=x(r.target.value);u&&c({auth_overlay_color:u})}),document.querySelectorAll("[data-carousel-field]").forEach(r=>{r.addEventListener("input",u=>{const y=parseInt(u.target.dataset.carouselIndex),F=u.target.dataset.carouselField,B=[...S()];B[y]={...B[y],[F]:u.target.value},c({carousel_slides:B})})}),document.getElementById("save-system-settings")?.addEventListener("click",async()=>{if(w)return;w=!0,E();const{data:r,error:u}=await W(s);u?i("Failed to save: "+u,"error"):(i("System settings saved!","success"),v=b(r),s=b(r),_=!1,P(v)),w=!1,E()}),document.getElementById("logo-file-input")?.addEventListener("change",ge),document.getElementById("remove-logo-btn")?.addEventListener("click",()=>{c({company_logo_url:null}),i("Logo removed (pending save).","success")}),document.getElementById("apply-logo-url")?.addEventListener("click",()=>{const r=document.getElementById("logo-url-input").value.trim();r&&(c({company_logo_url:r}),i("Logo link applied. Save to confirm.","success"))}),document.getElementById("wallpaper-file-input")?.addEventListener("change",be),document.getElementById("remove-wallpaper-btn")?.addEventListener("click",()=>{c({auth_background_url:null}),i("Wallpaper removed (pending save).","success")}),document.getElementById("apply-wallpaper-url")?.addEventListener("click",()=>{const r=document.getElementById("wallpaper-url-input").value.trim();r&&(c({auth_background_url:r}),i("Wallpaper link applied. Save to confirm.","success"))}),E()}async function ge(e){const t=e.target.files[0];if(t)try{const a=t.name.split(".").pop(),n=`system/logo_${Date.now()}.${a}`,{error:o}=await f.storage.from("avatars").upload(n,t);if(o)throw o;const{data:d}=f.storage.from("avatars").getPublicUrl(n);c({company_logo_url:d.publicUrl}),i("Logo uploaded successfully!","success")}catch(a){i("Upload failed: "+a.message,"error")}}async function be(e){const t=e.target.files[0];if(t)try{const a=t.name.split(".").pop(),n=`system/wallpaper_${Date.now()}.${a}`,{error:o}=await f.storage.from("avatars").upload(n,t);if(o)throw o;const{data:d}=f.storage.from("avatars").getPublicUrl(n);c({auth_background_url:d.publicUrl}),i("Wallpaper uploaded successfully!","success")}catch(a){i("Upload failed: "+a.message,"error")}}async function ye(){try{const{data:e}=await M();e&&(v=b(e),s=b(e),P(v))}catch(e){console.error("Init Settings Error:",e)}}document.addEventListener("DOMContentLoaded",async()=>{const e=await R();if(e){if($=e.role,m=e.profile,$==="super_admin")await ye();else{await V();const t=X();if(t){const a=b(t);v=a,s=b(a)}}ce()}});
