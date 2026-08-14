import * as THREE from 'three';
import {
  T, H, H2, X0, X1, Z0, Z1, OX, OZ, WIN_W, WIN_SILL, WIN_HEAD,
} from './plan.js';
import { box, cyl } from './kit.js';

export function buildYard(ctx) {
  const grass = box(ctx, ctx.mats.grass, 0, -0.02, 1.2, 56, 0.04, 48, { collide: false, cast: false });
  grass.receiveShadow = true;
  ctx.world.addBox(0, -0.08, 1.2, 56, 0.16, 48, { surface: 'stone' });

  // Front walk — stepped brick path that reads from the street.
  box(ctx, ctx.mats.brick, 0, 0.012, 10.6, 1.55, 0.03, 6.6, { collide: false, cast: false });
  box(ctx, ctx.mats.brick, 0, 0.018, 7.55, 2.85, 0.04, 1.35, { collide: false, cast: false });
  box(ctx, ctx.mats.brick, 0, 0.028, 6.55, 2.35, 0.05, 0.55, { collide: false, cast: false });
  for (const z of [11.8, 10.4, 9.0, 7.9]) {
    box(ctx, ctx.mats.woodDark, 0, 0.005, z, 1.62, 0.01, 0.04, { collide: false, cast: false });
  }

  const lampX = 3.45, lampZ = 12.8;
  cyl(ctx, ctx.mats.iron, lampX, 1.75, lampZ, 0.06, 0.07, 3.5);
  cyl(ctx, ctx.mats.iron, lampX, 3.55, lampZ, 0.24, 0.2, 0.14, { cast: false });
  cyl(ctx, ctx.mats.lampShade, lampX, 3.35, lampZ, 0.2, 0.24, 0.3, { cast: false });
  const street = new THREE.PointLight(0xffd9a8, 1.85, 22, 1.45);
  street.position.set(lampX, 3.28, lampZ);
  ctx.root.add(street);
  ctx.lights.push({ light: street, base: 1.85, flicker: 0.04 });

  // Iron gate + fence
  const fenceZ = 14.35;
  for (let i = -10; i <= 10; i++) {
    const x = i * 0.88;
    if (Math.abs(x) < 1.05) continue;
    box(ctx, ctx.mats.iron, x, 0.58, fenceZ, 0.045, 1.16, 0.045, { collide: false, cast: false });
    box(ctx, ctx.mats.iron, x, 1.05, fenceZ, 0.045, 0.04, 0.045, { collide: false, cast: false });
  }
  box(ctx, ctx.mats.iron, -5.5, 1.12, fenceZ, 8.6, 0.035, 0.035, { collide: false, cast: false });
  box(ctx, ctx.mats.iron, 5.5, 1.12, fenceZ, 8.6, 0.035, 0.035, { collide: false, cast: false });
  for (const x of [-9.4, 9.4, -1.1, 1.1]) {
    box(ctx, ctx.mats.iron, x, 0.62, fenceZ, 0.09, 1.28, 0.09, { collide: false });
  }
  // Gate posts + hanging sign
  box(ctx, ctx.mats.woodDark, 1.9, 0.7, 13.95, 0.1, 1.4, 0.1, { collide: false });
  box(ctx, ctx.mats.wood, 1.9, 1.25, 13.95, 0.42, 0.28, 0.05, { collide: false, cast: false });
  box(ctx, ctx.mats.brass, 1.9, 1.25, 13.98, 0.28, 0.02, 0.02, { collide: false, cast: false });

  const trees = [
    [-8.6, 8.4], [8.8, 9.2], [-8.0, -7.0], [7.6, -6.2], [-9.4, 2.6], [9.7, 3.3],
    [-5.0, 15.8], [5.4, 16.4], [-7.2, 3.0], [6.8, 12.2], [-6.2, 11.5],
  ];
  for (const [tx, tz] of trees) tree(ctx, tx, tz);

  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) < 2) continue;
    hedge(ctx, i * 1.05, 6.45);
  }
  // Side hedges
  for (let i = 0; i < 4; i++) {
    hedge(ctx, -6.4, 4.2 - i * 1.1);
    hedge(ctx, 6.4, 4.2 - i * 1.1);
  }

  // Readable night fill — still moody, not a black void.
  const moon = new THREE.DirectionalLight(0xd0dceb, 1.15);
  moon.position.set(-12, 20, 24);
  moon.target.position.set(0, 1.6, 2);
  ctx.scene.add(moon);
  ctx.scene.add(moon.target);
  if (ctx.quality === 'high') {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 4;
    moon.shadow.camera.far = 55;
    moon.shadow.camera.left = moon.shadow.camera.bottom = -18;
    moon.shadow.camera.right = moon.shadow.camera.top = 18;
  }
  ctx.scene.add(new THREE.HemisphereLight(0xe2d6c4, 0x1a1410, 1.05));
  ctx.scene.add(new THREE.AmbientLight(0xfff2e0, 0.52));
}

