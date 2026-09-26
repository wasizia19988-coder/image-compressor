document.addEventListener('DOMContentLoaded', () => {
  const hero = document.getElementById('homeHero');
  if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.VANTA || typeof window.VANTA.BIRDS !== 'function' || !window.THREE) return;

  let birds;
  try {
    birds = window.VANTA.BIRDS({
      el: hero,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1,
      scaleMobile: 1,
      backgroundColor: 0x0b0d14,
      color1: 0xff6b35,
      color2: 0x22d3ee,
      birdSize: 1.2,
      wingSpan: 20,
      speedLimit: 4,
      separation: 55,
      alignment: 45,
      cohesion: 25,
      quantity: 1
    });
  } catch (error) {
    console.error('Homepage bird animation could not be initialized.', error);
    return;
  }

  window.addEventListener('pagehide', () => birds.destroy(), { once: true });
});
