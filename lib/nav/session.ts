import { angleDelta, bearing, distance, offset, type LngLat } from '../geo';
import { fetchRoutes, remainingTime, type Route } from '../routing';
import type { Fix, LocationSource } from './location';
import { spokenDistance, type Voice } from './voice';

export type NavStatus = {
  route: Route;
  stepIndex: number;     // the manoeuvre coming up
  toStep: number;        // metres to it
  remaining: number;     // metres to the destination
  remainingTime: number; // seconds
  speed: number;         // m/s
  located: boolean;      // at least one position fix so far
  offRoute: boolean;
  rerouting: boolean;
  arrived: boolean;
  weakSignal: boolean;
};

// Where to draw the car this frame.
export type Pose = { pos: LngLat; heading: number; speed: number; along: number };

type Handlers = {
  onFrame: (pose: Pose, dt: number) => void;
  onStatus: (status: NavStatus) => void;
  onRoute: (route: Route) => void;
  onError: (message: string, fatal: boolean) => void;
};

const ARRIVE_WITHIN = 25;  // metres before the end of the route
const JOIN_WITHIN = 150;   // metres from the route's start: still heading to it, not lost
const WEAK_ACCURACY = 60;  // metres
const STALE_AFTER = 10000; // ms without a fix
const REROUTE_GAP = 8000;  // ms between reroute requests

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
// Fraction to close per frame for an exponential ease at `rate` per second.
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// Turn-by-turn guidance: snaps GPS fixes to the route, glides the car between
// fixes, speaks instructions ahead of each turn and reroutes when you leave the route.
export class NavSession {
  timeScale = 1; // a simulated drive can run faster than real time
  private route: Route;
  private fix: Fix | null = null;
  private fixTime = 0;
  private prev: { pos: LngLat; time: number } | null = null;
  private speed = 0;
  private along = 0;       // metres along the route at the last fix
  private onRoute = false; // the last fix was on the route
  private joining = false; // near the route's start but not on it yet
  private misses = 0;      // fixes in a row away from the route
  private offRoute = false;
  private rerouting = false;
  private lastReroute = -Infinity;
  private arrived = false;
  private generation = 0;  // bumped per reroute, so instructions can be spoken again
  private spoken = new Set<string>();
  private abort: AbortController | null = null;

  // What's on screen, eased between fixes.
  private shownAlong = 0;
  private shownPos: LngLat;
  private shownHeading: number;
  private shownOnRoute = false;

  private raf = 0;
  private lastFrame = 0;
  private lastStatus = 0;

  constructor(
    route: Route,
    private destination: LngLat,
    private source: LocationSource,
    private voice: Voice,
    private handlers: Handlers,
  ) {
    this.route = route;
    this.shownPos = route.coords[0];
    this.shownHeading = route.path.bearingAt(0);
  }

  get currentRoute() {
    return this.route;
  }

  start() {
    this.source.start(this.onFix, this.handlers.onError);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.source.stop();
    this.abort?.abort();
  }

  // --- Position fixes ---

  private onFix = (fix: Fix) => {
    const now = performance.now();
    let { speed, heading } = fix;
    // Fill in speed and heading from movement when the device doesn't report them.
    if (this.prev) {
      const moved = distance(this.prev.pos, fix.pos);
      const secs = ((now - this.prev.time) / 1000) * this.timeScale;
      if (speed === null && secs > 0.2) speed = moved > 3 ? moved / secs : 0;
      if (heading === null && moved > 4 && (speed ?? 0) > 1) heading = bearing(this.prev.pos, fix.pos);
    }
    this.prev = { pos: fix.pos, time: now };
    const first = !this.fix;
    this.fix = { ...fix, speed, heading };
    this.fixTime = now;
    this.speed = speed ?? 0;
    if (!this.arrived) this.snap(first);
    this.emit();
  };

