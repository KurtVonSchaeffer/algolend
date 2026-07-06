/**
 * AlgoLend Demo Screenshot Capture
 * Captures all key pages with seeded demo data.
 * Run: node scripts/capture_demo.js
 *
 * Screenshots go to: demo-video/public/captures/
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.APP_URL || 'https://algolend-opal.vercel.app';
const OUT_DIR = path.join(__dirname, '..', 'demo-video', 'public', 'captures');
const VIEWPORT = { width: 1440, height: 900 };

// Demo credentials
const ADMIN  = { email: 'demo.admin@algolend.co.za',  password: 'Demo@1234!' };
const USER   = { email: 'demo.thabo@algolend.co.za',  password: 'Demo@1234!' };

async function shot(page, filename, opts = {}) {
  const dest = path.join(OUT_DIR, filename);
  await page.waitForTimeout(opts.wait || 3000);
  await page.screenshot({ path: dest, fullPage: false });
  console.log('  📸  ' + filename);
}

async function clickAll(page) {
  // Click "All" time-range button if present (cash ledger, loan book)
  try {
    const allBtn = page.locator('button:has-text("All"), [data-range="all"]').first();
    if (await allBtn.count()) { await allBtn.click(); await page.waitForTimeout(1500); }
  } catch {}
}

async function loginAs(page, creds) {
  await page.goto(`${BASE_URL}/auth/login.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#email-address', creds.email);
  await page.fill('#password', creds.password);
  // Click the visible Sign In button
  await page.locator('button:has-text("Sign In"), button[type="submit"]:visible').last().click();
  // Wait for redirect — Supabase + Vercel needs ~5-8s
  await page.waitForTimeout(8000);
  const url = page.url();
  if (url.includes('/auth/')) {
    console.warn(`    ⚠ Still on auth page after login attempt (${url}) — screenshots may show login page`);
  } else {
    console.log(`    ✓ Logged in, redirected to: ${url}`);
  }
}

async function captureUserPortal(browser) {
  console.log('\n👤 User Portal screenshots');
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // — Login page (before logging in) —
  await page.goto(`${BASE_URL}/auth/login.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, 'login.png');

  // — Log in as borrower —
  await loginAs(page, USER);

  // — User Dashboard —
  await page.goto(`${BASE_URL}/user-portal/index.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  await shot(page, 'user-dashboard.png');

  // — Profile page —
  // Click profile/declarations tab if SPA, or navigate directly
  try {
    await page.goto(`${BASE_URL}/user-portal/index.html#profile`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    // Try clicking the profile nav item
    const profileNav = page.locator('a[href*="profile"], [data-page="profile"], nav a:has-text("Profile")').first();
    if (await profileNav.count()) await profileNav.click();
    await page.waitForTimeout(2000);
  } catch {}
  await shot(page, 'user-profile.png');

  // — Apply for Loan —
  try {
    await page.goto(`${BASE_URL}/user-portal/pages/apply-loan.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
  } catch {
    const applyNav = page.locator('a[href*="apply"], [data-page="apply"]').first();
    if (await applyNav.count()) await applyNav.click();
    await page.waitForTimeout(2000);
  }
  await shot(page, 'user-apply.png');

  // — Loan Calculator —
  try {
    await page.goto(`${BASE_URL}/user-portal/pages/loan-calculator.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
  } catch {}
  await shot(page, 'user-calculator.png');

  // — Documents page —
  try {
    await page.goto(`${BASE_URL}/user-portal/pages/documents.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
  } catch {}
  await shot(page, 'user-documents.png');

  // — Notifications —
  try {
    await page.goto(`${BASE_URL}/user-portal/pages/notifications.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch {}
  await shot(page, 'user-notifications.png');

  await ctx.close();
}

async function captureAdmin(browser) {
  console.log('\n🔐 Admin Portal screenshots');
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // — Log in as admin —
  await loginAs(page, ADMIN);

  // — Admin Dashboard —
  await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3500);
  await shot(page, 'admin-dashboard.png');

  // — Applications queue —
  await page.goto(`${BASE_URL}/admin/applications`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, 'admin-applications.png');

  // — Application detail — navigate directly to known DISBURSED loan (id=40, Lungelo Zulu)
  await page.goto(`${BASE_URL}/admin/applications?id=40`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  await shot(page, 'admin-app-detail.png');

  // — Loan Book —
  await page.goto(`${BASE_URL}/admin/loan-book`, { waitUntil: 'networkidle', timeout: 30000 });
  await clickAll(page);
  await shot(page, 'admin-loan-book.png');

  // — Analytics —
  await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: 'networkidle', timeout: 30000 });
  await clickAll(page);
  await shot(page, 'admin-analytics.png');

  // — Cash Ledger —
  await page.goto(`${BASE_URL}/admin/cash-ledger`, { waitUntil: 'networkidle', timeout: 30000 });
  // Cash ledger defaults to "Month" — our entries are in June 2026, so Month should work
  await page.waitForTimeout(2500);
  await shot(page, 'admin-ledger.png');

  // — Users — try both Clients and Staff tabs
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3500);
  await shot(page, 'admin-users.png');

  // — Credit Rules —
  await page.goto(`${BASE_URL}/admin/credit-rules`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  await shot(page, 'admin-credit-rules.png');

  // — Incoming Payments —
  await page.goto(`${BASE_URL}/admin/incoming-payments`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, 'admin-incoming-payments.png');

  // — Outgoing Payments / Payouts — click PAID HISTORY tab to show real transactions
  await page.goto(`${BASE_URL}/admin/outgoing-payments`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  try {
    const paidTab = page.locator('button:has-text("Paid History"), [data-tab="paid"], .tab:has-text("PAID")').first();
    if (await paidTab.count()) { await paidTab.click(); await page.waitForTimeout(2000); }
  } catch {}
  await shot(page, 'admin-outgoing-payments.png');

  // — Financials —
  await page.goto(`${BASE_URL}/admin/financials`, { waitUntil: 'networkidle', timeout: 30000 });
  await clickAll(page);
  await shot(page, 'admin-financials.png');

  // — Settings —
  await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, 'admin-settings.png');

  await ctx.close();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`🌐 Capturing from: ${BASE_URL}`);
  console.log(`📁 Saving to:      ${OUT_DIR}`);

  const browser = await chromium.launch({ headless: true });

  try {
    await captureUserPortal(browser);
    await captureAdmin(browser);
    console.log('\n✅ All screenshots captured!');
  } catch (err) {
    console.error('\n❌ Capture error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
