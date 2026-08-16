let ctx;
let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    unlocked = true;
  } catch { /* */ }
}

function tone(freq, dur, type = "sine", gain = 0.028) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function tap() {
  unlockAudio();
  tone(420, 0.04, "sine", 0.018);
}

export function checkOn() {
  unlockAudio();
  tone(560, 0.06, "triangle", 0.03);
  setTimeout(() => tone(720, 0.08, "sine", 0.02), 45);
}

export function doorOpen() {
  unlockAudio();
  tone(220, 0.22, "sine", 0.035);
  setTimeout(() => tone(330, 0.28, "triangle", 0.03), 100);
  setTimeout(() => tone(440, 0.35, "sine", 0.022), 220);
  setTimeout(() => tone(554, 0.45, "sine", 0.014), 380);
}

export function whoosh() {
  unlockAudio();
  tone(180, 0.18, "sine", 0.02);
}
