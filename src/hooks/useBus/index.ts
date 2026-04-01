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

const API_URL = 'https://api-sppo.onrender.com/buses';

/** Max age of a GPS record to be considered 'fresh' - user explicitly requested 5 minutes max */
const MAX_AGE_MS = 5 * 60 * 1000;

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

// Raw shape from the API — all strings, commas as decimal separators
type RawBus = {
  ordem: string;
  latitude: string;
  longitude: string;
  datahora?: string;
  datahora_envio?: string;
  datahora_servidor?: string;
  velocidade: string;
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

export function useBus(isActive: boolean = true): BusDataInfo {
  const [info, setInfo] = useState<BusDataInfo>({
    buses: [],
    lastFetchedAt: null,
    avgAgeSec: null,
    totalFromApi: 0,
    discardedStale: 0,
  });

  const lastTextRef = useRef<string>('');
  const lineColorsRef = useRef<globalThis.Map<string, string>>(new globalThis.Map());

  useEffect(() => {
    let mounted = true;

    function getColor(linha: string): string {
      let c = lineColorsRef.current.get(linha);
      if (!c) { c = getLineColor(linha); lineColorsRef.current.set(linha, c); }
      return c;
    }

    let initialFetchCount = 0;
    let timeoutId: number | null = null;

    async function fetchData() {
      // User explicitly requested 5s polling for everything
      const nextDelay = 5000;

      initialFetchCount++;

      let usedDelay = nextDelay;

      try {
        const url = `${API_URL}?_t=${Date.now()}`;
        const controller = new AbortController();
        const timeoutIdCtrl = window.setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        window.clearTimeout(timeoutIdCtrl);

        if (!res.ok || !mounted) {
          timeoutId = window.setTimeout(fetchData, nextDelay);
          return;
        }

        const text = await res.text();
        if (text === lastTextRef.current) {
          timeoutId = window.setTimeout(fetchData, nextDelay);
          return;
        }
        lastTextRef.current = text;

        const raw: RawBus[] = JSON.parse(text);
        const now = Date.now();

        const byOrdem = new globalThis.Map<string, Bus>();
        let discardedStale = 0;

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

        if (mounted) {
          const buses = Array.from(byOrdem.values());
          const ages = buses
            .filter((b) => b.datahoraMs > 0)
            .map((b) => (now - b.datahoraMs) / 1000);
          const avgAgeSec = ages.length > 0
            ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
            : null;

          setInfo({
            buses,
            lastFetchedAt: now,
            avgAgeSec,
            totalFromApi: raw.length,
            discardedStale,
          });
        }
      } catch (err: any) {
        // if request took more than 2s and got aborted, retry immediately
        if (err.name === 'AbortError') {
          usedDelay = 200; // Immediate 200ms retry
        }
      }

      if (mounted) {
        timeoutId = window.setTimeout(fetchData, usedDelay);
      }
    }

    fetchData();
    return () => {
      mounted = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [isActive]);

  return info;
}