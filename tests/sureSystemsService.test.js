/**
 * SureSystems Service — Unit Tests
 * 
 * Tests all pure business logic in sureSystemsService.js.
 * No live API calls — just validating payload construction, auth, dates, config, etc.
 * 
 * Run:  node tests/sureSystemsService.test.js
 */

// Inject dummy env vars BEFORE requiring the service
process.env.SURESYSTEMS_BASE_URL = 'https://uat.suredebit.co.za';
process.env.SURESYSTEMS_BASIC_AUTH_USERNAME = 'test_user';
process.env.SURESYSTEMS_BASIC_AUTH_PASSWORD = 'test_pass';
process.env.SURESYSTEMS_CLIENT_ID = 'client123';
process.env.SURESYSTEMS_CLIENT_SECRET = 'secret456';
process.env.SURESYSTEMS_MERCHANT_GID = '99';
process.env.SURESYSTEMS_REMOTE_GID = '42';
process.env.SURESYSTEMS_SYSTEM_USERNAME = 'apiuser';
process.env.SURESYSTEMS_HEADER_PREFIX = 'SS';
process.env.SURESYSTEMS_USE_MTLS = 'false';

// Supabase stubs (required at load time by supabaseServer.js)
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_ANON_KEY = 'fake-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';

const path = require('path');
const service = require(path.resolve(__dirname, '..', 'services', 'sureSystemsService'));
const t = service._test;

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function assertEq(actual, expected, label) {
  const pass = actual === expected;
  if (!pass) {
    label += ` (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`;
  }
  assert(pass, label);
}

function assertType(value, type, label) {
  assert(typeof value === type, `${label} is ${type}`);
}

function section(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);
}

// =============================================
// 1. Utility functions
// =============================================
section('Utility functions: toBoolean');

assertEq(t.toBoolean('true'), true, 'toBoolean("true") → true');
assertEq(t.toBoolean('false'), false, 'toBoolean("false") → false');
assertEq(t.toBoolean('1'), true, 'toBoolean("1") → true');
assertEq(t.toBoolean('0'), false, 'toBoolean("0") → false');
assertEq(t.toBoolean('yes'), true, 'toBoolean("yes") → true');
assertEq(t.toBoolean('no'), false, 'toBoolean("no") → false');
assertEq(t.toBoolean('garbage', false), false, 'toBoolean("garbage") → fallback false');
assertEq(t.toBoolean(null, true), true, 'toBoolean(null) → fallback true');

section('Utility functions: toNumber');

assertEq(t.toNumber('42'), 42, 'toNumber("42") → 42');
assertEq(t.toNumber('abc', 99), 99, 'toNumber("abc") → fallback 99');
assertEq(t.toNumber(null, 0), 0, 'toNumber(null) → fallback 0');
assertEq(t.toNumber('3.14'), 3.14, 'toNumber("3.14") → 3.14');

section('Utility functions: isPlaceholderValue');

assert(t.isPlaceholderValue(null), 'null is placeholder');
assert(t.isPlaceholderValue(undefined), 'undefined is placeholder');
assert(t.isPlaceholderValue(''), 'empty string is placeholder');
assert(t.isPlaceholderValue('your_client_id'), '"your_client_id" is placeholder');
assert(t.isPlaceholderValue('CHANGEME'), '"CHANGEME" is placeholder (case-insensitive)');
assert(!t.isPlaceholderValue('real_value'), '"real_value" is NOT placeholder');
assert(!t.isPlaceholderValue('client123'), '"client123" is NOT placeholder');

// =============================================
// 2. Date functions
// =============================================
section('Date functions: getToday');

const today = t.getToday();
assertEq(today.length, 8, 'getToday() returns 8 chars (YYYYMMDD)');
assert(/^\d{8}$/.test(today), 'getToday() is all digits');

section('Date functions: getNow');

const now = t.getNow();
assertEq(now.length, 6, 'getNow() returns 6 chars (HHMMSS)');
assert(/^\d{6}$/.test(now), 'getNow() is all digits');

section('Date functions: toSureSystemsDate');

assertEq(t.toSureSystemsDate('2025-06-15'), '20250615', 'ISO date → YYYYMMDD');
assertEq(t.toSureSystemsDate('2025-01-01T12:00:00Z'), '20250101', 'ISO datetime → YYYYMMDD');
assertEq(t.toSureSystemsDate(null), null, 'null → null');
assertEq(t.toSureSystemsDate(''), null, 'empty → null');
assertEq(t.toSureSystemsDate('not-a-date'), null, 'invalid → null');

// =============================================
// 3. Config validation
// =============================================
section('Config validation: getMissingConfig');

{
  const missing = t.getMissingConfig();
  assert(Array.isArray(missing), 'getMissingConfig returns array');
  assertEq(missing.length, 0, 'No missing config with all env vars set');
}

section('Config: assertConfigured (should NOT throw)');

{
  let threw = false;
  try { t.assertConfigured(); } catch (e) { threw = true; }
  assert(!threw, 'assertConfigured() does not throw when all vars set');
}

