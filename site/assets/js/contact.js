(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const TOPIC_SUBJECT = {
    general: 'General inquiry', quote: 'Quote request', support: 'Technical support',
    partner: 'Partnership', event: 'Events & media', careers: 'Careers'
  };

  const init = () => {
    const NW = window.NW || {motion: false};
    const gsap = NW.motion ? NW.gsap : null;
    const form = $('#contactForm');
    const subject = $('#c-subject');
    const note = $('#contactNote');

    /* ---------- topic chips (and ?subject=quote deep links) ---------- */
    let autoSubject = true;
    const setTopic = v => {
      const r = $(`input[name="topic"][value="${v}"]`, form);
      if (!r) return;
      r.checked = true;
      if (autoSubject) subject.value = TOPIC_SUBJECT[v];
    };
    subject.addEventListener('input', () => { autoSubject = !subject.value; });
    $$('input[name="topic"]', form).forEach(r => r.addEventListener('change', () => setTopic(r.value)));
    const params = new URLSearchParams(location.search);
    const pre = params.get('subject');
    const preMsg = params.get('msg'), preCode = params.get('code');
    if (preMsg) $('#c-msg').value = preMsg;
    if (preCode) { subject.value = `Quote request: ${preCode}`; autoSubject = false; }
    if (pre && TOPIC_SUBJECT[pre]) {
      setTopic(pre);
      setTimeout(() => {
        const y = $('#message').getBoundingClientRect().top + scrollY - 40;
        NW.lenis ? NW.lenis.scrollTo(y, {duration: 1.6}) : scrollTo({top: y, behavior: 'smooth'});
      }, 900);
    } else setTopic('general');

    /* ---------- submit -> prefilled email ---------- */
    const shake = el => gsap && gsap.fromTo(el, {x: -8}, {x: 0, duration: .5, ease: 'elastic.out(1, .3)'});
    form.addEventListener('input', e => e.target.closest('.field')?.classList.remove('invalid'));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const v = k => (f.get(k) || '').trim();
      const bad = [];
      if (!v('name')) bad.push('#c-name');
      if (!/^\S+@\S+\.\S+$/.test(v('email'))) bad.push('#c-email');
      if (!v('message')) bad.push('#c-msg');
      bad.forEach(sel => { const fld = $(sel).closest('.field'); fld.classList.add('invalid'); shake(fld); });
      if (bad.length) { $(bad[0]).focus(); return; }
      const subj = v('subject') || TOPIC_SUBJECT[f.get('topic')];
      const body = [v('message'), '', '—', `${v('name')}${v('company') ? ', ' + v('company') : ''}`, v('email')].join('\n');
      location.href = `mailto:info@neowave.tech?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
      note.textContent = 'Your email app should open now. Just hit send.';
      note.classList.add('ok');
    });

    /* ---------- interactive hero waves ---------- */
    const svg = $('#cWaves');
    if (svg) {
      const N = 9;
      const lines = Array.from({length: N}, (_, i) => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('stroke', `rgba(79,178,245,${0.08 + i * 0.07})`);
        svg.appendChild(p); return p;
      });
      const m = {x: .5, y: .5, tx: .5, ty: .5, amp: 1, tAmp: 1};
      const hero = $('.contact-hero');
      hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        m.tx = (e.clientX - r.left) / r.width; m.ty = (e.clientY - r.top) / r.height; m.tAmp = 1.6;
      });
      hero.addEventListener('mouseleave', () => { m.tx = .5; m.ty = .5; m.tAmp = 1; });
      const draw = t => {
        m.x += (m.tx - m.x) * .06; m.y += (m.ty - m.y) * .06; m.amp += (m.tAmp - m.amp) * .04;
        lines.forEach((p, i) => {
          let d = '';
          for (let x = 0; x <= 1440; x += 16) {
            const dx = x / 1440 - m.x;
            const bump = Math.exp(-dx * dx * 18) * (m.y - .5) * -160 * (m.amp - .6);   // swell under the cursor
            const y = 330 + (i - N / 2) * 16
              + Math.sin(x * .004 + t * .0005 + i * .45) * (34 + i * 5) * m.amp
              + Math.sin(x * .011 - t * .0003 + i) * 10 + bump;
            d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
          }
          p.setAttribute('d', d);
        });
        if (NW.motion) requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }

    if (!gsap) return;
    gsap.from('.c-form > *', {autoAlpha: 0, y: 20, stagger: .05, duration: .9, ease: 'expo.out',
      scrollTrigger: {trigger: '.c-form', start: 'top 80%', once: true}, clearProps: 'transform,opacity,visibility'});
    gsap.fromTo('.c-map', {clipPath: 'inset(10% 8% 10% 8% round 40px)'}, {clipPath: 'inset(0% 0% 0% 0% round 30px)', ease: 'none',
      scrollTrigger: {trigger: '.c-map', start: 'top 95%', end: 'top 45%', scrub: .6}});
  };

  window.NW ? init() : document.addEventListener('nw:ready', init, {once: true});
})();
