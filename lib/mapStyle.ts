import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { PALETTES, type Basemap, type Palette, type Theme } from './theme';

// OpenFreeMap "Liberty": free, keyless OpenStreetMap tiles in the OpenMapTiles
// schema, with POI icons, house numbers and road labels. We recolour it.
const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

let baseStyle: Promise<StyleSpecification> | null = null;

function fetchBaseStyle() {
  baseStyle ??= fetch(BASE_STYLE_URL).then((r) => {
    if (!r.ok) throw new Error(`Map style failed to load (${r.status})`);
    return r.json();
  });
  return baseStyle;
}

export async function loadStyle(theme: Theme, basemap: Basemap): Promise<StyleSpecification> {
  const base = await fetchBaseStyle();
  return recolor(structuredClone(base), PALETTES[theme], theme, basemap);
}

// Esri World Imagery: sharp aerial photos of Phnom Penh and other towns, keyless.
// Free to use with attribution; production use needs an ArcGIS developer account.
const SATELLITE_TILES = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];

// Fill colour for each fill layer, by layer id.
function fillColor(id: string, p: Palette): string | undefined {
  if (id === 'water') return p.water;
  if (id === 'park') return p.park;
  if (id === 'landcover_wood') return p.wood;
  if (id === 'landcover_grass' || id === 'landuse_pitch' || id === 'landuse_track' || id === 'landuse_cemetery') return p.grass;
  if (id === 'landcover_wetland') return p.wetland;
  if (id === 'landuse_residential') return p.residential;
  if (id === 'landcover_sand') return p.sand;
  if (id === 'landuse_hospital') return p.hospital;
  if (id === 'landuse_school' || id === 'aeroway_fill') return p.civic;
  if (id === 'road_area_pattern') return p.road;
  return undefined;
}

// Land use Liberty leaves uncoloured but a real map shows: rice fields, shopping
// and business districts, factories, campuses, stadiums.
function extraLandLayers(p: Palette): LayerSpecification[] {
  const fill = (id: string, sourceLayer: string, classes: string[], color: string, minzoom = 0): LayerSpecification => ({
    id, type: 'fill', source: 'openmaptiles', 'source-layer': sourceLayer, minzoom,
    filter: ['match', ['get', 'class'], classes, true, false],
    paint: { 'fill-color': color, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], minzoom, 0.6, minzoom + 3, 1] },
  });
  return [
    fill('kh-farmland', 'landcover', ['farmland'], p.farmland),
    fill('kh-commercial', 'landuse', ['commercial', 'retail'], p.commercial, 11),
    fill('kh-industrial', 'landuse', ['industrial', 'railway', 'garages', 'military', 'quarry'], p.industrial, 11),
    fill('kh-campus', 'landuse', ['university', 'college', 'library', 'kindergarten'], p.civic, 11),
    fill('kh-leisure', 'landuse', ['stadium', 'playground', 'theme_park', 'zoo'], p.grass, 12),
  ];
}

const isRoad = (id: string) => /^(road|tunnel|bridge)_/.test(id);

function roadColor(id: string, p: Palette): string | undefined {
  if (!isRoad(id)) return undefined;
  if (id.includes('rail')) return p.rail;
  const casing = id.includes('casing');
  if (id.includes('motorway')) return casing ? p.motorwayCasing : p.motorway;
  if (id.includes('trunk_primary')) return casing ? p.trunkCasing : p.trunk;
  if (id.includes('secondary_tertiary') || id.includes('link')) return casing ? p.secondaryCasing : p.secondary;
  if (id.includes('path_pedestrian')) return casing ? p.roadCasing : p.path;
  return casing ? p.roadCasing : p.road;
}

// A dashed centre line down main roads once you're close enough to see lanes.
function centerlines(p: Palette): LayerSpecification {
  return {
    id: 'kh-centerline', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 16,
    filter: ['all', ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false], ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'ramp'], 1]],
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': p.centerline,
      'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 16, 0.7, 18, 1.4, 20, 3.2, 22, 9],
      'line-dasharray': [4, 4],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 16, 0, 16.8, 0.9],
    },
  };
}

// Liberty draws streets far thinner than they are (a minor road is ~1.3 m wide at
// zoom 20), which looks wrong next to the 3D car. Past zoom 20, widen
// each road class towards its real width in metres.
const METRES_PER_PX_Z22 = 0.0183; // at Cambodia's latitude, 512 px tiles

