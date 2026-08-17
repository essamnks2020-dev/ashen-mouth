import * as THREE from 'three';
import { H, CELLAR_Y, X0, PW, PE, PZ, Z1, GRATE, PARLOR_LAMP } from './plan.js';
import {
  box, cyl, rug, chair, table, sofa, armchair, bed, nightstand, lamp, wardrobe,
  sideboard, clock, coatRack, makeDrawer, makeCupboard, kitchenRun, stove, fridge,
  ceilingLamp, picture, switchPlate, piano, radio, rocker,
} from './kit.js';

export function dressAll(ctx, quality) {
  dressFoyer(ctx);
  const parlor = dressParlor(ctx, quality);
  dressKitchen(ctx);
  dressDining(ctx);
  dressLanding(ctx);
  dressMaster(ctx);
  dressChild(ctx);
  dressCellar(ctx);
  return parlor;
}

function dressFoyer(ctx) {
  rug(ctx, -0.35, 0, 3.35, 1.55, 3.4, ctx.mats.runner);
  ceilingLamp(ctx, -0.35, 2.62, 3.5, { id: 'foyer', base: 2.55, dist: 10 });
  clock(ctx, PW + 0.38, 0, 4.55);
  ctx.interact.push({
    kind: 'note', id: 'clock', title: 'Grandfather clock',
    pos: new THREE.Vector3(PW + 0.38, 1.4, 4.55), reach: 1.6,
    body: 'Still her time. The pendulum never learned to hurry. A paper wedge in the case: hush when the house is listening.',
  });
  coatRack(ctx, PW + 0.42, 0, 4.95);
  ctx.interact.push({
    kind: 'note', id: 'coat', title: 'Her coat',
    pos: new THREE.Vector3(PW + 0.42, 1.25, 4.95), reach: 1.5,
    body: 'Wool still holding rain from a night she never came back from the parlor. Pocket: a house key, a burnt match.',
  });
  picture(ctx, 0, 1.85, PZ + 0.12, 0.46, 0.36, 'n', ctx.mats.portrait);
  switchPlate(ctx, 0.62, 1.15, Z1 - 0.2, 's', 'foyer');
  switchPlate(ctx, PW + 0.12, 1.15, 3.35, 'w', 'foyer');
  box(ctx, ctx.mats.woodDark, PE - 0.38, 0.55, 4.85, 0.42, 1.1, 0.28, { collide: true });
  ctx.interact.push({
    kind: 'note', id: 'letters', title: 'Hall table',
    pos: new THREE.Vector3(PE - 0.38, 1.0, 4.85), reach: 1.5,
    body: 'Unopened post. A buyer\'s note on top: flue to be checked. Do not occupy overnight.',
  });
}

