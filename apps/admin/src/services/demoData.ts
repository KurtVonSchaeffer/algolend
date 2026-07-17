// ── Demo mode data — returned by all adminData functions when algolend_demo=1 ──

export const isDemoMode = () => localStorage.getItem('algolend_demo') === '1';

const today = new Date();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const monthsAgo = (n: number) => new Date(today.getFullYear(), today.getMonth() - n, today.getDate()).toISOString();

// ── Shared fake profiles ──────────────────────────────────────────────────────

export const DEMO_PROFILES = [
  { id: 'u1', full_name: 'Thabo Nkosi',       identity_number: '8603154567089', email: 'thabo.nkosi@email.co.za',       role: 'user' },
  { id: 'u2', full_name: 'Zanele Dlamini',    identity_number: '9204225123087', email: 'zanele.dlamini@gmail.com',       role: 'user' },
  { id: 'u3', full_name: 'Sipho Khoza',       identity_number: '8801075890083', email: 'sipho.khoza@work.co.za',         role: 'user' },
  { id: 'u4', full_name: 'Nokwanda Mthembu',  identity_number: '9507124321086', email: 'nokwanda.m@personal.co.za',      role: 'user' },
  { id: 'u5', full_name: 'Vusi Ndlovu',       identity_number: '8412185678082', email: 'vusi.ndlovu@ndlovuco.co.za',     role: 'user' },
  { id: 'u6', full_name: 'Priya Naidoo',      identity_number: '9109234789081', email: 'priya.naidoo@law.co.za',         role: 'user' },
  { id: 'u7', full_name: 'Kagiso Sithole',    identity_number: '8706185432087', email: 'kagiso.sithole@fintech.co.za',   role: 'user' },
  { id: 'u8', full_name: 'Fatima Essop',      identity_number: '9312085671085', email: 'fatima.essop@trading.co.za',     role: 'user' },
  { id: 'u9', full_name: 'James van der Berg',identity_number: '8205135432089', email: 'james.vdb@engineering.co.za',    role: 'user' },
  { id: 'u10',full_name: 'Lungelo Zulu',      identity_number: '9001124321081', email: 'lungelo.zulu@gmail.com',          role: 'user' },
  { id: 'u11',full_name: 'Ayanda Mokoena',    identity_number: '8810115678083', email: 'ayanda.m@consulting.co.za',      role: 'user' },
  { id: 'u12',full_name: 'Nomsa Mahlangu',    identity_number: '9406084321087', email: 'nomsa.mahlangu@health.co.za',    role: 'user' },
  { id: 'a1', full_name: 'Admin User',        identity_number: null,             email: 'admin@algolend.co.za',            role: 'admin' },
  { id: 'a2', full_name: 'Compliance Officer',identity_number: null,             email: 'compliance@algolend.co.za',       role: 'compliance' },
];

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const DEMO_DASHBOARD = {
  totalDisbursed: 1_847_500,
  totalCollected: 1_124_800,
  profitMargin: '22.4',
  activeLoans: 8,
  pendingApps: 5,
  portfolio: [
    { name: 'Active',  value: 8 },
    { name: 'Default', value: 2 },
    { name: 'Repaid',  value: 4 },
  ],
};

// ── Loans ─────────────────────────────────────────────────────────────────────

