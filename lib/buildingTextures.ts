import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Palette } from './theme';

// Facade textures for the 3D buildings, drawn on a canvas so there's nothing
// to download. One tile is one floor (about 14 px on screen at street level),
// repeated up and along every wall. At night some windows are lit.

export const FACADE = 'kh-facade-';
export const TOWER = 'kh-tower-';
const PIXEL_RATIO = 2;

// Deterministic randomness, so a texture looks the same on every load.
function rng(seed: number) {
  let s = seed * 2654435761 % 4294967296;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function mix(hex: string, other: string, t: number) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(other.slice(1), 16);
  const ch = (v: number, shift: number) => (v >> shift) & 255;
  const c = (shift: number) => Math.round(ch(a, shift) + (ch(b, shift) - ch(a, shift)) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

// Shophouse / apartment: painted wall, two windows per bay, a floor slab line.
function lowRise(wall: string, p: Palette, seed: number) {
  const { g } = canvas(48, 28);
  const r = rng(seed);
  g.fillStyle = wall;
  g.fillRect(0, 0, 48, 28);
  // Floor slab / balcony edge.
  g.fillStyle = mix(wall, '#000000', 0.1);
  g.fillRect(0, 25, 48, 3);
  for (const x of [5, 29]) {
    const lit = r() < p.litWindows;
    const grad = g.createLinearGradient(0, 6, 0, 21);
    if (lit) {
      grad.addColorStop(0, '#fff1c4');
      grad.addColorStop(1, p.windows);
    } else if (p.litWindows > 0) {
      grad.addColorStop(0, '#2a2f48');
      grad.addColorStop(1, '#1d2136');
    } else {
      grad.addColorStop(0, mix(p.windows, '#ffffff', 0.55));
      grad.addColorStop(1, mix(p.windows, '#ffffff', 0.15));
    }
    g.fillStyle = grad;
    g.fillRect(x, 7, 13, 13);
    // Window frame and sill.
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(x - 1, 20, 15, 2);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(x + 6, 7, 1, 13);
  }
  return g.getImageData(0, 0, 48, 28);
}

// Glass tower: curtain wall with mullions and a spandrel band per floor.
function tower(glass: string, p: Palette, seed: number) {
  const { g } = canvas(32, 28);
  const r = rng(seed);
  const grad = g.createLinearGradient(0, 0, 32, 28);
  grad.addColorStop(0, mix(glass, '#ffffff', 0.25));
  grad.addColorStop(1, glass);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 28);
  if (p.litWindows > 0) {
    for (const x of [0, 16]) {
      if (r() < p.litWindows) {
        g.fillStyle = 'rgba(255,214,140,0.85)';
        g.fillRect(x + 1, 2, 14, 19);
      }
    }
  }
  // Spandrel (floor slab) and mullions.
  g.fillStyle = mix(glass, '#ffffff', 0.55);
  g.fillRect(0, 22, 32, 6);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fillRect(15, 0, 2, 28);
  g.fillRect(31, 0, 1, 28);
  return g.getImageData(0, 0, 32, 28);
}

// Adds every facade texture for this palette (safe to call again after a style change).
export function addFacadeImages(map: MapLibreMap, p: Palette) {
  p.facades.forEach((wall, i) => {
    if (!map.hasImage(FACADE + i)) map.addImage(FACADE + i, lowRise(wall, p, i + 1), { pixelRatio: PIXEL_RATIO });
  });
  p.towers.forEach((glass, i) => {
    if (!map.hasImage(TOWER + i)) map.addImage(TOWER + i, tower(glass, p, i + 101), { pixelRatio: PIXEL_RATIO });
  });
}
