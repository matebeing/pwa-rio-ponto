import { memo } from 'react';
import type { Bus } from '../../hooks/useBus';
import type { UserLocation } from '../../hooks/useUserLocation';
import { haversineMeters, formatDistance, formatTimeAgo, estimateETA } from '../../utils/geo';
import { shareBus } from '../../utils/share';
import { IconFollow, IconShare, IconX } from '../Icons';
import './styles.css';

type BusInfoPanelProps = {
  bus: Bus;
  userLocation: UserLocation | null;
  isFollowing: boolean;
  onFollow: () => void;
  onClose: () => void;
};

const BusInfoPanel = memo(function BusInfoPanel({
  bus,
  userLocation,
  isFollowing,
  onFollow,
  onClose,
}: BusInfoPanelProps) {
  const distance = userLocation
    ? haversineMeters(userLocation.lat, userLocation.lng, bus.latitude, bus.longitude)
    : null;

  const eta = estimateETA(distance, bus.velocidade);

  const datahoraMs = bus.datahoraMs;
  const lastUpdate = datahoraMs > 0 ? formatTimeAgo(datahoraMs) : '—';
  const timeStr = datahoraMs > 0
    ? new Date(datahoraMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const isMoving = bus.velocidade > 0;

  return (
    <div className="bus-info-overlay" onClick={onClose}>
      <div className="bus-info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bus-info-handle" />

        <div className="bus-info-header">
          <span
            className="bus-info-line-badge"
            style={{ color: bus.color, borderLeft: `3px solid ${bus.color}` }}
          >
            {bus.linha}
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{bus.ordem}</div>
            <div className="bus-info-ordem">
              {isMoving ? (
                <><span style={{ color: 'var(--green)' }}>●</span> Em movimento</>
              ) : (
                <><span style={{ color: 'var(--red)' }}>●</span> Parado</>
              )}
            </div>
          </div>
        </div>

        <div className="bus-info-grid">
          <div className="bus-info-stat">
            <div className="bus-info-stat-label">Velocidade</div>
            <div className="bus-info-stat-value">{bus.velocidade} km/h</div>
          </div>
          <div className="bus-info-stat">
            <div className="bus-info-stat-label">Atualizado</div>
            <div className="bus-info-stat-value">{lastUpdate}</div>
          </div>
          <div className="bus-info-stat">
            <div className="bus-info-stat-label">Horário GPS</div>
            <div className="bus-info-stat-value">{timeStr}</div>
          </div>
          <div className="bus-info-stat">
            <div className="bus-info-stat-label">Distância</div>
            <div className="bus-info-stat-value">
              {distance !== null ? formatDistance(distance) : '—'}
            </div>
          </div>
        </div>

        {eta && (
          <div className="bus-info-eta">
            <span className="bus-info-eta-icon">⏱</span>
            <span>Chegada estimada: <strong>{eta}</strong></span>
          </div>
        )}

        <div className="bus-info-actions">
          <button
            className={`bus-info-btn bus-info-btn-follow ${isFollowing ? 'active' : ''}`}
            onClick={onFollow}
          >
            <IconFollow size={16} />
            {isFollowing ? 'Parar' : 'Seguir'}
          </button>
          <button
            className="bus-info-btn bus-info-btn-share"
            onClick={() => shareBus(bus)}
          >
            <IconShare size={16} />
            Compartilhar
          </button>
          <button className="bus-info-btn bus-info-btn-close" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

export default BusInfoPanel;