export const DEMO_LOANS = [
  { id: 'l1',  loan_number: 'ALG-2024-001', user_id: 'u1',  principal_amount: 250000, outstanding_balance: 187500, interest_rate: 18, term_months: 36, status: 'active',  created_at: monthsAgo(14), profiles: DEMO_PROFILES[0] },
  { id: 'l2',  loan_number: 'ALG-2024-002', user_id: 'u2',  principal_amount: 85000,  outstanding_balance: 42500,  interest_rate: 21, term_months: 24, status: 'active',  created_at: monthsAgo(11), profiles: DEMO_PROFILES[1] },
  { id: 'l3',  loan_number: 'ALG-2024-003', user_id: 'u3',  principal_amount: 175000, outstanding_balance: 0,      interest_rate: 16, term_months: 18, status: 'repaid',  created_at: monthsAgo(18), profiles: DEMO_PROFILES[2] },
  { id: 'l4',  loan_number: 'ALG-2024-004', user_id: 'u4',  principal_amount: 120000, outstanding_balance: 120000, interest_rate: 19, term_months: 24, status: 'arrears', created_at: monthsAgo(9),  profiles: DEMO_PROFILES[3] },
  { id: 'l5',  loan_number: 'ALG-2024-005', user_id: 'u5',  principal_amount: 350000, outstanding_balance: 280000, interest_rate: 15, term_months: 48, status: 'active',  created_at: monthsAgo(8),  profiles: DEMO_PROFILES[4] },
  { id: 'l6',  loan_number: 'ALG-2024-006', user_id: 'u6',  principal_amount: 65000,  outstanding_balance: 65000,  interest_rate: 22, term_months: 12, status: 'default', created_at: monthsAgo(12), profiles: DEMO_PROFILES[5] },
  { id: 'l7',  loan_number: 'ALG-2024-007', user_id: 'u7',  principal_amount: 200000, outstanding_balance: 150000, interest_rate: 17, term_months: 30, status: 'active',  created_at: monthsAgo(7),  profiles: DEMO_PROFILES[6] },
  { id: 'l8',  loan_number: 'ALG-2024-008', user_id: 'u8',  principal_amount: 95000,  outstanding_balance: 76000,  interest_rate: 20, term_months: 24, status: 'active',  created_at: monthsAgo(6),  profiles: DEMO_PROFILES[7] },
  { id: 'l9',  loan_number: 'ALG-2024-009', user_id: 'u9',  principal_amount: 420000, outstanding_balance: 0,      interest_rate: 14, term_months: 60, status: 'settled', created_at: monthsAgo(22), profiles: DEMO_PROFILES[8] },
  { id: 'l10', loan_number: 'ALG-2024-010', user_id: 'u10', principal_amount: 55000,  outstanding_balance: 33000,  interest_rate: 23, term_months: 12, status: 'active',  created_at: monthsAgo(5),  profiles: DEMO_PROFILES[9] },
  { id: 'l11', loan_number: 'ALG-2024-011', user_id: 'u11', principal_amount: 280000, outstanding_balance: 224000, interest_rate: 16, term_months: 36, status: 'active',  created_at: monthsAgo(4),  profiles: DEMO_PROFILES[10] },
  { id: 'l12', loan_number: 'ALG-2024-012', user_id: 'u12', principal_amount: 110000, outstanding_balance: 0,      interest_rate: 19, term_months: 18, status: 'repaid',  created_at: monthsAgo(15), profiles: DEMO_PROFILES[11] },
];

// ── Applications ──────────────────────────────────────────────────────────────

