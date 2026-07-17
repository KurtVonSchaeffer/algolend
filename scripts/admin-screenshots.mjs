import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../screenshots/admin');
const BASE = 'http://localhost:5174/admin-panel';

const PAGES = [
  { name: '01-dashboard',          path: '/dashboard'          },
  { name: '02-applications',       path: '/applications'       },
  { name: '03-users',              path: '/users'              },
  { name: '04-mandates',           path: '/mandates'           },
  { name: '05-incoming-payments',  path: '/incoming-payments'  },
  { name: '06-outgoing-payments',  path: '/outgoing-payments'  },
  { name: '07-analytics',          path: '/analytics'          },
  { name: '08-financials',         path: '/financials'         },
  { name: '09-credit-rules',       path: '/credit-rules'       },
  { name: '10-portfolio',          path: '/portfolio'          },
  { name: '11-loan-book',          path: '/loan-book'          },
  { name: '12-cash-ledger',        path: '/cash-ledger'        },
  { name: '13-sacrra',             path: '/sacrra'             },
  { name: '13b-sacrra-validator',  path: '/sacrra-validator'   },
  { name: '14-ncr-reporting',      path: '/ncr-reporting'      },
  { name: '15-ncr-registers',      path: '/ncr-registers'      },
  { name: '16-compliance-tracker', path: '/compliance-tracker' },
  { name: '17-goaml',              path: '/goaml'              },
  { name: '18-settings',           path: '/settings'           },
  { name: '19-create-application', path: '/create-application' },
];

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Desktop viewport (1440×900)
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // Enable demo mode
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('algolend_demo', '1');
  });

  for (const { name, path } of PAGES) {
    console.log(`Capturing ${name}...`);
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 15000 });
      await new Promise(r => setTimeout(r, 800));
      // For the validator page, trigger the run button so results are visible
      if (path.includes('sacrra-validator')) {
        const btn = await page.$('button');
        if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1200)); }
      }
      const outPath = join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  → saved ${outPath}`);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nDone — screenshots/admin/');
}

run().catch(err => { console.error(err); process.exit(1); });
