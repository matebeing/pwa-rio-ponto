/* ─────────────────────────────────────────────────────────────────────────────
 * Firebase Cloud Messaging — App-side integration
 *
 * Provides:
 *   • initFirebase()               — lazy-init Firebase app + messaging
 *   • requestNotificationPermission() — ask for Notification permission & FCM token
 *   • onForegroundMessage(cb)      — subscribe to in-app messages
 * ─────────────────────────────────────────────────────────────────────────── */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

let app: FirebaseApp | null = null;
let messaging_: Messaging | null = null;

/** Check if Firebase is configured (not placeholder values) */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'YOUR_API_KEY_HERE' &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID' &&
    vapidKey &&
    vapidKey !== 'YOUR_VAPID_KEY'
  );
}

/** Lazily initialize Firebase */
function initFirebase(): Messaging | null {
  if (!isFirebaseConfigured()) {
    console.warn('[FCM] Firebase not configured — push notifications disabled. Fill .env with your Firebase credentials.');
    return null;
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[FCM] Push notifications not supported in this browser.');
    return null;
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  if (!messaging_) {
    messaging_ = getMessaging(app);
  }
  return messaging_;
}

/**
 * Request notification permission and return FCM token.
 * Returns null if permission denied or Firebase not configured.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  const msg = initFirebase();
  if (!msg) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied.');
      return null;
    }

    // Register the FCM SW
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    console.log('[FCM] Token obtained:', token);
    return token;
  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    return null;
  }
}

/**
 * Subscribe to foreground messages.
 * Returns unsubscribe function.
 */
export function onForegroundMessage(
  callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void,
): (() => void) | null {
  const msg = initFirebase();
  if (!msg) return null;

  const unsubscribe = onMessage(msg, (payload) => {
    console.log('[FCM] Foreground message:', payload);
    callback({
      title: payload.notification?.title || 'Rio No Ponto',
      body: payload.notification?.body || 'Atualização disponível',
      data: payload.data,
    });
  });

  return unsubscribe;
}
