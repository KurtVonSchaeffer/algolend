import { DEFAULT_SYSTEM_SETTINGS, normalizeCarouselSlides } from '../../../shared/theme-runtime.js';
import { supabase } from './supabaseClient.js';

export { DEFAULT_SYSTEM_SETTINGS };

function resolveFirstPaymentDate(source = {}) {
  const offerDetails = source.offer_details || {};
  const candidate = offerDetails.first_payment_date || source.repayment_start_date || source.next_payment_date;
  if (!candidate) return null;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeToIsoMidnight(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const clone = new Date(date);
  clone.setUTCHours(0, 0, 0, 0);
  return clone.toISOString();
}

// Helper to split full name into first and last names for institutional schema
function splitFullName(fullName = '') {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: 'NOT_PROVIDED' };
  const last = parts.pop();
  const first = parts.join(' ');
  return { first, last };
}

async function ensureLoanFromApplication(application) {
  if (!application?.id) return { data: null, error: new Error('Invalid application payload') };
  const applicationId = application.id;

  const { data: existingLoan } = await supabase
    .from('loans')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (existingLoan) return { data: existingLoan, error: null };

  const totalRepayment = Number(application.offer_total_repayment || 0);
  const startDate = new Date().toISOString();
  const repaymentDate = application.repayment_start_date || startDate;

  const baseLoan = {
    application_id: applicationId,
    user_id: application.user_id,
    principal_amount: Number(application.offer_principal || application.amount || 0),
    interest_rate: Number(application.offer_interest_rate || 0),
    term_months: Number(application.term_months || 1),
    monthly_payment: Number(application.offer_monthly_repayment || 0),
    status: 'active',
    start_date: startDate,
    first_payment_date: repaymentDate,
    next_payment_date: repaymentDate,
    outstanding_balance: totalRepayment,
    total_repayment: totalRepayment,
    has_credit_life_insurance: Boolean(
      application.has_credit_life_insurance
      ?? application.offer_details?.credit_life_enabled
      ?? false
    )
  };

  const { data, error } = await supabase
    .from('loans')
    .insert([baseLoan])
    .select()
    .single();

  if (error && /first_payment_date/i.test(error.message || '')) {
    const fallback = { ...baseLoan };
    delete fallback.first_payment_date;
    const retry = await supabase.from('loans').insert([fallback]).select().single();
    return { data: retry.data, error: retry.error };
  }
  return { data, error };
}

const hydrateSystemSettings = (settings = {}) => ({
  ...DEFAULT_SYSTEM_SETTINGS,
  ...settings,
  carousel_slides: Array.isArray(settings.carousel_slides) ? settings.carousel_slides : (DEFAULT_SYSTEM_SETTINGS.carousel_slides || [])
});

export async function createWalkInClient(clientData) {
  const newId = crypto.randomUUID();
  const { first, last } = splitFullName(clientData.fullName);

  const { data, error } = await supabase
    .from('profiles') // Walk-in client goes to profiles
    .insert([
      {
        id: newId,
        first_name: first,
        surname: last,
        id_number: clientData.idNumber,
        phone_mobile: clientData.phone,
        email: clientData.email || null,
        branch_id: clientData.branchId, 
        role: 'borrower'
      }
    ])
    .select()
    .single();

  return { data, error };
}

