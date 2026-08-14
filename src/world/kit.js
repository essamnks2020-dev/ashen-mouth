import * as THREE from 'three';
import { damp } from '../core/util.js';
import {
  T, H, H2, RISE, TREADS, RUN, RISERS, DOOR_W, DOOR_H, WIN_SILL, WIN_HEAD, WIN_W,
} from './plan.js';

export function createCtx(scene, world, mats, quality) {
  const root = new THREE.Group();
  scene.add(root);
  return {
    root, world, mats, quality, scene,
    living: [], interact: [], lights: [],
    unit: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 8),
    sphere: new THREE.SphereGeometry(1, 10, 8),
  };
}

export function box(ctx, mat, x, y, z, w, h, d, opts = {}) {
  const m = new THREE.Mesh(ctx.unit, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = opts.cast !== false && ctx.quality === 'high';
  m.receiveShadow = opts.recv !== false;
  (opts.parent || ctx.root).add(m);
  if (opts.collide) {
    ctx.world.addBox(x, y, z, w, h, d, { surface: opts.surface || 'wood', ...opts.col });
  }
  return m;
}

export function cyl(ctx, mat, x, y, z, rTop, rBot, h, opts = {}) {
  const m = new THREE.Mesh(ctx.cyl, mat);
  m.position.set(x, y, z);
  m.scale.set(rTop, h, rBot ?? rTop);
  m.castShadow = opts.cast !== false && ctx.quality === 'high';
  m.receiveShadow = opts.recv !== false;
  if (opts.rotX) m.rotation.x = opts.rotX;
  if (opts.rotZ) m.rotation.z = opts.rotZ;
  (opts.parent || ctx.root).add(m);
  return m;
}

function subtract(from, to, cuts) {
  const list = cuts
    .map(([a, b]) => [Math.max(from, Math.min(a, b)), Math.min(to, Math.max(a, b))])
    .filter(([a, b]) => b - a > 0.01)
    .sort((u, v) => u[0] - v[0]);
  const out = [];
  let cur = from;
  for (const [s, e] of list) {
    if (s > cur + 0.01) out.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (cur < to - 0.01) out.push([cur, to]);
  return out;
}

/**
 * Wall with door/window openings that are height-banded (windows are NOT
 * full-height holes). axis 'x' = constant x=pos, span on z; 'z' = constant z.
 * skirt: +1 / -1 offsets skirting toward interior.
 */
export function wall(ctx, {
  axis, pos, y0, h, from, to, openings = [], mat, collide = true, thick = T, skirt = 0, crown = true,
}) {
  const yTop = y0 + h;
  const ys = new Set([y0, yTop]);
  for (const o of openings) {
    const sill = o.sill ?? y0;
    const head = o.head ?? yTop;
    if (sill > y0 + 0.02) ys.add(sill);
    if (head < yTop - 0.02) ys.add(head);
  }
  const ylist = [...ys].sort((a, b) => a - b);
  for (let i = 0; i < ylist.length - 1; i++) {
    const ya = ylist[i], yb = ylist[i + 1];
    const yh = yb - ya;
    if (yh < 0.025) continue;
    const cuts = [];
    for (const o of openings) {
      const sill = o.sill ?? y0;
      const head = o.head ?? yTop;
      if (sill < yb - 0.008 && head > ya + 0.008) cuts.push([o.a, o.b]);
    }
    const segs = subtract(from, to, cuts);
    for (const [a, b] of segs) {
      const span = b - a;
      if (span < 0.03) continue;
      const mid = (a + b) * 0.5;
      const yc = (ya + yb) * 0.5;
      if (axis === 'x') box(ctx, mat, pos, yc, mid, thick, yh, span, { collide, surface: 'stone' });
      else box(ctx, mat, mid, yc, pos, span, yh, thick, { collide, surface: 'stone' });

      if (skirt && Math.abs(ya - y0) < 0.02) {
        const off = skirt * (thick * 0.5 + 0.012);
        if (axis === 'x') box(ctx, ctx.mats.woodDark, pos + off, y0 + 0.06, mid, 0.04, 0.12, span, { collide: false, cast: false });
        else box(ctx, ctx.mats.woodDark, mid, y0 + 0.06, pos + off, span, 0.12, 0.04, { collide: false, cast: false });
      }
      if (crown && Math.abs(yb - yTop) < 0.02 && yh > 0.2) {
        const off = skirt * (thick * 0.5 + 0.014);
        if (axis === 'x') box(ctx, ctx.mats.wood, pos + off, yTop - 0.04, mid, 0.03, 0.06, span, { collide: false, cast: false });
        else box(ctx, ctx.mats.wood, mid, yTop - 0.04, pos + off, span, 0.06, 0.03, { collide: false, cast: false });
      }
    }
  }
}

export function floors(ctx, cx, y, cz, w, d, holes, mat, collide = true) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const zs = new Set([z0, z1]);
  for (const h of holes) {
    zs.add(h.z - h.d / 2);
    zs.add(h.z + h.d / 2);
  }
  const zlist = [...zs].sort((a, b) => a - b);
  for (let i = 0; i < zlist.length - 1; i++) {
    const za = zlist[i], zb = zlist[i + 1];
    if (zb - za < 0.06) continue;
    const zm = (za + zb) * 0.5;
    const xs = new Set([x0, x1]);
    for (const h of holes) {
      if (zm > h.z - h.d / 2 && zm < h.z + h.d / 2) {
        xs.add(h.x - h.w / 2);
        xs.add(h.x + h.w / 2);
      }
    }
    const xlist = [...xs].sort((a, b) => a - b);
    for (let j = 0; j < xlist.length - 1; j++) {
      const xa = xlist[j], xb = xlist[j + 1];
      if (xb - xa < 0.06) continue;
      const xm = (xa + xb) * 0.5;
      let blocked = false;
      for (const h of holes) {
        if (Math.abs(xm - h.x) < h.w / 2 && Math.abs(zm - h.z) < h.d / 2) blocked = true;
      }
      if (blocked) continue;
      box(ctx, mat, xm, y + 0.04, zm, xb - xa, 0.08, zb - za, { cast: false });
      if (collide) ctx.world.addBox(xm, y - 0.04, zm, xb - xa, 0.12, zb - za, { surface: 'wood' });
    }
  }
}

export function ceiling(ctx, cx, y, cz, w, d, holes, mat) {
  floors(ctx, cx, y - 0.04, cz, w, d, holes, mat, false);
}

/**
 * Closed-string stair. Visual treads align to RISE; walkable surface is ONE ramp
 * from yLow at zBot to yHigh at zTop. No stacked box colliders.
 */
export function stairs(ctx, spec) {
  const { x, w, yLow, yHigh, zBot, dirZ } = spec;
  const rise = (yHigh - yLow) / RISERS;
  const g = new THREE.Group();
  ctx.root.add(g);
  const P = { parent: g, collide: false };

  for (let i = 0; i < TREADS; i++) {
    const yTop = yLow + rise * (i + 1);
    const z = zBot + dirZ * RUN * i;
    box(ctx, ctx.mats.wood, x, yTop - 0.018, z, w, 0.036, RUN + 0.02, P);
    box(ctx, ctx.mats.woodDark, x, yTop - 0.002, z + dirZ * RUN * 0.42, w, 0.02, 0.04, { ...P, cast: false });
    const prevY = yLow + rise * i;
    // Closed riser face — thin open stringers read as floating slabs.
    box(ctx, ctx.mats.woodDark, x, (prevY + yTop) * 0.5, z - dirZ * (RUN * 0.5 - 0.01), w - 0.02, rise - 0.01, 0.055, P);
  }

  const zTop = zBot + dirZ * TREADS * RUN;
  const pitch = Math.atan2(yHigh - yLow, Math.abs(zTop - zBot));
  const len = Math.hypot(Math.abs(zTop - zBot), yHigh - yLow);
  const zMid = (zBot + zTop) * 0.5;
  const yMid = (yLow + yHigh) * 0.5 + 0.04;
  for (const side of [-1, 1]) {
    const sx = x + side * (w * 0.5 - 0.04);
    const str = box(ctx, ctx.mats.woodDark, sx, yMid, zMid, 0.08, 0.28, len, P);
    str.rotation.x = dirZ < 0 ? pitch : -pitch;
  }

  const z0 = Math.min(zBot, zTop) - 0.06;
  const z1 = Math.max(zBot, zTop) + 0.06;
  const half = w * 0.5 - 0.02;
  if (dirZ < 0) ctx.world.addRamp(x - half, x + half, z0, z1, yHigh, yLow);
  else ctx.world.addRamp(x - half, x + half, z0, z1, yLow, yHigh);

  const handY = (yLow + yHigh) * 0.5 + 0.86;
  for (const side of [-1, 1]) {
    const hx = x + side * (w * 0.5);
    const rail = box(ctx, ctx.mats.wood, hx, handY, zMid, 0.045, 0.045, len + 0.08, P);
    rail.rotation.x = dirZ < 0 ? pitch : -pitch;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const z = zBot + dirZ * TREADS * RUN * t;
      const y = yLow + (yHigh - yLow) * t + 0.38;
      box(ctx, ctx.mats.wood, hx, y, z, 0.032, 0.88, 0.032, P);
    }
  }
  box(ctx, ctx.mats.woodDark, x - w * 0.5, yLow + 0.48, zBot, 0.1, 0.96, 0.1, { collide: true });
  box(ctx, ctx.mats.woodDark, x + w * 0.5, yLow + 0.48, zBot, 0.1, 0.96, 0.1, { collide: true });
  box(ctx, ctx.mats.woodDark, x - w * 0.5, yHigh + 0.46, zTop, 0.1, 0.92, 0.1, { collide: true });
  box(ctx, ctx.mats.woodDark, x + w * 0.5, yHigh + 0.46, zTop, 0.1, 0.92, 0.1, { collide: true });
}

