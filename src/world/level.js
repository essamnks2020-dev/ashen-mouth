import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3(1, 1, 1);
const tmpP = new THREE.Vector3();

export function buildLevel(scene, world, mats, quality) {
  const buckets = new Map();
  const interact = [];
  const listenables = [];
  const candles = [];
  const flags = [];
  const bells = [];
  const doors = [];
  const patrol = [];
  const zones = {};

  const put = (mat, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    let list = buckets.get(mat);
    if (!list) { list = []; buckets.set(mat, list); }
    list.push({ geo, x, y, z, rx, ry, rz, sx, sy, sz });
  };

  const solid = (x, y, z, w, h, d, opts) => world.addBox(x, y, z, w, h, d, opts);
  const box = (mat, x, y, z, w, h, d, opts = {}) => {
    put(mat, boxG(w, h, d), x, y, z);
    if (opts.col !== false) solid(x, y, z, w, h, d, opts);
  };
  const cyl = (mat, x, y, z, r, h, seg = 8, opts = {}) => {
    put(mat, cylG(r, h, seg), x, y, z);
    if (opts.col !== false) solid(x, y, z, r * 1.6, h, r * 1.6, opts);
  };

  // ─── DOCK ───────────────────────────────────────────────────────────────
  box(mats.woodPale, 0, 0.18, 36, 16, 0.36, 18, { surface: 'wood' });
  // pilings
  for (const x of [-7, -3.5, 0, 3.5, 7]) {
    for (const z of [29, 34, 39, 43.5]) {
      cyl(mats.wood, x, -0.7, z, 0.22, 2.2, 6, { col: false });
    }
  }
  // edge beams
  box(mats.wood, 0, 0.42, 44.8, 16.4, 0.22, 0.35, { surface: 'wood' });
  box(mats.wood, -7.9, 0.5, 36, 0.3, 0.4, 18, { surface: 'wood' });
  box(mats.wood, 7.9, 0.5, 36, 0.3, 0.4, 18, { surface: 'wood' });

  // crates / barrels
  const crate = (x, z, s = 0.7) => box(mats.wood, x, 0.4 + s / 2, z, s, s, s, { surface: 'wood' });
  crate(5.4, 40.2, 0.8); crate(6.1, 39.4, 0.55); crate(-5.8, 38.5, 0.7);
  crate(-6.2, 31.2, 0.9); crate(6.4, 31.8, 0.6);
  cyl(mats.wood, 4.8, 0.85, 32.4, 0.38, 0.9, 8, { surface: 'wood' });
  cyl(mats.wood, 5.5, 0.7, 32.9, 0.32, 0.6, 8, { surface: 'wood' });

  // rope coils
  for (let i = 0; i < 3; i++) {
    put(mats.rope, torusG(0.35, 0.08), -4.5 + i * 0.15, 0.48, 41.2, Math.PI / 2, 0, 0);
  }

  // boat
  put(mats.wood, boatG(), 0.4, 0.15, 46.2, 0, 0.15, 0.08);
  solid(0.4, 0.4, 46.2, 2.4, 0.8, 5.5, { surface: 'wood' });
  put(mats.clothFade, new THREE.PlaneGeometry(1.1, 1.6), 0.2, 1.7, 45.4, 0.1, 0.2, 0.15);
  flags.push({ x: 0.2, y: 1.7, z: 45.4 });

  // radio hut + mast
  box(mats.wood, 6.4, 1.35, 33.2, 2.6, 1.9, 2.4, { surface: 'wood' });
  box(mats.woodPale, 6.4, 2.4, 33.2, 2.9, 0.12, 2.7, { surface: 'wood' });
  cyl(mats.brass, 7.4, 4.4, 33.6, 0.06, 4.2, 5, { col: false });
  put(mats.brassBright, torusG(0.45, 0.03), 7.4, 6.4, 33.6, Math.PI / 2, 0, 0);
  put(mats.black, boxG(0.5, 0.28, 0.4), 5.55, 1.35, 32.15);
  interact.push({
    id: 'radio', kind: 'inspect', pos: new THREE.Vector3(5.6, 1.2, 32.3), r: 1.6,
    title: 'RELIEF SET',
    body: 'The last operator left the key down. Salt has grown in the coils. On the strip, in a child’s hand: your name, written until the pencil tore.',
    word: null, fragment: null, sound: 'radio',
  });

  // dock lantern posts
  for (const [x, z] of [[-6.6, 30.2], [6.6, 30.2], [-6.6, 42.5], [6.6, 42.5]]) {
    cyl(mats.wood, x, 1.3, z, 0.07, 1.8, 5, { col: false });
    put(mats.glass, cylG(0.12, 0.28, 6), x, 2.25, z);
    candles.push({ x, y: 2.25, z, flicker: Math.random() });
  }

  zones.dock = { minx: -8, maxx: 8, minz: 28, maxz: 48, y: 0.4 };

  // ─── STAIRS into the stack (small rises so the capsule can climb) ───────
  const steps = [];
  for (let i = 0; i < 16; i++) {
    const z = 27.8 - i * 0.38;
    const y = 0.22 + i * 0.24;
    steps.push([0, y, z, 5.0 - i * 0.04, 0.28, 0.5]);
  }
  for (const [x, y, z, w, h, d] of steps) box(mats.basalt, x, y, z, w, h, d);
  // stair walls
  box(mats.basaltDark, -2.7, 2.4, 25.4, 0.45, 4.6, 6.5);
  box(mats.basaltDark, 2.7, 2.4, 25.4, 0.45, 4.6, 6.5);

  // South cliff face around the chapel door (shells only — never fill rooms)
  box(mats.basalt, -7.2, 7, 22.6, 8.4, 14, 2.2);
  box(mats.basalt, 7.2, 7, 22.6, 8.4, 14, 2.2);
  box(mats.basalt, 0, 12.4, 22.6, 6.2, 4.2, 2.2);

  // ─── CHAPEL ─────────────────────────────────────────────────────────────
  const fy = 4.0;
  box(mats.basalt, 0, fy - 0.2, 13, 20.4, 0.4, 18.4);
  // ceiling
  box(mats.basaltDark, 0, 11.3, 13, 20.4, 0.5, 18.4);
  // walls with door gaps — split
  // south wall (door 2.6 wide at x=0)
  box(mats.basalt, -6.3, 7.5, 22.0, 7.8, 7.0, 0.7);
  box(mats.basalt, 6.3, 7.5, 22.0, 7.8, 7.0, 0.7);
  box(mats.basalt, 0, 10.4, 22.0, 5.0, 1.4, 0.7);
  // north wall (altar)
  box(mats.basalt, 0, 7.5, 4.0, 20.4, 7.0, 0.8);
  // west wall (archive door at z=12.2 — leave a 3.2m gap)
  box(mats.basalt, -10.15, 7.5, 7.4, 0.7, 7.0, 6.4);
  box(mats.basalt, -10.15, 7.5, 16.8, 0.7, 7.0, 5.0);
  box(mats.basalt, -10.15, 10.5, 12.2, 0.7, 1.2, 3.2);
  // east wall (walk door at z=9.2)
  box(mats.basalt, 10.15, 7.5, 16.4, 0.7, 7.0, 11.0);
  box(mats.basalt, 10.15, 7.5, 5.6, 0.7, 7.0, 3.4);
  box(mats.basalt, 10.15, 10.5, 9.2, 0.7, 1.2, 3.0);

  // hex columns
  for (const x of [-5.4, 5.4]) {
    for (const z of [8.2, 13.4, 18.2]) {
      cyl(mats.basalt, x, 7.5, z, 0.42, 6.6, 6);
      put(mats.brass, cylG(0.48, 0.12, 6), x, 4.25, z);
      put(mats.brass, cylG(0.48, 0.12, 6), x, 10.6, z);
    }
  }

  // pews
  for (let i = 0; i < 4; i++) {
    const z = 18.6 - i * 2.15;
    for (const x of [-3.2, 3.2]) {
      box(mats.wood, x, fy + 0.42, z, 3.4, 0.16, 0.85, { surface: 'wood' });
      box(mats.wood, x, fy + 0.7, z + 0.32, 3.4, 0.7, 0.14, { surface: 'wood' });
    }
  }

  // altar
  box(mats.basalt, 0, fy + 0.45, 6.3, 3.6, 0.9, 1.4);
  put(mats.brass, boxG(2.2, 0.08, 0.8), 0, fy + 0.96, 6.3);
  cyl(mats.brassBright, 0, fy + 1.45, 6.3, 0.08, 0.9, 8, { col: false });
  put(mats.brass, torusG(0.35, 0.04), 0, fy + 1.95, 6.3, Math.PI / 2, 0, 0);

  // mural (north wall, inspect)
  put(mats.mural, boxG(6.4, 3.6, 0.12), 0, 7.4, 4.46);
  put(mats.brass, boxG(6.6, 0.08, 0.14), 0, 5.55, 4.5);
  put(mats.brass, boxG(6.6, 0.08, 0.14), 0, 9.25, 4.5);
  // saint painted as three stacked mouths
  for (let i = 0; i < 3; i++) {
    put(mats.saintMouth, torusG(0.42 - i * 0.06, 0.07), 0, 8.3 - i * 0.7, 4.55, 0, 0, 0);
  }
  interact.push({
    id: 'mural', kind: 'inspect', pos: new THREE.Vector3(0, 6.2, 5.2), r: 2.2,
    title: 'THE BINDING WALL',
    body: 'Pigment the colour of old brass. Three mouths, stacked, each ringed with a word the spray has half-eaten. The top mouth still holds: ORTH.',
    word: 'ORTH', fragment: 'orth',
  });

  // hanging bells
  for (const x of [-2.2, 2.2]) {
    put(mats.rope, cylG(0.02, 1.4, 4), x, 10.2, 10.4);
    put(mats.brass, bellG(), x, 9.35, 10.4);
    bells.push({ x, y: 9.35, z: 10.4, mesh: null });
    interact.push({
      id: 'bell-' + x, kind: 'bell', pos: new THREE.Vector3(x, 8.5, 10.4), r: 1.3,
      title: 'VOTIVE BELL',
      body: 'Cast to carry a name out to the boats. It will carry yours into the rock.',
      sound: 'bell', loud: true,
    });
  }

  // chapel candles
  for (const [x, z] of [[-7.6, 6.8], [7.6, 6.8], [-7.6, 19.4], [7.6, 19.4], [-1.3, 6.4], [1.3, 6.4]]) {
    put(mats.wood, cylG(0.08, 0.7, 5), x, fy + 0.55, z);
    put(mats.candle, cylG(0.04, 0.14, 5), x, fy + 0.98, z);
    candles.push({ x, y: fy + 1.05, z, flicker: Math.random() });
  }

  // high windows (emissive aurora leak)
  for (const x of [-6, 0, 6]) {
    put(mats.glass, boxG(1.6, 1.8, 0.08), x, 9.6, 4.42);
  }

  // cloth banners — still, almost
  for (const x of [-8.4, 8.4]) {
    put(mats.cloth, new THREE.PlaneGeometry(0.9, 2.4), x, 8.4, 14.5, 0, x > 0 ? -0.4 : 0.4, 0.05);
    flags.push({ x, y: 8.4, z: 14.5 });
  }

  zones.chapel = { minx: -10, maxx: 10, minz: 4, maxz: 22, y: fy };

  // chapel doors (visual + toggle)
  const chapelSouthDoor = makeDoor(mats, 0, fy + 1.6, 21.95, 2.5, 3.2, 0.12, 0);
  doors.push(chapelSouthDoor);
  interact.push({
    id: 'door-chapel', kind: 'door', pos: new THREE.Vector3(0, fy + 1.4, 22), r: 1.8,
    title: 'NAVE DOOR', body: 'The wood is swollen with salt. It wants to stay shut.',
    door: chapelSouthDoor, startOpen: true,
  });

  const archDoor = makeDoor(mats, -10.12, fy + 1.55, 12.2, 0.14, 3.1, 2.4, Math.PI / 2);
  doors.push(archDoor);
  interact.push({
    id: 'door-archive', kind: 'door', pos: new THREE.Vector3(-10, fy + 1.4, 12.2), r: 1.7,
    title: 'LEDGER ROOM', body: 'A brass plate, pitted: VOW OF THE STILL CLOUD.',
    door: archDoor, startOpen: false,
  });

  const walkDoor = makeDoor(mats, 10.12, fy + 1.55, 9.2, 0.14, 3.1, 2.4, Math.PI / 2);
  doors.push(walkDoor);
  interact.push({
    id: 'door-walk', kind: 'door', pos: new THREE.Vector3(10, fy + 1.4, 9.2), r: 1.7,
    title: 'LANTERN WALK', body: 'Wind ought to come through. It does not.',
    door: walkDoor, startOpen: false,
  });

  // ─── ARCHIVE ────────────────────────────────────────────────────────────
  box(mats.basalt, -14.6, fy - 0.2, 12, 9.2, 0.4, 11.2);
  box(mats.basaltDark, -14.6, 10.4, 12, 9.2, 0.4, 11.2);
  box(mats.basalt, -19.1, 7.1, 12, 0.6, 6.2, 11.2);
  box(mats.basalt, -14.6, 7.1, 6.5, 9.2, 6.2, 0.6);
  box(mats.basalt, -14.6, 7.1, 17.5, 9.2, 6.2, 0.6);

  // shelves
  for (let i = 0; i < 3; i++) {
    const z = 8.2 + i * 3.0;
    box(mats.wood, -17.7, fy + 1.5, z, 0.4, 3.0, 2.4, { surface: 'wood' });
    for (let s = 0; s < 4; s++) put(mats.woodPale, boxG(0.38, 0.08, 2.2), -17.7, fy + 0.5 + s * 0.7, z);
    // book blocks
    for (let b = 0; b < 8; b++) {
      put(mats.cloth, boxG(0.18, 0.32, 0.22), -17.45, fy + 0.72 + (b % 4) * 0.7, z - 0.8 + (b % 3) * 0.55);
    }
  }
  // desk + ledger
  box(mats.wood, -13.2, fy + 0.55, 10.4, 1.8, 0.12, 1.1, { surface: 'wood' });
  box(mats.wood, -13.2, fy + 0.28, 10.4, 1.6, 0.5, 0.9, { surface: 'wood' });
  put(mats.salt, boxG(0.55, 0.04, 0.4), -13.1, fy + 0.66, 10.35);
  interact.push({
    id: 'ledger', kind: 'inspect', pos: new THREE.Vector3(-13.2, fy + 0.8, 10.4), r: 1.5,
    title: 'VOW LEDGER, 1911–',
    body: 'Columns of boats, then a column of names the monks fed the rock. The last bound syllable they dared write in full: AEL. After that, only ditto marks, then salt.',
    word: 'AEL', fragment: 'ael',
  });

  // vinyl
  put(mats.black, cylG(0.28, 0.04, 20), -13.4, fy + 0.64, 14.2);
  put(mats.brass, cylG(0.08, 0.22, 8), -13.4, fy + 0.78, 14.2);
  box(mats.wood, -13.4, fy + 0.45, 14.2, 0.9, 0.5, 0.9, { surface: 'wood' });
  interact.push({
    id: 'vinyl', kind: 'inspect', pos: new THREE.Vector3(-13.4, fy + 0.9, 14.2), r: 1.5,
    title: 'CRACKED WAX',
    body: 'A distress disc. The needle still knows the groove. A novice whispers both halves as one breath, then begs the boats to be spared. The word is not two words.',
    word: 'ORTHAEL', fragment: 'orthael', sound: 'vinyl',
  });

  // relic — brass tuning fork
  put(mats.brassBright, forkG(), -16.6, fy + 1.15, 15.8, 0.2, 0.4, 0);
  interact.push({
    id: 'relic', kind: 'take', pos: new THREE.Vector3(-16.6, fy + 1.1, 15.8), r: 1.4,
    title: 'STILLING FORK',
    body: 'Warm. It wants a name spoken into it. The plate underneath: CARRY TO THE MOUTH.',
    take: 'fork',
  });

  put(mats.glass, boxG(1.2, 1.0, 0.08), -14.6, 8.8, 6.85);
  zones.archive = { minx: -19, maxx: -10, minz: 7, maxz: 17, y: fy };

  // ─── LANTERN WALK (stepped exterior ramp) ───────────────────────────────
  // landing
  box(mats.basalt, 12.4, fy - 0.18, 9.2, 5.0, 0.36, 3.6);
  box(mats.basaltDark, 14.7, 6.4, 9.2, 0.4, 4.4, 3.6);
  box(mats.basaltDark, 12.4, 6.2, 11.0, 5.0, 4.0, 0.35);

  const walkSteps = [];
  for (let i = 0; i < 34; i++) {
    const t = i / 33;
    const z = 7.4 - i * 0.46;
    const y = fy + t * 8.0;
    const x = 13.3;
    box(mats.basalt, x, y - 0.12, z, 3.6, 0.24, 0.55);
    if (i % 2 === 0) {
      box(mats.basaltDark, x + 1.7, y + 1.15, z, 0.28, 2.4, 0.9);
      box(mats.basaltDark, x - 1.7, y + 1.0, z, 0.22, 2.1, 0.9);
    }
    if (i % 4 === 0) {
      const lx = x + 1.35, ly = y + 1.45, lz = z;
      put(mats.brass, cylG(0.05, 0.7, 5), lx, ly, lz);
      put(mats.glass, cylG(0.11, 0.22, 6), lx, ly + 0.42, lz);
      candles.push({ x: lx, y: ly + 0.42, z: lz, flicker: Math.random() });
    }
    walkSteps.push(new THREE.Vector3(x, y + 0.2, z));
    if (i % 8 === 3) {
      put(mats.clothFade, new THREE.PlaneGeometry(0.5, 1.3), x - 1.55, y + 1.6, z, 0, 1.2, 0.08);
      flags.push({ x: x - 1.55, y: y + 1.6, z });
    }
  }
  // lookout
  box(mats.basalt, 12.6, 11.85, -8.2, 5.2, 0.35, 3.4);
  box(mats.basaltDark, 14.9, 13.2, -8.2, 0.3, 2.4, 3.4);
  interact.push({
    id: 'lookout', kind: 'inspect', pos: new THREE.Vector3(12.4, 12.4, -8.2), r: 1.8,
    title: 'STILL CLOUD',
    body: 'The weather is holding its breath. Below, the sea has the skin of brass. No gulls. The stack is listening through you.',
  });

  // door into chamber
  const chamberDoor = makeDoor(mats, 10.0, 13.15, -8.4, 0.14, 3.0, 2.3, Math.PI / 2);
  doors.push(chamberDoor);
  box(mats.basalt, 10.05, 14.7, -4.6, 0.7, 4.0, 5.0);
  box(mats.basalt, 10.05, 14.7, -12.4, 0.7, 4.0, 4.6);
  interact.push({
    id: 'door-chamber', kind: 'door', pos: new THREE.Vector3(10, 13.0, -8.4), r: 1.7,
    title: 'BINDING THRESHOLD',
    body: 'The brass ring in the lintel is worn thin by thumbs. Names went in. None came out that the boats remember.',
    door: chamberDoor, startOpen: false,
  });

  zones.walk = { minx: 10, maxx: 16, minz: -10, maxz: 12, y: 8 };

  // ─── BINDING CHAMBER ────────────────────────────────────────────────────
  const cy = 12.0;
  box(mats.basalt, 0, cy - 0.2, -14, 20.2, 0.4, 16.4);
  box(mats.basaltDark, 0, 19.2, -14, 20.2, 0.5, 16.4);
  box(mats.basalt, -10.0, 15.5, -14, 0.7, 7.0, 16.4);
  box(mats.basalt, 10.0, 15.5, -17.4, 0.7, 7.0, 9.4);
  box(mats.basalt, 0, 15.5, -22.0, 20.2, 7.0, 0.8);
  box(mats.basalt, -4.8, 15.5, -6.0, 10.6, 7.0, 0.7);
  box(mats.basalt, 6.6, 15.5, -6.0, 6.8, 7.0, 0.7);

  // brass binding rings on floor
  for (const r of [2.2, 3.8, 5.4]) {
    put(mats.brass, torusG(r, 0.06), 0, cy + 0.04, -14.5, Math.PI / 2, 0, 0);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    put(mats.brass, cylG(0.08, 0.5, 5), Math.cos(a) * 5.4, cy + 0.28, -14.5 + Math.sin(a) * 5.4);
  }

  // THE MOUTH in the north wall — three stacked lips, unique architecture
  put(mats.basaltDark, mouthWallG(), 0, cy + 3.4, -21.35);
  for (let i = 0; i < 3; i++) {
    const yy = cy + 5.1 - i * 1.35;
    const rr = 1.15 - i * 0.18;
    put(mats.saintMouth, torusG(rr, 0.16), 0, yy, -21.15, 0, 0, 0);
    put(mats.black, cylG(rr * 0.72, 0.2, 12), 0, yy, -21.05, 0, 0, Math.PI / 2);
  }
  // salt teeth
  for (let i = 0; i < 9; i++) {
    put(mats.salt, new THREE.ConeGeometry(0.12, 0.55, 5), -1.6 + i * 0.4, cy + 2.35, -21.0, Math.PI, 0, 0);
  }

  interact.push({
    id: 'mouth', kind: 'bind', pos: new THREE.Vector3(0, cy + 1.6, -19.4), r: 3.4,
    title: 'THE ASHEN MOUTH',
    body: 'A listening saint poured into basalt. It learned every prayer and every sinking. Speak the bound name into the fork. Shout your own and it will answer as family.',
  });

  // chamber candles
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * 6.6, z = -14.5 + Math.sin(a) * 4.8;
    put(mats.brass, cylG(0.07, 0.9, 5), x, cy + 0.55, z);
    put(mats.candle, cylG(0.045, 0.16, 5), x, cy + 1.08, z);
    candles.push({ x, y: cy + 1.15, z, flicker: Math.random() });
  }

  zones.chamber = { minx: -10, maxx: 10, minz: -22, maxz: -6, y: cy };

  // Rock mass between chapel and chamber — keeps the stack solid from outside
  box(mats.basaltDark, 0, 6.5, -1.0, 20.4, 13.0, 6.2);
  box(mats.basaltDark, -14.5, 8.0, -1.0, 9.0, 16.0, 14.0);
  box(mats.basalt, 0, 22.0, -8.0, 14.0, 8.0, 22.0, { col: false });

  // ─── Exterior hex columns (the stack silhouette) ────────────────────────
  const hexes = [
    [-12, 8, 20], [12, 9, 19], [-14, 12, 8], [16, 14, 2],
    [-16, 16, -6], [15, 18, -16], [-11, 17, -20], [8, 20, -24],
    [-8, 22, 24], [11, 11, 26], [-18, 10, 14], [18, 13, -4],
  ];
  for (const [x, h, z] of hexes) {
    cyl(mats.basaltDark, x, h * 0.5 - 1.2, z, 1.1 + (Math.abs(x) % 5) * 0.08, h, 6, { col: false });
  }

  // salt crust boulders on dock / walk
  for (const [x, y, z, s] of [[-8.5, 0.5, 37, 0.7], [8.8, 0.45, 35, 0.55], [14.8, 5.2, 8.4, 0.4], [-0.8, cy + 0.2, -10.2, 0.5]]) {
    put(mats.salt, new THREE.DodecahedronGeometry(s, 0), x, y, z);
  }

  // ─── merge buckets ──────────────────────────────────────────────────────
  const merged = [];
  for (const [mat, list] of buckets) {
    const geos = [];
    for (const it of list) {
      const g = it.geo.clone();
      tmpP.set(it.x, it.y, it.z);
      tmpQ.setFromEuler(new THREE.Euler(it.rx, it.ry, it.rz));
      tmpS.set(it.sx, it.sy, it.sz);
      tmpM.compose(tmpP, tmpQ, tmpS);
      g.applyMatrix4(tmpM);
      geos.push(g);
    }
    if (!geos.length) continue;
    const mg = mergeGeometries(geos, false);
    if (mg) {
      const mesh = new THREE.Mesh(mg, mat);
      mesh.castShadow = quality === 'high';
      mesh.receiveShadow = true;
      scene.add(mesh);
      merged.push(mesh);
    } else {
      for (const it of list) {
        const mesh = new THREE.Mesh(it.geo, mat);
        mesh.position.set(it.x, it.y, it.z);
        mesh.rotation.set(it.rx, it.ry, it.rz);
        mesh.scale.set(it.sx, it.sy, it.sz);
        mesh.castShadow = quality === 'high';
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }
    for (const g of geos) g.dispose();
  }

  // attach live door meshes (not merged)
  for (const d of doors) {
    scene.add(d.group);
    d.collider = world.addBox(d.cx, d.cy, d.cz, d.w, d.h, d.d, { door: d, solid: !d.open });
  }

  // patrol: chamber → walk → chapel → archive door → chapel → walk → chamber
  patrol.push(
    new THREE.Vector3(0, cy + 0.05, -14),
    new THREE.Vector3(8, cy + 0.05, -8.4),
    new THREE.Vector3(13.2, 10.2, -2),
    new THREE.Vector3(13.2, 6.2, 6),
    new THREE.Vector3(8, fy + 0.05, 9.2),
    new THREE.Vector3(0, fy + 0.05, 13),
    new THREE.Vector3(-8, fy + 0.05, 12.2),
    new THREE.Vector3(0, fy + 0.05, 10),
    new THREE.Vector3(8, fy + 0.05, 9.2),
    new THREE.Vector3(13.2, 8.5, 2),
    new THREE.Vector3(8, cy + 0.05, -8),
  );

  // Fix the accidental giant bulk: we never added the 28x22x44 filler in the
  // final geometry above. Perimeter hexes + room walls only. Good.

  const under = new THREE.Mesh(boxG(21, 3.6, 19), mats.basaltDark);
  under.position.set(0, 1.7, 13);
  under.receiveShadow = true;
  scene.add(under);
  world.addBox(0, 1.7, 13, 21, 3.6, 19);

  const spawn = new THREE.Vector3(0, 0.45, 38.5);

  return {
    spawn, interact, listenables, candles, flags, bells, doors, patrol, zones,
    introLook: new THREE.Vector3(0, 10, 8),
  };
}