  private snap(first: boolean) {
    const fix = this.fix!;
    const path = this.route.path;
    const tolerance = clamp(fix.accuracy * 1.2, 25, 50);
    // Search just around where we were, so a parallel stretch of the same route can't capture us.
    let hit = first ? path.project(fix.pos) : path.project(fix.pos, this.along - 50, this.along + Math.max(300, this.speed * this.timeScale * 8));
    if (hit.distance > tolerance) {
      const anywhere = path.project(fix.pos);
      if (anywhere.distance <= tolerance || anywhere.distance < hit.distance) hit = anywhere;
    }

    if (hit.distance <= tolerance) {
      // GPS wanders at a standstill; don't let the car roll backwards for that.
      this.along = hit.along < this.along && this.along - hit.along < 15 ? this.along : hit.along;
      this.onRoute = true;
      this.joining = false;
      this.misses = 0;
      this.offRoute = false;
      return;
    }

    this.onRoute = false;
    // Walking to the car, leaving a car park, just rerouted from a side street…:
    // still on the way to where the route starts, not lost.
    this.joining = this.along < 30 && distance(fix.pos, path.coords[0]) < JOIN_WITHIN;
    if (this.joining) {
      this.misses = 0;
      this.offRoute = false;
      return;
    }
    if (fix.accuracy > WEAK_ACCURACY * 1.5) return; // too fuzzy to tell
    this.misses++;
    if (first || this.misses >= 2) {
      this.offRoute = true;
      void this.reroute();
    }
  }

  private async reroute() {
    const now = performance.now();
    if (this.rerouting || !this.fix || now - this.lastReroute < REROUTE_GAP / this.timeScale) return;
    this.rerouting = true;
    this.lastReroute = now;
    this.voice.say('Rerouting');
    this.emit();
    const abort = (this.abort = new AbortController());
    const from = this.fix.pos;
    try {
      let routes: Route[];
      try {
        // Prefer roads leading the way we're already driving.
        routes = await fetchRoutes(from, this.destination, { alternatives: false, heading: this.fix.heading ?? undefined, signal: abort.signal });
      } catch (e) {
        if (abort.signal.aborted) throw e;
        routes = await fetchRoutes(from, this.destination, { alternatives: false, signal: abort.signal });
      }
      this.setRoute(routes[0]);
    } catch (e) {
      if (!abort.signal.aborted) this.handlers.onError(`Couldn’t find a new route: ${(e as Error).message}`, false);
    } finally {
      this.rerouting = false;
      if (!abort.signal.aborted) this.emit();
    }
  }

  private setRoute(route: Route) {
    this.route = route;
    this.generation++;
    this.along = 0;
    this.misses = 0;
    this.offRoute = false;
    this.shownAlong = route.path.project(this.shownPos).along;
    this.shownOnRoute = false;
    this.handlers.onRoute(route);
    if (this.fix) this.snap(false);
  }

  // --- Every frame ---

