const { supabaseService } = require('../config/supabaseServer');

async function getDashboardMetrics(startDate, endDate) {
  try {
    const dateFilter = startDate && endDate ? `and created_at between '${startDate}' and '${endDate}'` : '';

    const { data: applications } = await supabaseService
      .from('loan_applications')
      .select('*')
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString());

    const { data: loans } = await supabaseService
      .from('loans')
      .select('*');

    const { data: disbursements } = await supabaseService
      .from('disbursements')
      .select('*');

    const totalApplications = applications?.length || 0;
    const approvedApplications = applications?.filter(a => a.status === 'APPROVED' || a.status === 'DISBURSED').length || 0;
    const declinedApplications = applications?.filter(a => a.status === 'DECLINED').length || 0;
    const pendingApplications = applications?.filter(a => ['STARTED', 'BUREAU_OK', 'AFFORD_OK'].includes(a.status)).length || 0;

    const totalLoanBook = loans?.reduce((sum, loan) => sum + (loan.current_balance || 0), 0) || 0;
    const activeLoans = loans?.filter(l => l.status === 'active').length || 0;
    const defaultedLoans = loans?.filter(l => l.in_default === true).length || 0;

    const totalDisbursed = disbursements?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
    const pendingDisbursements = disbursements?.filter(d => d.status === 'pending').length || 0;
    const completedDisbursements = disbursements?.filter(d => d.status === 'completed').length || 0;

    const approvalRate = totalApplications > 0 ? ((approvedApplications / totalApplications) * 100).toFixed(2) : 0;
    const declineRate = totalApplications > 0 ? ((declinedApplications / totalApplications) * 100).toFixed(2) : 0;
    const defaultRate = activeLoans > 0 ? ((defaultedLoans / activeLoans) * 100).toFixed(2) : 0;

    return {
      applications: {
        total: totalApplications,
        approved: approvedApplications,
        declined: declinedApplications,
        pending: pendingApplications,
        approval_rate: parseFloat(approvalRate),
        decline_rate: parseFloat(declineRate)
      },
      loans: {
        total_book: totalLoanBook,
        active: activeLoans,
        defaulted: defaultedLoans,
        default_rate: parseFloat(defaultRate)
      },
      disbursements: {
        total_disbursed: totalDisbursed,
        pending: pendingDisbursements,
        completed: completedDisbursements
      }
    };
  } catch (error) {
    console.error('Error calculating dashboard metrics:', error);
    return null;
  }
}

async function getPaymentReport(startDate, endDate) {
  try {
    const { data: payments } = await supabaseService
      .from('disbursements')
      .select('*')
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!payments) {
      return { payments: [], summary: {} };
    }

    const byMethod = {};
    const byStatus = {};
    let totalAmount = 0;

    payments.forEach(payment => {
      totalAmount += payment.amount || 0;

      byMethod[payment.payout_method] = (byMethod[payment.payout_method] || 0) + payment.amount;
      byStatus[payment.status] = (byStatus[payment.status] || 0) + 1;
    });

    return {
      payments,
      summary: {
        total_amount: totalAmount,
        total_count: payments.length,
        by_method: byMethod,
        by_status: byStatus
      }
    };
  } catch (error) {
    console.error('Error generating payment report:', error);
    return { payments: [], summary: {} };
  }
}

async function getFinancialReport(startDate, endDate) {
  try {
    const { data: applications } = await supabaseService
      .from('loan_applications')
      .select('*')
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString());

    const totalLoanValue = applications?.reduce((sum, app) => sum + (app.amount || 0), 0) || 0;
    const totalInterest = applications?.reduce((sum, app) => sum + (app.offer_total_interest || 0), 0) || 0;
    const totalFees = applications?.reduce((sum, app) => sum + (app.offer_total_initiation_fees || 0), 0) || 0;

    return {
      total_loan_value: totalLoanValue,
      total_interest: totalInterest,
      total_fees: totalFees,
      total_revenue: totalInterest + totalFees,
      application_count: applications?.length || 0,
      average_loan_size: applications?.length > 0 ? (totalLoanValue / applications.length).toFixed(2) : 0
    };
  } catch (error) {
    console.error('Error generating financial report:', error);
    return {};
  }
}

async function getClientMetrics() {
  try {
    const { data: applications } = await supabaseService
      .from('loan_applications')
      .select('user_id, status, amount');

    if (!applications || applications.length === 0) {
      return { total_clients: 0, repeat_clients: 0, avg_loans_per_client: 0 };
    }

    const clientLoans = {};
    let totalApplications = 0;

    applications.forEach(app => {
      clientLoans[app.user_id] = (clientLoans[app.user_id] || 0) + 1;
      totalApplications += 1;
    });

    const uniqueClients = Object.keys(clientLoans).length;
    const repeatClients = Object.values(clientLoans).filter(count => count > 1).length;
    const avgLoansPerClient = (totalApplications / uniqueClients).toFixed(2);

    return {
      total_clients: uniqueClients,
      repeat_clients: repeatClients,
      avg_loans_per_client: parseFloat(avgLoansPerClient),
      loan_distribution: clientLoans
    };
  } catch (error) {
    console.error('Error calculating client metrics:', error);
    return {};
  }
}

async function getProductMetrics() {
  try {
    const { data: applications } = await supabaseService
      .from('loan_applications')
      .select('term_months, amount, status');

    if (!applications || applications.length === 0) {
      return {};
    }

    const termBuckets = {};
    const statusBuckets = {};
    let totalAmount = 0;
    let avgTerm = 0;

    applications.forEach(app => {
      const term = app.term_months || 1;
      termBuckets[term] = (termBuckets[term] || 0) + 1;
      statusBuckets[app.status] = (statusBuckets[app.status] || 0) + 1;
      totalAmount += app.amount || 0;
      avgTerm += term;
    });

    return {
      total_applications: applications.length,
      total_amount: totalAmount,
      avg_loan_amount: (totalAmount / applications.length).toFixed(2),
      avg_term_months: (avgTerm / applications.length).toFixed(1),
      terms_distribution: termBuckets,
      status_distribution: statusBuckets
    };
  } catch (error) {
    console.error('Error calculating product metrics:', error);
    return {};
  }
}

module.exports = {
  getDashboardMetrics,
  getPaymentReport,
  getFinancialReport,
  getClientMetrics,
  getProductMetrics
};
