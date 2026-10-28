import type { Map as MapLibreMap } from 'maplibre-gl';

export type Theme = 'day' | 'night';

export type MapState = {
  theme: Theme;
  exaggeration: number;
  terrain: boolean;
  buildings: boolean;
};

// Free, keyless vector tiles (OpenStreetMap data, OpenMapTiles schema).
// The `building` layer carries render_height / render_min_height.
export const STYLES: Record<Theme, string> = {
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

export const BUILDINGS_LAYER = 'kh-buildings';

function firstSymbolLayerId(map: MapLibreMap) {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
}

// Adds terrain, hillshade, 3D buildings and sky. Runs on every style.load,
// because switching style wipes everything we added.
export function decorate(map: MapLibreMap, state: MapState) {
  const t = THEME[state.theme];
  const beforeLabels = firstSymbolLayerId(map);

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
    if ('source-layer' in l && l['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
  }

  if (!map.getLayer(BUILDINGS_LAYER)) {
    map.addLayer({
      id: BUILDINGS_LAYER,
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

  applyTerrain(map, state);

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

export function applyTerrain(map: MapLibreMap, state: MapState) {
  map.setTerrain(state.terrain ? { source: 'dem', exaggeration: state.exaggeration } : null);
}

export function setBuildingsVisible(map: MapLibreMap, visible: boolean) {
  if (map.getLayer(BUILDINGS_LAYER)) map.setLayoutProperty(BUILDINGS_LAYER, 'visibility', visible ? 'visible' : 'none');
}
