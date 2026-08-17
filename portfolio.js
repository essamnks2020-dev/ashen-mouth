/**
 * Portfolio atmosphere + interaction layer (v3)
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

const top = document.querySelector('.top');
const onScroll = () => top?.classList.toggle('scrolled', scrollY > 16);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* Reveal */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) e.target.classList.add('in');
}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

/* Custom cursor */
const cur = document.getElementById('cursor');
if (cur && fine && !reduce) {
  document.body.classList.add('has-cursor');
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; cur.classList.add('on'); });
  const loop = () => {
    x += (tx - x) * 0.25;
    y += (ty - y) * 0.25;
    cur.style.left = `${x}px`;
    cur.style.top = `${y}px`;
    requestAnimationFrame(loop);
  };
  loop();
  document.querySelectorAll('[data-cursor], .btn, a.project-visual').forEach((el) => {
    el.addEventListener('pointerenter', () => {
      cur.classList.add('big');
      cur.dataset.label = el.dataset.cursor || 'Go';
    });
    el.addEventListener('pointerleave', () => {
      cur.classList.remove('big');
      cur.dataset.label = '';
    });
  });
}

/* Magnetic buttons */
if (fine && !reduce) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `translate(${dx * 12}px, ${dy * 9}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* Parallax brand on scroll */
const brand = document.querySelector('.brand-lockup');
const plane = document.querySelector('.hero-plane');
if (brand && !reduce) {
  addEventListener('scroll', () => {
    const y = Math.min(120, scrollY * 0.22);
    brand.style.transform = `translateY(${y * 0.35}px)`;
    if (plane) plane.style.opacity = String(Math.max(0.35, 1 - scrollY / 700));
  }, { passive: true });
}

/* Atmosphere canvas — denser embers + quench sparks + mouse wake */
const canvas = document.getElementById('atmos');
if (canvas && !reduce) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let mx = 0.5, my = 0.35;
  const parts = Array.from({ length: 88 }, () => ({
    x: Math.random(), y: Math.random(),
    r: 0.35 + Math.random() * 2.1,
    vy: -(0.04 + Math.random() * 0.28),
    vx: (Math.random() - 0.5) * 0.1,
    a: 0.12 + Math.random() * 0.5,
    hue: Math.random() > 0.68 ? 175 : 18 + Math.random() * 28,
  }));
  addEventListener('pointermove', (e) => {
    mx = e.clientX / innerWidth;
    my = e.clientY / innerHeight;
  }, { passive: true });
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * mx, h * my * 0.6, 20, w * mx, h * my * 0.6, w * 0.55);
    g.addColorStop(0, 'rgba(232,93,4,0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (const p of parts) {
      p.vx += (mx - 0.5) * 0.0004;
      p.x += p.vx / 100;
      p.y += p.vy / 80;
      if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); p.vx = (Math.random() - 0.5) * 0.1; }
      if (p.x < -0.05) p.x = 1.05;
      if (p.x > 1.05) p.x = -0.05;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 92%, 58%, ${p.a})`;
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  };
  tick();
}

console.info('Portfolio v3 — brand-first atmosphere online');
