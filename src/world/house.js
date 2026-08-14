import * as THREE from 'three';
import { damp } from '../core/util.js';

const T = 0.14; // wall thickness

function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(parent, mat, x, y, z, w, h, d) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  parent.add(m);
  return m;
}

export function buildHouse(scene, world, mats, quality) {
  const root = new THREE.Group();
  scene.add(root);
  const living = [];
  const interact = [];
  const lights = [];
  const patrol = [];

  const addCol = (x, y, z, w, h, d, opts = {}) => {
    world.addBox(x, y, z, w, h, d, { surface: opts.surface || 'wood', ...opts });
  };

  // ——— exterior ground ———
  const ground = mesh(new THREE.PlaneGeometry(80, 80), mats.brick, 0, -0.02, 2);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.castShadow = false;
  root.add(ground);
  addCol(0, -0.5, 12.4, 80, 1, 12, { surface: 'stone' });
  addCol(0, -0.5, -10.2, 80, 1, 12, { surface: 'stone' });
  addCol(-18.5, -0.5, 1.1, 20, 1, 22, { surface: 'stone' });
  addCol(18.5, -0.5, 1.1, 20, 1, 22, { surface: 'stone' });

  const path = mesh(new THREE.PlaneGeometry(2.4, 8), mats.brick, 0, 0.01, 9.2);
  path.rotation.x = -Math.PI / 2;
  path.receiveShadow = true;
  path.castShadow = false;
  root.add(path);

  // street lamp
  box(root, mats.iron, 3.6, 1.6, 12.4, 0.12, 3.2, 0.12);
  const lampHead = box(root, mats.lampShade, 3.6, 3.35, 12.4, 0.45, 0.22, 0.45);
  const street = new THREE.PointLight(0xffd9a8, 1.15, 16, 1.6);
  street.position.set(3.6, 3.2, 12.4);
  root.add(street);
  lights.push({ light: street, base: 1.15, flicker: 0.04 });

  // fence
  for (let i = -6; i <= 6; i++) {
    box(root, mats.iron, i * 1.15, 0.7, 13.2, 0.06, 1.4, 0.06);
  }
  box(root, mats.iron, 0, 1.35, 13.2, 14, 0.05, 0.05);

  // ——— house shell ———
  const W = 16.4, D = 10.4;
  const ox = 0, oz = 1.1; // house center
  const x0 = ox - W / 2, x1 = ox + W / 2;
  const z0 = oz - D / 2, z1 = oz + D / 2; // z0 north, z1 south (front)
  const H1 = 3.05; // ground ceiling
  const H2 = 6.15; // roof
  const cellarY = -3.05;

  buildFacade(root, mats, x0, x1, z0, z1, H2);

  // Roof
  const roof = mesh(new THREE.BoxGeometry(W + 0.8, 0.28, D + 0.8), mats.woodDark, ox, H2 + 0.05, oz);
  root.add(roof);
  const ridge = mesh(new THREE.BoxGeometry(W + 0.5, 0.9, 0.2), mats.woodDark, ox, H2 + 0.55, oz);
  ridge.rotation.x = 0.15;
  root.add(ridge);

  // Chimney
  box(root, mats.brick, x0 + 1.1, H2 + 1.1, z0 + 2.2, 0.7, 2.2, 0.7);
  box(root, mats.iron, x0 + 1.1, H2 + 2.25, z0 + 2.2, 0.78, 0.12, 0.78);

  // Floors
  // Ground floor with stair hole
  addFloor(root, world, mats, ox, 0, oz, W, D, [
    { x: 1.15, z: 2.6, w: 1.2, d: 3.7 },
    { x: 3.35, z: 2.1, w: 1.2, d: 3.6 },
  ]);
  addFloor(root, world, mats, ox, H1, oz, W, D, [
    { x: 1.15, z: 2.4, w: 1.25, d: 3.5 },
  ]);
  addFloor(root, world, mats, ox, H2, oz, W, D, []);
  addFloor(root, world, mats, 0, cellarY, 1.4, 10.2, 8.4, []);
  addCol(0, cellarY - 0.1, 1.4, 10.2, 0.2, 8.4);

  // Ceilings (underside plaster)
  box(root, mats.plaster, ox, H1 - 0.04, oz, W - 0.2, 0.08, D - 0.2);
  box(root, mats.plaster, ox, H2 - 0.04, oz, W - 0.2, 0.08, D - 0.2);

  // Outer interior walls
  wallX(root, world, mats.plaster, x0 + T / 2, 0, z0, z1, H1, { skip: [{ a: 1.85, b: 2.95 }] });
  wallX(root, world, mats.plaster, x1 - T / 2, 0, z0, z1, H1, { skip: [] });
  wallZ(root, world, mats.plaster, z0 + T / 2, 0, x0, x1, H1, { skip: [] });
  wallZ(root, world, mats.plaster, z1 - T / 2, 0, x0, x1, H1, {
    skip: [{ a: -0.52, b: 0.52 }, { a: -5.7, b: -4.5 }, { a: -3.9, b: -2.7 }, { a: 4.5, b: 5.7 }],
  });

  wallX(root, world, mats.wallpaper, x0 + T / 2, H1, z0, z1, H2 - H1, { skip: [{ a: 1.85, b: 2.95 }] });
  wallX(root, world, mats.wallpaperWarm, x1 - T / 2, H1, z0, z1, H2 - H1, {});
  wallZ(root, world, mats.wallpaper, z0 + T / 2, H1, x0, x1, H2 - H1, {});
  wallZ(root, world, mats.wallpaper, z1 - T / 2, H1, x0, x1, H2 - H1, {
    skip: [{ a: -5.7, b: -4.5 }, { a: 4.5, b: 5.7 }],
  });

  // Interior partitions ground
  // foyer | parlor  x = -2.05, door at z 2.4-3.7
  wallX(root, world, mats.wallpaper, -2.05, 0, -3.9, 6.2, H1, { skip: [{ a: 2.15, b: 3.55 }] });
  // foyer | kitchen x = 2.05
  wallX(root, world, mats.wallpaperWarm, 2.05, 0, -3.9, 6.2, H1, { skip: [{ a: 2.15, b: 3.55 }, { a: -1.1, b: 0.2 }] });
  // foyer | dining  z = 1.15, door center
  wallZ(root, world, mats.plaster, 1.15, 0, -2.05, 2.05, H1, { skip: [{ a: -0.7, b: 0.7 }] });

  // upstairs partitions
  wallX(root, world, mats.wallpaper, -2.05, H1, -3.9, 6.2, H2 - H1, { skip: [{ a: 1.8, b: 3.2 }] });
  wallX(root, world, mats.wallpaperWarm, 2.05, H1, -3.9, 6.2, H2 - H1, { skip: [{ a: 1.8, b: 3.2 }] });

  // cellar walls
  wallX(root, world, mats.brick, -5.1, cellarY, -2.6, 5.4, H1 - cellarY - 0.15, {});
  wallX(root, world, mats.brick, 5.1, cellarY, -2.6, 5.4, H1 - cellarY - 0.15, {});
  wallZ(root, world, mats.brick, -2.6, cellarY, -5.1, 5.1, H1 - cellarY - 0.15, {});
  wallZ(root, world, mats.brick, 5.4, cellarY, -5.1, 5.1, H1 - cellarY - 0.15, { skip: [{ a: 0.9, b: 2.0 }] });

  // Windows (openings already in facade; interior glass)
  const windows = [
    { x: -5.1, y: 1.45, z: z1 - 0.12, w: 1.15, h: 1.5, wall: 's' }, // parlor
    { x: -3.3, y: 1.45, z: z1 - 0.12, w: 1.15, h: 1.5, wall: 's' },
    { x: 5.1, y: 1.45, z: z1 - 0.12, w: 1.15, h: 1.5, wall: 's' }, // kitchen
    { x: -5.1, y: 4.45, z: z1 - 0.12, w: 1.15, h: 1.35, wall: 's' }, // master
    { x: 5.1, y: 4.45, z: z1 - 0.12, w: 1.15, h: 1.35, wall: 's' }, // child
    { x: x0 + 0.12, y: 1.45, z: 2.4, w: 1.1, h: 1.5, wall: 'w' },
    { x: x0 + 0.12, y: 4.45, z: 2.4, w: 1.1, h: 1.35, wall: 'w' },
  ];
  for (const w of windows) {
    const g = box(root, mats.glass, w.x, w.y, w.z,
      w.wall === 'w' ? 0.04 : w.w, w.h, w.wall === 'w' ? w.w : 0.04);
    g.castShadow = false;
    // frame
    box(root, mats.wood, w.x, w.y, w.z, w.wall === 'w' ? 0.08 : w.w + 0.1, w.h + 0.1, w.wall === 'w' ? w.w + 0.1 : 0.08);
    box(root, mats.wood, w.x, w.y, w.z, w.wall === 'w' ? 0.05 : 0.04, w.h, w.wall === 'w' ? w.w : 0.04);
  }

  // Moonlight through parlor windows
  const moon = new THREE.DirectionalLight(0x8aa4c8, 0.28);
  moon.position.set(-12, 14, 18);
  moon.target.position.set(-5, 1, 3);
  scene.add(moon);
  scene.add(moon.target);
  if (quality === 'high') {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 2;
    moon.shadow.camera.far = 40;
    moon.shadow.camera.left = moon.shadow.camera.bottom = -12;
    moon.shadow.camera.right = moon.shadow.camera.top = 12;
  }

  const hemi = new THREE.HemisphereLight(0x6a7a92, 0x1a100c, 0.22);
  scene.add(hemi);

  // Stairs
  const stairs = buildStairs(root, world, mats, 1.15, 0, 4.9, 14, 0.218, 0.26, -1);
  living.push(stairs);

  // Rail
  box(root, mats.wood, 0.52, H1 + 0.45, 2.6, 0.06, 0.9, 3.5);
  for (let i = 0; i < 8; i++) box(root, mats.wood, 0.52, H1 + 0.22, 1.1 + i * 0.42, 0.04, 0.44, 0.04);

  // Cellar stairs from kitchen
  buildStairs(root, world, mats, 3.35, cellarY, 0.4, 14, 0.218, 0.26, 1);

  // ——— rooms ———
  const foyer = dressFoyer(root, world, mats, living, interact, lights, quality);
  const parlor = dressParlor(root, world, mats, living, interact, lights, quality);
  const kitchen = dressKitchen(root, world, mats, living, interact, lights, quality);
  const dining = dressDining(root, world, mats, living, interact, lights, quality);
  const landing = dressLanding(root, world, mats, living, interact, lights, quality);
  const master = dressMaster(root, world, mats, living, interact, lights, quality);
  const child = dressChild(root, world, mats, living, interact, lights, quality);
  const cellar = dressCellar(root, world, mats, living, interact, lights, quality);

  // Doors
  const doors = [];
  doors.push(makeDoor(root, world, mats, living, interact, 0, 0, z1 - T, 0, 'front', 'Front door', true, 1));
  doors.push(makeDoor(root, world, mats, living, interact, -2.05, 0, 2.85, Math.PI / 2, 'parlor', 'Parlor door', false, -1));
  doors.push(makeDoor(root, world, mats, living, interact, 2.05, 0, 2.85, -Math.PI / 2, 'kitchen', 'Kitchen door', false, 1));
  doors.push(makeDoor(root, world, mats, living, interact, 1.45, cellarY, 5.4 - 0.02, 0, 'cellar', 'Cellar door', true, 1));
  doors.push(makeDoor(root, world, mats, living, interact, -2.05, H1, 2.5, Math.PI / 2, 'master', 'Bedroom door', true, -1));
  doors.push(makeDoor(root, world, mats, living, interact, 2.05, H1, 2.5, -Math.PI / 2, 'child', 'Nursery door', true, 1));

  patrol.push(
    new THREE.Vector3(-5.2, 0, 2.8),
    new THREE.Vector3(-0.2, 0, 3.4),
    new THREE.Vector3(5.0, 0, 3.2),
    new THREE.Vector3(0.0, 0, -1.6),
    new THREE.Vector3(1.2, H1, 2.4),
    new THREE.Vector3(-5.0, H1, 2.8),
    new THREE.Vector3(5.0, H1, 3.0),
    new THREE.Vector3(0.4, cellarY, 1.2),
  );

  const zones = {
    foyer: { minx: -2.0, maxx: 2.0, minz: 1.15, maxz: 6.2, y: 0 },
    parlor: { minx: -8.2, maxx: -2.05, minz: -3.9, maxz: 6.2, y: 0 },
    kitchen: { minx: 2.05, maxx: 8.2, minz: 1.0, maxz: 6.2, y: 0 },
    dining: { minx: -2.0, maxx: 2.0, minz: -4.0, maxz: 1.15, y: 0 },
    landing: { minx: -2.0, maxx: 2.0, minz: 0.4, maxz: 5.5, y: H1 },
    master: { minx: -8.2, maxx: -2.05, minz: -3.9, maxz: 6.2, y: H1 },
    child: { minx: 2.05, maxx: 8.2, minz: -3.9, maxz: 6.2, y: H1 },
    cellar: { minx: -5.2, maxx: 5.2, minz: -2.7, maxz: 5.5, y: cellarY },
    porch: { minx: -3, maxx: 3, minz: 6.2, maxz: 12, y: 0 },
  };

  return {
    root, spawn: new THREE.Vector3(0, 0.02, 4.55), spawnYaw: 0,
    interact, living, lights, patrol, zones, doors,
    grate: parlor.grate,
    houseLights: lights,
  };
}

