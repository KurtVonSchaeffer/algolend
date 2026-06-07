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

const supabase    = createClient(supabaseUrl, supabaseKey);
const resend      = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

const EDIT_WINDOW_STATUSES = ['STARTED'];

async function getUserEmail(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

async function sendEmail(to, subject, html) {
  if (!resend) {
    console.warn('[notifications] RESEND_API_KEY not set — email not sent:', subject);
    return;
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message || err);
  }
}

/**
 * Check for upcoming payments and create notifications
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

    for (const loan of (loans || [])) {
      const dueDate      = new Date(loan.next_payment_date);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

      if (daysUntilDue === 7 || daysUntilDue === 3 || daysUntilDue === 1) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', loan.user_id)
          .eq('type', 'payment_due')
          .eq('metadata->>loan_id', loan.id.toString())
          .eq('metadata->>days_until_due', daysUntilDue.toString())
          .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingNotif) {
          const title   = daysUntilDue <= 3 ? 'Payment Due Soon' : 'Upcoming Payment';
          const message = `Payment of R${loan.monthly_payment.toLocaleString()} is due on ${dueDate.toLocaleDateString()}${daysUntilDue <= 3 ? ` (in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''})` : ''}`;

          await supabase.from('notifications').insert([{
            user_id: loan.user_id, type: 'payment_due', title, message,
            metadata: { loan_id: loan.id, amount: loan.monthly_payment, due_date: loan.next_payment_date, days_until_due: daysUntilDue },
            is_read: false
          }]);

          const user = await getUserEmail(loan.user_id);
          if (user?.email) {
            await sendEmail(user.email, title,
              `<p>Hi ${user.full_name || 'there'},</p><p>${message}</p><p>Please ensure your account has sufficient funds.</p>`);
          }
          console.log(`✅ Payment due notification for loan ${loan.id} (${daysUntilDue} days)`);
        }
      }
    }
    console.log('✅ Payment due notification check completed');
  } catch (error) {
    console.error('❌ Error checking payment due notifications:', error);
  }
}

/**
 * Check for applications about to lose edit window
 */
async function checkEditWindowNotifications() {
  try {
    console.log('🔔 Checking for edit window notifications...');

    const now                        = new Date();
    const twoHoursAgo                = new Date(now.getTime() - (2    * 60 * 60 * 1000));
    const oneHourAndFiftyMinutesAgo  = new Date(now.getTime() - (110  * 60      * 1000));

    const { data: applications, error: appsError } = await supabase
      .from('loan_applications')
      .select('id, user_id, amount, created_at')
      .in('status', EDIT_WINDOW_STATUSES)
      .gte('created_at', oneHourAndFiftyMinutesAgo.toISOString())
      .lt('created_at', twoHoursAgo.toISOString());

    if (appsError) throw appsError;

    for (const app of (applications || [])) {
      const { data: existingNotif } = await supabase
        .from('notifications').select('id')
        .eq('user_id', app.user_id).eq('type', 'application_editable')
        .eq('metadata->>application_id', app.id.toString()).maybeSingle();

      if (!existingNotif) {
        await supabase.from('notifications').insert([{
          user_id: app.user_id, type: 'application_editable',
          title: 'Edit Window Closing Soon',
          message: 'You have 10 minutes left to edit or delete your loan application.',
          metadata: { application_id: app.id, minutes_remaining: 10 },
          is_read: false
        }]);
        const user = await getUserEmail(app.user_id);
        if (user?.email) {
          await sendEmail(user.email, 'Edit Window Closing Soon',
            `<p>Hi ${user.full_name || 'there'},</p><p>You have <strong>10 minutes</strong> left to edit or delete your loan application.</p>`);
        }
        console.log(`✅ Edit window notification for application ${app.id}`);
      }
    }
    console.log('✅ Edit window notification check completed');
  } catch (error) {
    console.error('❌ Error checking edit window notifications:', error);
  }
}

/**
 * Update next_payment_date for loans where the payment date has passed
 */
async function updateLoanPaymentDates() {
  try {
    console.log('📅 Updating loan payment dates...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: loans, error: loansError } = await supabase
      .from('loans').select('id, next_payment_date, term_months, created_at')
      .eq('status', 'active').lt('next_payment_date', today.toISOString());

    if (loansError) throw loansError;
    if (!loans || loans.length === 0) { console.log('✅ No loan payment dates need updating'); return; }

    for (const loan of loans) {
      const currentNextPayment = new Date(loan.next_payment_date);
      const newNextPayment     = new Date(currentNextPayment);
      newNextPayment.setMonth(newNextPayment.getMonth() + 1);

      const { error: updateError } = await supabase.from('loans')
        .update({ next_payment_date: newNextPayment.toISOString(), updated_at: new Date().toISOString() })
        .eq('id', loan.id);

      if (updateError) console.error(`❌ Failed to update loan ${loan.id}:`, updateError);
      else console.log(`✅ Updated loan ${loan.id}: ${currentNextPayment.toLocaleDateString()} → ${newNextPayment.toLocaleDateString()}`);
    }
    console.log('✅ Loan payment dates updated');
  } catch (error) {
    console.error('❌ Error updating loan payment dates:', error);
  }
}

/**
 * Flag loan_applications as IN_ARREARS or IN_DEFAULT based on missed payments.
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
    if (!loans || loans.length === 0) return;

    for (const loan of loans) {
      const dueDate    = new Date(loan.repayment_start_date);
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) continue;

      let newStatus = null;
      if      (daysOverdue > 30 && loan.status !== 'IN_DEFAULT') newStatus = 'IN_DEFAULT';
      else if (daysOverdue > 0 && daysOverdue <= 30 && loan.status === 'DISBURSED') newStatus = 'IN_ARREARS';

      if (newStatus) {
        const { data: updatedLoan } = await supabase
          .from('loan_applications')
          .update({ status: newStatus, updated_at: now.toISOString() })
          .eq('id', loan.id)
          .select('profiles:user_id(full_name, cell_tel_no, contact_number)')
          .maybeSingle();
        console.log(`⚠️ Loan ${loan.id} → ${newStatus} (${daysOverdue} days overdue)`);

        // SMS notification (non-blocking)
        try {
          const messaging = require('./messagingService');
          const { data: settings } = await supabase.from('system_settings').select('company_name').maybeSingle();
          const company  = settings?.company_name || 'Zwane Financial';
          const profile  = updatedLoan?.profiles;
          const phone    = profile?.cell_tel_no || profile?.contact_number;
          const name     = profile?.full_name || 'Client';
          if (phone) {
            if (newStatus === 'IN_DEFAULT') {
              const balance = Number(loan.offer_monthly_repayment || 0) * Number(loan.term_months || 1);
              await messaging.notifyDefault({ to: phone, clientName: name, balance, defaultInterest: balance * 0.03, company });
            } else {
              await messaging.notifyArrears({ to: phone, clientName: name, daysOverdue, amount: loan.offer_monthly_repayment || 0, company });
            }
          }
        } catch (mErr) { console.warn('[messaging] notify failed:', mErr.message); }
      }
    }
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
