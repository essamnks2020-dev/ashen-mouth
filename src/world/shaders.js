import * as THREE from 'three';

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main(){
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform float uTime;
  uniform vec3 uSun;

  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
    float n = mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                      mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                  mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                      mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    return n;
  }
  float fbm(vec3 p){
    float a = 0.5; float s = 0.0;
    for(int i=0;i<5;i++){ s += a*noise(p); p = p*2.07 + 13.1; a *= 0.5; }
    return s;
  }

  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;

    // Wine dusk into brass-low horizon. The sun is too heavy, too still.
    vec3 zenith = vec3(0.07, 0.05, 0.08);
    vec3 mid    = vec3(0.22, 0.10, 0.09);
    vec3 horz   = vec3(0.55, 0.32, 0.14);
    vec3 sea    = vec3(0.04, 0.05, 0.06);
    vec3 col = mix(horz, mid, smoothstep(-0.05, 0.25, h));
    col = mix(col, zenith, smoothstep(0.18, 0.72, h));
    col = mix(sea, col, smoothstep(-0.35, 0.02, h));

    // Brass aurora — bands that barely crawl. Wrong weather.
    float bands = sin(d.x * 7.0 + d.z * 3.0 + uTime * 0.04) * 0.5 + 0.5;
    bands *= sin(d.x * 2.4 - d.z * 5.0 + 1.7);
    float aurora = pow(max(bands, 0.0), 3.0) * smoothstep(0.05, 0.45, h) * smoothstep(0.85, 0.35, h);
    aurora *= 0.55 + 0.45 * fbm(d * 3.0 + vec3(0.0, uTime * 0.015, 0.0));
    vec3 brass = vec3(0.78, 0.58, 0.22);
    vec3 sick  = vec3(0.42, 0.48, 0.22);
    col += mix(brass, sick, fbm(d * 2.0)) * aurora * 0.85;

    // Still clouds — almost frozen fbm sheets
    float cl = fbm(d * 4.5 + vec3(uTime * 0.008, 0.0, uTime * 0.003));
    cl = smoothstep(0.48, 0.72, cl) * smoothstep(0.02, 0.4, h);
    col = mix(col, vec3(0.36, 0.26, 0.20) * 1.15, cl * 0.55);

    // Brass disc — a sun that forgot to set
    float sun = pow(max(dot(d, normalize(uSun)), 0.0), 180.0);
    float glow = pow(max(dot(d, normalize(uSun)), 0.0), 12.0);
    col += vec3(1.0, 0.72, 0.32) * sun * 1.4;
    col += vec3(0.85, 0.45, 0.18) * glow * 0.35;

    // Salt haze at the horizon
    col = mix(col, vec3(0.62, 0.50, 0.34), pow(1.0 - abs(h), 8.0) * 0.35);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const SEA_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vW;
  uniform float uTime;
  void main(){
    vUv = uv;
    vec3 p = position;
    float w1 = sin(p.x * 0.08 + uTime * 0.11) * 0.08;
    float w2 = sin(p.z * 0.11 + uTime * 0.07) * 0.05;
    p.y += w1 + w2;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const SEA_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  varying vec3 vW;
  uniform float uTime;
  uniform vec3 uCam;
  void main(){
    vec3 N = normalize(vec3(
      sin(vW.x * 0.08 + uTime * 0.11) * 0.15,
      1.0,
      sin(vW.z * 0.11 + uTime * 0.07) * 0.12
    ));
    vec3 V = normalize(uCam - vW);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 deep = vec3(0.03, 0.04, 0.05);
    vec3 brass = vec3(0.42, 0.28, 0.12);
    vec3 col = mix(deep, brass, fres * 0.75);
    float foam = smoothstep(0.62, 0.9, sin(vW.x * 0.4 + vW.z * 0.15) * 0.5 + 0.5);
    col += vec3(0.55, 0.48, 0.38) * foam * 0.08;
    float dist = length(uCam - vW);
    col = mix(col, vec3(0.18, 0.12, 0.08), smoothstep(40.0, 160.0, dist));
    gl_FragColor = vec4(col, 0.94);
  }
`;

export function makeSky() {
  const geo = new THREE.SphereGeometry(400, 32, 20);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0.35, 0.08, 0.6).normalize() },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function makeSea() {
  const geo = new THREE.PlaneGeometry(280, 280, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -1.15;
  mesh.position.z = 70;
  return mesh;
}

function patchTriplanar(mat, opts) {
  mat.userData.uSalt = { value: opts.salt ?? 0.15 };
  mat.userData.uScale = { value: opts.scale ?? 2.4 };
  mat.userData.uWet = { value: opts.wet ?? 0.35 };
  mat.userData.uHex = { value: opts.hex ?? 0.0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSalt = mat.userData.uSalt;
    shader.uniforms.uScale = mat.userData.uScale;
    shader.uniforms.uWet = mat.userData.uWet;
    shader.uniforms.uHex = mat.userData.uHex;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform float uSalt, uScale, uWet, uHex;
        float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n2(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p); f*=f*(3.0-2.0*f);
          return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y);
        }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 n = normalize(vWNrm);
        vec3 bp = vWPos * uScale;
        float grime = n2(bp.xz) * abs(n.y) + n2(bp.xy) * abs(n.z) + n2(bp.yz) * abs(n.x);
        diffuseColor.rgb *= mix(0.72, 1.08, grime);
        // hexagonal suggestion on vertical basalt
        if (uHex > 0.01) {
          vec2 h = vWPos.xz * 0.55;
          float hex = abs(fract(h.x * 0.866 + h.y * 0.5) - 0.5);
          hex = min(hex, abs(fract(h.y) - 0.5));
          diffuseColor.rgb *= 1.0 - smoothstep(0.02, 0.06, hex) * 0.18 * uHex;
        }
        float salt = pow(n2(vWPos.xz * 3.4), 4.0) * uSalt * (0.4 + 0.6 * abs(n.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.78, 0.70), salt);
        roughnessFactor = clamp(roughnessFactor - uWet * 0.35 + salt * 0.4, 0.08, 1.0);
      `);
  };
  return mat;
}

