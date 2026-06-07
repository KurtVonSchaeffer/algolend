// Credit Check Module JavaScript
console.log('✅ Credit check module script loaded');

let isProcessing = false;
let hasCreditConsent = false;

async function getSessionAndClient() {
  const { supabase } = await import('/Services/supabaseClient.js');
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, session };
}

function setConsentStatusText(text) {
  const statusEl = document.querySelector('#credit-consent-status .consent-status-text');
  if (statusEl) statusEl.textContent = text;
}

async function persistCreditConsent(supabase, userId) {
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
    const missingColumn = String(error?.message || '').toLowerCase().includes('column')
      && String(error?.message || '').toLowerCase().includes('credit_check_consent_');

    if (!missingColumn) throw error;

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
}

async function showCreditConsentModalOnce() {
  const modal = document.getElementById('credit-consent-modal');
  const acceptCheckbox = document.getElementById('credit-consent-accept-checkbox');
  const confirmBtn = document.getElementById('credit-consent-confirm');
  const cancelBtn = document.getElementById('credit-consent-cancel');

  if (!modal || !acceptCheckbox || !confirmBtn || !cancelBtn) {
    return false;
  }

  const { supabase, session } = await getSessionAndClient();
  if (!session?.user?.id) {
    return false;
  }

  const { data: declarationData, error: fetchError } = await supabase
    .from('declarations')
    .select('credit_check_consent_accepted, metadata')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (fetchError) {
    console.warn('Could not read declarations consent state:', fetchError);
  }

  const consentFromColumn = declarationData?.credit_check_consent_accepted === true;
  const consentFromMetadata = declarationData?.metadata?.credit_check_consent_accepted === true;
  const alreadyAccepted = consentFromColumn || consentFromMetadata;

  if (alreadyAccepted) {
    hasCreditConsent = true;
    setConsentStatusText('Credit check consent already captured.');
    return true;
  }

  hasCreditConsent = false;
  setConsentStatusText('Please review and accept the credit bureau consent before running the credit check.');

  modal.classList.remove('hidden');
  acceptCheckbox.checked = false;
  confirmBtn.disabled = true;

  return new Promise((resolve) => {
    const cleanup = () => {
      acceptCheckbox.onchange = null;
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      modal.onclick = null;
    };

    const handleCancel = () => {
      modal.classList.add('hidden');
      cleanup();
      resolve(false);
    };

    const handleConfirm = async () => {
      try {
        await persistCreditConsent(supabase, session.user.id);
        hasCreditConsent = true;
        setConsentStatusText('Credit check consent accepted and saved.');
        modal.classList.add('hidden');
        cleanup();
        resolve(true);
      } catch (error) {
        console.error('Failed to save credit consent:', error);
        alert('Unable to save consent right now. Please try again.');
      }
    };

    acceptCheckbox.onchange = () => {
      confirmBtn.disabled = !acceptCheckbox.checked;
    };

    cancelBtn.onclick = handleCancel;
    confirmBtn.onclick = handleConfirm;
    modal.onclick = (event) => {
      if (event.target === modal) {
        handleCancel();
      }
    };
  });
}

async function initCreditConsentGate() {
  const runButton = document.getElementById('run-credit-check-btn');
  if (!runButton || runButton.disabled) return;

  try {
    const accepted = await showCreditConsentModalOnce();
    if (!accepted) {
      runButton.disabled = false;
      runButton.style.opacity = '1';
      runButton.style.cursor = 'pointer';
      setConsentStatusText('Consent not yet accepted. You can accept it when you run the credit check.');
    } else {
      runButton.disabled = false;
      runButton.style.opacity = '1';
      runButton.style.cursor = 'pointer';
    }
  } catch (error) {
    console.error('Error initializing credit consent gate:', error);
    setConsentStatusText('Unable to verify consent right now. Please reload and try again.');
  }
}

