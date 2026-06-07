const axios = require('axios');
const { supabaseService } = require('../config/supabaseServer');

const EXPERIAN_API_BASE = process.env.EXPERIAN_API_BASE || 'https://api.experian.co.za';
const EXPERIAN_API_KEY = process.env.EXPERIAN_API_KEY || '';
const EXPERIAN_CLIENT_ID = process.env.EXPERIAN_CLIENT_ID || '';
const EXPERIAN_CLIENT_SECRET = process.env.EXPERIAN_CLIENT_SECRET || '';

const AFFORDABILITY_THRESHOLDS = {
  MINIMUM_INCOME: 3000,
  INCOME_TO_DEBT_RATIO: 0.5,
  MAX_MONTHLY_PAYMENT_RATIO: 0.20
};

let cachedExperianToken = null;
let tokenExpiryTime = 0;

async function getExperianToken() {
  const now = Date.now();
  if (cachedExperianToken && tokenExpiryTime > now) {
    return cachedExperianToken;
  }

  try {
    if (!EXPERIAN_API_KEY || !EXPERIAN_CLIENT_ID) {
      console.warn('Experian credentials not configured');
      return null;
    }

    const response = await axios.post(`${EXPERIAN_API_BASE}/oauth2/token`, {
      client_id: EXPERIAN_CLIENT_ID,
      client_secret: EXPERIAN_CLIENT_SECRET,
      grant_type: 'client_credentials'
    });

    cachedExperianToken = response.data.access_token;
    tokenExpiryTime = now + (response.data.expires_in * 1000);
    return cachedExperianToken;
  } catch (error) {
    console.error('Error getting Experian token:', error.message);
    return null;
  }
}

async function getExperianProfile(idNumber) {
  try {
    const token = await getExperianToken();
    if (!token) {
      return { data: null, error: 'Experian service unavailable' };
    }

    const response = await axios.get(`${EXPERIAN_API_BASE}/individuals/${idNumber}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return {
      data: {
        reference: response.data.reference,
        name: response.data.name,
        id_number: response.data.identity_number,
        current_balance: response.data.credit_balance || 0,
        monthly_income: response.data.monthly_income || 0,
        debt_obligations: response.data.debt_obligations || [],
        credit_score: response.data.credit_score || 0,
        accounts: response.data.accounts || [],
        payment_history: response.data.payment_history || []
      },
      error: null
    };
  } catch (error) {
    console.error('Error fetching Experian profile:', error.message);
    return {
      data: null,
      error: error.response?.data?.message || error.message
    };
  }
}

function calculateAffordability(profile, additionalIncome = {}) {
  const baseIncome = profile.monthly_income || 0;
  const additionalIncomeAmount = Object.values(additionalIncome).reduce((sum, item) => {
    return sum + (item.include ? parseFloat(item.amount) || 0 : 0);
  }, 0);

  const totalIncome = baseIncome + additionalIncomeAmount;
  const monthlyDebtObligations = (profile.debt_obligations || [])
    .reduce((sum, debt) => sum + (debt.monthly_payment || 0), 0);

  if (totalIncome < AFFORDABILITY_THRESHOLDS.MINIMUM_INCOME) {
    return {
      eligible: false,
      reason: 'Income below minimum threshold',
      max_loan_amount: 0,
      affordability_ratio: 0
    };
  }

  const debtToIncomeRatio = monthlyDebtObligations / totalIncome;
  if (debtToIncomeRatio > AFFORDABILITY_THRESHOLDS.INCOME_TO_DEBT_RATIO) {
    return {
      eligible: false,
      reason: 'Monthly debt obligations exceed 50% of income',
      max_loan_amount: 0,
      affordability_ratio: debtToIncomeRatio
    };
  }

  const maxMonthlyPayment = totalIncome * AFFORDABILITY_THRESHOLDS.MAX_MONTHLY_PAYMENT_RATIO;
  const remainingCapacity = maxMonthlyPayment - monthlyDebtObligations;

  if (remainingCapacity <= 0) {
    return {
      eligible: false,
      reason: 'No remaining payment capacity after existing obligations',
      max_loan_amount: 0,
      affordability_ratio: (monthlyDebtObligations + maxMonthlyPayment) / totalIncome
    };
  }

  const monthlyRate = 0.20 / 12;
  const loanTerm = 12;
  const maxLoanAmount = remainingCapacity * (1 - Math.pow(1 + monthlyRate, -loanTerm)) / monthlyRate;

  return {
    eligible: true,
    reason: null,
    max_loan_amount: Math.floor(maxLoanAmount),
    max_monthly_payment: Math.floor(remainingCapacity),
    affordability_ratio: debtToIncomeRatio,
    total_income: totalIncome,
    existing_debt: monthlyDebtObligations,
    remaining_capacity: Math.floor(remainingCapacity)
  };
}

async function assessAffordability(userId, financialProfile) {
  try {
    const idNumber = financialProfile.id_number;
    if (!idNumber) {
      return {
        data: null,
        error: 'ID number required for Experian assessment'
      };
    }

    const { data: experianProfile, error: experianError } = await getExperianProfile(idNumber);

    if (experianError) {
      return {
        data: {
          source: 'manual',
          reference: null,
          eligible: null,
          decline_reason: 'Unable to retrieve Experian data'
        },
        error: null
      };
    }

    const additionalIncome = financialProfile.other_income_sources || {};
    const affordability = calculateAffordability(experianProfile, additionalIncome);

    const assessment = {
      source: 'experian',
      reference: experianProfile.reference,
      eligible: affordability.eligible,
      decline_reason: affordability.reason,
      max_loan_amount: affordability.max_loan_amount,
      affordability_ratio: affordability.affordability_ratio,
      credit_score: experianProfile.credit_score,
      current_balance: experianProfile.current_balance
    };

    await saveAffordabilityAssessment(userId, assessment);

    return { data: assessment, error: null };
  } catch (error) {
    console.error('Error in assessAffordability:', error);
    return {
      data: null,
      error: error.message
    };
  }
}

async function saveAffordabilityAssessment(userId, assessment) {
  try {
    const { error } = await supabaseService
      .from('financial_profiles')
      .update({
        affordability_source: assessment.source,
        experian_reference: assessment.reference,
        affordability_ratio: assessment.affordability_ratio,
        decline_reason: assessment.decline_reason,
        show_decline_reason: !assessment.eligible,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error saving affordability assessment:', error);
    }
  } catch (error) {
    console.error('Error in saveAffordabilityAssessment:', error);
  }
}

async function getAffordabilityStatus(userId) {
  try {
    const { data, error } = await supabaseService
      .from('financial_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        eligible: data.decline_reason === null || data.decline_reason === '',
        decline_reason: data.decline_reason,
        source: data.affordability_source,
        reference: data.experian_reference,
        affordability_ratio: data.affordability_ratio,
        can_view_reason: data.show_decline_reason
      },
      error: null
    };
  } catch (error) {
    console.error('Error fetching affordability status:', error);
    return { data: null, error };
  }
}

module.exports = {
  AFFORDABILITY_THRESHOLDS,
  getExperianProfile,
  calculateAffordability,
  assessAffordability,
  saveAffordabilityAssessment,
  getAffordabilityStatus
};
