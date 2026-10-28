# Cambodia 3D Map

An interactive, mobile-friendly 3D web map of Cambodia with a holographic look: real terrain for the whole country, 3D buildings, hand-modelled landmarks, place search and 3D driving directions.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production: `npm run build && npm start`. Type-check: `npm run typecheck`.

Map data streams from free, keyless tile servers, so you need an internet connection.

## Features

- **Holographic UI**: glass panels, iridescent accents, a pearl **Day** theme and a **Dusk** theme. On phones the panel becomes a bottom sheet
- **3D buildings** from real OpenStreetMap footprints, with a height gradient and bright roof edges. Tap one for its height and floor count
- **Hand-modelled landmarks**: Independence Monument (stepped lotus stupa) and Angkor Wat (galleries plus the five-tower quincunx)
- **Terrain** for all of Cambodia (SRTM-based), with a height slider
- **Search** for places, streets and businesses across Cambodia
- **Place details**: tap POIs, buildings or landmarks. Right-click or long-press to drop a pin. *Orbit in 3D* circles the camera around a place
- **Driving directions** with alternative routes and turn-by-turn steps
- **3D drive**: plays the route back with a chase camera, next-turn banner, ETA and 5×/10×/30× speed. This is a preview, not live GPS navigation

## Data sources

| What | Source | Notes |
|---|---|---|
| Map + buildings | [OpenFreeMap](https://openfreemap.org) (OpenStreetMap, OpenMapTiles schema) | Free, no API key. Buildings without a height get a default estimate |
| Elevation | AWS Terrain Tiles (Terrarium) | ~30 m in Cambodia |
| Search | [Photon](https://photon.komoot.io) (OpenStreetMap) | Free public API, fair use |
| Routing | [OSRM](https://project-osrm.org) public demo server | Free, rate-limited, **not for production**. Set `NEXT_PUBLIC_OSRM_URL` to a hosted/self-run OSRM before launch |
| Map engine | [MapLibre GL JS](https://maplibre.org) v6 (pinned in package.json) | Same styles work later in MapLibre Android/iOS SDKs |
| App framework | [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript | The map renders client-side only |

## Project layout

```
app/layout.tsx            page shell, fonts, metadata
app/page.tsx              home route → map
app/globals.css           holographic theme, panels, HUD, phone layout
components/MapLoader.tsx  loads the map in the browser only (ssr: false)
components/MapApp.tsx     map setup, state, clicks, directions, 3D drive
components/SearchBox.tsx  search field with results (also used for From/To)
components/ExplorePanel.tsx, PlaceCard.tsx, DirectionsPanel.tsx, DriveHud.tsx, ControlDock.tsx
components/icons.tsx      inline SVG icons, turn arrows
lib/theme.ts              Day / Dusk palettes
lib/mapStyle.ts           loads the OpenFreeMap style and recolours it
lib/mapLayers.ts          terrain, buildings, landmarks, route layers, light, sky
lib/landmarks.ts          hand-modelled landmark geometry
lib/routing.ts            OSRM client + turn instructions
lib/search.ts             Photon client
lib/drive.ts              3D drive camera animation
lib/geo.ts, lib/format.ts geometry and formatting helpers
lib/places.ts             Explore presets (edit to add places)
scripts/copy-maplibre-worker.mjs  copies MapLibre's web worker into public/
docs/PROJECT_NOTES.md     decisions and roadmap
```

**MapLibre worker:** v6 loads its web worker from a separate file, which the Next.js bundler doesn't ship. An npm hook copies it to `public/maplibre-gl-worker.mjs` (gitignored) on install, dev and build, and `MapApp.tsx` points MapLibre at it with `setWorkerUrl()`.

**CSS note:** write `backdrop-filter` without the `-webkit-` copy. Next's CSS optimizer adds the Safari prefix itself; writing both makes it keep only the prefixed one, which breaks the blur in Chrome.
