'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Route, Step } from '@/lib/routing';
import { POI_LAYERS, setManeuverArrow, setTraveled } from '@/lib/mapLayers';
import { NavSession, type NavStatus } from '@/lib/nav/session';
import { GpsSource, SimulatedSource } from '@/lib/nav/location';
import { NavCamera, type CameraMode } from '@/lib/nav/camera';
import { Voice } from '@/lib/nav/voice';
import { createVehicleLayer, VEHICLE_LAYER_ID } from '@/lib/nav/vehicleLayer';
import { formatArrival, formatDistance, formatDuration } from '@/lib/format';
import type { Endpoint } from './DirectionsPanel';
import { ManeuverIcon, MuteIcon, NavigateIcon, PauseIcon, PlayIcon, RouteIcon, SoundIcon } from './icons';

const RATES = [1, 3, 10];

type Props = {
  map: MapLibreMap;
  route: Route;
  destination: Endpoint;
  simulate: boolean; // replay the route with a pretend GPS instead of the real one
  onRoute: (route: Route) => void;
  onExit: () => void;
};

type Controls = { session: NavSession; camera: NavCamera; voice: Voice; sim: SimulatedSource | null };

// What the banner says for a step; "arrive" reads differently before you get there.
function headline(step: Step) {
  if (step.type !== 'arrive') return step.instruction;
  return step.modifier === 'left' || step.modifier === 'right' ? `Destination on the ${step.modifier}` : 'Arrive at your destination';
}