function buildFacade(root, mats, x0, x1, z0, z1, H2) {
  // South facade split around door and windows
  const yMid = 3.05;
  // below windows
  box(root, mats.brick, 0, 0.55, z1 + 0.09, x1 - x0 + 0.4, 1.1, 0.2);
  // door sides
  box(root, mats.brick, -3.4, 2.2, z1 + 0.09, 6.4, 2.4, 0.2);
  box(root, mats.brick, 3.4, 2.2, z1 + 0.09, 6.4, 2.4, 0.2);
  box(root, mats.brick, 0, 2.85, z1 + 0.09, 1.3, 0.5, 0.2);
  // between windows upstairs
  box(root, mats.brick, 0, 4.7, z1 + 0.09, x1 - x0 + 0.4, 2.8, 0.2);
  // porch
  box(root, mats.wood, 0, 2.55, z1 + 1.35, 3.6, 0.12, 2.4);
  box(root, mats.wood, -1.7, 1.25, z1 + 2.4, 0.14, 2.5, 0.14);
  box(root, mats.wood, 1.7, 1.25, z1 + 2.4, 0.14, 2.5, 0.14);
  box(root, mats.wood, 0, 0.08, z1 + 1.4, 3.4, 0.12, 2.5);
  // house number
  const num = box(root, mats.brass, 0.95, 1.85, z1 + 0.2, 0.28, 0.22, 0.04);
  num.castShadow = false;
}

