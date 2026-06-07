const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
// Load .env from root if present (Replit secrets take priority)
require('dotenv').config();

// Normalize Supabase env vars so all modules see consistent, working credentials.
// The frontend uses VITE_SUPABASE_* names; mirror them onto the legacy SUPABASE_* names
// (and vice versa) so older modules that read process.env.SUPABASE_* keep working.
const _FALLBACK_SUPABASE_URL = "https://jmnjkxfxenrudpvjprcu.supabase.co";
const _FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptbmpreGZ4ZW5ydWRwdmpwcmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxODkzNzUsImV4cCI6MjA4MDc2NTM3NX0.X4ZdxzHF0b9GnHklObpIHqnhWvtKjdZnLoah0EVTvHs";
const _resolvedUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || _FALLBACK_SUPABASE_URL;
const _resolvedAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || _FALLBACK_SUPABASE_ANON_KEY;
process.env.SUPABASE_URL = _resolvedUrl;
process.env.VITE_SUPABASE_URL = _resolvedUrl;
process.env.SUPABASE_ANON_KEY = _resolvedAnon;
process.env.VITE_SUPABASE_ANON_KEY = _resolvedAnon;
// Validate the configured service-role key actually belongs to this Supabase project.
// If missing or for a different project, fall back to the anon key so RLS-allowed
// reads still succeed (instead of failing with "Invalid API key").
function _isJwtForProject(token, supabaseUrl) {
    try {
        const ref = (supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/) || [])[1];
        if (!ref) return false;
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
        return payload && payload.ref === ref && payload.role === 'service_role';
    } catch { return false; }
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !_isJwtForProject(process.env.SUPABASE_SERVICE_ROLE_KEY, _resolvedUrl)) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = _resolvedAnon;
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({
    verify: (req, res, buf) => {
        const url = req.originalUrl || '';
        if (url.startsWith('/api/docuseal/webhook')) {
            req.rawBody = Buffer.from(buf);
        }
    }
}));

// --- User Portal API routes (Your code) ---
const tillSlipRoute = require('./public/user/routes/tillSlipRoute');
const bankStatementRoute = require('./public/user/routes/bankStatementRoute');
const idcardRoute = require('./public/user/routes/idcardRoute');
const kyc = require(path.join(__dirname, 'public', 'user-portal', 'Services', 'kycService'));
const truid = require('./services/truidService');
const creditCheckService = require('./services/creditCheckService');
const sureSystemsService = require('./services/sureSystemsService');
const messaging          = require('./services/messagingService');
const pushNotifications  = require('./services/pushNotificationService');
const moveItService = require('./services/moveItService');
const { supabase, supabaseService } = require('./config/supabaseServer');
const { startNotificationScheduler } = require('./services/notificationScheduler');
const { logApiCall, tracked } = require('./services/apiUsageLogger');

const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY;
const DOCUSEAL_TEMPLATE_ID = process.env.DOCUSEAL_TEMPLATE_ID;
const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com';

const isDocuSealReady = () => Boolean(DOCUSEAL_API_KEY && DOCUSEAL_TEMPLATE_ID);

const docuSealHeaders = {
    'Content-Type': 'application/json',
    'X-Auth-Token': DOCUSEAL_API_KEY || ''
};

const sureSystemsActivationStore = {
    byApplication: new Map(),
    history: []
};

const SURESYSTEMS_MANDATES_TABLE = 'suresystems_mandates';

function normalizeApplicationId(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
}

async function persistSureSystemsActivation(entry = {}) {
    const normalizedApplicationId = normalizeApplicationId(entry.applicationId);
    if (!normalizedApplicationId) {
        return null;
    }

    try {
        const payload = {
            application_id: normalizedApplicationId,
            user_id: entry.userId || null,
            status: entry.status || 'unknown',
            contract_reference: entry.contractReference || null,
            message: entry.message || null,
            request_payload: entry.requestPayload || null,
            response_payload: entry.responsePayload || null,
            error_payload: entry.errorPayload || null,
            activated_at: entry.at || new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseService
            .from(SURESYSTEMS_MANDATES_TABLE)
            .upsert(payload, { onConflict: 'application_id' });

        if (error) {
            throw error;
        }
        return payload;
    } catch (error) {
        console.warn('SureSystems activation persistence failed:', error.message || error);
        return null;
    }
}

async function recordSureSystemsActivation(entry = {}) {
    const normalizedApplicationId = normalizeApplicationId(entry.applicationId);
    if (!normalizedApplicationId) {
        return null;
    }

    const normalized = {
        applicationId: normalizedApplicationId,
        userId: entry.userId || null,
        status: entry.status || 'unknown',
        contractReference: entry.contractReference || null,
        message: entry.message || null,
        requestPayload: entry.requestPayload || null,
        responsePayload: entry.responsePayload || null,
        errorPayload: entry.errorPayload || null,
        at: entry.at || new Date().toISOString()
    };

    sureSystemsActivationStore.byApplication.set(normalized.applicationId, normalized);
    // Cap the Map at 500 entries to prevent unbounded memory growth
    if (sureSystemsActivationStore.byApplication.size > 500) {
        const oldest = sureSystemsActivationStore.byApplication.keys().next().value;
        sureSystemsActivationStore.byApplication.delete(oldest);
    }
    sureSystemsActivationStore.history.unshift(normalized);
    if (sureSystemsActivationStore.history.length > 200) {
        sureSystemsActivationStore.history = sureSystemsActivationStore.history.slice(0, 200);
    }

    await persistSureSystemsActivation(normalized);
    return normalized;
}

async function getSureSystemsActivationStatus() {
    const configStatus = sureSystemsService.getConfigStatus();

    try {
        const { data, error } = await supabaseService
            .from(SURESYSTEMS_MANDATES_TABLE)
            .select('application_id, user_id, status, contract_reference, message, activated_at, updated_at')
            .order('updated_at', { ascending: false })
            .limit(200);

        if (error) {
            throw error;
        }

        const rows = data || [];
        const recentWindow = rows.slice(0, 50);
        const successCount = recentWindow.filter((item) => item.status === 'success').length;
        const failureCount = recentWindow.filter((item) => item.status === 'failed').length;

        return {
            ...configStatus,
            source: 'database',
            recent: {
                total: recentWindow.length,
                success: successCount,
                failed: failureCount,
                lastAttemptAt: recentWindow[0]?.updated_at || null
            },
            applications: rows.slice(0, 20).map((item) => ({
                applicationId: item.application_id,
                userId: item.user_id,
                status: item.status,
                contractReference: item.contract_reference,
                message: item.message,
                at: item.updated_at || item.activated_at
            }))
        };
    } catch (error) {
        console.warn('SureSystems activation status DB read failed. Falling back to memory:', error.message || error);
    }

    const recentWindow = sureSystemsActivationStore.history.slice(0, 50);
    const successCount = recentWindow.filter((item) => item.status === 'success').length;
    const failureCount = recentWindow.filter((item) => item.status === 'failed').length;

    return {
        ...configStatus,
        source: 'memory-fallback',
        recent: {
            total: recentWindow.length,
            success: successCount,
            failed: failureCount,
            lastAttemptAt: recentWindow[0]?.at || null
        },
        applications: Array.from(sureSystemsActivationStore.byApplication.values())
            .sort((a, b) => new Date(b.at) - new Date(a.at))
            .slice(0, 20)
    };
}

const DEFAULT_AUTH_OVERLAY_COLOR = '#EA580C';
const DEFAULT_COMPANY_NAME = 'Your Company';

const DEFAULT_CAROUSEL_SLIDES = [
    {
        title: 'A Leap to\nFinancial Freedom',
        text: 'We offer credit of up to R200,000, with repayment terms extending up to a maximum of 36 months.'
    },
    {
        title: 'Flexible Repayments',
        text: "Repayment terms are tailored to each client's cash flow, risk profile, and agreed-upon conditions."
    },
    {
        title: 'Save on Interest',
        text: 'Our interest rates and fees are highly competitive, ensuring great value for our clients.'
    }
];

const DEFAULT_SYSTEM_SETTINGS = {
    id: 'global',
    company_name: DEFAULT_COMPANY_NAME,
    primary_color: '#E7762E',
    secondary_color: '#F97316',
    tertiary_color: '#FACC15',
    theme_mode: 'light',
    company_logo_url: null,
    auth_background_url: null,
    auth_background_flip: false,
    auth_overlay_color: DEFAULT_AUTH_OVERLAY_COLOR,
    auth_overlay_enabled: true,
    carousel_slides: DEFAULT_CAROUSEL_SLIDES.map((slide) => ({ ...slide }))
};

const normalizeBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
    }
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    return fallback;
};

const normalizeHexColor = (value, fallback) => {
    if (!value) return fallback;
    let hex = `${value}`.trim().replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map((char) => char + char).join('');
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return fallback;
    }
    return `#${hex.toUpperCase()}`;
};

const normalizeCompanyName = (value) => {
    const name = typeof value === 'string' ? value.trim() : '';
    return name || DEFAULT_SYSTEM_SETTINGS.company_name;
};

const sanitizeSlide = (slide = {}, fallback = {}) => {
    const safeTitle = typeof slide.title === 'string' ? slide.title.trim() : '';
    const safeText = typeof slide.text === 'string' ? slide.text.trim() : '';
    return {
        title: safeTitle || fallback.title,
        text: safeText || fallback.text
    };
};

const normalizeCarouselSlides = (slides) => {
    const incoming = Array.isArray(slides) ? slides : [];
    return DEFAULT_CAROUSEL_SLIDES.map((fallback, index) => sanitizeSlide(incoming[index] || {}, fallback));
};

const hydrateSystemSettings = (settings = {}) => ({
    ...DEFAULT_SYSTEM_SETTINGS,
    ...settings,
    company_name: normalizeCompanyName(settings?.company_name),
    auth_background_flip: normalizeBoolean(settings?.auth_background_flip, DEFAULT_SYSTEM_SETTINGS.auth_background_flip),
    auth_overlay_color: normalizeHexColor(settings?.auth_overlay_color, DEFAULT_SYSTEM_SETTINGS.auth_overlay_color),
    auth_overlay_enabled: normalizeBoolean(settings?.auth_overlay_enabled, DEFAULT_SYSTEM_SETTINGS.auth_overlay_enabled),
    carousel_slides: normalizeCarouselSlides(settings.carousel_slides)
});

const THEME_CACHE_TTL_MS = 60 * 1000;
let cachedSystemSettings = {
    data: hydrateSystemSettings(),
    timestamp: 0
};

async function loadSystemSettings(forceRefresh = false) {
    const now = Date.now();
    const isCacheFresh = now - cachedSystemSettings.timestamp < THEME_CACHE_TTL_MS;
    if (!forceRefresh && isCacheFresh) {
        return cachedSystemSettings.data;
    }

    try {
        const { data, error } = await supabaseService
            .from('system_settings')
            .select('*')
            .eq('id', 'global')
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        const theme = hydrateSystemSettings(data);
        cachedSystemSettings = { data: theme, timestamp: now };
        return theme;
    } catch (error) {
        console.error('System settings fetch failed:', error.message || error);
        return cachedSystemSettings.data;
    }
}
// Alias used throughout this file
const getSystemTheme = loadSystemSettings;

async function docuSealRequest(method, endpoint, data) {
    if (!isDocuSealReady()) {
        throw new Error('DocuSeal configuration missing');               
    }

    return axios({
        method,
        url: `${DOCUSEAL_API_URL}${endpoint}`,
        headers: docuSealHeaders,
        data
    });
}

/**
 * buildDocuSealSubmission
 * Maps dynamic data to the AlgoLend Small Credit Agreement.
 * * @param {Object} applicationData - Data from public.loan_applications
 * @param {Object} profileData - Data from public.profiles
 * @param {Object} branchData - Data from public.branches
 * @param {string} creditProviderEmail - Email of the credit provider representative
 */
function buildDocuSealSubmission(applicationData = {}, profileData = {}, branchData = {}, creditProviderEmail, settings = {}) {
    const formatCurrency = (val) => `R ${parseFloat(val || 0).toFixed(2)}`;
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-ZA') : 'N/A';

    // Financial Calculations [cite: 34, 37]
    const principal = parseFloat(applicationData.offer_principal || 0);
    const thirdParty = parseFloat(applicationData.offer_details?.third_party_payment || 0);
    const totalLoanC = principal + thirdParty;
    const interest = parseFloat(applicationData.offer_total_interest || 0);
    const initiation = parseFloat(applicationData.offer_total_initiation_fees || 0);
    const serviceFees = parseFloat(applicationData.offer_total_admin_fees || 0);
    const creditLife = parseFloat(applicationData.offer_credit_life_monthly || 0);
    const vatE5 = (initiation + serviceFees) * 0.15;
    const tccD = interest + initiation + serviceFees + creditLife + vatE5;
    const ncrTotalI = tccD;
    const costMultipleJ = totalLoanC > 0 ? (ncrTotalI / totalLoanC).toFixed(2) : "0.00";

    const borrowerMobile = profileData.cell_tel_no || profileData.contact_number || '';
    
    // Calculate Final Payback Date
    let finalPaybackDate = 'N/A';
    if (applicationData.repayment_start_date) {
        const d = new Date(applicationData.repayment_start_date);
        d.setMonth(d.getMonth() + (applicationData.term_months || 0));
        finalPaybackDate = d.toLocaleDateString('en-ZA');
    }

    return {
        template_id: parseInt(DOCUSEAL_TEMPLATE_ID, 10),
        send_email: true,
        submitters: [
            {
                role: 'Credit Provider',
                email: creditProviderEmail,
                values: {
                    provider_name: settings.company_name || process.env.COMPANY_NAME || "AlgoLend",
                    provider_ncr: settings.ncr_number || process.env.COMPANY_NCR || "NCRCP13510",
                    provider_branch_code: settings.provider_branch_code || process.env.COMPANY_BRANCH_CODE || "ZFS",
                    provider_reg_no: settings.company_reg_number || process.env.COMPANY_REG_NUMBER || "",
                    provider_vat_no: settings.company_vat_number || process.env.COMPANY_VAT_NUMBER || "",
                    provider_tel: branchData.phone || settings.company_phone || process.env.COMPANY_PHONE || "",
                    provider_physical_address: branchData.address || settings.company_physical_address || "",
                    provider_postal_address: branchData.address || settings.company_postal_address || "",
                    provider_logo_url: settings.company_logo_url || process.env.COMPANY_LOGO_URL || ""
                }
            },
            {
                role: 'Borrower',
                email: profileData.email,
                name: profileData.full_name,
                values: {
                    // Borrower Personal Info 
                    borrower_fullname: profileData.full_name,
                    borrower_id: profileData.identity_number,
                    borrower_address: profileData.address || '',
                    borrower_email: profileData.email,
                    borrower_mobile: borrowerMobile,
                    borrower_sms_address: borrowerMobile,
                    
                    // Fields missing from your SQL but present in DocuSeal 
                    borrower_employer: profileData.employer_name || 'N/A',
                    borrower_work_address: profileData.work_address || 'N/A',

                    // Financials [cite: 34, 37]
                    loan_amount_a: formatCurrency(principal),
                    payment_to_third_party: formatCurrency(thirdParty),
                    total_loan_amount_c: formatCurrency(totalLoanC),
                    total_cost_of_credit_d: formatCurrency(tccD),
                    credit_life_e1: formatCurrency(creditLife),
                    initiation_fee_e2: formatCurrency(initiation),
                    service_fees_e3: formatCurrency(serviceFees),
                    interest_charges_e4: formatCurrency(interest),
                    vat_charges_e5: formatCurrency(vatE5),
                    total_repayable: formatCurrency(applicationData.offer_total_repayment),
                    ncr_total_cost_i: formatCurrency(ncrTotalI),
                    credit_cost_multiple_j: costMultipleJ,

                    // Schedule
                    interest_rate_monthly: `${applicationData.offer_interest_rate || 0}%`,
                    first_payment_date: formatDate(applicationData.repayment_start_date),
                    final_payback_date: finalPaybackDate,
                    num_installments: applicationData.term_months?.toString(),
                    payment_method: "Debit Order",
                    installment_amount: formatCurrency(applicationData.offer_monthly_repayment),

                    // Sign-off [cite: 39]
                    signed_at_city: branchData.region || "Soweto",
                    signed_date: formatDate(new Date())
                }
            }
        ]
    };
}

function handleDocuSealError(error, res) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'DocuSeal request failed';

    console.error('DocuSeal API error:', message, error.response?.data || '');
    return res.status(status).json({ error: message, details: error.response?.data });
}

function toSureSystemsDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function loadSureSystemsMandateContext(applicationId) {
    const { data: application, error: appError } = await supabaseService
        .from('loan_applications')
        .select('id, user_id, amount, repayment_start_date, bank_account_id, term_months, profiles:user_id(full_name, email, identity_number)')
        .eq('id', applicationId)
        .maybeSingle();

    if (appError || !application) {
        throw new Error(`Unable to load application ${applicationId} for SureSystems mandate`);
    }

    if (!application.bank_account_id) {
        throw new Error(`Application ${applicationId} has no bank_account_id`);
    }

    const { data: bankAccount, error: bankError } = await supabaseService
        .from('bank_accounts')
        .select('account_holder, account_number, branch_code, account_type')
        .eq('id', application.bank_account_id)
        .maybeSingle();

    if (bankError || !bankAccount) {
        throw new Error(`Unable to load bank account for application ${applicationId}`);
    }

    const profile = application.profiles || null;

    return {
        application,
        bankAccount,
        profile
    };
}

function buildSureSystemsMandateRequestFromContext({ application, bankAccount, profile }, overrides = {}) {
    if (!application || !bankAccount) {
        throw new Error('Application and bank account context are required');
    }

    const loanAmount = Number(application.amount || 0);
    if (loanAmount <= 0) {
        throw new Error(`Application ${application.id} has an invalid amount (${loanAmount}). Cannot create SureSystems mandate for R0.`);
    }

    const collectionDate = overrides.collectionDate || toSureSystemsDate(application.repayment_start_date) || sureSystemsService.getToday();
    const debtorIdentificationNo = overrides.debtorIdentificationNo || profile?.identity_number || profile?.id_number || profile?.idNumber || application.user_id;
    const accountTypeRaw = overrides.debtorAccountType || bankAccount.account_type || 1;
    const accountTypeMap = { cheque: 1, current: 1, savings: 2, transmission: 3, bond: 4, subscription_share: 6 };
    const debtorAccountType = Number.isFinite(Number(accountTypeRaw))
        ? Number(accountTypeRaw)
        : (accountTypeMap[String(accountTypeRaw).toLowerCase()] || 1);
    const installmentCount = Number(overrides.noOfInstallments || application.term_months || 1);

    // Values matched to working SureSystems example
    return {
        // messageInfo overrides
        frontEndUserName: overrides.frontEndUserName || process.env.SURESYSTEMS_BASIC_AUTH_USERNAME || 'algohiveuat',

        // mandate fields
        clientNo:               String(overrides.clientNo || application.user_id || application.id).replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15),
        userReference:          overrides.userReference || `APP${String(application.id).slice(0, 7)}`,
        debtorAccountName:      overrides.debtorAccountName || bankAccount.account_holder || profile?.full_name || '',
        debtorIdentificationNo: String(debtorIdentificationNo || ''),
        debtorAccountNumber:    String(overrides.debtorAccountNumber || bankAccount.account_number || ''),
        debtorBranchNumber:     String(overrides.debtorBranchNumber || bankAccount.branch_code || ''),
        debtorAccountType,
        debtorTelephone:        overrides.debtorTelephone || profile?.cell_tel_no || '',
        debtorEmail:            overrides.debtorEmail || profile?.email || '',

        // Amounts — initialAmount must be 0 per working example
        amount:         loanAmount,
        initialAmount:  0,

        // Dates — YYYYMMDD format, no dashes
        collectionDate,
        mandateInitiationDate: sureSystemsService.getToday(),
        dateList: '',  // empty per working example

        // Mandate settings matched to working example
        noOfInstallments:          installmentCount,
        origin:                    15,      // was 0 — working example uses 15
        typeOfAuthorizationRequired: 3,     // was 1 — working example uses 3 (DebiCheck)
        debitSequenceType:         'RCUR',  // was OOFF — recurring for installment loans
        authorizationIndicator:    '0229',  // was 0226 — working example uses 0229
        maximumCollectionAmount:   Math.ceil(loanAmount * 1.5),
        // Parse YYYYMMDD format correctly — new Date("20260620") is invalid, need "2026-06-20"
        collectionDay:             (() => {
            const d = collectionDate && collectionDate.length === 8
                ? new Date(`${collectionDate.slice(0,4)}-${collectionDate.slice(4,6)}-${collectionDate.slice(6,8)}`)
                : new Date(collectionDate);
            return (d && !isNaN(d.getTime())) ? d.getDate() : new Date().getDate();
        })()
    };
}

function extractSureSystemsMessage(payload = {}, fallback = 'SureSystems action completed') {
    return payload?.message
        || payload?.statusMessage
        || payload?.resultDescription
        || payload?.description
        || payload?.responseMessage
        || payload?.responseDescription
        || payload?.error
        || fallback;
}

function inferSureSystemsStatus(payload = {}, fallback = 'pending') {
    const text = JSON.stringify(payload || {}).toLowerCase();
    if (!text || text === '{}') return fallback;
    if (/(fail|error|reject|declin|invalid|cancelled|canceled)/.test(text)) return 'failed';
    if (/(success|approved|accept|active|authenticated|complete)/.test(text)) return 'success';
    if (/(pending|await|queued|processing|submitted|in progress)/.test(text)) return 'pending';
    return fallback;
}

