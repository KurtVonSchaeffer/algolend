// Experian ID Me Now (IDMN) Service
// Handles biometric liveness verification, facial match vs DoHA, and AML/PEP screening
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const IS_UAT = process.env.IDMN_ENV !== 'production';

const CONFIG = {
    baseUrl: IS_UAT
        ? 'https://apis-uat.experian.co.za:9443/IdMeNow'
        : 'https://apis.experian.co.za:9443/IdMeNow',
    username: IS_UAT
        ? (process.env.IDMN_UAT_USERNAME || '2849-uat')
        : (process.env.IDMN_PROD_USERNAME || '35054-api'),
    password: IS_UAT
        ? (process.env.IDMN_UAT_PASSWORD || '')
        : (process.env.IDMN_PROD_PASSWORD || ''),
    originatingApp: process.env.COMPANY_NAME || 'ALGOLEND',
};

// Workflow IDs differ between UAT and Production
const WORKFLOW_IDS = {
    ALTERNATIVE_LIVENESS:    IS_UAT ? 10 : 6,
    ID_LIVENESS_CHECK:       IS_UAT ? 11 : 7,
    OCR_LIVENESS:            IS_UAT ? 12 : 8,
    AML_SCREENING:           IS_UAT ? 13 : 9,
    FULL_IDMENOW:            IS_UAT ? 14 : 10,  // Liveness + AML — recommended default
    INDIVIDUAL_LIVENESS:     IS_UAT ? 15 : 4,
};

function getAuthHeader() {
    const token = Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString('base64');
    return `Basic ${token}`;
}

function buildSystemSettings(clientRef) {
    const now = new Date().toISOString().replace('T', 'T').slice(0, 19);
    return {
        version: '1.0',
        originating_application: CONFIG.originatingApp.slice(0, 20),
        originating_environment: IS_UAT ? 'UAT' : 'PRODUCTION',
        client_reference: (clientRef || uuidv4()).slice(0, 128),
        request_time: now,
    };
}

/**
 * Start an IDMN workflow.
 * Returns { url, transactionId, token } where url is sent to the client.
 * The client visits url to complete biometric verification.
 *
 * @param {object} clientData  - { identityNumber, name, surname, clientConsent }
 * @param {string} workflowKey - key from WORKFLOW_IDS (default: 'FULL_IDMENOW')
 * @param {string} clientRef   - your internal reference (applicationId or userId)
 */
async function startWorkflow(clientData, workflowKey = 'FULL_IDMENOW', clientRef = null) {
    const { identityNumber, name, surname, clientConsent = 'Y' } = clientData;

    if (!identityNumber) throw new Error('identityNumber is required');
    if (!name || !surname) throw new Error('name and surname are required');

    const workflowId = WORKFLOW_IDS[workflowKey];
    if (!workflowId) throw new Error(`Unknown workflowKey: ${workflowKey}`);

    const body = {
        system_settings: buildSystemSettings(clientRef),
        search_criteria: {
            identity_number: String(identityNumber),
            identity_type: 'SID',
            name: String(name).slice(0, 35),
            surname: String(surname).slice(0, 35),
            client_consent: clientConsent === 'Y' ? 'Y' : 'N',
            workflow_id: workflowId,
        },
    };

    const response = await axios.post(`${CONFIG.baseUrl}/StartWorkflow`, body, {
        headers: {
            Authorization: getAuthHeader(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        timeout: 30000,
    });

    const { response_status, error_code, error_description, return_data } = response.data;

    if (response_status !== 'Success' || !return_data) {
        throw new Error(`IDMN StartWorkflow failed: ${error_code} — ${error_description}`);
    }

    return {
        transactionId: return_data.transaction_id,
        token:         return_data.token,
        url:           return_data.url,
        dateCreated:   return_data.date_created,
        workflowKey,
        workflowId,
    };
}

/**
 * Collect results for a completed IDMN workflow.
 * Call this after the client has finished the biometric flow at the URL.
 *
 * @param {string} transactionId - from startWorkflow response
 * @param {string} reference     - token from startWorkflow response
 * @param {string} clientRef     - your internal reference
 */
async function collectResults(transactionId, reference, clientRef = null) {
    if (!transactionId || !reference) throw new Error('transactionId and reference are required');

    const body = {
        system_settings: buildSystemSettings(clientRef),
        search_criteria: {
            transaction_id: String(transactionId),
            reference: String(reference),
        },
    };

    const response = await axios.post(`${CONFIG.baseUrl}/CollectWorkflowResults`, body, {
        headers: {
            Authorization: getAuthHeader(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        timeout: 30000,
    });

    const { response_status, error_code, error_description, return_data, transaction_stats } = response.data;

    if (response_status === 'Failure') {
        // IMN_205 = no records yet (client hasn't completed yet) — not a hard error
        if (error_code === 'IMN_205') {
            return { status: 'pending', message: 'Client has not yet completed verification' };
        }
        throw new Error(`IDMN CollectResults failed: ${error_code} — ${error_description}`);
    }

    return {
        status:          'completed',
        transactionStats: transaction_stats,
        data:            return_data,
        raw:             response.data,
    };
}

/**
 * Ping the IDMN service to verify connectivity.
 */
async function ping() {
    try {
        const response = await axios.get(`${CONFIG.baseUrl}/PingServer`, {
            headers: { Authorization: getAuthHeader() },
            timeout: 10000,
        });
        return response.data === true || response.data === 'true' || response.status === 200;
    } catch {
        return false;
    }
}

/**
 * Parse IDMN result into a structured summary for storage.
 * Call after collectResults returns status='completed'.
 */
function parseResult(result) {
    const data = result?.data || {};
    return {
        liveness_passed:    data.liveness_result === 'Pass' || data.liveness_check === 'PASS',
        facial_match:       data.facial_match_result === 'Pass' || data.facial_match === 'PASS',
        identity_verified:  data.id_verification_result === 'Pass' || data.id_verified === true,
        aml_clear:          data.aml_result === 'Clear' || data.aml_status === 'CLEAR',
        pep_clear:          data.pep_result === 'Clear' || data.pep_status === 'CLEAR',
        overall_result:     data.overall_result || data.result || 'UNKNOWN',
        raw_data:           data,
    };
}

module.exports = {
    startWorkflow,
    collectResults,
    ping,
    parseResult,
    WORKFLOW_IDS,
    IS_UAT,
};
