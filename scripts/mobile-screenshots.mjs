import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../screenshots/mobile');

const BASE = 'http://localhost:5173';

const PAGES = [
  { name: '01-login',       url: '/auth/login',              demo: false },
  { name: '02-dashboard',   url: '/user-portal/dashboard',   demo: true  },
  { name: '03-apply',       url: '/user-portal/apply',       demo: true  },
  { name: '04-calculator',  url: '/user-portal/calculator',  demo: true  },
  { name: '05-transactions',url: '/user-portal/transactions', demo: true  },
  { name: '06-transcripts', url: '/user-portal/transcripts', demo: true  },
  { name: '07-support',     url: '/user-portal/support',     demo: true  },
  { name: '08-profile',     url: '/user-portal/profile',     demo: true  },
];

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Mobile viewport (iPhone 14 Pro)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  // Enable demo mode in localStorage for pages that need it
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('algolend_demo', '1');
  });

  for (const { name, url } of PAGES) {
    console.log(`Capturing ${name}...`);
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0', timeout: 15000 });

    // Small pause for animations to settle
    await new Promise(r => setTimeout(r, 800));

    const path = join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(`  → saved ${path}`);
  }

  await browser.close();
  console.log('\nAll screenshots saved to screenshots/mobile/');
}

run().catch(err => { console.error(err); process.exit(1); });
