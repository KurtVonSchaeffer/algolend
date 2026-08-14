// Demo mode data store — all state lives in localStorage so actions persist across page navigations.
// Every function here mirrors a function in adminData.ts and returns the same shape.

const STORE_KEY = 'algolend_demo_v2';

// ── Types (minimal, matching what pages consume) ───────────────────────────

export interface DemoApplication {
  id: string;
  loan_number: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  notes?: string;
  offer_monthly_repayment?: number;
  offer_total_repayment?: number;
  offer_term_months?: number;
  offer_interest_rate?: number;
  profiles: { full_name: string; identity_number: string };
}

export interface DemoProfile {
  id: string;
  full_name: string;
  identity_number: string;
  email: string;
  cell_tel_no: string;
  created_at: string;
  role?: string;
  address_line_1?: string;
  employer_name?: string;
  occupation?: string;
  date_of_birth?: string;
}

export interface DemoLoan {
  id: string;
  loan_number: string;
  user_id: string;
  principal_amount: number;
  interest_rate: number;
  term_months: number;
  status: string;
  outstanding_balance: number;
  created_at: string;
  profiles?: { full_name: string; identity_number: string };
}

export interface DemoPayment {
  id: string;
  user_id: string;
  application_id: string;
  amount: number;
  status: string;
  payment_method: string;
  reference: string;
  created_at: string;
  confirmed_at?: string;
  profiles?: { full_name: string; identity_number: string; cell_tel_no: string };
  loan_applications?: { id: string; loan_number: string; amount: number; status: string; offer_monthly_repayment: number; offer_total_repayment: number };
}

export interface DemoPayout {
  id: string;
  user_id: string;
  application_id: string;
  amount: number;
  status: string;
  created_at: string;
  approved_at?: string;
  profile?: { full_name: string; email: string };
  application?: { status: string; bank_account?: DemoBankAccount };
}

export interface DemoBankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  branch_code: string;
  verified: boolean;
}

export interface DemoMandate {
  id: string;
  user_id: string;
  application_id: string;
  status: string;
  mandate_reference: string;
  amount: number;
  collection_day: number;
  created_at: string;
  profiles?: { full_name: string; identity_number: string };
  loan_applications?: { amount: number };
}

export interface DemoCreditCheck {
  id: string;
  user_id: string;
  score: number;
  status: string;
  checked_at: string;
  report_data?: Record<string, unknown>;
}

export interface DemoFinancialProfile {
  id: string;
  user_id: string;
  monthly_income: number;
  monthly_expenses: number;
  net_income: number;
  employment_status: string;
  employer_name: string;
  occupation: string;
  existing_debt: number;
}

export interface DemoLedgerEntry {
  id: string;
  transaction_date: string;
  description: string;
  type: string;
  amount: number;
  running_balance: number;
  reference: string;
}

export interface DemoCreditRule {
  id: string;
  name: string;
  rule_type: string;
  operator: string;
  value: number;
  action: string;
  active: boolean;
  created_at: string;
}

export interface DemoComplianceTask {
  id: string;
  title: string;
  description: string;
  status: string;
  due_date: string;
  priority: string;
  created_at: string;
}

export interface DemoGoAMLReport {
  id: string;
  report_type: string;
  reference: string;
  status: string;
  created_at: string;
  submitted_at?: string;
}

