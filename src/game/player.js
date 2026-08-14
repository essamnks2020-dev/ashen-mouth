import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';

export class Player {
  constructor(camera, world) {
    this.cam = camera;
    this.world = world;
    this.pos = new THREE.Vector3(0, 0.05, 4.55);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.04;
    this.radius = 0.28;
    this.height = 1.7;
    this.eye = 1.58;
    this.grounded = true;
    this.crouch = 0;
    this.lanternOn = true;
    this.lanternH = 1;
    this.bob = 0;
    this.stepT = 0;
    this.surface = 'wood';
    this.moved = 0;
    this.fovBase = 68;
    this._eyeSmoothed = 1.58;

    this.lantern = new THREE.SpotLight(0xffe8c8, 1.35, 12, 0.62, 0.5, 1.35);
    this.lantern.castShadow = false;
    camera.add(this.lantern);
    this.lantern.position.set(0.16, -0.1, 0.08);
    this.lantern.target.position.set(0, -0.04, -1);
    camera.add(this.lantern.target);

    this.fill = new THREE.PointLight(0xffe4c0, 0.28, 4.5, 2);
    this.fill.position.set(0, -0.05, 0.15);
    camera.add(this.fill);

    this.hand = new THREE.Group();
    camera.add(this.hand);
    this.hand.position.set(0.26, -0.28, -0.42);
  }

  attachLanternMesh(mats) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.14, 8), mats.iron);
    body.rotation.x = 0.9;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), mats.glassWarm);
    lens.position.set(0, 0.02, -0.08);
    lens.rotation.x = -0.3;
    this.hand.add(body);
    this.hand.add(lens);
    this._flame = lens;
  }

  update(dt, input, emitSound) {
    const look = input.look();
    this.yaw -= look.x;
    this.pitch -= look.y;
    this.pitch = clamp(this.pitch, -1.25, 1.25);

    const crouchWant = input.held('ControlLeft') || input.held('ControlRight') || input.held('KeyC') ? 1 : 0;
    this.crouch = damp(this.crouch, crouchWant, 10, dt);
    this.height = lerp(1.7, 1.18, this.crouch);
    this.eye = lerp(1.58, 1.08, this.crouch);

    const onRamp = this.world.onRamp;
    const slow = input.held('ShiftLeft') || input.held('ShiftRight') || this.crouch > 0.5;
    const speed = onRamp ? (slow ? 1.35 : 2.35) : (slow ? 1.55 : 3.05);

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
    const accel = this.grounded ? 16 : 4;
    this.vel.x = damp(this.vel.x, wishX * speed, accel, dt);
    this.vel.z = damp(this.vel.z, wishZ * speed, accel, dt);

    if (input.pressed('KeyF')) this.lanternOn = !this.lanternOn;
    this.lanternH = damp(this.lanternH, this.lanternOn ? 1 : 0.06, 8, dt);
    this.lantern.intensity = 1.35 * this.lanternH;
    this.lantern.distance = 12 * this.lanternH + 2;
    this.fill.intensity = 0.22 + 0.18 * this.lanternH;
    if (this._flame) this._flame.scale.setScalar(0.7 + this.lanternH * 0.6);

    this.grounded = this.world.moveCapsule(this.pos, this.vel, this.radius, this.height, dt);

    const spd = Math.hypot(this.vel.x, this.vel.z);
    this.moved = spd;
    if (this.grounded && spd > 0.35) {
      this.bob += dt * spd * (this.world.onRamp ? 2.8 : 2.05);
      this.stepT += dt * spd;
      const interval = this.world.onRamp ? 0.34 : (slow ? 0.62 : 0.4);
      if (this.stepT > interval) {
        this.stepT = 0;
        const power = slow ? 1.4 : (this.world.onRamp ? 3.2 : 5.0);
        emitSound(this.pos, power, 'step');
      }
    } else this.stepT = 0;

    const bobY = Math.sin(this.bob * 2) * spd * (this.world.onRamp ? 0.018 : 0.01);
    const bobX = Math.cos(this.bob) * spd * 0.005;
    this._eyeSmoothed = damp(this._eyeSmoothed, this.eye, 14, dt);
    this.cam.position.set(this.pos.x + bobX, this.pos.y + this._eyeSmoothed + bobY, this.pos.z);
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
