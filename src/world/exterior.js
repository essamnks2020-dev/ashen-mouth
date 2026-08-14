import * as THREE from 'three';
import {
  T, H, H2, X0, X1, Z0, Z1, OX, OZ, WIN_W, WIN_SILL, WIN_HEAD,
} from './plan.js';
import { box, cyl } from './kit.js';

export function buildYard(ctx) {
  const grass = box(ctx, ctx.mats.grass, 0, -0.02, 1.2, 56, 0.04, 48, { collide: false, cast: false });
  grass.receiveShadow = true;
  ctx.world.addBox(0, -0.08, 1.2, 56, 0.16, 48, { surface: 'stone' });

  box(ctx, ctx.mats.brick, 0, 0.015, 9.4, 1.7, 0.03, 8.4, { collide: false, cast: false });
  box(ctx, ctx.mats.brick, 0, 0.015, 7.1, 3.6, 0.03, 1.6, { collide: false, cast: false });

  const lampX = 3.35, lampZ = 12.6;
  cyl(ctx, ctx.mats.iron, lampX, 1.7, lampZ, 0.06, 0.06, 3.4);
  cyl(ctx, ctx.mats.iron, lampX, 3.45, lampZ, 0.22, 0.18, 0.12, { cast: false });
  cyl(ctx, ctx.mats.lampShade, lampX, 3.28, lampZ, 0.18, 0.22, 0.28, { cast: false });
  const street = new THREE.PointLight(0xffd9a8, 1.35, 18, 1.55);
  street.position.set(lampX, 3.2, lampZ);
  ctx.root.add(street);
  ctx.lights.push({ light: street, base: 1.35, flicker: 0.05 });

  const fenceZ = 14.2;
  for (let i = -9; i <= 9; i++) {
    const x = i * 0.95;
    if (Math.abs(x) < 1.15) continue;
    box(ctx, ctx.mats.iron, x, 0.55, fenceZ, 0.05, 1.1, 0.05, { collide: false, cast: false });
  }
  box(ctx, ctx.mats.iron, -5.2, 1.08, fenceZ, 8.2, 0.03, 0.03, { collide: false, cast: false });
  box(ctx, ctx.mats.iron, 5.2, 1.08, fenceZ, 8.2, 0.03, 0.03, { collide: false, cast: false });
  box(ctx, ctx.mats.iron, -9.1, 0.55, fenceZ, 0.08, 1.15, 0.08, { collide: false });
  box(ctx, ctx.mats.iron, 9.1, 0.55, fenceZ, 0.08, 1.15, 0.08, { collide: false });
  box(ctx, ctx.mats.iron, -1.2, 0.55, fenceZ, 0.06, 1.12, 0.06, { collide: false });
  box(ctx, ctx.mats.iron, 1.2, 0.55, fenceZ, 0.06, 1.12, 0.06, { collide: false });

  box(ctx, ctx.mats.woodDark, 1.85, 0.55, 13.85, 0.08, 1.1, 0.08, { collide: false });
  box(ctx, ctx.mats.iron, 1.85, 1.05, 13.85, 0.22, 0.16, 0.12, { collide: false, cast: false });

  const trees = [
    [-8.4, 8.2], [8.6, 9.0], [-7.8, -7.2], [7.4, -6.4], [-9.2, 2.4], [9.5, 3.1], [-4.6, 15.6], [5.2, 16.2], [-7.0, 2.75],
  ];
  for (const [tx, tz] of trees) tree(ctx, tx, tz);

  for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) < 2) continue;
    hedge(ctx, i * 1.15, 6.55);
  }

  const moon = new THREE.DirectionalLight(0xc4d4e8, 0.95);
  moon.position.set(-14, 18, 22);
  moon.target.position.set(0, 1.6, 2);
  ctx.scene.add(moon);
  ctx.scene.add(moon.target);
  if (ctx.quality === 'high') {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 4;
    moon.shadow.camera.far = 50;
    moon.shadow.camera.left = moon.shadow.camera.bottom = -16;
    moon.shadow.camera.right = moon.shadow.camera.top = 16;
  }
  ctx.scene.add(new THREE.HemisphereLight(0xd0c4b0, 0x1c1410, 0.78));
  ctx.scene.add(new THREE.AmbientLight(0xfff0d8, 0.34));
}

function tree(ctx, x, z) {
  cyl(ctx, ctx.mats.bark, x, 0.85, z, 0.14, 0.18, 1.7);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), ctx.mats.leaf);
  canopy.position.set(x, 2.35, z);
  canopy.scale.set(1.35, 1.1, 1.25);
  canopy.castShadow = ctx.quality === 'high';
  canopy.receiveShadow = true;
  ctx.root.add(canopy);
  const c2 = canopy.clone();
  c2.position.set(x + 0.45, 2.05, z - 0.2);
  c2.scale.set(0.85, 0.7, 0.8);
  ctx.root.add(c2);
}

