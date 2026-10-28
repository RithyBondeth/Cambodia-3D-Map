import * as THREE from 'three';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from 'maplibre-gl';
import { buildCar } from './carModel';
import type { LngLat } from '../geo';

export type CarState = {
  pos: LngLat;
  heading: number;   // degrees clockwise from north
  speed: number;     // m/s, signed
  steer: number;     // -1…1
  accel: number;     // m/s², for body pitch
  boosting: boolean;
  braking: boolean;
  dt: number;
};

export const CAR_LAYER_ID = 'kh-car';

// Renders the Three.js car inside MapLibre's own WebGL context, so it is
// depth-tested against the 3D buildings and sits on the terrain.
export function createCarLayer(map: MapLibreMap) {
  const car = buildCar();
  const scene = new THREE.Scene();
  scene.add(car.root);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8b7bd8', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(-3, 8, 4);
  scene.add(sun);

  const camera = new THREE.Camera();
  let renderer: THREE.WebGLRenderer | null = null;
  let state: CarState | null = null;
  let roll = 0;
  let pitch = 0;

  const layer: CustomLayerInterface = {
    id: CAR_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(_gl, args) {
      if (!renderer || !state) return;
      const altitude = map.queryTerrainElevation(state.pos) ?? 0;
      const mc = MercatorCoordinate.fromLngLat(state.pos, altitude);
      const s = mc.meterInMercatorCoordinateUnits();
      const model = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z ?? 0)
        .scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeRotationY((-state.heading * Math.PI) / 180));
      camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as number[]).multiply(model);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
    },
  };

  function update(next: CarState) {
    state = next;
    const { speed, steer, dt } = next;
    // Wheels spin with speed and the front ones steer.
    for (const w of car.wheels) w.rotation.x -= (speed * dt) / 0.36;
    for (const p of car.frontWheels) p.rotation.y = -steer * 0.5;
    // Body leans into corners and squats/dives with throttle and brake.
    roll += ((steer * Math.min(Math.abs(speed), 30)) * 0.004 - roll) * Math.min(1, dt * 6);
    pitch += (next.accel * 0.006 - pitch) * Math.min(1, dt * 5);
    car.body.rotation.z = roll;
    car.body.rotation.x = pitch;
    car.tail.emissiveIntensity = next.braking ? 4 : 1.4;
    car.underglow.color.set(next.boosting ? '#7ef0ff' : '#c4a8ff');
    car.underglow.opacity = next.boosting ? 1 : 0.75;
    for (const f of car.flames) {
      f.visible = next.boosting;
      f.scale.setScalar(0.8 + Math.random() * 0.5);
    }
    map.triggerRepaint();
  }

  return { layer, update };
}