export interface DemoState {
  applications: DemoApplication[];
  profiles: DemoProfile[];
  loans: DemoLoan[];
  payments: DemoPayment[];
  payouts: DemoPayout[];
  mandates: DemoMandate[];
  creditChecks: DemoCreditCheck[];
  financialProfiles: DemoFinancialProfile[];
  bankAccounts: DemoBankAccount[];
  ledger: DemoLedgerEntry[];
  creditRules: DemoCreditRule[];
  complianceTasks: DemoComplianceTask[];
  goAMLReports: DemoGoAMLReport[];
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

const d = (daysAgo: number, h = 8) =>
  new Date(Date.now() - daysAgo * 86_400_000 + h * 3_600_000).toISOString();

const SEED: DemoState = {
  profiles: [
    { id: 'u001', full_name: 'Thabo Nkosi', identity_number: '8503155600108', email: 'thabo.nkosi@gmail.com', cell_tel_no: '0712345678', created_at: d(30), role: 'borrower', address_line_1: '14 Soweto Ave, Johannesburg', employer_name: 'MTN South Africa', occupation: 'Network Engineer', date_of_birth: '1985-03-15' },
    { id: 'u002', full_name: 'Zanele Dlamini', identity_number: '9011220024089', email: 'zanele.d@outlook.com', cell_tel_no: '0823456789', created_at: d(28), role: 'borrower', address_line_1: '7 Berea Rd, Durban', employer_name: 'Woolworths Holdings', occupation: 'Store Manager', date_of_birth: '1990-11-22' },
    { id: 'u003', full_name: 'Ahmed Patel', identity_number: '7806035123087', email: 'a.patel@webmail.co.za', cell_tel_no: '0731234567', created_at: d(25), role: 'borrower', address_line_1: '22 Lenasia Ext 4, Johannesburg', employer_name: 'Patel & Associates Law', occupation: 'Junior Associate', date_of_birth: '1978-06-03' },
    { id: 'u004', full_name: 'Lerato Mokoena', identity_number: '9204014102085', email: 'lerato.m@gmail.com', cell_tel_no: '0674567890', created_at: d(20), role: 'borrower', address_line_1: '3 Sandton Gardens, Sandton', employer_name: 'Absa Bank', occupation: 'Branch Consultant', date_of_birth: '1992-04-01' },
    { id: 'u005', full_name: 'Sipho Mthembu', identity_number: '8801065432082', email: 'sipho.mthembu@yahoo.com', cell_tel_no: '0819876543', created_at: d(18), role: 'borrower', address_line_1: '88 Church St, Pretoria', employer_name: 'Department of Health', occupation: 'Admin Clerk', date_of_birth: '1988-01-06' },
    { id: 'u006', full_name: 'Nomsa Sithole', identity_number: '8607014567083', email: 'nomsa.sithole@webmail.co.za', cell_tel_no: '0765432109', created_at: d(90), role: 'borrower', address_line_1: '5 Khumalo St, Soweto', employer_name: 'Shoprite Checkers', occupation: 'Cashier Supervisor', date_of_birth: '1986-07-01' },
    { id: 'u007', full_name: 'David Botha', identity_number: '7912225034080', email: 'dbotha@gmail.com', cell_tel_no: '0827654321', created_at: d(120), role: 'borrower', address_line_1: '19 Klein Brak, Mossel Bay', employer_name: 'City of Cape Town', occupation: 'Civil Engineer', date_of_birth: '1979-12-22' },
    { id: 'u008', full_name: 'Grace Molefe', identity_number: '9503040678081', email: 'grace.molefe@gmail.com', cell_tel_no: '0614567890', created_at: d(60), role: 'borrower', address_line_1: '2 Mafikeng Rd, Mahikeng', employer_name: 'Pick n Pay', occupation: 'Sales Associate', date_of_birth: '1995-03-04' },
  ],

  applications: [
    {
      id: 'app001', loan_number: 'AL-2026-0041', amount: 15000, status: 'STARTED',
      created_at: d(2), updated_at: d(2), user_id: 'u001', notes: 'Walk-in client — employed at MTN',
      offer_monthly_repayment: 2340, offer_total_repayment: 28080, offer_term_months: 12, offer_interest_rate: 24.5,
      profiles: { full_name: 'Thabo Nkosi', identity_number: '8503155600108' },
    },
    {
      id: 'app002', loan_number: 'AL-2026-0040', amount: 8500, status: 'BUREAU_CHECKING',
      created_at: d(3), updated_at: d(1), user_id: 'u002', notes: 'Credit check submitted to TransUnion',
      offer_monthly_repayment: 1485, offer_total_repayment: 17820, offer_term_months: 12, offer_interest_rate: 22.0,
      profiles: { full_name: 'Zanele Dlamini', identity_number: '9011220024089' },
    },
    {
      id: 'app003', loan_number: 'AL-2026-0039', amount: 25000, status: 'AFFORD_OK',
      created_at: d(5), updated_at: d(1), user_id: 'u003', notes: 'Affordability confirmed — strong NLR score',
      offer_monthly_repayment: 3875, offer_total_repayment: 46500, offer_term_months: 12, offer_interest_rate: 24.0,
      profiles: { full_name: 'Ahmed Patel', identity_number: '7806035123087' },
    },
    {
      id: 'app004', loan_number: 'AL-2026-0038', amount: 12000, status: 'OFFERED',
      created_at: d(7), updated_at: d(2), user_id: 'u004', notes: 'Contract emailed — awaiting signature',
      offer_monthly_repayment: 1980, offer_total_repayment: 23760, offer_term_months: 12, offer_interest_rate: 24.0,
      profiles: { full_name: 'Lerato Mokoena', identity_number: '9204014102085' },
    },
    {
      id: 'app005', loan_number: 'AL-2026-0037', amount: 6000, status: 'READY_TO_DISBURSE',
      created_at: d(9), updated_at: d(1), user_id: 'u005', notes: 'Contract signed — payment queued',
      offer_monthly_repayment: 1050, offer_total_repayment: 12600, offer_term_months: 12, offer_interest_rate: 22.5,
      profiles: { full_name: 'Sipho Mthembu', identity_number: '8801065432082' },
    },
    {
      id: 'app006', loan_number: 'AL-2026-0031', amount: 20000, status: 'DISBURSED',
      created_at: d(90), updated_at: d(85), user_id: 'u006', notes: 'Disbursed via EFT',
      offer_monthly_repayment: 3100, offer_total_repayment: 37200, offer_term_months: 12, offer_interest_rate: 24.0,
      profiles: { full_name: 'Nomsa Sithole', identity_number: '8607014567083' },
    },
    {
      id: 'app007', loan_number: 'AL-2026-0022', amount: 35000, status: 'DISBURSED',
      created_at: d(120), updated_at: d(115), user_id: 'u007', notes: 'Disbursed — performing well',
      offer_monthly_repayment: 5425, offer_total_repayment: 65100, offer_term_months: 12, offer_interest_rate: 24.0,
      profiles: { full_name: 'David Botha', identity_number: '7912225034080' },
    },
    {
      id: 'app008', loan_number: 'AL-2026-0035', amount: 9000, status: 'DECLINED',
      created_at: d(30), updated_at: d(28), user_id: 'u008', notes: 'Declined — NLR adverse listing found',
      profiles: { full_name: 'Grace Molefe', identity_number: '9503040678081' },
    },
  ],

  loans: [
    {
      id: 'loan001', loan_number: 'LN-2026-0031', user_id: 'u006',
      principal_amount: 20000, interest_rate: 24.0, term_months: 12,
      status: 'active', outstanding_balance: 14200, created_at: d(85),
      profiles: { full_name: 'Nomsa Sithole', identity_number: '8607014567083' },
    },
    {
      id: 'loan002', loan_number: 'LN-2026-0022', user_id: 'u007',
      principal_amount: 35000, interest_rate: 24.0, term_months: 12,
      status: 'active', outstanding_balance: 22050, created_at: d(115),
      profiles: { full_name: 'David Botha', identity_number: '7912225034080' },
    },
  ],

  payments: [
    { id: 'pay001', user_id: 'u006', application_id: 'app006', amount: 3100, status: 'confirmed', payment_method: 'EFT', reference: 'REF-2026-0801', created_at: d(5), confirmed_at: d(4), profiles: { full_name: 'Nomsa Sithole', identity_number: '8607014567083', cell_tel_no: '0765432109' }, loan_applications: { id: 'app006', loan_number: 'AL-2026-0031', amount: 20000, status: 'DISBURSED', offer_monthly_repayment: 3100, offer_total_repayment: 37200 } },
    { id: 'pay002', user_id: 'u007', application_id: 'app007', amount: 5425, status: 'confirmed', payment_method: 'DebiCheck', reference: 'REF-2026-0799', created_at: d(6), confirmed_at: d(5), profiles: { full_name: 'David Botha', identity_number: '7912225034080', cell_tel_no: '0827654321' }, loan_applications: { id: 'app007', loan_number: 'AL-2026-0022', amount: 35000, status: 'DISBURSED', offer_monthly_repayment: 5425, offer_total_repayment: 65100 } },
    { id: 'pay003', user_id: 'u006', application_id: 'app006', amount: 3100, status: 'confirmed', payment_method: 'DebiCheck', reference: 'REF-2026-0743', created_at: d(35), confirmed_at: d(34), profiles: { full_name: 'Nomsa Sithole', identity_number: '8607014567083', cell_tel_no: '0765432109' }, loan_applications: { id: 'app006', loan_number: 'AL-2026-0031', amount: 20000, status: 'DISBURSED', offer_monthly_repayment: 3100, offer_total_repayment: 37200 } },
    { id: 'pay004', user_id: 'u007', application_id: 'app007', amount: 5425, status: 'confirmed', payment_method: 'DebiCheck', reference: 'REF-2026-0741', created_at: d(36), confirmed_at: d(35), profiles: { full_name: 'David Botha', identity_number: '7912225034080', cell_tel_no: '0827654321' }, loan_applications: { id: 'app007', loan_number: 'AL-2026-0022', amount: 35000, status: 'DISBURSED', offer_monthly_repayment: 5425, offer_total_repayment: 65100 } },
    { id: 'pay005', user_id: 'u006', application_id: 'app006', amount: 3100, status: 'confirmed', payment_method: 'DebiCheck', reference: 'REF-2026-0693', created_at: d(65), confirmed_at: d(64), profiles: { full_name: 'Nomsa Sithole', identity_number: '8607014567083', cell_tel_no: '0765432109' }, loan_applications: { id: 'app006', loan_number: 'AL-2026-0031', amount: 20000, status: 'DISBURSED', offer_monthly_repayment: 3100, offer_total_repayment: 37200 } },
    { id: 'pay006', user_id: 'u007', application_id: 'app007', amount: 5425, status: 'confirmed', payment_method: 'DebiCheck', reference: 'REF-2026-0689', created_at: d(66), confirmed_at: d(65), profiles: { full_name: 'David Botha', identity_number: '7912225034080', cell_tel_no: '0827654321' }, loan_applications: { id: 'app007', loan_number: 'AL-2026-0022', amount: 35000, status: 'DISBURSED', offer_monthly_repayment: 5425, offer_total_repayment: 65100 } },
    { id: 'pay007', user_id: 'u007', application_id: 'app007', amount: 5425, status: 'confirmed', payment_method: 'DebiCheck', reference: 'REF-2026-0601', created_at: d(96), confirmed_at: d(95), profiles: { full_name: 'David Botha', identity_number: '7912225034080', cell_tel_no: '0827654321' }, loan_applications: { id: 'app007', loan_number: 'AL-2026-0022', amount: 35000, status: 'DISBURSED', offer_monthly_repayment: 5425, offer_total_repayment: 65100 } },
    { id: 'pay008', user_id: 'u006', application_id: 'app006', amount: 1550, status: 'pending', payment_method: 'EFT', reference: 'REF-2026-0812', created_at: d(1), profiles: { full_name: 'Nomsa Sithole', identity_number: '8607014567083', cell_tel_no: '0765432109' }, loan_applications: { id: 'app006', loan_number: 'AL-2026-0031', amount: 20000, status: 'DISBURSED', offer_monthly_repayment: 3100, offer_total_repayment: 37200 } },
  ],

  payouts: [
    { id: 'po001', user_id: 'u006', application_id: 'app006', amount: 20000, status: 'APPROVED', created_at: d(86), approved_at: d(85), profile: { full_name: 'Nomsa Sithole', email: 'nomsa.sithole@webmail.co.za' }, application: { status: 'DISBURSED', bank_account: { id: 'ba001', user_id: 'u006', bank_name: 'FNB', account_number: '62123456789', account_type: 'Cheque', branch_code: '250655', verified: true } } },
    { id: 'po002', user_id: 'u007', application_id: 'app007', amount: 35000, status: 'APPROVED', created_at: d(116), approved_at: d(115), profile: { full_name: 'David Botha', email: 'dbotha@gmail.com' }, application: { status: 'DISBURSED', bank_account: { id: 'ba002', user_id: 'u007', bank_name: 'Standard Bank', account_number: '05987654321', account_type: 'Savings', branch_code: '051001', verified: true } } },
    { id: 'po003', user_id: 'u005', application_id: 'app005', amount: 6000, status: 'PENDING', created_at: d(1), profile: { full_name: 'Sipho Mthembu', email: 'sipho.mthembu@yahoo.com' }, application: { status: 'READY_TO_DISBURSE', bank_account: { id: 'ba003', user_id: 'u005', bank_name: 'Absa', account_number: '4098765432', account_type: 'Cheque', branch_code: '632005', verified: true } } },
  ],

  mandates: [
    { id: 'man001', user_id: 'u006', application_id: 'app006', status: 'ACTIVE', mandate_reference: 'DCM-2026-0031', amount: 3100, collection_day: 1, created_at: d(84), profiles: { full_name: 'Nomsa Sithole', identity_number: '8607014567083' }, loan_applications: { amount: 20000 } },
    { id: 'man002', user_id: 'u007', application_id: 'app007', status: 'ACTIVE', mandate_reference: 'DCM-2026-0022', amount: 5425, collection_day: 25, created_at: d(114), profiles: { full_name: 'David Botha', identity_number: '7912225034080' }, loan_applications: { amount: 35000 } },
    { id: 'man003', user_id: 'u005', application_id: 'app005', status: 'PENDING_AUTH', mandate_reference: 'DCM-2026-0037', amount: 1050, collection_day: 5, created_at: d(1), profiles: { full_name: 'Sipho Mthembu', identity_number: '8801065432082' }, loan_applications: { amount: 6000 } },
  ],

  creditChecks: [
    {
      id: 'cc001', user_id: 'u002', score: 648, status: 'RUNNING', checked_at: d(1),
      report_data: { bureau: 'TransUnion NLR', status: 'IN_PROGRESS', message: 'Credit bureau check submitted — awaiting response' },
    },
    {
      id: 'cc002', user_id: 'u003', score: 724, status: 'PASS', checked_at: d(3),
      report_data: {
        bureau: 'TransUnion NLR', nlr_score: 724, adverse_listings: 0, judgements: 0, defaults: 0,
        total_accounts: 5, active_accounts: 3, monthly_installments: 2100,
        recommendation: 'APPROVE', debt_to_income: 28,
        accounts: [
          { type: 'Credit Card', bank: 'FNB', balance: 4500, limit: 12000, status: 'Good Standing' },
          { type: 'Vehicle Finance', bank: 'WesBank', balance: 85000, installment: 1650, status: 'Good Standing' },
          { type: 'Personal Loan', bank: 'Capitec', balance: 0, status: 'Settled' },
        ],
      },
    },
    {
      id: 'cc003', user_id: 'u004', score: 691, status: 'PASS', checked_at: d(5),
      report_data: {
        bureau: 'Experian', nlr_score: 691, adverse_listings: 0, judgements: 0, defaults: 0,
        total_accounts: 3, active_accounts: 2, monthly_installments: 1400,
        recommendation: 'APPROVE', debt_to_income: 22,
        accounts: [
          { type: 'Home Loan', bank: 'Absa', balance: 620000, installment: 1200, status: 'Good Standing' },
          { type: 'Credit Card', bank: 'Standard Bank', balance: 2300, limit: 8000, status: 'Good Standing' },
        ],
      },
    },
    {
      id: 'cc004', user_id: 'u005', score: 703, status: 'PASS', checked_at: d(7),
      report_data: {
        bureau: 'TransUnion NLR', nlr_score: 703, adverse_listings: 0, judgements: 0, defaults: 0,
        total_accounts: 2, active_accounts: 2, monthly_installments: 950,
        recommendation: 'APPROVE', debt_to_income: 19,
        accounts: [
          { type: 'Retail Account', bank: 'Edgars', balance: 1800, limit: 4000, status: 'Good Standing' },
        ],
      },
    },
    {
      id: 'cc005', user_id: 'u006', score: 680, status: 'PASS', checked_at: d(88),
      report_data: { bureau: 'TransUnion NLR', nlr_score: 680, adverse_listings: 0, recommendation: 'APPROVE' },
    },
    {
      id: 'cc006', user_id: 'u007', score: 745, status: 'PASS', checked_at: d(118),
      report_data: { bureau: 'Experian', nlr_score: 745, adverse_listings: 0, recommendation: 'APPROVE' },
    },
    {
      id: 'cc007', user_id: 'u008', score: 412, status: 'FAIL', checked_at: d(29),
      report_data: {
        bureau: 'TransUnion NLR', nlr_score: 412, adverse_listings: 2, judgements: 1, defaults: 1,
        total_accounts: 6, active_accounts: 4, monthly_installments: 4200,
        recommendation: 'DECLINE', debt_to_income: 87,
        accounts: [
          { type: 'Personal Loan', bank: 'African Bank', balance: 22000, installment: 2100, status: 'In Arrears' },
          { type: 'Credit Card', bank: 'Capitec', balance: 15000, limit: 15000, status: 'Over Limit' },
        ],
      },
    },
  ],

  financialProfiles: [
    { id: 'fp001', user_id: 'u001', monthly_income: 35000, monthly_expenses: 18000, net_income: 17000, employment_status: 'Permanent', employer_name: 'MTN South Africa', occupation: 'Network Engineer', existing_debt: 1200 },
    { id: 'fp002', user_id: 'u002', monthly_income: 22000, monthly_expenses: 14000, net_income: 8000, employment_status: 'Permanent', employer_name: 'Woolworths Holdings', occupation: 'Store Manager', existing_debt: 2100 },
    { id: 'fp003', user_id: 'u003', monthly_income: 58000, monthly_expenses: 32000, net_income: 26000, employment_status: 'Permanent', employer_name: 'Patel & Associates Law', occupation: 'Junior Associate', existing_debt: 2100 },
    { id: 'fp004', user_id: 'u004', monthly_income: 28000, monthly_expenses: 16000, net_income: 12000, employment_status: 'Permanent', employer_name: 'Absa Bank', occupation: 'Branch Consultant', existing_debt: 1400 },
    { id: 'fp005', user_id: 'u005', monthly_income: 18500, monthly_expenses: 12000, net_income: 6500, employment_status: 'Permanent', employer_name: 'Department of Health', occupation: 'Admin Clerk', existing_debt: 950 },
    { id: 'fp006', user_id: 'u006', monthly_income: 16000, monthly_expenses: 9000, net_income: 7000, employment_status: 'Permanent', employer_name: 'Shoprite Checkers', occupation: 'Cashier Supervisor', existing_debt: 0 },
    { id: 'fp007', user_id: 'u007', monthly_income: 72000, monthly_expenses: 40000, net_income: 32000, employment_status: 'Permanent', employer_name: 'City of Cape Town', occupation: 'Civil Engineer', existing_debt: 1650 },
    { id: 'fp008', user_id: 'u008', monthly_income: 12000, monthly_expenses: 11500, net_income: 500, employment_status: 'Part-time', employer_name: 'Pick n Pay', occupation: 'Sales Associate', existing_debt: 4200 },
  ],

  bankAccounts: [
    { id: 'ba001', user_id: 'u006', bank_name: 'FNB', account_number: '62123456789', account_type: 'Cheque', branch_code: '250655', verified: true },
    { id: 'ba002', user_id: 'u007', bank_name: 'Standard Bank', account_number: '05987654321', account_type: 'Savings', branch_code: '051001', verified: true },
    { id: 'ba003', user_id: 'u005', bank_name: 'Absa', account_number: '4098765432', account_type: 'Cheque', branch_code: '632005', verified: true },
    { id: 'ba004', user_id: 'u001', bank_name: 'Capitec', account_number: '1234567890', account_type: 'Savings', branch_code: '470010', verified: false },
  ],

  ledger: [
    { id: 'le001', transaction_date: d(85), description: 'Loan Disbursement — Nomsa Sithole', type: 'debit', amount: 20000, running_balance: -20000, reference: 'DIS-LN-2026-0031' },
    { id: 'le002', transaction_date: d(65), description: 'Repayment — Nomsa Sithole', type: 'credit', amount: 3100, running_balance: -16900, reference: 'REP-2026-0693' },
    { id: 'le003', transaction_date: d(115), description: 'Loan Disbursement — David Botha', type: 'debit', amount: 35000, running_balance: -51900, reference: 'DIS-LN-2026-0022' },
    { id: 'le004', transaction_date: d(96), description: 'Repayment — David Botha', type: 'credit', amount: 5425, running_balance: -46475, reference: 'REP-2026-0601' },
    { id: 'le005', transaction_date: d(36), description: 'Repayment — Nomsa Sithole', type: 'credit', amount: 3100, running_balance: -43375, reference: 'REP-2026-0743' },
    { id: 'le006', transaction_date: d(36), description: 'Repayment — David Botha', type: 'credit', amount: 5425, running_balance: -37950, reference: 'REP-2026-0741' },
    { id: 'le007', transaction_date: d(6), description: 'Repayment — Nomsa Sithole', type: 'credit', amount: 3100, running_balance: -34850, reference: 'REP-2026-0801' },
    { id: 'le008', transaction_date: d(6), description: 'Repayment — David Botha', type: 'credit', amount: 5425, running_balance: -29425, reference: 'REP-2026-0799' },
  ],

  creditRules: [
    { id: 'cr001', name: 'Minimum NLR Score', rule_type: 'credit_score', operator: 'gte', value: 580, action: 'APPROVE', active: true, created_at: d(180) },
    { id: 'cr002', name: 'Maximum Debt-to-Income Ratio', rule_type: 'dti_ratio', operator: 'lte', value: 45, action: 'APPROVE', active: true, created_at: d(180) },
    { id: 'cr003', name: 'Minimum Net Income', rule_type: 'net_income', operator: 'gte', value: 4000, action: 'APPROVE', active: true, created_at: d(180) },
    { id: 'cr004', name: 'Maximum Loan Amount', rule_type: 'loan_amount', operator: 'lte', value: 50000, action: 'APPROVE', active: true, created_at: d(180) },
    { id: 'cr005', name: 'No Active Judgements', rule_type: 'judgements', operator: 'eq', value: 0, action: 'DECLINE', active: true, created_at: d(180) },
    { id: 'cr006', name: 'No Adverse Listings (auto-decline)', rule_type: 'adverse_listings', operator: 'gte', value: 3, action: 'DECLINE', active: true, created_at: d(180) },
  ],

  complianceTasks: [
    { id: 'ct001', title: 'Q2 NCR Return Submission', description: 'Submit quarterly NCR return via the NCR portal by the 15th of the month.', status: 'PENDING', due_date: d(-3), priority: 'HIGH', created_at: d(30) },
    { id: 'ct002', title: 'SACRRA Monthly Data Submission', description: 'Upload SACRRA credit bureau data file for August.', status: 'IN_PROGRESS', due_date: d(-10), priority: 'HIGH', created_at: d(14) },
    { id: 'ct003', title: 'Annual POPIA Compliance Review', description: 'Internal review of data processing activities and privacy notices.', status: 'PENDING', due_date: d(-45), priority: 'MEDIUM', created_at: d(60) },
    { id: 'ct004', title: 'Staff AML Training', description: 'Ensure all staff complete FICA/AML refresher training.', status: 'COMPLETED', due_date: d(10), priority: 'MEDIUM', created_at: d(90) },
    { id: 'ct005', title: 'FIC Registration Renewal', description: 'Renew FIC accountable institution registration.', status: 'PENDING', due_date: d(-60), priority: 'LOW', created_at: d(90) },
  ],

  goAMLReports: [
    { id: 'gam001', report_type: 'STR', reference: 'STR-2026-0003', status: 'SUBMITTED', created_at: d(45), submitted_at: d(44) },
    { id: 'gam002', report_type: 'CTR', reference: 'CTR-2026-0011', status: 'SUBMITTED', created_at: d(22), submitted_at: d(21) },
    { id: 'gam003', report_type: 'STR', reference: 'STR-2026-0004', status: 'DRAFT', created_at: d(3) },
  ],
};

// ── State management ──────────────────────────────────────────────────────────

export function getDemoState(): DemoState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch { /* corrupted — reset */ }
  return JSON.parse(JSON.stringify(SEED));
}

