# Cambodia 3D Map

An interactive, mobile-friendly 3D web map of Cambodia: real terrain for the whole country and 3D buildings for cities like Phnom Penh and Siem Reap.

## Run it

```bash
npm start
# open http://localhost:5173
```

No install step: MapLibre GL loads from a CDN and map data streams from free, keyless tile servers. You need an internet connection.

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
| Map engine | [MapLibre GL JS](https://maplibre.org) v5 | Same styles work later in MapLibre Android/iOS SDKs |

## Project layout

```
index.html        page + panel markup
src/main.js       map setup, terrain, buildings, UI wiring
src/places.js     camera presets (edit to add places)
src/style.css     panel styling, phone bottom sheet
serve.mjs         tiny local server (no dependencies)
docs/PROJECT_NOTES.md   decisions and roadmap
```
