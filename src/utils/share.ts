import type { Bus } from '../hooks/useBus';

function formatDatahora(datahora?: string): string {
  if (!datahora) return '—';
  const ms = Number(datahora);
  if (isNaN(ms)) return '—';
  return new Date(ms).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/** Build a shareable text message about a bus */
export function buildShareText(bus: Bus): string {
  return [
    `🚌 Linha ${bus.linha} — Veículo ${bus.ordem}`,
    `⚡ Velocidade: ${bus.velocidade} km/h`,
    `🕐 Atualizado: ${formatDatahora(bus.datahora)}`,
    `📍 Posição: ${bus.latitude.toFixed(5)}, ${bus.longitude.toFixed(5)}`,
    ``,
    `Via Rio No Ponto 🗺️`,
  ].join('\n');
}

/** Share bus info — uses Web Share API with WhatsApp fallback */
export async function shareBus(bus: Bus, screenshot?: File): Promise<void> {
  const text = buildShareText(bus);

  const shareData: ShareData = {
    title: `Ônibus ${bus.linha}`,
    text,
    url: window.location.origin
  };

  if (screenshot && navigator.canShare) {
    const shareWithFile = { ...shareData, files: [screenshot] };
    if (navigator.canShare(shareWithFile)) {
      try {
        await navigator.share(shareWithFile);
        return;
      } catch {
        // fallback to standard share
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // user cancelled or API failed — fall through to WhatsApp
    }
  }

  // WhatsApp fallback
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}
