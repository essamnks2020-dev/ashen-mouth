import * as THREE from 'three';

export class Life {
  constructor(scene, quality) {
    this.quality = quality;
    const n = quality === 'high' ? 18 : quality === 'medium' ? 10 : 0;
    this.moths = [];
    if (n) {
      const geo = new THREE.PlaneGeometry(0.07, 0.035);
      const mat = new THREE.MeshBasicMaterial({ color: 0xd8c8a0, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.frustumCulled = false;
        scene.add(m);
        this.moths.push({
          mesh: m,
          a: Math.random() * 6.28,
          r: 0.18 + Math.random() * 0.35,
          h: 0.05 + Math.random() * 0.25,
          s: 1.4 + Math.random() * 2.2,
        });
      }
    }
    this.lamp = new THREE.Vector3(-3.15, 1.2, 4.6);

    const dustN = quality === 'low' ? 0 : quality === 'high' ? 48 : 24;
    this.dust = null;
    if (dustN) {
      const pos = new Float32Array(dustN * 3);
      for (let i = 0; i < dustN; i++) {
        pos[i * 3] = -5.1 + (Math.random() - 0.5) * 1.2;
        pos[i * 3 + 1] = 0.4 + Math.random() * 2.0;
        pos[i * 3 + 2] = 4.8 + (Math.random() - 0.5) * 1.1;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({
        color: 0xe8d8b8, size: 0.018, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true,
      });
      this.dust = new THREE.Points(g, m);
      this.dust.frustumCulled = false;
      scene.add(this.dust);
      this._dust0 = pos.slice();
    }

    this.breath = null;
    if (quality !== 'low') {
      const g = new THREE.SphereGeometry(0.05, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0, depthWrite: false });
      this.breath = new THREE.Mesh(g, mat);
      this.breath.visible = false;
      scene.add(this.breath);
    }
  }

  update(dt, t, player, zone) {
    const lx = this.lamp.x, ly = this.lamp.y, lz = this.lamp.z;
    for (const m of this.moths) {
      m.a += dt * m.s;
      m.mesh.position.set(
        lx + Math.cos(m.a) * m.r,
        ly + Math.sin(m.a * 1.7) * m.h,
        lz + Math.sin(m.a * 0.9) * m.r * 0.7,
      );
      m.mesh.lookAt(lx, ly, lz);
      m.mesh.rotateY(Math.sin(t * 20 + m.a) * 0.4);
    }
    if (this.dust) {
      const arr = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += dt * 0.04;
        if (arr[i + 1] > 2.5) arr[i + 1] = 0.35;
        arr[i] += Math.sin(t * 0.4 + i) * dt * 0.02;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }
    if (this.breath) {
      const cold = zone === 'cellar';
      this.breath.visible = cold;
      if (cold) {
        const u = (t * 0.35) % 1;
        this.breath.position.copy(player.pos);
        this.breath.position.y += player.eye * 0.92;
        this.breath.position.x -= Math.sin(player.yaw) * 0.25;
        this.breath.position.z -= Math.cos(player.yaw) * 0.25;
        this.breath.scale.setScalar(0.4 + u * 2.2);
        this.breath.material.opacity = cold ? (1 - u) * 0.18 : 0;
      }
    }
  }
}
