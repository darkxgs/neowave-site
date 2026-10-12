(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const init = () => {
    const NW = window.NW || {motion: false};
    const gsap = NW.motion ? NW.gsap : null;

    /* ---------- open application -> prefilled email ---------- */
    const form = $('#applyForm');
    const note = $('#formNote');
    const shake = el => gsap && gsap.fromTo(el, {x: -8}, {x: 0, duration: .5, ease: 'elastic.out(1, .3)'});
    form.addEventListener('input', e => e.target.closest('.field')?.classList.remove('invalid'));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const name = (f.get('name') || '').trim();
      const email = (f.get('email') || '').trim();
      const bad = [];
      if (!name) bad.push('#f-name');
      if (!/^\S+@\S+\.\S+$/.test(email)) bad.push('#f-email');
      bad.forEach(sel => { const field = $(sel).closest('.field'); field.classList.add('invalid'); shake(field); });
      if (bad.length) { $(bad[0]).focus(); return; }

      const area = f.get('area');
      const body = [
        `Name: ${name}`,
        `Email: ${email}`,
        f.get('location') ? `Location: ${f.get('location')}` : '',
        f.get('link') ? `LinkedIn / portfolio: ${f.get('link')}` : '',
        `Area of interest: ${area}`,
        '',
        (f.get('message') || '').trim(),
        '',
        '(CV attached)'
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
      location.href = `mailto:info@neowave.tech?subject=${encodeURIComponent(`Open application: ${name} (${area})`)}&body=${encodeURIComponent(body)}`;
      note.textContent = 'Your email app should open now. Attach your CV and hit send.';
      note.classList.add('ok');
    });

    if (!gsap) return;
    const ST = NW.ST;

    /* ---------- cursor-following preview on the work list ---------- */
    const preview = $('.work-preview');
    const img = $('img', preview);
    if (NW.fine && preview) {
      gsap.set(preview, {scale: .6});
      const xTo = gsap.quickTo(preview, 'x', {duration: .7, ease: 'power3'});
      const yTo = gsap.quickTo(preview, 'y', {duration: .7, ease: 'power3'});
      const rTo = gsap.quickTo(preview, 'rotation', {duration: .9, ease: 'power3'});
      let lastX = 0;
      const list = $('.work-list');
      list.addEventListener('mousemove', e => {
        xTo(e.clientX); yTo(e.clientY);
        rTo(Math.max(-8, Math.min(8, (e.clientX - lastX) * .6)));
        lastX = e.clientX;
      });
      $$('.work-row').forEach(row => row.addEventListener('mouseenter', () => {
        if (img.getAttribute('src') !== row.dataset.img) {
          img.src = row.dataset.img;
          gsap.fromTo(img, {scale: 1.25}, {scale: 1, duration: .8, ease: 'expo.out'});
        }
      }));
      list.addEventListener('mouseenter', e => {
        gsap.set(preview, {x: e.clientX, y: e.clientY});
        gsap.to(preview, {opacity: 1, scale: 1, duration: .5, ease: 'expo.out'});
      });
      list.addEventListener('mouseleave', () => gsap.to(preview, {opacity: 0, scale: .6, duration: .4, ease: 'power3.in'}));
      $$('.work-row').forEach(r => { const i = new Image(); i.src = r.dataset.img; }); // warm the cache
    }

    /* ---------- lab image: expanding clip + zoom ---------- */
    const lab = $('.lab-visual');
    if (lab) {
      const st = {trigger: lab, start: 'top 92%', end: 'top 35%', scrub: .8};
      gsap.fromTo(lab, {clipPath: 'inset(12% 10% 12% 10% round 40px)'}, {clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none', scrollTrigger: st});
      gsap.fromTo($('img', lab), {scale: 1.35}, {scale: 1, ease: 'none', scrollTrigger: st});
    }

    /* ---------- form fields cascade in ---------- */
    gsap.from('.apply-form > *', {autoAlpha: 0, y: 24, stagger: .06, duration: 1, ease: 'expo.out',
      scrollTrigger: {trigger: '.apply-form', start: 'top 80%', once: true}, clearProps: 'transform,opacity,visibility'});
    gsap.from('.apply-steps li', {autoAlpha: 0, x: -24, stagger: .1, duration: 1, ease: 'expo.out',
      scrollTrigger: {trigger: '.apply-steps', start: 'top 85%', once: true}});
    ST.refresh();
  };

  window.NW ? init() : document.addEventListener('nw:ready', init, {once: true});
})();
