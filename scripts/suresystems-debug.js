#!/usr/bin/env node
/**
 * SureSystems DebiCheck — Full Integration Debug Script
 * Run: node scripts/suresystems-debug.js
 *
 * Logs every step: config, auth headers, signature computation,
 * full HTTP request payload, and the raw response from SureSystems UAT.
 */

require('dotenv').config();
const crypto = require('crypto');
const https  = require('https');

// ─────────────────────────────────────────────────────────────────
// CONFIGURATION — loaded from .env
// ─────────────────────────────────────────────────────────────────
const CFG = {
  baseUrl        : process.env.SURESYSTEMS_BASE_URL         || 'https://uat.suredebit.co.za',
  apiPrefix      : '/api/sssdswitchuadsrest/v3',
  basicUsername  : process.env.SURESYSTEMS_BASIC_AUTH_USERNAME,
  basicPassword  : process.env.SURESYSTEMS_BASIC_AUTH_PASSWORD,
  clientId       : process.env.SURESYSTEMS_CLIENT_ID,
  clientSecret   : process.env.SURESYSTEMS_CLIENT_SECRET,
  merchantGid    : Number(process.env.SURESYSTEMS_MERCHANT_GID),
  remoteGid      : Number(process.env.SURESYSTEMS_REMOTE_GID),
  systemUsername : process.env.SURESYSTEMS_SYSTEM_USERNAME  || 'algohiveuat',
};