export function rail(ctx, x, y, z0, z1, h = 0.92) {
  const z = (z0 + z1) * 0.5, d = Math.abs(z1 - z0);
  box(ctx, ctx.mats.wood, x, y + h * 0.5, z, 0.06, h, d, { collide: true });
  box(ctx, ctx.mats.woodDark, x, y + h, z, 0.08, 0.04, d, { collide: false, cast: false });
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    box(ctx, ctx.mats.wood, x, y + h * 0.45, z0 + (z1 - z0) * t, 0.03, h * 0.85, 0.03, { collide: false, cast: false });
  }
}

export function ceilingLamp(ctx, x, y, z, opts = {}) {
  cyl(ctx, ctx.mats.brass, x, y - 0.08, z, 0.018, 0.018, 0.16, { cast: false });
  cyl(ctx, ctx.mats.lampShade, x, y - 0.22, z, 0.22, 0.12, 0.18, { cast: false });
  const color = opts.color ?? 0xffe1b0;
  const base = opts.base ?? 2.15;
  const L = new THREE.PointLight(color, base, opts.dist ?? 9.5, 1.45);
  L.position.set(x, y - 0.28, z);
  ctx.root.add(L);
  ctx.lights.push({ light: L, base, flicker: opts.flicker ?? 0.02, id: opts.id, toggle: !!opts.toggle, on: true });
}

