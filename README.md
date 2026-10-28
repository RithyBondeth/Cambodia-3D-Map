# Cambodia 3D Map

An interactive, mobile-friendly 3D web map of Cambodia: real terrain for the whole country and 3D buildings for cities like Phnom Penh and Siem Reap.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production: `npm run build && npm start`. Type-check: `npm run typecheck`.

Map data streams from free, keyless tile servers, so you need an internet connection.

## What's in v0.1

- **Terrain** for all of Cambodia (SRTM-based elevation), with a height slider because most of the country is near sea level
- **3D buildings** from OpenStreetMap, coloured by height
- **Day / Night** styles (night is the starting point for the "navigation" look)
- **Fly-to presets**: Phnom Penh landmarks, Angkor Wat, Tonlé Sap, Cardamom Mountains
- **Tap a building** to see its recorded or estimated height
- **Phone layout**: the panel becomes a bottom sheet

## Data sources

| What | Source | Notes |
|---|---|---|
| Map + buildings | [OpenFreeMap](https://openfreemap.org) (OpenStreetMap, OpenMapTiles schema) | Free, no API key. Buildings without a height get a default estimate |
| Elevation | AWS Terrain Tiles (Terrarium) | ~30 m in Cambodia |
| Map engine | [MapLibre GL JS](https://maplibre.org) v6 (pinned in package.json) | Same styles work later in MapLibre Android/iOS SDKs |
| App framework | [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript | The map renders client-side only |

## Project layout

```
app/layout.tsx            page shell, metadata, global CSS
app/page.tsx              home route → map
app/globals.css           panel styling, phone bottom sheet
components/MapLoader.tsx  loads the map in the browser only (ssr: false)
components/MapApp.tsx     map setup, panel UI, building popup
lib/mapLayers.ts          tile styles, terrain, 3D buildings, sky, themes
lib/places.ts             camera presets (edit to add places)
scripts/copy-maplibre-worker.mjs  copies MapLibre's web worker into public/
docs/PROJECT_NOTES.md     decisions and roadmap
```

**MapLibre worker:** v6 loads its web worker from a separate file, which the Next.js bundler doesn't ship. An npm hook copies it to `public/maplibre-gl-worker.mjs` (gitignored) on install, dev and build, and `MapApp.tsx` points MapLibre at it with `setWorkerUrl()`.