export const DEMO_APPLICATIONS = [
  { id: 'a1', loan_number: 'APP-2025-001', user_id: 'u1',  amount: 180000, status: 'UNDER_REVIEW',          offer_monthly_repayment: 6800,  offer_total_repayment: 163200,  created_at: daysAgo(3),  profiles: DEMO_PROFILES[0] },
  { id: 'a2', loan_number: 'APP-2025-002', user_id: 'u2',  amount: 45000,  status: 'PENDING',                offer_monthly_repayment: 2100,  offer_total_repayment: 50400,   created_at: daysAgo(5),  profiles: DEMO_PROFILES[1] },
  { id: 'a3', loan_number: 'APP-2025-003', user_id: 'u5',  amount: 320000, status: 'AWAITING_DISBURSEMENT',  offer_monthly_repayment: 10500, offer_total_repayment: 504000,  created_at: daysAgo(2),  profiles: DEMO_PROFILES[4] },
  { id: 'a4', loan_number: 'APP-2025-004', user_id: 'u7',  amount: 75000,  status: 'APPROVED',               offer_monthly_repayment: 3200,  offer_total_repayment: 76800,   created_at: daysAgo(7),  profiles: DEMO_PROFILES[6] },
  { id: 'a5', loan_number: 'APP-2025-005', user_id: 'u10', amount: 25000,  status: 'REJECTED',               offer_monthly_repayment: null,  offer_total_repayment: null,    created_at: daysAgo(10), profiles: DEMO_PROFILES[9] },
  { id: 'a6', loan_number: 'APP-2025-006', user_id: 'u3',  amount: 150000, status: 'PENDING',                offer_monthly_repayment: 5600,  offer_total_repayment: 134400,  created_at: daysAgo(1),  profiles: DEMO_PROFILES[2] },
  { id: 'a7', loan_number: 'APP-2025-007', user_id: 'u11', amount: 90000,  status: 'UNDER_REVIEW',           offer_monthly_repayment: 3800,  offer_total_repayment: 91200,   created_at: daysAgo(4),  profiles: DEMO_PROFILES[10] },
  { id: 'a8', loan_number: 'APP-2025-008', user_id: 'u4',  amount: 200000, status: 'PENDING',                offer_monthly_repayment: 7200,  offer_total_repayment: 172800,  created_at: daysAgo(6),  profiles: DEMO_PROFILES[3] },
];

// ── Payments ──────────────────────────────────────────────────────────────────

export const DEMO_INCOMING_PAYMENTS = [
  { id: 'ip1', user_id: 'u1',  amount: 6800,  status: 'confirmed', created_at: daysAgo(2),  profiles: DEMO_PROFILES[0], loan_applications: DEMO_APPLICATIONS[0] },
  { id: 'ip2', user_id: 'u2',  amount: 2100,  status: 'confirmed', created_at: daysAgo(5),  profiles: DEMO_PROFILES[1], loan_applications: DEMO_APPLICATIONS[1] },
  { id: 'ip3', user_id: 'u7',  amount: 3200,  status: 'pending',   created_at: daysAgo(1),  profiles: DEMO_PROFILES[6], loan_applications: DEMO_APPLICATIONS[3] },
  { id: 'ip4', user_id: 'u8',  amount: 4750,  status: 'confirmed', created_at: daysAgo(8),  profiles: DEMO_PROFILES[7], loan_applications: null },
  { id: 'ip5', user_id: 'u5',  amount: 10500, status: 'confirmed', created_at: daysAgo(3),  profiles: DEMO_PROFILES[4], loan_applications: DEMO_APPLICATIONS[2] },
  { id: 'ip6', user_id: 'u9',  amount: 8200,  status: 'confirmed', created_at: daysAgo(12), profiles: DEMO_PROFILES[8], loan_applications: null },
  { id: 'ip7', user_id: 'u10', amount: 2750,  status: 'rejected',  created_at: daysAgo(6),  profiles: DEMO_PROFILES[9], loan_applications: null },
  { id: 'ip8', user_id: 'u11', amount: 6500,  status: 'confirmed', created_at: daysAgo(4),  profiles: DEMO_PROFILES[10], loan_applications: DEMO_APPLICATIONS[6] },
  { id: 'ip9', user_id: 'u3',  amount: 5600,  status: 'pending',   created_at: daysAgo(0),  profiles: DEMO_PROFILES[2], loan_applications: null },
];

export const DEMO_PAYOUTS = [
  { id: 'po1', amount: 320000, status: 'PENDING',  created_at: daysAgo(1), profile: DEMO_PROFILES[4], application: { bank_account: { bank_name: 'FNB', account_number: '62811234567' } } },
  { id: 'po2', amount: 180000, status: 'APPROVED', created_at: daysAgo(3), profile: DEMO_PROFILES[0], application: { bank_account: { bank_name: 'ABSA', account_number: '40891234567' } } },
  { id: 'po3', amount: 75000,  status: 'PAID',     created_at: daysAgo(7), profile: DEMO_PROFILES[6], application: { bank_account: { bank_name: 'Standard Bank', account_number: '37201234567' } } },
  { id: 'po4', amount: 45000,  status: 'PAID',     created_at: daysAgo(14),profile: DEMO_PROFILES[1], application: { bank_account: { bank_name: 'Nedbank', account_number: '11261234567' } } },
  { id: 'po5', amount: 90000,  status: 'PENDING',  created_at: daysAgo(0), profile: DEMO_PROFILES[10],application: { bank_account: { bank_name: 'Capitec', account_number: '13021234567' } } },
];

