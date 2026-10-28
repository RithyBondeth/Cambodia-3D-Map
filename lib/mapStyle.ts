import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { PALETTES, type Palette, type Theme } from './theme';

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

export async function loadStyle(theme: Theme): Promise<StyleSpecification> {
  const base = await fetchBaseStyle();
  return recolor(structuredClone(base), PALETTES[theme]);
}

// Fill colour for each fill layer, by layer id.
function fillColor(id: string, p: Palette): string | undefined {
  if (id === 'water') return p.water;
  if (id === 'park' || id.startsWith('landcover_wood') || id === 'landcover_grass' || id === 'landcover_wetland' || id === 'landuse_pitch' || id === 'landuse_track' || id === 'landuse_cemetery') return p.green;
  if (id === 'landuse_residential') return p.residential;
  if (id === 'landcover_sand') return p.sand;
  if (id === 'landuse_hospital' || id === 'landuse_school' || id === 'aeroway_fill') return p.civic;
  if (id === 'road_area_pattern') return p.road;
  return undefined;
}

function roadColor(id: string, p: Palette): string | undefined {
  if (!/^(road|tunnel|bridge)_/.test(id)) return undefined;
  if (id.includes('rail')) return p.rail;
  const major = /motorway|trunk|primary|secondary|tertiary|link/.test(id);
  if (id.includes('casing')) return major ? p.casingMajor : p.casing;
  if (id.includes('motorway')) return p.roadMotorway;
  if (id.includes('path_pedestrian')) return undefined;
  return major ? p.roadMajor : p.road;
}

function recolor(style: StyleSpecification, p: Palette): StyleSpecification {
  const layers: LayerSpecification[] = [];

  for (const layer of style.layers) {
    // We draw our own 3D buildings (see mapLayers.ts).
    if ('source-layer' in layer && layer['source-layer'] === 'building') continue;

    const paint = (layer.paint ?? {}) as Record<string, unknown>;
    const id = layer.id;

    switch (layer.type) {
      case 'background':
        paint['background-color'] = p.ground;
        break;
      case 'fill': {
        const c = fillColor(id, p);
        if (c) {
          paint['fill-color'] = c;
          // Liberty textures some areas (wetland, pedestrian plazas) with sprite images.
          delete paint['fill-pattern'];
          delete paint['fill-outline-color'];
          if (id === 'park') paint['fill-opacity'] = 0.85;
        }
        break;
      }
      case 'line': {
        if (id.startsWith('waterway')) paint['line-color'] = p.waterDeep;
        else if (id.startsWith('boundary')) paint['line-color'] = p.boundary;
        else if (id === 'park_outline') paint['line-opacity'] = 0;
        else if (id.startsWith('aeroway')) paint['line-color'] = p.road;
        else {
          const c = roadColor(id, p);
          if (c) paint['line-color'] = c;
        }
        break;
      }
      case 'symbol': {
        let text = p.label;
        if (id.startsWith('label_city') || id.startsWith('label_country') || id === 'label_town') text = p.labelStrong;
        else if (id.startsWith('water') ) text = p.labelWater;
        else if (id.startsWith('poi') || id === 'airport') text = p.labelPoi;
        paint['text-color'] = text;
        paint['text-halo-color'] = p.halo;
        paint['text-halo-width'] = 1.4;
        paint['text-halo-blur'] = 0.4;
        break;
      }
      case 'raster':
        // Natural Earth shaded relief: our hillshade replaces it.
        paint['raster-opacity'] = 0;
        break;
    }

    layers.push({ ...layer, paint } as LayerSpecification);
  }

  return { ...style, layers };
}
