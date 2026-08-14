/**
 * 14 Ashen Lane — locked plan. 1 unit = 1 metre.
 *
 *            N  −Z (back garden)
 *   ┌─────────────┬──────────┬─────────────┐  z = Z0
 *   │   DINING    │          │   KITCHEN   │
 *   │             │   HALL   │  cellar ↓   │
 *   ├─────────────┤          ├─────────────┤  z = PZ
 *   │   PARLOR    │  stair ↑ │   kitchen   │
 *   │   grate W   │  front   │   (south)   │
 *   └─────────────┴──────────┴─────────────┘  z = Z1  (front / porch / street +Z)
 *
 * Upstairs: master (west) | landing + hole | nursery (east)
 */

export const T = 0.16;
export const H = 2.80;
export const CELLAR_Y = -2.80;
export const H2 = 5.60;
export const CEIL = H - 0.18;

export const X0 = -5.70;
export const X1 = 5.70;
export const Z0 = -4.60;
export const Z1 = 5.20;
export const OX = 0;
export const OZ = (Z0 + Z1) * 0.5;

export const PW = -1.45;
export const PE = 1.52;
export const PZ = 0.48;

export const DOOR_W = 0.98;
export const DOOR_H = 2.14;
export const WIN_SILL = 0.90;
export const WIN_HEAD = 2.26;
export const WIN_W = 1.10;

export const RISERS = 16;
export const RISE = H / RISERS;
export const TREADS = 15;
export const RUN = 0.26;

export const MAIN_STAIR = {
  x: 0.94,
  w: 1.12,
  zBot: 4.46,
  dirZ: -1,
  zTop: 4.46 - TREADS * RUN,
};

export const CELLAR_STAIR = {
  x: 2.22,
  w: 1.10,
  zLow: -3.18,
  dirZ: 1,
  zHigh: -3.18 + TREADS * RUN,
};

export const HOLE_MAIN = {
  x: MAIN_STAIR.x,
  w: 1.20,
  z: (MAIN_STAIR.zTop + 0.18 + MAIN_STAIR.zBot + 0.06) * 0.5,
  d: (MAIN_STAIR.zBot + 0.06) - (MAIN_STAIR.zTop + 0.18),
};

export const HOLE_CELLAR = {
  x: CELLAR_STAIR.x,
  w: 1.18,
  z: (CELLAR_STAIR.zLow - 0.08 + CELLAR_STAIR.zHigh - 0.14) * 0.5,
  d: (CELLAR_STAIR.zHigh - 0.14) - (CELLAR_STAIR.zLow - 0.08),
};

export const GRATE = { x: X0 + 0.42, y: 0.62, z: 2.72 };
export const PARLOR_LAMP = { x: -3.05, y: 1.18, z: 4.38 };

export const SPAWN = { x: -0.42, y: 0.02, z: 4.22, yaw: 0 };

function doorOpening(c, y) {
  return { a: c - DOOR_W * 0.5, b: c + DOOR_W * 0.5, sill: y, head: y + DOOR_H };
}
function winOpening(c, y, w = WIN_W) {
  return { a: c - w * 0.5, b: c + w * 0.5, sill: y + WIN_SILL, head: y + WIN_HEAD };
}

export const OPEN = {
  south0: [
    doorOpening(0, 0),
    winOpening(-4.72, 0),
    winOpening(-3.38, 0),
    winOpening(3.82, 0),
    winOpening(5.08, 0),
  ],
  south1: [
    winOpening(-4.72, H),
    winOpening(-3.38, H),
    winOpening(3.82, H),
    winOpening(5.08, H),
  ],
  north0: [winOpening(-3.55, 0), winOpening(3.55, 0)],
  north1: [winOpening(-3.55, H), winOpening(3.55, H)],
  west0: [
    { a: 2.15, b: 3.25, sill: WIN_SILL, head: WIN_HEAD },
    { a: -2.40, b: -1.30, sill: WIN_SILL, head: WIN_HEAD },
  ],
  west1: [
    { a: 2.15, b: 3.25, sill: H + WIN_SILL, head: H + WIN_HEAD },
    { a: -2.40, b: -1.30, sill: H + WIN_SILL, head: H + WIN_HEAD },
  ],
  east0: [{ a: 2.00, b: 3.10, sill: WIN_SILL, head: WIN_HEAD }],
  east1: [{ a: 2.00, b: 3.10, sill: H + WIN_SILL, head: H + WIN_HEAD }],
  pw0: [doorOpening(2.75, 0), doorOpening(-1.70, 0)],
  pe0: [doorOpening(2.75, 0), doorOpening(-1.70, 0)],
  pz0: [doorOpening(-3.42, 0)],
  pw1: [doorOpening(2.55, H)],
  pe1: [doorOpening(2.55, H)],
};

export const WINDOWS = [
  { wall: 's', c: -4.72, y: 0, curtains: true },
  { wall: 's', c: -3.38, y: 0, curtains: true },
  { wall: 's', c: 3.82, y: 0, curtains: false },
  { wall: 's', c: 5.08, y: 0, curtains: false },
  { wall: 's', c: -4.72, y: H, curtains: true },
  { wall: 's', c: -3.38, y: H, curtains: true },
  { wall: 's', c: 3.82, y: H, curtains: true },
  { wall: 's', c: 5.08, y: H, curtains: true },
  { wall: 'n', c: -3.55, y: 0, curtains: false },
  { wall: 'n', c: 3.55, y: 0, curtains: false },
  { wall: 'n', c: -3.55, y: H, curtains: true },
  { wall: 'n', c: 3.55, y: H, curtains: true },
  { wall: 'w', c: 2.70, y: 0, curtains: true },
  { wall: 'w', c: -1.85, y: 0, curtains: false },
  { wall: 'w', c: 2.70, y: H, curtains: true },
  { wall: 'w', c: -1.85, y: H, curtains: true },
  { wall: 'e', c: 2.55, y: 0, curtains: false },
  { wall: 'e', c: 2.55, y: H, curtains: true },
];
