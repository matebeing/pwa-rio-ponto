import { useState, useEffect } from 'react';
import { loadItinerarios, getFeatureLinha, type ItinerarioGeoJSON, type ItinerarioFeature } from '../useItinerarios';
import { haversineMeters } from '../../utils/geo';
import type { UserLocation } from '../useUserLocation';

/**
 * Checks if a GeoJSON feature (LineString or MultiLineString)
 * has at least one coordinate within `radiusMeters` of the user.
 */
function isFeatureNearUser(
  feature: ItinerarioFeature,
  userLat: number,
  userLng: number,
  radiusMeters: number
): boolean {
  const geom = feature.geometry as { type: string; coordinates: any[] };
  if (!geom || !geom.coordinates) return false;

  const checkLine = (coords: any[]) => {
    for (const point of coords) {
      if (Array.isArray(point) && point.length >= 2) {
        // GeoJSON coordinates are [longitude, latitude]
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        if (haversineMeters(userLat, userLng, lat, lng) <= radiusMeters) {
          return true;
        }
      }
    }
    return false;
  };

  if (geom.type === 'LineString') {
    return checkLine(geom.coordinates);
  } else if (geom.type === 'MultiLineString') {
    for (const line of geom.coordinates) {
      if (checkLine(line)) return true;
    }
  }

  return false;
}

/**
 * Finds all unique bus lines whose itinerary passes within `radius` of `userLocation`.
 * Offloads work to microtask or uses basic iteration (fast enough for ~18MB JSON ~50k points).
 */
export function useNearbyLines(userLocation: UserLocation | null, radiusMeters: number) {
  const [nearbyLines, setNearbyLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userLocation) {
      setNearbyLines([]);
      return;
    }

    let alive = true;
    setLoading(true);

    loadItinerarios()
      .then((data: ItinerarioGeoJSON) => {
        if (!alive) return;
        
        // Compute in background (setTimeout) so it doesn't freeze UI
        setTimeout(() => {
          if (!alive) return;
          const found = new Set<string>();
          
          for (const feature of data.features) {
            const linha = getFeatureLinha(feature);
            if (!linha) continue;
            
            // If we already know this line passes nearby, skip further checks
            if (found.has(linha)) continue;

            if (isFeatureNearUser(feature, userLocation.lat, userLocation.lng, radiusMeters)) {
              found.add(linha);
            }
          }
          
          setNearbyLines(Array.from(found));
          setLoading(false);
        }, 10);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [userLocation, radiusMeters]);

  return { nearbyLines, loading };
}
