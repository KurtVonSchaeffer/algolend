// This page script simply bootstraps the shared loan configuration module logic.
// Keeping the heavy lifting inside modules-js/loan-config.js prevents duplicate logic
// and ensures both the SPA route and the standalone page behave the same way.

import '/user-portal/Services/sessionGuard.js'; // Production auth guard
import '/user-portal/modules-js/loan-config.js';

// Guard: Check if credit check is completed before allowing access
async function checkCreditCheckCompleted() {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      redirectToStep2('You must be logged in');
      return;
    }
    
    // Check if loan config was already completed in this session
    const loanConfigCompleted = sessionStorage.getItem('loanConfigCompleted');
    if (loanConfigCompleted === 'true') {
      const step3 = document.querySelector('.step.active');
      if (step3) {
        step3.classList.add('completed');
      }
    }
    
    // Check session storage first
    const creditCheckPassed = sessionStorage.getItem('creditCheckPassed');
    if (creditCheckPassed === 'true') {
      console.log('✅ Credit check verified (session storage)');
      return;
    }
    
    // Check database for completed credit checks
    const { data: creditChecks, error: creditCheckError } = await supabase
      .from('credit_checks')
      .select('credit_score, status, checked_at')
      .eq('user_id', session.user.id)
      .eq('status', 'completed')
      .order('checked_at', { ascending: false })
      .limit(1);
    
    if (!creditCheckError && creditChecks && creditChecks.length > 0) {
      console.log('✅ Credit check verified (database)');
      // Store in session for future checks
      sessionStorage.setItem('creditCheckPassed', 'true');
      sessionStorage.setItem('creditScore', creditChecks[0].credit_score);
      return;
    }
    
    // Check if user has an approved/bureau_ok application
    const { data: applications, error: appError } = await supabase
      .from('loan_applications')
      .select('bureau_score_band, status')
      .eq('user_id', session.user.id)
      .in('status', ['BUREAU_OK', 'APPROVED'])
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!appError && applications && applications.length > 0 && applications[0].bureau_score_band) {
      console.log('✅ Credit check verified (existing application)');
      sessionStorage.setItem('creditCheckPassed', 'true');
      sessionStorage.setItem('creditScore', applications[0].bureau_score_band);
      return;
    }
    
    // No credit check found - redirect back
    redirectToStep2('Please complete your credit check first');
    
  } catch (error) {
    console.error('❌ Error verifying credit check:', error);
    redirectToStep2('Unable to verify credit check status');
  }
}

function redirectToStep2(message) {
  if (typeof window.showToast === 'function') {
    window.showToast('Credit Check Required', message, 'warning');
  } else {
    alert(message);
  }
  
  setTimeout(() => {
    if (typeof loadPage === 'function') {
      loadPage('apply-loan-2');
    } else {
      window.location.href = '/user-portal/?page=apply-loan-2';
    }
  }, 1500);
}

// Run guard on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkCreditCheckCompleted);
} else {
  checkCreditCheckCompleted();
}

// Also run when page is loaded via SPA navigation
window.addEventListener('pageLoaded', (event) => {
  if (event?.detail?.pageName === 'apply-loan-3') {
    checkCreditCheckCompleted();
  }
});
