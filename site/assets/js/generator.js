(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const RECENT_KEY = 'nw-pcg-recent';

  const ICONS = {
    'temp-humid': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/><path d="M12 17.5v-6"/></svg>',
    'air-quality': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/></svg>',
    'pressure': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M9 3h6"/></svg>',
    'level': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18h14V3"/><path d="M5 13c2.3-1.5 4.7-1.5 7 0s4.7 1.5 7 0"/></svg>',
    'flow': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9h14l-3-3M22 15H8l3 3"/></svg>',
    'smart-thermostat': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="4"/></svg>',
  };
  const DL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10"/></svg>';
  const CHECK = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5"/></svg>';

  const init = async () => {
    const NW = window.NW || {motion: false};
    const gsap = NW.motion ? NW.gsap : null;
    let data;
    try {
      data = await (async () => {
        // live published snapshot (hosted); falls back to the static export when the API isn't available
        try {
          const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
          const r = await fetch('/api/generator', {signal: ctl.signal});
          if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.models)) return j; }
        } catch (e) { /* fall through */ }
        const r = await fetch('assets/data/generator.json?v=47e6787c');
        if (!r.ok) throw r;
        return r.json();
      })();
    } catch (e) {
      $('#cfgEmpty').innerHTML = '<b>The generator data could not be loaded.</b><p>Please refresh the page. If it keeps happening, contact us at info@neowave.tech.</p>';
      return;
    }
    const types = Object.fromEntries(data.types.map(t => [t.id, t]));
    const featName = Object.fromEntries(data.features.map(f => [f.id, f.name]));
    const S = {type: 'all', feats: new Set(), q: '', model: null, sel: []};

    /* ---------------- code helpers ---------------- */
    const build = (m, sel, q = '?') => [m.code, ...m.specs.map((_, i) => sel[i] ?? q)].join('-');
    const complete = () => S.model && S.sel.every(v => v != null);
    const describe = (m, sel) => [`${m.code} | ${m.name}`, ...m.specs.map((s, i) => {
      const o = s.options.find(o => o[0] === sel[i]);
      return `${s.name}: ${o ? o[1] : 'not selected'}`;
    })].join('\n');

    const decode = raw => {
      const str = raw.trim().replace(/\s+/g, '');
      if (!str) return {error: 'Paste a code to decode it.'};
      const up = str.toUpperCase();
      const m = data.models
        .filter(m => up.startsWith(m.code.toUpperCase()) && (up.length === m.code.length || up[m.code.length] === '-'))
        .sort((a, b) => b.code.length - a.code.length)[0];
      if (!m) return {error: `No model matches “${str}”. Check the model part of the code.`};
      const parts = str.length > m.code.length ? str.slice(m.code.length + 1).split('-') : [];
      const sel = m.specs.map((s, i) => {
        const p = parts[i];
        if (p == null) return null;
        const o = s.options.find(o => o[0].toUpperCase() === p.toUpperCase());
        return o ? o[0] : null;
      });
      const bad = m.specs.map((s, i) => parts[i] != null && sel[i] == null ? `“${parts[i]}” isn't a valid ${s.name.toLowerCase()}` : null).filter(Boolean);
      if (parts.length > m.specs.length) bad.push(`${parts.length - m.specs.length} extra segment(s)`);
      return {model: m, sel, bad, missing: sel.filter(v => v == null).length};
    };

    /* ---------------- browser ---------------- */
    const typeCounts = id => data.models.filter(m => id === 'all' || m.type === id).length;
    const renderTypes = () => {
      $('#brTypes').innerHTML = [['all', 'All'], ...data.types.map(t => [t.id, t.name])]
        .map(([id, name]) => `<button class="chip${S.type === id ? ' on' : ''}" data-type="${id}" role="tab" aria-selected="${S.type === id}">${esc(name)} <i>${typeCounts(id)}</i></button>`).join('');
    };
    const renderFeats = () => {
      const feats = S.type === 'all' ? [] : data.features.filter(f => f.type === S.type);
      $('#brFeats').innerHTML = feats.map(f => `<button class="chip${S.feats.has(f.id) ? ' on' : ''}" data-feat="${f.id}" aria-pressed="${S.feats.has(f.id)}">${esc(f.name)}</button>`).join('');
    };
    const visibleModels = () => {
      const words = S.q.toLowerCase().split(/\s+/).filter(Boolean);
      return data.models.filter(m =>
        (S.type === 'all' || m.type === S.type) &&
        [...S.feats].every(f => m.features.includes(f)) &&
        words.every(w => `${m.code} ${m.name} ${types[m.type].name} ${m.features.map(f => featName[f]).join(' ')}`.toLowerCase().includes(w)));
    };
    const thumb = m => m.image ? `<img src="${esc(m.image)}" alt="" loading="lazy">` : ICONS[m.type] || '';
    const renderList = (animate) => {
      const list = visibleModels();
      $('#brCount').textContent = `${list.length} of ${data.models.length} models`;
      $('#brList').innerHTML = list.length ? list.map(m => `
        <button class="m-item${S.model === m ? ' on' : ''}" data-code="${esc(m.code)}" role="option" aria-selected="${S.model === m}">
          <span class="m-thumb">${thumb(m)}</span>
          <span class="m-txt"><b>${esc(m.code)}</b><span>${esc(m.name)}</span></span>
          <span class="m-n">${m.specs.length ? m.specs.length + ' opt' : 'fixed'}</span>
        </button>`).join('') : '<p class="br-empty">No models match. Try clearing a filter.</p>';
      if (gsap && animate) gsap.from('#brList .m-item', {autoAlpha: 0, x: -14, stagger: .025, duration: .5, ease: 'power3.out', clearProps: 'all'});
    };

    $('#brTypes').addEventListener('click', e => {
      const b = e.target.closest('[data-type]'); if (!b) return;
      S.type = b.dataset.type; S.feats.clear();
      renderTypes(); renderFeats(); renderList(true);
    });
    $('#brFeats').addEventListener('click', e => {
      const b = e.target.closest('[data-feat]'); if (!b) return;
      S.feats.has(b.dataset.feat) ? S.feats.delete(b.dataset.feat) : S.feats.add(b.dataset.feat);
      renderFeats(); renderList(true);
    });
    let qt;
    $('#brSearch').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value; renderList(); }, 120); });
    $('#brList').addEventListener('click', e => {
      const b = e.target.closest('[data-code]'); if (!b) return;
      select(data.models.find(m => m.code === b.dataset.code));
      if (matchMedia('(max-width: 1100px)').matches) scrollToEl($('#config'), -90);
    });

    /* ---------------- configurator ---------------- */
    const select = (m, preset) => {
      S.model = m;
      S.sel = m.specs.map((s, i) => preset?.[i] ?? (s.options.length === 1 ? s.options[0][0] : null));
      $('#cfgEmpty').hidden = true;
      $('#cfg').hidden = false;
      $('#cfgImg').innerHTML = m.image ? `<img src="${esc(m.image)}" alt="${esc(m.name)}">` : ICONS[m.type] || '';
      $('#cfgType').textContent = `${types[m.type].name} · ${m.code}`;
      $('#cfgName').textContent = m.name;
      $('#cfgDesc').textContent = m.description || '';
      $('#cfgDocs').innerHTML = [m.datasheet && `<a href="${esc(m.datasheet)}" target="_blank" rel="noopener">${DL}Datasheet</a>`,
                                 m.manual && `<a href="${esc(m.manual)}" target="_blank" rel="noopener">${DL}Manual</a>`].filter(Boolean).join('');
      $('#specs').innerHTML = m.specs.map((s, i) => `
        <div class="g-spec" id="spec-${i}" data-i="${i}">
          <div class="spec-top"><span class="spec-n">${String(i + 1).padStart(2, '0')}</span><b>${esc(s.name)}</b><span class="check">${CHECK}</span></div>
          <div class="opts" role="radiogroup" aria-label="${esc(s.name)}">
            ${s.options.map(o => `<button class="opt" type="button" role="radio" data-i="${i}" data-code="${esc(o[0])}"><code>${esc(o[0])}</code><span>${esc(o[1])}</span></button>`).join('')}
          </div>
        </div>`).join('');
      $('.gspecs-head').hidden = !m.specs.length;
      $$('#brList .m-item').forEach(b => { b.classList.toggle('on', b.dataset.code === m.code); b.setAttribute('aria-selected', b.dataset.code === m.code); });
      renderAnatomy(true);
      update();
      $('#result').hidden = false;
      if (gsap) {
        gsap.from('.cfg-head, .anatomy', {autoAlpha: 0, y: 24, stagger: .08, duration: .7, ease: 'expo.out', clearProps: 'all'});
        gsap.from('#specs .g-spec', {autoAlpha: 0, y: 30, stagger: .05, duration: .7, ease: 'expo.out', delay: .1, clearProps: 'all'});
        NW.ST && NW.ST.refresh();
      }
    };

    const renderAnatomy = () => {
      const m = S.model;
      const segs = m.specs.map((s, i) => `<span class="dash">-</span><button class="seg" type="button" data-i="${i}" title="${esc(s.name)}"><span class="seg-v"></span><span class="seg-n">${esc(s.name)}</span></button>`).join('');
      $('#anatomy').innerHTML = `
        <div class="an-label"><span>Ordering code</span><span id="anState"></span></div>
        <div class="an-code"><div class="seg seg-base"><span class="seg-v">${esc(m.code)}</span><span class="seg-n">Model</span></div>${segs}</div>
        ${m.specs.length ? '' : '<p class="an-fixed">This model has no configurable options, so its ordering code is fixed.</p>'}`;
    };

    const update = (changed) => {
      const m = S.model;
      $$('#anatomy .seg[data-i]').forEach(seg => {
        const v = S.sel[seg.dataset.i];
        seg.classList.toggle('empty', v == null); seg.classList.toggle('set', v != null);
        $('.seg-v', seg).textContent = v ?? '?';
      });
      if (gsap && changed != null) gsap.fromTo(`#anatomy .seg[data-i="${changed}"] .seg-v`, {scale: 1.25}, {scale: 1, duration: .6, ease: 'back.out(3)'});
      $$('#specs .g-spec').forEach(sp => {
        const i = +sp.dataset.i;
        sp.classList.toggle('ok', S.sel[i] != null);
        $$('.opt', sp).forEach(o => { const on = o.dataset.code === S.sel[i]; o.classList.toggle('on', on); o.setAttribute('aria-checked', on); });
      });
      const left = S.sel.filter(v => v == null).length;
      const prog = $('#specProgress');
      prog.textContent = left ? `${m.specs.length - left} / ${m.specs.length} chosen` : 'All options chosen';
      prog.classList.toggle('done', !left);
      $('#anState').textContent = left ? `${left} to go` : 'Complete';
      const done = complete();
      const code = build(m, S.sel);
      $('#resCode').innerHTML = esc(code).replace(/\?/g, '<span class="q">?</span>');
      $('#resLabel').textContent = done ? 'Your ordering code' : `Choose ${left} more option${left === 1 ? '' : 's'}`;
      $('#result').classList.toggle('complete', done);
      const msg = done ? `Hello, I would like a quote for:\n\n${describe(m, S.sel)}\n\nQuantity: ` : `Hello, I'm interested in the ${m.code} (${m.name}).`;
      $('#quoteBtn').href = `/contact?subject=quote&code=${encodeURIComponent(done ? code : m.code)}&msg=${encodeURIComponent(msg)}`;
      history.replaceState(null, '', done ? '#' + code : '#' + m.code);
      if (done) remember(code, m);
    };

    $('#specs').addEventListener('click', e => {
      const b = e.target.closest('.opt'); if (!b) return;
      const i = +b.dataset.i;
      S.sel[i] = S.sel[i] === b.dataset.code && S.model.specs[i].options.length > 1 ? null : b.dataset.code;
      update(i);
      // move on to the next unchosen spec
      const next = S.sel.findIndex((v, j) => v == null && j > i);
      if (S.sel[i] != null && next > -1) {
        const el = $(`#spec-${next}`), r = el.getBoundingClientRect();
        if (r.top > innerHeight - 160) scrollToEl(el, -140);
      }
    });
    $('#anatomy').addEventListener('click', e => {
      const seg = e.target.closest('.seg[data-i]'); if (!seg) return;
      const el = $(`#spec-${seg.dataset.i}`);
      scrollToEl(el, -140);
      el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 1400);
    });
    $('#anatomy').addEventListener('mouseover', e => {
      const seg = e.target.closest('.seg[data-i]');
      $$('#specs .g-spec').forEach(sp => sp.classList.toggle('hl', !!seg && sp.dataset.i === seg.dataset.i));
    });
    $('#anatomy').addEventListener('mouseleave', () => $$('#specs .g-spec').forEach(sp => sp.classList.remove('hl')));
    $('#resetBtn').addEventListener('click', () => select(S.model));

    /* ---------------- result actions ---------------- */
    const toast = (() => {
      const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el);
      let t; return msg => { el.textContent = msg; el.classList.add('show'); clearTimeout(t); t = setTimeout(() => el.classList.remove('show'), 1800); };
    })();
    const copy = async text => {
      try { await navigator.clipboard.writeText(text); return true; } catch (e) {
        const ta = Object.assign(document.createElement('textarea'), {value: text}); ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
      }
    };
    $('#copyCode').addEventListener('click', async e => {
      const btn = e.currentTarget;
      if (await copy(build(S.model, S.sel))) {
        toast('Code copied'); btn.classList.add('copied'); $('span', btn).textContent = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); $('span', btn).textContent = 'Copy code'; }, 1600);
      }
    });
    $('#copyDesc').addEventListener('click', async () => { if (await copy(`${build(S.model, S.sel)}\n${describe(S.model, S.sel)}`)) toast('Description copied'); });
    $('#shareBtn').addEventListener('click', async () => { if (await copy(location.href)) toast('Share link copied'); });

    /* ---------------- decode ---------------- */
    const msg = $('#decodeMsg');
    const load = (raw, {scroll = true, quiet = false} = {}) => {
      const r = decode(raw);
      if (r.error) { if (!quiet) { msg.textContent = r.error; msg.className = 'decode-msg err'; } return false; }
      S.type = 'all'; S.feats.clear(); S.q = ''; $('#brSearch').value = '';
      renderTypes(); renderFeats(); renderList();
      select(r.model, r.sel);
      if (!quiet) {
        const parts = [`Decoded ${r.model.code}, ${r.model.name}.`];
        if (r.bad.length) parts.push(`Fix: ${r.bad.join('; ')}.`);
        else { const left = S.sel.filter(v => v == null).length; if (left) parts.push(`${left} option${left === 1 ? '' : 's'} still to choose.`); }
        msg.textContent = parts.join(' ');
        msg.className = 'decode-msg ' + (r.bad.length ? 'err' : 'ok');
      }
      if (scroll) setTimeout(() => scrollToEl($('#app'), -20), 80);
      return true;
    };
    $('#decodeForm').addEventListener('submit', e => { e.preventDefault(); load($('#decodeInput').value); });

    /* ---------------- recent ---------------- */
    const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; } };
    const renderRecent = () => {
      const list = readRecent();
      $('#recentSec').hidden = !list.length;
      $('#recentList').innerHTML = list.map(r => `<button class="recent" data-code="${esc(r.code)}"><code>${esc(r.code)}</code><span>${esc(r.name)}</span></button>`).join('');
    };
    let rt;
    const remember = (code, m) => {
      clearTimeout(rt);
      rt = setTimeout(() => {   // debounce so rapid option changes don't flood the list
        const list = readRecent().filter(r => r.code !== code);
        list.unshift({code, name: m.name, t: Date.now()});
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 9))); } catch (e) {}
        renderRecent();
      }, 900);
    };
    $('#recentList').addEventListener('click', e => { const b = e.target.closest('[data-code]'); if (b) load(b.dataset.code, {quiet: true}); });
    $('#clearRecent').addEventListener('click', () => { try { localStorage.removeItem(RECENT_KEY); } catch (e) {} renderRecent(); });

    /* ---------------- misc ---------------- */
    function scrollToEl(el, offset = 0) {
      const y = el.getBoundingClientRect().top + scrollY + offset;
      NW.lenis ? NW.lenis.scrollTo(y, {duration: 1.1}) : scrollTo({top: y, behavior: 'smooth'});
    }

    renderTypes(); renderFeats(); renderList(true); renderRecent();
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      $('#decodeInput').value = hash;
      load(hash, {scroll: true});
    }
  };

  window.NW ? init() : document.addEventListener('nw:ready', init, {once: true});
})();
