/**
 * Web Push Notification Service
 * Uses VAPID keys to send native push notifications to subscribed browsers.
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT  (mailto:you@domain.com)
 *
 * Subscriptions are stored in the `push_subscriptions` Supabase table.
 */

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:info@zwanefinancial.co.za';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn('[push] VAPID keys not configured — push notifications disabled');
}

/**
 * Save (or upsert) a push subscription for a user.
 */
async function saveSubscription(userId, subscription) {
  if (!userId || !subscription?.endpoint) {
    throw new Error('userId and subscription endpoint are required');
  }

  const { data, error } = await sb
    .from('push_subscriptions')
    .upsert({
      user_id:        userId,
      endpoint:       subscription.endpoint,
      p256dh:         subscription.keys?.p256dh,
      auth:           subscription.keys?.auth,
      user_agent:     subscription.userAgent || null,
      updated_at:     new Date().toISOString()
    }, { onConflict: 'endpoint' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a subscription (when user unsubscribes or endpoint is gone)
 */
async function removeSubscription(endpoint) {
  await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

/**
 * Send a push notification to all subscriptions for a user.
 * Returns count of successful sends.
 */
async function sendToUser(userId, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log(`[push] disabled — would have sent to user ${userId}: ${payload.title}`);
    return { sent: 0, disabled: true };
  }

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs?.length) return { sent: 0, reason: 'no_subscriptions' };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, body);
      sent++;
    } catch (err) {
      failed++;
      // 410 = subscription expired; remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeSubscription(sub.endpoint);
        console.log(`[push] removed expired subscription: ${sub.endpoint.slice(-20)}`);
      } else {
        console.warn(`[push] send failed: ${err.message}`);
      }
    }
  }));

  console.log(`[push] user=${userId} sent=${sent} failed=${failed} title="${payload.title}"`);
  return { sent, failed };
}

/**
 * Send a push notification to ALL subscribed users.
 * Useful for broadcasts (system maintenance, new feature, etc.)
 */
async function broadcast(payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, disabled: true };

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (!subs?.length) return { sent: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, body);
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeSubscription(sub.endpoint);
      }
    }
  }));

  return { sent };
}

module.exports = {
  saveSubscription,
  removeSubscription,
  sendToUser,
  broadcast,
  getPublicKey: () => VAPID_PUBLIC
};