async function buildSureSystemsMandateRequestForApplication(applicationId, overrides = {}) {
    if (!applicationId) return null;
    const context = await loadSureSystemsMandateContext(applicationId);
    return {
        ...context,
        requestPayload: buildSureSystemsMandateRequestFromContext(context, overrides)
    };
}

async function triggerSureSystemsMandateForApplication(applicationId, overrides = {}) {
    if (!applicationId) return null;

    const { application, requestPayload } = await buildSureSystemsMandateRequestForApplication(applicationId, overrides);

    const result = await sureSystemsService.loadMandate(requestPayload);

    return {
        applicationId: application.id,
        userId: application.user_id,
        contractReference: result?.contractReference || null,
        requestPayload,
        responsePayload: result?.response || null
    };
}

app.use('/api/tillslip', tillSlipRoute);
app.use('/api/bankstatement', bankStatementRoute);
app.use('/api/idcard', idcardRoute);

app.get('/api/system-settings', async (req, res) => {
    try {
        const forceRefresh = ['true', '1'].includes((req.query.refresh || '').toString());
        const theme = await loadSystemSettings(forceRefresh);
        return res.json({
            data: theme,
            updated_at: cachedSystemSettings.timestamp,
            cache_ttl_ms: THEME_CACHE_TTL_MS
        });
    } catch (error) {
        console.error('System settings API error:', error);
        return res.status(200).json({
            data: cachedSystemSettings.data,
            fallback: true
        });
    }
});

// KYC API routes
app.post('/api/kyc/create-session', async (req, res) => {
    try {
        const result = await kyc.createSession(req.body);
        return res.json(result);
    } catch (error) {
        console.error('KYC session error:', {
            message: error?.message || 'Unknown KYC error',
            status: error?.status || 500,
            details: error?.details || null
        });
        return res.status(error?.status || 500).json({
            error: error?.message || 'Unable to create KYC session',
            details: error?.details || null
        });
    }
});

app.post('/api/kyc/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-signature'];
        const payload = req.body;

        if (!signature || !kyc.verifyWebhookSignature(payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        kyc.updateSessionFromWebhook(payload);

        // ── Persist KYC result to profiles table ─────────────────────
        const sessionId = payload?.session_id || payload?.id;
        const status    = payload?.status || payload?.verification_status;
        const userId    = payload?.metadata?.userId || payload?.user_id;

        if (userId && status) {
            const kycPassed = ['approved','verified','completed','success'].includes(String(status).toLowerCase());
            await supabaseService.from('profiles').update({
                kyc_status:       status,
                kyc_verified:     kycPassed,
                kyc_verified_at:  kycPassed ? new Date().toISOString() : null,
                kyc_session_id:   sessionId || null,
                updated_at:       new Date().toISOString()
            }).eq('id', userId);

            // If KYC approved → update any pending application to next stage
            if (kycPassed) {
                await supabaseService.from('loan_applications')
                    .update({ kyc_status: 'verified', updated_at: new Date().toISOString() })
                    .eq('user_id', userId)
                    .in('status', ['STARTED', 'BUREAU_CHECKING', 'BUREAU_OK']);
            }
            console.log(`[KYC webhook] userId=${userId} status=${status} passed=${kycPassed}`);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('KYC webhook error:', error);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
});

app.get('/api/kyc/session/:sessionId', async (req, res) => {
    try {
        const result = await kyc.getSessionStatus(req.params.sessionId);
        return res.json(result);
    } catch (error) {
        console.error('KYC session lookup error:', error);
        return res.status(404).json({ error: 'Session not found' });
    }
});

app.get('/api/kyc/user/:userId/status', async (req, res) => {
    try {
        const result = await kyc.getUserKycStatus(req.params.userId);
        return res.json(result);
    } catch (error) {
        console.error('KYC status error:', error);
        return res.status(500).json({ error: 'Unable to fetch KYC status' });
    }
});

// TruID API routes
app.post('/api/truid/create-session', async (req, res) => {
    try {
        const payload = req.body || {};
        const appId = payload.metadata?.applicationId || null;
        const result = await tracked(
            { service: 'truid', operation: 'initiate_collection', applicationId: appId, userId: payload.userId },
            () => truid.initiateCollection({
                ...payload,
                name: payload.name || payload.metadata?.full_name,
                idNumber: payload.idNumber || payload.metadata?.id_number || payload.metadata?.idNumber,
                email: payload.email,
                mobile: payload.phone,
                correlation: { userId: payload.userId, applicationId: appId }
            })
        );

        return res.json({
            success: true,
            session_id: result.collectionId,
            connect_url: result.consumerUrl,
            status: result.status
        });
    } catch (error) {
        console.error('TruID create-session error:', error.message || error);
        if (error.code === 'TRUID_CONFIG_MISSING') {
            return res.status(503).json({ error: error.message });
        }
        return res.status(error.status || 500).json({ error: error.message || 'Unable to start TruID session' });
    }
});

app.get('/api/truid/session/:sessionId', async (req, res) => {
    try {
        const result = await truid.getCollectionStatus(req.params.sessionId);
        return res.json(result);
    } catch (error) {
        console.error('TruID session lookup error:', error.message || error);
        return res.status(error.status || 500).json({ error: 'Unable to fetch session status' });
    }
});

app.get('/api/truid/user/:userId/status', async (req, res) => {
    try {
        const result = await truid.getUserStatus(req.params.userId);
        return res.json(result);
    } catch (error) {
        console.error('TruID status error:', error.message || error);
        return res.status(500).json({ error: error.message || 'Unable to fetch TruID status' });
    }
});

app.post('/api/truid/webhook', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await truid.captureCollectionData({
            collectionId: payload.collectionId || payload.collection_id || payload.id,
            userId: payload.userId || payload.user_id || payload.correlation?.userId,
            applicationId: payload.applicationId || payload.correlation?.applicationId
        });
        return res.status(200).json(result);
    } catch (error) {
        console.error('TruID webhook error:', error.message || error);
        return res.status(error.status || 500).json({ error: 'Webhook processing failed' });
    }
});

// Banking API endpoints
app.post('/api/banking/initiate', async (req, res) => {
    try {
        const result = await truid.initiateCollection(req.body || {});
        return res.json(result);
    } catch (error) {
        console.error('Banking initiate error:', error.message || error);
        return res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to initiate banking collection' });
    }
});

app.get('/api/banking/status', async (req, res) => {
    try {
        const { collectionId, userId } = req.query;

        if (collectionId) {
            const result = await truid.getCollectionStatus(collectionId);
            return res.json(result);
        }

        if (userId) {
            const result = await truid.getUserStatus(userId);
            return res.json(result);
        }

        return res.status(400).json({ success: false, error: 'Provide collectionId or userId' });
    } catch (error) {
        console.error('Banking status error:', error.message || error);
        return res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to fetch banking status' });
    }
});

app.get('/api/banking/all', async (req, res) => {
    try {
        const result = await truid.getAllSessions();
        return res.json(result);
    } catch (error) {
        console.error('Banking all error:', error.message || error);
        return res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to list banking sessions' });
    }
});

app.post('/api/banking/capture', async (req, res) => {
    try {
        const result = await truid.captureCollectionData(req.body || {});
        return res.json(result);
    } catch (error) {
        console.error('Banking capture error:', error.message || error);
        return res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to capture banking data' });
    }
});

// Credit Check API endpoint
app.post('/api/credit-check', async (req, res) => {
    try {
        const { applicationId, userData } = req.body;

        if (!applicationId || !userData) {
            return res.status(400).json({ error: 'applicationId and userData are required' });
        }

        const authHeader = req.headers.authorization || '';
        const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        // Enrich address fields from the stored profile if missing
        // Experian requires Address2 (suburb) — pull it from profiles.suburb_area
        const enrichedUserData = { ...userData };
        if (enrichedUserData.user_id) {
            const { data: profile } = await supabaseService
                .from('profiles')
                .select('address, suburb_area, postal_code, cell_tel_no, date_of_birth, gender')
                .eq('id', enrichedUserData.user_id)
                .maybeSingle();
            if (profile) {
                // Merge missing fields from DB profile
                if (!enrichedUserData.address1 && profile.address) enrichedUserData.address1 = profile.address;
                if (!enrichedUserData.address2 && profile.suburb_area) enrichedUserData.address2 = profile.suburb_area;
                if (!enrichedUserData.postal_code && profile.postal_code) enrichedUserData.postal_code = profile.postal_code;
                if (!enrichedUserData.cell_tel_no && profile.cell_tel_no) enrichedUserData.cell_tel_no = profile.cell_tel_no;
                if (!enrichedUserData.date_of_birth && profile.date_of_birth) {
                    // Convert ISO date to YYYYMMDD
                    enrichedUserData.date_of_birth = (profile.date_of_birth || '').replace(/-/g, '').slice(0, 8);
                }
                if (!enrichedUserData.gender && profile.gender) enrichedUserData.gender = profile.gender;
                // Always set address2 to suburb if empty (Experian requires it)
                if (!enrichedUserData.address2 || enrichedUserData.address2.trim() === '') {
                    enrichedUserData.address2 = enrichedUserData.address1 || 'Not Provided';
                }
            }
        }
        // Final fallback: Experian rejects empty Address2
        if (!enrichedUserData.address2 || enrichedUserData.address2.trim() === '') {
            enrichedUserData.address2 = enrichedUserData.address1 || 'Not Provided';
        }

        const result = await tracked(
            { service: 'experian', operation: 'credit_check', applicationId: String(applicationId) },
            () => creditCheckService.performCreditCheck(enrichedUserData, applicationId, authToken)
        );

        return res.json(result);
    } catch (error) {
        console.error('Credit check error:', error);
        return res.status(500).json({ error: error.message || 'Credit check failed' });
    }
});

// Notification testing endpoints (development only)
const notificationScheduler = require('./services/notificationScheduler');

