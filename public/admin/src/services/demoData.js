// Demo mode data — returned by dataService when localStorage.algolend_demo === '1'.
// All names, IDs, and amounts are fictional.

export const isDemoMode = () => localStorage.getItem('algolend_demo') === '1';

export function enableDemoMode() {
  localStorage.setItem('algolend_demo', '1');
}

export function disableDemoMode() {
  localStorage.removeItem('algolend_demo');
}

// ── Fake profile injected as the logged-in admin ──────────────────────────────
export const DEMO_ADMIN_PROFILE = {
  id: 'demo-admin-001',
  email: 'demo@algolend.co.za',
  full_name: 'Demo Admin',
  avatar_url: null,
  role: 'super_admin',
  branch_id: 'demo-branch-jhb',
};

// ── Branches ──────────────────────────────────────────────────────────────────
export const DEMO_BRANCHES = [
  { id: 'demo-branch-jhb', name: 'Johannesburg (Demo)', city: 'Johannesburg' },
  { id: 'demo-branch-cpt', name: 'Cape Town (Demo)',    city: 'Cape Town' },
  { id: 'demo-branch-dbn', name: 'Durban (Demo)',       city: 'Durban' },
];

// ── Borrower profiles ─────────────────────────────────────────────────────────
export const DEMO_PROFILES = [
  { id: 'u01', full_name: 'Sipho Dlamini',    identity_number: '8501015009087', phone: '+27821001001', email: 'sipho.d@email.co.za',    branch_id: 'demo-branch-jhb', gross_income: 32000 },
  { id: 'u02', full_name: 'Thandi Mokoena',   identity_number: '9203220459081', phone: '+27821001002', email: 'thandi.m@email.co.za',   branch_id: 'demo-branch-jhb', gross_income: 18500 },
  { id: 'u03', full_name: 'Lungelo Zulu',     identity_number: '8812035009083', phone: '+27821001003', email: 'lungelo.z@email.co.za',  branch_id: 'demo-branch-dbn', gross_income: 24000 },
  { id: 'u04', full_name: 'Nompumelelo Khumalo', identity_number: '9507180459088', phone: '+27821001004', email: 'nompum.k@email.co.za', branch_id: 'demo-branch-dbn', gross_income: 15000 },
  { id: 'u05', full_name: 'Pieter van der Berg', identity_number: '7706135009082', phone: '+27821001005', email: 'pieter.v@email.co.za', branch_id: 'demo-branch-cpt', gross_income: 45000 },
  { id: 'u06', full_name: 'Fatima Jacobs',    identity_number: '8904110459086', phone: '+27821001006', email: 'fatima.j@email.co.za',   branch_id: 'demo-branch-cpt', gross_income: 28000 },
  { id: 'u07', full_name: 'Bongani Nkosi',    identity_number: '9110135009084', phone: '+27821001007', email: 'bongani.n@email.co.za',  branch_id: 'demo-branch-jhb', gross_income: 21000 },
  { id: 'u08', full_name: 'Ayanda Cele',      identity_number: '8603220459085', phone: '+27821001008', email: 'ayanda.c@email.co.za',   branch_id: 'demo-branch-dbn', gross_income: 19500 },
  { id: 'u09', full_name: 'Zanele Sithole',   identity_number: '9305155009081', phone: '+27821001009', email: 'zanele.s@email.co.za',   branch_id: 'demo-branch-jhb', gross_income: 26000 },
  { id: 'u10', full_name: 'Riaan Fourie',     identity_number: '8001015009086', phone: '+27821001010', email: 'riaan.f@email.co.za',    branch_id: 'demo-branch-cpt', gross_income: 52000 },
  { id: 'u11', full_name: 'Nomvula Ntanzi',   identity_number: '9712035459087', phone: '+27821001011', email: 'nomvula.n@email.co.za',  branch_id: 'demo-branch-dbn', gross_income: 14000 },
  { id: 'u12', full_name: 'Johan Pretorius',  identity_number: '7503015009083', phone: '+27821001012', email: 'johan.p@email.co.za',    branch_id: 'demo-branch-cpt', gross_income: 38000 },
];

// ── Loan applications ─────────────────────────────────────────────────────────
const today = new Date();
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString();

