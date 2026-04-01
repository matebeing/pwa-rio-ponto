import { useEffect, useRef, useState } from 'react';

export type Bus = {
  ordem: string;
  latitude: number;
  longitude: number;
  datahora?: string;
  /** Timestamp epoch ms parsed from datahora */
  datahoraMs: number;
  velocidade: number;
  linha: string;
  color: string;
};

const WS_URL = 'wss://api-sppo.onrender.com/ws';
const HTTP_URL = 'https://api-sppo.onrender.com/buses';

/** Max age of a GPS record to be considered 'fresh' - 5 minutes max */
const MAX_AGE_MS = 5 * 60 * 1000;

/** Reconnect delay for WebSocket */
const WS_RECONNECT_MS = 3000;

/** Parses a BR-format number string: "-22,90217" → -22.90217 */
function parseBR(value: string | number): number {
  if (typeof value === 'number') return value;
  return parseFloat(value.replace(',', '.'));
}

export function getLineColor(linha: string): string {
  let hash = 0;
  for (let i = 0; i < linha.length; i++) {
    hash = linha.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Raw shape from the API
type RawBus = {
  ordem: string;
  latitude: string | number;
  longitude: string | number;
  datahora?: string;
  velocidade: string | number;
  linha: string;
};

export type BusDataInfo = {
  /** Buses currently displayed */
  buses: Bus[];
  /** Timestamp of the last successful fetch */
  lastFetchedAt: number | null;
  /** Avg age (seconds) of the displayed GPS records */
  avgAgeSec: number | null;
  /** Total records returned by the API (before filtering) */
  totalFromApi: number;
  /** Records discarded because they were too old */
  discardedStale: number;
};

/**
 * Processes raw bus data into the final Bus[] format,
 * shared by both WebSocket and HTTP fallback paths.
 */
function processRawBuses(
  raw: RawBus[],
  lineColors: globalThis.Map<string, string>,
): { buses: Bus[]; avgAgeSec: number | null; totalFromApi: number; discardedStale: number } {
  const now = Date.now();
  const byOrdem = new globalThis.Map<string, Bus>();
  let discardedStale = 0;

  function getColor(linha: string): string {
    let c = lineColors.get(linha);
    if (!c) {
      c = getLineColor(linha);
      lineColors.set(linha, c);
    }
    return c;
  }

  for (const b of raw) {
    const vel = parseBR(b.velocidade);
    const ms = b.datahora ? Number(b.datahora) : 0;

    if (ms > 0 && now - ms > MAX_AGE_MS) {
      discardedStale++;
      continue;
    }

    const existing = byOrdem.get(b.ordem);
    if (!existing || ms > existing.datahoraMs) {
      byOrdem.set(b.ordem, {
        ordem: b.ordem,
        latitude: parseBR(b.latitude),
        longitude: parseBR(b.longitude),
        datahora: b.datahora,
        datahoraMs: ms,
        velocidade: vel,
        linha: b.linha,
        color: getColor(b.linha),
      });
    }
  }

  const buses = Array.from(byOrdem.values());
  const ages = buses
    .filter((b) => b.datahoraMs > 0)
    .map((b) => (now - b.datahoraMs) / 1000);
  const avgAgeSec =
    ages.length > 0
      ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      : null;

  return { buses, avgAgeSec, totalFromApi: raw.length, discardedStale };
}

/**
 * Decompresses a gzip ArrayBuffer → JSON
 */
async function decompressGzip(data: ArrayBuffer): Promise<RawBus[]> {
  const blob = new Blob([data]);
  const ds = new DecompressionStream('gzip');
  const decompressed = new Response(blob.stream().pipeThrough(ds));
  return decompressed.json();
}

export function useBus(isActive: boolean = true): BusDataInfo {
  const [info, setInfo] = useState<BusDataInfo>({
    buses: [],
    lastFetchedAt: null,
    avgAgeSec: null,
    totalFromApi: 0,
    discardedStale: 0,
  });

  const lineColorsRef = useRef<globalThis.Map<string, string>>(new globalThis.Map());

  useEffect(() => {
    if (!isActive) return;

    let mounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let wsFailCount = 0;
    let httpFallbackTimer: number | null = null;

    function updateState(raw: RawBus[]) {
      if (!mounted) return;
      const result = processRawBuses(raw, lineColorsRef.current);
      setInfo({
        ...result,
        lastFetchedAt: Date.now(),
      });
    }

    // ── WebSocket ──
    function connectWS() {
      if (!mounted) return;

      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('[SPPO] WebSocket conectado');
        wsFailCount = 0;
        // Stop HTTP fallback if it was running
        if (httpFallbackTimer !== null) {
          window.clearTimeout(httpFallbackTimer);
          httpFallbackTimer = null;
        }
      };

      ws.onmessage = async (event) => {
        try {
          let raw: RawBus[];

          if (event.data instanceof ArrayBuffer) {
            // Compressed binary (gzip)
            raw = await decompressGzip(event.data);
          } else {
            // Plain JSON text
            raw = JSON.parse(event.data);
          }

          updateState(raw);
        } catch (err) {
          console.error('[SPPO] Erro ao processar mensagem WS:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[SPPO] WebSocket erro:', err);
      };

      ws.onclose = () => {
        if (!mounted) return;
        wsFailCount++;
        console.log(`[SPPO] WebSocket desconectado (tentativa ${wsFailCount})`);

        // After 3 consecutive failures, fallback to HTTP polling
        if (wsFailCount >= 3) {
          console.log('[SPPO] Muitas falhas no WS, usando fallback HTTP');
          startHttpFallback();
        } else {
          reconnectTimer = window.setTimeout(connectWS, WS_RECONNECT_MS);
        }
      };
    }

    // ── HTTP Fallback ──
    async function fetchHttp() {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${HTTP_URL}?_t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (res.ok && mounted) {
          const raw: RawBus[] = await res.json();
          updateState(raw);
        }
      } catch (err) {
        console.error('[SPPO] Erro no fetch HTTP:', err);
      }

      if (mounted) {
        httpFallbackTimer = window.setTimeout(fetchHttp, 10000);
      }
    }

    function startHttpFallback() {
      if (httpFallbackTimer !== null) return; // Already running
      fetchHttp();
    }

    // Start with WebSocket
    connectWS();

    return () => {
      mounted = false;
      if (ws) {
        ws.onclose = null; // Prevent reconnect on unmount
        ws.close();
      }
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (httpFallbackTimer !== null) window.clearTimeout(httpFallbackTimer);
    };
  }, [isActive]);

  return info;
}
