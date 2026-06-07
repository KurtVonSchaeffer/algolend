import{s as d}from"./supabaseClient-Ki9k9WNi.js";import{i as w}from"./layout-P4Epjfxm.js";/* empty css               */let r=null,p=null;document.addEventListener("DOMContentLoaded",async()=>{await w(),g()});function g(){const e=document.getElementById("main-content");e&&(e.innerHTML=`
                <div class="steps-container">
                    <div class="steps-wrapper">
                        <div class="step-item active">
                            <div class="step-circle">1</div>
                            <div class="step-label">Applicant Info</div>
                        </div>
                        <div class="step-item">
                            <div class="step-circle">2</div>
                            <div class="step-label">Loan Details</div>
                        </div>
                        <div class="step-item">
                            <div class="step-circle">3</div>
                            <div class="step-label">Financial Info</div>
                        </div>
                        <div class="step-item">
                            <div class="step-circle">4</div>
                            <div class="step-label">Review & Submit</div>
                        </div>
                    </div>
                </div>

                <div class="content-card">
                    <div class="content-header">
                        <h1><i class="fas fa-user-plus"></i> Select Applicant</h1>
                        <p>Search and select an existing user to create a loan application</p>
                    </div>
                    
                    <div class="content-body">
                        <form id="step1-form">
                        <div class="form-section">
                            <h2 class="form-section-title">Find Applicant</h2>
                            
                            <div class="form-group">
                                <label class="form-label">Search by Name or Email</label>
                                <div class="search-container">
                                    <div class="search-input-wrapper">
                                        <i class="fas fa-search search-icon"></i>
                                        <input 
                                            type="text" 
                                            id="user-search" 
                                            class="form-input search-input" 
                                            placeholder="Start typing to search..."
                                            autocomplete="off"
                                        >
                                    </div>
                                    <div id="search-results" class="search-results" style="display: none;"></div>
                                </div>
                                <p class="helper-text">
                                    <i class="fas fa-info-circle"></i> 
                                    Search for an existing user or create a new one below
                                </p>
                                <div id="selected-user-display"></div>
                            </div>

                            <!-- OR Divider -->
                            <div style="display: flex; align-items: center; gap: 1rem; margin: 2rem 0;">
                                <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
                                <span style="color: #6b7280; font-size: 0.875rem; font-weight: 600;">OR</span>
                                <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
                            </div>

                            <!-- Create New User Button -->
                            <div style="text-align: center;">
                                <button type="button" id="create-new-user-btn" class="btn btn-secondary" style="width: 100%;">
                                    <i class="fas fa-user-plus"></i>
                                    Create New User
                                </button>
                            </div>
                        </div>

                        <!-- New User Form (Hidden by default) -->
                        <div id="new-user-form-section" class="form-section" style="display: none;">
                            <h2 class="form-section-title">
                                <i class="fas fa-user-plus"></i> New User Details
                                <button type="button" id="cancel-new-user-btn" class="btn btn-secondary" style="float: right; padding: 0.5rem 1rem; font-size: 0.875rem;">
                                    <i class="fas fa-times"></i> Cancel
                                </button>
                            </h2>
                            
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">Full Name *</label>
                                    <input type="text" id="new-full-name" class="form-input" placeholder="e.g., John Doe" required>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Email *</label>
                                    <input type="email" id="new-email" class="form-input" placeholder="e.g., john@example.com" required>
                                </div>
                            </div>

                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">Phone Number *</label>
                                    <input type="tel" id="new-phone" class="form-input" placeholder="e.g., 0812345678" required>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">ID Number *</label>
                                    <input type="text" id="new-id-number" class="form-input" placeholder="e.g., 9001010000000" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Temporary Password *</label>
                                <input type="text" id="new-password" class="form-input" placeholder="Will be sent to user's email" value="" required>
                                <p class="helper-text">
                                    <i class="fas fa-key"></i> User will need to change this on first login
                                </p>
                            </div>

                            <button type="button" id="save-new-user-btn" class="btn btn-primary" style="width: 100%;">
                                <i class="fas fa-save"></i>
                                Create User & Continue
                            </button>
                        </div>                            <div class="actions">
                                <button type="button" class="btn btn-secondary" onclick="window.location.href='/admin/applications'">
                                    <i class="fas fa-arrow-left"></i>
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary" id="next-btn" disabled>
                                    Next: Loan Details
                                    <i class="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `,E())}function E(){const e=document.getElementById("user-search"),s=document.getElementById("step1-form"),t=document.getElementById("create-new-user-btn"),a=document.getElementById("cancel-new-user-btn"),n=document.getElementById("save-new-user-btn");e?.addEventListener("input",U),s?.addEventListener("submit",L),t?.addEventListener("click",I),a?.addEventListener("click",v),n?.addEventListener("click",B);const l=document.getElementById("new-password");l&&(l.value=h())}function I(){document.getElementById("new-user-form-section").style.display="block",document.getElementById("create-new-user-btn").style.display="none",document.getElementById("user-search").disabled=!0,r&&removeUser()}function v(){document.getElementById("new-user-form-section").style.display="none",document.getElementById("create-new-user-btn").style.display="block",document.getElementById("user-search").disabled=!1,document.getElementById("new-full-name").value="",document.getElementById("new-email").value="",document.getElementById("new-phone").value="",document.getElementById("new-id-number").value="",document.getElementById("new-password").value=h()}function h(){const e="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";let s="";for(let t=0;t<12;t++)s+=e.charAt(Math.floor(Math.random()*e.length));return s}async function B(){const e=document.getElementById("new-full-name").value.trim(),s=document.getElementById("new-email").value.trim(),t=document.getElementById("new-phone").value.trim(),a=document.getElementById("new-id-number").value.trim(),n=document.getElementById("new-password").value.trim();if(!e||!s||!t||!a||!n){alert("Please fill in all required fields");return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)){alert("Please enter a valid email address");return}const i=document.getElementById("save-new-user-btn"),f=i.innerHTML;i.disabled=!0,i.innerHTML='<i class="fas fa-spinner fa-spin"></i> Creating User...';try{const{data:c,error:u}=await d.auth.signUp({email:s,password:n,options:{data:{full_name:e,phone:t,id_number:a,role:"borrower"}}});if(u)throw u.message.includes("already registered")?new Error("A user with this email already exists"):u;const o=c.user?.id;if(o){const{data:b}=await d.from("profiles").select("id").eq("id",o).single();if(!b){const{error:m}=await d.from("profiles").insert([{id:o,full_name:e,email:s,phone:t,id_number:a,role:"borrower"}]);m&&!m.message.includes("duplicate")&&console.error("Profile creation error:",m)}}const y={id:o,full_name:e,email:s,phone:t,role:"borrower"};selectUser(y),v(),alert(`User created successfully!

Email: ${s}
Password: ${n}

Please share these credentials with the user.`)}catch(c){console.error("Error creating user:",c),alert(`Error creating user: ${c.message}`),i.disabled=!1,i.innerHTML=f}finally{i.disabled||(i.disabled=!1,i.innerHTML=f)}}async function U(e){const s=e.target.value.trim(),t=document.getElementById("search-results");if(s.length<2){t.style.display="none";return}clearTimeout(p),p=setTimeout(async()=>{try{t.innerHTML='<div class="search-result-item"><i class="fas fa-spinner fa-spin"></i> Searching...</div>',t.style.display="block";const{data:a,error:n}=await d.from("profiles").select("id, full_name, email, phone, role").or(`full_name.ilike.%${s}%,email.ilike.%${s}%`).eq("role","borrower").limit(10);if(n){console.error("Search error:",n),t.innerHTML=`
                            <div class="search-result-item" style="color: #ef4444;">
                                <i class="fas fa-exclamation-circle"></i> 
                                Search error. Please try again.
                            </div>
                        `;return}if(!a||a.length===0){t.innerHTML=`
                            <div class="search-result-item" style="color: #6b7280;">
                                <i class="fas fa-info-circle"></i> 
                                No users found. Try creating a new user below.
                            </div>
                        `;return}x(a)}catch(a){console.error("Search error:",a),t.innerHTML=`
                        <div class="search-result-item" style="color: #ef4444;">
                            <i class="fas fa-exclamation-circle"></i> 
                            Error: ${a.message}
                        </div>
                    `}},300)}function x(e){const s=document.getElementById("search-results");s.innerHTML=e.map(t=>{const a=t.full_name?t.full_name.charAt(0).toUpperCase():"U";return`
                    <div class="search-result-item" onclick='selectUser(${JSON.stringify(t)})'>
                        <div class="search-result-avatar">${a}</div>
                        <div class="search-result-info">
                            <div class="search-result-name">${t.full_name||"Unknown"}</div>
                            <div class="search-result-email">${t.email}</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: #d1d5db;"></i>
                    </div>
                `}).join(""),s.style.display="block"}window.selectUser=function(e){r=e;const s=document.getElementById("search-results"),t=document.getElementById("selected-user-display"),a=document.getElementById("next-btn"),n=document.getElementById("user-search");s.style.display="none",n.value="";const l=e.full_name?e.full_name.charAt(0).toUpperCase():"U";t.innerHTML=`
                <div class="selected-user-card">
                    <div class="search-result-avatar">${l}</div>
                    <div class="search-result-info">
                        <div class="search-result-name">${e.full_name||"Unknown"}</div>
                        <div class="search-result-email">${e.email}</div>
                    </div>
                    <button type="button" class="remove-btn" onclick="removeUser()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `,a.disabled=!1};window.removeUser=function(){r=null,document.getElementById("selected-user-display").innerHTML="",document.getElementById("next-btn").disabled=!0};function L(e){if(e.preventDefault(),!r){alert("Please select an applicant");return}sessionStorage.setItem("newApplication",JSON.stringify({step:1,user:r})),window.location.href="/admin/create-application-step2"}
