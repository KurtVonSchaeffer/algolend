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

  try {
    // 1. Client flow
    console.log('Capturing client flow...');
    await page.goto('http://localhost:3002/auth/login.html');
    await page.waitForTimeout(1000);
    
    // Type credentials
    await page.fill('#email-address', 'vonschaefferk@gmail.com');
    await page.fill('#password', 'Pmillers@19');
    await page.click('button[type="submit"]');
    
    // Wait for navigation and dashboard to load
    await page.waitForTimeout(4000);

    console.log('Capturing loan-calculator...');
    await page.goto('http://localhost:3002/user-portal/loan-calculator.html');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, 'scene2-calc.png') });

    console.log('Capturing apply-loan...');
    await page.goto('http://localhost:3002/user-portal/pages/apply-loan.html');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, 'scene3-apply1.png') });

    console.log('Capturing apply-loan-2...');
    await page.goto('http://localhost:3002/user-portal/pages/apply-loan-2.html');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, 'scene3-apply2.png') });

    console.log('Capturing client dashboard...');
    await page.goto('http://localhost:3002/user-portal/pages/dashboard.html');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, 'scene3-dashboard.png') });

    // Logout / Clear session
    console.log('Clearing session for admin flow...');
    await context.clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    // 2. Admin flow
    console.log('Capturing admin portal login...');
    await page.goto('http://localhost:3002/auth/login.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene4-login.png') });
    
    // Type credentials
    await page.fill('#email-address', 'yexipod797@mustaer.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to admin
    await page.waitForTimeout(4000);

    console.log('Capturing admin dashboard / queue...');
    await page.goto('http://localhost:3002/admin/dashboard.html');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outputDir, 'scene4-queue.png') });

    console.log('Capturing admin application detail...');
    await page.goto('http://localhost:3002/admin/application-detail.html');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outputDir, 'scene5-detail.png') });

    console.log('Capturing admin cash ledger...');
    await page.goto('http://localhost:3002/admin/cash-ledger.html');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outputDir, 'scene5-ledger.png') });

    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch((err) => {
  console.error('Capture process failed:', err);
  process.exit(1);
});
