import { supabase } from '../api/supabaseClient';
import {
  demoDashboardData, demoPipelineApplications, demoLoanApplications,
  demoApplicationDetail, demoUpdateApplicationStatus, demoApprovePayout,
  demoUsers, demoIncomingPayments, demoConfirmPayment, demoRejectPayment,
  demoPayouts, demoMandates, demoLoans, demoCashLedger, demoCreditRules,
  demoUpsertCreditRule, demoDeleteCreditRule, demoPortfolioAnalytics,
  demoMonthlyLoanPerformance, demoFinancialTrends, demoRevenueAnalytics,
  demoAdvancedAnalytics, demoSacrraMembers, demoSacrraSubmissions,
  demoSacrraRejections, demoNcrReports, demoNcrRegisters, demoComplianceTasks,
  demoUpsertComplianceTask, demoGoAMLReports, demoCreateGoAMLReport,
  demoSearchClients, demoCreateApplication, demoAuditTrail, demoCashLedgerCreate,
  demoSystemSettings, demoArrearsAccounts, demoUpdateUserRole, demoUpdateSacrraProfile,
  demoResolveSacrraRejection,
} from '../demo/demoState';

const isDemo = () => localStorage.getItem('algolend_demo') === '1';

// Safety caps — prevents full-table scans at scale
const LIST_LIMIT = 500;
const ANALYTICS_LIMIT = 2000;

