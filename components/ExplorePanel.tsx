'use client';

import type { ReactNode } from 'react';
import { PLACES, type Place, type PlaceKind } from '@/lib/places';
import { CityIcon, GlobeIcon, MountainIcon, TempleIcon, TowerIcon } from './icons';

const ICONS: Record<PlaceKind, ReactNode> = {
  country: <GlobeIcon />,
  city: <CityIcon />,
  landmark: <TempleIcon />,
  tower: <TowerIcon />,
  nature: <MountainIcon />,
};

export default function ExplorePanel({ onGo }: { onGo: (p: Place) => void }) {
  return (
    <div className="explore">
      <div className="section-head">
        <span className="eyebrow">Explore</span>
        <h2>Cambodia in 3D</h2>
      </div>
      <div className="place-grid">
        {PLACES.map((p) => (
          <button key={p.id} className={`place-tile kind-${p.kind}`} onClick={() => onGo(p)}>
            <span className="tile-icon">{ICONS[p.kind]}</span>
            <span className="tile-name">{p.name}</span>
            <span className="tile-sub">{p.subtitle}</span>
          </button>
        ))}
      </div>
      <p className="hint">
        Tap a building or place for details. Right-click or long-press the map to drop a pin.
      </p>
    </div>
  );
}
