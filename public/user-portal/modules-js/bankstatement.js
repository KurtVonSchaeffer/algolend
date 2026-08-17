import { supabase } from '/Services/supabaseClient.js';
import { getDocumentInfoByUser } from '/user-portal/Services/documentService.js';

async function initBankStatementModule() {
  const statusEl = document.getElementById('truidStatusMessage'); // element kept in HTML; now shows upload status
  const manualUploadBtn = document.getElementById('manualBankUploadBtn');
  const manualFileInput = document.getElementById('manualBankFile');
  const manualSelectedFile = document.getElementById('manualBankSelectedFile');
  const disclaimerModal = document.getElementById('manualUploadDisclaimerModal');
  const disclaimerAcceptBtn = document.getElementById('manualUploadDisclaimerAccept');
  const disclaimerCancelBtn = document.getElementById('manualUploadDisclaimerCancel');
  const disclaimerConsentCheckbox = document.getElementById('manualUploadConsentCheckbox');
  const checkmark = document.getElementById('bankstatementCheckmark');
  const existingInfo = document.getElementById('existingFileInfo');
  const statusChip = document.getElementById('bankstatementStatusChip');
  let manualDisclaimerAccepted = false;

  if (!statusEl) {
    console.warn('⚠️ Bank statement module DOM not ready');
    return;
  }

  if (statusEl.dataset.bound === 'true') return;
  statusEl.dataset.bound = 'true';

  let applicationId = sessionStorage.getItem('currentApplicationId') || sessionStorage.getItem('lastApplicationId');
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    console.warn('⚠️ User not logged in');
    statusEl.textContent = '⚠️ Please log in first';
    statusEl.style.color = '#ff9800';
    if (manualUploadBtn) {
      manualUploadBtn.disabled = true;
      manualUploadBtn.textContent = 'Please Log In';
    }
    return;
  }

  const getConsentStateFromDeclarations = async () => {
    const metadataOnlyFetch = async () => {
      const { data: declarationData, error: metadataError } = await supabase
        .from('declarations')
        .select('metadata')
        .eq('user_id', userId)
        .maybeSingle();

      if (metadataError) throw metadataError;
      return declarationData?.metadata?.credit_check_consent_accepted === true;
    };

    try {
      const { data: declarationData, error } = await supabase
        .from('declarations')
        .select('credit_check_consent_accepted, metadata')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        const missingConsentColumn = String(error?.message || '').toLowerCase().includes('column')
          && String(error?.message || '').toLowerCase().includes('credit_check_consent_');
        if (missingConsentColumn) return await metadataOnlyFetch();
        throw error;
      }

      const consentFromColumn = declarationData?.credit_check_consent_accepted === true;
      const consentFromMetadata = declarationData?.metadata?.credit_check_consent_accepted === true;
      return consentFromColumn || consentFromMetadata;
    } catch (error) {
      console.warn('⚠️ Could not read declarations consent state', error);
      return false;
    }
  };

  const persistConsentToDeclarations = async () => {
    const acceptedAt = new Date().toISOString();

    const { data: existingDeclaration } = await supabase
      .from('declarations')
      .select('id, metadata')
      .eq('user_id', userId)
      .maybeSingle();

    const metadata = {
      ...(existingDeclaration?.metadata || {}),
      credit_check_consent_accepted: true,
      credit_check_consent_accepted_at: acceptedAt,
      credit_check_consent_version: 'v1'
    };

    try {
      if (existingDeclaration?.id) {
        const { error: updateError } = await supabase
          .from('declarations')
          .update({
            credit_check_consent_accepted: true,
            credit_check_consent_accepted_at: acceptedAt,
            credit_check_consent_version: 'v1',
            metadata,
            updated_at: acceptedAt
          })
          .eq('user_id', userId);
        if (updateError) throw updateError;
        return;
      }

      const { error: insertError } = await supabase
        .from('declarations')
        .insert([{
          user_id: userId,
          credit_check_consent_accepted: true,
          credit_check_consent_accepted_at: acceptedAt,
          credit_check_consent_version: 'v1',
          metadata
        }]);
      if (insertError) throw insertError;
    } catch (error) {
      const missingConsentColumn = String(error?.message || '').toLowerCase().includes('column')
        && String(error?.message || '').toLowerCase().includes('credit_check_consent_');

      if (!missingConsentColumn) throw error;

      if (existingDeclaration?.id) {
        const { error: fallbackUpdateError } = await supabase
          .from('declarations')
          .update({ metadata, updated_at: acceptedAt })
          .eq('user_id', userId);
        if (fallbackUpdateError) throw fallbackUpdateError;
        return;
      }

      const { error: fallbackInsertError } = await supabase
        .from('declarations')
        .insert([{ user_id: userId, metadata }]);
      if (fallbackInsertError) throw fallbackInsertError;
    }
  };

  manualDisclaimerAccepted = await getConsentStateFromDeclarations();

  if (!applicationId) {
    try {
      const { data: latestApplication, error: latestApplicationError } = await supabase
        .from('loan_applications')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestApplicationError) {
        console.warn('⚠️ Could not resolve latest applicationId from DB', latestApplicationError);
      } else if (latestApplication?.id) {
        applicationId = latestApplication.id;
        sessionStorage.setItem('lastApplicationId', String(applicationId));
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch latest applicationId', error);
    }
  }

  const applyUploadedState = (details = {}) => {
    const connectedDate = new Date(
      details.capturedAt || details.captured_at || details.uploadedAt || Date.now()
    ).toLocaleDateString();

    if (checkmark) checkmark.classList.add('visible');

    if (manualUploadBtn) {
      manualUploadBtn.disabled = true;
      manualUploadBtn.style.opacity = '0.5';
      manualUploadBtn.style.cursor = 'not-allowed';
      manualUploadBtn.textContent = 'Uploaded ✓';
    }

    if (manualFileInput) manualFileInput.disabled = true;

    if (statusChip) {
      statusChip.textContent = 'Uploaded';
      statusChip.classList.add('success');
    }

    if (existingInfo) {
      existingInfo.style.color = '#1f8c5c';
      existingInfo.innerHTML = `✓ Bank statement uploaded on ${connectedDate}`;
    }
  };

  const setManualUploadedState = (filename, uploadedAt) => {
    applyUploadedState({ uploadedAt: uploadedAt || new Date().toISOString() });
    statusEl.textContent = 'Bank statement uploaded successfully.';
    statusEl.style.color = '#28a745';

    if (existingInfo) {
      const uploadDate = new Date(uploadedAt || Date.now()).toLocaleDateString();
      existingInfo.innerHTML = `✓ Bank statement received: <b>${filename}</b> on ${uploadDate}`;
      existingInfo.style.color = '#1f8c5c';
    }
  };

  // Check for an existing uploaded statement
  const existingManualDoc = await getDocumentInfoByUser(userId, 'bank_statement');
  if (existingManualDoc?.file_name) {
    setManualUploadedState(existingManualDoc.file_name, existingManualDoc.uploaded_at);
  }

  if (manualFileInput && manualSelectedFile) {
    manualFileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        manualSelectedFile.style.display = 'none';
        manualSelectedFile.innerHTML = '';
        return;
      }
      const fileSize = (file.size / 1024).toFixed(1);
      manualSelectedFile.innerHTML = `<i class="fas fa-file"></i> <strong>${file.name}</strong> <span>(${fileSize} KB)</span>`;
      manualSelectedFile.style.display = 'block';
    });
  }

  if (manualUploadBtn && manualFileInput) {
    const showManualUploadDisclaimer = () => new Promise((resolve) => {
      if (manualDisclaimerAccepted) { resolve(true); return; }
      if (!disclaimerModal || !disclaimerAcceptBtn || !disclaimerCancelBtn) { resolve(true); return; }

      const closeModal = () => disclaimerModal.classList.add('hidden');

      if (disclaimerConsentCheckbox) disclaimerConsentCheckbox.checked = false;
      disclaimerAcceptBtn.disabled = true;

      const handleAccept = async () => {
        if (disclaimerConsentCheckbox && !disclaimerConsentCheckbox.checked) return;
        try {
          await persistConsentToDeclarations();
          manualDisclaimerAccepted = true;
          closeModal();
          resolve(true);
        } catch (error) {
          console.error('❌ Failed to save manual upload consent', error);
          statusEl.textContent = '❌ Unable to save consent right now. Please try again.';
          statusEl.style.color = '#dc3545';
        }
      };

      const handleCancel = () => { closeModal(); resolve(false); };

      if (disclaimerConsentCheckbox) {
        disclaimerConsentCheckbox.onchange = () => {
          disclaimerAcceptBtn.disabled = !disclaimerConsentCheckbox.checked;
        };
      }

      disclaimerAcceptBtn.onclick = handleAccept;
      disclaimerCancelBtn.onclick = handleCancel;
      disclaimerModal.onclick = (event) => { if (event.target === disclaimerModal) handleCancel(); };
      disclaimerModal.classList.remove('hidden');
    });

    const handleManualUpload = async () => {
      if (!manualFileInput.files?.length) {
        manualFileInput.click();
        return;
      }

      const file = manualFileInput.files[0];
      const authToken = session?.access_token;
      if (!authToken) {
        statusEl.textContent = '⚠️ Please log in again before uploading.';
        statusEl.style.color = '#ff9800';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (applicationId) formData.append('applicationId', applicationId);

      statusEl.textContent = 'Uploading bank statement...';
      statusEl.style.color = '#7a7a7a';
      manualUploadBtn.disabled = true;
      manualUploadBtn.textContent = 'Uploading...';

      try {
        const response = await fetch('/api/bankstatement/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || data?.error || 'Upload failed');

        setManualUploadedState(data?.filename || file.name, data?.uploadedAt || new Date().toISOString());

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('document:uploaded', { detail: { fileType: 'bank_statement' } }));
        }

        manualUploadBtn.textContent = 'Uploaded ✓';
      } catch (error) {
        console.error('❌ Bank statement upload failed', error);
        statusEl.textContent = `❌ Upload failed: ${error.message || 'Unknown error'}`;
        statusEl.style.color = '#dc3545';
        manualUploadBtn.disabled = false;
        manualUploadBtn.textContent = 'Upload Bank Statement';
      }
    };

    manualUploadBtn.addEventListener('click', async () => {
      if (!manualDisclaimerAccepted) {
        const accepted = await showManualUploadDisclaimer();
        if (!accepted) return;
      }
      await handleManualUpload();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBankStatementModule, { once: true });
} else {
  initBankStatementModule();
}
