/**
 * Records fresh full-flow walkthrough videos of the AlgoLend app — one at a
 * desktop viewport (widescreen demo cut) and one at a phone viewport (vertical
 * /mobile cut) — replacing the stale algolend-full-flow-improved.mp4 capture.
 *
 * All Supabase auth + REST calls are mocked with realistic canned data so the
 * recording is fast, deterministic, and free of real-auth redirect races.
 *
 * Flow: client login -> dashboard -> support -> loan calculator -> apply for loan
 *       -> admin login -> portfolio overview -> revenue analytics -> loan applications
 *       -> user management -> mandates -> credit rules -> loan book -> cash ledger
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3002';
const TMP_DIR = path.join(__dirname, '../demo-video/.tmp-recordings');

const VARIANTS = [
  { name: 'web', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
];

const MOCK_CLIENT_SESSION = {
  access_token: 'mock-client-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-client-refresh',
  user: {
    id: 'mock-client-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'thandiwe.nkosi@example.com',
    app_metadata: { provider: 'email', role: 'borrower' },
    user_metadata: { role: 'borrower', full_name: 'Thandiwe Nkosi' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token',
  user: {
    id: 'mock-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'consultant@algolend.co.za',
    app_metadata: { provider: 'email', role: 'base_admin' },
    user_metadata: { role: 'base_admin', full_name: 'Lead Consultant' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// Canned REST responses keyed by table/view name (matched against the request URL)
const TABLE_DATA = {
  profiles: {
    id: 'mock-user-id',
    full_name: 'Thandiwe Nkosi',
    email: 'thandiwe.nkosi@example.com',
    cell_tel_no: '+27 82 555 0142',
    identity_number: '9203105000084',
    address: '14 Vilakazi St, Soweto, 1804',
    role: 'borrower',
    kyc_verified: true,
    kyc_status: 'verified',
  },
  system_settings: {
    id: 'global',
    company_name: 'AlgoLend',
    primary_color: '#B026FF', // Luminous neon purple
    secondary_color: '#4A0E8F', // Deep purple
    tertiary_color: '#11022A', // Dark aesthetic
    theme_mode: 'dark',
    auth_overlay_color: '#1E0B3B', // Glassmorphic dark purple
    auth_overlay_enabled: true,
    carousel_slides: [
      {
        title: "Front End: Fully Branded Client Application Portal",
        text: "Real-Time Affordability Intelligence (TruID Integration)\nCorporate Document Upload & E-Contracts"
      },
      {
        title: "Back-End Risk & Compliance Engine",
        text: "Instantly run real-time CIPC company checks, AML screening, director credit scoring, and biometric liveness checks at the point of application"
      },
      {
        title: "Robust Operational Backbone",
        text: "Mandate Control Room & Live Dry-Runs\nRisk-Based Pricing & Approval Hierarchies\nFull Audit Trail & Role-Based Access Logs"
      }
    ],
  },
  loan_applications: [
    { id: 1042, user_id: 'mock-user-id', amount: 28000, term_months: 12, status: 'PENDING', repayment_start_date: '2026-07-01', offer_principal: 28000, offer_monthly_repayment: 2840, offer_total_repayment: 34080, offer_interest_rate: 18, profiles: { full_name: 'Thandiwe Nkosi', email: 'thandiwe.nkosi@example.com', identity_number: '9203105000084' }, created_at: new Date().toISOString() },
    { id: 1041, user_id: 'mock-user-id-2', amount: 65000, term_months: 24, status: 'STARTED', repayment_start_date: '2026-07-05', offer_principal: 65000, offer_monthly_repayment: 3550, offer_total_repayment: 85200, offer_interest_rate: 16, profiles: { full_name: 'Sipho Dlamini', email: 'sipho.dlamini@example.com', identity_number: '8807126000082' }, created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 1040, user_id: 'mock-user-id-3', amount: 12500, term_months: 6, status: 'APPROVED', repayment_start_date: '2026-06-20', offer_principal: 12500, offer_monthly_repayment: 2280, offer_total_repayment: 13680, offer_interest_rate: 14, profiles: { full_name: 'Lerato Molefe', email: 'lerato.molefe@example.com', identity_number: '9509224000089' }, created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: 1039, user_id: 'mock-user-id-4', amount: 95000, term_months: 36, status: 'DISBURSED', repayment_start_date: '2026-05-15', offer_principal: 95000, offer_monthly_repayment: 3760, offer_total_repayment: 135360, offer_interest_rate: 15, profiles: { full_name: 'Johan van der Merwe', email: 'johan.vdm@example.com', identity_number: '7711085000080' }, created_at: new Date(Date.now() - 432000000).toISOString() },
  ],
  branches: [
    { id: 'b1', name: 'Johannesburg Main' },
    { id: 'b2', name: 'Soweto Branch' },
    { id: 'b3', name: 'Pretoria Central' },
  ],
  cash_journal: [
    { id: 1, entry_date: '2026-06-08', entry_type: 'cash_out', category: 'loan_disbursement', description: 'Disbursement for Loan #1039 - Johan van der Merwe', reference: 'C1039-L001', amount: 95000.0, created_by_name: 'Lead Consultant' },
    { id: 2, entry_date: '2026-06-07', entry_type: 'cash_in', category: 'repayment', description: 'Repayment received - Lerato Molefe', reference: 'C1040-L003', amount: 2280.0, created_by_name: 'Lead Consultant' },
    { id: 3, entry_date: '2026-06-05', entry_type: 'opening_balance', category: 'other', description: 'Opening vault balance', reference: 'VAULT-INIT', amount: 250000.0, created_by_name: 'System' },
  ],
  loans: [
    { id: 1, principal_amount: 95000, status: 'active' },
    { id: 2, principal_amount: 65000, status: 'active' },
    { id: 3, principal_amount: 12500, status: 'repaid' },
    { id: 4, principal_amount: 38000, status: 'active' },
    { id: 5, principal_amount: 21000, status: 'arrears' },
  ],
  manual_payments: [
    { amount: 2840 },
    { amount: 3550 },
    { amount: 2280 },
    { amount: 3760 },
    { amount: 1850 },
  ],
  mandates: [
    { id: 1, name: 'SureSystems Debit Order Mandate', status: 'active', provider: 'SureSystems', integration_status: 'connected', created_at: new Date().toISOString() },
    { id: 2, name: 'Direct Debit — Standard Bank', status: 'active', provider: 'Standard Bank', integration_status: 'connected', created_at: new Date().toISOString() },
  ],
  users: [
    { id: 'u1', full_name: 'Thandiwe Nkosi', email: 'thandiwe.nkosi@example.com', role: 'borrower', branch_id: 'b1', created_at: new Date().toISOString() },
    { id: 'u2', full_name: 'Sipho Dlamini', email: 'sipho.dlamini@example.com', role: 'borrower', branch_id: 'b2', created_at: new Date().toISOString() },
    { id: 'u3', full_name: 'Lead Consultant', email: 'consultant@algolend.co.za', role: 'base_admin', branch_id: 'b1', created_at: new Date().toISOString() },
    { id: 'u4', full_name: 'Naledi Khumalo', email: 'naledi.khumalo@example.com', role: 'branch_admin', branch_id: 'b3', created_at: new Date().toISOString() },
  ],
  credit_checks: [
    { id: 1, user_id: 'mock-user-id', score: 681, bureau: 'Experian', outcome: 'pass', created_at: new Date().toISOString() },
  ],
};

const RPC_DATA = {
  get_dashboard_stats: { pending_applications: 7, total_clients: 318, active_branches: 3 },
  is_role_or_higher: true,
  mark_notification_read_single: { success: true },
  mark_notifications_read: { success: true },
  register_admin_upload: { success: true, id: 'mock-upload-id' },
};

function matchTable(url) {
  const m = url.match(/\/rest\/v1\/([a-zA-Z_]+)/);
  return m ? m[1] : null;
}

function matchRpc(url) {
  const m = url.match(/\/rest\/v1\/rpc\/([a-zA-Z_]+)/);
  return m ? m[1] : null;
}

async function installMocks(page) {
  await page.route('**/*.supabase.co/**', async (route) => {
    const url = route.request().url();
    const headers = route.request().headers();
    const authHeader = headers['authorization'] || '';
    const isClientSession = authHeader.includes('mock-client-token');

    if (url.includes('/auth/v1/')) {
      if (url.includes('/auth/v1/user')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isClientSession ? MOCK_CLIENT_SESSION.user : MOCK_SESSION.user) });
        return;
      }

      let session = MOCK_SESSION;
      try {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.email && body.email.includes('thandiwe')) session = MOCK_CLIENT_SESSION;
      } catch (_) {}
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
      return;
    }

    if (url.includes('/rest/v1/')) {
      const rpc = matchRpc(url);
      if (rpc) {
        let body = rpc in RPC_DATA ? RPC_DATA[rpc] : {};
        if (rpc === 'is_role_or_higher') body = !isClientSession;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }

      const table = matchTable(url);
      if (table && table in TABLE_DATA) {
        let payload = TABLE_DATA[table];
        if (table === 'profiles' && !url.includes('id=eq.')) {
          payload = [
            { id: 'mock-client-id', full_name: 'Thandiwe Nkosi', email: 'thandiwe.nkosi@example.com', identity_number: '9203105000084', role: 'borrower', branch_id: 'b1' },
            { id: 'u2', full_name: 'Sipho Dlamini', email: 'sipho.dlamini@example.com', identity_number: '8807126000082', role: 'borrower', branch_id: 'b2' },
            { id: 'mock-user-id', full_name: 'Lead Consultant', email: 'consultant@algolend.co.za', identity_number: '7601085000088', role: 'base_admin', branch_id: 'b1' },
            { id: 'u4', full_name: 'Naledi Khumalo', email: 'naledi.khumalo@example.com', identity_number: '9509224000089', role: 'branch_admin', branch_id: 'b3' },
          ];
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }

      if (table === 'financial_profiles') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'mock-client-id', monthly_income: 15000, monthly_expenses: 5000 }) });
        return;
      }

      if (table === 'declarations') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'mock-client-id', accepted_std_conditions: true }) });
        return;
      }
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

// Pre-seed the Supabase session in storage so subsequent page loads are already
// authenticated (used AFTER the on-screen "sign in" beat has been recorded).
async function seedSession(page) {
  await page.evaluate((session) => {
    const keys = ['sb-yakhrwrfmdrnhfgzfiwm-auth-token', 'sb-auth-token'];
    for (const key of keys) {
      window.localStorage.setItem(key, JSON.stringify(session));
      window.sessionStorage.setItem(key, JSON.stringify(session));
    }
  }, MOCK_SESSION);
}

async function clearSession(page) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function performLogin(page, label, email) {
  console.log(`${label} (typing credentials)...`);
  
  await page.goto(`${BASE_URL}/auth/login.html`, { waitUntil: 'networkidle' });
  // Clear any existing session before logging in
  await clearSession(page);

  await page.waitForTimeout(900);
  await page.fill('#email-address', email);
  await page.waitForTimeout(250);
  await page.fill('#password', 'demo-password-123');
  await page.waitForTimeout(700);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('#auth-form button[type="submit"]'),
  ]);
  await page
    .evaluate(() => (document.fonts && document.fonts.ready) || Promise.resolve())
    .catch(() => {});
  await page.waitForTimeout(1800);
}

async function recordVariant(browser, variant) {
  const variantDir = path.join(TMP_DIR, variant.name);
  fs.mkdirSync(variantDir, { recursive: true });

  const context = await browser.newContext({
    viewport: variant.viewport,
    deviceScaleFactor: variant.deviceScaleFactor,
    recordVideo: { dir: variantDir, size: variant.viewport },
  });
  const page = await context.newPage();
  await installMocks(page);

  const waitForFonts = async () => {
    await page
      .evaluate(() => (document.fonts && document.fonts.ready) || Promise.resolve())
      .catch(() => {});
    await page.waitForTimeout(700);
  };

  const visit = async (label, url, settleMs = 3200) => {
    console.log(`[${variant.name}] ${label}...`);
    await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' });
    await waitForFonts();
    await page.waitForTimeout(settleMs);
  };

  try {
    // --- Client portal ---
    await performLogin(page, `[${variant.name}] Client login`, 'thandiwe.nkosi@example.com');

    await visit('Client dashboard', '/user-portal/?page=dashboard', 4200);
    await page.mouse.wheel(0, 380);
    await page.waitForTimeout(1600);

    await visit('Support tab', '/user-portal/pages/support.html', 3000);
    await visit('Loan calculator', '/user-portal/?page=loan-calculator', 3400);
    await visit('Apply for loan — step 1', '/user-portal/pages/apply-loan.html', 3000);
    await visit('Apply for loan — step 2', '/user-portal/pages/apply-loan-2.html', 3000);

    // --- Admin portal ---
    await clearSession(page);

    await performLogin(page, `[${variant.name}] Admin login (the drop)`, 'consultant@algolend.co.za');

    await visit('Portfolio overview', '/admin/dashboard.html', 4400);
    await page.mouse.wheel(0, 380);
    await page.waitForTimeout(1600);

    await visit('Revenue analytics', '/admin/analytics.html', 3600);
    await visit('Loan applications', '/admin/applications.html', 3400);
    await visit('User management', '/admin/users.html', 3200);
    await visit('Mandate control', '/admin/mandates.html', 3200);
    await visit('Credit rules engine', '/admin/credit-rules.html', 3200);
    await visit('Loan book analytics', '/admin/loan-book.html', 3400);
    await visit('Cash ledger', '/admin/cash-ledger.html', 3000);
  } catch (err) {
    console.error(`[${variant.name}] Error during recording:`, err);
  } finally {
    await page.close();
    await context.close();
  }

  const files = fs.readdirSync(variantDir).filter((f) => f.endsWith('.webm'));
  if (files.length === 0) {
    throw new Error(`No recording produced for variant "${variant.name}"`);
  }
  return path.join(variantDir, files[0]);
}

async function main() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const variant of VARIANTS) {
    results[variant.name] = await recordVariant(browser, variant);
    console.log(`[${variant.name}] Recorded -> ${results[variant.name]}`);
  }

  await browser.close();
  console.log('\nAll recordings complete:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Recording process failed:', err);
  process.exit(1);
});