function addFloor(root, world, mats, cx, y, cz, w, d, holes = []) {
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
    if (zb - za < 0.08) continue;
    const zm = (za + zb) / 2;
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
      if (xb - xa < 0.08) continue;
      const xm = (xa + xb) / 2;
      let blocked = false;
      for (const h of holes) {
        if (Math.abs(xm - h.x) < h.w / 2 && Math.abs(zm - h.z) < h.d / 2) blocked = true;
      }
      if (blocked) continue;
      box(root, mats.floor, xm, y + 0.04, zm, xb - xa, 0.1, zb - za);
      world.addBox(xm, y - 0.05, zm, xb - xa, 0.12, zb - za, { surface: 'wood' });
    }
  }
}

function wallX(root, world, mat, x, y0, zA, zB, h, { skip = [] }) {
  const segs = segments(zA, zB, skip);
  for (const [a, b] of segs) {
    const z = (a + b) / 2, d = b - a;
    if (d < 0.08) continue;
    box(root, mat, x, y0 + h / 2, z, T, h, d);
    world.addBox(x, y0 + h / 2, z, T, h, d);
  }
  // lintels over skips
  for (const s of skip) {
    const z = (s.a + s.b) / 2, d = s.b - s.a;
    box(root, mat, x, y0 + h - 0.18, z, T, 0.36, d);
    world.addBox(x, y0 + h - 0.18, z, T, 0.36, d);
  }
}

