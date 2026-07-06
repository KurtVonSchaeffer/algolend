const { chromium } = require('playwright');
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
  },
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('**/*.supabase.co/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) });
  });
  await page.goto('http://localhost:3002/auth/login.html');
  await page.fill('#email-address', 'consultant@algolend.co.za');
  await page.fill('#password', 'demo-password-123');
  await Promise.all([
    page.waitForNavigation().catch(e => console.log('nav error', e)),
    page.click('#auth-form button[type="submit"]')
  ]);
  await page.waitForTimeout(1000);
  const url = page.url();
  console.log('URL after login:', url);
  await browser.close();
})();
