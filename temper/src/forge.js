/**
 * Forge atmosphere canvas — embers, heat shimmer, quench steam, thermometer.
 */

export function createForge(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;
  let heat = 0; // 0–100
  let quenching = false;
  let steam = [];
  let embers = [];
  let t0 = performance.now();
  let reduceMotion = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedEmbers() {
    embers = Array.from({ length: 48 }, () => ({
      x: Math.random() * w,
      y: h * 0.55 + Math.random() * h * 0.45,
      r: 0.6 + Math.random() * 2.2,
      vy: -(0.15 + Math.random() * 0.55),
      vx: (Math.random() - 0.5) * 0.25,
      life: Math.random(),
      hue: 20 + Math.random() * 30,
    }));
  }

  function setHeat(score) {
    heat = score;
  }

  function setQuenching(on) {
    quenching = on;
  }

  function setReduceMotion(on) {
    reduceMotion = on;
  }

  function burstSteam(n = 18) {
    for (let i = 0; i < n; i++) {
      steam.push({
        x: w * 0.5 + (Math.random() - 0.5) * w * 0.35,
        y: h * 0.72,
        r: 8 + Math.random() * 28,
        vy: -(0.4 + Math.random() * 1.2),
        vx: (Math.random() - 0.5) * 0.6,
        a: 0.25 + Math.random() * 0.35,
        life: 1,
      });
    }
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    // Charcoal bed
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070605');
    bg.addColorStop(0.45, '#120e0c');
    bg.addColorStop(1, '#1a0f0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Heat glow from below
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.95, 10, w * 0.5, h * 0.7, h * 0.7);
    const a = heat / 100;
    glow.addColorStop(0, `rgba(251, 146, 60, ${0.05 + a * 0.45})`);
    glow.addColorStop(0.4, `rgba(220, 38, 38, ${0.03 + a * 0.22})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Soft vignette
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.4, w * 0.15, w * 0.5, h * 0.5, w * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Embers
    if (!reduceMotion) {
      for (const e of embers) {
        e.x += e.vx + Math.sin(t * 2 + e.y) * 0.05;
        e.y += e.vy * (0.5 + a * 1.4);
        e.life -= 0.002;
        if (e.y < h * 0.2 || e.life <= 0) {
          e.x = Math.random() * w;
          e.y = h * 0.7 + Math.random() * h * 0.3;
          e.life = 1;
        }
        const alpha = e.life * (0.25 + a * 0.75);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${e.hue}, 95%, ${55 + a * 20}%, ${alpha})`;
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Thermometer — right rail
    const tx = w - 36;
    const ty = h * 0.18;
    const th = h * 0.55;
    ctx.fillStyle = 'rgba(28, 25, 23, 0.85)';
    roundRect(ctx, tx - 10, ty - 10, 20, th + 36, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 162, 158, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const fillH = (heat / 100) * th;
    const fg = ctx.createLinearGradient(0, ty + th, 0, ty);
    fg.addColorStop(0, '#67e8f9');
    fg.addColorStop(0.35, '#fbbf24');
    fg.addColorStop(0.7, '#ea580c');
    fg.addColorStop(1, '#ef4444');
    ctx.fillStyle = fg;
    roundRect(ctx, tx - 5, ty + th - fillH, 10, fillH + 8, 5);
    ctx.fill();

    // bulb
    ctx.beginPath();
    ctx.fillStyle = heat > 50 ? '#ef4444' : heat > 25 ? '#f59e0b' : '#22d3ee';
    ctx.arc(tx, ty + th + 14, 11, 0, Math.PI * 2);
    ctx.fill();

    // Quench trough hint glow when quenching
    if (quenching) {
      const qg = ctx.createRadialGradient(w * 0.5, h * 0.82, 20, w * 0.5, h * 0.82, w * 0.4);
      qg.addColorStop(0, 'rgba(34, 211, 238, 0.28)');
      qg.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = qg;
      ctx.fillRect(0, 0, w, h);
      if (!reduceMotion && Math.random() < 0.5) burstSteam(2);
    }

    // Steam particles
    steam = steam.filter((s) => s.life > 0);
    for (const s of steam) {
      s.x += s.vx;
      s.y += s.vy;
      s.r += 0.35;
      s.life -= 0.012;
      s.a *= 0.985;
      ctx.beginPath();
      ctx.fillStyle = `rgba(186, 230, 253, ${s.a * s.life})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Heat shimmer bands
    if (!reduceMotion && heat > 20) {
      ctx.save();
      ctx.globalAlpha = (heat / 100) * 0.08;
      for (let i = 0; i < 4; i++) {
        const y = h * 0.3 + Math.sin(t * 1.5 + i) * 20 + i * 40;
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(0, y, w, 2);
      }
      ctx.restore();
    }
  }

  let raf = 0;
  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  resize();
  seedEmbers();
  raf = requestAnimationFrame(loop);
  window.addEventListener('resize', () => {
    resize();
    seedEmbers();
  });

  return {
    setHeat,
    setQuenching,
    setReduceMotion,
    burstSteam,
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
