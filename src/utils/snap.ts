import L from 'leaflet';
import { calculateBearing } from './geo';

const DEG_M_LAT = 111320;
// Average RJ latitude is -22.9
const DEG_M_LNG = 111320 * Math.cos((-22.9 * Math.PI) / 180);

export type Point2D = [number, number]; // [x, y] in pseudometers

export function toFlatMeters(lat: number, lng: number): Point2D {
  return [lng * DEG_M_LNG, lat * DEG_M_LAT];
}
export function toLatLng(x: number, y: number): [number, number] {
  return [y / DEG_M_LAT, x / DEG_M_LNG];
}
export function dist2D(p1: Point2D, p2: Point2D): number {
  return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

// Find closest point on segment p1-p2 to pt
export function closestPointOnSegment(pt: Point2D, p1: Point2D, p2: Point2D): Point2D {
  const l2 = dist2D(p1, p2) ** 2;
  if (l2 === 0) return p1;
  let t = ((pt[0] - p1[0]) * (p2[0] - p1[0]) + (pt[1] - p1[1]) * (p2[1] - p1[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}

export type ExtractedPolyline = {
  points: Point2D[];
  props: Record<string, any>;
};

// Sub-routine to extract linestrings and their properties from a heterogeneous Leaflet GeoJSON layer
export function extractPolylines(geoLayer: L.GeoJSON, targetLinha?: string): ExtractedPolyline[] {
  const result: ExtractedPolyline[] = [];
  geoLayer.eachLayer((layer: any) => {
    // Check if the feature belongs to the specific bus line (if requested)
    if (targetLinha && layer.feature?.properties?._linha !== targetLinha) {
      return;
    }

    if (typeof layer.getLatLngs === 'function') {
      const latlngs = layer.getLatLngs() as any;
      const props = layer.feature?.properties || {};

      const processArray = (arr: any) => {
        if (arr.length > 0 && typeof arr[0].lat === 'number') {
          result.push({ points: arr.map((l: L.LatLng) => toFlatMeters(l.lat, l.lng)), props });
        } else if (Array.isArray(arr[0])) {
          arr.forEach(processArray);
        }
      };
      processArray(latlngs);
    }
  });
  return result;
}

/**
 * Identifies the destination point of the bus based on its geometric alignment with the route vectors.
 */
export function identifyBusDirection(
  lat: number,
  lng: number,
  heading: number,
  linha: string,
  geoLayer: L.GeoJSON
): string | null {
  const lines = extractPolylines(geoLayer, linha);
  if (lines.length === 0) return null;

  const currentPt = toFlatMeters(lat, lng);
  let bestDist = Infinity;
  let bestDestino: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const { points, props } = lines[i];
    for (let j = 0; j < points.length - 1; j++) {
      const proj = closestPointOnSegment(currentPt, points[j], points[j + 1]);
      const d = dist2D(currentPt, proj);
      
      if (d < bestDist) {
        const latLngA = toLatLng(points[j][0], points[j][1]);
        const latLngB = toLatLng(points[j + 1][0], points[j + 1][1]);
        
        const bearingFwd = calculateBearing(latLngA[0], latLngA[1], latLngB[0], latLngB[1]);
        const bearingBwd = (bearingFwd + 180) % 360;

        const diffFwd = Math.abs((((bearingFwd - heading) % 360) + 540) % 360 - 180);
        const diffBwd = Math.abs((((bearingBwd - heading) % 360) + 540) % 360 - 180);

        // If the bus is physically closer to this segment, OR if it's identical (overlapping Ida and Volta lines),
        // we heavily favor the segment where the vector direction perfectly matches the bus's heading constraint.
        if (d < bestDist - 1 || (d <= bestDist + 1 && Math.min(diffFwd, diffBwd) < 45)) {
            bestDist = d;
            
            // To figure out if it's Ida or Volta, the GTFS string uses a property named 'destino'.
            const dirLabel = props.destino || null;
            
            if (dirLabel) {
               // We only assign it if we actually have a target
               bestDestino = dirLabel as string;
            }
        }
      }
    }
  }

  // If bus is too far from its official route (e.g. garaged or taking strange shortcuts), we don't assume destination.
  if (bestDist > 300) return null;

  return bestDestino;
}

/**
 * Ancors map coordinates to the itinerary line and navigates seamlessly through its curves
 * Returns [newLat, newLng]
 */
export function advanceAlongItinerary(
  lat: number,
  lng: number,
  heading: number,
  linha: string,
  distanceMeters: number,
  geoLayer: L.GeoJSON
): { lat: number; lng: number; heading: number } | null {
  const lines = extractPolylines(geoLayer, linha);
  if (lines.length === 0) return null;

  const currentPt = toFlatMeters(lat, lng);
  let bestDist = Infinity;
  let bestLineIdx = -1;
  let bestSegIdx = -1;
  let bestProj: Point2D | null = null;
  let bestDir = 0;

  for (let i = 0; i < lines.length; i++) {
    const { points } = lines[i];
    for (let j = 0; j < points.length - 1; j++) {
      const proj = closestPointOnSegment(currentPt, points[j], points[j + 1]);
      const d = dist2D(currentPt, proj);
      if (d < bestDist) {
        const latLngA = toLatLng(points[j][0], points[j][1]);
        const latLngB = toLatLng(points[j + 1][0], points[j + 1][1]);
        
        const bearingFwd = calculateBearing(latLngA[0], latLngA[1], latLngB[0], latLngB[1]);
        const bearingBwd = (bearingFwd + 180) % 360;

        const diffFwd = Math.abs((((bearingFwd - heading) % 360) + 540) % 360 - 180);
        const diffBwd = Math.abs((((bearingBwd - heading) % 360) + 540) % 360 - 180);

        bestDist = d;
        bestLineIdx = i;
        bestSegIdx = j;
        bestProj = proj;
        bestDir = diffFwd < diffBwd ? 1 : -1;
      }
    }
  }

  if (bestDist > 300 || !bestProj || bestLineIdx === -1) {
    return null; 
  }

  const { points } = lines[bestLineIdx];
  const line = points;
  let remainingDist = distanceMeters;
  let p = bestProj;
  let idx = bestDir === 1 ? bestSegIdx + 1 : bestSegIdx;
  
  let currentRoadBearing = heading;

  // Even if we don't travel any distance, we want to know the road's bearing at our exact snapped point!
  if (idx >= 0 && idx < line.length) {
     const target = line[idx];
     if (dist2D(p, target) > 0.1) {
       const pLl = toLatLng(p[0], p[1]);
       const tLl = toLatLng(target[0], target[1]);
       currentRoadBearing = calculateBearing(pLl[0], pLl[1], tLl[0], tLl[1]);
     } else if (bestDir === 1 && idx + 1 < line.length) {
       // We are standing exactly on 'target' node, check the next node to know road bearing
       const pLl = toLatLng(target[0], target[1]);
       const tLl = toLatLng(line[idx+1][0], line[idx+1][1]);
       currentRoadBearing = calculateBearing(pLl[0], pLl[1], tLl[0], tLl[1]);
     } else if (bestDir === -1 && idx - 1 >= 0) {
       const pLl = toLatLng(target[0], target[1]);
       const tLl = toLatLng(line[idx-1][0], line[idx-1][1]);
       currentRoadBearing = calculateBearing(pLl[0], pLl[1], tLl[0], tLl[1]);
     }
  }

  while (remainingDist > 0 && idx >= 0 && idx < line.length) {
    const target = line[idx];
    const segLen = dist2D(p, target);
    
    if (segLen > 0.1) {
      const pLl = toLatLng(p[0], p[1]);
      const tLl = toLatLng(target[0], target[1]);
      currentRoadBearing = calculateBearing(pLl[0], pLl[1], tLl[0], tLl[1]);
    }

    if (segLen <= remainingDist) {
      remainingDist -= segLen;
      p = target;
      idx += bestDir;
    } else {
      const ratio = remainingDist / segLen;
      p = [
        p[0] + (target[0] - p[0]) * ratio, 
        p[1] + (target[1] - p[1]) * ratio
      ];
      remainingDist = 0;
    }
  }

  const finalLatLng = toLatLng(p[0], p[1]);
  return { lat: finalLatLng[0], lng: finalLatLng[1], heading: currentRoadBearing };
}