export function placeWindow(ctx, spec) {
  const w = spec.w ?? WIN_W;
  const h = WIN_HEAD - WIN_SILL;
  const y = spec.y + (WIN_SILL + WIN_HEAD) * 0.5;
  let x, z, ww, wd, inward;
  if (spec.wall === 's') {
    x = spec.c; z = spec.zFace; ww = w + 0.1; wd = 0.08; inward = -1;
  } else if (spec.wall === 'n') {
    x = spec.c; z = spec.zFace; ww = w + 0.1; wd = 0.08; inward = 1;
  } else if (spec.wall === 'w') {
    x = spec.xFace; z = spec.c; ww = 0.08; wd = w + 0.1; inward = 1;
  } else {
    x = spec.xFace; z = spec.c; ww = 0.08; wd = w + 0.1; inward = -1;
  }
  const isWE = spec.wall === 'w' || spec.wall === 'e';
  // Deep casing + sill so windows read as openings, not stickers.
  box(ctx, ctx.mats.wood, x, y, z, isWE ? 0.12 : w + 0.18, h + 0.2, isWE ? w + 0.18 : 0.12, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, x, spec.y + WIN_SILL - 0.05, z + (isWE ? 0 : inward * 0.05),
    isWE ? 0.14 : w + 0.22, 0.08, isWE ? w + 0.22 : 0.14, { collide: false });
  box(ctx, ctx.mats.woodDark, x, spec.y + WIN_HEAD + 0.04, z + (isWE ? 0 : inward * 0.03),
    isWE ? 0.12 : w + 0.18, 0.06, isWE ? w + 0.18 : 0.12, { collide: false, cast: false });
  // Dark reveal behind glass
  const dark = box(ctx, ctx.mats.soot, x + (isWE ? inward * 0.02 : 0), y, z + (isWE ? 0 : inward * 0.02),
    isWE ? 0.04 : w - 0.06, h - 0.08, isWE ? w - 0.06 : 0.04, { collide: false, cast: false });
  dark.castShadow = false;
  const inset = inward * 0.04;
  const gx = isWE ? x + inset : x;
  const gz = isWE ? z : z + inset;
  const glass = box(ctx, ctx.mats.glassWarm, gx, y, gz,
    isWE ? 0.02 : w - 0.14, h - 0.16, isWE ? w - 0.14 : 0.02, { collide: false, cast: false });
  glass.castShadow = false;
  const glow = box(ctx, ctx.mats.windowGlow, gx + (isWE ? inward * 0.01 : 0), y, gz + (isWE ? 0 : inward * 0.01),
    isWE ? 0.015 : w - 0.22, h - 0.24, isWE ? w - 0.22 : 0.015, { collide: false, cast: false, recv: false });
  glow.castShadow = false;
  // Four-lite muntins
  box(ctx, ctx.mats.woodDark, gx, y, gz, isWE ? 0.022 : 0.03, h - 0.18, isWE ? 0.03 : 0.022, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, gx, y, gz, isWE ? 0.022 : w - 0.18, 0.03, isWE ? w - 0.18 : 0.022, { collide: false, cast: false });
  // Exterior shutter blades (thin, offset) so facade isn't bare brick + glow.
  if (!isWE && ctx.quality !== 'low') {
    const sx = w * 0.5 + 0.12;
    for (const side of [-1, 1]) {
      box(ctx, ctx.mats.woodDark, x + side * sx, y, z + inward * 0.02, 0.18, h * 0.92, 0.04, { collide: false, cast: false });
      for (const uy of [-0.22, 0, 0.22]) {
        box(ctx, ctx.mats.wood, x + side * sx, y + uy * h * 0.35, z + inward * 0.04, 0.14, 0.03, 0.02, { collide: false, cast: false });
      }
    }
  }

  if (spec.curtains && ctx.quality !== 'low') {
    const cz = isWE ? z : z + inward * 0.12;
    const cx = isWE ? x + inward * 0.12 : x;
    addCurtains(ctx, isWE ? z : x, spec.y + (WIN_SILL + WIN_HEAD) * 0.5, isWE, cx, cz, w, h + 0.35);
  }
}

