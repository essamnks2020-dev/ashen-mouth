export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpA = (a, b, t) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const dampA = (a, b, lambda, dt) => lerpA(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randn = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};
export const hash = (n) => {
  n = (n * 374761393 + 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
};
export const dist2 = (ax, az, bx, bz) => {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
};
export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function loadSettings() {
  try {
    return Object.assign({
      quality: 'high',
      master: 0.85,
      sfx: 1,
      music: 0.55,
      sens: 1,
      invertY: false,
      mic: true,
      mute: false,
    }, JSON.parse(localStorage.getItem('ashen-mouth') || '{}'));
  } catch {
    return { quality: 'high', master: 0.85, sfx: 1, music: 0.55, sens: 1, invertY: false, mic: true, mute: false };
  }
}
export function saveSettings(s) {
  try { localStorage.setItem('ashen-mouth', JSON.stringify(s)); } catch { /* ignore */ }
}
