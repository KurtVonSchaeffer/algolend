import { supabase } from '/Services/supabaseClient.js';
import { getDocumentInfoByUser } from '/user-portal/Services/documentService.js';

async function initTillSlipModule() {
  const form = document.getElementById("tillslipForm");
  const status = document.getElementById("uploadStatus");
  const uploadBtn = document.getElementById("tillslipUploadBtn");
  const fileInput = document.getElementById("tillslipFile");
  const checkmark = document.getElementById("tillslipCheckmark");
  const existingInfo = document.getElementById("existingFileInfo");
  const statusChip = document.getElementById("tillslipStatusChip");
  const selectedFileDisplay = document.getElementById("tillslipSelectedFile");

  if (!form || !status || !uploadBtn || !fileInput) {
    console.warn("⚠️ Payslip form not found");
    return;
  }

  if (form.dataset.bound === 'true') {
    return;
  }
  form.dataset.bound = 'true';

  // Optional: keep application context if stored
  const applicationId = sessionStorage.getItem('currentApplicationId') || sessionStorage.getItem('lastApplicationId');

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const authToken = session?.access_token;

  if (!userId || !authToken) {
    status.textContent = '⚠️ Please log in to upload your payslip.';
    status.style.color = '#ff9800';
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Please Log In';
    return;
  }

  // Display selected file name
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && selectedFileDisplay) {
      const fileSize = (file.size / 1024).toFixed(1);
      selectedFileDisplay.innerHTML = `<i class="fas fa-file"></i> <strong>${file.name}</strong> <span>(${fileSize} KB)</span>`;
      selectedFileDisplay.style.display = 'block';
    }
  });

  await hydrateExistingState();

  async function hydrateExistingState() {
    const docInfo = await getDocumentInfoByUser(userId, 'till_slip');
    if (docInfo) {
      setUploadedState(docInfo.file_name, docInfo.uploaded_at, false);
    } else if (statusChip) {
      statusChip.textContent = 'Pending';
      statusChip.classList.remove('success');
    }
  }

  function setUploadedState(filename, uploadedAt, isNewUpload = false) {
    status.innerHTML = isNewUpload
      ? `✅ Payslip uploaded successfully!<br><small>File: <b>${filename}</b></small>`
      : `✅ Payslip already uploaded.<br><small>File: <b>${filename}</b></small>`;
    status.style.color = "#4caf50";
    if (checkmark) {
      checkmark.classList.add('visible');
    }
    if (statusChip) {
      statusChip.textContent = 'Uploaded';
      statusChip.classList.add('success');
    }
    if (existingInfo) {
      const uploadDate = new Date(uploadedAt || Date.now()).toLocaleDateString();
      existingInfo.innerHTML = `✅ File uploaded: <b>${filename}</b> on ${uploadDate}`;
      existingInfo.style.color = '#1f8c5c';
    }
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploaded ✓';
    uploadBtn.style.opacity = '0.5';
    uploadBtn.style.cursor = 'not-allowed';
    fileInput.disabled = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
      status.textContent = "Please select a file first.";
      console.warn("⚠ No file selected");
      return;
    }

    console.log("📁 File selected:", {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)}KB`,
      type: file.type
    });

    const formData = new FormData();
    formData.append("file", file);
    if (applicationId) {
      formData.append('applicationId', applicationId);
    }

    status.textContent = "Uploading... ⏳";
    uploadBtn.disabled = true;

    try {
      const res = await fetch("/api/tillslip/upload", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData,
      });

      console.log("📊 Response status:", res.status, res.statusText);

      const data = await res.json();
      console.log("📥 Response data:", data);

      if (res.ok) {
        console.log("✅ Upload successful!");
        setUploadedState(data.filename, data.uploadedAt, true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('document:uploaded', { detail: { fileType: 'till_slip' } }));
        }
      } else {
        console.error("❌ Upload failed:", data);
        status.textContent = `❌ Upload failed: ${data.message || data.error}`;
        status.style.color = "#f44336";
        uploadBtn.disabled = false;
        if (statusChip) {
          statusChip.textContent = 'Pending';
          statusChip.classList.remove('success');
        }
      }
    } catch (err) {
      console.error("⚠ Network error:", err);
      status.textContent = "⚠ Something went wrong during upload.";
      status.style.color = "#ff9800";
      uploadBtn.disabled = false;
      if (statusChip) {
        statusChip.textContent = 'Pending';
        statusChip.classList.remove('success');
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTillSlipModule, { once: true });
} else {
  initTillSlipModule();
}