export default function Navigation({ map, route, destination, simulate, onRoute, onExit }: Props) {
  const [status, setStatus] = useState<NavStatus | null>(null);
  const [camera, setCamera] = useState<CameraMode>('follow');
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(3);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<{ text: string; fatal: boolean } | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const ctl = useRef<Controls | null>(null);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  useEffect(() => {
    const voice = new Voice();
    const sim = simulate ? new SimulatedSource(route) : null;
    if (sim) sim.rate = 3;
    const cam = new NavCamera(map);
    const vehicle = createVehicleLayer(map);
    map.addLayer(vehicle.layer);
    // Shop and café icons are noise at the wheel; street names and the route stay.
    const showPois = (on: boolean) => {
      for (const id of POI_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    };
    showPois(false);

    let latest: NavStatus | null = null;
    let arrowFor: { route: Route; step: number; arrived: boolean } | null = null;
    let trailAt = 0;
    let noticeTimer = 0;

    const session = new NavSession(route, destination.center, sim ?? new GpsSource(), voice, {
      onFrame(pose, dt) {
        vehicle.update(pose, dt);
        cam.update(pose, dt, latest?.toStep ?? Infinity);
        const now = performance.now();
        if (now - trailAt > 200) {
          trailAt = now;
          setTraveled(map, session.currentRoute.path.sliceTo(pose.along));
        }
      },
      onStatus(s) {
        latest = s;
        setStatus(s);
        // Repaint the turn arrow only when the manoeuvre changes.
        if (arrowFor?.route !== s.route || arrowFor.step !== s.stepIndex || arrowFor.arrived !== s.arrived) {
          arrowFor = { route: s.route, step: s.stepIndex, arrived: s.arrived };
          const step = s.route.steps[s.stepIndex];
          setManeuverArrow(map, s.arrived || step.type === 'arrive' ? [] : s.route.path.slice(step.at - 30, step.at + 22));
        }
      },
      onRoute(r) {
        onRouteRef.current(r);
        sim?.follow(r);
      },
      onError(text, fatal) {
        clearTimeout(noticeTimer);
        setNotice({ text, fatal });
        if (!fatal) noticeTimer = window.setTimeout(() => setNotice(null), 6000);
      },
    });
    session.timeScale = sim?.rate ?? 1;
    ctl.current = { session, camera: cam, voice, sim };

    // Dragging or pinching the map lets you look around; "Re-center" brings the camera back.
    const onMoveStart = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent && cam.mode !== 'free') {
        cam.mode = 'free';
        setCamera('free');
      }
    };
    map.on('movestart', onMoveStart);

    // Keep the screen awake while driving.
    let lock: WakeLockSentinel | null = null;
    const keepAwake = () => {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {});
      }
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);

    session.start();
    if (process.env.NODE_ENV !== 'production') (window as unknown as { nav: NavSession }).nav = session;

    return () => {
      session.stop();
      voice.dispose();
      clearTimeout(noticeTimer);
      map.off('movestart', onMoveStart);
      document.removeEventListener('visibilitychange', keepAwake);
      void lock?.release().catch(() => {});
      if (map.getLayer(VEHICLE_LAYER_ID)) map.removeLayer(VEHICLE_LAYER_ID);
      showPois(true);
      setManeuverArrow(map, []);
      setTraveled(map, []);
      map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      ctl.current = null;
    };
    // One session per mount: the route it starts with, then its own reroutes.
  }, [map]);

  function recenter() {
    ctl.current?.camera.follow();
    setCamera('follow');
  }

  function overview() {
    const c = ctl.current;
    if (!c || !status) return;
    const { path } = status.route;
    c.camera.overview(path.slice(path.length - status.remaining, path.length));
    setCamera('overview');
  }

  function toggleMute() {
    ctl.current?.voice.setMuted(!muted);
    setMuted(!muted);
  }

  function changeRate(r: number) {
    setRate(r);
    const c = ctl.current;
    if (!c?.sim) return;
    c.sim.rate = r;
    c.session.timeScale = r;
  }

  function togglePause() {
    const sim = ctl.current?.sim;
    if (!sim) return;
    sim.paused = !sim.paused;
    setPaused(sim.paused);
  }

  const steps = status?.route.steps ?? route.steps;
  const step = status ? steps[status.stepIndex] : steps[1] ?? steps[0];
  const next = status && !status.arrived ? steps[status.stepIndex + 1] : undefined;
  const thenSoon = next && step && next.at - step.at < 150;
  const along = status ? status.route.path.length - status.remaining : 0;
  const lost = status && (status.offRoute || status.rerouting) && !status.arrived;
  const searching = !simulate && !status?.located && !notice?.fatal;

  let banner;
  if (notice?.fatal) {
    banner = (
      <div className="nav-banner is-alert" role="alert">
        <div className="nav-text"><span className="nav-instr">{notice.text}</span></div>
      </div>
    );
  } else if (searching) {
    banner = (
      <div className="nav-banner" role="status">
        <span className="nav-maneuver"><span className="spinner light" /></span>
        <div className="nav-text">
          <span className="nav-dist small">Finding your location…</span>
          <span className="nav-sub">Make sure location is on and you can see the sky.</span>
        </div>
      </div>
    );
  } else if (lost) {
    banner = (
      <div className="nav-banner is-rerouting" role="status" aria-live="polite">
        <span className="nav-maneuver"><span className="spinner light" /></span>
        <div className="nav-text">
          <span className="nav-dist small">Rerouting…</span>
          <span className="nav-sub">Finding a new way to {destination.label}</span>
        </div>
      </div>
    );
  } else if (status?.arrived) {
    banner = (
      <div className="nav-banner is-arrived" role="status" aria-live="polite">
        <span className="nav-maneuver"><ManeuverIcon type="arrive" width={34} height={34} strokeWidth={2.2} /></span>
        <div className="nav-text">
          <span className="nav-dist small">You’ve arrived</span>
          <span className="nav-sub">{destination.label}</span>
        </div>
      </div>
    );
  } else if (step) {
    banner = (
      <button className="nav-banner" aria-expanded={showSteps} aria-label="Show upcoming turns" onClick={() => setShowSteps((s) => !s)}>
        <span className="nav-maneuver"><ManeuverIcon type={step.type} modifier={step.modifier} width={38} height={38} strokeWidth={2.3} /></span>
        <span className="nav-text">
          <span className="nav-dist">{formatDistance(status?.toStep ?? step.at)}</span>
          <span className="nav-instr">{headline(step)}</span>
          {step.roadLocal && <span className="nav-sub">{step.roadLocal}</span>}
        </span>
        {thenSoon && next && (
          <span className="nav-then">Then <ManeuverIcon type={next.type} modifier={next.modifier} width={18} height={18} /></span>
        )}
      </button>
    );
  }

  return (
    <div className="nav">
      <div className="nav-top">
        {banner}
        {showSteps && status && !lost && !status.arrived && (
          <ol className="nav-steps glass">
            {steps.slice(status.stepIndex + 1).map((s, i) => (
              <li key={i} className="step">
                <span className="step-icon"><ManeuverIcon type={s.type} modifier={s.modifier} width={18} height={18} /></span>
                <span className="step-text">{headline(s)}</span>
                <span className="step-dist">{formatDistance(s.at - along)}</span>
              </li>
            ))}
          </ol>
        )}
        {status?.located && status.weakSignal && !status.arrived && <span className="nav-chip glass">Weak GPS signal</span>}
      </div>

      <div className="nav-bar glass">
        {/* Pinned to the bar, so they clear it however tall it grows. */}
        {camera !== 'follow' && (
          <button className="nav-recenter glass" onClick={recenter}><NavigateIcon width={18} height={18} /> Re-center</button>
        )}
        {status?.located && !status.arrived && (
          <div className="nav-speed glass" aria-label={`Speed ${Math.round(status.speed * 3.6)} kilometres per hour`}>
            <b>{Math.round(status.speed * 3.6)}</b>
            <span>km/h</span>
          </div>
        )}
        <div className="nav-eta">
          <b>{status?.arrived ? 'Arrived' : formatArrival(status?.remainingTime ?? route.duration)}</b>
          <span className="muted">
            {status?.arrived
              ? destination.label
              : `${formatDuration(status?.remainingTime ?? route.duration)} · ${formatDistance(status?.remaining ?? route.distance)}`}
          </span>
        </div>
        {simulate && !status?.arrived && (
          <div className="nav-sim">
            <span className="badge">Preview</span>
            <div className="seg" role="group" aria-label="Preview speed">
              {RATES.map((r) => (
                <button key={r} className={r === rate ? 'active' : ''} onClick={() => changeRate(r)}>{r}×</button>
              ))}
            </div>
            <button className="icon-btn" aria-label={paused ? 'Resume preview' : 'Pause preview'} onClick={togglePause}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          </div>
        )}
        <div className="nav-actions">
          {!status?.arrived && (
            <button
              className={`icon-btn ${camera === 'overview' ? 'on' : ''}`}
              aria-label={camera === 'overview' ? 'Back to driving view' : 'Route overview'}
              title={camera === 'overview' ? 'Back to driving view' : 'Route overview'}
              onClick={camera === 'overview' ? recenter : overview}
            >
              {camera === 'overview' ? <NavigateIcon /> : <RouteIcon />}
            </button>
          )}
          <button className="icon-btn" aria-label={muted ? 'Unmute voice' : 'Mute voice'} title={muted ? 'Unmute voice' : 'Mute voice'} onClick={toggleMute}>
            {muted ? <MuteIcon /> : <SoundIcon />}
          </button>
          <button className={`btn ${status?.arrived ? 'primary' : 'end'}`} onClick={onExit}>{status?.arrived ? 'Done' : 'End'}</button>
        </div>
      </div>

      {notice && !notice.fatal && <div className="toast glass nav-toast" role="status">{notice.text}</div>}
    </div>
  );
}