// POST /api/notifications/status-change
// Called automatically by updateApplicationStatus() whenever a loan status changes.
// Sends the appropriate SMS/WhatsApp to the client based on the new status.
app.post('/api/notifications/status-change', async (req, res) => {
    try {
        const { applicationId, newStatus } = req.body;
        if (!applicationId || !newStatus) return res.status(400).json({ error: 'applicationId and newStatus required' });

        // Fetch application + borrower profile
        const { data: app, error: appErr } = await supabaseService
            .from('loan_applications')
            .select('id, amount, offer_monthly_repayment, loan_number, user_id, profiles(full_name, cell_tel_no, email)')
            .eq('id', applicationId)
            .single();
        if (appErr || !app) return res.status(404).json({ error: 'Application not found' });

        const profile  = app.profiles || {};
        const to       = profile.cell_tel_no || profile.phone;
        const company  = process.env.COMPANY_NAME || 'Zwane Financial Services';
        const name     = profile.full_name?.split(' ')[0] || 'Client';
        const ref      = app.loan_number || applicationId.slice(-8).toUpperCase();
        const amount   = Number(app.amount || 0);
        const monthly  = Number(app.offer_monthly_repayment || 0);

        // Build push notification payload for this status change
        const fmtR = v => `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        const pushPayloads = {
            OFFERED:    { title: '🎉 Loan Approved!',  body: `Your loan of ${fmtR(amount)} has been approved. Monthly: ${fmtR(monthly)}`, url: '/user-portal/?page=dashboard', requireInteraction: true },
            APPROVED:   { title: '🎉 Loan Approved!',  body: `Your loan of ${fmtR(amount)} has been approved. Monthly: ${fmtR(monthly)}`, url: '/user-portal/?page=dashboard', requireInteraction: true },
            DISBURSED:  { title: '💰 Money sent!',     body: `${fmtR(amount)} is on its way to your account.`,                              url: '/user-portal/?page=dashboard', requireInteraction: true },
            REJECTED:   { title: 'Application Update', body: 'Your loan application was not approved. Tap for details.',                   url: '/user-portal/?page=dashboard' },
            DECLINED:   { title: 'Application Update', body: 'Your loan application was not approved. Tap for details.',                   url: '/user-portal/?page=dashboard' },
            IN_ARREARS: { title: '⚠️ Payment Overdue', body: `Your payment of ${fmtR(monthly)} is overdue. Tap to settle.`,                  url: '/user-portal/?page=payments', requireInteraction: true }
        };

        // Fire push notification (non-blocking)
        const pushPayload = pushPayloads[newStatus];
        if (pushPayload) {
            pushNotifications.sendToUser(app.user_id, { ...pushPayload, tag: `loan-${newStatus}-${applicationId}` })
                .catch(e => console.warn('[push]', e.message));
        }

        if (!to) return res.json({ sent: false, reason: 'No phone number on profile' });

        let result;
        switch (newStatus) {
            case 'OFFERED':
            case 'APPROVED':
                result = await messaging.notifyLoanApproved({ to, clientName: name, reference: ref, amount, monthly, company });
                break;
            case 'DISBURSED':
                result = await messaging.notifyLoanDisbursed({ to, clientName: name, reference: ref, amount, company });
                break;
            case 'REJECTED':
            case 'DECLINED':
                result = await messaging.sendSMS(to,
                    `Hi ${name}, unfortunately your loan application (Ref: ${ref}) was not approved at this time. Please contact us for more information. – ${company}`
                );
                break;
            case 'IN_ARREARS':
                result = await messaging.notifyArrears({ to, clientName: name, daysOverdue: 7, amount: monthly, company });
                break;
            default:
                return res.json({ sent: false, reason: `No notification configured for status: ${newStatus}` });
        }

        console.log(`[notify] ${newStatus} → ${to}: sent=${result?.sent}`);
        res.json({ sent: true, status: newStatus, result });
    } catch (err) {
        console.error('[notify/status-change]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notifications/check-payments', async (req, res) => {
    try {
        await notificationScheduler.checkPaymentDueNotifications();
        return res.json({ success: true, message: 'Payment due notifications checked' });
    } catch (error) {
        console.error('Error checking payment notifications:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/notifications/check-edit-window', async (req, res) => {
    try {
        await notificationScheduler.checkEditWindowNotifications();
        return res.json({ success: true, message: 'Edit window notifications checked' });
    } catch (error) {
        console.error('Error checking edit window notifications:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Loan affordability calculation endpoint
app.post('/api/calculate-affordability', (req, res) => {
    try {
        const {
            monthly_income,
            affordability_percent = 20, // Default 20%
            annual_interest_rate = 20, // Default 20% APR
            loan_term_months = 1 // Default 1 month
        } = req.body;

        if (!monthly_income || monthly_income <= 0) {
            return res.status(400).json({ error: 'Valid monthly_income is required' });
        }

        // 1. Maximum monthly repayment (13% of income)
        const max_monthly_payment = monthly_income * (affordability_percent / 100);

        // 2. Monthly interest rate (APR / 12)
        const monthly_rate = (annual_interest_rate / 100) / 12;

        // 3. Amortized loan amount formula
        // Formula: P = M * [(1 - (1 + r)^-n) / r]
        // Where: P = Principal (loan amount), M = Monthly payment, r = monthly rate, n = number of months
        const loan_amount = monthly_rate > 0
            ? max_monthly_payment * (1 - Math.pow(1 + monthly_rate, -loan_term_months)) / monthly_rate
            : max_monthly_payment * loan_term_months; // If rate is 0, simple calculation

        return res.json({
            max_monthly_payment: Number(max_monthly_payment.toFixed(2)),
            affordability_threshold: Number(max_monthly_payment.toFixed(2)),
            max_loan_amount: Number(loan_amount.toFixed(2)),
            monthly_rate: Number((monthly_rate * 100).toFixed(4)),
            annual_interest_rate,
            loan_term_months,
            affordability_percent
        });
    } catch (error) {
        console.error('Affordability calculation error:', error);
        return res.status(500).json({ error: error.message || 'Calculation failed' });
    }
});

// SureSystems API proxy endpoints
app.get('/api/suresystems/config', (req, res) => {
    try {
        return res.json(sureSystemsService.getConfigStatus());
    } catch (error) {
        console.error('SureSystems config status error:', error);
        return res.status(500).json({ configured: false, error: 'Unable to read SureSystems configuration' });
    }
});

app.get('/api/suresystems/debug/connectivity', async (req, res) => {
    try {
        const result = await sureSystemsService.probeConnectivity();
        return res.status(result.reachable ? 200 : (result.status || 503)).json({
            success: result.reachable,
            ...result
        });
    } catch (error) {
        console.error('SureSystems connectivity probe error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems connectivity probe failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/test-payload', async (req, res) => {
    try {
        const applicationId = normalizeApplicationId(req.body?.applicationId);
        const overrides = req.body?.overrides || {};
        let requestPayload;
        let application = null;
        let bankAccount = null;
        let profile = null;

        if (applicationId) {
            const context = await buildSureSystemsMandateRequestForApplication(applicationId, overrides);
            requestPayload = context.requestPayload;
            application = context.application;
            bankAccount = context.bankAccount;
            profile = context.profile;
        } else {
            requestPayload = sureSystemsService._test.buildMandatePayload(req.body || {}).payload;
        }

        const warnings = [];
        if (!requestPayload?.mandate?.debtorAccountNumber) warnings.push('Debtor account number is missing.');
        if (!requestPayload?.mandate?.debtorBranchNumber) warnings.push('Debtor branch number is missing.');
        if (!requestPayload?.mandate?.debtorIdentificationNo) warnings.push('Debtor identification number is missing.');
        if (!requestPayload?.mandate?.debtorAccountName) warnings.push('Debtor account name is missing.');

        return res.json({
            success: true,
            mode: applicationId ? 'application' : 'manual',
            config: sureSystemsService.getConfigStatus(),
            warnings,
            application,
            bankAccount,
            profile,
            requestPayload
        });
    } catch (error) {
        console.error('SureSystems payload preview error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'Unable to build SureSystems test payload',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/load', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await tracked(
            { service: 'suresystems', operation: 'load_mandate', applicationId: String(payload.applicationId || '') },
            () => sureSystemsService.loadMandate(payload)
        );
        return res.json({ success: true, contractReference: result.contractReference, ...result.response });
    } catch (error) {
        console.error('SureSystems mandate load error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems mandate load failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/finalfate', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await sureSystemsService.checkFinalFate(payload);
        return res.json({ success: true, ...result.response });
    } catch (error) {
        console.error('SureSystems final fate error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems final fate check failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/load-direct', async (req, res) => {
    try {
        const applicationId = normalizeApplicationId(req.body?.applicationId);
        if (!applicationId) {
            return res.status(400).json({ success: false, error: 'applicationId is required' });
        }

        const overrides = req.body?.overrides || {};
        const { application, profile, requestPayload } = await buildSureSystemsMandateRequestForApplication(applicationId, overrides);
        const result = await sureSystemsService.loadMandate(requestPayload);
        const responsePayload = result?.response || {};
        const contractReference = result?.contractReference || requestPayload?.mandate?.contractReference || null;
        const status = inferSureSystemsStatus(responsePayload, 'pending');
        const message = extractSureSystemsMessage(responsePayload, 'SureSystems direct mandate load completed');

        await recordSureSystemsActivation({
            applicationId,
            userId: application?.user_id || null,
            status,
            contractReference,
            message,
            requestPayload,
            responsePayload,
            at: new Date().toISOString()
        });

        return res.json({
            success: true,
            applicationId,
            contractReference,
            status,
            message,
            requestPayload,
            responsePayload,
            profile
        });
    } catch (error) {
        const applicationId = normalizeApplicationId(req.body?.applicationId) || null;
        const contractReference = req.body?.overrides?.contractReference || null;
        await recordSureSystemsActivation({
            applicationId,
            status: 'failed',
            contractReference,
            message: error.message || 'SureSystems direct mandate load failed',
            errorPayload: error.details || null,
            at: new Date().toISOString()
        });

        console.error('SureSystems direct mandate load error:', {
            message: error?.message || 'Unknown error',
            status: error?.status || 500,
            details: error?.details || null
        });
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems direct mandate load failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/check-status', async (req, res) => {
    try {
        const applicationId = normalizeApplicationId(req.body?.applicationId);
        const contractReference = req.body?.contractReference || null;
        const frontEndUserName = req.body?.frontEndUserName || undefined;
        const mode = (req.body?.mode || 'finalfate').toString().toLowerCase();

        if (!contractReference) {
            return res.status(400).json({ success: false, error: 'contractReference is required' });
        }

        let result;
        let requestPayload;
        if (mode === 'enquiry') {
            requestPayload = { contractReference, frontEndUserName };
            result = await sureSystemsService.mandateEnquiry(requestPayload);
        } else {
            requestPayload = { contractReference, frontEndUserName };
            result = await sureSystemsService.checkFinalFate(requestPayload);
        }

        const responsePayload = result?.response || {};
        const status = inferSureSystemsStatus(responsePayload, 'pending');
        const message = extractSureSystemsMessage(responsePayload, `SureSystems ${mode} completed`);

        if (applicationId) {
            const { data: existing } = await supabaseService
                .from(SURESYSTEMS_MANDATES_TABLE)
                .select('user_id')
                .eq('application_id', applicationId)
                .maybeSingle();

            await recordSureSystemsActivation({
                applicationId,
                userId: existing?.user_id || null,
                status,
                contractReference,
                message,
                requestPayload,
                responsePayload,
                at: new Date().toISOString()
            });
        }

        return res.json({
            success: true,
            applicationId,
            contractReference,
            mode,
            status,
            message,
            responsePayload
        });
    } catch (error) {
        console.error('SureSystems status check error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems status check failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/payments/download', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await sureSystemsService.downloadPayments(payload);
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('SureSystems payments download error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems payment download failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/batch/mandateenquiry', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await sureSystemsService.mandateEnquiry(payload);
        return res.json({ success: true, ...result.response });
    } catch (error) {
        console.error('SureSystems mandate enquiry error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems mandate enquiry failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/cancel', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await sureSystemsService.cancelMandate(payload);
        return res.json({ success: true, ...result.response });
    } catch (error) {
        console.error('SureSystems cancel mandate error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems cancel mandate failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/mandates/cancel-record', async (req, res) => {
    try {
        const applicationId = normalizeApplicationId(req.body?.applicationId);
        const contractReference = req.body?.contractReference || null;
        const frontEndUserName = req.body?.frontEndUserName || 'webuser';

        if (!contractReference) {
            return res.status(400).json({ success: false, error: 'contractReference is required' });
        }

        const requestPayload = {
            contractReference,
            frontEndUserName
        };

        const result = await sureSystemsService.cancelMandate(requestPayload);
        const responsePayload = result?.response || {};
        const status = inferSureSystemsStatus(responsePayload, 'pending');
        const message = extractSureSystemsMessage(responsePayload, 'SureSystems cancel mandate completed');

        if (applicationId) {
            const { data: existing } = await supabaseService
                .from(SURESYSTEMS_MANDATES_TABLE)
                .select('user_id')
                .eq('application_id', applicationId)
                .maybeSingle();

            await recordSureSystemsActivation({
                applicationId,
                userId: existing?.user_id || null,
                status,
                contractReference,
                message,
                requestPayload,
                responsePayload,
                at: new Date().toISOString()
            });
        }

        return res.json({
            success: true,
            applicationId,
            contractReference,
            status,
            message,
            responsePayload
        });
    } catch (error) {
        console.error('SureSystems cancel-and-record error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems cancel mandate failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/installments/batch/installment', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await sureSystemsService.createInstallmentRequest(payload);
        return res.json({ success: true, ...result.response });
    } catch (error) {
        console.error('SureSystems installment request error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems installment request failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/installments/batch/update', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await sureSystemsService.updateInstallmentRequest(payload);
        return res.json({ success: true, ...result.response });
    } catch (error) {
        console.error('SureSystems update installment error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems update installment failed',
            details: error.details || null
        });
    }
});

app.post('/api/suresystems/installments/cancel', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await sureSystemsService.cancelInstallment(payload);
        return res.json({ success: true, ...result.response });
    } catch (error) {
        console.error('SureSystems cancel installment error:', error.message || error);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SureSystems cancel installment failed',
            details: error.details || null
        });
    }
});

app.get('/api/suresystems/activation-status', async (req, res) => {
    try {
        const status = await getSureSystemsActivationStatus();
        return res.json(status);
    } catch (error) {
        console.error('SureSystems activation status error:', error);
        return res.status(500).json({ error: 'Unable to load SureSystems activation status' });
    }
});

app.post('/api/suresystems/activate-application', async (req, res) => {
    try {
        const applicationId = normalizeApplicationId(req.body?.applicationId);
        if (!applicationId) {
            return res.status(400).json({ success: false, error: 'applicationId is required' });
        }

        const activation = await triggerSureSystemsMandateForApplication(applicationId);
        const now = new Date().toISOString();

        await recordSureSystemsActivation({
            applicationId,
            userId: activation?.userId || null,
            status: 'success',
            contractReference: activation?.contractReference || null,
            message: 'Mandate activated manually by admin',
            requestPayload: activation?.requestPayload || null,
            responsePayload: activation?.responsePayload || null,
            at: now
        });

        return res.json({
            success: true,
            applicationId,
            contractReference: activation?.contractReference || null,
            activatedAt: now,
            message: 'SureSystems mandate activated successfully'
        });
    } catch (error) {
        const applicationId = normalizeApplicationId(req.body?.applicationId) || null;
        await recordSureSystemsActivation({
            applicationId,
            status: 'failed',
            message: error.message || 'Manual SureSystems activation failed',
            errorPayload: error.details || null,
            at: new Date().toISOString()
        });

        console.error('Manual SureSystems activation error:', {
            message: error?.message || 'Unknown error',
            status: error?.status || 500,
            details: error?.details || null
        });
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'Unable to activate SureSystems mandate',
            details: error.details || null
        });
    }
});

app.get('/api/suresystems/mandates/history', async (req, res) => {
    try {
        const { data, error } = await supabaseService
            .from(SURESYSTEMS_MANDATES_TABLE)
            .select(`
                *,
                loan_applications (
                    user_id,
                    amount,
                    status
                )
            `)
            .order('updated_at', { ascending: false })
            .limit(100);

        if (error) {
            throw error;
        }

        return res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('SureSystems history fetch error:', error?.message || error);
        return res.status(500).json({ success: false, error: 'Unable to load mandate history', detail: error?.message || String(error) });
    }
});

// DocuSeal proxy endpoints
app.get('/api/docuseal/config', (req, res) => {
    return res.json({
        configured: isDocuSealReady(),
        templateId: isDocuSealReady() ? DOCUSEAL_TEMPLATE_ID : null
    });
});

app.post('/api/docuseal/send-contract', async (req, res) => {
    if (!isDocuSealReady()) {
        return res.status(503).json({ error: 'DocuSeal integration is not configured' });
    }

    const { applicationData, profileData } = req.body || {};
    if (!applicationData || !profileData) {
        return res.status(400).json({ error: 'applicationData and profileData are required' });
    }

    try {
        const branchId = applicationData.branch_id || profileData.branch_id || 1;

        // Fetch branch AND system_settings in parallel
        const [{ data: branchData }, settings] = await Promise.all([
            supabaseService.from('branches').select('*').eq('id', branchId).maybeSingle(),
            loadSystemSettings()
        ]);

        const creditProviderEmail = process.env.CREDIT_PROVIDER_EMAIL || settings.company_email || "info@algolend.co.za";

        const payload = buildDocuSealSubmission(applicationData, profileData, branchData || {}, creditProviderEmail, settings);

        const response = await tracked(
            { service: 'docuseal', operation: 'send_contract', applicationId: String(applicationData.id || '') },
            () => docuSealRequest('post', '/submissions', payload)
        );
        return res.json(response.data);
    } catch (error) {
        return handleDocuSealError(error, res);
    }
});

app.get('/api/docuseal/submissions/:submissionId', async (req, res) => {
    if (!isDocuSealReady()) {
        return res.status(503).json({ error: 'DocuSeal integration is not configured' });
    }

    try {
        const response = await docuSealRequest('get', `/submissions/${req.params.submissionId}`);
        return res.json(response.data);
    } catch (error) {
        return handleDocuSealError(error, res);
    }
});

app.get('/api/docuseal/submitters/:submitterId', async (req, res) => {
    if (!isDocuSealReady()) {
        return res.status(503).json({ error: 'DocuSeal integration is not configured' });
    }

    try {
        const response = await docuSealRequest('get', `/submitters/${req.params.submitterId}`);
        return res.json(response.data);
    } catch (error) {
        return handleDocuSealError(error, res);
    }
});

app.put('/api/docuseal/submitters/:submitterId', async (req, res) => {
    if (!isDocuSealReady()) {
        return res.status(503).json({ error: 'DocuSeal integration is not configured' });
    }

    try {
        const payload = { send_email: true, ...(req.body || {}) };
        const response = await docuSealRequest('put', `/submitters/${req.params.submitterId}`, payload);
        return res.json(response.data);
    } catch (error) {
        return handleDocuSealError(error, res);
    }
});

app.delete('/api/docuseal/submissions/:submissionId', async (req, res) => {
    if (!isDocuSealReady()) {
        return res.status(503).json({ error: 'DocuSeal integration is not configured' });
    }

    try {
        const response = await docuSealRequest('delete', `/submissions/${req.params.submissionId}`);
        return res.json(response.data);
    } catch (error) {
        return handleDocuSealError(error, res);
    }
});

// DocuSeal Webhook Receiver – updates docuseal_submissions when DocuSeal sends events
app.post('/api/docuseal/webhook', async (req, res) => {
    try {
        // Verify webhook signature if secret is configured
        const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
        const testHeaderName = (process.env.DOCUSEAL_TEST_HEADER_NAME || '').trim();
        const testHeaderValue = (process.env.DOCUSEAL_TEST_HEADER_VALUE || '').trim();
        const testHeaderIncoming = testHeaderName ? req.headers[testHeaderName.toLowerCase()] : undefined;
        const testHeaderMatched = Boolean(
            testHeaderName
            && testHeaderValue
            && typeof testHeaderIncoming !== 'undefined'
            && String(testHeaderIncoming).trim() === testHeaderValue
        );

        // If no signature secret is configured, allow custom header auth as primary guard.
        // If custom header env vars are configured but header does not match, reject request.
        if (!secret && testHeaderName && testHeaderValue && !testHeaderMatched) {
            console.warn('DocuSeal webhook rejected: custom test header did not match', {
                expectedTestHeader: testHeaderName,
                receivedTestHeader: typeof testHeaderIncoming === 'undefined' ? null : String(testHeaderIncoming),
                headers: req.headers
            });
            return res.status(401).json({ error: 'Invalid webhook header' });
        }

        if (!secret && testHeaderName && testHeaderValue && testHeaderMatched) {
            console.log('Accepted DocuSeal webhook via custom test header', testHeaderName);
        }

        if (secret) {
            const sigHeader = (req.headers['x-docuseal-signature'] || req.headers['x-signature'] || req.headers['x-hub-signature'] || '').toString();
            if (!sigHeader) {
                // Allow a simple test header fallback (not secure) during debugging if configured
                if (testHeaderName && testHeaderValue) {
                    if (testHeaderMatched) {
                        console.log('Accepted DocuSeal webhook via custom test header', testHeaderName);
                        // treat as valid and skip HMAC validation
                    } else {
                        console.warn('Missing DocuSeal signature header and test header did not match', {
                            expectedTestHeader: testHeaderName,
                            headers: req.headers,
                            rawBodyLength: req.rawBody ? req.rawBody.length : 0,
                            bodySample: (() => {
                                try { return JSON.stringify(req.body).slice(0, 1000); } catch (e) { return '<non-serializable body>'; }
                            })()
                        });
                        return res.status(401).json({ error: 'Missing signature header' });
                    }
                } else {
                    // Log full headers + small body sample to help debug what DocuSeal is sending
                    console.warn('Missing DocuSeal signature header', {
                        headers: req.headers,
                        rawBodyLength: req.rawBody ? req.rawBody.length : 0,
                        bodySample: (() => {
                            try { return JSON.stringify(req.body).slice(0, 1000); } catch (e) { return '<non-serializable body>'; }
                        })()
                    });
                    return res.status(401).json({ error: 'Missing signature header' });
                }
            }

            // Strip common prefix (e.g. 'sha256=') if present
            let received = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : sigHeader;

            // Compute expected digests
            const computedHex = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from('')).digest('hex');
            const computedBase64 = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from('')).digest('base64');

            let valid = false;
            try {
                // Try hex comparison (timing-safe)
                const rec = Buffer.from(received, 'hex');
                const comp = Buffer.from(computedHex, 'hex');
                if (rec.length === comp.length && crypto.timingSafeEqual(rec, comp)) valid = true;
            } catch (e) {}
            try {
                // Try base64 comparison (timing-safe)
                const recB = Buffer.from(received, 'base64');
                const compB = Buffer.from(computedBase64, 'base64');
                if (recB.length === compB.length && crypto.timingSafeEqual(recB, compB)) valid = true;
            } catch (e) {}
            // Fallback string compare for plain header formats
            if (received === computedHex || received === computedBase64) valid = true;

            if (!valid) {
                // Debug fallback: if custom test header matches, allow request even when signature is invalid
                if (testHeaderMatched) {
                    console.warn('DocuSeal signature invalid, but accepted via custom test header', testHeaderName);
                } else {
                    console.warn('Invalid DocuSeal webhook signature');
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            }
        }

        const payload = req.body || {};
        const eventType = payload.event_type || payload.type || '';
        const data = payload.data || payload;

        console.log('DocuSeal webhook received:', eventType, data?.id || data?.submission_id || 'no-id');

        const now = new Date().toISOString();

        const updateBySubmitter = async (fields) => {
            if (!data?.id) return;
            await supabase
                .from('docuseal_submissions')
                .update({ ...fields, updated_at: now })
                .eq('submitter_id', data.id);
        };

        const updateBySubmission = async (fields) => {
            const submissionId = data?.submission?.id || data?.submission_id || (eventType.startsWith('submission.') ? data?.id : null);
            if (!submissionId) return;
            await supabase
                .from('docuseal_submissions')
                .update({ ...fields, updated_at: now })
                .eq('submission_id', submissionId);
        };

        const getSubmissionIdFromWebhook = () => {
            return data?.submission?.id || data?.submission_id || (eventType.startsWith('submission.') ? data?.id : null);
        };

        const getSlugFromWebhook = (submissionId) => {
            const slugCandidate = data?.slug
                || data?.submission?.slug
                || data?.submission_url
                || data?.submission?.url
                || '';

            if (slugCandidate) {
                try {
                    const parsed = new URL(String(slugCandidate));
                    const parts = parsed.pathname.split('/').filter(Boolean);
                    const maybeSlug = parts[parts.length - 1] || '';
                    if (maybeSlug) return maybeSlug;
                } catch (e) {
                    const asString = String(slugCandidate).trim();
                    if (asString) return asString;
                }
            }

            return submissionId ? `submission-${submissionId}` : `submission-${Date.now()}`;
        };

        const upsertDocuSealSubmissionRow = async (nextStatus, extraFields = {}) => {
            const submissionId = getSubmissionIdFromWebhook();
            if (!submissionId) return;

            const firstSubmitter = Array.isArray(data?.submitters) && data.submitters.length > 0
                ? data.submitters[0]
                : null;

            const resolvedApplicationId = normalizeApplicationId(
                data?.metadata?.application_id
                || data?.application_id
                || data?.submission?.metadata?.application_id
                || data?.submission?.application_id
                || null
            );

            const row = {
                application_id: resolvedApplicationId,
                submission_id: String(submissionId),
                slug: getSlugFromWebhook(submissionId),
                status: nextStatus || data?.status || 'pending',
                template_id: data?.template?.id ? String(data.template.id) : null,
                submitters: Array.isArray(data?.submitters) ? data.submitters : (firstSubmitter ? [firstSubmitter] : null),
                metadata: data?.metadata || {},
                email: firstSubmitter?.email || data?.email || null,
                embed_src: firstSubmitter?.embed_src || null,
                name: firstSubmitter?.name || data?.name || null,
                role: firstSubmitter?.role || data?.role || null,
                submitter_id: firstSubmitter?.id ? String(firstSubmitter.id) : (data?.id ? String(data.id) : null),
                sent_at: firstSubmitter?.sent_at || data?.sent_at || null,
                opened_at: data?.opened_at || null,
                completed_at: data?.completed_at || null,
                declined_at: data?.declined_at || null,
                archived_at: data?.archived_at || null,
                updated_at: now,
                ...extraFields
            };

            const { error } = await supabase
                .from('docuseal_submissions')
                .upsert(row, { onConflict: 'submission_id' });

            if (error) {
                console.error('DocuSeal submission upsert error:', error, {
                    eventType,
                    submissionId,
                    row
                });
            }
        };

        const resolveApplicationIdFromWebhook = async () => {
            const directCandidate =
                data?.metadata?.application_id
                || data?.application_id
                || data?.submission?.metadata?.application_id
                || data?.submission?.application_id
                || null;

            if (directCandidate) {
                return directCandidate;
            }

            const submissionId = data?.submission?.id || data?.submission_id || null;
            const submitterId = data?.id || null;

            if (submitterId) {
                const { data: bySubmitter, error: bySubmitterError } = await supabase
                    .from('docuseal_submissions')
                    .select('application_id')
                    .eq('submitter_id', submitterId)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!bySubmitterError && bySubmitter?.application_id) {
                    return bySubmitter.application_id;
                }
            }

            if (submissionId) {
                const { data: bySubmission, error: bySubmissionError } = await supabase
                    .from('docuseal_submissions')
                    .select('application_id')
                    .eq('submission_id', submissionId)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!bySubmissionError && bySubmission?.application_id) {
                    return bySubmission.application_id;
                }
            }

            // Final weak fallback: look for a field in DocuSeal values that carries application id
            const valueMatch = Array.isArray(data?.values)
                ? data.values.find((entry) => {
                    const fieldName = String(entry?.field || '').toLowerCase();
                    return fieldName.includes('application') && fieldName.includes('id');
                })
                : null;

            if (valueMatch?.value) {
                return String(valueMatch.value).trim();
            }

            return null;
        };

        const updateApplicationStatusFromDocuSeal = async (applicationId, nextStatus, extraFields = {}) => {
            if (!applicationId) return null;

            const { data: beforeData, error: beforeError } = await supabase
                .from('loan_applications')
                .select('id, status, contract_signed_at, updated_at')
                .eq('id', applicationId)
                .maybeSingle();

            if (beforeError) {
                console.warn('DocuSeal: could not fetch current application status before update', {
                    applicationId,
                    error: beforeError.message || beforeError
                });
            }

            const { data: afterData, error: updateError } = await supabase
                .from('loan_applications')
                .update({ status: nextStatus, ...extraFields })
                .eq('id', applicationId)
                .select('id, status, contract_signed_at, updated_at')
                .maybeSingle();

            if (updateError) {
                throw updateError;
            }

            console.log('DocuSeal application status transition', {
                applicationId,
                eventType,
                previousStatus: beforeData?.status || null,
                newStatus: afterData?.status || nextStatus,
                updatedAt: afterData?.updated_at || now
            });

            return afterData;
        };

        switch (eventType) {
            case 'form.viewed':
                await upsertDocuSealSubmissionRow('opened', { opened_at: data.opened_at || now });
                await updateBySubmitter({ status: 'opened', opened_at: data.opened_at || now });
                break;
            case 'form.started':
                await upsertDocuSealSubmissionRow('started');
                await updateBySubmitter({ status: 'started' });
                break;
            case 'form.completed':
                await upsertDocuSealSubmissionRow('completed', {
                    completed_at: data.completed_at || now,
                    metadata: data.metadata || {}
                });
                await updateBySubmitter({ status: 'completed', completed_at: data.completed_at || now, metadata: data.values || data.metadata || {} });
                // After a submitter completes the form, mark the related application as Contract Signed (step 5)
                try {
                    const applicationId = await resolveApplicationIdFromWebhook();
                    if (applicationId) {
                        await updateApplicationStatusFromDocuSeal(applicationId, 'OFFER_ACCEPTED', {
                            contract_signed_at: now
                        });
                        console.log('DocuSeal: set application', applicationId, 'to OFFER_ACCEPTED');

                        try {
                            const activation = await triggerSureSystemsMandateForApplication(applicationId);
                            await recordSureSystemsActivation({
                                applicationId,
                                userId: activation?.userId || null,
                                status: 'success',
                                contractReference: activation?.contractReference || null,
                                message: 'Mandate loaded after DocuSeal completion',
                                requestPayload: activation?.requestPayload || null,
                                responsePayload: activation?.responsePayload || null,
                                at: now
                            });
                            if (activation?.contractReference) {
                                console.log('SureSystems: mandate loaded for application', applicationId, 'contractReference:', activation.contractReference);
                            }
                        } catch (sureSystemsError) {
                            await recordSureSystemsActivation({
                                applicationId,
                                status: 'failed',
                                message: sureSystemsError?.message || 'SureSystems activation failed',
                                errorPayload: sureSystemsError?.details || null,
                                at: now
                            });
                            console.warn('SureSystems mandate activation failed for application', applicationId, sureSystemsError?.message || sureSystemsError);
                        }
                    } else {
                        console.warn('DocuSeal completed event received but no application_id could be resolved', {
                            eventType,
                            submitterId: data?.id || null,
                            submissionId: data?.submission?.id || data?.submission_id || null,
                            metadata: data?.metadata || null
                        });
                    }
                } catch (err) {
                    console.error('Error updating application status after DocuSeal completed:', err);
                }
                break;
            case 'form.declined':
                try {
                    await upsertDocuSealSubmissionRow('declined', {
                        declined_at: data.declined_at || now,
                        metadata: data.metadata || {}
                    });
                    // Mark the submitter row as declined (use submitter id present in data.id)
                    await updateBySubmitter({ status: 'declined', declined_at: data.declined_at || now, metadata: data.values || data.metadata || {} });

                    // Also update any submission-level rows by submission.id if available
                    const submissionId = data.submission?.id || data.submission_id;
                    if (submissionId) {
                        await supabase
                            .from('docuseal_submissions')
                            .update({ status: 'declined', declined_at: data.declined_at || now, updated_at: now })
                            .eq('submission_id', submissionId);
                    }

                    // Update linked loan application status when offer signing is declined
                    const applicationId = await resolveApplicationIdFromWebhook();
                    if (applicationId) {
                        await updateApplicationStatusFromDocuSeal(applicationId, 'OFFER_DECLINED', {
                            updated_at: now
                        });
                        console.log('DocuSeal: set application', applicationId, 'to OFFER_DECLINED');
                    } else {
                        console.warn('DocuSeal declined event received but no application_id could be resolved', {
                            eventType,
                            submitterId: data?.id || null,
                            submissionId: data?.submission?.id || data?.submission_id || null,
                            metadata: data?.metadata || null
                        });
                    }
                } catch (error) {
                    console.error('DocuSeal form.declined handling error:', error);
                }
                break;
            case 'submission.archived':
                await upsertDocuSealSubmissionRow('archived', { archived_at: data.archived_at || now });
                await updateBySubmission({ status: 'archived', archived_at: data.archived_at || now });
                break;
            case 'submission.created':
                try {
                    await upsertDocuSealSubmissionRow(data.status || 'pending', {
                        created_at: data.created_at || now
                    });
                } catch (error) {
                    console.error('DocuSeal webhook upsert error:', error);
                }
                break;
            // Handle updates where submitter status changes (e.g. declined) or submission metadata updates
            case 'submitter.updated':
            case 'submitter.status_changed':
            case 'submission.updated':
            case 'submission.declined':
            case 'submitter.declined':
                try {
                    await upsertDocuSealSubmissionRow(data.status || 'pending');

                    // If submission-level status provided, update rows by submission_id
                    const submissionId = getSubmissionIdFromWebhook();
                    if (submissionId && data.status) {
                        await supabase
                            .from('docuseal_submissions')
                            .update({ status: data.status, updated_at: now })
                            .eq('submission_id', submissionId);
                    }
                } catch (error) {
                    console.error('DocuSeal webhook update error:', error);
                }
                break;
            default:
                console.log('Unhandled DocuSeal webhook event:', eventType);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('DocuSeal webhook processing error:', error);
        return res.status(500).json({ error: error.message || 'DocuSeal webhook failed' });
    }
});


// =================================================================
// --- 5. ADMIN & PUBLIC STATIC FILE SERVING (THE FIX) ---
// =================================================================

// 5a. Define the path to your *BUILT* admin app's 'dist' folder
const adminDistPath = path.join(__dirname, 'public', 'admin', 'dist');
const adminAssetsPath = path.join(adminDistPath, 'assets');
const adminSourcePath = path.join(__dirname, 'public', 'admin');
const adminBuildExists = fs.existsSync(path.join(adminDistPath, 'index.html'));

// Helper to pick the built file when it exists, otherwise fall back to source HTML.
const resolveAdminFile = (fileName) => {
    const builtFile = path.join(adminDistPath, fileName);
    if (adminBuildExists && fs.existsSync(builtFile)) {
        return builtFile;
    }
    return path.join(adminSourcePath, fileName);
};

if (adminBuildExists) {
    // ★★★ THIS IS THE FIX YOU NEEDED ★★★
    // This captures requests to /assets/... and points them to public/admin/dist/assets
    app.use('/assets', express.static(adminAssetsPath));

    // Fallback for cached asset names (serves latest hash when old file requested)
    app.get('/assets/:assetName', (req, res, next) => {
        const requestedFile = path.join(adminAssetsPath, req.params.assetName);
        if (fs.existsSync(requestedFile)) {
            return res.sendFile(requestedFile);
        }

        const dotIndex = req.params.assetName.lastIndexOf('.');
        const dashIndex = req.params.assetName.indexOf('-');
        if (dotIndex === -1 || dashIndex === -1) {
            return next();
        }

        const baseName = req.params.assetName.slice(0, dashIndex);
        const extension = req.params.assetName.slice(dotIndex);

        try {
            const files = fs.readdirSync(adminAssetsPath);
            const match = files.find(file => file.startsWith(`${baseName}-`) && file.endsWith(extension));
            if (match) {
                return res.sendFile(path.join(adminAssetsPath, match));
            }
        } catch (err) {
            console.error('Asset fallback error:', err);
        }

        return next();
    });

    // 5b. Serve all static assets (CSS, JS) from the 'dist' folder
    // This uses the '/admin' prefix
    app.use('/admin', express.static(adminDistPath));
} else {
    console.warn('Admin build not found at public/admin/dist. Falling back to source files. Run "npm run build --prefix public/admin" for optimized assets.');
    app.use('/admin', express.static(adminSourcePath));
}

// 5c. Serve the REST of the 'public' folder (for login.html, etc.)
const publicStaticOptions = process.env.NODE_ENV === 'production'
    ? {}
    : {
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    };
app.use(express.static(path.join(__dirname, 'public'), publicStaticOptions));


// --- 6. Root Redirect & Auth Helpers ---
app.get('/', (req, res) => {
    res.redirect('/auth/login.html');
});

// Helper routes to catch bad redirects
app.get('/login.html', (req, res) => {
    res.redirect('/auth/login.html');
});
app.get('/auth.html', (req, res) => {
    res.redirect('/auth/login.html');
});


// --- 7. Admin Page Routes (FOR MPA) ---

const sendAdminPage = (fileName, res) => {
    const filePath = resolveAdminFile(fileName);
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    return res.status(404).send('Admin page not found. Build the admin app or check the path.');
};

app.get('/admin', (req, res) => {
    sendAdminPage('index.html', res);
});

app.get('/admin/index.html', (req, res) => {
    sendAdminPage('index.html', res);
});

app.get('/admin/auth.html', (req, res) => {
    sendAdminPage('auth.html', res);
});

app.get('/admin/dashboard', (req, res) => {
    sendAdminPage('dashboard.html', res);
});


app.get('/admin/analytics', (req, res) => {
    sendAdminPage('analytics.html', res);
});

app.get('/admin/applications', (req, res) => {
    sendAdminPage('applications.html', res);
});

app.get('/admin/application-detail', (req, res) => {
    sendAdminPage('application-detail.html', res);
});

app.get('/admin/create-application-step1', (req, res) => {
    sendAdminPage('create-application-step1.html', res);
});

app.get('/admin/incoming-payments', (req, res) => {
    sendAdminPage('incoming-payments.html', res);
});

app.get('/admin/outgoing-payments', (req, res) => {
    sendAdminPage('outgoing-payments.html', res);
});

app.get('/admin/users', (req, res) => {
    sendAdminPage('users.html', res);
});

app.get('/admin/credit-rules', (req, res) => {
    sendAdminPage('credit-rules.html', res);
});

app.get('/admin/cash-ledger', (req, res) => {
    sendAdminPage('cash-ledger.html', res);
});

app.get('/admin/loan-book', (req, res) => {
    sendAdminPage('loan-book.html', res);
});

app.get('/admin/settings', (req, res) => {
    sendAdminPage('settings.html', res);
});

app.get('/admin/sacrra', (req, res) => {
    sendAdminPage('sacrra.html', res);
});

app.get('/admin/sacrra-validator', (req, res) => {
    sendAdminPage('sacrra-validator.html', res);
});

// ─── MOVEit / SACRRA transmission routes ─────────────────────────────────────

// Step 1: Initiate auth — returns access_token or triggers MFA email
app.post('/api/moveit/auth', async (req, res) => {
    try {
        const result = await moveItService.authenticate();
        if (result.requiresMfa) {
            return res.json({ requiresMfa: true, mfaToken: result.mfaToken, mfaMethods: result.mfaMethods });
        }
        return res.json({ success: true, accessToken: result.accessToken, expiresIn: result.expiresIn });
    } catch (err) {
        console.error('[MOVEit] Auth error:', err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message, details: err.details });
    }
});

// Step 2 (MFA only): Complete OTP challenge
app.post('/api/moveit/auth/mfa', async (req, res) => {
    try {
        const { mfaToken, otpCode } = req.body;
        if (!mfaToken || !otpCode) return res.status(400).json({ error: 'mfaToken and otpCode are required' });
        const result = await moveItService.completeMfa(mfaToken, otpCode);
        return res.json({ success: true, accessToken: result.accessToken, expiresIn: result.expiresIn });
    } catch (err) {
        console.error('[MOVEit] MFA error:', err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message, details: err.details });
    }
});

// Step 3: Upload a SACRRA file — body: { accessToken, fileName, fileContent (base64), folderId? }
app.post('/api/moveit/upload', async (req, res) => {
    try {
        const { accessToken, fileName, fileContent, folderId } = req.body;
        if (!accessToken || !fileName || !fileContent) {
            return res.status(400).json({ error: 'accessToken, fileName, and fileContent are required' });
        }
        const content = Buffer.from(fileContent, 'base64');
        const result  = await moveItService.uploadFile(accessToken, fileName, content, folderId);

        // Mark the latest sacrra_submission as TRANSMITTED
        const { supabaseStorage } = require('./config/supabaseServer');
        await supabaseStorage
            .from('sacrra_submissions')
            .update({ status: 'TRANSMITTED', notes: `Uploaded to MOVEit: ${result.fileId || fileName}`, updated_at: new Date().toISOString() })
            .eq('file_name', fileName);

        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('[MOVEit] Upload error:', err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message, details: err.details });
    }
});

// List files in the configured folder (for verification)
app.get('/api/moveit/files', async (req, res) => {
    try {
        const auth = await moveItService.authenticate();
        if (auth.requiresMfa) {
            return res.status(401).json({ error: 'MFA required — use service account for automated access' });
        }
        const files = await moveItService.listFolder(auth.accessToken, req.query.folderId);
        return res.json({ success: true, files });
    } catch (err) {
        console.error('[MOVEit] List error:', err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
});

// ─── SACRRA Response / Feedback routes ───────────────────────────────────────

/**
 * Parse a raw SACRRA Layout 700v2 response file and return structured rejections.
 * SACRRA response format:
 *   H — header (pos 1 = 'H')
 *   E — error/rejection record (pos 1 = 'E')  account ref + error code + message
 *   I — info record (some bureaus use 'I' for informational)
 *   T — trailer
 * Field positions (fixed-width):
 *   Pos 1:      Record type
 *   Pos 2-11:   Supplier Reference Number (SRN, 10 chars)
 *   Pos 12-31:  Account number (20 chars)
 *   Pos 32-34:  Error code (3 chars, e.g. E01)
 *   Pos 35-114: Error description (80 chars)
 */
function parseSACRRAResponseFile(content) {
    const SACRRA_ERROR_CODES = {
        'E01': 'SA ID Number invalid or checksum failed',
        'E02': 'Date of birth does not match ID number',
        'E03': 'Gender does not match ID number',
        'E04': 'Surname missing or exceeds 25 characters',
        'E05': 'First names missing or exceeds 14 characters',
        'E06': 'Residential address required',
        'E07': 'Postal code must be 4 digits',
        'E08': 'Account/loan number missing',
        'E09': 'Opening balance invalid or exceeds maximum',
        'E10': 'Current balance invalid or exceeds maximum',
        'E11': 'Date account opened missing or invalid format',
        'E12': 'Term months missing or out of range',
        'E13': 'Monthly installment invalid',
        'E14': 'Date format error (must be YYYYMMDD)',
        'E15': 'Status code invalid',
        'E16': 'Months in arrears inconsistent with status',
        'E17': 'Account type code invalid',
        'E18': 'Subscriber reference number not found',
        'E19': 'Record length not 700 characters',
        'E20': 'Duplicate account reference',
        'E26': 'Field exceeds maximum allowed length',
        'E99': 'General validation error',
        'W01': 'Warning: address may be incomplete',
        'W02': 'Warning: mobile number format suspect',
    };

    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const rejections = [];
    let headerSRN = '';
    let totalRecords = 0;
    let rejectedRecords = 0;
    let acceptedRecords = 0;

    for (const line of lines) {
        const type = line.charAt(0).toUpperCase();

        if (type === 'H') {
            headerSRN = line.slice(1, 11).trim();
        } else if (type === 'T') {
            // Trailer may contain counts
            totalRecords    = parseInt(line.slice(1, 9).trim()) || 0;
            rejectedRecords = parseInt(line.slice(9, 17).trim()) || 0;
            acceptedRecords = parseInt(line.slice(17,25).trim()) || 0;
        } else if (type === 'E' || type === 'R') {
            // Error/Rejection record
            const srn         = line.slice(1, 11).trim();
            const accountRef  = line.slice(11, 31).trim();
            const errorCode   = line.slice(31, 34).trim();
            const errorMsg    = line.slice(34, 114).trim() || SACRRA_ERROR_CODES[errorCode] || 'Unknown error';
            const matchKey    = `${srn || headerSRN}-${accountRef}`;

            rejections.push({
                match_key:     matchKey,
                account_ref:   accountRef,
                error_code:    errorCode || 'E99',
                error_message: errorMsg,
                description:   SACRRA_ERROR_CODES[errorCode] || errorMsg,
            });
        }
    }

    return {
        headerSRN,
        totalRecords:    totalRecords || lines.filter(l => !['H','T'].includes(l.charAt(0).toUpperCase())).length,
        rejectedRecords: rejectedRecords || rejections.length,
        acceptedRecords,
        rejections,
        raw_line_count:  lines.length,
    };
}

// ════════════════════════════════════════════════════════════════
// SACRRA Bureau Management
// ════════════════════════════════════════════════════════════════

// GET /api/sacrra/bureaux — list all bureau configs
app.get('/api/sacrra/bureaux', async (req, res) => {
    try {
        const { data, error } = await supabaseService
            .from('sacrra_bureaux')
            .select('*')
            .order('bureau_key');
        if (error) throw error;
        // Mask sensitive fields in the list view
        const masked = (data || []).map(b => ({
            ...b,
            submission_password: b.submission_password ? '••••••••' : null,
            pgp_public_key:      b.pgp_public_key ? b.pgp_public_key.slice(0, 60) + '...' : null
        }));
        res.json({ data: masked });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/sacrra/bureaux/:bureauKey — update bureau config
app.put('/api/sacrra/bureaux/:bureauKey', async (req, res) => {
    try {
        const { bureauKey } = req.params;
        const allowed = ['is_enabled', 'supplier_ref_number', 'pgp_public_key',
            'submission_method', 'submission_email', 'submission_host',
            'submission_username', 'submission_password', 'submission_folder'];
        const payload = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined && req.body[k] !== '••••••••') payload[k] = req.body[k] || null;
        }
        payload.updated_at = new Date().toISOString();
        const { data, error } = await supabaseService
            .from('sacrra_bureaux')
            .update(payload)
            .eq('bureau_key', bureauKey)
            .select()
            .single();
        if (error) throw error;
        res.json({ data, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sacrra/submit/:bureauKey — submit the SACRRA file to one bureau
// Body: { fileContent (plain text), fileName }
app.post('/api/sacrra/submit/:bureauKey', async (req, res) => {
    const startTime = Date.now();
    try {
        const { bureauKey } = req.params;
        const { fileContent, fileName } = req.body;
        if (!fileContent || !fileName) return res.status(400).json({ error: 'fileContent and fileName required' });

        // 1. Load bureau config
        const { data: bureau, error: bureauErr } = await supabaseService
            .from('sacrra_bureaux')
            .select('*')
            .eq('bureau_key', bureauKey)
            .single();
        if (bureauErr || !bureau) return res.status(404).json({ error: 'Bureau not found' });
        if (!bureau.is_enabled)   return res.status(400).json({ error: `Bureau ${bureauKey} is disabled` });
        if (!bureau.pgp_public_key) return res.status(400).json({ error: 'No PGP public key configured for this bureau' });

        // 2. Encrypt with bureau's PGP key
        const openpgp = require('openpgp');
        const publicKey = await openpgp.readKey({ armoredKey: bureau.pgp_public_key });
        const encrypted = await openpgp.encrypt({
            message:     await openpgp.createMessage({ text: fileContent }),
            encryptionKeys: publicKey
        });

        const pgpFileName = fileName.replace(/\.txt$/i, '.pgp');
        let result = { method: bureau.submission_method };

        // 3. Submit via the bureau's configured method
        if (bureau.submission_method === 'moveit') {
            const auth = await moveItService.authenticate();
            const upload = await moveItService.uploadFile({
                accessToken: auth.access_token,
                folderId:    bureau.submission_folder || process.env.MOVEIT_FOLDER_ID,
                fileName:    pgpFileName,
                content:     Buffer.from(encrypted)
            });
            result.uploadedFileId = upload?.fileId || upload?.id;

        } else if (bureau.submission_method === 'email') {
            if (!bureau.submission_email) throw new Error('No submission email configured');
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            const send = await resend.emails.send({
                from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
                to:      bureau.submission_email,
                subject: `SACRRA Layout 700v2 Submission — ${process.env.COMPANY_NAME || 'AlgoLend'} — ${new Date().toISOString().slice(0,10)}`,
                text:    `Please find attached the encrypted SACRRA Layout 700v2 submission.\n\nSupplier Reference: ${bureau.supplier_ref_number || 'N/A'}\nFile: ${pgpFileName}\nSubmitted: ${new Date().toISOString()}\n\nThis file is PGP-encrypted with your public key.`,
                attachments: [{ filename: pgpFileName, content: Buffer.from(encrypted) }]
            });
            result.emailId = send?.data?.id || send?.id;
        } else {
            throw new Error(`Unsupported submission method: ${bureau.submission_method}`);
        }

        // 4. Update last_submitted_at on the bureau row
        await supabaseService.from('sacrra_bureaux').update({
            last_submitted_at:      new Date().toISOString(),
            last_submission_status: 'success',
            last_submission_note:   `Submitted ${pgpFileName} via ${bureau.submission_method}`
        }).eq('bureau_key', bureauKey);

        result.durationMs = Date.now() - startTime;
        result.success = true;
        res.json(result);

    } catch (err) {
        console.error(`[sacrra/submit/${req.params.bureauKey}]`, err.message);
        await supabaseService.from('sacrra_bureaux').update({
            last_submission_status: 'failed',
            last_submission_note:   err.message
        }).eq('bureau_key', req.params.bureauKey).catch(()=>{});
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sacrra/response-files — list MOVEit for SACRRA response files
app.get('/api/sacrra/response-files', async (req, res) => {
    try {
        const auth = await moveItService.authenticate();
        if (auth.requiresMfa) {
            return res.status(401).json({ error: 'MFA required', hint: 'Configure a service account without MFA for automated response checking' });
        }
        // Check the same folder — response files are placed there by SACRRA/Experian
        const folderId = req.query.folderId || process.env.MOVEIT_FOLDER_ID;
        const files    = await moveItService.listFolder(auth.accessToken, folderId);
        // Filter to likely response files (SACRRA typically returns files with 'RESP', 'RESPONSE', 'ACK', 'FEEDBACK' in name)
        const responseFiles = (files || []).filter(f => {
            const n = (f.name || f.fileName || '').toUpperCase();
            return n.includes('RESP') || n.includes('ACK') || n.includes('FEEDBACK') || n.includes('REJECT') || n.includes('ERROR');
        });
        return res.json({ success: true, files: responseFiles, all_files: files });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
});

// POST /api/sacrra/import-response — parse response file content + store rejections
// Body: { content: string (raw file text), submissionId?: number, fileName?: string }
// OR:   { fileId: string (MOVEit file ID to download), submissionId?: number }
app.post('/api/sacrra/import-response', async (req, res) => {
    try {
        const { fileId, fileName, submissionId } = req.body;
        let content = req.body.content;

        // If fileId given, download from MOVEit
        if (!content && fileId) {
            const auth = await moveItService.authenticate();
            if (auth.requiresMfa) {
                return res.status(401).json({ error: 'MFA required — cannot auto-download' });
            }
            content = await moveItService.downloadFile(auth.accessToken, fileId);
        }

        if (!content) {
            return res.status(400).json({ error: 'Provide either content or fileId' });
        }

        const parsed = parseSACRRAResponseFile(content);

        // Store rejections in sacrra_rejections table
        let storedCount = 0;
        if (parsed.rejections.length > 0) {
            const rows = parsed.rejections.map(r => ({
                match_key:     r.match_key,
                error_code:    r.error_code,
                error_message: r.description || r.error_message,
                submission_id: submissionId || null,
                resolved:      false,
            }));

            // Upsert — avoid duplicates on re-import
            const { error: insertErr } = await supabaseService
                .from('sacrra_rejections')
                .upsert(rows, { onConflict: 'match_key,error_code', ignoreDuplicates: true });

            if (!insertErr) storedCount = rows.length;
            else console.warn('[sacrra/import-response] insert warning:', insertErr.message);
        }

        // Update submission status
        if (submissionId) {
            const newStatus = parsed.rejections.length === 0 ? 'ACCEPTED' : 'REJECTED';
            await supabaseService
                .from('sacrra_submissions')
                .update({
                    status: newStatus,
                    notes:  `${parsed.rejectedRecords} rejection(s) — ${parsed.acceptedRecords} accepted. Imported ${new Date().toLocaleDateString('en-ZA')}.`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', submissionId);
        }

        return res.json({
            success:         true,
            total_records:   parsed.totalRecords,
            rejections:      parsed.rejections.length,
            accepted:        parsed.acceptedRecords,
            stored:          storedCount,
            status:          parsed.rejections.length === 0 ? 'ACCEPTED' : 'REJECTED',
            details:         parsed.rejections,
        });
    } catch (err) {
        console.error('[sacrra/import-response] error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH /api/sacrra/submissions/:id — update submission status manually
app.patch('/api/sacrra/submissions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const valid = ['PENDING', 'ACCEPTED', 'REJECTED', 'PARTIAL'];
        if (status && !valid.includes(status)) {
            return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
        }
        const update = {};
        if (status) update.status = status;
        if (notes)  update.notes  = notes;
        update.updated_at = new Date().toISOString();
        const { error } = await supabaseService.from('sacrra_submissions').update(update).eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── Capitec payout CSV export ────────────────────────────────────────────────
// POST /api/payouts/capitec-csv
// Body: { applicationIds: string[], markDisbursed?: boolean }
// Returns: text/csv in Capitec batch-payment format.
// Also logs a suresystems billing event so the payment attempt is tracked.
app.post('/api/payouts/capitec-csv', async (req, res) => {
    try {
        const { applicationIds = [], markDisbursed = false } = req.body || {};

        if (!applicationIds.length) {
            return res.status(400).json({ error: 'applicationIds array is required' });
        }

        // Fetch applications + their bank accounts and profiles
        const { data: apps, error: fetchErr } = await supabaseService
            .from('loan_applications')
            .select(`
                id, amount, offer_principal, offer_monthly_repayment, offer_total_repayment,
                term_months, created_at, status,
                profiles:user_id ( full_name, identity_number ),
                bank_accounts:bank_account_id (
                    bank_name, account_holder, account_number, branch_code, account_type
                )
            `)
            .in('id', applicationIds)
            .in('status', ['READY_TO_DISBURSE', 'AFFORD_OK', 'OFFER_ACCEPTED']);

        if (fetchErr) throw fetchErr;
        if (!apps || apps.length === 0) {
            return res.status(404).json({ error: 'No eligible applications found for the given IDs.' });
        }

        // PIN lock — require a download PIN in the request header or body
        const CSV_DOWNLOAD_PIN = process.env.CSV_DOWNLOAD_PIN || '1234';
        const providedPin = req.headers['x-csv-pin'] || req.body?.pin || '';
        if (providedPin !== CSV_DOWNLOAD_PIN) {
            return res.status(403).json({
                error: 'Invalid or missing CSV download PIN.',
                hint: 'Include the PIN as x-csv-pin header or pin in request body.'
            });
        }

        // Build Capitec batch-payment CSV rows
        // Reference format: C{clientNumber}-L{loan_number}
        const csvHeaders = [
            'Reference',
            'Client Name',
            'ID Number',
            'Phone',
            'Account Holder',
            'Bank Name',
            'Account Number',
            'Branch Code',
            'Account Type',
            'Disbursal Amount',
            'Loan Term (months)',
            'Purpose',
            'Application ID',
            'Date'
        ].join(',');

        const rows = apps.map((app) => {
            const bank    = app.bank_accounts || {};
            const profile = app.profiles || {};
            // Reference: C{clientNum}-L{loanSeq}
            const clientNum  = profile.client_number ? String(profile.client_number) : `C${String(app.id).slice(-4).toUpperCase()}`;
            const loanSeq    = app.loan_number ? `L${String(app.loan_number).padStart(4, '0')}` : `L${String(app.id).slice(-4)}`;
            const reference  = `${clientNum}-${loanSeq}`;
            const disbursalAmount = Number(app.offer_principal || app.amount || 0).toFixed(2);
            const accountType = (bank.account_type || 'current').toLowerCase() === 'savings' ? 'Savings' : 'Current';
            const date = new Date().toISOString().slice(0, 10);

            return [
                `"${reference}"`,
                `"${(profile.full_name || '').replace(/"/g, '""')}"`,
                `"${profile.identity_number || ''}"`,
                `"${profile.cell_tel_no || profile.contact_number || ''}"`,
                `"${(bank.account_holder || profile.full_name || '').replace(/"/g, '""')}"`,
                `"${(bank.bank_name || '').replace(/"/g, '""')}"`,
                `"${bank.account_number || ''}"`,
                `"${bank.branch_code || ''}"`,
                `"${accountType}"`,
                disbursalAmount,
                app.term_months || 1,
                `"${(app.purpose || app.loan_purpose || 'Personal Loan').replace(/"/g, '""')}"`,
                `"${app.id}"`,
                date
            ].join(',');
        });

        const csvContent = [csvHeaders, ...rows].join('\n');

        // Optionally mark as DISBURSED
        if (markDisbursed) {
            const ids = apps.map((a) => a.id);
            await supabaseService
                .from('loan_applications')
                .update({ status: 'DISBURSED', updated_at: new Date().toISOString() })
                .in('id', ids);

            // Log a billing event for each disbursement
            const usageRows = ids.map((id) => ({
                client_id: (process.env.CLIENT_ID || process.env.COMPANY_NAME || 'default').toLowerCase().replace(/\s+/g, '-'),
                service: 'capitec',
                operation: 'payout_csv',
                application_id: String(id),
                status: 'success',
            }));
            await supabaseService.from('api_usage_log').insert(usageRows).catch(() => {});

            // Fire disbursement notifications + auto-post to Cash Ledger (non-blocking)
            const settings = await getSystemTheme();
            const company  = settings?.company_name || process.env.COMPANY_NAME || 'Zwane Financial';

            // Auto-post each disbursement as a cash_out entry in the Cash Ledger
            const journalRows = apps.map(app => ({
                entry_date:      new Date().toISOString().slice(0,10),
                entry_type:      'cash_out',
                category:        'loan_disbursement',
                description:     `Loan disbursed to ${app.profiles?.full_name || 'Client'} — Ref: ${app.loan_number || app.id.slice(0,8)}`,
                reference:       String(app.loan_number || app.id.slice(0,8).toUpperCase()),
                amount:          Number(app.offer_principal || app.amount || 0),
                branch_id:       app.branch_id || null,
                application_id:  String(app.id),
                created_by_name: 'System (Capitec CSV)'
            }));
            supabaseService.from('cash_journal').insert(journalRows)
                .then(() => console.log(`[cash-ledger] auto-posted ${journalRows.length} disbursement(s)`))
                .catch(e => console.warn('[cash-ledger] auto-post disbursement failed:', e.message));

            apps.forEach(app => {
                const phone = app.profiles?.cell_tel_no || app.profiles?.contact_number;
                const name  = app.profiles?.full_name || 'Client';
                const clientNum = app.profiles?.client_number || 'C' + String(app.id).slice(-4).toUpperCase();
                const loanSeq   = app.loan_number ? `L${String(app.loan_number).padStart(4,'0')}` : app.id.slice(0,8);
                const reference = clientNum ? `${clientNum}-${loanSeq}` : loanSeq;
                if (phone) {
                    messaging.notifyLoanDisbursed({
                        to: phone, clientName: name, reference,
                        amount: app.offer_principal || app.amount || 0, company
                    }).catch(e => console.warn('[messaging] disbursement notify failed:', e.message));
                }
            });
        }

        const date = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="capitec_payout_${date}.csv"`);
        return res.send(csvContent);

    } catch (err) {
        console.error('[capitec-csv] error:', err.message || err);
        return res.status(500).json({ error: err.message || 'CSV generation failed' });
    }
});

// GET /api/payouts/ready — list applications ready for disbursement
app.get('/api/payouts/ready', async (req, res) => {
    try {
        const { data, error } = await supabaseService
            .from('loan_applications')
            .select(`
                id, amount, offer_principal, offer_total_repayment, term_months, created_at, status,
                profiles:user_id ( full_name, identity_number ),
                bank_accounts:bank_account_id ( bank_name, account_number, branch_code, account_type, account_holder )
            `)
            .in('status', ['READY_TO_DISBURSE'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json({ applications: data || [] });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/billing/usage — API usage summary for a client (used by mint-admin)
app.get('/api/billing/usage', async (req, res) => {
    try {
        const { month, service } = req.query;
        const clientId = (process.env.CLIENT_ID || process.env.COMPANY_NAME || 'default')
            .toLowerCase().replace(/\s+/g, '-');

        let query = supabaseService
            .from('api_usage_log')
            .select('service, operation, status, created_at, application_id, latency_ms')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(500);

        if (service) query = query.eq('service', service);
        if (month) {
            const start = new Date(month + '-01');
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        // Aggregate by service + operation
        const summary = {};
        (data || []).forEach((row) => {
            const key = `${row.service}::${row.operation}`;
            if (!summary[key]) summary[key] = { service: row.service, operation: row.operation, total: 0, success: 0, error: 0 };
            summary[key].total++;
            if (row.status === 'success') summary[key].success++;
            else summary[key].error++;
        });

        return res.json({ clientId, rows: data, summary: Object.values(summary) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── Default interest calculation (NCA: 3% × current balance) ───────────────
// POST /api/loans/default-interest
// Body: { applicationId }
// Returns: current outstanding balance + default interest amount
app.post('/api/loans/default-interest', async (req, res) => {
    try {
        const { applicationId } = req.body || {};
        if (!applicationId) return res.status(400).json({ error: 'applicationId required' });

        const { data: app, error } = await supabaseService
            .from('loan_applications')
            .select('id, offer_principal, offer_total_repayment, offer_monthly_repayment, term_months, repayment_start_date, status')
            .eq('id', applicationId)
            .single();

        if (error || !app) return res.status(404).json({ error: 'Application not found' });

        // Calculate outstanding balance: total repayable minus payments received
        const { data: payments } = await supabaseService
            .from('repayments')
            .select('amount')
            .eq('application_id', applicationId)
            .eq('status', 'confirmed');

        const totalPaid = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const currentBalance = Math.max(0, parseFloat(app.offer_total_repayment || 0) - totalPaid);

        // NCA default interest: 3% per month on current outstanding balance
        const DEFAULT_INTEREST_RATE = 0.03;
        const defaultInterestMonthly = currentBalance * DEFAULT_INTEREST_RATE;

        await supabaseService
            .from('loan_applications')
            .update({
                status: 'IN_DEFAULT',
                offer_details: {
                    default_interest_rate: DEFAULT_INTEREST_RATE,
                    default_balance: currentBalance,
                    default_monthly_charge: defaultInterestMonthly,
                    defaulted_at: new Date().toISOString(),
                }
            })
            .eq('id', applicationId);

        return res.json({
            applicationId,
            currentBalance,
            defaultInterestRate: DEFAULT_INTEREST_RATE,
            defaultInterestMonthly,
            totalPaid,
        });
    } catch (err) {
        console.error('[default-interest] error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ================================================================
// 7b. Credit Rules API — Per-Client Configuration
// ================================================================

// --- Helper: require admin role ---
function requireAdmin(req, res, next) {
    const role = req.user?.app_metadata?.role || req.user?.user_metadata?.role;
    if (!['admin','super_admin','base_admin'].includes(role)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// GET /api/organizations — list all lender organizations
app.get('/api/organizations', async (req, res) => {
    try {
        const { data, error } = await supabaseService
            .from('organizations')
            .select('*')
            .order('name');
        if (error) throw error;
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/credit-rules/:orgId — get all rules + bands for an org
app.get('/api/credit-rules/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const [bandsResult, rulesResult] = await Promise.all([
            supabaseService
                .from('credit_score_bands')
                .select('*')
                .eq('organization_id', orgId)
                .order('sort_order'),
            supabaseService
                .from('credit_eligibility_rules')
                .select('*')
                .eq('organization_id', orgId)
                .order('sort_order')
        ]);
        if (bandsResult.error) throw bandsResult.error;
        if (rulesResult.error) throw rulesResult.error;
        res.json({ bands: bandsResult.data, rules: rulesResult.data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/credit-bands — create a score band
app.post('/api/credit-bands', async (req, res) => {
    try {
        const { data, error } = await supabaseService
            .from('credit_score_bands')
            .insert([req.body])
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/credit-bands/:id — update a score band
app.put('/api/credit-bands/:id', async (req, res) => {
    try {
        const { data, error } = await supabaseService
            .from('credit_score_bands')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/credit-bands/:id — remove a score band
app.delete('/api/credit-bands/:id', async (req, res) => {
    try {
        const { error } = await supabaseService
            .from('credit_score_bands')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/eligibility-rules/:id — update a rule
app.put('/api/eligibility-rules/:id', async (req, res) => {
    try {
        const { data, error } = await supabaseService
            .from('credit_eligibility_rules')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Cashsend fee schedule (Standard Bank CashSend, updated 2024) ──────────────
// https://www.standardbank.co.za/southafrica/personal/products-and-services/ways-to-bank/cashsend
const CASHSEND_FEE_SCHEDULE = [
    { maxAmount: 500,   fee: 10.00 },
    { maxAmount: 1000,  fee: 13.50 },
    { maxAmount: 2000,  fee: 17.00 },
    { maxAmount: 3000,  fee: 20.50 },
    { maxAmount: 5000,  fee: 25.00 },
    { maxAmount: 10000, fee: 35.00 },
];
const CASHSEND_MAX = 10000;

function getCashsendFee(amount) {
    const amt = Number(amount || 0);
    if (amt <= 0 || amt > CASHSEND_MAX) return null; // Not eligible
    const tier = CASHSEND_FEE_SCHEDULE.find(t => amt <= t.maxAmount);
    return tier ? tier.fee : CASHSEND_FEE_SCHEDULE[CASHSEND_FEE_SCHEDULE.length - 1].fee;
}

// GET /api/cashsend/fee?amount=X — return fee for a given amount
app.get('/api/cashsend/fee', (req, res) => {
    const amount = parseFloat(req.query.amount || 0);
    const fee    = getCashsendFee(amount);
    if (fee === null) {
        return res.json({
            eligible: false,
            reason:   amount > CASHSEND_MAX
                ? `CashSend maximum is R${CASHSEND_MAX.toLocaleString('en-ZA')}. Use bank transfer for larger amounts.`
                : 'Invalid amount',
            schedule: CASHSEND_FEE_SCHEDULE
        });
    }
    return res.json({
        eligible:   true,
        amount,
        fee,
        net_payout: amount - fee,
        method:     'CashSend (Standard Bank)',
        schedule:   CASHSEND_FEE_SCHEDULE
    });
});

// GET /api/cashsend/schedule — return full fee schedule
app.get('/api/cashsend/schedule', (req, res) => {
    res.json({ schedule: CASHSEND_FEE_SCHEDULE, max: CASHSEND_MAX });
});

// ══════════════════════════════════════════════════════════════
// MANUAL PAYMENT & EARLY SETTLEMENT  (client-facing)
// ══════════════════════════════════════════════════════════════

// GET /api/payment/banking-details
// Returns company banking details from system_settings so the client
// knows where to EFT their payment.
app.get('/api/payment/banking-details', async (req, res) => {
    try {
        const { data: settings } = await supabaseService
            .from('system_settings')
            .select('company_name, company_bank_name, company_bank_account_no, company_bank_branch_code, company_bank_account_type, company_bank_account_holder, company_bank_reference_prefix')
            .eq('id', 'global')
            .maybeSingle();

        res.json({
            company:        settings?.company_name            || process.env.COMPANY_NAME || 'Zwane Financial Services',
            bankName:       settings?.company_bank_name        || '',
            accountNo:      settings?.company_bank_account_no  || '',
            branchCode:     settings?.company_bank_branch_code || '',
            accountType:    settings?.company_bank_account_type || 'Current',
            accountHolder:  settings?.company_bank_account_holder || settings?.company_name || '',
            refPrefix:      settings?.company_bank_reference_prefix || 'REF'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payment/settlement-quote/:loanId
// Returns the settlement amount for a given loan (outstanding balance).
app.get('/api/payment/settlement-quote/:loanId', async (req, res) => {
    try {
        const { loanId } = req.params;

        // Try loans table first, fall back to loan_applications
        const { data: loan } = await supabaseService
            .from('loans')
            .select('id, outstanding_balance, principal_amount, application_id, loan_applications(loan_number, offer_total_repayment, offer_monthly_repayment, term_months)')
            .eq('id', loanId)
            .maybeSingle();

        if (!loan) {
            // Try by application_id
            const { data: app } = await supabaseService
                .from('loan_applications')
                .select('id, loan_number, amount, offer_total_repayment, offer_monthly_repayment, term_months, status')
                .eq('id', loanId)
                .maybeSingle();
            if (!app) return res.status(404).json({ error: 'Loan not found' });

            const outstanding = Number(app.offer_total_repayment || app.amount || 0);
            return res.json({
                loanId,
                loanNumber:   app.loan_number,
                outstanding,
                // Settlement discount: 5% off if paid in full today (NCA compliant)
                settlementAmount: Math.round(outstanding * 0.95 * 100) / 100,
                settlementDiscount: Math.round(outstanding * 0.05 * 100) / 100,
                validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0,10)
            });
        }

        const outstanding = Number(loan.outstanding_balance || loan.principal_amount || 0);
        res.json({
            loanId,
            loanNumber:       loan.loan_applications?.loan_number,
            outstanding,
            settlementAmount: Math.round(outstanding * 0.95 * 100) / 100,
            settlementDiscount: Math.round(outstanding * 0.05 * 100) / 100,
            validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0,10)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payment/submit-proof
// Client submits proof of manual EFT payment or settlement.
// Body: { loanId, applicationId, paymentType, amount, reference, notes, proofUrl }
app.post('/api/payment/submit-proof', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        // Verify token to get user id
        const { data: { user }, error: authErr } = await supabaseService.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

        const { loanId, applicationId, paymentType = 'partial', amount, reference, notes, proofUrl } = req.body;
        if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount is required' });

        const { data: profile } = await supabaseService
            .from('profiles')
            .select('full_name, phone, loan_number')
            .eq('id', user.id)
            .maybeSingle();

        const { data: record, error: insertErr } = await supabaseService
            .from('manual_payments')
            .insert([{
                loan_id:        loanId        ? parseInt(loanId, 10)        || null : null,  // bigint
                application_id: applicationId ? parseInt(applicationId, 10) || null : null,  // bigint
                user_id:        user.id,
                payment_type:   paymentType,
                amount:         Number(amount),
                reference:      reference || null,
                proof_url:      proofUrl  || null,
                notes:          notes     || null,
                status:         'pending'
            }])
            .select()
            .single();

        if (insertErr) throw insertErr;

        // No admin SMS — admin reviews via Incoming Payments → Manual Payment Proofs panel

        // Acknowledge receipt to client — SMS + WhatsApp + Email
        const toPhone = profile?.cell_tel_no || profile?.phone;
        const toEmail = profile?.email;
        const clientFirst = (profile?.full_name || 'Client').split(' ')[0];
        const co = process.env.COMPANY_NAME || 'Zwane Financial';
        const typeStr = paymentType === 'settlement' ? 'settlement' : 'payment';
        const ackSms = `Hi ${clientFirst}, we've received your ${typeStr} proof of R${Number(amount).toLocaleString('en-ZA')} (Ref: ${reference || 'N/A'}). We'll confirm within 1 business day. – ${co}`;
        const ackWa  = `📋 *Proof Received* — ${co}\n\nHi ${clientFirst}, we've received your ${typeStr} proof of *R${Number(amount).toLocaleString('en-ZA')}*.\n\nReference: ${reference || 'N/A'}\n\nWe'll review and confirm within *1 business day*. You'll receive another notification once confirmed.`;
        if (toPhone) messaging.sendSMS(toPhone, ackSms).catch(() => {});
        if (toPhone) messaging.sendWhatsApp(toPhone, ackWa).catch(() => {});
        if (toEmail) {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            resend.emails.send({
                from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
                to:      toEmail,
                subject: `We received your ${typeStr} proof — ${co}`,
                html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
                    <h2 style="color:#E7762E">Proof of Payment Received</h2>
                    <p>Hi <strong>${clientFirst}</strong>,</p>
                    <p>We've received your ${typeStr} proof of <strong>R${Number(amount).toLocaleString('en-ZA')}</strong> (Ref: ${reference || 'N/A'}).</p>
                    <p>Our team will review and confirm your payment within <strong>1 business day</strong>. You'll receive a confirmation via SMS, WhatsApp, and email once processed.</p>
                    <p style="color:#9ca3af;font-size:13px">— ${co}</p>
                  </div>`
            }).catch(() => {});
        }

        // Auto-post to cash journal as 'pending' repayment note
        await supabaseService.from('cash_journal').insert([{
            entry_date:      new Date().toISOString().slice(0,10),
            entry_type:      'cash_in',
            category:        paymentType === 'settlement' ? 'loan_disbursement' : 'repayment',
            description:     `[PENDING CONFIRMATION] ${typeLabel} from ${profile?.full_name || 'Client'} — R${Number(amount).toLocaleString('en-ZA')} — Ref: ${reference || 'N/A'}`,
            reference:       reference || record.id.slice(0,8).toUpperCase(),
            amount:          Number(amount),
            application_id:  String(applicationId || loanId || ''),
            created_by_name: `${profile?.full_name || 'Client'} (self-submitted, pending review)`
        }]).catch(() => {}); // non-blocking

        res.json({ success: true, paymentId: record.id, message: 'Payment proof submitted. Admin will confirm within 1 business day.' });
    } catch (err) {
        console.error('[submit-proof]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/payment/confirm/:id  — admin confirms a manual payment
app.post('/api/admin/payment/confirm/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Auth required' });
        const { data: { user } } = await supabaseService.auth.getUser(token);

        const { data: payment } = await supabaseService
            .from('manual_payments')
            .select('*, profiles:user_id(full_name, cell_tel_no, email)')
            .eq('id', id)
            .single();

        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        await supabaseService.from('manual_payments').update({
            status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString()
        }).eq('id', id);

        // ── Update outstanding balance on the loan ────────────────────
        // Find the loan record linked to this application and decrement
        const paidAmount = Number(payment.amount || 0);
        if (payment.application_id) {
            // Find loan by application_id
            const { data: loan } = await supabaseService
                .from('loans')
                .select('id, outstanding_balance')
                .eq('application_id', payment.application_id)
                .maybeSingle();

            if (loan) {
                const newBalance = Math.max(0, Number(loan.outstanding_balance || 0) - paidAmount);
                await supabaseService.from('loans')
                    .update({ outstanding_balance: newBalance, updated_at: new Date().toISOString() })
                    .eq('id', loan.id);
            }
        }

        // If settlement → zero balance + update loan status to SETTLED
        if (payment.payment_type === 'settlement' && payment.application_id) {
            await supabaseService.from('loan_applications')
                .update({ status: 'SETTLED', updated_at: new Date().toISOString() })
                .eq('id', payment.application_id);

            // Zero out the loan balance on settlement
            await supabaseService.from('loans')
                .update({ outstanding_balance: 0, status: 'settled', updated_at: new Date().toISOString() })
                .eq('application_id', payment.application_id);
        }

        // Update cash journal entry from pending to confirmed
        await supabaseService.from('cash_journal')
            .update({ created_by_name: `${payment.profiles?.full_name || 'Client'} (confirmed by admin)` })
            .ilike('reference', payment.id.slice(0,8) + '%');

        // ── Notify client via SMS + WhatsApp + Email ─────────────────
        const phone    = payment.profiles?.cell_tel_no || payment.profiles?.phone;
        const email    = payment.profiles?.email;
        const fullName = payment.profiles?.full_name || 'Client';
        const name     = fullName.split(' ')[0];
        const settings = await getSystemTheme();
        const company  = settings?.company_name || process.env.COMPANY_NAME || 'Zwane Financial';
        const amtFmt   = `R ${Number(payment.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        const ref      = payment.reference || payment.id.slice(0,8).toUpperCase();
        const isSettle = payment.payment_type === 'settlement';

        const smsMsg = isSettle
            ? `Hi ${name}, your settlement of ${amtFmt} (Ref: ${ref}) has been confirmed. Your loan is now SETTLED. Thank you! – ${company}`
            : `Hi ${name}, your payment of ${amtFmt} (Ref: ${ref}) has been confirmed and applied to your account. Thank you! – ${company}`;

        const waMsg = isSettle
            ? `✅ *Settlement Confirmed* — ${company}\n\nHi ${name}, your early settlement of *${amtFmt}* has been received and confirmed.\n\nReference: ${ref}\nYour loan is now *fully settled*.\n\nThank you for banking with us! 🎉`
            : `✅ *Payment Confirmed* — ${company}\n\nHi ${name}, your payment of *${amtFmt}* has been received and applied to your account.\n\nReference: ${ref}\n\nThank you! 🙏`;

        const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
              <div style="background:#E7762E;padding:24px 32px">
                <h2 style="color:#fff;margin:0;font-size:22px">${isSettle ? '🎉 Loan Settled!' : '✅ Payment Confirmed'}</h2>
                <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px">${company}</p>
              </div>
              <div style="padding:32px">
                <p style="font-size:15px;color:#111827">Hi <strong>${name}</strong>,</p>
                <p style="font-size:15px;color:#374151;line-height:1.6">
                  ${isSettle
                    ? `Your early settlement payment of <strong style="color:#E7762E">${amtFmt}</strong> has been received and confirmed. Your loan is now <strong>fully settled</strong>.`
                    : `Your payment of <strong style="color:#E7762E">${amtFmt}</strong> has been received and confirmed. It has been applied to your account.`}
                </p>
                <div style="background:#f9fafb;border-radius:10px;padding:16px;margin:20px 0">
                  <table style="width:100%;font-size:13px;color:#374151">
                    <tr><td style="padding:4px 0;color:#6b7280">Amount</td><td style="text-align:right;font-weight:700">${amtFmt}</td></tr>
                    <tr><td style="padding:4px 0;color:#6b7280">Reference</td><td style="text-align:right;font-weight:700">${ref}</td></tr>
                    <tr><td style="padding:4px 0;color:#6b7280">Type</td><td style="text-align:right">${isSettle ? 'Settlement' : 'Manual Payment'}</td></tr>
                    <tr><td style="padding:4px 0;color:#6b7280">Date</td><td style="text-align:right">${new Date().toLocaleDateString('en-ZA')}</td></tr>
                  </table>
                </div>
                ${isSettle ? `<p style="font-size:14px;color:#10b981;font-weight:600">🎉 Congratulations on settling your loan!</p>` : ''}
                <p style="font-size:13px;color:#9ca3af;margin-top:24px">If you have any questions, please contact us. — ${company}</p>
              </div>
            </div>`;

        // Send all three non-blocking
        if (phone) messaging.sendSMS(phone, smsMsg).catch(e => console.warn('[confirm-sms]', e.message));
        if (phone) messaging.sendWhatsApp(phone, waMsg).catch(e => console.warn('[confirm-wa]', e.message));
        if (email) {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
            resend.emails.send({
                from:    fromEmail,
                to:      email,
                subject: isSettle ? `✅ Loan Settled — ${amtFmt} confirmed | ${company}` : `✅ Payment confirmed — ${amtFmt} | ${company}`,
                html:    emailHtml
            }).catch(e => console.warn('[confirm-email]', e.message));
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-eligibility — returns borrower's current credit band + eligibility for dashboard widget
app.get('/api/my-eligibility', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Unauthorised' });

        const { data: { user }, error: authErr } = await supabaseService.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Unauthorised' });

        // Latest completed credit check
        const { data: cc } = await supabaseService
            .from('credit_checks')
            .select('credit_score, checked_at')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('checked_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!cc?.credit_score) return res.json({ eligible: false, reason: 'no_credit_check' });

        // Is first loan?
        const { count: prevLoans } = await supabaseService
            .from('loan_applications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('status', ['APPROVED', 'ACTIVE', 'SETTLED', 'COMPLETED']);
        const isFirstLoan = (prevLoans || 0) === 0;

        // Match band
        const { data: orgs } = await supabaseService.from('organizations').select('id').eq('is_active', true).limit(1);
        const orgId = orgs?.[0]?.id;
        if (!orgId) return res.json({ eligible: false, reason: 'no_org' });

        const { data: band } = await supabaseService
            .from('credit_score_bands')
            .select('*')
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .lte('min_score', cc.credit_score)
            .gte('max_score', cc.credit_score)
            .maybeSingle();

        if (!band || band.risk_level === 'declined') {
            return res.json({ eligible: false, reason: 'score_declined', credit_score: cc.credit_score });
        }

        const effectiveTerm = (isFirstLoan && band.first_loan_max_term_months)
            ? band.first_loan_max_term_months
            : band.max_term_months;

        res.json({
            eligible:            true,
            credit_score:        cc.credit_score,
            checked_at:          cc.checked_at,
            is_first_loan:       isFirstLoan,
            band: {
                label:           band.label,
                color:           band.color,
                risk_level:      band.risk_level,
                max_loan_amount: band.max_loan_amount,
                interest_rate_pa: band.interest_rate_pa,
                max_term_months: effectiveTerm
            },
            first_loan_restriction: (isFirstLoan && band.first_loan_max_term_months)
                ? `First loan: max ${band.first_loan_max_term_months} month term`
                : null
        });
    } catch (err) {
        console.error('[my-eligibility]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/applications/:id/evaluate — run rules engine against a saved application
// Fetches credit score + financial profile from DB, runs evaluate-credit, stores result
app.post('/api/applications/:id/evaluate', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Load the application + profile + financial data
        const { data: app, error: appErr } = await supabaseService
            .from('loan_applications')
            .select(`
                id, user_id, amount, term_months, bureau_score_band,
                profiles:user_id (
                    id, full_name, date_of_birth
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (appErr || !app) return res.status(404).json({ error: 'Application not found', detail: appErr?.message });

        // Load financial profile separately to avoid join issues
        const { data: financial } = await supabaseService
            .from('financial_profiles')
            .select('monthly_income, monthly_expenses, monthly_debt_repayments')
            .eq('user_id', app.user_id)
            .maybeSingle();

        const profile = Array.isArray(app.profiles) ? app.profiles[0] : app.profiles;

        // 2. Determine credit score (from application or latest credit check)
        let creditScore = app.bureau_score_band ? null : null; // bureau_score_band is a label, not a number
        if (!creditScore) {
            const { data: cc } = await supabaseService
                .from('credit_checks')
                .select('credit_score')
                .eq('user_id', app.user_id)
                .eq('status', 'completed')
                .order('checked_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            creditScore = cc?.credit_score ?? 0;
        }

        // 3. Check if this is the borrower's first loan
        const { count: prevLoans } = await supabaseService
            .from('loan_applications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', app.user_id)
            .in('status', ['APPROVED', 'ACTIVE', 'SETTLED', 'COMPLETED'])
            .neq('id', id);

        const isFirstLoan = (prevLoans || 0) === 0;

        // 4. Calculate age from date of birth
        const dob = profile?.date_of_birth;
        const age = dob
            ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
            : null;

        const monthlyIncome = Number(financial?.monthly_income || 0);
        const monthlyDebt   = Number(financial?.monthly_debt_repayments || financial?.monthly_expenses || 0);

        // 5. Get org id (default to first org)
        const { data: orgs } = await supabaseService
            .from('organizations')
            .select('id')
            .eq('is_active', true)
            .limit(1);
        const orgId = orgs?.[0]?.id;
        if (!orgId) return res.status(400).json({ error: 'No active organization found' });

        // 6. Run rules engine (internal call reusing same logic)
        const [bandsRes, rulesRes] = await Promise.all([
            supabaseService.from('credit_score_bands').select('*').eq('organization_id', orgId).eq('is_active', true).order('sort_order'),
            supabaseService.from('credit_eligibility_rules').select('*').eq('organization_id', orgId).eq('is_active', true).order('sort_order')
        ]);

        const dti = monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 999;
        const factors = {
            min_credit_score:          creditScore,
            min_monthly_income:        monthlyIncome,
            max_debt_to_income_pct:    dti,
            min_age:                   age,
            max_age:                   age,
            no_active_judgments:       true,   // would come from Experian report
            no_sequestration:          true,
            employed_or_self_employed: monthlyIncome > 0
        };

        const failures = [];
        for (const rule of (rulesRes.data || [])) {
            const val = factors[rule.rule_key];
            if (val === undefined || val === null) continue;
            let passed = true;
            const threshold = parseFloat(rule.threshold_value);
            if (rule.operator === 'gte')       passed = val >= threshold;
            else if (rule.operator === 'lte')  passed = val <= threshold;
            else if (rule.operator === 'is_true')  passed = val === true;
            else if (rule.operator === 'is_false') passed = val === false;
            if (!passed) failures.push({ rule_key: rule.rule_key, label: rule.rule_label, action: rule.fail_action, reason: rule.decline_reason });
        }

        const hasDecline = failures.some(f => f.action === 'decline');
        const hasReview  = failures.some(f => f.action === 'review');
        const band = (bandsRes.data || []).find(b => creditScore >= b.min_score && creditScore <= b.max_score);

        let decision = 'review';
        if (hasDecline || !band || band.risk_level === 'declined') {
            decision = 'declined';
        } else if (!hasReview && band.auto_decision === 'approve') {
            decision = 'approved';
        }

        const effectiveTerm = (isFirstLoan && band?.first_loan_max_term_months)
            ? band.first_loan_max_term_months
            : band?.max_term_months;

        const firstLoanMsg = (isFirstLoan && band?.first_loan_max_term_months)
            ? `First loan limited to ${band.first_loan_max_term_months} month(s). Longer terms unlock after successful repayment.`
            : null;

        // 6b. Apply individual client credit cap if set
        const { data: profileCap } = await supabaseService
            .from('profiles')
            .select('credit_limit_override, credit_limit_note')
            .eq('id', app.user_id)
            .maybeSingle();

        if (profileCap?.credit_limit_override && band) {
            const capAmt = Number(profileCap.credit_limit_override);
            if (capAmt < band.max_loan_amount) {
                band = { ...band, max_loan_amount: capAmt };
                if (!failures.some(f => f.rule_key === 'client_cap')) {
                    failures.push({
                        rule_key: 'client_cap',
                        label:    'Individual Client Cap Applied',
                        action:   'review',
                        reason:   `This client has a personal credit limit of R${capAmt.toLocaleString('en-ZA')}. ${profileCap.credit_limit_note || ''}`
                    });
                }
            }
        }

        // 7. Store result on the application
        await supabaseService.from('loan_applications').update({
            credit_decision:        decision,
            credit_band_label:      band?.label || null,
            credit_band_color:      band?.color || null,
            credit_max_loan:        band?.max_loan_amount || 0,
            credit_rate_pa:         band?.interest_rate_pa || 0,
            credit_max_term:        effectiveTerm || null,
            credit_decline_reasons: failures.length ? failures : null,
            first_loan_restriction: firstLoanMsg,
            is_first_loan:          isFirstLoan
        }).eq('id', id);

        res.json({
            decision,
            band: band ? { ...band, effective_max_term_months: effectiveTerm } : null,
            failures,
            is_first_loan: isFirstLoan,
            first_loan_restriction: firstLoanMsg,
            credit_score: creditScore
        });

    } catch (err) {
        console.error('[evaluate-application]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/evaluate-credit — run rules engine against a borrower profile
// Body: { organization_id, credit_score, monthly_income, monthly_debt, age, is_employed, has_judgments, under_debt_review }
app.post('/api/evaluate-credit', async (req, res) => {
    try {
        const { organization_id, credit_score, monthly_income, monthly_debt, age,
                is_employed, has_judgments, under_debt_review } = req.body;

        // Fetch org's rules and bands
        const [bandsRes, rulesRes] = await Promise.all([
            supabaseService.from('credit_score_bands').select('*')
                .eq('organization_id', organization_id).eq('is_active', true).order('sort_order'),
            supabaseService.from('credit_eligibility_rules').select('*')
                .eq('organization_id', organization_id).eq('is_active', true).order('sort_order')
        ]);
        if (bandsRes.error) throw bandsRes.error;
        if (rulesRes.error) throw rulesRes.error;

        const dti = monthly_income > 0 ? (monthly_debt / monthly_income) * 100 : 999;
        const factors = {
            min_credit_score:           credit_score,
            min_monthly_income:         monthly_income,
            max_debt_to_income_pct:     dti,
            min_age:                    age,
            max_age:                    age,
            no_active_judgments:        !has_judgments,
            no_sequestration:           !under_debt_review,
            employed_or_self_employed:  is_employed
        };

        // Run eligibility rules
        const failures = [];
        for (const rule of rulesRes.data) {
            const val = factors[rule.rule_key];
            if (val === undefined) continue;
            const threshold = parseFloat(rule.threshold_value);
            let passed = true;

            if (rule.operator === 'gte')      passed = val >= threshold;
            else if (rule.operator === 'lte') passed = val <= threshold;
            else if (rule.operator === 'eq')  passed = val == rule.threshold_value;
            else if (rule.operator === 'neq') passed = val != rule.threshold_value;
            else if (rule.operator === 'is_true')  passed = val === true;
            else if (rule.operator === 'is_false') passed = val === false;

            if (!passed) {
                failures.push({
                    rule_key:   rule.rule_key,
                    label:      rule.rule_label,
                    action:     rule.fail_action,
                    reason:     rule.decline_reason
                });
            }
        }

        const hasHardDecline = failures.some(f => f.action === 'decline');
        const hasReview      = failures.some(f => f.action === 'review');

        if (hasHardDecline) {
            return res.json({
                decision:  'declined',
                band:      null,
                failures,
                message:   failures.find(f => f.action === 'decline')?.reason || 'Application declined.'
            });
        }

        // Match score band
        const band = bandsRes.data.find(b => credit_score >= b.min_score && credit_score <= b.max_score);
        if (!band || band.risk_level === 'declined') {
            return res.json({ decision: 'declined', band: null, failures, message: 'Credit score outside lending criteria.' });
        }

        const decision = (hasReview || band.auto_decision === 'review') ? 'review'
                       : band.auto_decision === 'approve' ? 'approved'
                       : 'review';

        // Apply first-loan term restriction if applicable
        const isFirstLoan = req.body.is_first_loan === true;
        const effectiveMaxTerm = (isFirstLoan && band.first_loan_max_term_months)
            ? band.first_loan_max_term_months
            : band.max_term_months;

        res.json({
            decision,
            band: { ...band, effective_max_term_months: effectiveMaxTerm },
            failures,
            is_first_loan: isFirstLoan,
            first_loan_restriction: isFirstLoan && band.first_loan_max_term_months
                ? `First loan limited to ${band.first_loan_max_term_months} month(s). Longer terms unlock after successful repayment.`
                : null,
            message: null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/letters-of-demand/:applicationId — generate HTML letter ready for browser print-to-PDF
app.get('/api/letters-of-demand/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;

        const { data: app, error } = await supabaseService
            .from('loan_applications')
            .select(`
                id, amount, offer_principal, offer_monthly_repayment, offer_total_repayment,
                term_months, created_at, status, repayment_start_date, loan_number,
                loan_purpose, purpose,
                profiles:user_id (
                    full_name, identity_number, contact_number, cell_tel_no,
                    address, postal_code, suburb_area,
                    nok_name, nok_phone, nok_relationship
                )
            `)
            .eq('id', applicationId)
            .maybeSingle();

        if (error || !app) return res.status(404).json({ error: 'Application not found' });

        const profile     = app.profiles || {};
        const settings    = await getSystemTheme();
        const companyName = settings?.company_name || process.env.COMPANY_NAME || 'AlgoLend Financial Services';
        const companyAddr = settings?.company_physical_address || '';
        const companyPhone= settings?.company_phone || '';
        const companyEmail= process.env.CREDIT_PROVIDER_EMAIL || '';
        const today       = new Date().toLocaleDateString('en-ZA', { year:'numeric', month:'long', day:'numeric' });

        const clientNum   = profile.client_number ? String(profile.client_number) : 'C' + String(applicationId).slice(-4).toUpperCase();
        const loanSeq     = app.loan_number ? `L${String(app.loan_number).padStart(4,'0')}` : app.id.slice(0,8);
        const reference   = clientNum ? `${clientNum}-${loanSeq}` : loanSeq;

        const balance     = Number(app.offer_principal || app.amount || 0);
        const defaultInterest = balance * 0.03;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Letter of Demand — ${reference}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; background: #fff; }
  .page { max-width: 210mm; margin: 0 auto; padding: 25mm 20mm; }

  /* Header */
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24pt; border-bottom: 2px solid #000; padding-bottom: 12pt; }
  .company-name { font-size: 18pt; font-weight: bold; letter-spacing: -0.5px; }
  .company-details { font-size: 9pt; color: #333; margin-top: 4pt; line-height: 1.5; }
  .letter-type { font-size: 10pt; font-weight: bold; color: #c00; text-transform: uppercase; letter-spacing: 1px; }

  /* Date & Reference */
  .meta { margin: 20pt 0; font-size: 10pt; }
  .meta strong { font-size: 11pt; }

  /* Addressee */
  .addressee { margin: 16pt 0; font-size: 11pt; line-height: 1.8; }

  /* Subject */
  .subject { font-size: 12pt; font-weight: bold; text-decoration: underline; margin: 20pt 0 12pt; }

  /* Body */
  p { margin-bottom: 10pt; line-height: 1.6; text-align: justify; }

  /* Amounts table */
  .amounts { width: 100%; border-collapse: collapse; margin: 16pt 0; font-size: 11pt; }
  .amounts th { background: #000; color: #fff; padding: 6pt 10pt; text-align: left; font-size: 10pt; }
  .amounts td { padding: 5pt 10pt; border-bottom: 1px solid #ddd; }
  .amounts .total { font-weight: bold; background: #f5f5f5; font-size: 12pt; }
  .amounts .highlight { color: #c00; font-weight: bold; }

  /* Signature */
  .signature { margin-top: 36pt; }
  .sig-line { border-top: 1px solid #000; width: 200pt; margin-top: 40pt; font-size: 9pt; }

  /* Footer */
  .footer { margin-top: 40pt; padding-top: 8pt; border-top: 1px solid #999; font-size: 8pt; color: #555; text-align: center; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
    @page { size: A4; margin: 20mm; }
  }
</style>
</head>
<body>
<div class="no-print" style="background:#1a1a1a;color:#fff;padding:12px 20px;font-family:sans-serif;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
  <span>📄 Letter of Demand — ${profile.full_name || 'Borrower'} | Ref: ${reference}</span>
  <button onclick="window.print()" style="background:#E7762E;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">🖨 Print / Save PDF</button>
</div>

<div class="page">

  <div class="letterhead">
    <div>
      <div class="company-name">${companyName}</div>
      <div class="company-details">${companyAddr}${companyAddr ? '<br>' : ''}${companyPhone ? 'Tel: '+companyPhone : ''}${companyEmail ? ' | '+companyEmail : ''}</div>
    </div>
    <div style="text-align:right;">
      <div class="letter-type">Letter of Demand</div>
      <div style="font-size:9pt;color:#555;margin-top:6pt;">NCR Registered Credit Provider</div>
    </div>
  </div>

  <div class="meta">
    <strong>Date:</strong> ${today}<br>
    <strong>Reference:</strong> ${reference}<br>
    <strong>Application ID:</strong> ${app.id}
  </div>

  <div class="addressee">
    <strong>${profile.full_name || '[Client Name]'}</strong><br>
    ID Number: ${profile.identity_number || '[ID Number]'}<br>
    ${profile.address ? profile.address + '<br>' : ''}${profile.suburb_area ? profile.suburb_area + '<br>' : ''}${profile.postal_code || ''}
    <br><br>
    Contact: ${profile.contact_number || profile.cell_tel_no || '[Contact Number]'}
  </div>

  <div class="subject">NOTICE OF DEFAULT AND DEMAND FOR PAYMENT</div>

  <p>Dear <strong>${profile.full_name || 'Client'}</strong>,</p>

  <p>We refer to the loan agreement entered into between yourself and <strong>${companyName}</strong>. Despite previous requests for payment, your account is now in <strong>default</strong>.</p>

  <p>In terms of Section 129 of the National Credit Act 34 of 2005, we hereby give you formal notice that you are in default of your obligations and we demand immediate payment of all outstanding amounts.</p>

  <table class="amounts">
    <thead><tr><th>Description</th><th style="text-align:right;">Amount (R)</th></tr></thead>
    <tbody>
      <tr><td>Original Loan Amount</td><td style="text-align:right;">${Number(app.amount || 0).toLocaleString('en-ZA', {minimumFractionDigits:2})}</td></tr>
      <tr><td>Outstanding Principal Balance</td><td style="text-align:right;">${balance.toLocaleString('en-ZA', {minimumFractionDigits:2})}</td></tr>
      <tr><td>Default Interest (3% of balance)</td><td style="text-align:right;" class="highlight">${defaultInterest.toLocaleString('en-ZA', {minimumFractionDigits:2})}</td></tr>
      <tr class="total"><td>TOTAL AMOUNT DUE</td><td style="text-align:right;" class="highlight">${(balance + defaultInterest).toLocaleString('en-ZA', {minimumFractionDigits:2})}</td></tr>
    </tbody>
  </table>

  <p>You are hereby required to pay the above total amount within <strong>10 (ten) business days</strong> of receiving this notice. Failure to respond or make payment will result in:</p>

  <p style="margin-left:20pt;">
    1. Legal proceedings being instituted against you;<br>
    2. A negative listing on your credit record with the relevant credit bureau;<br>
    3. Recovery of all legal costs from you.
  </p>

  <p>Should you wish to arrange a payment plan or dispute this notice, please contact us immediately at the details above. You also have the right to approach a debt counsellor, alternative dispute resolution agent, consumer court, or the National Credit Regulator.</p>

  ${profile.nok_name ? `<p><em>We note that your next of kin ${profile.nok_name} (${profile.nok_relationship || ''}) may be contacted at ${profile.nok_phone || ''} if we are unable to reach you directly.</em></p>` : ''}

  <p>This letter serves as formal notice in terms of Section 129(1)(a) of the National Credit Act.</p>

  <div class="signature">
    <p>Yours faithfully,</p>
    <div class="sig-line">Authorised Signatory — ${companyName}</div>
  </div>

  <div class="footer">
    ${companyName} is a registered credit provider in terms of the National Credit Act 34 of 2005.
    This letter was generated on ${today} | Ref: ${reference}
  </div>

</div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        console.error('[letter-of-demand]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/loans/:id/default-interest — calculate 3% default interest on current balance
app.get('/api/loans/:id/default-interest', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: loan, error } = await supabaseService
            .from('loan_applications')
            .select('id, amount, offer_principal, status, credit_decision')
            .eq('id', id)
            .maybeSingle();

        if (error || !loan) return res.status(404).json({ error: 'Loan not found' });

        const currentBalance = Number(loan.offer_principal || loan.amount || 0);
        const DEFAULT_INTEREST_RATE = 0.03; // 3% of current balance per NCA
        const defaultInterest = currentBalance * DEFAULT_INTEREST_RATE;

        res.json({
            loan_id:              id,
            current_balance:      currentBalance,
            default_rate:         DEFAULT_INTEREST_RATE,
            default_interest:     Number(defaultInterest.toFixed(2)),
            total_with_default:   Number((currentBalance + defaultInterest).toFixed(2)),
            note:                 'Default interest = current balance × 3% per month (NCA regulated)'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/contracts/:applicationId/preview
// Full NCA-compliant Pre-Agreement Quote — print-ready HTML with CPI breakdown + logo
app.get('/api/contracts/:applicationId/preview', async (req, res) => {
    try {
        const { applicationId } = req.params;

        const { data: app, error } = await supabaseService
            .from('loan_applications')
            .select(`
                id, amount, offer_principal, offer_total_repayment, offer_monthly_repayment,
                offer_total_interest, offer_total_initiation_fees, offer_total_admin_fees,
                offer_credit_life_monthly, offer_vat_amount, offer_total_cost_of_credit,
                term_months, repayment_start_date, loan_number, loan_purpose, purpose,
                is_first_loan, agreement_number,
                profiles:user_id (
                    full_name, identity_number, contact_number, cell_tel_no,
                    address, postal_code, suburb_area, email,
                    employer_name,
                    nok_name, nok_phone, nok_relationship
                )
            `)
            .eq('id', applicationId)
            .maybeSingle();

        if (error || !app) return res.status(404).json({ error: 'Application not found' });

        const settings  = await getSystemTheme();
        const company   = settings?.company_name   || process.env.COMPANY_NAME   || 'Zwane Financial Services';
        const ncrNumber = settings?.ncr_number      || process.env.COMPANY_NCR    || 'NCRCP13510';
        const companyReg= settings?.company_reg_number || '';
        const companyTel= settings?.company_phone   || '';
        const companyAddr= settings?.company_physical_address || '';
        const logoUrl   = settings?.company_logo_url || 'https://static.wixstatic.com/media/f82622_cde1fbd5680141c5b0fccca81fb92ad6~mv2.png';

        const profile   = app.profiles || {};
        const today     = new Date().toLocaleDateString('en-ZA', { year:'numeric', month:'long', day:'numeric' });

        const principal  = Number(app.offer_principal || app.amount || 0);
        const term       = Number(app.term_months || 1);
        const interest   = Number(app.offer_total_interest || 0);
        const initiation = Number(app.offer_total_initiation_fees || 0);
        const serviceFee = Number(app.offer_total_admin_fees || 0);
        const cpiMonthly = Number(app.offer_credit_life_monthly || 0);
        const cpiTotal   = cpiMonthly * term;
        const vatAmt     = Number(app.offer_vat_amount || (initiation + serviceFee) * 0.15);
        const tcc        = Number(app.offer_total_cost_of_credit || (interest + initiation + serviceFee + cpiTotal + vatAmt));
        const totalRepay = Number(app.offer_total_repayment || (principal + tcc));
        const monthly    = Number(app.offer_monthly_repayment || (totalRepay / term));

        const interestRateMonthly = 5;          // 5% p/m
        const cpiRate             = 0.45;        // 0.45% p/m
        const initiationRate      = app.is_first_loan ? 5 : 15;

        const clientNum  = profile.client_number ? String(profile.client_number) : 'C' + String(applicationId).slice(-4).toUpperCase();
        const loanSeq    = app.loan_number ? `L${String(app.loan_number).padStart(4,'0')}` : app.id.slice(0,8).toUpperCase();
        const reference  = clientNum ? `${clientNum}-${loanSeq}` : loanSeq;
        const agreementNo= app.agreement_number || reference;

        let firstPayDate = 'TBD', finalPayDate = 'TBD';
        if (app.repayment_start_date) {
            const d1 = new Date(app.repayment_start_date);
            firstPayDate = d1.toLocaleDateString('en-ZA');
            const d2 = new Date(d1); d2.setMonth(d2.getMonth() + term - 1);
            finalPayDate = d2.toLocaleDateString('en-ZA');
        }

        const fmtR = (v) => `R ${Number(v).toLocaleString('en-ZA', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        const fmtPct = (v) => `${v}%`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Pre-Agreement Quote — ${agreementNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; background: #fff; }
  .page { max-width: 210mm; margin: 0 auto; padding: 12mm 14mm; }

  /* Print toolbar */
  .no-print { background:#1a1a1a; color:#fff; padding:10px 20px; font-family:sans-serif; font-size:13px; display:flex; justify-content:space-between; align-items:center; }
  .no-print button { background:#E7762E; color:#fff; border:none; padding:8px 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #E7762E; padding-bottom:8pt; margin-bottom:10pt; }
  .logo img { max-height:50px; max-width:140px; object-fit:contain; }
  .company-info { text-align:right; font-size:8pt; line-height:1.6; color:#444; }
  .doc-title { text-align:center; margin:8pt 0; }
  .doc-title h1 { font-size:13pt; font-weight:bold; letter-spacing:0.5px; }
  .doc-title p { font-size:8pt; color:#666; margin-top:2pt; }

  /* Reference bar */
  .ref-bar { background:#f8f4f0; border:1px solid #e0d8d0; border-radius:4pt; padding:6pt 10pt; display:flex; justify-content:space-between; margin-bottom:10pt; font-size:8pt; }
  .ref-bar strong { color:#E7762E; }

  /* Section headings */
  .section-title { background:#E7762E; color:#fff; padding:4pt 8pt; font-size:9pt; font-weight:bold; letter-spacing:0.3px; margin:10pt 0 4pt; border-radius:2pt; }

  /* Two-column grid */
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid #ddd; margin-bottom:2pt; }
  .grid2 .cell { padding:4pt 8pt; border-right:1px solid #ddd; }
  .grid2 .cell:last-child { border-right:none; }
  .grid2 .cell .label { font-size:7.5pt; color:#888; text-transform:uppercase; letter-spacing:0.3px; }
  .grid2 .cell .val { font-size:9.5pt; font-weight:bold; color:#1a1a1a; margin-top:1pt; }

  /* Costs table */
  .costs-table { width:100%; border-collapse:collapse; font-size:8.5pt; }
  .costs-table th { background:#f0f0f0; padding:4pt 8pt; text-align:left; font-size:7.5pt; text-transform:uppercase; letter-spacing:0.3px; border:1px solid #ddd; }
  .costs-table td { padding:4pt 8pt; border:1px solid #ddd; }
  .costs-table tr.highlight td { background:#fff8f3; font-weight:bold; color:#E7762E; }
  .costs-table tr.total td { background:#E7762E; color:#fff; font-weight:bold; font-size:9.5pt; }
  .costs-table .pct { color:#888; font-size:8pt; }

  /* CPI box */
  .cpi-box { border:1px solid #E7762E; border-radius:3pt; padding:8pt 10pt; margin:8pt 0; background:#fff8f3; }
  .cpi-box h4 { color:#E7762E; font-size:9pt; font-weight:bold; margin-bottom:6pt; display:flex; align-items:center; gap:6pt; }
  .cpi-box table { width:100%; font-size:8pt; border-collapse:collapse; }
  .cpi-box table td { padding:2pt 6pt; }
  .cpi-box table tr:nth-child(even) { background:#fff3ea; }

  /* Manual inserts */
  .manual { color:#c00; font-weight:bold; }
  .manual-note { font-size:7pt; color:#c00; margin-top:4pt; }

  /* Schedule */
  .schedule-table { width:100%; border-collapse:collapse; font-size:8pt; }
  .schedule-table th { background:#1a1a1a; color:#fff; padding:4pt 8pt; text-align:left; font-size:7.5pt; }
  .schedule-table td { padding:3pt 8pt; border-bottom:1px solid #eee; }
  .schedule-table tr:nth-child(even) td { background:#f9f9f9; }

  /* Declarations */
  .decl { font-size:7.5pt; line-height:1.6; color:#444; margin-top:8pt; text-align:justify; }
  .sign-row { display:flex; gap:20pt; margin-top:20pt; }
  .sign-block { flex:1; }
  .sign-line { border-top:1px solid #333; margin-top:36pt; font-size:7.5pt; padding-top:2pt; }

  /* Footer */
  .footer { margin-top:12pt; padding-top:6pt; border-top:1px solid #ccc; font-size:7pt; color:#888; text-align:center; }

  @media print {
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .no-print { display:none; }
    @page { size:A4; margin:12mm; }
  }
</style>
</head>
<body>

<div class="no-print">
  <span>📄 Pre-Agreement Quote — ${profile.full_name || 'Borrower'} | Ref: ${agreementNo}</span>
  <button onclick="window.print()">🖨 Print / Save PDF</button>
</div>

<div class="page">

  <!-- Letterhead -->
  <div class="header">
    <div class="logo">
      <img src="${logoUrl}" alt="${company}" onerror="this.style.display='none'">
      <div style="font-size:11pt;font-weight:bold;color:#E7762E;margin-top:4pt;">${company}</div>
    </div>
    <div class="company-info">
      NCR Registration: <strong>${ncrNumber}</strong><br>
      ${companyReg ? `Reg No: ${companyReg}<br>` : ''}
      ${companyTel ? `Tel: ${companyTel}<br>` : ''}
      ${companyAddr ? companyAddr + '<br>' : ''}
    </div>
  </div>

  <!-- Title -->
  <div class="doc-title">
    <h1>PRE-AGREEMENT STATEMENT AND QUOTATION</h1>
    <p>In terms of Section 92 of the National Credit Act 34 of 2005 (NCA) and Regulation 28</p>
  </div>

  <!-- Reference Bar -->
  <div class="ref-bar">
    <span>Agreement No: <strong>${agreementNo}</strong></span>
    <span>Date: <strong>${today}</strong></span>
    <span>Purpose: <strong>${app.loan_purpose || app.purpose || 'Personal Loan'}</strong></span>
    ${app.is_first_loan ? '<span style="color:#E7762E;font-weight:bold;">⭐ First Loan</span>' : ''}
  </div>

  <!-- Borrower Details -->
  <div class="section-title">A. BORROWER DETAILS</div>
  <div class="grid2">
    <div class="cell"><div class="label">Full Name</div><div class="val">${profile.full_name || '—'}</div></div>
    <div class="cell"><div class="label">SA ID Number</div><div class="val">${profile.identity_number || '—'}</div></div>
    <div class="cell"><div class="label">Address</div><div class="val">${[profile.address, profile.suburb_area, profile.postal_code].filter(Boolean).join(', ') || '—'}</div></div>
    <div class="cell"><div class="label">Mobile</div><div class="val">${profile.contact_number || profile.cell_tel_no || '—'}</div></div>
    <div class="cell"><div class="label">Email</div><div class="val">${profile.email || '—'}</div></div>
    <div class="cell"><div class="label">Employer</div><div class="val manual">${profile.employer_name || '— (Manual)'}</div></div>
  </div>
  <p class="manual-note">* Red fields require manual verification before disbursement</p>

  <!-- Loan Summary -->
  <div class="section-title">B. LOAN DETAILS</div>
  <div class="grid2">
    <div class="cell"><div class="label">Principal Amount</div><div class="val">${fmtR(principal)}</div></div>
    <div class="cell"><div class="label">Loan Term</div><div class="val">${term} Month${term>1?'s':''}</div></div>
    <div class="cell"><div class="label">Interest Rate</div><div class="val">${interestRateMonthly}% per month</div></div>
    <div class="cell"><div class="label">First Payment Date</div><div class="val">${firstPayDate}</div></div>
    <div class="cell"><div class="label">Final Payment Date</div><div class="val">${finalPayDate}</div></div>
    <div class="cell"><div class="label">Monthly Instalment</div><div class="val" style="color:#E7762E">${fmtR(monthly)}</div></div>
  </div>

  <!-- Cost of Credit -->
  <div class="section-title">C. TOTAL COST OF CREDIT BREAKDOWN</div>
  <table class="costs-table">
    <thead>
      <tr>
        <th>Cost Component</th>
        <th>Rate / Basis</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Interest Charges</td>
        <td><span class="pct">${interestRateMonthly}% p/m × ${term} month${term>1?'s':''}</span></td>
        <td>${fmtR(interest)}</td>
      </tr>
      <tr>
        <td>Initiation Fee ${app.is_first_loan ? '<span style="color:#E7762E;font-size:7.5pt;">(First Loan Rate)</span>' : ''}</td>
        <td><span class="pct">${initiationRate}% of principal (once-off)</span></td>
        <td>${fmtR(initiation)}</td>
      </tr>
      <tr>
        <td>Service Fee (Admin)</td>
        <td><span class="pct">R60.00/month × ${term} — first month prorated</span></td>
        <td>${fmtR(serviceFee)}</td>
      </tr>
      <tr class="highlight">
        <td>Credit Protection Insurance (CPI)</td>
        <td><span class="pct">${cpiRate}% p/m of principal × ${term} month${term>1?'s':''}</span></td>
        <td>${fmtR(cpiTotal)}</td>
      </tr>
      <tr>
        <td>VAT (15% on fees)</td>
        <td><span class="pct">15% on initiation + service fees</span></td>
        <td>${fmtR(vatAmt)}</td>
      </tr>
      <tr class="total">
        <td colspan="2">TOTAL COST OF CREDIT (D)</td>
        <td>${fmtR(tcc)}</td>
      </tr>
      <tr class="total" style="background:#1a1a1a">
        <td colspan="2">TOTAL REPAYABLE (Principal + TCC)</td>
        <td>${fmtR(totalRepay)}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:7.5pt;color:#888;margin-top:3pt;">Credit Cost Multiple (TCC ÷ Principal): ${tcc > 0 && principal > 0 ? (tcc/principal).toFixed(2) : '—'}</p>

  <!-- CPI Detail Box -->
  <div class="cpi-box">
    <h4>🛡 Credit Protection Insurance (CPI) — Full Breakdown</h4>
    <table>
      <tr><td><strong>Coverage:</strong></td><td>Death, Permanent Disability, Temporary Disability, Retrenchment</td></tr>
      <tr><td><strong>Monthly Premium:</strong></td><td>${fmtR(cpiMonthly)} (${cpiRate}% of R${principal.toLocaleString('en-ZA')})</td></tr>
      <tr><td><strong>Total Premium (${term} months):</strong></td><td><strong>${fmtR(cpiTotal)}</strong></td></tr>
      <tr><td><strong>Premium Rate:</strong></td><td>${cpiRate}% per month of the outstanding principal balance</td></tr>
      <tr><td><strong>Beneficiary:</strong></td><td>${company} (outstanding balance settled on valid claim)</td></tr>
      <tr><td><strong>Consent:</strong></td><td>By signing this agreement the borrower consents to CPI being added as a monthly premium.</td></tr>
    </table>
  </div>

  <!-- Next of Kin -->
  ${profile.nok_name ? `
  <div class="section-title">D. NEXT OF KIN</div>
  <div class="grid2">
    <div class="cell"><div class="label">Full Name</div><div class="val">${profile.nok_name}</div></div>
    <div class="cell"><div class="label">Relationship</div><div class="val">${profile.nok_relationship || '—'}</div></div>
    <div class="cell"><div class="label">Contact Number</div><div class="val">${profile.nok_phone || '—'}</div></div>
    <div class="cell"><div class="label"></div><div class="val"></div></div>
  </div>` : ''}

  <!-- NCA Declarations -->
  <div class="section-title">${profile.nok_name ? 'E' : 'D'}. DECLARATIONS & CONSENT</div>
  <div class="decl">
    <p>I, <strong>${profile.full_name || '[Borrower Name]'}</strong> (ID: ${profile.identity_number || '[ID Number]'}), confirm that:</p>
    <br>
    <p>1. I have read and understood this Pre-Agreement Statement and Quotation in terms of Section 92 of the NCA.</p>
    <p>2. The information provided is true and correct.</p>
    <p>3. I consent to ${company} conducting credit bureau enquiries on my credit profile.</p>
    <p>4. I consent to the Credit Protection Insurance (CPI) premium of <strong>${fmtR(cpiMonthly)}/month</strong> being added to my repayments.</p>
    <p>5. I understand that this quotation is valid for 5 business days and does not constitute a final offer.</p>
    <p>6. I have the right to reject CPI, but understand that the loan may not be approved without it.</p>
    <p>7. I consent to debit orders being raised against my nominated bank account for monthly repayments of <strong>${fmtR(monthly)}</strong>.</p>
  </div>

  <!-- Signatures -->
  <div class="sign-row">
    <div class="sign-block">
      <div class="sign-line">Borrower Signature: ${profile.full_name || '___________________'}</div>
      <div style="font-size:7.5pt;margin-top:2pt;">Date: ___________________</div>
    </div>
    <div class="sign-block">
      <div class="sign-line">Credit Provider: ${company}</div>
      <div style="font-size:7.5pt;margin-top:2pt;">Date: ${today}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    ${company} — NCR Registration: ${ncrNumber} ${companyReg ? '| Reg: '+companyReg : ''}<br>
    This document is a Pre-Agreement Quotation in terms of the National Credit Act 34 of 2005 | Ref: ${agreementNo}
  </div>

</div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        console.error('[contract-preview]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/applications/:id/route-to-head-office
// Flags online applications for head office review
app.post('/api/applications/:id/route-to-head-office', async (req, res) => {
    try {
        const { id } = req.params;
        const headOfficeBranchId = process.env.HEAD_OFFICE_BRANCH_ID || null;
        const updatePayload = { routed_to_head_office: true };
        if (headOfficeBranchId) updatePayload.branch_id = headOfficeBranchId;

        await supabaseService
            .from('loan_applications')
            .update(updatePayload)
            .eq('id', id);

        // Audit it
        await writeAudit({
            entityType: 'loan_application',
            entityId:   id,
            action:     'routed_to_head_office',
            description: 'Online application routed to head office for review',
            req
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
// AUDIT TRAIL — log important actions to audit_log table
// ================================================================
async function writeAudit({ entityType, entityId, action, oldValue = null, newValue = null, description, req = null }) {
    try {
        let performedBy = null, performedByName = null;
        if (req) {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
            if (token) {
                const { data: { user } } = await supabaseService.auth.getUser(token);
                if (user) {
                    performedBy = user.id;
                    const { data: profile } = await supabaseService
                        .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
                    performedByName = profile?.full_name || user.email;
                }
            }
        }
        await supabaseService.from('audit_log').insert([{
            entity_type:       entityType,
            entity_id:         String(entityId),
            action,
            old_value:         oldValue  ? JSON.parse(JSON.stringify(oldValue))  : null,
            new_value:         newValue  ? JSON.parse(JSON.stringify(newValue))  : null,
            description,
            performed_by:      performedBy,
            performed_by_name: performedByName,
            ip_address:        req?.ip || null
        }]);
    } catch (err) {
        console.warn('[audit]', err.message); // non-blocking
    }
}

// GET /api/audit-log/:entityType/:entityId — fetch audit history for any entity
app.get('/api/audit-log/:entityType/:entityId', async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { data, error } = await supabaseService
            .from('audit_log')
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/audit-log — full audit log with optional filters
app.get('/api/audit-log', async (req, res) => {
    try {
        const { entity_type, action, limit = 50, offset = 0 } = req.query;
        let query = supabaseService
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);
        if (entity_type) query = query.eq('entity_type', entity_type);
        if (action)      query = query.eq('action', action);
        const { data, error } = await query;
        if (error) throw error;
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
// MESSAGING API — SMS + WhatsApp endpoints
// ================================================================

// POST /api/messaging/otp — send OTP to a phone number
app.post('/api/messaging/otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'phone is required' });
        const settings  = await getSystemTheme();
        const company   = settings?.company_name || process.env.COMPANY_NAME || 'Zwane Financial';
        await messaging.sendOTPMessage({ to: phone, company });
        res.json({ success: true, message: 'OTP sent' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/messaging/verify-otp
app.post('/api/messaging/verify-otp', (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'phone and otp required' });
    const result = messaging.verifyOTP(phone, otp);
    res.json(result);
});

// GET /api/statement/:applicationId — generate loan statement for client download
app.get('/api/statement/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const { data: { user }, error: authErr } = await supabaseService.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

        const { data: app, error: appErr } = await supabaseService
            .from('loan_applications')
            .select('*, profiles:user_id(full_name, identity_number, cell_tel_no, email)')
            .eq('id', applicationId)
            .eq('user_id', user.id) // ensure client can only get their own
            .single();

        if (appErr || !app) return res.status(404).json({ error: 'Loan not found' });

        const { data: payments } = await supabaseService
            .from('payments')
            .select('*')
            .eq('user_id', user.id)
            .order('payment_date', { ascending: true });

        const { data: manualPayments } = await supabaseService
            .from('manual_payments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'confirmed')
            .order('created_at', { ascending: true });

        const settings = await getSystemTheme();
        const company  = settings?.company_name || process.env.COMPANY_NAME || 'Zwane Financial Services';
        const profile  = app.profiles || {};
        const loanRef  = app.loan_number || String(applicationId).slice(0,8).toUpperCase();
        const allPayments = [
            ...(payments || []).map(p => ({ date: p.payment_date, amount: p.amount, type: 'Debit Order', ref: p.id?.slice(0,8) })),
            ...(manualPayments || []).map(p => ({ date: p.created_at?.slice(0,10), amount: p.amount, type: 'Manual EFT', ref: p.reference || p.id?.slice(0,8) }))
        ].sort((a,b) => new Date(a.date) - new Date(b.date));

        const totalPaid = allPayments.reduce((s,p) => s + Number(p.amount), 0);
        const outstanding = Math.max(0, Number(app.offer_total_repayment || app.amount || 0) - totalPaid);
        const fmtR = v => `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        const today = new Date().toLocaleDateString('en-ZA');

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>Loan Statement — ${loanRef}</title>
        <style>
          body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#111}
          h1{color:#E7762E;font-size:22px;margin:0} .sub{color:#6b7280;font-size:12px}
          table{width:100%;border-collapse:collapse;margin:16px 0}
          th{background:#E7762E;color:#fff;padding:8px 12px;text-align:left;font-size:12px}
          td{padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}
          tr:nth-child(even) td{background:#fafafa}
          .summary{background:#fff8f3;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0}
          .kv{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}
          .kv span:last-child{font-weight:700} .footer{color:#9ca3af;font-size:11px;margin-top:24px}
        </style></head><body>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
          <div><h1>${company}</h1><p class="sub">Loan Statement — ${today}</p></div>
          <div style="text-align:right;font-size:12px;color:#6b7280">
            <div>Ref: <strong>${loanRef}</strong></div>
            <div>${profile.full_name || ''}</div>
            <div>ID: ${profile.identity_number || ''}</div>
          </div>
        </div>
        <div class="summary">
          <div class="kv"><span>Loan Amount</span><span>${fmtR(app.amount || app.offer_principal)}</span></div>
          <div class="kv"><span>Total Repayable</span><span>${fmtR(app.offer_total_repayment || app.amount)}</span></div>
          <div class="kv"><span>Monthly Instalment</span><span>${fmtR(app.offer_monthly_repayment)}</span></div>
          <div class="kv"><span>Total Paid</span><span style="color:#10b981">${fmtR(totalPaid)}</span></div>
          <div class="kv" style="border-top:2px solid #fed7aa;padding-top:8px;margin-top:8px">
            <span><strong>Outstanding Balance</strong></span>
            <span style="color:${outstanding>0?'#E7762E':'#10b981'};font-size:16px"><strong>${fmtR(outstanding)}</strong></span>
          </div>
        </div>
        <h3 style="font-size:14px;color:#374151;margin-bottom:8px">Payment History</h3>
        ${allPayments.length ? `
        <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Amount</th></tr></thead>
        <tbody>${allPayments.map(p => `<tr><td>${p.date||'—'}</td><td>${p.type}</td><td>${p.ref||'—'}</td><td>${fmtR(p.amount)}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:#9ca3af;font-size:13px">No payments recorded yet.</p>'}
        <p class="footer">${company} · NCR Registered Credit Provider · Statement generated ${today} · This is an official statement.</p>
        </body></html>`;

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="statement_${loanRef}_${today.replace(/\//g,'-')}.html"`);
        res.send(html);
    } catch (err) {
        console.error('[statement]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/support/ticket — client submits a support request
app.post('/api/support/ticket', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const { data: { user }, error: authErr } = await supabaseService.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

        const { subject, category, message, priority = 'normal' } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

        const { data: profile } = await supabaseService
            .from('profiles')
            .select('full_name, phone, email')
            .eq('id', user.id)
            .maybeSingle();

        // Save to support_tickets table
        const { data: ticket, error: ticketErr } = await supabaseService
            .from('support_tickets')
            .insert([{
                user_id:    user.id,
                subject:    subject || 'Support Request',
                category:   category || 'general',
                message,
                priority,
                status:     'open',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (ticketErr) {
            // If table doesn't exist yet, still send email and succeed
            console.warn('[support] support_tickets insert failed:', ticketErr.message);
        }

        // Email to credit provider / support team
        const company = process.env.COMPANY_NAME || 'Zwane Financial Services';
        const supportEmail = process.env.CREDIT_PROVIDER_EMAIL || process.env.RESEND_FROM_EMAIL;
        const clientName = profile?.full_name || user.email;
        const ticketRef  = ticket?.id?.slice(0,8)?.toUpperCase() || Date.now().toString(36).toUpperCase();

        if (supportEmail && process.env.RESEND_API_KEY) {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            resend.emails.send({
                from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
                to:      supportEmail,
                subject: `[Support #${ticketRef}] ${subject || 'New support request'} — ${company}`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px">
                    <h2 style="color:#E7762E">New Support Ticket #${ticketRef}</h2>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                        <tr><td style="padding:6px;color:#666;width:120px">Client</td><td style="padding:6px;font-weight:600">${clientName}</td></tr>
                        <tr><td style="padding:6px;color:#666">Phone</td><td style="padding:6px">${profile?.cell_tel_no || profile?.phone || '—'}</td></tr>
                        <tr><td style="padding:6px;color:#666">Category</td><td style="padding:6px">${category || 'General'}</td></tr>
                        <tr><td style="padding:6px;color:#666">Priority</td><td style="padding:6px">${priority}</td></tr>
                    </table>
                    <div style="background:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #E7762E">
                        <p style="margin:0;white-space:pre-wrap">${message}</p>
                    </div>
                    <p style="color:#9ca3af;font-size:12px;margin-top:16px">Ref: ${ticketRef} — ${company}</p>
                </div>`
            }).catch(e => console.warn('[support email]', e.message));
        }

        // Confirm to client via SMS
        if (profile?.cell_tel_no || profile?.phone) {
            messaging.sendSMS(profile.cell_tel_no || profile.phone,
                `Hi ${clientName?.split(' ')[0] || 'Client'}, your support request (Ref: ${ticketRef}) has been received. We'll respond within 1 business day. – ${company}`
            ).catch(() => {});
        }

        res.json({ success: true, ticketRef, message: `Support request submitted. Reference: ${ticketRef}` });
    } catch (err) {
        console.error('[support/ticket]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/messaging/send — manual send (admin tool)
// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS (Web Push API)
// ═══════════════════════════════════════════════════════════════

// GET /api/push/public-key — clients fetch the VAPID public key to subscribe
app.get('/api/push/public-key', (req, res) => {
    res.json({ publicKey: pushNotifications.getPublicKey() });
});

// POST /api/push/subscribe — save a client's push subscription
app.post('/api/push/subscribe', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const { data: { user }, error: authErr } = await supabaseService.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

        const subscription = req.body;
        if (!subscription?.endpoint) return res.status(400).json({ error: 'Subscription endpoint required' });

        const saved = await pushNotifications.saveSubscription(user.id, {
            ...subscription,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, id: saved.id });
    } catch (err) {
        console.error('[push/subscribe]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/push/unsubscribe — remove a subscription
app.post('/api/push/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
        await pushNotifications.removeSubscription(endpoint);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/push/test — send a test notification to current user
app.post('/api/push/test', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const { data: { user } } = await supabaseService.auth.getUser(token);
        if (!user) return res.status(401).json({ error: 'Invalid session' });

        const result = await pushNotifications.sendToUser(user.id, {
            title: 'Zwane Financial Services',
            body:  'Push notifications are working! 🎉',
            url:   '/user-portal/?page=dashboard',
            tag:   'test-notification'
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messaging/send', async (req, res) => {
    try {
        const { to, message, channel = 'both' } = req.body;
        if (!to || !message) return res.status(400).json({ error: 'to and message required' });
        let result;
        if (channel === 'sms')       result = await messaging.sendSMS(to, message);
        else if (channel === 'whatsapp') result = await messaging.sendWhatsApp(to, message);
        else result = await messaging.sendBoth(to, message);
        res.json({ success: true, result });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/messaging/registration-link — send WhatsApp onboarding link
app.post('/api/messaging/registration-link', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'phone required' });
        const settings = await getSystemTheme();
        const company  = settings?.company_name || process.env.COMPANY_NAME || 'Zwane Financial';
        const link     = `${process.env.APP_URL || 'https://your-portal.vercel.app'}/auth/register.html?ref=${messaging.normaliseZANumber(phone)}`;
        await messaging.sendRegistrationLink({ to: phone, link, company });
        res.json({ success: true, link });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/messaging/status — check which channels are enabled
app.get('/api/messaging/status', (req, res) => {
    res.json({
        sms:       { enabled: process.env.SMS_ENABLED === 'true',       configured: !!(process.env.BULKSMS_USERNAME && process.env.BULKSMS_PASSWORD) },
        whatsapp:  { enabled: process.env.WHATSAPP_ENABLED === 'true',  configured: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) }
    });
});

// GET /api/messaging/webhook — WhatsApp webhook verification (Meta requirement)
app.get('/api/messaging/webhook', (req, res) => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('✅ WhatsApp webhook verified');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// POST /api/messaging/webhook — incoming WhatsApp messages
app.post('/api/messaging/webhook', (req, res) => {
    // Acknowledge receipt immediately (Meta requires 200 within 20s)
    res.sendStatus(200);
    const body = req.body;
    if (body?.object === 'whatsapp_business_account') {
        const messages = body.entry?.[0]?.changes?.[0]?.value?.messages || [];
        messages.forEach(msg => {
            const from = msg.from;
            const text = msg.text?.body || '';
            console.log(`[WhatsApp inbound] From: ${from} | ${text}`);
            // Future: handle keyword routing (REGISTER, STATUS, BALANCE, etc.)
        });
    }
});

// POST /api/admin/invite-staff — create a staff/admin user account
// Only super_admin can create admin/base_admin; admin can create base_admin only
app.post('/api/admin/invite-staff', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const { data: { user }, error: authErr } = await supabaseService.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

        const callerRole = user.app_metadata?.role || user.user_metadata?.role || 'borrower';
        if (!['super_admin', 'admin'].includes(callerRole)) {
            return res.status(403).json({ error: 'Only admins can invite staff' });
        }

        const { email, full_name, role, branch_id, password } = req.body;
        if (!email || !full_name || !role || !password) {
            return res.status(400).json({ error: 'email, full_name, role and password are required' });
        }

        // Admins can only create base_admin; super_admin can create admin or base_admin
        const allowedRoles = callerRole === 'super_admin' ? ['admin', 'base_admin'] : ['base_admin'];
        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: `You can only create: ${allowedRoles.join(', ')}` });
        }

        // Create the auth user via service role
        const { data: newUser, error: createErr } = await supabaseService.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            app_metadata: { role },
            user_metadata:  { full_name, role }
        });

        if (createErr) {
            if (createErr.message?.includes('already registered')) {
                return res.status(409).json({ error: 'An account with this email already exists.' });
            }
            throw createErr;
        }

        // Upsert profile row
        await supabaseService.from('profiles').upsert({
            id:         newUser.user.id,
            full_name,
            email,
            role,
            branch_id:  branch_id || null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        // Audit
        await writeAudit({
            entityType: 'user', entityId: newUser.user.id,
            action: 'staff_invited',
            description: `Staff member ${full_name} (${role}) invited by ${user.email}`
        });

        res.status(201).json({
            success: true,
            user: { id: newUser.user.id, email, full_name, role }
        });
    } catch (err) {
        console.error('[invite-staff]', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Vercel Cron endpoints (replaces setInterval for serverless) ───
// Called by Vercel Cron every 6 hours instead of setInterval
app.get('/api/cron/notifications', async (req, res) => {
    if (process.env.VERCEL && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET || ''}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const sched = require('./services/notificationScheduler');
        await Promise.allSettled([
            sched.checkPaymentDueNotifications?.(),
            sched.checkEditWindowNotifications?.(),
            sched.updateLoanPaymentDates?.()
        ]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/cron/flag-defaults', async (req, res) => {
    if (process.env.VERCEL && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET || ''}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const sched = require('./services/notificationScheduler');
        await sched.flagDefaultedLoans?.();
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/disbursements/payout-csv — single-application disbursement CSV (admin panel, no PIN required)
app.post('/api/disbursements/payout-csv', async (req, res) => {
    try {
        const { applicationIds = [] } = req.body || {};
        if (!applicationIds.length) {
            return res.status(400).json({ error: 'applicationIds array is required' });
        }

        const { data: apps, error: fetchErr } = await supabaseService
            .from('loan_applications')
            .select(`
                id, amount, offer_principal, offer_monthly_repayment, offer_total_repayment,
                term_months, loan_number, created_at, status, branch_id,
                profiles:user_id ( full_name, identity_number ),
                bank_accounts:bank_account_id (
                    bank_name, account_holder, account_number, branch_code, account_type
                )
            `)
            .in('id', applicationIds);

        if (fetchErr) throw fetchErr;
        if (!apps || apps.length === 0) {
            return res.status(404).json({ error: 'No applications found for the given IDs.' });
        }

        const csvHeaders = [
            'Reference', 'Client Name', 'ID Number',
            'Account Holder', 'Bank Name', 'Account Number', 'Branch Code', 'Account Type',
            'Disbursal Amount', 'Loan Term (months)', 'Application ID', 'Date'
        ].join(',');

        const rows = apps.map((app) => {
            const bank       = app.bank_accounts || {};
            const profile    = app.profiles || {};
            const clientNum  = profile.client_number ? String(profile.client_number) : `C${String(app.id).slice(-4).toUpperCase()}`;
            const loanSeq    = app.loan_number ? `L${String(app.loan_number).padStart(4, '0')}` : `L${String(app.id).slice(-4)}`;
            const reference  = `${clientNum}-${loanSeq}`;
            const amount     = Number(app.offer_principal || app.amount || 0).toFixed(2);
            const accountType = (bank.account_type || 'current').toLowerCase() === 'savings' ? 'Savings' : 'Current';
            const date = new Date().toISOString().slice(0, 10);
            return [
                `"${reference}"`,
                `"${(profile.full_name || '').replace(/"/g, '""')}"`,
                `"${profile.identity_number || ''}"`,
                `"${(bank.account_holder || profile.full_name || '').replace(/"/g, '""')}"`,
                `"${(bank.bank_name || '').replace(/"/g, '""')}"`,
                `"${bank.account_number || ''}"`,
                `"${bank.branch_code || ''}"`,
                `"${accountType}"`,
                amount,
                app.term_months || 1,
                `"${app.id}"`,
                date
            ].join(',');
        });

        const csvContent = [csvHeaders, ...rows].join('\n');
        const date = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="disbursement_${date}.csv"`);
        return res.send(csvContent);
    } catch (err) {
        console.error('[disbursements/payout-csv] error:', err.message || err);
        return res.status(500).json({ error: err.message || 'CSV generation failed' });
    }
});

// POST /api/export/:type — generic data export for admin export manager
app.post('/api/export/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { start_date, end_date, format = 'csv' } = req.body || {};

        const dateFilter = (query, col = 'created_at') => {
            if (start_date) query = query.gte(col, start_date);
            if (end_date)   query = query.lte(col, end_date + 'T23:59:59');
            return query;
        };

        let rows = [];
        let filename = `export-${type}-${new Date().toISOString().slice(0,10)}`;

        if (type === 'dashboard' || type === 'applications') {
            let q = supabaseService.from('loan_applications')
                .select('id, loan_number, amount, offer_principal, offer_total_repayment, status, term_months, created_at, profiles:user_id(full_name, identity_number)')
                .order('created_at', { ascending: false });
            q = dateFilter(q);
            const { data, error } = await q;
            if (error) throw error;
            rows = (data || []).map(a => ({
                loan_number:   a.loan_number || '',
                client:        a.profiles?.full_name || '',
                id_number:     a.profiles?.identity_number || '',
                amount:        a.offer_principal || a.amount || 0,
                total_repay:   a.offer_total_repayment || 0,
                term_months:   a.term_months || '',
                status:        a.status || '',
                created_at:    a.created_at?.slice(0,10) || ''
            }));
            filename = `applications-${new Date().toISOString().slice(0,10)}`;
        } else if (type === 'payments' || type === 'incoming-payments') {
            let q = supabaseService.from('manual_payments')
                .select('id, amount, payment_type, reference, status, created_at, profiles:user_id(full_name)')
                .order('created_at', { ascending: false });
            q = dateFilter(q);
            const { data, error } = await q;
            if (error) throw error;
            rows = (data || []).map(p => ({
                reference:    p.reference || '',
                client:       p.profiles?.full_name || '',
                amount:       p.amount || 0,
                type:         p.payment_type || '',
                status:       p.status || '',
                date:         p.created_at?.slice(0,10) || ''
            }));
            filename = `payments-${new Date().toISOString().slice(0,10)}`;
        } else if (type === 'loan-book' || type === 'loans') {
            let q = supabaseService.from('loans')
                .select('id, principal_amount, outstanding_balance, monthly_payment, status, start_date, next_payment_date, loan_applications(loan_number, profiles:user_id(full_name, identity_number))')
                .order('start_date', { ascending: false });
            q = dateFilter(q, 'start_date');
            const { data, error } = await q;
            if (error) throw error;
            rows = (data || []).map(l => ({
                loan_number:       l.loan_applications?.loan_number || '',
                client:            l.loan_applications?.profiles?.full_name || '',
                id_number:         l.loan_applications?.profiles?.identity_number || '',
                principal:         l.principal_amount || 0,
                outstanding:       l.outstanding_balance || 0,
                monthly_payment:   l.monthly_payment || 0,
                status:            l.status || '',
                start_date:        l.start_date?.slice(0,10) || '',
                next_payment_date: l.next_payment_date?.slice(0,10) || ''
            }));
            filename = `loan-book-${new Date().toISOString().slice(0,10)}`;
        } else if (type === 'cash-ledger') {
            let q = supabaseService.from('cash_journal')
                .select('entry_date, entry_type, category, description, reference, amount, created_by_name')
                .order('entry_date', { ascending: false });
            q = dateFilter(q, 'entry_date');
            const { data, error } = await q;
            if (error) throw error;
            rows = data || [];
            filename = `cash-ledger-${new Date().toISOString().slice(0,10)}`;
        } else {
            return res.status(400).json({ error: `Unknown export type: ${type}` });
        }

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
            return res.send(JSON.stringify(rows, null, 2));
        }

        // CSV
        if (!rows.length) {
            return res.status(404).json({ error: 'No data found for the selected date range.' });
        }
        const headers = Object.keys(rows[0]).join(',');
        const csvRows = rows.map(r =>
            Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
        );
        const csv = [headers, ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(csv);
    } catch (err) {
        console.error('[export] error:', err.message || err);
        return res.status(500).json({ error: err.message || 'Export failed' });
    }
});

// --- 8. Start Server ---
// On Vercel, the module is imported directly — no listen() needed.
// Locally, listen() starts the server and the scheduler.
if (process.env.VERCEL) {
    // Vercel serverless: export the app, skip listen + scheduler
    console.log('🚀 Running on Vercel serverless');
} else {
    app.listen(PORT, () => {
        const companyNameForLog = cachedSystemSettings?.data?.company_name || DEFAULT_SYSTEM_SETTINGS.company_name;
        console.log(`🚀 ${companyNameForLog} server running on http://localhost:${PORT}`);
        console.log(`📁 Serving admin files from: ${adminDistPath}`);
        console.log(`📁 Serving public files from: ${path.join(__dirname, 'public')}`);
        startNotificationScheduler();
    });
}

// Export for Vercel serverless handler
module.exports = app;