function addCurtains(ctx, spanC, y, isWE, x, z, w, h) {
  const geo = new THREE.PlaneGeometry(w * 0.46, h, 6, 10);
  const left = new THREE.Mesh(geo, ctx.mats.curtainMat);
  const right = new THREE.Mesh(geo.clone(), ctx.mats.curtainMat);
  if (isWE) {
    left.position.set(x, y, spanC - w * 0.22);
    right.position.set(x, y, spanC + w * 0.22);
    left.rotation.y = right.rotation.y = Math.PI / 2;
  } else {
    left.position.set(spanC - w * 0.22, y, z);
    right.position.set(spanC + w * 0.22, y, z);
  }
  left.castShadow = right.castShadow = false;
  ctx.root.add(left, right);
}

export function makeDoor(ctx, x, y, z, rotY, id, title, startClosed, openSign, opts = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  ctx.root.add(group);

  box(ctx, ctx.mats.wood, 0, DOOR_H * 0.5 + 0.06, 0, DOOR_W + 0.16, 0.1, 0.1, { parent: group, collide: false, cast: false });
  box(ctx, ctx.mats.wood, -DOOR_W * 0.5 - 0.05, DOOR_H * 0.5, 0, 0.1, DOOR_H + 0.08, 0.1, { parent: group, collide: false, cast: false });
  box(ctx, ctx.mats.wood, DOOR_W * 0.5 + 0.05, DOOR_H * 0.5, 0, 0.1, DOOR_H + 0.08, 0.1, { parent: group, collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, 0, 0.02, 0, DOOR_W + 0.08, 0.04, 0.12, { parent: group, collide: false, cast: false });

  if (opts.transom) {
    box(ctx, ctx.mats.wood, 0, DOOR_H + 0.28, 0, DOOR_W + 0.16, 0.08, 0.1, { parent: group, collide: false, cast: false });
    box(ctx, ctx.mats.glassWarm, 0, DOOR_H + 0.28, 0, DOOR_W - 0.08, 0.32, 0.03, { parent: group, collide: false, cast: false });
  }

  const leaf = new THREE.Group();
  leaf.position.set(-DOOR_W * 0.5, 0, 0);
  group.add(leaf);
  const pw = DOOR_W, ph = DOOR_H;
  box(ctx, ctx.mats.woodDark, pw * 0.5, ph * 0.5, 0, pw, ph, 0.05, { parent: leaf });
  const panels = opts.front
    ? [[0.26, 0.42, 0.28, 0.52], [0.72, 0.42, 0.28, 0.52], [0.26, 1.05, 0.28, 0.52], [0.72, 1.05, 0.28, 0.52], [0.26, 1.68, 0.28, 0.36], [0.72, 1.68, 0.28, 0.36]]
    : [[0.5, 0.55, 0.62, 0.62], [0.5, 1.48, 0.62, 0.7]];
  for (const [u, v, ww, hh] of panels) {
    box(ctx, ctx.mats.wood, u * pw, v, 0.016, opts.front ? ww : ww * pw, hh, 0.018, { parent: leaf, cast: false });
  }
  box(ctx, ctx.mats.brass, pw - 0.08, 1.02, 0.04, 0.045, 0.045, 0.04, { parent: leaf, cast: false });
  cyl(ctx, ctx.mats.brass, pw - 0.08, 1.02, 0.06, 0.018, 0.018, 0.04, { parent: leaf, rotX: Math.PI / 2, cast: false });
  if (opts.front) {
    box(ctx, ctx.mats.brass, pw * 0.5, 1.35, 0.04, 0.18, 0.04, 0.02, { parent: leaf, cast: false });
    box(ctx, ctx.mats.iron, pw * 0.5, 0.92, 0.035, 0.16, 0.08, 0.02, { parent: leaf, cast: false });
  }

  const colW = rotY !== 0 ? 0.16 : 1.02;
  const colD = rotY !== 0 ? 1.02 : 0.16;
  const col = ctx.world.addBox(x, y + 1.08, z, colW, 2.16, colD, { door: id, surface: 'wood' });
  const door = {
    id, group: leaf, open: 0, want: startClosed ? 0 : 1, col, rotY,
    openAngle: (openSign || 1) * 1.32,
  };
  ctx.living.push({
    update(dt) {
      door.open = damp(door.open, door.want, 3.4, dt);
      leaf.rotation.y = door.open * door.openAngle;
      col.alive = door.open < 0.5;
      col.solid = door.open < 0.5;
    },
  });
  ctx.interact.push({
    kind: 'door', id, title, pos: new THREE.Vector3(x, y + 1.1, z), reach: 1.85,
    door,
    use(story, audio) {
      door.want = door.want > 0.5 ? 0 : 1;
      audio?.door?.(x, y, z);
      return { hint: door.want ? 'The door takes its weight.' : 'It settles shut.' };
    },
  });
  return door;
}

export function picture(ctx, x, y, z, w, h, wall, matInner) {
  const isWE = wall === 'w' || wall === 'e';
  box(ctx, ctx.mats.woodDark, x, y, z, isWE ? 0.04 : w, h, isWE ? w : 0.04, { collide: false, cast: false });
  box(ctx, matInner || ctx.mats.linen, x + (wall === 'w' ? 0.02 : wall === 'e' ? -0.02 : 0), y,
    z + (wall === 's' ? -0.02 : wall === 'n' ? 0.02 : 0),
    isWE ? 0.01 : w - 0.08, h - 0.08, isWE ? w - 0.08 : 0.01, { collide: false, cast: false });
}

export function switchPlate(ctx, x, y, z, wall) {
  const isWE = wall === 'w' || wall === 'e';
  box(ctx, ctx.mats.porcelain, x, y, z, isWE ? 0.02 : 0.07, 0.11, isWE ? 0.07 : 0.02, { collide: false, cast: false });
  box(ctx, ctx.mats.brass, x, y, z, isWE ? 0.03 : 0.02, 0.04, isWE ? 0.02 : 0.03, { collide: false, cast: false });
}

export function rug(ctx, x, y, z, w, d, mat) {
  box(ctx, mat || ctx.mats.carpet, x, y + 0.015, z, w, 0.03, d, { collide: false, cast: false });
}

export function chair(ctx, x, y, z, rotY, mat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;
  ctx.root.add(g);
  const m = mat || ctx.mats.wood;
  const P = { parent: g, collide: false };
  const seatH = 0.46;
  for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
    box(ctx, m, lx, seatH * 0.5, lz, 0.035, seatH, 0.035, P);
  }
  box(ctx, m, 0, seatH, 0, 0.44, 0.04, 0.42, P);
  box(ctx, ctx.mats.linen, 0, seatH + 0.035, 0.01, 0.4, 0.035, 0.38, P);
  box(ctx, m, 0, 0.78, -0.19, 0.42, 0.58, 0.04, P);
  box(ctx, m, -0.18, 0.78, -0.19, 0.04, 0.5, 0.03, { ...P, cast: false });
  box(ctx, m, 0.18, 0.78, -0.19, 0.04, 0.5, 0.03, { ...P, cast: false });
  box(ctx, m, 0, 1.05, -0.19, 0.38, 0.04, 0.04, { ...P, cast: false });
  ctx.world.addBox(x, y + 0.42, z, 0.48, 0.84, 0.48, { surface: 'wood' });
}

