'use client';

import type { ReactNode } from 'react';
import type { LngLat } from '@/lib/geo';
import { BuildingIcon, CloseIcon, DirectionsIcon, OrbitIcon, PinIcon, TempleIcon } from './icons';

export type PlaceInfo = {
  kind: 'building' | 'landmark' | 'place' | 'pin';
  title: string;
  subtitle?: string;
  category?: string;
  facts?: { label: string; value: string }[];
  center: LngLat;
};

const KIND: Record<PlaceInfo['kind'], { label: string; icon: ReactNode }> = {
  building: { label: 'Building', icon: <BuildingIcon /> },
  landmark: { label: '3D landmark', icon: <TempleIcon /> },
  place: { label: 'Place', icon: <PinIcon /> },
  pin: { label: 'Dropped pin', icon: <PinIcon /> },
};

type Props = {
  place: PlaceInfo;
  onClose: () => void;
  onDirections: () => void;
  onOrbit: () => void;
};

export default function PlaceCard({ place, onClose, onDirections, onOrbit }: Props) {
  const kind = KIND[place.kind];
  return (
    <div className="place">
      <div className="place-head">
        <span className="place-glyph">{kind.icon}</span>
        <div className="place-titles">
          <span className="eyebrow">{place.category || kind.label}</span>
          <h2>{place.title}</h2>
          {place.subtitle && <p className="muted">{place.subtitle}</p>}
        </div>
        <button className="icon-btn ghost" aria-label="Close" onClick={onClose}><CloseIcon /></button>
      </div>

      {place.facts && place.facts.length > 0 && (
        <dl className="facts">
          {place.facts.map((f) => (
            <div key={f.label} className="fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="actions">
        <button className="btn primary" onClick={onDirections}><DirectionsIcon /> Directions</button>
        <button className="btn" onClick={onOrbit}><OrbitIcon /> Orbit in 3D</button>
      </div>

      <p className="coords">{place.center[1].toFixed(5)}, {place.center[0].toFixed(5)}</p>
    </div>
  );
}
