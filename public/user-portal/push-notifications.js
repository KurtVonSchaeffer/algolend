/**
 * Client-side Push Notifications module.
 * Handles service worker registration, permission request, and subscription.
 *
 * Exposes:
 *   window.zwanePush.askPermission()  — prompt user for permission + subscribe
 *   window.zwanePush.isSubscribed()   — check current subscription state
 *   window.zwanePush.unsubscribe()    — remove subscription
 *   window.zwanePush.sendTest()       — send a test notification
 */
(function () {
  // Don't run on auth pages
  if (location.pathname.includes('/auth/')) return;

  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // Helper: convert VAPID public key from base64url → Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
  }

  async function registerServiceWorker() {
    if (!supported) throw new Error('Push notifications not supported in this browser');
    return await navigator.serviceWorker.register('/user-portal/sw.js', { scope: '/user-portal/' });
  }

  async function getSession() {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  async function isSubscribed() {
    if (!supported) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/user-portal/');
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch { return false; }
  }

  async function askPermission() {
    if (!supported) {
      alert('Push notifications are not supported in this browser.');
      return false;
    }

    // Check current permission first
    if (Notification.permission === 'denied') {
      alert('You have blocked notifications. Please enable them in your browser settings to receive updates.');
      return false;
    }

    try {
      const session = await getSession();
      if (!session) throw new Error('Please log in first');

      // Get VAPID public key from server
      const { publicKey } = await fetch('/api/push/public-key').then(r => r.json());
      if (!publicKey) throw new Error('Push notifications are not configured on the server');

      // Register service worker
      const reg = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(sub.toJSON())
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Subscription failed');
      }

      console.log('✅ Push notifications enabled');
      return true;
    } catch (err) {
      console.warn('[push]', err.message);
      alert('Could not enable notifications: ' + err.message);
      return false;
    }
  }

  async function unsubscribe() {
    if (!supported) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/user-portal/');
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;

      // Remove from server first
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });

      await sub.unsubscribe();
      console.log('Push notifications disabled');
      return true;
    } catch (err) {
      console.warn('[push] unsubscribe failed:', err.message);
      return false;
    }
  }

  async function sendTest() {
    const session = await getSession();
    if (!session) throw new Error('Not logged in');
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    return await res.json();
  }

  // Auto-register service worker on load (silent — doesn't ask for permission)
  if (supported) {
    navigator.serviceWorker.register('/user-portal/sw.js', { scope: '/user-portal/' })
      .catch(err => console.warn('[push] SW register failed:', err.message));
  }

  // Auto-prompt: ONE polite prompt after the user has been on the dashboard for 10s
  // and only if they haven't been asked before
  async function maybeAutoPrompt() {
    if (!supported || Notification.permission !== 'default') return;
    if (sessionStorage.getItem('push_prompted')) return;
    if (await isSubscribed()) return;

    // Wait until user is settled on dashboard
    if (!location.search.includes('page=dashboard') && location.pathname.endsWith('/user-portal/')) {
      setTimeout(showSoftPrompt, 10000);
    }
  }

  function showSoftPrompt() {
    if (document.getElementById('push-soft-prompt')) return;
    sessionStorage.setItem('push_prompted', '1');

    const banner = document.createElement('div');
    banner.id = 'push-soft-prompt';
    banner.style.cssText = `position:fixed;bottom:90px;left:16px;right:16px;max-width:380px;margin:auto;background:#fff;border-radius:20px;padding:16px;box-shadow:0 16px 40px rgba(0,0,0,.18);z-index:9998;border:1px solid rgba(15,23,42,.08);animation:pushSlideUp .4s cubic-bezier(.22,1,.36,1)`;
    banner.innerHTML = `
      <style>@keyframes pushSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}</style>
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="background:var(--color-primary,#E7762E);width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span class="material-symbols-outlined" style="color:#fff;font-size:22px">notifications_active</span>
        </div>
        <div style="flex:1;min-width:0">
          <h4 style="font-size:14px;font-weight:800;color:#0F172A;margin:0 0 4px;letter-spacing:-0.01em">Get instant updates</h4>
          <p style="font-size:12px;color:#64748B;margin:0;line-height:1.5">Be the first to know when your loan is approved or a payment is confirmed.</p>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button id="push-accept" style="flex:1;padding:10px;background:var(--color-primary,#E7762E);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer">Enable</button>
            <button id="push-decline" style="padding:10px 14px;background:#F1F5F9;color:#64748B;border:none;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer">Not now</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('push-accept').onclick = async () => {
      banner.remove();
      await askPermission();
    };
    document.getElementById('push-decline').onclick = () => banner.remove();
  }

  // Expose API on window
  window.zwanePush = {
    askPermission,
    isSubscribed,
    unsubscribe,
    sendTest,
    supported
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeAutoPrompt);
  } else {
    maybeAutoPrompt();
  }
})();
