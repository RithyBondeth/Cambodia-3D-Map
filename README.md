# Cambodia 3D Map

An interactive, mobile-friendly 3D web map of Cambodia with a holographic look: real terrain for the whole country, 3D buildings, hand-modelled landmarks, place search, and turn-by-turn 3D navigation from your location.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production: `npm run build && npm start`. Type-check: `npm run typecheck`.

**Try navigation on your phone.** Browsers only share GPS with secure (https) pages, and `localhost` only counts on the computer itself. Run `npm run dev:phone`, then open `https://<your computer's Wi-Fi IP>:3000` on the phone (same Wi-Fi) and accept the certificate warning. For real use, deploy it to an https host.

Map data streams from free, keyless tile servers, so you need an internet connection.

## Features

- **Holographic UI**: glass panels and iridescent accents. On phones the panel becomes a bottom sheet
- **A full-colour street map**, styled like modern map apps:
  - Green parks, woods and rice fields, blue rivers, and tinted shopping, industrial and campus areas.
  - A road hierarchy: orange highways, yellow main roads, white streets, and dashed centre lines up close.
  - A **Day** look and a **Dusk** (night) look.
- **Satellite view**: aerial imagery under the 3D city, with roads and labels on top (dock button, or Layers → Satellite)
- **3D buildings** from real OpenStreetMap footprints, each with its own look:
  - Painted shophouse facades with rows of windows (lit at night) and glass curtain walls on towers.
  - Terracotta, concrete or metal roofs.
  - Tap a building for its height and floor count.
- **Hand-modelled landmarks**: Independence Monument (stepped lotus stupa) and Angkor Wat (galleries plus the five-tower quincunx)
- **Terrain** for all of Cambodia (SRTM-based), with a height slider
- **Search** for places, streets and businesses across Cambodia
- **Place details**: tap POIs, buildings or landmarks. Right-click or long-press to drop a pin. *Orbit in 3D* circles the camera around a place
- **Driving directions** with alternative routes and step lists. The start fills in with your location
- **Turn-by-turn 3D navigation** (*Start*): follows your phone's GPS along the route.
  - A heading-up chase camera behind a 3D car, which pulls back at speed and leans in before turns. A white turn arrow is painted on the road at the next manoeuvre.
  - Banner with the next turn, the distance to it, the street (Latin + Khmer) and a "Then" hint for back-to-back turns. Tap it for the upcoming turns.
  - **Voice guidance** (browser speech): "In 300 meters, turn right onto Street 107", "Turn left onto Street 214, then turn right onto Street 105", "You have arrived. Your destination is on the left."
  - **Rerouting** when you leave the route, preferring roads in your direction of travel.
  - ETA, time and distance left, current speed, route overview, re-center after panning, mute. Keeps the screen awake.
- **Preview drive**: the same navigation, fed by a simulated GPS that drives the route at 1×/3×/10×. Handy for checking a route, and for testing on a desktop
- **Street names drivers know**: OSM names in Cambodia are Khmer, but most Phnom Penh streets carry their number (e.g. "មហាវិថី ព្រះសីហនុ (២៧៤)"). Those become "St 274" on screen and "Street 274" in the voice; national roads become "NR 4"

## Data sources

| What | Source | Notes |
|---|---|---|
| Map + buildings | [OpenFreeMap](https://openfreemap.org) (OpenStreetMap, OpenMapTiles schema) | Free, no API key. Buildings without a height get a default estimate |
| Elevation | AWS Terrain Tiles (Terrarium) | ~30 m in Cambodia |
| Satellite imagery | [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a4) | Keyless, attribution shown. Production use needs an ArcGIS developer account (free tier) or another imagery provider |
| Search | [Photon](https://photon.komoot.io) (OpenStreetMap) | Free public API, fair use |
| Routing | [OSRM](https://project-osrm.org) public demo server | Free, rate-limited, **not for production**. Set `NEXT_PUBLIC_OSRM_URL` to a hosted/self-run OSRM before launch |
| Map engine | [MapLibre GL JS](https://maplibre.org) v6 (pinned in package.json) | Same styles work later in MapLibre Android/iOS SDKs |
| 3D car | [Three.js](https://threejs.org), rendered as a MapLibre custom layer | Loaded only with the navigation code, when directions open |
| Voice | Browser speech synthesis (Web Speech API) | English voice; uses whatever voices the phone has |
| App framework | [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript | The map renders client-side only |

## Project layout

```
app/layout.tsx            page shell, fonts, metadata
app/page.tsx              home route → map
app/globals.css           holographic theme, panels, HUD, phone layout
components/MapLoader.tsx  loads the map in the browser only (ssr: false)
components/MapApp.tsx     map setup, state, clicks, directions, starting navigation
components/Navigation.tsx navigation screen: banner, turn list, ETA bar, speed, controls
components/SearchBox.tsx  search field with results (also used for From/To)
components/ExplorePanel.tsx, PlaceCard.tsx, DirectionsPanel.tsx, ControlDock.tsx
components/icons.tsx      inline SVG icons, turn arrows
lib/theme.ts              Day / Dusk map palettes (land use, roads, facades, roofs)
lib/mapStyle.ts           loads the OpenFreeMap style, recolours it, adds land use, centre lines, satellite
lib/mapLayers.ts          terrain, buildings, landmarks, route + turn-arrow layers, light, sky
lib/buildingTextures.ts   facade and glass-tower textures, drawn on a canvas
lib/buildingParts.ts      splits merged tile buildings into single buildings (see below)
lib/landmarks.ts          hand-modelled landmark geometry
lib/routing.ts            OSRM client, turn instructions (screen + voice), road names
lib/search.ts             Photon client
lib/nav/session.ts        navigation engine: snaps GPS to the route, glides the car between
                          fixes, voice timing, off-route detection and rerouting
lib/nav/location.ts       GPS source + simulated GPS (preview drive)
lib/nav/camera.ts         follow / overview camera
lib/nav/voice.ts          spoken instructions
lib/nav/carModel.ts, vehicleLayer.ts  Three.js car, drawn in MapLibre's WebGL context
lib/geo.ts, lib/format.ts geometry and formatting helpers
lib/places.ts             Explore presets (edit to add places)
scripts/copy-maplibre-worker.mjs  copies MapLibre's web worker into public/
docs/PROJECT_NOTES.md     decisions and roadmap
```

**MapLibre worker:** v6 loads its web worker from a separate file, which the Next.js bundler doesn't ship. An npm hook copies it to `public/maplibre-gl-worker.mjs` (gitignored) on install, dev and build, and `MapApp.tsx` points MapLibre at it with `setWorkerUrl()`.

**Per-building looks:** OpenFreeMap merges every building of the same height in a tile into one feature, and most Cambodian buildings have no height in OSM, so hundreds of buildings arrive as one shape that style rules can only colour as a whole. `lib/buildingParts.ts` fetches the same z14 tiles (served from the browser cache), splits them into single buildings, clips each to its tile, and gives each a stable random value that picks its facade and roof. Zoomed out, or until the tile under the camera is split, the plain tile buildings show instead.

**CSS note:** write `backdrop-filter` without the `-webkit-` copy. Next's CSS optimizer adds the Safari prefix itself; writing both makes it keep only the prefixed one, which breaks the blur in Chrome.
