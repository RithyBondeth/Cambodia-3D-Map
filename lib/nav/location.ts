import { offset, type LngLat } from '../geo';
import type { Route } from '../routing';

export type Fix = {
  pos: LngLat;
  speed: number | null;   // m/s, null when the device doesn't know
  heading: number | null; // degrees clockwise from north, null when standing still
  accuracy: number;       // metres
};

export interface LocationSource {
  start(onFix: (fix: Fix) => void, onError: (message: string, fatal: boolean) => void): void;
  stop(): void;
}

const known = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);

// The device's GPS. Needs a secure origin (https or localhost).
export class GpsSource implements LocationSource {
  private id: number | null = null;

  start(onFix: (fix: Fix) => void, onError: (message: string, fatal: boolean) => void) {
    if (!('geolocation' in navigator)) {
      onError('Location isn’t available in this browser.', true);
      return;
    }
    this.id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const speed = known(coords.speed);
        onFix({
          pos: [coords.longitude, coords.latitude],
          speed,
          heading: speed !== null && speed > 0.8 ? known(coords.heading) : null,
          accuracy: coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) onError('Location is turned off for this site. Allow location access to navigate.', true);
        else onError('Searching for GPS signal…', false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  }

  stop() {
    if (this.id !== null) navigator.geolocation.clearWatch(this.id);
    this.id = null;
  }
}

// A pretend GPS that drives the route at OSRM's expected speeds, easing off
// for turns, one fix per second like a phone. Used for the route preview, so
// the preview runs through exactly the same navigation code as a real drive.
export class SimulatedSource implements LocationSource {
  rate = 1;      // × real time
  paused = false;
  private along = 0;
  private timer = 0;
  private onFix: ((fix: Fix) => void) | null = null;

  constructor(private route: Route) {}

  start(onFix: (fix: Fix) => void) {
    this.onFix = onFix;
    this.emit();
    this.timer = window.setInterval(() => {
      if (this.paused) return;
      this.along = Math.min(this.along + this.speedAt(this.along) * this.rate, this.route.path.length);
      this.emit();
    }, 1000);
  }

  stop() {
    clearInterval(this.timer);
    this.onFix = null;
  }

  // After a reroute, carry on along the new route from where we are.
  follow(route: Route) {
    const here = this.route.path.pointAt(this.along);
    this.route = route;
    this.along = route.path.project(here).along;
  }

  private speedAt(d: number) {
    const { path, times, steps } = this.route;
    // Average speed over the next 30 m of road.
    const dt = path.valueAt(times, d + 30) - path.valueAt(times, d);
    let speed = dt > 0 ? Math.min(30 / dt, 25) : 8;
    for (const s of steps) {
      if (s.type === 'depart' || s.type === 'arrive' || s.modifier === 'straight' || s.modifier?.startsWith('slight')) continue;
      speed = Math.min(speed, 5 + Math.max(0, Math.abs(s.at - d) - 8) * 0.3);
    }
    return Math.max(speed, 3);
  }

  private emit() {
    const { path } = this.route;
    const heading = path.bearingAt(this.along);
    // A metre or two of sideways wobble, like real GPS.
    const wobble = (Math.random() - 0.5) * 3;
    const r = (heading * Math.PI) / 180;
    const moving = this.along < path.length && !this.paused;
    this.onFix?.({
      pos: offset(path.pointAt(this.along), Math.cos(r) * wobble, -Math.sin(r) * wobble),
      speed: moving ? this.speedAt(this.along) : 0,
      heading: moving ? heading : null,
      accuracy: 5,
    });
  }
}
