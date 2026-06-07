/**
 * Messaging Service — SMS (BulkSMS) + WhatsApp (Meta Cloud API)
 *
 * Setup:
 *  SMS:       BULKSMS_USERNAME + BULKSMS_PASSWORD  + SMS_ENABLED=true
 *  WhatsApp:  WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ENABLED=true
 */

const axios = require('axios');

const SMS_ENABLED      = () => process.env.SMS_ENABLED      === 'true';
const WHATSAPP_ENABLED = () => process.env.WHATSAPP_ENABLED === 'true';

// ─────────────────────────────────────────────────────────────────
// Phone normalisation (South Africa)
// ─────────────────────────────────────────────────────────────────
function normaliseZANumber(raw) {
    if (!raw) return null;
    let n = String(raw).replace(/[\s\-().+]/g, '');
    if (n.startsWith('0') && n.length === 10) n = '27' + n.slice(1);
    if (n.startsWith('27') && n.length === 11) return n;
    return null;
}

function fmtR(v) {
    return `R${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────
// SMS via BulkSMS
// ─────────────────────────────────────────────────────────────────
async function sendSMS(to, body) {
    const normTo = normaliseZANumber(to);
    if (!SMS_ENABLED()) {
        console.log(`[SMS disabled] → ${normTo || to}: ${body.slice(0, 60)}`);
        return { sent: false, reason: 'SMS_ENABLED is false' };
    }
    const username = process.env.BULKSMS_USERNAME;
    const password = process.env.BULKSMS_PASSWORD;
    if (!username || !password) {
        console.warn('[SMS] BULKSMS_USERNAME / BULKSMS_PASSWORD not set');
        return { sent: false, reason: 'missing credentials' };
    }
    if (!normTo) {
        console.warn('[SMS] Invalid phone number:', to);
        return { sent: false, reason: 'invalid number' };
    }
    try {
        // Build Basic auth manually to handle special chars (* # etc.) correctly
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        const { data } = await axios.post(
            'https://api.bulksms.com/v1/messages',
            [{ to: normTo, body }],
            { headers: { 'Authorization': `Basic ${encoded}`, 'Content-Type': 'application/json' } }
        );
        console.log(`✅ [SMS] sent to ${normTo}`);
        return { sent: true, data };
    } catch (err) {
        console.error('[SMS] Failed:', err.response?.data || err.message);
        return { sent: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────
// WhatsApp via Meta Cloud API
// ─────────────────────────────────────────────────────────────────
async function sendWhatsApp(to, message) {
    const normTo = normaliseZANumber(to);
    if (!WHATSAPP_ENABLED()) {
        console.log(`[WhatsApp disabled] → ${normTo || to}: ${message.slice(0, 60)}`);
        return { sent: false, reason: 'WHATSAPP_ENABLED is false' };
    }
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
        console.warn('[WhatsApp] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set');
        return { sent: false, reason: 'missing credentials' };
    }
    if (!normTo) return { sent: false, reason: 'invalid number' };
    try {
        const { data } = await axios.post(
            `https://graph.facebook.com/v18.0/${phoneId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type:    'individual',
                to:                normTo,
                type:              'text',
                text:              { preview_url: false, body: message }
            },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        console.log(`✅ [WhatsApp] sent to ${normTo}`);
        return { sent: true, data };
    } catch (err) {
        console.error('[WhatsApp] Failed:', err.response?.data || err.message);
        return { sent: false, error: err.message };
    }
}

async function sendBoth(to, message) {
    const [sms, wa] = await Promise.allSettled([sendSMS(to, message), sendWhatsApp(to, message)]);
    return { sms: sms.value, whatsapp: wa.value };
}

// ─────────────────────────────────────────────────────────────────
// OTP generation
// ─────────────────────────────────────────────────────────────────
const otpStore = new Map(); // { phone → { otp, expiresAt } }

function generateOTP(phone) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(normaliseZANumber(phone) || phone, {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 min
    });
    return otp;
}

