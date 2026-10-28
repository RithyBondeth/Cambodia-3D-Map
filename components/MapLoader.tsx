'use client';

import dynamic from 'next/dynamic';

// MapLibre needs WebGL and `window`, so the map renders in the browser only.
const MapApp = dynamic(() => import('./MapApp'), { ssr: false });

export default function MapLoader() {
  return <MapApp />;
}
