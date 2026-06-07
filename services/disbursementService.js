const { supabaseService } = require('../config/supabaseServer');
const crypto = require('crypto');
const { Parser } = require('json2csv');

const PAYOUT_METHODS = {
  CAPITEC: 'capitec',
  CASHSEND: 'cashsend',
  THIRD_PARTY: 'third_party',
  CASH: 'cash'
};

const DISBURSEMENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed'
};

async function getCashSendConfig() {
  const { data, error } = await supabaseService
    .from('cashsend_config')
    .select('*')
    .eq('active', true)
    .single();

  if (error) {
    console.error('Error fetching CashSend config:', error);
    return {
      baseFee: 5.00,
      percentageFee: 2.50,
      minAmount: 100,
      maxAmount: 50000
    };
  }

  return {
    baseFee: data.base_fee || 5.00,
    percentageFee: data.percentage_fee || 2.50,
    minAmount: data.min_amount || 100,
    maxAmount: data.max_amount || 50000
  };
}

function calculateCashSendFee(amount, config) {
  const percentageFee = (amount * (config.percentageFee / 100));
  const totalFee = config.baseFee + percentageFee;
  return {
    baseFee: config.baseFee,
    percentageFee: parseFloat(percentageFee.toFixed(2)),
    totalFee: parseFloat(totalFee.toFixed(2))
  };
}

async function selectPayoutMethod(loanAmount, primaryBankAccountId) {
  const config = await getCashSendConfig();

  if (loanAmount < config.minAmount || loanAmount > config.maxAmount) {
    return PAYOUT_METHODS.CASH;
  }

  if (primaryBankAccountId) {
    return PAYOUT_METHODS.CAPITEC;
  }

  return PAYOUT_METHODS.CASHSEND;
}

async function createDisbursement(disbursementData) {
  const {
    applicationId,
    userId,
    amount,
    disbursementDate = new Date().toISOString().split('T')[0],
    payoutMethod = null,
    bankAccountId = null,
    thirdPartyName = null,
    thirdPartyAccount = null,
    thirdPartyBank = null,
    createdBy = null
  } = disbursementData;

  try {
    let method = payoutMethod;
    if (!method) {
      method = await selectPayoutMethod(amount, bankAccountId);
    }

    let disbursementRecord = {
      application_id: applicationId,
      user_id: userId,
      amount,
      disbursement_date: disbursementDate,
      status: DISBURSEMENT_STATUSES.PENDING,
      payout_method: method,
      bank_account_id: bankAccountId,
      third_party_name: thirdPartyName,
      third_party_account: thirdPartyAccount,
      third_party_bank: thirdPartyBank,
      created_by: createdBy
    };

    if (method === PAYOUT_METHODS.CASHSEND) {
      const config = await getCashSendConfig();
      const fees = calculateCashSendFee(amount, config);
      disbursementRecord.cashsend_fee = fees.totalFee;
      disbursementRecord.cashsend_reference = `CS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const { data, error } = await supabaseService
      .from('disbursements')
      .insert([disbursementRecord])
      .select();

    if (error) {
      console.error('Error creating disbursement:', error);
      throw new Error(`Failed to create disbursement: ${error.message}`);
    }

    const disbursement = data[0];

    await logPayoutAction(
      disbursement.id,
      'created',
      { method, amount },
      'Disbursement created',
      createdBy
    );

    return disbursement;
  } catch (error) {
    console.error('Error in createDisbursement:', error);
    throw error;
  }
}

async function updateDisbursementStatus(disbursementId, newStatus, details = {}) {
  try {
    const { data, error } = await supabaseService
      .from('disbursements')
      .update({ status: newStatus })
      .eq('id', disbursementId)
      .select();

    if (error) {
      throw new Error(`Failed to update disbursement: ${error.message}`);
    }

    const statusAction = {
      [DISBURSEMENT_STATUSES.PENDING]: 'submitted',
      [DISBURSEMENT_STATUSES.PROCESSING]: 'submitted',
      [DISBURSEMENT_STATUSES.COMPLETED]: 'sent',
      [DISBURSEMENT_STATUSES.FAILED]: 'failed',
      [DISBURSEMENT_STATUSES.REVERSED]: 'reversed'
    }[newStatus] || 'updated';

    await logPayoutAction(disbursementId, statusAction, details, `Status updated to ${newStatus}`);

    return data[0];
  } catch (error) {
    console.error('Error updating disbursement status:', error);
    throw error;
  }
}

async function logPayoutAction(disbursementId, action, details = {}, notes = '', createdBy = null) {
  try {
    const { error } = await supabaseService
      .from('payout_audit_log')
      .insert([{
        disbursement_id: disbursementId,
        action,
        details,
        notes,
        created_by: createdBy
      }]);

    if (error) {
      console.error('Error logging payout action:', error);
    }
  } catch (error) {
    console.error('Error in logPayoutAction:', error);
  }
}

async function getDisbursement(disbursementId) {
  const { data, error } = await supabaseService
    .from('disbursements')
    .select('*')
    .eq('id', disbursementId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch disbursement: ${error.message}`);
  }

  return data;
}

