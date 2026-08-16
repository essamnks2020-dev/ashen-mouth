/**
 * Harbor atmosphere — fog bands, brass flecks, slow swell.
 */
export function createSea(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flecks = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.3 + Math.random() * 1.4,
    a: 0.08 + Math.random() * 0.35,
    vy: -(0.02 + Math.random() * 0.08),
    brass: Math.random() > 0.55,
  }));
  let t0 = performance.now();

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#040a10');
    bg.addColorStop(0.45, '#071820');
    bg.addColorStop(1, '#020608');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Harbor glow — left horizon
    const g = ctx.createRadialGradient(w * 0.15, h * 0.2, 20, w * 0.2, h * 0.25, w * 0.55);
    g.addColorStop(0, 'rgba(143,184,178,0.12)');
    g.addColorStop(0.45, 'rgba(201,162,74,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Swell bands
    if (!reduce) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 5; i++) {
        const y = h * 0.55 + Math.sin(t * 0.35 + i * 1.1) * 18 + i * 28;
        ctx.fillStyle = i % 2 ? '#8fb8b2' : '#c9a24a';
        ctx.fillRect(0, y, w, 2);
      }
      ctx.restore();
    }

    for (const f of flecks) {
      if (!reduce) {
        f.y += f.vy / 90;
        if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
      }
      ctx.beginPath();
      ctx.fillStyle = f.brass
        ? `rgba(201,162,74,${f.a})`
        : `rgba(143,184,178,${f.a})`;
      ctx.arc(f.x * w, f.y * h, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let raf = 0;
  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  resize();
  addEventListener('resize', resize);
  if (!reduce) raf = requestAnimationFrame(loop);
  else draw(performance.now());

  return {
    destroy() { cancelAnimationFrame(raf); },
  };
}
