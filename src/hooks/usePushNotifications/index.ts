/* ─────────────────────────────────────────────────────────────────────────────
 * usePushNotifications — Hook for Firebase Cloud Messaging push notifications.
 *
 * Provides:
 *   • requestPermission() — asks for notification permission & gets FCM token
 *   • token              — the FCM device token (null if not yet granted)
 *   • isSupported         — whether push is supported in this browser
 *   • permissionState     — 'default' | 'granted' | 'denied'
 *   • toastMessage        — latest foreground notification (auto-clears after 6s)
 * ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  requestNotificationPermission,
  onForegroundMessage,
  isFirebaseConfigured,
} from '../../services/firebase';

export interface PushToast {
  title: string;
  body: string;
}

export interface UsePushNotificationsReturn {
  token: string | null;
  isSupported: boolean;
  permissionState: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<void>;
  toastMessage: PushToast | null;
  clearToast: () => void;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [token, setToken] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<PushToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    isFirebaseConfigured();

  const permissionState: NotificationPermission | 'unsupported' = isSupported
    ? Notification.permission
    : 'unsupported';

  const requestPermission = useCallback(async () => {
    if (!isSupported) return;
    const fcmToken = await requestNotificationPermission();
    if (fcmToken) {
      setToken(fcmToken);
      // In production, send this token to your server to target this device
      console.log('[Push] Device registered. Token:', fcmToken);
    }
  }, [isSupported]);

  // Listen for foreground messages
  useEffect(() => {
    if (!isSupported || !token) return;

    const unsub = onForegroundMessage((payload) => {
      setToastMessage({ title: payload.title, body: payload.body });
      // Auto-clear after 6 seconds
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 6000);
    });

    return () => {
      unsub?.();
      clearTimeout(toastTimerRef.current);
    };
  }, [isSupported, token]);

  const clearToast = useCallback(() => {
    setToastMessage(null);
    clearTimeout(toastTimerRef.current);
  }, []);

  return { token, isSupported, permissionState, requestPermission, toastMessage, clearToast };
}
