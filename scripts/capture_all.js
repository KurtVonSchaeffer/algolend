// Comprehensive screenshot capture for demo video
const { chromium } = require('playwright');
const path = require('path');

const OUT = '/Users/kurtvonschaeffer/Algolend/demo-video/public/captures';
const BASE = 'https://algolend-opal.vercel.app';
const VP = { width: 1440, height: 900 };

async function loginAs(ctx, email, pass) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/auth/login.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#email-address', email);
  await page.fill('#password', pass);
  await page.locator('button:has-text("Sign In")').last().click();
  await page.waitForTimeout(10000);
  console.log('  logged in, url:', page.url());
  return page;
}

async function shot(page, file, waitMs = 3000) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log('📸', file);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── USER PORTAL ─────────────────────────────────────────────────────────────
  console.log('\n── User portal ──');
  const uctx = await browser.newContext({ viewport: VP });
  const up = await loginAs(uctx, 'demo.thabo@algolend.co.za', 'Demo@1234!');

  // Login page (capture before login)
  const lctx = await browser.newContext({ viewport: VP });
  const lp = await lctx.newPage();
  await lp.goto(BASE + '/auth/login.html', { waitUntil: 'networkidle', timeout: 30000 });
  await lp.waitForTimeout(2000);
  await shot(lp, 'login.png', 500);
  await lctx.close();

  // Dashboard — already showing
  await up.goto(BASE + '/user-portal/?page=dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(up, 'user-dashboard.png', 7000);

  // Apply for Loan — SPA route
  await up.goto(BASE + '/user-portal/?page=apply-loan', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(up, 'user-apply.png', 5000);

  // Loan Calculator — SPA route
  await up.goto(BASE + '/user-portal/?page=loan-calculator', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(up, 'user-calculator.png', 4000);

  // Transcripts (document centre)
  await up.goto(BASE + '/user-portal/?page=transcripts', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(up, 'user-documents.png', 4000);

  // Profile
  await up.goto(BASE + '/user-portal/?page=profile', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(up, 'user-profile.png', 4000);

  await uctx.close();

  // ── ADMIN PORTAL ─────────────────────────────────────────────────────────────
  console.log('\n── Admin portal ──');
  const actx = await browser.newContext({ viewport: VP });
  const ap = await loginAs(actx, 'demo.admin@algolend.co.za', 'Demo@1234!');

  // Dashboard
  await ap.goto(BASE + '/admin/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-dashboard.png', 6000);

  // Applications
  await ap.goto(BASE + '/admin/applications', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-applications.png', 5000);

  // Application Detail — use app ID 40 (DISBURSED loan L1028)
  await ap.goto(BASE + '/admin/application-detail?id=40', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-app-detail.png', 6000);

  // Loan Book
  await ap.goto(BASE + '/admin/loan-book', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-loan-book.png', 5000);

  // Credit Rules
  await ap.goto(BASE + '/admin/credit-rules', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-credit-rules.png', 4000);

  // Users
  await ap.goto(BASE + '/admin/users', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-users.png', 5000);

  // Cash Ledger — click "All" to show all time
  await ap.goto(BASE + '/admin/cash-ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await ap.waitForTimeout(3000);
  try { await ap.locator('button:has-text("All")').first().click(); await ap.waitForTimeout(2000); } catch {}
  await shot(ap, 'admin-ledger.png', 2000);

  // Incoming Payments — ALL tab
  await ap.goto(BASE + '/admin/incoming-payments', { waitUntil: 'networkidle', timeout: 30000 });
  await ap.waitForTimeout(4000);
  try { await ap.locator('text=ALL').first().click(); await ap.waitForTimeout(3000); } catch {}
  await shot(ap, 'admin-incoming-payments.png', 2000);

  // Outgoing Payments
  await ap.goto(BASE + '/admin/outgoing-payments', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-outgoing-payments.png', 6000);

  // Analytics
  await ap.goto(BASE + '/admin/analytics', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(ap, 'admin-analytics.png', 5000);

  // Settings — scroll to show branding section
  await ap.goto(BASE + '/admin/settings', { waitUntil: 'networkidle', timeout: 30000 });
  await ap.waitForTimeout(4000);
  await ap.evaluate(() => window.scrollTo(0, 400));
  await shot(ap, 'admin-settings.png', 1000);

  await actx.close();
  await browser.close();
  console.log('\n✅ All screenshots captured');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