function normalizeDateForInput(value) {
  if (!value) return '';
  const dateString = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  if (/^\d{8}$/.test(dateString)) {
    return `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
  }
  const parsed = new Date(dateString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function getMissingRequiredCreditFields() {
  const required = [
    { id: 'identity_number', label: 'ID Number' },
    { id: 'surname', label: 'Surname' },
    { id: 'forename', label: 'First Name' },
    { id: 'gender', label: 'Gender' },
    { id: 'date_of_birth', label: 'Date of Birth' },
    { id: 'address1', label: 'Street Address' },
    { id: 'postal_code', label: 'Postal Code' }
  ];

  return required.filter(({ id }) => {
    const element = document.getElementById(id);
    const value = element?.value;
    return !value || !String(value).trim();
  });
}

async function prefillCreditCheckFormFromProfile() {
  try {
    const { supabase, session } = await getSessionAndClient();
    if (!session?.user?.id) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('identity_number, first_name, last_name, gender, date_of_birth, address, postal_code, suburb_area, cell_tel_no, contact_number')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profile) return;

    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (element && (element.value == null || element.value.trim() === '')) {
        element.value = value || '';
      }
    };

    setValue('identity_number', profile.identity_number || '');
    setValue('surname', profile.last_name || '');
    setValue('forename', profile.first_name || '');
    setValue('address1', profile.address || '');
    setValue('address2', profile.suburb_area || '');
    setValue('postal_code', profile.postal_code || '');
    setValue('cell_tel_no', profile.cell_tel_no || profile.contact_number || '');

    const genderEl = document.getElementById('gender');
    if (genderEl && !genderEl.value) {
      const rawGender = (profile.gender || '').toUpperCase();
      genderEl.value = rawGender.startsWith('F') ? 'F' : (rawGender.startsWith('M') ? 'M' : '');
    }

    const dobEl = document.getElementById('date_of_birth');
    if (dobEl && !dobEl.value) {
      dobEl.value = normalizeDateForInput(profile.date_of_birth);
    }
  } catch (error) {
    console.warn('Could not prefill credit-check form from profile:', error);
  }
}

// Module loading functions
window.loadCreditCheckModule = function(options = {}) {
  const { autoRun = true } = options;
  console.log('🔓 Loading credit check module');
  const moduleContainer = document.getElementById('module-container');
  const moduleContent = document.getElementById('module-content');
  
  fetch('/user-portal/modules/credit-check.html')
    .then(response => response.text())
    .then(html => {
      moduleContent.innerHTML = html;
      moduleContainer.classList.remove('hidden');
      console.log('✅ Credit check module loaded');
      
      // Attach button listener after loading
      setTimeout(async () => {
        attachButtonListener();
        await prefillCreditCheckFormFromProfile();
        const hasExistingCheck = await checkExistingCreditCheck();
        if (!hasExistingCheck && !autoRun) {
          await initCreditConsentGate();
        }

        if (!hasExistingCheck && autoRun) {
          const missingFields = getMissingRequiredCreditFields();
          if (missingFields.length > 0) {
            const missingLabels = missingFields.map((f) => f.label).join(', ');
            moduleContainer.classList.add('hidden');
            resetForm();
            if (typeof window.showToast === 'function') {
              window.showToast('Profile Details Required', `Complete profile fields first: ${missingLabels}`, 'warning');
            } else {
              alert(`Please complete these profile fields first: ${missingLabels}`);
            }
            if (typeof loadPage === 'function') {
              loadPage('profile');
            }
            return;
          }

          const formContent = document.getElementById('credit-form-content');
          if (formContent) {
            formContent.style.display = 'none';
          }

          await runCreditCheck();
        }
      }, 100);
    })
    .catch(error => {
      console.error('❌ Error loading credit check module:', error);
      alert('Failed to load credit check form. Please try again.');
    });
};

window.closeModule = function() {
  console.log('🔒 Closing credit check module');
  const moduleContainer = document.getElementById('module-container');
  moduleContainer.classList.add('hidden');
  resetForm();
};

// Navigation function
window.goToStep = function(step) {
  const pages = {
    1: 'apply-loan',
    2: 'apply-loan-2',
    3: 'apply-loan-3',
    4: 'confirmation'
  };
  
  if (typeof loadPage === 'function') {
    loadPage(pages[step]);
  } else {
    window.location.href = `/user-portal/?page=${pages[step]}`;
  }
};

// Continue to loan selection
window.continueToLoanSelection = function() {
  closeModule();
  if (typeof loadPage === 'function') {
    loadPage('apply-loan-3');
  } else {
    window.location.href = '/user-portal/?page=apply-loan-3';
  }
};

// Attach button listener
function attachButtonListener() {
  const button = document.getElementById('run-credit-check-btn');
  if (button) {
    button.onclick = runCreditCheck;
    console.log('✅ Credit check button listener attached');
  } else {
    console.error('❌ Button not found');
  }
}

// Check if user already has a credit check
async function checkExistingCreditCheck() {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('⚠️ No session found');
      return false;
    }
    
    // Check session storage first
    const creditCheckPassed = sessionStorage.getItem('creditCheckPassed');
    const creditScore = sessionStorage.getItem('creditScore');
    
    // Check database for existing credit checks
    const applicationId = sessionStorage.getItem('currentApplicationId');
    let hasExistingCheck = false;
    let existingScore = null;
    
    const { data: creditChecks, error: creditCheckError } = await supabase
      .from('credit_checks')
      .select('credit_score, status, checked_at, application_id')
      .eq('user_id', session.user.id)
      .eq('status', 'completed')
      .order('checked_at', { ascending: false })
      .limit(1);
    
    if (!creditCheckError && creditChecks && creditChecks.length > 0) {
      hasExistingCheck = true;
      existingScore = creditChecks[0].credit_score;
      if (creditChecks[0].application_id) {
        sessionStorage.setItem('currentApplicationId', creditChecks[0].application_id);
      }
    }
    
    if (!hasExistingCheck) {
      if (applicationId) {
        const { data: app, error } = await supabase
          .from('loan_applications')
          .select('bureau_score_band, status')
          .eq('id', applicationId)
          .single();
        
        if (!error && app && (app.status === 'BUREAU_OK' || app.status === 'APPROVED') && app.bureau_score_band) {
          hasExistingCheck = true;
          existingScore = app.bureau_score_band;
        }
      } else {
        // Check if user has any recent credit checks tied to applications
        const { data: recentApps, error } = await supabase
          .from('loan_applications')
          .select('bureau_score_band, status, created_at')
          .eq('user_id', session.user.id)
          .in('status', ['BUREAU_OK', 'APPROVED'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!error && recentApps && recentApps.length > 0 && recentApps[0].bureau_score_band) {
          hasExistingCheck = true;
          existingScore = recentApps[0].bureau_score_band;
        }
      }
    }
    
    // Disable button if credit check exists
    if (hasExistingCheck || creditCheckPassed === 'true') {
      const button = document.getElementById('run-credit-check-btn');
      const formContent = document.getElementById('credit-form-content');
      const resultSection = document.getElementById('credit-result');
      const continueBtn = document.getElementById('continue-btn');
      
      if (button) {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        button.innerHTML = '<i class="fas fa-check-circle"></i> Credit Check Already Completed';
        button.onclick = null;
      }
      
      // Show existing result
      if (formContent && resultSection) {
        formContent.style.display = 'none';
        resultSection.style.display = 'block';
        
        const scoreValue = existingScore || creditScore || '---';
        document.getElementById('credit-score-value').textContent = typeof scoreValue === 'number'
          ? `Score: ${scoreValue}`
          : scoreValue;
        
        if (continueBtn) {
          continueBtn.style.display = 'inline-block';
        }
      }
      
      console.log('✅ Existing credit check found - button disabled');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error checking existing credit check:', error);
    return false;
  }
}

// Download ZIP file containing credit report
function downloadZipFile(base64Data, applicationId) {
  try {
    // Convert base64 to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/zip' });
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-report-${applicationId}.zip`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    console.log('📥 Credit report ZIP downloaded');
  } catch (error) {
    console.error('❌ Error downloading ZIP:', error);
  }
}