async function getDisbursementsByApplicationId(applicationId) {
  const { data, error } = await supabaseService
    .from('disbursements')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch disbursements: ${error.message}`);
  }

  return data;
}

function generateBatchId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `BATCH-${timestamp}-${random}`.toUpperCase();
}

function generateCSVHash(csvContent) {
  return crypto.createHash('sha256').update(csvContent).digest('hex');
}

async function generatePayoutCSV(disbursements, method = 'all') {
  try {
    const filtered = method === 'all'
      ? disbursements
      : disbursements.filter(d => d.payout_method === method);

    const records = filtered.map(disburse => ({
      'Disbursement ID': disburse.id,
      'Application ID': disburse.application_id,
      'User ID': disburse.user_id,
      'Amount (R)': disburse.amount.toFixed(2),
      'Disbursement Date': disburse.disbursement_date,
      'Payout Method': disburse.payout_method,
      'Status': disburse.status,
      'Bank Account ID': disburse.bank_account_id || '',
      'CashSend Reference': disburse.cashsend_reference || '',
      'CashSend Fee (R)': (disburse.cashsend_fee || 0).toFixed(2),
      'Third Party Name': disburse.third_party_name || '',
      'Third Party Account': disburse.third_party_account || '',
      'Third Party Bank': disburse.third_party_bank || '',
      'Created At': disburse.created_at
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(records);
    return csv;
  } catch (error) {
    console.error('Error generating CSV:', error);
    throw error;
  }
}

async function createCSVExport(batchId, method, disbursements, exportedBy = null) {
  try {
    const csv = await generatePayoutCSV(disbursements, method);
    const csvHash = generateCSVHash(csv);
    const recordCount = disbursements.length;
    const totalAmount = disbursements.reduce((sum, d) => sum + d.amount, 0);

    const { data, error } = await supabaseService
      .from('payout_csv_exports')
      .insert([{
        batch_id: batchId,
        method,
        record_count: recordCount,
        total_amount: totalAmount,
        status: 'exported',
        csv_hash: csvHash,
        locked: true,
        exported_by: exportedBy
      }])
      .select();

    if (error) {
      throw new Error(`Failed to create CSV export record: ${error.message}`);
    }

    return {
      export: data[0],
      csv,
      csvHash
    };
  } catch (error) {
    console.error('Error in createCSVExport:', error);
    throw error;
  }
}

async function verifyCSVIntegrity(batchId, csvContent) {
  try {
    const { data, error } = await supabaseService
      .from('payout_csv_exports')
      .select('csv_hash')
      .eq('batch_id', batchId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch CSV export: ${error.message}`);
    }

    const currentHash = generateCSVHash(csvContent);
    return {
      valid: currentHash === data.csv_hash,
      storedHash: data.csv_hash,
      currentHash
    };
  } catch (error) {
    console.error('Error verifying CSV integrity:', error);
    throw error;
  }
}

module.exports = {
  PAYOUT_METHODS,
  DISBURSEMENT_STATUSES,
  getCashSendConfig,
  calculateCashSendFee,
  selectPayoutMethod,
  createDisbursement,
  updateDisbursementStatus,
  logPayoutAction,
  getDisbursement,
  getDisbursementsByApplicationId,
  generateBatchId,
  generateCSVHash,
  generatePayoutCSV,
  createCSVExport,
  verifyCSVIntegrity
};
