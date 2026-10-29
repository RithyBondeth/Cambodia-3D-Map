import type { Map as MapLibreMap, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, LineString } from 'geojson';
import { PALETTES, type Theme } from './theme';
import { LANDMARKS, LANDMARK_CLEARINGS } from './landmarks';
import { bearing, type LngLat } from './geo';

export type MapState = {
  theme: Theme;
  exaggeration: number;
  terrain: boolean;
  buildings: boolean;
};

// Free global elevation tiles (SRTM-based), Terrarium encoding.
const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];

export const BUILDINGS_LAYER = 'kh-buildings';
export const ROUTE_ALT_LAYER = 'route-alt';
export const POI_LAYERS = ['poi_r20', 'poi_r7', 'poi_r1', 'poi_transit'];

const BUILDING_LAYERS = [BUILDINGS_LAYER, 'kh-roofs', 'kh-landmarks'];

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

// GeoJSON we own. Kept here so it survives style swaps (setStyle wipes sources).
const data: Record<string, FeatureCollection> = {
  route: EMPTY,
  'route-traveled': EMPTY,
  'nav-arrow': EMPTY,
  'nav-arrow-head': EMPTY,
  selected: EMPTY,
};

// Keep OSM buildings out of the hand-modelled landmarks' footprints.
const outsideLandmarks: ExpressionSpecification = ['all', ...LANDMARK_CLEARINGS.map(
  ({ center, radius }): ExpressionSpecification => ['>', ['distance', { type: 'Point', coordinates: center }], radius],
)];

const height: ExpressionSpecification = ['coalesce', ['get', 'render_height'], 6];
const minHeight: ExpressionSpecification = ['coalesce', ['get', 'render_min_height'], 0];
// Buildings rise out of the ground between zoom 13 and 14.5.
const grow = (h: ExpressionSpecification | number): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, h];

function firstSymbolLayerId(map: MapLibreMap) {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
}

function addGeoJSON(map: MapLibreMap, id: string, lineMetrics = false) {
  if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: data[id], lineMetrics });
}

const ARROW_HEAD = 'nav-arrowhead';
const ARROW_INK = '#2a1f6b';

// The head of the turn arrow: a white triangle pointing up, drawn once per style.
function addArrowHead(map: MapLibreMap) {
  if (map.hasImage(ARROW_HEAD)) return;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.moveTo(32, 5);
  g.lineTo(60, 61);
  g.lineTo(4, 61);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 6;
  g.strokeStyle = ARROW_INK;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.fill();
  map.addImage(ARROW_HEAD, g.getImageData(0, 0, size, size), { pixelRatio: 2 });
}

// Route line width per zoom. Past z18 it keeps growing so it still fills the
// road at street level, where roads are drawn at their real width.
const ROUTE_WIDTH: ExpressionSpecification = ['interpolate', ['exponential', 1.6], ['zoom'], 10, 5, 18, 14, 22, 180];

// Arrow width per zoom; the head scales with it.
const arrowWidth = (extra: number): ExpressionSpecification =>
  ['interpolate', ['exponential', 1.6], ['zoom'], 15, 3 + extra, 18, 11 + extra, 22, 130 + extra];