export function table(ctx, x, y, z, w, d, rotY) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;
  ctx.root.add(g);
  const P = { parent: g };
  const top = 0.75;
  box(ctx, ctx.mats.wood, 0, top, 0, w, 0.04, d, P);
  box(ctx, ctx.mats.woodDark, 0, top - 0.06, 0, w - 0.06, 0.06, d - 0.06, P);
  const ix = w * 0.5 - 0.07, iz = d * 0.5 - 0.07;
  for (const [lx, lz] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]]) {
    box(ctx, ctx.mats.woodDark, lx, top * 0.5 - 0.02, lz, 0.055, top - 0.04, 0.055, P);
  }
  ctx.world.addBox(x, y + 0.4, z, w, 0.8, d, { surface: 'wood' });
}

export function sofa(ctx, x, y, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;
  ctx.root.add(g);
  const P = { parent: g };
  const f = ctx.mats.fabric;
  // Skirt + legs so it doesn't read as one wood crate.
  box(ctx, ctx.mats.woodDark, 0, 0.06, 0, 2.08, 0.1, 0.84, P);
  for (const [lx, lz] of [[-0.92, -0.32], [0.92, -0.32], [-0.92, 0.32], [0.92, 0.32]]) {
    box(ctx, ctx.mats.woodDark, lx, 0.09, lz, 0.06, 0.18, 0.06, P);
  }
  box(ctx, f, 0, 0.3, 0.06, 1.92, 0.26, 0.7, P);
  box(ctx, f, 0, 0.58, -0.3, 1.92, 0.5, 0.18, P);
  box(ctx, f, -0.98, 0.44, 0.02, 0.16, 0.52, 0.76, P);
  box(ctx, f, 0.98, 0.44, 0.02, 0.16, 0.52, 0.76, P);
  box(ctx, ctx.mats.linen, -0.48, 0.48, 0.08, 0.86, 0.12, 0.56, { ...P, cast: false });
  box(ctx, ctx.mats.linen, 0.48, 0.48, 0.08, 0.86, 0.12, 0.56, { ...P, cast: false });
  box(ctx, ctx.mats.linen, 0, 0.72, -0.28, 1.7, 0.1, 0.12, { ...P, cast: false });
  ctx.world.addBox(x, y + 0.4, z, 2.15, 0.82, 0.92, { surface: 'wood' });
}