export const DEMO_APPLICATIONS = [
  {
    id: 'app01', loan_number: 'AL-2025-0001', user_id: 'u01',
    amount: 25000, status: 'DISBURSED', created_at: daysAgo(60), updated_at: daysAgo(55),
    offer_principal: 25000, offer_monthly_repayment: 4583, offer_total_repayment: 27500,
    offer_interest_rate: 5, term_months: 6,
    repayment_start_date: daysAgo(50),
    profiles: DEMO_PROFILES[0],
    bank_accounts: { bank_name: 'FNB', account_number: '****3210' },
    credit_band_label: 'Good', credit_rate_pa: 21,
    is_first_loan: false,
  },
  {
    id: 'app02', loan_number: 'AL-2025-0002', user_id: 'u02',
    amount: 8000, status: 'IN_ARREARS', created_at: daysAgo(90), updated_at: daysAgo(10),
    offer_principal: 8000, offer_monthly_repayment: 1480, offer_total_repayment: 8880,
    offer_interest_rate: 5, term_months: 6,
    repayment_start_date: daysAgo(80),
    profiles: DEMO_PROFILES[1],
    bank_accounts: { bank_name: 'Capitec', account_number: '****9812' },
    credit_band_label: 'Fair', credit_rate_pa: 27.5,
    is_first_loan: true,
  },
  {
    id: 'app03', loan_number: 'AL-2025-0003', user_id: 'u03',
    amount: 15000, status: 'DISBURSED', created_at: daysAgo(45), updated_at: daysAgo(40),
    offer_principal: 15000, offer_monthly_repayment: 2750, offer_total_repayment: 16500,
    offer_interest_rate: 5, term_months: 6,
    repayment_start_date: daysAgo(38),
    profiles: DEMO_PROFILES[2],
    bank_accounts: { bank_name: 'Absa', account_number: '****7734' },
    credit_band_label: 'Good', credit_rate_pa: 21,
    is_first_loan: false,
  },
  {
    id: 'app04', loan_number: 'AL-2025-0004', user_id: 'u04',
    amount: 5000, status: 'OFFERED', created_at: daysAgo(3), updated_at: daysAgo(1),
    offer_principal: 5000, offer_monthly_repayment: 933, offer_total_repayment: 5600,
    offer_interest_rate: 5, term_months: 6,
    repayment_start_date: null,
    profiles: DEMO_PROFILES[3],
    bank_accounts: null,
    credit_band_label: 'Fair', credit_rate_pa: 27.5,
    is_first_loan: true,
  },
  {
    id: 'app05', loan_number: 'AL-2025-0005', user_id: 'u05',
    amount: 50000, status: 'PENDING', created_at: daysAgo(1), updated_at: daysAgo(0),
    offer_principal: null, offer_monthly_repayment: null, offer_total_repayment: null,
    offer_interest_rate: null, term_months: null,
    repayment_start_date: null,
    profiles: DEMO_PROFILES[4],
    bank_accounts: null,
    credit_band_label: null, credit_rate_pa: null,
    is_first_loan: false,
  },
  {
    id: 'app06', loan_number: 'AL-2025-0006', user_id: 'u06',
    amount: 20000, status: 'DISBURSED', created_at: daysAgo(120), updated_at: daysAgo(115),
    offer_principal: 20000, offer_monthly_repayment: 3667, offer_total_repayment: 22000,
    offer_interest_rate: 5, term_months: 6,
    repayment_start_date: daysAgo(110),
    profiles: DEMO_PROFILES[5],
    bank_accounts: { bank_name: 'Standard Bank', account_number: '****5521' },
    credit_band_label: 'Excellent', credit_rate_pa: 15,
    is_first_loan: false,
  },
  {
    id: 'app07', loan_number: 'AL-2025-0007', user_id: 'u07',
    amount: 12000, status: 'PENDING', created_at: daysAgo(2), updated_at: daysAgo(2),
    offer_principal: null, offer_monthly_repayment: null, offer_total_repayment: null,
    offer_interest_rate: null, term_months: null,
    repayment_start_date: null,
    profiles: DEMO_PROFILES[6],
    bank_accounts: null,
    credit_band_label: null, credit_rate_pa: null,
    is_first_loan: true,
  },
  {
    id: 'app08', loan_number: 'AL-2025-0008', user_id: 'u08',
    amount: 7500, status: 'DECLINED', created_at: daysAgo(14), updated_at: daysAgo(13),
    offer_principal: null, offer_monthly_repayment: null, offer_total_repayment: null,
    offer_interest_rate: null, term_months: null,
    repayment_start_date: null,
    profiles: DEMO_PROFILES[7],
    bank_accounts: null,
    credit_band_label: 'Poor', credit_rate_pa: null,
    is_first_loan: true,
  },
  {
    id: 'app09', loan_number: 'AL-2025-0009', user_id: 'u09',
    amount: 30000, status: 'DISBURSED', created_at: daysAgo(30), updated_at: daysAgo(26),
    offer_principal: 30000, offer_monthly_repayment: 5500, offer_total_repayment: 33000,
    offer_interest_rate: 5, term_months: 6,
    repayment_start_date: daysAgo(24),
    profiles: DEMO_PROFILES[8],
    bank_accounts: { bank_name: 'Nedbank', account_number: '****1190' },
    credit_band_label: 'Good', credit_rate_pa: 21,
    is_first_loan: false,
  },
  {
    id: 'app10', loan_number: 'AL-2025-0010', user_id: 'u10',
    amount: 45000, status: 'OFFERED', created_at: daysAgo(5), updated_at: daysAgo(3),
    offer_principal: 45000, offer_monthly_repayment: 8250, offer_total_repayment: 49500,
    offer_interest_rate: 5, term_months: 6,
    repayment_start_date: null,
    profiles: DEMO_PROFILES[9],
    bank_accounts: null,
    credit_band_label: 'Excellent', credit_rate_pa: 15,
    is_first_loan: false,
  },
];

