'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { PLACES, type Place } from '@/lib/places';
import {
  STYLES, BUILDINGS_LAYER, applyTerrain, decorate, setBuildingsVisible,
  type MapState, type Theme,
} from '@/lib/mapLayers';

// Served from public/ by scripts/copy-maplibre-worker.mjs; ?v busts the cache on upgrades.
maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);

type BuildingInfo = { name?: string; height?: number };

export default function MapApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [theme, setTheme] = useState<Theme>('day');
  const [exaggeration, setExaggeration] = useState(1.5);
  const [terrain, setTerrain] = useState(true);
  const [buildings, setBuildings] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [info, setInfo] = useState<BuildingInfo | null>(null);

  // decorate() runs from a map event, so it reads the latest state through a ref.
  const stateRef = useRef<MapState>({ theme, exaggeration, terrain, buildings });
  stateRef.current = { theme, exaggeration, terrain, buildings };

  // --- Map setup (once) ---
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: STYLES[stateRef.current.theme],
      center: [104.922, 11.565],
      zoom: 14.6,
      pitch: 62,
      bearing: -20,
      maxPitch: 85,
      hash: true,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({ trackUserLocation: true, positionOptions: { enableHighAccuracy: true } }),
      'top-right'
    );
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('style.load', () => decorate(map, stateRef.current));

    // --- Building info on tap ---
    map.on('click', BUILDINGS_LAYER, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      setInfo({ name: f.properties.name || f.properties['name:en'], height: f.properties.render_height });
    });
    map.on('mouseenter', BUILDINGS_LAYER, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', BUILDINGS_LAYER, () => (map.getCanvas().style.cursor = ''));

    (window as unknown as { map: maplibregl.Map }).map = map; // handy for debugging in the console

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Theme: swap the style; decorate() re-runs on style.load ---
  const loadedTheme = useRef<Theme>(theme);
  useEffect(() => {
    document.body.dataset.theme = theme;
    if (loadedTheme.current === theme) return;
    loadedTheme.current = theme;
    mapRef.current?.setStyle(STYLES[theme]);
  }, [theme]);

  useEffect(() => {
    if (mapRef.current) setBuildingsVisible(mapRef.current, buildings);
  }, [buildings]);

  useEffect(() => {
    const map = mapRef.current;
    // Before style.load the DEM source doesn't exist yet; decorate() applies terrain then.
    if (map?.getSource('dem')) applyTerrain(map, stateRef.current);
  }, [terrain, exaggeration]);

  function goTo(p: Place) {
    if (p.exaggeration && terrain) setExaggeration(p.exaggeration);
    mapRef.current?.flyTo({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, duration: 3500, essential: true });
    if (window.matchMedia('(max-width: 720px)').matches) setCollapsed(true);
  }

  return (
    <>
      <div id="map" ref={containerRef} />

      <aside className={`panel${collapsed ? ' collapsed' : ''}`}>
        <button className="panel-handle" aria-label="Toggle panel" onClick={() => setCollapsed((c) => !c)}>
          <span />
        </button>
        <header>
          <h1>Cambodia 3D</h1>
          <p className="sub">Terrain + 3D buildings · v0.1</p>
        </header>

        <section>
          <h2>Go to</h2>
          <div className="chips">
            {PLACES.map((p) => (
              <button key={p.id} className="chip" onClick={() => goTo(p)}>{p.name}</button>
            ))}
          </div>
        </section>

        <section>
          <h2>Style</h2>
          <div className="seg" role="group">
            {(['day', 'night'] as const).map((t) => (
              <button key={t} className={theme === t ? 'active' : ''} onClick={() => setTheme(t)}>
                {t === 'day' ? 'Day' : 'Night'}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Layers</h2>
          <label className="row">
            <input type="checkbox" checked={buildings} onChange={(e) => setBuildings(e.target.checked)} /> 3D buildings
          </label>
          <label className="row">
            <input type="checkbox" checked={terrain} onChange={(e) => setTerrain(e.target.checked)} /> Terrain
          </label>
          <label className="row col">
            <span>Terrain height <b>{exaggeration}×</b></span>
            <input
              type="range" min={1} max={10} step={0.5} value={exaggeration}
              onChange={(e) => setExaggeration(Number(e.target.value))}
            />
          </label>
        </section>
      </aside>

      {info && (
        <div className="info">
          <button className="close" aria-label="Close" onClick={() => setInfo(null)}>×</button>
          <strong>{info.name ?? 'Building'}</strong>
          <span>Height ≈ {info.height != null ? `${Math.round(info.height)} m` : 'unknown'}</span>
          <small>From OpenStreetMap. Buildings without a recorded height use a default estimate.</small>
        </div>
      )}
    </>
  );
}
