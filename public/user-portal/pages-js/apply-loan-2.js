import '/user-portal/Services/sessionGuard.js'; // Production auth guard

// Navigation function for step buttons
window.goToStep = function(step) {
  // Guard: Cannot go to step 3 without completing credit check
  if (step >= 3) {
    const creditCheckPassed = sessionStorage.getItem('creditCheckPassed');
    if (creditCheckPassed !== 'true') {
      if (typeof window.showToast === 'function') {
        window.showToast('Credit Check Required', 'Please complete your credit check before proceeding', 'warning');
      } else {
        alert('Please complete your credit check before proceeding');
      }
      return;
    }
  }
  
  const pages = {
    1: 'apply-loan.html',
    2: 'apply-loan-2.html',
    3: 'apply-loan-3.html',
    4: 'confirmation.html'
  };
  
  if (typeof loadPage === 'function') {
    // If in user-portal dynamic loading
    const pageNames = {
      1: 'apply-loan',
      2: 'apply-loan-2',
      3: 'apply-loan-3',
      4: 'confirmation'
    };
    loadPage(pageNames[step]);
  } else {
    // Direct navigation
    window.location.href = pages[step];
  }
}

// Check existing credit check on page load
async function checkCreditCheckStatus() {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;
    
    // Check session storage
    const creditCheckPassed = sessionStorage.getItem('creditCheckPassed');
    const creditScore = sessionStorage.getItem('creditScore');
    
    // Check database
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
    
    // Update circle button if credit check already exists
    if (hasExistingCheck || creditCheckPassed === 'true') {
      const circleBtn = document.getElementById('start-credit-check-btn');
      if (circleBtn) {
        // Stop pulse, go green, change label to "Next"
        circleBtn.classList.remove('is-loading');
        circleBtn.classList.add('is-done');
        circleBtn.style.animation = 'none';

        const label = circleBtn.querySelector('.scc-label');
        const spinner = circleBtn.querySelector('.scc-spinner');
        if (spinner) spinner.style.display = 'none';
        if (label) {
          label.innerHTML = 'Next&nbsp;<i class="fas fa-arrow-right"></i>';
        }

        circleBtn.disabled = false;
        circleBtn.onclick = () => {
          sessionStorage.setItem('creditCheckPassed', 'true');
          if (typeof loadPage === 'function') {
            loadPage('apply-loan-3');
          } else {
            window.location.href = '/user-portal/?page=apply-loan-3';
          }
        };
      }

      // Mark step 2 as completed
      const step2 = document.querySelector('.step.active');
      if (step2) {
        step2.classList.add('completed');
      }

      console.log('✅ Credit check already completed — button set to Next');
    }
  } catch (error) {
    console.error('❌ Error checking credit status:', error);
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkCreditCheckStatus);
} else {
  checkCreditCheckStatus();
}

// Also check when page is loaded via SPA navigation
window.addEventListener('pageLoaded', (event) => {
  if (event?.detail?.pageName === 'apply-loan-2') {
    setTimeout(checkCreditCheckStatus, 100);
  }
});
