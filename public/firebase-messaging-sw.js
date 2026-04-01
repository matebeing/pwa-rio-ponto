/* ─────────────────────────────────────────────────────────────────────────────
 * Firebase Cloud Messaging — Background Service Worker
 *
 * This SW handles push notifications when the app is in the background or
 * closed. Foreground messages are handled by the app itself via onMessage().
 *
 * NOTE: Replace the firebaseConfig values with your real Firebase credentials.
 * ─────────────────────────────────────────────────────────────────────────── */

importScripts('https://www.gstatic.com/firebasejs/11.5.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.5.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY_HERE',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message received:', payload);

  const title = payload.notification?.title || 'Rio No Ponto';
  const options = {
    body: payload.notification?.body || 'Atualização de ônibus disponível',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'rio-no-ponto-bus-alert',
    data: payload.data,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Abrir mapa' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };

  self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow('/');
    })
  );
});
