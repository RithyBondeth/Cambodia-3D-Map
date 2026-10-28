import { Path, type LngLat } from './geo';

// OSRM public demo server: free and keyless, but rate-limited and not meant for
// production traffic. Point this at a hosted or self-run OSRM before launch.
const OSRM_URL = process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';

type OsrmManeuver = {
  type: string;
  modifier?: string;
  exit?: number;
  bearing_after: number;
  location: LngLat;
};

type OsrmStep = {
  name: string;
  ref?: string;
  distance: number;
  duration: number;
  maneuver: OsrmManeuver;
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: LngLat[] };
  legs: { steps: OsrmStep[]; summary: string }[];
};

export type Step = {
  instruction: string;
  type: string;
  modifier?: string;
  road: string;
  distance: number;
  // Distance along the route where this manoeuvre happens.
  at: number;
  location: LngLat;
};

export type Route = {
  distance: number; // metres
  duration: number; // seconds
  via: string;
  coords: LngLat[];
  path: Path;
  steps: Step[];
};

export async function fetchRoutes(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<Route[]> {
  const url = `${OSRM_URL}/route/v1/driving/${from.join(',')};${to.join(',')}?overview=full&geometries=geojson&steps=true&alternatives=true`;
  const res = await fetch(url, { signal });
  if (res.status === 429) throw new Error('The routing server is busy. Try again in a moment.');
  const json = await res.json();
  if (json.code !== 'Ok') {
    throw new Error(json.code === 'NoRoute' ? 'No driving route found between these places.' : json.message || 'Routing failed.');
  }
  return (json.routes as OsrmRoute[]).map(toRoute);
}

function toRoute(r: OsrmRoute): Route {
  const coords = r.geometry.coordinates;
  const steps: Step[] = [];
  let at = 0;
  for (const s of r.legs.flatMap((l) => l.steps)) {
    steps.push({
      instruction: describe(s),
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      road: roadName(s),
      distance: s.distance,
      at,
      location: s.maneuver.location,
    });
    at += s.distance;
  }
  // "via" = the road the route spends longest on.
  const byRoad = new Map<string, number>();
  for (const s of steps) if (s.road) byRoad.set(s.road, (byRoad.get(s.road) ?? 0) + s.distance);
  const via = [...byRoad.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return { distance: r.distance, duration: r.duration, via, coords, path: new Path(coords), steps };
}

function roadName(s: OsrmStep) {
  return s.name || s.ref || '';
}

const CARDINALS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// OSRM returns manoeuvre types, not sentences; this turns them into text.
function describe(s: OsrmStep): string {
  const { type, modifier = 'straight', exit, bearing_after } = s.maneuver;
  const road = roadName(s);
  const onto = road ? ` onto ${road}` : '';
  const dir = modifier.replace('uturn', 'U-turn');

  switch (type) {
    case 'depart':
      return `Head ${CARDINALS[Math.round(bearing_after / 45) % 8]}${road ? ` on ${road}` : ''}`;
    case 'arrive':
      return 'Arrive at your destination';
    case 'roundabout':
    case 'rotary':
      return exit ? `At the roundabout, take the ${ordinal(exit)} exit${onto}` : `Enter the roundabout${onto}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${onto}`;
    case 'merge':
      return `Merge ${dir}${onto}`;
    case 'on ramp':
      return `Take the ramp${onto}`;
    case 'off ramp':
      return `Take the exit${onto}`;
    case 'fork':
      return `Keep ${modifier.includes('left') ? 'left' : 'right'} at the fork${onto}`;
    case 'continue':
    case 'new name':
      return modifier === 'straight' ? `Continue${onto}` : `Continue ${dir}${onto}`;
    default: // turn, end of road, notification, …
      if (modifier === 'uturn') return `Make a U-turn${onto}`;
      if (modifier === 'straight') return `Go straight${onto}`;
      return `Turn ${dir}${onto}`;
  }
}
