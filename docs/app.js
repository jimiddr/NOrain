const tilt = document.querySelector('[data-tilt]');
const stage = document.querySelector('.machine-stage');
const topbar = document.querySelector('.topbar');

if (topbar) {
  let lastScrollY = window.scrollY;
  let downDistance = 0;
  let upDistance = 0;
  let scrollFrame = 0;

  const updateTopbar = () => {
    const currentScrollY = Math.max(0, window.scrollY);
    const delta = currentScrollY - lastScrollY;

    topbar.classList.toggle('is-scrolled', currentScrollY > 12);

    if (currentScrollY <= 20) {
      topbar.classList.remove('is-hidden');
      downDistance = 0;
      upDistance = 0;
    } else if (delta > 0) {
      downDistance += delta;
      upDistance = 0;
      if (downDistance >= 14) topbar.classList.add('is-hidden');
    } else if (delta < 0) {
      upDistance -= delta;
      downDistance = 0;
      if (upDistance >= 10) topbar.classList.remove('is-hidden');
    }

    lastScrollY = currentScrollY;
    scrollFrame = 0;
  };

  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateTopbar);
  }, { passive: true });

  window.addEventListener('pageshow', () => {
    lastScrollY = Math.max(0, window.scrollY);
    downDistance = 0;
    upDistance = 0;
    topbar.classList.remove('is-hidden');
    topbar.classList.toggle('is-scrolled', lastScrollY > 12);
  });

  topbar.addEventListener('focusin', () => topbar.classList.remove('is-hidden'));
}

if (tilt && stage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  stage.addEventListener('pointermove', (event) => {
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    tilt.style.transform = `translate(-50%, -50%) rotateY(${x * 14 - 8}deg) rotateX(${-y * 9 + 3}deg)`;
  });
  stage.addEventListener('pointerleave', () => {
    tilt.style.transform = 'translate(-50%, -50%) rotateY(-8deg) rotateX(3deg)';
  });
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = window.norainLanguage?.() === 'zh' ? '已复制' : 'Copied';
    setTimeout(() => { button.textContent = window.norainLanguage?.() === 'zh' ? '复制' : 'Copy'; }, 1400);
  });
});

const softTilt = document.querySelector('[data-tilt-soft]');
const subtitleStage = document.querySelector('.subtitle-stage');

if (softTilt && subtitleStage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  subtitleStage.addEventListener('pointermove', (event) => {
    const rect = subtitleStage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    softTilt.style.transform = `rotateY(${x * 10 - 7}deg) rotateX(${-y * 7 + 2}deg)`;
  });
  subtitleStage.addEventListener('pointerleave', () => {
    softTilt.style.transform = 'rotateY(-7deg) rotateX(2deg)';
  });
}

const revealTargets = document.querySelectorAll('.section-head, .subtitle-copy, .subtitle-console, .operation-rail, .showcase, .pipeline ol');
revealTargets.forEach((target) => target.dataset.reveal = '');

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16 });
  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add('is-visible'));
}