// ── Mandates ──────────────────────────────────────────────────────────────────

export const DEMO_MANDATES = [
  { id: 'm1', user_id: 'u1',  bank_name: 'ABSA',         bank: 'ABSA',         account_number: '40891234567', collection_day: 25, status: 'active',    created_at: monthsAgo(14), profiles: DEMO_PROFILES[0] },
  { id: 'm2', user_id: 'u2',  bank_name: 'FNB',          bank: 'FNB',          account_number: '62811234567', collection_day: 28, status: 'active',    created_at: monthsAgo(11), profiles: DEMO_PROFILES[1] },
  { id: 'm3', user_id: 'u3',  bank_name: 'Standard Bank',bank: 'Standard Bank',account_number: '37201234567', collection_day: 1,  status: 'cancelled', created_at: monthsAgo(18), profiles: DEMO_PROFILES[2] },
  { id: 'm4', user_id: 'u4',  bank_name: 'Nedbank',      bank: 'Nedbank',      account_number: '11261234567', collection_day: 15, status: 'pending',   created_at: monthsAgo(9),  profiles: DEMO_PROFILES[3] },
  { id: 'm5', user_id: 'u5',  bank_name: 'FNB',          bank: 'FNB',          account_number: '62819876543', collection_day: 5,  status: 'active',    created_at: monthsAgo(8),  profiles: DEMO_PROFILES[4] },
  { id: 'm6', user_id: 'u7',  bank_name: 'Capitec',      bank: 'Capitec',      account_number: '13029876543', collection_day: 20, status: 'active',    created_at: monthsAgo(7),  profiles: DEMO_PROFILES[6] },
  { id: 'm7', user_id: 'u8',  bank_name: 'ABSA',         bank: 'ABSA',         account_number: '40891111222', collection_day: 10, status: 'active',    created_at: monthsAgo(6),  profiles: DEMO_PROFILES[7] },
  { id: 'm8', user_id: 'u10', bank_name: 'TymeBank',     bank: 'TymeBank',     account_number: '25019876543', collection_day: 3,  status: 'active',    created_at: monthsAgo(5),  profiles: DEMO_PROFILES[9] },
  { id: 'm9', user_id: 'u11', bank_name: 'Standard Bank',bank: 'Standard Bank',account_number: '37205556666', collection_day: 25, status: 'suspended', created_at: monthsAgo(4),  profiles: DEMO_PROFILES[10] },
];

// ── Cash Ledger ───────────────────────────────────────────────────────────────

