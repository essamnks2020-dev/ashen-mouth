import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.12 },
    uGrain: { value: 0.0024 },
    uCA: { value: 0.00018 },
    uListen: { value: 0 },
    uHunt: { value: 0 },
    uTaken: { value: 0 },
    uPin: { value: 0 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uVignette, uGrain, uCA, uListen, uHunt, uTaken, uPin, uFlash;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

    void main(){
      vec2 uv = vUv;
      vec2 toC = uv - 0.5;
      float r = length(toC);

      float ca = uCA * (0.35 + r * 1.8) + uHunt * 0.0015;
      vec2 off = toC * ca * 10.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      col.r = pow(col.r, 0.97);
      col.b = pow(col.b, 1.01);
      col *= vec3(1.04, 1.01, 0.98);

      float g = (hash(uv * uRes * 0.35 + uTime * 8.0) - 0.5) * uGrain;
      col += g;

      float vig = smoothstep(0.45, 1.25, r);
      col *= 1.0 - vig * uVignette;

      col = mix(col, col * vec3(1.08, 0.92, 0.82), uHunt * 0.18);
      col = mix(col, vec3(dot(col, vec3(0.3,0.5,0.2))), uPin * 0.35);
      col = mix(col, vec3(0.04, 0.02, 0.015), uTaken * smoothstep(0.1, 0.7, r));
      col += vec3(1.0, 0.93, 0.8) * uFlash;

      float listenRing = abs(r - fract(uTime * 0.12) * 0.65);
      col += vec3(0.12, 0.07, 0.04) * smoothstep(0.04, 0.0, listenRing) * uListen * 0.35;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = 'high';
    this.listen = 0;
    this.hunt = 0;
    this.taken = 0;
    this.pin = 0;
    this.flash = 0;
    this.stat = 0;
    this._build('high');
  }

  _build(q) {
    const s = new THREE.Vector2();
    this.renderer.getSize(s);
    const pr = this.renderer.getPixelRatio();
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(s.x, s.y);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (q === 'high') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(s.x, s.y), 0.055, 0.32, 0.92);
      this.composer.addPass(this.bloom);
    } else if (q === 'medium') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(s.x, s.y), 0.06, 0.35, 0.92);
      this.composer.addPass(this.bloom);
    } else {
      this.bloom = null;
    }

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    if (q !== 'low') {
      this.fxaa = new ShaderPass(FXAAShader);
      this.fxaa.uniforms.resolution.value.set(1 / (s.x * pr), 1 / (s.y * pr));
      this.composer.addPass(this.fxaa);
    } else this.fxaa = null;
  }

  setQuality(q) {
    this.quality = q;
    this._build(q);
    this.resize();
  }

  resize() {
    const s = new THREE.Vector2();
    this.renderer.getSize(s);
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(s.x, s.y);
    this.grade.uniforms.uRes.value.set(s.x * pr, s.y * pr);
    if (this.fxaa) this.fxaa.uniforms.resolution.value.set(1 / (s.x * pr), 1 / (s.y * pr));
    if (this.bloom) this.bloom.setSize(s.x, s.y);
  }

  update(dt, cam) {
    this.grade.uniforms.uTime.value += dt;
    this.grade.uniforms.uListen.value = this.listen;
    this.grade.uniforms.uHunt.value = this.hunt;
    this.grade.uniforms.uTaken.value = this.taken;
    this.grade.uniforms.uPin.value = this.pin;
    this.grade.uniforms.uFlash.value = this.flash;
    this.listen = THREE.MathUtils.damp(this.listen, 0, 1.2, dt);
    this.hunt = THREE.MathUtils.damp(this.hunt, 0, 0.9, dt);
    this.pin = THREE.MathUtils.damp(this.pin, 0, 1.4, dt);
    this.flash = THREE.MathUtils.damp(this.flash, 0, 6, dt);
    this.camera = cam;
    this.composer.passes[0].camera = cam;
  }

  render() { this.composer.render(); }
}

export function pixelRatioFor(q) {
  const d = window.devicePixelRatio || 1;
  if (q === 'high') return Math.min(d, 1.35);
  if (q === 'medium') return Math.min(d, 1.1);
  return 1;
}
