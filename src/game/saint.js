import * as THREE from 'three';
import { clamp, clamp01, damp, dampA, lerp, TAU, rand, dist3 } from '../core/util.js';

/**
 * The Listening Saint — a walking organ of basalt.
 * Silhouette: hexagonal column, three stacked mouths, brass radio-halo,
 * phonograph-horn hands. It does not run like a man. It tilts, stamps, inhales.
 */
export class Saint {
  constructor(scene, mats, world, patrol) {
    this.world = world;
    this.patrol = patrol;
    this.pi = 0;
    this.state = 'dormant'; // dormant patrol listen hunt inhale echo pinned bound taking
    this.stateT = 0;
    this.aware = 0;
    this.lastHeard = new THREE.Vector3();
    this.heardKind = '';
    this.pinned = 0;
    this.echoT = 0;
    this.speed = 1.55;
    this.mouthOpen = [0, 0, 0];
    this.listenLean = 0;
    this.haloSpin = 0;
    this.bob = 0;
    this.stepT = 0;
    this.alive = true;
    this.visible = false;
    this.pull = 0;
    this.lastWords = '';
    this.echoPos = new THREE.Vector3();
    this.echoMesh = null;

    this.root = new THREE.Group();
    this.root.position.copy(patrol[0]);
    this.root.visible = false;
    scene.add(this.root);

    this._build(mats);

    this.light = new THREE.PointLight(0xc49a48, 0.4, 8, 2);
    this.light.position.set(0, 2.4, 0.4);
    this.root.add(this.light);

    this.echoMesh = this._makeEcho(mats);
    this.echoMesh.visible = false;
    scene.add(this.echoMesh);
  }

