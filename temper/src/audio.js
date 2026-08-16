/**
 * Procedural forge audio — Web Audio only, no assets.
 */

let ctx = null;
let master = null;
let drone = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setHeatDrone(score) {
  const c = ac();
  if (!drone) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filt = c.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    filt.type = 'lowpass';
    filt.frequency.value = 120;
    gain.gain.value = 0;
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(master);
    osc.start();
    drone = { osc, gain, filt };
  }
  const t = c.currentTime;
  const target = score < 8 ? 0 : 0.015 + (score / 100) * 0.07;
  drone.gain.gain.cancelScheduledValues(t);
  drone.gain.gain.linearRampToValueAtTime(target, t + 0.4);
  drone.osc.frequency.linearRampToValueAtTime(48 + score * 0.9, t + 0.4);
  drone.filt.frequency.linearRampToValueAtTime(100 + score * 8, t + 0.4);
}

export function quenchHiss(intensity = 1) {
  const c = ac();
  const len = c.sampleRate * 0.5;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 1200;
  const g = c.createGain();
  g.gain.value = 0.18 * intensity;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start();
}

export function metalTing() {
  const c = ac();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.05);
  osc.frequency.exponentialRampToValueAtTime(660, t + 0.35);
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + 0.45);
}

export function anvilTap() {
  const c = ac();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.value = 180;
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
}

export function copyChime() {
  const c = ac();
  const t = c.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.06);
    g.gain.linearRampToValueAtTime(0.12, t + i * 0.06 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.35);
    osc.connect(g);
    g.connect(master);
    osc.start(t + i * 0.06);
    osc.stop(t + i * 0.06 + 0.4);
  });
}
