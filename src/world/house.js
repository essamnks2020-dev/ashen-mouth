import * as THREE from 'three';
import {
  T, H, H2, CEIL, CELLAR_Y, X0, X1, Z0, Z1, OX, OZ, PW, PE, PZ,
  MAIN_STAIR, CELLAR_STAIR, HOLE_MAIN, HOLE_CELLAR, OPEN, WINDOWS,
  SPAWN, GRATE, PARLOR_LAMP,
} from './plan.js';
import {
  createCtx, wall, floors, ceiling, stairs, rail, makeDoor, placeWindow,
  setDoorOpen, toggleLight,
} from './kit.js';
import { buildYard, buildPorch, buildRoof, windowFill } from './exterior.js';
import { dressAll } from './rooms.js';

export { setDoorOpen, toggleLight };

export function buildHouse(scene, world, mats, quality) {
  const ctx = createCtx(scene, world, mats, quality);

  buildYard(ctx);
  buildPorch(ctx);

  const W = X1 - X0;
  const D = Z1 - Z0;

  floors(ctx, OX, 0, OZ, W - 0.06, D - 0.06, [HOLE_CELLAR], mats.floor);
  floors(ctx, OX, H, OZ, W - 0.06, D - 0.06, [HOLE_MAIN], mats.floor);
  floors(ctx, OX, H2, OZ, W + 0.2, D + 0.2, [], mats.woodDark, false);
  floors(ctx, 0, CELLAR_Y, 0.2, 10.8, 9.0, [], mats.brick);
  ceiling(ctx, OX, CEIL, OZ, W - 0.22, D - 0.22, [HOLE_MAIN, HOLE_CELLAR], mats.plaster);
  ceiling(ctx, OX, H2 - 0.06, OZ, W - 0.22, D - 0.22, [], mats.plaster);

  const xi0 = X0 + T * 0.5, xi1 = X1 - T * 0.5;
  const zi0 = Z0 + T * 0.5, zi1 = Z1 - T * 0.5;

  wall(ctx, { axis: 'z', pos: zi1, y0: 0, h: H, from: X0, to: X1, openings: OPEN.south0, mat: mats.brick, skirt: -1 });
  wall(ctx, { axis: 'z', pos: zi1, y0: H, h: H2 - H, from: X0, to: X1, openings: OPEN.south1, mat: mats.brick, skirt: -1 });
  wall(ctx, { axis: 'z', pos: zi0, y0: 0, h: H, from: X0, to: X1, openings: OPEN.north0, mat: mats.brick, skirt: 1 });
  wall(ctx, { axis: 'z', pos: zi0, y0: H, h: H2 - H, from: X0, to: X1, openings: OPEN.north1, mat: mats.brick, skirt: 1 });
  wall(ctx, { axis: 'x', pos: xi0, y0: 0, h: H, from: Z0, to: Z1, openings: OPEN.west0, mat: mats.brick, skirt: 1 });
  wall(ctx, { axis: 'x', pos: xi0, y0: H, h: H2 - H, from: Z0, to: Z1, openings: OPEN.west1, mat: mats.brick, skirt: 1 });
  wall(ctx, { axis: 'x', pos: xi1, y0: 0, h: H, from: Z0, to: Z1, openings: OPEN.east0, mat: mats.brick, skirt: -1 });
  wall(ctx, { axis: 'x', pos: xi1, y0: H, h: H2 - H, from: Z0, to: Z1, openings: OPEN.east1, mat: mats.brick, skirt: -1 });

  const veneer = { collide: false, thick: 0.03, crown: true };
  wall(ctx, { axis: 'z', pos: zi1 - T * 0.5 - 0.02, y0: 0, h: H, from: X0 + T, to: X1 - T, openings: OPEN.south0, mat: mats.plaster, skirt: -1, ...veneer });
  wall(ctx, { axis: 'z', pos: zi1 - T * 0.5 - 0.02, y0: H, h: H2 - H, from: X0 + T, to: X1 - T, openings: OPEN.south1, mat: mats.wallpaper, skirt: -1, ...veneer });
  wall(ctx, { axis: 'z', pos: zi0 + T * 0.5 + 0.02, y0: 0, h: H, from: X0 + T, to: X1 - T, openings: OPEN.north0, mat: mats.plaster, skirt: 1, ...veneer });
  wall(ctx, { axis: 'z', pos: zi0 + T * 0.5 + 0.02, y0: H, h: H2 - H, from: X0 + T, to: X1 - T, openings: OPEN.north1, mat: mats.wallpaper, skirt: 1, ...veneer });
  wall(ctx, { axis: 'x', pos: xi0 + T * 0.5 + 0.02, y0: 0, h: H, from: Z0 + T, to: Z1 - T, openings: OPEN.west0, mat: mats.wallpaper, skirt: 1, ...veneer });
  wall(ctx, { axis: 'x', pos: xi0 + T * 0.5 + 0.02, y0: H, h: H2 - H, from: Z0 + T, to: Z1 - T, openings: OPEN.west1, mat: mats.wallpaper, skirt: 1, ...veneer });
  wall(ctx, { axis: 'x', pos: xi1 - T * 0.5 - 0.02, y0: 0, h: H, from: Z0 + T, to: Z1 - T, openings: OPEN.east0, mat: mats.wallpaperWarm, skirt: -1, ...veneer });
  wall(ctx, { axis: 'x', pos: xi1 - T * 0.5 - 0.02, y0: H, h: H2 - H, from: Z0 + T, to: Z1 - T, openings: OPEN.east1, mat: mats.wallpaperWarm, skirt: -1, ...veneer });

  wall(ctx, { axis: 'x', pos: PW, y0: 0, h: H, from: Z0 + T, to: Z1 - T, openings: OPEN.pw0, mat: mats.wallpaper, skirt: 1 });
  wall(ctx, { axis: 'x', pos: PE, y0: 0, h: H, from: Z0 + T, to: Z1 - T, openings: OPEN.pe0, mat: mats.wallpaperWarm, skirt: -1 });
  wall(ctx, { axis: 'z', pos: PZ, y0: 0, h: H, from: X0 + T, to: PW, openings: OPEN.pz0, mat: mats.plaster, skirt: 1 });
  wall(ctx, { axis: 'x', pos: PW, y0: H, h: H2 - H, from: Z0 + T, to: Z1 - T, openings: OPEN.pw1, mat: mats.wallpaper, skirt: 1 });
  wall(ctx, { axis: 'x', pos: PE, y0: H, h: H2 - H, from: Z0 + T, to: Z1 - T, openings: OPEN.pe1, mat: mats.wallpaperWarm, skirt: -1 });

  wall(ctx, { axis: 'x', pos: -5.25, y0: CELLAR_Y, h: H - 0.12, from: -4.35, to: 4.85, openings: [], mat: mats.brick, skirt: 1, crown: false });
  wall(ctx, { axis: 'x', pos: 5.25, y0: CELLAR_Y, h: H - 0.12, from: -4.35, to: 4.85, openings: [], mat: mats.brick, skirt: -1, crown: false });
  wall(ctx, { axis: 'z', pos: -4.35, y0: CELLAR_Y, h: H - 0.12, from: -5.25, to: 5.25, openings: [], mat: mats.brick, skirt: 1, crown: false });
  wall(ctx, { axis: 'z', pos: 4.85, y0: CELLAR_Y, h: H - 0.12, from: -5.25, to: 5.25, openings: [], mat: mats.brick, skirt: -1, crown: false });

  stairs(ctx, { x: MAIN_STAIR.x, w: MAIN_STAIR.w, yLow: 0, yHigh: H, zBot: MAIN_STAIR.zBot, dirZ: MAIN_STAIR.dirZ });
  stairs(ctx, { x: CELLAR_STAIR.x, w: CELLAR_STAIR.w, yLow: CELLAR_Y, yHigh: 0, zBot: CELLAR_STAIR.zLow, dirZ: CELLAR_STAIR.dirZ });

  rail(ctx, MAIN_STAIR.x - MAIN_STAIR.w * 0.5 - 0.05, H, MAIN_STAIR.zTop + 0.2, MAIN_STAIR.zBot - 0.15, 0.9);

  for (const w of WINDOWS) {
    const spec = { ...w };
    if (w.wall === 's') spec.zFace = Z1 + 0.01;
    if (w.wall === 'n') spec.zFace = Z0 - 0.01;
    if (w.wall === 'w') spec.xFace = X0 - 0.01;
    if (w.wall === 'e') spec.xFace = X1 + 0.01;
    placeWindow(ctx, spec);
  }
  const glowWins = WINDOWS.filter((w) => !w.boarded && (w.wall === 's' || (w.wall === 'w' && w.y === 0)));
  for (const w of glowWins) {
    windowFill(ctx, w.wall, w.c, w.y, xi0, zi1);
  }

  const doors = [];
  doors.push(makeDoor(ctx, 0, 0, zi1, 0, 'front', 'Front door', true, 1, { transom: true, front: true }));
  doors.push(makeDoor(ctx, PW, 0, 2.75, Math.PI / 2, 'parlor', 'Parlor door', false, -1));
  doors.push(makeDoor(ctx, PE, 0, 2.75, -Math.PI / 2, 'kitchen', 'Kitchen door', false, 1));
  doors.push(makeDoor(ctx, -3.42, 0, PZ, 0, 'dining', 'Dining door', false, 1));
  doors.push(makeDoor(ctx, PW, 0, -1.70, Math.PI / 2, 'hallDining', 'Hall door', false, -1));
  doors.push(makeDoor(ctx, PE, 0, -1.70, -Math.PI / 2, 'kitchenBack', 'Kitchen door', false, 1));
  doors.push(makeDoor(ctx, PW, H, 2.55, Math.PI / 2, 'master', 'Bedroom door', false, -1));
  doors.push(makeDoor(ctx, PE, H, 2.55, -Math.PI / 2, 'child', 'Nursery door', false, 1));

  buildRoof(ctx);

  const parlor = dressAll(ctx, quality);

  const patrol = [
    new THREE.Vector3(-3.6, 0, 2.7),
    new THREE.Vector3(-0.4, 0, 3.4),
    new THREE.Vector3(3.8, 0, 3.0),
    new THREE.Vector3(-3.4, 0, -1.7),
    new THREE.Vector3(0.2, H, 2.2),
    new THREE.Vector3(-3.5, H, 2.6),
    new THREE.Vector3(3.6, H, 2.8),
    new THREE.Vector3(0.3, CELLAR_Y, 0.6),
  ];

  const zones = {
    foyer: { minx: PW, maxx: PE, minz: Z0, maxz: Z1, y: 0 },
    parlor: { minx: X0, maxx: PW, minz: PZ, maxz: Z1, y: 0 },
    kitchen: { minx: PE, maxx: X1, minz: Z0, maxz: Z1, y: 0 },
    dining: { minx: X0, maxx: PW, minz: Z0, maxz: PZ, y: 0 },
    landing: { minx: PW, maxx: PE, minz: Z0, maxz: Z1, y: H },
    master: { minx: X0, maxx: PW, minz: Z0, maxz: Z1, y: H },
    child: { minx: PE, maxx: X1, minz: Z0, maxz: Z1, y: H },
    cellar: { minx: -5.3, maxx: 5.3, minz: -4.4, maxz: 5.0, y: CELLAR_Y },
    porch: { minx: -2.4, maxx: 2.4, minz: Z1, maxz: 8.6, y: 0 },
  };

  return {
    root: ctx.root,
    spawn: new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z),
    spawnYaw: SPAWN.yaw,
    interact: ctx.interact,
    living: ctx.living,
    lights: ctx.lights,
    patrol,
    zones,
    doors,
    grate: parlor.grate,
    gratePos: new THREE.Vector3(GRATE.x + 0.55, 0.7, GRATE.z),
    lampPos: new THREE.Vector3(PARLOR_LAMP.x, PARLOR_LAMP.y, PARLOR_LAMP.z),
    houseLights: ctx.lights,
    frontDoor: doors[0],
  };
}