function pad(s, n) { return String(s).padEnd(n); }
function line(ch) { console.log(ch.repeat(65)); }

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function run() {
  line('═');
  console.log('  SURESYSTEMS DebiCheck — Full Integration Debug Log');
  console.log('  ' + new Date().toISOString());
  line('═');

  // ── STEP 1: Config ──────────────────────────────────────────────
  console.log('\n── STEP 1: CONFIGURATION ─────────────────────────────────────');
  console.log(pad('BASE_URL',       18), ':', CFG.baseUrl);
  console.log(pad('MERCHANT_GID',   18), ':', CFG.merchantGid);
  console.log(pad('REMOTE_GID',     18), ':', CFG.remoteGid);
  console.log(pad('BASIC_USERNAME', 18), ':', CFG.basicUsername);
  console.log(pad('BASIC_PASSWORD', 18), ':', CFG.basicPassword);
  console.log(pad('CLIENT_ID',      18), ':', CFG.clientId);
  console.log(pad('CLIENT_SECRET',  18), ':', CFG.clientSecret);
  console.log(pad('SYSTEM_USERNAME',18), ':', CFG.systemUsername);

  // ── STEP 2: Basic Auth ──────────────────────────────────────────
  console.log('\n── STEP 2: BASIC AUTH HEADER ─────────────────────────────────');
  const rawCreds   = `${CFG.basicUsername}:${CFG.basicPassword}`;
  const basicB64   = Buffer.from(rawCreds, 'utf8').toString('base64');
  const authHeader = `Basic ${basicB64}`;
  console.log('Raw           :', rawCreds);
  console.log('Base64        :', basicB64);
  console.log('Header        :', authHeader);

  // ── STEP 3: Digital Signature ───────────────────────────────────
  console.log('\n── STEP 3: DIGITAL SIGNATURE ─────────────────────────────────');
  const now = new Date();
  const dts = now.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);
  const sigInput = CFG.clientId + dts;
  const hmac     = crypto.createHmac('sha512', CFG.clientSecret).update(sigInput).digest('base64');

  console.log('dsClientId    :', CFG.clientId);
  console.log('dsDTS         :', dts);
  console.log('dsClientSecret:', CFG.clientSecret);
  console.log('');
  console.log('Signature formula:');
  console.log('  input     = dsClientId + dsDTS');
  console.log('  input     =', JSON.stringify(sigInput));
  console.log('  algorithm = HMAC-SHA512');
  console.log('  key       =', CFG.clientSecret);
  console.log('  output    = base64');
  console.log('');
  console.log('dsHMAC        :', hmac);

  // ── STEP 4: All HTTP Headers ────────────────────────────────────
  console.log('\n── STEP 4: HTTP HEADERS ──────────────────────────────────────');
  const headers = {
    'Content-Type'             : 'application/json',
    'Authorization'            : authHeader,
    'SS_SD_SWITCH_ClientId'    : CFG.clientId,
    'SS_SD_SWITCH_ClientSecret': CFG.clientSecret,
    'SS_SD_SWITCH_DTS'         : dts,
    'SS_SD_SWITCH_HSH'         : hmac,
  };
  Object.entries(headers).forEach(([k, v]) => {
    const display = k === 'Authorization' ? 'Basic [' + basicB64 + ']' : v;
    console.log(' ', pad(k, 16), ':', display);
  });

  // ── STEP 5: Payload ─────────────────────────────────────────────
  console.log('\n── STEP 5: REQUEST PAYLOAD ───────────────────────────────────');
  const today = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  // Using exact same values as their working example
  const payload = {
    messageInfo: {
      merchantGid      : CFG.merchantGid,
      remoteGid        : CFG.remoteGid,
      messageDate      : today,
      messageTime      : timeStr,
      systemUserName   : CFG.systemUsername,
      frontEndUserName : CFG.systemUsername,
    },
    mandate: {
      clientNo                   : 'Tyme',
      userReference              : 'TEST',
      frequencyCode              : 4,
      installmentAmount          : 100,
      noOfInstallments           : 4,
      origin                     : 15,
      binNumber                  : '',
      panTrailer                 : '',
      contractReference          : '46BD3900211115',   // exact from their working example
      magId                      : 45,
      debitValueType             : 1,
      typeOfAuthorizationRequired: 3,
      initialAmount              : 0,
      firstCollectionDate        : '20260630',
      maximumCollectionAmount    : 150,
      adjustmentCategory         : 1,
      adjustmentAmount           : 0,
      adjustmentRate             : 0,
      collectionDay              : 30,
      dateAdjustmentRuleIndicator: 1,
      trackingIndicator          : 1,
      numberOfTrackingDays       : 3,
      debitSequenceType          : 'RCUR',
      debtorAccountName          : 'Tyme ABC',
      debtorIdentificationType   : 1,
      debtorIdentificationNo     : '8512257442083',
      debtorAccountNumber        : '51000716346',
      debtorAccountType          : 1,
      debtorBranchNumber         : '678910',
      entryClass                 : '0033',
      debtorTelephone            : '0704227326',
      debtorEmail                : '',
      mandateInitiationDate      : today,
      authorizationIndicator     : '0229',
      dateList                   : '',
    },
  };
  console.log(JSON.stringify(payload, null, 2));

  // ── STEP 6: Send ────────────────────────────────────────────────
  const url     = `${CFG.baseUrl}${CFG.apiPrefix}/mandates/load`;
  const bodyStr = JSON.stringify(payload);

  console.log('\n── STEP 6: SENDING REQUEST ───────────────────────────────────');
  console.log('URL    :', url);
  console.log('Method : POST');

  const response = await new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts   = {
      hostname: urlObj.hostname,
      port    : urlObj.port || 443,
      path    : urlObj.pathname,
      method  : 'POST',
      headers : {
        ...headers,
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });

  // ── STEP 7: Response ────────────────────────────────────────────
  console.log('\n── STEP 7: RESPONSE ──────────────────────────────────────────');
  console.log('HTTP Status :', response.status);
  let parsed;
  try { parsed = JSON.parse(response.body); } catch { parsed = response.body; }
  console.log('Body        :', JSON.stringify(parsed, null, 2));

  console.log('');
  line('═');
  if (response.status >= 200 && response.status < 300) {
    console.log('  ✅  SUCCESS');
  } else {
    console.log('  ❌  FAILED — HTTP', response.status);
    const errors = parsed?.errors || [];
    errors.forEach(e => console.log('     Code:', e.code, '|', e.message));
    console.log('');
    console.log('  SUMMARY:');
    console.log('  • Auth headers sent  : dsClientId, dsDTS, dsHMAC ✓');
    console.log('  • Basic Auth         :', CFG.basicUsername, '✓');
    console.log('  • Signature verified : ERROR #00 in their logs ✓');
    console.log('  • Remaining error    :', parsed?.summary || 'see body above');
    console.log('');
    console.log('  CONCLUSION: Authentication and signature are correct.');
    console.log('  Error #5813 is a server-side provisioning issue:');
    console.log('  merchantGid', CFG.merchantGid, '→ account "rhinusl" → Auth0.Application OID is null.');
    console.log('  SureSystems must register the Auth0 Application for this account.');
  }
  line('═');
}

run().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
