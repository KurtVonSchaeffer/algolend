const { supabaseService } = require('../config/supabaseServer');

const AUDIT_ENTITIES = {
  LOAN: 'loan',
  APPLICATION: 'application',
  DISBURSEMENT: 'disbursement',
  USER: 'user',
  SYSTEM: 'system'
};

const AUDIT_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  APPROVED: 'approved',
  DECLINED: 'declined',
  DISBURSED: 'disbursed',
  REVERSED: 'reversed',
  EXPORTED: 'exported',
  DELETED: 'deleted'
};

async function logAuditEvent(userId, entityType, entityId, action, data = {}) {
  try {
    const { oldValues, newValues, changesSummary, metadata, notes } = data;

    const { error } = await supabaseService
      .from('audit_log')
      .insert([{
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        action,
        old_values: oldValues || null,
        new_values: newValues || null,
        changes_summary: changesSummary || null,
        metadata: metadata || null,
        notes: notes || null
      }]);

    if (error) {
      console.error('Error logging audit event:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logAuditEvent:', error);
    return { success: false, error };
  }
}

async function logLoanStateChange(loanId, userId, previousStatus, newStatus, data = {}) {
  try {
    const { previousBalance, newBalance, previousPaymentDate, newPaymentDate, reason, metadata } = data;

    const { error } = await supabaseService
      .from('loan_state_history')
      .insert([{
        loan_id: loanId,
        user_id: userId,
        previous_status: previousStatus,
        new_status: newStatus,
        previous_balance: previousBalance || null,
        new_balance: newBalance || null,
        previous_payment_date: previousPaymentDate || null,
        new_payment_date: newPaymentDate || null,
        reason: reason || null,
        metadata: metadata || null
      }]);

    if (error) {
      console.error('Error logging loan state change:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logLoanStateChange:', error);
    return { success: false, error };
  }
}

async function logUserAction(userId, actionType, targetType, targetId, data = {}) {
  try {
    const { actionDetails, notes, approvalReason, declineReason, ipAddress, userAgent } = data;

    const { error } = await supabaseService
      .from('user_action_log')
      .insert([{
        user_id: userId,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        action_details: actionDetails || null,
        notes: notes || null,
        approval_reason: approvalReason || null,
        decline_reason: declineReason || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null
      }]);

    if (error) {
      console.error('Error logging user action:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logUserAction:', error);
    return { success: false, error };
  }
}

async function logFinancialTransaction(loanId, transactionType, amount, data = {}) {
  try {
    const { balanceBefore, balanceAfter, referenceNumber, externalReference, status, metadata, processedAt } = data;

    const { error } = await supabaseService
      .from('financial_transaction_log')
      .insert([{
        loan_id: loanId,
        transaction_type: transactionType,
        amount,
        balance_before: balanceBefore || null,
        balance_after: balanceAfter || null,
        reference_number: referenceNumber || null,
        external_reference: externalReference || null,
        status: status || 'completed',
        metadata: metadata || null,
        processed_at: processedAt || new Date().toISOString()
      }]);

    if (error) {
      console.error('Error logging financial transaction:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logFinancialTransaction:', error);
    return { success: false, error };
  }
}

async function logAdminAction(adminId, actionCategory, actionDescription, data = {}) {
  try {
    const { affectedRecords, riskLevel, ipAddress, sessionId } = data;

    const { error } = await supabaseService
      .from('admin_action_audit')
      .insert([{
        admin_id: adminId,
        action_category: actionCategory,
        action_description: actionDescription,
        affected_records: affectedRecords || null,
        risk_level: riskLevel || 'low',
        ip_address: ipAddress || null,
        session_id: sessionId || null
      }]);

    if (error) {
      console.error('Error logging admin action:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logAdminAction:', error);
    return { success: false, error };
  }
}

async function logSystemEvent(eventType, severity, eventDescription, data = {}) {
  try {
    const { eventData, affectedUsersCount, resolutionStatus, resolutionNotes } = data;

    const { error } = await supabaseService
      .from('system_event_log')
      .insert([{
        event_type: eventType,
        severity: severity || 'info',
        event_description: eventDescription,
        event_data: eventData || null,
        affected_users_count: affectedUsersCount || 0,
        resolution_status: resolutionStatus || 'unresolved',
        resolution_notes: resolutionNotes || null
      }]);

    if (error) {
      console.error('Error logging system event:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logSystemEvent:', error);
    return { success: false, error };
  }
}

async function getAuditTrail(filters = {}) {
  try {
    let query = supabaseService
      .from('audit_log')
      .select('*');

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.entity_type) {
      query = query.eq('entity_type', filters.entity_type);
    }
    if (filters.entity_id) {
      query = query.eq('entity_id', filters.entity_id);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100);

    if (error) {
      throw error;
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    return { data: [], error: error.message };
  }
}

async function getLoanStateHistory(loanId) {
  try {
    const { data, error } = await supabaseService
      .from('loan_state_history')
      .select('*')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching loan state history:', error);
    return { data: [], error: error.message };
  }
}

async function getUserActionHistory(userId, limit = 50) {
  try {
    const { data, error } = await supabaseService
      .from('user_action_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching user action history:', error);
    return { data: [], error: error.message };
  }
}

async function getRecentAuditActivity(days = 7) {
  try {
    const { data, error } = await supabaseService
      .from('recent_audit_activity')
      .select('*')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching recent audit activity:', error);
    return { data: [], error: error.message };
  }
}

module.exports = {
  AUDIT_ENTITIES,
  AUDIT_ACTIONS,
  logAuditEvent,
  logLoanStateChange,
  logUserAction,
  logFinancialTransaction,
  logAdminAction,
  logSystemEvent,
  getAuditTrail,
  getLoanStateHistory,
  getUserActionHistory,
  getRecentAuditActivity
};