export const DEMO_CASH_LEDGER = [
  { id: 'cl1',  type: 'opening_balance', category: 'other',            amount: 500000,  description: 'Opening balance — Jan 2025',         reference: 'OB-2025-01',  transaction_date: monthsAgo(6),  created_at: monthsAgo(6) },
  { id: 'cl2',  type: 'credit',          category: 'loan_repayment',   amount: 10500,   description: 'Repayment — Vusi Ndlovu ALG-2024-005',reference: 'PAY-20240102',transaction_date: monthsAgo(5),  created_at: monthsAgo(5) },
  { id: 'cl3',  type: 'debit',           category: 'loan_disbursement', amount: 320000,  description: 'Disbursement — APP-2025-003',         reference: 'DIS-20250103',transaction_date: monthsAgo(5),  created_at: monthsAgo(5) },
  { id: 'cl4',  type: 'credit',          category: 'loan_repayment',   amount: 6800,    description: 'Repayment — Thabo Nkosi ALG-2024-001', reference: 'PAY-20240201',transaction_date: monthsAgo(4),  created_at: monthsAgo(4) },
  { id: 'cl5',  type: 'credit',          category: 'loan_repayment',   amount: 2100,    description: 'Repayment — Zanele Dlamini ALG-2024-002',reference: 'PAY-20240202',transaction_date: monthsAgo(4), created_at: monthsAgo(4) },
  { id: 'cl6',  type: 'debit',           category: 'expense',          amount: 8500,    description: 'Office rental — March 2025',          reference: 'EXP-20250301',transaction_date: monthsAgo(3),  created_at: monthsAgo(3) },
  { id: 'cl7',  type: 'credit',          category: 'fee',              amount: 3200,    description: 'Initiation fee — APP-2025-003',        reference: 'FEE-20250302',transaction_date: monthsAgo(3),  created_at: monthsAgo(3) },
  { id: 'cl8',  type: 'debit',           category: 'loan_disbursement', amount: 180000,  description: 'Disbursement — APP-2025-001',         reference: 'DIS-20250303',transaction_date: monthsAgo(3),  created_at: monthsAgo(3) },
  { id: 'cl9',  type: 'credit',          category: 'loan_repayment',   amount: 10500,   description: 'Repayment — Vusi Ndlovu ALG-2024-005', reference: 'PAY-20240401',transaction_date: monthsAgo(2),  created_at: monthsAgo(2) },
  { id: 'cl10', type: 'credit',          category: 'loan_repayment',   amount: 6800,    description: 'Repayment — Thabo Nkosi ALG-2024-001', reference: 'PAY-20240402',transaction_date: monthsAgo(2),  created_at: monthsAgo(2) },
  { id: 'cl11', type: 'debit',           category: 'expense',          amount: 15000,   description: 'Staff salaries — April 2025',         reference: 'SAL-20250401',transaction_date: monthsAgo(2),  created_at: monthsAgo(2) },
  { id: 'cl12', type: 'credit',          category: 'interest',         amount: 18750,   description: 'Interest income — Q1 2025',           reference: 'INT-20250401',transaction_date: monthsAgo(1),  created_at: monthsAgo(1) },
  { id: 'cl13', type: 'debit',           category: 'loan_disbursement', amount: 75000,   description: 'Disbursement — APP-2025-004',         reference: 'DIS-20250502',transaction_date: monthsAgo(1),  created_at: monthsAgo(1) },
  { id: 'cl14', type: 'credit',          category: 'loan_repayment',   amount: 6500,    description: 'Repayment — Ayanda Mokoena',           reference: 'PAY-20240501',transaction_date: daysAgo(10),   created_at: daysAgo(10) },
  { id: 'cl15', type: 'credit',          category: 'loan_repayment',   amount: 4750,    description: 'Repayment — Fatima Essop',             reference: 'PAY-20240502',transaction_date: daysAgo(5),    created_at: daysAgo(5) },
];

// ── Credit Rules ──────────────────────────────────────────────────────────────