  private tick = (now: number) => {
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    const path = this.route.path;

    if (this.fix) {
      // Dead-reckon from the last fix so the car keeps moving between fixes.
      const elapsed = Math.min((now - this.fixTime) / 1000, 1.5);
      const ahead = this.arrived ? 0 : this.speed * this.timeScale * elapsed;
      if (this.onRoute) {
        if (!this.shownOnRoute) this.shownAlong = path.project(this.shownPos).along;
        const target = Math.min(this.along + ahead, path.length);
        this.shownAlong += (target - this.shownAlong) * ease(5, dt);
        this.shownPos = path.pointAt(this.shownAlong);
        this.turnTowards(path.bearingAt(this.shownAlong), dt);
      } else {
        const h = ((this.fix.heading ?? this.shownHeading) * Math.PI) / 180;
        const target = offset(this.fix.pos, Math.sin(h) * ahead, Math.cos(h) * ahead);
        const k = ease(5, dt);
        this.shownPos = [this.shownPos[0] + (target[0] - this.shownPos[0]) * k, this.shownPos[1] + (target[1] - this.shownPos[1]) * k];
        if (this.fix.heading !== null) this.turnTowards(this.fix.heading, dt);
      }
      this.shownOnRoute = this.onRoute;

      if (!this.arrived && (this.onRoute || this.joining)) {
        if (this.onRoute && path.length - this.shownAlong <= ARRIVE_WITHIN) this.arrive();
        else this.guide();
      }
    }

    this.handlers.onFrame({ pos: this.shownPos, heading: this.shownHeading, speed: this.speed, along: this.shownAlong }, dt);
    if (now - this.lastStatus > 250) this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  private turnTowards(target: number, dt: number) {
    this.shownHeading = (this.shownHeading + angleDelta(this.shownHeading, target) * ease(6, dt) + 360) % 360;
  }

  // --- Voice ---

  private say(key: string, text: string, interrupt = true) {
    const k = `${this.generation}:${key}`;
    if (this.spoken.has(k)) return;
    this.spoken.add(k);
    this.voice.say(text, interrupt);
  }

  private guide() {
    const { steps } = this.route;
    const i = this.stepIndexAt(this.shownAlong);
    const step = steps[i];
    const dist = step.at - this.shownAlong;
    // Announce earlier the faster we go.
    const v = Math.max(this.speed, 7);
    const now = clamp(v * 6, 35, 110);
    const soon = clamp(v * 25, 220, 1000);

    if (!this.spoken.has(`${this.generation}:start`)) {
      this.say('start', steps[0].speech, !this.rerouting);
      this.spoken.add(`${this.generation}:${i}:continue`);
    }

    if (step.type === 'arrive') {
      if (dist <= soon && dist > now) {
        this.say(`${i}:soon`, `In ${spokenDistance(dist)}, ${step.speech.startsWith('Your destination') ? lowerFirst(step.speech.replace(' is ', ' will be ')) : 'you will arrive at your destination'}`, false);
      }
    } else if (dist <= now) {
      this.say(`${i}:now`, step.speech + this.thenPhrase(i));
    } else if (dist <= soon) {
      if (dist > now + 60) this.say(`${i}:soon`, `In ${spokenDistance(dist)}, ${lowerFirst(step.speech)}`, false);
    } else {
      this.say(`${i}:continue`, `Continue for ${spokenDistance(dist)}`, false);
    }
  }

  // ", then turn left" when the next manoeuvre comes right after this one.
  private thenPhrase(i: number) {
    const { steps } = this.route;
    const next = steps[i + 1];
    if (!next || next.at - steps[i].at > 80) return '';
    return next.type === 'arrive' ? ', then you will arrive' : `, then ${lowerFirst(next.speech)}`;
  }

  private arrive() {
    this.arrived = true;
    this.speed = 0;
    const last = this.route.steps[this.route.steps.length - 1];
    this.voice.say(last.speech.startsWith('Your destination') ? `You have arrived. ${last.speech}.` : 'You have arrived at your destination');
    this.emit();
  }

  // --- Status for the HUD ---

  private stepIndexAt(along: number) {
    const i = this.route.steps.findIndex((s) => s.at > along + 2);
    return i === -1 ? this.route.steps.length - 1 : i;
  }

  private emit() {
    this.lastStatus = performance.now();
    const { route } = this;
    const along = this.shownAlong;
    const i = this.stepIndexAt(along);
    this.handlers.onStatus({
      route,
      stepIndex: i,
      toStep: Math.max(0, route.steps[i].at - along),
      remaining: this.arrived ? 0 : Math.max(0, route.path.length - along),
      remainingTime: this.arrived ? 0 : remainingTime(route, along),
      speed: this.speed,
      located: this.fix !== null,
      offRoute: this.offRoute,
      rerouting: this.rerouting,
      arrived: this.arrived,
      weakSignal: this.fix !== null && (this.fix.accuracy > WEAK_ACCURACY || performance.now() - this.fixTime > STALE_AFTER),
    });
  }
}
