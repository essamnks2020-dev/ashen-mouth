/**
 * Outset atmosphere — milky daylight, soft sage haze, pollen motes, gentle rain.
 */
export function createAtmos(canvas) {
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mode = "inside";
  let weather = "clear";
  let t0 = performance.now();

  const motes = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.6 + Math.random() * 2.2,
    a: 0.12 + Math.random() * 0.35,
    vy: -(0.01 + Math.random() * 0.05),
    vx: (Math.random() - 0.5) * 0.02,
    hue: Math.random() > 0.55 ? "leaf" : "milk",
  }));

  const rain = Array.from({ length: 70 }, () => ({
    x: Math.random(),
    y: Math.random(),
    len: 0.012 + Math.random() * 0.04,
    sp: 0.008 + Math.random() * 0.02,
  }));

  const leaves = Array.from({ length: 10 }, () => ({
    x: Math.random(),
    y: Math.random(),
    rot: Math.random() * Math.PI,
    sp: 0.0004 + Math.random() * 0.001,
    sway: 0.3 + Math.random() * 0.7,
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

  function draw(now) {
    const t = (now - t0) / 1000;
    const pulse = 0.5 + Math.sin(t * 0.55) * 0.5;
    ctx.clearRect(0, 0, w, h);

    // milky daylight field
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#fbf8f2");
    bg.addColorStop(0.45, "#f3efe6");
    bg.addColorStop(1, "#e8efe6");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const open = mode === "open" ? 1 : mode === "ritual" ? 0.62 + Math.sin(t * 0.7) * 0.08 : 0.4 + pulse * 0.08;
    const lx = w * 0.5;
    const ly = h * 0.32;
    const rainy = weather === "rain" || weather === "storm";

    // sun / soft skylight
    const sun = ctx.createRadialGradient(lx, ly * 0.7, 8, lx, ly, w * (0.38 + open * 0.2));
    if (rainy) {
      sun.addColorStop(0, `rgba(180, 200, 190, ${0.35 + open * 0.2})`);
      sun.addColorStop(0.5, `rgba(160, 185, 175, ${0.12})`);
    } else {
      sun.addColorStop(0, `rgba(255, 244, 214, ${0.55 + open * 0.25})`);
      sun.addColorStop(0.4, `rgba(220, 235, 210, ${0.22 + open * 0.1})`);
    }
    sun.addColorStop(1, "rgba(251,248,242,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    // sage wash
    const sage = ctx.createRadialGradient(w * 0.78, h * 0.75, 20, w * 0.78, h * 0.75, w * 0.55);
    sage.addColorStop(0, `rgba(110, 150, 120, ${0.1 + open * 0.08})`);
    sage.addColorStop(1, "rgba(110,150,120,0)");
    ctx.fillStyle = sage;
    ctx.fillRect(0, 0, w, h);

    // doorway arch suggestion
    ctx.save();
    ctx.globalAlpha = 0.14 + open * 0.12;
    ctx.strokeStyle = "#5f8a6e";
    ctx.lineWidth = 1.5;
    const dw = Math.min(200, w * 0.22);
    const dh = Math.min(340, h * 0.48);
    const dx = lx - dw / 2;
    const dy = ly - dh * 0.15;
    ctx.beginPath();
    ctx.moveTo(dx, dy + dh);
    ctx.lineTo(dx, dy + dw * 0.35);
    ctx.arc(lx, dy + dw * 0.35, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw, dy + dh);
    ctx.stroke();
    ctx.restore();

    if (!reduce) {
      for (const m of motes) {
        m.x += m.vx / 60;
        m.y += m.vy / 55;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        ctx.beginPath();
        ctx.fillStyle = m.hue === "leaf"
          ? `rgba(95,140,105,${m.a * open * (0.6 + pulse * 0.4)})`
          : `rgba(255,250,235,${m.a * open})`;
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const L of leaves) {
        L.y += L.sp;
        L.x += Math.sin(t * L.sway + L.rot) * 0.0008;
        L.rot += 0.008;
        if (L.y > 1.1) { L.y = -0.05; L.x = Math.random(); }
        ctx.save();
        ctx.translate(L.x * w, L.y * h);
        ctx.rotate(L.rot);
        ctx.globalAlpha = 0.18 * open;
        ctx.fillStyle = "#6a9a78";
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (rainy) {
        ctx.save();
        ctx.globalAlpha = 0.28 + open * 0.15;
        ctx.strokeStyle = "#7a9a8a";
        ctx.lineWidth = 1.1;
        for (const r of rain) {
          r.y += r.sp * (weather === "storm" ? 1.35 : 1);
          r.x -= 0.0006;
          if (r.y > 1.1) { r.y = -0.05; r.x = Math.random(); }
          ctx.beginPath();
          ctx.moveTo(r.x * w, r.y * h);
          ctx.lineTo(r.x * w - 2, r.y * h + r.len * h);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // soft vignette (milk, not black)
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.4, w * 0.2, w * 0.5, h * 0.5, w * 0.85);
    vig.addColorStop(0, "rgba(251,248,242,0)");
    vig.addColorStop(1, "rgba(210, 220, 205, 0.35)");
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
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    },
  };
}
