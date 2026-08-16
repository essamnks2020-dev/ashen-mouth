/**
 * Optional breath cooling — mic RMS as "blow on the metal".
 */

let stream = null;
let analyser = null;
let data = null;
let raf = null;
let onLevel = null;

export function isBreathSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export async function startBreath(cb) {
  onLevel = cb;
  if (stream) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      // Breath is mid-level continuous noise; speech spikes higher — soft gate
      const level = Math.max(0, Math.min(1, (rms - 0.02) / 0.12));
      if (onLevel) onLevel(level);
    };
    loop();
    return true;
  } catch {
    stream = null;
    return false;
  }
}

export function stopBreath() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  onLevel = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  analyser = null;
  data = null;
}
