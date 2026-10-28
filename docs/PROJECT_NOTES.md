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
- **Terrain needs exaggeration.** Highest peak (Phnom Aural) is ~1,800 m and the central plain is near sea level, so a 5–20× option is useful for country views.

## Known limits

- Many Cambodian buildings in OSM have no height; they show a default estimate. Key towers should be checked and corrected.
- No lane-level road data for Cambodia, so Google-style lane detail is out of reach without surveying.
- Khmer labels render, but MapLibre doesn't do complex text shaping, so stacked consonants are likely drawn incorrectly. Needs checking by a Khmer reader.

## Roadmap

- [ ] Verify / fix heights of major Phnom Penh towers
- [ ] Night "navigation" theme: glowing route line, animated car, 3D trees
- [ ] Province boundaries and names (EN + Khmer)
- [ ] Khmer labels (self-hosted glyphs with Noto Sans Khmer)
- [ ] Detailed landmark models (Royal Palace, Angkor Wat)
- [ ] Deploy (e.g. Cloudflare Pages / Vercel) and test on mid-range Android