function wallZ(root, world, mat, z, y0, xA, xB, h, { skip = [] }) {
  const segs = segments(xA, xB, skip);
  for (const [a, b] of segs) {
    const x = (a + b) / 2, w = b - a;
    if (w < 0.08) continue;
    box(root, mat, x, y0 + h / 2, z, w, h, T);
    world.addBox(x, y0 + h / 2, z, w, h, T);
  }
  for (const s of skip) {
    const x = (s.a + s.b) / 2, w = s.b - s.a;
    box(root, mat, x, y0 + h - 0.18, z, w, 0.36, T);
    world.addBox(x, y0 + h - 0.18, z, w, 0.36, T);
  }
}

function segments(a, b, skip) {
  const cuts = skip.map((s) => [Math.min(s.a, s.b), Math.max(s.a, s.b)]).sort((u, v) => u[0] - v[0]);
  const out = [];
  let cur = a;
  for (const [s, e] of cuts) {
    if (s > cur) out.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (cur < b) out.push([cur, b]);
  return out;
}

function buildStairs(root, world, mats, x, y0, zStart, n, rise, run, dirZ) {
  const group = new THREE.Group();
  root.add(group);
  for (let i = 0; i < n; i++) {
    const y = y0 + rise * (i + 0.5);
    const z = zStart + dirZ * run * i;
    box(group, mats.wood, x, y, z, 1.05, rise, run + 0.02);
    world.addBox(x, y, z, 1.05, rise, run + 0.02, { surface: 'wood' });
  }
  return { update() {} };
}

function makeDoor(root, world, mats, living, interact, x, y, z, rotY, id, title, startClosed, openSign) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  root.add(group);
  const leaf = new THREE.Group();
  leaf.position.set(-0.48, 0, 0);
  group.add(leaf);
  const panel = box(leaf, mats.woodDark, 0.48, 1.1, 0, 0.96, 2.2, 0.06);
  box(leaf, mats.brass, 0.88, 1.05, 0.04, 0.06, 0.08, 0.04);
  const col = world.addBox(x, y + 1.1, z, 1.02, 2.2, 0.18, { door: id, surface: 'wood' });
  const door = {
    id, group: leaf, baseRot: 0, open: 0, want: startClosed ? 0 : 1, col, rotY,
    openAngle: (openSign || 1) * 1.35,
  };
  living.push({
    update(dt) {
      door.want = door.want;
      door.open = damp(door.open, door.want, 3.2, dt);
      leaf.rotation.y = door.open * door.openAngle;
      col.alive = door.open < 0.55;
      col.solid = door.open < 0.55;
    },
  });
  interact.push({
    kind: 'door', id, title, pos: new THREE.Vector3(x, y + 1.1, z), reach: 1.7,
    door,
    use(story, audio) {
      door.want = door.want > 0.5 ? 0 : 1;
      audio?.door?.(x, y, z);
      return { hint: door.want ? 'The door takes its weight.' : 'It settles shut.' };
    },
  });
  return door;
}

