'use client';

import { useState } from 'react';
import type { Theme } from '@/lib/theme';
import { CubeIcon, LayersIcon, LocateIcon, MinusIcon, MoonIcon, PlusIcon, SunIcon } from './icons';

type Props = {
  theme: Theme;
  bearing: number;
  is3D: boolean;
  buildings: boolean;
  terrain: boolean;
  exaggeration: number;
  onTheme: (t: Theme) => void;
  onZoom: (dir: 1 | -1) => void;
  onNorth: () => void;
  on3D: () => void;
  onLocate: () => void;
  onBuildings: (v: boolean) => void;
  onTerrain: (v: boolean) => void;
  onExaggeration: (v: number) => void;
};

export default function ControlDock(p: Props) {
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <div className="dock">
      <div className="dock-group glass">
        <button className="icon-btn" aria-label="Zoom in" onClick={() => p.onZoom(1)}><PlusIcon /></button>
        <button className="icon-btn" aria-label="Zoom out" onClick={() => p.onZoom(-1)}><MinusIcon /></button>
      </div>

      <div className="dock-group glass">
        <button className="icon-btn" aria-label="Reset north" title="Reset north" onClick={p.onNorth}>
          <span className="compass" style={{ transform: `rotate(${-p.bearing}deg)` }}>
            <span className="needle-n" /><span className="needle-s" />
          </span>
        </button>
        <button className={`icon-btn text ${p.is3D ? 'on' : ''}`} aria-label="Toggle 3D view" onClick={p.on3D}>
          {p.is3D ? '3D' : '2D'}
        </button>
        <button className="icon-btn" aria-label="Show my location" onClick={p.onLocate}><LocateIcon /></button>
      </div>

      <div className="dock-group glass">
        <button className="icon-btn" aria-label={p.theme === 'day' ? 'Switch to dusk' : 'Switch to day'} onClick={() => p.onTheme(p.theme === 'day' ? 'dusk' : 'day')}>
          {p.theme === 'day' ? <MoonIcon /> : <SunIcon />}
        </button>
        <button className={`icon-btn ${layersOpen ? 'on' : ''}`} aria-label="Layers" aria-expanded={layersOpen} onClick={() => setLayersOpen((o) => !o)}>
          <LayersIcon />
        </button>
      </div>

      {layersOpen && (
        <div className="layers glass">
          <span className="eyebrow">Layers</span>
          <label className="switch">
            <span><CubeIcon width={16} height={16} /> 3D buildings</span>
            <input type="checkbox" checked={p.buildings} onChange={(e) => p.onBuildings(e.target.checked)} />
            <i />
          </label>
          <label className="switch">
            <span>Terrain</span>
            <input type="checkbox" checked={p.terrain} onChange={(e) => p.onTerrain(e.target.checked)} />
            <i />
          </label>
          <label className="slider">
            <span>Terrain height <b>{p.exaggeration}×</b></span>
            <input
              type="range" min={1} max={10} step={0.5} value={p.exaggeration}
              disabled={!p.terrain}
              onChange={(e) => p.onExaggeration(Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
}
