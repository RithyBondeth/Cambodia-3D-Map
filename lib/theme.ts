// Holographic palettes. `day` is the default pearl/iridescent look,
// `dusk` is the same idea after sunset.
export type Theme = 'day' | 'dusk';

export type Palette = {
  ground: string;
  residential: string;
  green: string;
  water: string;
  waterDeep: string;
  sand: string;
  civic: string;
  road: string;
  roadMajor: string;
  roadMotorway: string;
  casing: string;
  casingMajor: string;
  rail: string;
  boundary: string;
  label: string;
  labelStrong: string;
  labelWater: string;
  labelPoi: string;
  halo: string;
  // 3D buildings, low → tall
  building: [string, string, string, string];
  roof: string;
  roofTall: string;
  selected: string;
  landmark: [string, string];
  hillshade: string;
  sky: string;
  horizon: string;
  fog: string;
  light: string;
};

export const PALETTES: Record<Theme, Palette> = {
  day: {
    ground: '#f4f2fb',
    residential: '#eeebf8',
    green: '#d3f1e4',
    water: '#bcdcfd',
    waterDeep: '#a6c8f7',
    sand: '#f7f0e4',
    civic: '#f3eefb',
    road: '#ffffff',
    roadMajor: '#ffffff',
    roadMotorway: '#efe6ff',
    casing: '#ddd7f0',
    casingMajor: '#c8bdf0',
    rail: '#cbc5de',
    boundary: '#b1a7dc',
    label: '#4b4568',
    labelStrong: '#2b2650',
    labelWater: '#4c6db3',
    labelPoi: '#6a6391',
    halo: 'rgba(255,255,255,0.92)',
    building: ['#f7f5fd', '#e2dcf7', '#c4cdf6', '#a3e3f0'],
    roof: '#ffffff',
    roofTall: '#e9fbff',
    selected: '#ff7ad9',
    landmark: ['#f6dccd', '#f9eee6'],
    hillshade: '#9b90c9',
    sky: '#cfe2ff',
    horizon: '#fbe6ff',
    fog: '#f4f2fb',
    light: '#ffffff',
  },
  dusk: {
    ground: '#1c1a33',
    residential: '#221f3d',
    green: '#1d3a3e',
    water: '#26345f',
    waterDeep: '#1f2a52',
    sand: '#2b2840',
    civic: '#262243',
    road: '#3a3563',
    roadMajor: '#4a428a',
    roadMotorway: '#6151b5',
    casing: '#2a2650',
    casingMajor: '#352e66',
    rail: '#3d3866',
    boundary: '#6c5fc0',
    label: '#c9c3f0',
    labelStrong: '#efeaff',
    labelWater: '#8fb2ff',
    labelPoi: '#a99fe0',
    halo: 'rgba(20,18,40,0.85)',
    building: ['#2e2a52', '#3f3a7a', '#5763b8', '#5fd3e6'],
    roof: '#8f86e8',
    roofTall: '#9ff3ff',
    selected: '#ff7ad9',
    landmark: ['#b98b78', '#e7c3a9'],
    hillshade: '#0c0a1e',
    sky: '#2a2160',
    horizon: '#a05bc4',
    fog: '#1c1a33',
    light: '#d8d0ff',
  },
};
