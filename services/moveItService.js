/**
 * MOVEit Transfer REST API Service
 * Handles authentication (with MFA support) and file uploads
 * to the Experian SACRRA MFT endpoint.
 *
 * Auth flow:
 *   1. POST /api/v1/token  → access_token  (service account, no MFA)
 *      or                  → mfa_access_token + error_code 2028 (MFA required)
 *   2. If MFA: POST /api/v1/token/mfa  → access_token
 *   3. POST /api/v1/folders/{folderId}/files  → upload
 */

const axios = require('axios');
const FormData = require('form-data');

const config = {
    baseUrl:  (process.env.MOVEIT_BASE_URL  || 'https://expcnntmv.experian.co.za').replace(/\/$/, ''),
    username: process.env.MOVEIT_USERNAME   || '',
    password: process.env.MOVEIT_PASSWORD   || '',
    folderId: process.env.MOVEIT_FOLDER_ID  || '',
};

const TOKEN_URL    = `${config.baseUrl}/api/v1/token`;
const TOKEN_MFA_URL = `${config.baseUrl}/api/v1/token/mfa`;

/**
 * Authenticate with MOVEit.
 * Returns { accessToken } on success.
 * Returns { mfaToken, mfaMethods } when MFA is required.
 */
async function authenticate(username, password) {
    const res = await axios.post(TOKEN_URL,
        new URLSearchParams({
            grant_type: 'password',
            username:   username || config.username,
            password:   password || config.password,
        }).toString(),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
            validateStatus: () => true,
        }
    );

    const body = res.data;

    // MFA required — return the mfa_access_token so the caller can complete with OTP
    if (body.error_code === 2028 || body.error === 'mfa_required') {
        return {
            requiresMfa:  true,
            mfaToken:     body.mfa_access_token,
            mfaMethods:   body.mfa_supported_methods,
        };
    }

    if (!body.access_token) {
        const err = new Error(body.error_description || body.error || 'MOVEit authentication failed');
        err.status  = res.status;
        err.details = body;
        throw err;
    }

    return { accessToken: body.access_token, expiresIn: body.expires_in };
}

/**
 * Complete MFA challenge with a one-time password.
 * mfaToken  — the mfa_access_token from authenticate()
 * otpCode   — the OTP from email/authenticator
 */
async function completeMfa(mfaToken, otpCode) {
    const res = await axios.post(TOKEN_MFA_URL,
        new URLSearchParams({
            grant_type:        'mfa',
            mfa_access_token:  mfaToken,
            passcode:          otpCode,
        }).toString(),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
            validateStatus: () => true,
        }
    );

    const body = res.data;

    if (!body.access_token) {
        const err = new Error(body.error_description || body.error || 'MOVEit MFA verification failed');
        err.status  = res.status;
        err.details = body;
        throw err;
    }

    return { accessToken: body.access_token, expiresIn: body.expires_in };
}

/**
 * Upload a file to a MOVEit folder.
 * accessToken — bearer token from authenticate() or completeMfa()
 * fileName    — name of the file as it should appear in MOVEit
 * fileContent — string or Buffer
 * folderId    — defaults to MOVEIT_FOLDER_ID env var
 */
async function uploadFile(accessToken, fileName, fileContent, folderId) {
    const targetFolder = folderId || config.folderId;
    if (!targetFolder) {
        throw new Error('MOVEit folder ID not configured. Set MOVEIT_FOLDER_ID in .env');
    }

    const form = new FormData();
    form.append('file', Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent, 'utf8'), {
        filename:    fileName,
        contentType: fileName.endsWith('.pgp') ? 'application/octet-stream' : 'text/plain',
    });

    const uploadUrl = `${config.baseUrl}/api/v1/folders/${targetFolder}/files`;

    const res = await axios.post(uploadUrl, form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${accessToken}`,
        },
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
        validateStatus:   () => true,
    });

    if (res.status < 200 || res.status >= 300) {
        const err = new Error(res.data?.message || `MOVEit upload failed with status ${res.status}`);
        err.status  = res.status;
        err.details = res.data;
        throw err;
    }

    return {
        success:  true,
        fileId:   res.data?.id   || null,
        fileName: res.data?.name || fileName,
        size:     res.data?.size || null,
    };
}

/**
 * List files in the configured folder (useful for verifying uploads).
 */
async function listFolder(accessToken, folderId) {
    const targetFolder = folderId || config.folderId;
    const res = await axios.get(`${config.baseUrl}/api/v1/folders/${targetFolder}/files`, {
        headers:        { Authorization: `Bearer ${accessToken}` },
        timeout:        15000,
        validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(res.data?.message || `MOVEit folder list failed with status ${res.status}`);
    }

    return res.data?.items || res.data || [];
}

/**
 * Download the raw text/binary content of a file by its MOVEit file ID.
 */
async function downloadFile(accessToken, fileId) {
    const url = `${config.baseUrl}/api/v1/files/${fileId}/download`;
    const res = await axios.get(url, {
        headers:        { Authorization: `Bearer ${accessToken}` },
        responseType:   'text',
        timeout:        30000,
        validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(res.data?.message || `MOVEit download failed: ${res.status}`);
    }

    return res.data; // raw text content
}

/**
 * One-shot helper: authenticate (no MFA) + upload.
 * Throws if MFA is required — use authenticate() + completeMfa() + uploadFile() flow instead.
 */
async function authenticateAndUpload(fileName, fileContent, folderId) {
    const auth = await authenticate();

    if (auth.requiresMfa) {
        const err = new Error('MOVEit MFA is required. Use a service account with MFA disabled for automated uploads.');
        err.code    = 'MOVEIT_MFA_REQUIRED';
        err.status  = 401;
        throw err;
    }

    return uploadFile(auth.accessToken, fileName, fileContent, folderId);
}

module.exports = {
    authenticate,
    completeMfa,
    uploadFile,
    listFolder,
    downloadFile,
    authenticateAndUpload,
    config,
};
