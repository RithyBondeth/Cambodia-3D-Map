'use client';

import type { ReactNode } from 'react';
import { PLACES, type Place, type PlaceKind } from '@/lib/places';
import { CityIcon, GlobeIcon, MountainIcon, NavigateIcon, TempleIcon, TowerIcon } from './icons';

const ICONS: Record<PlaceKind, ReactNode> = {
  country: <GlobeIcon />,
  city: <CityIcon />,
  landmark: <TempleIcon />,
  tower: <TowerIcon />,
  nature: <MountainIcon />,
};

export default function ExplorePanel({ onGo, onNavigate }: { onGo: (p: Place) => void; onNavigate: () => void }) {
  return (
    <div className="explore">
      <div className="section-head">
        <span className="eyebrow">Explore</span>
        <h2>Cambodia in 3D</h2>
      </div>
      <button className="drive-hero" onClick={onNavigate}>
        <span className="drive-hero-icon"><NavigateIcon width={26} height={26} /></span>
        <span className="drive-hero-text">
          <b>Where to?</b>
          <span>Turn-by-turn 3D navigation from your location</span>
        </span>
        <span className="drive-hero-cta">Go</span>
      </button>
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
