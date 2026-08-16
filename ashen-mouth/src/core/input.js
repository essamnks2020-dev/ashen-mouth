export class Input {
  constructor() {
    this.keys = new Set();
    this.down = new Set();
    this.up = new Set();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.locked = false;
    this.clicked = false;
    this.right = false;
    this.sens = 1;
    this.invertY = false;
    this._el = null;
    this.touch = { lookX: 0, lookY: 0, moveX: 0, moveY: 0, lookId: -1, moveId: -1 };
    this.mobile = matchMedia('(pointer: coarse)').matches;
  }

  attach(el) {
    this._el = el;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.up.add(e.code);
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.clicked = true;
      if (e.button === 2) this.right = true;
    });
    el.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.right = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
    addEventListener('blur', () => { this.keys.clear(); this.locked = false; });

    if (this.mobile) this._touch(el);
  }

  _touch(el) {
    const zone = (id, x, y) => {
      if (x < innerWidth * 0.42) {
        this.touch.moveId = id;
        this.touch._mx = x; this.touch._my = y;
      } else {
        this.touch.lookId = id;
        this.touch._lx = x; this.touch._ly = y;
      }
    };
    el.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) zone(t.identifier, t.clientX, t.clientY);
      this.clicked = true;
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.moveId) {
          this.touch.moveX = clampStick((t.clientX - this.touch._mx) / 70);
          this.touch.moveY = clampStick((t.clientY - this.touch._my) / 70);
        }
        if (t.identifier === this.touch.lookId) {
          this.dx += (t.clientX - this.touch._lx) * 1.6;
          this.dy += (t.clientY - this.touch._ly) * 1.6;
          this.touch._lx = t.clientX; this.touch._ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.moveId) {
          this.touch.moveId = -1; this.touch.moveX = 0; this.touch.moveY = 0;
        }
        if (t.identifier === this.touch.lookId) this.touch.lookId = -1;
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  requestLock() {
    if (this.mobile) return;
    this._el?.requestPointerLock?.();
  }
  exitLock() { document.exitPointerLock?.(); }

  held(code) { return this.keys.has(code); }
  pressed(code) { return this.down.has(code); }

  look() {
    const s = 0.0022 * this.sens;
    const x = this.dx * s;
    const y = this.dy * s * (this.invertY ? -1 : 1);
    this.dx = 0; this.dy = 0;
    return { x, y };
  }

  endFrame() {
    this.down.clear();
    this.up.clear();
    this.clicked = false;
    this.wheel = 0;
  }
}

function clampStick(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
