// Map palettes. `day` reads like a modern street map (green parks, blue water,
// yellow main roads, varied building colours); `dusk` is the same map at night,
// with lit windows. The UI keeps its holographic look in both.
export type Theme = 'day' | 'dusk';

// `map`: drawn from OpenStreetMap vector data. `satellite`: aerial photos underneath.
export type Basemap = 'map' | 'satellite';

export type Palette = {
  ground: string;
  residential: string;
  commercial: string;
  industrial: string;
  civic: string;    // schools, universities, libraries
  hospital: string;
  park: string;
  grass: string;
  wood: string;
  farmland: string; // rice paddies cover most of lowland Cambodia
  wetland: string;
  sand: string;
  water: string;
  waterDeep: string;
  motorway: string;
  motorwayCasing: string;
  trunk: string;    // trunk and primary
  trunkCasing: string;
  secondary: string; // secondary and tertiary
  secondaryCasing: string;
  road: string;     // streets, minor and service roads
  roadCasing: string;
  path: string;
  centerline: string;
  rail: string;
  boundary: string;
  label: string;
  labelStrong: string;
  labelWater: string;
  labelPoi: string;
  halo: string;
  // Buildings: low-rise wall colours, glass tower tints, roof colours.
  facades: string[];
  towers: string[];
  roofs: string[];
  windows: string;    // glass in low-rise windows
  litWindows: number; // share of windows lit at night, 0–1
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
    ground: '#f3f1ec',
    residential: '#ece7df',
    commercial: '#f5e4df',
    industrial: '#e8e3ec',
    civic: '#f1ecd2',
    hospital: '#f9dede',
    park: '#bfe3a9',
    grass: '#cbe7b6',
    wood: '#a3d391',
    farmland: '#e2ecc0',
    wetland: '#c2e2d2',
    sand: '#f3e5bd',
    water: '#8ec2f3',
    waterDeep: '#6fa9e6',
    motorway: '#f6a93f',
    motorwayCasing: '#d4862a',
    trunk: '#fcd466',
    trunkCasing: '#e0aa45',
    secondary: '#fff0ad',
    secondaryCasing: '#e3cd85',
    road: '#ffffff',
    roadCasing: '#d5cfc4',
    path: '#e4ddd0',
    centerline: '#ffffff',
    rail: '#a39d94',
    boundary: '#9a8fc0',
    label: '#3e3b4a',
    labelStrong: '#1f1c2e',
    labelWater: '#2b6cb0',
    labelPoi: '#5a566d',
    halo: 'rgba(255,255,255,0.94)',
    // Phnom Penh shophouses and villas: creams, sands, terracotta, pale yellows, greys.
    facades: ['#f1e6d2', '#e7d3b3', '#f4efe6', '#e2c7a5', '#efd8c2', '#dcd6cb', '#efe1a8', '#d6dfe2', '#ebcdb9', '#e9e1cf'],
    towers: ['#8fb4d2', '#a8c5da', '#7b9cbb', '#b6cbd8', '#8fb7b3', '#9db0c9'],
    roofs: ['#c76d4c', '#b8b2a8', '#d9d4cb', '#97a3ad', '#a95c42', '#e7e2d8', '#7e97ae', '#c4bba9'],
    windows: '#5f7488',
    litWindows: 0,
    selected: '#ff6fcf',
    landmark: ['#e9cdb3', '#f6e8d9'],
    hillshade: '#8a8679',
    sky: '#b9d6f5',
    horizon: '#eef3fb',
    fog: '#f1f0ec',
    light: '#ffffff',
  },
  dusk: {
    ground: '#1d2134',
    residential: '#22273d',
    commercial: '#2b2843',
    industrial: '#25293c',
    civic: '#262d44',
    hospital: '#33273f',
    park: '#1d3a35',
    grass: '#213e38',
    wood: '#1a362e',
    farmland: '#243731',
    wetland: '#1e3940',
    sand: '#34302d',
    water: '#132a4b',
    waterDeep: '#0f2341',
    motorway: '#c78a3a',
    motorwayCasing: '#7c5424',
    trunk: '#ab8a48',
    trunkCasing: '#6b5430',
    secondary: '#56649a',
    secondaryCasing: '#34395c',
    road: '#3c4570',
    roadCasing: '#282e4d',
    path: '#363c5c',
    centerline: '#e9d9a6',
    rail: '#4d5170',
    boundary: '#7b70c2',
    label: '#cfcae8',
    labelStrong: '#f1edff',
    labelWater: '#8fb4ff',
    labelPoi: '#aaa3d8',
    halo: 'rgba(16,18,36,0.88)',
    facades: ['#4a4560', '#585068', '#4b5166', '#605870', '#53495c', '#45505f', '#5a5563', '#4f4a5c'],
    towers: ['#2e4a6f', '#36567c', '#283f5f', '#3d5f88', '#2f5160'],
    roofs: ['#3a3550', '#484158', '#584952', '#373d52', '#4a4f63'],
    windows: '#ffd27f',
    litWindows: 0.45,
    selected: '#ff6fcf',
    landmark: ['#b98b78', '#e7c3a9'],
    hillshade: '#0c0a1e',
    sky: '#1b1f4a',
    horizon: '#6b4c9c',
    fog: '#1d2134',
    light: '#d8d0ff',
  },
};
