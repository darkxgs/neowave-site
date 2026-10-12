(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = !root.classList.contains('force-motion') && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const nav = $('#nav');

  /* ---------- basics ---------- */
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 30);
  onScroll(); addEventListener('scroll', onScroll, {passive: true});
  $('#burger').addEventListener('click', () => document.body.classList.toggle('menu-open'));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
  $('#year').textContent = new Date().getFullYear();

  /* ---------- count-up (final values already in the HTML) ---------- */
  const countUp = el => {
    if (el.dataset.done) return; el.dataset.done = 1;
    const to = +el.dataset.count, t0 = performance.now(), dur = 1800;
    const tick = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---------- text splitting ---------- */
  const wrapWord = (node, out) => {
    const w = document.createElement('span'); w.className = 'w';
    const i = document.createElement('span'); i.className = 'wi';
    i.appendChild(node); w.appendChild(i); out.push(i); return w;
  };
  const splitWords = el => {
    const out = [], frag = document.createDocumentFragment();
    [...el.childNodes].forEach(n => {
      if (n.nodeName === 'BR') return frag.appendChild(n);
      const isText = n.nodeType === 3;
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '));
        let node;
        if (isText) node = document.createTextNode(part);
        else { node = n.cloneNode(false); node.textContent = part; }
        frag.appendChild(wrapWord(node, out));
      });
    });
    el.textContent = ''; el.appendChild(frag);
    return out;
  };
  const splitChars = el => {
    const out = [], text = el.textContent; el.textContent = '';
    [...text].forEach(ch => {
      const s = document.createElement('span'); s.className = 'ch';
      s.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(s); out.push(s);
    });
    return out;
  };

  /* ---------- fallback: no GSAP, or reduced motion ---------- */
  const fallback = () => {
    window.NW = {motion: false};
    root.classList.add('pl-done', 'split-ready');
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      if (!reduce) en.target.querySelectorAll('[data-count]').forEach(countUp);
      io.unobserve(en.target);
    }), {threshold: .15, rootMargin: '0px 0px -40px 0px'});
    $$('.reveal, #introVisual').forEach(el => io.observe(el));
    drawWaves(false);
    document.dispatchEvent(new CustomEvent('nw:ready'));
  };

  /* ---------- CTA waves (mouse reactive when animated) ---------- */
  function drawWaves(interactive) {
    const svg = $('#waves'); if (!svg) return;
    const lines = Array.from({length: 7}, (_, i) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('stroke', `rgba(79,178,245,${0.12 + i * 0.06})`);
      svg.appendChild(p); return p;
    });
    const m = {amp: 1, tAmp: 1, ph: 0, tPh: 0};
    if (interactive) {
      const card = $('.cta-card');
      if (card) card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        m.tAmp = 1 + (1 - (e.clientY - r.top) / r.height) * 1.6;
        m.tPh = ((e.clientX - r.left) / r.width - .5) * 3;
      });
      if (card) card.addEventListener('mouseleave', () => { m.tAmp = 1; m.tPh = 0; });
    }
    const draw = t => {
      m.amp += (m.tAmp - m.amp) * .05; m.ph += (m.tPh - m.ph) * .05;
      lines.forEach((p, i) => {
        let d = '';
        for (let x = 0; x <= 1200; x += 12) {
          const y = 150 + Math.sin(x * .006 + t * .0006 + i * .5 + m.ph) * (30 + i * 6) * m.amp
                        + Math.sin(x * .013 - t * .0004 + i) * 12;
          d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
        }
        p.setAttribute('d', d);
      });
      if (!reduce) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  /* ---------- full motion ---------- */
  const start = () => {
    const splits = $$('[data-split]').map(el => {
      const type = el.dataset.split || 'words';
      return {el, type, parts: type === 'chars' ? splitChars(el) : splitWords(el)};
    });
    root.classList.add('split-ready');

    const gsap = window.gsap, ST = window.ScrollTrigger;
    if (reduce || !gsap || !ST) return fallback();
    gsap.registerPlugin(ST);
    const has = sel => !!$(sel);
    root.classList.add('anim');
    if (fine) root.classList.add('fine');

    /* smooth scroll */
    let lenis = null;
    if (window.Lenis) {
      lenis = new Lenis({lerp: .09, smoothWheel: true});
      lenis.on('scroll', ST.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        const t = id.length > 1 && $(id);
        if (t) { e.preventDefault(); lenis.scrollTo(t, {offset: -60, duration: 1.6}); }
      }));
    }

    /* take .reveal elements over from the CSS fallback */
    const custom = el => el.closest('.hero, .page-hero') || el.matches('#introVisual, .featured-visual, .cta-card');
    $$('.reveal').forEach(el => {
      el.classList.remove('reveal', 'd1', 'd2', 'd3', 'd4');
      if (!custom(el)) el.setAttribute('data-rv', '');
    });

    /* hero intro timeline */
    const heroSplit = splits.find(s => s.el.closest('.hero, .page-hero'));
    const hero = gsap.timeline({paused: true, defaults: {ease: 'expo.out', duration: 1.4}});
    const T = (sel, vars, pos) => { if (typeof sel !== 'string' || has(sel)) hero.from(sel, vars, pos); };
    T('.hero-media video, .page-hero-media img, .page-hero-media video', {scale: 1.35, duration: 2.8, ease: 'power3.out'}, 0);
    T('#nav .nav-inner > *', {y: -24, autoAlpha: 0, stagger: .08, duration: 1.1}, .25);
    T('.hero .eyebrow, .page-hero .crumbs, .page-hero .eyebrow', {autoAlpha: 0, x: -24, stagger: .1}, .3);
    if (heroSplit) T(heroSplit.parts, {yPercent: 115, rotate: 4, stagger: .055, duration: 1.4}, .35);
    T('.hero .lede, .page-hero .lede', {autoAlpha: 0, y: 26}, .85);
    T('.hero-actions > *', {autoAlpha: 0, y: 26, stagger: .1}, .95);
    T('.hero-rail a, .ph-stats > div', {autoAlpha: 0, y: 34, stagger: .08}, 1.05);
    T('.scroll-cue', {autoAlpha: 0, duration: 1}, 1.5);

    /* preloader (once per session) */
    const pl = $('#preloader');
    let seen = false;
    try { seen = sessionStorage.getItem('nw-pl') === '1'; sessionStorage.setItem('nw-pl', '1'); } catch (e) {}
    if (seen) { root.classList.add('pl-done'); hero.play(); }
    else {
      const num = $('#plNum'), c = {v: 0};
      gsap.timeline()
        .to(c, {v: 100, duration: 1.3, ease: 'power2.inOut', onUpdate: () => num.textContent = Math.round(c.v)})
        .to('.pl-bars i', {scaleY: 0, stagger: .05, duration: .45, ease: 'power3.in'}, '+=.05')
        .to('.pl-word, .pl-count', {autoAlpha: 0, y: -12, duration: .4, ease: 'power2.in'}, '<')
        .to(pl, {yPercent: -100, duration: 1.1, ease: 'expo.inOut'})
        .add(() => hero.play(), '-=.75')
        .add(() => root.classList.add('pl-done'));
    }

    /* hero scroll + mouse parallax */
    const heroEl = $('.hero, .page-hero');
    if (heroEl) {
      const heroST = {trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true};
      if (has('.hero-media, .page-hero-media')) gsap.to('.hero-media, .page-hero-media', {yPercent: 22, ease: 'none', scrollTrigger: heroST});
      gsap.to('.hero-content, .page-hero-content', {y: -140, autoAlpha: 0, ease: 'none', scrollTrigger: {...heroST, end: '80% top'}});
    }
    const vid = $('.hero-media video, .page-hero-media img, .page-hero-media video');
    if (fine && heroEl && vid) {
      const vx = gsap.quickTo(vid, 'x', {duration: 1.6, ease: 'power3'});
      const vy = gsap.quickTo(vid, 'y', {duration: 1.6, ease: 'power3'});
      heroEl.addEventListener('mousemove', e => {
        vx((e.clientX / innerWidth - .5) * -24);
        vy((e.clientY / innerHeight - .5) * -16);
      });
    }

    /* progress bar + nav hide/show */
    gsap.to('.progress', {scaleX: 1, ease: 'none', scrollTrigger: {start: 0, end: 'max', scrub: .3}});
    ST.create({start: 0, end: 'max', onUpdate: self => {
      const y = self.scroll();
      nav.classList.toggle('hide', self.direction === 1 && y > 600 && !document.body.classList.contains('menu-open'));
      nav.classList.toggle('scrolled', y > 30);
    }});

    /* generic reveals */
    gsap.set('[data-rv]', {autoAlpha: 0, y: 56});
    ST.batch('[data-rv]', {
      start: 'top 88%', once: true,
      onEnter: b => gsap.to(b, {autoAlpha: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: .1,
        clearProps: 'transform,opacity,visibility'})
    });

    /* split headings */
    splits.filter(s => s.type === 'words' && !s.el.closest('.hero, .page-hero')).forEach(s => {
      gsap.from(s.parts, {yPercent: 115, rotate: 3, duration: 1.4, ease: 'expo.out', stagger: .045,
        scrollTrigger: {trigger: s.el, start: 'top 88%', once: true}});
    });

    /* intro statement lights up word by word */
    splits.filter(s => s.type === 'scrub').forEach(s => {
      gsap.fromTo(s.parts, {opacity: .14}, {opacity: 1, stagger: .05, ease: 'none',
        scrollTrigger: {trigger: s.el, start: 'top 82%', end: 'bottom 50%', scrub: .6}});
    });

    /* footer wordmark rises letter by letter */
    splits.filter(s => s.type === 'chars').forEach(s => {
      gsap.from(s.parts, {yPercent: 100, duration: 1.4, ease: 'expo.out', stagger: .05,
        scrollTrigger: {trigger: s.el, start: 'top 98%', once: true}});
    });

    /* counters */
    $$('[data-count]').forEach(el => ST.create({trigger: el, start: 'top 92%', once: true, onEnter: () => countUp(el)}));

    /* marquee: GSAP loop that speeds up with scroll velocity */
    const track = $('.marquee-track');
    if (track) {
      track.style.animation = 'none';
      const loop = gsap.to(track, {xPercent: -50, ease: 'none', duration: 48, repeat: -1});
      ST.create({start: 0, end: 'max', onUpdate: self => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 250, 8);
        gsap.to(loop, {timeScale: boost, duration: .2, overwrite: true});
        gsap.to(loop, {timeScale: 1, duration: 1.4, delay: .3});
      }});
    }

    /* intro visual: expanding clip + image zoom */
    const iv = $('#introVisual');
    if (iv) {
    const ivST = {trigger: iv, start: 'top 92%', end: 'top 30%', scrub: .8};
    gsap.fromTo(iv, {clipPath: 'inset(16% 14% 16% 14% round 40px)'}, {clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none', scrollTrigger: ivST});
    gsap.fromTo('#introVisual > img', {scale: 1.4}, {scale: 1, ease: 'none', scrollTrigger: ivST});
    gsap.from('.intro-badge, .live-dot', {autoAlpha: 0, y: 30, stagger: .12, duration: 1.2, ease: 'expo.out',
      scrollTrigger: {trigger: iv, start: 'top 40%', once: true}});
    }

    /* bento: tilt + spotlight + sensor parallax */
    if (fine) {
      $$('.tile').forEach(tile => {
        const rx = gsap.quickTo(tile, 'rotationX', {duration: .8, ease: 'power3'});
        const ry = gsap.quickTo(tile, 'rotationY', {duration: .8, ease: 'power3'});
        gsap.set(tile, {transformPerspective: 1100});
        const imgs = $$('.sensor-stage img', tile).map((img, i) => ({
          x: gsap.quickTo(img, 'x', {duration: 1, ease: 'power3'}),
          y: gsap.quickTo(img, 'y', {duration: 1, ease: 'power3'}),
          d: [26, 14, 20, 34][i] || 16
        }));
        tile.addEventListener('mouseenter', () => gsap.set(tile, {transformPerspective: 1100}));
        tile.addEventListener('mousemove', e => {
          const r = tile.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          tile.style.setProperty('--mx', px * 100 + '%');
          tile.style.setProperty('--my', py * 100 + '%');
          rx((py - .5) * -6); ry((px - .5) * 6);
          imgs.forEach(o => { o.x((px - .5) * o.d); o.y((py - .5) * o.d); });
        });
        tile.addEventListener('mouseleave', () => { rx(0); ry(0); imgs.forEach(o => { o.x(0); o.y(0); }); });
      });
    }

    /* featured switch scales/rotates in, callouts pop */
    if (has('.featured-visual')) {
    gsap.fromTo('.featured-visual', {scale: .72, rotate: -10, autoAlpha: 0},
      {scale: 1, rotate: 0, autoAlpha: 1, ease: 'none',
       scrollTrigger: {trigger: '.featured', start: 'top 85%', end: 'center 62%', scrub: 1}});
    gsap.from('.callout', {autoAlpha: 0, scale: .6, y: 16, stagger: .15, duration: .9, ease: 'back.out(2)',
      scrollTrigger: {trigger: '.featured-visual', start: 'top 45%', once: true}});
    }

    /* solutions + impact + news: image parallax */
    $$('.sol').forEach(sol => gsap.fromTo($('img', sol), {yPercent: -7, scale: 1.18}, {yPercent: 7, scale: 1.18, ease: 'none',
      scrollTrigger: {trigger: sol, start: 'top bottom', end: 'bottom top', scrub: true}}));
    if (has('.impact')) gsap.fromTo('.impact video', {yPercent: -12, scale: 1.25}, {yPercent: 12, scale: 1.25, ease: 'none',
      scrollTrigger: {trigger: '.impact', start: 'top bottom', end: 'bottom top', scrub: true}});
    $$('.post-img').forEach(pi => gsap.fromTo(pi, {clipPath: 'inset(100% 0% 0% 0%)'}, {clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4, ease: 'expo.inOut', scrollTrigger: {trigger: pi, start: 'top 90%', once: true}}));

    /* why icons draw themselves */
    $$('.why').forEach(w => {
      const shapes = $$('.why-icon svg *', w);
      shapes.forEach(sh => { try { const l = sh.getTotalLength(); sh.style.strokeDasharray = l; sh.style.strokeDashoffset = l; } catch (e) {} });
      ST.create({trigger: w, start: 'top 85%', once: true, onEnter: () =>
        gsap.to(shapes, {strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: .08, delay: .3})});
    });

    /* CTA card */
    if (has('.cta-card')) {
    gsap.from('.cta-card', {scale: .9, y: 90, autoAlpha: 0, duration: 1.5, ease: 'expo.out',
      scrollTrigger: {trigger: '.cta', start: 'top 80%', once: true}});
    if (has('.contact-item')) gsap.from('.contact-item', {x: 40, autoAlpha: 0, stagger: .1, duration: 1.2, ease: 'expo.out',
      scrollTrigger: {trigger: '.cta', start: 'top 60%', once: true}, clearProps: 'transform,opacity,visibility'});
    }
    drawWaves(fine);

    /* magnetic buttons */
    if (fine) {
      $$('.btn, .tile-arrow, .nav-gen, .burger, [data-magnetic]').forEach(el => {
        const xTo = gsap.quickTo(el, 'x', {duration: .6, ease: 'power3'});
        const yTo = gsap.quickTo(el, 'y', {duration: .6, ease: 'power3'});
        el.addEventListener('mousemove', e => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * .28);
          yTo((e.clientY - r.top - r.height / 2) * .38);
        });
        el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
      });
    }

    /* custom cursor */
    if (fine) {
      const ring = $('.cursor'), dot = $('.cursor-dot');
      const rx = gsap.quickTo(ring, 'x', {duration: .5, ease: 'power3'}), ry = gsap.quickTo(ring, 'y', {duration: .5, ease: 'power3'});
      const dx = gsap.quickTo(dot, 'x', {duration: .08}), dy = gsap.quickTo(dot, 'y', {duration: .08});
      addEventListener('mousemove', e => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); });
      document.addEventListener('mouseover', e => {
        const t = e.target;
        ring.classList.toggle('view', !!t.closest('.sol, .post'));
        ring.classList.toggle('hover', !t.closest('.sol, .post') && !!t.closest('a, button'));
      });
      document.addEventListener('mouseleave', () => { ring.classList.add('gone'); dot.classList.add('gone'); });
      document.addEventListener('mouseenter', () => { ring.classList.remove('gone'); dot.classList.remove('gone'); });
    }

    addEventListener('load', () => ST.refresh());
    window.NW = {gsap, ST, lenis, fine, motion: true};
    document.dispatchEvent(new CustomEvent('nw:ready'));
  };

  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', start) : start();
})();

/* below-the-fold videos: fetch and play only once they come near the viewport */
(() => {
  const init = () => {
    const vids = document.querySelectorAll('video[data-lazy]');
    const load = v => {
      v.querySelectorAll('source[data-src]').forEach(s => { s.src = s.dataset.src; s.removeAttribute('data-src'); });
      v.removeAttribute('data-lazy');
      v.load();
      v.play().catch(() => {});
    };
    if (!('IntersectionObserver' in window)) return vids.forEach(load);
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { io.unobserve(e.target); load(e.target); }
    }), {rootMargin: '600px 0px'});
    vids.forEach(v => io.observe(v));
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', init) : init();
})();
