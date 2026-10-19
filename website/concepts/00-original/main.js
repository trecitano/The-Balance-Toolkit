// The Balance Toolkit page: the live board, the working fragments and the motion layer.
(() => {
  const doc = document.documentElement;
  doc.classList.add('js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n, d = 2) => n.toFixed(d);
  const signed = (n, d = 3) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);

  // Same formula as BalanceBoardCalibratedReading::calculate_cop in toolkit-core.
  const cop = (tr, br, tl, bl) => {
    const w = tr + br + tl + bl;
    if (Math.abs(w) < 0.1) return { w, x: 0, y: 0 };
    return { w, x: (tr + br - (tl + bl)) / w, y: (tr + tl - (br + bl)) / w };
  };
  // Splits a total load into four sensor loads that produce the given CoP.
  const split = (w, x, y) => ({
    tr: (w * (1 + x) * (1 + y)) / 4,
    br: (w * (1 + x) * (1 - y)) / 4,
    tl: (w * (1 - x) * (1 + y)) / 4,
    bl: (w * (1 - x) * (1 - y)) / 4,
  });

  /* ---------- Hero board ---------- */
  const area = $('#board-area');
  if (area) {
    const out = { tr: $('#s-tr b'), br: $('#s-br b'), tl: $('#s-tl b'), bl: $('#s-bl b') };
    const rW = $('#r-w'), rX = $('#r-x'), rY = $('#r-y');
    const dot = $('#board-dot'), trail = $('#board-trail'), state = $('#board-state');
    const W = 72;
    let stance = 'both';
    let pointer = null; // target CoP from the pointer, or null when idle
    let px = 0, py = 0, vx = 0, vy = 0, t0 = performance.now();
    const pts = [];

    const toCop = (e) => {
      const r = area.getBoundingClientRect();
      // The sensors sit inside the drawn board, roughly the inner 70% x 74%.
      const nx = ((e.clientX - r.left) / r.width - 0.5) / 0.35;
      const ny = -((e.clientY - r.top) / r.height - 0.5) / 0.37;
      return { x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) };
    };
    area.addEventListener('pointermove', (e) => { pointer = toCop(e); });
    area.addEventListener('pointerdown', (e) => { pointer = toCop(e); area.setPointerCapture?.(e.pointerId); });
    area.addEventListener('pointerleave', () => { pointer = null; });
    area.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointer = null; });

    $$('.seg').forEach((b) => b.addEventListener('click', () => {
      stance = b.dataset.stance;
      $$('.seg').forEach((s) => { const on = s === b; s.classList.toggle('is-on', on); s.setAttribute('aria-pressed', on); });
    }));

    const frame = (now) => {
      const t = (now - t0) / 1000;
      const one = stance === 'left';
      // Quiet standing sways a few millimetres; on one leg the sway grows and the CoP moves over the standing (right) foot.
      const amp = reduced ? 0 : one ? 0.11 : 0.035;
      const sx = amp * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.7 + 1) * 0.25 + Math.sin(t * 7.9) * (one ? 0.25 : 0.1));
      const sy = amp * 1.4 * (Math.sin(t * 0.9 + 2) * 0.6 + Math.sin(t * 2.9) * 0.3 + Math.sin(t * 6.1 + 0.5) * (one ? 0.2 : 0.08));
      const base = pointer || { x: one ? 0.3 : 0.02, y: one ? 0.05 : -0.04 };
      const tx = base.x + sx, ty = base.y + sy;
      // A soft spring so the dot moves like a body, not a cursor.
      vx = (vx + (tx - px) * 0.08) * 0.78;
      vy = (vy + (ty - py) * 0.08) * 0.78;
      px = Math.max(-1, Math.min(1, px + vx));
      py = Math.max(-1, Math.min(1, py + vy));

      const s = split(W + Math.sin(t * 2.1) * 0.08, px, py);
      const c = cop(s.tr, s.br, s.tl, s.bl);
      out.tr.textContent = fmt(s.tr); out.br.textContent = fmt(s.br);
      out.tl.textContent = fmt(s.tl); out.bl.textContent = fmt(s.bl);
      rW.textContent = fmt(c.w); rX.textContent = signed(c.x); rY.textContent = signed(c.y);
      dot.setAttribute('cx', c.x.toFixed(4)); dot.setAttribute('cy', (-c.y).toFixed(4));
      pts.push(`${c.x.toFixed(3)},${(-c.y).toFixed(3)}`);
      if (pts.length > 90) pts.shift();
      trail.setAttribute('points', pts.join(' '));
      state.textContent = pointer ? 'Your weight' : one ? 'Left leg up' : 'Quiet standing';
      if (!document.hidden) requestAnimationFrame(frame);
    };
    const start = () => { if (!document.hidden) requestAnimationFrame(frame); };
    document.addEventListener('visibilitychange', start);
    if (reduced) {
      // Still live under reduced motion: it follows the pointer, but does not sway on its own.
      requestAnimationFrame(frame);
    } else start();
  }

  /* ---------- Trial length figure ---------- */
  const slider = $('#trial-s');
  if (slider) {
    const n = $('#rows-n'), o = $('#trial-out');
    const presets = $$('.slider-presets button');
    const set = () => {
      const s = +slider.value;
      o.textContent = `${s} s`;
      n.textContent = (s * 100).toLocaleString('en-GB');
      presets.forEach((p) => p.classList.toggle('is-on', +p.dataset.s === s));
    };
    slider.addEventListener('input', set);
    presets.forEach((p) => p.addEventListener('click', () => { slider.value = p.dataset.s; set(); }));
    set();
  }

  /* ---------- Session panel ---------- */
  $$('.note').forEach((note) => {
    const row = document.getElementById(note.dataset.for);
    const on = (v) => { row?.classList.toggle('is-lit', v); note.classList.toggle('is-on', v); };
    note.addEventListener('mouseenter', () => on(true));
    note.addEventListener('mouseleave', () => on(false));
    note.addEventListener('focus', () => on(true));
    note.addEventListener('blur', () => on(false));
    note.addEventListener('click', () => row?.querySelector('select, input, button')?.focus());
  });
  const tareBtn = $('#pu-tare-btn');
  tareBtn?.addEventListener('click', () => {
    $('#pu-tare-out').textContent = 'TR 0.00  BR 0.00  TL 0.00  BL 0.00';
    tareBtn.textContent = 'Tared';
  });
  $$('.pu-check input').forEach((c) => c.addEventListener('change', () => { c.parentElement.querySelector('em').textContent = c.checked ? 'ON' : 'OFF'; }));
  const rec = $('#pu-rec');
  if (rec) {
    let timer = null, secs = 0;
    const total = { 'Eyes open-close': 40, 'Functional Reach Test': 144, 'Single leg stance': 128, 'Tandem stance': 128, 'Timed Up and Go (TUG)': 144, 'Squat': 24, 'None': 0 };
    const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const act = $('#pu-act');
    const show = () => {
      const tot = total[act.value] || 0;
      $('#pu-time').textContent = tot ? `${mmss(secs)}/${mmss(tot)}` : mmss(secs);
      $('#pu-loop').textContent = tot ? `Loop ${secs < tot / 2 ? 1 : 2}/2` : 'Free recording';
    };
    act.addEventListener('change', () => { secs = 0; show(); });
    rec.addEventListener('click', () => {
      const going = !timer;
      rec.classList.toggle('is-rec', going);
      rec.setAttribute('aria-label', going ? 'Stop recording' : 'Start recording');
      if (going) timer = setInterval(() => { secs++; const tot = total[act.value]; if (tot && secs >= tot) secs = 0; show(); }, 1000);
      else { clearInterval(timer); timer = null; }
    });
    show();
  }

  /* ---------- Pinned stage ---------- */
  const stage = $('#stage-ui');
  const steps = $$('.step');
  if (stage && steps.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        steps.forEach((s) => s.classList.toggle('is-active', s === e.target));
        stage.dataset.state = e.target.dataset.state;
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
    // The stream state keeps printing samples while it is shown.
    const so = $('#stream-out');
    let k = 0;
    setInterval(() => {
      if (reduced || stage.dataset.state !== 'stream') return;
      k++;
      const s = split(72 + Math.sin(k / 3) * 0.06, 0.045 + Math.sin(k / 4) * 0.01, -0.02 + Math.cos(k / 5) * 0.006);
      const c = cop(s.tr, s.br, s.tl, s.bl);
      const line = ` ${fmt(c.w)} kg  ${signed(c.x)} ${signed(c.y)}`.replaceAll('−', '-');
      so.textContent = (so.textContent.split('\n').slice(-2).concat(line)).join('\n');
    }, 500);
  }

  /* ---------- Raw rows to sway ---------- */
  const csv = $('#csv-in');
  if (csv) {
    const HX = 446 / 2, HY = 238 / 2; // default sensor spacing in mm
    const parseTime = (s) => {
      const m = s.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) return (+m[1] * 3600 + +m[2] * 60 + +m[3]);
      const d = Date.parse(s);
      return Number.isNaN(d) ? null : d / 1000;
    };
    const run = () => {
      const rows = csv.textContent.split('\n').slice(1).map((l) => l.split(',')).filter((r) => r.length >= 5);
      const pts = [];
      let load = 0;
      rows.forEach((r) => {
        const t = parseTime(r[0]);
        const [tr, br, tl, bl] = r.slice(1, 5).map(Number);
        if (t === null || [tr, br, tl, bl].some(Number.isNaN)) return;
        const c = cop(tr, br, tl, bl);
        load += c.w;
        pts.push({ t, x: c.x * HX, y: c.y * HY });
      });
      let path = 0;
      for (let i = 1; i < pts.length; i++) path += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const dur = pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const range = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
      $('#m-rows').textContent = pts.length;
      $('#m-load').textContent = `${fmt(pts.length ? load / pts.length : 0)} kg`;
      $('#m-path').textContent = `${path.toFixed(1)} mm`;
      $('#m-vel').textContent = `${dur > 0 ? Math.round(path / dur) : 0} mm/s`;
      $('#m-ml').textContent = `${range(xs).toFixed(1)} mm`;
      $('#m-ap').textContent = `${range(ys).toFixed(1)} mm`;
      // Millimetre sway is invisible on a 446 mm board, so the path is centred on its mean and enlarged to fit.
      const mx = xs.reduce((a, v) => a + v, 0) / (xs.length || 1), my = ys.reduce((a, v) => a + v, 0) / (ys.length || 1);
      const spanX = Math.max(...xs.map((v) => Math.abs(v - mx)), 0.01), spanY = Math.max(...ys.map((v) => Math.abs(v - my)), 0.01);
      const zoom = Math.max(1, Math.floor(Math.min((0.7 * HX) / spanX, (0.7 * HY) / spanY)));
      $('#sw-zoom').textContent = zoom > 1 ? `path enlarged ${zoom}×` : 'path to scale';
      const X = (p) => ((p.x - mx) * zoom).toFixed(1), Y = (p) => (-(p.y - my) * zoom).toFixed(1);
      $('#sw-path').setAttribute('points', pts.map((p) => `${X(p)},${Y(p)}`).join(' '));
      $('#sw-dots').innerHTML = pts.map((p, i) => `<circle class="sw-dot${i === pts.length - 1 ? ' last' : ''}" cx="${X(p)}" cy="${Y(p)}" r="${i === pts.length - 1 ? 7 : 4}"/>`).join('');
    };
    csv.addEventListener('input', run);
    run();
  }

  /* ---------- Ledger preview ---------- */
  const ledger = $('#ledger-rows');
  if (ledger) {
    const rows = $$('.lr', ledger);
    const show = (row) => {
      rows.forEach((r) => r.classList.toggle('is-active', r === row));
      $$('.pv').forEach((p) => p.classList.toggle('is-shown', p.id === row.dataset.preview));
      const pv = document.getElementById(row.dataset.preview);
      if (pv) pv.style.setProperty('--pv-top', `${row.offsetTop - ledger.offsetTop}px`);
    };
    rows.forEach((r) => {
      const a = $('a', r);
      a.addEventListener('mouseenter', () => show(r));
      a.addEventListener('focus', () => show(r));
    });
    // Signature move: the desktop app's screens crossfade like light shifting in a room.
    const xf = $$('.pv-desktop .xf');
    if (!reduced && xf.length > 1) {
      let i = 0;
      setInterval(() => {
        if (document.hidden) return;
        xf[i].classList.remove('is-on');
        i = (i + 1) % xf.length;
        xf[i].classList.add('is-on');
      }, 5600);
    }
  }

  /* ---------- Citation ---------- */
  const copy = $('#cite-copy');
  copy?.addEventListener('click', async () => {
    const text = $('#bibtex').textContent;
    const status = $('#cite-status');
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
      status.textContent = 'The BibTeX entry is on your clipboard.';
    } catch {
      const sel = getSelection(); const range = document.createRange();
      range.selectNodeContents($('#bibtex')); sel.removeAllRanges(); sel.addRange(range);
      status.textContent = 'Selected the BibTeX entry. Press Ctrl+C or ⌘C to copy it.';
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 2400);
  });

  /* ---------- Entrances ---------- */
  // Each section's parts rise in turn: heading, then text, then the picture or fragment.
  const groups = [
    '.walk', '.rows-top', '.rows-bottom', '.plate', '.tiles', '.steps-text', '.split-in', '.split-out',
    '.wire', '.ledger', '.letter-col', '.cite-col', '.foot',
  ];
  groups.forEach((sel) => $$(sel).forEach((g) => {
    g.setAttribute('data-rise', '');
    [...g.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
  }));
  $$('.tile-grid > li').forEach((li, i) => { li.style.transitionDelay = `${(i % 4) * 70}ms`; });
  $$('.hero .reveal').forEach((el, i) => el.style.setProperty('--i', i));
  const risers = $$('[data-rise], .hero .reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    risers.forEach((el) => el.classList.add('is-in'));
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    risers.forEach((el) => ro.observe(el));
  }
})();