function tree(ctx, x, z) {
  cyl(ctx, ctx.mats.bark, x, 0.95, z, 0.13, 0.18, 1.9);
  const layers = [
    [0, 2.55, 1.45, 1.2, 1.35],
    [0.4, 2.2, 0.95, 0.75, 0.9],
    [-0.35, 2.15, 0.85, 0.7, 0.8],
    [0.1, 3.05, 0.7, 0.55, 0.65],
  ];
  for (const [ox, oy, sx, sy, sz] of layers) {
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), ctx.mats.leaf);
    canopy.position.set(x + ox, oy, z);
    canopy.scale.set(sx, sy, sz);
    canopy.castShadow = ctx.quality === 'high';
    canopy.receiveShadow = true;
    ctx.root.add(canopy);
  }
}

function hedge(ctx, x, z) {
  box(ctx, ctx.mats.leaf, x, 0.34, z, 0.95, 0.68, 0.38, { collide: false, cast: false });
  box(ctx, ctx.mats.leaf, x + 0.22, 0.46, z + 0.06, 0.5, 0.48, 0.3, { collide: false, cast: false });
  box(ctx, ctx.mats.leaf, x - 0.18, 0.42, z - 0.05, 0.42, 0.4, 0.28, { collide: false, cast: false });
}

export function buildPorch(ctx) {
  const zDeck = Z1 + 1.2;
  // Raised deck + steps (visual; walkable ground plane already covers approach)
  box(ctx, ctx.mats.wood, 0, 0.1, zDeck, 4.0, 0.14, 2.45, { collide: false });
  box(ctx, ctx.mats.woodDark, 0, 0.02, zDeck + 0.95, 1.55, 0.08, 0.42, { collide: false });
  box(ctx, ctx.mats.woodDark, 0, -0.02, zDeck + 1.35, 1.7, 0.08, 0.4, { collide: false });

  for (const x of [-1.85, 1.85]) {
    box(ctx, ctx.mats.wood, x, 1.4, Z1 + 2.2, 0.16, 2.65, 0.16, { collide: true });
    box(ctx, ctx.mats.wood, x, 1.4, Z1 + 0.4, 0.16, 2.65, 0.16, { collide: false });
    // Capital + base
    box(ctx, ctx.mats.woodDark, x, 2.7, Z1 + 2.2, 0.22, 0.08, 0.22, { collide: false, cast: false });
    box(ctx, ctx.mats.woodDark, x, 0.14, Z1 + 2.2, 0.22, 0.1, 0.22, { collide: false, cast: false });
  }
  // Porch roof
  box(ctx, ctx.mats.wood, 0, 2.78, zDeck + 0.08, 4.35, 0.12, 2.7, { collide: false });
  box(ctx, ctx.mats.shingle, 0, 2.92, zDeck + 0.08, 4.5, 0.08, 2.85, { collide: false });

  const porchLight = new THREE.PointLight(0xffc888, 2.2, 11, 1.35);
  porchLight.position.set(0.0, 2.5, Z1 + 0.38);
  ctx.root.add(porchLight);
  ctx.lights.push({ light: porchLight, base: 2.2, flicker: 0.035 });
  cyl(ctx, ctx.mats.brass, 0.0, 2.58, Z1 + 0.28, 0.045, 0.045, 0.1, { cast: false });
  cyl(ctx, ctx.mats.lampShade, 0.0, 2.45, Z1 + 0.28, 0.14, 0.1, 0.16, { cast: false });

  // Railings
  box(ctx, ctx.mats.wood, -1.95, 0.55, zDeck + 0.15, 0.06, 0.85, 2.1, { collide: false, cast: false });
  box(ctx, ctx.mats.wood, 1.95, 0.55, zDeck + 0.15, 0.06, 0.85, 2.1, { collide: false, cast: false });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      box(ctx, ctx.mats.woodDark, side * 1.95, 0.45, zDeck - 0.7 + i * 0.45, 0.04, 0.7, 0.04, { collide: false, cast: false });
    }
  }

  // House number plate
  box(ctx, ctx.mats.brass, 0.78, 1.78, Z1 + 0.1, 0.32, 0.2, 0.03, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, 0.78, 1.78, Z1 + 0.12, 0.26, 0.14, 0.01, { collide: false, cast: false });
}

