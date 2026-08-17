/**
 * Outset atmosphere — weather-reactive sky, god rays, pollen, rain, dusk.
 */
export function createAtmos(canvas) {
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mode = "inside";
  let weather = "clear";
  let sky = "dawn";
  let t0 = performance.now();

  const motes = Array.from({ length: 64 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.5 + Math.random() * 2.6,
    a: 0.1 + Math.random() * 0.4,
    vy: -(0.008 + Math.random() * 0.045),
    vx: (Math.random() - 0.5) * 0.018,
    hue: Math.random() > 0.5 ? "leaf" : "milk",
  }));

  const rain = Array.from({ length: 110 }, () => ({
    x: Math.random(),
    y: Math.random(),
    len: 0.014 + Math.random() * 0.05,
    sp: 0.01 + Math.random() * 0.024,
  }));

  const leaves = Array.from({ length: 14 }, () => ({
    x: Math.random(),
    y: Math.random(),
    rot: Math.random() * Math.PI,
    sp: 0.00035 + Math.random() * 0.0011,
    sway: 0.25 + Math.random() * 0.8,
    s: 0.7 + Math.random() * 1.1,
  }));

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setMode(m) { mode = m; }
  function setWeather(c) {
    weather = typeof c === "string" ? c : c?.condition || c?.code || "clear";
  }
  function setSky(s) { if (s) sky = s; }

  function palette() {
    const rainy = weather === "rain" || weather === "storm";
    if (rainy) {
      return { a: "#d7e0d8", b: "#c3d0c6", c: "#9bb0a0", sun: [170, 190, 180], sage: [90, 120, 105] };
    }
    if (sky === "night") {
      return { a: "#1c2a22", b: "#24352b", c: "#1a241e", sun: [255, 214, 140], sage: [70, 100, 85] };
    }
    if (sky === "dusk") {
      return { a: "#f3d9c2", b: "#e8c9b0", c: "#c9b49a", sun: [255, 170, 110], sage: [90, 110, 90] };
    }
    if (sky === "dawn") {
      return { a: "#ffe9c8", b: "#f6efe0", c: "#dce8da", sun: [255, 220, 150], sage: [110, 150, 120] };
    }
    return { a: "#fbf8f2", b: "#f3efe6", c: "#e4eee4", sun: [255, 236, 190], sage: [110, 150, 120] };
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    const pulse = 0.5 + Math.sin(t * 0.5) * 0.5;
    const pal = palette();
    const rainy = weather === "rain" || weather === "storm";
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, pal.a);
    bg.addColorStop(0.48, pal.b);
    bg.addColorStop(1, pal.c);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const open = mode === "open" ? 1 : mode === "ritual" ? 0.7 + Math.sin(t * 0.65) * 0.1 : 0.48 + pulse * 0.1;
    const lx = w * 0.52;
    const ly = h * 0.28;

    const sun = ctx.createRadialGradient(lx + w * 0.08, ly * 0.55, 6, lx, ly, w * (0.42 + open * 0.22));
    const [sr, sg, sb] = pal.sun;
    sun.addColorStop(0, `rgba(${sr},${sg},${sb},${0.62 + open * 0.28})`);
    sun.addColorStop(0.38, `rgba(${sr},${sg},${sb},${0.18 + open * 0.12})`);
    sun.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    // god rays
    if (!rainy && sky !== "night") {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.translate(lx + 30, ly - 20);
      ctx.rotate(-0.18);
      for (let i = 0; i < 7; i++) {
        ctx.rotate(0.09);
        ctx.fillStyle = `rgba(255, 244, 210, ${0.035 + open * 0.04})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-40 - i * 8, h);
        ctx.lineTo(28 + i * 6, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const sage = ctx.createRadialGradient(w * 0.8, h * 0.82, 10, w * 0.8, h * 0.82, w * 0.58);
    const [gr, gg, gb] = pal.sage;
    sage.addColorStop(0, `rgba(${gr},${gg},${gb},${0.14 + open * 0.1})`);
    sage.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.fillStyle = sage;
    ctx.fillRect(0, 0, w, h);

    // doorway
    ctx.save();
    ctx.globalAlpha = 0.16 + open * 0.18;
    ctx.strokeStyle = sky === "night" ? "#cfe0d2" : "#3f6b4f";
    ctx.lineWidth = 2;
    const dw = Math.min(220, w * 0.24);
    const dh = Math.min(380, h * 0.52);
    const dx = lx - dw / 2;
    const dy = ly - dh * 0.12;
    ctx.beginPath();
    ctx.moveTo(dx, dy + dh);
    ctx.lineTo(dx, dy + dw * 0.38);
    ctx.arc(lx, dy + dw * 0.38, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw, dy + dh);
    ctx.stroke();
    if (mode === "open") {
      const glow = ctx.createLinearGradient(lx, dy, lx, dy + dh);
      glow.addColorStop(0, "rgba(255, 236, 180, 0.35)");
      glow.addColorStop(1, "rgba(255, 236, 180, 0)");
      ctx.fillStyle = glow;
      ctx.fill();
    }
    ctx.restore();

    if (!reduce) {
      for (const m of motes) {
        m.x += m.vx / 60;
        m.y += m.vy / 55;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        ctx.beginPath();
        ctx.fillStyle = m.hue === "leaf"
          ? `rgba(95,140,105,${m.a * open * (0.55 + pulse * 0.4)})`
          : `rgba(255,250,230,${m.a * open})`;
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const L of leaves) {
        L.y += L.sp;
        L.x += Math.sin(t * L.sway + L.rot) * 0.00085;
        L.rot += 0.01;
        if (L.y > 1.12) { L.y = -0.06; L.x = Math.random(); }
        ctx.save();
        ctx.translate(L.x * w, L.y * h);
        ctx.rotate(L.rot);
        ctx.globalAlpha = 0.22 * open;
        ctx.fillStyle = "#5f8a6e";
        ctx.beginPath();
        ctx.ellipse(0, 0, 6 * L.s, 2.4 * L.s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (rainy) {
        ctx.save();
        ctx.globalAlpha = 0.32 + open * 0.18;
        ctx.strokeStyle = "#6a8a7c";
        ctx.lineWidth = 1.15;
        for (const r of rain) {
          r.y += r.sp * (weather === "storm" ? 1.45 : 1);
          r.x -= 0.0007;
          if (r.y > 1.1) { r.y = -0.05; r.x = Math.random(); }
          ctx.beginPath();
          ctx.moveTo(r.x * w, r.y * h);
          ctx.lineTo(r.x * w - 3, r.y * h + r.len * h);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.38, w * 0.18, w * 0.5, h * 0.5, w * 0.88);
    vig.addColorStop(0, "rgba(251,248,242,0)");
    vig.addColorStop(1, sky === "night" ? "rgba(10,16,12,0.55)" : "rgba(180, 200, 185, 0.32)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  let raf = 0;
  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  resize();
  addEventListener("resize", resize);
  if (!reduce) raf = requestAnimationFrame(loop);
  else draw(performance.now());

  return {
    setMode,
    setWeather,
    setSky,
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    },
  };
}
