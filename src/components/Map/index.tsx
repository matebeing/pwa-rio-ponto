import React, { useEffect, useRef, memo, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import html2canvas from 'html2canvas';
import { useMap, TileLayer, MapContainer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type Bus } from '../../hooks/useBus';
import { type UserLocation } from '../../hooks/useUserLocation';
import { type BusStop } from '../../hooks/useBusStops';
import { useItinerarios } from '../../hooks/useItinerarios';
import { useFogoCruzadoAlert } from '../../hooks/useFogoCruzadoAlert';
import { calculateBearing, interpolateAngle } from '../../utils/geo';
import { advanceAlongItinerary, identifyBusDirection } from '../../utils/snap';
import { type Occurrence, getOccurrenceLabel } from '../../services/fogocruzado';
import { getOccurrenceExtraContext } from '../../services/routeCrimeSafety';
import { escapeHtml } from '../../utils/escapeHtml';
import busSignIconUrl from '../../assets/bus_sign.svg';
import { IconLocate, IconBusStop, IconX } from '../Icons';
import NotificationBell from '../NotificationBell';
import type { PushToast } from '../../hooks/usePushNotifications';

export type MapHandle = {
  takeScreenshot: () => Promise<File | null>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function geoJsonStyle(feature?: GeoJSON.Feature): L.PathOptions {
  return {
    color: (feature?.properties?._color as string | undefined) ?? '#00c3ff',
    weight: 2,
    opacity: 0.4,
  };
}

/** Format SPPO timestamp (epoch ms string) into HH:mm:ss */
function formatDatahora(datahora?: string): string {
  if (!datahora) return '—';
  const ms = Number(datahora);
  if (isNaN(ms)) return '—';
  const d = new Date(ms);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatOccurrenceTooltipDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
}

function buildOccurrenceTooltip(occ: Occurrence): string {
  const when = formatOccurrenceTooltipDate(occ.date);
  const label = escapeHtml(getOccurrenceLabel(occ));
  const extra = getOccurrenceExtraContext(occ);
  const extraBlock = extra
    ? `<br><span style="display:block;margin-top:6px;opacity:.85;font-size:11px;line-height:1.4">${escapeHtml(extra)}</span>`
    : '';

  const meta: string[] = [];
  if (occ.addressSummary) {
    meta.push(`<span style="opacity:.7;font-size:11px">${escapeHtml(occ.addressSummary)}</span>`);
  }
  if (occ.policeAction) {
    meta.push('<span style="opacity:.72;font-size:11px">Ação policial registrada</span>');
  }
  if (occ.policeUnit) {
    meta.push(
      `<span style="opacity:.65;font-size:11px">Unidade: ${escapeHtml(occ.policeUnit)}</span>`,
    );
  }
  if (occ.documentNumber) {
    meta.push(`<span style="opacity:.55;font-size:10px">Registro FC #${escapeHtml(occ.documentNumber)}</span>`);
  }
  const metaBlock =
    meta.length > 0
      ? `<br><span style="display:block;margin-top:6px">${meta.join('<br>')}</span>`
      : '';

  return [
    `<div style="font-size:12px;line-height:1.45;max-width:280px">`,
    `<b style="font-weight:600">Roubo, assalto, furto, tentativa, arrastão, latrocínio, invasão (hist.)</b>`,
    `<br>${label}`,
    extraBlock,
    metaBlock,
    `<br><span style="opacity:.65;font-size:10px;margin-top:6px;display:block">${when} · dados históricos (CSV)</span>`,
    `</div>`,
  ].join('');
}

function buildTooltip(bus: Bus, destino: string | null): string {
  return [
    `<div style="font-size:13px;line-height:1.5">`,
    `<b style="font-size:14px">${bus.linha}</b>`,
    destino ? `<br><span style="opacity:.85">Sentido: <b>${destino}</b></span>` : '',
    `<br><span style="opacity:.7">Ordem:</span> ${bus.ordem}`,
    `<br><span style="opacity:.7">Velocidade:</span> ${bus.velocidade} km/h`,
    `<br><span style="opacity:.7">Atualizado:</span> ${formatDatahora(bus.datahora)}`,
    `</div>`,
  ].join('');
}

// ─── Animated marker state ────────────────────────────────────────────────────

type MarkerState = {
  marker: L.Marker;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  fromHeading: number;
  toHeading: number;
  hasHeading: boolean;
  startTime: number;
  velocidade: number; // km/h
  destino: string | null;
  linha: string;
  /** Last GPS timestamp (epoch ms) — used to skip redundant WS updates */
  lastDatahoraMs: number;
};

// ... (skipping unchanged code block manually, let's target specific lines)

const ANIM_DURATION = 3500;

// ─── Inner layer manager ──────────────────────────────────────────────────────

type LayerManagerProps = {
  buses: Bus[];
  itinerarioData: any;
  followedOrdem: string | null;
  onFollow: (ordem: string | null) => void;
  onSelectBus: (bus: Bus) => void;
  userLocation: UserLocation | null;
  busStops: BusStop[];
  showStops: boolean;
  panToUserTick?: number;
  isRisky: boolean;
  occurrences: Occurrence[];
  onMapInteraction?: () => void;
  disableAutoFit?: boolean;
};

// ── LayerManager (handles imperative Leaflet updates) ───────────────────────
const LayerManager = memo(function LayerManager({
  buses,
  itinerarioData,
  followedOrdem,
  onFollow,
  onSelectBus,
  userLocation,
  busStops,
  showStops,
  panToUserTick = 0,
  isRisky,
  occurrences,
  onMapInteraction,
  disableAutoFit = false,
}: LayerManagerProps) {
  const map = useMap();
  const statesRef = useRef<globalThis.Map<string, MarkerState>>(new globalThis.Map());
  const animFrameRef = useRef<number>(0);
  const fittedRef = useRef<string>('');

  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const userAccuracyRef = useRef<L.Circle | null>(null);
  const stopMarkersRef = useRef<L.LayerGroup | null>(null);
  const lastPanTickRef = useRef(0);

  // Get the followed bus's line
  // (removed unused followedBus declaration)

  const alertMarkersRef = useRef<L.LayerGroup | null>(null);
  const interactedRef = useRef(false);

  // ── Map interaction detection for PWA install banner ─────────────────────
  useEffect(() => {
    if (!onMapInteraction) return;
    const handler = () => {
      if (!interactedRef.current) {
        interactedRef.current = true;
        onMapInteraction();
      }
    };
    map.on('zoomend', handler);
    map.on('dragend', handler);
    map.on('click', handler);
    return () => {
      map.off('zoomend', handler);
      map.off('dragend', handler);
      map.off('click', handler);
    };
  }, [map, onMapInteraction]);

  // ── Imperative panToUserTick handler ───────────────────────────────────────
  useEffect(() => {
    if (panToUserTick > lastPanTickRef.current && userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 16, { animate: true, duration: 1 });
      lastPanTickRef.current = panToUserTick;
    }
  }, [panToUserTick, userLocation, map]);

  // ── Animation loop ────────────────────────────────────────────────────────
  const animate = useCallback(() => {
    const now = performance.now();
    const states = statesRef.current;

    for (const [, state] of states) {
      const elapsed = now - state.startTime;
      const t = Math.min(elapsed / ANIM_DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      let lat = state.fromLat + (state.toLat - state.fromLat) * ease;
      let lng = state.fromLng + (state.toLng - state.fromLng) * ease;

      // Interpolate heading (used as base, may be overridden by dead reckoning)
      let heading = interpolateAngle(state.fromHeading, state.toHeading, ease);

      // CONTINUOUS MOVEMENT / DEAD RECKONING
      // If animation finished and bus has speed, simulate continued path up to 90 seconds
      if (t === 1 && state.velocidade > 0 && state.hasHeading) {
        const excessElapsedMs = elapsed - ANIM_DURATION;
        const boundedExcessMs = Math.min(excessElapsedMs, 90000); // hard cap at 90s
        
        if (boundedExcessMs > 0) {
          const excessSeconds = boundedExcessMs / 1000;
          const speedMps = state.velocidade / 3.6; // convert km/h to m/s
          const distanceMeters = speedMps * excessSeconds;
          
          let advancedPosition: { lat: number, lng: number, heading: number } | null = null;
          
          // Try to snap to GeoJSON itinerary line if available
          if (geoLayerRef.current) {
             advancedPosition = advanceAlongItinerary(lat, lng, state.toHeading, state.linha, distanceMeters, geoLayerRef.current);
          }

          if (advancedPosition) {
            lat = advancedPosition.lat;
            lng = advancedPosition.lng;
            heading = advancedPosition.heading;
          } else {
            // Geographic Fallback: Organic Free Movement if there is no line or bus is out of route bounds
            const headingRad = (state.toHeading * Math.PI) / 180;
            const deltaLat = (Math.cos(headingRad) * distanceMeters) / 111320;
            const deltaLng = (Math.sin(headingRad) * distanceMeters) / (111320 * Math.cos(lat * Math.PI / 180));
            lat += deltaLat;
            lng += deltaLng;
          }
        }
      }

      state.marker.setLatLng([lat, lng]);

      // Is this bus currently in prediction/dead reckoning mode?
      const isPredicting = t === 1 && state.velocidade > 0 && state.hasHeading && (elapsed - ANIM_DURATION) > 0;

      const icon = state.marker.getElement();
      if (icon) {
        const container = icon.querySelector('.bus-marker-container') as HTMLElement;
        if (container) {
          container.style.transform = `rotate(${heading}deg)`;
        }

        if (state.hasHeading) {
          const nose = icon.querySelector('.bus-marker-nose') as HTMLElement;
          if (nose && nose.style.display !== 'block') {
            nose.style.display = 'block';
          }
        }

        // Gentle opacity pulse when in prediction mode (sine wave between 0.55 and 1.0)
        if (isPredicting) {
          const pulse = 0.775 + 0.225 * Math.sin(now / 600);
          (icon as HTMLElement).style.opacity = String(pulse);
        } else {
          if ((icon as HTMLElement).style.opacity !== '1') {
            (icon as HTMLElement).style.opacity = '1';
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);

  // ── Sync markers with bus data ────────────────────────────────────────────
  useEffect(() => {
    const states = statesRef.current;
    const currentOrdens = new Set(buses.map((b) => b.ordem));
    const now = performance.now();

    for (const [ordem, state] of states) {
      if (!currentOrdens.has(ordem)) {
        state.marker.remove();
        states.delete(ordem);
      }
    }

    for (const bus of buses) {
      if (isNaN(bus.latitude) || isNaN(bus.longitude)) continue;

      const existing = states.get(bus.ordem);
      if (existing) {
        // SKIP if GPS timestamp hasn't changed — the WS is just re-sending cached data.
        // This prevents resetting the animation/dead-reckoning to the same position.
        if (bus.datahoraMs > 0 && bus.datahoraMs === existing.lastDatahoraMs) {
          continue;
        }

        const currentPos = existing.marker.getLatLng();

        // Calculate new heading based on actual API-to-API movement
        const newHeading = calculateBearing(existing.toLat, existing.toLng, bus.latitude, bus.longitude);

        // Movement requires displacement AND the bus reporting speed > 0
        const hasDisplacement = Math.abs(existing.toLat - bus.latitude) > 0.0001 || Math.abs(existing.toLng - bus.longitude) > 0.0001;
        const isMoving = hasDisplacement && bus.velocidade > 0;
        
        let finalToHeading = existing.toHeading;
        if (isMoving) {
          const diff = Math.abs((((newHeading - existing.toHeading) % 360) + 540) % 360 - 180);
          // If driving fast (> 10km/h) but angle flips > 130 deg instantly, reject as GPS bounce
          if (existing.velocidade > 10 && diff > 130) {
            finalToHeading = existing.toHeading;
          } else {
            finalToHeading = newHeading;
          }
        }

        if (isMoving && geoLayerRef.current) {
          const matchedDestino = identifyBusDirection(bus.latitude, bus.longitude, finalToHeading, bus.linha, geoLayerRef.current);
          if (matchedDestino) existing.destino = matchedDestino;
        }

        // OVERSHOOT DETECTION: Check if animating from the current visual position
        // to the new API position would move the bus BACKWARDS relative to its heading.
        // This happens when dead reckoning pushed the marker further than the bus actually went.
        const bearingVisualToNew = calculateBearing(currentPos.lat, currentPos.lng, bus.latitude, bus.longitude);
        const reverseAngle = Math.abs((((bearingVisualToNew - existing.toHeading) % 360) + 540) % 360 - 180);
        const wouldGoBackwards = reverseAngle > 90;

        if (wouldGoBackwards) {
          // TELEPORT: Snap instantly to the new API position instead of animating backwards.
          // This prevents the 3.5s backwards slide that causes wrong-direction dead reckoning.
          existing.fromLat = bus.latitude;
          existing.fromLng = bus.longitude;
        } else {
          // Normal smooth animation from visual position to new API position
          existing.fromLat = currentPos.lat;
          existing.fromLng = currentPos.lng;
        }

        existing.toLat = bus.latitude;
        existing.toLng = bus.longitude;
        existing.fromHeading = existing.toHeading;
        existing.toHeading = finalToHeading;
        if (isMoving) existing.hasHeading = true;
        existing.startTime = now;
        existing.velocidade = bus.velocidade;
        existing.lastDatahoraMs = bus.datahoraMs;
        existing.marker.setTooltipContent(buildTooltip(bus, existing.destino));
      } else {
        const iconHtml = `
          <div class="bus-marker-container" style="background: transparent !important; border: none !important; border-radius: 0 !important; width: auto !important; height: auto !important; transform: rotate(0deg); transform-origin: center;">
            <svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3));">
              <rect x="3" y="3" width="18" height="27" rx="4" fill="#111" />
              <rect x="3" y="1" width="18" height="27" rx="4" fill="${bus.color}" />
              <path d="M 4 5 Q 12 2 20 5 L 20 9 L 4 9 Z" fill="#000" />
              <path d="M 5 5.5 Q 12 3.5 19 5.5 L 18 6.5 L 6 6.5 Z" fill="rgba(255,255,255,0.3)" />
              <path d="M 4 26 L 20 26 L 19 28 L 5 28 Z" fill="#000" />
              <rect x="5" y="10" width="14" height="14" rx="2" fill="rgba(255,255,255,0.15)" />
              <rect x="8" y="12" width="8" height="5" rx="1" fill="#ddd" />
              <rect x="8" y="13" width="8" height="3" fill="#bbb" />
            </svg>
          </div>
        `;
        const myIcon = L.divIcon({
          html: iconHtml,
          className: 'bus-custom-icon-wrapper',
          iconSize: [24, 32],
          iconAnchor: [12, 16],
        });

        const marker = L.marker([bus.latitude, bus.longitude], {
          icon: myIcon,
          zIndexOffset: 100,
        })
          .bindTooltip(buildTooltip(bus, null), {
            direction: 'top',
            sticky: false,
            className: 'bus-tooltip',
          })
          .addTo(map);

        const busRef = bus;
        marker.on('click', () => onSelectBus(busRef));

        states.set(bus.ordem, {
          marker,
          fromLat: bus.latitude,
          fromLng: bus.longitude,
          toLat: bus.latitude,
          toLng: bus.longitude,
          fromHeading: 0,
          toHeading: 0,
          hasHeading: false,
          startTime: now,
          velocidade: bus.velocidade,
          linha: bus.linha,
          destino: null,
          lastDatahoraMs: bus.datahoraMs,
        });
      }
    }
  }, [buses, map, onFollow, onSelectBus]);

  // ── Follow mode ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!followedOrdem) return;
    const bus = buses.find((b) => b.ordem === followedOrdem);
    if (bus && !isNaN(bus.latitude) && !isNaN(bus.longitude)) {
      map.panTo([bus.latitude, bus.longitude], { animate: true, duration: 1 });
    }
  }, [followedOrdem, buses, map]);

  // ── Highlight followed bus ────────────────────────────────────────────────
  useEffect(() => {
    // 1) Update markers
    const now = Date.now();
    for (const [ordem, state] of statesRef.current) {
      const el = state.marker.getElement();
      if (!el) continue;

      const container = el.querySelector('.bus-marker-container') as HTMLElement | null;
      const bus = buses.find((b) => b.ordem === ordem);
      const isStale = bus ? (now - bus.datahoraMs > 4 * 60 * 1000) : false;
      const baseOpacity = isStale ? '0.4' : '1';

      if (followedOrdem) {
        if (ordem === followedOrdem) {
          state.marker.setZIndexOffset(1000); // bring to front
          if (container) {
            container.style.boxShadow = 'none';
            container.style.opacity = baseOpacity;
            container.style.display = 'block';
            container.style.transform = container.style.transform.replace(/ scale\([^)]+\)/, '') + ' scale(1.4)';
            container.style.filter = isStale ? 'grayscale(100%)' : 'none';
          }
        } else {
          state.marker.setZIndexOffset(100);
          if (container) {
            container.style.boxShadow = 'none';
            container.style.display = 'none';
            container.style.transform = container.style.transform.replace(/ scale\([^)]+\)/, '');
          }
        }
      } else {
        // Reset
        state.marker.setZIndexOffset(100);
        if (container) {
          container.style.boxShadow = 'none';
          container.style.opacity = baseOpacity;
          container.style.display = 'block';
          container.style.transform = container.style.transform.replace(/ scale\([^)]+\)/, '');
          container.style.filter = isStale ? 'grayscale(100%)' : 'none';
        }
      }
    }

    // 2) Update GeoJSON Itinerary layer
    if (geoLayerRef.current) {
      geoLayerRef.current.setStyle((feature) => {
        const baseStyle = geoJsonStyle(feature);
        if (!followedOrdem) {
          return { ...baseStyle, opacity: 0.4, stroke: true };
        }
        const followedBus = buses.find((b) => b.ordem === followedOrdem);
        const isSameLine = followedBus && feature?.properties?._linha === followedBus.linha;
        return { ...baseStyle, opacity: isSameLine ? 0.6 : 0, weight: isSameLine ? 3 : 0, stroke: !!isSameLine };
      });
    }
  }, [followedOrdem, buses]);

  // ── Auto-fit ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (followedOrdem || disableAutoFit) return;
    const key = [...new Set(buses.map((b) => b.linha))].sort().join(',');
    if (!key || key === fittedRef.current || buses.length === 0) return;
    fittedRef.current = key;

    const latLngs: [number, number][] = buses
      .filter((b) => !isNaN(b.latitude) && !isNaN(b.longitude))
      .map((b) => [b.latitude, b.longitude]);

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      const targetZoom = map.getBoundsZoom(bounds, false, L.point(48, 48));

      if (targetZoom < 13) {
        // Prevent zooming out excessively (e.g. to see the whole state) which clumps markers
        map.setView(bounds.getCenter(), 13, { animate: true });
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buses.map((b) => b.linha).sort().join(','), followedOrdem]);

  // ── GeoJSON itinerary layer ───────────────────────────────────────────────

  useEffect(() => {
    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
      geoLayerRef.current = null;
    }
    if (itinerarioData) {
      geoLayerRef.current = L.geoJSON(itinerarioData as GeoJSON.FeatureCollection, {
        style: geoJsonStyle,
      }).addTo(map);
    }
  }, [itinerarioData, map]);

  // ── User location marker ──────────────────────────────────────────────────
  useEffect(() => {
    if (userLocation) {
      const pos: L.LatLngExpression = [userLocation.lat, userLocation.lng];

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(pos);
      } else {
        userMarkerRef.current = L.circleMarker(pos, {
          radius: 8,
          fillColor: '#4285f4',
          fillOpacity: 1,
          color: '#fff',
          weight: 3,
          className: 'user-location-marker',
        })
          .bindTooltip('Você está aqui', {
            direction: 'top',
            className: 'bus-tooltip',
          })
          .addTo(map);
      }

      if (userAccuracyRef.current) {
        userAccuracyRef.current.setLatLng(pos);
        userAccuracyRef.current.setRadius(userLocation.accuracy);
      } else {
        userAccuracyRef.current = L.circle(pos, {
          radius: userLocation.accuracy,
          fillColor: '#4285f4',
          fillOpacity: 0.08,
          color: '#4285f4',
          weight: 1,
          opacity: 0.3,
        }).addTo(map);
      }
    } else {
      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
      if (userAccuracyRef.current) { userAccuracyRef.current.remove(); userAccuracyRef.current = null; }
    }
  }, [userLocation, map]);

  // ── Bus stop markers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (stopMarkersRef.current) {
      stopMarkersRef.current.remove();
      stopMarkersRef.current = null;
    }

    if (!showStops || busStops.length === 0) return;

    const group = L.layerGroup();
    const currentZoom = map.getZoom();

    // Only render stops if zoomed in enough
    if (currentZoom >= 14) {
      const bounds = map.getBounds();
      const iconSize: L.PointExpression = currentZoom >= 16 ? [20, 20] : [12, 12];
      const stopIcon = L.icon({
        iconUrl: busSignIconUrl,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2] as L.PointExpression,
      });

      for (const stop of busStops) {
        if (!bounds.contains([stop.lat, stop.lng])) continue;
        L.marker([stop.lat, stop.lng], {
          icon: stopIcon,
          opacity: currentZoom >= 16 ? 1 : 0.7,
        })
          .bindTooltip(stop.stopName, {
            direction: 'top',
            className: 'bus-tooltip',
          })
          .addTo(group);
      }
    }

    group.addTo(map);
    stopMarkersRef.current = group;

    // Re-render stops on zoom/move
    const refreshStops = () => {
      if (stopMarkersRef.current) {
        stopMarkersRef.current.remove();
        stopMarkersRef.current = null;
      }
      const zoom = map.getZoom();
      if (zoom < 14) return;

      const newGroup = L.layerGroup();
      const b = map.getBounds();
      const iconSize: L.PointExpression = zoom >= 16 ? [20, 20] : [12, 12];
      const stopIcon = L.icon({
        iconUrl: busSignIconUrl,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2] as L.PointExpression,
      });

      for (const stop of busStops) {
        if (!b.contains([stop.lat, stop.lng])) continue;
        L.marker([stop.lat, stop.lng], {
          icon: stopIcon,
          opacity: zoom >= 16 ? 1 : 0.7,
        })
          .bindTooltip(stop.stopName, {
            direction: 'top',
            className: 'bus-tooltip',
          })
          .addTo(newGroup);
      }
      newGroup.addTo(map);
      stopMarkersRef.current = newGroup;
    };

    map.on('moveend', refreshStops);
    map.on('zoomend', refreshStops);

    return () => {
      map.off('moveend', refreshStops);
      map.off('zoomend', refreshStops);
    };
  }, [showStops, busStops, map]);

  // ── Fogo Cruzado alert markers ────────────────────────────────────────────
  useEffect(() => {
    if (alertMarkersRef.current) {
      alertMarkersRef.current.remove();
      alertMarkersRef.current = null;
    }

    if (!isRisky || occurrences.length === 0) return;

    const group = L.layerGroup();
    const pinHtml = '<div class="fc-alert-marker"><span class="fc-alert-dot"></span></div>';
    for (const occurrence of occurrences) {
      L.marker([occurrence.latitude, occurrence.longitude], {
        zIndexOffset: 350,
        icon: L.divIcon({
          html: pinHtml,
          className: 'fc-alert-marker-wrapper',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
      })
        .bindTooltip(buildOccurrenceTooltip(occurrence), {
          direction: 'top',
          sticky: true,
          className: 'bus-tooltip bus-tooltip--wide',
        })
        .addTo(group);
    }

    group.addTo(map);
    alertMarkersRef.current = group;
  }, [isRisky, occurrences, map]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      for (const s of statesRef.current.values()) s.marker.remove();
      statesRef.current.clear();
      if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null; }
      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
      if (userAccuracyRef.current) { userAccuracyRef.current.remove(); userAccuracyRef.current = null; }
      if (stopMarkersRef.current) { stopMarkersRef.current.remove(); stopMarkersRef.current = null; }
      if (alertMarkersRef.current) { alertMarkersRef.current.remove(); alertMarkersRef.current = null; }
    };
  }, []);

  return null;
});

