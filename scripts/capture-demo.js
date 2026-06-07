const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  console.log('Launching browser for screenshot captures...');
  const browser = await chromium.launch({ headless: true });
  
  // Create page with 2x scale factor for high DPI / sharp text
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();

  // Create captures folder
  const outputDir = path.join(__dirname, '../demo-video/public/captures');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Intercept all Supabase REST and Auth requests to inject mock data
  await page.route('**/*.supabase.co/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    
    // Auth requests
    if (url.includes('/auth/v1/')) {
      if (url.includes('/token') || url.includes('/session') || url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-access-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'mock-refresh-token',
            user: {
              id: 'mock-user-id',
              aud: 'authenticated',
              role: 'authenticated',
              email: 'consultant@algolend.co.za',
              app_metadata: { provider: 'email', role: 'base_admin' },
              user_metadata: { role: 'base_admin', full_name: 'Lead consultant' },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          })
        });
        return;
      }
    }

    // Database queries
    if (url.includes('/rest/v1/')) {
      if (url.includes('rpc/is_role_or_higher')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(true)
        });
        return;
      }

      if (url.includes('profiles')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-user-id',
            full_name: 'John Doe',
            email: 'john.doe@example.com',
            cell_tel_no: '+27 82 123 4567',
            identity_number: '9001015000081',
            address: '123 Vilakazi St, Soweto, 1804',
            role: 'borrower',
            kyc_verified: true,
            kyc_status: 'verified'
          })
        });
        return;
      }

      if (url.includes('system_settings')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'global',
            company_name: 'AlgoLend',
            primary_color: '#E7762E',
            secondary_color: '#F97316',
            tertiary_color: '#FACC15',
            theme_mode: 'light',
            carousel_slides: [
              { title: 'A Leap to Financial Freedom', text: 'We offer credit of up to R200,000, with repayment terms extending up to a maximum of 36 months.' },
              { title: 'Flexible Repayments', text: "Repayment terms are tailored to each client's cash flow, risk profile, and agreed-upon conditions." },
              { title: 'Save on Interest', text: 'Our interest rates and fees are highly competitive, ensuring great value for our clients.' }
            ]
          })
        });
        return;
      }

      if (url.includes('loan_applications')) {
        // Return a mock application list
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1042,
              user_id: 'mock-user-id',
              amount: 5000,
              term_months: 3,
              status: 'STARTED',
              repayment_start_date: '2026-07-01',
              offer_principal: 5000,
              offer_monthly_repayment: 1850,
              offer_total_repayment: 5550,
              offer_interest_rate: 5,
              profiles: {
                full_name: 'John Doe',
                email: 'john.doe@example.com',
                identity_number: '9001015000081'
              },
              created_at: new Date().toISOString()
            }
          ])
        });
        return;
      }

      if (url.includes('branches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'b1', name: 'Johannesburg Main' },
            { id: 'b2', name: 'Soweto Branch' }
          ])
        });
        return;
      }

      if (url.includes('cash_journal')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              entry_date: '2026-06-07',
              entry_type: 'cash_out',
              category: 'loan_disbursement',
              description: 'Disbursement for Loan #1042 - John Doe',
              reference: 'C1042-L001',
              amount: 5000.00,
              created_by_name: 'Lead consultant'
            },
            {
              id: 2,
              entry_date: '2026-06-06',
              entry_type: 'cash_in',
              category: 'repayment',
              description: 'Repayment received - Jane Smith',
              reference: 'C0982-L003',
              amount: 1250.00,
              created_by_name: 'Lead consultant'
            },
            {
              id: 3,
              entry_date: '2026-06-05',
              entry_type: 'opening_balance',
              category: 'other',
              description: 'Opening vault balance',
              reference: 'VAULT-INIT',
              amount: 25000.00,
              created_by_name: 'System'
            }
          ])
        });
        return;
      }
    }

    // Default mock response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  // Inject session details before scripts run
  await page.addInitScript(() => {
    const mockSession = {
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'mock-user-id',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'consultant@algolend.co.za',
        app_metadata: { provider: 'email', role: 'base_admin' },
        user_metadata: { role: 'base_admin', full_name: 'Lead consultant' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
    const keys = [
      'sb-yakhrwrfmdrnhfgzfiwm-auth-token',
      'sb-jmnjkxfxenrudpvjprcu-auth-token',
      'sb-auth-token'
    ];
    for (const key of keys) {
      window.sessionStorage.setItem(key, JSON.stringify(mockSession));
      window.localStorage.setItem(key, JSON.stringify(mockSession));
    }
  });

  // 1. Calculator Screen (User Portal)
  console.log('Capturing loan-calculator...');
  await page.goto('http://localhost:3002/user-portal/loan-calculator.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene2-calc.png') });

  // 2. Client Application - Personal Info Form
  console.log('Capturing apply-loan...');
  await page.goto('http://localhost:3002/user-portal/pages/apply-loan.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene3-apply1.png') });

  // 3. Client Onboarding - Bank Verification
  console.log('Capturing apply-loan-2...');
  await page.goto('http://localhost:3002/user-portal/pages/apply-loan-2.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene3-apply2.png') });

  // 4. Client Dashboard Screen
  console.log('Capturing client dashboard...');
  await page.goto('http://localhost:3002/user-portal/pages/dashboard.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene3-dashboard.png') });

  // 5. Admin Portal Login
  console.log('Capturing admin portal login...');
  await page.goto('http://localhost:3002/auth/login.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene4-login.png') });

  // 6. Admin Dashboard - Applications Queue
  console.log('Capturing admin dashboard / queue...');
  await page.goto('http://localhost:3002/admin/dashboard.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene4-queue.png') });

  // 7. Admin Application Detail
  console.log('Capturing admin application detail...');
  await page.goto('http://localhost:3002/admin/application-detail.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene5-detail.png') });

  // 8. Admin Cash Ledger
  console.log('Capturing admin cash ledger...');
  await page.goto('http://localhost:3002/admin/cash-ledger.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, 'scene5-ledger.png') });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

captureScreenshots().catch((err) => {
  console.error('Capture process failed:', err);
  process.exit(1);
});