export async function fetchDashboardData() {
  try {
    const { data: stats } = await supabase.rpc('get_dashboard_stats').single();
    // Use manual_payments (confirmed) as the source of collected payments
    const { data: payments } = await supabase.from('manual_payments').select('amount').eq('status', 'confirmed');
    const { data: loans } = await supabase.from('loans').select('principal_amount, status');

    const totalCollected = payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
    const totalDisbursed = loans?.reduce((sum, l) => sum + (Number(l.principal_amount) || 0), 0) || 0;
    
    let activeCount = 0, defaultCount = 0, repaidCount = 0;
    loans?.forEach(l => {
      const s = (l.status || '').toLowerCase();
      if (s === 'active') activeCount++;
      else if (s === 'default' || s === 'arrears') defaultCount++;
      else if (s === 'repaid' || s === 'settled') repaidCount++;
    });

    return {
      financials: {
        total_disbursed: totalDisbursed,
        total_collected: totalCollected,
        profit_margin: totalDisbursed > 0 ? (((totalCollected - totalDisbursed) / totalDisbursed) * 100).toFixed(1) : 0,
        active_loans_count: activeCount,
        pending_apps: stats?.pending_applications || 0
      },
      portfolioStatus: [
        { name: 'Active', value: activeCount },
        { name: 'Default', value: defaultCount },
        { name: 'Repaid', value: repaidCount }
      ],
      error: null
    };
  } catch (error) {
    return { financials: null, portfolioStatus: null, error: error.message };
  }
}

export async function fetchPipelineApplications() {
  const { data, error } = await supabase
    .from('loan_applications')
    .select('id, amount, status, created_at, profiles:user_id(full_name)') // Read from View
    .not('status', 'in', '(DISBURSED,DECLINED)')
    .order('created_at', { ascending: false });
  return { data, error: error ? error.message : null };
}

export async function fetchLoanApplications() {
  return supabase
    .from('loan_applications')
    .select('*, profiles:user_id(full_name, identity_number)')
    .order('created_at', { ascending: false });
}