// ── Dashboard summary ─────────────────────────────────────────────────────────
export const DEMO_DASHBOARD = {
  financials: {
    total_disbursed:     230000,
    total_collected:      87500,
    profit_margin:         12.4,
    active_loans_count:       6,
    pending_apps:             2,
  },
  portfolioStatus: [
    { name: 'Active',   value: 6 },
    { name: 'Arrears',  value: 1 },
    { name: 'Repaid',   value: 3 },
    { name: 'Declined', value: 1 },
  ],
  error: null,
};

// ── Pipeline (non-disbursed, active) ─────────────────────────────────────────
export const DEMO_PIPELINE = {
  data: DEMO_APPLICATIONS.filter(a => !['DISBURSED','DECLINED'].includes(a.status)),
  error: null,
};

// ── Monthly performance ───────────────────────────────────────────────────────
export const DEMO_MONTHLY_PERFORMANCE = {
  data: [
    { month_year: '2025-01', originated_amount: 25000, disbursed_amount: 25000, repaid_amount: 0,     defaulted_amount: 0, count: 1 },
    { month_year: '2025-02', originated_amount: 20000, disbursed_amount: 20000, repaid_amount: 20000, defaulted_amount: 0, count: 1 },
    { month_year: '2025-03', originated_amount: 33000, disbursed_amount: 33000, repaid_amount: 0,     defaulted_amount: 0, count: 2 },
    { month_year: '2025-04', originated_amount: 15000, disbursed_amount: 15000, repaid_amount: 15000, defaulted_amount: 0, count: 1 },
    { month_year: '2025-05', originated_amount: 57500, disbursed_amount: 45000, repaid_amount: 0,     defaulted_amount: 7500, count: 3 },
    { month_year: '2025-06', originated_amount: 80000, disbursed_amount: 55000, repaid_amount: 0,     defaulted_amount: 0, count: 3 },
  ],
};