export function setDemoState(state: DemoState) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export function updateDemoState(updater: (s: DemoState) => void) {
  const state = getDemoState();
  updater(state);
  setDemoState(state);
}

export function resetDemoState() {
  localStorage.removeItem(STORE_KEY);
}

// ── Demo mock functions (mirror adminData.ts signatures) ──────────────────────

function uid() {
  return `demo-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
}

export function demoDashboardData() {
  const { loans, payments, applications } = getDemoState();
  const totalCollected = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);
  const totalDisbursed = loans.reduce((s, l) => s + l.principal_amount, 0);
  const active = loans.filter(l => l.status === 'active').length;
  const pendingApps = applications.filter(a => !['DISBURSED', 'DECLINED'].includes(a.status)).length;
  const defaulted = loans.filter(l => l.status === 'default' || l.status === 'arrears').length;
  const repaid = loans.filter(l => l.status === 'repaid' || l.status === 'settled').length;

  return {
    totalDisbursed,
    totalCollected,
    profitMargin: totalDisbursed > 0 ? (((totalCollected - totalDisbursed) / totalDisbursed) * 100).toFixed(1) : '0.0',
    activeLoans: active,
    pendingApps,
    portfolio: [
      { name: 'Active', value: active },
      { name: 'Default', value: defaulted },
      { name: 'Repaid', value: repaid },
    ],
  };
}

export function demoPipelineApplications() {
  const { applications } = getDemoState();
  return applications
    .filter(a => !['DISBURSED', 'DECLINED'].includes(a.status))
    .map(a => ({ id: a.id, amount: a.amount, status: a.status, created_at: a.created_at, profiles: a.profiles }));
}

export function demoLoanApplications() {
  return getDemoState().applications;
}

export function demoApplicationDetail(id: string) {
  const { applications, profiles, financialProfiles, bankAccounts, creditChecks, loans } = getDemoState();
  const app = applications.find(a => a.id === id);
  if (!app) throw new Error('Application not found in demo');

  const profile = profiles.find(p => p.id === app.user_id) ?? null;
  const financial = financialProfiles.find(f => f.user_id === app.user_id) ?? null;
  const bank = bankAccounts.filter(b => b.user_id === app.user_id);
  const checks = creditChecks.filter(c => c.user_id === app.user_id).sort((a, b) => b.checked_at.localeCompare(a.checked_at));
  const userLoans = loans.filter(l => l.user_id === app.user_id);
  const payout = app.status === 'DISBURSED' ? { id: uid(), status: 'APPROVED', created_at: app.updated_at, approved_at: app.updated_at } : app.status === 'READY_TO_DISBURSE' ? { id: uid(), status: 'PENDING', created_at: app.updated_at } : null;

  const fullApp = { ...app, profiles: profile ? { ...profile } : app.profiles };
  return { application: fullApp, financial, documents: [], payout, bankAccounts: bank, creditChecks: checks, loans: userLoans };
}

export function demoUpdateApplicationStatus(id: string, status: string, notes?: string) {
  updateDemoState(s => {
    const app = s.applications.find(a => a.id === id);
    if (!app) return;
    app.status = status;
    app.updated_at = new Date().toISOString();
    if (notes !== undefined) app.notes = notes;

    // Auto-create a credit check when entering bureau checking
    if (status === 'BUREAU_CHECKING') {
      s.creditChecks = s.creditChecks.filter(c => c.user_id !== app.user_id || c.status !== 'RUNNING');
      s.creditChecks.unshift({ id: uid(), user_id: app.user_id, score: 0, status: 'RUNNING', checked_at: new Date().toISOString(), report_data: { bureau: 'TransUnion NLR', status: 'IN_PROGRESS', message: 'Credit bureau check submitted — response expected within 30 seconds' } });
    }
    // Simulate bureau response: BUREAU_OK creates a passing credit check
    if (status === 'BUREAU_OK') {
      const score = 620 + Math.floor(Math.random() * 180);
      const running = s.creditChecks.find(c => c.user_id === app.user_id && c.status === 'RUNNING');
      if (running) { running.status = 'PASS'; running.score = score; running.report_data = { bureau: 'TransUnion NLR', nlr_score: score, adverse_listings: 0, judgements: 0, defaults: 0, total_accounts: Math.floor(Math.random() * 4) + 2, active_accounts: Math.floor(Math.random() * 3) + 1, monthly_installments: Math.floor(Math.random() * 2000) + 800, recommendation: 'APPROVE', debt_to_income: Math.floor(Math.random() * 25) + 15 }; }
    }
    if (status === 'BUREAU_REFER') {
      const running = s.creditChecks.find(c => c.user_id === app.user_id && c.status === 'RUNNING');
      if (running) { running.status = 'REFER'; running.score = 540 + Math.floor(Math.random() * 80); running.report_data = { bureau: 'TransUnion NLR', nlr_score: running.score, adverse_listings: 1, judgements: 0, defaults: 0, recommendation: 'REFER' }; }
    }
    // When disbursed, create a loan and a mandate
    if (status === 'DISBURSED') {
      const alreadyHasLoan = s.loans.some(l => l.user_id === app.user_id && s.applications.find(a => a.id === id)?.status === 'DISBURSED');
      if (!alreadyHasLoan) {
        const loanId = uid();
        s.loans.push({ id: loanId, loan_number: `LN-${new Date().getFullYear()}-${String(s.loans.length + 1).padStart(4, '0')}`, user_id: app.user_id, principal_amount: app.amount, interest_rate: app.offer_interest_rate ?? 24, term_months: app.offer_term_months ?? 12, status: 'active', outstanding_balance: app.amount, created_at: new Date().toISOString(), profiles: app.profiles });
        // Create a mandate
        if (!s.mandates.some(m => m.application_id === app.id)) {
          s.mandates.push({ id: uid(), user_id: app.user_id, application_id: app.id, status: 'PENDING_AUTH', mandate_reference: `DCM-${new Date().getFullYear()}-${String(s.mandates.length + 1).padStart(4, '0')}`, amount: app.offer_monthly_repayment ?? 0, collection_day: 1, created_at: new Date().toISOString(), profiles: app.profiles, loan_applications: { amount: app.amount } });
        }
        // Add a ledger entry
        s.ledger.unshift({ id: uid(), transaction_date: new Date().toISOString(), description: `Loan Disbursement — ${app.profiles.full_name}`, type: 'debit', amount: app.amount, running_balance: -(s.ledger.length > 0 ? Math.abs(s.ledger[0].running_balance) + app.amount : app.amount), reference: `DIS-${loanId.slice(0, 8).toUpperCase()}` });
      }
    }
  });
  return { data: null, error: null };
}

export function demoApprovePayout(payoutId: string) {
  updateDemoState(s => {
    const p = s.payouts.find(p => p.id === payoutId);
    if (p) { p.status = 'APPROVED'; p.approved_at = new Date().toISOString(); }
  });
  return { data: null, error: null };
}

export function demoUsers() {
  return getDemoState().profiles.map(p => ({ ...p, branches: null }));
}

export function demoIncomingPayments() {
  return getDemoState().payments.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoConfirmPayment(id: string) {
  updateDemoState(s => {
    const p = s.payments.find(p => p.id === id);
    if (p) { p.status = 'confirmed'; p.confirmed_at = new Date().toISOString(); }
  });
  return { data: null, error: null };
}

export function demoRejectPayment(id: string) {
  updateDemoState(s => {
    const p = s.payments.find(p => p.id === id);
    if (p) { p.status = 'rejected'; }
  });
  return { data: null, error: null };
}

export function demoPayouts() {
  return getDemoState().payouts.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoMandates() {
  return getDemoState().mandates.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoLoans() {
  return getDemoState().loans;
}

export function demoCashLedger() {
  return getDemoState().ledger.slice().sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
}

export function demoCreditRules() {
  return getDemoState().creditRules;
}

export function demoUpsertCreditRule(rule: Record<string, unknown>) {
  updateDemoState(s => {
    const id = rule.id as string | undefined;
    if (id) {
      const i = s.creditRules.findIndex(r => r.id === id);
      if (i >= 0) s.creditRules[i] = { ...s.creditRules[i], ...rule } as DemoCreditRule;
    } else {
      s.creditRules.push({ ...rule, id: uid(), created_at: new Date().toISOString() } as DemoCreditRule);
    }
  });
  return { data: null, error: null };
}

export function demoDeleteCreditRule(id: string) {
  updateDemoState(s => { s.creditRules = s.creditRules.filter(r => r.id !== id); });
  return { error: null };
}

export function demoPortfolioAnalytics() {
  const { loans, applications, payments } = getDemoState();
  return {
    loans: loans.map(l => ({ principal_amount: l.principal_amount, status: l.status, created_at: l.created_at, interest_rate: l.interest_rate })),
    applications: applications.map(a => ({ amount: a.amount, status: a.status, created_at: a.created_at })),
    payments: payments.map(p => ({ amount: p.amount, created_at: p.created_at, status: p.status })),
  };
}

export function demoMonthlyLoanPerformance() {
  const { loans, payments } = getDemoState();
  const byMonth: Record<string, { month_year: string; disbursed_amount: number; repaid_amount: number }> = {};
  loans.forEach(l => { const m = l.created_at.slice(0, 7); if (!byMonth[m]) byMonth[m] = { month_year: m, disbursed_amount: 0, repaid_amount: 0 }; byMonth[m].disbursed_amount += l.principal_amount; });
  payments.filter(p => p.status === 'confirmed').forEach(p => { const m = p.created_at.slice(0, 7); if (!byMonth[m]) byMonth[m] = { month_year: m, disbursed_amount: 0, repaid_amount: 0 }; byMonth[m].repaid_amount += p.amount; });
  return { data: Object.values(byMonth).sort((a, b) => a.month_year.localeCompare(b.month_year)) };
}

export function demoFinancialTrends() {
  const { loans } = getDemoState();
  const byMonth: Record<string, { month: string; total_principal: number; projected_interest: number; active_loans: number }> = {};
  loans.forEach(l => { const m = l.created_at.slice(0, 7); if (!byMonth[m]) byMonth[m] = { month: m, total_principal: 0, projected_interest: 0, active_loans: 0 }; byMonth[m].total_principal += l.principal_amount; byMonth[m].projected_interest += l.principal_amount * l.interest_rate * 0.01; if (l.status === 'active') byMonth[m].active_loans++; });
  return { data: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)) };
}

export function demoRevenueAnalytics() {
  const { loans, payments } = getDemoState();
  const paidByUser: Record<string, number> = {};
  payments.filter(p => p.status === 'confirmed').forEach(p => { paidByUser[p.user_id] = (paidByUser[p.user_id] || 0) + p.amount; });
  return {
    data: loans.map(l => {
      const principal = l.principal_amount;
      const paid = paidByUser[l.user_id] || 0;
      const monthsActive = Math.max(1, Math.round((Date.now() - new Date(l.created_at).getTime()) / (30 * 86400000)));
      return { loan_id: l.loan_number, customer: l.profiles?.full_name ?? 'Unknown', month: l.created_at.slice(0, 7), principal, interest: Math.round(principal * l.interest_rate * 0.01 * (monthsActive / 12)), fees: 0, arrears: l.status === 'default' ? Math.max(0, principal - paid) : 0, status: l.status, created_at: l.created_at, user_id: l.user_id };
    }),
  };
}

export function demoAdvancedAnalytics() {
  const { loans, creditChecks, payments } = getDemoState();
  const latestScore: Record<string, number> = {};
  creditChecks.forEach(c => { if (!latestScore[c.user_id] && c.score > 0) latestScore[c.user_id] = c.score; });
  const repaidByUser: Record<string, number> = {};
  payments.filter(p => p.status === 'confirmed').forEach(p => { repaidByUser[p.user_id] = (repaidByUser[p.user_id] || 0) + p.amount; });

  const risk_matrix = loans.filter(l => latestScore[l.user_id] > 0).map(l => { const principal = l.principal_amount; const repaid = repaidByUser[l.user_id] || 0; const dti = principal > 0 ? Math.min(100, Math.round((repaid / principal) * 100)) : 0; return { credit_score: latestScore[l.user_id] || 0, principal_amount: principal, dti_ratio: dti, status: l.status }; });

  const monthMap: Record<string, { cohort: string; disbursed: number; repaid: number }> = {};
  loans.forEach(l => { const m = l.created_at.slice(0, 7); if (!monthMap[m]) monthMap[m] = { cohort: m, disbursed: 0, repaid: 0 }; monthMap[m].disbursed += l.principal_amount; });
  payments.filter(p => p.status === 'confirmed').forEach(p => { const m = p.created_at.slice(0, 7); if (monthMap[m]) monthMap[m].repaid += p.amount; });

  const vintage = Object.values(monthMap).map(v => ({ cohort: v.cohort, recovery_rate: v.disbursed > 0 ? Math.round((v.repaid / v.disbursed) * 100) : 0 })).sort((a, b) => a.cohort.localeCompare(b.cohort));
  return { data: { risk_matrix, vintage } };
}

export function demoSacrraMembers() {
  const { loans, profiles } = getDemoState();
  return loans.map(l => {
    const p = profiles.find(pr => pr.id === l.user_id);
    return { loan_id: l.id, loan_number: l.loan_number, full_name: p?.full_name, identity_number: p?.identity_number, principal_amount: l.principal_amount, outstanding_balance: l.outstanding_balance, status: l.status, created_at: l.created_at, address_line_1: p?.address_line_1, employer_name: p?.employer_name, occupation: p?.occupation };
  });
}

export function demoSacrraSubmissions() {
  return [
    { id: 1, submission_date: d(10), period: '2026-07', record_count: 2, status: 'ACCEPTED', file_reference: 'SACRRA-2026-07-001' },
    { id: 2, submission_date: d(40), period: '2026-06', record_count: 1, status: 'ACCEPTED', file_reference: 'SACRRA-2026-06-001' },
    { id: 3, submission_date: d(70), period: '2026-05', record_count: 1, status: 'ACCEPTED', file_reference: 'SACRRA-2026-05-001' },
  ];
}

export function demoUpdateUserRole(userId: string, role: string) {
  updateDemoState(s => {
    const p = s.profiles.find(pr => pr.id === userId);
    if (p) p.role = role;
  });
  return { data: null, error: null };
}

export function demoUpdateSacrraProfile(loanId: string, fields: Record<string, unknown>) {
  updateDemoState(s => {
    const loan = s.loans.find(l => l.id === loanId);
    if (!loan) return;
    const profile = s.profiles.find(p => p.id === loan.user_id);
    if (profile) Object.assign(profile, fields);
  });
}

const SACRRA_REJECTIONS = [
  { id: 1, loan_id: 'loan001', full_name: 'Nomsa Sithole', identity_number: '8607014567083', reason: 'Employer address missing from profile', created_at: d(8), resolved: false, resolved_at: null as string | null },
  { id: 2, loan_id: 'loan002', full_name: 'David Botha', identity_number: '7912225034080', reason: 'Occupation field blank — required for NCA submission', created_at: d(3), resolved: false, resolved_at: null as string | null },
];

export function demoSacrraRejections() {
  return SACRRA_REJECTIONS.filter(r => !r.resolved);
}

export function demoResolveSacrraRejection(id: number) {
  const r = SACRRA_REJECTIONS.find(r => r.id === id);
  if (r) { r.resolved = true; r.resolved_at = new Date().toISOString(); }
}

export function demoNcrReports() {
  return [
    { id: 1, period: '2026-Q2', submitted_at: d(42), status: 'ACCEPTED', records: 3, reference: 'NCR-2026-Q2-001', created_at: d(44) },
    { id: 2, period: '2026-Q1', submitted_at: d(132), status: 'ACCEPTED', records: 1, reference: 'NCR-2026-Q1-001', created_at: d(134) },
  ];
}

export function demoNcrRegisters() {
  const { loans, profiles } = getDemoState();
  return loans.map(l => {
    const p = profiles.find(pr => pr.id === l.user_id);
    return { ...l, profiles: p ? { full_name: p.full_name, identity_number: p.identity_number, email: p.email } : null };
  });
}

export function demoComplianceTasks() {
  return getDemoState().complianceTasks.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function demoUpsertComplianceTask(task: Record<string, unknown>) {
  updateDemoState(s => {
    const id = task.id as string | undefined;
    if (id) {
      const i = s.complianceTasks.findIndex(t => t.id === id);
      if (i >= 0) s.complianceTasks[i] = { ...s.complianceTasks[i], ...task } as DemoComplianceTask;
    } else {
      s.complianceTasks.push({ ...task, id: uid(), created_at: new Date().toISOString() } as DemoComplianceTask);
    }
  });
  return { data: null, error: null };
}

export function demoGoAMLReports() {
  return getDemoState().goAMLReports.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoCreateGoAMLReport(report: Record<string, unknown>) {
  updateDemoState(s => {
    s.goAMLReports.unshift({ ...report, id: uid(), created_at: new Date().toISOString() } as DemoGoAMLReport);
  });
  return { data: null, error: null };
}

export function demoSearchClients(query: string) {
  const { profiles } = getDemoState();
  const q = query.toLowerCase();
  return profiles.filter(p => p.full_name.toLowerCase().includes(q) || p.identity_number.includes(q)).slice(0, 8).map(p => ({ id: p.id, full_name: p.full_name, identity_number: p.identity_number, email: p.email, cell_tel_no: p.cell_tel_no }));
}

export function demoCreateApplication(payload: Record<string, unknown>) {
  const profile = getDemoState().profiles.find(p => p.id === payload.user_id) ?? null;
  const newApp: DemoApplication = {
    id: uid(),
    loan_number: `AL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    amount: Number(payload.amount) || 5000,
    status: 'STARTED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: String(payload.user_id || uid()),
    notes: String(payload.notes || ''),
    offer_monthly_repayment: Number(payload.offer_monthly_repayment) || undefined,
    offer_total_repayment: Number(payload.offer_total_repayment) || undefined,
    offer_term_months: Number(payload.offer_term_months) || 12,
    offer_interest_rate: Number(payload.offer_interest_rate) || 24,
    profiles: { full_name: profile?.full_name ?? String(payload.full_name ?? 'New Client'), identity_number: profile?.identity_number ?? String(payload.identity_number ?? '') },
  };
  updateDemoState(s => { s.applications.unshift(newApp); });
  return { data: newApp, error: null };
}