// Adds terrain, hillshade, 3D buildings, landmarks, route layers, light and sky.
// Runs on every style.load, because switching style wipes everything we added.
export function decorate(map: MapLibreMap, state: MapState) {
  const p = PALETTES[state.theme];
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
  map.addLayer({
    id: 'hillshade', type: 'hillshade', source: 'dem-hs', maxzoom: 14,
    paint: {
      'hillshade-shadow-color': p.hillshade,
      'hillshade-highlight-color': state.theme === 'day' ? '#ffffff' : '#3a3470',
      'hillshade-exaggeration': 0.3,
    },
  }, beforeLabels);

  // --- Route (drawn on the ground, under buildings and labels) ---
  addGeoJSON(map, 'route', true);
  addGeoJSON(map, 'route-traveled');
  map.addLayer({
    id: ROUTE_ALT_LAYER, type: 'line', source: 'route', filter: ['!=', ['get', 'selected'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': state.theme === 'day' ? '#b9b0de' : '#5c5499', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 4, 18, 12, 22, 150], 'line-opacity': 0.85 },
  }, beforeLabels);
  map.addLayer({
    id: 'route-glow', type: 'line', source: 'route', filter: ['==', ['get', 'selected'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#9b7bff', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 12, 18, 34, 22, 300], 'line-blur': 10, 'line-opacity': 0.45 },
  }, beforeLabels);
  map.addLayer({
    id: 'route-core', type: 'line', source: 'route', filter: ['==', ['get', 'selected'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': ROUTE_WIDTH,
      // Holographic gradient along the route: cyan → violet → pink.
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#3ee0f5', 0.5, '#8b6cff', 1, '#ff6fd8'],
    },
  }, beforeLabels);
  map.addLayer({
    id: 'route-traveled', type: 'line', source: 'route-traveled',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': state.theme === 'day' ? '#d4cfe8' : '#3b3668', 'line-width': ROUTE_WIDTH },
  }, beforeLabels);

  // --- Turn arrow painted on the road at the next manoeuvre (while navigating) ---
  addGeoJSON(map, 'nav-arrow');
  addGeoJSON(map, 'nav-arrow-head');
  addArrowHead(map);
  map.addLayer({
    id: 'nav-arrow-casing', type: 'line', source: 'nav-arrow', minzoom: 14,
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': ARROW_INK, 'line-width': arrowWidth(4) },
  }, beforeLabels);
  map.addLayer({
    id: 'nav-arrow', type: 'line', source: 'nav-arrow', minzoom: 14,
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': arrowWidth(0) },
  }, beforeLabels);
  map.addLayer({
    id: 'nav-arrow-head', type: 'symbol', source: 'nav-arrow-head', minzoom: 14,
    layout: {
      'icon-image': ARROW_HEAD,
      'icon-anchor': 'bottom',
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      // 32 px wide at size 1: about 2.4× the arrow's line width.
      'icon-size': ['interpolate', ['exponential', 1.6], ['zoom'], 15, 0.3, 18, 0.95, 22, 9.9],
    },
  }, beforeLabels);

  // --- 3D buildings: real OSM footprints, holographic height gradient, bright roof caps ---
  const visibility = state.buildings ? 'visible' : 'none';
  map.addLayer({
    id: BUILDINGS_LAYER,
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 13,
    filter: outsideLandmarks,
    layout: { visibility },
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], height, 0, p.building[0], 18, p.building[1], 60, p.building[2], 150, p.building[3]],
      'fill-extrusion-height': grow(height),
      'fill-extrusion-base': grow(minHeight),
      'fill-extrusion-opacity': state.theme === 'day' ? 0.96 : 0.92,
      'fill-extrusion-vertical-gradient': true,
    },
  }, beforeLabels);
  // A thin slab on top of each building catches the light like a glass roof edge.
  map.addLayer({
    id: 'kh-roofs',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 15,
    filter: outsideLandmarks,
    layout: { visibility },
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], height, 10, p.roof, 80, p.roofTall],
      'fill-extrusion-base': height,
      'fill-extrusion-height': ['+', height, ['interpolate', ['linear'], height, 0, 0.4, 100, 1.5]],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 1],
    },
  }, beforeLabels);

  if (!map.getSource('landmarks')) map.addSource('landmarks', { type: 'geojson', data: LANDMARKS });
  map.addLayer({
    id: 'kh-landmarks',
    type: 'fill-extrusion',
    source: 'landmarks',
    minzoom: 13,
    layout: { visibility },
    paint: {
      'fill-extrusion-color': ['match', ['get', 'tone'], 1, p.landmark[1], p.landmark[0]],
      'fill-extrusion-height': grow(['get', 'height']),
      'fill-extrusion-base': grow(['get', 'base']),
      'fill-extrusion-vertical-gradient': true,
    },
  }, beforeLabels);

  addGeoJSON(map, 'selected');
  map.addLayer({
    id: 'kh-selected',
    type: 'fill-extrusion',
    source: 'selected',
    paint: {
      'fill-extrusion-color': p.selected,
      'fill-extrusion-height': ['+', ['coalesce', ['get', 'render_height'], 6], 0.6],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.75,
    },
  }, beforeLabels);

  applyTerrain(map, state);

  map.setLight({ anchor: 'map', position: [1.4, 215, 40], color: p.light, intensity: state.theme === 'day' ? 0.32 : 0.45 });
  map.setSky({
    'sky-color': p.sky,
    'horizon-color': p.horizon,
    'fog-color': p.fog,
    'sky-horizon-blend': 0.7,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.35,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0],
  });
}

export function applyTerrain(map: MapLibreMap, state: MapState) {
  map.setTerrain(state.terrain ? { source: 'dem', exaggeration: state.exaggeration } : null);
}

export function setBuildingsVisible(map: MapLibreMap, visible: boolean) {
  for (const id of BUILDING_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}

function setData(map: MapLibreMap, id: string, fc: FeatureCollection) {
  data[id] = fc;
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
}

// Routes: the selected one is drawn last so it sits on top of alternatives.
export function setRoutes(map: MapLibreMap, routes: LngLat[][], selected: number) {
  const features: Feature<LineString>[] = routes
    .map((coords, i) => ({ i, coords }))
    .sort((a, b) => Number(a.i === selected) - Number(b.i === selected))
    .map(({ i, coords }) => ({
      type: 'Feature',
      properties: { index: i, selected: i === selected },
      geometry: { type: 'LineString', coordinates: coords },
    }));
  setData(map, 'route', { type: 'FeatureCollection', features });
}

export function setTraveled(map: MapLibreMap, coords: LngLat[]) {
  setData(map, 'route-traveled', coords.length > 1
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] }
    : EMPTY);
}

// The turn arrow: a stretch of road through the manoeuvre, ending in a head.
export function setManeuverArrow(map: MapLibreMap, coords: LngLat[]) {
  if (coords.length < 2) {
    setData(map, 'nav-arrow', EMPTY);
    setData(map, 'nav-arrow-head', EMPTY);
    return;
  }
  const tip = coords[coords.length - 1];
  // Aim the head along the last few metres, skipping any near-duplicate end point.
  const before = [...coords].reverse().find((c) => Math.abs(c[0] - tip[0]) + Math.abs(c[1] - tip[1]) > 2e-5) ?? coords[0];
  setData(map, 'nav-arrow', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] });
  setData(map, 'nav-arrow-head', {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { bearing: bearing(before, tip) }, geometry: { type: 'Point', coordinates: tip } }],
  });
}

export function setSelectedBuilding(map: MapLibreMap, feature: { geometry: Geometry; properties: Record<string, unknown> } | null) {
  setData(map, 'selected', feature
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: feature.properties, geometry: feature.geometry }] }
    : EMPTY);
}
