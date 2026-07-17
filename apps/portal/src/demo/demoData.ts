// Demo mode — activated by localStorage.setItem('algolend_demo','1')

export const isDemoMode = () => localStorage.getItem('algolend_demo') === '1';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const DEMO_DASHBOARD = {
  userName: 'Thabo Mokoena',
  loans: [
    {
      id: 'demo-loan-1',
      displayId: 'AL-2024-001',
      amount: 'R 45,000.00',
      remaining: 'R 32,750.00',
      nextPayment: 'R 4,287.50',
      dueDate: '2026-08-12',
      interestRate: '28.50%',
      progress: 27,
      daysUntilDue: 8,
    },
  ],
  transactions: [
    { id: 'tx-1', description: 'Loan Disbursement',   date: '1 Feb 2026', amount: '+R 45,000.00' },
    { id: 'tx-2', description: 'Monthly Instalment',  date: '1 Mar 2026', amount: '-R 4,287.50' },
    { id: 'tx-3', description: 'Monthly Instalment',  date: '1 Apr 2026', amount: '-R 4,287.50' },
    { id: 'tx-4', description: 'Monthly Instalment',  date: '1 May 2026', amount: '-R 4,287.50' },
  ],
  applications: [
    { rawId: 'app-1', type: 'Personal Loan', amount: 'R 45,000.00', date: '15 Jan 2026', status: 'ACTIVE' },
  ],
  totalBorrowed: 45000,
  currentBalance: 32750,
  totalRepaid: 12250,
  nextPayment: { amount: 4287.5, date: '2026-08-12' },
  creditScore: 742,
  unsignedOffer: null,
  repaymentSeries: [
    { label: 'Feb', total: 4287.5 },
    { label: 'Mar', total: 4287.5 },
    { label: 'Apr', total: 4287.5 },
    { label: 'May', total: 4287.5 },
    { label: 'Jun', total: 4287.5 },
    { label: 'Jul', total: 4287.5 },
  ],
  eligibility: {
    eligible: true,
    credit_score: 742,
    band: {
      label: 'Low Risk',
      color: '#22C55E',
      max_loan_amount: 80000,
      interest_rate_pa: 28.5,
      max_term_months: 24,
    },
    first_loan_restriction: undefined,
  },
};

// ── Transactions ──────────────────────────────────────────────────────────────

export const DEMO_PAYMENTS = {
  payments: [
    { id: 'p1', loanId: 'demo-loan-1', applicationId: null, amount: 4287.5,  date: '2026-07-01', status: 'completed', method: 'DebiCheck' },
    { id: 'p2', loanId: 'demo-loan-1', applicationId: null, amount: 4287.5,  date: '2026-06-01', status: 'completed', method: 'DebiCheck' },
    { id: 'p3', loanId: 'demo-loan-1', applicationId: null, amount: 4287.5,  date: '2026-05-01', status: 'completed', method: 'DebiCheck' },
    { id: 'p4', loanId: 'demo-loan-1', applicationId: null, amount: 4287.5,  date: '2026-04-01', status: 'completed', method: 'DebiCheck' },
    { id: 'p5', loanId: 'demo-loan-1', applicationId: null, amount: 4287.5,  date: '2026-03-01', status: 'completed', method: 'DebiCheck' },
  ],
  accounts: [
    { id: 'acc-1', bankName: 'Capitec Bank', accountNumber: '****3421', accountType: 'Savings', isPrimary: true },
  ],
  loans: [
    {
      id: 'demo-loan-1',
      applicationId: 'app-1',
      principal: 45000,
      outstanding: 32750,
      monthlyPayment: 4287.5,
      nextDueAmount: 4287.5,
      dueDateObj: new Date('2026-08-12'),
    },
  ],
  userName: 'Thabo Mokoena',
  userId: 'demo-user-id',
};

// ── Transcripts / Credit ──────────────────────────────────────────────────────

export const DEMO_TRANSCRIPTS = {
  checks: [
    {
      id: 'cc-1',
      user_id: 'demo-user-id',
      credit_score: 742,
      risk_category: 'low risk',
      status: 'completed',
      application_id: 'app-1',
      checked_at: '2026-01-15T10:30:00Z',
      total_accounts: 4,
      open_accounts: 3,
      closed_accounts: 1,
      accounts_with_arrears: 0,
      total_balance: 148500,
      total_monthly_payment: 8750,
      total_arrears_amount: 0,
      total_enquiries: 5,
      total_judgments: 0,
      total_judgment_amount: 0,
    },
  ],
  docMap: {} as Record<string, { id: string; file_name: string; file_type: string; file_path: string; uploaded_at: string }>,
  userId: 'demo-user-id',
};

// ── Profile ───────────────────────────────────────────────────────────────────

export const DEMO_PROFILE = {
  profile: {
    id: 'demo-user-id',
    email: 'thabo.mokoena@gmail.com',
    first_name: 'Thabo',
    last_name: 'Mokoena',
    full_name: 'Thabo Mokoena',
    contact_number: '071 234 5678',
    identity_number: '9203154800085',
    gender: 'Male',
    date_of_birth: '1992-03-15',
    address: '14 Soweto Highway, Meadowlands',
    postal_code: '1852',
    suburb_area: 'Meadowlands',
    cell_tel_no: '071 234 5678',
    avatar_url: null,
    role: 'borrower',
    created_at: '2026-01-10T08:00:00Z',
  },
  financial: {
    monthly_income: 18500,
    monthly_expenses: 9200,
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
    parsed_data: {
      income:   { salary: 18500, other_monthly_earnings: 0 },
      expenses: { housing_rent: 3500, school: 800, maintenance: 500, petrol: 1200, groceries: 2400, other: 800 },
    },
  },
  declarations: {
    historically_disadvantaged: true,
    accepted_std_conditions: true,
    home_ownership: 'Renting',
    marital_status: 'Single',
    highest_qualification: "Bachelor's Degree",
    referral_provided: false,
  },
};
