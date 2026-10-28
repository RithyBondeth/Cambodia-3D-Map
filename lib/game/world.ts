import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Position } from 'geojson';
import { distance, type LngLat } from '../geo';
import { LANDMARKS, LANDMARK_CLEARINGS } from '../landmarks';

type Poly = { bbox: [number, number, number, number]; rings: Position[][] };
type Road = { name: string; coords: Position[] };

const RADIUS = 400;     // metres of world kept around the car
const REFRESH_MOVE = 150;
const REFRESH_MS = 2500;

function bboxOf(rings: Position[][]): Poly['bbox'] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of rings[0]) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function inRing([x, y]: LngLat, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Distance in metres from p to segment ab (equirectangular, fine at street scale).
function segmentDistance(p: LngLat, a: Position, b: Position) {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1];
  const bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + dx * t, ay + dy * t) * 111320;
}

// What the car can bump into and which street it's on, built from the vector
// tiles MapLibre has already loaded around the car.
export class World {
  private polys: Poly[] = [];
  private roads: Road[] = [];
  private center: LngLat | null = null;
  private builtAt = 0;

  constructor(private map: MapLibreMap) {}

  refresh(around: LngLat, force = false) {
    const now = performance.now();
    if (!force && this.center && distance(this.center, around) < REFRESH_MOVE && now - this.builtAt < REFRESH_MS) return;
    this.center = around;
    this.builtAt = now;

    const near = (bbox: Poly['bbox']) =>
      distance(around, [Math.max(bbox[0], Math.min(around[0], bbox[2])), Math.max(bbox[1], Math.min(around[1], bbox[3]))]) < RADIUS;

    const polys: Poly[] = [];
    for (const f of this.map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' })) {
      // Overhangs and bridges you can drive under.
      if (Number(f.properties.render_min_height ?? 0) > 3) continue;
      const g = f.geometry;
      const shapes = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const rings of shapes) {
        const bbox = bboxOf(rings);
        if (!near(bbox)) continue;
        // Hidden under the hand-modelled landmarks (see mapLayers.ts).
        const cx = (bbox[0] + bbox[2]) / 2, cy = (bbox[1] + bbox[3]) / 2;
        if (LANDMARK_CLEARINGS.some((c) => distance(c.center, [cx, cy]) < c.radius)) continue;
        polys.push({ bbox, rings });
      }
    }
    for (const f of LANDMARKS.features) {
      if (f.properties.base > 0) continue;
      const bbox = bboxOf(f.geometry.coordinates);
      if (near(bbox)) polys.push({ bbox, rings: f.geometry.coordinates });
    }
    this.polys = polys;

    const roads: Road[] = [];
    for (const f of this.map.querySourceFeatures('openmaptiles', { sourceLayer: 'transportation_name' })) {
      const p = f.properties;
      const name = (p['name:en'] ?? p.name_en ?? p['name:latin'] ?? p.name ?? p.ref) as string | undefined;
      if (!name) continue;
      const g = f.geometry;
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const coords of lines) roads.push({ name, coords });
    }
    this.roads = roads;
  }

  blocked = (p: LngLat): boolean => {
    for (const { bbox, rings } of this.polys) {
      if (p[0] < bbox[0] || p[0] > bbox[2] || p[1] < bbox[1] || p[1] > bbox[3]) continue;
      if (inRing(p, rings[0]) && !rings.slice(1).some((hole) => inRing(p, hole))) return true;
    }
    return false;
  };

  streetAt(p: LngLat, maxDistance = 22): string {
    let best = '';
    let bestD = maxDistance;
    for (const { name, coords } of this.roads) {
      for (let i = 1; i < coords.length; i++) {
        const d = segmentDistance(p, coords[i - 1], coords[i]);
        if (d < bestD) { bestD = d; best = name; }
      }
    }
    return best;
  }

  // Nearest point on a named road within `maxDistance` metres, facing along the road.
  snapToRoad(p: LngLat, maxDistance = 250): { pos: LngLat; heading: number } | null {
    const k = Math.cos((p[1] * Math.PI) / 180);
    let best: { pos: LngLat; heading: number } | null = null;
    let bestD = maxDistance;
    for (const { coords } of this.roads) {
      for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1], b = coords[i];
        const ax = (a[0] - p[0]) * k, ay = a[1] - p[1];
        const dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
        const len = dx * dx + dy * dy;
        if (!len) continue;
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
        const d = Math.hypot(ax + dx * t, ay + dy * t) * 111320;
        if (d < bestD) {
          bestD = d;
          best = {
            pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
            heading: (Math.atan2(dx, dy) * 180) / Math.PI,
          };
        }
      }
    }
    return best;
  }

  // Nearest point around `p` that isn't inside a building (spiral search).
  freeSpot(p: LngLat, isFree: (q: LngLat) => boolean): LngLat {
    if (isFree(p)) return p;
    const k = 1 / (111320 * Math.cos((p[1] * Math.PI) / 180));
    for (let r = 4; r <= 80; r += 4) {
      for (let a = 0; a < 360; a += 20) {
        const q: LngLat = [p[0] + Math.sin((a * Math.PI) / 180) * r * k, p[1] + (Math.cos((a * Math.PI) / 180) * r) / 111320];
        if (isFree(q)) return q;
      }
    }
    return p;
  }
}