  _build(mats) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.35, 6), mats.saintBody);
    body.position.y = 1.35;
    this.root.add(body);

    // salt beard / barnacle growth
    const salt = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), mats.salt);
    salt.position.set(0.32, 1.7, 0.2);
    this.root.add(salt);

    this.mouths = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.position.set(0, 2.05 - i * 0.42, 0.38);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.16 - i * 0.02, 0.045, 8, 14), mats.saintBrass);
      lip.rotation.x = Math.PI / 2;
      const cave = new THREE.Mesh(new THREE.CircleGeometry(0.13 - i * 0.02, 12), mats.saintMouth);
      cave.position.z = 0.02;
      g.add(lip); g.add(cave);
      this.root.add(g);
      this.mouths.push(g);
    }

    // brass radio halo + antennae
    this.halo = new THREE.Group();
    this.halo.position.y = 2.62;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 20), mats.saintBrass);
    ring.rotation.x = Math.PI / 2;
    this.halo.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.01, 0.55, 4), mats.saintBrass);
      rod.position.set(Math.cos(a) * 0.48, 0.28, Math.sin(a) * 0.48);
      this.halo.add(rod);
    }
    this.root.add(this.halo);

    // arms + horn hands
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.48, 1.7, 0);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 1.15, 5), mats.saintBody);
      limb.rotation.z = side * 0.35;
      limb.position.set(side * 0.28, -0.35, 0.1);
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.05, 0.45, 8, 1, true), mats.saintBrass);
      horn.rotation.x = Math.PI / 2;
      horn.position.set(side * 0.55, -0.85, 0.28);
      arm.add(limb); arm.add(horn);
      this.root.add(arm);
      this.arms.push({ arm, horn, side });
    }

    // tripod split
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU + 0.4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 0.55, 5), mats.saintBody);
      leg.position.set(Math.cos(a) * 0.28, 0.22, Math.sin(a) * 0.28);
      this.root.add(leg);
    }

    // prayer beads
    this.beads = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), mats.brass ?? mats.saintBrass);
      this.beads.add(b);
    }
    this.root.add(this.beads);
  }

  _makeEcho(mats) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 16), mats.saintMouth);
    m.rotation.x = Math.PI / 2;
    g.add(m);
    g.scale.setScalar(0.01);
    return g;
  }

  wake() {
    if (this.state === 'dormant') {
      this.state = 'patrol';
      this.root.visible = true;
      this.visible = true;
    }
  }

  hear(pos, power, kind, words) {
    if (!this.alive || this.state === 'bound' || this.state === 'taking') return;
    const d = dist3(this.root.position, pos);
    const listenMul = this.state === 'listen' ? 2.4 : 1;
    const fall = power * listenMul / (1 + d * d * 0.018);
    this.aware = Math.min(1, this.aware + fall * 0.08);
    if (fall > 0.35) {
      this.lastHeard.copy(pos);
      this.heardKind = kind;
      if (words) this.lastWords = words;
    }
    if (kind === 'voice' && power > 30) {
      this.aware = 1;
      this._enter('hunt');
    }
    if (fall > 1.2 && this.state === 'patrol') this._enter('listen');
    if (fall > 2.4 && this.state !== 'inhale' && this.state !== 'pinned') this._enter('hunt');
  }

  pin(seconds) {
    if (this.state === 'bound' || this.state === 'taking') return;
    this.pinned = seconds;
    this._enter('pinned');
  }

  _enter(s) {
    this.state = s;
    this.stateT = 0;
  }

  update(dt, player, audio, fx, emitSound) {
    if (!this.alive) return;
    this.stateT += dt;
    this.aware = Math.max(0, this.aware - dt * 0.07);

    if (this.pinned > 0) {
      this.pinned -= dt;
      if (this.pinned <= 0 && this.state === 'pinned') this._enter('listen');
    }

    const p = this.root.position;
    const toP = player.pos.clone().sub(p);
    const dist = toP.length();
    const los = dist < 28 && this.world.los(p.x, p.y + 1.8, p.z, player.pos.x, player.pos.y + 1.2, player.pos.z);

    switch (this.state) {
      case 'dormant':
        break;
      case 'patrol':
        this._patrol(dt, audio);
        if (this.aware > 0.45) this._enter('listen');
        if (los && dist < 7 && player.moved > 1.2) this._enter('listen');
        break;
      case 'listen':
        this.speed = 0;
        if (this.stateT < 0.1) audio.saintListen(p.x, p.y, p.z);
        fx.listen = Math.max(fx.listen, 0.85);
        if (this.stateT > 1.8) {
          if (this.aware > 0.55) this._enter('hunt');
          else if (this.lastWords && this.echoT <= 0 && Math.random() < 0.45) this._enter('echo');
          else this._enter('patrol');
        }
        break;
      case 'hunt':
        this._seek(dt, this.lastHeard, 2.35, audio);
        if (los) this.lastHeard.copy(player.pos);
        if (dist < 4.2 && los) this._enter('inhale');
        if (this.aware < 0.12 && this.stateT > 6) this._enter('patrol');
        fx.hunt = Math.max(fx.hunt, clamp01(1.4 - dist / 16));
        break;
      case 'inhale':
        this.speed = 0;
        this.pull = smoothIn(this.stateT / 1.15);
        fx.stat = Math.max(fx.stat, this.pull * 0.45);
        if (this.stateT < 0.05) audio.inhale(p.x, p.y, p.z);
        if (this.stateT > 1.35) {
          if (dist < 3.4) this._enter('taking');
          else { this.pull = 0; this._enter('hunt'); }
        }
        break;
      case 'echo':
        this._doEcho(dt, audio);
        if (this.stateT > 2.4) this._enter('hunt');
        break;
      case 'pinned':
        this.speed = 0;
        this.pull = 0;
        fx.pin = Math.max(fx.pin, 0.8);
        break;
      case 'bound':
        this.speed = 0;
        this.pull = 0;
        break;
      case 'taking':
        this.speed = 0;
        this.pull = 1;
        fx.taken = Math.max(fx.taken, clamp01(this.stateT / 2.2));
        if (this.stateT < 0.05) audio.taken();
        break;
    }

    this._animate(dt, player);
    if (this.state === 'hunt' || this.state === 'patrol') {
      this.stepT += dt * (this.state === 'hunt' ? 2.2 : 1.3);
      if (this.stepT > 0.7) {
        this.stepT = 0;
        audio.saintStep(p.x, p.y, p.z);
        emitSound(p, this.state === 'hunt' ? 7 : 3.5, 'saint');
      }
    }
  }

  _patrol(dt, audio) {
    if (!this.patrol.length) return;
    const tgt = this.patrol[this.pi % this.patrol.length];
    const gy = this.world.groundAt(tgt.x, tgt.z);
    tgt.y = gy;
    this._seek(dt, tgt, 1.45, audio);
    const d = Math.hypot(this.root.position.x - tgt.x, this.root.position.z - tgt.z);
    if (d < 1.1) this.pi = (this.pi + 1) % this.patrol.length;
  }

  _seek(dt, tgt, spd, audio) {
    const p = this.root.position;
    const gx = tgt.x - p.x, gz = tgt.z - p.z;
    const d = Math.hypot(gx, gz) + 1e-5;
    const vx = gx / d * spd, vz = gz / d * spd;
    const ny = this.world.groundAt(p.x + vx * dt, p.z + vz * dt);
    p.x += vx * dt;
    p.z += vz * dt;
    p.y = damp(p.y, ny, 8, dt);
    const yaw = Math.atan2(gx, gz);
    this.root.rotation.y = dampA(this.root.rotation.y, yaw, 4, dt);
    this.speed = spd;
  }

  _doEcho(dt, audio) {
    if (this.stateT < 0.05) {
      const a = rand(0, TAU);
      this.echoPos.set(
        this.root.position.x + Math.cos(a) * 7,
        this.root.position.y + 1.4,
        this.root.position.z + Math.sin(a) * 7,
      );
      this.echoMesh.position.copy(this.echoPos);
      this.echoMesh.visible = true;
      audio.echoVoice(this.echoPos.x, this.echoPos.y, this.echoPos.z);
    }
    const s = Math.sin(this.stateT / 2.4 * Math.PI);
    this.echoMesh.scale.setScalar(0.2 + s * 1.4);
    this.echoMesh.rotation.y += dt * 1.2;
    if (this.stateT > 2.3) this.echoMesh.visible = false;
  }

  _animate(dt, player) {
    const listen = this.state === 'listen' ? 1 : 0;
    const hunt = this.state === 'hunt' || this.state === 'inhale' ? 1 : 0;
    const attack = this.state === 'inhale' || this.state === 'taking' ? 1 : 0;
    const pin = this.state === 'pinned' ? 1 : 0;
    const bound = this.state === 'bound' ? 1 : 0;

    this.listenLean = damp(this.listenLean, listen * 0.28 - attack * 0.15, 6, dt);
    this.root.rotation.x = this.listenLean;

    this.haloSpin += dt * (0.4 + listen * 3.5 + hunt * 1.2);
    this.halo.rotation.y = this.haloSpin;
    this.halo.rotation.z = Math.sin(this.haloSpin * 0.7) * 0.08;

    const openT = attack ? 1 : hunt ? 0.45 : listen ? 0.12 : pin ? 0.05 : bound ? 0 : 0.04;
    for (let i = 0; i < 3; i++) {
      this.mouthOpen[i] = damp(this.mouthOpen[i], openT * (1 - i * 0.12), 5, dt);
      const o = this.mouthOpen[i];
      this.mouths[i].scale.set(1 + o * 0.55, 1 + o * 0.2, 1 + o * 0.8);
      this.mouths[i].position.z = 0.38 + o * 0.08;
    }

    this.bob += dt * (this.speed > 0.2 ? this.speed : 0.6);
    this.root.children[0].position.y = 1.35 + Math.sin(this.bob * 2) * 0.03;

    for (const a of this.arms) {
      const raise = listen * 0.9 + attack * 0.5;
      a.arm.rotation.x = damp(a.arm.rotation.x, -raise, 5, dt);
      a.arm.rotation.z = a.side * (0.15 + Math.sin(this.bob + a.side) * 0.12 * (this.speed > 0.3 ? 1 : 0.2));
    }

    for (let i = 0; i < this.beads.children.length; i++) {
      const t = i / 9;
      const b = this.beads.children[i];
      b.position.set(
        Math.sin(this.haloSpin + t * 4) * 0.15,
        2.35 - t * 0.85,
        0.35 + Math.cos(this.haloSpin * 0.5 + t) * 0.08,
      );
    }

    this.light.intensity = 0.25 + listen * 0.8 + attack * 1.4 + Math.sin(this.haloSpin * 3) * 0.08;

    if (this.state === 'bound') {
      this.root.scale.y = damp(this.root.scale.y, 0.72, 1.2, dt);
      this.root.rotation.x = damp(this.root.rotation.x, 0.4, 1, dt);
    }
  }

  bind() {
    this._enter('bound');
    this.alive = true;
  }
}

function smoothIn(t) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}
