import{s as y}from"./supabaseClient-Ki9k9WNi.js";import{i as N,e as j,D as g,a as R,p as A,b as z}from"./layout-P4Epjfxm.js";/* empty css               */import{g as P,u as q,h as O,i as W,j as Y,k as V,l as X,m as G}from"./dataService-OY041MzK.js";let B="borrower",u=null,k=[],x={...g},n={...g},h=!1,w=!1,J=!1,K=!1;const $=[{key:"primary_color",label:"Primary Color",description:"Used for CTAs, highlights and primary focus states."},{key:"secondary_color",label:"Secondary Color",description:"Used for gradients, hover states and charts."},{key:"tertiary_color",label:"Tertiary Color",description:"Used for gradients and subtle accents."}],Q=e=>{switch(e){case"super_admin":return"bg-purple-100 text-purple-700 border-purple-200";case"admin":return"bg-blue-100 text-blue-700 border-blue-200";case"base_admin":return"bg-orange-100 text-orange-700 border-orange-200";default:return"bg-green-50 text-green-700 border-green-200"}},_=e=>{switch(e){case"super_admin":return"SUPER ADMIN";case"admin":return"LOAN MANAGER";case"base_admin":return"LOAN OFFICER";default:return"CLIENT"}},D=(e,t={})=>{const{sizeClass:a="w-10 h-10",textClass:s="text-sm"}=t,r=e.full_name||"U";return e.avatar_url?`<img src="${e.avatar_url}" class="${a} rounded-full object-cover border border-gray-200 shadow-sm" alt="${r}">`:`
    <div class="${a} rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center ${s} font-bold text-gray-600">
      ${r.charAt(0).toUpperCase()}
    </div>
  `},i=(e,t="success")=>{let a=document.getElementById("toast-container");a||(a=document.createElement("div"),a.id="toast-container",a.className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none",document.body.appendChild(a));const s=document.createElement("div"),r=t==="success"?"bg-gray-900 text-white":"bg-red-600 text-white",d=t==="success"?'<i class="fa-solid fa-check-circle"></i>':'<i class="fa-solid fa-circle-exclamation"></i>';s.className=`${r} px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transform transition-all duration-300 translate-y-4 opacity-0 min-w-[300px] pointer-events-auto`,s.innerHTML=`${d}<span class="font-medium text-sm">${e}</span>`,a.appendChild(s),requestAnimationFrame(()=>s.classList.remove("translate-y-4","opacity-0")),setTimeout(()=>{s.classList.add("opacity-0","translate-y-2"),setTimeout(()=>s.remove(),300)},3e3)},Z=(e=[])=>Array.isArray(e)?e.map((t={})=>({title:typeof t.title=="string"?t.title:"",text:typeof t.text=="string"?t.text:""})):[],S=e=>{const t=g.carousel_slides||[],a=Z(Array.isArray(e)&&e.length?e:t),s=t.length||3;for(;a.length<s;){const r=t[a.length]||{title:"",text:""};a.push({...r})}return a.slice(0,s).map((r,d)=>({title:r.title?.trim()||t[d]?.title||"",text:r.text?.trim()||t[d]?.text||""}))},v=(e,t=!1)=>typeof e=="boolean"?e:typeof e=="string"?e.toLowerCase()==="true":t,f=e=>{if(!e)return null;let t=e.trim().replace("#","");return t.length===3&&(t=t.split("").map(a=>a+a).join("")),/^[0-9A-Fa-f]{6}$/.test(t)?`#${t.toUpperCase()}`:null},F=e=>(typeof e=="string"?e.trim():"")||g.company_name,m=(e={})=>({...g,...e,company_name:F(e?.company_name),auth_overlay_color:f(e?.auth_overlay_color)||g.auth_overlay_color,auth_overlay_enabled:v(e?.auth_overlay_enabled,g.auth_overlay_enabled),auth_background_flip:v(e?.auth_background_flip,g.auth_background_flip),carousel_slides:S(e?.carousel_slides)}),C=()=>S(n?.carousel_slides||[]),T=(e="")=>(e||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;"),ee=(e="")=>(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),te=()=>{$.forEach(({key:t})=>{const a=document.querySelector(`[data-color-picker="${t}"]`),s=document.querySelector(`[data-color-input="${t}"]`);a&&(a.value=n[t]),s&&(s.value=n[t])});const e=document.getElementById("brand-gradient-preview");e&&(e.style.backgroundImage=`linear-gradient(120deg, ${n.primary_color}, ${n.secondary_color}, ${n.tertiary_color})`),document.querySelectorAll("[data-theme-mode]").forEach(t=>{t.dataset.themeMode===n.theme_mode?(t.classList.add("bg-gray-900","text-white","shadow"),t.classList.remove("text-gray-600","bg-white")):(t.classList.remove("bg-gray-900","text-white","shadow"),t.classList.add("text-gray-600","bg-white"))}),oe(),le(),ne(),de(),E()},E=()=>{const e=document.getElementById("save-system-settings"),t=document.getElementById("system-settings-status");e&&(e.disabled=!h||w,e.innerHTML=w?'<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Saving':"Save Changes"),t&&(t.textContent=h?"Unsaved changes":"Theme saved",t.className=h?"text-xs text-orange-600 font-bold":"text-xs text-green-600 font-bold")},ae=()=>{h=!0,E()},p=e=>{const t={...e};e.carousel_slides&&(t.carousel_slides=S(e.carousel_slides)),n=m({...n,...t}),ae(),z(n),te()},re=()=>(n.company_logo_url||"").trim(),se=()=>(n.auth_background_url||"").trim(),oe=()=>{const e=re(),t=document.getElementById("company-logo-preview"),a=document.getElementById("company-logo-empty"),s=document.getElementById("remove-logo-btn"),r=document.getElementById("logo-url-input");t&&(e?(t.src=e,t.classList.remove("hidden"),a&&a.classList.add("hidden")):(t.src="",t.classList.add("hidden"),a&&a.classList.remove("hidden"))),s&&(s.disabled=!e||J),r&&document.activeElement!==r&&(r.value=e)},le=()=>{const e=se(),t=v(n.auth_background_flip,!1),a=document.getElementById("auth-bg-preview"),s=document.getElementById("auth-bg-empty"),r=document.getElementById("wallpaper-flip-toggle"),d=document.getElementById("remove-wallpaper-btn"),l=document.getElementById("wallpaper-url-input");a&&(a.style.backgroundImage=e?`url('${e}')`:"none",a.style.transform=t?"scaleX(-1)":"scaleX(1)",s&&s.classList.toggle("hidden",!!e)),r&&(r.checked=t),d&&(d.disabled=!e||K),l&&document.activeElement!==l&&(l.value=e)},ne=()=>{const e=f(n.auth_overlay_color)||g.auth_overlay_color,t=v(n.auth_overlay_enabled,!0),a=document.getElementById("overlay-color-picker"),s=document.getElementById("overlay-color-input"),r=document.getElementById("overlay-disable-toggle");a&&(a.value=e),s&&(s.value=e),r&&(r.checked=!t)},de=()=>{C().forEach((t,a)=>{const s=document.querySelector(`[data-carousel-field="title"][data-carousel-index="${a}"]`),r=document.querySelector(`[data-carousel-field="text"][data-carousel-index="${a}"]`);s&&s!==document.activeElement&&(s.value=t.title),r&&r!==document.activeElement&&(r.value=t.text)})};function ie(){const e=document.getElementById("main-content");if(!e)return;e.innerHTML=`
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
      <div class="flex border-b border-gray-200 bg-gray-50/50 px-6 overflow-x-auto">
        <button class="tab-btn active" data-tab="profile"><i class="fa-solid fa-id-card mr-2"></i>My Profile</button>
        <button class="tab-btn" data-tab="security"><i class="fa-solid fa-shield-halved mr-2"></i>Security</button>
        ${B==="super_admin"?`
          <button class="tab-btn" data-tab="users"><i class="fa-solid fa-users-gear mr-2"></i>User Management</button>
          <button class="tab-btn" data-tab="billing"><i class="fa-solid fa-credit-card mr-2"></i>Billing</button>
          <button class="tab-btn" data-tab="system"><i class="fa-solid fa-sliders mr-2"></i>System Branding</button>
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
    .tab-btn:hover { color: #111827; background: #F3F4F6; }
    .tab-btn.active { color: #EA580C; border-bottom-color: #EA580C; background: #FFF; }
  `,document.head.appendChild(t),ce(),U()}function ce(){const e=document.querySelectorAll(".tab-btn");e.forEach(a=>{a.onclick=()=>{e.forEach(r=>r.classList.remove("active")),a.classList.add("active");const s=a.dataset.tab;s==="profile"?U():s==="security"?ue():s==="users"?M():s==="billing"?pe():s==="system"&&ge()}});const t=document.getElementById("role-form");t&&t.addEventListener("submit",async a=>{a.preventDefault();const s=document.getElementById("modal-user-id").value,r=document.getElementById("modal-role-select").value;try{const{error:d}=await q(s,r);if(d)throw new Error(d);i("Role updated successfully","success"),document.getElementById("role-modal").classList.add("hidden"),M()}catch(d){i(d.message,"error")}})}function U(){const e=document.getElementById("tab-content");e.innerHTML=`
        <div class="max-w-2xl animate-fade-in">
            <h2 class="text-2xl font-bold text-gray-900 mb-1">My Profile</h2>
            <p class="text-sm text-gray-500 mb-8">Manage your personal account details.</p>
            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div class="flex items-center gap-6 mb-8">
                    <div class="relative group cursor-pointer w-20 h-20">
                        ${D({...u,avatar_url:u.avatar_url},{sizeClass:"w-20 h-20",textClass:"text-2xl"})} 
                        <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i class="fa-solid fa-camera text-white"></i>
                        </div>
                        <input type="file" id="avatar-input" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*">
                        <div id="avatar-spinner" class="absolute inset-0 w-full h-full bg-black/70 rounded-full flex items-center justify-center hidden"><i class="fa-solid fa-spinner fa-spin text-white"></i></div>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">${u.full_name||"User"}</h3>
                        <p class="text-sm text-gray-500">${u.email||""}</p>
                        <span class="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase border border-gray-200">
                            ${_(u.role)}
                        </span>
                    </div>
                </div>
                <form id="profile-form" class="space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label>
                            <input type="text" id="prof-name" value="${u.full_name||""}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Contact Number</label>
                            <input type="text" id="prof-phone" value="${u.contact_number||""}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                        </div>
                    </div>
                    <div class="flex justify-end pt-4">
                        <button type="submit" id="save-profile" class="px-6 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black shadow-lg transition-all">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `,document.getElementById("profile-form").addEventListener("submit",async t=>{t.preventDefault();const a=document.getElementById("save-profile"),s=a.innerHTML;a.disabled=!0,a.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';try{const r={full_name:document.getElementById("prof-name").value,contact_number:document.getElementById("prof-phone").value},{error:d}=await O(r);if(d)throw new Error(d);u={...u,...r},i("Profile Updated","success")}catch(r){i(r.message,"error")}finally{a.disabled=!1,a.innerHTML=s}}),document.getElementById("avatar-input").addEventListener("change",async t=>{const a=t.target.files[0];if(a){document.getElementById("avatar-spinner").classList.remove("hidden");try{const s=a.name.split(".").pop(),r=`${u.id}/${Date.now()}.${s}`,{error:d}=await y.storage.from("avatars").upload(r,a,{upsert:!0});if(d)throw d;const{data:l}=y.storage.from("avatars").getPublicUrl(r);await W(l.publicUrl),u.avatar_url=l.publicUrl,U(),i("Avatar updated","success")}catch(s){i("Failed to upload: "+s.message,"error")}finally{}}})}function ue(){const e=document.getElementById("tab-content");e.innerHTML=`
        <div class="max-w-2xl animate-fade-in">
            <h2 class="text-2xl font-bold text-gray-900 mb-1">Security</h2>
            <p class="text-sm text-gray-500 mb-8">Update your password and security settings.</p>
            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
    `,document.getElementById("security-form").addEventListener("submit",async t=>{t.preventDefault();const a=document.getElementById("sec-pass").value,s=document.getElementById("sec-confirm").value;if(a!==s)return i("Passwords do not match","error");if(a.length<6)return i("Password too short (min 6 chars)","error");const{error:r}=await y.auth.updateUser({password:a});r?i(r.message,"error"):(i("Password updated successfully","success"),t.target.reset())})}async function M(){const e=document.getElementById("tab-content");if(e){e.innerHTML=`
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 class="text-2xl font-bold text-gray-900">User Management</h2>
            <p class="text-sm text-gray-500">Manage permissions and roles for all users.</p>
        </div>
        <div class="relative w-full sm:w-72">
            <input type="text" id="user-search" placeholder="Search users..." 
                   class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm transition-shadow">
            <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
        </div>
    </div>
    
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto custom-scrollbar">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User Identity</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">System ID</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Current Role</th>
                        <th class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody id="user-management-list" class="bg-white divide-y divide-gray-200">
                    <tr><td colspan="4" class="p-12 text-center text-gray-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br>Loading directory...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
    <div class="mt-4 text-xs text-gray-400 text-right" id="user-count"></div>
  `;try{const t=await Y();k=Array.isArray(t)?t:[];const a=s=>{const r=document.getElementById("user-management-list"),d=document.getElementById("user-count");if(d&&(d.textContent=`Showing ${s.length} users`),s.length===0){r.innerHTML='<tr><td colspan="4" class="p-8 text-center text-sm text-gray-500">No users found.</td></tr>';return}r.innerHTML=s.map(l=>{const I=u?.id===l.id;return`
              <tr class="hover:bg-gray-50 transition-colors group">
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                          ${D(l,{sizeClass:"w-9 h-9",textClass:"text-xs"})}
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
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${Q(l.role)}">
                          ${_(l.role)}
                      </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                      ${I?'<span class="text-xs text-gray-400 italic">Current User</span>':`
                      <button class="change-role-btn text-gray-600 hover:text-orange-600 font-bold text-xs bg-white border border-gray-200 hover:border-orange-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm inline-flex items-center gap-2"
                          data-user-id="${l.id}" 
                          data-user-name="${l.full_name||"User"}" 
                          data-user-role="${l.role}">
                          <i class="fa-solid fa-user-tag"></i> Change Role
                      </button>`}
                  </td>
              </tr>
            `}).join(""),r.querySelectorAll(".change-role-btn").forEach(l=>{l.onclick=()=>{document.getElementById("modal-user-id").value=l.dataset.userId,document.getElementById("modal-user-name").textContent=l.dataset.userName,document.getElementById("modal-current-role").textContent=_(l.dataset.userRole),document.getElementById("modal-role-select").value=l.dataset.userRole,document.getElementById("role-modal").classList.remove("hidden")}})};a(k),document.getElementById("user-search").addEventListener("input",s=>{const r=s.target.value.toLowerCase(),d=k.filter(l=>(l.full_name||"").toLowerCase().includes(r)||(l.email||"").toLowerCase().includes(r)||(l.id||"").toLowerCase().includes(r));a(d)})}catch(t){console.error(t),document.getElementById("user-management-list").innerHTML=`<tr><td colspan="4" class="p-8 text-center text-red-600">Error: ${t.message}</td></tr>`}}}window.openRoleModal=(e,t,a)=>{document.getElementById("modal-user-id").value=e,document.getElementById("modal-user-name").textContent=t,document.getElementById("modal-current-role").textContent=_(a),document.getElementById("modal-role-select").value=a,document.getElementById("role-modal").classList.remove("hidden")};async function pe(){const e=document.getElementById("tab-content");e.innerHTML=`
        <div class="max-w-4xl animate-fade-in">
            <h2 class="text-2xl font-bold text-gray-900 mb-1">Billing & Payments</h2>
            <p class="text-sm text-gray-500 mb-8">Manage disbursement methods.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 class="font-bold text-gray-800 mb-4">Add Payment Method</h3>
                    <form id="card-form" class="space-y-4">
                        <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Card Type</label><select id="card-type" class="w-full border-gray-300 rounded-lg text-sm p-2.5"><option value="visa">Visa</option><option value="mastercard">Mastercard</option></select></div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Last 4 Digits</label><input type="text" id="card-last4" maxlength="4" class="w-full border-gray-300 rounded-lg text-sm p-2.5" placeholder="1234"></div>
                        <div class="grid grid-cols-2 gap-4"><input type="text" id="card-mm" maxlength="2" placeholder="MM" class="w-full border-gray-300 rounded-lg text-sm p-2.5"><input type="text" id="card-yy" maxlength="4" placeholder="YYYY" class="w-full border-gray-300 rounded-lg text-sm p-2.5"></div>
                        <button type="submit" class="w-full py-2.5 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black mt-2">Add Card</button>
                    </form>
                </div>
                <div class="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <h3 class="font-bold text-gray-800 mb-4">Saved Cards</h3>
                    <div id="cards-list" class="space-y-3"><p class="text-sm text-gray-400 italic">Loading...</p></div>
                </div>
            </div>
        </div>
    `;const t=async()=>{const{data:a}=await G(),s=document.getElementById("cards-list");if(!a||a.length===0){s.innerHTML='<p class="text-sm text-gray-400 italic">No cards saved.</p>';return}s.innerHTML=a.map(r=>`
            <div class="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <i class="fa-brands fa-cc-${r.card_type} text-2xl text-gray-600"></i>
                <div class="flex-1"><p class="text-sm font-bold text-gray-800">•••• ${r.last_four}</p><p class="text-xs text-gray-500">Exp: ${r.expiry_month}/${r.expiry_year}</p></div>
                ${r.is_default?'<span class="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase">Default</span>':""}
            </div>
        `).join("")};t(),document.getElementById("card-form").addEventListener("submit",async a=>{a.preventDefault();const s={p_card_type:document.getElementById("card-type").value,p_last_four:document.getElementById("card-last4").value,p_expiry_month:document.getElementById("card-mm").value,p_expiry_year:document.getElementById("card-yy").value},{error:r}=await V(s);r?i(r.message,"error"):(i("Card Added","success"),a.target.reset(),t())})}async function ge(){const e=document.getElementById("tab-content");if(!e)return;try{const{data:o}=await P();o&&(x=m(o),n=m(o))}catch(o){console.error("Settings Sync Error:",o)}const t=n.company_logo_url||"",a=n.auth_background_url||"",s=T(F(n.company_name)),r=f(n.auth_overlay_color)||g.auth_overlay_color,d=!v(n.auth_overlay_enabled,!0),l=v(n.auth_background_flip,!1),I=C();e.innerHTML=`
        <div class="max-w-5xl space-y-8 animate-fade-in">
            <div class="flex items-center justify-between">
                <div><h2 class="text-2xl font-bold text-gray-900">System Branding</h2><p class="text-sm text-gray-500">Customize the look and feel of the platform.</p></div>
                <div class="text-right">
                    <button id="save-system-settings" class="px-6 py-2.5 bg-brand-accent text-white font-bold rounded-xl shadow-lg hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Save Changes</button>
                    <p id="system-settings-status" class="text-xs text-gray-400 mt-2 font-medium">No pending changes</p>
                </div>
            </div>

            <section class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h4 class="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Company Identity</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Name</label>
                        <input type="text" id="company-name-input" value="${s}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Logo</label>
                        <div class="flex flex-col lg:flex-row gap-4">
                            <div class="h-20 w-20 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                ${t?`<img src="${t}" class="h-full w-full object-contain">`:'<i class="fa-solid fa-image text-gray-300 text-2xl"></i>'}
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

            <section class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h4 class="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Theme Colors</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${$.map(o=>`
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">${o.label}</label>
                            <div class="flex items-center gap-2">
                                <input type="color" data-color-picker="${o.key}" value="${n[o.key]}" class="h-10 w-10 rounded cursor-pointer border border-gray-300 p-0 overflow-hidden">
                                <input type="text" data-color-input="${o.key}" value="${n[o.key]}" class="flex-1 border-gray-300 rounded-lg p-2 text-sm font-mono uppercase focus:ring-orange-500">
                            </div>
                        </div>`).join("")}
                </div>
                <div class="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-4">
                    <span class="text-xs font-bold text-gray-500 uppercase">Preview:</span>
                    <div id="brand-gradient-preview" class="flex-1 h-8 rounded-lg shadow-inner" style="background: linear-gradient(90deg, ${n.primary_color}, ${n.secondary_color}, ${n.tertiary_color})"></div>
                </div>
            </section>

            <section class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h4 class="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Login Styling</h4>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Wallpaper</label>
                        <div id="auth-bg-preview" class="h-40 rounded-xl border border-gray-300 bg-gray-100 flex items-center justify-center relative overflow-hidden bg-cover bg-center mb-3" style="background-image: ${a?`url('${a}')`:"none"}; transform: scaleX(${l?"-1":"1"});">
                             ${a?"":'<span class="text-xs text-gray-400 font-bold">Default</span>'}
                        </div>
                        <div class="space-y-3">
                            <div class="flex gap-2">
                                <label class="cursor-pointer px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black">
                                    <i class="fa-solid fa-cloud-arrow-up mr-1"></i> Upload
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
                                <input type="color" id="overlay-color-picker" value="${r}" class="h-10 w-10 rounded border border-gray-300 cursor-pointer">
                                <input type="text" id="overlay-color-input" value="${r}" class="w-32 border-gray-300 rounded-lg p-2 text-sm font-mono uppercase">
                            </div>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="overlay-disable-toggle" class="rounded text-orange-600" ${d?"checked":""}>
                            <span class="text-sm font-medium text-gray-700">Disable Overlay</span>
                        </label>
                    </div>
                </div>
            </section>

            <section class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h4 class="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Login Text</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${I.map((o,c)=>`
                        <div class="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Slide ${c+1}</span>
                            <input type="text" value="${T(o.title)}" data-carousel-index="${c}" data-carousel-field="title" class="w-full border-gray-300 rounded-lg text-sm font-bold p-2 focus:ring-orange-500" placeholder="Title">
                            <textarea rows="3" data-carousel-index="${c}" data-carousel-field="text" class="w-full border-gray-300 rounded-lg text-xs p-2 focus:ring-orange-500 resize-none" placeholder="Description">${ee(o.text)}</textarea>
                        </div>
                    `).join("")}
                </div>
            </section>
        </div>
    `,$.forEach(({key:o})=>{document.querySelector(`[data-color-picker="${o}"]`)?.addEventListener("input",c=>{const b=f(c.target.value);b&&p({[o]:b})}),document.querySelector(`[data-color-input="${o}"]`)?.addEventListener("change",c=>{const b=f(c.target.value);b&&p({[o]:b})})}),document.getElementById("company-name-input")?.addEventListener("input",o=>p({company_name:o.target.value})),document.getElementById("wallpaper-flip-toggle")?.addEventListener("change",o=>p({auth_background_flip:o.target.checked})),document.getElementById("overlay-disable-toggle")?.addEventListener("change",o=>p({auth_overlay_enabled:!o.target.checked})),document.getElementById("overlay-color-picker")?.addEventListener("input",o=>{const c=f(o.target.value);c&&p({auth_overlay_color:c})}),document.querySelectorAll("[data-carousel-field]").forEach(o=>{o.addEventListener("input",c=>{const b=parseInt(c.target.dataset.carouselIndex),H=c.target.dataset.carouselField,L=[...C()];L[b]={...L[b],[H]:c.target.value},p({carousel_slides:L})})}),document.getElementById("save-system-settings")?.addEventListener("click",async()=>{if(w)return;w=!0,E();const{data:o,error:c}=await X(n);c?i("Failed to save: "+c,"error"):(i("System settings saved!","success"),x=m(o),n=m(o),h=!1,A(x)),w=!1,E()}),document.getElementById("logo-file-input")?.addEventListener("change",me),document.getElementById("remove-logo-btn")?.addEventListener("click",()=>{p({company_logo_url:null}),i("Logo removed (pending save).","success")}),document.getElementById("apply-logo-url")?.addEventListener("click",()=>{const o=document.getElementById("logo-url-input").value.trim();o&&(p({company_logo_url:o}),i("Logo link applied. Save to confirm.","success"))}),document.getElementById("wallpaper-file-input")?.addEventListener("change",be),document.getElementById("remove-wallpaper-btn")?.addEventListener("click",()=>{p({auth_background_url:null}),i("Wallpaper removed (pending save).","success")}),document.getElementById("apply-wallpaper-url")?.addEventListener("click",()=>{const o=document.getElementById("wallpaper-url-input").value.trim();o&&(p({auth_background_url:o}),i("Wallpaper link applied. Save to confirm.","success"))}),E()}async function me(e){const t=e.target.files[0];if(t)try{const a=t.name.split(".").pop(),s=`system/logo_${Date.now()}.${a}`,{error:r}=await y.storage.from("avatars").upload(s,t);if(r)throw r;const{data:d}=y.storage.from("avatars").getPublicUrl(s);p({company_logo_url:d.publicUrl}),i("Logo uploaded successfully!","success")}catch(a){i("Upload failed: "+a.message,"error")}}async function be(e){const t=e.target.files[0];if(t)try{const a=t.name.split(".").pop(),s=`system/wallpaper_${Date.now()}.${a}`,{error:r}=await y.storage.from("avatars").upload(s,t);if(r)throw r;const{data:d}=y.storage.from("avatars").getPublicUrl(s);p({auth_background_url:d.publicUrl}),i("Wallpaper uploaded successfully!","success")}catch(a){i("Upload failed: "+a.message,"error")}}async function ye(){try{const{data:e}=await P();e&&(x=m(e),n=m(e),A(x))}catch(e){console.error("Init Settings Error:",e)}}document.addEventListener("DOMContentLoaded",async()=>{const e=await N();if(e){if(B=e.role,u=e.profile,B==="super_admin")await ye();else{await j();const t=R();if(t){const a=m(t);x=a,n=m(a)}}ie()}});
