import { useEffect, useRef, useState, useCallback } from 'react';

export type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  timestamp: number;
};

export type UseUserLocationResult = {
  location: UserLocation | null;
  enabled: boolean;
  error: string | null;
  /** Call to request/toggle location tracking */
  toggle: () => void;
};

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Permissão de localização negada');
          setEnabled(false);
        } else {
          setError('Erro ao obter localização');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    setEnabled(true);
  }, []);

  const stopWatch = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setEnabled(false);
  }, []);

  const toggle = useCallback(() => {
    if (enabled) {
      stopWatch();
    } else {
      startWatch();
    }
  }, [enabled, startWatch, stopWatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  return { location, enabled, error, toggle };
}
