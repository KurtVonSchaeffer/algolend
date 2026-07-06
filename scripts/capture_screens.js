const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Capture Login
  await page.goto('http://localhost:3002/auth/login.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'demo-video/public/captures/scene4-login.png' });

  // Capture Client Portal
  await page.goto('http://localhost:3002/showcase.html', { waitUntil: 'networkidle' });
  await page.click('.tab-btn:nth-child(3)');
  await page.waitForTimeout(1000);
  
  let clip = await page.evaluate(() => {
    const el = document.querySelector('.preview-container');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  
  if (clip) {
    await page.screenshot({ path: 'demo-video/public/captures/scene2-calc.png', clip });
  } else {
    await page.screenshot({ path: 'demo-video/public/captures/scene2-calc.png' });
  }

  // Capture Admin Dashboard
  await page.click('.tab-btn:nth-child(1)');
  await page.waitForTimeout(1000);
  clip = await page.evaluate(() => {
    const el = document.querySelector('.preview-container');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  if (clip) {
    await page.screenshot({ path: 'demo-video/public/captures/scene3-dashboard.png', clip });
  } else {
    await page.screenshot({ path: 'demo-video/public/captures/scene3-dashboard.png' });
  }

  await browser.close();
})();
