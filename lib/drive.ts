import type { Map as MapLibreMap } from 'maplibre-gl';
import { angleDelta, bearing } from './geo';
import type { Route } from './routing';

export type DriveProgress = {
  travelled: number;   // metres along the route
  remaining: number;   // metres
  remainingTime: number; // seconds at real driving speed
  stepIndex: number;   // the manoeuvre coming up next
  toNextStep: number;  // metres to it
  done: boolean;
};

// Plays a route back as a 3D drive: the camera chases the car along the
// route, turning smoothly with the road. A preview, not live GPS navigation.
export class DriveSimulation {
  speed = 10; // × real time
  private distance = 0;
  private cameraBearing: number;
  private lastFrame = 0;
  private raf = 0;
  private playing = false;

  constructor(
    private map: MapLibreMap,
    private route: Route,
    private onFrame: (pos: [number, number], heading: number, progress: DriveProgress) => void,
  ) {
    const p = route.path;
    this.cameraBearing = bearing(p.pointAt(0), p.pointAt(30));
  }

  get isPlaying() {
    return this.playing;
  }

  play() {
    if (this.playing) return;
    if (this.distance >= this.route.path.length) this.distance = 0;
    this.playing = true;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
  }

  stop() {
    this.pause();
  }

  private tick = (now: number) => {
    if (!this.playing) return;
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;

    const { path, distance: total, duration } = this.route;
    const avgSpeed = total / Math.max(duration, 1); // m/s
    this.distance = Math.min(this.distance + avgSpeed * this.speed * dt, path.length);

    const pos = path.pointAt(this.distance);
    // Look ahead so the camera turns into corners instead of snapping at them.
    const heading = bearing(path.pointAt(Math.max(this.distance - 5, 0)), path.pointAt(this.distance + 45));
    this.cameraBearing += angleDelta(this.cameraBearing, heading) * Math.min(1, dt * 2.2);

    this.map.jumpTo({ center: pos, bearing: this.cameraBearing, pitch: 70, zoom: 17.4 });

    const steps = this.route.steps;
    let stepIndex = steps.findIndex((s) => s.at > this.distance + 1);
    if (stepIndex === -1) stepIndex = steps.length - 1;
    const remaining = path.length - this.distance;
    const done = remaining <= 0.5;

    this.onFrame(pos, heading, {
      travelled: this.distance,
      remaining,
      remainingTime: duration * (remaining / path.length),
      stepIndex,
      toNextStep: Math.max(0, steps[stepIndex].at - this.distance),
      done,
    });

    if (done) this.pause();
    else this.raf = requestAnimationFrame(this.tick);
  };
}
