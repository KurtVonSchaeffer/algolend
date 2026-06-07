import { checkIdCardExistsByUser, getDocumentInfoByUser } from '/user-portal/Services/documentService.js';
import { supabase } from '/Services/supabaseClient.js';

async function initIdCardModule() {
  const form = document.getElementById('idcardForm');
  const status = document.getElementById('uploadStatus');
  const uploadBtn = document.getElementById('idcardUploadBtn');
  const frontInput = document.getElementById('idcardFilefront');
  const backInput = document.getElementById('idcardFileback');
  const checkmark = document.getElementById('idcardCheckmark');
  const existingInfo = document.getElementById('existingFileInfo');
  const statusChip = document.getElementById('idcardStatusChip');

  if (!form || !status || !uploadBtn || !frontInput || !backInput) {
    console.warn('⚠️ ID card module DOM not ready');
    return;
  }

  if (form.dataset.bound === 'true') {
    return;
  }
  form.dataset.bound = 'true';

  const applicationId = sessionStorage.getItem('currentApplicationId') || sessionStorage.getItem('lastApplicationId');
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const authToken = session?.access_token;

  if (!userId || !authToken) {
    console.warn('⚠️ User not logged in');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Please Log In';
    return;
  }

  console.log('✅ Ready to upload ID card', { applicationId: applicationId || 'none', userId });

  await checkExistingDocuments();

  async function checkExistingDocuments() {
    const { front, back } = await checkIdCardExistsByUser(userId);

    if (front && back) {
      if (checkmark) checkmark.classList.add('visible');
      uploadBtn.disabled = true;
      uploadBtn.style.opacity = '0.5';
      uploadBtn.style.cursor = 'not-allowed';
      uploadBtn.textContent = 'Already Uploaded ✓';
      frontInput.disabled = true;
      backInput.disabled = true;
      if (statusChip) {
        statusChip.textContent = 'Uploaded';
        statusChip.classList.add('success');
      }

      const frontInfo = await getDocumentInfoByUser(userId, 'id_card_front');
      const backInfo = await getDocumentInfoByUser(userId, 'id_card_back');

      if (frontInfo && backInfo && existingInfo) {
        const uploadDate = new Date(frontInfo.uploaded_at || Date.now()).toLocaleDateString();
        existingInfo.innerHTML = `✅ Both sides uploaded on ${uploadDate}<br>
          <small>Front: <b>${frontInfo.file_name}</b> | Back: <b>${backInfo.file_name}</b></small>`;
        existingInfo.style.color = '#1f8c5c';
      }
    } else if (front || back) {
      if (existingInfo) {
        existingInfo.innerHTML = `⚠️ Only ${front ? 'front' : 'back'} side uploaded. Please upload ${front ? 'back' : 'front'} side.`;
        existingInfo.style.color = '#ff9800';
      }
      if (statusChip) {
        statusChip.textContent = 'In Progress';
        statusChip.classList.remove('success');
      }
      if (checkmark) {
        checkmark.classList.remove('visible');
      }
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload Both Sides';
      frontInput.disabled = false;
      backInput.disabled = false;
    } else {
      if (existingInfo) {
        existingInfo.textContent = '';
        existingInfo.style.color = '';
      }
      if (statusChip) {
        statusChip.textContent = 'Pending';
        statusChip.classList.remove('success');
      }
      if (checkmark) {
        checkmark.classList.remove('visible');
      }
      uploadBtn.disabled = false;
      uploadBtn.style.opacity = '1';
      uploadBtn.style.cursor = 'pointer';
      uploadBtn.textContent = 'Upload Both Sides';
      frontInput.disabled = false;
      backInput.disabled = false;
    }
  }

  function resetStatusChip() {
    if (statusChip) {
      statusChip.textContent = 'Pending';
      statusChip.classList.remove('success');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileFront = frontInput.files[0];
    const fileBack = backInput.files[0];

    if (!fileFront || !fileBack) {
      status.textContent = '⚠️ Please select both front and back files (2 files required).';
      status.style.color = '#ff9800';
      return;
    }

    console.log('📁 ID card files selected', {
      front: { name: fileFront.name, size: `${(fileFront.size / 1024).toFixed(2)}KB` },
      back: { name: fileBack.name, size: `${(fileBack.size / 1024).toFixed(2)}KB` },
    });

    const formData = new FormData();
    formData.append('filefront', fileFront);
    formData.append('fileback', fileBack);
    if (applicationId) {
      formData.append('applicationId', applicationId);
    }

    status.textContent = 'Uploading both sides... ⏳';
    status.style.color = '';
    uploadBtn.disabled = true;

    try {
      const res = await fetch('/api/idcard/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        status.innerHTML = '✅ ID card uploaded successfully!<br><small>Both front and back received.</small>';
        status.style.color = '#28a745';
        if (checkmark) checkmark.classList.add('visible');
        uploadBtn.style.opacity = '0.5';
        uploadBtn.style.cursor = 'not-allowed';
        uploadBtn.textContent = 'Already Uploaded ✓';
        frontInput.disabled = true;
        backInput.disabled = true;
        if (statusChip) {
          statusChip.textContent = 'Uploaded';
          statusChip.classList.add('success');
        }

        if (existingInfo) {
          const uploadDate = new Date(data.uploadedAt || Date.now()).toLocaleDateString();
          existingInfo.innerHTML = `✅ Both sides uploaded on ${uploadDate}<br>
            <small>Front: <b>${data.documents?.front?.filename}</b> | Back: <b>${data.documents?.back?.filename}</b></small>`;
          existingInfo.style.color = '#1f8c5c';
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('document:uploaded', { detail: { fileType: 'id_card' } }));
        }
      } else {
        console.error('❌ Upload failed', data);
        status.textContent = `❌ Upload failed: ${data.message || data.error}`;
        status.style.color = '#dc3545';
        uploadBtn.disabled = false;
        resetStatusChip();
      }
    } catch (err) {
      console.error('❌ Network error', err);
      status.textContent = '❌ Upload failed: Network or server error.';
      status.style.color = '#dc3545';
      uploadBtn.disabled = false;
      resetStatusChip();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIdCardModule, { once: true });
} else {
  initIdCardModule();
}
