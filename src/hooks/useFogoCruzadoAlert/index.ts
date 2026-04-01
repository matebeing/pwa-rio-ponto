import { useState, useEffect } from 'react';
import { fogoCruzadoService, type Occurrence } from '../../services/fogocruzado';
import {
  computeRouteSafetyLayman,
  occurrenceIsPatrimonialCrime,
  type RouteSafetyLayman,
} from '../../services/routeCrimeSafety';
import { haversineMeters } from '../../utils/geo';

export type FogoAlertState = {
  isRisky: boolean;
  occurrences: Occurrence[];
  routeSafety: RouteSafetyLayman | null;
  loading: boolean;
};

export function useFogoCruzadoAlert(linha: string | null, itinerarioData: any): FogoAlertState {
  const [result, setResult] = useState<FogoAlertState>({
    isRisky: false,
    occurrences: [],
    routeSafety: null,
    loading: false,
  });

  useEffect(() => {
    if (!linha || !itinerarioData) {
      setResult({ isRisky: false, occurrences: [], routeSafety: null, loading: false });
      return;
    }

    let cancelled = false;
    setResult({ isRisky: false, occurrences: [], routeSafety: null, loading: true });

    const checkAlerts = async () => {
      try {
        const allOccurrences = await fogoCruzadoService.getOccurrences();
        if (cancelled) return;

        const rioOccurrences = fogoCruzadoService.getOccurrencesInRio(allOccurrences);

        const riskyOccurrences: Occurrence[] = [];
        for (const occurrence of rioOccurrences) {
          if (!occurrenceIsPatrimonialCrime(occurrence)) continue;
          if (isPointOnRoute(occurrence.latitude, occurrence.longitude, itinerarioData)) {
            riskyOccurrences.push(occurrence);
          }
        }

        if (cancelled) return;
        const routeSafety = computeRouteSafetyLayman(riskyOccurrences);
        setResult({
          isRisky: riskyOccurrences.length > 0,
          occurrences: riskyOccurrences,
          routeSafety,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking Fogo Cruzado alerts:', error);
        if (!cancelled) {
          setResult({ isRisky: false, occurrences: [], routeSafety: null, loading: false });
        }
      }
    };

    void checkAlerts();
    return () => {
      cancelled = true;
    };
  }, [linha, itinerarioData]);

  return result;
}

// Função para verificar se um ponto está na rota (LineString ou Polygon)
function isPointOnRoute(lat: number, lng: number, itinerarioData: any): boolean {
  if (!itinerarioData?.features) return false;

  for (const feature of itinerarioData.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'LineString' && geometry.coordinates) {
      // Verificar se o ponto está próximo à linha (tolerância de 50m)
      for (const coord of geometry.coordinates) {
        const routeLat = coord[1];
        const routeLng = coord[0];
        const distance = haversineMeters(lat, lng, routeLat, routeLng);
        if (distance <= 150) { // tolerância ~corredor da rota (pontos do itinerário podem ser esparsos)
          return true;
        }
      }
    } else if (geometry.type === 'Polygon' && geometry.coordinates) {
      // Se for polígono, verificar se o ponto está dentro
      if (isPointInPolygon(lat, lng, geometry.coordinates[0])) {
        return true;
      }
    }
  }

  return false;
}

// Função para verificar se um ponto está dentro de um polígono (usando ray casting)
function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1]; // latitude
    const yi = polygon[i][0]; // longitude
    const xj = polygon[j][1]; // latitude
    const yj = polygon[j][0]; // longitude

    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}