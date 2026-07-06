/**
 * AlgoLend Demo Seed
 * Populates every admin + user-portal page with realistic fake data.
 * Run: node seed_demo.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yakhrwrfmdrnhfgzfiwm.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY is not set'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const dateOnly = iso => iso.slice(0, 10);

async function upsert(table, rows, conflictColumn = null) {
  const opts = conflictColumn ? { onConflict: conflictColumn, ignoreDuplicates: false } : {};
  const { error } = await sb.from(table).upsert(rows, opts);
  if (error) console.warn(`  ⚠  ${table}:`, error.message);
  else console.log(`  ✓  ${table} (${rows.length} row${rows.length !== 1 ? 's' : ''})`);
}

async function insert(table, rows) {
  const { error } = await sb.from(table).insert(rows);
  if (error) console.warn(`  ⚠  ${table}:`, error.message);
  else console.log(`  ✓  ${table} (${rows.length} row${rows.length !== 1 ? 's' : ''})`);
}

// ─── 1. System settings ───────────────────────────────────────────────────────
async function seedSettings() {
  console.log('\n📐 System settings');
  await upsert('system_settings', [{
    id: 'global',
    company_name: 'AlgoLend',
    primary_color: '#B026FF',
    secondary_color: '#4A0E8F',
    tertiary_color: '#11022A',
    theme_mode: 'dark',
    auth_overlay_color: '#1E0B3B',
    auth_overlay_enabled: true,
    auth_background_flip: false,
    ncr_number: 'NCRCP13510',
    company_reg_number: '2023/123456/07',
    company_vat_number: '4012345678',
    company_phone: '0691195046',
    carousel_slides: [
      { title: 'Branded Client Application Portal', text: 'Real-Time Affordability Intelligence · Corporate Document Upload · E-Contracts' },
      { title: 'Back-End Risk & Compliance Engine', text: 'CIPC checks · AML screening · Director credit scoring · Biometric liveness' },
      { title: 'Robust Operational Backbone', text: 'Mandate Control Room · Risk-Based Pricing · Full Audit Trail' }
    ]
  }], 'id');
}

// ─── 2. Branches ──────────────────────────────────────────────────────────────
async function seedBranches() {
  console.log('\n🏢 Branches');
  // Check existing branches first — auto-generated id, so avoid inserting duplicates
  const { data: existing } = await sb.from('branches').select('name');
  const existingNames = new Set((existing || []).map(b => b.name));
  const toInsert = [
    { name: 'Johannesburg CBD', region: 'Gauteng', is_active: true },
    { name: 'Sandton', region: 'Gauteng', is_active: true },
    { name: 'Cape Town', region: 'Western Cape', is_active: true },
    { name: 'Durban', region: 'KwaZulu-Natal', is_active: true },
  ].filter(b => !existingNames.has(b.name));
  if (toInsert.length) {
    const { error } = await sb.from('branches').insert(toInsert);
    if (error) console.warn('  ⚠  branches:', error.message);
    else console.log(`  ✓  branches (${toInsert.length} rows inserted)`);
  } else {
    console.log('  ✓  branches (already seeded)');
  }
}

// ─── 3. Auth users + profiles ─────────────────────────────────────────────────
const BORROWERS = [
  { email: 'thabo.nkosi@demo.algolend.co.za',    password: 'Demo@1234!', full_name: 'Thabo Nkosi',       id_number: '9203155178082', cell: '0821234567', dob: '1992-03-15', gender: 'Male',   branch: 1 },
  { email: 'zanele.dlamini@demo.algolend.co.za',  password: 'Demo@1234!', full_name: 'Zanele Dlamini',    id_number: '8807280678083', cell: '0837654321', dob: '1988-07-28', gender: 'Female', branch: 2 },
  { email: 'sipho.mokoena@demo.algolend.co.za',   password: 'Demo@1234!', full_name: 'Sipho Mokoena',     id_number: '9510105218082', cell: '0712345678', dob: '1995-10-10', gender: 'Male',   branch: 1 },
  { email: 'nomvula.khumalo@demo.algolend.co.za', password: 'Demo@1234!', full_name: 'Nomvula Khumalo',   id_number: '8601145058085', cell: '0609876543', dob: '1986-01-14', gender: 'Female', branch: 3 },
  { email: 'lerato.sithole@demo.algolend.co.za',  password: 'Demo@1234!', full_name: 'Lerato Sithole',    id_number: '9412175118088', cell: '0831122334', dob: '1994-12-17', gender: 'Female', branch: 2 },
  { email: 'bongani.ntuli@demo.algolend.co.za',   password: 'Demo@1234!', full_name: 'Bongani Ntuli',     id_number: '9007085218085', cell: '0765544332', dob: '1990-07-08', gender: 'Male',   branch: 4 },
  { email: 'ayanda.mthembu@demo.algolend.co.za',  password: 'Demo@1234!', full_name: 'Ayanda Mthembu',   id_number: '9605145018088', cell: '0841231234', dob: '1996-05-14', gender: 'Female', branch: 3 },
  { email: 'lungelo.zulu@demo.algolend.co.za',    password: 'Demo@1234!', full_name: 'Lungelo Zulu',      id_number: '8804105018083', cell: '0759991234', dob: '1988-04-10', gender: 'Male',   branch: 4 },
];

// Admin user
const ADMIN = {
  email: 'admin@demo.algolend.co.za',
  password: 'Admin@1234!',
  full_name: 'Demo Admin',
  role: 'base_admin',
};

async function createOrGetUser(email, password, metadata = {}) {
  // Try get existing
  const { data: existing } = await sb.auth.admin.listUsers({ filter: `email=${email}` }).catch(() => ({ data: null }));
  if (existing?.users?.length) return existing.users[0].id;

  const { data, error } = await sb.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) {
    if (error.message?.includes('already')) {
      // fetch by listing all users and filtering
      const { data: all } = await sb.auth.admin.listUsers({ perPage: 200 });
      const found = all?.users?.find(u => u.email === email);
      return found?.id || null;
    }
    console.warn(`  ⚠  auth.createUser ${email}:`, error.message);
    return null;
  }
  return data.user.id;
}

async function seedUsers() {
  console.log('\n👤 Auth users + profiles');

  // Admin
  const adminId = await createOrGetUser(ADMIN.email, ADMIN.password, { full_name: ADMIN.full_name });
  if (adminId) {
    await upsert('profiles', [{
      id: adminId, email: ADMIN.email, full_name: ADMIN.full_name,
      role: 'base_admin', branch_id: 1,
      created_at: daysAgo(120), updated_at: daysAgo(5),
    }], 'id');
  }

  const ADDRESSES = [
    { address: '14 Eloff Street', suburb: 'Johannesburg Central', postal: '2001' },
    { address: '32 Rivonia Road', suburb: 'Sandton', postal: '2196' },
    { address: '7 Long Street', suburb: 'Cape Town City Bowl', postal: '8001' },
    { address: '19 Smith Street', suburb: 'Durban Central', postal: '4001' },
    { address: '88 Commissioner St', suburb: 'Johannesburg Central', postal: '2001' },
    { address: '6 Umhlanga Rocks Dr', suburb: 'Umhlanga', postal: '4319' },
    { address: '24 Kloof Street', suburb: 'Gardens', postal: '8001' },
    { address: '11 Florida Road', suburb: 'Morningside', postal: '4001' },
  ];

  const userIds = [];
  for (let i = 0; i < BORROWERS.length; i++) {
    const b = BORROWERS[i];
    const uid = await createOrGetUser(b.email, b.password, { full_name: b.full_name });
    if (!uid) continue;
    userIds.push(uid);
    const addr = ADDRESSES[i];
    await upsert('profiles', [{
      id: uid, email: b.email, full_name: b.full_name, role: 'borrower',
      identity_number: b.id_number, cell_tel_no: b.cell,
      date_of_birth: b.dob, gender: b.gender,
      address: addr.address, suburb_area: addr.suburb, postal_code: addr.postal,
      branch_id: b.branch,
      employer_name: pick(['Shoprite Holdings', 'Standard Bank', 'Sasol Ltd', 'Pick n Pay', 'Vodacom', 'MTN Group', 'Old Mutual', 'Discovery Ltd']),
      employer_phone: '011' + rand(100, 999) + rand(1000, 9999),
      nok_name: 'Family Member',
      nok_phone: '082' + rand(1000000, 9999999),
      nok_relationship: pick(['Spouse', 'Parent', 'Sibling']),
      last_active_at: daysAgo(rand(0, 7)),
      created_at: daysAgo(rand(30, 120)), updated_at: daysAgo(rand(0, 14)),
    }], 'id');
  }
  return { adminId, userIds };
}

// ─── 4. Bank accounts ─────────────────────────────────────────────────────────
async function seedBankAccounts(userIds) {
  console.log('\n🏦 Bank accounts');
  const banks = ['Standard Bank', 'FNB', 'ABSA', 'Nedbank', 'Capitec'];
  const types = ['Cheque', 'Savings', 'Current'];
  const codes  = { 'Standard Bank': '051001', FNB: '250655', ABSA: '632005', Nedbank: '198765', Capitec: '470010' };

  const accounts = userIds.map((uid, i) => {
    const bank = banks[i % banks.length];
    return {
      user_id: uid,
      bank_name: bank,
      account_holder: BORROWERS[i]?.full_name || 'Account Holder',
      account_number: String(rand(10000000, 99999999)),
      account_type: types[i % types.length],
      branch_code: codes[bank],
      created_at: daysAgo(rand(30, 90)),
    };
  });
  await insert('bank_accounts', accounts);

  // return fresh list so we get the IDs
  const { data } = await sb.from('bank_accounts').select('id, user_id').in('user_id', userIds);
  return data || [];
}

// ─── 5. Financial profiles + declarations ─────────────────────────────────────
async function seedFinancialData(userIds) {
  console.log('\n💰 Financial profiles + declarations');

  const fps = userIds.map((uid) => {
    const salary   = rand(18000, 65000);
    const other    = rand(0, 5000);
    const income   = salary + other;
    const expenses = rand(8000, Math.floor(income * 0.6));
    return {
      user_id: uid,
      monthly_income:    income,
      monthly_expenses:  expenses,
      disposable_income: income - expenses,
      debt_to_income_ratio: ((expenses / income) * 100).toFixed(2),
      affordability_ratio: (income * 0.20).toFixed(2),
      max_loan_amount: (income * 0.20 / (0.20 / 12)).toFixed(2),
      parsed_data: {
        income: { salary, other_monthly_earnings: other },
        expenses: {
          housing_rent: rand(3000, 12000),
          food_groceries: rand(1500, 4000),
          transport: rand(500, 3000),
          utilities: rand(500, 2000),
          insurance: rand(500, 2500),
          other: rand(0, 2000),
        }
      },
      created_at: daysAgo(rand(15, 90)),
    };
  });
  // Insert (ignore duplicates on user_id via delete-then-insert pattern)
  for (const fp of fps) {
    await sb.from('financial_profiles').delete().eq('user_id', fp.user_id);
    await sb.from('financial_profiles').insert([fp]);
  }
  console.log(`  ✓  financial_profiles (${fps.length} rows)`);

  const decls = userIds.map(uid => ({
    user_id: uid,
    accepted_std_conditions: true,
    credit_check_consent_accepted: true,
    credit_check_consent_accepted_at: daysAgo(rand(5, 90)),
    historically_disadvantaged: pick([true, false]),
    home_ownership: pick(['Renting', 'Own', 'Bond', 'Family']),
    marital_status: pick(['Single', 'Married', 'Divorced']),
    highest_qualification: pick(['Matric', 'Diploma', 'Degree', 'Postgraduate']),
    updated_at: daysAgo(rand(0, 5)),
  }));
  for (const d of decls) {
    await sb.from('declarations').delete().eq('user_id', d.user_id);
    await sb.from('declarations').insert([d]);
  }
  console.log(`  ✓  declarations (${decls.length} rows)`);
}

// ─── 6. Loan applications ─────────────────────────────────────────────────────
const STATUSES = ['APPROVED', 'DISBURSED', 'ACTIVE', 'BUREAU_CHECKING', 'PENDING_DOCUMENTS', 'DECLINED', 'IN_ARREARS', 'SETTLED'];
const PURPOSES = ['Working Capital', 'Equipment Financing', 'Inventory Purchase', 'Business Expansion', 'Cash Flow', 'Vehicle Finance', 'Property Deposit', 'Bridging Finance'];
const BANDS = [
  { label: 'Excellent', color: '#10b981', decision: 'APPROVE', max: 20000, rate: 18 },
  { label: 'Good',      color: '#3b82f6', decision: 'APPROVE', max: 15000, rate: 22 },
  { label: 'Fair',      color: '#f59e0b', decision: 'REVIEW',  max: 8000,  rate: 27.5 },
];

async function seedApplications(userIds, bankAccounts) {
  console.log('\n📋 Loan applications + loans + payouts + payments');

  // Get current max loan number
  const { data: maxRow } = await sb.from('loan_applications').select('loan_number').order('loan_number', { ascending: false }).limit(1).maybeSingle();
  let nextLoanNum = (maxRow?.loan_number || 999) + 1;

  const apps = [];
  // One application per user, plus extra varied ones for the first 3 users
  const appDefs = [
    { userIdx: 0, status: 'ACTIVE',            daysBack: 45 },
    { userIdx: 1, status: 'DISBURSED',          daysBack: 10 },
    { userIdx: 2, status: 'APPROVED',           daysBack: 5  },
    { userIdx: 3, status: 'BUREAU_CHECKING',    daysBack: 2  },
    { userIdx: 4, status: 'IN_ARREARS',         daysBack: 90 },
    { userIdx: 5, status: 'PENDING_DOCUMENTS',  daysBack: 7  },
    { userIdx: 6, status: 'DECLINED',           daysBack: 20 },
    { userIdx: 7, status: 'SETTLED',            daysBack: 180},
    // Extra applications for admin list variety
    { userIdx: 0, status: 'SETTLED',            daysBack: 200 },
    { userIdx: 1, status: 'ACTIVE',             daysBack: 120 },
    { userIdx: 2, status: 'IN_ARREARS',         daysBack: 60  },
    { userIdx: 4, status: 'APPROVED',           daysBack: 3   },
  ];

  for (const def of appDefs) {
    if (!userIds[def.userIdx]) continue;
    const uid  = userIds[def.userIdx];
    const band = pick(BANDS);
    const amount  = rand(3000, 20000);
    const term    = pick([1, 3, 6, 12, 18, 24]);
    const rate    = band.rate;
    const monthly = (amount * (rate / 12 / 100)) / (1 - Math.pow(1 + rate / 12 / 100, -term));
    const total   = monthly * term;
    const ba      = bankAccounts.find(b => b.user_id === uid);

    const isDecided = ['APPROVED','DISBURSED','ACTIVE','IN_ARREARS','SETTLED'].includes(def.status);
    const createdAt = daysAgo(def.daysBack);

    apps.push({
      user_id: uid,
      status: def.status,
      amount,
      term_months: term,
      purpose: pick(PURPOSES),
      loan_number: nextLoanNum++,
      has_credit_life_insurance: Math.random() > 0.4,
      offer_credit_life_total: 0,
      credit_life_contract_signed: false,
      // Credit decision fields (only for decided apps)
      ...(isDecided ? {
        credit_decision:   band.decision,
        credit_band_label: band.label,
        credit_band_color: band.color,
        credit_max_loan:   band.max,
        credit_rate_pa:    rate,
        credit_max_term:   24,
        offer_principal:   amount,
        offer_monthly_repayment: Math.round(monthly * 100) / 100,
        offer_total_repayment:   Math.round(total * 100) / 100,
        offer_interest_rate:     rate,
        bank_account_id:  ba?.id || null,
      } : {}),
      // Agreement number for disbursed/active/settled
      ...(['DISBURSED','ACTIVE','SETTLED','IN_ARREARS'].includes(def.status) ? {
        agreement_number: `ALG-${2024}-${String(nextLoanNum).padStart(5,'0')}`,
      } : {}),
      created_at: createdAt,
      updated_at: daysAgo(rand(0, def.daysBack)),
    });
  }

  const { data: insertedApps, error: appErr } = await sb.from('loan_applications').insert(apps).select();
  if (appErr) { console.warn('  ⚠  loan_applications:', appErr.message); return []; }
  console.log(`  ✓  loan_applications (${insertedApps.length} rows)`);
  return insertedApps;
}

// ─── 7. Loans ─────────────────────────────────────────────────────────────────
async function seedLoans(applications) {
  console.log('\n📊 Loans');
  const loanStatuses = { ACTIVE: 'active', IN_ARREARS: 'IN_ARREARS', SETTLED: 'completed', DISBURSED: 'active' };
  const loanApps = applications.filter(a => ['ACTIVE','IN_ARREARS','SETTLED','DISBURSED'].includes(a.status));

  if (!loanApps.length) { console.log('  (no eligible apps)'); return []; }

  const loanRows = loanApps.map(app => {
    const outstanding = app.status === 'SETTLED' ? 0 : Math.round(rand(1, 100) / 100 * (app.offer_total_repayment || app.amount));
    return {
      application_id:      app.id,
      user_id:             app.user_id,
      principal_amount:    app.offer_principal || app.amount,
      interest_rate:       app.offer_interest_rate || 22,
      term_months:         app.term_months,
      monthly_payment:     app.offer_monthly_repayment || Math.round(app.amount / app.term_months),
      status:              loanStatuses[app.status] || 'active',
      start_date:          app.created_at,
      first_payment_date:  daysAgo(rand(10, 60)),
      next_payment_date:   daysAgo(-rand(5, 30)), // future
      outstanding_balance: outstanding,
      total_repayment:     app.offer_total_repayment || app.amount,
      has_credit_life_insurance: app.has_credit_life_insurance || false,
    };
  });

  const { data: loans, error } = await sb.from('loans').insert(loanRows).select();
  if (error) { console.warn('  ⚠  loans:', error.message); return []; }
  console.log(`  ✓  loans (${loans.length} rows)`);
  return loans;
}

// ─── 8. Payouts ───────────────────────────────────────────────────────────────
async function seedPayouts(applications, bankAccounts) {
  console.log('\n💸 Payouts');
  const payoutApps = applications.filter(a => ['DISBURSED','ACTIVE','IN_ARREARS','SETTLED'].includes(a.status));
  if (!payoutApps.length) { console.log('  (none)'); return; }

  const rows = payoutApps.map(app => ({
    application_id:  app.id,
    user_id:         app.user_id,
    status:          'APPROVED',
    amount:          app.offer_principal || app.amount,
    payment_method:  pick(['EFT', 'Cash', 'Capitec Send']),
    disbursed_at:    daysAgo(rand(5, 40)),
    created_at:      app.created_at,
  }));
  await insert('payouts', rows);
}

// ─── 9. Manual payments (repayments) ──────────────────────────────────────────
async function seedManualPayments(applications, loans) {
  console.log('\n💳 Manual payments');
  const paymentApps = applications.filter(a => ['ACTIVE','IN_ARREARS','SETTLED'].includes(a.status));
  if (!paymentApps.length) { console.log('  (none)'); return; }

  const rows = [];
  for (const app of paymentApps) {
    const loan = loans.find(l => l.application_id === app.id);
    const numPayments = app.status === 'SETTLED' ? app.term_months : rand(1, Math.max(1, app.term_months - 1));
    for (let p = 0; p < numPayments; p++) {
      rows.push({
        loan_id:        loan?.id || null,
        application_id: app.id,
        user_id:        app.user_id,
        payment_type:   p === numPayments - 1 && app.status === 'SETTLED' ? 'settlement' : 'repayment',
        amount:         app.offer_monthly_repayment || Math.round(app.amount / app.term_months),
        reference:      `REF${rand(100000, 999999)}`,
        status:         'confirmed',
        reviewed_at:    daysAgo(rand(1, 90)),
        payment_date:   dateOnly(daysAgo(rand(1, 90))),
        notes:          null,
      });
    }
  }
  if (rows.length) await insert('manual_payments', rows);
}

// ─── 10. Cash journal ─────────────────────────────────────────────────────────
async function seedCashJournal(applications) {
  console.log('\n📒 Cash journal');
  const entries = [];

  // Opening balance
  entries.push({
    entry_date: dateOnly(daysAgo(180)),
    entry_type: 'opening_balance',
    category: 'opening_balance',
    description: 'Opening balance — AlgoLend Demo',
    amount: 500000,
    reference: 'OB-2024-001',
    created_by_name: 'System',
  });

  // Disbursements
  const disbApps = applications.filter(a => ['DISBURSED','ACTIVE','IN_ARREARS','SETTLED'].includes(a.status));
  for (const app of disbApps) {
    entries.push({
      entry_date: dateOnly(app.created_at),
      entry_type: 'cash_out',
      category: 'loan_disbursement',
      description: `Loan disbursement — ${app.loan_number} — R${(app.offer_principal || app.amount).toLocaleString('en-ZA')}`,
      amount: app.offer_principal || app.amount,
      reference: app.agreement_number || `ALG-${app.loan_number}`,
      created_by_name: 'Finance Dept',
    });
  }

  // Repayments (random historical)
  const names = BORROWERS.map(b => b.full_name);
  for (let i = 0; i < 20; i++) {
    const amount = rand(800, 8000);
    entries.push({
      entry_date: dateOnly(daysAgo(rand(1, 150))),
      entry_type: 'cash_in',
      category: 'repayment',
      description: `Repayment from ${pick(names)} — R${amount.toLocaleString('en-ZA')}`,
      amount,
      reference: `REP${rand(100000, 999999)}`,
      created_by_name: 'Finance Dept',
    });
  }

  // Expenses / cash out misc
  const expenseDesc = ['Office rent — March 2025', 'IT infrastructure', 'Legal fees', 'Staff salaries', 'Insurance premium', 'Stationery & supplies'];
  for (const desc of expenseDesc) {
    entries.push({
      entry_date: dateOnly(daysAgo(rand(5, 90))),
      entry_type: 'cash_out',
      category: 'operating_expense',
      description: desc,
      amount: rand(1500, 45000),
      reference: `EXP${rand(10000, 99999)}`,
      created_by_name: 'Finance Dept',
    });
  }

  await insert('cash_journal', entries);
}

// ─── 11. Document uploads ─────────────────────────────────────────────────────
async function seedDocuments(userIds, applications) {
  console.log('\n📄 Document uploads');
  const docLabels = ['ID Document', 'Latest Payslip', 'Bank Statement 3 months', 'Proof of Address', 'Company Registration', 'Tax Clearance Certificate'];
  const rows = [];
  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[i];
    const app = applications.find(a => a.user_id === uid);
    for (const label of docLabels.slice(0, rand(2, docLabels.length))) {
      const slug = label.toLowerCase().replace(/\s+/g, '_');
      const filename = `${slug}_${rand(1000, 9999)}.pdf`;
      rows.push({
        user_id: uid,
        application_id: app?.id || null,
        file_name: filename,
        original_name: filename,
        file_path: `documents/${uid}/${filename}`,
        file_type: 'pdf',
        mime_type: 'application/pdf',
        file_size: rand(50000, 2000000),
        status: pick(['verified', 'verified', 'pending', 'verified']),
        uploaded_at: daysAgo(rand(1, 90)),
      });
    }
  }
  await insert('document_uploads', rows);
}

// ─── 12. Audit log (some sample entries) ─────────────────────────────────────
async function seedAuditLog(applications, adminId) {
  console.log('\n📝 Audit log');
  const actions = ['application_created', 'status_updated', 'credit_check_run', 'document_verified', 'loan_approved', 'disbursement_approved'];
  const rows = [];
  for (const app of applications.slice(0, 6)) {
    const action = pick(actions);
    rows.push({
      entity_type: 'loan_application',
      entity_id: app.id,   // bigint
      action,
      user_id: adminId,
      new_values: { status: app.status },
      changes_summary: `Application L${app.loan_number} — ${action.replace(/_/g, ' ')}`,
      created_at: daysAgo(rand(1, 30)),
    });
  }
  await insert('audit_log', rows);
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 AlgoLend demo seed starting…\n');
  try {
    await seedSettings();
    await seedBranches();
    const { adminId, userIds } = await seedUsers();
    if (!userIds.length) { console.error('No users created — aborting.'); process.exit(1); }

    const bankAccounts = await seedBankAccounts(userIds);
    await seedFinancialData(userIds);
    const applications = await seedApplications(userIds, bankAccounts);
    const loans        = await seedLoans(applications);
    await seedPayouts(applications, bankAccounts);
    await seedManualPayments(applications, loans);
    await seedCashJournal(applications);
    await seedDocuments(userIds, applications);
    if (adminId) await seedAuditLog(applications, adminId);

    console.log('\n✅ Demo seed complete!');
    console.log('\n📧 Demo logins:');
    console.log('   Admin:   admin@demo.algolend.co.za / Admin@1234!');
    BORROWERS.forEach(b => console.log(`   Borrower: ${b.email} / Demo@1234!`));
  } catch (err) {
    console.error('Fatal seed error:', err);
    process.exit(1);
  }
}

main();