function dressFoyer(root, world, mats, living, interact, lights) {
  box(root, mats.carpet, 0, 0.06, 3.6, 2.4, 0.04, 3.2);
  // clock
  const clock = new THREE.Group();
  clock.position.set(-1.55, 0, 4.6);
  root.add(clock);
  box(clock, mats.woodDark, 0, 1.15, 0, 0.42, 2.3, 0.28);
  const face = box(clock, mats.linen, 0, 1.85, 0.15, 0.28, 0.28, 0.02);
  const pendulum = new THREE.Group();
  pendulum.position.set(0, 1.35, 0.12);
  clock.add(pendulum);
  box(pendulum, mats.brass, 0, -0.45, 0, 0.04, 0.9, 0.04);
  box(pendulum, mats.brass, 0, -0.92, 0, 0.12, 0.12, 0.05);
  living.push({
    update(dt, t) {
      pendulum.rotation.z = Math.sin(t * 2.05) * 0.18;
    },
  });
  interact.push({
    kind: 'note', id: 'clock', title: 'Grandfather clock',
    pos: new THREE.Vector3(-1.55, 1.4, 4.6), reach: 1.6,
    body: 'It still keeps her time. The pendulum never learned to hurry. A paper wedge in the case says: hush when the house is listening.',
  });

  // coat rack
  box(root, mats.wood, 1.55, 1.05, 5.35, 0.08, 2.1, 0.08);
  box(root, mats.coat, 1.55, 1.35, 5.2, 0.35, 1.1, 0.12);
  interact.push({
    kind: 'note', id: 'coat', title: 'Her coat',
    pos: new THREE.Vector3(1.55, 1.3, 5.3), reach: 1.5,
    body: 'Wool still holding rain from a night she never came back from the parlor. The pocket has a house key and a burnt match.',
  });

  const foyerLamp = new THREE.PointLight(0xffc07a, 0.85, 8, 1.7);
  foyerLamp.position.set(0, 2.55, 3.6);
  root.add(foyerLamp);
  lights.push({ light: foyerLamp, base: 0.85, flicker: 0.06, id: 'foyer' });
  box(root, mats.brass, 0, 2.72, 3.6, 0.25, 0.08, 0.25);
  box(root, mats.lampShade, 0, 2.48, 3.6, 0.5, 0.28, 0.5);

  return {};
}

