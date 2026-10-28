// Camera presets. Coordinates are approximate and good enough for fly-to;
// refine them as the project grows.
export type PlaceKind = 'country' | 'city' | 'landmark' | 'tower' | 'nature';

export type Place = {
  id: string;
  name: string;
  subtitle: string;
  kind: PlaceKind;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  exaggeration?: number;
};

export const PLACES: Place[] = [
  { id: 'pp',        name: 'Phnom Penh',            subtitle: 'Capital skyline',      kind: 'city',     center: [104.922, 11.565],   zoom: 14.6, pitch: 62, bearing: -20 },
  { id: 'monument',  name: 'Independence Monument', subtitle: '3D landmark',          kind: 'landmark', center: [104.9282, 11.5563], zoom: 17.6, pitch: 68, bearing: -10 },
  { id: 'palace',    name: 'Royal Palace',          subtitle: 'Riverside',            kind: 'landmark', center: [104.9310, 11.5637], zoom: 17,   pitch: 65, bearing: 30 },
  { id: 'vattanac',  name: 'Vattanac Capital',      subtitle: 'Tallest towers',       kind: 'tower',    center: [104.9206, 11.5717], zoom: 16.5, pitch: 70, bearing: 40 },
  { id: 'watphnom',  name: 'Wat Phnom',             subtitle: 'Hilltop pagoda',       kind: 'landmark', center: [104.9231, 11.5764], zoom: 17,   pitch: 60, bearing: 0 },
  { id: 'kohpich',   name: 'Koh Pich',              subtitle: 'Diamond Island',       kind: 'tower',    center: [104.9375, 11.5470], zoom: 15.8, pitch: 62, bearing: -35 },
  { id: 'angkor',    name: 'Angkor Wat',            subtitle: '3D temple model',      kind: 'landmark', center: [103.8670, 13.4125], zoom: 16.2, pitch: 62, bearing: -25 },
  { id: 'tonlesap',  name: 'Tonlé Sap',             subtitle: 'Great lake',           kind: 'nature',   center: [104.05, 12.85],     zoom: 8,    pitch: 55, bearing: 20 },
  { id: 'cardamom',  name: 'Cardamom Mountains',    subtitle: 'Terrain ×3',           kind: 'nature',   center: [103.35, 11.85],     zoom: 9.2,  pitch: 70, bearing: 40, exaggeration: 3 },
  { id: 'cambodia',  name: 'All Cambodia',          subtitle: 'Country view',         kind: 'country',  center: [104.90, 12.60],     zoom: 6.4,  pitch: 45, bearing: 0 },
];