function dressParlor(ctx, quality) {
  rug(ctx, -3.55, 0, 2.75, 3.55, 3.6);
  // Chimney breast — full height into the ceiling so it reads continuous with the roof stack
  box(ctx, ctx.mats.brick, X0 + 0.38, 1.35, GRATE.z, 0.48, 2.7, 1.72, { collide: true, surface: 'stone' });
  box(ctx, ctx.mats.brick, X0 + 0.38, H + 1.2, GRATE.z, 0.55, 2.2, 1.55, { collide: true, surface: 'stone' });
  box(ctx, ctx.mats.soot, X0 + 0.55, 0.55, GRATE.z, 0.22, 0.95, 1.05, { collide: false });
  // Ash bed
  box(ctx, ctx.mats.soot, X0 + 0.62, 0.12, GRATE.z, 0.28, 0.08, 0.9, { collide: false, cast: false });
  const grate = new THREE.Group();
  grate.position.set(GRATE.x + 0.12, GRATE.y, GRATE.z);
  ctx.root.add(grate);
  // Vertical bars
  for (let i = 0; i < 7; i++) {
    box(ctx, ctx.mats.iron, 0.02, 0, -0.45 + i * 0.15, 0.03, 0.72, 0.03, { parent: grate, collide: false });
  }
  // Horizontal crossbars — reads as a real grate mouth
  box(ctx, ctx.mats.iron, 0.02, 0.22, 0, 0.04, 0.03, 0.95, { parent: grate, collide: false });
  box(ctx, ctx.mats.iron, 0.02, -0.22, 0, 0.04, 0.03, 0.95, { parent: grate, collide: false });
  // Flue throat — dark shaft rising into the breast (reads continuous to roof)
  box(ctx, ctx.mats.soot, -0.12, 0.95, 0, 0.16, 1.1, 0.55, { parent: grate, collide: false, cast: false });
  box(ctx, ctx.mats.iron, -0.04, 0.72, 0, 0.03, 0.06, 0.7, { parent: grate, collide: false, cast: false });
  const glow = box(ctx, ctx.mats.ember, -0.06, -0.08, 0, 0.1, 0.28, 0.7, { parent: grate, collide: false, cast: false });
  // Damper plate (animates closed on win via story if it finds grate.userData)
  const damper = box(ctx, ctx.mats.iron, -0.02, 0.38, 0, 0.02, 0.08, 0.85, { parent: grate, collide: false });
  grate.userData.damper = damper;
  grate.userData.damperOpen = 1;
  const fireLight = new THREE.PointLight(0xff6a28, 1.85, 8.2, 1.6);
  fireLight.position.set(GRATE.x + 0.45, 0.72, GRATE.z);
  ctx.root.add(fireLight);
  ctx.lights.push({ light: fireLight, base: 1.85, flicker: 0.18, id: 'fire' });
  ctx.living.push({
    update(dt, t) {
      const open = grate.userData.damperOpen ?? 1;
      glow.scale.y = (0.85 + Math.sin(t * 7.2) * 0.12 + Math.sin(t * 13) * 0.06) * open;
      glow.visible = open > 0.08;
      ctx.mats.ember.emissiveIntensity = (2.1 + Math.sin(t * 6.5) * 0.5) * open;
      fireLight.intensity = (1.85 + Math.sin(t * 8) * 0.25) * Math.max(0.05, open);
      damper.position.y = 0.38 - (1 - open) * 0.42;
      // Soft chimney smoke columns
      if (grate.userData.smoke) {
        for (let i = 0; i < grate.userData.smoke.length; i++) {
          const s = grate.userData.smoke[i];
          s.position.y = 0.45 + ((t * (0.22 + i * 0.035) + i * 0.28) % 2.2);
          s.material.opacity = 0.055 * open * (1 - (s.position.y - 0.45) / 2.2);
          s.scale.setScalar(0.65 + (s.position.y - 0.45) * 0.45);
        }
      }
    },
  });
  // Smoke puffs rising into the breast / flue
  if (quality !== 'low') {
    const smoke = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.07 + i * 0.012, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x9a8f84, transparent: true, opacity: 0.05, depthWrite: false }),
      );
      m.position.set(-0.08, 0.5, -0.2 + (i % 4) * 0.1);
      grate.add(m);
      smoke.push(m);
    }
    grate.userData.smoke = smoke;
  }
  box(ctx, ctx.mats.wood, X0 + 0.58, 1.58, GRATE.z, 0.36, 0.1, 1.75, { collide: false });
  // Mantel corbels
  box(ctx, ctx.mats.woodDark, X0 + 0.5, 1.42, GRATE.z - 0.55, 0.18, 0.22, 0.14, { collide: false, cast: false });
  box(ctx, ctx.mats.woodDark, X0 + 0.5, 1.42, GRATE.z + 0.55, 0.18, 0.22, 0.14, { collide: false, cast: false });
  picture(ctx, X0 + 0.62, 1.88, GRATE.z - 0.35, 0.22, 0.28, 'w', ctx.mats.portrait);

  ctx.interact.push({
    kind: 'note', id: 'photo', title: 'Photograph, reversed',
    pos: new THREE.Vector3(X0 + 0.85, 1.7, GRATE.z - 0.3), reach: 1.7, frag: 'maren',
    body: 'Father at the piano. On the back, in her hand: MAREN — say it small, at the mouth, and the house will close.',
  });
  ctx.interact.push({
    kind: 'grate', id: 'grate', title: 'The grate',
    pos: new THREE.Vector3(GRATE.x + 0.55, 0.7, GRATE.z), reach: 1.85,
    body: 'Ash in the shape of tape. The iron is warm. This is the mouth.',
  });

  sofa(ctx, -3.35, 0, 1.35, 0);
  armchair(ctx, -2.15, 0, 3.55, -0.9);
  rocker(ctx, -4.55, 0, 1.55, 0.4);
  table(ctx, -3.35, 0, 2.45, 0.85, 0.5, 0);
  radio(ctx, -3.15, 0.88, 2.45);
  lamp(ctx, PARLOR_LAMP.x, 0, PARLOR_LAMP.z, 'parlor', 1.45);
  ceilingLamp(ctx, -3.5, 2.62, 2.7, { id: 'parlor-ceil', base: 2.05, dist: 9 });
  switchPlate(ctx, PW - 0.12, 1.15, 3.5, 'e', 'parlor-ceil');
  piano(ctx, -4.55, 0, 4.05, 0);
  makeCupboard(ctx, X0 + 0.48, 1.0, 4.85, 0.4, 1.28, 0.48, 'left',
    'Parlor cupboard', 'Hymnals and a box of matches. The wood still smells of smoke.');
  picture(ctx, -3.5, 1.75, Z1 - 0.2, 0.55, 0.42, 's', ctx.mats.portrait);

  if (quality !== 'low') {
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xffe6c0, transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide }),
    );
    shaft.position.set(-4.72, 1.35, 4.55);
    shaft.rotation.x = 0.18;
    shaft.castShadow = shaft.receiveShadow = false;
    ctx.root.add(shaft);
    ctx.living.push({ update(dt, t) { shaft.material.opacity = 0.03 + Math.sin(t * 0.6) * 0.012; } });
  }
  return { grate };
}

