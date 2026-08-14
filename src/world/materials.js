import * as THREE from 'three';

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function noise(g, s, a, col) {
  const d = g.getImageData(0, 0, s, s);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (Math.random() - 0.5) * a;
    p[i] = Math.max(0, Math.min(255, p[i] + n * col[0]));
    p[i + 1] = Math.max(0, Math.min(255, p[i + 1] + n * col[1]));
    p[i + 2] = Math.max(0, Math.min(255, p[i + 2] + n * col[2]));
  }
  g.putImageData(d, 0, 0);
}

export function makeMaterials(quality) {
  const woodMap = canvas(512, (g, s) => {
    g.fillStyle = '#3a2416';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const wave = Math.sin(y * 0.085) * 10 + Math.sin(y * 0.31) * 4;
      const shade = 40 + Math.sin(y * 0.04) * 18;
      g.fillStyle = `rgb(${90 + shade * 0.4},${52 + shade * 0.2},${28})`;
      g.fillRect(0, y, s, 1);
      g.strokeStyle = `rgba(20,10,6,${0.12 + (y % 17 === 0 ? 0.25 : 0)})`;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(s, y + wave * 0.15);
      g.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 68, y = 60 + (i * 97) % 380;
      g.fillStyle = 'rgba(28,14,8,0.35)';
      g.beginPath();
      g.ellipse(x, y, 14, 8, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    noise(g, s, 18, [1, 0.7, 0.4]);
  });
  woodMap.repeat.set(2, 2);

  const floorMap = canvas(512, (g, s) => {
    g.fillStyle = '#2a1810';
    g.fillRect(0, 0, s, s);
    const plank = 42;
    for (let y = 0; y < s; y += plank) {
      const hue = 78 + ((y / plank) % 5) * 6;
      g.fillStyle = `rgb(${hue},${hue * 0.58},${hue * 0.32})`;
      g.fillRect(0, y, s, plank - 2);
      g.fillStyle = 'rgba(18,8,4,0.55)';
      g.fillRect(0, y + plank - 2, s, 2);
      for (let x = (y * 3) % 90; x < s; x += 118) {
        g.fillRect(x, y, 2, plank);
      }
      g.fillStyle = 'rgba(255,210,160,0.04)';
      g.fillRect(0, y + 4, s, 3);
    }
    noise(g, s, 14, [1, 0.8, 0.5]);
  });
  floorMap.repeat.set(6, 8);

  const plasterMap = canvas(512, (g, s) => {
    g.fillStyle = '#cfc4b0';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(180,160,140,${0.04 + Math.random() * 0.06})`;
      g.beginPath();
      g.arc(Math.random() * s, Math.random() * s, 20 + Math.random() * 50, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(90,70,50,0.18)';
    g.beginPath();
    g.moveTo(20, 40);
    g.lineTo(80, 200);
    g.lineTo(70, 480);
    g.moveTo(300, 10);
    g.lineTo(340, 160);
    g.stroke();
    noise(g, s, 16, [1, 1, 0.9]);
  });
  plasterMap.repeat.set(2, 2);

  const paperMap = canvas(512, (g, s) => {
    g.fillStyle = '#6e7a62';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 28) {
      g.fillStyle = x % 56 === 0 ? '#5c6752' : '#768266';
      g.fillRect(x, 0, 14, s);
    }
    for (let i = 0; i < 90; i++) {
      const x = (i * 73) % s, y = (i * 119) % s;
      g.fillStyle = 'rgba(190,170,120,0.12)';
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(90,70,40,0.15)';
      g.beginPath();
      g.arc(x, y, 6, 0.2, 2.4);
      g.stroke();
    }
    noise(g, s, 10, [1, 1, 0.8]);
  });
  paperMap.repeat.set(3, 2);

  const paperWarm = canvas(512, (g, s) => {
    g.fillStyle = '#8a6a52';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 36) {
      g.fillStyle = '#7a5c46';
      g.fillRect(x, 0, 4, s);
    }
    for (let y = 0; y < s; y += 48) {
      g.strokeStyle = 'rgba(40,20,10,0.12)';
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(120, y + 8, 280, y - 6, s, y);
      g.stroke();
    }
    noise(g, s, 12, [1, 0.8, 0.6]);
  });
  paperWarm.repeat.set(2.5, 2);

  const brickMap = canvas(256, (g, s) => {
    g.fillStyle = '#2a1c18';
    g.fillRect(0, 0, s, s);
    const bh = 18, bw = 42;
    for (let y = 0, row = 0; y < s; y += bh, row++) {
      const off = (row % 2) * (bw / 2);
      for (let x = -bw; x < s; x += bw) {
        const r = 72 + Math.random() * 30;
        g.fillStyle = `rgb(${r},${r * 0.42},${r * 0.28})`;
        g.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
  });
  brickMap.repeat.set(3, 4);

  const fabricMap = canvas(256, (g, s) => {
    g.fillStyle = '#3a1c22';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      g.fillStyle = y % 8 === 0 ? '#4a2430' : '#32181e';
      g.fillRect(0, y, s, 2);
    }
    noise(g, s, 20, [1, 0.5, 0.5]);
  });
  fabricMap.repeat.set(2, 4);

  const carpetMap = canvas(256, (g, s) => {
    g.fillStyle = '#4a1e1e';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(90,40,30,0.5)';
    for (let i = 12; i < s / 2; i += 10) {
      g.strokeRect(i, i, s - i * 2, s - i * 2);
    }
    noise(g, s, 16, [1, 0.4, 0.3]);
  });

  const rustMap = canvas(256, (g, s) => {
    g.fillStyle = '#2a2420';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(${80 + Math.random() * 40},${40},${20},${0.15})`;
      g.beginPath();
      g.arc(Math.random() * s, Math.random() * s, 4 + Math.random() * 12, 0, 6.3);
      g.fill();
    }
    noise(g, s, 22, [1, 0.8, 0.6]);
  });

  const std = (map, opts = {}) => new THREE.MeshStandardMaterial({
    map,
    roughness: opts.roughness ?? 0.82,
    metalness: opts.metalness ?? 0,
    color: opts.color ?? 0xffffff,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });

  const wood = std(woodMap, { roughness: 0.68, color: 0xe8d0b4 });
  const woodDark = std(woodMap, { roughness: 0.74, color: 0x8a6244 });
  const floor = std(floorMap, { roughness: 0.62, color: 0xd4b08a });
  const plaster = std(plasterMap, { roughness: 0.9, color: 0xf2eadc });
  const wallpaper = std(paperMap, { roughness: 0.88 });
  const wallpaperWarm = std(paperWarm, { roughness: 0.9 });
  const brick = std(brickMap, { roughness: 0.95 });
  const fabric = std(fabricMap, { roughness: 0.9, side: THREE.DoubleSide });
  const carpet = std(carpetMap, { roughness: 0.98 });
  const iron = std(rustMap, { roughness: 0.45, metalness: 0.72, color: 0x9a8a7a });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xb08a4a, roughness: 0.35, metalness: 0.85, emissive: 0x221400, emissiveIntensity: 0.15,
  });
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.28, metalness: 0.05 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8ab0c8,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const glassWarm = new THREE.MeshStandardMaterial({
    color: 0xffd9a0,
    emissive: 0xffc078,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    transparent: true,
    opacity: 0.85,
  });

  const ember = new THREE.MeshStandardMaterial({
    color: 0xff6a20, emissive: 0xff4a10, emissiveIntensity: 2.4, roughness: 0.6,
  });
  const soot = new THREE.MeshStandardMaterial({ color: 0x12100e, roughness: 0.95 });
  const linen = new THREE.MeshStandardMaterial({ color: 0xc8b8a0, roughness: 0.92 });
  const coat = new THREE.MeshStandardMaterial({
    color: 0x2a1618, roughness: 0.86, side: THREE.DoubleSide,
  });
  const lampShade = new THREE.MeshStandardMaterial({
    color: 0xf8e2c0, emissive: 0xffc070, emissiveIntensity: 1.15, roughness: 0.65, side: THREE.DoubleSide,
  });
  const white = new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0908, roughness: 0.9 });

  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0x5a2832, roughness: 0.88, side: THREE.DoubleSide, map: fabricMap,
  });
  curtainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float w = uv.y;
       transformed.x += sin(position.y * 3.4 + uTime * 1.15 + position.x * 2.0) * 0.045 * w;
       transformed.z += sin(position.y * 2.1 + uTime * 0.7) * 0.03 * w;`,
    );
    curtainMat.userData.shader = shader;
  };

  return {
    wood, woodDark, floor, plaster, wallpaper, wallpaperWarm, brick, fabric, carpet,
    iron, brass, porcelain, glass, glassWarm, ember, soot, linen, coat, lampShade, white, black, curtainMat,
    maps: { woodMap, floorMap, plasterMap },
  };
}

export const NIGHT = 0x0a1018;

export function makeSky() {
  const geo = new THREE.SphereGeometry(180, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uStorm: { value: 0.35 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vDir;
      uniform float uTime, uStorm;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p){
        vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(
          mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
          f.z);
      }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y * 0.5 + 0.5;
        vec3 zenith = vec3(0.02, 0.04, 0.08);
        vec3 hor = vec3(0.10, 0.12, 0.18);
        vec3 col = mix(hor, zenith, smoothstep(0.35, 0.92, h));
        col = mix(col, vec3(0.06, 0.08, 0.12), uStorm * 0.5);

        float stars = step(0.992, hash(d * 80.0)) * (0.55 + 0.45 * sin(uTime * 2.0 + hash(d)*6.0));
        col += stars * (1.0 - uStorm) * smoothstep(0.45, 0.9, h);

        vec3 moonDir = normalize(vec3(-0.35, 0.55, 0.4));
        float moon = smoothstep(0.997, 0.9992, dot(d, moonDir));
        col += vec3(0.85, 0.88, 1.0) * moon * 1.4;
        col += vec3(0.25, 0.32, 0.5) * pow(max(dot(d, moonDir), 0.0), 80.0);

        float c = noise(d * 3.2 + vec3(uTime * 0.018, 0.0, uTime * 0.01));
        c = smoothstep(0.48, 0.78, c);
        col = mix(col, vec3(0.08, 0.09, 0.12), c * (0.35 + uStorm * 0.4));

        float flash = pow(max(sin(uTime * 0.37 + 1.2), 0.0), 40.0) * uStorm;
        col += vec3(0.35, 0.4, 0.55) * flash * (1.0 - h);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