function makeDoor(mats, x, y, z, w, h, d, rotY) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  const panel = new THREE.Mesh(boxG(w, h, d), mats.wood);
  group.add(panel);
  const band = new THREE.Mesh(boxG(w * 1.05, 0.08, d * 1.2), mats.brass);
  band.position.y = h * 0.15;
  group.add(band);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mats.brassBright);
  handle.position.set(w * 0.35, 0, d * 0.6);
  group.add(handle);
  return {
    group, open: false, t: 0, rotY,
    cx: x, cy: y, cz: z, w: Math.abs(Math.cos(rotY) * w) + Math.abs(Math.sin(rotY) * d) + 0.4,
    h, d: Math.abs(Math.sin(rotY) * w) + Math.abs(Math.cos(rotY) * d) + 0.4,
    collider: null,
  };
}

export function setDoorOpen(door, open) {
  door.open = open;
  if (door.collider) door.collider.solid = !open;
}

const _boxCache = new Map();
const _cylCache = new Map();
function boxG(w, h, d) {
  const k = w.toFixed(2) + ',' + h.toFixed(2) + ',' + d.toFixed(2);
  let g = _boxCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _boxCache.set(k, g); }
  return g;
}
function cylG(r, h, seg) {
  const k = r.toFixed(2) + ',' + h.toFixed(2) + ',' + seg;
  let g = _cylCache.get(k);
  if (!g) { g = new THREE.CylinderGeometry(r, r, h, seg); _cylCache.set(k, g); }
  return g;
}
function torusG(r, t) { return new THREE.TorusGeometry(r, t, 8, 16); }
function bellG() {
  const a = new THREE.CylinderGeometry(0.12, 0.28, 0.4, 10);
  a.translate(0, -0.1, 0);
  return a;
}
function boatG() {
  const hull = new THREE.BoxGeometry(1.8, 0.45, 5.2);
  return hull;
}
function forkG() {
  const a = new THREE.BoxGeometry(0.06, 0.5, 0.06);
  return a;
}
function mouthWallG() {
  return new THREE.BoxGeometry(8.5, 7.2, 0.7);
}