function dressParlor(root, world, mats, living, interact, lights, quality) {
  box(root, mats.carpet, -5.0, 0.055, 2.8, 5.2, 0.04, 4.8);
  // fireplace west wall
  box(root, mats.brick, -7.85, 1.1, 2.6, 0.55, 2.2, 1.8);
  box(root, mats.soot, -7.62, 0.55, 2.6, 0.22, 0.9, 1.15);
  const grate = new THREE.Group();
  grate.position.set(-7.55, 0.62, 2.6);
  root.add(grate);
  for (let i = 0; i < 6; i++) {
    box(grate, mats.iron, 0.02, 0, -0.45 + i * 0.18, 0.04, 0.7, 0.04);
  }
  const glow = box(grate, mats.ember, -0.08, -0.05, 0, 0.12, 0.28, 0.7);
  const fireLight = new THREE.PointLight(0xff6a28, 1.35, 7.5, 1.8);
  fireLight.position.set(-7.2, 0.7, 2.6);
  root.add(fireLight);
  lights.push({ light: fireLight, base: 1.35, flicker: 0.22, id: 'fire' });
  living.push({
    update(dt, t) {
      glow.scale.y = 0.85 + Math.sin(t * 7.2) * 0.12 + Math.sin(t * 13) * 0.06;
      mats.ember.emissiveIntensity = 2.1 + Math.sin(t * 6.5) * 0.5;
    },
  });
  // mantel
  box(root, mats.wood, -7.55, 1.55, 2.6, 0.35, 0.1, 1.9);
  const photo = box(root, mats.woodDark, -7.42, 1.78, 2.35, 0.04, 0.28, 0.22);
  box(photo, mats.linen, 0.03, 0, 0, 0.01, 0.22, 0.16);

  interact.push({
    kind: 'note', id: 'photo', title: 'Photograph, reversed',
    pos: new THREE.Vector3(-7.2, 1.7, 2.4), reach: 1.7, frag: 'maren',
    body: 'Father at the piano. On the back, in her hand: MAREN — say it small, at the mouth, and the house will close.',
  });
  interact.push({
    kind: 'grate', id: 'grate', title: 'The grate',
    pos: new THREE.Vector3(-7.1, 0.7, 2.6), reach: 1.8,
    body: 'Ash in the shape of tape. The iron is warm. This is the mouth.',
  });

  // sofa
  box(root, mats.fabric, -4.2, 0.42, 1.1, 2.2, 0.42, 0.85);
  box(root, mats.fabric, -4.2, 0.72, 0.78, 2.2, 0.5, 0.18);
  box(root, mats.fabric, -5.2, 0.62, 1.1, 0.18, 0.55, 0.85);
  box(root, mats.fabric, -3.2, 0.62, 1.1, 0.18, 0.55, 0.85);
  addColFurniture(world, -4.2, 0.4, 1.1, 2.2, 0.8, 0.9);

  box(root, mats.wood, -4.2, 0.28, 2.4, 0.9, 0.42, 0.55);
  // lamp + moths
  box(root, mats.wood, -3.15, 0.55, 4.6, 0.12, 1.1, 0.12);
  box(root, mats.lampShade, -3.15, 1.2, 4.6, 0.42, 0.28, 0.42);
  const parlorLamp = new THREE.PointLight(0xffd19a, 1.05, 6.5, 1.7);
  parlorLamp.position.set(-3.15, 1.15, 4.6);
  root.add(parlorLamp);
  lights.push({ light: parlorLamp, base: 1.05, flicker: 0.05, id: 'parlor', toggle: true, on: true });
  interact.push({
    kind: 'light', id: 'parlor-lamp', title: 'Parlor lamp',
    pos: new THREE.Vector3(-3.15, 1.1, 4.6), reach: 1.6, lightId: 'parlor',
  });

  // curtains parlor south
  addCurtains(root, mats, living, -5.1, 1.45, 6.05, 1.2, 2.0);
  addCurtains(root, mats, living, -3.3, 1.45, 6.05, 1.2, 2.0);

  // dust shaft
  if (quality !== 'low') {
    const shaft = mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshBasicMaterial({
      color: 0xffe6c0, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide,
    }), -5.1, 1.4, 5.4);
    shaft.rotation.x = 0.15;
    shaft.castShadow = shaft.receiveShadow = false;
    root.add(shaft);
    living.push({
      update(dt, t) { shaft.material.opacity = 0.035 + Math.sin(t * 0.6) * 0.012; },
    });
  }

  return { grate };
}

function dressKitchen(root, world, mats, living, interact, lights) {
  // counters along east
  box(root, mats.wood, 7.35, 0.48, 3.4, 0.7, 0.92, 4.2);
  addColFurniture(world, 7.35, 0.48, 3.4, 0.7, 0.92, 4.2);
  box(root, mats.porcelain, 7.35, 0.96, 4.4, 0.55, 0.08, 0.7);
  // tap
  box(root, mats.iron, 7.2, 1.15, 4.4, 0.04, 0.28, 0.04);
  const spout = box(root, mats.iron, 7.05, 1.22, 4.4, 0.22, 0.04, 0.04);
  const drop = mesh(new THREE.SphereGeometry(0.018, 8, 8), mats.glass, 6.95, 1.15, 4.4);
  drop.castShadow = false;
  root.add(drop);
  living.push({
    update(dt, t) {
      const u = (t * 0.55) % 1;
      drop.position.y = 1.12 - u * 0.95;
      drop.position.x = 6.95;
      drop.visible = u < 0.85;
      drop.scale.setScalar(0.7 + u * 0.5);
    },
  });
  interact.push({
    kind: 'note', id: 'tap', title: 'Kitchen tap',
    pos: new THREE.Vector3(7.0, 1.1, 4.4), reach: 1.5,
    body: 'It has dripped since the funeral. She said a house should not be silent. She was wrong about why.',
  });

  // drawers
  const drawer = box(root, mats.woodDark, 7.32, 0.55, 3.1, 0.62, 0.22, 0.5);
  interact.push({
    kind: 'drawer', id: 'drawer', title: 'Kitchen drawer',
    pos: new THREE.Vector3(7.0, 0.7, 3.1), reach: 1.6, frag: 'ma',
    body: 'Twine, a burnt matchbox, and a list: milk, tape, hush-word. The first syllable is written twice. MA.',
    mesh: drawer,
  });

  box(root, mats.wood, 5.1, 0.4, 2.2, 1.35, 0.08, 0.8);
  box(root, mats.wood, 5.1, 0.22, 1.9, 0.08, 0.4, 0.08);
  box(root, mats.wood, 4.5, 0.22, 2.5, 0.08, 0.4, 0.08);
  box(root, mats.wood, 5.7, 0.22, 2.5, 0.08, 0.4, 0.08);
  addColFurniture(world, 5.1, 0.35, 2.2, 1.4, 0.7, 0.85);

  const letter = box(root, mats.linen, 5.15, 0.46, 2.15, 0.22, 0.01, 0.16);
  interact.push({
    kind: 'note', id: 'letter', title: 'Unsent letter',
    pos: new THREE.Vector3(5.15, 0.6, 2.15), reach: 1.5, frag: 'ma',
    body: 'To the buyer: the flue sticks. Do not shout in the parlor. If it leans in, say the first of her name, small. MA.',
  });

  const pend = new THREE.PointLight(0xffc070, 0.9, 7, 1.7);
  pend.position.set(5.2, 2.55, 3.4);
  root.add(pend);
  lights.push({ light: pend, base: 0.9, flicker: 0.07, id: 'kitchen', toggle: true, on: true });
  box(root, mats.lampShade, 5.2, 2.55, 3.4, 0.4, 0.22, 0.4);
  interact.push({
    kind: 'light', id: 'kitchen-light', title: 'Kitchen light',
    pos: new THREE.Vector3(5.2, 1.5, 3.4), reach: 1.8, lightId: 'kitchen',
  });

  // stove
  box(root, mats.iron, 7.3, 0.55, 1.6, 0.7, 1.0, 0.7);
  return {};
}