function roadMetres(id: string): number | undefined {
  if (id.includes('rail')) return undefined;
  const base =
    id.includes('motorway') ? 16 :
    id.includes('trunk_primary') ? 14 :
    id.includes('secondary_tertiary') ? 11 :
    id.includes('service_track') ? 5 :
    id.includes('path_pedestrian') ? 3 :
    8; // minor, street, link
  return id.includes('casing') ? base + 1.6 : base;
}

function extendRoadWidth(id: string, paint: Record<string, unknown>) {
  const metres = roadMetres(id);
  const w = paint['line-width'];
  if (!metres || !Array.isArray(w) || w[0] !== 'interpolate' || !Array.isArray(w[2]) || w[2][0] !== 'zoom') return;
  const lastZoom = w[w.length - 2];
  if (typeof lastZoom !== 'number' || lastZoom >= 22) return;
  paint['line-width'] = [...w, 22, metres / METRES_PER_PX_Z22];
}

function recolor(style: StyleSpecification, p: Palette, theme: Theme, basemap: Basemap): StyleSpecification {
  const satellite = basemap === 'satellite';
  const layers: LayerSpecification[] = [];

  if (satellite) {
    style.sources.satellite = {
      type: 'raster', tiles: SATELLITE_TILES, tileSize: 256, maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    };
  }

  for (const layer of style.layers) {
    // We draw our own 3D buildings (see mapLayers.ts).
    if ('source-layer' in layer && layer['source-layer'] === 'building') continue;

    const paint = (layer.paint ?? {}) as Record<string, unknown>;
    const layout = (layer.layout ?? {}) as Record<string, unknown>;
    const id = layer.id;

    switch (layer.type) {
      case 'background':
        paint['background-color'] = p.ground;
        break;
      case 'fill': {
        // Over aerial photos, painted land and water would just hide them.
        if (satellite) layout.visibility = 'none';
        const c = fillColor(id, p);
        if (c) {
          paint['fill-color'] = c;
          // Liberty textures some areas (wetland, pedestrian plazas) with sprite images.
          delete paint['fill-pattern'];
          delete paint['fill-outline-color'];
          if (id === 'park') paint['fill-opacity'] = 0.95;
        }
        break;
      }
      case 'line': {
        if (id.startsWith('waterway')) {
          paint['line-color'] = p.waterDeep;
          if (satellite) layout.visibility = 'none';
        } else if (id.startsWith('boundary')) paint['line-color'] = p.boundary;
        else if (id === 'park_outline') paint['line-opacity'] = 0;
        else if (id.startsWith('aeroway')) paint['line-color'] = p.road;
        else {
          const c = roadColor(id, p);
          if (c) paint['line-color'] = c;
          if (isRoad(id)) {
            extendRoadWidth(id, paint);
            // Satellite: roads as a light overlay on the photo, like a hybrid map.
            if (satellite) {
              if (id.includes('casing')) layout.visibility = 'none';
              else paint['line-opacity'] = /motorway|trunk_primary/.test(id) ? 0.7 : /secondary|link/.test(id) ? 0.5 : 0.28;
            }
          }
        }
        break;
      }
      case 'symbol': {
        let text = p.label;
        if (id.startsWith('label_city') || id.startsWith('label_country') || id === 'label_town') text = p.labelStrong;
        else if (id.startsWith('water') ) text = p.labelWater;
        else if (id.startsWith('poi') || id === 'airport') text = p.labelPoi;
        paint['text-color'] = satellite ? '#ffffff' : text;
        paint['text-halo-color'] = satellite ? 'rgba(0,0,0,0.75)' : p.halo;
        paint['text-halo-width'] = 1.4;
        paint['text-halo-blur'] = 0.4;
        break;
      }
      case 'raster':
        // Natural Earth shaded relief: our hillshade replaces it.
        paint['raster-opacity'] = 0;
        break;
    }

    layers.push({ ...layer, paint, layout } as LayerSpecification);

    if (id === 'background' && satellite) {
      layers.push({
        id: 'satellite', type: 'raster', source: 'satellite',
        paint: theme === 'dusk'
          ? { 'raster-brightness-max': 0.5, 'raster-saturation': -0.2, 'raster-contrast': 0.1 }
          : { 'raster-saturation': 0.12, 'raster-contrast': 0.06 },
      });
    }
    if (id === 'landuse_residential' && !satellite) layers.push(...extraLandLayers(p));
    if (id === 'road_motorway') layers.push(centerlines(p));
  }

  return { ...style, layers };
}
