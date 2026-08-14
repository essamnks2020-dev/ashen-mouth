import * as THREE from 'three';
import { clamp, damp, dampA, DEG } from '../core/util.js';

export class Player {
  constructor(camera, world) {
    this.cam = camera;
    this.world = world;
    this.pos = new THREE.Vector3(0, 0.45, 38.5);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = -0.12;
    this.radius = 0.32;
    this.height = 1.7;
    this.eye = 1.62;
    this.grounded = true;
    this.crouch = 0;
    this.lanternOn = true;
    this.lanternH = 1;
    this.bob = 0;
    this.stepT = 0;
    this.surface = 'wood';
    this.moved = 0;
    this.fovBase = 68;

    this.lantern = new THREE.PointLight(0xffc078, 1.35, 11, 1.6);
    this.lantern.castShadow = false;
    camera.add(this.lantern);
    this.lantern.position.set(0.22, -0.18, -0.25);

    this.hand = new THREE.Group();
    camera.add(this.hand);
    this.hand.position.set(0.28, -0.32, -0.45);
  }

  attachLanternMesh(mats) {
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 6), mats.brass);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mats.glass);
    flame.position.y = 0.08;
    this.hand.add(cage); this.hand.add(flame);
    this._flame = flame;
  }

  update(dt, input, emitSound) {
    const look = input.look();
    this.yaw -= look.x;
    this.pitch -= look.y;
    this.pitch = clamp(this.pitch, -1.25, 1.25);

    const crouchWant = input.held('ControlLeft') || input.held('ControlRight') || input.held('KeyC') ? 1 : 0;
    this.crouch = damp(this.crouch, crouchWant, 10, dt);
    this.height = lerp(1.7, 1.15, this.crouch);
    this.eye = lerp(1.62, 1.05, this.crouch);

    const slow = input.held('ShiftLeft') || input.held('ShiftRight') || this.crouch > 0.5;
    const speed = slow ? 1.55 : 3.15;

    let ix = 0, iz = 0;
    if (input.held('KeyW') || input.held('ArrowUp')) iz -= 1;
    if (input.held('KeyS') || input.held('ArrowDown')) iz += 1;
    if (input.held('KeyA') || input.held('ArrowLeft')) ix -= 1;
    if (input.held('KeyD') || input.held('ArrowRight')) ix += 1;
    if (input.mobile) { ix += input.touch.moveX; iz += input.touch.moveY; }
    const mag = Math.hypot(ix, iz);
    if (mag > 1) { ix /= mag; iz /= mag; }

    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const wishX = ix * c + iz * s;
    const wishZ = -ix * s + iz * c;
    const accel = this.grounded ? 18 : 4;
    this.vel.x = damp(this.vel.x, wishX * speed, accel, dt);
    this.vel.z = damp(this.vel.z, wishZ * speed, accel, dt);

    if (input.pressed('Space') && this.grounded) {
      this.vel.y = 5.4;
      this.grounded = false;
      emitSound(this.pos, 8, 'land');
    }

    if (input.pressed('KeyF')) this.lanternOn = !this.lanternOn;
    this.lanternH = damp(this.lanternH, this.lanternOn ? 1 : 0.08, 8, dt);
    this.lantern.intensity = 1.45 * this.lanternH;
    this.lantern.distance = 11 * this.lanternH + 2;
    if (this._flame) this._flame.scale.setScalar(0.7 + this.lanternH * 0.6);

    this.grounded = this.world.moveCapsule(this.pos, this.vel, this.radius, this.height, dt);

    const spd = Math.hypot(this.vel.x, this.vel.z);
    this.moved = spd;
    if (this.grounded && spd > 0.4) {
      this.bob += dt * spd * 2.1;
      this.stepT += dt * spd;
      const interval = slow ? 0.62 : 0.38;
      if (this.stepT > interval) {
        this.stepT = 0;
        const power = slow ? 1.6 : 5.5;
        emitSound(this.pos, power, 'step');
      }
    } else this.stepT = 0;

    const bobY = Math.sin(this.bob * 2) * spd * 0.012;
    const bobX = Math.cos(this.bob) * spd * 0.006;
    this.cam.position.set(this.pos.x + bobX, this.pos.y + this.eye + bobY, this.pos.z);
    this.cam.rotation.order = 'YXZ';
    this.cam.rotation.y = this.yaw;
    this.cam.rotation.x = this.pitch;

    this.hand.rotation.z = Math.sin(this.bob) * 0.04;
    this.hand.rotation.x = Math.cos(this.bob * 2) * 0.03;
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
