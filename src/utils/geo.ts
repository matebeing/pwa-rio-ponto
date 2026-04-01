/** Haversine distance between two lat/lng points, in meters */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Calculate geographic bearing (heading) between two points */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const toRadian = (degree: number) => (degree * Math.PI) / 180;
  const toDegree = (radian: number) => (radian * 180) / Math.PI;

  const dLng = toRadian(lng2 - lng1);
  const l1 = toRadian(lat1);
  const l2 = toRadian(lat2);

  const y = Math.sin(dLng) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLng);

  let brng = Math.atan2(y, x);
  brng = toDegree(brng);
  return (brng + 360) % 360;
}

/** Shortest-path angle interpolation in degrees. Prevents wrapping rotation from 350 to 10 */
export function interpolateAngle(from: number, to: number, weight: number): number {
  const shortestAngle = ((((to - from) % 360) + 540) % 360) - 180;
  return from + shortestAngle * weight;
}

/** Format distance for display: "350 m" or "2.3 km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format relative time: "há 2 min", "há 30s" */
export function formatTimeAgo(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) return 'agora';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `há ${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `há ${hrs}h${mins % 60}min`;
}

/**
 * Estimate time of arrival (ETA) based on distance and current speed.
 * Returns null if speed is 0 or distance is unknown.
 * Uses straight-line distance — actual travel time will be longer.
 */
export function estimateETA(distanceMeters: number | null, speedKmh: number): string | null {
  if (distanceMeters === null || distanceMeters <= 0 || speedKmh <= 0) return null;

  // speed km/h → m/s
  const speedMs = (speedKmh * 1000) / 3600;
  const etaSeconds = distanceMeters / speedMs;

  // Add ~30% for route vs straight-line difference
  const adjusted = Math.round(etaSeconds * 1.3);

  if (adjusted < 60) return '~1 min';
  const mins = Math.round(adjusted / 60);
  if (mins < 60) return `~${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `~${hrs}h${remMins > 0 ? `${remMins}min` : ''}`;
}