function hedge(ctx, x, z) {
  // Slightly irregular mass so hedges aren't perfect crates.
  box(ctx, ctx.mats.leaf, x, 0.36, z, 1.0, 0.72, 0.4, { collide: false, cast: false });
  box(ctx, ctx.mats.leaf, x + 0.18, 0.48, z + 0.05, 0.55, 0.5, 0.32, { collide: false, cast: false });
}

export function buildPorch(ctx) {
  const zDeck = Z1 + 1.15;
  box(ctx, ctx.mats.wood, 0, 0.03, zDeck, 3.8, 0.06, 2.35, { collide: false, cast: false });
  for (const x of [-1.7, 1.7]) {
    box(ctx, ctx.mats.wood, x, 1.35, Z1 + 2.15, 0.13, 2.55, 0.13, { collide: true });
    box(ctx, ctx.mats.wood, x, 1.35, Z1 + 0.35, 0.13, 2.55, 0.13, { collide: false });
  }
  box(ctx, ctx.mats.wood, 0, 2.68, zDeck + 0.05, 4.05, 0.1, 2.55, { collide: false });
  const porchLight = new THREE.PointLight(0xffc888, 1.85, 10, 1.45);
  porchLight.position.set(0.0, 2.44, Z1 + 0.32);
  ctx.root.add(porchLight);
  ctx.lights.push({ light: porchLight, base: 1.85, flicker: 0.04 });
  cyl(ctx, ctx.mats.brass, 0.0, 2.5, Z1 + 0.22, 0.04, 0.04, 0.08, { cast: false });
  cyl(ctx, ctx.mats.lampShade, 0.0, 2.4, Z1 + 0.22, 0.12, 0.08, 0.14, { cast: false });

  box(ctx, ctx.mats.wood, -1.85, 0.48, zDeck, 0.05, 0.72, 2.2, { collide: false, cast: false });
  box(ctx, ctx.mats.wood, 1.85, 0.48, zDeck, 0.05, 0.72, 2.2, { collide: false, cast: false });

  box(ctx, ctx.mats.brass, 0.72, 1.72, Z1 + 0.12, 0.28, 0.18, 0.03, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, 0.72, 1.72, Z1 + 0.14, 0.22, 0.12, 0.01, { collide: false, cast: false });
}

export function buildRoof(ctx) {
  const rise = 2.05;
  const yEave = H2;
  const over = 0.45;
  const w = (X1 - X0) + over * 2;
  const d = (Z1 - Z0) + over * 2;
  const hw = w * 0.5;
  const len = Math.hypot(hw, rise);
  const ang = Math.atan2(rise, hw);

  const left = box(ctx, ctx.mats.shingle, -hw * 0.5, yEave + rise * 0.5, OZ, len, 0.1, d, { collide: false });
  left.rotation.z = ang;
  const right = box(ctx, ctx.mats.shingle, hw * 0.5, yEave + rise * 0.5, OZ, len, 0.1, d, { collide: false });
  right.rotation.z = -ang;

  const gableShape = new THREE.Shape();
  gableShape.moveTo(X0, H2);
  gableShape.lineTo(0, H2 + rise);
  gableShape.lineTo(X1, H2);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: T, bevelEnabled: false });
  gableGeo.translate(0, 0, -T * 0.5);
  const fg = new THREE.Mesh(gableGeo, ctx.mats.brick);
  fg.position.z = Z1 - T * 0.5;
  fg.castShadow = ctx.quality === 'high';
  fg.receiveShadow = true;
  ctx.root.add(fg);
  const bg = fg.clone();
  bg.position.z = Z0 + T * 0.5;
  ctx.root.add(bg);

  box(ctx, ctx.mats.woodDark, 0, H2 + rise + 0.06, OZ, 0.16, 0.12, d + 0.1, { collide: false });

  const cx = X0 + 1.15, cz = Z0 + 2.4;
  box(ctx, ctx.mats.brick, cx, H2 + 1.35, cz, 0.62, 2.7, 0.62, { collide: false });
  box(ctx, ctx.mats.iron, cx, H2 + 2.72, cz, 0.72, 0.1, 0.72, { collide: false, cast: false });

  const foundH = 0.28;
  box(ctx, ctx.mats.brick, OX, -foundH * 0.5, OZ, (X1 - X0) + 0.12, foundH, (Z1 - Z0) + 0.12, { collide: false, cast: false });
}

export function windowFill(ctx, wall, c, yStorey, xFace, zFace) {
  const y = yStorey + (WIN_SILL + WIN_HEAD) * 0.5;
  let x = c, z = c;
  if (wall === 's') { x = c; z = zFace - 0.4; }
  else if (wall === 'n') { x = c; z = zFace + 0.4; }
  else if (wall === 'w') { x = xFace + 0.45; z = c; }
  else { x = xFace - 0.45; z = c; }
  const fill = new THREE.PointLight(0xc4d8ee, 0.42, 4.8, 1.8);
  fill.position.set(x, y, z);
  ctx.root.add(fill);
  ctx.lights.push({ light: fill, base: 0.42, flicker: 0 });
}
