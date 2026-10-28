'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { GameSession, type GameHud } from '@/lib/game/session';
import { Controls } from '@/lib/game/input';
import { EngineAudio } from '@/lib/game/audio';
import { BoltIcon, CloseIcon, MuteIcon, ResetIcon, SoundIcon } from './icons';

const MAX_KMH = 160;
const START: GameHud = { kmh: 0, gear: 'N', boost: 1, boosting: false, drifting: false, street: '', topKmh: 0, km: 0, crashes: 0 };

// Speedometer arc: 270° sweep starting bottom-left.
function arc(fraction: number, r = 58) {
  const start = 135, sweep = 270 * Math.max(0.001, Math.min(1, fraction));
  const a0 = (start * Math.PI) / 180, a1 = ((start + sweep) * Math.PI) / 180;
  const p = (a: number) => `${70 + r * Math.cos(a)} ${70 + r * Math.sin(a)}`;
  return `M ${p(a0)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${p(a1)}`;
}

// Keep receiving moves when the finger slides off the control.
function capture(e: ReactPointerEvent) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // pointer already gone
  }
}

function Joystick({ controls }: { controls: Controls }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const R = 46;

  function move(e: ReactPointerEvent) {
    const rect = base.current!.getBoundingClientRect();
    let x = e.clientX - (rect.left + rect.width / 2);
    let y = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(x, y);
    if (len > R) { x = (x / len) * R; y = (y / len) * R; }
    setKnob({ x, y });
    controls.touch.x = x / R;
    controls.touch.y = y / R;
  }
  function release() {
    setKnob({ x: 0, y: 0 });
    controls.touch.x = 0;
    controls.touch.y = 0;
  }

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => { capture(e); move(e); }}
      onPointerMove={(e) => e.buttons && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
      aria-label="Steering and throttle"
    >
      <span className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function HoldButton({ label, onHold, className, children }: { label: string; onHold: (on: boolean) => void; className: string; children: React.ReactNode }) {
  return (
    <button
      className={`hold-btn ${className}`}
      aria-label={label}
      onPointerDown={(e) => { capture(e); onHold(true); }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function GameMode({ map, onExit }: { map: MapLibreMap; onExit: () => void }) {
  const [hud, setHud] = useState<GameHud>(START);
  const [muted, setMuted] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [crash, setCrash] = useState(0);
  const [touch, setTouch] = useState(false);
  const session = useRef<GameSession | null>(null);
  const controls = useRef<Controls | null>(null);
  const audio = useRef<EngineAudio | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  function toggleMute() {
    const a = audio.current;
    if (!a) return;
    a.setMuted(!a.isMuted);
    setMuted(a.isMuted);
  }

  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    const c = new Controls((key) => {
      if (key === 'escape') exitRef.current();
      else if (key === 'r') session.current?.reset();
      else if (key === 'm') toggleMute();
      else if (key !== 'shift') setShowHelp(false);
    });
    controls.current = c;
    try {
      audio.current = new EngineAudio();
      audio.current.resume();
    } catch {
      audio.current = null; // no Web Audio: drive silently
    }
    const s = new GameSession(map, c, audio.current, setHud, () => setCrash(Date.now()));
    session.current = s;
    s.start();
    const t = setTimeout(() => setShowHelp(false), 9000);
    return () => {
      clearTimeout(t);
      s.stop();
      c.dispose();
      audio.current?.dispose();
      audio.current = null;
      session.current = null;
    };
  }, [map]);

  const speedFx = hud.boosting ? 1 : Math.max(0, Math.min(1, (hud.kmh - 55) / 60));

  return (
    <div className="game" onPointerDown={() => audio.current?.resume()}>
      <div className="speedlines" style={{ opacity: speedFx }} aria-hidden="true" />
      {crash > 0 && <div key={crash} className="crash-flash" aria-hidden="true" />}

      <div className="game-top">
        <div className="game-badge glass">
          <span className="brand-orb small" aria-hidden="true" />
          <span>
            <span className="eyebrow">Free drive</span>
            <span className="game-street">{hud.street || 'Phnom Penh'}</span>
          </span>
        </div>
        <div className="game-actions glass">
          <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} title="Sound (M)" onClick={toggleMute}>
            {muted ? <MuteIcon /> : <SoundIcon />}
          </button>
          <button className="icon-btn" aria-label="Reset car" title="Reset (R)" onClick={() => session.current?.reset()}><ResetIcon /></button>
          <button className="icon-btn danger" aria-label="Exit drive mode" title="Exit (Esc)" onClick={onExit}><CloseIcon /></button>
        </div>
      </div>

      {hud.drifting && <div className="drift-tag">DRIFT</div>}

      <div className="game-stats glass">
        <div><span>Top</span><b>{Math.round(hud.topKmh)}</b><small>km/h</small></div>
        <div><span>Driven</span><b>{hud.km.toFixed(2)}</b><small>km</small></div>
        <div><span>Crashes</span><b>{hud.crashes}</b></div>
      </div>

      <div className={`speedo ${hud.boosting ? 'is-boosting' : ''}`}>
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <defs>
            <linearGradient id="speedo-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#22d3ee" />
              <stop offset="0.55" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <path d={arc(1)} className="speedo-track" />
          <path d={arc(hud.kmh / MAX_KMH)} className="speedo-value" stroke="url(#speedo-grad)" />
        </svg>
        <div className="speedo-read">
          <b>{Math.round(hud.kmh)}</b>
          <span>km/h</span>
          <i className="gear">{hud.gear}</i>
        </div>
        <div className="boost-meter" aria-label={`Boost ${Math.round(hud.boost * 100)}%`}>
          <BoltIcon width={14} height={14} />
          <span><i style={{ width: `${hud.boost * 100}%` }} /></span>
        </div>
      </div>

      {showHelp && !touch && (
        <div className="game-help glass">
          <div><kbd>W</kbd><kbd>↑</kbd> Drive</div>
          <div><kbd>S</kbd><kbd>↓</kbd> Brake / reverse</div>
          <div><kbd>A</kbd><kbd>D</kbd> Steer</div>
          <div><kbd>Shift</kbd> Boost</div>
          <div><kbd>Space</kbd> Drift</div>
          <div><kbd>R</kbd> Reset · <kbd>Esc</kbd> Exit</div>
        </div>
      )}

      {touch && controls.current && (
        <>
          <Joystick controls={controls.current} />
          <div className="touch-buttons">
            <HoldButton label="Drift" className="drift" onHold={(on) => { if (controls.current) controls.current.touch.drift = on; }}>
              DRIFT
            </HoldButton>
            <HoldButton label="Boost" className="boost" onHold={(on) => { if (controls.current) controls.current.touch.boost = on; }}>
              <BoltIcon width={26} height={26} />
            </HoldButton>
          </div>
        </>
      )}
    </div>
  );
}
