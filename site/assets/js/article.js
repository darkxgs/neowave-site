(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const init = () => {
    const NW = window.NW || {motion: false};
    const body = $('.a-body');
    const links = $$('.a-toc a');
    const heads = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
    const bar = $('.a-progress i');

    /* reading progress + active section (works with or without GSAP) */
    const update = () => {
      const r = body.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .35 - r.top) / (r.height - innerHeight * .35)));
      if (bar) bar.style.transform = `scaleX(${p})`;
      let cur = 0;
      heads.forEach((h, i) => { if (h.getBoundingClientRect().top < innerHeight * .35) cur = i; });
      links.forEach((a, i) => a.classList.toggle('on', i === cur && p > 0));
    };
    update();
    addEventListener('scroll', update, {passive: true});

    /* copy link */
    $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href.split('?')[0]); } catch (e) {}
      b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1600);
    }));

    if (!NW.motion) return;
    const {gsap} = NW;

    /* cover: opens up from a narrower frame, image drifts with scroll */
    const cover = $('.a-cover');
    gsap.fromTo(cover, {clipPath: 'inset(14% 10% 0% 10% round 40px 40px 0 0)'}, {clipPath: 'inset(0% 0% 0% 0% round 30px 30px 0 0)',
      duration: 1.6, ease: 'expo.out', delay: .5});
    gsap.fromTo($('img', cover), {scale: 1.25}, {scale: 1, duration: 2, ease: 'expo.out', delay: .5});
    gsap.to($('img', cover), {yPercent: 10, ease: 'none',
      scrollTrigger: {trigger: cover, start: 'top top', end: 'bottom top', scrub: true}});
  };

  window.NW ? init() : document.addEventListener('nw:ready', init, {once: true});
})();
