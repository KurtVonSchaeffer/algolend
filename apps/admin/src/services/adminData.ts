import { supabase } from '../api/supabaseClient';
import {
  isDemoMode,
  DEMO_DASHBOARD, DEMO_LOANS, DEMO_APPLICATIONS, DEMO_INCOMING_PAYMENTS,
  DEMO_PAYOUTS, DEMO_MANDATES, DEMO_CASH_LEDGER, DEMO_CREDIT_RULES,
  DEMO_SYSTEM_SETTINGS, DEMO_CONSUMERS, DEMO_NCR_SUBMISSIONS,
  DEMO_REVENUE_ANALYTICS, DEMO_PORTFOLIO_ANALYTICS, DEMO_COMPLIANCE_TASKS,
  DEMO_GOAML_REPORTS, DEMO_PROFILES,
} from './demoData';

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function fetchDashboardData() {
  if (isDemoMode()) return DEMO_DASHBOARD;
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
  if (isDemoMode()) return { data: DEMO_APPLICATIONS.filter(a => !['DISBURSED','DECLINED'].includes(a.status)), error: null };
  const { data, error } = await supabase
    .from('loan_applications')
    .select('id, amount, status, created_at, profiles:user_id(full_name)')
    .not('status', 'in', '(DISBURSED,DECLINED)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Applications ───────────────────────────────────────────────────────────

export async function fetchLoanApplications() {
  if (isDemoMode()) return { data: DEMO_APPLICATIONS, error: null };
  const { data, error } = await supabase
    .from('loan_applications')
    .select('*, profiles:user_id(full_name, identity_number)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchApplicationDetail(applicationId: string) {
  if (isDemoMode()) {
    const app = DEMO_APPLICATIONS.find(a => a.id === applicationId) ?? DEMO_APPLICATIONS[0];
    const profile = DEMO_PROFILES.find(p => p.id === app.user_id) ?? DEMO_PROFILES[0];
    return {
      application: { ...app, profiles: profile },
      financial: { monthly_income: 45000, monthly_expenses: 18000, employment_status: 'employed' },
      documents: [{ id: 'd1', document_type: 'ID Document', uploaded_at: app.created_at }, { id: 'd2', document_type: 'Payslip', uploaded_at: app.created_at }],
      payout: null,
      bankAccounts: [{ id: 'ba1', bank_name: 'ABSA', account_number: '4089123456', account_type: 'cheque' }],
      creditChecks: [{ id: 'cc1', score: 680, checked_at: app.created_at }],
      loans: DEMO_LOANS.filter(l => l.user_id === app.user_id),
    };
  }
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
  if (isDemoMode()) return { data: DEMO_PROFILES.map(p => ({ ...p, created_at: new Date(Date.now() - Math.random() * 1e10).toISOString(), branches: null })), error: null };
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
  if (isDemoMode()) return { data: DEMO_INCOMING_PAYMENTS, error: null };
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
  if (isDemoMode()) return { data: DEMO_PAYOUTS, error: null };
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
  if (isDemoMode()) return { data: DEMO_MANDATES, error: null };
  const { data, error } = await supabase
    .from('debit_mandates')
    .select('*, profiles:user_id(full_name, identity_number)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Loans ──────────────────────────────────────────────────────────────────

export async function fetchLoans() {
  if (isDemoMode()) return { data: DEMO_LOANS, error: null };
  const { data, error } = await supabase
    .from('loans')
    .select('*, profiles:user_id(full_name, identity_number)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Cash Ledger ────────────────────────────────────────────────────────────

export async function fetchCashLedger() {
  if (isDemoMode()) return { data: [...DEMO_CASH_LEDGER].reverse(), error: null };
  const { data, error } = await supabase
    .from('cash_ledger')
    .select('*')
    .order('transaction_date', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Credit Rules ───────────────────────────────────────────────────────────

export async function fetchCreditRules() {
  if (isDemoMode()) return { data: DEMO_CREDIT_RULES, error: null };
  const { data, error } = await supabase
    .from('credit_rules')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function fetchSystemSettings() {
  if (isDemoMode()) return { data: DEMO_SYSTEM_SETTINGS, error: null };
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

export async function createCashLedgerEntry(entry: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('cash_ledger')
    .insert(entry)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}

// ── SACRRA / NCR ──────────────────────────────────────────────────────────

export async function fetchConsumers() {
  if (isDemoMode()) return { data: DEMO_CONSUMERS, error: null };
  const { data, error } = await supabase
    .from('consumers')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchNcrReportingData() {
  if (isDemoMode()) return { data: DEMO_NCR_SUBMISSIONS, error: null };
  const { data, error } = await supabase
    .from('ncr_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

// ── Revenue Analytics (loan-level amortisation table) ─────────────────────

export async function fetchRevenueAnalytics() {
  if (isDemoMode()) return { data: DEMO_REVENUE_ANALYTICS };
  const [loansRes, paymentsRes] = await Promise.all([
    supabase.from('loans').select('*, profiles:user_id(full_name)').order('created_at', { ascending: false }),
    supabase.from('manual_payments').select('user_id, amount, created_at').eq('status', 'confirmed'),
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
  const { id, ...rest } = rule as any;
  if (id) {
    const { data, error } = await supabase.from('credit_rules').update(rest).eq('id', id).select().single();
    return { data, error: error?.message ?? null };
  }
  const { data, error } = await supabase.from('credit_rules').insert(rest).select().single();
  return { data, error: error?.message ?? null };
}

export async function deleteCreditRule(id: string) {
  const { error } = await supabase.from('credit_rules').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── Portfolio analytics ────────────────────────────────────────────────────

export async function fetchPortfolioAnalytics() {
  if (isDemoMode()) return DEMO_PORTFOLIO_ANALYTICS;
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

// ── Monthly loan performance (for velocity + vintage charts) ───────────────

export async function fetchMonthlyLoanPerformance() {
  if (isDemoMode()) {
    const byMonth: Record<string, { month_year: string; disbursed_amount: number; repaid_amount: number }> = {};
    DEMO_LOANS.forEach(l => {
      const m = l.created_at.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { month_year: m, disbursed_amount: 0, repaid_amount: 0 };
      byMonth[m].disbursed_amount += Number(l.principal_amount) || 0;
    });
    DEMO_INCOMING_PAYMENTS.filter(p => p.status === 'confirmed').forEach(p => {
      const m = p.created_at.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { month_year: m, disbursed_amount: 0, repaid_amount: 0 };
      byMonth[m].repaid_amount += Number(p.amount) || 0;
    });
    return { data: Object.values(byMonth).sort((a, b) => a.month_year.localeCompare(b.month_year)) };
  }
  const [{ data: loans }, { data: payments }] = await Promise.all([
    supabase.from('loans').select('principal_amount, created_at').order('created_at'),
    supabase.from('manual_payments').select('amount, created_at').eq('status', 'confirmed').order('created_at'),
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

// ── Financial trends (for Monthly Loan Book + Portfolio Over Time) ─────────

export async function fetchFinancialTrends() {
  if (isDemoMode()) {
    const byMonth: Record<string, { month: string; total_principal: number; projected_interest: number; active_loans: number }> = {};
    DEMO_LOANS.forEach(l => {
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
  const { data: loans } = await supabase
    .from('loans')
    .select('principal_amount, interest_rate, status, created_at')
    .order('created_at');

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

// ── Advanced analytics (risk matrix + vintage repayment) ───────────────────

export async function fetchAdvancedAnalytics() {
  if (isDemoMode()) {
    const scores: Record<string, number> = { u1:720, u2:685, u3:640, u4:580, u5:710, u6:495, u7:760, u8:615, u9:730, u10:550, u11:680, u12:700 };
    const repaid: Record<string, number> = {};
    DEMO_INCOMING_PAYMENTS.filter(p => p.status === 'confirmed').forEach(p => { repaid[p.user_id] = (repaid[p.user_id] || 0) + Number(p.amount); });
    const risk_matrix = DEMO_LOANS.filter(l => scores[l.user_id]).map(l => ({
      loan_id: l.id, user_id: l.user_id, principal_amount: l.principal_amount, status: l.status,
      credit_score: scores[l.user_id], recovery_rate: l.principal_amount > 0 ? Math.round(((repaid[l.user_id] || 0) / l.principal_amount) * 100) : 0,
    }));
    const byMonth: Record<string, { cohort: string; disbursed: number; repaid: number }> = {};
    DEMO_LOANS.forEach(l => {
      const m = l.created_at.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { cohort: m, disbursed: 0, repaid: 0 };
      byMonth[m].disbursed += Number(l.principal_amount) || 0;
    });
    DEMO_INCOMING_PAYMENTS.filter(p => p.status === 'confirmed').forEach(p => {
      const m = p.created_at.slice(0, 7);
      if (byMonth[m]) byMonth[m].repaid += Number(p.amount) || 0;
    });
    const vintage = Object.values(byMonth).map(v => ({ cohort: v.cohort, recovery_rate: v.disbursed > 0 ? Math.round((v.repaid / v.disbursed) * 100) : 0 })).sort((a, b) => a.cohort.localeCompare(b.cohort));
    return { data: { risk_matrix, vintage } };
  }
  const [loansRes, creditsRes, paymentsRes] = await Promise.all([
    supabase.from('loans').select('id, user_id, principal_amount, status, created_at'),
    supabase.from('credit_checks').select('user_id, score, checked_at').order('checked_at', { ascending: false }),
    supabase.from('manual_payments').select('user_id, amount, created_at').eq('status', 'confirmed'),
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
  if (isDemoMode()) return { data: DEMO_LOANS, error: null };
  const { data, error } = await supabase
    .from('loans')
    .select('*, profiles:user_id(full_name, identity_number, email)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function fetchComplianceTasks() {
  if (isDemoMode()) return { data: DEMO_COMPLIANCE_TASKS, error: null };
  const { data, error } = await supabase
    .from('compliance_tasks')
    .select('*')
    .order('due_date', { ascending: true });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function upsertComplianceTask(task: Record<string, unknown>) {
  const { id, ...rest } = task as any;
  if (id) {
    const { data, error } = await supabase.from('compliance_tasks').update(rest).eq('id', id).select().single();
    return { data, error: error?.message ?? null };
  }
  const { data, error } = await supabase.from('compliance_tasks').insert(rest).select().single();
  return { data, error: error?.message ?? null };
}

export async function fetchGoAMLReports() {
  if (isDemoMode()) return { data: DEMO_GOAML_REPORTS, error: null };
  const { data, error } = await supabase
    .from('goaml_reports')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function createGoAMLReport(report: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('goaml_reports')
    .insert(report)
    .select()
    .single();
  return { data, error: error?.message ?? null };
}