// ─── Public component ─────────────────────────────────────────────────────────

type MapProps = {
  buses?: Bus[];
  selectedLines?: string[];
  lineColorMap?: globalThis.Map<string, string>;
  userLocation?: UserLocation | null;
  userLocationEnabled?: boolean;
  onToggleLocation?: () => void;
  busStops?: BusStop[];
  showStops?: boolean;
  onToggleStops?: () => void;
  onSelectBus?: (bus: Bus) => void;
  followedOrdem?: string | null;
  onFollow?: (ordem: string | null) => void;
  panToUserTick?: number;
  onMapInteraction?: () => void;
  disableAutoFit?: boolean;
  pushSupported?: boolean;
  pushPermission?: NotificationPermission | 'unsupported';
  onRequestPushPermission?: () => void;
  toastMessage?: PushToast | null;
  onClearToast?: () => void;
};

const BusMap = memo(forwardRef<MapHandle, MapProps>(function BusMap({
  buses = [],
  selectedLines = [],
  lineColorMap = new globalThis.Map(),
  userLocation = null,
  userLocationEnabled = false,
  onToggleLocation,
  busStops = [],
  showStops = false,
  onToggleStops,
  onSelectBus,
  followedOrdem = null,
  onFollow,
  panToUserTick = 0,
  onMapInteraction,
  disableAutoFit = false,
  pushSupported = false,
  pushPermission = 'unsupported',
  onRequestPushPermission,
  toastMessage = null,
  onClearToast,
}, ref) {
  const followedBus = followedOrdem ? buses.find((b) => b.ordem === followedOrdem) : null;

  const linesForItinerary = useMemo(() => {
    const s = new Set(selectedLines);
    if (followedBus?.linha) s.add(followedBus.linha);
    return Array.from(s);
  }, [selectedLines, followedBus?.linha]);

  const { data: itinerarioData } = useItinerarios(linesForItinerary, lineColorMap);

  const handleFollow = useCallback((ordem: string | null) => {
    onFollow?.(ordem === followedOrdem ? null : ordem);
  }, [onFollow, followedOrdem]);

  const handleSelectBus = useCallback((bus: Bus) => {
    onSelectBus?.(bus);
  }, [onSelectBus]);

  const followedLine = followedBus?.linha || null;
  const { isRisky, occurrences } = useFogoCruzadoAlert(followedLine, itinerarioData);
  const showRouteAlerts = Boolean(followedOrdem);
  const mapIsRisky = showRouteAlerts && isRisky;
  const mapOccurrences = showRouteAlerts ? occurrences : [];

  const mapContainerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    takeScreenshot: async () => {
      if (!mapContainerRef.current) return null;
      try {
        const controls = mapContainerRef.current.querySelectorAll('.leaflet-control-container, .map-fab-group, .follow-pill');
        controls.forEach((c) => { (c as HTMLElement).style.display = 'none'; });
        
        const canvas = await html2canvas(mapContainerRef.current, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#f8f9fa',
          scale: 2,
          logging: false,
        });
        
        controls.forEach((c) => { (c as HTMLElement).style.display = ''; });

        return new Promise<File | null>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) resolve(null);
            else resolve(new File([blob], `rio-no-ponto-${Date.now()}.png`, { type: 'image/png' }));
          }, 'image/png');
        });
      } catch (err) {
        console.error('Screenshot error:', err);
        return null;
      }
    }
  }));

  return (
    <div ref={mapContainerRef} style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <MapContainer
        center={[-22.9068, -43.1729]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <LayerManager
          buses={buses}
          itinerarioData={itinerarioData}
          followedOrdem={followedOrdem}
          onFollow={handleFollow}
          onSelectBus={handleSelectBus}
          userLocation={userLocation}
          busStops={busStops}
          showStops={showStops}
          panToUserTick={panToUserTick}
          isRisky={mapIsRisky}
          occurrences={mapOccurrences}
          onMapInteraction={onMapInteraction}
          disableAutoFit={disableAutoFit}
        />
      </MapContainer>

      {/* Map FABs */}
      <div className="map-fab-group">
        <button
          className={`map-fab ${userLocationEnabled ? 'active' : ''}`}
          onClick={onToggleLocation}
          title="Minha localização"
          id="btn-location"
        >
          <IconLocate size={20} />
        </button>
        <button
          className={`map-fab ${showStops ? 'active' : ''}`}
          onClick={onToggleStops}
          title="Pontos de parada"
          id="btn-stops"
        >
          <IconBusStop size={20} />
        </button>
        <NotificationBell
          isSupported={pushSupported}
          permissionState={pushPermission}
          onRequestPermission={() => onRequestPushPermission?.()}
          toastMessage={toastMessage}
          onClearToast={() => onClearToast?.()}
        />
      </div>

      {/* Follow pill */}
      {followedBus && (
        <div className={`follow-pill`}>
          <span style={{ color: followedBus.color, fontWeight: 700 }}>
            ● {followedBus.linha}
          </span>
          <span style={{ color: 'var(--text-2)' }}>{followedBus.ordem}</span>
          <span style={{ color: 'var(--text-2)' }}>{followedBus.velocidade} km/h</span>
          <button
            className="follow-pill-stop"
            onClick={() => onFollow?.(null)}
          >
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}));

export default BusMap;