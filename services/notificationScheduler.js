/**
 * Notification Scheduler Service — CommonJS (matches server.js)
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials for notification scheduler');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const resend   = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || null;
if (!FROM_EMAIL && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] RESEND_FROM_EMAIL is not set — notification emails will be blocked in production.');
}

const EDIT_WINDOW_STATUSES = ['STARTED'];

async function sendEmail(to, subject, html) {
  if (!resend) {
    console.warn('[notifications] RESEND_API_KEY not set — email not sent:', subject);
    return;
  }
  if (!FROM_EMAIL) {
    throw new Error('[FATAL] RESEND_FROM_EMAIL is not configured — email send blocked to prevent sandbox delivery of regulated notices. Set this env var to a verified sending domain.');
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message || err);
  }
}

/**
 * Check for upcoming payments and create notifications.
 * Batch approach: 3 DB round-trips total instead of 3N.
 */
async function checkPaymentDueNotifications() {
  try {
    console.log('🔔 Checking for payment due notifications...');

    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id, user_id, monthly_payment, next_payment_date')
      .eq('status', 'active');

    if (loansError) throw loansError;

    const now = new Date();

    const qualifying = (loans || []).flatMap(loan => {
      const dueDate      = new Date(loan.next_payment_date);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return (daysUntilDue === 7 || daysUntilDue === 3 || daysUntilDue === 1)
        ? [{ ...loan, dueDate, daysUntilDue }]
        : [];
    });

    if (!qualifying.length) {
      console.log('✅ No payment due notifications needed');
      return;
    }

    const since   = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const userIds = [...new Set(qualifying.map(l => l.user_id))];

    // Batch: fetch recent payment_due notifications for all qualifying users in one query
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('user_id, metadata')
      .eq('type', 'payment_due')
      .gte('created_at', since)
      .in('user_id', userIds);

    const alreadySent = new Set((existingNotifs || []).map(n =>
      `${n.user_id}-${n.metadata?.loan_id}-${n.metadata?.days_until_due}`
    ));

    const toNotify = qualifying.filter(loan =>
      !alreadySent.has(`${loan.user_id}-${loan.id}-${loan.daysUntilDue}`)
    );

    if (!toNotify.length) {
      console.log('✅ All payment due notifications already sent');
      return;
    }

    // Batch: fetch profiles for all users needing notification in one query
    const notifyUserIds = [...new Set(toNotify.map(l => l.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', notifyUserIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    // Batch: insert all notifications at once
    await supabase.from('notifications').insert(toNotify.map(loan => {
      const title   = loan.daysUntilDue <= 3 ? 'Payment Due Soon' : 'Upcoming Payment';
      const message = `Payment of R${loan.monthly_payment.toLocaleString()} is due on ${loan.dueDate.toLocaleDateString()}${loan.daysUntilDue <= 3 ? ` (in ${loan.daysUntilDue} day${loan.daysUntilDue > 1 ? 's' : ''})` : ''}`;
      return {
        user_id:  loan.user_id,
        type:     'payment_due',
        title,
        message,
        metadata: { loan_id: loan.id, amount: loan.monthly_payment, due_date: loan.next_payment_date, days_until_due: loan.daysUntilDue },
        is_read:  false,
      };
    }));

    // Send all emails in parallel
    await Promise.allSettled(toNotify.map(loan => {
      const user = profileMap[loan.user_id];
      if (!user?.email) return Promise.resolve();
      const title   = loan.daysUntilDue <= 3 ? 'Payment Due Soon' : 'Upcoming Payment';
      const message = `Payment of R${loan.monthly_payment.toLocaleString()} is due on ${loan.dueDate.toLocaleDateString()}${loan.daysUntilDue <= 3 ? ` (in ${loan.daysUntilDue} day${loan.daysUntilDue > 1 ? 's' : ''})` : ''}`;
      return sendEmail(user.email, title,
        `<p>Hi ${user.full_name || 'there'},</p><p>${message}</p><p>Please ensure your account has sufficient funds.</p>`);
    }));

    console.log(`✅ Payment due notifications sent: ${toNotify.length}`);
  } catch (error) {
    console.error('❌ Error checking payment due notifications:', error);
  }
}

/**
 * Check for applications about to lose edit window.
 * Batch approach: 3 DB round-trips instead of 3N.
 */
async function checkEditWindowNotifications() {
  try {
    console.log('🔔 Checking for edit window notifications...');

    const now                       = new Date();
    const twoHoursAgo               = new Date(now.getTime() - (2   * 60 * 60 * 1000));
    const oneHourAndFiftyMinutesAgo = new Date(now.getTime() - (110 * 60      * 1000));

    const { data: applications, error: appsError } = await supabase
      .from('loan_applications')
      .select('id, user_id, amount, created_at')
      .in('status', EDIT_WINDOW_STATUSES)
      .gte('created_at', oneHourAndFiftyMinutesAgo.toISOString())
      .lt('created_at', twoHoursAgo.toISOString());

    if (appsError) throw appsError;
    if (!applications?.length) {
      console.log('✅ No edit window notifications needed');
      return;
    }

    const userIds = [...new Set(applications.map(a => a.user_id))];

    // Batch: fetch existing edit window notifications for all qualifying users in one query
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('metadata')
      .eq('type', 'application_editable')
      .in('user_id', userIds);

    const alreadySent = new Set((existingNotifs || []).map(n =>
      String(n.metadata?.application_id)
    ));

    const toNotify = applications.filter(app => !alreadySent.has(String(app.id)));

    if (!toNotify.length) {
      console.log('✅ All edit window notifications already sent');
      return;
    }

    // Batch: fetch profiles in one query
    const notifyUserIds = [...new Set(toNotify.map(a => a.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', notifyUserIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    // Batch: insert all notifications at once
    await supabase.from('notifications').insert(toNotify.map(app => ({
      user_id:  app.user_id,
      type:     'application_editable',
      title:    'Edit Window Closing Soon',
      message:  'You have 10 minutes left to edit or delete your loan application.',
      metadata: { application_id: app.id, minutes_remaining: 10 },
      is_read:  false,
    })));

    // Send all emails in parallel
    await Promise.allSettled(toNotify.map(app => {
      const user = profileMap[app.user_id];
      if (!user?.email) return Promise.resolve();
      return sendEmail(user.email, 'Edit Window Closing Soon',
        `<p>Hi ${user.full_name || 'there'},</p><p>You have <strong>10 minutes</strong> left to edit or delete your loan application.</p>`);
    }));

    console.log(`✅ Edit window notifications sent: ${toNotify.length}`);
  } catch (error) {
    console.error('❌ Error checking edit window notifications:', error);
  }
}

/**
 * Update next_payment_date for loans where the payment date has passed.
 * Parallel updates instead of sequential per-loan awaits.
 */
async function updateLoanPaymentDates() {
  try {
    console.log('📅 Updating loan payment dates...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id, next_payment_date, term_months, created_at')
      .eq('status', 'active')
      .lt('next_payment_date', today.toISOString());

    if (loansError) throw loansError;
    if (!loans?.length) {
      console.log('✅ No loan payment dates need updating');
      return;
    }

    const now     = new Date().toISOString();
    const updates = loans.map(loan => {
      const next = new Date(loan.next_payment_date);
      next.setMonth(next.getMonth() + 1);
      return { id: loan.id, next: next.toISOString() };
    });

    const results = await Promise.allSettled(updates.map(({ id, next }) =>
      supabase.from('loans').update({ next_payment_date: next, updated_at: now }).eq('id', id)
    ));

    let succeeded = 0;
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && !result.value.error) {
        succeeded++;
      } else {
        const err = result.reason || result.value?.error;
        console.error(`❌ Failed to update loan ${updates[i].id}:`, err?.message || err);
      }
    });

    console.log(`✅ Loan payment dates updated: ${succeeded}/${loans.length}`);
  } catch (error) {
    console.error('❌ Error updating loan payment dates:', error);
  }
}

/**
 * Flag loan_applications as IN_ARREARS or IN_DEFAULT based on missed payments.
 * system_settings fetched once outside the loop; updates run in parallel.
 */
async function flagDefaultedLoans() {
  try {
    const now = new Date();

    const { data: loans, error } = await supabase
      .from('loan_applications')
      .select('id, repayment_start_date, status, offer_monthly_repayment, term_months')
      .in('status', ['DISBURSED', 'IN_ARREARS'])
      .not('repayment_start_date', 'is', null);

    if (error) throw error;
    if (!loans?.length) return;

    // Fetch system settings once, outside the loop
    const { data: settings } = await supabase.from('system_settings').select('company_name').maybeSingle();
    const company = settings?.company_name || 'AlgoLend Financial';

    const toUpdate = loans.flatMap(loan => {
      const daysOverdue = Math.floor((now - new Date(loan.repayment_start_date)) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) return [];
      let newStatus = null;
      if      (daysOverdue > 30 && loan.status !== 'IN_DEFAULT') newStatus = 'IN_DEFAULT';
      else if (daysOverdue > 0 && daysOverdue <= 30 && loan.status === 'DISBURSED') newStatus = 'IN_ARREARS';
      return newStatus ? [{ ...loan, daysOverdue, newStatus }] : [];
    });

    if (!toUpdate.length) {
      console.log('✅ Default/arrears check complete — no updates needed');
      return;
    }

    await Promise.allSettled(toUpdate.map(async loan => {
      const { data: updatedLoan } = await supabase
        .from('loan_applications')
        .update({ status: loan.newStatus, updated_at: now.toISOString() })
        .eq('id', loan.id)
        .select('profiles:user_id(full_name, cell_tel_no, contact_number)')
        .maybeSingle();

      console.log(`⚠️ Loan ${loan.id} → ${loan.newStatus} (${loan.daysOverdue} days overdue)`);

      try {
        const messaging = require('./messagingService');
        const profile = updatedLoan?.profiles;
        const phone   = profile?.cell_tel_no || profile?.contact_number;
        const name    = profile?.full_name || 'Client';
        if (phone) {
          if (loan.newStatus === 'IN_DEFAULT') {
            const balance = Number(loan.offer_monthly_repayment || 0) * Number(loan.term_months || 1);
            await messaging.notifyDefault({ to: phone, clientName: name, balance, defaultInterest: balance * 0.03, company });
          } else {
            await messaging.notifyArrears({ to: phone, clientName: name, daysOverdue: loan.daysOverdue, amount: loan.offer_monthly_repayment || 0, company });
          }
        }
      } catch (mErr) { console.warn('[messaging] notify failed:', mErr.message); }
    }));

    console.log('✅ Default/arrears check complete');
  } catch (err) {
    console.error('❌ flagDefaultedLoans error:', err.message);
  }
}

function startNotificationScheduler() {
  console.log('🚀 Starting notification scheduler...');
  checkPaymentDueNotifications();
  checkEditWindowNotifications();
  updateLoanPaymentDates();
  flagDefaultedLoans();

  setInterval(checkPaymentDueNotifications, 6  * 60 * 60 * 1000);
  setInterval(checkEditWindowNotifications, 10 *      60 * 1000);
  setInterval(updateLoanPaymentDates,       60 *      60 * 1000);
  setInterval(flagDefaultedLoans,           6  * 60 * 60 * 1000);

  console.log('✅ Notification scheduler started');
}

module.exports = {
  startNotificationScheduler,
  checkPaymentDueNotifications,
  checkEditWindowNotifications,
  updateLoanPaymentDates,
  flagDefaultedLoans
};