export function buildRoof(ctx) {
  const rise = 2.15;
  const yEave = H2;
  const over = 0.55;
  const w = (X1 - X0) + over * 2;
  const d = (Z1 - Z0) + over * 2;
  const hw = w * 0.5;
  const len = Math.hypot(hw, rise);
  const ang = Math.atan2(rise, hw);

  const left = box(ctx, ctx.mats.shingle, -hw * 0.5, yEave + rise * 0.5, OZ, len, 0.12, d, { collide: false });
  left.rotation.z = ang;
  const right = box(ctx, ctx.mats.shingle, hw * 0.5, yEave + rise * 0.5, OZ, len, 0.12, d, { collide: false });
  right.rotation.z = -ang;

  // Soft under-eave boards so silhouette isn't a hard brick box.
  box(ctx, ctx.mats.woodDark, 0, H2 + 0.04, Z1 + over * 0.35, (X1 - X0) + over, 0.06, 0.5, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, 0, H2 + 0.04, Z0 - over * 0.35, (X1 - X0) + over, 0.06, 0.5, { collide: false, cast: false });

  const gableShape = new THREE.Shape();
  gableShape.moveTo(X0 - 0.05, H2);
  gableShape.lineTo(0, H2 + rise);
  gableShape.lineTo(X1 + 0.05, H2);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: T + 0.04, bevelEnabled: false });
  gableGeo.translate(0, 0, -(T + 0.04) * 0.5);
  const fg = new THREE.Mesh(gableGeo, ctx.mats.brick);
  fg.position.z = Z1 - T * 0.45;
  fg.castShadow = ctx.quality === 'high';
  fg.receiveShadow = true;
  ctx.root.add(fg);
  const bg = fg.clone();
  bg.position.z = Z0 + T * 0.45;
  ctx.root.add(bg);

  // Ridge + chimney
  box(ctx, ctx.mats.woodDark, 0, H2 + rise + 0.08, OZ, 0.18, 0.14, d + 0.15, { collide: false });
  const cx = X0 + 1.25, cz = Z0 + 2.5;
  box(ctx, ctx.mats.brick, cx, H2 + 1.45, cz, 0.7, 2.9, 0.7, { collide: false });
  box(ctx, ctx.mats.brick, cx, H2 + 2.95, cz, 0.82, 0.18, 0.82, { collide: false, cast: false });
  box(ctx, ctx.mats.iron, cx, H2 + 3.12, cz, 0.55, 0.12, 0.55, { collide: false, cast: false });

  // Foundation / water table
  const foundH = 0.34;
  box(ctx, ctx.mats.brick, OX, -foundH * 0.5, OZ, (X1 - X0) + 0.18, foundH, (Z1 - Z0) + 0.18, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, OX, 0.02, OZ, (X1 - X0) + 0.22, 0.05, (Z1 - Z0) + 0.22, { collide: false, cast: false });
}

export function windowFill(ctx, wall, c, yStorey, xFace, zFace) {
  const y = yStorey + (WIN_SILL + WIN_HEAD) * 0.5;
  let x = c, z = c;
  if (wall === 's') { x = c; z = zFace - 0.45; }
  else if (wall === 'n') { x = c; z = zFace + 0.45; }
  else if (wall === 'w') { x = xFace + 0.5; z = c; }
  else { x = xFace - 0.5; z = c; }
  const fill = new THREE.PointLight(0xffd2a0, 0.55, 5.2, 1.7);
  fill.position.set(x, y, z);
  ctx.root.add(fill);
  ctx.lights.push({ light: fill, base: 0.55, flicker: 0.01 });
}
