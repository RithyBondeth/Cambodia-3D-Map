import type { LngLat } from './geo';

// Photon (komoot): free OpenStreetMap geocoder, fair-use public API.
const PHOTON_URL = 'https://photon.komoot.io/api/';
const CAMBODIA_BBOX = '102.3,10.4,107.7,14.7';

export type SearchResult = {
  id: string;
  name: string;
  detail: string;
  category: string;
  center: LngLat;
};

type PhotonFeature = {
  geometry: { coordinates: LngLat };
  properties: Record<string, string | undefined>;
};

export async function search(query: string, near: LngLat, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query, limit: '7', lang: 'en', bbox: CAMBODIA_BBOX,
    lat: String(near[1]), lon: String(near[0]),
  });
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!res.ok) throw new Error('Search is unavailable right now.');
  const json = await res.json();
  // Photon can return one OSM object twice (e.g. tagged both park and wood).
  const seen = new Set<string>();
  return (json.features as PhotonFeature[]).map(toResult).filter((r) => r.name && !seen.has(r.id) && seen.add(r.id));
}

function toResult(f: PhotonFeature): SearchResult {
  const p = f.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const detail = [street, p.district, p.city, p.state].filter((s, i, a) => s && a.indexOf(s) === i && s !== p.name).join(', ');
  return {
    id: `${p.osm_type}${p.osm_id}`,
    name: p.name ?? street,
    detail,
    category: prettyCategory(p.osm_value),
    center: f.geometry.coordinates,
  };
}

export function prettyCategory(value?: string) {
  if (!value || value === 'yes') return '';
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
