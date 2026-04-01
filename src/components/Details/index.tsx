import { memo, useMemo, Fragment } from 'react';
import { type Bus } from '../../hooks/useBus';
import './styles.css';

type DetailsProps = {
  selectedLines: string[];
  buses: Bus[];
  followedLinha?: string | null;
};

const Details = memo(function Details({
  selectedLines,
  buses,
  followedLinha = null,
}: DetailsProps) {
  const stats = useMemo(() => {
    const count = buses.length;
    const speeds = buses.map((b) => b.velocidade).filter((v) => v > 0);
    const avgSpeed = speeds.length > 0
      ? Math.round(speeds.reduce((a, v) => a + v, 0) / speeds.length)
      : 0;
    const moving = speeds.length;
    const stopped = count - moving;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    return { count, avgSpeed, moving, stopped, maxSpeed };
  }, [buses]);

  if (selectedLines.length === 0 && !followedLinha) {
    return null;
  }

  const movingPct = stats.count > 0 ? Math.round((stats.moving / stats.count) * 100) : 0;

  const headerText =
    selectedLines.length > 0
      ? selectedLines.length <= 3
        ? selectedLines.join(', ')
        : `${selectedLines.slice(0, 3).join(', ')} +${selectedLines.length - 3}`
      : followedLinha
        ? `Linha ${followedLinha}`
        : 'Painel';

  return (
    <div className="details-panel">
      <div className="details-header">{headerText}</div>

      {selectedLines.length > 0 && (
        <Fragment>
          <div className="details-grid">
            <div className="details-stat">
              <span className="details-stat-value">{stats.count}</span>
              <span className="details-stat-label">veículos</span>
            </div>
            <div className="details-stat">
              <span className="details-stat-value">{stats.moving}</span>
              <span className="details-stat-label">em mov.</span>
            </div>
            <div className="details-stat">
              <span className="details-stat-value">{stats.stopped}</span>
              <span className="details-stat-label">parados</span>
            </div>
            <div className="details-stat">
              <span className="details-stat-value">{stats.avgSpeed}<small> km/h</small></span>
              <span className="details-stat-label">vel. média</span>
            </div>
          </div>

          <div className="details-bar-container">
            <div className="details-bar-track">
              <div
                className="details-bar-fill"
                style={{ width: `${movingPct}%` }}
              />
            </div>
            <span className="details-bar-label">{movingPct}% em movimento</span>
          </div>

          {stats.maxSpeed > 0 && (
            <div className="details-row-inline">
              <span className="details-label">Mais rápido</span>
              <span className="details-value">{stats.maxSpeed} km/h</span>
            </div>
          )}
        </Fragment>
      )}
    </div>
  );
});

export default Details;