// ── Loan book ─────────────────────────────────────────────────────────────────
export const DEMO_LOAN_BOOK = {
  data: DEMO_APPLICATIONS.filter(a => ['DISBURSED','IN_ARREARS','OFFERED'].includes(a.status)).map(a => ({
    ...a,
    days_active: a.repayment_start_date
      ? Math.floor((Date.now() - new Date(a.repayment_start_date).getTime()) / 864e5)
      : 0,
    maturity_date: a.repayment_start_date && a.term_months
      ? new Date(new Date(a.repayment_start_date).setMonth(new Date(a.repayment_start_date).getMonth() + a.term_months)).toISOString()
      : null,
  })),
  error: null,
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const DEMO_PAYMENTS = {
  data: [
    { id: 'pmt01', application_id: 'app01', user_id: 'u01', amount: 4583, status: 'confirmed', payment_date: daysAgo(18), reference: 'DEBIT-20250601', profiles: DEMO_PROFILES[0] },
    { id: 'pmt02', application_id: 'app03', user_id: 'u03', amount: 2750, status: 'confirmed', payment_date: daysAgo(16), reference: 'DEBIT-20250603', profiles: DEMO_PROFILES[2] },
    { id: 'pmt03', application_id: 'app06', user_id: 'u06', amount: 3667, status: 'confirmed', payment_date: daysAgo(15), reference: 'DEBIT-20250604', profiles: DEMO_PROFILES[5] },
    { id: 'pmt04', application_id: 'app09', user_id: 'u09', amount: 5500, status: 'confirmed', payment_date: daysAgo(12), reference: 'DEBIT-20250607', profiles: DEMO_PROFILES[8] },
    { id: 'pmt05', application_id: 'app01', user_id: 'u01', amount: 4583, status: 'confirmed', payment_date: daysAgo(3),  reference: 'DEBIT-20250616', profiles: DEMO_PROFILES[0] },
    { id: 'pmt06', application_id: 'app02', user_id: 'u02', amount: 1480, status: 'pending',   payment_date: daysAgo(1),  reference: 'DEBIT-20250618', profiles: DEMO_PROFILES[1] },
  ],
  error: null,
};

// ── Payouts / disbursements ───────────────────────────────────────────────────
export const DEMO_PAYOUTS = {
  data: [
    { id: 'pay01', application_id: 'app01', amount: 25000, status: 'processed', created_at: daysAgo(55), bank_name: 'FNB',           account_number: '****3210', profiles: DEMO_PROFILES[0] },
    { id: 'pay02', application_id: 'app03', amount: 15000, status: 'processed', created_at: daysAgo(40), bank_name: 'Absa',          account_number: '****7734', profiles: DEMO_PROFILES[2] },
    { id: 'pay03', application_id: 'app06', amount: 20000, status: 'processed', created_at: daysAgo(115),bank_name: 'Standard Bank', account_number: '****5521', profiles: DEMO_PROFILES[5] },
    { id: 'pay04', application_id: 'app09', amount: 30000, status: 'processed', created_at: daysAgo(26), bank_name: 'Nedbank',       account_number: '****1190', profiles: DEMO_PROFILES[8] },
    { id: 'pay05', application_id: 'app04', amount: 5000,  status: 'pending',   created_at: daysAgo(1),  bank_name: 'Capitec',       account_number: '****2211', profiles: DEMO_PROFILES[3] },
  ],
  error: null,
};

// ── System settings ───────────────────────────────────────────────────────────
export const DEMO_SYSTEM_SETTINGS = {
  company_name:       'AlgoLend (Demo)',
  company_logo_url:   null,
  primary_color:      '#7C3AED',
  secondary_color:    '#A78BFA',
  tertiary_color:     '#EDE9FE',
  theme_mode:         'light',
  ncr_number:         'NCRCP12345',
  fic_registration:   'FIC-2024-AL001',
};

// ── Portal borrower profile (used by user-portal demo) ───────────────────────
export const DEMO_BORROWER_PROFILE = {
  id: 'demo-borrower-001',
  full_name: 'Sipho Dlamini',
  email: 'sipho.d@email.co.za',
  phone: '+27821001001',
  identity_number: '8501015009087',
  gross_income: 32000,
  employment_status: 'Employed',
  employer_name: 'Acme Industries (Pty) Ltd',
  bank_name: 'FNB',
  account_number: '****3210',
  active_loan: {
    loan_number: 'AL-2025-0001',
    amount: 25000,
    monthly_repayment: 4583,
    outstanding_balance: 18334,
    next_payment_date: new Date(Date.now() + 12 * 864e5).toISOString(),
    status: 'DISBURSED',
    term_months: 6,
    start_date: daysAgo(50),
  },
};
