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
- **Terrain needs exaggeration.** Highest peak (Phnom Aural) is ~1,800 m and the central plain is near sea level, so a 5–20× option is useful for country views.

## Known limits

- Many Cambodian buildings in OSM have no height; they show a default estimate. Key towers should be checked and corrected.
- No lane-level road data for Cambodia, so Google-style lane detail is out of reach without surveying.
- Map label fonts may not render Khmer script; needs a Khmer-capable glyph server.

## Roadmap

- [ ] Verify / fix heights of major Phnom Penh towers
- [ ] Night "navigation" theme: glowing route line, animated car, 3D trees
- [ ] Province boundaries and names (EN + Khmer)
- [ ] Khmer labels (self-hosted glyphs with Noto Sans Khmer)
- [ ] Detailed landmark models (Royal Palace, Angkor Wat)
- [ ] Deploy (e.g. Cloudflare Pages / Vercel) and test on mid-range Android
