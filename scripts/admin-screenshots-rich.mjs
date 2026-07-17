/**
 * Admin panel screenshots — fake data + dark & light modes
 * Intercepts Supabase REST calls and returns realistic mock data.
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE      = 'http://localhost:5174/admin-panel';
const SUPABASE  = 'yakhrwrfmdrnhfgzfiwm.supabase.co/rest/v1';

// ── Fake data ────────────────────────────────────────────────────────────────

const FAKE = {
  loans: [
    { id: 'l1', user_id: 'u1', principal_amount: 45000, status: 'active',   interest_rate: 28.5, created_at: '2026-03-01T09:00:00Z', profiles: { full_name: 'Thabo Mokoena',   identity_number: '9001015009087' } },
    { id: 'l2', user_id: 'u2', principal_amount: 18000, status: 'active',   interest_rate: 24.0, created_at: '2026-04-10T11:00:00Z', profiles: { full_name: 'Naledi Dlamini',  identity_number: '9203220456089' } },
    { id: 'l3', user_id: 'u3', principal_amount: 32000, status: 'repaid',   interest_rate: 26.0, created_at: '2025-11-01T08:00:00Z', profiles: { full_name: 'Sipho Khumalo',   identity_number: '8807145123083' } },
    { id: 'l4', user_id: 'u4', principal_amount: 12000, status: 'default',  interest_rate: 30.0, created_at: '2026-01-15T10:00:00Z', profiles: { full_name: 'Zanele Nkosi',    identity_number: '9511230789081' } },
    { id: 'l5', user_id: 'u5', principal_amount: 25000, status: 'active',   interest_rate: 25.5, created_at: '2026-05-20T14:00:00Z', profiles: { full_name: 'Kagiso Sithole',  identity_number: '0004155678085' } },
  ],
  loan_applications: [
    { id: 'a1', user_id: 'u1', amount: 50000, status: 'PENDING',   created_at: '2026-07-10T09:00:00Z', profiles: { full_name: 'Thabo Mokoena',   identity_number: '9001015009087' } },
    { id: 'a2', user_id: 'u2', amount: 20000, status: 'UNDER_REVIEW', created_at: '2026-07-08T11:00:00Z', profiles: { full_name: 'Naledi Dlamini',  identity_number: '9203220456089' } },
    { id: 'a3', user_id: 'u6', amount: 35000, status: 'APPROVED',  created_at: '2026-07-06T14:00:00Z', profiles: { full_name: 'Bongani Mthembu', identity_number: '8512125432081' } },
    { id: 'a4', user_id: 'u7', amount: 15000, status: 'PENDING',   created_at: '2026-07-05T16:00:00Z', profiles: { full_name: 'Precious Molefe', identity_number: '9708304567082' } },
    { id: 'a5', user_id: 'u5', amount: 28000, status: 'AWAITING_DISBURSEMENT', created_at: '2026-07-03T10:00:00Z', profiles: { full_name: 'Kagiso Sithole',  identity_number: '0004155678085' } },
    { id: 'a6', user_id: 'u8', amount: 10000, status: 'DECLINED',  created_at: '2026-06-28T09:00:00Z', profiles: { full_name: 'Lindiwe Zulu',    identity_number: '0106080123086' } },
  ],
  manual_payments: [
    { id: 'p1', user_id: 'u1', amount: 4287.50, status: 'confirmed', created_at: '2026-07-12T08:00:00Z', profiles: { full_name: 'Thabo Mokoena',   email: 'thabo@gmail.com'  } },
    { id: 'p2', user_id: 'u2', amount: 2100.00, status: 'confirmed', created_at: '2026-07-11T09:00:00Z', profiles: { full_name: 'Naledi Dlamini',  email: 'naledi@gmail.com' } },
    { id: 'p3', user_id: 'u5', amount: 3350.00, status: 'confirmed', created_at: '2026-07-10T14:00:00Z', profiles: { full_name: 'Kagiso Sithole',  email: 'kagiso@gmail.com' } },
    { id: 'p4', user_id: 'u3', amount: 5200.00, status: 'pending',   created_at: '2026-07-09T11:00:00Z', profiles: { full_name: 'Sipho Khumalo',   email: 'sipho@gmail.com'  } },
  ],
  payouts: [
    { id: 'po1', application_id: 'a3', user_id: 'u6', amount: 35000, status: 'paid', created_at: '2026-07-07T10:00:00Z', profile: { full_name: 'Bongani Mthembu', email: 'bongani@gmail.com' }, application: { status: 'APPROVED', bank_account: { account_number: '****3421', bank_name: 'FNB' } } },
    { id: 'po2', application_id: 'a5', user_id: 'u5', amount: 28000, status: 'pending', created_at: '2026-07-14T09:00:00Z', profile: { full_name: 'Kagiso Sithole', email: 'kagiso@gmail.com' }, application: { status: 'AWAITING_DISBURSEMENT', bank_account: { account_number: '****7890', bank_name: 'Capitec' } } },
  ],
  profiles: [
    { id: 'u1', full_name: 'Thabo Mokoena',   email: 'thabo@gmail.com',   role: 'borrower',   identity_number: '9001015009087', created_at: '2026-01-10T09:00:00Z', branches: { id: 'b1', name: 'Johannesburg CBD' } },
    { id: 'u2', full_name: 'Naledi Dlamini',  email: 'naledi@gmail.com',  role: 'borrower',   identity_number: '9203220456089', created_at: '2026-02-14T10:00:00Z', branches: { id: 'b2', name: 'Sandton' } },
    { id: 'u3', full_name: 'Sipho Khumalo',   email: 'sipho@gmail.com',   role: 'borrower',   identity_number: '8807145123083', created_at: '2025-11-01T08:00:00Z', branches: { id: 'b1', name: 'Johannesburg CBD' } },
    { id: 'u4', full_name: 'Zanele Nkosi',    email: 'zanele@gmail.com',  role: 'borrower',   identity_number: '9511230789081', created_at: '2026-01-05T11:00:00Z', branches: { id: 'b3', name: 'Pretoria' } },
    { id: 'u5', full_name: 'Kagiso Sithole',  email: 'kagiso@gmail.com',  role: 'borrower',   identity_number: '0004155678085', created_at: '2026-03-22T14:00:00Z', branches: { id: 'b2', name: 'Sandton' } },
    { id: 'u6', full_name: 'Bongani Mthembu', email: 'bongani@gmail.com', role: 'borrower',   identity_number: '8512125432081', created_at: '2026-04-18T09:00:00Z', branches: { id: 'b1', name: 'Johannesburg CBD' } },
    { id: 'u7', full_name: 'Precious Molefe', email: 'precious@gmail.com',role: 'borrower',   identity_number: '9708304567082', created_at: '2026-05-30T10:00:00Z', branches: { id: 'b3', name: 'Pretoria' } },
    { id: 'u8', full_name: 'Lindiwe Zulu',    email: 'lindiwe@gmail.com', role: 'borrower',   identity_number: '0106080123086', created_at: '2026-06-12T11:00:00Z', branches: { id: 'b4', name: 'Durban' } },
    { id: 'a1', full_name: 'Admin User',       email: 'admin@algolend.co.za', role: 'base_admin', identity_number: null, created_at: '2025-01-01T00:00:00Z', branches: null },
  ],
  debit_mandates: [
    { id: 'm1', user_id: 'u1', profiles: { full_name: 'Thabo Mokoena',   identity_number: '9001015009087' }, mandate_reference: 'ALG-001-2026', status: 'active',   collection_amount: 4287.50, created_at: '2026-03-05T09:00:00Z' },
    { id: 'm2', user_id: 'u2', profiles: { full_name: 'Naledi Dlamini',  identity_number: '9203220456089' }, mandate_reference: 'ALG-002-2026', status: 'active',   collection_amount: 2100.00, created_at: '2026-04-12T10:00:00Z' },
    { id: 'm3', user_id: 'u5', profiles: { full_name: 'Kagiso Sithole',  identity_number: '0004155678085' }, mandate_reference: 'ALG-003-2026', status: 'pending',  collection_amount: 3350.00, created_at: '2026-05-22T11:00:00Z' },
    { id: 'm4', user_id: 'u4', profiles: { full_name: 'Zanele Nkosi',    identity_number: '9511230789081' }, mandate_reference: 'ALG-004-2026', status: 'cancelled', collection_amount: 1800.00, created_at: '2026-01-20T08:00:00Z' },
  ],
  cash_ledger: [
    { id: 'cl1', type: 'disbursement', amount: -45000, description: 'Loan disbursement - Thabo Mokoena', created_at: '2026-03-01T09:00:00Z', balance: 355000 },
    { id: 'cl2', type: 'repayment',    amount:  4287.5, description: 'DebiCheck collection - ALG-001',   created_at: '2026-07-12T08:00:00Z', balance: 359287.5 },
    { id: 'cl3', type: 'disbursement', amount: -18000, description: 'Loan disbursement - Naledi Dlamini', created_at: '2026-04-10T11:00:00Z', balance: 341287.5 },
    { id: 'cl4', type: 'repayment',    amount:  2100,  description: 'DebiCheck collection - ALG-002',   created_at: '2026-07-11T09:00:00Z', balance: 343387.5 },
    { id: 'cl5', type: 'disbursement', amount: -25000, description: 'Loan disbursement - Kagiso Sithole', created_at: '2026-05-20T14:00:00Z', balance: 318387.5 },
  ],
  credit_rules: [
    { id: 'cr1', name: 'Minimum Credit Score',    field: 'credit_score',    operator: 'gte', value: 600,  action: 'approve', active: true  },
    { id: 'cr2', name: 'Maximum DTI Ratio',       field: 'dti_ratio',       operator: 'lte', value: 40,   action: 'approve', active: true  },
    { id: 'cr3', name: 'Minimum Monthly Income',  field: 'monthly_income',  operator: 'gte', value: 5000, action: 'approve', active: true  },
    { id: 'cr4', name: 'Maximum Loan to Income',  field: 'loan_to_income',  operator: 'lte', value: 3,    action: 'approve', active: true  },
    { id: 'cr5', name: 'Blacklisted Check',       field: 'is_blacklisted',  operator: 'eq',  value: false,action: 'decline', active: true  },
    { id: 'cr6', name: 'Employment Status',       field: 'employment_type', operator: 'in',  value: ['employed','self_employed'], action: 'approve', active: false },
  ],
  system_settings: [{ id: 'global', company_name: 'AlgoLend', theme_primary_color: '#7c3aed', theme_mode: 'dark', company_logo_url: '/algolend-logo.png' }],
  consumers: [
    { id: 'c1', full_name: 'Thabo Mokoena',   id_number: '9001015009087', credit_score: 742, submitted: true,  submitted_at: '2026-01-15T09:00:00Z' },
    { id: 'c2', full_name: 'Naledi Dlamini',  id_number: '9203220456089', credit_score: 698, submitted: true,  submitted_at: '2026-02-20T10:00:00Z' },
    { id: 'c3', full_name: 'Sipho Khumalo',   id_number: '8807145123083', credit_score: 715, submitted: false, submitted_at: null },
    { id: 'c4', full_name: 'Zanele Nkosi',    id_number: '9511230789081', credit_score: 580, submitted: true,  submitted_at: '2026-01-10T11:00:00Z' },
  ],
  ncr_submissions: [
    { id: 'n1', period: '2026-06', status: 'submitted', submitted_at: '2026-07-05T09:00:00Z', record_count: 47 },
    { id: 'n2', period: '2026-05', status: 'submitted', submitted_at: '2026-06-05T10:00:00Z', record_count: 41 },
    { id: 'n3', period: '2026-04', status: 'submitted', submitted_at: '2026-05-05T09:00:00Z', record_count: 38 },
  ],
};

// ── Request interception ─────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Range, X-Total-Count',
};

function mockSupabase(url, method) {
  // CORS preflight
  if (method === 'OPTIONS') {
    return { status: 204, body: '', headers: CORS };
  }

  const path  = url.split('/rest/v1/')[1] ?? '';
  const table = path.split('?')[0].replace(/^\//, '');
  const rows  = FAKE[table] ?? [];
  const count = rows.length;

  // HEAD = count-only query
  if (method === 'HEAD') {
    return {
      status: 200,
      body: '',
      headers: {
        ...CORS,
        'Content-Range':       `0-${Math.max(count - 1, 0)}/${count}`,
        'Content-Type':        'application/json',
        'Preference-Applied':  'count=exact',
      },
    };
  }

  return {
    status: 200,
    body: JSON.stringify(rows),
    headers: { ...CORS, 'Content-Type': 'application/json' },
  };
}

// ── Pages ────────────────────────────────────────────────────────────────────

const PAGES = [
  { name: '01-dashboard',          path: '/dashboard'          },
  { name: '02-applications',       path: '/applications'       },
  { name: '03-users',              path: '/users'              },
  { name: '04-mandates',           path: '/mandates'           },
  { name: '05-incoming-payments',  path: '/incoming-payments'  },
  { name: '06-outgoing-payments',  path: '/outgoing-payments'  },
  { name: '07-analytics',          path: '/analytics'          },
  { name: '08-financials',         path: '/financials'         },
  { name: '09-credit-rules',       path: '/credit-rules'       },
  { name: '10-portfolio',          path: '/portfolio'          },
  { name: '11-loan-book',          path: '/loan-book'          },
  { name: '12-cash-ledger',        path: '/cash-ledger'        },
  { name: '13-sacrra',             path: '/sacrra'             },
  { name: '14-ncr-reporting',      path: '/ncr-reporting'      },
  { name: '15-ncr-registers',      path: '/ncr-registers'      },
  { name: '16-compliance-tracker', path: '/compliance-tracker' },
  { name: '17-goaml',              path: '/goaml'              },
  { name: '18-settings',           path: '/settings'           },
  { name: '19-create-application', path: '/create-application' },
];

const THEMES = ['dark', 'light'];

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  for (const theme of THEMES) {
    const outDir = join(__dirname, `../screenshots/admin/${theme}`);
    mkdirSync(outDir, { recursive: true });

    console.log(`\n=== ${theme.toUpperCase()} MODE ===`);

    const browser = await puppeteer.launch({ headless: true });
    const page    = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    // Set demo mode and initial theme
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('algolend_demo', '1');
      localStorage.setItem('algolend_theme_mode', t);
    }, theme);

    // Intercept Supabase REST calls
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes(SUPABASE)) {
        const { status, body, headers } = mockSupabase(url, req.method());
        req.respond({ status, body, headers });
      } else {
        req.continue();
      }
    });

    for (const { name, path } of PAGES) {
      console.log(`  ${name}...`);
      try {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 15000 });

        // Wait for spinners to clear (max 5s)
        await page.waitForFunction(
          () => document.querySelectorAll('.spinner').length === 0,
          { timeout: 5000 }
        ).catch(() => {});

        await new Promise(r => setTimeout(r, 1000));

        // Force theme AFTER React effects have settled
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, theme);

        await new Promise(r => setTimeout(r, 300));

        await page.screenshot({
          path: join(outDir, `${name}.png`),
          fullPage: false,
        });
        console.log(`    ✓ saved`);
      } catch (err) {
        console.error(`    ✗ ${err.message}`);
      }
    }

    await browser.close();
  }

  console.log('\nDone — screenshots/admin/dark/ and screenshots/admin/light/');
}

run().catch(err => { console.error(err); process.exit(1); });