function dressDining(root, world, mats, living, interact, lights) {
  box(root, mats.wood, 0, 0.42, -1.5, 1.7, 0.08, 0.95);
  for (const [x, z] of [[-0.55, -1.05], [0.55, -1.05], [-0.55, -1.95], [0.55, -1.95]]) {
    box(root, mats.wood, x, 0.28, z, 0.32, 0.55, 0.32);
  }
  addColFurniture(world, 0, 0.4, -1.5, 1.8, 0.8, 1.1);
  const din = new THREE.PointLight(0xffd0a0, 0.55, 6, 1.8);
  din.position.set(0, 2.4, -1.4);
  root.add(din);
  lights.push({ light: din, base: 0.55, flicker: 0.04, id: 'dining' });
  interact.push({
    kind: 'note', id: 'table', title: 'Dining table',
    pos: new THREE.Vector3(0, 0.7, -1.5), reach: 1.5,
    body: 'Four chairs. Three places set. Dust on the fourth. She ate facing the parlor door.',
  });
  return {};
}

function dressLanding(root, world, mats, living, interact, lights) {
  const y = 3.05;
  box(root, mats.carpet, 0, y + 0.06, 2.6, 1.6, 0.04, 3.2);
  const sconce = new THREE.PointLight(0xffc888, 0.7, 5.5, 1.8);
  sconce.position.set(-1.6, y + 1.6, 2.5);
  root.add(sconce);
  lights.push({ light: sconce, base: 0.7, flicker: 0.08, id: 'landing' });
  box(root, mats.brass, -1.72, y + 1.55, 2.5, 0.08, 0.16, 0.08);
  box(root, mats.lampShade, -1.55, y + 1.5, 2.5, 0.18, 0.14, 0.18);
  interact.push({
    kind: 'note', id: 'landing', title: 'Landing',
    pos: new THREE.Vector3(0, y + 1.2, 2.5), reach: 1.4,
    body: 'From here the parlor chimney sounds like breathing. She used to wait on this step until you were quiet.',
  });
  return {};
}

function dressMaster(root, world, mats, living, interact, lights) {
  const y = 3.05;
  box(root, mats.carpet, -5.0, y + 0.055, 2.6, 5.0, 0.04, 4.4);
  box(root, mats.wood, -5.4, y + 0.28, 1.2, 2.0, 0.28, 1.5);
  box(root, mats.linen, -5.4, y + 0.48, 1.2, 1.85, 0.16, 1.35);
  addColFurniture(world, -5.4, y + 0.4, 1.2, 2.0, 0.7, 1.5);
  box(root, mats.woodDark, -7.3, y + 1.1, 4.6, 0.4, 2.1, 1.4);
  addColFurniture(world, -7.3, y + 1.1, 4.6, 0.4, 2.1, 1.4);
  addCurtains(root, mats, living, -5.1, y + 1.4, 6.05, 1.2, 1.9);
  const bedLamp = new THREE.PointLight(0xffc090, 0.45, 4.5, 1.9);
  bedLamp.position.set(-4.2, y + 0.95, 2.2);
  root.add(bedLamp);
  lights.push({ light: bedLamp, base: 0.45, flicker: 0.05, id: 'master', toggle: true, on: true });
  box(root, mats.wood, -4.2, y + 0.45, 2.2, 0.35, 0.55, 0.35);
  box(root, mats.lampShade, -4.2, y + 0.85, 2.2, 0.22, 0.16, 0.22);
  interact.push({
    kind: 'light', id: 'master-lamp', title: 'Bedside lamp',
    pos: new THREE.Vector3(-4.2, y + 0.8, 2.2), reach: 1.5, lightId: 'master',
  });
  interact.push({
    kind: 'note', id: 'wardrobe', title: 'Wardrobe',
    pos: new THREE.Vector3(-7.1, y + 1.2, 4.6), reach: 1.6,
    body: 'Dresses facing inward. A note pinned to a sleeve: if you must speak, do it like a child who is already sorry.',
  });
  // breath cold? master is warmer
  return {};
}

