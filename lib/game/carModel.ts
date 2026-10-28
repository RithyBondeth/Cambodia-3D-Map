import * as THREE from 'three';

// A low-poly futuristic sports car, in metres: front faces -Z, up is +Y,
// wheels sit on y = 0. Built in code so there's no model file to download.

export type CarParts = {
  root: THREE.Group;
  body: THREE.Group;      // tilts for roll / pitch
  frontWheels: THREE.Object3D[];
  wheels: THREE.Mesh[];
  tail: THREE.MeshStandardMaterial;
  underglow: THREE.MeshBasicMaterial;
  flames: THREE.Mesh[];
};

function glowTexture(inner: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Side profile (x = length with the nose at +x, y = height), extruded across the width.
function profile(points: [number, number][], width: number) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2,
  });
  geo.rotateY(Math.PI / 2);          // nose from +x to -z
  geo.translate(-width / 2, 0, 0);   // centre across the width
  geo.computeVertexNormals();
  return geo;
}

export function buildCar(): CarParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: '#f2efff', metalness: 0.55, roughness: 0.28, emissive: '#3b2a8a', emissiveIntensity: 0.08 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1b1640', metalness: 0.9, roughness: 0.08, emissive: '#2a9fd6', emissiveIntensity: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: '#17142b', metalness: 0.3, roughness: 0.6 });
  const neonCyan = new THREE.MeshStandardMaterial({ color: '#7ef0ff', emissive: '#22d3ee', emissiveIntensity: 2.2 });
  const neonPink = new THREE.MeshStandardMaterial({ color: '#ff9be0', emissive: '#ec4899', emissiveIntensity: 1.6 });
  const headlight = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.5 });

  // Body shell: low wedge nose, cab-forward roof, short tail.
  const shell = new THREE.Mesh(profile([
    [2.3, 0.28], [2.36, 0.52], [1.25, 0.74], [0.35, 0.8], [-0.35, 1.12], [-1.15, 1.13],
    [-1.85, 0.9], [-2.3, 0.86], [-2.32, 0.3],
  ], 1.86), paint);
  shell.position.y = 0.04;
  body.add(shell);

  // Glass canopy, a little wider than the shell so it reads on the sides.
  const canopy = new THREE.Mesh(profile([
    [0.55, 0.79], [-0.32, 1.15], [-1.1, 1.16], [-1.72, 0.92], [-0.6, 0.8],
  ], 1.7), glass);
  canopy.position.y = 0.04;
  body.add(canopy);

  // Neon side stripes and front light bar.
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 3.6), neonCyan);
    stripe.position.set(side * 0.99, 0.44, 0.05);
    body.add(stripe);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08), headlight);
    lamp.position.set(side * 0.58, 0.58, -2.33);
    body.add(lamp);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.04), neonCyan);
  nose.position.set(0, 0.36, -2.37);
  body.add(nose);

  // Full-width tail light (brightens when braking).
  const tail = neonPink.clone();
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.06), tail);
  tailBar.position.set(0, 0.78, 2.37);
  body.add(tailBar);

  // Spoiler.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.38), paint);
  wing.position.set(0, 1.12, 2.05);
  body.add(wing);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.12), dark);
    strut.position.set(side * 0.6, 0.98, 2.05);
    body.add(strut);
  }

  // Wheels with glowing rims.
  const wheels: THREE.Mesh[] = [];
  const frontWheels: THREE.Object3D[] = [];
  const tyre = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 20);
  tyre.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.24, 0.035, 8, 24);
  rimGeo.rotateY(Math.PI / 2);
  for (const [x, z, front] of [[-0.9, -1.45, true], [0.9, -1.45, true], [-0.9, 1.45, false], [0.9, 1.45, false]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const wheel = new THREE.Mesh(tyre, dark);
    const rim = new THREE.Mesh(rimGeo, neonCyan);
    rim.position.x = x > 0 ? 0.16 : -0.16;
    wheel.add(rim);
    pivot.add(wheel);
    root.add(pivot);
    wheels.push(wheel);
    if (front) frontWheels.push(pivot);
  }

  // Boost flames from twin exhausts.
  const flames: THREE.Mesh[] = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: '#7ef0ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const side of [-1, 1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.9, 12), flameMat);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(side * 0.45, 0.32, 2.75);
    cone.visible = false;
    body.add(cone);
    flames.push(cone);
  }

  // Soft contact shadow + violet underglow on the road.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.2),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(20,10,60,0.55)'), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);
  const underglow = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(160,110,255,1)'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.2), underglow);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.03;
  root.add(glowPlane);

  return { root, body, frontWheels, wheels, tail, underglow, flames };
}
