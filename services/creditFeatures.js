// creditFeatures.js — Gemini-powered bank statement feature extractor
// Uses the Gemini REST API (no SDK) so no additional dependencies are required.
// Input:  file buffer + mime type (application/pdf, image/jpeg, image/png)
// Output: structured feature vector consumed by creditScoreEngine.js

const axios = require('axios');

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_BYTES    = 4 * 1024 * 1024; // 4 MB inline limit

const EXTRACTION_PROMPT = `You are a senior financial analyst reviewing a South African bank statement.
Extract the following data and respond with ONLY a valid JSON object — no markdown, no explanation, no surrounding text.

Required JSON keys:
{
  "months_of_data":              <integer: number of distinct calendar months visible>,
  "gross_income":                <number: estimated monthly gross salary in ZAR>,
  "net_income":                  <number: average monthly net/take-home income in ZAR (regular salary credits)>,
  "avg_monthly_deposits":        <number: average total credits per month in ZAR>,
  "min_monthly_deposits":        <number: lowest single month's total credits in ZAR>,
  "avg_closing_balance":         <number: average month-end closing balance in ZAR>,
  "min_closing_balance":         <number: lowest recorded balance at any point in ZAR>,
  "existing_debt_installments":  <number: total recurring monthly debt/loan debit orders in ZAR>,
  "num_lenders":                 <integer: count of distinct credit providers or loan references>,
  "dishonored_debits":           <integer: count of returned/bounced/dishonored debit orders>,
  "salary_regularity":           <number: 1 if salary credits on consistent dates each month (±5 days), 0 if irregular>,
  "gambling_detected":           <number: 1 if gambling merchants present (Betway, Hollywoodbets, SportsBet, etc.), 0 otherwise>,
  "large_irregular_credits":     <number: 1 if large one-off credits exist that do not match normal salary pattern, 0 otherwise>
}

Rules:
- All monetary values in ZAR, no currency symbols, numeric only
- Use 0 for any field that cannot be determined — never null or undefined
- existing_debt_installments: sum only recurring debit orders that appear in multiple months; exclude once-off payments
- num_lenders: count distinct lender names, not individual transactions
- dishonored_debits: include only entries labelled "returned", "dishonoured", "unpaid", "bounced", or "R/D"
- Respond with the JSON object only`;

async function extractFeatures(buffer, mimeType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    if (buffer.length > MAX_BYTES) {
        throw new Error(`Bank statement exceeds Gemini inline limit (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 4 MB)`);
    }

    const base64Data = buffer.toString('base64');

    const payload = {
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                },
                { text: EXTRACTION_PROMPT }
            ]
        }],
        generationConfig: {
            temperature: 0,        // deterministic extraction
            maxOutputTokens: 512,
            responseMimeType: 'application/json'
        }
    };

    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
    });

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed;
    try {
        // Strip any accidental markdown fences
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error(`Gemini returned non-JSON response: ${rawText.slice(0, 200)}`);
    }

    return sanitiseFeatures(parsed);
}

function sanitiseFeatures(raw) {
    const num  = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const int  = (v) => Math.max(0, Math.round(num(v)));
    const flag = (v) => (num(v) >= 1 ? 1 : 0);

    return {
        months_of_data:             Math.max(1, int(raw.months_of_data)),
        gross_income:               num(raw.gross_income),
        net_income:                 num(raw.net_income),
        avg_monthly_deposits:       num(raw.avg_monthly_deposits),
        min_monthly_deposits:       num(raw.min_monthly_deposits),
        avg_closing_balance:        num(raw.avg_closing_balance),
        min_closing_balance:        num(raw.min_closing_balance),
        existing_debt_installments: num(raw.existing_debt_installments),
        num_lenders:                int(raw.num_lenders),
        dishonored_debits:          int(raw.dishonored_debits),
        salary_regularity:          flag(raw.salary_regularity),
        gambling_detected:          flag(raw.gambling_detected),
        large_irregular_credits:    flag(raw.large_irregular_credits)
    };
}

module.exports = { extractFeatures };