function dressKitchen(ctx) {
  kitchenRun(ctx, 5.28, -2.55, 4.2);
  // Short return run along the south wall — full cabinet faces so the L reads as cabinetry
  box(ctx, ctx.mats.woodDark, 4.35, 0.05, 4.55, 1.55, 0.1, 0.56, { collide: false, cast: false });
  box(ctx, ctx.mats.wood, 4.35, 0.48, 4.55, 1.55, 0.76, 0.56, { collide: true });
  box(ctx, ctx.mats.porcelain, 4.35, 0.9, 4.53, 1.62, 0.05, 0.62, { collide: false });
  box(ctx, ctx.mats.brass, 4.35, 0.925, 4.22, 1.55, 0.015, 0.015, { collide: false, cast: false });
  for (let i = 0; i < 3; i++) {
    const xx = 3.75 + i * 0.5;
    box(ctx, ctx.mats.woodDark, xx, 0.48, 4.26, 0.42, 0.62, 0.03, { collide: false, cast: false });
    box(ctx, ctx.mats.wood, xx, 0.48, 4.245, 0.28, 0.42, 0.01, { collide: false, cast: false });
    box(ctx, ctx.mats.brass, xx, 0.48, 4.24, 0.02, 0.08, 0.02, { collide: false, cast: false });
  }
  box(ctx, ctx.mats.porcelain, 4.35, 1.18, 4.78, 1.45, 0.42, 0.03, { collide: false, cast: false });
  // Corner filler so L joint doesn’t read as a gap
  box(ctx, ctx.mats.woodDark, 5.0, 0.48, 4.55, 0.28, 0.76, 0.28, { collide: false, cast: false });
  box(ctx, ctx.mats.porcelain, 5.0, 0.9, 4.55, 0.32, 0.05, 0.32, { collide: false, cast: false });

  stove(ctx, 5.28, 0, 1.05);
  fridge(ctx, 5.22, 0, 3.85);

  // Recessed sink — basin cut into the counter, not a floating white slab
  box(ctx, ctx.mats.porcelain, 5.12, 0.86, 2.55, 0.48, 0.08, 0.52, { collide: false });
  box(ctx, ctx.mats.iron, 5.12, 0.78, 2.55, 0.36, 0.12, 0.38, { collide: false, cast: false }); // basin well
  box(ctx, ctx.mats.iron, 5.12, 0.72, 2.55, 0.06, 0.04, 0.06, { collide: false, cast: false }); // drain
  // Faucet
  cyl(ctx, ctx.mats.iron, 5.28, 1.12, 2.55, 0.016, 0.016, 0.28);
  box(ctx, ctx.mats.iron, 5.12, 1.24, 2.55, 0.22, 0.03, 0.03, { collide: false, cast: false });
  cyl(ctx, ctx.mats.iron, 5.02, 1.18, 2.55, 0.012, 0.012, 0.1, { cast: false });

  // Drip — thin cylinder with opacity fade (not a bouncing sphere)
  const dropMat = ctx.mats.glass.clone();
  dropMat.transparent = true;
  dropMat.opacity = 0.55;
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.05, 6), dropMat);
  drop.position.set(5.02, 1.1, 2.55);
  drop.castShadow = false;
  ctx.root.add(drop);
  ctx.living.push({
    update(dt, t) {
      const u = (t * 0.62) % 1;
      drop.position.y = 1.08 - u * 0.95;
      drop.material.opacity = u < 0.75 ? 0.55 * (1 - u) : 0;
      drop.visible = u < 0.85;
      drop.scale.y = 0.8 + u * 1.4;
    },
  });
  ctx.interact.push({
    kind: 'note', id: 'tap', title: 'Kitchen tap',
    pos: new THREE.Vector3(5.05, 1.1, 2.55), reach: 1.5,
    body: 'It has dripped since the funeral. She said a house should not be silent. She was wrong about the reason.',
  });

  makeDrawer(ctx, 5.22, 0.52, 1.75, 0.5, 0.16, 0.42, 'x',
    'Kitchen drawer',
    'Twine, a burnt matchbox, and a list: milk, tape, hush-word. The first syllable written twice. MA.',
    'ma');
  makeCupboard(ctx, 5.28, 1.82, 1.85, 0.32, 0.62, 0.34, 'left',
    'Wall cupboard', 'Plates stacked facing the wall. She stopped setting a fourth.');

  table(ctx, 3.45, 0, 2.85, 1.15, 0.7, 0);
  chair(ctx, 3.05, 0, 2.4, 0.15);
  chair(ctx, 3.85, 0, 2.4, -0.1);
  box(ctx, ctx.mats.porcelain, 3.3, 0.78, 2.75, 0.12, 0.05, 0.12, { collide: false, cast: false });
  box(ctx, ctx.mats.linen, 3.6, 0.77, 2.9, 0.18, 0.015, 0.12, { collide: false, cast: false });
  ctx.interact.push({
    kind: 'note', id: 'letter', title: 'Unsent letter',
    pos: new THREE.Vector3(3.45, 0.85, 2.85), reach: 1.5, frag: 'ma',
    body: 'To the buyer: the flue sticks. Do not shout in the parlor. If it leans in, say the first of her name, small. MA.',
  });

  // Shared kitchen circuit — both pendants answer the same switch
  const pend = new THREE.PointLight(0xffe0a8, 1.55, 8.5, 1.5);
  pend.position.set(3.6, 2.45, 2.5);
  ctx.root.add(pend);
  ctx.lights.push({ light: pend, base: 1.55, flicker: 0.035, id: 'kitchen', toggle: true, on: true });
  cyl(ctx, ctx.mats.lampShade, 3.6, 2.48, 2.5, 0.08, 0.28, 0.1, { rotX: Math.PI / 2, cast: false });
  ceilingLamp(ctx, 4.55, 2.62, 0.35, { id: 'kitchen', base: 1.25, color: 0xfff2c8, dist: 7 });
  switchPlate(ctx, 3.2, 1.15, Z1 - 0.18, 's', 'kitchen');

  // Shelf props — kitchen should feel lived-in, not empty cabinet kit
  box(ctx, ctx.mats.woodDark, 4.15, 1.55, -1.85, 0.9, 0.04, 0.22, { collide: false });
  box(ctx, ctx.mats.woodDark, 4.15, 1.95, -1.85, 0.9, 0.04, 0.22, { collide: false });
  cyl(ctx, ctx.mats.iron, 3.9, 1.68, -1.85, 0.07, 0.08, 0.18, { cast: false });
  cyl(ctx, ctx.mats.porcelain, 4.15, 1.7, -1.85, 0.06, 0.07, 0.14, { cast: false });
  box(ctx, ctx.mats.iron, 4.4, 1.66, -1.85, 0.14, 0.16, 0.14, { collide: false, cast: false });
  // Hanging utensils
  for (let i = 0; i < 4; i++) {
    const zz = 0.2 + i * 0.28;
    box(ctx, ctx.mats.iron, 4.95, 1.48, zz, 0.02, 0.22, 0.02, { collide: false, cast: false });
    box(ctx, ctx.mats.iron, 4.95, 1.35, zz, 0.08, 0.02, 0.02, { collide: false, cast: false });
  }
  // Floor mat
  box(ctx, ctx.mats.linen, 4.6, 0.02, 2.55, 0.7, 0.02, 1.1, { collide: false, cast: false });
  // Window sill jars
  cyl(ctx, ctx.mats.glass, 5.35, 1.05, 2.55, 0.05, 0.06, 0.12, { cast: false });
  cyl(ctx, ctx.mats.glass, 5.35, 1.02, 2.75, 0.04, 0.05, 0.1, { cast: false });
}

