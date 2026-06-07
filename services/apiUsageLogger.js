/**
 * Centralised API usage logger for billing.
 * Wraps external API calls (Experian, TruID, DocuSeal, SureSystems) and
 * writes a row to `api_usage_log` after each call completes or fails.
 *
 * client_id is read from CLIENT_ID env var, falling back to
 * COMPANY_NAME → 'default'. Set CLIENT_ID per deployment so the
 * mint-admin billing engine can aggregate by tenant.
 */

const { supabaseService } = require('../config/supabaseServer');

const CLIENT_ID = (
  process.env.CLIENT_ID ||
  process.env.COMPANY_NAME ||
  'default'
).toLowerCase().replace(/\s+/g, '-');

/**
 * Log a completed external API call.
 * @param {object} params
 * @param {'experian'|'truid'|'docuseal'|'suresystems'} params.service
 * @param {string}  params.operation   e.g. 'credit_check', 'initiate_collection'
 * @param {'success'|'error'|'timeout'} params.status
 * @param {number}  [params.latencyMs]
 * @param {number}  [params.httpStatus]
 * @param {string}  [params.applicationId]
 * @param {string}  [params.userId]
 * @param {string}  [params.errorMessage]
 * @param {object}  [params.metadata]
 */
async function logApiCall({
  service,
  operation,
  status,
  latencyMs,
  httpStatus,
  applicationId,
  userId,
  errorMessage,
  metadata,
}) {
  try {
    await supabaseService.from('api_usage_log').insert({
      client_id: CLIENT_ID,
      service,
      operation,
      status,
      http_status: httpStatus ?? null,
      latency_ms: latencyMs ?? null,
      application_id: applicationId ? String(applicationId) : null,
      user_id: userId ?? null,
      error_message: errorMessage ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    // Never let logging blow up the main request.
    console.warn('[apiUsageLogger] write failed:', err?.message || err);
  }
}

/**
 * Wrap an async function that calls an external API.
 * Automatically measures latency and logs success/error.
 *
 * @param {object}   opts
 * @param {string}   opts.service
 * @param {string}   opts.operation
 * @param {string}   [opts.applicationId]
 * @param {string}   [opts.userId]
 * @param {object}   [opts.metadata]    Extra context merged into the log row
 * @param {Function} fn                 The async function to execute
 * @returns {Promise<*>}               The return value of fn
 */
async function tracked(opts, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - start;
    const httpStatus = result?.status || result?.statusCode || null;
    logApiCall({ ...opts, status: 'success', latencyMs, httpStatus });
    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const httpStatus = err?.response?.status || err?.status || null;
    const errorMessage = err?.response?.data?.error || err?.message || String(err);
    logApiCall({ ...opts, status: 'error', latencyMs, httpStatus, errorMessage });
    throw err;
  }
}

module.exports = { logApiCall, tracked, CLIENT_ID };
