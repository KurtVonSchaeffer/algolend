window.toggleConsent = function() {
  window.consentGiven = !window.consentGiven;
  const btn = document.getElementById('consentBtn');
  const icon = btn.querySelector('i');
  const documentList = document.getElementById('documentList');
  if (window.consentGiven) {
    btn.classList.add('active');
    icon.classList.remove('fa-square');
    icon.classList.add('fa-check-square');
    documentList.classList.remove('hidden-consent');
  } else {
    btn.classList.remove('active');
    icon.classList.remove('fa-check-square');
    icon.classList.add('fa-square');
    documentList.classList.add('hidden-consent');
  }
}

window.showApplyLoan2 = function() {
  if (typeof loadPage === 'function') {
    loadPage('apply-loan-2');
  } else {
    window.location.href = 'apply-loan-2.html';
  }
}

async function loadModule(name) {
  const overlay = document.getElementById("module-container");
  const moduleContent = document.getElementById("module-content");
// load css first 

const cssPath = `modules-css/${name}.css`;
  if (!document.querySelector(`link[href="${cssPath}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssPath;
    document.head.appendChild(link);
  }
  overlay.classList.remove("hidden");
  moduleContent.innerHTML = "<p>Loading...</p>";//animate later

  try {
    const res = await fetch(`modules/${name}.html`);
    if (!res.ok) throw new Error(`Module ${name} not found`);
    const html = await res.text();
    setTimeout(() => {
      moduleContent.innerHTML = html;
      //  upload handler binder for till slip and alla them
      //
      if (name === 'tillslip') {
        bindTillSlipUpload();
      } else if (name === 'bankstatement') {
        bindBankStatementUpload();
      } else if (name === 'idcard') {
        bindIdCardUpload();
      }

function bindBankStatementUpload() {
  const form = document.getElementById("bankstatementForm");
  const status = document.getElementById("uploadStatus");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("bankstatementFile").files[0];
    if (!file) {
      status.textContent = "Please select a file first.";
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    status.textContent = "Uploading... ⏳";
    try {
      const res = await fetch("/api/bankstatement/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        status.innerHTML = `✅ Bank statement uploaded successfully!<br><small>Thank you, your file <b>${data.filename}</b> has been received.</small>`;
      } else {
        status.textContent = `❌ Upload failed: ${data.error}`;
      }
    } catch (err) {
      console.error(err);
      status.textContent = "⚠ Something went wrong during upload.";
    }
  });
}
// Bind till slip upload handler after module loads
function bindTillSlipUpload() {
  const form = document.getElementById("tillslipForm");
  const status = document.getElementById("uploadStatus");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("tillslipFile").files[0];
    if (!file) {
      status.textContent = "Please select a file first.";
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    status.textContent = "Uploading... ⏳";
    try {
      const res = await fetch("/api/tillslip/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        status.innerHTML = `✅ Till slip uploaded successfully!<br><small>Thank you, your file <b>${data.filename}</b> has been received.</small>`;
      } else {
        status.textContent = `❌ Upload failed: ${data.error}`;
      }
    } catch (err) {
      console.error(err);
      status.textContent = "⚠ Something went wrong during upload.";
    }
  });
}
    }, 300);
  } catch (err) {
    moduleContent.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

function closeModule() {
  const overlay = document.getElementById("module-container");
  overlay.classList.add("hidden");
}