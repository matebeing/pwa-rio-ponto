/* ─────────────────────────────────────────────────────────────────────────────
 * NotificationBell — Bell button in the map controls area.
 *
 * Click → requests push notification permission.
 * Shows visual feedback:
 *   • Default: bell icon, no active state
 *   • Granted: bell with active ring color
 *   • Denied: bell with strikethrough visual
 *
 * Also renders a foreground toast when a push message arrives.
 * ─────────────────────────────────────────────────────────────────────────── */

import { memo } from 'react';
import type { PushToast } from '../../hooks/usePushNotifications';

interface NotificationBellProps {
  isSupported: boolean;
  permissionState: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  toastMessage: PushToast | null;
  onClearToast: () => void;
}

const NotificationBell = memo(function NotificationBell({
  isSupported,
  permissionState,
  onRequestPermission,
  toastMessage,
  onClearToast,
}: NotificationBellProps) {
  if (!isSupported) return null;

  const isActive = permissionState === 'granted';
  const isDenied = permissionState === 'denied';

  return (
    <>
      <button
        className={`map-fab notification-bell ${isActive ? 'active' : ''} ${isDenied ? 'denied' : ''}`}
        onClick={onRequestPermission}
        title={
          isDenied
            ? 'Notificações bloqueadas — ative nas configurações do navegador'
            : isActive
              ? 'Notificações ativadas'
              : 'Ativar notificações de chegada'
        }
        id="notification-bell-button"
      >
        {isDenied ? '🔕' : '🔔'}
      </button>

      {/* Foreground toast */}
      {toastMessage && (
        <div className="push-toast" id="push-toast">
          <div className="push-toast__content">
            <strong>{toastMessage.title}</strong>
            <span>{toastMessage.body}</span>
          </div>
          <button className="push-toast__close" onClick={onClearToast}>✕</button>
        </div>
      )}
    </>
  );
});

export default NotificationBell;
