import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Details from '../../components/Details';
import BusMap from '../../components/Map';
import Search from '../../components/Search';
import BusList, { NEARBY_RADIUS_M } from '../../components/BusList';
import BusInfoPanel from '../../components/BusInfoPanel';
import InstallBanner from '../../components/InstallBanner';
import SettingsPanel from '../../components/SettingsPanel';
import { IconMap, IconBus, IconSettings } from '../../components/Icons';
import { useBus, type Bus } from '../../hooks/useBus';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useBusStops } from '../../hooks/useBusStops';
import { useNearbyLines } from '../../hooks/useNearbyLines';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTheme } from '../../hooks/useTheme';

type ActiveTab = 'map' | 'lines' | 'settings';

const Home = () => {
  const [selectedLines, setSelectedLines] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('rio-selected-lines');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [searchedOrdem, setSearchedOrdem] = useState<string | null>(() => {
    return localStorage.getItem('rio-searched-ordem') || null;
  });
  const [followedOrdem, setFollowedOrdem] = useState<string | null>(null);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [showStops, setShowStops] = useState(false);
  const [listTab, setListTab] = useState<'selected' | 'nearby'>('selected');
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const userLoc = useUserLocation();
  const theme = useTheme();
  const { stops } = useBusStops();

  const isPollingActive = selectedLines.length > 0 || searchedOrdem !== null || followedOrdem !== null || userLoc.enabled;
  const { buses, lastFetchedAt, avgAgeSec } = useBus(isPollingActive);

  // Auto-locate user on initial load
  useEffect(() => {
    if (!userLoc.enabled && !userLoc.error) {
      userLoc.toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('rio-selected-lines', JSON.stringify(selectedLines));
  }, [selectedLines]);
  useEffect(() => {
    if (searchedOrdem) {
      localStorage.setItem('rio-searched-ordem', searchedOrdem);
    } else {
      localStorage.removeItem('rio-searched-ordem');
    }
  }, [searchedOrdem]);

  // ── PWA: Install prompt ───────────────────────────────────────────────────
  const [mapInteracted, setMapInteracted] = useState(false);
  const { canInstall, promptInstall, dismiss: dismissInstall } = useInstallPrompt(mapInteracted);

  // ── PWA: Push notifications ───────────────────────────────────────────────
  const {
    isSupported: pushSupported,
    permissionState: pushPermission,
    requestPermission: requestPushPermission,
    toastMessage,
    clearToast,
  } = usePushNotifications();

  const handleMapInteraction = useCallback(() => setMapInteracted(true), []);

  // Nearby lines
  const { nearbyLines, loading: loadingNearby } = useNearbyLines(userLoc.location, NEARBY_RADIUS_M);

  // ── LineColorMap ──────────────────────────────────────────────────────────
  const lineColorMapRef = useRef<globalThis.Map<string, string>>(new globalThis.Map());
  useEffect(() => {
    for (const bus of buses) lineColorMapRef.current.set(bus.linha, bus.color);
  }, [buses]);
  const lineColorMap = lineColorMapRef.current;

  // ── All lines / ordens ────────────────────────────────────────────────────
  const allLines = useMemo(() => Array.from(new Set(buses.map((b) => b.linha))).sort(), [buses]);
  const allOrdens = useMemo(() => Array.from(new Set(buses.map((b) => b.ordem))).sort(), [buses]);

  // ── Visible buses ─────────────────────────────────────────────────────────
  const visibleBuses = useMemo(() => {
    if (searchedOrdem) return buses.filter((b) => b.ordem === searchedOrdem);
    if (selectedLines.length === 0) return [];
    return buses.filter((b) => selectedLines.includes(b.linha));
  }, [buses, selectedLines, searchedOrdem]);

  const liveBus = useMemo(() => {
    if (!selectedBus) return null;
    return buses.find((b) => b.ordem === selectedBus.ordem) ?? selectedBus;
  }, [selectedBus, buses]);

  // ── Map buses ─────────────────────────────────────────────────────────────
  const mapBuses = useMemo(() => {
    if (listTab === 'nearby') {
      const unique = new Map<string, Bus>();
      visibleBuses.forEach((b) => unique.set(b.ordem, b));
      if (nearbyLines.length > 0) {
        const nearbySet = new Set(nearbyLines);
        buses.forEach((b) => { if (nearbySet.has(b.linha)) unique.set(b.ordem, b); });
      }
      return Array.from(unique.values());
    }
    return visibleBuses;
  }, [listTab, visibleBuses, buses, nearbyLines]);

  const nearbyBusesList = useMemo(() => {
    if (!userLoc.location || nearbyLines.length === 0) return [];
    const nearbySet = new Set(nearbyLines);
    return buses.filter((b) => nearbySet.has(b.linha));
  }, [buses, nearbyLines, userLoc.location]);

  const mapLines = useMemo(() => {
    if (listTab === 'nearby') {
      const lines = new Set<string>(selectedLines);
      mapBuses.forEach((b) => lines.add(b.linha));
      return Array.from(lines);
    }
    return selectedLines;
  }, [listTab, selectedLines, mapBuses]);

  const followedBus = useMemo(
    () => (followedOrdem ? buses.find((b) => b.ordem === followedOrdem) ?? null : null),
    [followedOrdem, buses],
  );

  const [panToUserTick, setPanToUserTick] = useState(0);
  const [initialPanDone, setInitialPanDone] = useState(false);

  useEffect(() => {
    if (userLoc.location && !initialPanDone) {
      setPanToUserTick((t) => t + 1);
      setInitialPanDone(true);
    }
  }, [userLoc.location, initialPanDone]);

  const handleToggleLocation = useCallback(() => {
    if (!userLoc.enabled) userLoc.toggle();
    setPanToUserTick((t) => t + 1);
  }, [userLoc]);

  const handleSelectBus = useCallback((bus: Bus) => setSelectedBus(bus), []);
  const handleFollow = useCallback((ordem: string | null) => {
    setFollowedOrdem(ordem);
    if (ordem) setActiveTab('map');
  }, []);

  const handleInfoFollow = useCallback(() => {
    if (!liveBus) return;
    setFollowedOrdem((prev) => (prev === liveBus.ordem ? null : liveBus.ordem));
    setSelectedBus(null);
    setActiveTab('map');
  }, [liveBus]);

  const handleInfoClose = useCallback(() => setSelectedBus(null), []);

  const handleSearchOrdem = useCallback((ordem: string | null) => {
    setFollowedOrdem(null);
    setSearchedOrdem(ordem);
    if (ordem) setSelectedLines([]);
  }, []);

  const handleSelectLines = useCallback(
    (lines: string[]) => {
      setSelectedLines(lines);
      if (lines.length > 0) setSearchedOrdem(null);
      setFollowedOrdem((ord) => {
        if (ord == null) return null;
        const bus = buses.find((b) => b.ordem === ord);
        if (!bus) return null;
        if (lines.length === 0) return listTab === 'selected' ? null : ord;
        if (!lines.includes(bus.linha)) return null;
        return ord;
      });
    },
    [buses, listTab],
  );

  // ── Staleness ─────────────────────────────────────────────────────────────
  const isStale = avgAgeSec !== null && avgAgeSec > 120;
  const ageLabel = avgAgeSec !== null
    ? avgAgeSec >= 60 ? `${Math.floor(avgAgeSec / 60)}m${avgAgeSec % 60}s` : `${avgAgeSec}s`
    : '—';
  const lastFetchLabel = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  // ── Tab handlers ──────────────────────────────────────────────────────────
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'lines' && !userLoc.enabled) {
      userLoc.toggle();
    }
  }, [userLoc]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Search — always above map */}
      {activeTab === 'map' && (
        <Search
          allLines={allLines}
          allOrdens={allOrdens}
          lineColorMap={lineColorMap}
          selectedLines={selectedLines}
          onSelectLines={handleSelectLines}
          onSearchOrdem={handleSearchOrdem}
        />
      )}

      {/* Map — always rendered */}
      <BusMap
        buses={mapBuses}
        selectedLines={mapLines}
        lineColorMap={lineColorMap}
        userLocation={userLoc.location}
        userLocationEnabled={userLoc.enabled}
        onToggleLocation={handleToggleLocation}
        busStops={stops}
        showStops={showStops}
        onToggleStops={() => setShowStops((s) => !s)}
        onSelectBus={handleSelectBus}
        followedOrdem={followedOrdem}
        onFollow={handleFollow}
        panToUserTick={panToUserTick}
        onMapInteraction={handleMapInteraction}
        pushSupported={pushSupported}
        pushPermission={pushPermission}
        onRequestPushPermission={requestPushPermission}
        toastMessage={toastMessage}
        onClearToast={clearToast}
        disableAutoFit={activeTab === 'lines'}
      />

      {/* Details panel (desktop only) */}
      <Details
        buses={visibleBuses}
        selectedLines={searchedOrdem ? [searchedOrdem] : selectedLines}
        followedLinha={followedOrdem ? followedBus?.linha ?? null : null}
      />

      {/* BusList bottom sheet */}
      {activeTab === 'lines' && (
        <BusList
          buses={visibleBuses}
          nearbyBuses={nearbyBusesList}
          userLocation={userLoc.location}
          onSelectBus={handleSelectBus}
          tab={listTab}
          onTabChange={setListTab}
          loadingNearby={loadingNearby}
        />
      )}

      {/* Bus info panel */}
      {liveBus && (
        <BusInfoPanel
          bus={liveBus}
          userLocation={userLoc.location}
          isFollowing={followedOrdem === liveBus.ordem}
          onFollow={handleInfoFollow}
          onClose={handleInfoClose}
        />
      )}

      {/* PWA Install Banner */}
      {canInstall && <InstallBanner onInstall={promptInstall} onDismiss={dismissInstall} />}

      {/* Settings Panel */}
      <SettingsPanel
        open={activeTab === 'settings'}
        themeMode={theme.mode}
        onSetTheme={theme.setMode}
        onClose={() => setActiveTab('map')}
      />

      {/* Staleness pill */}
      <div className={`staleness-pill ${isStale ? 'stale' : ''}`}>
        <span>{isStale ? '⚠' : '●'}</span>
        <span>GPS: <strong>{ageLabel}</strong></span>
        <span>{lastFetchLabel}</span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
       * Bottom Tab Bar — iOS style, thumb-friendly
       * ══════════════════════════════════════════════════════════════════ */}
      <nav className="tab-bar">
        <button
          className={`tab-bar-item ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => handleTabChange('map')}
          id="tab-map"
        >
          <IconMap size={22} filled={activeTab === 'map'} />
          <span>Mapa</span>
        </button>
        <button
          className={`tab-bar-item ${activeTab === 'lines' ? 'active' : ''}`}
          onClick={() => handleTabChange('lines')}
          id="tab-lines"
        >
          <IconBus size={22} filled={activeTab === 'lines'} />
          <span>Próximos</span>
        </button>
        <button
          className={`tab-bar-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabChange('settings')}
          id="tab-settings"
        >
          <IconSettings size={22} filled={activeTab === 'settings'} />
          <span>Ajustes</span>
        </button>
      </nav>
    </div>
  );
};

export default Home;