const { supabaseService } = require('../config/supabaseServer');
const { Parser } = require('json2csv');
const crypto = require('crypto');

function generateBatchId() {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(6).toString('hex');
  return `BATCH-${timestamp}-${randomPart}`;
}

function convertToCSV(data, fieldNames = null) {
  if (!Array.isArray(data) || data.length === 0) {
    return 'No data to export';
  }

  try {
    const fields = fieldNames || Object.keys(data[0]);
    const parser = new Parser({ fields });
    return parser.parse(data);
  } catch (error) {
    console.error('Error converting to CSV:', error);
    throw new Error('Failed to generate CSV format');
  }
}

function convertToJSON(data) {
  return JSON.stringify(data, null, 2);
}

async function exportDashboardMetrics(startDate, endDate, format = 'csv') {
  try {
    const metrics = await require('./analyticsService').getDashboardMetrics(startDate, endDate);

    if (!metrics) {
      throw new Error('Failed to retrieve dashboard metrics');
    }

    const data = [
      { Metric: 'Total Applications', Value: metrics.applications.total },
      { Metric: 'Approved Applications', Value: metrics.applications.approved },
      { Metric: 'Declined Applications', Value: metrics.applications.declined },
      { Metric: 'Pending Applications', Value: metrics.applications.pending },
      { Metric: 'Approval Rate (%)', Value: metrics.applications.approval_rate },
      { Metric: 'Decline Rate (%)', Value: metrics.applications.decline_rate },
      { Metric: 'Active Loans', Value: metrics.loans.active },
      { Metric: 'Defaulted Loans', Value: metrics.loans.defaulted },
      { Metric: 'Default Rate (%)', Value: metrics.loans.default_rate },
      { Metric: 'Total Loan Book', Value: metrics.loans.total_book },
      { Metric: 'Total Disbursed', Value: metrics.disbursements.total_disbursed },
      { Metric: 'Pending Disbursements', Value: metrics.disbursements.pending },
      { Metric: 'Completed Disbursements', Value: metrics.disbursements.completed }
    ];

    if (format === 'json') {
      return { data, batchId: generateBatchId() };
    }

    return { csv: convertToCSV(data), batchId: generateBatchId() };
  } catch (error) {
    console.error('Error exporting dashboard metrics:', error);
    throw error;
  }
}

async function exportAnalyticsData(startDate, endDate, format = 'csv') {
  try {
    // Fetch loan applications with analytics data
    const { data: applications, error } = await supabaseService
      .from('loan_applications')
      .select(`
        id,
        user_id,
        amount,
        status,
        offer_principal,
        offer_total_interest,
        offer_total_initiation_fees,
        created_at
      `)
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedData = (applications || []).map(app => ({
      'Application ID': app.id,
      'Requested Amount': app.amount || 0,
      'Offered Principal': app.offer_principal || 0,
      'Interest': app.offer_total_interest || 0,
      'Initiation Fees': app.offer_total_initiation_fees || 0,
      'Status': app.status || 'N/A',
      'Created Date': new Date(app.created_at).toLocaleDateString('en-ZA')
    }));

    if (format === 'json') {
      return { data: formattedData, batchId: generateBatchId() };
    }

    return { csv: convertToCSV(formattedData), batchId: generateBatchId() };
  } catch (error) {
    console.error('Error exporting analytics data:', error);
    throw error;
  }
}

async function exportFinancialsData(startDate, endDate, format = 'csv') {
  try {
    const financials = await require('./analyticsService').getFinancialReport(startDate, endDate);

    if (!financials) {
      throw new Error('Failed to retrieve financial data');
    }

    const data = [
      { Category: 'INCOME STATEMENT', Amount: '' },
      { Category: 'Total Loan Value', Amount: financials.total_loan_value || 0 },
      { Category: 'Total Interest', Amount: financials.total_interest || 0 },
      { Category: 'Total Fees', Amount: financials.total_fees || 0 },
      { Category: 'Total Revenue', Amount: financials.total_revenue || 0 },
      { Category: '', Amount: '' },
      { Category: 'SUMMARY METRICS', Amount: '' },
      { Category: 'Application Count', Amount: financials.application_count || 0 },
      { Category: 'Average Loan Size', Amount: financials.average_loan_size || 0 }
    ];

    if (format === 'json') {
      return { data: financials, batchId: generateBatchId() };
    }

    return { csv: convertToCSV(data, ['Category', 'Amount']), batchId: generateBatchId() };
  } catch (error) {
    console.error('Error exporting financials data:', error);
    throw error;
  }
}

async function exportAuditTrail(startDate, endDate, format = 'csv') {
  try {
    const { data: auditLogs, error } = await supabaseService
      .from('audit_log')
      .select('*')
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedData = (auditLogs || []).map(log => ({
      'Timestamp': new Date(log.created_at).toISOString(),
      'User ID': log.user_id || 'N/A',
      'Entity Type': log.entity_type || 'N/A',
      'Entity ID': log.entity_id || 'N/A',
      'Action': log.action || 'N/A',
      'Summary': log.changes_summary || 'N/A'
    }));

    if (format === 'json') {
      return { data: formattedData, batchId: generateBatchId() };
    }

    return { csv: convertToCSV(formattedData), batchId: generateBatchId() };
  } catch (error) {
    console.error('Error exporting audit trail:', error);
    throw error;
  }
}

async function exportPaymentHistory(startDate, endDate, format = 'csv') {
  try {
    const { data: disbursements, error } = await supabaseService
      .from('disbursements')
      .select('*')
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedData = (disbursements || []).map(d => ({
      'Disbursement ID': d.id || 'N/A',
      'Application ID': d.application_id || 'N/A',
      'Amount': d.amount || 0,
      'Payout Method': d.payout_method || 'N/A',
      'Status': d.status || 'N/A',
      'Created Date': new Date(d.created_at).toLocaleDateString('en-ZA')
    }));

    if (format === 'json') {
      return { data: formattedData, batchId: generateBatchId() };
    }

    return { csv: convertToCSV(formattedData), batchId: generateBatchId() };
  } catch (error) {
    console.error('Error exporting payment history:', error);
    throw error;
  }
}

module.exports = {
  generateBatchId,
  convertToCSV,
  convertToJSON,
  exportDashboardMetrics,
  exportAnalyticsData,
  exportFinancialsData,
  exportAuditTrail,
  exportPaymentHistory
};
