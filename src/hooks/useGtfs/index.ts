import { useEffect, useState } from 'react';

export type GtfsRoute = {
  shortName: string;
  longName: string;
  color: string;
};

let _cached: GtfsRoute[] | null = null;
let _promise: Promise<GtfsRoute[]> | null = null;

function parseCsv(text: string): GtfsRoute[] {
  const lines = text.split('\n');
  const header = lines[0].split(',');
  const shortIdx = header.indexOf('route_short_name');
  const longIdx = header.indexOf('route_long_name');
  const colorIdx = header.indexOf('route_color');

  const result: GtfsRoute[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    
    const shortName = cols[shortIdx]?.trim() || '';
    if (!shortName || seen.has(shortName)) continue;
    
    seen.add(shortName);
    result.push({
      shortName,
      longName: cols[longIdx]?.trim() || '',
      color: cols[colorIdx] ? `#${cols[colorIdx].trim()}` : '#1da527',
    });
  }
  
  return result.sort((a, b) => a.shortName.localeCompare(b.shortName, undefined, { numeric: true }));
}

export function loadGtfsRoutes(): Promise<GtfsRoute[]> {
  if (_cached) return Promise.resolve(_cached);
  if (_promise) return _promise;

  _promise = fetch('/gtfs/routes.txt')
    .then((r) => {
      if (!r.ok) throw new Error('Falha ao carregar gtfs/routes.txt');
      return r.text();
    })
    .then((text) => {
      const data = parseCsv(text);
      _cached = data;
      return data;
    });

  return _promise;
}

export function useGtfs() {
  const [routes, setRoutes] = useState<GtfsRoute[]>(_cached ?? []);
  const [loading, setLoading] = useState(!_cached);

  useEffect(() => {
    if (_cached) {
      setRoutes(_cached);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    loadGtfsRoutes()
      .then((data) => {
        if (alive) setRoutes(data);
      })
      .catch((e) => {
        console.error('[GTFS] Erro ao carregar rotas:', e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { routes, loading };
}
