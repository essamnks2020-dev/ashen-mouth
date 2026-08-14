import * as THREE from 'three';

const CELL = 6;

export class Collider {
  constructor(min, max, opts = {}) {
    this.min = min;
    this.max = max;
    this.solid = opts.solid !== false;
    this.blocksSight = opts.blocksSight !== false;
    this.surface = opts.surface || 'stone';
    this.alive = true;
    this.door = opts.door || null;
  }
}

export class World {
  constructor() {
    this.colliders = [];
    this.grid = new Map();
    this.gravity = -22;
    this.killY = -8;
    this._q = [];
  }

  _key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  add(c) {
    this.colliders.push(c);
    const x0 = Math.floor(c.min.x / CELL), x1 = Math.floor(c.max.x / CELL);
    const z0 = Math.floor(c.min.z / CELL), z1 = Math.floor(c.max.z / CELL);
    c._cells = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = this._key(x, z);
      let a = this.grid.get(k);
      if (!a) { a = []; this.grid.set(k, a); }
      a.push(c);
      c._cells.push(a);
    }
    return c;
  }

  addBox(cx, cy, cz, w, h, d, opts) {
    return this.add(new Collider(
      new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
      new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2),
      opts,
    ));
  }

  query(minx, minz, maxx, maxz) {
    const out = this._q;
    out.length = 0;
    const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL);
    const z0 = Math.floor(minz / CELL), z1 = Math.floor(maxz / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const a = this.grid.get(this._key(x, z));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const c = a[i];
        if (c.alive && !c._mark) { c._mark = 1; out.push(c); }
      }
    }
    for (let i = 0; i < out.length; i++) out[i]._mark = 0;
    return out;
  }

  /** Axis-separated capsule move. `p` is feet. Returns grounded flag. */
  moveCapsule(p, vel, radius, height, dt) {
    vel.y += this.gravity * dt;
    if (vel.y < -28) vel.y = -28;

    p.x += vel.x * dt;
    this._sep(p, radius, height, 'x');
    p.z += vel.z * dt;
    this._sep(p, radius, height, 'z');

    let grounded = false;
    p.y += vel.y * dt;
    const yHit = this._sepY(p, radius, height, vel.y);
    if (yHit === 'floor') { vel.y = 0; grounded = true; }
    if (yHit === 'ceil') vel.y = Math.min(vel.y, 0);
    if (p.y < this.killY) { p.y = 0.4; vel.set(0, 0, 0); }
    return grounded;
  }

  _sep(p, r, h, axis) {
    const y0 = p.y + 0.08, y1 = p.y + h;
    const list = this.query(p.x - r - 0.5, p.z - r - 0.5, p.x + r + 0.5, p.z + r + 0.5);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.solid) continue;
      if (y1 < c.min.y + 0.02 || y0 > c.max.y - 0.02) continue;
      if (axis === 'x') {
        if (p.z + r <= c.min.z || p.z - r >= c.max.z) continue;
        if (p.x + r > c.min.x && p.x < c.min.x + r + 0.4 && p.x < (c.min.x + c.max.x) * 0.5)
          p.x = c.min.x - r;
        else if (p.x - r < c.max.x && p.x > c.max.x - r - 0.4 && p.x > (c.min.x + c.max.x) * 0.5)
          p.x = c.max.x + r;
      } else {
        if (p.x + r <= c.min.x || p.x - r >= c.max.x) continue;
        if (p.z + r > c.min.z && p.z < c.min.z + r + 0.4 && p.z < (c.min.z + c.max.z) * 0.5)
          p.z = c.min.z - r;
        else if (p.z - r < c.max.z && p.z > c.max.z - r - 0.4 && p.z > (c.min.z + c.max.z) * 0.5)
          p.z = c.max.z + r;
      }
    }
  }

  _sepY(p, r, h, vy) {
    const list = this.query(p.x - r - 0.2, p.z - r - 0.2, p.x + r + 0.2, p.z + r + 0.2);
    let hit = null;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.solid) continue;
      if (p.x + r <= c.min.x || p.x - r >= c.max.x) continue;
      if (p.z + r <= c.min.z || p.z - r >= c.max.z) continue;
      const top = c.max.y;
      const bot = c.min.y;
        if (p.y <= top + 0.18 && p.y >= top - 0.72 && p.y + h > top) {
        p.y = top;
        hit = 'floor';
      } else if (p.y + h > bot && p.y < bot && vy > 0) {
        p.y = bot - h;
        hit = 'ceil';
      } else if (p.y < top && p.y + h > bot) {
        if (p.y + 0.4 > top) { p.y = top; hit = 'floor'; }
        else if (vy > 0) { p.y = bot - h; hit = 'ceil'; }
      }
    }
    return hit;
  }

  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    const steps = Math.ceil(len / 0.7);
    const sx = dx / steps, sy = dy / steps, sz = dz / steps;
    let x = ax, y = ay, z = az;
    for (let i = 1; i < steps; i++) {
      x += sx; y += sy; z += sz;
      const list = this.query(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
      for (let j = 0; j < list.length; j++) {
        const c = list[j];
        if (!c.alive || !c.blocksSight) continue;
        if (x >= c.min.x && x <= c.max.x && y >= c.min.y && y <= c.max.y && z >= c.min.z && z <= c.max.z)
          return false;
      }
    }
    return true;
  }

  groundAt(x, z) {
    const list = this.query(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
    let y = -4;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.solid) continue;
      if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
      if (c.max.y > y && c.max.y < 40) y = c.max.y;
    }
    return y;
  }
}
