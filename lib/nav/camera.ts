import { LngLatBounds, type Map as MapLibreMap, type PaddingOptions } from 'maplibre-gl';
import { angleDelta, type LngLat } from '../geo';
import type { Pose } from './session';

export type CameraMode = 'follow' | 'overview' | 'free';

const PITCH = 62;
const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const smooth = (t: number) => t * t * (3 - 2 * t);

// Pushes the map's centre down so the car sits low on screen with the road ahead above it.
const followTop = () => window.innerHeight * (isPhone() ? 0.4 : 0.44);

// Clear of the instruction banner and the bottom bar.
function overviewPadding(): PaddingOptions {
  return isPhone()
    ? { top: 150, bottom: 150, left: 40, right: 40 }
    : { top: 150, bottom: 140, left: 80, right: 80 };
}

// The navigation camera: chases the car heading-up from behind and above,
// pulls back at speed and leans in before turns. Gliding, never snapping.
export class NavCamera {
  mode: CameraMode = 'follow';
  private zoom: number;
  private bearing: number;
  private pitch: number;
  // Glide from wherever the camera was when following (re)starts.
  private from: { center: LngLat; top: number } | null = null;
  private blend = 1;

  constructor(private map: MapLibreMap) {
    this.zoom = map.getZoom();
    this.bearing = map.getBearing();
    this.pitch = map.getPitch();
    this.follow();
  }

  follow() {
    const { map } = this;
    map.stop();
    const c = map.getCenter();
    this.from = { center: [c.lng, c.lat], top: map.getPadding().top ?? 0 };
    this.zoom = map.getZoom();
    this.bearing = map.getBearing();
    this.pitch = map.getPitch();
    this.blend = 0;
    this.mode = 'follow';
  }

  overview(remaining: LngLat[]) {
    this.mode = 'overview';
    if (remaining.length < 2) return;
    const bounds = remaining.reduce((b, c) => b.extend(c), new LngLatBounds(remaining[0], remaining[0]));
    this.map.fitBounds(bounds, { padding: overviewPadding(), absolutePadding: true, bearing: 0, pitch: 30, maxZoom: 17, duration: 1100 });
  }

  update(pose: Pose, dt: number, toStep: number) {
    if (this.mode !== 'follow') return;
    const gliding = this.blend < 1;
    // Closer in town, further out on the open road, and a little closer just before a turn.
    const kmh = pose.speed * 3.6;
    let zoom = 18.3 - Math.min(Math.max((kmh - 25) / 60, 0), 1) * 1.5;
    if (toStep < 160) zoom += 0.35 * (1 - toStep / 160);

    this.zoom += (zoom - this.zoom) * ease(gliding ? 2.2 : 0.8, dt);
    this.bearing = (this.bearing + angleDelta(this.bearing, pose.heading) * ease(gliding ? 3 : 2.4, dt) + 360) % 360;
    this.pitch += (PITCH - this.pitch) * ease(2, dt);

    let center = pose.pos;
    let top = followTop();
    if (gliding && this.from) {
      this.blend = Math.min(1, this.blend + dt / 1.3);
      const k = smooth(this.blend);
      center = [this.from.center[0] + (pose.pos[0] - this.from.center[0]) * k, this.from.center[1] + (pose.pos[1] - this.from.center[1]) * k];
      top = this.from.top + (top - this.from.top) * k;
    }
    this.map.jumpTo({ center, zoom: this.zoom, bearing: this.bearing, pitch: this.pitch, padding: { top, bottom: 0, left: 0, right: 0 } });
  }
}
