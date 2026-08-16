const top = document.querySelector('.top');
const onScroll = () => top?.classList.toggle('scrolled', window.scrollY > 12);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Subtle magnetic hover on primary CTAs
document.querySelectorAll('.btn.primary').forEach((btn) => {
  btn.addEventListener('pointermove', (e) => {
    const r = btn.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    btn.style.transform = `translate(${x * 4}px, ${y * 3}px)`;
  });
  btn.addEventListener('pointerleave', () => {
    btn.style.transform = '';
  });
});

console.info('Portfolio ready — ASHEN MOUTH + TEMPER');
