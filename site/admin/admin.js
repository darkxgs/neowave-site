(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const OPT_RE = /^[A-Za-z0-9.+/]+$/;
  const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9.\-/]*$/;

  const ICON = {
    grip: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.3"/><circle cx="10.5" cy="3.5" r="1.3"/><circle cx="5.5" cy="8" r="1.3"/><circle cx="10.5" cy="8" r="1.3"/><circle cx="5.5" cy="12.5" r="1.3"/><circle cx="10.5" cy="12.5" r="1.3"/></svg>',
    up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg>',
    down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>',
    del: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5"/></svg>',
  };

  /* ================= state ================= */
  const S = {data: null, me: null, cur: null, orig: null, images: null, pasteOpen: new Set()};

  /* ================= api ================= */
  async function api(method, path, body, raw) {
    const opts = {method, headers: {'X-Requested-With': 'nw-admin'}, credentials: 'same-origin'};
    if (raw) { opts.body = raw.body; opts.headers['X-Filename'] = encodeURIComponent(raw.name); opts.headers['Content-Type'] = 'application/octet-stream'; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(`/api/admin/${path}`, opts);
    const j = await r.json().catch(() => ({error: `Unexpected response (${r.status})`}));
    if (r.status === 401 && path !== 'login') { showLogin(); throw new Error(j.error); }
    if (!r.ok) { const e = new Error(j.error || `Request failed (${r.status})`); e.status = r.status; throw e; }
    return j;
  }

  /* ================= ui helpers ================= */
  function toast(msg, kind = '') {
    const t = Object.assign(document.createElement('div'), {className: `toast ${kind}`, textContent: msg});
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), kind === 'err' ? 6000 : 2600);
  }
  function confirmDlg(title, text, okLabel = 'Confirm') {
    return new Promise(res => {
      const d = $('#confirmDlg');
      $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmOk').textContent = okLabel;
      const done = v => { d.close(); res(v); };
      $('#confirmOk').onclick = () => done(true);
      $('[data-close]', d).onclick = () => done(false);
      d.oncancel = () => res(false);
      d.showModal();
    });
  }
  $$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  const typeName = id => S.data.types.find(t => t.id === id)?.name || id;
  const img = path => !path ? '' : /^https?:/.test(path) ? path : `/${path}`;
  const fmtTime = s => { const d = new Date(s); return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) + ' ' + d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'}); };

  /* ================= auth ================= */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; ($('#loginEmail').value ? $('#loginPw') : $('#loginEmail')).focus(); }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#loginForm button[type=submit]');
    $('#loginErr').textContent = ''; btn.disabled = true; btn.textContent = 'Signing in…';
    try { await api('POST', 'login', {email: $('#loginEmail').value, password: $('#loginPw').value}); $('#loginPw').value = ''; start(); }
    catch (err) { $('#loginErr').textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = 'Sign in'; }
  });
  $('#logoutBtn').addEventListener('click', async () => {
    if (isDirty() && !await confirmDlg('Discard unsaved changes?', 'You have changes that are not saved yet.', 'Sign out anyway')) return;
    S.cur = null; $('#editor').hidden = true; $('#welcome').hidden = false;
    await api('POST', 'logout', {}).catch(() => {}); showLogin();
  });

  /* ================= boot ================= */
  async function start() {
    $('#login').hidden = true; $('#app').hidden = false;
    await reload();
    $('#meEmail').textContent = S.me.email;
    $('#mType').innerHTML = '<option value="">All types</option>' + S.data.types.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  }
  async function reload() {
    S.data = await api('GET', 'bootstrap');
    S.me = S.data.me;
    renderList(); renderFeaturesPane(); setPubState(!S.data.publish.unpublished, S.data.publish.last);
  }
  (async () => {
    try { (await api('GET', 'session')).user ? start() : showLogin(); }
    catch (e) { showLogin(); $('#loginErr').textContent = e.message.includes('configured') ? e.message : ''; }
  })();

  /* ================= tabs ================= */
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('on', x === t));
    $$('.side-pane').forEach(p => p.hidden = p.id !== `pane-${t.dataset.tab}`);
    if (t.dataset.tab === 'activity') loadActivity();
    if (t.dataset.tab === 'team') loadTeam();
  }));

  /* ================= model list ================= */
  function renderList() {
    const q = $('#mSearch').value.trim().toLowerCase();
    const type = $('#mType').value, showHidden = $('#mHidden').checked;
    const list = S.data.models.filter(m => (showHidden || m.active) && (!type || m.type_id === type) &&
      (!q || `${m.base_code} ${m.name}`.toLowerCase().includes(q)));
    const groups = S.data.types.map(t => [t, list.filter(m => m.type_id === t.id)]).filter(([, ms]) => ms.length);
    $('#mList').innerHTML = groups.map(([t, ms]) => `<div class="m-group">${esc(t.name)} · ${ms.length}</div>` + ms.map(m => `
      <button class="m-item${S.cur?.id === m.id ? ' on' : ''}" data-id="${m.id}" type="button">
        <span class="m-thumb">${m.image_path ? `<img src="${esc(img(m.image_path))}" alt="" loading="lazy">` : 'no<br>photo'}</span>
        <span class="m-txt"><b>${esc(m.base_code)}</b><span>${esc(m.name)}</span></span>
        <span class="m-badges"><span class="badge">${m.spec_count ? m.spec_count + ' segs' : 'fixed'}</span>
          ${m.active ? '' : '<span class="badge hidden">hidden</span>'}${m.active && !m.has_datasheet ? '<span class="badge warn">no datasheet</span>' : ''}</span>
      </button>`).join('')).join('') || '<p class="side-note">No models match.</p>';
  }
  $('#mSearch').addEventListener('input', renderList);
  $('#mType').addEventListener('change', renderList);
  $('#mHidden').addEventListener('change', renderList);
  $('#mList').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) openModel(+b.dataset.id); });
  $('#newModel').addEventListener('click', async () => {
    if (!await guard()) return;
    const t = $('#mType').value || S.data.types[0].id;
    setCurrent({id: null, base_code: '', name: '', type_id: t, description: '', datasheet_url: '', manual_url: '', image_path: '',
                active: true, superseded_by: '', specs: [], features: []});
    $('#editor [data-f="base_code"]').focus();
  });

  /* ================= editor lifecycle ================= */
  const snapshot = m => JSON.stringify({...m, updated_at: undefined});
  const isDirty = () => !!S.cur && snapshot(S.cur) !== S.orig;
  async function guard() {
    return !isDirty() || confirmDlg('Discard unsaved changes?', `Your changes to ${S.cur.base_code || 'this new model'} haven't been saved.`, 'Discard changes');
  }
  async function openModel(id) {
    if (S.cur?.id === id || !await guard()) return;
    try { setCurrent(await api('GET', `models/${id}`)); } catch (e) { toast(e.message, 'err'); }
  }
  function setCurrent(m) {
    m.specs.forEach(s => s.options.forEach(o => { o.code ??= ''; o.label ??= ''; }));
    ['description', 'datasheet_url', 'manual_url', 'image_path', 'superseded_by'].forEach(k => { m[k] ??= ''; });
    S.cur = m; S.orig = snapshot(m); S.pasteOpen.clear();
    $('#welcome').hidden = true; $('#editor').hidden = false;
    renderEditor(); renderList();
    $('#main').scrollTop = 0;
  }
  addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && S.cur) { e.preventDefault(); save(); } });

  /* ================= editor render ================= */
  function renderEditor() {
    const m = S.cur;
    const typeOpts = S.data.types.map(t => `<option value="${t.id}"${t.id === m.type_id ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    $('#editor').innerHTML = `
      <div class="ed-head">
        <div class="ed-title"><small id="edType"></small><h1 id="edTitle"></h1></div>
        <div class="ed-actions">
          <span class="dirty-dot">Unsaved changes</span>
          <label class="status"><input type="checkbox" data-f="active"${m.active ? ' checked' : ''}><i></i><span id="edStatus">${m.active ? 'Visible' : 'Hidden'}</span></label>
          ${m.id ? '<button class="btn btn-ghost btn-sm" data-act="duplicate" type="button">Duplicate</button><button class="btn btn-ghost btn-sm" data-act="delete" type="button">Delete</button>' : ''}
          <button class="btn btn-primary" data-act="save" type="button" id="saveBtn">${m.id ? 'Save changes' : 'Create model'}</button>
        </div>
      </div>
      <div class="errors" id="edErrors" hidden></div>
      <div class="ed-top">
        <div class="card">
          <div class="card-h"><b>Details</b><span>Shown in the generator and on quotes</span></div>
          <div class="grid3">
            <label class="fld"><span>Model code</span><input class="inp mono" data-f="base_code" value="${esc(m.base_code)}" placeholder="TxTH29" spellcheck="false"></label>
            <label class="fld"><span>Name</span><input class="inp" data-f="name" value="${esc(m.name)}" placeholder="Temperature &amp; Humidity Sensor"></label>
            <label class="fld"><span>Product type</span><select class="inp" data-f="type_id">${typeOpts}</select></label>
          </div>
          <label class="fld mt14"><span>Description <em>(optional)</em></span><textarea class="inp" rows="3" data-f="description">${esc(m.description)}</textarea></label>
          <div class="grid2 mt14">
            <label class="fld"><span>Datasheet URL</span><input class="inp" data-f="datasheet_url" value="${esc(m.datasheet_url)}" placeholder="https://neowave.tech/wp-content/uploads/….pdf"></label>
            <label class="fld"><span>Manual URL <em>(optional)</em></span><input class="inp" data-f="manual_url" value="${esc(m.manual_url)}" placeholder="https://…"></label>
          </div>
          <label class="fld mt14" id="supWrap"${m.active ? ' hidden' : ''}><span>Superseded by <em>(optional, for hidden legacy models)</em></span><input class="inp mono" data-f="superseded_by" value="${esc(m.superseded_by)}" placeholder="TxTHO23"></label>
        </div>
        <div class="card">
          <div class="card-h"><b>Photo</b></div>
          <div class="photo" id="edPhoto"></div>
          <div class="photo-actions">
            <button class="btn btn-ghost btn-sm" data-act="img-lib" type="button">Library</button>
            <button class="btn btn-ghost btn-sm" data-act="img-upload" type="button">Upload</button>
            <button class="btn btn-ghost btn-sm" data-act="img-remove" type="button"${m.image_path ? '' : ' hidden'}>Remove</button>
          </div>
          <input type="file" id="imgFile" accept="image/png,image/jpeg,image/webp" hidden>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><b>Features</b><span>Filter chips this model appears under</span></div>
        <div class="chips" id="edFeats"></div>
      </div>
      <div class="preview" id="edPreview"></div>
      <div class="card-h segs-title"><b>Code segments</b><span>Drag to reorder · segment order = code order</span></div>
      <div class="specs-ed" id="edSpecs"></div>
      <button class="add-spec" data-act="add-spec" type="button">+ Add code segment</button>`;
    renderPhoto(); renderFeats(); renderSpecs(); refresh();
  }

  function renderPhoto() {
    $('#edPhoto').innerHTML = S.cur.image_path ? `<img src="${esc(img(S.cur.image_path))}" alt="">` : 'No photo yet.<br>The generator shows a type icon instead.';
    const rm = $('[data-act="img-remove"]'); if (rm) rm.hidden = !S.cur.image_path;
  }
  function renderFeats() {
    const feats = S.data.features.filter(f => f.type_id === S.cur.type_id);
    $('#edFeats').innerHTML = feats.length
      ? feats.map(f => `<button type="button" class="chip${S.cur.features.includes(f.id) ? ' on' : ''}" data-act="feat" data-id="${esc(f.id)}">${esc(f.name)}</button>`).join('')
      : `<span class="chips-empty">No features for ${esc(typeName(S.cur.type_id))} yet. Add them in the Features tab.</span>`;
  }
  function renderSpecs(focus) {
    const m = S.cur;
    $('#edSpecs').innerHTML = m.specs.map((s, i) => `
      <div class="sp" data-sp="${i}">
        <div class="sp-head">
          <span class="handle" data-drag="sp" title="Drag to reorder">${ICON.grip}</span>
          <span class="sp-n">${String(i + 1).padStart(2, '0')}</span>
          <input class="inp sp-name" data-sp="${i}" data-k="name" value="${esc(s.name)}" placeholder="Segment name, e.g. Output">
          <div class="row-btns">
            <button class="icon-btn" type="button" data-act="sp-up" data-sp="${i}" title="Move up"${i ? '' : ' disabled'}>${ICON.up}</button>
            <button class="icon-btn" type="button" data-act="sp-down" data-sp="${i}" title="Move down"${i < m.specs.length - 1 ? '' : ' disabled'}>${ICON.down}</button>
            <button class="icon-btn" type="button" data-act="sp-del" data-sp="${i}" title="Delete segment">${ICON.del}</button>
          </div>
        </div>
        <div class="sp-body">
          ${s.options.length ? '<div class="opt-head"><span></span><span>Code</span><span>Label</span><span></span></div>' : ''}
          <div class="opt-table">
            ${s.options.map((o, j) => `
              <div class="opt-row" data-sp="${i}" data-op="${j}">
                <span class="handle" data-drag="op" title="Drag to reorder">${ICON.grip}</span>
                <input class="inp mono" data-sp="${i}" data-op="${j}" data-k="code" value="${esc(o.code)}" placeholder="V10" spellcheck="false">
                <input class="inp" data-sp="${i}" data-op="${j}" data-k="label" value="${esc(o.label)}" placeholder="0~10VDC (3-wire)">
                <div class="row-btns">
                  <button class="icon-btn" type="button" data-act="op-up" data-sp="${i}" data-op="${j}" title="Move up"${j ? '' : ' disabled'}>${ICON.up}</button>
                  <button class="icon-btn" type="button" data-act="op-down" data-sp="${i}" data-op="${j}" title="Move down"${j < s.options.length - 1 ? '' : ' disabled'}>${ICON.down}</button>
                  <button class="icon-btn" type="button" data-act="op-del" data-sp="${i}" data-op="${j}" title="Delete option">${ICON.del}</button>
                </div>
              </div>`).join('')}
          </div>
          <div class="sp-foot">
            <button class="btn btn-ghost btn-sm" type="button" data-act="op-add" data-sp="${i}">+ Add option</button>
            <button class="btn btn-ghost btn-sm" type="button" data-act="paste-toggle" data-sp="${i}">Paste list…</button>
          </div>
          <div class="paste" data-paste="${i}"${S.pasteOpen.has(i) ? '' : ' hidden'}>
            <p>One option per line, code first: <code>V10 = 0~10VDC (3-wire)</code>. A tab or <code>:</code> also works. Options are added to the end.</p>
            <textarea class="inp mono" rows="5" data-paste-text="${i}" placeholder="V10 = 0~10VDC (3-wire)&#10;A = 4~20mA (2-wire)&#10;RS = RS485/Modbus"></textarea>
            <div><button class="btn btn-dark btn-sm" type="button" data-act="paste-apply" data-sp="${i}">Add options</button></div>
          </div>
        </div>
      </div>`).join('') || '<div class="card empty-card">No code segments. The ordering code is just the model code.</div>';
    if (focus) { const el = $(focus, $('#edSpecs')); if (el) { el.focus(); el.select?.(); } }
    refresh();
  }

  /* live preview, validation hints, dirty state */
  function refresh() {
    const m = S.cur;
    const segs = m.specs.map((s, i) => {
      const c = s.options[0]?.code || '?';
      const bad = !s.options.length || s.options.some(o => !OPT_RE.test(o.code));
      return `<span class="pv-dash">-</span><span class="pv-seg${bad ? ' bad' : ''}"><span>${esc(c)}</span><small>${esc(s.name || `Segment ${i + 1}`)}</small></span>`;
    }).join('');
    const example = [m.base_code || 'CODE', ...m.specs.map(s => s.options[0]?.code || '?')].join('-');
    const combos = m.specs.reduce((n, s) => n * Math.max(1, s.options.length), 1);
    $('#edPreview').innerHTML = `<div class="pv-label"><span>Code preview</span><span>${combos.toLocaleString()} possible code${combos === 1 ? '' : 's'}</span></div>
      <div class="pv-code"><span class="pv-seg base"><span>${esc(m.base_code || 'CODE')}</span><small>Model</small></span>${segs}</div>
      <p class="pv-note">Example (first option of each segment): <b class="pv-example">${esc(example)}</b></p>`;
    $$('#editor input[data-k="code"]').forEach(inp => {
      const s = m.specs[inp.dataset.sp], v = inp.value.trim().toLowerCase();
      const dup = v && s.options.filter(o => o.code.trim().toLowerCase() === v).length > 1;
      inp.classList.toggle('bad', !!inp.value && (!OPT_RE.test(inp.value.trim()) || dup));
      inp.title = dup ? 'Duplicate code in this segment' : (inp.value && !OPT_RE.test(inp.value.trim()) ? 'No dashes or spaces' : '');
    });
    const bc = $('#editor [data-f="base_code"]');
    if (bc) bc.classList.toggle('bad', !!bc.value && !CODE_RE.test(bc.value.trim()));
    $('#edTitle').textContent = m.base_code || 'New model';
    $('#edType').textContent = typeName(m.type_id) + (m.id ? '' : ' · new model');
    $('#editor').classList.toggle('is-dirty', isDirty());
    $('#saveBtn').disabled = !isDirty();
  }

  /* ================= editor events ================= */
  const ed = $('#editor');
  ed.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f) {
      const k = t.dataset.f;
      S.cur[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'type_id') { S.cur.features = []; renderFeats(); }
      if (k === 'active') { $('#edStatus').textContent = t.checked ? 'Visible' : 'Hidden'; $('#supWrap').hidden = t.checked; }
    } else if (t.dataset.k) {
      const s = S.cur.specs[t.dataset.sp];
      if (t.dataset.op != null) s.options[t.dataset.op][t.dataset.k] = t.value; else s[t.dataset.k] = t.value;
    }
    refresh();
  });
  ed.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.dataset.k === 'label') {
      e.preventDefault();
      const i = +e.target.dataset.sp, j = +e.target.dataset.op;
      if (j === S.cur.specs[i].options.length - 1) act('op-add', i);
      else $(`input[data-sp="${i}"][data-op="${j + 1}"][data-k="code"]`, ed)?.focus();
    }
  });
  ed.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    act(b.dataset.act, b.dataset.sp != null ? +b.dataset.sp : null, b.dataset.op != null ? +b.dataset.op : null, b);
  });

  const move = (arr, from, to) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };
  async function act(a, i, j, el) {
    const m = S.cur;
    switch (a) {
      case 'save': return save();
      case 'delete': return remove();
      case 'duplicate':
        if (!await guard()) return;
        setCurrent({...clone(m), id: null, updated_at: undefined, base_code: m.base_code + '-COPY', name: m.name + ' (copy)'});
        S.orig = ''; refresh(); toast('Copy created. Change its code, then save.'); return;
      case 'feat': {
        const f = el.dataset.id;
        m.features = m.features.includes(f) ? m.features.filter(x => x !== f) : [...m.features, f];
        el.classList.toggle('on'); return refresh();
      }
      case 'add-spec':
        m.specs.push({name: '', options: [{code: '', label: ''}]});
        return renderSpecs(`.sp[data-sp="${m.specs.length - 1}"] .sp-name`);
      case 'sp-up': move(m.specs, i, i - 1); return renderSpecs();
      case 'sp-down': move(m.specs, i, i + 1); return renderSpecs();
      case 'sp-del':
        if (m.specs[i].options.some(o => o.code || o.label) &&
            !await confirmDlg('Delete this segment?', `“${m.specs[i].name || 'Untitled'}” and its ${m.specs[i].options.length} option(s) will be removed when you save.`, 'Delete segment')) return;
        m.specs.splice(i, 1); return renderSpecs();
      case 'op-add':
        m.specs[i].options.push({code: '', label: ''});
        return renderSpecs(`input[data-sp="${i}"][data-op="${m.specs[i].options.length - 1}"][data-k="code"]`);
      case 'op-up': move(m.specs[i].options, j, j - 1); return renderSpecs();
      case 'op-down': move(m.specs[i].options, j, j + 1); return renderSpecs();
      case 'op-del': m.specs[i].options.splice(j, 1); return renderSpecs();
      case 'paste-toggle':
        S.pasteOpen.has(i) ? S.pasteOpen.delete(i) : S.pasteOpen.add(i);
        $(`[data-paste="${i}"]`, ed).hidden = !S.pasteOpen.has(i);
        if (S.pasteOpen.has(i)) $(`[data-paste-text="${i}"]`, ed).focus();
        return;
      case 'paste-apply': {
        const lines = $(`[data-paste-text="${i}"]`, ed).value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const parsed = lines.map(l => { const mm = l.match(/^([^\s=:\t]+)\s*(?:=|:|\t|\s-\s|\s{2,})\s*(.+)$/); return mm ? {code: mm[1], label: mm[2].trim()} : {code: l, label: ''}; });
        m.specs[i].options = [...m.specs[i].options.filter(o => o.code || o.label), ...parsed];
        S.pasteOpen.delete(i);
        toast(`Added ${parsed.length} option${parsed.length === 1 ? '' : 's'}`);
        return renderSpecs();
      }
      case 'img-lib': return openLibrary();
      case 'img-upload': return $('#imgFile').click();
      case 'img-remove': m.image_path = ''; renderPhoto(); return refresh();
    }
  }

  /* ================= drag & drop (segments and options) ================= */
  let drag = null;
  ed.addEventListener('pointerdown', e => {
    const h = e.target.closest('.handle'); if (!h) return;
    (h.dataset.drag === 'sp' ? h.closest('.sp') : h.closest('.opt-row')).draggable = true;
  });
  addEventListener('pointerup', () => { if (!drag) $$('[draggable="true"]', ed).forEach(x => x.draggable = false); });
  ed.addEventListener('dragstart', e => {
    const item = e.target.closest('[draggable="true"]'); if (!item) return;
    drag = item.classList.contains('sp') ? {kind: 'sp', from: +item.dataset.sp} : {kind: 'op', sp: +item.dataset.sp, from: +item.dataset.op};
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', '');
  });
  ed.addEventListener('dragover', e => {
    if (!drag) return;
    const over = drag.kind === 'sp' ? e.target.closest('.sp') : e.target.closest(`.opt-row[data-sp="${drag.sp}"]`);
    $$('.drop-before, .drop-after', ed).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    if (!over) return;
    e.preventDefault();
    const r = over.getBoundingClientRect();
    over.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  ed.addEventListener('drop', e => {
    if (!drag) return;
    const over = $('.drop-before, .drop-after', ed); if (!over) return;
    e.preventDefault();
    const after = over.classList.contains('drop-after');
    const arr = drag.kind === 'sp' ? S.cur.specs : S.cur.specs[drag.sp].options;
    let to = +(drag.kind === 'sp' ? over.dataset.sp : over.dataset.op) + (after ? 1 : 0);
    if (to > drag.from) to--;
    if (to !== drag.from) { move(arr, drag.from, to); renderSpecs(); }
  });
  ed.addEventListener('dragend', () => {
    drag = null;
    $$('[draggable="true"]', ed).forEach(x => { x.draggable = false; x.classList.remove('dragging'); });
    $$('.drop-before, .drop-after', ed).forEach(x => x.classList.remove('drop-before', 'drop-after'));
  });

  /* ================= save / delete ================= */
  function clientErrors(m) {
    const errs = [];
    if (!m.base_code.trim()) errs.push('Model code is required.');
    else if (!CODE_RE.test(m.base_code.trim())) errs.push('Model code may only contain letters, digits, dots, slashes and dashes.');
    if (!m.name.trim()) errs.push('Name is required.');
    m.specs.forEach((s, i) => {
      const n = s.name.trim() || `Segment ${i + 1}`;
      if (!s.name.trim()) errs.push(`Segment ${i + 1} needs a name.`);
      if (!s.options.length) errs.push(`“${n}” needs at least one option.`);
      const seen = new Set();
      s.options.forEach(o => {
        const c = o.code.trim();
        if (!c) errs.push(`“${n}”: every option needs a code.`);
        else if (!OPT_RE.test(c)) errs.push(`“${n}”: “${c}” may not contain dashes or spaces.`);
        else if (seen.has(c.toLowerCase())) errs.push(`“${n}”: “${c}” is used twice.`);
        seen.add(c.toLowerCase());
        if (!o.label.trim()) errs.push(`“${n}”: option “${c || '?'}” needs a label.`);
      });
    });
    return [...new Set(errs)];
  }
  function showErrors(list) {
    const box = $('#edErrors');
    box.hidden = !list.length;
    box.innerHTML = list.length ? `<b>Can't save yet:</b><br>${list.map(esc).join('<br>')}` : '';
    if (list.length) box.scrollIntoView({behavior: 'smooth', block: 'center'});
  }
  let saving = false;
  async function save() {
    if (!S.cur || saving || !isDirty()) return;
    const errs = clientErrors(S.cur);
    showErrors(errs); if (errs.length) return;
    saving = true; $('#saveBtn').disabled = true; $('#saveBtn').textContent = 'Saving…';
    try {
      const isNew = S.cur.id == null;
      const saved = await api(isNew ? 'POST' : 'PUT', isNew ? 'models' : `models/${S.cur.id}`, S.cur);
      setCurrent(saved);
      await reload();
      toast(isNew ? `${saved.base_code} created` : `${saved.base_code} saved`, 'ok');
    } catch (e) {
      if (e.status === 409) {
        if (await confirmDlg('Changed elsewhere', e.message, 'Reload model')) { const id = S.cur.id; S.orig = snapshot(S.cur); S.cur = null; openModel(id); }
      } else { showErrors([e.message]); toast(e.message, 'err'); }
    } finally {
      saving = false;
      if ($('#saveBtn') && S.cur) { $('#saveBtn').textContent = S.cur.id ? 'Save changes' : 'Create model'; refresh(); }
    }
  }
  async function remove() {
    const m = S.cur;
    if (!await confirmDlg(`Delete ${m.base_code}?`, 'This permanently removes the model and all its code segments. Tip: switch it to Hidden instead if you might need it again.', 'Delete model')) return;
    try {
      await api('DELETE', `models/${m.id}`);
      S.cur = null; $('#editor').hidden = true; $('#welcome').hidden = false;
      await reload(); toast(`${m.base_code} deleted`, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ================= photos ================= */
  async function openLibrary() {
    const d = $('#imgDlg');
    if (!S.images) {
      const [site, up] = await Promise.all([
        fetch('/assets/data/images.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : []).catch(() => []),
        api('GET', 'images').catch(() => ({uploads: []})),
      ]);
      S.images = [...up.uploads, ...site];
    }
    const draw = () => {
      const q = $('#imgSearch').value.toLowerCase();
      $('#imgGrid').innerHTML = S.images.filter(p => p.toLowerCase().includes(q)).map(p => `
        <button class="img-pick${p === S.cur.image_path ? ' on' : ''}" data-path="${esc(p)}" type="button">
          <div><img src="${esc(img(p))}" alt="" loading="lazy"></div><span>${esc(decodeURIComponent(p.split('/').pop()))}</span></button>`).join('')
        || '<p class="side-note">No photos match.</p>';
    };
    $('#imgSearch').oninput = draw; $('#imgSearch').value = ''; draw();
    $('#imgGrid').onclick = e => {
      const b = e.target.closest('[data-path]'); if (!b) return;
      S.cur.image_path = b.dataset.path; renderPhoto(); refresh(); d.close();
    };
    d.showModal();
  }
  document.addEventListener('change', async e => {
    if (e.target.id !== 'imgFile' || !e.target.files[0]) return;
    const f = e.target.files[0];
    if (f.size > 4 * 1024 * 1024) { toast('Images must be under 4 MB.', 'err'); e.target.value = ''; return; }
    try {
      const r = await api('POST', 'images', undefined, {body: f, name: f.name});
      S.images = null; S.cur.image_path = r.path; renderPhoto(); refresh(); toast('Photo uploaded', 'ok');
    } catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  });

  /* ================= features pane ================= */
  function renderFeaturesPane() {
    $('#fList').innerHTML = S.data.types.map(t => {
      const fs = S.data.features.filter(f => f.type_id === t.id);
      return `<div class="f-group"><h4>${esc(t.name)}</h4>
        ${fs.map(f => `<div class="f-row"><input class="inp" value="${esc(f.name)}" data-fid="${esc(f.id)}" aria-label="Feature name"><span class="badge" title="Models using it">${f.uses}</span>
          <button class="icon-btn" type="button" data-fdel="${esc(f.id)}" data-uses="${f.uses}" title="Delete feature">${ICON.del}</button></div>`).join('')}
        <div class="f-add"><input class="inp" placeholder="New feature…" data-fnew="${t.id}"><button class="btn btn-dark btn-sm" type="button" data-fadd="${t.id}">Add</button></div></div>`;
    }).join('');
  }
  $('#fList').addEventListener('change', async e => {
    const id = e.target.dataset.fid; if (!id) return;
    try { await api('PUT', `features/${encodeURIComponent(id)}`, {name: e.target.value}); await afterFeatureChange('Feature renamed'); }
    catch (err) { toast(err.message, 'err'); renderFeaturesPane(); }
  });
  $('#fList').addEventListener('click', async e => {
    const add = e.target.closest('[data-fadd]'), del = e.target.closest('[data-fdel]');
    try {
      if (add) {
        await api('POST', 'features', {type_id: add.dataset.fadd, name: $(`[data-fnew="${add.dataset.fadd}"]`).value});
        await afterFeatureChange('Feature added');
      } else if (del) {
        const n = +del.dataset.uses;
        if (!await confirmDlg('Delete feature?', n ? `${n} model(s) use this feature. It will be removed from them.` : 'No models use this feature.', 'Delete feature')) return;
        await api('DELETE', `features/${encodeURIComponent(del.dataset.fdel)}`);
        await afterFeatureChange('Feature deleted');
      }
    } catch (err) { toast(err.message, 'err'); }
  });
  $('#fList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.fnew) $(`[data-fadd="${e.target.dataset.fnew}"]`).click(); });
  async function afterFeatureChange(msg) {
    await reload(); toast(msg, 'ok');
    if (S.cur) { S.cur.features = S.cur.features.filter(f => S.data.features.some(x => x.id === f)); renderFeats(); refresh(); }
  }

  /* ================= activity ================= */
  async function loadActivity() {
    try {
      const rows = await api('GET', 'audit');
      $('#aList').innerHTML = rows.map(r => `<div class="a-item"><time>${fmtTime(r.at)}</time><div><span class="a-act ${esc(r.action.replace(/\W.*/, ''))}">${esc(r.action)}</span>
        <b>${esc(r.base_code || '')}</b> <span>${esc(r.detail)}</span>${r.actor ? `<div class="a-who">${esc(r.actor)}</div>` : ''}</div></div>`).join('') || '<p class="side-note">No changes yet.</p>';
    } catch (e) { /* signed out */ }
  }

  /* ================= team ================= */
  async function loadTeam() {
    try {
      const users = await api('GET', 'users');
      $('#uList').innerHTML = users.map(u => `<div class="u-row"><div><b>${esc(u.name || u.email)}</b><span>${esc(u.email)}</span>
          <small>${u.last_login_at ? 'Last sign-in ' + fmtTime(u.last_login_at) : 'Never signed in'}</small></div>
        ${u.id === S.me.id ? '<span class="badge">you</span>' : `<button class="icon-btn" type="button" data-udel="${u.id}" data-email="${esc(u.email)}" title="Remove admin">${ICON.del}</button>`}</div>`).join('');
    } catch (e) { toast(e.message, 'err'); }
  }
  $('#uAddForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const r = await api('POST', 'users', {email: $('#uEmail').value, name: $('#uName').value});
      $('#uEmail').value = ''; $('#uName').value = '';
      $('#newUserEmail').textContent = r.email; $('#newUserPw').textContent = r.tempPassword;
      $('#newUserDlg').showModal(); loadTeam();
    } catch (err) { toast(err.message, 'err'); }
  });
  $('#uList').addEventListener('click', async e => {
    const b = e.target.closest('[data-udel]'); if (!b) return;
    if (!await confirmDlg(`Remove ${b.dataset.email}?`, 'They will no longer be able to sign in to the admin.', 'Remove admin')) return;
    try { await api('DELETE', `users/${b.dataset.udel}`); toast('Admin removed', 'ok'); loadTeam(); } catch (err) { toast(err.message, 'err'); }
  });
  $('#copyNewPw').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${$('#newUserEmail').textContent}\n${$('#newUserPw').textContent}`); toast('Copied', 'ok'); } catch (e) { /* manual copy */ }
  });

  /* ================= account: change password ================= */
  $('#pwBtn').addEventListener('click', () => { $('#pwForm').reset(); $('#pwErr').textContent = ''; $('#pwDlg').showModal(); $('#pwCurrent').focus(); });
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#pwNext').value !== $('#pwNext2').value) { $('#pwErr').textContent = "The new passwords don't match."; return; }
    try {
      await api('POST', 'password', {current: $('#pwCurrent').value, next: $('#pwNext').value});
      $('#pwDlg').close(); toast('Password changed. Other sessions were signed out.', 'ok');
    } catch (err) { $('#pwErr').textContent = err.message; }
  });

  /* ================= publish ================= */
  function setPubState(clean, last) {
    const el = $('#pubState');
    el.classList.toggle('dirty', !clean);
    el.textContent = clean ? 'Site is up to date' : 'Unpublished changes';
    el.title = last ? `Last published ${fmtTime(last.created_at)}${last.created_by ? ' by ' + last.created_by : ''}` : 'Not published yet';
  }
  $('#publishBtn').addEventListener('click', async () => {
    if (isDirty() && !await confirmDlg('Publish without your unsaved changes?', 'Only saved changes are published. Save first to include what you are editing.', 'Publish anyway')) return;
    const b = $('#publishBtn'); b.disabled = true; b.textContent = 'Publishing…';
    try {
      const r = await api('POST', 'publish', {});
      toast(`Published ${r.models} models. The public generator updates within a minute.`, 'ok');
      await reload();
    } catch (e) { toast(e.message, 'err'); }
    finally { b.disabled = false; b.textContent = 'Publish to site'; }
  });
})();
