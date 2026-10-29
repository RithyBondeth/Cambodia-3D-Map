# Project notes

Started 28 Oct 2026 from a planning chat with Claude.

## Goal

A 3D map of Cambodia: real terrain countrywide, 3D buildings in cities, eventually with a stylised "navigation" look like Google Maps immersive view.

## Decisions so far

- **Web first, phone-first design.** One codebase, shareable by link, fastest to iterate. Most Cambodian users are on mid-range Android phones, so keep the 3D light. Go native (MapLibre Android/iOS SDK, same styles) only if we need live GPS navigation, offline maps, or better performance on cheap phones.
- **Building realism, three levels:**
  1. Extruded boxes from OSM footprints (v0.1, done)
  2. Stylised navigation look: themed colours, glowing route, car marker, trees, raised flyovers using OSM bridge/layer tags
  3. Photorealistic: Google Photorealistic 3D Tiles (paid API key; Cambodia coverage unconfirmed, check in Google Earth) or drone photogrammetry for specific landmarks
- **Next.js + TypeScript (28 Oct 2026).** Moved off the CDN + plain-JS setup to Next.js 16 (App Router), React 19 and TypeScript, with MapLibre installed from npm. Chosen to leave room for indexable place pages, server-side features (e.g. storing corrected building heights) and accounts. The map itself is a client-only component.
- **MapLibre v6.** Upgraded from 5.x during the move because npm audit flagged a critical XSS advisory (GHSA-jrc7-96c5-q579) for every release up to 6.4.0.
- **Holographic redesign + directions (28 Oct 2026).**
  - Buildings: stylised OSM rather than Google Photorealistic 3D Tiles, which need a paid key and have unconfirmed Cambodia coverage.
  - Look: holographic light, with a dusk variant.
  - Routing: the OSRM public demo server; search uses Photon. Both are free and keyless.
  - Google Places data can't be used here: Google's terms don't allow showing it on a non-Google map, so place detail comes from OpenStreetMap.
- **Free drive (28 Oct 2026).**
  - You drive a low-poly sports car, built in code with Three.js, rather than a tuk-tuk or a fly-around drone.
  - Physics is arcade-style. Buildings are solid, using OSM footprints from the loaded vector tiles.
  - Road widths were raised to real metres at close zoom so streets aren't narrower than the car.
- **Navigation instead of a game (29 Oct 2026).** The aim is a map people use to drive from where they are to where they're going, with a 3D view of the real route. Free drive was removed (it's in git history: PR #5).
  - Live GPS turn-by-turn in the browser: route snapping, rerouting, voice prompts, wake lock. The 3D car from free drive was reused as the position marker, restyled and kept at a steady size on screen.
  - The old playback preview now runs through the same engine with a simulated GPS. What you preview is what you'll get, and it can be tested on a desktop.
  - Khmer OSM street names carry Phnom Penh street numbers, which give "St 274" for the screen and "Street 274" for an English voice. A Khmer voice isn't offered: few phones have one.
- **Terrain needs exaggeration.** Highest peak (Phnom Aural) is ~1,800 m and the central plain is near sea level, so a 5–20× option is useful for country views.

## Known limits

- Many Cambodian buildings in OSM have no height; they show a default estimate. Key towers should be checked and corrected.
- No lane-level road data for Cambodia, so Google-style lane detail is out of reach without surveying.
- No live traffic, speed limits or speed cameras: OSRM's demo server has no traffic, and OSM in Cambodia rarely has `maxspeed`.
- A browser tab only gets GPS while it's open and on screen (no background navigation), and only over https.
- Khmer labels render, but MapLibre doesn't do complex text shaping, so stacked consonants are likely drawn incorrectly. Needs checking by a Khmer reader.

## Roadmap

- [ ] Verify / fix heights of major Phnom Penh towers
- [x] Glowing route line, animated car (3D drive)
- [ ] 3D trees
- [x] Live GPS turn-by-turn navigation with voice and rerouting
- [ ] Move routing off the OSRM demo server before launch (self-hosted OSRM or Valhalla with a Cambodia extract)
- [ ] Night mode that switches on automatically while driving after dark
- [ ] Lane hints and speed limits where OSM has them
- [ ] Motorbike / tuk-tuk routing profiles (most Phnom Penh traffic)
- [ ] Saved places (home, work) and recent destinations
- [ ] Installable PWA; native app if background navigation is needed
- [ ] Province boundaries and names (EN + Khmer)
- [ ] Khmer labels (self-hosted glyphs with Noto Sans Khmer)
- [x] Landmark models: Independence Monument, Angkor Wat
- [ ] More landmarks: Royal Palace, Wat Phnom, Bayon
- [ ] Deploy (e.g. Cloudflare Pages / Vercel) and test on mid-range Android
