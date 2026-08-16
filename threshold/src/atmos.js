/**
 * Doorway atmosphere — light spill, dust motes, weather beyond the frame.
 * Full-viewport canvas behind the phone shell.
 */
export function createAtmos(canvas) {
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let dpr = 1;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mode = "inside"; // inside | ritual | open
  let weather = "clear";
  let t0 = performance.now();
  let pulse = 0;

  const dust = Array.from({ length: 56 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.35 + Math.random() * 1.6,
    a: 0.08 + Math.random() * 0.4,
    vy: -(0.015 + Math.random() * 0.09),
    vx: (Math.random() - 0.5) * 0.035,
  }));

  const rain = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random(),
    len: 0.015 + Math.random() * 0.05,
    sp: 0.01 + Math.random() * 0.028,
  }));

  const embers = Array.from({ length: 18 }, () => ({
    x: 0.4 + Math.random() * 0.3,
    y: 0.3 + Math.random() * 0.4,
    r: 0.6 + Math.random() * 1.8,
    life: Math.random(),
    sp: 0.001 + Math.random() * 0.003,
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

  function setMode(m) {
    mode = m;
  }

  function setWeather(c) {
    weather = typeof c === "string" ? c : c?.condition || c?.code || "clear";
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    pulse = 0.5 + Math.sin(t * 0.7) * 0.5;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0806");
    bg.addColorStop(0.45, "#12100c");
    bg.addColorStop(1, "#050403");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const open = mode === "open" ? 1 : mode === "ritual" ? 0.58 + Math.sin(t * 0.85) * 0.1 : 0.32 + pulse * 0.06;
    const lx = w * 0.52;
    const ly = h * 0.4;

    // Warm spill / cool rain spill
    const rainy = weather === "rain" || weather === "storm";
    const glow = ctx.createRadialGradient(lx, ly, 12, lx, ly, w * (0.42 + open * 0.28));
    if (rainy) {
      glow.addColorStop(0, `rgba(150,175,195,${0.1 + open * 0.16})`);
      glow.addColorStop(0.4, `rgba(90,120,140,${0.05 + open * 0.08})`);
    } else {
      glow.addColorStop(0, `rgba(240,190,100,${0.14 + open * 0.22})`);
      glow.addColorStop(0.4, `rgba(200,140,55,${0.05 + open * 0.08})`);
    }
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Soft secondary bloom
    const bloom = ctx.createRadialGradient(lx - 40, ly + 60, 10, lx, ly + 40, w * 0.35);
    bloom.addColorStop(0, `rgba(224,168,74,${0.04 + open * 0.06})`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);

    // Door frame
    ctx.save();
    ctx.globalAlpha = 0.12 + open * 0.14;
    ctx.strokeStyle = rainy ? "#a8c0d0" : "#e8c080";
    ctx.lineWidth = 1.25;
    const dw = Math.min(240, w * 0.26);
    const dh = Math.min(460, h * 0.58);
    const dx = lx - dw * 0.38;
    const dy = ly - dh * 0.42;
    ctx.strokeRect(dx, dy, dw, dh);
    ctx.beginPath();
    ctx.moveTo(dx + dw * 0.5, dy);
    ctx.lineTo(dx + dw * 0.5, dy + dh);
    ctx.stroke();
    // threshold line
    ctx.globalAlpha = 0.08 + open * 0.1;
    ctx.beginPath();
    ctx.moveTo(dx, dy + dh);
    ctx.lineTo(dx + dw, dy + dh);
    ctx.stroke();
    ctx.restore();

    if (!reduce) {
      for (const d of dust) {
        d.x += d.vx / 70;
        d.y += d.vy / 65;
        if (d.y < -0.05) {
          d.y = 1.05;
          d.x = 0.32 + Math.random() * 0.42;
        }
        if (d.x < 0.2 || d.x > 0.85) d.vx *= -1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,220,160,${d.a * open * (0.7 + pulse * 0.3)})`;
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (mode === "open" || mode === "ritual") {
        for (const e of embers) {
          e.life += e.sp;
          if (e.life > 1) {
            e.life = 0;
            e.x = 0.42 + Math.random() * 0.2;
            e.y = 0.35 + Math.random() * 0.25;
          }
          const ey = e.y - e.life * 0.15;
          ctx.beginPath();
          ctx.fillStyle = `rgba(240,180,80,${(1 - e.life) * 0.45 * open})`;
          ctx.arc(e.x * w, ey * h, e.r * (1 - e.life * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (rainy) {
        ctx.save();
        ctx.globalAlpha = 0.22 + open * 0.2;
        ctx.strokeStyle = "#b4c8d4";
        ctx.lineWidth = 1;
        for (const r of rain) {
          r.y += r.sp * (weather === "storm" ? 1.4 : 1);
          r.x -= 0.0008;
          if (r.y > 1.1) {
            r.y = -0.1;
            r.x = Math.random();
          }
          const x = r.x * w;
          const y = r.y * h;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + r.len * h);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (weather === "wind" && !rainy) {
        ctx.save();
        ctx.globalAlpha = 0.08 + open * 0.06;
        ctx.strokeStyle = "#d8c8a8";
        for (let i = 0; i < 8; i++) {
          const yy = ((t * 30 + i * 80) % (h + 40)) - 20;
          ctx.beginPath();
          ctx.moveTo(w * 0.35, yy);
          ctx.bezierCurveTo(w * 0.45, yy + 10, w * 0.55, yy - 8, w * 0.7, yy + 4);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.12, w * 0.5, h * 0.5, w * 0.78);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.62)");
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