// Reset form to initial state
function resetForm() {
  document.getElementById('credit-form-content').style.display = 'block';
  document.getElementById('credit-loading').style.display = 'none';
  document.getElementById('credit-result').style.display = 'none';
  document.getElementById('run-credit-check-btn').style.display = 'inline-block';
  document.getElementById('continue-btn').style.display = 'none';
  isProcessing = false;
}

// Main credit check function
async function runCreditCheck() {
  console.log('🚀 Credit check button clicked!');
  
  if (isProcessing) {
    console.log('⏳ Already processing...');
    return;
  }
  
  const button = document.getElementById('run-credit-check-btn');
  
  try {
    if (!hasCreditConsent) {
      const accepted = await showCreditConsentModalOnce();
      if (!accepted) {
        alert('⚠️ Credit check consent is required to continue.');
        return;
      }
    }

    // Import modules dynamically
    const { performCreditCheck } = await import('/Services/dataService.js');
    const { supabase } = await import('/Services/supabaseClient.js');

    await prefillCreditCheckFormFromProfile();
    
    isProcessing = true;
    button.disabled = true;
    button.style.opacity = '0.6';
    
    // Get form values
    const identity_number = document.getElementById('identity_number').value.trim();
    const surname = document.getElementById('surname').value.trim();
    const forename = document.getElementById('forename').value.trim();
    const gender = document.getElementById('gender').value;
    const date_of_birth = document.getElementById('date_of_birth').value;
    const address1 = document.getElementById('address1').value.trim();
    const address2 = document.getElementById('address2').value.trim();
    const postal_code = document.getElementById('postal_code').value.trim();
    const cell_tel_no = document.getElementById('cell_tel_no').value.trim();
    
    console.log('📋 Form values collected');
    
    // Validation
    if (!identity_number || !surname || !forename || !gender || !date_of_birth || !address1 || !postal_code) {
      alert('⚠️ Please fill in all required fields marked with *');
      isProcessing = false;
      button.disabled = false;
      button.style.opacity = '1';
      return;
    }
    
    if (!hasCreditConsent) {
      alert('⚠️ Please accept the credit bureau consent disclaimer to continue');
      isProcessing = false;
      button.disabled = false;
      button.style.opacity = '1';
      return;
    }
    
    if (identity_number.length !== 13) {
      alert('⚠️ ID number must be 13 digits');
      isProcessing = false;
      button.disabled = false;
      button.style.opacity = '1';
      return;
    }

    // Check for duplicate ID number on another account
    try {
      const { data: { session: dupSession } } = await supabase.auth.getSession();
      const currentUserId = dupSession?.user?.id;
      const { data: existingProfiles, error: dupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('identity_number', identity_number)
        .neq('id', currentUserId || '00000000-0000-0000-0000-000000000000');

      if (dupError) {
        console.warn('Duplicate ID check failed (continuing):', dupError);
      } else if (existingProfiles && existingProfiles.length > 0) {
        alert('⚠️ This ID number is already registered on another account. Please use a different ID number, or contact support if you believe this is an error.');
        isProcessing = false;
        button.disabled = false;
        button.style.opacity = '1';
        return;
      }
    } catch (dupCheckErr) {
      console.warn('Duplicate ID check threw (continuing):', dupCheckErr);
    }

    if (postal_code.length !== 4) {
      alert('⚠️ Postal code must be 4 digits');
      isProcessing = false;
      button.disabled = false;
      button.style.opacity = '1';
      return;
    }
    
    console.log('✅ Validation passed');
    
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('⚠️ Please log in to continue');
      isProcessing = false;
      button.disabled = false;
      button.style.opacity = '1';
      return;
    }
    
    console.log('✅ User authenticated');
    
    // Get or create application ID
    let applicationId = sessionStorage.getItem('currentApplicationId');
    if (!applicationId) {
      console.log('📝 Creating new application...');
      const { data: newApp, error: appError } = await supabase
        .from('loan_applications')
        .insert([{
          user_id: session.user.id,
          status: 'BUREAU_CHECKING',
          amount: 0,
          term_months: 0,
          purpose: 'Personal Loan'
        }])
        .select()
        .single();
      
      if (appError) {
        console.error('❌ Error creating application:', appError);
        alert('❌ Failed to create application. Please try again.');
        isProcessing = false;
        button.disabled = false;
        button.style.opacity = '1';
        return;
      }
      
      applicationId = newApp.id;
      sessionStorage.setItem('currentApplicationId', applicationId);
      console.log('✅ Application created:', applicationId);
    } else {
      // Update existing application status
      await supabase
        .from('loan_applications')
        .update({ status: 'BUREAU_CHECKING' })
        .eq('id', applicationId);
      console.log('✅ Application updated:', applicationId);
    }
    
    // Format date
    const dob_formatted = date_of_birth.replace(/-/g, '');
    
    // Prepare user data
    const userData = {
      user_id: session.user.id,
      identity_number,
      surname,
      forename,
      forename2: '',
      forename3: '',
      gender,
      date_of_birth: dob_formatted,
      address1,
      address2,
      address3: '',
      address4: '',
      postal_code,
      home_tel_code: '',
      home_tel_no: '',
      work_tel_code: '',
      work_tel_no: '',
      cell_tel_no,
      passport_flag: 'N'
    };
    
    console.log('📋 User data prepared:', userData);
    
    // Show loading state
    document.getElementById('credit-form-content').style.display = 'none';
    document.getElementById('credit-loading').style.display = 'block';
    button.style.display = 'none';
    
    console.log('🔄 Calling credit check API...');
    
    // Perform credit check
    const result = await performCreditCheck(applicationId, userData);
    
    console.log('✅ Credit check result:', result);
    
    if (result.success) {
      // Extract credit data from result
      const creditData = result.creditScore || {};
      const score = creditData.score || 0;
      const riskType = creditData.riskType || 'UNKNOWN';
      
      // Update application with detailed credit info
      await supabase
        .from('loan_applications')
        .update({
          bureau_score_band: score,
          status: 'BUREAU_OK'
        })
        .eq('id', applicationId);
      
      // Store result in sessionStorage
      sessionStorage.setItem('creditScore', score.toString());
      sessionStorage.setItem('creditRiskType', riskType);
      sessionStorage.setItem('creditCheckPassed', 'true');
      sessionStorage.setItem('creditData', JSON.stringify(creditData));
      
      // Auto-download disabled: keep flow manual-only for report retrieval
      
      // Show result with detailed information
      document.getElementById('credit-loading').style.display = 'none';
      document.getElementById('credit-result').style.display = 'block';
      document.getElementById('credit-score-value').textContent = `Score: ${score} | Risk: ${riskType}`;
      document.getElementById('continue-btn').style.display = 'inline-block';
      
      console.log('✅ Credit check successful!');
      console.log('📊 Credit Data:', creditData);
    } else {
      // Failed
      await supabase
        .from('loan_applications')
        .update({ status: 'BUREAU_DECLINE' })
        .eq('id', applicationId);
      
      document.getElementById('credit-loading').style.display = 'none';
      alert('❌ Credit check failed: ' + (result.error || 'Unknown error'));
      resetForm();
      
      console.error('❌ Credit check failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Credit check error:', error);
    document.getElementById('credit-loading').style.display = 'none';
    alert('❌ An error occurred: ' + error.message);
    resetForm();
  }
}

// -------------------------------------------------------
// SILENT BACKGROUND CREDIT CHECK
// Called from the circular button on apply-loan-2 page.
// No module overlay — runs directly from profile data.
// -------------------------------------------------------

function _resetCircleButton(button) {
  isProcessing = false;
  const label = button.querySelector('.scc-label');
  const spinner = button.querySelector('.scc-spinner');
  if (label)   label.style.display = '';
  if (spinner) spinner.style.display = 'none';
  button.disabled = false;
  button.classList.remove('is-loading');
}

function _showCreditResultPopup(score, riskType, eligibility = null) {
  const popup = document.getElementById('credit-result-popup');
  if (!popup) return;

  const scoreEl  = document.getElementById('cr-score-value');
  const badgeEl  = document.getElementById('cr-risk-badge');
  const descEl   = document.getElementById('cr-risk-desc');
  const bannerEl = popup.querySelector('.cr-banner');
  const ringEl   = popup.querySelector('.cr-score-ring');
  const continueBtn = popup.querySelector('.cr-continue-btn');

  if (scoreEl) scoreEl.textContent = score || '---';

  // Use band from rules engine if available, else fall back to riskType
  const band       = eligibility?.band;
  const decision   = eligibility?.decision;
  const isDeclined = decision === 'declined';

  let riskClass = 'risk-high';
  let riskLabel = band?.label || riskType || 'Unknown';
  let riskDesc  = 'Your credit profile requires further review before proceeding.';

  if (band) {
    if (band.risk_level === 'low')      { riskClass = 'risk-low';    riskDesc = `Great news! You qualify for up to R${Number(band.max_loan_amount).toLocaleString()} at ${band.interest_rate_pa}% p.a.`; }
    else if (band.risk_level === 'medium') { riskClass = 'risk-medium'; riskDesc = `You qualify for up to R${Number(band.max_loan_amount).toLocaleString()} at ${band.interest_rate_pa}% p.a.`; }
    else if (band.risk_level === 'high')   { riskClass = 'risk-high';   riskDesc = `You may qualify for up to R${Number(band.max_loan_amount).toLocaleString()}. A review is required.`; }
    else { riskClass = 'risk-high'; riskDesc = 'Unfortunately your application does not meet our current lending criteria.'; }
  } else {
    const riskUpper = String(riskType || '').toUpperCase();
    if (riskUpper === 'LOW' || score > 650)    { riskClass = 'risk-low';    riskDesc = 'Excellent! Your credit profile looks great. You qualify for preferential rates.'; }
    else if (riskUpper === 'MEDIUM' || score > 400) { riskClass = 'risk-medium'; riskDesc = 'Your credit profile is acceptable. Proceed to select your loan amount.'; }
  }

  if (badgeEl) {
    badgeEl.className   = `cr-risk-badge ${riskClass}`;
    badgeEl.textContent = riskLabel;
  }
  if (descEl)   descEl.textContent = riskDesc;
  if (bannerEl) bannerEl.className  = `cr-banner ${riskClass}`;
  if (ringEl)   ringEl.className    = `cr-score-ring ${riskClass}`;

  // Show band details card if available
  let bandHtml = '';
  if (band && !isDeclined) {
    const term = eligibility?.first_loan_restriction
      ? `<span style="color:#f59e0b;font-weight:700">${band.effective_max_term_months || band.max_term_months} mo ⭐ 1st loan</span>`
      : `${band.max_term_months} months`;
    bandHtml = `
      <div style="background:#f8f9fa;border-radius:12px;padding:14px 16px;margin:12px 0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
        <div><div style="font-size:11px;color:#8E8E93;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Max Loan</div>
             <div style="font-size:16px;font-weight:700;color:#0F172A">R${Number(band.max_loan_amount).toLocaleString()}</div></div>
        <div><div style="font-size:11px;color:#8E8E93;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Rate p.a.</div>
             <div style="font-size:16px;font-weight:700;color:#0F172A">${band.interest_rate_pa}%</div></div>
        <div><div style="font-size:11px;color:#8E8E93;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Max Term</div>
             <div style="font-size:16px;font-weight:700;color:#0F172A">${term}</div></div>
      </div>
      ${eligibility?.first_loan_restriction ? `<p style="font-size:12px;color:#f59e0b;text-align:center;margin:0 0 8px">${eligibility.first_loan_restriction}</p>` : ''}
    `;
  }

  // Inject band card before the continue button
  let bandCard = popup.querySelector('#cr-band-card');
  if (!bandCard) {
    bandCard = document.createElement('div');
    bandCard.id = 'cr-band-card';
    continueBtn?.parentNode?.insertBefore(bandCard, continueBtn);
  }
  bandCard.innerHTML = bandHtml;

  // If hard declined, replace continue button with decline message
  if (isDeclined && continueBtn) {
    const declineReasons = eligibility?.failures?.filter(f => f.action === 'decline') || [];
    continueBtn.style.display = 'none';
    let declineCard = popup.querySelector('#cr-decline-msg');
    if (!declineCard) {
      declineCard = document.createElement('div');
      declineCard.id = 'cr-decline-msg';
      continueBtn.parentNode.insertBefore(declineCard, continueBtn);
    }
    declineCard.innerHTML = `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:8px 0;text-align:left;">
        <div style="font-weight:700;color:#dc2626;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-times-circle"></i> Application Declined
        </div>
        ${declineReasons.map(f => `<p style="font-size:13px;color:#374151;margin:4px 0">• ${f.reason || f.label}</p>`).join('')}
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">Please contact support if you believe this is incorrect.</p>
      </div>`;
  } else if (continueBtn) {
    continueBtn.style.display = '';
    const declineCard = popup.querySelector('#cr-decline-msg');
    if (declineCard) declineCard.innerHTML = '';
  }

  popup.style.display = 'flex';
}

window.startCreditCheckSilent = async function(button) {
  if (isProcessing) return;

  try {
    isProcessing = true;

    // Transition button to loading state
    const label = button.querySelector('.scc-label');
    const spinner = button.querySelector('.scc-spinner');
    if (label)   label.style.display = 'none';
    if (spinner) spinner.style.display = '';
    button.disabled = true;
    button.classList.add('is-loading');

    // Dynamic imports
    const { performCreditCheck } = await import('/Services/dataService.js');
    const { supabase }           = await import('/Services/supabaseClient.js');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      window.showToast?.('Session Expired', 'Please log in again.', 'error');
      _resetCircleButton(button);
      return;
    }

    // Load profile fields required for Experian
    const { data: profile } = await supabase
      .from('profiles')
      .select('identity_number, first_name, last_name, gender, date_of_birth, address, postal_code, suburb_area, cell_tel_no, contact_number')
      .eq('id', session.user.id)
      .maybeSingle();

    // Validate required fields exist in profile
    const requiredMap = {
      'ID Number':      profile?.identity_number,
      'Surname':        profile?.last_name,
      'First Name':     profile?.first_name,
      'Gender':         profile?.gender,
      'Date of Birth':  profile?.date_of_birth,
      'Street Address': profile?.address,
      'Postal Code':    profile?.postal_code,
    };

    const missing = Object.entries(requiredMap)
      .filter(([, v]) => !v || !String(v).trim())
      .map(([k]) => k);

    if (missing.length > 0) {
      window.showToast?.(
        'Profile Incomplete',
        `Please complete your profile first: ${missing.join(', ')}`,
        'warning'
      );
      _resetCircleButton(button);
      if (typeof loadPage === 'function') loadPage('profile');
      return;
    }

    // Ensure credit check consent is persisted
    const { data: declaration } = await supabase
      .from('declarations')
      .select('credit_check_consent_accepted, metadata')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const alreadyConsented =
      declaration?.credit_check_consent_accepted === true ||
      declaration?.metadata?.credit_check_consent_accepted === true;

    if (!alreadyConsented) {
      await persistCreditConsent(supabase, session.user.id);
    }
    hasCreditConsent = true;

    // Get or create application
    let applicationId = sessionStorage.getItem('currentApplicationId');
    if (!applicationId) {
      const { data: newApp, error: appError } = await supabase
        .from('loan_applications')
        .insert([{
          user_id:     session.user.id,
          status:      'BUREAU_CHECKING',
          amount:      0,
          term_months: 0,
          purpose:     'Personal Loan'
        }])
        .select()
        .single();

      if (appError) {
        window.showToast?.('Error', 'Failed to create application. Please try again.', 'error');
        _resetCircleButton(button);
        return;
      }
      applicationId = newApp.id;
      sessionStorage.setItem('currentApplicationId', applicationId);
    } else {
      await supabase
        .from('loan_applications')
        .update({ status: 'BUREAU_CHECKING' })
        .eq('id', applicationId);
    }

    // Normalise gender to single char expected by Experian
    const rawGender = String(profile.gender || '').toUpperCase();
    const gender    = rawGender.startsWith('F') ? 'F' : 'M';

    // Normalise DOB  → YYYYMMDD
    const dobNormalised   = normalizeDateForInput(profile.date_of_birth); // YYYY-MM-DD
    const dob_formatted   = dobNormalised.replace(/-/g, '');              // YYYYMMDD

    const userData = {
      user_id:         session.user.id,
      identity_number: profile.identity_number,
      surname:         profile.last_name,
      forename:        profile.first_name,
      forename2: '', forename3: '',
      gender,
      date_of_birth: dob_formatted,
      address1:      profile.address,
      address2:      profile.suburb_area || '',
      address3: '', address4: '',
      postal_code:   profile.postal_code,
      home_tel_code: '', home_tel_no: '',
      work_tel_code: '', work_tel_no: '',
      cell_tel_no:   profile.cell_tel_no || profile.contact_number || '',
      passport_flag: 'N'
    };

    const result = await performCreditCheck(applicationId, userData);

    if (result.success) {
      const creditData = result.creditScore || {};
      const score      = creditData.score    || 0;
      const riskType   = creditData.riskType || 'Unknown';

      await supabase
        .from('loan_applications')
        .update({ bureau_score_band: score, status: 'BUREAU_OK' })
        .eq('id', applicationId);

      sessionStorage.setItem('creditScore',       score.toString());
      sessionStorage.setItem('creditRiskType',    riskType);
      sessionStorage.setItem('creditCheckPassed', 'true');
      sessionStorage.setItem('creditData',        JSON.stringify(creditData));

      // ── Run credit rules engine evaluation ──────────────────────
      let eligibility = null;
      try {
        const evalRes = await fetch(`/api/applications/${applicationId}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }
        });
        if (evalRes.ok) {
          eligibility = await evalRes.json();
          sessionStorage.setItem('creditEligibility', JSON.stringify(eligibility));
        }
      } catch (e) {
        console.warn('[credit-check] Rules evaluation failed (non-blocking):', e.message);
      }
      // ────────────────────────────────────────────────────────────

      // Flip button to "done" state
      isProcessing = false;
      if (spinner) spinner.style.display = 'none';
      if (label) {
        label.style.display   = '';
        label.innerHTML       = 'Done&nbsp;<i class="fas fa-check"></i>';
      }
      button.classList.remove('is-loading');
      button.classList.add('is-done');

      // Show the result popup — with band info if available
      _showCreditResultPopup(score, riskType, eligibility);

    } else {
      await supabase
        .from('loan_applications')
        .update({ status: 'BUREAU_DECLINE' })
        .eq('id', applicationId);

      window.showToast?.('Credit Check Failed', result.error || 'Unknown error', 'error');
      _resetCircleButton(button);
    }

  } catch (error) {
    console.error('❌ Silent credit check error:', error);
    window.showToast?.('Error', error.message || 'An unexpected error occurred', 'error');
    _resetCircleButton(button);
  }
};