// Analytics time window — 24 months keeps charts fast without losing business history
function analyticsSince(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString();
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function fetchDashboardData() {
  if (isDemo()) return demoDashboardData();
  try {
    const [{ data: payments }, { data: loans }] = await Promise.all([
      supabase.from('manual_payments').select('amount').eq('status', 'confirmed').limit(ANALYTICS_LIMIT),
      supabase.from('loans').select('principal_amount, status').limit(ANALYTICS_LIMIT),
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
  if (isDemo()) return { data: demoPipelineApplications(), error: null };
  const { data, error } = await supabase
    .from('loan_applications')
    .select('id, amount, status, created_at, profiles:user_id(full_name)')
    .not('status', 'in', '(DISBURSED,DECLINED)')
    .order('created_at', { ascending: false })
    .limit(50);
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Applications ───────────────────────────────────────────────────────────

export async function fetchLoanApplications(page = 0) {
  if (isDemo()) return { data: demoLoanApplications(), error: null, count: null };
  const from = page * LIST_LIMIT;
  const { data, error, count } = await supabase
    .from('loan_applications')
    .select('*, profiles:user_id(full_name, identity_number)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + LIST_LIMIT - 1);
  return { data: data ?? [], error: error?.message ?? null, count };
}

export async function fetchApplicationDetail(applicationId: string) {
  if (isDemo()) return demoApplicationDetail(applicationId);
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
    supabase.from('payouts').select('id, status, created_at, approved_at').eq('application_id', applicationId).maybeSingle(),
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

export async function saveApplicationSignature(
  applicationId: string,
  signatureDataUrl: string,
  signatureType: string,
  signerName: string,
) {
  const signedAt = new Date().toISOString();

  if (isDemo()) {
    localStorage.setItem(
      `algolend_sig_${applicationId}`,
      JSON.stringify({ signatureDataUrl, signatureType, signerName, signedAt }),
    );
    return { error: null };
  }

  // Fetch current offer_details so we can merge without overwriting
  const { data: current } = await supabase
    .from('loan_applications')
    .select('offer_details')
    .eq('id', applicationId)
    .single();

  const { error } = await supabase
    .from('loan_applications')
    .update({
      contract_signed_at: signedAt,
      offer_details: {
        ...(current?.offer_details ?? {}),
        signature_data: signatureDataUrl,
        signature_type: signatureType,
        signer_name: signerName,
        signed_at: signedAt,
      },
    })
    .eq('id', applicationId);

  return { error: error?.message ?? null };
}

export async function updateApplicationStatus(id: string, status: string, notes?: string) {
  if (isDemo()) return demoUpdateApplicationStatus(id, status, notes);
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
  if (isDemo()) return { data: demoUsers(), error: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('*, branches(id, name)')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function updateUserRole(userId: string, role: string) {
  if (isDemo()) return demoUpdateUserRole(userId, role);
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
  if (isDemo()) return { data: demoIncomingPayments(), error: null };
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
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchPayouts() {
  if (isDemo()) return { data: demoPayouts(), error: null };
  const { data, error } = await supabase
    .from('payouts')
    .select('*, profile:user_id(full_name, email), application:loan_applications(status, bank_account:bank_account_id(*))')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function approvePayout(payoutId: string) {
  if (isDemo()) return demoApprovePayout(payoutId);
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
  if (isDemo()) return { data: demoMandates(), error: null };
  const { data, error } = await supabase
    .from('debit_mandates')
    .select('*, profiles:user_id(full_name, identity_number), loan_applications:application_id(amount)')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Incoming Payment Actions ───────────────────────────────────────────────

export async function confirmIncomingPayment(id: string) {
  if (isDemo()) return demoConfirmPayment(id);
  const { data, error } = await supabase
    .from('manual_payments')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

export async function rejectIncomingPayment(id: string) {
  if (isDemo()) return demoRejectPayment(id);
  const { data, error } = await supabase
    .from('manual_payments')
    .update({ status: 'rejected', confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── Loans ──────────────────────────────────────────────────────────────────

export async function fetchLoans(page = 0) {
  if (isDemo()) return { data: demoLoans(), error: null, count: null };
  const from = page * LIST_LIMIT;
  const { data, error, count } = await supabase
    .from('loans')
    .select('*, profiles:user_id(full_name, identity_number)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + LIST_LIMIT - 1);
  return { data: data ?? [], error: error?.message ?? null, count };
}

// ── Cash Ledger ────────────────────────────────────────────────────────────

export async function fetchCashLedger() {
  if (isDemo()) return { data: demoCashLedger(), error: null };
  const { data, error } = await supabase
    .from('cash_ledger')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(LIST_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Credit Rules ───────────────────────────────────────────────────────────

export async function fetchCreditRules() {
  if (isDemo()) return { data: demoCreditRules(), error: null };
  const { data, error } = await supabase
    .from('credit_rules')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function fetchSystemSettings() {
  if (isDemo()) return { data: demoSystemSettings(), error: null };
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function updateSystemSettings(settings: Record<string, unknown>) {
  if (isDemo()) return { data: settings, error: null };
  const { data, error } = await supabase
    .from('system_settings')
    .upsert({ ...settings, id: 'global' }, { onConflict: 'id' })
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

export async function createCashLedgerEntry(entry: Record<string, unknown>) {
  if (isDemo()) return demoCashLedgerCreate(entry);
  const { data, error } = await supabase
    .from('cash_ledger')
    .insert(entry)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── SACRRA / NCR ──────────────────────────────────────────────────────────

export async function fetchSacrraMembers() {
  if (isDemo()) return { data: demoSacrraMembers(), error: null };
  const { data, error } = await supabase
    .from('sacrra_700_view')
    .select('*')
    .limit(ANALYTICS_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchSacrraSubmissions() {
  if (isDemo()) return { data: demoSacrraSubmissions(), error: null };
  const { data, error } = await supabase
    .from('sacrra_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchSacrraRejections() {
  if (isDemo()) return { data: demoSacrraRejections(), error: null };
  const { data, error } = await supabase
    .from('sacrra_rejections')
    .select('*')
    .eq('resolved', false)
    .limit(LIST_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function updateSacrraProfile(loanId: string, fields: {
  address_line_1?: string; employer_name?: string; occupation?: string;
  id_number?: string; middle_name?: string;
}) {
  if (isDemo()) return demoUpdateSacrraProfile(loanId, fields);
  const { data: loan } = await supabase.from('loans').select('user_id').eq('id', loanId).single();
  if (!loan?.user_id) throw new Error('Loan not found');
  const { error } = await supabase.from('profiles').update(fields).eq('id', loan.user_id);
  if (error) throw error;
}

export async function resolveSacrraRejection(id: number) {
  if (isDemo()) return demoResolveSacrraRejection(id);
  const { error } = await supabase.from('sacrra_rejections').update({
    resolved: true,
    resolved_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function fetchConsumers() {
  if (isDemo()) return { data: [], error: null };
  const { data, error } = await supabase
    .from('consumers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchNcrReportingData() {
  if (isDemo()) return { data: demoNcrReports(), error: null };
  const { data, error } = await supabase
    .from('ncr_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(ANALYTICS_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Revenue Analytics ─────────────────────────────────────────────────────

export async function fetchRevenueAnalytics() {
  if (isDemo()) return demoRevenueAnalytics();
  const since = analyticsSince();
  const [loansRes, paymentsRes] = await Promise.all([
    supabase.from('loans').select('*, profiles:user_id(full_name)').gte('created_at', since).order('created_at', { ascending: false }).limit(ANALYTICS_LIMIT),
    supabase.from('manual_payments').select('user_id, amount, created_at').eq('status', 'confirmed').gte('created_at', since).limit(ANALYTICS_LIMIT),
  ]);

  const loans = loansRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const paidByUser: Record<string, number> = {};
  payments.forEach((p: any) => {
    paidByUser[p.user_id] = (paidByUser[p.user_id] || 0) + (Number(p.amount) || 0);
  });

  const rows = loans.map((l: any) => {
    const principal = Number(l.principal_amount) || 0;
    const rate = Number(l.interest_rate) || 0;
    const created = l.created_at ? new Date(l.created_at) : new Date();
    const monthsActive = Math.max(1, Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const projectedInterest = Math.round(principal * (rate / 100) * (monthsActive / 12));
    const paid = paidByUser[l.user_id] || 0;
    const status = (l.status || '').toLowerCase();
    const arrears = (status === 'default' || status === 'arrears') ? Math.max(0, principal - paid) : 0;

    return {
      loan_id: l.loan_number ?? l.id,
      customer: (l.profiles as any)?.full_name ?? 'Unknown',
      month: l.created_at?.slice(0, 7) ?? '',
      principal,
      interest: projectedInterest,
      fees: 0,
      arrears,
      status,
      created_at: l.created_at,
      user_id: l.user_id,
    };
  });

  return { data: rows };
}

// ── Credit Rule CRUD ───────────────────────────────────────────────────────

export async function upsertCreditRule(rule: Record<string, unknown>) {
  if (isDemo()) return demoUpsertCreditRule(rule);
  const { id, ...rest } = rule as any;
  if (id) {
    const { data, error } = await supabase.from('credit_rules').update(rest).eq('id', id).select().single();
    return { data, error: error?.message ?? null };
  }
  const { data, error } = await supabase.from('credit_rules').insert(rest).select().single();
  return { data, error: error?.message ?? null };
}

export async function deleteCreditRule(id: string) {
  if (isDemo()) return demoDeleteCreditRule(id);
  const { error } = await supabase.from('credit_rules').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── Portfolio Analytics ────────────────────────────────────────────────────

export async function fetchPortfolioAnalytics() {
  if (isDemo()) return demoPortfolioAnalytics();
  const since = analyticsSince();
  const [loansRes, appRes, paymentsRes] = await Promise.all([
    supabase.from('loans').select('principal_amount, status, created_at, interest_rate').gte('created_at', since).limit(ANALYTICS_LIMIT),
    supabase.from('loan_applications').select('amount, status, created_at').gte('created_at', since).limit(ANALYTICS_LIMIT),
    supabase.from('manual_payments').select('amount, created_at, status').gte('created_at', since).limit(ANALYTICS_LIMIT),
  ]);
  return {
    loans: loansRes.data ?? [],
    applications: appRes.data ?? [],
    payments: paymentsRes.data ?? [],
  };
}

// ── Monthly Loan Performance ───────────────────────────────────────────────

export async function fetchMonthlyLoanPerformance() {
  if (isDemo()) return demoMonthlyLoanPerformance();
  const since = analyticsSince();
  const [{ data: loans }, { data: payments }] = await Promise.all([
    supabase.from('loans').select('principal_amount, created_at').gte('created_at', since).order('created_at').limit(ANALYTICS_LIMIT),
    supabase.from('manual_payments').select('amount, created_at').eq('status', 'confirmed').gte('created_at', since).order('created_at').limit(ANALYTICS_LIMIT),
  ]);

  const byMonth: Record<string, { month_year: string; disbursed_amount: number; repaid_amount: number }> = {};
  loans?.forEach(l => {
    const m = l.created_at.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { month_year: m, disbursed_amount: 0, repaid_amount: 0 };
    byMonth[m].disbursed_amount += Number(l.principal_amount) || 0;
  });
  payments?.forEach(p => {
    const m = p.created_at.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { month_year: m, disbursed_amount: 0, repaid_amount: 0 };
    byMonth[m].repaid_amount += Number(p.amount) || 0;
  });

  return { data: Object.values(byMonth).sort((a, b) => a.month_year.localeCompare(b.month_year)) };
}

// ── Financial Trends ──────────────────────────────────────────────────────

export async function fetchFinancialTrends() {
  if (isDemo()) return demoFinancialTrends();
  const since = analyticsSince();
  const { data: loans } = await supabase
    .from('loans')
    .select('principal_amount, interest_rate, status, created_at')
    .gte('created_at', since)
    .order('created_at')
    .limit(ANALYTICS_LIMIT);

  const byMonth: Record<string, { month: string; total_principal: number; projected_interest: number; active_loans: number }> = {};
  loans?.forEach(l => {
    const m = l.created_at.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { month: m, total_principal: 0, projected_interest: 0, active_loans: 0 };
    const p = Number(l.principal_amount) || 0;
    const r = Number(l.interest_rate) || 0;
    byMonth[m].total_principal += p;
    byMonth[m].projected_interest += p * r * 0.01;
    if ((l.status || '').toLowerCase() === 'active') byMonth[m].active_loans++;
  });

  return { data: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)) };
}

// ── Advanced Analytics ────────────────────────────────────────────────────

export async function fetchAdvancedAnalytics() {
  if (isDemo()) return demoAdvancedAnalytics();
  const since = analyticsSince();
  const [loansRes, creditsRes, paymentsRes] = await Promise.all([
    supabase.from('loans').select('id, user_id, principal_amount, status, created_at').gte('created_at', since).limit(ANALYTICS_LIMIT),
    supabase.from('credit_checks').select('user_id, score, checked_at').order('checked_at', { ascending: false }).limit(ANALYTICS_LIMIT),
    supabase.from('manual_payments').select('user_id, amount, created_at').eq('status', 'confirmed').gte('created_at', since).limit(ANALYTICS_LIMIT),
  ]);

  const loans = loansRes.data ?? [];
  const credits = creditsRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const latestScore: Record<string, number> = {};
  credits.forEach(c => { if (!latestScore[c.user_id]) latestScore[c.user_id] = c.score; });

  const repaidByUser: Record<string, number> = {};
  payments.forEach(p => { repaidByUser[p.user_id] = (repaidByUser[p.user_id] || 0) + (Number(p.amount) || 0); });

  const risk_matrix = loans
    .filter(l => latestScore[l.user_id] > 0)
    .map(l => {
      const principal = Number(l.principal_amount) || 0;
      const repaid = repaidByUser[l.user_id] || 0;
      const dti = principal > 0 ? Math.min(100, Math.round((repaid / principal) * 100)) : 0;
      return { credit_score: latestScore[l.user_id] || 0, principal_amount: principal, dti_ratio: dti, status: (l.status || '').toLowerCase() };
    });

  const monthMap: Record<string, { cohort: string; disbursed: number; repaid: number }> = {};
  loans.forEach(l => {
    const m = l.created_at.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = { cohort: m, disbursed: 0, repaid: 0 };
    monthMap[m].disbursed += Number(l.principal_amount) || 0;
  });
  payments.forEach(p => {
    const m = p.created_at.slice(0, 7);
    if (monthMap[m]) monthMap[m].repaid += Number(p.amount) || 0;
  });

  const vintage = Object.values(monthMap)
    .map(v => ({ cohort: v.cohort, recovery_rate: v.disbursed > 0 ? Math.round((v.repaid / v.disbursed) * 100) : 0 }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort));

  return { data: { risk_matrix, vintage } };
}

// ── Compliance ─────────────────────────────────────────────────────────────

export async function fetchNcrRegisters() {
  if (isDemo()) return { data: demoNcrRegisters(), error: null };
  const { data, error } = await supabase
    .from('loans')
    .select('*, profiles:user_id(full_name, identity_number, email)')
    .order('created_at', { ascending: false })
    .limit(ANALYTICS_LIMIT);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchComplianceTasks() {
  if (isDemo()) return { data: demoComplianceTasks(), error: null };
  const { data, error } = await supabase
    .from('compliance_tasks')
    .select('*')
    .order('due_date', { ascending: true });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function upsertComplianceTask(task: Record<string, unknown>) {
  if (isDemo()) return demoUpsertComplianceTask(task);
  const { id, ...rest } = task as any;
  if (id) {
    const { data, error } = await supabase.from('compliance_tasks').update(rest).eq('id', id).select().single();
    return { data, error: error?.message ?? null };
  }
  const { data, error } = await supabase.from('compliance_tasks').insert(rest).select().single();
  return { data, error: error?.message ?? null };
}

export async function fetchGoAMLReports() {
  if (isDemo()) return { data: demoGoAMLReports(), error: null };
  const { data, error } = await supabase
    .from('goaml_reports')
    .select('*')
    .limit(LIST_LIMIT)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function createGoAMLReport(report: Record<string, unknown>) {
  if (isDemo()) return demoCreateGoAMLReport(report);
  const { data, error } = await supabase
    .from('goaml_reports')
    .insert(report)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── Walk-in / In-Branch ───────────────────────────────────────────────────────

export async function searchClients(query: string) {
  if (isDemo()) return { data: demoSearchClients(query), error: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, identity_number, email, cell_tel_no')
    .or(`full_name.ilike.%${query}%,identity_number.ilike.%${query}%`)
    .limit(8);
  return { data: data ?? [], error: error?.message ?? null };
}

export async function createWalkInApplication(payload: Record<string, unknown>) {
  if (isDemo()) return demoCreateApplication(payload);
  const { data, error } = await supabase
    .from('loan_applications')
    .insert(payload)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

export async function syncOfferedApplications() {
  if (isDemo()) return { data: [], error: null };
  // Fetches all OFFERED applications — in production this would trigger a
  // server-side sync job (e.g. via a Supabase Edge Function).
  const { data, error } = await supabase
    .from('loan_applications')
    .select('id, status')
    .eq('status', 'OFFERED');
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Audit Trail ────────────────────────────────────────────────────────────────

export async function fetchAuditTrail(applicationId: string) {
  if (isDemo()) return { data: demoAuditTrail(applicationId), error: null };
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_type', 'loan_application')
    .eq('entity_id', applicationId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Collections & Arrears ─────────────────────────────────────────────────────

export type EscalationStage = 'REMINDER' | 'COLLECTIONS' | 'LEGAL' | 'WRITE_OFF';

export interface ArrearAccount {
  id: string;
  appId: string;
  loanNumber: string;
  clientName: string;
  loanAmount: number;
  outstanding: number;
  arrears: number;
  dpd: number;
  stage: EscalationStage;
  lastPaymentDate: string | null;
  nextAction: string;
  phone: string;
  email: string;
}

const ESCALATION_KEY = 'algolend_escalation_v1';

function getEscalationOverrides(): Record<string, EscalationStage> {
  try { return JSON.parse(localStorage.getItem(ESCALATION_KEY) ?? '{}'); } catch { return {}; }
}

function stageFromDPD(dpd: number): EscalationStage {
  if (dpd <= 30) return 'REMINDER';
  if (dpd <= 60) return 'COLLECTIONS';
  if (dpd <= 90) return 'LEGAL';
  return 'WRITE_OFF';
}

export async function fetchArrearsAccounts(): Promise<{ data: ArrearAccount[]; error: string | null }> {
  if (isDemo()) return { data: demoArrearsAccounts() as ArrearAccount[], error: null };

  try {
    const { data: loans, error: loansErr } = await supabase
      .from('loans')
      .select('*, profiles:user_id(full_name, cell_tel_no, email)')
      .in('status', ['active', 'arrears', 'default'])
      .order('created_at', { ascending: false });

    if (loansErr) throw loansErr;
    if (!loans?.length) return { data: [], error: null };

    const userIds = [...new Set(loans.map((l: any) => l.user_id as string))];

    const [appsRes, paymentsRes] = await Promise.all([
      supabase
        .from('loan_applications')
        .select('id, user_id, offer_monthly_repayment, repayment_start_date')
        .eq('status', 'DISBURSED')
        .in('user_id', userIds),
      supabase
        .from('manual_payments')
        .select('user_id, amount, created_at')
        .eq('status', 'confirmed')
        .in('user_id', userIds),
    ]);

    const appByUser: Record<string, any> = {};
    appsRes.data?.forEach((a: any) => { appByUser[a.user_id] = a; });

    const paidByUser: Record<string, number> = {};
    const lastPayByUser: Record<string, string> = {};
    paymentsRes.data?.forEach((p: any) => {
      paidByUser[p.user_id] = (paidByUser[p.user_id] || 0) + Number(p.amount || 0);
      if (!lastPayByUser[p.user_id] || p.created_at > lastPayByUser[p.user_id]) {
        lastPayByUser[p.user_id] = p.created_at;
      }
    });

    const overrides = getEscalationOverrides();
    const today = Date.now();

    const nextActions: Record<EscalationStage, string> = {
      REMINDER:    'Send payment reminder SMS/WhatsApp',
      COLLECTIONS: 'Issue demand letter — 7 day notice',
      LEGAL:       'Section 129 notice — prepare for legal action',
      WRITE_OFF:   'Refer to debt recovery agent',
    };

    const accounts: ArrearAccount[] = loans
      .map((l: any) => {
        const app = appByUser[l.user_id];
        const monthly = Number(app?.offer_monthly_repayment || 0);
        const start = new Date(app?.repayment_start_date || l.created_at);
        const monthsActive = Math.max(0, (today - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
        const expectedPaid = Math.ceil(monthsActive) * monthly;
        const actuallyPaid = paidByUser[l.user_id] || 0;
        const arrears = Math.max(0, expectedPaid - actuallyPaid);
        const dpd = monthly > 0 ? Math.round((arrears / monthly) * 30) : 0;

        if (dpd === 0 && l.status === 'active') return null;

        const profile = (l.profiles as any) ?? {};
        const stage: EscalationStage = overrides[l.id] ?? stageFromDPD(Math.max(dpd, 1));

        return {
          id: l.id,
          appId: app?.id ?? l.id,
          loanNumber: l.loan_number ?? l.id,
          clientName: profile.full_name ?? 'Unknown',
          loanAmount: Number(l.principal_amount || 0),
          outstanding: Number(l.outstanding_balance || l.principal_amount || 0),
          arrears,
          dpd,
          stage,
          lastPaymentDate: lastPayByUser[l.user_id] ?? null,
          nextAction: nextActions[stage],
          phone: profile.cell_tel_no ?? '',
          email: profile.email ?? '',
        } as ArrearAccount;
      })
      .filter(Boolean) as ArrearAccount[];

    return { data: accounts.sort((a, b) => b.dpd - a.dpd), error: null };
  } catch (err: any) {
    return { data: [], error: err?.message ?? 'Failed to fetch arrears' };
  }
}

export function updateLoanEscalation(loanId: string, stage: EscalationStage): void {
  const overrides = getEscalationOverrides();
  overrides[loanId] = stage;
  localStorage.setItem(ESCALATION_KEY, JSON.stringify(overrides));
}

