import * as THREE from 'three';

// A clean, modern saloon in metres: front faces -Z, up is +Y, wheels sit on
// y = 0. Violet with a white roof, so "you" stands out against the pale city.
// Built in code so there's no model file to download.

export const CAR_LENGTH = 4.65;

export type CarParts = {
  root: THREE.Group;
  body: THREE.Group;      // leans a touch in corners
  frontWheels: THREE.Object3D[];
  wheels: THREE.Mesh[];
  tail: THREE.MeshStandardMaterial;
  halo: THREE.MeshBasicMaterial;
  haloMesh: THREE.Mesh;
};

function glowTexture(stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Side profile (x = length with the nose at +x, y = height), extruded across the width.
function profile(points: [number, number][], width: number, bevel = 0.06) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3,
  });
  geo.rotateY(Math.PI / 2);                 // nose from +x to -z
  geo.translate(-(width - bevel * 2) / 2, 0, 0); // centre across the width
  geo.computeVertexNormals();
  return geo;
}

export function buildCar(): CarParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: '#6a45ff', metalness: 0.5, roughness: 0.3, emissive: '#3b1fb8', emissiveIntensity: 0.25 });
  const pearl = new THREE.MeshStandardMaterial({ color: '#f6f4ff', metalness: 0.35, roughness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: '#2b2742', metalness: 0.3, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1a1830', metalness: 0.85, roughness: 0.12, emissive: '#3a2f8f', emissiveIntensity: 0.18 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f4f7ff', emissiveIntensity: 2.4 });
  const accent = new THREE.MeshStandardMaterial({ color: '#7ef0ff', emissive: '#22d3ee', emissiveIntensity: 1.6 });

  // Lower body up to the window line.
  const shell = new THREE.Mesh(profile([
    [2.3, 0.3], [2.34, 0.6], [1.5, 0.8], [0.62, 0.92], [-1.9, 0.98], [-2.3, 0.94], [-2.33, 0.34],
  ], 1.84), paint);
  shell.position.y = 0.04;
  body.add(shell);

  // Bumpers and sills in dark trim.
  const sill = new THREE.Mesh(profile([[2.33, 0.22], [2.36, 0.36], [-2.35, 0.36], [-2.33, 0.22]], 1.86, 0.03), trim);
  sill.position.y = 0.04;
  body.add(sill);

  // Glasshouse, narrower than the body, with a painted roof on top.
  const cabin = new THREE.Mesh(profile([[0.62, 0.92], [-0.2, 1.37], [-1.28, 1.39], [-1.96, 0.97]], 1.58, 0.08), glass);
  cabin.position.y = 0.04;
  body.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.05, 1.12), pearl);
  roof.position.set(0, 1.42, 0.72);
  body.add(roof);

  // Headlights with a cyan daytime-running strip, mirrors, full-width tail light.
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.06), lamp);
    head.position.set(side * 0.58, 0.66, -2.34);
    body.add(head);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.14), trim);
    mirror.position.set(side * 0.98, 1.0, -0.5);
    body.add(mirror);
  }
  const drl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.025, 0.04), accent);
  drl.position.set(0, 0.58, -2.37);
  body.add(drl);
  const tail = new THREE.MeshStandardMaterial({ color: '#ff8aa8', emissive: '#ff2d55', emissiveIntensity: 1.2 });
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 0.06), tail);
  tailBar.position.set(0, 0.86, 2.36);
  body.add(tailBar);

  // Wheels: dark tyres, bright alloy rims.
  const wheels: THREE.Mesh[] = [];
  const frontWheels: THREE.Object3D[] = [];
  const tyreMat = new THREE.MeshStandardMaterial({ color: '#16141f', roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#d9dce6', metalness: 0.85, roughness: 0.25 });
  const tyre = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 20);
  tyre.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14);
  rimGeo.rotateZ(Math.PI / 2);
  for (const [x, z, front] of [[-0.84, -1.42, true], [0.84, -1.42, true], [-0.84, 1.42, false], [0.84, 1.42, false]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.35, z);
    const wheel = new THREE.Mesh(tyre, tyreMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.x = x > 0 ? 0.13 : -0.13;
    wheel.add(rim);
    pivot.add(wheel);
    root.add(pivot);
    wheels.push(wheel);
    if (front) frontWheels.push(pivot);
  }

  // Soft contact shadow, and a glowing "you are here" halo on the road.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 5.4),
    new THREE.MeshBasicMaterial({ map: glowTexture([[0, 'rgba(20,10,60,0.6)'], [1, 'rgba(20,10,60,0)']]), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);
  // Normal blending, so the halo still shows on the near-white daytime ground.
  const halo = new THREE.MeshBasicMaterial({
    map: glowTexture([[0, 'rgba(124,92,255,0.05)'], [0.5, 'rgba(124,92,255,0.28)'], [0.78, 'rgba(34,211,238,0.5)'], [1, 'rgba(34,211,238,0)']]),
    transparent: true, depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), halo);
  haloMesh.rotation.x = -Math.PI / 2;
  haloMesh.position.y = 0.01;
  root.add(haloMesh);

  return { root, body, frontWheels, wheels, tail, halo, haloMesh };
}