export function armchair(ctx, x, y, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;
  ctx.root.add(g);
  const P = { parent: g };
  const f = ctx.mats.fabric;
  box(ctx, f, 0, 0.28, 0, 0.72, 0.28, 0.70, P);
  box(ctx, f, 0, 0.55, -0.24, 0.72, 0.46, 0.2, P);
  box(ctx, f, -0.38, 0.42, 0, 0.14, 0.4, 0.68, P);
  box(ctx, f, 0.38, 0.42, 0, 0.14, 0.4, 0.68, P);
  ctx.world.addBox(x, y + 0.38, z, 0.82, 0.76, 0.78, { surface: 'wood' });
}

export function bed(ctx, x, y, z, rotY, twin = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;
  ctx.root.add(g);
  const P = { parent: g };
  const w = twin ? 1.05 : 1.48;
  const d = twin ? 1.85 : 2.05;
  // Frame rails + legs, not one wood brick.
  box(ctx, ctx.mats.woodDark, 0, 0.22, 0, w + 0.1, 0.12, d + 0.1, P);
  for (const [lx, lz] of [[-w * 0.45, -d * 0.45], [w * 0.45, -d * 0.45], [-w * 0.45, d * 0.45], [w * 0.45, d * 0.45]]) {
    box(ctx, ctx.mats.woodDark, lx, 0.14, lz, 0.07, 0.28, 0.07, P);
  }
  box(ctx, ctx.mats.linen, 0, 0.4, 0.04, w, 0.18, d - 0.12, P);
  box(ctx, ctx.mats.fabric, 0, 0.52, 0.08, w - 0.08, 0.08, d * 0.55, { ...P, cast: false });
  box(ctx, ctx.mats.woodDark, 0, 0.7, -d * 0.5 + 0.04, w + 0.12, 1.05, 0.07, P);
  box(ctx, ctx.mats.woodDark, 0, 0.42, d * 0.5 - 0.04, w + 0.08, 0.48, 0.06, P);
  box(ctx, ctx.mats.linen, -w * 0.22, 0.56, -d * 0.28, 0.4, 0.14, 0.3, { ...P, cast: false });
  box(ctx, ctx.mats.linen, w * 0.22, 0.56, -d * 0.28, 0.4, 0.14, 0.3, { ...P, cast: false });
  ctx.world.addBox(x, y + 0.35, z, w + 0.15, 0.7, d + 0.15, { surface: 'wood' });
}

export function nightstand(ctx, x, y, z) {
  box(ctx, ctx.mats.wood, x, y + 0.28, z, 0.42, 0.56, 0.38, { collide: true });
  box(ctx, ctx.mats.woodDark, x, y + 0.18, z + 0.18, 0.36, 0.12, 0.04, { collide: false, cast: false });
  box(ctx, ctx.mats.brass, x, y + 0.18, z + 0.21, 0.08, 0.02, 0.02, { collide: false, cast: false });
}

export function lamp(ctx, x, y, z, id, base = 1.05) {
  cyl(ctx, ctx.mats.woodDark, x, y + 0.28, z, 0.07, 0.09, 0.08, { cast: false });
  cyl(ctx, ctx.mats.brass, x, y + 0.52, z, 0.015, 0.015, 0.42);
  cyl(ctx, ctx.mats.lampShade, x, y + 0.82, z, 0.14, 0.14, 0.18, { cast: false });
  const L = new THREE.PointLight(0xffd19a, base, 6.5, 1.65);
  L.position.set(x, y + 0.78, z);
  ctx.root.add(L);
  ctx.lights.push({ light: L, base, flicker: 0.035, id, toggle: true, on: true });
  ctx.interact.push({
    kind: 'light', id: id + '-lamp', title: 'Lamp', pos: new THREE.Vector3(x, y + 0.7, z), reach: 1.55, lightId: id,
  });
}

