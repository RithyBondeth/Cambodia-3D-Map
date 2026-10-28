import type { Map as MapLibreMap } from 'maplibre-gl';
import { angleDelta, distance, offset, type LngLat } from '../geo';
import { Vehicle } from './vehicle';
import { World } from './world';
import { CAR_LAYER_ID, createCarLayer } from './carLayer';
import type { Controls } from './input';
import type { EngineAudio } from './audio';

export type GameHud = {
  kmh: number;
  gear: 'D' | 'R' | 'N';
  boost: number;     // fuel 0…1
  boosting: boolean;
  drifting: boolean;
  street: string;
  topKmh: number;
  km: number;        // distance driven
  crashes: number;
};

const INTERACTIONS = ['dragPan', 'dragRotate', 'scrollZoom', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch', 'boxZoom'] as const;

// Runs free-drive mode: physics, chase camera, car rendering and HUD updates.
export class GameSession {
  private vehicle: Vehicle;
  private world: World;
  private car: ReturnType<typeof createCarLayer>;
  private raf = 0;
  private last = 0;
  private lastHud = 0;
  private lastStreet = 0;
  private camBearing: number;
  private shake = 0;
  private prevSpeed = 0;
  private safe: { pos: LngLat; heading: number; at: number };
  private hud: GameHud = { kmh: 0, gear: 'N', boost: 1, boosting: false, drifting: false, street: '', topKmh: 0, km: 0, crashes: 0 };

  constructor(
    private map: MapLibreMap,
    private controls: Controls,
    private audio: EngineAudio | null,
    private onHud: (hud: GameHud) => void,
    private onCrash: (impact: number) => void,
  ) {
    this.world = new World(map);
    this.car = createCarLayer(map);
    const c = map.getCenter();
    const center: LngLat = [c.lng, c.lat];
    this.world.refresh(center, true);
    // Start on the nearest named road, pointing along it; otherwise the nearest open spot.
    const road = this.world.snapToRoad(center);
    let heading = map.getBearing();
    if (road) {
      // Of the two directions along the road, take the one closer to where the camera faces.
      heading = Math.abs(angleDelta(heading, road.heading)) <= 90 ? road.heading : (road.heading + 180) % 360;
    }
    const spawn = this.world.freeSpot(road?.pos ?? center, (p) => !this.vehicleAt(p, heading).some(this.world.blocked));
    this.vehicle = new Vehicle(spawn, heading);
    this.camBearing = this.vehicle.heading;
    this.safe = { pos: spawn, heading: this.vehicle.heading, at: 0 };
  }

  private vehicleAt(p: LngLat, heading: number) {
    return new Vehicle(p, heading).footprint(p, heading);
  }

  start() {
    for (const h of INTERACTIONS) this.map[h].disable();
    this.map.setPadding({ top: this.map.getContainer().clientHeight * 0.42, bottom: 0, left: 0, right: 0 });
    if (!this.map.getLayer(CAR_LAYER_ID)) this.map.addLayer(this.car.layer);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.map.getLayer(CAR_LAYER_ID)) this.map.removeLayer(CAR_LAYER_ID);
    for (const h of INTERACTIONS) this.map[h].enable();
    this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  }

  // Back to the last spot the car was driving freely, stopped.
  reset() {
    this.vehicle.pos = this.safe.pos;
    this.vehicle.heading = this.safe.heading;
    this.vehicle.stop();
    this.camBearing = this.safe.heading;
  }

  get position(): LngLat {
    return this.vehicle.pos;
  }

  private tick = (now: number) => {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const v = this.vehicle;
    const input = this.controls.read();
    const before = v.pos;

    this.world.refresh(v.pos);
    const { crashed, impact } = v.step(dt, input, this.world.blocked);
    const speed = v.speed;
    const accel = (speed - this.prevSpeed) / Math.max(dt, 1e-3);
    this.prevSpeed = speed;

    if (crashed) {
      this.shake = Math.min(1.2, impact / 12);
      this.hud.crashes++;
      this.audio?.crash(impact);
      this.onCrash(impact);
    }
    if (now - this.safe.at > 1000 && Math.abs(speed) > 2 && !crashed) this.safe = { pos: v.pos, heading: v.heading, at: now };

    this.car.update({ pos: v.pos, heading: v.heading, speed, steer: v.steer, accel, boosting: v.boosting, braking: v.braking, dt });
    this.audio?.update(speed, input.throttle, v.boosting);

    // Chase camera: swings round behind the car, pulls back at speed, shakes on impact.
    if (Math.abs(speed) > 0.5 && speed > -1) this.camBearing += angleDelta(this.camBearing, v.heading) * Math.min(1, dt * 3.2);
    const abs = Math.abs(speed);
    this.shake *= Math.pow(0.02, dt);
    const jitter = this.shake * 2.5;
    const center = offset(v.pos, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter);
    this.map.jumpTo({
      center,
      bearing: this.camBearing,
      pitch: 70 + Math.min(abs, 30) * 0.1,
      zoom: 20.4 - Math.min(abs, 42) / 42 * 1.3,
    });

    this.hud.km += distance(before, v.pos) / 1000;
    const kmh = abs * 3.6;
    this.hud.topKmh = Math.max(this.hud.topKmh, kmh);
    if (now - this.lastStreet > 400) {
      this.lastStreet = now;
      this.hud.street = this.world.streetAt(v.pos) || this.hud.street;
    }
    if (now - this.lastHud > 80) {
      this.lastHud = now;
      this.onHud({
        ...this.hud,
        kmh,
        gear: speed < -0.5 ? 'R' : abs < 0.5 ? 'N' : 'D',
        boost: v.boostFuel,
        boosting: v.boosting,
        drifting: input.drift && abs > 6 || v.slip > 0.25,
      });
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}