function dressDining(ctx) {
  rug(ctx, -3.5, 0, -1.85, 2.8, 2.2);
  table(ctx, -3.5, 0, -1.85, 1.55, 0.9, 0);
  chair(ctx, -4.05, 0, -1.4, Math.PI);
  chair(ctx, -2.95, 0, -1.4, Math.PI);
  chair(ctx, -4.05, 0, -2.3, 0);
  chair(ctx, -2.95, 0, -2.3, 0);
  box(ctx, ctx.mats.porcelain, -3.75, 0.78, -1.7, 0.14, 0.05, 0.14, { collide: false, cast: false });
  box(ctx, ctx.mats.porcelain, -3.25, 0.78, -1.95, 0.1, 0.08, 0.1, { collide: false, cast: false });
  box(ctx, ctx.mats.linen, -3.5, 0.77, -1.55, 0.2, 0.015, 0.12, { collide: false, cast: false });
  ceilingLamp(ctx, -3.5, 2.62, -1.8, { id: 'dining', base: 1.7, dist: 7.5 });
  sideboard(ctx, -3.5, 0, -4.15, 1.7);
  picture(ctx, -3.5, 1.7, -4.42, 0.7, 0.45, 'n', ctx.mats.portrait);
  switchPlate(ctx, PW - 0.12, 1.15, -1.6, 'e', 'dining');
  ctx.interact.push({
    kind: 'note', id: 'table', title: 'Dining table',
    pos: new THREE.Vector3(-3.5, 0.7, -1.85), reach: 1.55,
    body: 'Four chairs. Three places set. Dust on the fourth. She ate facing the parlor door, as if she could hear him through it.',
  });
}