export function wardrobe(ctx, x, y, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;
  ctx.root.add(g);
  box(ctx, ctx.mats.woodDark, 0, 1.05, 0, 1.15, 2.1, 0.52, { parent: g });
  box(ctx, ctx.mats.wood, -0.28, 1.05, 0.27, 0.52, 1.95, 0.04, { parent: g, cast: false });
  box(ctx, ctx.mats.wood, 0.28, 1.05, 0.27, 0.52, 1.95, 0.04, { parent: g, cast: false });
  box(ctx, ctx.mats.brass, -0.08, 1.05, 0.3, 0.03, 0.1, 0.03, { parent: g, cast: false });
  box(ctx, ctx.mats.brass, 0.08, 1.05, 0.3, 0.03, 0.1, 0.03, { parent: g, cast: false });
  ctx.world.addBox(x, y + 1.05, z, 1.2, 2.1, 0.56, { surface: 'wood' });
}

export function sideboard(ctx, x, y, z, w = 1.6) {
  box(ctx, ctx.mats.wood, x, 0.42, z, w, 0.84, 0.42, { collide: true });
  box(ctx, ctx.mats.woodDark, x - w * 0.22, 0.38, z + 0.2, w * 0.38, 0.55, 0.04, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, x + w * 0.22, 0.38, z + 0.2, w * 0.38, 0.55, 0.04, { collide: false, cast: false });
}

export function clock(ctx, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  ctx.root.add(g);
  box(ctx, ctx.mats.woodDark, 0, 1.08, 0, 0.44, 2.16, 0.26, { parent: g });
  box(ctx, ctx.mats.wood, 0, 1.88, 0.12, 0.32, 0.32, 0.04, { parent: g, cast: false });
  box(ctx, ctx.mats.linen, 0, 1.88, 0.14, 0.26, 0.26, 0.01, { parent: g, cast: false });
  box(ctx, ctx.mats.woodDark, 0, 1.88, 0.15, 0.02, 0.1, 0.01, { parent: g, cast: false });
  const pendulum = new THREE.Group();
  pendulum.position.set(0, 1.35, 0.1);
  g.add(pendulum);
  box(ctx, ctx.mats.brass, 0, -0.42, 0, 0.03, 0.84, 0.03, { parent: pendulum, cast: false });
  box(ctx, ctx.mats.brass, 0, -0.86, 0, 0.1, 0.1, 0.04, { parent: pendulum, cast: false });
  ctx.living.push({ update(dt, t) { pendulum.rotation.z = Math.sin(t * 2.05) * 0.16; } });
  ctx.world.addBox(x, y + 1.08, z, 0.5, 2.16, 0.32, { surface: 'wood' });
}

export function coatRack(ctx, x, y, z) {
  cyl(ctx, ctx.mats.wood, x, 0.95, z, 0.035, 0.035, 1.9);
  cyl(ctx, ctx.mats.woodDark, x, 0.04, z, 0.16, 0.16, 0.05, { cast: false });
  box(ctx, ctx.mats.coat, x + 0.08, 1.25, z - 0.04, 0.32, 1.05, 0.1, { collide: false });
  ctx.world.addBox(x, 0.95, z, 0.28, 1.9, 0.28, { surface: 'wood' });
}

export function makeDrawer(ctx, x, y, z, w, h, d, axis, title, body, frag) {
  const leaf = box(ctx, ctx.mats.woodDark, x, y, z, w, h, d);
  box(ctx, ctx.mats.brass, x + (axis === 'x' ? -w * 0.05 : 0), y, z + (axis === 'z' ? d * 0.42 : 0.02), 0.08, 0.02, 0.03, { collide: false, cast: false });
  const anim = { open: 0, want: 0 };
  const base = leaf.position.clone();
  ctx.living.push({
    update(dt) {
      anim.open = damp(anim.open, anim.want, 7, dt);
      if (axis === 'x') leaf.position.x = base.x - anim.open * 0.36;
      else leaf.position.z = base.z + anim.open * 0.36;
    },
  });
  ctx.world.addBox(x, y, z, w + 0.04, h + 0.1, d + 0.04, { surface: 'wood' });
  ctx.interact.push({
    kind: 'drawer', id: title, title, pos: new THREE.Vector3(x, y, z), reach: 1.55, body, frag, anim,
  });
}

