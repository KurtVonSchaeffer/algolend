/**
 * Takes clean, fully-rendered screenshots of each admin/client screen
 * with mocked Supabase responses and font-ready guarantee.
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3002';
const OUT_DIR = '/tmp/fresh_screens';
const fs = require('fs');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Build a structurally valid (but unsigned) JWT so Supabase's jwtDecode doesn't throw
function makeJwt(payload) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.fakesignature`;
}

const exp = Math.floor(Date.now() / 1000) + 7200;
const ADMIN_JWT = makeJwt({
  sub: 'mock-user-id', aud: 'authenticated', role: 'authenticated',
  email: 'consultant@algolend.co.za', iat: Math.floor(Date.now() / 1000), exp,
  app_metadata: { provider: 'email', role: 'base_admin' },
  user_metadata: { role: 'base_admin', full_name: 'Lead Consultant' },
});
const CLIENT_JWT = makeJwt({
  sub: 'mock-client-id', aud: 'authenticated', role: 'authenticated',
  email: 'thandiwe.nkosi@example.com', iat: Math.floor(Date.now() / 1000), exp,
  app_metadata: { provider: 'email', role: 'borrower' },
  user_metadata: { role: 'borrower', full_name: 'Thandiwe Nkosi' },
});

const MOCK_SESSION = {
  access_token: ADMIN_JWT,
  token_type: 'bearer',
  expires_in: 7200,
  expires_at: exp,
  refresh_token: 'mock-refresh-token',
  user: {
    id: 'mock-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'consultant@algolend.co.za',
    app_metadata: { provider: 'email', role: 'super_admin' },
    user_metadata: { role: 'super_admin', full_name: 'Lead Consultant' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

const MOCK_CLIENT_SESSION = {
  ...MOCK_SESSION,
  access_token: CLIENT_JWT,
  user: {
    ...MOCK_SESSION.user,
    id: 'mock-client-id',
    email: 'thandiwe.nkosi@example.com',
    app_metadata: { provider: 'email', role: 'borrower' },
    user_metadata: { role: 'borrower', full_name: 'Thandiwe Nkosi' },
  },
};

const TABLE_DATA = {
  // Array form for list queries (fetchUsers, etc); single-record pages use .maybeSingle() which Supabase extracts
  profiles: [
    { id: 'mock-user-id', full_name: 'Thandiwe Nkosi', email: 'thandiwe.nkosi@example.com', cell_tel_no: '+27 82 555 0142', identity_number: '9203105000084', address: '14 Vilakazi St, Soweto, 1804', role: 'borrower', kyc_verified: true, kyc_status: 'verified', branch_id: 'b1', created_at: new Date().toISOString() },
    { id: 'mock-user-id-2', full_name: 'Sipho Dlamini', email: 'sipho.dlamini@example.com', cell_tel_no: '+27 83 444 0211', identity_number: '8807126000082', address: '22 Bree St, Cape Town, 8001', role: 'borrower', kyc_verified: true, kyc_status: 'verified', branch_id: 'b2', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'u3', full_name: 'Lead Consultant', email: 'consultant@algolend.co.za', cell_tel_no: '+27 11 000 0001', identity_number: '8001011000080', address: '1 Admin Ave, JHB', role: 'base_admin', kyc_verified: true, kyc_status: 'verified', branch_id: 'b1', created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: 'u4', full_name: 'Naledi Khumalo', email: 'naledi.khumalo@example.com', cell_tel_no: '+27 12 000 0002', identity_number: '9001011000081', address: '5 Branch Rd, Pretoria', role: 'branch_admin', kyc_verified: true, kyc_status: 'verified', branch_id: 'b3', created_at: new Date(Date.now() - 259200000).toISOString() },
  ],
  system_settings: { id: 'global', company_name: 'AlgoLend', primary_color: '#8A2BE2', secondary_color: '#A020F0', tertiary_color: '#FACC15', theme_mode: 'light', carousel_slides: [{ title: 'A Leap to Financial Freedom', text: 'We offer credit of up to R200,000.' }] },
  loan_applications: [
    { id: 'a1042b3c-0001-4d5e-8f90-abcdef000001', loan_number: 1042, client_number: 'C0042', user_id: 'mock-user-id', amount: 28000, term_months: 12, status: 'PENDING', offer_principal: 28000, offer_monthly_repayment: 2840, offer_total_repayment: 34080, offer_interest_rate: 18, loan_purpose: 'Working capital', profiles: { full_name: 'Thandiwe Nkosi', email: 'thandiwe.nkosi@example.com', identity_number: '9203105000084', client_number: 'C0042' }, created_at: new Date().toISOString() },
    { id: 'b2053c4d-0002-4e6f-9001-abcdef000002', loan_number: 1041, client_number: 'C0031', user_id: 'mock-user-id-2', amount: 65000, term_months: 24, status: 'STARTED', offer_principal: 65000, offer_monthly_repayment: 3550, offer_total_repayment: 85200, offer_interest_rate: 16, loan_purpose: 'Equipment purchase', profiles: { full_name: 'Sipho Dlamini', email: 'sipho.dlamini@example.com', identity_number: '8807126000082', client_number: 'C0031' }, created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'c3064d5e-0003-4f70-9112-abcdef000003', loan_number: 1040, client_number: 'C0028', user_id: 'mock-user-id-3', amount: 12500, term_months: 6, status: 'APPROVED', offer_principal: 12500, offer_monthly_repayment: 2280, offer_total_repayment: 13680, offer_interest_rate: 14, loan_purpose: 'Stock purchase', profiles: { full_name: 'Lerato Molefe', email: 'lerato.molefe@example.com', identity_number: '9509224000089', client_number: 'C0028' }, created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: 'd4075e6f-0004-4071-9223-abcdef000004', loan_number: 1039, client_number: 'C0019', user_id: 'mock-user-id-4', amount: 95000, term_months: 36, status: 'DISBURSED', offer_principal: 95000, offer_monthly_repayment: 3760, offer_total_repayment: 135360, offer_interest_rate: 15, loan_purpose: 'Business expansion', profiles: { full_name: 'Johan van der Merwe', email: 'johan.vdm@example.com', identity_number: '7711085000080', client_number: 'C0019' }, created_at: new Date(Date.now() - 432000000).toISOString() },
  ],
  branches: [{ id: 'b1', name: 'Johannesburg Main' }, { id: 'b2', name: 'Soweto Branch' }, { id: 'b3', name: 'Pretoria Central' }],
  cash_journal: [
    { id: 1, entry_date: '2026-06-08', entry_type: 'cash_out', category: 'loan_disbursement', description: 'Disbursement for Loan #1039 - Johan van der Merwe', reference: 'C1039-L001', amount: 95000.0, created_by_name: 'Lead Consultant' },
    { id: 2, entry_date: '2026-06-07', entry_type: 'cash_in', category: 'repayment', description: 'Repayment received - Lerato Molefe', reference: 'C1040-L003', amount: 2280.0, created_by_name: 'Lead Consultant' },
    { id: 3, entry_date: '2026-06-05', entry_type: 'opening_balance', category: 'other', description: 'Opening vault balance', reference: 'VAULT-INIT', amount: 250000.0, created_by_name: 'System' },
  ],
  loans: [{ id: 1, principal_amount: 95000, status: 'active' }, { id: 2, principal_amount: 65000, status: 'active' }, { id: 3, principal_amount: 12500, status: 'repaid' }, { id: 4, principal_amount: 38000, status: 'active' }, { id: 5, principal_amount: 21000, status: 'arrears' }],
  manual_payments: [{ amount: 2840 }, { amount: 3550 }, { amount: 2280 }, { amount: 3760 }, { amount: 1850 }],
  mandates: [{ id: 1, name: 'SureSystems Debit Order Mandate', status: 'active', provider: 'SureSystems', integration_status: 'connected', created_at: new Date().toISOString() }, { id: 2, name: 'Direct Debit — Standard Bank', status: 'active', provider: 'Standard Bank', integration_status: 'connected', created_at: new Date().toISOString() }],
  users: [{ id: 'u1', full_name: 'Thandiwe Nkosi', email: 'thandiwe.nkosi@example.com', role: 'borrower', branch_id: 'b1', created_at: new Date().toISOString() }, { id: 'u2', full_name: 'Sipho Dlamini', email: 'sipho.dlamini@example.com', role: 'borrower', branch_id: 'b2', created_at: new Date().toISOString() }, { id: 'u3', full_name: 'Lead Consultant', email: 'consultant@algolend.co.za', role: 'base_admin', branch_id: 'b1', created_at: new Date().toISOString() }, { id: 'u4', full_name: 'Naledi Khumalo', email: 'naledi.khumalo@example.com', role: 'branch_admin', branch_id: 'b3', created_at: new Date().toISOString() }],
  credit_checks: [{ id: 1, user_id: 'mock-user-id', score: 681, bureau: 'Experian', outcome: 'pass', created_at: new Date().toISOString() }],
  transactions: [
    { id: 't1', created_at: new Date(Date.now() - 86400000).toISOString(), type: 'repayment', amount: 2840, description: 'Monthly repayment', status: 'completed' },
    { id: 't2', created_at: new Date(Date.now() - 172800000).toISOString(), type: 'disbursement', amount: 28000, description: 'Loan disbursement', status: 'completed' },
  ],
  notifications: [],
  credit_score_bands: [{ id: 1, label: 'Excellent', min_score: 750, max_score: 850, max_loan_amount: 200000, interest_rate: 12 }, { id: 2, label: 'Good', min_score: 650, max_score: 749, max_loan_amount: 100000, interest_rate: 16 }, { id: 3, label: 'Fair', min_score: 550, max_score: 649, max_loan_amount: 50000, interest_rate: 20 }],
};

const RPC_DATA = {
  get_dashboard_stats: { pending_applications: 7, total_clients: 318, active_branches: 3 },
  is_role_or_higher: true,
  mark_notification_read_single: { success: true },
  mark_notifications_read: { success: true },
  register_admin_upload: { success: true, id: 'mock-upload-id' },
  get_monthly_revenue: [{ month: '2026-01', revenue: 48200, disbursed: 125000 }, { month: '2026-02', revenue: 52100, disbursed: 98000 }, { month: '2026-03', revenue: 61400, disbursed: 147000 }, { month: '2026-04', revenue: 58700, disbursed: 132000 }, { month: '2026-05', revenue: 67300, disbursed: 189000 }, { month: '2026-06', revenue: 71800, disbursed: 203000 }],
};

async function installMocks(page, isAdmin = true) {
  const session = isAdmin ? MOCK_SESSION : MOCK_CLIENT_SESSION;
  await page.route('**/*.supabase.co/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
      return;
    }
    if (url.includes('/rest/v1/')) {
      const rpcMatch = url.match(/\/rest\/v1\/rpc\/([a-zA-Z_]+)/);
      if (rpcMatch) {
        const rpc = rpcMatch[1];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rpc in RPC_DATA ? RPC_DATA[rpc] : {}) });
        return;
      }
      const tableMatch = url.match(/\/rest\/v1\/([a-zA-Z_]+)/);
      if (tableMatch) {
        const table = tableMatch[1];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(table in TABLE_DATA ? TABLE_DATA[table] : []) });
        return;
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