export function demoAuditTrail(applicationId: string) {
  const { applications } = getDemoState();
  const app = applications.find(a => a.id === applicationId);
  if (!app) return [];

  const events: { id: string; action: string; created_at: string; created_by: string; details: string }[] = [
    { id: uid(), action: 'APPLICATION_CREATED', created_at: app.created_at, created_by: 'Admin (Demo)', details: `Application ${app.loan_number} created for ${app.profiles.full_name}` },
  ];
  if (app.status !== 'STARTED') events.push({ id: uid(), action: 'STATUS_CHANGED', created_at: app.updated_at, created_by: 'Admin (Demo)', details: `Status updated to ${app.status}` });
  return events.reverse();
}

export function demoCashLedgerCreate(entry: Record<string, unknown>) {
  updateDemoState(s => { s.ledger.unshift({ ...entry, id: uid(), transaction_date: entry.transaction_date as string ?? new Date().toISOString() } as DemoLedgerEntry); });
  return { data: null, error: null };
}

export function demoSystemSettings() {
  return {
    company_name: 'AlgoLend Demo',
    company_logo_url: '',
    primary_color: '#7C3AED',
    interest_rate_default: 24,
    max_loan_amount: 50000,
    min_loan_amount: 1000,
    loan_term_options: [6, 12, 18, 24],
  };
}

