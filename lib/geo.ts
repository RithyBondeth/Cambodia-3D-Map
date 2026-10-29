export type LngLat = [number, number];

const R = 6371008.8; // mean Earth radius, metres
const METRES_PER_DEGREE = (R * Math.PI) / 180;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function distance(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Initial bearing from a to b, degrees clockwise from north.
export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// Point `east`/`north` metres away from `origin` (fine for building-sized offsets).
export function offset(origin: LngLat, east: number, north: number): LngLat {
  return [
    origin[0] + deg(east / (R * Math.cos(rad(origin[1])))),
    origin[1] + deg(north / R),
  ];
}

// Shortest signed difference between two angles, in degrees (-180..180).
export function angleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

// A polyline with cumulative distances, for walking along it.
export class Path {
  readonly coords: LngLat[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(coords: LngLat[]) {
    this.coords = coords;
    this.cumulative = [0];
    for (let i = 1; i < coords.length; i++) {
      this.cumulative.push(this.cumulative[i - 1] + distance(coords[i - 1], coords[i]));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  // Index of the segment containing distance d.
  private segment(d: number): number {
    let lo = 0;
    let hi = this.cumulative.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid] <= d) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  pointAt(d: number): LngLat {
    const t = clamp(d, 0, this.length);
    const i = this.segment(t);
    const a = this.coords[i];
    const b = this.coords[Math.min(i + 1, this.coords.length - 1)];
    const segLen = this.cumulative[i + 1] - this.cumulative[i] || 1;
    const f = (t - this.cumulative[i]) / segLen;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  // Direction of travel at distance d, looking a little ahead so it turns smoothly.
  bearingAt(d: number): number {
    return bearing(this.pointAt(d - 4), this.pointAt(d + 12));
  }

  // A per-coordinate value (e.g. cumulative seconds) interpolated at distance d.
  valueAt(values: number[], d: number): number {
    const t = clamp(d, 0, this.length);
    const i = this.segment(t);
    const segLen = this.cumulative[i + 1] - this.cumulative[i] || 1;
    const f = (t - this.cumulative[i]) / segLen;
    return values[i] + ((values[i + 1] ?? values[i]) - values[i]) * f;
  }

  // The part of the path between distances a and b.
  slice(a: number, b: number): LngLat[] {
    const from = clamp(a, 0, this.length);
    const to = clamp(b, 0, this.length);
    if (to <= from) return [];
    return [this.pointAt(from), ...this.coords.slice(this.segment(from) + 1, this.segment(to) + 1), this.pointAt(to)];
  }

  sliceTo(d: number): LngLat[] {
    return this.slice(0, d);
  }

  // Closest point on the path to p, searching only between distances `from` and `to`.
  project(p: LngLat, from = 0, to = this.length): { along: number; distance: number } {
    const k = Math.cos(rad(p[1]));
    const last = Math.min(this.segment(clamp(to, 0, this.length)), this.coords.length - 2);
    let best = { along: 0, distance: Infinity };
    for (let i = this.segment(clamp(from, 0, this.length)); i <= last; i++) {
      const a = this.coords[i];
      const b = this.coords[i + 1];
      const ax = (a[0] - p[0]) * k, ay = a[1] - p[1];
      const dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
      const len = dx * dx + dy * dy;
      const t = len ? clamp(-(ax * dx + ay * dy) / len, 0, 1) : 0;
      const dist = Math.hypot(ax + dx * t, ay + dy * t) * METRES_PER_DEGREE;
      if (dist < best.distance) {
        best = { along: this.cumulative[i] + (this.cumulative[i + 1] - this.cumulative[i]) * t, distance: dist };
      }
    }
    return best;
  }
}
