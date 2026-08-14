import * as THREE from 'three';
import { rand } from '../core/util.js';

export class Motes {
  constructor(scene, count = 80) {
    this.n = count;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this._respawn(i, true);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xd8c9a4, size: 0.045, transparent: true, opacity: 0.55,
      depthWrite: false, sizeAttenuation: true,
    });
    this.pts = new THREE.Points(geo, mat);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.geo = geo;
  }
  _respawn(i, anywhere) {
    this.pos[i * 3] = rand(-16, 16);
    this.pos[i * 3 + 1] = anywhere ? rand(0.5, 18) : rand(12, 20);
    this.pos[i * 3 + 2] = rand(-22, 46);
    this.vel[i * 3] = rand(-0.15, 0.15);
    this.vel[i * 3 + 1] = rand(-0.08, 0.04);
    this.vel[i * 3 + 2] = rand(-0.1, 0.1);
  }
  update(dt, leanToward) {
    for (let i = 0; i < this.n; i++) {
      if (leanToward) {
        this.vel[i * 3] += (leanToward.x - this.pos[i * 3]) * 0.0008;
        this.vel[i * 3 + 2] += (leanToward.z - this.pos[i * 3 + 2]) * 0.0008;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.2) this._respawn(i, false);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class Vortex {
  constructor(scene) {
    const n = 48;
    this.n = n;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc9a44a, size: 0.07, transparent: true, opacity: 0.0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.pts = new THREE.Points(geo, mat);
    this.pts.visible = false;
    scene.add(this.pts);
    this.geo = geo;
    this.mat = mat;
    this.t = 0;
  }
  update(dt, saint) {
    const on = saint.pull > 0.05;
    this.pts.visible = on;
    if (!on) { this.mat.opacity = 0; return; }
    this.t += dt;
    const o = saint.root.position;
    for (let i = 0; i < this.n; i++) {
      const a = this.t * 2.4 + i * 0.7;
      const r = 2.8 * (1 - saint.pull) + 0.2;
      this.pos[i * 3] = o.x + Math.cos(a) * r * (i % 5) * 0.25;
      this.pos[i * 3 + 1] = o.y + 1.2 + Math.sin(a * 0.7) * 0.8;
      this.pos[i * 3 + 2] = o.z + Math.sin(a) * r * (i % 5) * 0.25;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.mat.opacity = saint.pull * 0.7;
  }
}
