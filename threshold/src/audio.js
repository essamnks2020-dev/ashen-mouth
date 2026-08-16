let ctx;
let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    unlocked = true;
  } catch {
    /* ignore */
  }
}

function tone(freq, dur, type = "sine", gain = 0.03) {
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
  tone(340, 0.045, "sine", 0.022);
}

export function checkOn() {
  unlockAudio();
  tone(520, 0.07, "triangle", 0.032);
  setTimeout(() => tone(660, 0.05, "sine", 0.018), 50);
}

export function doorOpen() {
  unlockAudio();
  tone(160, 0.28, "sine", 0.045);
  setTimeout(() => tone(220, 0.3, "triangle", 0.038), 110);
  setTimeout(() => tone(330, 0.4, "sine", 0.028), 240);
  setTimeout(() => tone(440, 0.5, "sine", 0.016), 400);
}

export function play(name) {
  if (name === "check") checkOn();
  else if (name === "door") doorOpen();
  else tap();
}
