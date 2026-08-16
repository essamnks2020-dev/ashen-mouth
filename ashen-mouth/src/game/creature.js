import * as THREE from 'three';
import { damp, dampA, clamp, clamp01, dist2 } from '../core/util.js';

/**
 * The Listener — silhouette of a woman in a housecoat,
 * but the head is an iron grate (the house's mouth).
 */
export class Listener {
  constructor(scene, mats, world, patrol) {
    this.world = world;
    this.patrol = patrol;
    this.pi = 0;
    this.state = 'idle';
    this.aware = 0;
    this.hearT = 0;
    this.huntT = 0;
    this.attackT = 0;
    this.stepT = 0;
    this.phase = 0;
    this.speed = 0;
    this.lastHeard = new THREE.Vector3(-5.2, 0, 2.8);
    this.visible = true;
    this.pull = 0;
    this.wakeT = 0;
    this.woke = false;

    this.root = new THREE.Group();
    this.root.position.set(-5.4, 0, 2.9);
    scene.add(this.root);

    this.hips = new THREE.Group();
    this.hips.position.y = 1.02;
    this.root.add(this.hips);

    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.48, 1.55, 8, 1, true), mats.coat);
    coat.position.y = 0.15;
    coat.castShadow = true;
    this.torso.add(coat);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.32), mats.brick);
    mantel.position.set(0, 0.72, 0.02);
    mantel.castShadow = true;
    this.torso.add(mantel);

    this.lArm = new THREE.Group();
    this.lArm.position.set(-0.48, 0.62, 0);
    this.torso.add(this.lArm);
    const la = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), mats.coat);
    la.position.y = -0.28;
    this.lArm.add(la);
    this.lFore = new THREE.Group();
    this.lFore.position.set(0, -0.58, 0);
    this.lArm.add(this.lFore);
    const lf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), mats.coat);
    lf.position.y = -0.22;
    this.lFore.add(lf);
    const poker = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.55, 5), mats.iron);
    poker.position.set(0, -0.55, 0.05);
    poker.rotation.x = 0.4;
    this.lFore.add(poker);

    this.rArm = new THREE.Group();
    this.rArm.position.set(0.48, 0.62, 0);
    this.torso.add(this.rArm);
    const ra = la.clone();
    this.rArm.add(ra);
    this.rFore = new THREE.Group();
    this.rFore.position.set(0, -0.58, 0);
    this.rArm.add(this.rFore);
    this.rFore.add(lf.clone());
    const tongs = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), mats.iron);
    tongs.position.set(0, -0.52, 0.04);
    this.rFore.add(tongs);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.95, 0.04);
    this.torso.add(this.head);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.22), mats.iron);
    this.head.add(frame);
    this.cavity = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.12), mats.ember);
    this.cavity.position.z = 0.06;
    this.head.add(this.cavity);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.34, 0.025), mats.iron);
      bar.position.set(-0.12 + i * 0.08, 0, 0.12);
      this.head.add(bar);
    }
    this.headLight = new THREE.PointLight(0xff5518, 0.55, 3.2, 2);
    this.headLight.position.set(0, 0, 0.2);
    this.head.add(this.headLight);

    this.lLeg = new THREE.Group();
    this.lLeg.position.set(-0.16, 0, 0.04);
    this.hips.add(this.lLeg);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.16), mats.coat);
    thigh.position.y = -0.26;
    this.lLeg.add(thigh);
    this.lShin = new THREE.Group();
    this.lShin.position.set(0, -0.52, 0);
    this.lLeg.add(this.lShin);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.14), mats.coat);
    shin.position.y = -0.22;
    this.lShin.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.28), mats.soot);
    foot.position.set(0, -0.5, 0.06);
    this.lShin.add(foot);

    this.rLeg = new THREE.Group();
    this.rLeg.position.set(0.16, 0, 0.04);
    this.hips.add(this.rLeg);
    this.rLeg.add(thigh.clone());
    this.rShin = new THREE.Group();
    this.rShin.position.set(0, -0.52, 0);
    this.rLeg.add(this.rShin);
    this.rShin.add(shin.clone());
    this.rShin.add(foot.clone());

    this.yaw = Math.PI * 0.5;
    this.pos = this.root.position;
    this._tmp = new THREE.Vector3();
    this._wish = new THREE.Vector3();
  }

  wake() {
    this.woke = true;
    this.wakeT = 0;
  }

  hear(pos, power, kind, phrase) {
    const d = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
    const reach = power * 1.15;
    if (d > reach) return;
    this.lastHeard.copy(pos);
    this.hearT = 1.8 + power * 0.04;
    this.aware = clamp01(this.aware + power * 0.035);
    if (power > 20 || kind === 'shout') {
      this.state = 'hunt';
      this.huntT = 8;
    } else if (this.state === 'idle' || this.state === 'walk') {
      this.state = 'listen';
    }
  }

  update(dt, player, audio, fx, emitSound) {
    if (!this.woke) {
      this._idleMotion(dt, performance.now() * 0.001);
      this._applyPose(dt, 0);
      this.root.rotation.y = this.yaw;
      return;
    }
    this.wakeT += dt;
    const t = performance.now() * 0.001;
    const p = player.pos;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    this.hearT = Math.max(0, this.hearT - dt);

    if (this.state === 'attack') {
      this.attackT += dt;
      this._attackMotion(dt, t, p);
      if (this.attackT > 1.6) {
        // stay in attack; story handles taken
      }
      this._place(dt);
      return;
    }

    if (d < 1.15 && this.aware > 0.25) {
      this.state = 'attack';
      this.attackT = 0;
      audio?.inhale?.(this.pos.x, this.pos.y, this.pos.z);
      fx.taken = 0.2;
      this._place(dt);
      return;
    }

    if (this.state === 'hunt') {
      this.huntT -= dt;
      this._wish.copy(p);
      this.speed = 1.85;
      if (this.huntT < 0 && d > 6) this.state = 'walk';
      fx.hunt = Math.max(fx.hunt, 0.35);
    } else if (this.state === 'listen') {
      this.speed = 0;
      this._listenMotion(dt, t);
      if (this.hearT <= 0) this.state = 'walk';
      fx.listen = Math.max(fx.listen, 0.55);
      if (this.hearT > 1.55 && audio) audio.saintListen?.(this.pos.x, this.pos.y + 1.8, this.pos.z);
    } else {
      const tgt = this.patrol[this.pi % this.patrol.length];
      this._wish.copy(tgt);
      this.speed = 0.85;
      if (dist2(this.pos.x, this.pos.z, tgt.x, tgt.z) < 1.2) this.pi++;
      this.state = 'walk';
    }

    const dx = this._wish.x - this.pos.x;
    const dz = this._wish.z - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const gy = this.world.groundAt(this.pos.x, this.pos.z);
    if (this.speed > 0.05) {
      this.pos.x += (dx / len) * this.speed * dt;
      this.pos.z += (dz / len) * this.speed * dt;
      this.yaw = dampA(this.yaw, Math.atan2(-dx, -dz), 4, dt);
      this.phase += dt * this.speed * 3.4;
      this.stepT += dt * this.speed;
      if (this.stepT > 0.52) {
        this.stepT = 0;
        audio?.saintStep?.(this.pos.x, gy, this.pos.z);
        emitSound?.(this.pos, 4.5, 'step');
      }
    } else {
      this.phase *= Math.exp(-2 * dt);
    }
    this.pos.y = gy;
    this._applyPose(dt, this.speed);
    this.root.rotation.y = this.yaw;
    this.headLight.intensity = this.state === 'listen' ? 1.1 : this.state === 'hunt' ? 0.9 : 0.45;
    this.cavity.scale.setScalar(this.state === 'listen' ? 1.15 : 1);
  }

  _place() {
    const gy = this.world.groundAt(this.pos.x, this.pos.z);
    this.pos.y = gy;
    this.root.rotation.y = this.yaw;
  }

  _idleMotion(dt, t) {
    this.torso.rotation.y = Math.sin(t * 0.6) * 0.06;
    this.hips.position.y = 1.02 + Math.sin(t * 1.4) * 0.012;
    this.head.rotation.z = Math.sin(t * 0.5) * 0.05;
  }

  _listenMotion(dt, t) {
    this.head.rotation.x = damp(this.head.rotation.x, 0.25, 4, dt);
    this.head.rotation.z = Math.sin(t * 1.2) * 0.12;
    this.torso.rotation.x = damp(this.torso.rotation.x, 0.08, 3, dt);
    this.lArm.rotation.x = damp(this.lArm.rotation.x, -0.4, 3, dt);
  }

  _attackMotion(dt, t, p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    this.yaw = dampA(this.yaw, Math.atan2(-dx, -dz), 8, dt);
    this.torso.rotation.x = damp(this.torso.rotation.x, 0.55, 6, dt);
    this.head.rotation.x = damp(this.head.rotation.x, 0.5, 6, dt);
    this.lArm.rotation.x = damp(this.lArm.rotation.x, -1.4, 7, dt);
    this.rArm.rotation.x = damp(this.rArm.rotation.x, -1.4, 7, dt);
    this.pos.x -= Math.sin(this.yaw) * 0.6 * dt;
    this.pos.z -= Math.cos(this.yaw) * 0.6 * dt;
    this._place();
    this._applyPose(dt, 0);
  }

  _applyPose(dt, spd) {
    const a = this.phase;
    const walk = clamp01(spd / 1.2);
    const lift = Math.max(0, Math.sin(a)) * 0.55 * walk;
    const liftR = Math.max(0, Math.sin(a + Math.PI)) * 0.55 * walk;
    this.lLeg.rotation.x = Math.sin(a) * 0.55 * walk;
    this.rLeg.rotation.x = Math.sin(a + Math.PI) * 0.55 * walk;
    this.lShin.rotation.x = lift * 0.7;
    this.rShin.rotation.x = liftR * 0.7;
    this.lArm.rotation.x = damp(this.lArm.rotation.x, Math.sin(a + Math.PI) * 0.35 * walk - 0.15, 8, dt);
    this.rArm.rotation.x = damp(this.rArm.rotation.x, Math.sin(a) * 0.35 * walk - 0.15, 8, dt);
    this.lFore.rotation.x = 0.25;
    this.rFore.rotation.x = 0.25;
    this.hips.position.y = 1.02 + Math.abs(Math.sin(a)) * 0.04 * walk;
    this.torso.rotation.z = Math.sin(a) * 0.04 * walk;
    if (this.state !== 'listen' && this.state !== 'attack') {
      this.head.rotation.x = damp(this.head.rotation.x, 0, 5, dt);
      this.torso.rotation.x = damp(this.torso.rotation.x, 0, 5, dt);
    }
  }
}