export const DEMO_CREDIT_RULES = [
  { id: 'cr1', category: 'score_band', label: 'Prime',       min_score: 750, max_score: 850, risk_level: 'low',    auto_decision: 'approve', max_loan_amount: 500000, interest_rate: 14, max_term_months: 60, first_loan_term_months: 24, color: '#10B981', is_active: true,  decline_message: '' },
  { id: 'cr2', category: 'score_band', label: 'Good',        min_score: 650, max_score: 749, risk_level: 'low',    auto_decision: 'approve', max_loan_amount: 350000, interest_rate: 17, max_term_months: 48, first_loan_term_months: 18, color: '#6366F1', is_active: true,  decline_message: '' },
  { id: 'cr3', category: 'score_band', label: 'Fair',        min_score: 550, max_score: 649, risk_level: 'medium', auto_decision: 'review',  max_loan_amount: 200000, interest_rate: 21, max_term_months: 36, first_loan_term_months: 12, color: '#F59E0B', is_active: true,  decline_message: '' },
  { id: 'cr4', category: 'score_band', label: 'Poor',        min_score: 400, max_score: 549, risk_level: 'high',   auto_decision: 'review',  max_loan_amount: 50000,  interest_rate: 26, max_term_months: 12, first_loan_term_months: 6,  color: '#EF4444', is_active: true,  decline_message: 'Application will be manually reviewed by credit team.' },
  { id: 'cr5', category: 'score_band', label: 'Very Poor',   min_score: 0,   max_score: 399, risk_level: 'high',   auto_decision: 'decline', max_loan_amount: 0,      interest_rate: 0,  max_term_months: 0,  first_loan_term_months: 0,  color: '#7C3AED', is_active: true,  decline_message: 'Credit score does not meet minimum lending criteria.' },
  { id: 'cr6', category: 'eligibility_rule', label: 'Minimum Monthly Income',          threshold: 5000,  fail_action: 'decline', description: 'Applicant must earn at least R5,000 per month', decline_reason: 'Income below minimum threshold', is_active: true },
  { id: 'cr7', category: 'eligibility_rule', label: 'Maximum Debt-to-Income Ratio',    threshold: 45,    fail_action: 'review',  description: 'Debt obligations must not exceed 45% of gross income', decline_reason: 'Debt-to-income ratio too high', is_active: true },
  { id: 'cr8', category: 'eligibility_rule', label: 'Minimum Age',                      threshold: 18,    fail_action: 'decline', description: 'Applicant must be at least 18 years old', decline_reason: 'Applicant does not meet minimum age requirement', is_active: true },
  { id: 'cr9', category: 'eligibility_rule', label: 'Valid South African ID',           threshold: null,  fail_action: 'decline', description: 'Applicant must have a valid SA ID or passport', decline_reason: 'Valid identification document required', is_active: true },
  { id: 'cr10',category: 'eligibility_rule', label: 'No Active Judgements',             threshold: null,  fail_action: 'decline', description: 'Applicant must have no active court judgements', decline_reason: 'Active court judgement on record', is_active: true },
];

// ── Revenue Analytics ─────────────────────────────────────────────────────────