section('Config: getConfigStatus shape');

{
  const status = service.getConfigStatus();
  assert(status.configured === true, 'configured is true');
  assertType(status.useMtls, 'boolean', 'useMtls');
  assertEq(status.headerPrefix, 'SS', 'headerPrefix is "SS"');
  assertEq(status.merchantGid, 99, 'merchantGid is 99');
  assertEq(status.remoteGid, 42, 'remoteGid is 42');
  assert(Array.isArray(status.missing), 'missing is array');
  assertEq(status.missing.length, 0, 'missing is empty');
}

// =============================================
// 4. Auth & Signature headers
// =============================================
section('Auth: buildBasicAuthHeader');

{
  const header = t.buildBasicAuthHeader();
  assert(header.startsWith('Basic '), 'starts with "Basic "');
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  assertEq(decoded, 'test_user:test_pass', 'decodes to username:password');
}

section('Auth: buildSignatureHeaders');

{
  const headers = t.buildSignatureHeaders();
  assert('SS_SD_SWITCH_ClientId' in headers, 'has SS_SD_SWITCH_ClientId header');
  assert('SS_SD_SWITCH_ClientSecret' in headers, 'has SS_SD_SWITCH_ClientSecret header');
  assert('SS_SD_SWITCH_DTS' in headers, 'has SS_SD_SWITCH_DTS header');
  assert('SS_SD_SWITCH_HSH' in headers, 'has SS_SD_SWITCH_HSH header');
  assertEq(headers.SS_SD_SWITCH_ClientId, 'client123', 'SS_SD_SWITCH_ClientId matches client ID');
  assert(headers.SS_SD_SWITCH_DTS.length >= 19, 'SS_SD_SWITCH_DTS is datetime string (>= 19 chars)');
  assert(headers.SS_SD_SWITCH_HSH.length > 20, 'SS_SD_SWITCH_HSH is a non-trivial hash string');
}

// =============================================
// 5. Contract reference
// =============================================
section('Contract Reference: buildContractReference');

{
  const ref = t.buildContractReference(99, 123);
  assert(typeof ref === 'string', 'returns a string');
  assertEq(ref.length, 14, 'reference is 14 characters long');
  // First 4 chars should be hex of merchantGid (99 → 0x63 → '0063')
  assert(ref.startsWith('0063'), 'starts with hex of 99 = 0063');
  // test with large gid
  const ref2 = t.buildContractReference(65535, 999999);
  assertEq(ref2.length, 14, 'large gid reference is still 14 chars');
}

// =============================================
// 6. Mandate payload construction
// =============================================
section('Mandate Payload: buildMandatePayload — basic');

{
  const { contractReference, payload } = t.buildMandatePayload({
    amount: 5000,
    clientNo: 'CLT001',
    debtorAccountNumber: '123 456-789',
    debtorBranchNumber: '25-00-09',
    debtorAccountName: 'John Doe',
    debtorIdentificationNo: '9001015555088',
    debtorEmail: 'john@example.com'
  });

  assert(typeof contractReference === 'string', 'has contractReference');
  assertEq(contractReference.length, 14, 'contractReference is 14 chars');

  // messageInfo
  const mi = payload.messageInfo;
  assert(mi !== undefined, 'payload.messageInfo exists');
  assertEq(mi.merchantGid, 99, 'messageInfo.merchantGid = 99');
  assertEq(mi.remoteGid, 42, 'messageInfo.remoteGid = 42');
  assertEq(mi.systemUserName, 'apiuser', 'messageInfo.systemUserName');
  assert(mi.messageDate.length === 8, 'messageInfo.messageDate is YYYYMMDD');
  assert(mi.messageTime.length === 6, 'messageInfo.messageTime is HHMMSS');

  // mandate
  const m = payload.mandate;
  assert(m !== undefined, 'payload.mandate exists');
  assertEq(m.clientNo, 'CLT001', 'mandate.clientNo');
  assertEq(m.installmentAmount, 5000, 'mandate.installmentAmount = 5000');
  assertEq(m.initialAmount, 0, 'mandate.initialAmount = 0 (default per working example)');
  assertEq(m.maximumCollectionAmount, 7500, 'mandate.maximumCollectionAmount = 5000 * 1.5');
  assertEq(m.debtorAccountName, 'John Doe', 'mandate.debtorAccountName');
  assertEq(m.debtorEmail, 'john@example.com', 'mandate.debtorEmail');
  assertEq(m.contractReference, contractReference, 'mandate.contractReference matches');

  // Account number sanitization
  assertEq(m.debtorAccountNumber, '123456789', 'debtorAccountNumber stripped spaces/dashes');
  assertEq(m.debtorBranchNumber, '250009', 'debtorBranchNumber stripped dashes');

  // Products (9 slots)
  for (let i = 1; i <= 9; i++) {
    assertEq(m[`product${i}Gid`], 0, `product${i}Gid = 0`);
  }
}

section('Mandate Payload: zero amount → maximumCollectionAmount floors at 1');

