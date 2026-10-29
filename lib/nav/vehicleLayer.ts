import * as THREE from 'three';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from 'maplibre-gl';
import { angleDelta } from '../geo';
import { buildCar, CAR_LENGTH } from './carModel';
import type { Pose } from './session';

export const VEHICLE_LAYER_ID = 'nav-vehicle';

// How long the car looks on screen (CSS px, before perspective), at any zoom.
const ON_SCREEN_LENGTH = 88;
const EARTH_CIRCUMFERENCE = 40075016.686;

// Renders the Three.js car inside MapLibre's own WebGL context. It is scaled
// to a steady on-screen size and drawn over the buildings, like a location
// puck, so it never shrinks to a speck or hides behind a tower.
export function createVehicleLayer(map: MapLibreMap) {
  const car = buildCar();
  const scene = new THREE.Scene();
  scene.add(car.root);
  scene.add(new THREE.HemisphereLight('#ffffff', '#9a8be0', 1.7));
  const sun = new THREE.DirectionalLight('#ffffff', 1.9);
  sun.position.set(-3, 8, 4);
  scene.add(sun);

  const camera = new THREE.Camera();
  let renderer: THREE.WebGLRenderer | null = null;
  let pose: Pose | null = null;
  let heading = 0;
  let roll = 0;
  let speed = 0;
  let decel = 0;
  let clock = 0;

  const layer: CustomLayerInterface = {
    id: VEHICLE_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(_gl, args) {
      if (!renderer || !pose) return;
      const altitude = map.queryTerrainElevation(pose.pos) ?? 0;
      const mc = MercatorCoordinate.fromLngLat(pose.pos, altitude);
      const metresPerPixel = (EARTH_CIRCUMFERENCE * Math.cos((pose.pos[1] * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      const grow = Math.max(1, (ON_SCREEN_LENGTH * metresPerPixel) / CAR_LENGTH);
      const s = mc.meterInMercatorCoordinateUnits() * grow;
      const model = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z ?? 0)
        .scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeRotationY((-pose.heading * Math.PI) / 180));
      camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as number[]).multiply(model);
      renderer.resetState();
      renderer.clearDepth(); // on top of the map, like a puck
      renderer.render(scene, camera);
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
    },
  };

  function update(next: Pose, dt: number) {
    if (dt <= 0) return;
    clock += dt;
    const turnRate = pose ? angleDelta(heading, next.heading) / dt : 0; // degrees per second
    heading = next.heading;
    decel += ((speed - next.speed) / dt - decel) * Math.min(1, dt * 3);
    speed = next.speed;
    pose = next;

    for (const w of car.wheels) w.rotation.x -= (next.speed * dt) / 0.35;
    const steer = Math.max(-1, Math.min(1, turnRate / 25));
    for (const p of car.frontWheels) p.rotation.y = -steer * 0.45;
    roll += (steer * Math.min(next.speed, 20) * 0.003 - roll) * Math.min(1, dt * 5);
    car.body.rotation.z = roll;
    car.tail.emissiveIntensity = next.speed < 0.5 || decel > 1.2 ? 3.2 : 1.2;
    // The halo breathes gently so the car is easy to find at a glance.
    car.halo.opacity = 0.75 + Math.sin(clock * 2.4) * 0.2;
    car.haloMesh.scale.setScalar(1 + Math.sin(clock * 2.4) * 0.05);
    map.triggerRepaint();
  }

  return { layer, update };
}