// Supabase stores the session under this localStorage key
const STORAGE_KEY = 'sb-yakhrwrfmdrnhfgzfiwm-auth-token';

async function seedSession(page, session) {
  // The app uses sessionStorage (see supabaseClient.js: storage: window.sessionStorage)
  await page.addInitScript(({ key, val }) => {
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }, { key: STORAGE_KEY, val: { ...session } });
}

async function waitAndShot(page, name, extraWait = 2000) {
  await page.waitForFunction(() => document.fonts.ready.then(() => true), { timeout: 10000 }).catch(() => {});
  // Wait for loading spinners to clear (up to 5s)
  await page.waitForFunction(
    () => !document.body?.innerText?.includes('Loading...') && !document.querySelector('.fa-spin'),
    { timeout: 5000 }
  ).catch(() => {});
  await page.waitForTimeout(extraWait);
  const outPath = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`captured ${name}.png`);
}

const VP = { width: 1522, height: 784 };

(async () => {
  const browser = await chromium.launch({ headless: true });

  // --- ADMIN SCREENS ---
  const adminCtx = await browser.newContext({ viewport: VP });
  const adminPage = await adminCtx.newPage();
  await installMocks(adminPage, true);
  await seedSession(adminPage, MOCK_SESSION);

  const adminScreens = [
    ['/admin/dashboard.html',       'portfolio_dashboard',  3000],
    ['/admin/analytics.html',       'revenue_analytics',   3000],
    ['/admin/applications.html',    'loan_applications',   3000],
    ['/admin/users.html',           'user_management',     3000],
    ['/admin/mandates.html',        'mandate_control',     3000],
    ['/admin/credit-rules.html',    'credit_rules',        3000],
    ['/admin/loan-book.html',       'loan_book',           3000],
  ];

  adminPage.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('session') || msg.text().includes('login') || msg.text().includes('🔒')) {
      console.log(`  [console ${msg.type()}]: ${msg.text().slice(0, 120)}`);
    }
  });

  for (const [url, name, wait] of adminScreens) {
    await adminPage.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    const finalUrl = adminPage.url();
    const title = await adminPage.title();
    console.log(`  -> landed: ${finalUrl} | "${title}"`);
    await waitAndShot(adminPage, name, wait);
  }

  // --- CLIENT / AUTH SCREENS ---
  const clientCtx = await browser.newContext({ viewport: VP });
  const clientPage = await clientCtx.newPage();
  await installMocks(clientPage, false);
  await seedSession(clientPage, MOCK_CLIENT_SESSION);

  // Login page (no auth needed)
  const loginCtx = await browser.newContext({ viewport: VP });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${BASE_URL}/auth/login.html`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await waitAndShot(loginPage, 'secure_signin', 1500);
  await loginCtx.close();

  // Client portal pages
  const clientPortalScreens = [
    ['/user-portal/pages/loan-calculator.html', 'loan_calculator',      1500],
    ['/user-portal/pages/transactions.html',    'transactions_overview', 1500],
    ['/user-portal/pages/support.html',         'support',              1500],
    ['/user-portal/pages/kyc.html',             'identity_compliance',  1500],
  ];

  for (const [url, name, wait] of clientPortalScreens) {
    await clientPage.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await waitAndShot(clientPage, name, wait);
  }

  await browser.close();
  console.log('\nAll screenshots saved to', OUT_DIR);
  console.log(fs.readdirSync(OUT_DIR).join('\n'));
})();
