import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { offset, type LngLat } from './geo';

// Hand-modelled landmarks, built from stacked extrusions so they keep their
// recognisable silhouettes instead of a single OSM box. Dimensions are
// approximate (published figures + satellite imagery), not survey-grade.

type Tier = { w: number; d?: number; base: number; top: number; sides?: number; rotate?: number; tone?: 0 | 1 };

type Props = { base: number; height: number; tone: number; landmark: string };

function ring(center: LngLat, w: number, d: number, sides: number, rotate: number): LngLat[] {
  const pts: LngLat[] = [];
  if (sides === 4) {
    const corners: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    const r = (rotate * Math.PI) / 180;
    for (const [x, y] of corners) {
      pts.push(offset(center, x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)));
    }
  } else {
    for (let i = 0; i < sides; i++) {
      const a = ((rotate + (360 * i) / sides) * Math.PI) / 180;
      pts.push(offset(center, (w / 2) * Math.cos(a), (w / 2) * Math.sin(a)));
    }
  }
  pts.push(pts[0]);
  return pts;
}

function build(name: string, center: LngLat, tiers: Tier[]): Feature<Polygon, Props>[] {
  return tiers.map((t) => ({
    type: 'Feature',
    properties: { base: t.base, height: t.top, tone: t.tone ?? 0, landmark: name },
    geometry: { type: 'Polygon', coordinates: [ring(center, t.w, t.d ?? t.w, t.sides ?? 4, t.rotate ?? 0)] },
  }));
}

// A tapering lotus-bud tower: n tiers shrinking from w0 to w1 between base and top.
function tower(w0: number, w1: number, base: number, top: number, n: number, sides = 8, tone: 0 | 1 = 1): Tier[] {
  const tiers: Tier[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const w = w0 + (w1 - w0) * f;
    tiers.push({ w, base: base + (top - base) * f, top: base + (top - base) * ((i + 1) / n), sides, rotate: 22.5, tone });
  }
  return tiers;
}

// Independence Monument, Phnom Penh: ~37 m Angkorian-style lotus stupa on a stepped base.
const independenceMonument = build('Independence Monument', [104.92819, 11.55644], [
  { w: 18, base: 0, top: 1.6 },
  { w: 14.5, base: 1.6, top: 3.4 },
  { w: 10, base: 3.4, top: 13, tone: 1 },
  { w: 8.6, base: 13, top: 17.5 },
  { w: 7.2, base: 17.5, top: 21.5, tone: 1 },
  { w: 5.9, base: 21.5, top: 25 },
  { w: 4.6, base: 25, top: 28.2, tone: 1 },
  { w: 3.3, base: 28.2, top: 31 },
  { w: 2.1, base: 31, top: 33.6, tone: 1 },
  { w: 1.1, base: 33.6, top: 35.6, sides: 8 },
  { w: 0.4, base: 35.6, top: 37, sides: 8, tone: 1 },
]);

// Angkor Wat: three concentric galleries rising to a quincunx of lotus towers,
// the central one ~65 m above ground.
const ANGKOR: LngLat = [103.86698, 13.41248];
const angkorCorner = (east: number, north: number) => offset(ANGKOR, east, north);
const angkorWat = [
  ...build('Angkor Wat', ANGKOR, [
    { w: 215, d: 187, base: 0, top: 4.5 },        // third gallery
    { w: 200, d: 172, base: 0, top: 1.2 },        // courtyard floor
    { w: 115, d: 100, base: 0, top: 11, tone: 1 }, // second gallery
    { w: 60, d: 60, base: 11, top: 24 },          // raised central terrace (Bakan)
    ...tower(19, 3, 24, 65, 10),                  // central tower
  ]),
  // four corner towers of the central terrace
  ...[[-24, -24], [24, -24], [24, 24], [-24, 24]].flatMap(([e, n]) =>
    build('Angkor Wat', angkorCorner(e, n), tower(11, 2, 24, 52, 8))),
  // corner towers of the second gallery
  ...[[-52, -45], [52, -45], [52, 45], [-52, 45]].flatMap(([e, n]) =>
    build('Angkor Wat', angkorCorner(e, n), tower(8, 1.5, 11, 25, 5, 8, 0))),
];

// OSM buildings within these circles are hidden so they don't swallow the models.
export const LANDMARK_CLEARINGS: { center: LngLat; radius: number }[] = [
  { center: [104.92819, 11.55644], radius: 12 },
  { center: ANGKOR, radius: 145 },
];

export const LANDMARK_INFO: Record<string, { subtitle: string; height: string; built: string }> = {
  'Independence Monument': { subtitle: 'Lotus-shaped stupa, Phnom Penh', height: '37 m', built: '1958' },
  'Angkor Wat': { subtitle: 'Temple complex, Siem Reap', height: '65 m', built: '12th century' },
};

export const LANDMARKS: FeatureCollection<Polygon, Props> = {
  type: 'FeatureCollection',
  features: [...independenceMonument, ...angkorWat],
};
