const axios = require('axios');
const crypto = require('crypto');
const BASE_URL = 'https://verification.didit.me';

// In-memory session storage (use database in production)
const sessions = new Map();

function verifyWebhookSignature(payload, signature) {
  try {
    const WEBHOOK_SECRET_KEY = process.env.DIDIT_WEBHOOK_SECRET_KEY;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET_KEY);
    hmac.update(JSON.stringify(payload));
    const computedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    return false;
  }
}

async function createSession({ userId, email, phone, metadata }) {
  const API_KEY = process.env.DIDIT_API_KEY;
  const WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID;
  if (!userId || !email) {
    throw new Error('userId and email are required');
  }
  const response = await axios.post(
    `${BASE_URL}/v2/session/`,
    {
      workflow_id: WORKFLOW_ID,
      vendor_data: userId,
      metadata: metadata || {},
      contact_details: {
        email: email,
        email_lang: 'en',
        phone: phone || undefined
      }
    },
    {
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
  const sessionData = response.data;
  sessions.set(sessionData.session_id, {
    userId: userId,
    sessionId: sessionData.session_id,
    sessionToken: sessionData.session_token,
    status: sessionData.status,
    email: email,
    createdAt: new Date().toISOString()
  });
  return {
    success: true,
    session_id: sessionData.session_id,
    verification_url: sessionData.url,
    status: sessionData.status
  };
}

function updateSessionFromWebhook(payload) {
  const { session_id, status, event_type } = payload;
  if (sessions.has(session_id)) {
    const session = sessions.get(session_id);
    session.status = status;
    session.lastUpdated = new Date().toISOString();
    session.eventType = event_type;
    sessions.set(session_id, session);
  }
}

async function getSessionStatus(sessionId) {
  const API_KEY = process.env.DIDIT_API_KEY;
  if (sessions.has(sessionId)) {
    const sessionData = sessions.get(sessionId);
    try {
      const response = await axios.get(
        `${BASE_URL}/v2/session/${sessionId}/decision/`,
        { headers: { 'X-Api-Key': API_KEY } }
      );
      return {
        success: true,
        session: sessionData,
        details: response.data
      };
    } catch (apiError) {
      return {
        success: true,
        session: sessionData
      };
    }
  }
  // If not in storage, try API
  const response = await axios.get(
    `${BASE_URL}/v2/session/${sessionId}/decision/`,
    { headers: { 'X-Api-Key': API_KEY } }
  );
  return {
    success: true,
    details: response.data
  };
}

function getUserKycStatus(userId) {
  const userSessions = Array.from(sessions.values())
    .filter(session => session.userId === userId);
  if (userSessions.length === 0) {
    return {
      verified: false,
      message: 'No KYC sessions found'
    };
  }
  const latestSession = userSessions.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  )[0];
  return {
    verified: latestSession.status === 'Approved',
    status: latestSession.status,
    sessionId: latestSession.sessionId,
    updatedAt: latestSession.lastUpdated || latestSession.createdAt
  };
}

module.exports = {
  verifyWebhookSignature,
  createSession,
  updateSessionFromWebhook,
  getSessionStatus,
  getUserKycStatus,
  sessions
};