function dressLanding(ctx) {
  const y = H;
  rug(ctx, -0.25, y, 2.2, 1.35, 2.4, ctx.mats.runner);
  ceilingLamp(ctx, -0.25, y + 2.55, 2.4, { id: 'landing', base: 1.75, dist: 7.5 });
  const sconce = new THREE.PointLight(0xffd8a0, 1.05, 6, 1.7);
  sconce.position.set(PW + 0.22, y + 1.5, 3.1);
  ctx.root.add(sconce);
  ctx.lights.push({ light: sconce, base: 1.05, flicker: 0.03, id: 'landing-sconce' });
  cyl(ctx, ctx.mats.brass, PW + 0.18, y + 1.5, 3.1, 0.04, 0.04, 0.08, { cast: false });
  cyl(ctx, ctx.mats.lampShade, PW + 0.28, y + 1.48, 3.1, 0.08, 0.05, 0.1, { cast: false });
  picture(ctx, 0, y + 1.5, -0.15, 0.48, 0.36, 'n', ctx.mats.portrait);
  switchPlate(ctx, PW + 0.12, y + 1.15, 3.4, 'w', 'landing');
  ctx.interact.push({
    kind: 'note', id: 'landing', title: 'Landing',
    pos: new THREE.Vector3(-0.2, y + 1.2, 2.2), reach: 1.45,
    body: 'From here the parlor chimney sounds like breathing. She used to wait on this step until you were quiet enough to come up.',
  });
}

function dressMaster(ctx) {
  const y = H;
  rug(ctx, -3.55, y, 2.4, 3.4, 3.2);
  bed(ctx, -3.7, y, 1.55, 0, false);
  nightstand(ctx, -2.7, y, 2.45);
  lamp(ctx, -2.7, y, 2.45, 'master', 0.95);
  makeDrawer(ctx, -2.7, y + 0.22, 2.55, 0.36, 0.12, 0.28, 'z',
    'Bedside drawer', 'Hairpins and a folded note: the house hears the loud ones first.', null);
  wardrobe(ctx, X0 + 0.55, y, 4.35, 0);
  ceilingLamp(ctx, -3.5, y + 2.55, 2.5, { id: 'master-ceil', base: 1.45, dist: 7.5 });
  picture(ctx, -3.6, y + 1.55, Z1 - 0.2, 0.5, 0.4, 's', ctx.mats.portrait);
  ctx.interact.push({
    kind: 'note', id: 'wardrobe', title: 'Wardrobe',
    pos: new THREE.Vector3(X0 + 0.7, y + 1.2, 4.35), reach: 1.6,
    body: 'Dresses facing inward. A note on a sleeve: if you must speak, do it like a child who is already sorry.',
  });
  ctx.interact.push({
    kind: 'light', id: 'master-lamp', title: 'Bedside lamp',
    pos: new THREE.Vector3(-2.7, y + 0.8, 2.45), reach: 1.5, lightId: 'master',
  });
}

