import { supabase } from '/Services/supabaseClient.js';
import { getDocumentInfoByUser } from '/user-portal/Services/documentService.js';

async function initBankStatementModule() {
  const status = document.getElementById('truidStatusMessage');
  const connectBtn = document.getElementById('truidConnectBtn');
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
  let statusPollInterval = null;

  if (!status || !connectBtn) {
    console.warn('⚠️ Bank statement module DOM not ready');
    return;
  }

  if (connectBtn.dataset.bound === 'true') {
    return;
  }
  connectBtn.dataset.bound = 'true';

  let applicationId = sessionStorage.getItem('currentApplicationId') || sessionStorage.getItem('lastApplicationId');
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    console.warn('⚠️ User not logged in');
    status.textContent = '⚠️ Please log in first';
    status.style.color = '#ff9800';
    connectBtn.disabled = true;
    connectBtn.textContent = 'Please Log In';
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

      if (metadataError) {
        throw metadataError;
      }

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

        if (missingConsentColumn) {
          return await metadataOnlyFetch();
        }

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

      if (!missingConsentColumn) {
        throw error;
      }

      if (existingDeclaration?.id) {
        const { error: fallbackUpdateError } = await supabase
          .from('declarations')
          .update({
            metadata,
            updated_at: acceptedAt
          })
          .eq('user_id', userId);

        if (fallbackUpdateError) throw fallbackUpdateError;
        return;
      }

      const { error: fallbackInsertError } = await supabase
        .from('declarations')
        .insert([{
          user_id: userId,
          metadata
        }]);

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
      console.warn('⚠️ Failed to fetch latest applicationId for TruID correlation', error);
    }
  }

  console.log('✅ Ready for TruID bank statement connection', { applicationId: applicationId || 'none', userId });

  const applyVerifiedState = (details = {}) => {
    const normalizedStatus = (details.status || '').toString().toLowerCase();
    const isCaptured = Boolean(
      details.capturedAt
      || details.captured_at
      || details.source === 'truid_collections'
      || ['captured', 'data_ready', 'ready', 'completed'].includes(normalizedStatus)
    );

    if (checkmark) checkmark.classList.add('visible');
    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.style.opacity = '0.5';
      connectBtn.style.cursor = 'not-allowed';
      connectBtn.textContent = isCaptured ? 'Statement Captured ✓' : 'Bank Connected ✓';
    }

    if (manualUploadBtn) {
      manualUploadBtn.disabled = true;
      manualUploadBtn.style.opacity = '0.5';
      manualUploadBtn.style.cursor = 'not-allowed';
      manualUploadBtn.textContent = 'Uploaded/Connected ✓';
    }

    if (manualFileInput) {
      manualFileInput.disabled = true;
    }

    if (statusChip) {
      statusChip.textContent = isCaptured ? 'Captured' : 'Connected';
      statusChip.classList.add('success');
    }

    if (existingInfo) {
      const connectedDate = new Date(details.capturedAt || details.captured_at || details.last_updated || details.updatedAt || Date.now()).toLocaleDateString();
      existingInfo.style.color = '#1f8c5c';
      existingInfo.innerHTML = isCaptured
        ? `✓ TruID data captured on ${connectedDate}`
        : `✓ Bank connected via TruID on ${connectedDate}`;
    }

    if (statusPollInterval) {
      clearInterval(statusPollInterval);
      statusPollInterval = null;
    }
  };

  const setManualUploadedState = (filename, uploadedAt) => {
    applyVerifiedState({
      capturedAt: uploadedAt || new Date().toISOString(),
      status: 'captured',
      source: 'manual_upload'
    });

    status.textContent = 'Bank statement uploaded successfully.';
    status.style.color = '#28a745';

    if (existingInfo) {
      const uploadDate = new Date(uploadedAt || Date.now()).toLocaleDateString();
      existingInfo.innerHTML = `✓ Manual upload received: <b>${filename}</b> on ${uploadDate}`;
      existingInfo.style.color = '#1f8c5c';
    }
  };

  const fetchTruidStatus = async () => {
    const response = await fetch(`/api/banking/status?userId=${encodeURIComponent(userId)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to check TruID status');
    }

    if (data.verified) {
      applyVerifiedState(data);
      status.textContent = (data.statusLabel === 'Captured' || data.capturedAt)
        ? 'TruID capture completed.'
        : 'Bank statement verified via TruID.';
      status.style.color = '#28a745';

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document:uploaded', { detail: { fileType: 'bank_statement' } }));
      }
      return;
    }

    if (statusChip) {
      statusChip.textContent = data.statusLabel || 'Pending';
      statusChip.classList.remove('success');
    }

    if (data.statusLabel) {
      status.textContent = `TruID status: ${data.statusLabel}`;
      status.style.color = '#7a7a7a';
    }
  };

  const existingManualDoc = await getDocumentInfoByUser(userId, 'bank_statement');
  if (existingManualDoc?.file_name) {
    setManualUploadedState(existingManualDoc.file_name, existingManualDoc.uploaded_at);
  } else {
    await fetchTruidStatus();
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
      if (manualDisclaimerAccepted) {
        resolve(true);
        return;
      }

      if (!disclaimerModal || !disclaimerAcceptBtn || !disclaimerCancelBtn) {
        resolve(true);
        return;
      }

      const closeModal = () => {
        disclaimerModal.classList.add('hidden');
      };

      if (disclaimerConsentCheckbox) {
        disclaimerConsentCheckbox.checked = false;
      }
      disclaimerAcceptBtn.disabled = true;

      const handleAccept = async () => {
        if (disclaimerConsentCheckbox && !disclaimerConsentCheckbox.checked) {
          return;
        }

        try {
          await persistConsentToDeclarations();
          manualDisclaimerAccepted = true;
          closeModal();
          resolve(true);
        } catch (error) {
          console.error('❌ Failed to save manual upload consent', error);
          status.textContent = '❌ Unable to save consent right now. Please try again.';
          status.style.color = '#dc3545';
        }
      };

      const handleCancel = () => {
        closeModal();
        resolve(false);
      };

      if (disclaimerConsentCheckbox) {
        disclaimerConsentCheckbox.onchange = () => {
          disclaimerAcceptBtn.disabled = !disclaimerConsentCheckbox.checked;
        };
      }

      disclaimerAcceptBtn.onclick = handleAccept;
      disclaimerCancelBtn.onclick = handleCancel;
      disclaimerModal.onclick = (event) => {
        if (event.target === disclaimerModal) {
          handleCancel();
        }
      };

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
        status.textContent = '⚠️ Please log in again before uploading.';
        status.style.color = '#ff9800';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (applicationId) {
        formData.append('applicationId', applicationId);
      }

      status.textContent = 'Uploading manual bank statement...';
      status.style.color = '#7a7a7a';
      manualUploadBtn.disabled = true;
      manualUploadBtn.textContent = 'Uploading...';

      try {
        const response = await fetch('/api/bankstatement/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Manual upload failed');
        }

        setManualUploadedState(data?.filename || file.name, data?.uploadedAt || new Date().toISOString());

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('document:uploaded', { detail: { fileType: 'bank_statement' } }));
        }

        manualUploadBtn.textContent = 'Uploaded/Connected ✓';
      } catch (error) {
        console.error('❌ Manual bank statement upload failed', error);
        status.textContent = `❌ Manual upload failed: ${error.message || 'Unknown error'}`;
        status.style.color = '#dc3545';
        manualUploadBtn.disabled = false;
        manualUploadBtn.textContent = 'Manual Bank Upload';
      }
    };

    manualUploadBtn.addEventListener('click', async () => {
      if (!manualDisclaimerAccepted) {
        const accepted = await showManualUploadDisclaimer();
        if (!accepted) {
          return;
        }
      }

      await handleManualUpload();
    });
  }

  connectBtn.addEventListener('click', async () => {
    status.textContent = 'Launching TruID secure connection...';
    status.style.color = '#7a7a7a';
    connectBtn.disabled = true;

    const redirectUrl = `${window.location.origin}/user-portal/?page=apply-loan`;
    // Fetch latest profile from DB before launching TruID
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (profileError) {
        console.warn('⚠️ Could not fetch latest profile from DB, falling back to session metadata', profileError);
      }
      profile = profileData;
    } catch (e) {
      console.warn('⚠️ Exception fetching profile from DB, falling back to session metadata', e);
    }

    const payload = {
      userId,
      name: profile?.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
      idNumber: profile?.identity_number || session.user.user_metadata?.id_number || session.user.user_metadata?.idNumber || null,
      idType: 'id',
      email: session.user.email,
      mobile: session.user.phone || session.user.user_metadata?.phone || session.user.user_metadata?.phone_number,
      correlation: {
        userId,
        applicationId: applicationId || null
      },
      redirectUrl
    };
    console.log('[TruID] Sending payload to backend:', JSON.stringify(payload, null, 2));

    try {
      const res = await fetch('/api/banking/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        const consumerUrl = data.consumerUrl || data.connect_url;
        if (consumerUrl) {
          window.open(consumerUrl, '_blank', 'width=900,height=700');
        }

        status.textContent = 'TruID launched. Complete bank linking to continue.';
        status.style.color = '#7a7a7a';

        if (statusChip) {
          statusChip.textContent = 'In Progress';
          statusChip.classList.remove('success');
        }

        if (statusPollInterval) {
          clearInterval(statusPollInterval);
        }
        statusPollInterval = setInterval(fetchTruidStatus, 5000);
      } else {
        console.error('❌ TruID launch failed', data);
        status.textContent = `❌ TruID start failed: ${data.message || data.error}`;
        status.style.color = '#dc3545';
        connectBtn.disabled = false;
        if (statusChip) {
          statusChip.textContent = 'Pending';
          statusChip.classList.remove('success');
        }
      }
    } catch (err) {
      console.error('⚠️ TruID request error', err);
      status.textContent = '⚠️ Something went wrong while starting TruID.';
      status.style.color = '#ff9800';
      connectBtn.disabled = false;
      if (statusChip) {
        statusChip.textContent = 'Pending';
        statusChip.classList.remove('success');
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBankStatementModule, { once: true });
} else {
  initBankStatementModule();
}
