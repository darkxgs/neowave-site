(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const init = () => {
    const NW = window.NW || {motion: false};
    const gsap = NW.motion ? NW.gsap : null;
    const ST = NW.motion ? NW.ST : null;

    const body = $('#catalogBody');
    const cards = $$('.p-card', body);
    const groups = $$('.cat-group', body);
    const fams = $$('.fam', body);
    const pills = $$('.pill');
    const ind = $('.pill-ind');
    const q = $('#q');
    const count = $('#resultCount');
    const empty = $('#empty');
    let family = 'all';

    /* ---------- sliding pill indicator ---------- */
    const moveInd = (instant) => {
      const a = $('.pill.active'); if (!a || !ind) return;
      const vars = {x: a.offsetLeft, width: a.offsetWidth};
      if (gsap && !instant) gsap.to(ind, {...vars, duration: .55, ease: 'expo.out'});
      else if (gsap) gsap.set(ind, vars);
      else { ind.style.transform = `translateX(${vars.x}px)`; ind.style.width = vars.width + 'px'; }
    };
    if (ind) { $('.pills').classList.add('has-ind'); moveInd(true); addEventListener('resize', () => moveInd(true)); }
    if (document.fonts) document.fonts.ready.then(() => moveInd(true));

    /* ---------- filtering ---------- */
    const apply = () => {
      const term = q.value.trim().toLowerCase();
      const words = term.split(/\s+/).filter(Boolean);
      let shown = 0;
      cards.forEach(c => {
        const ok = (family === 'all' || c.dataset.family === family) &&
                   words.every(w => c.dataset.search.includes(w));
        c.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      groups.forEach(g => g.classList.toggle('is-hidden', !$$('.p-card:not(.is-hidden)', g).length));
      fams.forEach(f => f.classList.toggle('is-hidden', !$$('.cat-group:not(.is-hidden)', f).length));
      count.textContent = shown;
      empty.classList.toggle('show', shown === 0);
      $('#emptyQ').textContent = q.value.trim();
      return shown;
    };

    const scrollToCatalog = () => {
      const top = $('#catalog').getBoundingClientRect().top + scrollY - 70;
      if (scrollY > top + 10) NW.lenis ? NW.lenis.scrollTo(top, {immediate: true}) : scrollTo(0, top);
    };

    const run = (opts = {}) => {
      if (!gsap) { apply(); return; }
      gsap.to(body, {autoAlpha: 0, y: 14, duration: .22, ease: 'power2.in', overwrite: true, onComplete: () => {
        apply();
        if (opts.scroll) scrollToCatalog();
        ST.refresh();
        // reveal whatever is now visible, without waiting for scroll triggers
        const visible = $$('.p-card:not(.is-hidden), .cat-head, .fam-banner', body)
          .filter(el => el.offsetParent && el.getBoundingClientRect().top < innerHeight);
        gsap.set($$('.p-card:not(.is-hidden), .cat-head', body), {autoAlpha: 1, y: 0});
        gsap.to(body, {autoAlpha: 1, y: 0, duration: .45, ease: 'expo.out'});
        if (visible.length) gsap.fromTo(visible, {autoAlpha: 0, y: 26}, {autoAlpha: 1, y: 0, duration: .8, ease: 'expo.out', stagger: .035, clearProps: 'transform'});
      }});
    };

    pills.forEach(p => p.addEventListener('click', () => {
      if (p.classList.contains('active')) return;
      pills.forEach(x => { x.classList.toggle('active', x === p); x.setAttribute('aria-selected', x === p); });
      family = p.dataset.filter;
      moveInd();
      run({scroll: true});
    }));

    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run({scroll: true}), 180); });
    $('#clearSearch').addEventListener('click', () => { q.value = ''; run(); q.focus(); });
    addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault(); q.focus();
      }
      if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; run(); q.blur(); }
    });

    /* category links: make sure the target is not filtered out, then scroll */
    $$('a[href^="#cat-"]').forEach(a => a.addEventListener('click', e => {
      const target = $(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (family !== 'all' || q.value) {
        q.value = ''; family = 'all';
        pills.forEach(x => x.classList.toggle('active', x.dataset.filter === 'all'));
        moveInd(); apply(); if (ST) ST.refresh();
      }
      const y = target.getBoundingClientRect().top + scrollY - 160;
      NW.lenis ? NW.lenis.scrollTo(y, {duration: 1.6}) : scrollTo({top: y, behavior: 'smooth'});
    }));

    /* deep links from the homepage (products.html#cat-…) */
    if (location.hash.startsWith('#cat-') && $(location.hash)) {
      setTimeout(() => {
        const y = $(location.hash).getBoundingClientRect().top + scrollY - 160;
        NW.lenis ? NW.lenis.scrollTo(y, {immediate: true}) : scrollTo(0, y);
      }, 60);
    }

    /* ---------- drag-to-scroll category index ---------- */
    const track = $('#ciTrack');
    if (track && matchMedia('(pointer: fine)').matches) {
      let down = false, startX = 0, startL = 0, moved = false;
      track.addEventListener('pointerdown', e => { down = true; moved = false; startX = e.clientX; startL = track.scrollLeft; });
      addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) { moved = true; track.classList.add('dragging'); }
        track.scrollLeft = startL - dx;
      });
      addEventListener('pointerup', () => { down = false; setTimeout(() => track.classList.remove('dragging'), 0); });
      track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
      track.addEventListener('wheel', e => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return; // let vertical wheel scroll the page
      }, {passive: true});
    }

    /* ---------- toolbar shadow when stuck ---------- */
    const tw = $('.toolbar-wrap');
    if (ST) ST.create({trigger: '#catalog', start: 'top 72px', end: 'bottom top', toggleClass: {targets: tw, className: 'stuck'}});

    if (!gsap) return;

    /* ---------- motion: banners, category index, stats ---------- */
    $$('.fam-banner').forEach(b => {
      gsap.fromTo($('img', b), {yPercent: -6}, {yPercent: 6, ease: 'none',
        scrollTrigger: {trigger: b, start: 'top bottom', end: 'bottom top', scrub: true}});
      gsap.fromTo(b, {clipPath: 'inset(8% 6% 8% 6% round 40px)'}, {clipPath: 'inset(0% 0% 0% 0% round 30px)', ease: 'none',
        scrollTrigger: {trigger: b, start: 'top 95%', end: 'top 45%', scrub: .6}});
      gsap.from($$('.fam-num, .fam-txt p, .fam-chips a', b), {autoAlpha: 0, y: 24, stagger: .06, duration: 1, ease: 'expo.out',
        scrollTrigger: {trigger: b, start: 'top 60%', once: true}});
    });
    gsap.from('.ci-card', {autoAlpha: 0, x: 80, stagger: .06, duration: 1.3, ease: 'expo.out',
      scrollTrigger: {trigger: '.cat-index', start: 'top 85%', once: true}, clearProps: 'transform,opacity,visibility'});
  };

  window.NW ? init() : document.addEventListener('nw:ready', init, {once: true});
})();