export async function fetchApplicationDetail(applicationId) {
  const { data: appData, error: appError } = await supabase
    .from('loan_applications')
    .select(`
        *,
        profiles:user_id(*),
        creator:created_by_admin(full_name, email),
        reviewer:reviewed_by_admin(full_name, email)
    `)
    .eq('id', applicationId)
    .single();
  if (appError) throw appError;
  
  const userId = appData.user_id;
  const [finRes, docsRes, payoutRes, bankRes, creditRes, loansRes, appHistoryRes] = await Promise.all([
    supabase.from('financial_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('document_uploads').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false }),
    supabase.from('payouts').select('status').eq('application_id', applicationId).maybeSingle(),
    supabase.from('bank_accounts').select('*').eq('user_id', userId),
    supabase.from('credit_checks').select('*').eq('user_id', userId).order('checked_at', { ascending: false }),
    supabase.from('loans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('loan_applications').select('id, status, amount, created_at, purpose').eq('user_id', userId).neq('id', applicationId).order('created_at', { ascending: false })
  ]);

  return {
    ...appData,
    financial_profiles: finRes.data ? [finRes.data] : [],
    documents: docsRes.data || [],
    payout: payoutRes.data || null,
    bank_accounts: bankRes.data || [],
    credit_checks: creditRes.data || [],
    loan_history: loansRes.data || [],
    application_history: appHistoryRes.data || []
  };
}

export async function updateApplicationStatus(applicationId, newStatus) {
  try {
    const { data: app, error: fetchError } = await supabase.from('loan_applications').select('*').eq('id', applicationId).single();
    if (fetchError) throw fetchError;

    let updatePayload = { status: newStatus };

    if (['READY_TO_DISBURSE', 'DISBURSED', 'OFFER_ACCEPTED'].includes(newStatus)) {
      const { count: historyCount } = await supabase.from('loans').select('*', { count: 'exact', head: true }).eq('user_id', app.user_id);
      const principal = Number(app.amount || 0);
      const term = Number(app.term_months || 1);
      const MONTHLY_ADMIN_FEE = 60.00;
      const INITIATION_FEE_RATE = 0.15;
      const totalAnnualRate = (historyCount < 3) ? 0.20 : 0.18; 
      const interestOnlyRate = totalAnnualRate - INITIATION_FEE_RATE;
      const totalInterest = principal * interestOnlyRate * (term / 12);
      const totalInitiation = principal * INITIATION_FEE_RATE;
      const totalAdminFees = MONTHLY_ADMIN_FEE * term;
      const totalRepayment = principal + totalInterest + totalInitiation + totalAdminFees;
      const monthlyPayment = totalRepayment / term;
      const scheduledDate = app.repayment_start_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      updatePayload = {
        ...updatePayload,
        offer_principal: principal,
        offer_interest_rate: totalAnnualRate,
        offer_total_interest: totalInterest,
        offer_total_initiation_fees: totalInitiation,
        offer_total_admin_fees: totalAdminFees,
        offer_total_repayment: totalRepayment,
        offer_monthly_repayment: monthlyPayment,
        repayment_start_date: scheduledDate
      };
    }

    const { data: updatedApp, error: updateError } = await supabase.from('loan_applications').update(updatePayload).eq('id', applicationId).select().single();
    if (updateError) throw updateError;
    if (newStatus === 'DISBURSED' || newStatus === 'ACTIVE') await ensureLoanFromApplication(updatedApp);

    // ── Audit trail ────────────────────────────────────────────────
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const { data: adminProfile } = userId
            ? await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
            : { data: null };
        await supabase.from('audit_log').insert([{
            entity_type:       'loan_application',
            entity_id:         String(applicationId),
            action:            'status_change',
            old_value:         { status: app.status },
            new_value:         { status: newStatus },
            description:       `Status changed from ${app.status} → ${newStatus}`,
            performed_by:      userId || null,
            performed_by_name: adminProfile?.full_name || session?.user?.email || 'System'
        }]);
    } catch (_) { /* audit is non-blocking */ }
    // ──────────────────────────────────────────────────────────────

    // ── Client notification (non-blocking) ────────────────────────
    // Statuses that trigger a client SMS/WhatsApp
    const NOTIFY_STATUSES = ['OFFERED', 'APPROVED', 'DISBURSED', 'REJECTED', 'DECLINED', 'IN_ARREARS'];
    if (NOTIFY_STATUSES.includes(newStatus)) {
        fetch('/api/notifications/status-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId, newStatus })
        })
        .then(r => r.json())
        .then(r => console.log(`[notify] ${newStatus} → sent=${r.sent}`, r.reason || ''))
        .catch(e => console.warn('[notify] status-change failed:', e.message));
    }
    // ──────────────────────────────────────────────────────────────

    return { data: updatedApp, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export const fetchUsers = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*, branches(id, name)')
        .order('created_at', { ascending: false });
    return error ? [] : data;
};

export async function fetchProfile(userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single();
}

export async function fetchUserDetail(userId) {
  const { data: profile, error: profError } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (profError) return { data: null, error: profError.message };
  const [finRes, appRes] = await Promise.all([
    supabase.from('financial_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('loan_applications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  ]);
  return { data: { profile, financials: finRes.data || null, applications: appRes.data || [] }, error: null };
}

export async function fetchPayments() {
  // Query manual_payments joined with loans for the balance
  const result = await supabase
    .from('manual_payments')
    .select(`
      *,
      profiles:user_id(full_name, identity_number, cell_tel_no),
      loan_applications:application_id(
        id, loan_number, amount, status,
        offer_monthly_repayment, offer_total_repayment,
        loans(outstanding_balance)
      )
    `)
    .order('payment_date', { ascending: false });

  if (result.data) {
    result.data = result.data.map(p => {
      const app = p.loan_applications;
      const loan = Array.isArray(app?.loans) ? app.loans[0] : app?.loans;
      return {
        ...p,
        // shape expected by incoming-payments table render
        profile: p.profiles,
        loan_id: p.application_id,
        loan_number: app?.loan_number || '',
        loan: {
          outstanding_balance: Number(loan?.outstanding_balance ?? app?.offer_total_repayment ?? 0),
          principal_amount:    Number(app?.amount ?? 0),
          application: app || {}
        }
      };
    });
  }
  return result;
}

export async function fetchPayouts() {
  return supabase.from('payouts').select('*, profile:user_id(full_name, email), application:loan_applications(status, branch_id, bank_account:bank_account_id(*))').order('created_at', { ascending: false });
}

export async function approvePayout(payoutId) {
    const { data, error } = await supabase.from('payouts').update({ status: 'APPROVED', approved_at: new Date().toISOString() }).eq('id', payoutId).select().single();
    return { data, error: error ? error.message : null };
}

export async function createPayout(applicationId, payoutData = {}) {
    const { data, error } = await supabase.from('payouts').insert([{ application_id: applicationId, status: 'PENDING', ...payoutData }]).select().single();
    return { data, error: error ? error.message : null };
}

export async function deletePayout(payoutId) {
    const { error } = await supabase.from('payouts').delete().eq('id', payoutId);
    return { error: error ? error.message : null };
}

export async function updateApplicationNotes(applicationId, notes) {
    const { data, error } = await supabase.from('loan_applications').update({ notes }).eq('id', applicationId).select().single();
    return { data, error: error ? error.message : null };
}

export async function fetchBranches() {
    const { data, error } = await supabase.from('branches').select('*').order('name');
    return { data: data || [], error: error ? error.message : null };
}

export async function claimClientProtocol(userId, branchId) {
    const { data, error } = await supabase.from('profiles').update({ branch_id: branchId }).eq('id', userId).select().single();
    return { data, error: error ? error.message : null };
}

export async function updateUserRole(userId, role) {
    const { data, error } = await supabase.from('profiles').update({ role }).eq('id', userId).select().single();
    return { data, error: error ? error.message : null };
}

export async function getPaymentMethods() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Not authenticated' };
    const { data, error } = await supabase.from('bank_accounts').select('*').eq('user_id', user.id);
    return { data: data || [], error: error ? error.message : null };
}

export async function addPaymentMethod(methodData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    const { data, error } = await supabase.from('bank_accounts').insert([{ ...methodData, user_id: user.id }]).select().single();
    return { data, error: error ? error.message : null };
}

export async function updateMyAvatar(avatarUrl) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    const { data, error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id).select().single();
    return { data, error: error ? error.message : null };
}

export async function updateMyProfile(profileData) {
  const { first, last } = splitFullName(profileData.full_name);
  return supabase.from('consumers').update({ first_name: first, surname: last, phone_mobile: profileData.contact_number }).eq('id', profileData.id);
}

export async function fetchSystemSettings() {
  const { data, error } = await supabase.from('system_settings').select('*').eq('id', 'global').maybeSingle();
  return { data: hydrateSystemSettings(data || {}), error: (error && error.code !== 'PGRST116') ? error.message : null };
}

export async function updateSystemSettings(settings) {
  try {
    const { data: userResult } = await supabase.auth.getUser();
    const carouselSlides = normalizeCarouselSlides(settings.carousel_slides);
    const payload = {
      id: 'global',
      company_name: normalizeCompanyName(settings.company_name),
      primary_color: settings.primary_color,
      secondary_color: settings.secondary_color,
      tertiary_color: settings.tertiary_color,
      theme_mode: settings.theme_mode,
      company_logo_url: settings.company_logo_url || null,
      auth_background_url: settings.auth_background_url || null,
      auth_background_flip: normalizeBoolean(settings.auth_background_flip, false),
      auth_overlay_color: normalizeHexColor(settings.auth_overlay_color, DEFAULT_SYSTEM_SETTINGS.auth_overlay_color),
      auth_overlay_enabled: normalizeBoolean(settings.auth_overlay_enabled, DEFAULT_SYSTEM_SETTINGS.auth_overlay_enabled),
      carousel_slides: carouselSlides,
      updated_by: userResult?.user?.id || null
    };

    const { data, error } = await supabase
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    return {
      data: hydrateSystemSettings(data || {}),
      error: error ? error.message : null
    };
  } catch (error) {
    return {
      data: null,
      error: error.message
    };
  }
}

// =================================================================
// == LOAN SYNCING
// =================================================================
export async function syncApplicationToLoans(applicationId) {
  try {
    const { data: app, error: appError } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('id', applicationId)
      .single();
    if (appError) throw appError;

    if (app.status !== 'OFFERED' && app.status !== 'DISBURSED' && app.status !== 'APPROVED') {
        // Just log or ignore
    }

    const { data: existingLoan } = await supabase
      .from('loans')
      .select('id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (existingLoan) {
      return { error: 'Loan already exists' };
    }

    const offerDetails = app.offer_details || {};
    const annualRate = offerDetails.interest_rate ? parseFloat(offerDetails.interest_rate) : 0.20;
    const monthlyRate = annualRate / 12;
    const principal = parseFloat(app.amount);
    const termMonths = parseInt(app.term_months);
    const monthlyServiceFee = 60.00;

    const monthlyInterest = principal * monthlyRate;
    const principalPart = principal / termMonths;
    const monthlyPayment = principalPart + monthlyInterest + monthlyServiceFee;
    const resolvedFirstPayment = resolveFirstPaymentDate(app);
    const nextPaymentDate = resolvedFirstPayment
      ? new Date(resolvedFirstPayment)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    nextPaymentDate.setUTCHours(0, 0, 0, 0);
    const firstPaymentIso = normalizeToIsoMidnight(resolvedFirstPayment);

    const loanPayload = {
      application_id: applicationId,
      user_id: app.user_id,
      principal_amount: principal,
      interest_rate: annualRate,
      term_months: termMonths,
      monthly_payment: monthlyPayment.toFixed(2),
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
      loanPayload.first_payment_date = firstPaymentIso;
    }

    const initialInsert = await supabase
      .from('loans')
      .insert([loanPayload])
      .select()
      .single();

    let newLoan = initialInsert.data;
    let loanError = initialInsert.error;

    if (loanError && firstPaymentIso && /first_payment_date/i.test(loanError.message || '')) {
      console.warn('⚠️ loans.first_payment_date column missing. Retrying insert without it.');
      const fallbackLoan = { ...loanPayload };
      delete fallbackLoan.first_payment_date;
      const retryInsert = await supabase
        .from('loans')
        .insert([fallbackLoan])
        .select()
        .single();
      newLoan = retryInsert.data;
      loanError = retryInsert.error;
    }
    if (loanError) throw loanError;

    if (app.status !== 'DISBURSED') {
      await supabase.from('loan_applications').update({ status: 'DISBURSED' }).eq('id', applicationId);
    }
    return { data: newLoan, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export async function syncAllOfferedApplications() {
  try {
    const { data: offeredApps, error } = await supabase
      .from('loan_applications')
      .select('id')
      .eq('status', 'OFFERED');
    if (error) throw error;
    const applications = offeredApps || [];
    const summary = {
      total: applications.length,
      success: 0,
      failures: []
    };
    for (const app of applications) {
      const { data, error: syncError } = await syncApplicationToLoans(app.id);
      if (syncError || !data) {
        summary.failures.push({ id: app.id, error: syncError || 'Unknown error' });
      } else {
        summary.success += 1;
      }
    }
    return { data: summary, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

// =================================================================
// == ANALYTICS & BALANCE SHEET ENGINE
// =================================================================
export async function fetchLoanBook(branchId = null) {
    let query = supabase
        .from('loan_applications')
        .select(`
            id, loan_number, loan_purpose, amount, term_months, status,
            credit_decision, credit_band_label, credit_rate_pa,
            repayment_start_date, created_at, updated_at,
            is_first_loan, routed_to_head_office,
            offer_principal, offer_monthly_repayment, offer_total_repayment,
            profiles:user_id ( full_name, identity_number, branch_id ),
            bank_accounts:bank_account_id ( bank_name, account_number )
        `)
        .in('status', ['DISBURSED', 'IN_ARREARS', 'IN_DEFAULT', 'OFFER_ACCEPTED', 'READY_TO_DISBURSE'])
        .order('created_at', { ascending: false });

    if (branchId && branchId !== 'all') {
        // Filter by branch via profiles join
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error };

    const now = new Date();
    const rows = (data || []).map(app => {
        const disbursedDate   = app.repayment_start_date ? new Date(app.repayment_start_date) : null;
        const createdDate     = new Date(app.created_at);
        const maturityDate    = disbursedDate && app.term_months
            ? new Date(new Date(disbursedDate).setMonth(disbursedDate.getMonth() + Number(app.term_months)))
            : null;

        const daysActive   = disbursedDate ? Math.floor((now - disbursedDate) / 86400000) : null;
        const daysOverdue  = (app.status === 'IN_ARREARS' || app.status === 'IN_DEFAULT') && disbursedDate
            ? Math.max(0, Math.floor((now - disbursedDate) / 86400000))
            : 0;
        const daysToMaturity = maturityDate
            ? Math.ceil((maturityDate - now) / 86400000)
            : null;

        const clientNum = app.profiles?.client_number || 'C' + String(app.id).slice(-4).toUpperCase();
        const loanSeq   = app.loan_number ? `L${String(app.loan_number).padStart(4,'0')}` : '';
        const reference = clientNum && loanSeq ? `${clientNum}-${loanSeq}` : (loanSeq || app.id.slice(0,8));

        return {
            id: app.id,
            reference,
            client_name:      app.profiles?.full_name   || 'N/A',
            identity_number:  app.profiles?.identity_number || '',
            amount:           Number(app.offer_principal || app.amount || 0),
            monthly_payment:  Number(app.offer_monthly_repayment || 0),
            total_repayable:  Number(app.offer_total_repayment   || 0),
            term_months:      app.term_months,
            interest_rate:    app.credit_rate_pa,
            band:             app.credit_band_label,
            status:           app.status,
            purpose:          app.loan_purpose || '—',
            bank:             app.bank_accounts?.bank_name || '—',
            account:          app.bank_accounts?.account_number || '—',
            disbursed_date:   app.repayment_start_date?.slice(0,10) || '—',
            maturity_date:    maturityDate ? maturityDate.toISOString().slice(0,10) : '—',
            days_active:      daysActive,
            days_overdue:     daysOverdue,
            days_to_maturity: daysToMaturity,
            is_first_loan:    app.is_first_loan,
            created_at:       app.created_at,
        };
    });

    return { data: rows, error: null };
}

export async function fetchAnalyticsData() {
    const { data: loans, error: loanError } = await supabase
        .from('loans')
        .select('id, application_id, user_id, principal_amount, outstanding_balance, monthly_payment, interest_rate, status, created_at, profiles:user_id(full_name)')
        .order('created_at', { ascending: false });
    if (loanError) return { data: [], error: loanError };

    const rows = (loans || []).map(loan => ({
        loan_id: loan.id,
        customer: loan.profiles?.full_name || 'Unknown',
        month: (loan.created_at || '').slice(0, 7),
        principal_outstanding: Number(loan.outstanding_balance || loan.principal_amount || 0),
        interest_receivable: Number(loan.monthly_payment || 0) * 0.2, // estimated interest portion
        fee_receivable: Number(loan.monthly_payment || 0) * 0.05,     // estimated fee portion
        arrears_amount: loan.status === 'arrears' || loan.status === 'default'
            ? Number(loan.outstanding_balance || 0) : 0,
    }));

    return { data: rows, error: null };
}

export async function fetchMonthlyLoanPerformance() {
    const { data, error } = await supabase
        .from('loan_applications')
        .select('created_at, offer_principal, offer_total_repayment, offer_monthly_repayment, status, term_months')
        .order('created_at', { ascending: true });
    if (error) return { data: [] };

    const byMonth = {};
    for (const row of data || []) {
        const month = (row.created_at || '').slice(0, 7);
        if (!month) continue;
        if (!byMonth[month]) byMonth[month] = { month, originated: 0, disbursed: 0, repaid: 0, defaulted: 0, count: 0 };
        byMonth[month].count++;
        byMonth[month].originated += Number(row.offer_principal) || 0;
        if (row.status === 'DISBURSED')   byMonth[month].disbursed  += Number(row.offer_principal) || 0;
        if (row.status === 'REPAID')      byMonth[month].repaid     += Number(row.offer_total_repayment) || 0;
        if (row.status === 'IN_DEFAULT')  byMonth[month].defaulted  += Number(row.offer_principal) || 0;
    }
    return { data: Object.values(byMonth) };
}

export async function fetchFinancialsData(branchId = null) {
    let query = supabase
        .from('loan_applications')
        .select('offer_principal, offer_total_repayment, offer_monthly_repayment, offer_total_interest, offer_total_initiation_fees, offer_total_admin_fees, status, branch_id');
    if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) return { data: null, error };

    const rows = data || [];
    const sum = (field) => rows.reduce((a, r) => a + (Number(r[field]) || 0), 0);
    const withStatus = (s) => rows.filter(r => r.status === s);

    const interestIncome  = sum('offer_total_interest');
    const feeIncome       = sum('offer_total_initiation_fees') + sum('offer_total_admin_fees');
    const totalRevenue    = interestIncome + feeIncome;
    const totalLoanBook   = sum('offer_principal');
    const activeClients   = withStatus('DISBURSED').length;
    const defaultCount    = withStatus('IN_DEFAULT').length;
    const arrearsRate     = rows.length ? (defaultCount / rows.length) * 100 : 0;

    return {
        data: {
            incomeStatement: {
                interestIncome,
                nii:          interestIncome,
                feeIncome,
                nir:          feeIncome,
                totalRevenue,
            },
            ratios: {
                clr:            totalLoanBook ? ((sum('offer_total_interest') - interestIncome) / totalLoanBook * 100) : 0,
                niiToRevenue:   totalRevenue ? (interestIncome / totalRevenue * 100) : 0,
                nirToRevenue:   totalRevenue ? (feeIncome / totalRevenue * 100) : 0,
            },
            balanceSheet: {
                totalLoanBook,
                activeClients,
                avgLoanPerClient: activeClients ? totalLoanBook / activeClients : 0,
                arrearsPercentage: arrearsRate,
            },
        }
    };
}

export async function fetchPortfolioAnalytics() {
    const { data, error } = await supabase
        .from('loan_applications')
        .select('created_at, status, offer_principal, term_months, bureau_score_band')
        .order('created_at', { ascending: true });
    if (error) return { data: null };

    const rows = data || [];
    const statusCounts = rows.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    const riskMatrix = Object.entries(
        rows.reduce((acc, r) => {
            const band = r.bureau_score_band || 'UNKNOWN';
            if (!acc[band]) acc[band] = { band, count: 0, value: 0 };
            acc[band].count++;
            acc[band].value += Number(r.offer_principal) || 0;
            return acc;
        }, {})
    ).map(([, v]) => v);

    const vintage = rows.reduce((acc, r) => {
        const month = (r.created_at || '').slice(0, 7);
        if (!month) return acc;
        if (!acc[month]) acc[month] = { month, total: 0, defaulted: 0 };
        acc[month].total++;
        if (r.status === 'IN_DEFAULT') acc[month].defaulted++;
        return acc;
    }, {});

    return {
        data: {
            funnel:      statusCounts,
            risk_matrix: riskMatrix,
            vintage:     Object.values(vintage),
        }
    };
}

export async function fetchFinancialTrends() {
    const { data, error } = await supabase
        .from('loan_applications')
        .select('created_at, offer_principal, offer_total_repayment, offer_monthly_repayment, status')
        .order('created_at', { ascending: true });
    if (error) return { data: [] };

    // Aggregate by month: { month: 'YYYY-MM', disbursed, repayments, count }
    const byMonth = {};
    for (const row of data || []) {
        const month = (row.created_at || '').slice(0, 7);
        if (!month) continue;
        if (!byMonth[month]) byMonth[month] = { month, disbursed: 0, repayments: 0, count: 0 };
        byMonth[month].count++;
        if (row.status === 'DISBURSED' || row.status === 'REPAID') {
            byMonth[month].disbursed  += Number(row.offer_principal) || 0;
            byMonth[month].repayments += Number(row.offer_total_repayment) || 0;
        }
    }
    return { data: Object.values(byMonth) };
}

export const getCurrentAdminProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('profiles').select('*, branches(id, name)').eq('id', user.id).single();
    return error ? null : data;
};

export const fetchFullUserProfile = async (userId) => {
    const [profileRes, loansRes, docsRes, finRes] = await Promise.all([
        supabase.from('profiles').select('*, branches(id, name)').eq('id', userId).maybeSingle(),
        supabase.from('loan_applications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('document_uploads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('financial_profiles').select('*').eq('user_id', userId).maybeSingle()
    ]);

    // Log any query errors for debugging without throwing
    if (profileRes.error) console.warn('[fetchFullUserProfile] profiles error:', profileRes.error.message);
    if (loansRes.error)   console.warn('[fetchFullUserProfile] loans error:', loansRes.error.message);
    if (docsRes.error)    console.warn('[fetchFullUserProfile] docs error:', docsRes.error.message);
    if (finRes.error)     console.warn('[fetchFullUserProfile] financials error:', finRes.error.message);

    // If profile itself is missing (not just null), throw a clear error
    if (profileRes.error && !profileRes.data) {
        throw new Error(`Profile query failed: ${profileRes.error.message}`);
    }

    const profile = profileRes.data || { id: userId, full_name: 'Unknown User', role: 'borrower' };
    return {
        profile,
        loans:      loansRes.data   || [],
        documents:  docsRes.data    || [],
        financials: finRes.data     || {}
    };
};
// Fetch disbursements for a specific application
export async function getDisbursementsByApplication(applicationId) {
    const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });
    return { data: data || [], error };
}

// Fetch loan book with tracking fields

// Alias: createDisbursement = createPayout for backward compat
export const createDisbursement = createPayout;

/**
 * Auto-post a repayment to the Cash Ledger when manually confirmed.
 * Called from incoming-payments or application detail when marking a payment received.
 */
export async function postRepaymentToLedger({ applicationId, amount, clientName, reference, branchId }) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: profile } = session?.user?.id
            ? await supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
            : { data: null };

        const { error } = await supabase.from('cash_journal').insert([{
            entry_date:      new Date().toISOString().slice(0,10),
            entry_type:      'cash_in',
            category:        'repayment',
            description:     `Repayment received from ${clientName || 'Client'} — Ref: ${reference || applicationId?.slice(0,8)}`,
            reference:       String(reference || applicationId?.slice(0,8) || '').toUpperCase(),
            amount:          Number(amount || 0),
            branch_id:       branchId || null,
            application_id:  String(applicationId || ''),
            created_by_name: profile?.full_name || session?.user?.email || 'System'
        }]);
        if (error) console.warn('[cash-ledger] repayment post failed:', error.message);
    } catch (e) { console.warn('[cash-ledger] postRepaymentToLedger error:', e.message); }
}

// CashSend config — returns fee schedule for UI
export async function getCashSendConfig() {
    try {
        const res = await fetch('/api/cashsend/schedule');
        if (!res.ok) return { data: null, error: 'Failed to fetch CashSend config' };
        const data = await res.json();
        return { data, error: null };
    } catch (err) {
        return { data: null, error: err.message };
    }
}
