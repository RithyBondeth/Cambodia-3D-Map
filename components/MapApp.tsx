'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as maplibregl from 'maplibre-gl';
import type { Point } from 'geojson';
import type { Place } from '@/lib/places';
import type { Theme } from '@/lib/theme';
import type { LngLat } from '@/lib/geo';
import { loadStyle } from '@/lib/mapStyle';
import {
  BUILDINGS_LAYER, POI_LAYERS, ROUTE_ALT_LAYER, applyTerrain, decorate, setBuildingsVisible,
  setRoutes, setSelectedBuilding, type MapState,
} from '@/lib/mapLayers';
import { LANDMARK_INFO } from '@/lib/landmarks';
import { fetchRoutes, type Route } from '@/lib/routing';
import { prettyCategory, type SearchResult } from '@/lib/search';
import { unlockSpeech } from '@/lib/nav/voice';
import SearchBox from './SearchBox';
import ExplorePanel from './ExplorePanel';
import PlaceCard, { type PlaceInfo } from './PlaceCard';
import DirectionsPanel, { type Endpoint } from './DirectionsPanel';
import ControlDock from './ControlDock';
import { DirectionsIcon } from './icons';

// Navigation (and Three.js, for the 3D car) loads only once directions are open.
const loadNavigation = () => import('./Navigation');
const Navigation = dynamic(loadNavigation, { ssr: false });

// Served from public/ by scripts/copy-maplibre-worker.mjs; ?v busts the cache on upgrades.
maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);

type View = 'explore' | 'place' | 'directions';

const isPhone = () => window.matchMedia('(max-width: 760px)').matches;

// Frame a route beside the directions panel (desktop) or above the bottom sheet (phone).
function fitRoute(map: maplibregl.Map, route: Route, duration: number) {
  const bounds = route.coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(route.coords[0], route.coords[0]));
  map.fitBounds(bounds, {
    padding: isPhone() ? { top: 60, bottom: window.innerHeight * 0.5, left: 40, right: 40 } : { top: 80, bottom: 80, left: 460, right: 100 },
    pitch: 45, bearing: 0, duration, maxZoom: 16.5,
  });
}

function markerEl(className: string) {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = '<span></span>';
  return el;
}

