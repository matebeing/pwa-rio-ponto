import { useEffect, useRef, useState, useMemo } from 'react';

export type ItinerarioFeature = {
  type: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

export type ItinerarioGeoJSON = {
  type: string;
  features: ItinerarioFeature[];
};

export function getFeatureLinha(f: ItinerarioFeature): string {
  return String(f.properties.linha ?? f.properties.LINHA ?? f.properties.servico ?? '');
}

// Module-level singleton cache — fetched once per session
let _cached: ItinerarioGeoJSON | null = null;
let _promise: Promise<ItinerarioGeoJSON> | null = null;

export function loadItinerarios(): Promise<ItinerarioGeoJSON> {
  if (_cached) return Promise.resolve(_cached);
  if (_promise) return _promise;
  _promise = fetch('/itinerario.geojson')
    .then((r) => { if (!r.ok) throw new Error('Falha ao carregar itinerario.geojson'); return r.json() as Promise<ItinerarioGeoJSON>; })
    .then((d) => { _cached = d; return d; });
  return _promise;
}

/**
 * Returns a filtered + colored GeoJSON for the given selected lines.
 * lineColorMap is consumed via ref so it never invalidates the useMemo.
 */
export function useItinerarios(
  selectedLines: string[],
  lineColorMap: globalThis.Map<string, string>,
) {
  const [allData, setAllData] = useState<ItinerarioGeoJSON | null>(_cached);
  const [loading, setLoading] = useState(!_cached);
  const [error, setError] = useState<string | null>(null);
  // Keep lineColorMap in a ref so it doesn't invalidate the filteredData memo
  const colorMapRef = useRef(lineColorMap);
  colorMapRef.current = lineColorMap;

  useEffect(() => {
    if (_cached) { setAllData(_cached); setLoading(false); return; }
    setLoading(true);
    let alive = true;
    loadItinerarios()
      .then((d) => { if (alive) { setAllData(d); setError(null); } })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Key that only changes when the set of selected lines changes
  const linesKey = useMemo(() => [...selectedLines].sort().join(','), [selectedLines]);

  const filteredData = useMemo(() => {
    if (!allData || !linesKey) return null;
    const lines = new Set(linesKey.split(',').filter(Boolean));
    if (lines.size === 0) return null;

    const features = allData.features
      .filter((f) => lines.has(getFeatureLinha(f)))
      .map((f) => {
        const linha = getFeatureLinha(f);
        return {
          ...f,
          properties: {
            ...f.properties,
            _color: colorMapRef.current.get(linha) ?? '#00c3ff',
            _linha: linha,
          },
        };
      });

    return features.length > 0
      ? { type: 'FeatureCollection' as const, features }
      : null;
  // colorMapRef intentionally omitted — reading via ref avoids infinite loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allData, linesKey]);

  return { data: filteredData, loading, error };
}