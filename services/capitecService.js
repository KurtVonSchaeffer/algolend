const axios = require('axios');
const crypto = require('crypto');
const { supabaseService } = require('../config/supabaseServer');

const CAPITEC_API_BASE = process.env.CAPITEC_API_BASE || 'https://api.capitec.co.za';
const CAPITEC_API_KEY = process.env.CAPITEC_API_KEY || '';
const CAPITEC_CLIENT_ID = process.env.CAPITEC_CLIENT_ID || '';
const CAPITEC_MERCHANT_ID = process.env.CAPITEC_MERCHANT_ID || '';

const TRANSFER_TYPES = {
  IMMEDIATE: 'IMMEDIATE',
  SCHEDULED: 'SCHEDULED'
};

const TRANSFER_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

let cachedCapitecToken = null;
let tokenExpiryTime = 0;

async function getCapitecToken() {
  const now = Date.now();
  if (cachedCapitecToken && tokenExpiryTime > now) {
    return cachedCapitecToken;
  }

  try {
    if (!CAPITEC_API_KEY || !CAPITEC_CLIENT_ID) {
      console.warn('Capitec credentials not configured');
      return null;
    }

    const response = await axios.post(`${CAPITEC_API_BASE}/oauth/token`, {
      client_id: CAPITEC_CLIENT_ID,
      client_secret: CAPITEC_API_KEY,
      grant_type: 'client_credentials'
    });

    cachedCapitecToken = response.data.access_token;
    tokenExpiryTime = now + (response.data.expires_in * 1000);
    return cachedCapitecToken;
  } catch (error) {
    console.error('Error getting Capitec token:', error.message);
    return null;
  }
}

async function initiateTransfer(transferData) {
  try {
    const token = await getCapitecToken();
    if (!token) {
      return { data: null, error: 'Capitec service unavailable' };
    }

    const {
      recipient_account,
      recipient_bank,
      amount,
      reference,
      recipient_name,
      transfer_type = TRANSFER_TYPES.IMMEDIATE,
      scheduled_date = null
    } = transferData;

    const payload = {
      recipient: {
        account_number: recipient_account,
        bank_code: recipient_bank,
        name: recipient_name
      },
      transaction: {
        amount: parseFloat(amount),
        reference: reference,
        type: transfer_type,
        scheduled_date: scheduled_date
      },
      merchant_id: CAPITEC_MERCHANT_ID
    };

    const response = await axios.post(
      `${CAPITEC_API_BASE}/transfers`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      data: {
        capitec_transaction_id: response.data.transaction_id,
        capitec_batch_id: response.data.batch_id,
        status: response.data.status,
        amount: response.data.amount,
        reference: response.data.reference,
        initiated_at: new Date().toISOString()
      },
      error: null
    };
  } catch (error) {
    console.error('Error initiating Capitec transfer:', error.message);
    return {
      data: null,
      error: error.response?.data?.message || error.message
    };
  }
}

async function getTransferStatus(transactionId) {
  try {
    const token = await getCapitecToken();
    if (!token) {
      return { data: null, error: 'Capitec service unavailable' };
    }

    const response = await axios.get(
      `${CAPITEC_API_BASE}/transfers/${transactionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      data: {
        transaction_id: response.data.transaction_id,
        status: response.data.status,
        amount: response.data.amount,
        reference: response.data.reference,
        completed_at: response.data.completed_at
      },
      error: null
    };
  } catch (error) {
    console.error('Error fetching transfer status:', error.message);
    return {
      data: null,
      error: error.response?.data?.message || error.message
    };
  }
}

async function createBatchTransfer(transfers) {
  try {
    const token = await getCapitecToken();
    if (!token) {
      return { data: null, error: 'Capitec service unavailable' };
    }

    const batchId = `BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const payload = {
      batch_id: batchId,
      merchant_id: CAPITEC_MERCHANT_ID,
      transfers: transfers.map(t => ({
        recipient: {
          account_number: t.recipient_account,
          bank_code: t.recipient_bank,
          name: t.recipient_name
        },
        transaction: {
          amount: parseFloat(t.amount),
          reference: t.reference
        }
      }))
    };

    const response = await axios.post(
      `${CAPITEC_API_BASE}/batch-transfers`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      data: {
        batch_id: batchId,
        capitec_batch_id: response.data.batch_id,
        status: response.data.status,
        transfer_count: transfers.length,
        total_amount: transfers.reduce((sum, t) => sum + parseFloat(t.amount), 0),
        initiated_at: new Date().toISOString()
      },
      error: null
    };
  } catch (error) {
    console.error('Error creating batch transfer:', error.message);
    return {
      data: null,
      error: error.response?.data?.message || error.message
    };
  }
}

async function updateDisbursementCapitecStatus(disbursementId, capitecData) {
  try {
    const { error } = await supabaseService
      .from('disbursements')
      .update({
        capitec_transaction_id: capitecData.capitec_transaction_id,
        capitec_batch_id: capitecData.capitec_batch_id,
        capitec_response: capitecData,
        status: 'processing'
      })
      .eq('id', disbursementId);

    if (error) {
      console.error('Error updating disbursement:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateDisbursementCapitecStatus:', error);
    return { success: false, error };
  }
}

module.exports = {
  TRANSFER_TYPES,
  TRANSFER_STATUS,
  getCapitecToken,
  initiateTransfer,
  getTransferStatus,
  createBatchTransfer,
  updateDisbursementCapitecStatus
};
