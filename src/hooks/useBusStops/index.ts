import { useEffect, useState } from 'react';

export type BusStop = {
  fid: number;
  stopName: string;
  lat: number;
  lng: number;
};

type StopFeature = {
  type: string;
  properties: { fid: number; stop_name: string };
  geometry: { type: string; coordinates: [number, number] };
};

type StopGeoJSON = {
  type: string;
  features: StopFeature[];
};

// Module-level cache
let _cached: BusStop[] | null = null;
let _promise: Promise<BusStop[]> | null = null;

function loadStops(): Promise<BusStop[]> {
  if (_cached) return Promise.resolve(_cached);
  if (_promise) return _promise;

  _promise = fetch('/pontos.geojson')
    .then((r) => {
      if (!r.ok) throw new Error('Falha ao carregar pontos.geojson');
      return r.json() as Promise<StopGeoJSON>;
    })
    .then((data) => {
      const stops: BusStop[] = data.features.map((f) => ({
        fid: f.properties.fid,
        stopName: f.properties.stop_name,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
      _cached = stops;
      return stops;
    });

  return _promise;
}

export function useBusStops() {
  const [stops, setStops] = useState<BusStop[]>(_cached ?? []);
  const [loading, setLoading] = useState(!_cached);

  useEffect(() => {
    if (_cached) { setStops(_cached); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    loadStops()
      .then((s) => { if (alive) setStops(s); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { stops, loading };
}