{
  const { payload } = t.buildMandatePayload({ amount: 0 });
  assertEq(payload.mandate.installmentAmount, 0, 'installmentAmount = 0');
  assertEq(payload.mandate.maximumCollectionAmount, 1, 'maximumCollectionAmount floors at 1');
}

section('Mandate Payload: negative amount');

{
  const { payload } = t.buildMandatePayload({ amount: -500 });
  assertEq(payload.mandate.installmentAmount, -500, 'installmentAmount = -500 (not validated here)');
  assertEq(payload.mandate.maximumCollectionAmount, 1, 'maximumCollectionAmount floors at 1 for negative');
}

// =============================================
// 7. isExactMandatePayload detection
// =============================================
section('isExactMandatePayload detection');

assert(t.isExactMandatePayload({ messageInfo: {}, mandate: {} }), '{ messageInfo, mandate } → true');
assert(!t.isExactMandatePayload({ amount: 100 }), 'simple input → false');
assert(!t.isExactMandatePayload(null), 'null → false');
assert(!t.isExactMandatePayload(undefined), 'undefined → false');
assert(!t.isExactMandatePayload({}), 'empty object → false');

// =============================================
// 8. Error normalization
// =============================================
section('Error normalization: normalizeError');

{
  const raw = new Error('Oops');
  raw.status = 422;
  raw.code = 'VALIDATION';
  const norm = t.normalizeError(raw, 'fallback msg');
  assertEq(norm.message, 'Oops', 'preserves original error message');
  assertEq(norm.status, 422, 'preserves status');
  assert(norm.details !== undefined, 'details object exists');
  assertEq(norm.details.status, 422, 'details.status = 422');
  assertEq(norm.details.code, 'VALIDATION', 'details.code preserved');
}

{
  const raw = new Error();
  const norm = t.normalizeError(raw, 'default msg');
  assertEq(norm.message, 'default msg', 'uses fallback when error.message is empty');
  assertEq(norm.status, 500, 'defaults to 500');
}

{
  // Simulate axios-like error with response body
  const raw = new Error('Network fail');
  raw.response = {
    status: 503,
    data: { message: 'Service unavailable', error: 'down' }
  };
  const norm = t.normalizeError(raw, 'fallback');
  assertEq(norm.message, 'Service unavailable', 'prefers response.data.message');
  assertEq(norm.status, 503, 'uses response.status');
}

// =============================================
// 9. Full flow validation
// =============================================
section('Full flow: mandate payload → correct API structure');

{
  const { payload } = t.buildMandatePayload({
    amount: 10000,
    clientNo: 'USER-ABC',
    debtorAccountNumber: '1234567890',
    debtorBranchNumber: '250655',
    debtorAccountName: 'Test User',
    debtorIdentificationNo: '9001015555088',
    debtorEmail: 'test@example.com',
    collectionDate: '20250715',
    noOfInstallments: 12,
    frequencyCode: 4
  });

  // Validate full structure required by SureDebit API
  assert(payload.messageInfo && payload.mandate, 'Payload has messageInfo and mandate');
  assertEq(typeof payload.messageInfo.merchantGid, 'number', 'merchantGid is number');
  assertEq(typeof payload.messageInfo.remoteGid, 'number', 'remoteGid is number');
  assertEq(payload.mandate.noOfInstallments, 12, 'noOfInstallments = 12');
  assertEq(payload.mandate.frequencyCode, 4, 'frequencyCode = 4');
  assertEq(payload.mandate.firstCollectionDate, '20250715', 'firstCollectionDate passed through');
  assertEq(payload.mandate.dateList, '', 'dateList defaults to empty (per working example)');
  assertEq(payload.mandate.debitSequenceType, 'RCUR', 'default debitSequenceType = RCUR (per working example)');
  assertEq(payload.mandate.entryClass, '0033', 'default entryClass = 0033');
  assertEq(payload.mandate.magId, 45, 'default magId = 45');
}

// =============================================
// 10. Edge cases
// =============================================
section('Edge cases');

{
  // Empty input
  const { contractReference, payload } = t.buildMandatePayload();
  assert(typeof contractReference === 'string', 'empty input still produces contractReference');
  assert(payload.messageInfo !== undefined, 'empty input still has messageInfo');
  assert(payload.mandate !== undefined, 'empty input still has mandate');
  assertEq(payload.mandate.installmentAmount, 0, 'empty input → amount defaults to 0');
  assertEq(payload.mandate.clientNo, 'WEB001', 'empty input → clientNo defaults to WEB001');
}

{
  // Custom contractReference passed in
  const { contractReference } = t.buildMandatePayload({
    contractReference: 'CUSTOM-REF-001',
    amount: 100
  });
  assertEq(contractReference, 'CUSTOM-REF-001', 'custom contractReference is preserved');
}

// =============================================
// Summary
// =============================================
console.log('\n' + '═'.repeat(64));
console.log(`\n  Total: ${passed + failed}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}\n`);

if (failures.length > 0) {
  console.log('  Failed tests:');
  failures.forEach((f) => console.log(`    • ${f}`));
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);
