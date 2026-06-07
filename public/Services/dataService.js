import { supabase } from './supabaseClient.js';
import { notifyApplicationStatusChange } from './notificationService.js';

function resolveFirstPaymentDate(source = {}) {
    const offerDetails = source.offer_details || {};
    const candidate = offerDetails.first_payment_date || source.repayment_start_date || source.next_payment_date;
    if (!candidate) {
        return null;
    }
    const date = new Date(candidate);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function normalizeToIsoMidnight(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null;
    }
    const clone = new Date(date);
    clone.setUTCHours(0, 0, 0, 0);
    return clone.toISOString();
}

// --- Dashboard Metrics ---
export async function fetchDashboardData() {
    try {
        const [
            loansRes,
            paymentsRes,
            appsCountRes,
            monthlyDataRes,
            distributionRes,
        ] = await Promise.all([
            supabase.from('loans').select('principal_amount'),
            supabase.from('payments').select('amount'),
            supabase.from('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.rpc('get_monthly_loan_performance'),
            supabase.rpc('get_portfolio_status_breakdown'),
        ]);

        if (loansRes.error) throw loansRes.error;
        if (paymentsRes.error) throw paymentsRes.error;
        if (appsCountRes.error) throw appsCountRes.error;
        if (monthlyDataRes.error) throw monthlyDataRes.error;
        if (distributionRes.error) throw distributionRes.error;

        const totalPrincipal = loansRes.data.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
        const totalRepaid = paymentsRes.data.reduce((sum, payment) => sum + Number(payment.amount), 0);

        return {
            totalPrincipal,
            totalRepaid,
            outstandingBalance: totalPrincipal - totalRepaid,
            pendingApplications: appsCountRes.count || 0,
            monthlyLoanData: monthlyDataRes.data || [],
            applicationDistribution: distributionRes.data || [],
            error: null,
        };
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        return { error: error.message };
    }
}

// --- Applications Data ---
export async function fetchLoanApplications() {
    return supabase
        .from('loan_applications')
        .select('*, profiles:user_id(full_name)')
        .order('created_at', { ascending: false });
}

export async function fetchApplicationDetail(applicationId) {
    const { data: appData, error: appError } = await supabase
        .from('loan_applications')
        .select('*, profiles:user_id(*)')
        .eq('id', applicationId)
        .single();

    if (appError) {
        console.error("Error fetching application details:", appError);
        throw appError;
    }

    // ✅ MODIFICATION: Fetch the payout record along with other details.
    const [financialRes, docsRes, payoutRes] = await Promise.all([
        supabase.from('financial_profiles').select('*').eq('user_id', appData.user_id).maybeSingle(),
        supabase.from('documents').select('*').eq('application_id', applicationId),
        supabase.from('payouts').select('status').eq('application_id', applicationId).maybeSingle()
    ]);

    return {
        ...appData,
        financial_profiles: financialRes.data ? [financialRes.data] : [],
        documents: docsRes.data || [],
        payout: payoutRes.data // ✅ MODIFICATION: Add payout data to the returned object.
    };
}

export async function updateApplicationStatus(applicationId, newStatus) {
  // Update the application status
  const { data: updatedApp, error: updateError } = await supabase
    .from('loan_applications')
    .update({ status: newStatus }) 
    .eq('id', applicationId)
    .select()
    .single();
  
  if (updateError) {
    console.error('Error updating application status:', updateError);
    return { data: null, error: updateError };
  }
  
  // Create notification for status change
  if (updatedApp && ['OFFERED', 'DECLINED', 'DISBURSED', 'ACTIVE'].includes(newStatus)) {
    await notifyApplicationStatusChange(
      updatedApp.user_id,
      applicationId,
      newStatus,
      updatedApp.amount
    );
  }
  
  // If status is OFFERED, create a loan record
  if (newStatus === 'OFFERED' && updatedApp) {
    console.log('📝 Creating loan record for application:', applicationId);
    
    // Check if loan already exists for this application
    const { data: existingLoan } = await supabase
      .from('loans')
      .select('id')
      .eq('application_id', applicationId)
      .maybeSingle();
    
    if (existingLoan) {
      console.log('✅ Loan already exists for this application');
      return { data: updatedApp, error: null };
    }
    
        // Extract loan details from offer_details if available
        const offerDetails = updatedApp.offer_details || {};
        const interestRate = offerDetails.interest_rate || 0.025; // Default 2.5% monthly

        const resolvedFirstPayment = resolveFirstPaymentDate(updatedApp);
        const nextPaymentDate = resolvedFirstPayment
            ? new Date(resolvedFirstPayment)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        nextPaymentDate.setUTCHours(0, 0, 0, 0);
        const firstPaymentIso = normalizeToIsoMidnight(resolvedFirstPayment);
    
    // Calculate monthly payment
    const principal = parseFloat(updatedApp.amount);
    const termMonths = parseInt(updatedApp.term_months);
    const rate = parseFloat(interestRate);
    let monthlyPayment;
    if (rate === 0) {
      monthlyPayment = principal / termMonths;
    } else {
      const factor = Math.pow(1 + rate, termMonths);
      monthlyPayment = principal * (rate * factor) / (factor - 1);
    }
    
    // Create loan record
        const loanBase = {
            application_id: applicationId,
            user_id: updatedApp.user_id,
            principal_amount: principal,
            interest_rate: rate,
            term_months: termMonths,
            monthly_payment: monthlyPayment,
            status: 'active',
            start_date: new Date().toISOString(),
            next_payment_date: nextPaymentDate.toISOString(),
                        outstanding_balance: principal,
                        has_credit_life_insurance: Boolean(
                            updatedApp.has_credit_life_insurance
                            ?? offerDetails.credit_life_enabled
                            ?? false
                        )
        };
        if (firstPaymentIso) {
            loanBase.first_payment_date = firstPaymentIso;
        }

        let newLoan = null;
        let loanError = null;

        const initialInsert = await supabase
            .from('loans')
            .insert([loanBase])
            .select()
            .single();

        if (initialInsert.error && firstPaymentIso && /first_payment_date/i.test(initialInsert.error.message || '')) {
            console.warn('⚠️ loans.first_payment_date column missing. Retrying insert without it.');
            const fallbackLoan = { ...loanBase };
            delete fallbackLoan.first_payment_date;
            const retryInsert = await supabase
                .from('loans')
                .insert([fallbackLoan])
                .select()
                .single();
            newLoan = retryInsert.data;
            loanError = retryInsert.error;
        } else {
            newLoan = initialInsert.data;
            loanError = initialInsert.error;
        }

        if (loanError) {
            console.error('❌ Error creating loan record:', loanError);
            // Don't fail the status update if loan creation fails
            // Admin can manually create loan if needed
        } else {
            console.log('✅ Loan created successfully:', newLoan);
        }
  }
  
  return { data: updatedApp, error: null };
}

export async function createLoanApplication(appData) {
    const appDataForDb = {
        user_id: appData.user_id,
        amount: parseFloat(appData.amount),
        term_months: parseInt(appData.term),
        purpose: appData.purpose || 'Personal Loan',
        status: appData.status || 'STARTED',
    };

    return supabase
        .from('loan_applications')
        .insert([appDataForDb])
        .select('*, profiles:user_id(full_name)')
        .single();
}

// Helper function to create loan record for an application
export async function createLoanFromApplication(applicationId) {
    console.log('📝 Manually creating loan record for application:', applicationId);
    
    // Fetch the application
    const { data: app, error: appError } = await supabase
        .from('loan_applications')
        .select('*')
        .eq('id', applicationId)
        .single();
    
    if (appError || !app) {
        console.error('❌ Application not found:', appError);
        return { data: null, error: appError };
    }
    
    if (app.status !== 'OFFERED') {
        console.error('❌ Application status is not OFFERED:', app.status);
        return { data: null, error: new Error('Application must have OFFERED status') };
    }
    
    // Check if loan already exists
    const { data: existingLoan } = await supabase
        .from('loans')
        .select('id')
        .eq('application_id', applicationId)
        .maybeSingle();
    
    if (existingLoan) {
        console.log('✅ Loan already exists:', existingLoan.id);
        return { data: existingLoan, error: null };
    }
    
    // Extract loan details
    const offerDetails = app.offer_details || {};
    const interestRate = offerDetails.interest_rate || 0.025;
    const resolvedFirstPayment = resolveFirstPaymentDate(app);
    const nextPaymentDate = resolvedFirstPayment
        ? new Date(resolvedFirstPayment)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    nextPaymentDate.setUTCHours(0, 0, 0, 0);
    const firstPaymentIso = normalizeToIsoMidnight(resolvedFirstPayment);
    
    // Calculate monthly payment
    const principal = parseFloat(app.amount);
    const termMonths = parseInt(app.term_months);
    const rate = parseFloat(interestRate);
    let monthlyPayment;
    if (rate === 0) {
      monthlyPayment = principal / termMonths;
    } else {
      const factor = Math.pow(1 + rate, termMonths);
      monthlyPayment = principal * (rate * factor) / (factor - 1);
    }

    // Create loan record
    const baseLoanData = {
        application_id: applicationId,
        user_id: app.user_id,
        principal_amount: principal,
        interest_rate: rate,
        term_months: termMonths,
        monthly_payment: monthlyPayment,
        status: 'active',
        start_date: new Date().toISOString(),
        next_payment_date: nextPaymentDate.toISOString(),
                outstanding_balance: principal,
                has_credit_life_insurance: Boolean(
                    app.has_credit_life_insurance
                    ?? offerDetails.credit_life_enabled
                    ?? false
                )
    };
    if (firstPaymentIso) {
        baseLoanData.first_payment_date = firstPaymentIso;
    }

    const initialInsert = await supabase
        .from('loans')
        .insert([baseLoanData])
        .select()
        .single();

    let newLoan = initialInsert.data;
    let loanError = initialInsert.error;

    if (loanError && firstPaymentIso && /first_payment_date/i.test(loanError.message || '')) {
        console.warn('⚠️ loans.first_payment_date column missing. Retrying insert without it.');
        const fallbackLoan = { ...baseLoanData };
        delete fallbackLoan.first_payment_date;
        const retryInsert = await supabase
            .from('loans')
            .insert([fallbackLoan])
            .select()
            .single();
        newLoan = retryInsert.data;
        loanError = retryInsert.error;
    }
    
    if (loanError) {
        console.error('❌ Error creating loan:', loanError);
        return { data: null, error: loanError };
    }
    
    console.log('✅ Loan created successfully:', newLoan);
    return { data: newLoan, error: null };
}

// Admin function to create application for any user
export async function createApplicationAsAdmin(appData) {
    // Get current admin user for created_by_admin field
    const { data: { session } } = await supabase.auth.getSession();
    
    const applicationData = {
        user_id: appData.p_user_id,
        amount: parseFloat(appData.p_loan_amount),
        term_months: parseInt(appData.p_term_months),
        purpose: appData.p_purpose || 'Personal Loan',
        status: 'STARTED',
        created_by_admin: session?.user?.id || null // Track which admin created it
        // created_at and updated_at are auto-generated
        // Other fields (bureau_score_band, affordability_result, offer_details, etc.) 
        // will be populated later in the loan workflow
    };

    return supabase
        .from('loan_applications')
        .insert([applicationData])
        .select('*, profiles:user_id(full_name)')
        .single();
}

export async function upsertFinancialProfile(financialData) {
    return supabase
        .from('financial_profiles')
        .upsert(financialData, { onConflict: 'user_id' })
        .select();
}

// Credit Check - Trigger Experian credit check
export async function performCreditCheck(applicationId, userData) {
    try {
        console.log('🔍 Initiating credit check for application:', applicationId);
        
        // Get auth token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const response = await fetch('/api/credit-check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            body: JSON.stringify({
                applicationId,
                userData
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Credit check failed');
        }
        
        console.log('✅ Credit check completed:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Credit check error:', error);
        throw error;
    }
}


// --- Payments, Payouts & Users Data ---
export async function fetchPayments() {
    return supabase
        .from('payments')
        .select('*, profile:user_id(full_name)')
        .order('payment_date', { ascending: false });
}

export async function fetchPayouts() {
    return supabase
        .from('payouts')
        .select('*')
        .order('payout_date', { ascending: false });
}

export async function createPayout(payoutData) {
    return supabase
        .from('payouts')
        .insert([payoutData]);
}

export async function deletePayout(applicationId) {
    return supabase
        .from('payouts')
        .delete()
        .eq('application_id', applicationId);
}

export async function updatePayoutStatus(payoutId) {
    return supabase
        .from('payouts')
        .update({ status: 'disbursed', payout_date: new Date().toISOString() })
        .eq('id', payoutId);
}

export async function fetchUsers() {
    return supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
}
