import { offset, type LngLat } from '../geo';

export type Input = {
  throttle: number; // -1 (brake / reverse) … 1
  steer: number;    // -1 (left) … 1 (right)
  boost: boolean;
  drift: boolean;
};

// Arcade tuning, in metres and seconds.
const MAX_SPEED = 26;        // ~94 km/h
const BOOST_SPEED = 42;      // ~150 km/h
const REVERSE_SPEED = 8;
const ACCEL = 9;
const BOOST_ACCEL = 20;
const BRAKE = 24;
const DRAG = 0.22;           // fraction of speed lost per second
const ROLLING = 1.5;
const WHEELBASE = 2.7;
const MAX_STEER = 0.62;      // radians at walking pace
const GRIP = 9;              // how fast velocity follows heading
const DRIFT_GRIP = 1.6;
const LENGTH = 4.5;
const WIDTH = 2.0;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export type StepResult = { crashed: boolean; impact: number };

// A simple drifting car: velocity is a world vector that's pulled towards the
// car's heading by grip, so letting go of grip (drift) slides the car.
export class Vehicle {
  pos: LngLat;
  heading: number; // degrees clockwise from north
  steer = 0;       // smoothed steering input, -1…1
  boostFuel = 1;
  boosting = false;
  braking = false;
  private ve = 0;  // velocity east, m/s
  private vn = 0;  // velocity north, m/s

  constructor(pos: LngLat, heading: number) {
    this.pos = pos;
    this.heading = heading;
  }

  // Signed speed along the heading (negative when reversing).
  get speed() {
    const h = rad(this.heading);
    return this.ve * Math.sin(h) + this.vn * Math.cos(h);
  }

  get slip() {
    const total = Math.hypot(this.ve, this.vn);
    return total < 1 ? 0 : 1 - Math.abs(this.speed) / total;
  }

  // The car's four corners plus its nose, for collision tests.
  footprint(pos: LngLat, heading: number): LngLat[] {
    const h = rad(heading);
    const fx = Math.sin(h), fy = Math.cos(h);   // forward (east, north)
    const rx = Math.cos(h), ry = -Math.sin(h);  // right
    const l = LENGTH / 2, w = WIDTH / 2;
    return [[l, w], [l, -w], [-l, w], [-l, -w], [l + 0.2, 0]].map(([a, b]) =>
      offset(pos, fx * a + rx * b, fy * a + ry * b));
  }

  step(dt: number, input: Input, blocked: (p: LngLat) => boolean): StepResult {
    // Steering eases in/out and gets gentler at speed.
    this.steer += (input.steer - this.steer) * Math.min(1, dt * 8);
    let speed = this.speed;
    const abs = Math.abs(speed);

    this.boosting = input.boost && this.boostFuel > 0.02 && input.throttle > 0;
    this.boostFuel = Math.max(0, Math.min(1, this.boostFuel + (this.boosting ? -0.32 : 0.1) * dt));
    this.braking = input.throttle < 0 && speed > 0.5;

    // Longitudinal forces.
    if (input.throttle > 0) {
      const top = this.boosting ? BOOST_SPEED : MAX_SPEED;
      if (speed < top) speed += (this.boosting ? BOOST_ACCEL : ACCEL) * input.throttle * (1 - Math.max(0, speed) / (top * 1.15)) * dt;
    } else if (input.throttle < 0) {
      if (speed > 0.3) speed -= BRAKE * -input.throttle * dt;
      else if (speed > -REVERSE_SPEED) speed -= ACCEL * 0.6 * -input.throttle * dt;
    }
    speed -= speed * DRAG * dt;
    if (input.throttle === 0) speed -= Math.sign(speed) * Math.min(abs, ROLLING * dt);
    if (input.drift) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 4 * dt);

    // Bicycle-model yaw, boosted while drifting.
    const steerAngle = this.steer * MAX_STEER / (1 + abs / 16);
    const yaw = (speed / WHEELBASE) * Math.tan(steerAngle) * (input.drift ? 1.5 : 1);
    const heading = (this.heading + deg(yaw * dt) + 360) % 360;

    // Split velocity into forward/sideways parts of the new heading: throttle
    // changes the forward part, grip bleeds off the sideways part (less grip = drift).
    const h = rad(heading);
    const fx = Math.sin(h), fy = Math.cos(h);
    const rx = Math.cos(h), ry = -Math.sin(h);
    const grip = Math.min(1, (input.drift ? DRIFT_GRIP : GRIP) * dt);
    const forward = this.ve * fx + this.vn * fy + (speed - this.speed);
    const sideways = (this.ve * rx + this.vn * ry) * (1 - grip);
    let ve = fx * forward + rx * sideways;
    let vn = fy * forward + ry * sideways;

    // Move, sliding along walls where possible.
    const tryMove = (e: number, n: number) => {
      const next = offset(this.pos, e * dt, n * dt);
      return this.footprint(next, heading).some(blocked) ? null : next;
    };
    let next = tryMove(ve, vn);
    let crashed = false;
    let impact = 0;
    if (!next) {
      impact = Math.hypot(ve, vn);
      const slideE = tryMove(ve, 0);
      const slideN = slideE ? null : tryMove(0, vn);
      next = slideE ?? slideN;
      if (next) {
        // Scrape along the wall.
        if (slideE) vn = 0; else ve = 0;
        ve *= 0.75; vn *= 0.75;
        impact *= 0.4;
      } else {
        // Head-on: bounce back.
        ve *= -0.3; vn *= -0.3;
      }
      crashed = impact > 3;
    }

    if (next) this.pos = next;
    // Don't rotate into a wall either.
    if (!this.footprint(this.pos, heading).some(blocked)) this.heading = heading;
    this.ve = ve;
    this.vn = vn;
    return { crashed, impact };
  }

  stop() {
    this.ve = 0;
    this.vn = 0;
  }
}
