import { PLACES } from './places.js';

const maplibregl = window.maplibregl;

// Free, keyless vector tiles (OpenStreetMap data, OpenMapTiles schema).
// The `building` layer carries render_height / render_min_height.
const STYLES = {
  day: 'https://tiles.openfreemap.org/styles/liberty',
  night: 'https://tiles.openfreemap.org/styles/dark',
};

// Free global elevation tiles (SRTM-based), Terrarium encoding.
const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];

const THEME = {
  day: {
    low: '#ece8e1', mid: '#d9d4ca', high: '#b7c3d8',
    sky: '#9fd3ff', horizon: '#ffffff', fog: '#f4f1ec', shadow: '#5b5f66',
  },
  night: {
    low: '#36447a', mid: '#4b5ea0', high: '#7c93e6',
    sky: '#070b24', horizon: '#1d2b63', fog: '#0a1030', shadow: '#000814',
  },
};

const state = { theme: 'day', exaggeration: 1.5, terrain: true, buildings: true };

const map = new maplibregl.Map({
  container: 'map',
  style: STYLES.day,
  center: [104.922, 11.565],
  zoom: 14.6,
  pitch: 62,
  bearing: -20,
  maxPitch: 85,
  hash: true,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(
  new maplibregl.GeolocateControl({ trackUserLocation: true, positionOptions: { enableHighAccuracy: true } }),
  'top-right'
);
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

function firstSymbolLayerId() {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
}

function decorate() {
  const t = THEME[state.theme];
  const beforeLabels = firstSymbolLayerId();

  // --- Terrain + hillshade ---
  if (!map.getSource('dem')) {
    map.addSource('dem', {
      type: 'raster-dem', tiles: DEM_TILES, encoding: 'terrarium', tileSize: 256, maxzoom: 15,
      attribution: 'Elevation © Mapzen / AWS Terrain Tiles',
    });
  }
  if (!map.getSource('dem-hs')) {
    map.addSource('dem-hs', { type: 'raster-dem', tiles: DEM_TILES, encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
  }
  if (!map.getLayer('hillshade')) {
    map.addLayer({
      id: 'hillshade', type: 'hillshade', source: 'dem-hs', maxzoom: 14,
      paint: {
        'hillshade-shadow-color': t.shadow,
        'hillshade-exaggeration': state.theme === 'night' ? 0.5 : 0.35,
      },
    }, beforeLabels);
  }

  // --- Hide the style's own building layers; we draw our own ---
  for (const l of map.getStyle().layers) {
    if (l['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
  }

  if (!map.getLayer('kh-buildings')) {
    map.addLayer({
      id: 'kh-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      layout: { visibility: state.buildings ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0],
          0, t.low, 25, t.mid, 120, t.high,
        ],
        'fill-extrusion-height': [
          'interpolate', ['linear'], ['zoom'],
          13, 0, 14, ['coalesce', ['get', 'render_height'], 6],
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.94,
        'fill-extrusion-vertical-gradient': true,
      },
    }, beforeLabels);
  }

  applyTerrain();

  map.setSky({
    'sky-color': t.sky,
    'horizon-color': t.horizon,
    'fog-color': t.fog,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.4,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0],
  });
}

function applyTerrain() {
  map.setTerrain(state.terrain ? { source: 'dem', exaggeration: state.exaggeration } : null);
}

map.on('style.load', decorate);

// --- Building info on tap ---
const info = document.getElementById('info');
map.on('click', 'kh-buildings', (e) => {
  const f = e.features?.[0];
  if (!f) return;
  const h = f.properties.render_height;
  const name = f.properties.name || f.properties['name:en'];
  info.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <strong>${name ? escapeHtml(name) : 'Building'}</strong>
    <span>Height ≈ ${h != null ? Math.round(h) + ' m' : 'unknown'}</span>
    <small>From OpenStreetMap. Buildings without a recorded height use a default estimate.</small>`;
  info.classList.remove('hidden');
  info.querySelector('.close').onclick = () => info.classList.add('hidden');
});
map.on('mouseenter', 'kh-buildings', () => (map.getCanvas().style.cursor = 'pointer'));
map.on('mouseleave', 'kh-buildings', () => (map.getCanvas().style.cursor = ''));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- UI ---
const placesEl = document.getElementById('places');
for (const p of PLACES) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = p.name;
  b.onclick = () => {
    if (p.exaggeration && state.terrain) setExaggeration(p.exaggeration);
    map.flyTo({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, duration: 3500, essential: true });
    if (window.matchMedia('(max-width: 720px)').matches) panel.classList.add('collapsed');
  };
  placesEl.appendChild(b);
}

document.querySelectorAll('[data-theme]').forEach((btn) => {
  btn.onclick = () => {
    if (state.theme === btn.dataset.theme) return;
    state.theme = btn.dataset.theme;
    document.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('active', b === btn));
    document.body.dataset.theme = state.theme;
    map.setStyle(STYLES[state.theme]); // decorate() re-runs on style.load
  };
});

document.getElementById('tg-buildings').onchange = (e) => {
  state.buildings = e.target.checked;
  if (map.getLayer('kh-buildings')) map.setLayoutProperty('kh-buildings', 'visibility', state.buildings ? 'visible' : 'none');
};
document.getElementById('tg-terrain').onchange = (e) => {
  state.terrain = e.target.checked;
  applyTerrain();
};

const exag = document.getElementById('exag');
const exagVal = document.getElementById('exag-val');
function setExaggeration(v) {
  state.exaggeration = Number(v);
  exag.value = v;
  exagVal.textContent = `${state.exaggeration}×`;
  applyTerrain();
}
exag.oninput = (e) => setExaggeration(e.target.value);

const panel = document.getElementById('panel');
document.getElementById('panel-toggle').onclick = () => panel.classList.toggle('collapsed');

window.map = map; // handy for debugging in the console