function dressChild(ctx) {
  const y = H;
  rug(ctx, 3.7, y, 2.6, 3.0, 3.0);
  bed(ctx, 3.85, y, 1.7, 0, true);
  makeCupboard(ctx, 5.22, y + 0.65, 4.2, 0.42, 1.05, 0.46, 'left',
    'Toy cupboard', 'Wooden animals face the wall. One has a mouth drawn on in red.');
  box(ctx, ctx.mats.wood, 4.85, y + 0.38, 3.35, 0.7, 0.55, 0.42, { collide: true });
  picture(ctx, PE + 0.12, y + 1.42, 3.2, 0.42, 0.34, 'w', ctx.mats.linen);
  ctx.interact.push({
    kind: 'note', id: 'drawing', title: 'A drawing',
    pos: new THREE.Vector3(PE + 0.35, y + 1.35, 3.2), reach: 1.6, frag: 'ren',
    body: 'A house with a red mouth. Under it, in crayon: REN. The last of her name. You wrote it when you still thought the grate was a face that could be kind.',
  });
  const cLamp = new THREE.PointLight(0xffe0b8, 1.0, 6.5, 1.6);
  cLamp.position.set(3.4, y + 1.55, 3.0);
  ctx.root.add(cLamp);
  ctx.lights.push({ light: cLamp, base: 1.0, flicker: 0.03, id: 'child', toggle: true, on: true });
  ceilingLamp(ctx, 3.7, y + 2.55, 2.6, { id: 'child-ceil', base: 1.35, dist: 7 });
  ctx.interact.push({
    kind: 'light', id: 'child-light', title: 'Nursery lamp',
    pos: new THREE.Vector3(3.4, y + 1.3, 3.0), reach: 1.55, lightId: 'child',
  });
}

function dressCellar(ctx) {
  const y = CELLAR_Y;
  box(ctx, ctx.mats.iron, -2.15, y + 0.85, 0.15, 1.05, 1.5, 1.05, { collide: true, surface: 'stone' });
  const flue = box(ctx, ctx.mats.iron, -2.15, y + 1.72, 0.15, 0.32, 0.1, 0.32, { collide: false });
  ctx.living.push({ update(dt, t) { flue.rotation.y = Math.sin(t * 0.4) * 0.05; } });
  const cold = new THREE.PointLight(0xb8c8d8, 1.05, 9, 1.4);
  cold.position.set(0.5, y + 1.85, 0.8);
  ctx.root.add(cold);
  ctx.lights.push({ light: cold, base: 1.05, flicker: 0.02, id: 'cellar' });
  const furnace = new THREE.PointLight(0xff6018, 1.15, 5.5, 1.75);
  furnace.position.set(-2.15, y + 0.7, 0.15);
  ctx.root.add(furnace);
  ctx.lights.push({ light: furnace, base: 1.15, flicker: 0.14, id: 'furnace' });
  ctx.interact.push({
    kind: 'key', id: 'damper', title: 'Damper wheel',
    pos: new THREE.Vector3(-2.15, y + 1.4, 0.15), reach: 1.7,
    body: 'The flue control. Cold iron. Take it upstairs. The mouth will not close without a hand on this and her name in the grate.',
  });
  ctx.interact.push({
    kind: 'note', id: 'coal', title: 'Coal scuttle',
    pos: new THREE.Vector3(-1.05, y + 0.45, 0.35), reach: 1.5,
    body: 'Tape spools, blackened. He recorded every dinner. She fed them to the house one reel at a time, and then the house knew the shape of his voice.',
  });
  box(ctx, ctx.mats.wood, 3.4, y + 0.85, -1.4, 0.38, 1.7, 1.5, { collide: true });
  box(ctx, ctx.mats.iron, -0.8, y + 0.35, 0.5, 0.55, 0.4, 0.4, { collide: false });
}