export function makeMaterials() {
  const basalt = patchTriplanar(new THREE.MeshStandardMaterial({
    color: 0x2a2420, roughness: 0.82, metalness: 0.08, flatShading: false,
  }), { salt: 0.22, scale: 1.6, wet: 0.4, hex: 1 });

  const basaltDark = patchTriplanar(new THREE.MeshStandardMaterial({
    color: 0x161310, roughness: 0.88, metalness: 0.04,
  }), { salt: 0.1, scale: 1.1, wet: 0.2, hex: 0.6 });

  const wood = patchTriplanar(new THREE.MeshStandardMaterial({
    color: 0x5a4632, roughness: 0.78, metalness: 0.0,
  }), { salt: 0.35, scale: 3.2, wet: 0.15, hex: 0 });

  const woodPale = patchTriplanar(new THREE.MeshStandardMaterial({
    color: 0x8a7a62, roughness: 0.72, metalness: 0.0,
  }), { salt: 0.5, scale: 4.0, wet: 0.1, hex: 0 });

  const brass = new THREE.MeshStandardMaterial({
    color: 0x8a6a38, roughness: 0.38, metalness: 0.86,
    emissive: 0x2a1a08, emissiveIntensity: 0.15,
  });
  const brassBright = new THREE.MeshStandardMaterial({
    color: 0xb08a48, roughness: 0.28, metalness: 0.92,
    emissive: 0x6a4a18, emissiveIntensity: 0.35,
  });

  const salt = patchTriplanar(new THREE.MeshStandardMaterial({
    color: 0xd4cbb8, roughness: 0.55, metalness: 0.05,
  }), { salt: 0.8, scale: 5.0, wet: 0.05, hex: 0 });

  const cloth = new THREE.MeshStandardMaterial({
    color: 0x4a3028, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide,
  });
  const clothFade = new THREE.MeshStandardMaterial({
    color: 0x6a5040, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
  });

  const glass = new THREE.MeshStandardMaterial({
    color: 0xffc978, roughness: 0.25, metalness: 0.1,
    emissive: 0xffb24a, emissiveIntensity: 1.4, transparent: true, opacity: 0.92,
  });

  const candle = new THREE.MeshStandardMaterial({
    color: 0xffe2a0, emissive: 0xffc66a, emissiveIntensity: 2.2,
  });

  const mural = new THREE.MeshStandardMaterial({
    color: 0x3a2a20, roughness: 0.7, metalness: 0.05,
    emissive: 0x3a2810, emissiveIntensity: 0.12,
  });

  const saintBody = patchTriplanar(new THREE.MeshStandardMaterial({
    color: 0x1c1814, roughness: 0.55, metalness: 0.22,
    emissive: 0x1a1208, emissiveIntensity: 0.2,
  }), { salt: 0.45, scale: 2.8, wet: 0.55, hex: 1.2 });

  const saintMouth = new THREE.MeshStandardMaterial({
    color: 0x0a0604, roughness: 0.35, metalness: 0.1,
    emissive: 0x4a2a10, emissiveIntensity: 0.8, side: THREE.DoubleSide,
  });

  const saintBrass = new THREE.MeshStandardMaterial({
    color: 0x9a7438, roughness: 0.32, metalness: 0.9,
    emissive: 0x5a3a10, emissiveIntensity: 0.55,
  });

  const black = new THREE.MeshStandardMaterial({ color: 0x080604, roughness: 0.9, metalness: 0 });

  const rope = new THREE.MeshStandardMaterial({ color: 0x6a5840, roughness: 0.85, metalness: 0 });

  return {
    basalt, basaltDark, wood, woodPale, brass, brassBright, salt, cloth, clothFade,
    glass, candle, mural, saintBody, saintMouth, saintBrass, black, rope,
  };
}

export const FogColor = 0x1c140e;
