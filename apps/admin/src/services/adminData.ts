import { supabase } from '../api/supabaseClient';

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function fetchDashboardData() {
  try {
    const [{ data: payments }, { data: loans }] = await Promise.all([
      supabase.from('manual_payments').select('amount').eq('status', 'confirmed'),
      supabase.from('loans').select('principal_amount, status'),
    ]);

    const totalCollected = payments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) ?? 0;
    const totalDisbursed = loans?.reduce((s, l) => s + (Number(l.principal_amount) || 0), 0) ?? 0;

    let active = 0, defaulted = 0, repaid = 0;
    loans?.forEach(l => {
      const s = (l.status ?? '').toLowerCase();
      if (s === 'active') active++;
      else if (s === 'default' || s === 'arrears') defaulted++;
      else if (s === 'repaid' || s === 'settled') repaid++;
    });

    const { count: pendingApps } = await supabase
      .from('loan_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    return {
      totalDisbursed,
      totalCollected,
      profitMargin: totalDisbursed > 0 ? (((totalCollected - totalDisbursed) / totalDisbursed) * 100).toFixed(1) : '0.0',
      activeLoans: active,
      pendingApps: pendingApps ?? 0,
      portfolio: [
        { name: 'Active', value: active },
        { name: 'Default', value: defaulted },
        { name: 'Repaid', value: repaid },
      ],
    };
  } catch {
    return null;
  }
}

export async function fetchPipelineApplications() {
  const { data, error } = await supabase
    .from('loan_applications')
    .select('id, amount, status, created_at, profiles:user_id(full_name)')
    .not('status', 'in', '(DISBURSED,DECLINED)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Applications ───────────────────────────────────────────────────────────

export async function fetchLoanApplications() {
  const { data, error } = await supabase
    .from('loan_applications')
    .select('*, profiles:user_id(full_name, identity_number)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchApplicationDetail(applicationId: string) {
  const { data: appData, error: appError } = await supabase
    .from('loan_applications')
    .select('*, profiles:user_id(*)')
    .eq('id', applicationId)
    .single();
  if (appError) throw appError;

  const userId = appData.user_id;
  const [finRes, docsRes, payoutRes, bankRes, creditRes, loansRes] = await Promise.all([
    supabase.from('financial_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('document_uploads').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false }),
    supabase.from('payouts').select('status').eq('application_id', applicationId).maybeSingle(),
    supabase.from('bank_accounts').select('*').eq('user_id', userId),
    supabase.from('credit_checks').select('*').eq('user_id', userId).order('checked_at', { ascending: false }),
    supabase.from('loans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);

  return {
    application: appData,
    financial: finRes.data,
    documents: docsRes.data ?? [],
    payout: payoutRes.data,
    bankAccounts: bankRes.data ?? [],
    creditChecks: creditRes.data ?? [],
    loans: loansRes.data ?? [],
  };
}

export async function updateApplicationStatus(id: string, status: string, notes?: string) {
  const payload: Record<string, unknown> = { status };
  if (notes !== undefined) payload.notes = notes;
  const { data, error } = await supabase
    .from('loan_applications')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function fetchUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, branches(id, name)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function updateUserRole(userId: string, role: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function fetchIncomingPayments() {
  const { data, error } = await supabase
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
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchPayouts() {
  const { data, error } = await supabase
    .from('payouts')
    .select('*, profile:user_id(full_name, email), application:loan_applications(status, bank_account:bank_account_id(*))')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function approvePayout(payoutId: string) {
  const { data, error } = await supabase
    .from('payouts')
    .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
    .eq('id', payoutId)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── Mandates ───────────────────────────────────────────────────────────────

export async function fetchMandates() {
  const { data, error } = await supabase
    .from('debit_mandates')
    .select('*, profiles:user_id(full_name, identity_number)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Loans ──────────────────────────────────────────────────────────────────

export async function fetchLoans() {
  const { data, error } = await supabase
    .from('loans')
    .select('*, profiles:user_id(full_name, identity_number)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Cash Ledger ────────────────────────────────────────────────────────────

export async function fetchCashLedger() {
  const { data, error } = await supabase
    .from('cash_ledger')
    .select('*')
    .order('transaction_date', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Credit Rules ───────────────────────────────────────────────────────────

export async function fetchCreditRules() {
  const { data, error } = await supabase
    .from('credit_rules')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function fetchSystemSettings() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function updateSystemSettings(settings: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('system_settings')
    .upsert({ ...settings, id: 'global' }, { onConflict: 'id' })
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── SACRRA / NCR ──────────────────────────────────────────────────────────

export async function fetchConsumers() {
  const { data, error } = await supabase
    .from('consumers')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchNcrReportingData() {
  const { data, error } = await supabase
    .from('ncr_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Portfolio analytics ────────────────────────────────────────────────────

export async function fetchPortfolioAnalytics() {
  const [loansRes, appRes, paymentsRes] = await Promise.all([
    supabase.from('loans').select('principal_amount, status, created_at, interest_rate'),
    supabase.from('loan_applications').select('amount, status, created_at'),
    supabase.from('manual_payments').select('amount, created_at, status'),
  ]);
  return {
    loans: loansRes.data ?? [],
    applications: appRes.data ?? [],
    payments: paymentsRes.data ?? [],
  };
}
