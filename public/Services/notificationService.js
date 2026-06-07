import { supabase } from './supabaseClient.js';

/**
 * Notification Service
 * Handles creating, fetching, and managing user notifications
 */

// Notification types
export const NOTIFICATION_TYPES = {
  APPLICATION_STATUS: 'application_status',
  PAYMENT_DUE: 'payment_due',
  APPLICATION_SUBMITTED: 'application_submitted',
  APPLICATION_EDITABLE: 'application_editable',
  PAYMENT_RECEIVED: 'payment_received',
  LOAN_DISBURSED: 'loan_disbursed',
  DOCUMENT_REQUIRED: 'document_required',
  ACCOUNT_UPDATED: 'account_updated'
};

// Notification icons based on type
export const NOTIFICATION_ICONS = {
  application_status: 'info',
  payment_due: 'warning',
  application_submitted: 'success',
  application_editable: 'info',
  payment_received: 'success',
  loan_disbursed: 'success',
  document_required: 'warning',
  account_updated: 'info'
};

/**
 * Create a notification for a user
 */
export async function createNotification(userId, type, title, message, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type,
        title,
        message,
        metadata,
        is_read: false
      }])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { data: null, error };
  }
}

/**
 * Fetch notifications for the current user
 */
export async function fetchUserNotifications(limit = 50) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { data: [], error };
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return { count: count || 0, error: null };
  } catch (error) {
    console.error('Error getting unread count:', error);
    return { count: 0, error };
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { error };
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllAsRead() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error marking all as read:', error);
    return { error };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { error };
  }
}

// ==================== NOTIFICATION CREATORS ====================
// i had to bros...

/**
 * Create notification when application status changes
 */
export async function notifyApplicationStatusChange(userId, applicationId, status, amount) {
  const statusMessages = {
    'OFFERED': {
      title: 'Loan Application Approved',
      message: `Your loan application for R${amount.toLocaleString()} has been approved. View your offer now.`
    },
    'DECLINED': {
      title: 'Application Update',
      message: `Your loan application for R${amount.toLocaleString()} was not approved at this time. Contact support for details.`
    },
    'DISBURSED': {
      title: 'Loan Disbursed',
      message: `Your loan of R${amount.toLocaleString()} has been disbursed to your account.`
    },
    'ACTIVE': {
      title: 'Loan Active',
      message: `Your loan of R${amount.toLocaleString()} is now active. First payment details will be sent shortly.`
    }
  };

  const notification = statusMessages[status];
  if (!notification) return;

  return await createNotification(
    userId,
    NOTIFICATION_TYPES.APPLICATION_STATUS,
    notification.title,
    notification.message,
    { application_id: applicationId, status, amount }
  );
}

/**
 * Create notification when payment is due
 */
export async function notifyPaymentDue(userId, loanId, amount, dueDate, daysUntilDue) {
  const title = daysUntilDue <= 3 ? 'Payment Due Soon' : 'Upcoming Payment';
  const message = `Payment of R${amount.toLocaleString()} is due on ${new Date(dueDate).toLocaleDateString()}${daysUntilDue <= 3 ? ` (in ${daysUntilDue} days)` : ''}`;

  return await createNotification(
    userId,
    NOTIFICATION_TYPES.PAYMENT_DUE,
    title,
    message,
    { loan_id: loanId, amount, due_date: dueDate, days_until_due: daysUntilDue }
  );
}

/**
 * Create notification when application is submitted
 */
export async function notifyApplicationSubmitted(userId, applicationId, amount) {
  const submissionTime = new Date();
  const editableUntil = new Date(submissionTime.getTime() + (2 * 60 * 60 * 1000)); // 2 hours

  return await createNotification(
    userId,
    NOTIFICATION_TYPES.APPLICATION_SUBMITTED,
    'Application Submitted',
    `Your loan application for R${amount.toLocaleString()} has been submitted. You have 2 hours to edit or delete this application.`,
    { 
      application_id: applicationId, 
      amount,
      submitted_at: submissionTime.toISOString(),
      editable_until: editableUntil.toISOString()
    }
  );
}

/**
 * Create notification reminder about edit window closing
 */
export async function notifyEditWindowClosing(userId, applicationId, minutesRemaining) {
  return await createNotification(
    userId,
    NOTIFICATION_TYPES.APPLICATION_EDITABLE,
    'Edit Window Closing Soon',
    `You have ${minutesRemaining} minutes left to edit or delete your loan application.`,
    { application_id: applicationId, minutes_remaining: minutesRemaining }
  );
}

/**
 * Create notification when documents are required
 */
export async function notifyDocumentRequired(userId, applicationId, documentTypes, reason = null) {
  const docList = Array.isArray(documentTypes) ? documentTypes.join(', ') : documentTypes;
  const message = reason 
    ? `${reason}. Please upload: ${docList}`
    : `Additional documents required for your application. Please upload: ${docList}`;
  
  return await createNotification(
    userId,
    NOTIFICATION_TYPES.DOCUMENT_REQUIRED,
    'Documents Required',
    message,
    { 
      application_id: applicationId, 
      document_types: Array.isArray(documentTypes) ? documentTypes : [documentTypes],
      reason 
    }
  );
}

/**
 * Create notification when account is updated
 */
export async function notifyAccountUpdated(userId, updateType, details = null) {
  const messages = {
    'profile': 'Your profile information has been updated successfully.',
    'bank_account': 'Your bank account details have been updated.',
    'password': 'Your password has been changed successfully.',
    'email': 'Your email address has been updated.',
    'phone': 'Your phone number has been updated.',
    'security': 'Your security settings have been updated.',
    'kyc': 'Your KYC documents have been updated.'
  };
  
  const message = details || messages[updateType] || 'Your account has been updated.';
  
  return await createNotification(
    userId,
    NOTIFICATION_TYPES.ACCOUNT_UPDATED,
    'Account Updated',
    message,
    { update_type: updateType }
  );
}

/**
 * Subscribe to real-time notification updates
 */
export function subscribeToNotifications(userId, callback) {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from notifications
 */
export async function unsubscribeFromNotifications(channel) {
  if (channel) {
    await supabase.removeChannel(channel);
  }
}

// ==================== ADMIN NOTIFICATIONS ====================

/**
 * Create an admin notification
 */
export async function createAdminNotification(targetRole, title, message, link = null, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('admin_notifications')
      .insert([{
        target_role: targetRole,
        title,
        message,
        link,
        metadata,
        read_by: []
      }])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating admin notification:', error);
    return { data: null, error };
  }
}

/**
 * Notify admins when a new loan application is submitted
 */
export async function notifyAdminsNewApplication(userId, applicationId, amount, userName) {
  const link = `/admin/application-detail.html?id=${applicationId}`;
  const message = `${userName || 'A user'} has submitted a new loan application for R${amount.toLocaleString()}`;
  
  return await createAdminNotification(
    'admin',
    'New Loan Application',
    message,
    link,
    { 
      user_id: userId,
      application_id: applicationId, 
      amount,
      submitted_at: new Date().toISOString()
    }
  );
}
