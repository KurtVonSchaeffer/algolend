import{s as b}from"./supabaseClient-Ki9k9WNi.js";import{i as V}from"./layout-P4Epjfxm.js";/* empty css               */import{b as h,a as p}from"./utils-D6Z1B7Jq.js";import{t as C,v as Y,w as z,x as J}from"./dataService-OY041MzK.js";const I="/api/docuseal",Q=void 0;function q(){return!!Q}async function G(a,e){try{if(!q())throw new Error("DocuSeal integration is disabled");const t=await fetch(`${I}/send-contract`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationData:a,profileData:e})});if(!t.ok){const n=await t.json().catch(()=>({}));throw console.error("DocuSeal proxy error:",t.status,n),new Error(n.error||n.message||`Failed to send contract: ${t.status}`)}const s=await t.json();if(!s||!Array.isArray(s)||s.length===0)throw new Error("Invalid response from DocuSeal API");const r=s[0];return await ee(r,a.id),{submission_id:r.submission_id,submitter_id:r.id,slug:r.slug,status:r.status,embed_src:r.embed_src,email:r.email}}catch(t){throw console.error("DocuSeal send contract error:",t),t}}async function X(a){try{const e=await fetch(`${I}/submissions/${a}`);if(!e.ok){const t=await e.json().catch(()=>({}));throw new Error(t.error||t.message||`Failed to fetch submission status: ${e.status}`)}return await e.json()}catch(e){throw console.error("DocuSeal get status error:",e),e}}async function W(a){try{const e=await fetch(`${I}/submitters/${a}`);if(!e.ok){const t=await e.json().catch(()=>({}));throw new Error(t.error||t.message||`Failed to fetch submitter details: ${e.status}`)}return await e.json()}catch(e){throw console.error("DocuSeal get submitter error:",e),e}}async function Z(a){try{const{data:e,error:t}=await b.from("docuseal_submissions").select("*").eq("application_id",a).order("created_at",{ascending:!1});if(t)throw t;return e||[]}catch(e){return console.error("Error fetching submissions:",e),[]}}async function ee(a,e){try{const{error:t}=await b.from("docuseal_submissions").insert({application_id:e,submission_id:a.submission_id,submitter_id:a.id,slug:a.slug,status:a.status||"pending",email:a.email,name:a.name,role:a.role,embed_src:a.embed_src,sent_at:a.sent_at,opened_at:a.opened_at,completed_at:a.completed_at,metadata:a.metadata||{},created_at:new Date().toISOString()});if(t)throw t}catch(t){throw console.error("Error saving submission to database:",t),t}}async function te(a,e,t={}){try{const{error:s}=await b.from("docuseal_submissions").update({status:e,...t,updated_at:new Date().toISOString()}).eq("submission_id",a);if(s)throw s}catch(s){throw console.error("Error updating submission status:",s),s}}async function ae(a,e,t={}){try{const{error:s}=await b.from("docuseal_submissions").update({status:e,...t,updated_at:new Date().toISOString()}).eq("submitter_id",a);if(s)throw s}catch(s){throw console.error("Error updating submitter status:",s),s}}function j(a){return`https://docuseal.co/s/${a}`}async function se(a,e={}){try{const t=await fetch(`${I}/submitters/${a}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({send_email:!0,...e})});if(!t.ok){const r=await t.json().catch(()=>({}));throw new Error(r.error||r.message||`Failed to resend contract: ${t.status}`)}const s=await t.json();return await ae(a,s.status,{sent_at:s.sent_at}),s}catch(t){throw console.error("DocuSeal resend error:",t),t}}async function re(a){try{const e=await fetch(`${I}/submissions/${a}`,{method:"DELETE"});if(!e.ok){const s=await e.json().catch(()=>({}));throw new Error(s.error||s.message||`Failed to archive submission: ${e.status}`)}const t=await e.json();return await te(a,"archived",{archived_at:t.archived_at}),t}catch(e){throw console.error("DocuSeal archive error:",e),e}}async function ne(a,e=null){try{const t=await X(a);if(!t.submitters||t.submitters.length===0)throw new Error("No submitters found for this submission");if(e){const s=t.submitters.find(r=>r.email===e);if(!s)throw new Error(`No submitter found with email: ${e}`);return s.id}return t.submitters[0].id}catch(t){throw console.error("Error getting submitter ID:",t),t}}let i=null,T=null,U=!1,D=null,$=null,L=!1,F=!1;const oe=5e3,ie=[{value:"STARTED",label:"Step 1: New Application"},{value:"BANK_LINKING",label:"Bank Analysis"},{value:"AFFORD_OK",label:"Step 3: Affordability OK"},{value:"AFFORD_REFER",label:"Affordability Refer"},{value:"OFFERED",label:"Step 4: Contract Sent"},{value:"OFFER_ACCEPTED",label:"Contract Signed"},{value:"READY_TO_DISBURSE",label:"Step 6: Queue Disburse"},{value:"DECLINED",label:"Declined"}],de=`
<div id="application-detail-content" class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div id="loading-state" class="text-center p-20">
    <i class="fa-solid fa-circle-notch fa-spin text-4xl text-orange-600"></i>
    <p class="mt-4 text-gray-600 font-medium animate-pulse">Loading Complete Application Data...</p>
  </div>

  <div id="page-header" class="mb-8 hidden animate-fade-in">
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-4">
       <a href="/admin/applications" class="hover:text-orange-600 transition-colors">Applications</a>
       <i class="fa-solid fa-chevron-right text-xs text-gray-400"></i>
       <span id="breadcrumb-name" class="font-medium text-gray-900">Applicant</span>
    </nav>
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
       <div>
         <h1 id="applicant-name-header" class="text-3xl font-extrabold text-gray-900 tracking-tight">Loading...</h1>
         <div class="flex items-center gap-3 mt-2">
            <p class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md font-mono">ID: <span id="header-id-val">...</span></p>
            <span id="header-date" class="text-sm text-gray-500"></span>
         </div>
       </div>
       <span id="header-status-badge" class="px-5 py-2 text-sm font-bold rounded-full bg-gray-200 text-gray-700 shadow-sm uppercase tracking-wide">Status</span>
    </div>
  </div>

  <div id="content-grid" class="grid grid-cols-1 lg:grid-cols-12 gap-8 hidden animate-slide-up">
    
    <div class="lg:col-span-8 flex flex-col gap-6">
      
       <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
         <div class="flex overflow-x-auto scrollbar-hide border-b border-gray-100">
            <button class="tab-btn active flex-1 py-4 px-4 text-sm font-bold text-center border-b-2 border-orange-600 text-orange-600 bg-orange-50/50 transition-all whitespace-nowrap" data-tab="personal">Personal</button>
            <button class="tab-btn flex-1 py-4 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all whitespace-nowrap" data-tab="financial">Financial & Credit</button>
            <button class="tab-btn flex-1 py-4 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all whitespace-nowrap" data-tab="documents">Documents</button>
            <button class="tab-btn flex-1 py-4 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all whitespace-nowrap" data-tab="loan">Loan & History</button>
         </div>
       </div>

       <div id="tab-contents" class="relative min-h-[400px]">
       
          <div id="personal-tab" class="tab-pane bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
             <h3 class="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i class="fa-solid fa-user-circle text-gray-400"></i> Personal Information
             </h3>
             
             <div class="flex flex-col md:flex-row gap-8 mb-8 pb-8 border-b border-gray-100">
                <div class="shrink-0 mx-auto md:mx-0">
                   <div class="w-32 h-32 bg-gray-100 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                      <img id="profile-image" src="" alt="Profile" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=User&background=random'">
                   </div>
                </div>
                <div class="flex-grow grid grid-cols-1 gap-y-5">
                   <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                      <span class="text-sm font-medium text-gray-500">Full Name</span>
                      <div class="sm:col-span-2">
                         <div id="detail-fullname" class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm font-semibold"></div>
                      </div>
                   </div>
                   <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                      <span class="text-sm font-medium text-gray-500">Email Address</span>
                      <div class="sm:col-span-2">
                         <div id="detail-email" class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm"></div>
                      </div>
                   </div>
                   <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                      <span class="text-sm font-medium text-gray-500">Mobile Number</span>
                      <div class="sm:col-span-2">
                         <div id="detail-mobile" class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm"></div>
                      </div>
                   </div>
                </div>
             </div>
             <h4 class="text-md font-bold text-gray-900 mb-4">Linked Bank Accounts</h4>
             <div id="bank-accounts-container" class="space-y-3">
                </div>
          </div>

          <div id="financial-tab" class="tab-pane hidden bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
             <h3 class="text-lg font-bold text-gray-900 mb-6">Financial Snapshot</h3>
             <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="p-5 bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 shadow-sm">
                   <div class="flex items-center gap-3 mb-2">
                      <div class="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center"><i class="fa-solid fa-arrow-trend-up"></i></div>
                      <span class="text-xs font-bold text-green-700 uppercase tracking-wider">Monthly Income</span>
                   </div>
                   <div id="fin-income" class="text-2xl font-bold text-gray-900">R 0.00</div>
                </div>
                <div class="p-5 bg-gradient-to-br from-red-50 to-white rounded-2xl border border-red-100 shadow-sm">
                   <div class="flex items-center gap-3 mb-2">
                      <div class="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center"><i class="fa-solid fa-arrow-trend-down"></i></div>
                      <span class="text-xs font-bold text-red-700 uppercase tracking-wider">Monthly Expenses</span>
                   </div>
                   <div id="fin-expenses" class="text-2xl font-bold text-gray-900">R 0.00</div>
                </div>
             </div>
             <div class="pt-8 border-t border-gray-100">
                <div class="flex justify-between items-center mb-6">
                   <h4 class="text-lg font-bold text-gray-900">Credit Bureau Report</h4>
                   <div class="flex items-center gap-3">
                      <span id="credit-date" class="text-sm text-gray-500 font-medium"></span>
                      <button id="btn-download-xml" class="hidden text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium flex items-center gap-2">
                         <i class="fa-solid fa-file-code"></i> Download XML
                      </button>
                   </div>
                </div>
                <div id="credit-check-content" class="bg-gray-50/50 rounded-2xl border border-gray-200 overflow-hidden">
                   </div>
             </div>
          </div>

          <div id="documents-tab" class="tab-pane hidden bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
             <div class="flex justify-between items-center mb-6">
                <h3 class="text-lg font-bold text-gray-900">All User Documents</h3>
                <span id="doc-count" class="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-md">0</span>
             </div>
             <div id="documents-list" class="grid grid-cols-1 gap-4">
                </div>
          </div>

          <div id="loan-tab" class="tab-pane hidden bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
             <h3 class="text-lg font-bold text-gray-900 mb-6">Current Application Data</h3>
             <div class="space-y-6 mb-10">
                <div class="grid grid-cols-1 sm:grid-cols-3 items-center border-b border-gray-50 pb-4">
                   <span class="text-sm font-medium text-gray-500">Application ID</span>
                   <div class="sm:col-span-2 font-mono text-sm text-gray-900 bg-gray-50 p-2 rounded-md inline-block border border-gray-200" id="detail-app-id"></div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 items-center border-b border-gray-50 pb-4">
                   <span class="text-sm font-medium text-gray-500">Submitted Date</span>
                   <div class="sm:col-span-2 text-sm text-gray-900" id="detail-date"></div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 items-center border-b border-gray-50 pb-4">
                   <span class="text-sm font-medium text-gray-500">Loan Purpose</span>
                   <div class="sm:col-span-2 text-sm text-gray-900 font-medium" id="detail-purpose"></div>
                </div>
                <div class="pt-2">
                   <label class="text-sm font-medium text-gray-700 block mb-2">Admin Notes</label>
                   
                   <textarea id="detail-notes" class="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-gray-700 h-32 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none" placeholder="Add internal notes here..."></textarea>
                   <div class="mt-2 text-right">
                       <button id="btn-save-notes" class="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-black transition-all shadow-sm">
                           <i class="fa-solid fa-floppy-disk mr-1"></i> Save Notes
                       </button>
                   </div>

                </div>
             </div>
             
             <h3 class="text-lg font-bold text-gray-900 mb-4 border-t border-gray-100 pt-8">Client History</h3>
             <div class="mb-6">
                <h4 class="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wider">Previous Loans</h4>
                <div id="loan-history-list" class="space-y-2">
                   <p class="text-sm text-gray-400 italic">No previous loan history found.</p>
                </div>
             </div>
             <div>
                <h4 class="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wider">Other Applications</h4>
                <div id="app-history-list" class="space-y-2">
                   <p class="text-sm text-gray-400 italic">No other applications on record.</p>
                </div>
             </div>
          </div>
       </div>

           <div id="contract-status-card" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2 text-xs uppercase tracking-wider">
              <i class="fa-solid fa-file-signature text-orange-600"></i> Contract Status
            </h3>
            <div id="contract-status-empty" class="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-6 text-center">
              No contracts sent yet.
            </div>
            <div id="contract-status-section" class="hidden mt-4 border-t border-gray-100 pt-4">
              <h4 class="text-xs font-bold text-gray-400 uppercase mb-3">History</h4>
              <div id="contract-status-content" class="space-y-2">
                </div>
            </div>
           </div>
    </div>

    <div class="lg:col-span-4">
       <div class="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 sticky top-28 overflow-hidden">
          <div class="p-6 border-b border-gray-100 bg-gray-50/50">
             <h3 class="font-bold text-gray-900">Loan Status</h3>
             <div id="status-alert" class="mt-3 p-3 rounded-lg text-xs font-medium leading-relaxed hidden animate-pulse">
                </div>
          </div>

          <div class="p-6 space-y-6">
             <div>
                <label class="text-xs text-gray-500 uppercase font-bold tracking-wider">Requested Amount</label>
                <div id="sidebar-amount" class="text-3xl font-extrabold text-gray-900 mt-1 tracking-tight">R 0.00</div>
             </div>
             <div>
                <label class="text-xs text-gray-500 uppercase font-bold tracking-wider">Term Length</label>
                <div class="mt-2 flex items-center gap-2">
                   <div class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center"><i class="fa-regular fa-calendar"></i></div>
                   <div id="sidebar-term" class="text-lg font-semibold text-gray-800">0 Months</div>
                </div>
             </div>

             <div>
                <label class="text-xs text-gray-500 uppercase font-bold tracking-wider">Est. Monthly Payment</label>
                <div class="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                   <div id="sidebar-payment" class="text-xl font-bold text-gray-800">R 0.00</div>
                   <div class="text-xs text-gray-400 mt-1">(Principal Only)</div>
                </div>
             </div>

             <div id="financial-breakdown" class="pt-4 border-t border-gray-100 space-y-4">
                </div>

             <div>
                <label class="text-xs text-gray-500 uppercase font-bold tracking-wider">Current Status</label>
                <div id="sidebar-status" class="mt-2 text-lg font-bold text-orange-600">Pending</div>
             </div>
          </div>
          
          <div class="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-3" id="action-buttons-container">
              </div>

          <div class="p-6 bg-white border-t border-gray-200">
              <label class="text-xs font-bold text-gray-400 uppercase mb-2 block">Manual Override (Restricted)</label>
              <div class="flex gap-2">
                  <select id="status-override-select" class="flex-1 text-xs border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500">
                      ${ie.map(a=>`<option value="${a.value}">${a.label}</option>`).join("")}
                  </select>
                  <button id="manual-update-btn" onclick="manualStatusChange()" class="px-3 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-black transition">
                      Update
                  </button>
              </div>
              <p id="override-hint" class="text-[10px] text-gray-400 mt-1 italic">Use only for corrections. Bureau statuses locked.</p>
          </div>

       </div>
    </div>
  </div>

  <div id="feedback-container" class="fixed bottom-6 right-6 z-50 hidden"></div>
</div>
`,M=a=>{if(!a)return"bg-gray-100 text-gray-800 border border-gray-200";switch(a){case"READY_TO_DISBURSE":case"approved":case"DISBURSED":case"AFFORD_OK":case"BUREAU_OK":return"bg-green-100 text-green-800 border border-green-200";case"declined":case"DECLINED":case"AFFORD_FAIL":return"bg-red-100 text-red-800 border border-red-200";case"OFFERED":case"OFFER_ACCEPTED":return"bg-purple-100 text-purple-800 border border-purple-200";default:return"bg-yellow-100 text-yellow-800 border border-yellow-200"}},N=a=>{const e=document.getElementById("header-status-badge");!e||!a||(e.textContent=a,e.className=`px-4 py-1.5 text-sm font-bold rounded-full shadow-sm ${M(a)}`)};window.viewBureauReport=a=>{try{const e=atob(a),t=new Array(e.length);for(let o=0;o<e.length;o++)t[o]=e.charCodeAt(o);const s=new Uint8Array(t),r=new Blob([s],{type:"application/pdf"}),n=URL.createObjectURL(r);window.open(n,"_blank")}catch(e){console.error("PDF Render Error:",e),alert("Unable to display the PDF format. Please ensure the bureau data is valid.")}};window.viewTruidReport=()=>{if(!i?.truid_info){u("No TruID data available for this applicant.","error");return}const a=i.truid_info.summary_payload||i.truid_info,e=window.open("","_blank");e.document.write(`
        <html>
            <head>
                <title>TruID Digital Report</title>
                <style>
                    body { font-family: 'Courier New', monospace; background: #f4f7f6; padding: 30px; color: #333; line-height: 1.6; }
                    .container { max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 8px; shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #ddd; }
                    h2 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                    pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 13px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>TruID Verification Payload</h2>
                    <p><strong>Collection ID:</strong> ${i.truid_info.collection_id}</p>
                    <pre>${JSON.stringify(a,null,2)}</pre>
                </div>
            </body>
        </html>
    `),e.document.close()};const u=(a,e="success")=>{const t=document.getElementById("feedback-container");if(!t)return;const s=e==="success";t.innerHTML=`
    <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${s?"bg-white border-green-100":"bg-white border-red-100"} transform transition-all duration-300">
        <div class="w-8 h-8 rounded-full ${s?"bg-green-100 text-green-600":"bg-red-100 text-red-600"} flex items-center justify-center">
            <i class="fa-solid ${s?"fa-check":"fa-exclamation"}"></i>
        </div>
        <div>
            <p class="text-sm font-bold text-gray-900">${s?"Success":"Error"}</p>
            <p class="text-xs text-gray-500">${a}</p>
        </div>
    </div>
  `,t.classList.remove("hidden"),setTimeout(()=>{t.classList.add("hidden")},5e3)},le=async()=>{const a=document.getElementById("contract-status-empty"),e=document.getElementById("contract-status-section");if(!q()){R(),e&&e.classList.add("hidden"),a&&(a.classList.remove("hidden"),a.innerHTML=`
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
          <div class="flex items-start gap-3">
            <i class="fa-solid fa-triangle-exclamation text-yellow-600 text-xl mt-0.5"></i>
            <div>
              <h4 class="font-semibold text-yellow-900 mb-1">DocuSeal Not Configured</h4>
              <p class="text-sm text-yellow-700">
                E-signature features are currently disabled. Please configure DocuSeal API credentials to enable contract tracking.
              </p>
            </div>
          </div>
        </div>
      `);return}a&&(a.classList.remove("hidden"),a.textContent="No contracts sent yet."),await B()},ce=async(a=null)=>{if(!i||!i.profiles){alert("Error: Application data not loaded");return}const e=a||document.getElementById("btn-send-contract"),t=e?e.innerHTML:"";e&&(e.disabled=!0,e.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Sending...');try{const s=await G(i,i.profiles);alert(`✅ Contract sent successfully to ${i.profiles.email}`),await C(i.id,"OFFERED"),await B(),await x()}catch(s){console.error("Send contract error:",s),alert(`❌ Failed to send contract: ${s.message}`)}finally{e&&(e.disabled=!1,e.innerHTML=t)}},ue=()=>{window.open("https://docuseal.co/templates/your_template_id","_blank")},me=()=>{if(!i)return!1;const a=i.status||"";return["OFFERED"].includes(a)},pe=()=>{$||!me()||($=setInterval(()=>{B(!0)},oe))},R=()=>{$&&(clearInterval($),$=null)},be=async()=>{if(!(F||L||!i)){F=!0,L=!0,R();try{let a=!1;if(i.status!=="OFFER_ACCEPTED"){const{error:e}=await C(i.id,"OFFER_ACCEPTED");if(e){console.error("Auto advance to Contract Signed failed:",e),L=!1;return}i.status="OFFER_ACCEPTED",i.contract_signed_at=new Date().toISOString(),a=!0}if(a)try{const e=await fetch("/api/suresystems/activate-application",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:i.id})}),t=await e.json().catch(()=>({}));if(!e.ok||t?.success===!1){const s=new Error(t?.error||t?.message||"SureSystems mandate activation failed");throw s.details=t?.details||null,s}}catch(e){console.error("SureSystems activation failed during contract auto-complete:",{message:e?.message||"Unknown activation error",details:e?.details||null}),u(e?.message||"SureSystems mandate activation failed","error")}A(i),N("OFFER_ACCEPTED"),u("Contract signed! Advanced to approval phase.","success"),await x()}catch(a){console.error("handleContractCompleted error:",a),L=!1}finally{F=!1}}},B=async(a=!1)=>{if(i?.id)try{const e=await Z(i.id),t=document.getElementById("contract-status-section"),s=document.getElementById("contract-status-empty");if(e.length===0){t&&t.classList.add("hidden"),s&&(s.classList.remove("hidden"),s.textContent="No contracts sent yet."),R(),P(!1);return}s&&s.classList.add("hidden"),t&&t.classList.remove("hidden"),ge(e);const r=e[0]?.status?.toLowerCase?.()||"";P(r==="declined"),r==="completed"&&!L?await be():r!=="completed"&&!a&&pe()}catch(e){console.error("Load contract status error:",e)}},ge=a=>{const e=document.getElementById("contract-status-content");e&&(e.innerHTML=a.map(t=>{const s=fe(t.status),r=xe(t.status);return`
      <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg ${s.bg} ${s.text} flex items-center justify-center">
              <i class="${r}"></i>
            </div>
            <div>
              <div class="font-semibold text-gray-900 text-sm">Contract #${t.submission_id.slice(-8)}</div>
              <div class="text-xs text-gray-500">Sent ${h(t.created_at)}</div>
            </div>
          </div>
          <span class="px-3 py-1 text-xs font-bold rounded-full ${s.badge}">${t.status}</span>
        </div>
        <div class="flex gap-2">
          <button onclick="window.viewSubmission('${t.slug||""}', '${t.submitter_id||""}', '${t.embed_src||""}')" class="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-semibold">
            <i class="fa-solid fa-eye mr-1"></i> View
          </button>
          ${t.status==="pending"?`
            <button onclick="window.resendSubmission('${t.submitter_id}', '${t.submission_id}')" class="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-semibold">
              <i class="fa-solid fa-paper-plane mr-1"></i> Resend
            </button>
          `:""}
          ${t.status!=="completed"&&t.status!=="voided"?`
            <button onclick="window.voidSubmission('${t.submission_id}')" class="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 text-xs font-semibold">
              <i class="fa-solid fa-ban mr-1"></i> Void
            </button>
          `:""}
        </div>
      </div>
    `}).join(""))},P=a=>{if(typeof a!="boolean"||!i||a===U)return;U=a;const e="contract-declined-banner",t=document.getElementById(e),s=document.getElementById("contract-status-card");if(a){if(!D&&i.status!=="DECLINED"&&(D=i.status),i.status="DECLINED",N("DECLINED"),A(i),!t&&s){const r=document.createElement("div");r.id=e,r.className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2",r.innerHTML=`
        <i class="fa-solid fa-circle-xmark text-red-500"></i>
        <span>Contract was declined by the applicant.</span>
      `;const n=s.querySelector("h3");n&&n.parentNode?n.parentNode.insertBefore(r,n.nextSibling):s.prepend(r)}}else t&&t.remove(),D&&(i.status=D),D=null,A(i),N(i.status)},fe=a=>{const e=(a||"").toLowerCase(),t={pending:{bg:"bg-yellow-100",text:"text-yellow-600",badge:"bg-yellow-100 text-yellow-700"},completed:{bg:"bg-green-100",text:"text-green-600",badge:"bg-green-100 text-green-700"},expired:{bg:"bg-red-100",text:"text-red-600",badge:"bg-red-100 text-red-700"},voided:{bg:"bg-gray-100",text:"text-gray-600",badge:"bg-gray-100 text-gray-700"},declined:{bg:"bg-red-100",text:"text-red-600",badge:"bg-red-100 text-red-700"}};return t[e]||t.pending},xe=a=>{const e=(a||"").toLowerCase(),t={pending:"fa-solid fa-clock",completed:"fa-solid fa-check-circle",expired:"fa-solid fa-exclamation-circle",voided:"fa-solid fa-ban",declined:"fa-solid fa-circle-xmark"};return t[e]||t.pending};window.viewSubmission=async(a,e,t)=>{const s=n=>n&&n!=="undefined"&&n!=="null"?n:null,r=window.open("","_blank");try{let n=null;if(s(e))try{const o=await W(e),l=o?.slug||o?.submitter?.slug,d=o?.embed_src||o?.submitter?.embed_src;n=s(d)||(s(l)?j(l):null)}catch(o){console.warn("Live submitter lookup failed, falling back to stored values:",o)}if(n||(n=s(t)),!n&&s(a)&&(n=j(a)),!n){r&&r.close(),alert("Unable to open this contract — the signing link is missing. Try resending the contract.");return}r?r.location.href=n:window.open(n,"_blank")}catch(n){console.error("viewSubmission error:",n),r&&r.close(),alert(`Could not open contract: ${n.message||n}`)}};window.resendSubmission=async(a,e=null)=>{if(confirm("Resend contract email to the applicant?"))try{let t=a;if(!t){if(!e)throw new Error("Unable to determine DocuSeal submitter");t=await ne(e)}await se(t),alert("✅ Contract email resent successfully"),await B()}catch(t){alert(`❌ Failed to resend: ${t.message}`)}};window.voidSubmission=async a=>{if(confirm("Void this contract submission? This cannot be undone."))try{await re(a),alert("✅ Submission voided successfully"),await B()}catch(e){alert(`❌ Failed to void: ${e.message}`)}};const ye=()=>{const a=document.querySelectorAll(".tab-btn"),e=document.querySelectorAll(".tab-pane");a.forEach(t=>{t.addEventListener("click",()=>{a.forEach(n=>{n.classList.remove("active","text-orange-600","border-orange-600","bg-orange-50/50"),n.classList.add("text-gray-500","border-transparent")}),t.classList.remove("text-gray-500","border-transparent"),t.classList.add("active","text-orange-600","border-orange-600","bg-orange-50/50"),e.forEach(n=>n.classList.add("hidden"));const s=t.getAttribute("data-tab")+"-tab",r=document.getElementById(s);r&&r.classList.remove("hidden")})})};window.updateStatus=async a=>{const{error:e}=await C(i.id,a);e?u(e.message,"error"):(u(`Status updated to ${a}`,"success"),x()),S()};window.declineApplication=async()=>{const{error:a}=await C(i.id,"DECLINED");a?u(a.message,"error"):(u("Application declined.","success"),x()),S()};window.saveNotes=async()=>{const a=document.getElementById("detail-notes").value,e=document.getElementById("btn-save-notes");if(!a.trim())return;const t=e.innerHTML;e.disabled=!0,e.innerHTML='<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Saving...';try{const{error:s}=await Y(i.id,a);if(s)throw s;u("Notes saved successfully","success"),e.innerHTML='<i class="fa-solid fa-check mr-1"></i> Saved!',e.classList.remove("bg-gray-800"),e.classList.add("bg-green-600"),setTimeout(()=>{e.innerHTML=t,e.disabled=!1,e.classList.remove("bg-green-600"),e.classList.add("bg-gray-800")},2e3)}catch(s){u(s.message,"error"),e.disabled=!1,e.innerHTML=t}};window.saveRepaymentDate=async()=>{const a=document.getElementById("new-repayment-date");if(!a||!a.value)return;const e=a.value,t=document.getElementById("btn-save-date"),s=t.innerHTML;t.disabled=!0,t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';try{const n={...i.offer_details||{},first_payment_date:e},{error:o}=await b.from("loan_applications").update({offer_details:n,repayment_start_date:e}).eq("id",i.id);if(o)throw o;u("First repayment date updated successfully","success"),await x()}catch(r){console.error("Date Update Error:",r),u(r.message,"error"),t.disabled=!1,t.innerHTML=s}};window.toggleDateEdit=()=>{const a=document.getElementById("date-view-mode"),e=document.getElementById("date-edit-mode");a&&e&&(a.classList.toggle("hidden"),e.classList.toggle("hidden"))};window.manualStatusChange=async()=>{if(i.status==="DISBURSED"){alert(`⛔ ACTION BLOCKED

This application has already been disbursed. To maintain financial integrity, you cannot change the status of an active loan.`);return}const e=document.getElementById("status-override-select").value;if(e!==i.status){if(e.includes("BUREAU")){alert("Cannot manually override Bureau statuses. These are automated.");return}if(confirm(`Are you sure you want to manually force status to "${e}"?`)){const{error:t}=await C(i.id,e);if(t){u(t.message,"error");return}if(e==="OFFER_ACCEPTED"){u("Status manually updated. Activating SureSystems mandate...","success");try{const s=await fetch("/api/suresystems/activate-application",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:i.id})}),r=await s.json().catch(()=>({}));if(!s.ok||r?.success===!1){const n=new Error(r?.error||r?.message||"SureSystems mandate activation failed");throw n.details=r?.details||null,n}alert(`✅ SureSystems mandate activated successfully.

Application ID: ${i.id}${r?.contractReference?`
Contract Reference: ${r.contractReference}`:""}${r?.activatedAt?`
Activated At: ${new Date(r.activatedAt).toLocaleString()}`:""}`)}catch(s){const r=s?.details?`

Details:
${JSON.stringify(s.details,null,2)}`:"";console.error("SureSystems activation failed:",{message:s?.message||"Unknown activation error",details:s?.details||null}),alert(`⚠️ Status changed to OFFER_ACCEPTED, but mandate activation failed.

${s?.message||"Unknown activation error"}`+r),u(s?.message||"SureSystems mandate activation failed","error")}}else u("Status manually updated.","success");await x()}}};const E=document.getElementById("confirmation-modal"),H=document.getElementById("modal-title"),K=document.getElementById("modal-body"),ve=(a,e,t)=>{H&&(H.textContent=a),K&&(K.textContent=e),T=t,E?(E.classList.remove("hidden"),E.classList.add("flex")):confirm(e)&&t()},S=()=>{E&&(E.classList.add("hidden"),E.classList.remove("flex")),T=null},he=async()=>{const{data:{user:a}}=await b.auth.getUser(),{data:e}=await b.from("payouts").select("id").eq("application_id",i.id).maybeSingle();if(e){u("A payout record already exists for this application.","error"),S();return}const{data:t,error:s}=await C(i.id,"READY_TO_DISBURSE");if(s){u(s.message,"error"),S();return}const r={application_id:i.id,user_id:i.user_id,amount:t.amount,status:"pending_disbursement"},{error:n}=await J(r);n?u("Status updated but payout creation failed: "+n.message,"error"):(u("Application approved & financial values locked.","success"),x()),S()},we=(a,e)=>{const t=a?.full_name||"Unknown User",s=a?.avatar_url||`https://ui-avatars.com/api/?name=${t.replace(" ","+")}&background=random`;document.getElementById("profile-image").src=s,document.getElementById("detail-fullname").textContent=t,document.getElementById("detail-email").textContent=a?.email||"N/A",document.getElementById("detail-mobile").textContent=a?.contact_number||"N/A";const r=document.getElementById("bank-accounts-container");r&&(r.innerHTML="",e&&e.length>0?e.forEach(n=>{const o=document.createElement("div");o.className="p-4 border border-gray-200 rounded-xl bg-white flex justify-between items-center hover:border-orange-300 hover:shadow-sm transition-all",o.innerHTML=`
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <i class="fa-solid fa-building-columns"></i>
            </div>
            <div>
                <p class="text-sm font-bold text-gray-900">${n.bank_name||"Unknown Bank"}</p>
                <p class="text-xs text-gray-500 font-mono">${n.account_number||"----"} • ${n.account_type||"Savings"}</p>
            </div>
        </div>
        ${n.is_primary?'<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold border border-green-200">Primary</span>':""}
      `,r.appendChild(o)}):r.innerHTML='<div class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 rounded-xl text-center">No bank accounts linked to this profile.</div>')},_e=async a=>{const e=document.getElementById("personal-tab");if(!e||!a)return;const t=e.querySelector(".compliance-section");t&&t.remove();const{data:s}=await b.from("declarations").select("*").eq("user_id",a).maybeSingle();if(!s)return;const r=document.createElement("div");r.className="mt-8 pt-8 border-t border-gray-100 compliance-section",r.innerHTML=`
        <h4 class="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
            <i class="fa-solid fa-file-shield text-gray-400"></i> Compliance & Statutory Data
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-bold">Marital Status</p>
                <p class="text-sm font-semibold text-gray-700 capitalize">${s.marital_status||"Not Set"}</p>
            </div>
            <div class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-bold">Residential Status</p>
                <p class="text-sm font-semibold text-gray-700 capitalize">${s.home_ownership||"Not Set"}</p>
            </div>
        </div>

        ${s.referral_provided?`
        <div class="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p class="text-[10px] text-blue-400 uppercase font-bold mb-2">Referral Information</p>
            <div class="flex flex-col sm:flex-row gap-4">
                <div><span class="text-xs text-blue-600">Name:</span> <span class="text-sm font-bold text-blue-900">${s.referral_name}</span></div>
                <div><span class="text-xs text-blue-600">Phone:</span> <span class="text-sm font-bold text-blue-900">${s.referral_phone}</span></div>
            </div>
        </div>`:""}
    `,e.appendChild(r)},Ee=(a,e)=>{const t=a&&a[0]?a[0]:{},s=t.parsed_data||{income:{},expenses:{}};document.getElementById("fin-income").textContent=p(t.monthly_income||0),document.getElementById("fin-expenses").textContent=p(t.monthly_expenses||0);const r=document.getElementById("credit-check-content"),n=document.getElementById("credit-date"),o=document.getElementById("btn-download-xml");if(!r)return;let l=document.getElementById("affordability-breakdown-list");if(!l){const c=document.querySelector("#financial-tab .grid"),m=document.createElement("div");m.id="affordability-breakdown-list",m.className="mt-6 p-6 bg-gray-50 rounded-2xl border border-gray-200",c.after(m),l=m}l.innerHTML=`
    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <i class="fa-solid fa-list-check"></i> Monthly Budget Breakdown
    </h4>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        <div class="flex justify-between border-b border-gray-200 pb-1">
            <span class="text-sm text-gray-500">Basic Salary (Net)</span>
            <span class="text-sm font-bold text-gray-900">${p(s.income.salary||0)}</span>
        </div>
        <div class="flex justify-between border-b border-gray-200 pb-1">
            <span class="text-sm text-gray-500">Housing / Rent</span>
            <span class="text-sm font-bold text-gray-900">${p(s.expenses.housing_rent||0)}</span>
        </div>
        <div class="flex justify-between border-b border-gray-200 pb-1">
            <span class="text-sm text-gray-500">Other Earnings</span>
            <span class="text-sm font-bold text-gray-900">${p(s.income.other_monthly_earnings||0)}</span>
        </div>
        <div class="flex justify-between border-b border-gray-200 pb-1">
            <span class="text-sm text-gray-500">School Fees</span>
            <span class="text-sm font-bold text-gray-900">${p(s.expenses.school||0)}</span>
        </div>
        <div class="flex justify-between border-b border-gray-200 pb-1">
            <span class="text-sm text-gray-500">Disposable Surplus</span>
            <span class="text-sm font-bold text-brand-accent">${p(t.affordability_ratio||0)}</span>
        </div>
        <div class="flex justify-between border-b border-gray-200 pb-1">
            <span class="text-sm text-gray-500">Transport / Fuel</span>
            <span class="text-sm font-bold text-gray-900">${p(s.expenses.petrol||0)}</span>
        </div>
    </div>
  `;const d=e&&e.length>0?e[0]:null;if(d){const c=d.credit_score||0,m=c>600?"text-green-600":c>500?"text-yellow-600":"text-red-600";if(n&&(n.textContent=`Checked on ${h(d.checked_at||d.created_at||new Date)}`),o){const g=d.raw_xml_data;g?(o.classList.remove("hidden"),o.innerHTML='<i class="fa-solid fa-file-pdf mr-2"></i> View Bureau Report',o.className="text-sm bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors shadow-sm font-medium flex items-center gap-2",o.onclick=()=>window.viewBureauReport(g)):o.classList.add("hidden")}r.innerHTML=`
        <div class="p-6 border-b border-gray-200 text-center bg-white">
            <div class="text-6xl font-extrabold ${m} mb-2 tracking-tighter">${c}</div>
            <p class="font-bold text-gray-700 uppercase tracking-wide text-xs">Bureau Score</p>
            <span class="inline-block mt-2 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200">${d.score_band||"Standard"}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-gray-50">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span class="block text-2xl font-bold text-gray-800">${d.total_accounts||0}</span>
                <span class="text-xs text-gray-400 font-bold uppercase mt-1">Total Acc</span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span class="block text-2xl font-bold text-red-600">${d.accounts_with_arrears||0}</span>
                <span class="text-xs text-gray-400 font-bold uppercase mt-1">Arrears</span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span class="block text-2xl font-bold text-orange-600">${d.total_enquiries||0}</span>
                <span class="text-xs text-gray-400 font-bold uppercase mt-1">Enquiries</span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span class="block text-2xl font-bold text-gray-800">${d.total_judgments||0}</span>
                <span class="text-xs text-gray-400 font-bold uppercase mt-1">Judgments</span>
            </div>
        </div>
        <div class="p-6 bg-white border-t border-gray-200 space-y-4">
            <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                <span class="text-sm text-gray-500">Total Balance</span>
                <span class="font-bold text-gray-900">${p(d.total_balance||0)}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-500">Judgment Value</span>
                <span class="font-bold text-red-600">${p(d.total_judgment_amount||0)}</span>
            </div>
        </div>
      `}else n&&(n.textContent=""),o&&o.classList.add("hidden"),r.innerHTML='<div class="py-12 text-center text-gray-400"><p>No bureau data available.</p></div>'},Se=(a,e,t)=>{const s=document.getElementById("documents-list"),r=document.getElementById("doc-count");if(!s||!r)return;const n=[{key:"idcard",label:"ID Document"},{key:"till_slip",label:"Latest Payslip"},{key:"bank_statement",label:"Bank Statement"}];let o=0;if(t&&(t.id_front_image_url&&o++,t.id_back_image_url&&o++,t.selfie_image_url&&o++),r.textContent=(a?.length||0)+(e?1:0)+o,s.innerHTML="",n.forEach(l=>{const d=a.find(y=>y.file_type===l.key),c=l.key==="idcard"&&(t?.id_front_image_url||t?.id_back_image_url),m=d||c,g=m?"text-green-600 bg-green-100":"text-gray-400 bg-gray-100",w=m?"fa-check-circle":"fa-upload",_=c?"Verified via KYC Session":d?"File Verified":"Missing Document",f=document.createElement("div");f.className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-300 transition-all group",f.innerHTML=`
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl ${g} flex items-center justify-center">
                <i class="fa-solid ${w} text-xl"></i>
            </div>
            <div class="flex-grow min-w-0">
                <p class="text-sm font-bold text-gray-900">${l.label}</p>
                <p class="text-xs text-gray-500">${_}</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${d?`
            <button onclick="handleSmartDownload('${d.file_path}')" class="w-10 h-10 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all">
                <i class="fa-solid fa-eye"></i>
            </button>`:""}
            
            <label class="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-all">
                ${m?"Replace":"Upload"}
                <input type="file" class="hidden admin-doc-upload" data-type="${l.key}" accept=".pdf,.jpg,.png,.jpeg">
            </label>
        </div>
      `,s.appendChild(f)}),e){const l=e.verified===!0,d=e.normalized_status||e.status||"Linked",c=document.createElement("div");c.className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-200 rounded-xl hover:border-blue-400 transition-all mt-4",c.innerHTML=`
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl ${l?"bg-blue-600 text-white":"bg-blue-100 text-blue-600"} flex items-center justify-center shadow-sm">
                <i class="fa-solid fa-shield-halved text-xl"></i>
            </div>
            <div class="flex-grow min-w-0">
                <p class="text-sm font-bold text-gray-900">TruID Digital Verification</p>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">${d}</span>
                    <p class="text-[10px] text-gray-400 font-medium">Ref: ${(e.collection_id||"").slice(0,8)}</p>
                </div>
            </div>
        </div>
        <button onclick="window.viewTruidReport()" class="px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all">
            Inspect Data
        </button>
    `,s.appendChild(c)}t&&[{key:"id_front",label:"KYC ID Front",url:t.id_front_image_url},{key:"id_back",label:"KYC ID Back",url:t.id_back_image_url},{key:"selfie",label:"KYC Selfie",url:t.selfie_image_url}].filter(d=>d.url).forEach(d=>{const c=document.createElement("div");c.className="flex items-center justify-between p-4 bg-purple-50/50 border border-purple-200 rounded-xl hover:border-purple-400 transition-all mt-4",c.innerHTML=`
          <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                  <i class="fa-solid fa-id-card text-xl"></i>
              </div>
              <div class="flex-grow min-w-0">
                  <p class="text-sm font-bold text-gray-900">${d.label}</p>
                  <div class="flex items-center gap-2">
                      <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700">Digital KYC</span>
                      <p class="text-[10px] text-gray-400 font-medium">Session ID: ${(t.session_id||"").slice(0,8)}</p>
                  </div>
              </div>
          </div>
          <button onclick="window.open('${d.url}', '_blank')" class="px-4 py-2 bg-white border border-purple-600 text-blue-600 rounded-lg text-xs font-bold hover:bg-purple-50 transition-all">
              <i class="fa-solid fa-external-link-alt mr-1"></i> View
          </button>
      `,s.appendChild(c)}),Ce()},Ce=()=>{document.querySelectorAll(".admin-doc-upload").forEach(a=>{a.addEventListener("change",async e=>{const t=e.target.files[0];if(!t||!i)return;const s=e.target.dataset.type,r=e.target.parentElement,n=r.childNodes[0].textContent;r.childNodes[0].textContent="Processing...";try{const{data:{session:o}}=await b.auth.getSession(),l=o.user.id,d=t.name.split(".").pop(),c=`${s}_${Date.now()}.${d}`,m=`${l}/${i.user_id}_${c}`,{error:g}=await b.storage.from("client_docs").upload(m,t,{upsert:!0});if(g)throw g;const{error:w}=await b.rpc("register_admin_upload",{p_user_id:i.user_id,p_app_id:i.id,p_file_name:c,p_original_name:t.name,p_file_path:m,p_file_type:s,p_mime_type:t.type,p_file_size:t.size});if(w)throw w;u("Document Updated Successfully","success"),x()}catch(o){console.error(o),u(o.message,"error")}finally{r.childNodes[0].textContent=n}})})};window.handleSmartDownload=async a=>{try{let e=a;a.includes("/storage/v1/object/")&&(e=a.split("/").slice(8).join("/"));let{data:t,error:s}=await b.storage.from("client_docs").createSignedUrl(e,60);if((s||!t)&&({data:t,error:s}=await b.storage.from("documents").createSignedUrl(e,60)),s)throw s;window.open(t.signedUrl,"_blank")}catch(e){console.error("Smart Download Error:",e),u("File not found in any bucket. Please check storage manually.","error")}};const ke=async(a,e,t)=>{const s=document.getElementById("loan-history-list"),r=document.getElementById("app-history-list");let n=document.getElementById("admin-metadata-container");if(t){const o=document.getElementById("loan-tab");if(!n){n=document.createElement("div"),n.id="admin-metadata-container",n.className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-8";const l=Array.from(o.querySelectorAll("h3")).find(d=>d.textContent.includes("Client History"));l?o.insertBefore(n,l):o.appendChild(n)}try{const l=[t.created_by_admin,t.reviewed_by_admin].filter(Boolean),{data:d}=await b.from("profiles").select("id, full_name").in("id",l),c=d?.find(g=>g.id===t.created_by_admin)?.full_name||"System / User",m=d?.find(g=>g.id===t.reviewed_by_admin)?.full_name||"Pending Review";n.innerHTML=`
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">Created By</p>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold">
                        ${c.charAt(0)}
                    </div>
                    <span class="text-sm font-bold text-gray-800">${c}</span>
                </div>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p class="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">Reviewed By</p>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">
                        ${m.charAt(0)}
                    </div>
                    <span class="text-sm font-bold text-gray-800">${m}</span>
                </div>
            </div>
          `}catch(l){console.error("Admin UUID Lookup Error:",l)}}s&&(s.innerHTML="",a&&a.length>0?a.forEach(o=>{const l=document.createElement("div");l.className="p-3 border-b border-gray-100 last:border-0",l.innerHTML=`
                <div class="flex justify-between items-center">
                    <div>
                        <span class="block font-bold text-gray-800 text-sm">Loan #${o.id}</span>
                        <span class="text-xs text-gray-500">${h(o.start_date||o.created_at)}</span>
                    </div>
                    <div class="text-right">
                        <span class="block font-bold text-gray-900 text-sm">${p(o.principal_amount||0)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold uppercase">${o.status||"Active"}</span>
                    </div>
                </div>
            `,s.appendChild(l)}):s.innerHTML='<p class="text-sm text-gray-400 italic p-2">No previous loan history found.</p>'),r&&(r.innerHTML="",e&&e.length>0?e.forEach(o=>{const l=document.createElement("div");l.className="p-3 border-b border-gray-100 last:border-0",l.innerHTML=`
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-bold block text-gray-800 text-sm">App #${o.id}</span>
                        <span class="text-xs text-gray-500">${h(o.created_at)}</span>
                    </div>
                    <div class="text-right">
                        <span class="block text-gray-600 font-medium text-sm">${p(o.amount||0)}</span>
                        <span class="text-[10px] uppercase font-bold text-orange-500">${o.status}</span>
                    </div>
                </div>
            `,r.appendChild(l)}):r.innerHTML='<p class="text-sm text-gray-400 italic p-2">No other applications on record.</p>')},A=a=>{if(!a)return;const e=a.status||"pending",t=document.getElementById("sidebar-status"),s=document.getElementById("status-alert"),r=document.getElementById("action-buttons-container"),n=parseFloat(a.offer_principal||a.amount||0),o=parseInt(a.term_months||1),l=parseFloat(a.offer_total_interest||0),d=parseFloat(a.offer_total_initiation_fees||0),c=parseFloat(a.offer_total_admin_fees||0),m=parseFloat(a.offer_total_repayment||0),g=parseFloat(a.offer_monthly_repayment||0),w=parseFloat(a.offer_interest_rate||0),_=a.repayment_start_date||a.offer_details?.first_payment_date;document.getElementById("sidebar-amount").textContent=p(n),document.getElementById("sidebar-term").textContent=`${o} Month${o>1?"s":""}`,document.getElementById("sidebar-payment").textContent=p(g);let f=document.getElementById("financial-breakdown");if(!f){const k=document.getElementById("sidebar-payment").parentElement.parentElement;f=document.createElement("div"),f.id="financial-breakdown",f.className="pt-4 border-t border-gray-100 space-y-4",k.after(f)}f.innerHTML=`
    <div class="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Tiered Interest (${(w*100).toFixed(1)}%)</span>
            <span class="font-bold text-gray-900">${p(l)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Initiation Fee</span>
            <span class="font-bold text-gray-900">${p(d)}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Monthly Service Fee</span>
            <span class="font-bold text-gray-900">${p(c)}</span>
        </div>
        <div class="pt-2 border-t border-gray-200 flex justify-between items-center">
            <span class="text-xs font-black uppercase text-gray-700">Total Repayable</span>
            <span class="text-sm font-black text-green-600">${p(m)}</span>
        </div>
    </div>
    
    <div class="mt-4">
        <label class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1 block">Scheduled Payout Info</label>
        <div class="p-3 bg-orange-50 border border-orange-100 rounded-xl transition-all">
            <div id="date-view-mode" class="flex items-center justify-between">
                <span class="text-xs text-orange-800 font-medium">First Repayment:</span>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-orange-900">
                        ${_?h(_):"Not Scheduled"}
                    </span>
                    ${e!=="DISBURSED"?`
                    <button onclick="window.toggleDateEdit()" class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-orange-100 text-orange-600 transition-colors" title="Change Date">
                        <i class="fa-solid fa-pen text-[10px]"></i>
                    </button>`:""}
                </div>
            </div>
            <div id="date-edit-mode" class="hidden mt-1">
                <div class="flex items-center gap-2">
                    <input type="date" id="new-repayment-date" 
                           class="flex-1 text-xs p-1.5 rounded-lg border border-orange-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                           value="${_?new Date(_).toISOString().split("T")[0]:""}">
                    <button id="btn-save-date" onclick="window.saveRepaymentDate()" class="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 shadow-sm">
                        Save
                    </button>
                    <button onclick="window.toggleDateEdit()" class="px-2 py-1.5 text-gray-500 hover:text-gray-700">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
  `,t&&(t.textContent=e.replace("_"," "),t.className=`mt-2 text-lg font-bold uppercase tracking-wide ${M(e).split(" ")[0].replace("bg-","text-").replace("-100","-600")}`);const y=document.getElementById("status-override-select"),v=document.getElementById("manual-update-btn"),O=document.getElementById("override-hint");if(e==="DISBURSED"?(y&&(y.disabled=!0),v&&(v.disabled=!0,v.classList.add("opacity-50","cursor-not-allowed"),v.innerText="Locked"),O&&(O.textContent="🔒 Application is active. Modifications disabled.")):(y&&(y.disabled=!1,y.value=e),v&&(v.disabled=!1,v.innerText="Update")),s&&(s.className="mt-3 p-3 rounded-lg text-xs font-medium leading-relaxed hidden",e==="OFFERED"?(s.textContent="Contract Sent. Waiting for user to sign.",s.classList.add("bg-purple-50","text-purple-700","block")):e==="READY_TO_DISBURSE"&&(s.textContent="Application is queued for disbursement.",s.classList.add("bg-green-50","text-green-700","block"))),r)if(r.innerHTML="",["BUREAU_OK","BANK_LINKING","STARTED","AFFORD_REFER","BUREAU_REFER"].includes(e)){const k=e==="AFFORD_REFER"||e==="BUREAU_REFER"?'<div class="p-3 bg-orange-50 border border-orange-100 rounded-lg mb-3 text-xs text-orange-700 font-bold"><i class="fa-solid fa-circle-exclamation mr-1"></i> Currently Under Manual Review</div>':"";r.innerHTML=`
            ${k}
            <h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Assessment</h4>
            <button onclick="updateStatus('AFFORD_OK')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl mb-2 shadow-lg"><i class="fa-solid fa-check-circle mr-2"></i> Confirm Affordability</button>
            ${e.includes("REFER")?"":`<button onclick="updateStatus('AFFORD_REFER')" class="w-full py-3 bg-white border border-orange-200 text-orange-600 text-sm font-bold rounded-xl mb-2"><i class="fa-solid fa-magnifying-glass mr-2"></i> Refer</button>`}
            
            <button onclick="openModal('Decline', 'Are you sure you want to decline this application?', declineApplication)" class="w-full py-3 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-xl">
                <i class="fa-solid fa-xmark mr-2"></i> Decline
            </button>
          `}else e==="AFFORD_OK"?(r.innerHTML=`
            <div class="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-3 text-xs text-blue-700">Client passed assessment. Ready for Contract.</div>
            <button id="action-send-contract" class="w-full py-3 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><i class="fa-solid fa-paper-plane"></i> Send Contract</button>
            <button id="action-preview-contract" class="w-full py-3 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl shadow-sm flex items-center justify-center gap-2"><i class="fa-solid fa-eye"></i> Preview Template</button>
          `,document.getElementById("action-send-contract")?.addEventListener("click",k=>ce(k.currentTarget)),document.getElementById("action-preview-contract")?.addEventListener("click",ue)):e==="OFFER_ACCEPTED"?(r.innerHTML=`
             <div class="p-3 bg-purple-50 border border-purple-100 rounded-lg mb-3 text-xs text-purple-700"><i class="fa-solid fa-signature mr-1"></i> Client Signed.</div>
             <button id="btn-approve-contract" class="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-lg"><i class="fa-solid fa-file-signature mr-2"></i> Approve & Queue Payout</button>
          `,document.getElementById("btn-approve-contract").onclick=()=>ve("Approve","Mark contract as valid and ready for payout?",he)):e==="READY_TO_DISBURSE"?r.innerHTML='<div class="p-4 bg-green-50 border border-green-100 rounded-xl text-center"><p class="text-sm font-bold text-green-800">Queued for Payout</p></div>':e==="DISBURSED"&&(r.innerHTML='<div class="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center"><p class="text-sm font-bold text-gray-600">Loan Active / Completed</p></div>')},De=a=>{if(!a)return;document.getElementById("applicant-name-header").textContent=a.profiles?.full_name||"Unknown",document.getElementById("header-id-val").textContent=a.id,document.getElementById("header-date").textContent=h(a.created_at),document.getElementById("detail-app-id").textContent=`#${a.id}`,document.getElementById("detail-date").textContent=h(a.created_at),document.getElementById("detail-purpose").textContent=a.purpose||"Personal Loan",document.getElementById("detail-notes").value=a.notes||"";const e=document.getElementById("header-status-badge");e&&(e.textContent=a.status,e.className=`px-4 py-1.5 text-sm font-bold rounded-full shadow-sm ${M(a.status)}`)},x=async()=>{const e=new URLSearchParams(window.location.search).get("id");if(e)try{const t=await z(e);i=t,R(),document.getElementById("contract-declined-banner")?.remove(),De(t),we(t.profiles||{},t.bank_accounts),await _e(t.user_id),Ee(t.financial_profiles,t.credit_checks),Se(t.documents,t.truid_info,t.kyc_info),await ke(t.loan_history,t.application_history,t),A(t),await le(),document.getElementById("loading-state")?.classList.add("hidden"),document.getElementById("content-grid")?.classList.remove("hidden"),document.getElementById("page-header")?.classList.remove("hidden")}catch(t){console.error("Integration Error:",t),u("Failed to load full application data.","error")}};document.addEventListener("DOMContentLoaded",async()=>{await V();let a=document.getElementById("main-content");a||(a=document.createElement("main"),a.id="main-content",a.className="flex-1 p-6 pt-24",document.getElementById("app-shell").appendChild(a)),a.innerHTML=de,ye(),await x(),document.getElementById("btn-save-notes")?.addEventListener("click",saveNotes);const e=document.getElementById("modal-confirm-btn"),t=document.getElementById("modal-cancel-btn");e&&e.addEventListener("click",()=>{typeof T=="function"&&T()}),t&&t.addEventListener("click",S)});