export function demoArrearsAccounts() {
  return [
    { id: 'arr001', appId: 'app006', loanNumber: 'LN-2026-0031', clientName: 'Nomsa Sithole', loanAmount: 20000, outstanding: 17500, arrears: 3100, dpd: 45, stage: 'COLLECTIONS', lastPaymentDate: '2026-07-28', nextAction: 'Issue demand letter — 7 day notice', phone: '0765432109', email: 'nomsa.sithole@webmail.co.za' },
    { id: 'arr002', appId: 'app007', loanNumber: 'LN-2026-0022', clientName: 'David Botha', loanAmount: 35000, outstanding: 28000, arrears: 6200, dpd: 92, stage: 'LEGAL', lastPaymentDate: '2026-07-01', nextAction: 'Section 129 notice sent — await response', phone: '0845678901', email: 'david.botha@telkomsa.net' },
    { id: 'arr003', appId: 'app003', loanNumber: 'LN-2026-0039', clientName: 'Lerato Mokoena', loanAmount: 8000, outstanding: 6800, arrears: 850, dpd: 12, stage: 'REMINDER', lastPaymentDate: '2026-08-08', nextAction: 'Send second payment reminder SMS', phone: '0712345678', email: 'lerato.mokoena@outlook.com' },
    { id: 'arr004', appId: 'app004', loanNumber: 'LN-2026-0041', clientName: 'Sipho Mthembu', loanAmount: 15000, outstanding: 11200, arrears: 2800, dpd: 68, stage: 'COLLECTIONS', lastPaymentDate: '2026-07-20', nextAction: 'Demand letter — 7 day final notice', phone: '0823456789', email: 'sipho.mthembu@yahoo.com' },
    { id: 'arr005', appId: 'app002', loanNumber: 'LN-2026-0040', clientName: 'Grace Molefe', loanAmount: 5000, outstanding: 4200, arrears: 400, dpd: 7, stage: 'REMINDER', lastPaymentDate: null, nextAction: 'First payment overdue — send reminder', phone: '0791234567', email: 'grace.molefe@mweb.co.za' },
    { id: 'arr006', appId: 'app001', loanNumber: 'LN-2026-0038', clientName: 'Ahmed Patel', loanAmount: 50000, outstanding: 42000, arrears: 12500, dpd: 145, stage: 'WRITE_OFF', lastPaymentDate: '2026-05-15', nextAction: 'Recommended for write-off — NCO process initiated', phone: '0834567890', email: 'ahmed.patel@gmail.com' },
  ];
}
