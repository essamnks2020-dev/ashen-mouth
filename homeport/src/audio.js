/** Tiny harbor sounds — unlock on first gesture */
let ctx;
let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    unlocked = true;
  } catch { /* ignore */ }
}

function tone(freq, dur, type = 'sine', gain = 0.04) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function landChime() {
  unlockAudio();
  tone(392, 0.12, 'triangle', 0.05);
  setTimeout(() => tone(523, 0.18, 'triangle', 0.045), 90);
  setTimeout(() => tone(659, 0.28, 'sine', 0.035), 180);
}

export function tapSoft() {
  unlockAudio();
  tone(220, 0.05, 'sine', 0.025);
}

export function warnPulse() {
  unlockAudio();
  tone(180, 0.15, 'square', 0.02);
}
