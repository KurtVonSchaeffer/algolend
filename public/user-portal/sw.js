// Service Worker for push notifications
// Registered by main app to handle background push events

self.addEventListener('install', (e) => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activated');
  e.waitUntil(self.clients.claim());
});

// Handle incoming push from server
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (err) {
    data = { title: 'Zwane Financial', body: event.data?.text() || 'New notification' };
  }

  const title   = data.title  || 'Zwane Financial';
  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/user-portal/icon-192.png',
    badge:   data.badge || '/user-portal/badge-72.png',
    tag:     data.tag   || 'zwane-' + Date.now(),
    data:    { url: data.url || '/user-portal/', ...(data.data || {}) },
    vibrate: [200, 100, 200],
    actions: data.actions || [{ action: 'open', title: 'View' }],
    requireInteraction: data.requireInteraction || false,
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click on notification → open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/user-portal/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If portal already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/user-portal') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Else open a new tab
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// When subscription expires, try to refresh it
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((sub) => fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      }))
  );
});
