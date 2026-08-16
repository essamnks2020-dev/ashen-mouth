/**
 * Harbor atmosphere v2 — horizon glow, swell, fog banks, brass flecks, beacon.
 */
export function createSea(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flecks = Array.from({ length: 72 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.25 + Math.random() * 1.6,
    a: 0.06 + Math.random() * 0.4,
    vy: -(0.015 + Math.random() * 0.1),
    vx: (Math.random() - 0.5) * 0.04,
    brass: Math.random() > 0.5,
  }));
  let t0 = performance.now();
  let mx = 0.3, my = 0.35;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  addEventListener('pointermove', (e) => {
    mx = e.clientX / w;
    my = e.clientY / h;
  }, { passive: true });

  function draw(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#030910');
    bg.addColorStop(0.4, '#071820');
    bg.addColorStop(0.75, '#0a1f2a');
    bg.addColorStop(1, '#02060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Horizon band
    const hz = ctx.createLinearGradient(0, h * 0.28, 0, h * 0.55);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(0.5, 'rgba(143,184,178,0.07)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, w, h);

    // Beacon / harbor glow — follows pointer lightly
    const bx = w * (0.18 + mx * 0.12);
    const by = h * (0.18 + my * 0.08);
    const pulse = 0.5 + Math.sin(t * 1.4) * 0.5;
    const g = ctx.createRadialGradient(bx, by, 10, bx, by, w * 0.5);
    g.addColorStop(0, `rgba(201,162,74,${0.1 + pulse * 0.06})`);
    g.addColorStop(0.35, `rgba(143,184,178,${0.08 + pulse * 0.04})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Fog banks
    if (!reduce) {
      for (let i = 0; i < 3; i++) {
        const fx = ((t * (8 + i * 3) + i * 200) % (w + 400)) - 200;
        const fog = ctx.createRadialGradient(fx, h * (0.55 + i * 0.08), 20, fx, h * 0.6, 280);
        fog.addColorStop(0, 'rgba(180,200,198,0.05)');
        fog.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // Swell lines
    if (!reduce) {
      ctx.save();
      for (let i = 0; i < 7; i++) {
        const y = h * 0.52 + Math.sin(t * 0.4 + i * 0.9) * 14 + i * 22;
        ctx.globalAlpha = 0.035 + (i % 2) * 0.02;
        ctx.fillStyle = i % 2 ? '#8fb8b2' : '#c9a24a';
        ctx.fillRect(0, y, w, 1.5);
      }
      ctx.restore();
    }

    for (const f of flecks) {
      if (!reduce) {
        f.x += f.vx / 100;
        f.y += f.vy / 85;
        if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
        if (f.x < -0.05) f.x = 1.05;
        if (f.x > 1.05) f.x = -0.05;
      }
      ctx.beginPath();
      ctx.fillStyle = f.brass
        ? `rgba(201,162,74,${f.a})`
        : `rgba(143,184,178,${f.a})`;
      ctx.arc(f.x * w, f.y * h, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft vignette
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.2, w * 0.5, h * 0.5, w * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
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

  return { destroy() { cancelAnimationFrame(raf); } };
}
