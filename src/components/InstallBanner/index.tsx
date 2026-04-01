/* ─────────────────────────────────────────────────────────────────────────────
 * InstallBanner — PWA install prompt shown after user engages with the map.
 *
 * Uses glassmorphism aesthetic consistent with the rest of the app's dark UI.
 * Slides up from the bottom with a smooth animation.
 * ─────────────────────────────────────────────────────────────────────────── */

import { memo, useState } from 'react';

interface InstallBannerProps {
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}

const InstallBanner = memo(function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    const accepted = await onInstall();
    if (!accepted) {
      setInstalling(false);
    }
  };

  return (
    <div className="pwa-install-banner" id="pwa-install-banner">
      <div className="pwa-install-banner__icon">⚡</div>
      <div className="pwa-install-banner__text">
        <strong>Instalar Rio No Ponto</strong>
        <span>Acesse mais rápido direto da tela inicial</span>
      </div>
      <div className="pwa-install-banner__actions">
        <button
          className="pwa-install-btn pwa-install-btn--primary"
          onClick={handleInstall}
          disabled={installing}
          id="pwa-install-button"
        >
          {installing ? 'Instalando…' : 'Instalar'}
        </button>
        <button
          className="pwa-install-btn pwa-install-btn--dismiss"
          onClick={onDismiss}
          id="pwa-dismiss-button"
        >
          Agora não
        </button>
      </div>
    </div>
  );
});

export default InstallBanner;
