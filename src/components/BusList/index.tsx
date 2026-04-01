import { memo, useMemo, useState } from 'react';
import type { Bus } from '../../hooks/useBus';
import type { UserLocation } from '../../hooks/useUserLocation';
import { haversineMeters, formatDistance, formatTimeAgo, estimateETA } from '../../utils/geo';
import './styles.css';

type SortMode = 'speed' | 'update' | 'distance';

type BusListProps = {
  buses: Bus[];
  /** Pre-calculated nearby buses from the parent */
  nearbyBuses?: Bus[];
  userLocation: UserLocation | null;
  onSelectBus: (bus: Bus) => void;
  tab: 'selected' | 'nearby';
  onTabChange: (tab: 'selected' | 'nearby') => void;
  loadingNearby?: boolean;
};

type BusWithDistance = Bus & { distanceM: number | null; eta: string | null };

/** Max radius for "Nearby" buses */
export const NEARBY_RADIUS_M = 500;

const BusList = memo(function BusList({ 
  buses, 
  nearbyBuses, 
  userLocation, 
  onSelectBus, 
  tab, 
  onTabChange,
  loadingNearby 
}: BusListProps) {
  const [sortMode, setSortMode] = useState<SortMode>('speed');
  const [collapsed, setCollapsed] = useState(false);

  // Enrich buses with distance + ETA
  const enrichBus = (b: Bus): BusWithDistance => {
    const distanceM = userLocation
      ? haversineMeters(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
      : null;
    const eta = estimateETA(distanceM, b.velocidade);
    return { ...b, distanceM, eta };
  };

  const busesWithDist: BusWithDistance[] = useMemo(
    () => buses.map(enrichBus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buses, userLocation],
  );

  const nearbyBusesWithDist: BusWithDistance[] = useMemo(
    () => nearbyBuses ? nearbyBuses.map(enrichBus) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nearbyBuses, userLocation],
  );

  const sorted = useMemo(() => {
    const source = tab === 'nearby' ? nearbyBusesWithDist : busesWithDist;
    const copy = [...source];
    
    // Default sorting for nearby: sort by distance/ETA (closest first)
    if (tab === 'nearby') {
      copy.sort((a, b) => {
        // Sort by distance (smaller = faster arrival/closest)
        return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity);
      });
      return copy.slice(0, 50);
    }
    
    switch (sortMode) {
      case 'speed':
        copy.sort((a, b) => b.velocidade - a.velocidade);
        break;
      case 'update':
        copy.sort((a, b) => b.datahoraMs - a.datahoraMs);
        break;
      case 'distance':
        copy.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
        break;
    }
    return copy;
  }, [busesWithDist, nearbyBusesWithDist, sortMode, tab]);

  const showNearbyTab = !!userLocation && !!nearbyBuses;
  if (buses.length === 0 && !showNearbyTab) return null;

  return (
    <div
      className="bus-list-sheet"
      style={{ transform: collapsed ? 'translateY(calc(100% - 44px))' : 'translateY(0)' }}
    >
      <div
        className="bus-list-handle-area"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="bus-list-handle" />
      </div>

      {/* Tabs */}
      {showNearbyTab && (
        <div className="bus-list-tabs">
          <button
            className={`bus-list-tab ${tab === 'selected' ? 'active' : ''}`}
            onClick={() => onTabChange('selected')}
          >
            🚌 Selecionados ({buses.length})
          </button>
          <button
            className={`bus-list-tab ${tab === 'nearby' ? 'active' : ''}`}
            onClick={() => onTabChange('nearby')}
            disabled={loadingNearby}
          >
            📍 Próximos {loadingNearby ? '⏳' : `(${nearbyBuses?.length})`}
          </button>
        </div>
      )}

      {!showNearbyTab && (
        <div className="bus-list-header">
          <span className="bus-list-title">Ônibus</span>
          <span className="bus-list-count">{buses.length} veículos</span>
        </div>
      )}

      {tab === 'selected' && (
        <div className="bus-list-sort">
          <button
            className={`bus-list-sort-btn ${sortMode === 'speed' ? 'active' : ''}`}
            onClick={() => setSortMode('speed')}
          >
            ⚡ Velocidade
          </button>
          <button
            className={`bus-list-sort-btn ${sortMode === 'update' ? 'active' : ''}`}
            onClick={() => setSortMode('update')}
          >
            🕐 Atualização
          </button>
          {userLocation && (
            <button
              className={`bus-list-sort-btn ${sortMode === 'distance' ? 'active' : ''}`}
              onClick={() => setSortMode('distance')}
            >
              📍 Distância
            </button>
          )}
        </div>
      )}

      <div className="bus-list-scroll">
        {sorted.length === 0 && (
          <div className="bus-list-empty">
            {tab === 'nearby'
              ? 'Nenhum ônibus em 2 km'
              : 'Nenhum ônibus encontrado'}
          </div>
        )}
        {sorted.map((bus) => (
          <div
            key={bus.ordem}
            className="bus-list-item"
            onClick={() => onSelectBus(bus)}
          >
            <div className="bus-list-dot" style={{ background: bus.color }} />
            <div className="bus-list-item-info">
              <div className="bus-list-item-line" style={{ color: bus.color }}>
                {bus.linha}
              </div>
              <div className="bus-list-item-sub">
                {bus.ordem} · {bus.datahoraMs > 0 ? formatTimeAgo(bus.datahoraMs) : '—'}
              </div>
            </div>
            <div className="bus-list-item-right">
              <div className="bus-list-item-speed">
                {bus.velocidade > 0 ? `${bus.velocidade} km/h` : 'Parado'}
              </div>
              {bus.distanceM !== null && (
                <div className="bus-list-item-dist">{formatDistance(bus.distanceM)}</div>
              )}
              {bus.eta && (
                <div className="bus-list-item-eta">{bus.eta}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default BusList;