function dressChild(root, world, mats, living, interact, lights) {
  const y = 3.05;
  box(root, mats.carpet, 5.0, y + 0.055, 3.2, 4.6, 0.04, 3.8);
  box(root, mats.wood, 5.6, y + 0.22, 2.2, 1.4, 0.22, 0.85);
  box(root, mats.linen, 5.6, y + 0.38, 2.2, 1.25, 0.12, 0.7);
  addColFurniture(world, 5.6, y + 0.3, 2.2, 1.4, 0.5, 0.85);
  box(root, mats.wood, 6.9, y + 0.55, 4.6, 0.7, 0.7, 0.45);
  const drawing = box(root, mats.linen, 2.2, y + 1.45, 3.4, 0.02, 0.32, 0.4);
  interact.push({
    kind: 'note', id: 'drawing', title: 'A drawing',
    pos: new THREE.Vector3(2.4, y + 1.4, 3.4), reach: 1.6, frag: 'ren',
    body: 'A house with a red mouth. Under it, in crayon: REN. The last of her name. You wrote it when you still thought the grate was a face.',
  });
  const cLamp = new THREE.PointLight(0xffd4a8, 0.5, 5, 1.8);
  cLamp.position.set(4.4, y + 1.7, 3.2);
  root.add(cLamp);
  lights.push({ light: cLamp, base: 0.5, flicker: 0.06, id: 'child', toggle: true, on: true });
  addCurtains(root, mats, living, 5.1, y + 1.4, 6.05, 1.2, 1.9);
  interact.push({
    kind: 'light', id: 'child-light', title: 'Nursery lamp',
    pos: new THREE.Vector3(4.4, y + 1.4, 3.2), reach: 1.6, lightId: 'child',
  });
  return {};
}

function dressCellar(root, world, mats, living, interact, lights) {
  const y = -3.05;
  box(root, mats.brick, 0, y + 0.02, 1.2, 9.6, 0.08, 7.6);
  box(root, mats.iron, -2.2, y + 0.9, 0.2, 1.1, 1.6, 1.1);
  const flue = box(root, mats.iron, -2.2, y + 1.85, 0.2, 0.35, 0.12, 0.35);
  living.push({
    update(dt, t) {
      flue.rotation.y = Math.sin(t * 0.4) * 0.05;
    },
  });
  const cold = new THREE.PointLight(0x88a0b8, 0.35, 7, 1.6);
  cold.position.set(0.4, y + 1.8, 1.4);
  root.add(cold);
  lights.push({ light: cold, base: 0.35, flicker: 0.03, id: 'cellar' });
  const furnace = new THREE.PointLight(0xff5010, 0.55, 4.5, 2);
  furnace.position.set(-2.2, y + 0.7, 0.2);
  root.add(furnace);
  lights.push({ light: furnace, base: 0.55, flicker: 0.18, id: 'furnace' });

  interact.push({
    kind: 'key', id: 'damper', title: 'Damper wheel',
    pos: new THREE.Vector3(-2.2, y + 1.5, 0.2), reach: 1.7,
    body: 'The flue control. Cold iron. Take it upstairs. The mouth will not close without a hand on this and her name in the grate.',
  });
  interact.push({
    kind: 'note', id: 'coal', title: 'Coal scuttle',
    pos: new THREE.Vector3(-1.1, y + 0.5, 0.4), reach: 1.5,
    body: 'Tape spools, blackened. He recorded every dinner. She fed them to the house one reel at a time.',
  });
  box(root, mats.wood, 3.6, y + 0.9, -1.2, 0.4, 1.8, 1.6);
  return {};
}

function addCurtains(root, mats, living, x, y, z, w, h) {
  const geo = new THREE.PlaneGeometry(w * 0.48, h, 8, 12);
  const left = new THREE.Mesh(geo, mats.curtainMat);
  const right = new THREE.Mesh(geo.clone(), mats.curtainMat);
  left.position.set(x - w * 0.22, y, z);
  right.position.set(x + w * 0.22, y, z);
  left.castShadow = right.castShadow = false;
  root.add(left, right);
}

function addColFurniture(world, x, y, z, w, h, d) {
  world.addBox(x, y, z, w, h, d, { surface: 'wood' });
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
