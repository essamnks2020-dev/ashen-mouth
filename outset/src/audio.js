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
  tone(392, 0.045, "sine", 0.016);
}

export function checkOn() {
  unlockAudio();
  tone(523, 0.07, "triangle", 0.028);
  setTimeout(() => tone(659, 0.09, "sine", 0.02), 50);
  setTimeout(() => tone(784, 0.12, "sine", 0.012), 110);
}

export function doorOpen() {
  unlockAudio();
  tone(196, 0.28, "sine", 0.04);
  setTimeout(() => tone(247, 0.32, "triangle", 0.028), 90);
  setTimeout(() => tone(330, 0.4, "sine", 0.022), 200);
  setTimeout(() => tone(392, 0.5, "sine", 0.016), 340);
  setTimeout(() => tone(523, 0.7, "sine", 0.01), 520);
}

export function whoosh() {
  unlockAudio();
  tone(174, 0.16, "sine", 0.016);
}
