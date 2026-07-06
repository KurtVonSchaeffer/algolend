#!/usr/bin/env node
/**
 * Capture authenticated screenshots of every admin page using Puppeteer.
 * Logs in via Supabase, injects the session into localStorage, then navigates each page.
 */

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE = 'http://localhost:3002';
const EMAIL = 'vonschaefferk@gmail.com';
const PASSWORD = 'Pmillers@19';
const OUT_DIR = path.join(__dirname, 'screenshots');

const PAGES = [
  ['00-login',              'auth/login.html',                 false],
  ['01-dashboard',          'admin/dashboard',                 true],
  ['02-applications',       'admin/applications',              true],
  ['03-loan-book',          'admin/loan-book',                 true],
  ['04-users',              'admin/users',                     true],
  ['05-cash-ledger',        'admin/cash-ledger',               true],
  ['06-incoming-payments',  'admin/incoming-payments',         true],
  ['07-outgoing-payments',  'admin/outgoing-payments',         true],
  ['08-credit-rules',       'admin/credit-rules',              true],
  ['09-sacrra',             'admin/sacrra',                    true],
  ['10-sacrra-validator',   'admin/sacrra-validator',          true],
  ['11-settings',           'admin/settings',                  true],
];

(async () => {
  // 1. Get Supabase session
  console.log('🔐 Logging in via Supabase...');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw error;
  const session = data.session;
  console.log(`✅ Session for ${data.user.email} — role: ${data.user.app_metadata?.role}`);

  // Supabase storage key based on project ref
  const projectRef = process.env.SUPABASE_URL.match(/\/\/([^.]+)/)[1];
  const STORAGE_KEY = `sb-${projectRef}-auth-token`;
  const storageValue = JSON.stringify(session);

  // 2. Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Admin client uses sessionStorage (not localStorage) — see supabaseClient.js
  // Inject the Supabase session BEFORE any page script runs.
  await page.evaluateOnNewDocument((key, val) => {
    try {
      sessionStorage.setItem(key, val);
      localStorage.setItem(key, val); // belt-and-braces
    } catch {}
  }, STORAGE_KEY, storageValue);

  for (const [name, path_, needsAuth] of PAGES) {
    const url = `${BASE}/${path_}`;
    console.log(`📸 ${name} → ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (e) {
      console.warn(`   ⚠️  timeout, continuing: ${e.message.slice(0,80)}`);
    }

    // Wait for any async data / charts to settle
    await new Promise(r => setTimeout(r, 3500));

    const filePath = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    const size = fs.statSync(filePath).size;
    console.log(`   ✅ saved (${(size/1024).toFixed(0)}KB)`);
  }

  await browser.close();
  console.log('\n🎉 Done! Screenshots in:', OUT_DIR);
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