export function makeCupboard(ctx, x, y, z, w, h, d, hinge, title, body) {
  box(ctx, ctx.mats.wood, x, y, z, w, h, d, { collide: true });
  const door = new THREE.Group();
  const hx = hinge === 'left' ? -w * 0.48 : w * 0.48;
  door.position.set(x + hx, y, z + d * 0.52);
  ctx.root.add(door);
  const panel = box(ctx, ctx.mats.woodDark, -hx * 0.02 + (hinge === 'left' ? w * 0.46 : -w * 0.46), 0, 0, w * 0.9, h * 0.9, 0.035, { parent: door });
  box(ctx, ctx.mats.brass, (hinge === 'left' ? 1 : -1) * w * 0.32, 0, 0.03, 0.03, 0.08, 0.025, { parent: panel, cast: false });
  const anim = { open: 0, want: 0 };
  ctx.living.push({
    update(dt) {
      anim.open = damp(anim.open, anim.want, 5.5, dt);
      door.rotation.y = anim.open * (hinge === 'left' ? -1.15 : 1.15);
    },
  });
  ctx.interact.push({
    kind: 'cupboard', id: title, title, pos: new THREE.Vector3(x, y, z + d * 0.5), reach: 1.6, body, anim,
  });
}

export function kitchenRun(ctx, x, z0, z1) {
  const z = (z0 + z1) * 0.5, d = Math.abs(z1 - z0);
  // Base cabinets + toe kick + door faces — not one wood volume.
  box(ctx, ctx.mats.woodDark, x, 0.05, z, 0.56, 0.1, d, { collide: false, cast: false });
  box(ctx, ctx.mats.wood, x, 0.48, z, 0.56, 0.76, d, { collide: true });
  box(ctx, ctx.mats.porcelain, x - 0.02, 0.9, z, 0.6, 0.05, d + 0.04, { collide: false });
  const doors = Math.max(3, Math.floor(d / 0.72));
  for (let i = 0; i < doors; i++) {
    const t = (i + 0.5) / doors;
    const dz = z0 + (z1 - z0) * t;
    const dh = d / doors - 0.06;
    box(ctx, ctx.mats.woodDark, x - 0.29, 0.48, dz, 0.03, 0.62, Math.max(0.28, dh), { collide: false, cast: false });
    box(ctx, ctx.mats.brass, x - 0.31, 0.48, dz, 0.02, 0.08, 0.02, { collide: false, cast: false });
  }
  // Backsplash tile strip (short, not a floating white slab).
  box(ctx, ctx.mats.porcelain, x - 0.26, 1.18, z, 0.03, 0.42, d - 0.1, { collide: false, cast: false });
  box(ctx, ctx.mats.wood, x - 0.05, 1.78, z, 0.36, 0.62, d - 0.35, { collide: false });
  for (let i = 0; i < Math.max(2, doors - 1); i++) {
    const t = (i + 0.5) / Math.max(2, doors - 1);
    const dz = (z0 + 0.2) + ((z1 - z0) - 0.4) * t;
    box(ctx, ctx.mats.woodDark, x - 0.24, 1.78, dz, 0.03, 0.5, 0.42, { collide: false, cast: false });
  }
}

export function stove(ctx, x, y, z) {
  box(ctx, ctx.mats.iron, x, 0.46, z, 0.62, 0.92, 0.58, { collide: true });
  box(ctx, ctx.mats.iron, x - 0.28, 0.55, z, 0.04, 0.55, 0.42, { collide: false, cast: false });
  for (const [lx, lz] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) {
    cyl(ctx, ctx.mats.iron, x + lx, 0.94, z + lz, 0.09, 0.09, 0.03, { cast: false });
  }
  box(ctx, ctx.mats.iron, x, 1.15, z, 0.08, 0.45, 0.08, { collide: false });
  box(ctx, ctx.mats.brass, x - 0.2, 0.72, z + 0.2, 0.04, 0.04, 0.04, { collide: false, cast: false });
}

export function fridge(ctx, x, y, z) {
  box(ctx, ctx.mats.iron, x, 0.88, z, 0.62, 1.76, 0.58, { collide: true });
  box(ctx, ctx.mats.iron, x - 0.3, 1.15, z, 0.04, 1.1, 0.5, { collide: false, cast: false });
  box(ctx, ctx.mats.iron, x - 0.3, 0.42, z, 0.04, 0.55, 0.5, { collide: false, cast: false });
  box(ctx, ctx.mats.brass, x - 0.33, 1.15, z + 0.12, 0.03, 0.22, 0.03, { collide: false, cast: false });
  box(ctx, ctx.mats.brass, x - 0.33, 0.42, z + 0.12, 0.03, 0.14, 0.03, { collide: false, cast: false });
}

export function setDoorOpen(door, open) {
  door.want = open ? 1 : 0;
}

export function toggleLight(level, id) {
  const L = level.lights.find((l) => l.id === id);
  if (!L || !L.toggle) return false;
  L.on = !L.on;
  return L.on;
}