export const DEMO_REVENUE_ANALYTICS = DEMO_LOANS.map(l => {
  const principal = Number(l.principal_amount);
  const rate = Number(l.interest_rate);
  const created = new Date(l.created_at);
  const months = Math.max(1, Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const interest = Math.round(principal * (rate / 100) * (months / 12));
  const status = l.status.toLowerCase();
  const arrears = (status === 'default' || status === 'arrears') ? Math.max(0, principal * 0.6) : 0;
  return {
    loan_id: l.loan_number,
    customer: l.profiles.full_name,
    month: l.created_at.slice(0, 7),
    principal,
    interest,
    fees: Math.round(principal * 0.01),
    arrears,
    status,
    created_at: l.created_at,
    user_id: l.user_id,
  };
});

// ── Consumers (SACRRA) ────────────────────────────────────────────────────────

export const DEMO_CONSUMERS = DEMO_PROFILES.slice(0, 12).map((p, i) => ({
  id: `c${i + 1}`,
  full_name: p.full_name,
  id_number: p.identity_number,
  identity_number: p.identity_number,
  credit_score: [720, 685, 640, 580, 710, 495, 760, 615, 730, 550, 680, 700][i],
  employer: ['Eskom','Self-employed','Transnet','SA Health','Ndlovu Group','Essop Trading','FinTech SA','Standard Bank','VDB Engineering','TJ Consulting','MokoenaGroup','Dept. Health'][i],
  employment_status: ['employed','self-employed','employed','employed','employed','self-employed','employed','employed','employed','contract','employed','employed'][i],
  submission_status: ['submitted','submitted','submitted','pending','submitted','failed','submitted','pending','submitted','submitted','submitted','submitted'][i],
  created_at: DEMO_LOANS[i]?.created_at ?? monthsAgo(6),
}));

// ── NCR Submissions ───────────────────────────────────────────────────────────

export const DEMO_NCR_SUBMISSIONS = [
  { id: 'ns1', period: '2024-Q1', report_type: 'Credit Agreements Register', status: 'approved',  submitted_by: 'Compliance Officer', reference: 'NCR-2024-Q1-001', created_at: monthsAgo(12) },
  { id: 'ns2', period: '2024-Q2', report_type: 'Credit Agreements Register', status: 'approved',  submitted_by: 'Compliance Officer', reference: 'NCR-2024-Q2-001', created_at: monthsAgo(9) },
  { id: 'ns3', period: '2024-Q3', report_type: 'Credit Agreements Register', status: 'approved',  submitted_by: 'Compliance Officer', reference: 'NCR-2024-Q3-001', created_at: monthsAgo(6) },
  { id: 'ns4', period: '2024-Q4', report_type: 'Credit Agreements Register', status: 'approved',  submitted_by: 'Compliance Officer', reference: 'NCR-2024-Q4-001', created_at: monthsAgo(3) },
  { id: 'ns5', period: '2025-Q1', report_type: 'Credit Agreements Register', status: 'pending',   submitted_by: 'Compliance Officer', reference: 'NCR-2025-Q1-001', created_at: daysAgo(5) },
  { id: 'ns6', period: '2024-Q1', report_type: 'Reckless Lending Indicator',  status: 'approved',  submitted_by: 'Admin User',         reference: 'NCR-2024-Q1-RLI', created_at: monthsAgo(12) },
  { id: 'ns7', period: '2024-Q2', report_type: 'Reckless Lending Indicator',  status: 'approved',  submitted_by: 'Admin User',         reference: 'NCR-2024-Q2-RLI', created_at: monthsAgo(9) },
  { id: 'ns8', period: '2024-Q3', report_type: 'Reckless Lending Indicator',  status: 'rejected',  submitted_by: 'Admin User',         reference: 'NCR-2024-Q3-RLI', created_at: monthsAgo(6) },
  { id: 'ns9', period: '2024-Q3', report_type: 'Reckless Lending Indicator',  status: 'approved',  submitted_by: 'Admin User',         reference: 'NCR-2024-Q3-RLI-REV', created_at: monthsAgo(5) },
  { id: 'ns10',period: '2025-Q1', report_type: 'Affordability Assessment',     status: 'pending',   submitted_by: 'Compliance Officer', reference: 'NCR-2025-Q1-AA',  created_at: daysAgo(2) },
];

// ── Compliance Tasks ──────────────────────────────────────────────────────────

export const DEMO_COMPLIANCE_TASKS = [
  { id: 'ct1',  category: 'NCR',      title: 'Q1 2025 NCR Credit Agreements submission',       due_date: `${today.getFullYear()}-04-30`, status: 'pending',   priority: 'high',   notes: 'Submit via NCR online portal by end of April.' },
  { id: 'ct2',  category: 'NCR',      title: 'Q4 2024 NCR submission — confirmed approved',    due_date: `${today.getFullYear()-1}-01-31`, status: 'completed', priority: 'high',  notes: 'Reference NCR-2024-Q4-001.' },
  { id: 'ct3',  category: 'SACRRA',   title: 'April SACRRA monthly data file submission',       due_date: `${today.getFullYear()}-04-15`, status: 'completed', priority: 'medium', notes: 'Data cut-off on the 10th. Submit by 15th.' },
  { id: 'ct4',  category: 'SACRRA',   title: 'May SACRRA monthly data file submission',         due_date: `${today.getFullYear()}-05-15`, status: 'pending',   priority: 'medium', notes: '' },
  { id: 'ct5',  category: 'POPIA',    title: 'Annual POPIA compliance audit',                   due_date: `${today.getFullYear()}-06-30`, status: 'pending',   priority: 'high',   notes: 'Engage external auditor by May.' },
  { id: 'ct6',  category: 'FIC',      title: 'Q1 goAML STR/CTR review and submission',          due_date: `${today.getFullYear()}-04-20`, status: 'pending',   priority: 'medium', notes: 'Review all flagged transactions.' },
  { id: 'ct7',  category: 'Internal', title: 'Credit policy annual review',                     due_date: `${today.getFullYear()}-07-31`, status: 'pending',   priority: 'low',    notes: 'Schedule board presentation.' },
  { id: 'ct8',  category: 'Internal', title: 'Staff compliance training — AML/CFT',             due_date: `${today.getFullYear()}-05-31`, status: 'pending',   priority: 'medium', notes: 'All client-facing staff to complete.' },
  { id: 'ct9',  category: 'NCR',      title: 'Q3 2024 Reckless Lending Indicator resubmission', due_date: `${today.getFullYear()-1}-08-31`, status: 'completed', priority: 'high', notes: 'Rejected first time — resubmitted as NCR-2024-Q3-RLI-REV.' },
  { id: 'ct10', category: 'POPIA',    title: 'Update Privacy Policy on borrower portal',        due_date: `${today.getFullYear()}-03-31`, status: 'completed', priority: 'low',   notes: 'Updated and published 2025-03-20.' },
];

// ── goAML Reports ─────────────────────────────────────────────────────────────

export const DEMO_GOAML_REPORTS = [
  { id: 'gr1', report_type: 'STR', subject_name: 'Unknown Counter-party', amount: 185000, description: 'Multiple cash deposits split below R25k threshold over 5 days', reference: 'STR-2024-001', report_date: monthsAgo(8), created_at: monthsAgo(8) },
  { id: 'gr2', report_type: 'CTR', subject_name: 'Vusi Ndlovu',           amount: 350000, description: 'Single cash transaction exceeding R24,999 — loan disbursement',  reference: 'CTR-2024-001', report_date: monthsAgo(8), created_at: monthsAgo(8) },
  { id: 'gr3', report_type: 'CTR', subject_name: 'James van der Berg',    amount: 420000, description: 'Cash disbursement exceeding threshold — settled loan',            reference: 'CTR-2024-002', report_date: monthsAgo(22),created_at: monthsAgo(22) },
  { id: 'gr4', report_type: 'STR', subject_name: 'Third Party Entity',    amount: 75000,  description: 'Funds received from unknown third party on behalf of applicant',  reference: 'STR-2024-002', report_date: monthsAgo(5), created_at: monthsAgo(5) },
  { id: 'gr5', report_type: 'SAR', subject_name: 'Priya Naidoo',          amount: 65000,  description: 'Account in default with no contact — possible fraud indicators',   reference: 'SAR-2024-001', report_date: monthsAgo(3), created_at: monthsAgo(3) },
];

// ── System Settings ───────────────────────────────────────────────────────────

export const DEMO_SYSTEM_SETTINGS = {
  company_name: 'AlgoLend Financial Services',
  company_email: 'info@algolend.co.za',
  company_phone: '+27 11 555 0100',
  company_address: '27 Sandton Drive, Sandton, 2196',
  primary_color: '#7C3AED',
  ncr_registration: 'NCR12345',
  max_loan_amount: 500000,
  min_loan_amount: 5000,
  default_interest_rate: 18,
  loan_application_fee: 1150,
  maintenance_mode: false,
};

// ── Portfolio analytics ───────────────────────────────────────────────────────

export const DEMO_PORTFOLIO_ANALYTICS = {
  loans: DEMO_LOANS.map(l => ({ principal_amount: l.principal_amount, status: l.status, created_at: l.created_at, interest_rate: l.interest_rate })),
  applications: DEMO_APPLICATIONS.map(a => ({ amount: a.amount, status: a.status, created_at: a.created_at })),
  payments: DEMO_INCOMING_PAYMENTS.filter(p => p.status === 'confirmed').map(p => ({ amount: p.amount, created_at: p.created_at, status: p.status })),
};