function verifyOTP(phone, code) {
    const key = normaliseZANumber(phone) || phone;
    const entry = otpStore.get(key);
    if (!entry) return { valid: false, reason: 'No OTP found' };
    if (Date.now() > entry.expiresAt) { otpStore.delete(key); return { valid: false, reason: 'OTP expired' }; }
    if (entry.otp !== String(code).trim()) return { valid: false, reason: 'Incorrect OTP' };
    otpStore.delete(key);
    return { valid: true };
}

// ─────────────────────────────────────────────────────────────────
// Business event messages
// ─────────────────────────────────────────────────────────────────
async function notifyApplicationReceived({ to, clientName, reference, amount, company }) {
    return sendBoth(to, `Hi ${clientName}, your loan application (Ref: ${reference}) for ${fmtR(amount)} has been received by ${company}. We will review within 1 business day.`);
}

async function notifyLoanApproved({ to, clientName, reference, amount, monthly, company }) {
    return sendBoth(to, `APPROVED! Hi ${clientName}, your loan of ${fmtR(amount)} (Ref: ${reference}) is approved. Monthly instalment: ${fmtR(monthly)}. Funds disbursed shortly. – ${company}`);
}

async function notifyLoanDisbursed({ to, clientName, reference, amount, company }) {
    const now = new Date().toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
    return sendBoth(to, `Hi ${clientName}, ${fmtR(amount)} has been paid into your account (Ref: ${reference}) on ${now}. – ${company}`);
}

async function notifyPaymentDue({ to, clientName, amount, dueDate, company }) {
    return sendSMS(to, `Reminder: Hi ${clientName}, payment of ${fmtR(amount)} is due on ${dueDate}. Ensure funds are available for debit collection. – ${company}`);
}

async function notifyPaymentReceived({ to, clientName, amount, balance, company }) {
    const now = new Date().toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
    return sendBoth(to, `Thank you ${clientName}! Payment of ${fmtR(amount)} received on ${now}. Outstanding balance: ${fmtR(balance)}. – ${company}`);
}

async function notifyArrears({ to, clientName, daysOverdue, amount, company }) {
    return sendBoth(to, `URGENT: Hi ${clientName}, your account is ${daysOverdue} day(s) overdue. Amount due: ${fmtR(amount)}. Contact ${company} immediately to avoid legal action.`);
}

async function notifyDefault({ to, clientName, balance, defaultInterest, company }) {
    const total = Number(balance) + Number(defaultInterest);
    return sendBoth(to, `LEGAL NOTICE: Hi ${clientName}, your account is IN DEFAULT. Total due (incl. 3% default interest): ${fmtR(total)}. Letter of Demand issued. Contact ${company} within 10 days (NCR S129).`);
}

async function notifyCreditCheckDone({ to, clientName, ncrRef, company }) {
    const now = new Date().toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
    return sendSMS(to, `Hi ${clientName}, your credit bureau enquiry was completed on ${now}. NCR Reference: ${ncrRef}. – ${company}`);
}

async function sendOTPMessage({ to, company }) {
    const otp = generateOTP(to);
    await sendSMS(to, `Your ${company} verification code is: ${otp}. Valid 10 minutes. Do not share.`);
    return otp;
}

async function sendRegistrationLink({ to, link, company }) {
    return sendWhatsApp(to, `Hi! Welcome to ${company}. Complete your application here:\n${link}\n\nThis link expires in 24 hours.`);
}

module.exports = {
    sendSMS,
    sendWhatsApp,
    sendBoth,
    normaliseZANumber,
    generateOTP,
    verifyOTP,
    notifyApplicationReceived,
    notifyLoanApproved,
    notifyLoanDisbursed,
    notifyPaymentDue,
    notifyPaymentReceived,
    notifyArrears,
    notifyDefault,
    notifyCreditCheckDone,
    sendOTPMessage,
    sendRegistrationLink
};
