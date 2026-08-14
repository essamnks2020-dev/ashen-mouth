import { clamp, clamp01, rand, lerp } from './util.js';

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.ctx = null;
    this.muted = false;
    this.volumes = { master: 0.85, sfx: 1, music: 0.5 };
    this._listener = { x: 0, y: 0, z: 0, fx: 0, fz: -1 };
    this._last = new Map();
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = this.volumes.master;
    this.busSfx = c.createGain(); this.busSfx.gain.value = this.volumes.sfx;
    this.busMusic = c.createGain(); this.busMusic.gain.value = 0;
    this.busUi = c.createGain(); this.busUi.gain.value = 0.8;

    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(2.4, 3.1);
    this.verbSend = c.createGain(); this.verbSend.gain.value = 0.32;
    this.verbReturn = c.createGain(); this.verbReturn.gain.value = 0.55;

    this.busSfx.connect(this.master);
    this.busUi.connect(this.master);
    this.busMusic.connect(this.master);
    this.busSfx.connect(this.verbSend);
    this.verbSend.connect(this.verb);
    this.verb.connect(this.verbReturn);
    this.verbReturn.connect(this.master);
    this.master.connect(c.destination);

    this.noise = this._noise(2);
    this.ready = true;
    this._ambience();
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolume(k, v) {
    this.volumes[k] = v;
    if (!this.ctx) return;
    if (k === 'master') this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.t, 0.05);
    if (k === 'sfx') this.busSfx.gain.value = v;
    if (k === 'music') this.busMusic.gain.value = v;
  }
  setMute(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volumes.master, this.t, 0.08);
  }

  setListener(x, y, z, fx, fz) {
    this._listener = { x, y, z, fx, fz };
  }

  _throttle(key, ms) {
    const n = performance.now();
    if (n - (this._last.get(key) || 0) < ms) return true;
    this._last.set(key, n);
    return false;
  }

  _impulse(sec, decay) {
    const c = this.ctx, n = c.sampleRate * sec;
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }
  _noise(sec) {
    const c = this.ctx, n = c.sampleRate * sec;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _src(buf, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = loop;
    return s;
  }
  _g(v = 1) {
    const g = this.ctx.createGain(); g.gain.value = v; return g;
  }
  _filt(type, f, q = 1) {
    const o = this.ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; o.Q.value = q;
    return o;
  }
  _osc(type, f) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = f;
    return o;
  }

  _spatialize(node, x, y, z, dist = 18) {
    const L = this._listener;
    const dx = x - L.x, dy = y - L.y, dz = z - L.z;
    const d = Math.hypot(dx, dy, dz) + 0.001;
    const att = clamp(1 - d / dist, 0, 1);
    const g = this._g(att * att);
    const p = this.ctx.createStereoPanner();
    const rx = L.fz, rz = -L.fx;
    const side = clamp((dx * rx + dz * rz) / d, -1, 1);
    p.pan.value = side * 0.85;
    node.connect(g); g.connect(p); p.connect(this.busSfx);
    return g;
  }

  _ambience() {
    const c = this.ctx;
    const wind = this._src(this.noise, true);
    const f = this._filt('bandpass', 180, 0.7);
    const g = this._g(0.045);
    wind.connect(f); f.connect(g); g.connect(this.busMusic);
    wind.start();
    this._windG = g; this._windF = f;

    const drone = this._osc('sine', 46);
    const drone2 = this._osc('sine', 92.2);
    const dg = this._g(0.03);
    drone.connect(dg); drone2.connect(dg); dg.connect(this.busMusic);
    drone.start(); drone2.start();
    this._drone = drone; this._drone2 = drone2; this._droneG = dg;

    this.busMusic.gain.setTargetAtTime(this.volumes.music, this.t, 1.4);
  }

  setTension(t) {
    if (!this.ready) return;
    t = clamp01(t);
    this._windF?.frequency.setTargetAtTime(lerp(160, 520, t), this.t, 0.4);
    this._droneG?.gain.setTargetAtTime(lerp(0.03, 0.09, t), this.t, 0.4);
    if (this._drone) this._drone.frequency.setTargetAtTime(lerp(46, 38, t), this.t, 0.5);
  }

  ui() {
    if (!this.ready) return;
    const o = this._osc('triangle', 420);
    const g = this._g(0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.12);
    o.frequency.exponentialRampToValueAtTime(180, this.t + 0.12);
    o.connect(g); g.connect(this.busUi); o.start(); o.stop(this.t + 0.13);
  }

  foot(x, y, z, kind = 'stone', slow = false) {
    if (!this.ready || this._throttle('ft', slow ? 420 : 280)) return;
    const src = this._src(this.noise);
    const f = this._filt('lowpass', kind === 'wood' ? 900 : 420, 0.8);
    const g = this._g(slow ? 0.08 : 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.12);
    src.playbackRate.value = kind === 'wood' ? rand(1.4, 1.8) : rand(0.6, 0.95);
    src.connect(f); f.connect(g);
    this._spatialize(g, x, y, z, 14);
    src.start(); src.stop(this.t + 0.14);
  }

  radioBurst(x, y, z) {
    if (!this.ready) return;
    const src = this._src(this.noise);
    const f = this._filt('bandpass', 1800, 4);
    const g = this._g(0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 1.8);
    src.connect(f); f.connect(g);
    this._spatialize(g, x, y, z, 22);
    src.start(); src.stop(this.t + 1.9);
  }

  vinyl(x, y, z) {
    if (!this.ready) return;
    const src = this._src(this.noise, false);
    const f = this._filt('highpass', 800);
    const g = this._g(0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 4.2);
    src.connect(f); f.connect(g);
    this._spatialize(g, x, y, z, 16);
    src.start(); src.stop(this.t + 4.3);
    const o = this._osc('sine', 196);
    const og = this._g(0.04);
    og.gain.exponentialRampToValueAtTime(0.0001, this.t + 3.5);
    o.connect(og); this._spatialize(og, x, y, z, 16);
    o.start(); o.stop(this.t + 3.6);
  }

  bell(x, y, z) {
    if (!this.ready) return;
    const o = this._osc('sine', 312);
    const o2 = this._osc('sine', 468);
    const g = this._g(0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 2.8);
    o.connect(g); o2.connect(g);
    this._spatialize(g, x, y, z, 40);
    o.start(); o2.start(); o.stop(this.t + 2.9); o2.stop(this.t + 2.9);
  }

  inspect() {
    if (!this.ready) return;
    const o = this._osc('sine', 240);
    const g = this._g(0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.25);
    o.connect(g); g.connect(this.busUi);
    o.start(); o.stop(this.t + 0.26);
  }

  door(x, y, z) {
    if (!this.ready) return;
    const src = this._src(this.noise);
    const f = this._filt('lowpass', 280);
    const g = this._g(0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.7);
    src.connect(f); f.connect(g);
    this._spatialize(g, x, y, z, 20);
    src.start(); src.stop(this.t + 0.72);
  }

  saintStep(x, y, z) {
    if (!this.ready || this._throttle('ss', 380)) return;
    const src = this._src(this.noise);
    const f = this._filt('lowpass', 90, 0.6);
    const g = this._g(0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.28);
    src.connect(f); f.connect(g);
    this._spatialize(g, x, y, z, 36);
    src.start(); src.stop(this.t + 0.3);
  }

  saintListen(x, y, z) {
    if (!this.ready) return;
    const o = this._osc('sine', 74);
    const o2 = this._osc('triangle', 148);
    const g = this._g(0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 2.2);
    o.frequency.linearRampToValueAtTime(110, this.t + 2);
    o.connect(g); o2.connect(g);
    this._spatialize(g, x, y, z, 28);
    o.start(); o2.start(); o.stop(this.t + 2.3); o2.stop(this.t + 2.3);
  }

  inhale(x, y, z) {
    if (!this.ready) return;
    const src = this._src(this.noise);
    const f = this._filt('bandpass', 400, 0.5);
    const g = this._g(0.02);
    g.gain.linearRampToValueAtTime(0.5, this.t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 1.6);
    f.frequency.linearRampToValueAtTime(140, this.t + 1.4);
    src.connect(f); f.connect(g);
    this._spatialize(g, x, y, z, 30);
    src.start(); src.stop(this.t + 1.65);
  }

  echoVoice(x, y, z) {
    if (!this.ready) return;
    const o = this._osc('sawtooth', 90);
    const f = this._filt('lowpass', 600);
    const g = this._g(0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 1.4);
    o.connect(f); f.connect(g);
    this._spatialize(g, x, y, z, 24);
    o.start(); o.stop(this.t + 1.45);
  }

  pin() {
    if (!this.ready) return;
    const o = this._osc('sine', 880);
    const g = this._g(0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.8);
    o.frequency.exponentialRampToValueAtTime(220, this.t + 0.8);
    o.connect(g); g.connect(this.busUi);
    o.start(); o.stop(this.t + 0.82);
  }

  heartbeat(close) {
    if (!this.ready || this._throttle('hb', close ? 520 : 900)) return;
    const o = this._osc('sine', 48);
    const g = this._g(close ? 0.12 : 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.18);
    o.connect(g); g.connect(this.busSfx);
    o.start(); o.stop(this.t + 0.2);
  }

  taken() {
    if (!this.ready) return;
    const src = this._src(this.noise);
    const f = this._filt('bandpass', 900, 2);
    const g = this._g(0.35);
    g.gain.linearRampToValueAtTime(0.5, this.t + 2);
    src.connect(f); f.connect(g); g.connect(this.busSfx);
    src.start(); src.stop(this.t + 4);
  }

  bindChime() {
    if (!this.ready) return;
    [196, 247, 294, 392].forEach((f, i) => {
      const o = this._osc('sine', f);
      const g = this._g(0);
      g.gain.setValueAtTime(0, this.t + i * 0.35);
      g.gain.linearRampToValueAtTime(0.08, this.t + i * 0.35 + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, this.t + i * 0.35 + 2.2);
      o.connect(g); g.connect(this.busMusic);
      o.start(this.t + i * 0.35); o.stop(this.t + i * 0.35 + 2.3);
    });
  }

  speakPuff(loud) {
    if (!this.ready) return;
    const src = this._src(this.noise);
    const f = this._filt('bandpass', loud ? 700 : 1400, 1);
    const g = this._g(loud ? 0.12 : 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.2);
    src.connect(f); f.connect(g); g.connect(this.busSfx);
    src.start(); src.stop(this.t + 0.22);
  }
}
