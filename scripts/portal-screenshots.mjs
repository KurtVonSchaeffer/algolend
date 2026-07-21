import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../screenshots/portal');
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'dashboard',    path: '/dashboard' },
  { name: 'apply',        path: '/apply' },
  { name: 'transactions', path: '/transactions' },
  { name: 'profile',      path: '/profile' },
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

await page.evaluateOnNewDocument(() => {
  localStorage.setItem('algolend_demo', '1');
  localStorage.setItem('algolend_auth_token', 'demo-token');
});

for (const { name, path } of PAGES) {
  await page.goto(`http://localhost:5173${path}`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log(`  saved ${name}.png`);
}
await browser.close();
console.log('Done — screenshots/portal/');