export default function MapApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const markers = useRef<Record<string, maplibregl.Marker | undefined>>({});
  const orbitRef = useRef(0);
  const myLocation = useRef<Endpoint | null>(null);

  const [theme, setTheme] = useState<Theme>('day');
  const [exaggeration, setExaggeration] = useState(1.5);
  const [terrain, setTerrain] = useState(true);
  const [buildings, setBuildings] = useState(true);
  const [bearing, setBearing] = useState(0);
  const [is3D, setIs3D] = useState(true);
  const [mapError, setMapError] = useState('');

  const [view, setView] = useState<View>('explore');
  const [sheetOpen, setSheetOpen] = useState(true);
  const [place, setPlace] = useState<PlaceInfo | null>(null);

  const [from, setFrom] = useState<Endpoint | null>(null);
  const [to, setTo] = useState<Endpoint | null>(null);
  const [routes, setRoutesState] = useState<Route[]>([]);
  const [selected, setSelected] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [nav, setNav] = useState<{ preview: boolean } | null>(null);

  // Map event handlers read the latest state through refs.
  const stateRef = useRef<MapState>({ theme, exaggeration, terrain, buildings });
  stateRef.current = { theme, exaggeration, terrain, buildings };
  const viewRef = useRef(view);
  viewRef.current = view;
  const navRef = useRef(nav);
  navRef.current = nav;

  const near = useCallback((): LngLat => {
    const c = mapRef.current?.getCenter();
    return c ? [c.lng, c.lat] : [104.922, 11.565];
  }, []);

  // --- Helpers that touch the map ---

  const setMarker = useCallback((key: string, className: string, at: LngLat | null) => {
    const map = mapRef.current;
    const existing = markers.current[key];
    if (!at || !map) {
      existing?.remove();
      markers.current[key] = undefined;
      return;
    }
    if (existing) existing.setLngLat(at);
    else markers.current[key] = new maplibregl.Marker({ element: markerEl(className), anchor: className.includes('pin') ? 'bottom' : 'center' }).setLngLat(at).addTo(map);
  }, []);

  const stopOrbit = useCallback(() => {
    cancelAnimationFrame(orbitRef.current);
    orbitRef.current = 0;
  }, []);

  const showPlace = useCallback((info: PlaceInfo, selectedFeature?: Parameters<typeof setSelectedBuilding>[1]) => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedBuilding(map, selectedFeature ?? null);
    setMarker('place', 'marker-pin', info.kind === 'place' || info.kind === 'pin' ? info.center : null);
    setPlace(info);
    setView('place');
    setSheetOpen(true);
  }, [setMarker]);

  const closePlace = useCallback(() => {
    if (mapRef.current) setSelectedBuilding(mapRef.current, null);
    setMarker('place', '', null);
    setPlace(null);
    setView('explore');
  }, [setMarker]);

  // --- Map setup (once) ---
  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | undefined;

    loadStyle(stateRef.current.theme).then((style) => {
      if (cancelled) return;
      map = new maplibregl.Map({
        container: containerRef.current!,
        style,
        center: [104.922, 11.565],
        zoom: 15.2,
        pitch: 62,
        bearing: -20,
        maxPitch: 85,
        hash: true,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      (window as unknown as { map: maplibregl.Map }).map = map; // handy for debugging in the console

      // Its button is hidden; the dock's locate button triggers it. It draws the blue dot.
      const geolocate = new maplibregl.GeolocateControl({ trackUserLocation: true, positionOptions: { enableHighAccuracy: true } });
      geolocateRef.current = geolocate;
      map.addControl(geolocate, 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
      geolocate.on('geolocate', (e) => {
        myLocation.current = { label: 'Your location', center: [e.coords.longitude, e.coords.latitude], mine: true };
      });

      const m = map;
      m.on('style.load', () => decorate(m, stateRef.current));
      m.on('error', (e) => console.warn('Map error:', e.error?.message));
      // The navigation camera turns every frame; the compass is hidden then anyway.
      m.on('rotate', () => !navRef.current && setBearing(m.getBearing()));
      m.on('pitchend', () => setIs3D(m.getPitch() > 10));
      for (const ev of ['dragstart', 'wheel', 'touchstart'] as const) m.on(ev, stopOrbit);

      m.on('click', (e) => {
        if (navRef.current) return;
        const layers = [ROUTE_ALT_LAYER, ...POI_LAYERS, 'kh-landmarks', BUILDINGS_LAYER].filter((id) => m.getLayer(id));
        const f = m.queryRenderedFeatures(e.point, { layers })[0];
        if (!f) {
          if (viewRef.current === 'place') closePlace();
          return;
        }
        const props = f.properties as Record<string, string | number | undefined>;
        const id = f.layer.id;

        if (id === ROUTE_ALT_LAYER) {
          setSelected(Number(props.index));
        } else if (POI_LAYERS.includes(id)) {
          const local = props.name as string | undefined;
          const latin = (props['name:en'] ?? props.name_en ?? props['name:latin']) as string | undefined;
          showPlace({
            kind: 'place',
            title: latin || local || 'Place',
            subtitle: latin && local && latin !== local ? local : undefined,
            category: prettyCategory((props.subclass ?? props.class) as string | undefined),
            center: (f.geometry as Point).coordinates as LngLat,
          });
        } else if (id === 'kh-landmarks') {
          const name = String(props.landmark);
          const info = LANDMARK_INFO[name];
          showPlace({
            kind: 'landmark',
            title: name,
            subtitle: info?.subtitle,
            facts: info ? [{ label: 'Height', value: info.height }, { label: 'Built', value: info.built }, { label: 'Model', value: 'Hand-built 3D' }] : [],
            center: [e.lngLat.lng, e.lngLat.lat],
          });
        } else {
          const h = Number(props.render_height ?? 0);
          const base = Number(props.render_min_height ?? 0);
          showPlace({
            kind: 'building',
            title: 'Building',
            category: 'OpenStreetMap',
            subtitle: 'Real footprint. Height from OSM, or estimated where OSM has none.',
            facts: [
              { label: 'Height', value: `≈ ${Math.round(h)} m` },
              { label: 'Floors', value: `≈ ${Math.max(1, Math.round((h - base) / 3.3))}` },
              ...(base > 0 ? [{ label: 'Starts at', value: `${Math.round(base)} m` }] : []),
            ],
            center: [e.lngLat.lng, e.lngLat.lat],
          }, { geometry: f.geometry, properties: f.properties });
        }
      });

      // Right-click (desktop) or long-press (touch) drops a pin.
      m.on('contextmenu', (e) => {
        if (navRef.current) return;
        showPlace({ kind: 'pin', title: 'Dropped pin', center: [e.lngLat.lng, e.lngLat.lat] });
      });

      for (const layer of [BUILDINGS_LAYER, 'kh-landmarks', ROUTE_ALT_LAYER, ...POI_LAYERS]) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
      }
    }).catch((e: Error) => !cancelled && setMapError(e.message));

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markers.current = {};
    };
  }, [closePlace, showPlace, stopOrbit]);

  // --- Theme: rebuild the recoloured style; decorate() re-runs on style.load ---
  const loadedTheme = useRef<Theme>(theme);
  useEffect(() => {
    document.body.dataset.theme = theme;
    if (loadedTheme.current === theme) return;
    loadedTheme.current = theme;
    loadStyle(theme).then((s) => mapRef.current?.setStyle(s, { diff: false })).catch((e: Error) => setMapError(e.message));
  }, [theme]);

  useEffect(() => {
    if (mapRef.current) setBuildingsVisible(mapRef.current, buildings);
  }, [buildings]);

  useEffect(() => {
    const map = mapRef.current;
    // Before style.load the DEM source doesn't exist yet; decorate() applies terrain then.
    if (map?.getSource('dem')) applyTerrain(map, stateRef.current);
  }, [terrain, exaggeration]);

  // --- Directions ---

  // Fetch routes whenever both ends are known.
  useEffect(() => {
    setMarker('from', 'marker-start', view === 'directions' ? from?.center ?? null : null);
    setMarker('to', 'marker-pin end', view === 'directions' ? to?.center ?? null : null);
    setRoutesState([]);
    setSelected(0);
    setRouteError('');
    if (view !== 'directions' || !from || !to) return;

    const ctrl = new AbortController();
    setRouteLoading(true);
    fetchRoutes(from.center, to.center, { signal: ctrl.signal })
      .then((r) => {
        setRoutesState(r);
        if (mapRef.current && r[0]) fitRoute(mapRef.current, r[0], 1600);
      })
      .catch((e: Error) => { if (!ctrl.signal.aborted) setRouteError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setRouteLoading(false); });
    return () => ctrl.abort();
  }, [from, to, view, setMarker]);

  useEffect(() => {
    if (mapRef.current) setRoutes(mapRef.current, routes.map((r) => r.coords), selected);
  }, [routes, selected]);

  // Fetch the navigation code while the user is still picking a route.
  useEffect(() => {
    if (view === 'directions') void loadNavigation();
  }, [view]);

  function openDirections() {
    stopOrbit();
    if (mapRef.current) setSelectedBuilding(mapRef.current, null);
    setMarker('place', '', null);
    if (place) setTo({ label: place.title === 'Building' || place.kind === 'pin' ? `${place.title} (${place.center[1].toFixed(4)}, ${place.center[0].toFixed(4)})` : place.title, center: place.center });
    // Navigation starts from where you are, so fill that in straight away.
    if (!from) {
      if (myLocation.current) setFrom(myLocation.current);
      else useMyLocation('from', true);
    }
    setPlace(null);
    setView('directions');
    setSheetOpen(true);
  }

  function closeDirections() {
    setView('explore');
    setFrom(null);
    setTo(null);
  }

  // `auto`: filled in for the user, so stay quiet on failure and never overwrite their choice.
  function useMyLocation(field: 'from' | 'to', auto = false) {
    if (!navigator.geolocation) {
      if (!auto) setRouteError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me: Endpoint = { label: 'Your location', center: [pos.coords.longitude, pos.coords.latitude], mine: true };
        myLocation.current = me;
        if (field === 'to') setTo(me);
        else setFrom((current) => (auto && current ? current : me));
      },
      (err) => !auto && setRouteError(`Couldn't get your location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  // --- Turn-by-turn navigation ---

  function startNavigation(preview: boolean) {
    const route = routes[selected];
    if (!mapRef.current || !route || !to) return;
    unlockSpeech(); // must happen inside the tap, for iOS
    stopOrbit();
    // Drive the chosen route only; alternatives would just be clutter.
    setRoutesState([route]);
    setSelected(0);
    setNav({ preview });
  }

  const onRerouted = useCallback((route: Route) => {
    setRoutesState([route]);
    setSelected(0);
  }, []);

  // After navigation ends (and has cleaned up its camera), show the whole route again.
  const wasNavigating = useRef(false);
  useEffect(() => {
    if (nav) {
      wasNavigating.current = true;
      return;
    }
    if (!wasNavigating.current) return;
    wasNavigating.current = false;
    const route = routes[selected];
    if (mapRef.current && route) fitRoute(mapRef.current, route, 1400);
  }, [nav]);

  // --- Camera moves ---

  function goTo(p: Place) {
    stopOrbit();
    if (p.exaggeration && terrain) setExaggeration(p.exaggeration);
    mapRef.current?.flyTo({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, duration: 3500, essential: true });
    if (isPhone()) setSheetOpen(false);
  }

  function selectResult(r: SearchResult) {
    stopOrbit();
    mapRef.current?.flyTo({ center: r.center, zoom: 17, pitch: 60, duration: 2600, essential: true });
    showPlace({ kind: 'place', title: r.name, subtitle: r.detail, category: r.category, center: r.center });
  }

  // Fly in close, then circle the place slowly until the user touches the map.
  function orbit(center: LngLat) {
    const map = mapRef.current;
    if (!map) return;
    stopOrbit();
    if (isPhone()) setSheetOpen(false);
    map.flyTo({ center, zoom: Math.max(map.getZoom(), 17), pitch: 68, duration: 1800, essential: true });
    map.once('moveend', () => {
      let last = performance.now();
      const spin = (now: number) => {
        map.setBearing(map.getBearing() + ((now - last) / 1000) * 14);
        last = now;
        orbitRef.current = requestAnimationFrame(spin);
      };
      orbitRef.current = requestAnimationFrame(spin);
    });
  }

  const route = routes[selected];
  const mode = nav ? 'navigate' : view;

  return (
    <div className="app" data-mode={mode}>
      <div id="map" ref={containerRef} />
      <div className="halo" aria-hidden="true" />

      {!nav && (
        <>
          {view !== 'directions' && (
            <header className="topbar">
              <SearchBox
                className="main glass"
                value={place?.kind === 'place' ? place.title : ''}
                placeholder="Search Cambodia"
                near={near}
                onSelect={selectResult}
                onClear={closePlace}
                leading={<span className="brand-orb" aria-hidden="true" />}
                trailing={
                  <button className="icon-btn holo" aria-label="Directions" title="Directions" onClick={openDirections}>
                    <DirectionsIcon />
                  </button>
                }
              />
            </header>
          )}

          <aside className={`sheet glass ${sheetOpen ? '' : 'collapsed'}`}>
            <button className="sheet-handle" aria-label={sheetOpen ? 'Collapse panel' : 'Expand panel'} onClick={() => setSheetOpen((o) => !o)}>
              <span />
            </button>
            <div className="sheet-body">
              {view === 'explore' && <ExplorePanel onGo={goTo} onNavigate={openDirections} />}
              {view === 'place' && place && (
                <PlaceCard place={place} onClose={closePlace} onDirections={openDirections} onOrbit={() => orbit(place.center)} />
              )}
              {view === 'directions' && (
                <DirectionsPanel
                  from={from} to={to} routes={routes} selected={selected}
                  loading={routeLoading} error={routeError} near={near}
                  onFrom={setFrom} onTo={setTo}
                  onSwap={() => { setFrom(to); setTo(from); }}
                  onUseLocation={useMyLocation}
                  onSelectRoute={setSelected}
                  onStart={startNavigation}
                  onClose={closeDirections}
                />
              )}
            </div>
          </aside>

          <ControlDock
            theme={theme} bearing={bearing} is3D={is3D}
            buildings={buildings} terrain={terrain} exaggeration={exaggeration}
            onTheme={setTheme}
            onZoom={(d) => (d > 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())}
            onNorth={() => mapRef.current?.easeTo({ bearing: 0, duration: 600 })}
            on3D={() => {
              const map = mapRef.current;
              if (!map) return;
              const next = map.getPitch() > 10 ? 0 : 60;
              map.easeTo({ pitch: next, duration: 900 });
              setIs3D(next > 0);
            }}
            onLocate={() => geolocateRef.current?.trigger()}
            onBuildings={setBuildings}
            onTerrain={setTerrain}
            onExaggeration={setExaggeration}
          />
        </>
      )}

      {nav && mapRef.current && route && to && (
        <Navigation
          map={mapRef.current} route={route} destination={to} simulate={nav.preview}
          onRoute={onRerouted} onExit={() => setNav(null)}
        />
      )}

      {mapError && <div className="toast glass" role="alert">{mapError}</div>}
    </div>
  );
}
