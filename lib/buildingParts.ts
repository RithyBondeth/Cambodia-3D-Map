import { VectorTile, classifyRings } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { Map as MapLibreMap, VectorTileSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import { distance, type LngLat } from './geo';

// OpenFreeMap merges every building of the same height in a tile into one
// feature, and most Cambodian buildings have no height, so up to hundreds of
// buildings arrive as one shape that can only be styled as a whole. This reads
// the same tiles itself and splits them into one feature per building, each
// with a stable random `v`, so neighbouring buildings can look different.

const Z = 14;            // the tiles' native zoom; deeper zooms are scaled-up copies
const RADIUS = 2600;     // metres of city around the view to keep split
const KEEP = 24;         // tiles held in memory

export type BuildingProps = { render_height: number; render_min_height: number; v: number };
type Part = Feature<Polygon, BuildingProps>;

const tileX = (lng: number) => Math.floor(((lng + 180) / 360) * 2 ** Z);
const tileY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z);
};
const lngOf = (x: number) => (x / 2 ** Z) * 360 - 180;
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;

// Cut a ring to the tile square (tile coordinates), so a building that also sits
// in the next tile's buffer isn't drawn twice.
function clip(ring: { x: number; y: number }[], extent: number) {
  let pts = ring.map((p) => [p.x, p.y]);
  const edges: [(p: number[]) => boolean, (a: number[], b: number[]) => number[]][] = [
    [(p) => p[0] >= 0, (a, b) => [0, a[1] + ((b[1] - a[1]) * (0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= extent, (a, b) => [extent, a[1] + ((b[1] - a[1]) * (extent - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= 0, (a, b) => [a[0] + ((b[0] - a[0]) * (0 - a[1])) / (b[1] - a[1]), 0]],
    [(p) => p[1] <= extent, (a, b) => [a[0] + ((b[0] - a[0]) * (extent - a[1])) / (b[1] - a[1]), extent]],
  ];
  for (const [inside, cross] of edges) {
    const out: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (inside(a)) {
        out.push(a);
        if (!inside(b)) out.push(cross(a, b));
      } else if (inside(b)) out.push(cross(a, b));
    }
    pts = out;
    if (pts.length < 3) return null;
  }
  return pts;
}

// 0–999 from a position: the same building always gets the same number.
function hash(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return Math.floor((s - Math.floor(s)) * 1000);
}

function decode(buf: ArrayBuffer, x: number, y: number): Part[] {
  const layer = new VectorTile(new PbfReader(new Uint8Array(buf))).layers.building;
  if (!layer) return [];
  const extent = layer.extent;
  const toLngLat = ([px, py]: number[]): Position => [lngOf(x + px / extent), latOf(y + py / extent)];
  const parts: Part[] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    const props = {
      render_height: Number(f.properties.render_height ?? 6),
      render_min_height: Number(f.properties.render_min_height ?? 0),
    };
    for (const polygon of classifyRings(f.loadGeometry())) {
      const outer = clip(polygon[0], extent);
      if (!outer) continue; // in the buffer only: the neighbouring tile draws it
      const holes = polygon.slice(1).map((r) => clip(r, extent)).filter((r): r is number[][] => r !== null);
      const rings = [outer, ...holes];
      const coords = rings.map((r) => [...r, r[0]].map(toLngLat));
      const [cx, cy] = coords[0].reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
      parts.push({
        type: 'Feature',
        properties: { ...props, v: hash(cx / coords[0].length, cy / coords[0].length) },
        geometry: { type: 'Polygon', coordinates: coords },
      });
    }
  }
  return parts;
}

export class BuildingParts {
  private tiles = new Map<string, Part[]>();
  private loading = new Set<string>();
  private shown = '';
  private lastCheck = 0;

  constructor(private map: MapLibreMap, private onData: (fc: FeatureCollection<Polygon, BuildingProps>, ready: boolean) => void) {}

  // Call on camera moves; cheap when nothing new is needed.
  update = () => {
    const now = performance.now();
    if (now - this.lastCheck < 400) return;
    this.lastCheck = now;
    const template = (this.map.getSource('openmaptiles') as VectorTileSource | undefined)?.tiles?.[0];
    if (!template || this.map.getZoom() < 14) return;

    const c = this.map.getCenter();
    const center: LngLat = [c.lng, c.lat];
    const wanted: string[] = [];
    const cx = tileX(c.lng), cy = tileY(c.lat);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const x = cx + dx, y = cy + dy;
        // Nearest point of this tile to the view centre.
        const near: LngLat = [Math.min(Math.max(c.lng, lngOf(x)), lngOf(x + 1)), Math.min(Math.max(c.lat, latOf(y + 1)), latOf(y))];
        if (distance(center, near) <= RADIUS) wanted.push(`${x}/${y}`);
      }
    }

    for (const key of wanted) {
      if (this.tiles.has(key) || this.loading.has(key)) continue;
      this.loading.add(key);
      const [x, y] = key.split('/').map(Number);
      fetch(template.replace('{z}', String(Z)).replace('{x}', String(x)).replace('{y}', String(y)))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((buf) => this.tiles.set(key, decode(buf, x, y)))
        .catch(() => this.tiles.set(key, [])) // ocean, or offline: nothing to split
        .finally(() => {
          this.loading.delete(key);
          this.publish(wanted);
        });
    }
    // Forget tiles we've driven away from.
    for (const key of [...this.tiles.keys()]) {
      if (this.tiles.size <= KEEP) break;
      if (!wanted.includes(key)) this.tiles.delete(key);
    }
    this.publish(wanted);
  };

  private publish(wanted: string[]) {
    const ready = wanted.filter((k) => this.tiles.has(k));
    const id = ready.join('|');
    if (id === this.shown) return;
    this.shown = id;
    const centre = `${tileX(this.map.getCenter().lng)}/${tileY(this.map.getCenter().lat)}`;
    this.onData({ type: 'FeatureCollection', features: ready.flatMap((k) => this.tiles.get(k)!) }, this.tiles.has(centre));
  }
}
