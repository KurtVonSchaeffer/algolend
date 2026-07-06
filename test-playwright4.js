const { chromium } = require('playwright');

// We will just run the start of record-walkthrough.js with console logs
// and see what URL it ends up on after performLogin.

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
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.route('**/*.supabase.co/**', async (route) => {
    const url = route.request().url();
    
    if (url.includes('/auth/v1/')) {
      let session = MOCK_SESSION;
      try {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.email && body.email.includes('thandiwe')) session = MOCK_CLIENT_SESSION;
      } catch (_) {}
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
      return;
    }

    if (url.includes('/rest/v1/')) {
      const isRpc = url.includes('/rpc/');
      let data = isRpc ? [] : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      return;
    }
    
    await route.continue();
  });

  await page.goto('http://localhost:3002/auth/login.html');
  await page.fill('#email-address', 'thandiwe.nkosi@example.com');
  await page.fill('#password', 'demo-password-123');
  
  console.log('Clicking submit...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('#auth-form button[type="submit"]'),
  ]);
  
  await page.waitForTimeout(2000);
  console.log('URL after performLogin:', page.url());

  // In record-walkthrough.js: 
  console.log('Visiting dashboard...');
  await page.goto('http://localhost:3002/user-portal/?page=dashboard', { waitUntil: 'networkidle' });
  console.log('URL after visiting dashboard:', page.url());

  await browser.close();
})();
