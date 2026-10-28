// MapLibre v6 loads its web worker from a separate file next to its own module.
// Bundlers move that module, so we serve the worker from public/ and point
// MapLibre at it with setWorkerUrl() (see components/MapApp.tsx).
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('public', { recursive: true });
await copyFile('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre-gl-worker.mjs');
