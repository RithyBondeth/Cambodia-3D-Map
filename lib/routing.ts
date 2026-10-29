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
  legs: { steps: OsrmStep[]; summary: string; annotation?: { duration: number[] } }[];
};

export type Step = {
  instruction: string; // for the screen, e.g. "Turn right onto St 274"
  speech: string;      // for the voice: no Khmer script, which English voices can't read
  type: string;
  modifier?: string;
  road: string;        // road name, in Latin letters when we can make one
  roadLocal: string;   // the original OSM name when it differs from `road` (usually Khmer)
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
  // Seconds from the start to each coordinate, from OSRM's per-segment timings.
  times: number[];
  steps: Step[];
};

type FetchOptions = {
  alternatives?: boolean;
  // Current direction of travel, so a reroute doesn't start with a U-turn.
  heading?: number;
  signal?: AbortSignal;
};

export async function fetchRoutes(from: LngLat, to: LngLat, { alternatives = true, heading, signal }: FetchOptions = {}): Promise<Route[]> {
  const params = new URLSearchParams({
    overview: 'full', geometries: 'geojson', steps: 'true', annotations: 'duration', alternatives: String(alternatives),
  });
  if (heading !== undefined) params.set('bearings', `${Math.round((heading + 360) % 360)},60;`);
  const res = await fetch(`${OSRM_URL}/route/v1/driving/${from.join(',')};${to.join(',')}?${params}`, { signal });
  if (res.status === 429) throw new Error('The routing server is busy. Try again in a moment.');
  const json = await res.json();
  if (json.code !== 'Ok') {
    throw new Error(json.code === 'NoRoute' ? 'No driving route found between these places.' : json.message || 'Routing failed.');
  }
  return (json.routes as OsrmRoute[]).map(toRoute);
}

/** Seconds left to drive from `along` metres into the route. */
export function remainingTime(route: Route, along: number) {
  const total = route.times[route.times.length - 1] || 1;
  return Math.max(0, (total - route.path.valueAt(route.times, along)) * (route.duration / total));
}

function toRoute(r: OsrmRoute): Route {
  const coords = r.geometry.coordinates;
  const path = new Path(coords);
  const steps: Step[] = [];
  let at = 0;
  for (const s of r.legs.flatMap((l) => l.steps)) {
    const names = roadNames(s);
    steps.push({
      instruction: describe(s, names.road),
      speech: describe(s, names.spoken),
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      road: names.road,
      roadLocal: names.local,
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

  return { distance: r.distance, duration: r.duration, via, coords, path, times: segmentTimes(r, path), steps };
}

function segmentTimes(r: OsrmRoute, path: Path): number[] {
  const durations = r.legs.flatMap((l) => l.annotation?.duration ?? []);
  if (durations.length === path.coords.length - 1) {
    const times = [0];
    for (const d of durations) times.push(times[times.length - 1] + d);
    return times;
  }
  // No usable timings: spread the total evenly by distance.
  return path.cumulative.map((d) => (d / (path.length || 1)) * r.duration);
}

// --- Road names ---

const latinDigits = (s: string) => s.replace(/[០-៩]/g, (d) => String(d.charCodeAt(0) - 0x17e0));
const isLatin = (s: string) => /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u.test(s);

// OSM names in Cambodia are mostly Khmer, but Phnom Penh streets carry their
// number in brackets, e.g. "មហាវិថី ព្រះសីហនុ (២៧៤)" is Street 274, and national
// roads carry a ref. Those give a name drivers know that an English voice can read.
function roadNames(s: OsrmStep): { road: string; local: string; spoken: string } {
  const name = s.name?.trim() ?? '';
  const ref = s.ref?.split(';')[0].trim() ?? '';
  if (name && isLatin(name)) return { road: name, local: '', spoken: name };

  // "… (២៧៤)", "… (ផ្លូវ ១២៨)" or plain "ផ្លូវ ៦៣" / "ផ្លូវលេខ ៦៣" (Street 63).
  const digits = latinDigits(name);
  const number = digits.match(/\([^)]*?(\d+[A-Za-z]?)\s*\)/)?.[1] ?? digits.match(/^(?:ផ្លូវ|វិថី)\s*(?:លេខ\s*)?(\d+[A-Za-z]?)$/)?.[1];
  let road = '';
  let spoken = '';
  if (number) {
    road = `St ${number}`;
    spoken = `Street ${number}`;
  } else if (ref) {
    const national = name.includes('ផ្លូវជាតិ') || /^\d{1,2}[A-Z]?$/.test(ref);
    road = national ? `NR ${ref}` : `Road ${ref}`;
    spoken = national ? `National Road ${ref}` : `Road ${ref}`;
  }
  return road ? { road, local: name, spoken } : { road: name, local: '', spoken: '' };
}

const CARDINALS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// OSRM returns manoeuvre types, not sentences; this turns them into text.
function describe(s: OsrmStep, road: string): string {
  const { type, modifier = 'straight', exit, bearing_after } = s.maneuver;
  const onto = road ? ` onto ${road}` : '';
  const dir = modifier.replace('uturn', 'U-turn');

  switch (type) {
    case 'depart':
      return `Head ${CARDINALS[Math.round(bearing_after / 45) % 8]}${road ? ` on ${road}` : ''}`;
    case 'arrive':
      return modifier === 'left' || modifier === 'right'
        ? `Your destination is on the ${modifier}`
        : 'You have arrived at your destination';
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
