/* ─────────────────────────────────────────────────────────────────────────────
 * useInstallPrompt — Captures the beforeinstallprompt event for deferred installation.
 *
 * The banner is only shown when:
 *   1. The browser fires beforeinstallprompt (PWA criteria met)
 *   2. The caller sets `mapInteracted = true` (user engaged with the map)
 *   3. The user hasn't previously dismissed or installed
 * ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'rio-pwa-install-dismissed';

export interface UseInstallPromptReturn {
  /** Whether the install banner can be shown right now */
  canInstall: boolean;
  /** Whether the app is already installed (standalone mode) */
  isInstalled: boolean;
  /** Trigger the native install prompt */
  promptInstall: () => Promise<boolean>;
  /** Dismiss the banner (hides for this session) */
  dismiss: () => void;
}

export function useInstallPrompt(mapInteracted: boolean): UseInstallPromptReturn {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [promptAvailable, setPromptAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
  });

  const isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  useEffect(() => {
    if (isInstalled) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setPromptAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect install success
    const installedHandler = () => {
      setPromptAvailable(false);
      deferredPromptRef.current = null;
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isInstalled]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return false;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === 'accepted') {
      deferredPromptRef.current = null;
      setPromptAvailable(false);
      return true;
    }
    return false;
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* noop */ }
  }, []);

  const canInstall = promptAvailable && mapInteracted && !dismissed && !isInstalled;

  return { canInstall, isInstalled, promptInstall, dismiss };
}
