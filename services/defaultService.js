const { supabaseService } = require('../config/supabaseServer');

const DEFAULT_PERCENTAGE = 0.03; // 3% of current balance

async function markLoanInDefault(loanId, reason = '') {
  try {
    const { data: loan, error: fetchError } = await supabaseService
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch loan: ${fetchError.message}`);
    }

    const defaultAmount = loan.current_balance * DEFAULT_PERCENTAGE;

    const { error: updateError } = await supabaseService
      .from('loans')
      .update({
        in_default: true,
        default_date: new Date().toISOString().split('T')[0],
        default_amount: defaultAmount,
        status: 'in_default'
      })
      .eq('id', loanId);

    if (updateError) {
      throw new Error(`Failed to update loan: ${updateError.message}`);
    }

    // Log to loan history
    await logLoanEvent(loanId, 'in_default', {
      reason,
      default_amount: defaultAmount,
      calculated_from: `${loan.current_balance} × ${DEFAULT_PERCENTAGE * 100}%`
    });

    return {
      success: true,
      loan_id: loanId,
      default_amount: defaultAmount
    };
  } catch (error) {
    console.error('Error marking loan in default:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function clearDefault(loanId) {
  try {
    const { error } = await supabaseService
      .from('loans')
      .update({
        in_default: false,
        default_date: null,
        default_amount: null,
        status: 'active'
      })
      .eq('id', loanId);

    if (error) {
      throw new Error(`Failed to clear default: ${error.message}`);
    }

    await logLoanEvent(loanId, 'default_cleared', {
      cleared_at: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('Error clearing default:', error);
    return { success: false, error: error.message };
  }
}

async function getDefaultLoans(filters = {}) {
  try {
    let query = supabaseService
      .from('loans')
      .select('*')
      .eq('in_default', true);

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.days_in_default) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - filters.days_in_default);
      query = query.gte('default_date', daysAgo.toISOString().split('T')[0]);
    }

    const { data, error } = await query.order('default_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch defaults: ${error.message}`);
    }

    return {
      data: data || [],
      error: null
    };
  } catch (error) {
    console.error('Error fetching default loans:', error);
    return {
      data: [],
      error: error.message
    };
  }
}

async function getDefaultMetrics() {
  try {
    const { data: allLoans, error: loansError } = await supabaseService
      .from('loans')
      .select('*');

    if (loansError) {
      throw loansError;
    }

    const { data: defaultLoans, error: defaultError } = await supabaseService
      .from('loans')
      .select('*')
      .eq('in_default', true);

    if (defaultError) {
      throw defaultError;
    }

    const totalLoanBook = allLoans.reduce((sum, loan) => sum + (loan.current_balance || 0), 0);
    const totalDefaultAmount = defaultLoans.reduce((sum, loan) => sum + (loan.default_amount || 0), 0);
    const defaultPercentage = totalLoanBook > 0 ? (totalDefaultAmount / totalLoanBook) * 100 : 0;
    const defaultCount = defaultLoans.length;

    return {
      data: {
        total_loan_book: totalLoanBook,
        total_default_amount: totalDefaultAmount,
        default_percentage: parseFloat(defaultPercentage.toFixed(2)),
        loans_in_default: defaultCount,
        average_default_per_loan: defaultCount > 0 ? parseFloat((totalDefaultAmount / defaultCount).toFixed(2)) : 0
      },
      error: null
    };
  } catch (error) {
    console.error('Error calculating default metrics:', error);
    return {
      data: null,
      error: error.message
    };
  }
}

async function logLoanEvent(loanId, event, details = {}) {
  try {
    const { error } = await supabaseService
      .from('loan_history')
      .insert([{
        loan_id: loanId,
        event,
        details,
        is_default: event.includes('default'),
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Error logging loan event:', error);
    }
  } catch (error) {
    console.error('Error in logLoanEvent:', error);
  }
}

module.exports = {
  DEFAULT_PERCENTAGE,
  markLoanInDefault,
  clearDefault,
  getDefaultLoans,
  getDefaultMetrics,
  logLoanEvent
};
