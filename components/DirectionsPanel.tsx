'use client';

import { useState } from 'react';
import SearchBox, { type Extra } from './SearchBox';
import { CarIcon, ChevronIcon, CloseIcon, LocateIcon, ManeuverIcon, NavigateIcon, PlayIcon, SwapIcon } from './icons';
import type { Route } from '@/lib/routing';
import type { LngLat } from '@/lib/geo';
import type { SearchResult } from '@/lib/search';
import { formatArrival, formatDistance, formatDuration } from '@/lib/format';

// `mine`: the device's own position, which live navigation needs as its start.
export type Endpoint = { label: string; center: LngLat; mine?: boolean };

type Props = {
  from: Endpoint | null;
  to: Endpoint | null;
  routes: Route[];
  selected: number;
  loading: boolean;
  error: string;
  near: () => LngLat;
  onFrom: (e: Endpoint | null) => void;
  onTo: (e: Endpoint | null) => void;
  onSwap: () => void;
  onUseLocation: (field: 'from' | 'to') => void;
  onSelectRoute: (i: number) => void;
  onStart: (preview: boolean) => void;
  onClose: () => void;
};

const toEndpoint = (r: SearchResult): Endpoint => ({ label: r.name, center: r.center });

export default function DirectionsPanel(props: Props) {
  const { from, to, routes, selected, loading, error, near } = props;
  const [showSteps, setShowSteps] = useState(false);
  const route = routes[selected];

  const locationExtra = (field: 'from' | 'to'): Extra[] => [
    { id: 'me', label: 'Your location', icon: <LocateIcon width={16} height={16} />, onSelect: () => props.onUseLocation(field) },
  ];

  return (
    <div className="directions">
      <div className="section-head row-between">
        <div>
          <span className="eyebrow">Directions</span>
          <h2><CarIcon className="inline-icon" /> Drive</h2>
        </div>
        <button className="icon-btn ghost" aria-label="Close directions" onClick={props.onClose}><CloseIcon /></button>
      </div>

      <div className="endpoints">
        <div className="endpoint-rail" aria-hidden="true"><span className="dot start" /><span className="rail" /><span className="dot end" /></div>
        <div className="endpoint-fields">
          <SearchBox
            className="compact"
            value={from?.label ?? ''}
            placeholder="Choose starting point"
            near={near}
            onSelect={(r) => props.onFrom(toEndpoint(r))}
            onClear={() => props.onFrom(null)}
            extras={locationExtra('from')}
            leading={<span />}
          />
          <SearchBox
            className="compact"
            value={to?.label ?? ''}
            placeholder="Choose destination"
            near={near}
            onSelect={(r) => props.onTo(toEndpoint(r))}
            onClear={() => props.onTo(null)}
            extras={locationExtra('to')}
            leading={<span />}
            autoFocus={!to}
          />
        </div>
        <button className="icon-btn" aria-label="Swap start and destination" onClick={props.onSwap}><SwapIcon /></button>
      </div>

      {loading && <div className="route-skeleton"><span /><span /></div>}
      {error && !loading && <p className="error">{error}</p>}
      {!from && to && !loading && <p className="hint">Pick a starting point, or use your location.</p>}

      {!loading && routes.length > 0 && (
        <>
          <ul className="route-options">
            {routes.map((r, i) => (
              <li key={i}>
                <button className={`route-option ${i === selected ? 'is-selected' : ''}`} onClick={() => props.onSelectRoute(i)}>
                  <span className="route-time">{formatDuration(r.duration)}</span>
                  <span className="route-meta">
                    {formatDistance(r.distance)}{r.via ? ` · via ${r.via}` : ''}
                  </span>
                  {i === 0 && <span className="badge">Fastest</span>}
                </button>
              </li>
            ))}
          </ul>

          {route && (
            <>
              <p className="arrival">Arrive around <b>{formatArrival(route.duration)}</b></p>
              <div className="actions">
                {from?.mine && (
                  <button className="btn primary wide" onClick={() => props.onStart(false)}><NavigateIcon /> Start</button>
                )}
                <button className={`btn ${from?.mine ? '' : 'primary wide'}`} onClick={() => props.onStart(true)}>
                  <PlayIcon /> Preview drive
                </button>
              </div>
              {from && !from.mine && (
                <p className="hint">Live turn-by-turn navigation starts from your location. Set the start to “Your location” to drive it.</p>
              )}

              <button className="steps-toggle" onClick={() => setShowSteps((s) => !s)} aria-expanded={showSteps}>
                {route.steps.length} steps <ChevronIcon className={showSteps ? 'flip' : ''} width={16} height={16} />
              </button>
              {showSteps && (
                <ol className="steps">
                  {route.steps.map((s, i) => (
                    <li key={i} className="step">
                      <span className="step-icon"><ManeuverIcon type={s.type} modifier={s.modifier} width={18} height={18} /></span>
                      <span className="step-text">{s.instruction}</span>
                      {s.distance > 0 && <span className="step-dist">{formatDistance(s.distance)}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </>
      )}

      <p className="fineprint">Routes by OSRM on OpenStreetMap data, without live traffic. Always follow road signs and local conditions.</p>
    </div>
  );
}
