const { chromium } = require('playwright');
const MOCK_CLIENT_SESSION = {
  access_token: 'mock-client-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-client-refresh',
  user: {
    id: 'mock-client-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'thandiwe.nkosi@example.com',
    app_metadata: { provider: 'email', role: 'borrower' },
    user_metadata: { role: 'borrower', full_name: 'Thandiwe Nkosi' },
  },
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  await page.route('**/*.supabase.co/**', async (route) => {
    let session = MOCK_CLIENT_SESSION;
    const url = route.request().url();
    if (url.includes('/rest/v1/rpc/is_role_or_higher')) {
       await route.fulfill({ status: 200, contentType: 'application/json', body: 'false' });
       return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });
  await page.goto('http://localhost:3002/auth/login.html');
  await page.fill('#email-address', 'thandiwe.nkosi@example.com');
  await page.fill('#password', 'demo-password-123');
  await Promise.all([
    page.waitForNavigation().catch(e => console.log('nav error', e)),
    page.click('#auth-form button[type="submit"]')
  ]);
  await page.waitForTimeout(1000);
  console.log('URL after login:', page.url());
  
  await page.goto('http://localhost:3002/user-portal/?page=dashboard', { waitUntil: 'networkidle' });
  console.log('URL after goto user portal:', page.url());
  await browser.close();
})();
