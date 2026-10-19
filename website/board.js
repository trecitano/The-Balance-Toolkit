// Shared simulation for the concept pages: a Wii Balance Board seen from above, its four
// corner sensors, and centre of pressure computed with the toolkit's own formula.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
  const HX = 446 / 2, HY = 238 / 2; // half the default sensor spacing, mm (balance_board_x/y_size)

  // Same formula as BalanceBoardCalibratedReading::calculate_cop in toolkit-core.
  const cop = (tr, br, tl, bl) => {
    const w = tr + br + tl + bl;
    if (Math.abs(w) < 0.1) return { w, x: 0, y: 0 };
    return { w, x: (tr + br - (tl + bl)) / w, y: (tr + tl - (br + bl)) / w };
  };
  // Splits a total load into the four sensor loads that give this CoP.
  const split = (w, x, y) => ({
    tr: (w * (1 + x) * (1 + y)) / 4,
    br: (w * (1 + x) * (1 - y)) / 4,
    tl: (w * (1 - x) * (1 + y)) / 4,
    bl: (w * (1 - x) * (1 - y)) / 4,
  });

  // Sway metrics over a list of {t (s), x, y (normalised)} points, in mm.
  const metrics = (pts) => {
    let path = 0;
    for (let i = 1; i < pts.length; i++) path += Math.hypot((pts[i].x - pts[i - 1].x) * HX, (pts[i].y - pts[i - 1].y) * HY);
    const dur = pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0;
    const xs = pts.map((p) => p.x * HX), ys = pts.map((p) => p.y * HY);
    const range = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
    return { path, dur, vel: dur > 0 ? path / dur : 0, ml: range(xs), ap: range(ys) };
  };

  // Where the weight sits and how much it sways, per posture. x is right, y is forward.
  const STANCES = {
    both: { x: 0.02, y: -0.04, ax: 0.035, ay: 0.05, w: 1 },
    'eyes-closed': { x: 0.02, y: -0.03, ax: 0.06, ay: 0.09, w: 1 },
    'left-leg-up': { x: 0.3, y: 0.05, ax: 0.1, ay: 0.13, w: 1 },
    'right-leg-up': { x: -0.3, y: 0.05, ax: 0.1, ay: 0.13, w: 1 },
    'left-foot-in-front': { x: -0.03, y: 0.02, ax: 0.09, ay: 0.06, w: 1 },
    'right-foot-in-front': { x: 0.03, y: 0.02, ax: 0.09, ay: 0.06, w: 1 },
    reach: { x: 0, y: 0.38, ax: 0.04, ay: 0.08, w: 1 },
    'lean-forward': { x: 0, y: 0.45, ax: 0.03, ay: 0.05, w: 1 },
    'lean-backwards': { x: 0, y: -0.45, ax: 0.03, ay: 0.05, w: 1 },
    'lean-to-the-left': { x: -0.5, y: 0, ax: 0.04, ay: 0.04, w: 1 },
    'lean-to-the-right': { x: 0.5, y: 0, ax: 0.04, ay: 0.04, w: 1 },
    squat: { x: 0, y: -0.15, ax: 0.05, ay: 0.12, w: 1 },
    off: { x: 0, y: 0, ax: 0, ay: 0, w: 0 },
  };

  // The six default activities from toolkit-core activities.rs: (block id, title, seconds, posture).
  const B = (id, title, s, stance) => ({ id, title, s, stance });
  const ACTIVITIES = [
    { id: 'eyes-open-close', title: 'Eyes open-close', pic: 'eyes-open', boards: 1, loops: 2,
      blocks: [B('step-onto-board', 'Step onto Board', 12, 'both'), B('eyes-open', 'Eyes Open', 4, 'both'), B('eyes-close', 'Eyes Closed', 4, 'eyes-closed')] },
    { id: 'functional-reach-test', title: 'Functional Reach Test', pic: 'left-arm-reach', boards: 1, loops: 2,
      blocks: [B('step-onto-board', 'Step onto Board', 12, 'both'), B('stand-on-the-board-reach', 'Stand on the Board (Reach)', 12, 'both'),
        B('left-arm-up', 'Left Arm Up', 8, 'both'), B('left-arm-reach', 'Left Arm Reach', 8, 'reach'), B('left-arm-down', 'Left Arm Down', 8, 'both'),
        B('right-arm-up', 'Right Arm Up', 8, 'both'), B('right-arm-reach', 'Right Arm Reach', 8, 'reach'), B('right-arm-down', 'Right Arm Down', 8, 'both')] },
    { id: 'single-leg-stance', title: 'Single leg stance', pic: 'left-leg-up', boards: 1, loops: 2,
      blocks: [B('step-onto-board', 'Step onto Board', 12, 'both'), B('stand-on-the-board', 'Stand on the Board', 12, 'both'),
        B('left-leg-up', 'Left Leg Up', 8, 'left-leg-up'), B('stand-on-the-board', 'Stand on the Board', 12, 'both'),
        B('right-leg-up', 'Right Leg Up', 8, 'right-leg-up'), B('stand-on-the-board', 'Stand on the Board', 12, 'both')] },
    { id: 'tandem-stance', title: 'Tandem stance', pic: 'left-foot-in-front', boards: 1, loops: 2,
      blocks: [B('step-onto-board', 'Step onto Board', 12, 'both'), B('stand-on-the-board', 'Stand on the Board', 12, 'both'),
        B('left-foot-in-front', 'Left Foot in Front', 8, 'left-foot-in-front'), B('stand-on-the-board', 'Stand on the Board', 12, 'both'),
        B('right-foot-in-front', 'Right Foot in Front', 8, 'right-foot-in-front'), B('stand-on-the-board', 'Stand on the Board', 12, 'both')] },
    { id: 'tug', title: 'Timed Up and Go', pic: 'turn-around', boards: 1, loops: 2,
      blocks: [B('sit', 'Sit', 12, 'off'), B('stand', 'Stand', 12, 'both'), B('walk-forward', 'Walk Forward', 12, 'off'),
        B('turn-around', 'Turn Around', 12, 'off'), B('walk-back', 'Walk Back', 12, 'off'), B('sit-again', 'Sit Again', 12, 'off')] },
    { id: 'squat-two-boards', title: 'Squat', pic: 'dual-board-squat-on-the-boards', boards: 2, loops: 2,
      blocks: [B('dual-board-step-on-the-boards', 'Step on the boards', 3, 'both'), B('dual-board-one-foot-on-each-board', 'One foot on each board', 3, 'both'),
        B('dual-board-squat-on-the-boards', 'Squat on the boards', 3, 'squat'), B('dual-board-stand-on-the-boards', 'Stand on the boards', 3, 'both')] },
  ];
  ACTIVITIES.forEach((a) => { a.loopS = a.blocks.reduce((n, b) => n + b.s, 0); a.totalS = a.loopS * a.loops; });

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // The board drawn from above, in a 520 x 320 box; sensors sit at +-223 x +-119 mm from the centre.
  const CX = 260, CY = 160;
  const toSvg = (x, y) => [CX + x * 223, CY - y * 119];
  const svg = (opts) => `
<svg class="tb" viewBox="0 0 520 320" role="img" aria-label="${opts.label || 'Wii Balance Board seen from above; the dot is the centre of pressure.'}">
  <rect class="tb-body" x="6" y="6" width="508" height="308" rx="64"/>
  <rect class="tb-pad" x="26" y="26" width="226" height="268" rx="44"/>
  <rect class="tb-pad" x="268" y="26" width="226" height="268" rx="44"/>
  <g class="tb-grid"><line x1="${CX}" y1="20" x2="${CX}" y2="300"/><line x1="20" y1="${CY}" x2="500" y2="${CY}"/></g>
  <g class="tb-sensors">
    <circle class="tb-s" data-s="tl" cx="${CX - 223}" cy="${CY - 119}" r="10"/>
    <circle class="tb-s" data-s="tr" cx="${CX + 223}" cy="${CY - 119}" r="10"/>
    <circle class="tb-s" data-s="bl" cx="${CX - 223}" cy="${CY + 119}" r="10"/>
    <circle class="tb-s" data-s="br" cx="${CX + 223}" cy="${CY + 119}" r="10"/>
  </g>
  <g class="tb-extra"></g>
  <polyline class="tb-trail" points=""/>
  <circle class="tb-dot" cx="${CX}" cy="${CY}" r="9"/>
</svg>`;

  class Board {
    constructor(el, opts = {}) {
      this.el = el;
      this.o = { weight: 72, trail: 90, stance: 'both', interactive: true, history: 600, sensorScale: true, ...opts };
      el.insertAdjacentHTML('beforeend', svg(this.o));
      this.svg = el.querySelector('svg.tb');
      this.dotEl = this.svg.querySelector('.tb-dot');
      this.trailEl = this.svg.querySelector('.tb-trail');
      this.extra = this.svg.querySelector('.tb-extra');
      this.sEls = Object.fromEntries([...this.svg.querySelectorAll('.tb-s')].map((c) => [c.dataset.s, c]));
      this.stance = this.o.stance;
      this.weight = this.o.weight;
      this.w = this.stanceW() * this.weight;
      this.target = null; // pointer or external CoP, or null to stand on the posture's own spot
      this.offsets = { tr: 0, br: 0, tl: 0, bl: 0 }; // sensor zero drift, before tare
      this.tared = { tr: 0, br: 0, tl: 0, bl: 0 };
      this.px = 0; this.py = 0; this.vx = 0; this.vy = 0;
      this.t0 = performance.now();
      this.pts = []; this.hist = [];
      this.listeners = [];
      if (this.o.interactive) this.bindPointer();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) requestAnimationFrame(this.loop); });
    }
    stanceW() { return (STANCES[this.stance] || STANCES.both).w; }
    on(fn) { this.listeners.push(fn); return this; }
    setStance(s) { this.stance = s; }
    setWeight(kg) { this.weight = kg; }
    setTarget(p) { this.target = p; }
    setDrift(o) { this.offsets = { ...o }; }
    tare() { this.tared = { ...this.offsets }; }
    clearTrail() { this.pts = []; this.hist = []; }
    bindPointer() {
      const svgEl = this.svg;
      const toCop = (e) => {
        const r = svgEl.getBoundingClientRect();
        const sx = ((e.clientX - r.left) / r.width) * 520, sy = ((e.clientY - r.top) / r.height) * 320;
        return { x: clamp((sx - CX) / 223), y: clamp(-(sy - CY) / 119) };
      };
      svgEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || this.dragging) this.target = toCop(e); });
      svgEl.addEventListener('pointerdown', (e) => { this.dragging = true; this.target = toCop(e); svgEl.setPointerCapture?.(e.pointerId); });
      svgEl.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.target = null; });
      svgEl.addEventListener('pointerup', (e) => { this.dragging = false; if (e.pointerType !== 'mouse') this.target = null; });
      svgEl.style.touchAction = 'none';
    }
    loop(now) {
      const t = (now - this.t0) / 1000;
      const st = STANCES[this.stance] || STANCES.both;
      const amp = reduced ? 0 : 1;
      const sx = amp * st.ax * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.7 + 1) * 0.25 + Math.sin(t * 7.9) * 0.15);
      const sy = amp * st.ay * (Math.sin(t * 0.9 + 2) * 0.6 + Math.sin(t * 2.9) * 0.3 + Math.sin(t * 6.1 + 0.5) * 0.1);
      const base = this.target || st;
      // A soft spring, so the dot moves like a body rather than a cursor.
      this.vx = (this.vx + (base.x + sx - this.px) * 0.08) * 0.78;
      this.vy = (this.vy + (base.y + sy - this.py) * 0.08) * 0.78;
      this.px = clamp(this.px + this.vx); this.py = clamp(this.py + this.vy);
      this.w += (st.w * this.weight - this.w) * 0.12;

      const load = split(this.w + (this.w > 1 ? Math.sin(t * 2.1) * 0.08 : 0), this.px, this.py);
      // What the sensors report: the load plus their drift, minus whatever offset tare stored.
      const raw = {}, cal = {};
      for (const k of ['tr', 'br', 'tl', 'bl']) { raw[k] = load[k] + this.offsets[k]; cal[k] = raw[k] - this.tared[k]; }
      const c = cop(cal.tr, cal.br, cal.tl, cal.bl);
      this.state = { t, raw, ...cal, w: c.w, x: c.x, y: c.y, on: c.w > 2 };

      const [dx, dy] = toSvg(c.x, c.y);
      this.dotEl.setAttribute('cx', dx.toFixed(1)); this.dotEl.setAttribute('cy', dy.toFixed(1));
      this.dotEl.classList.toggle('is-off', !this.state.on);
      if (this.state.on) {
        this.pts.push(`${dx.toFixed(1)},${dy.toFixed(1)}`);
        this.hist.push({ t, x: c.x, y: c.y });
      }
      if (this.pts.length > this.o.trail) this.pts.shift();
      if (this.hist.length > this.o.history) this.hist.shift();
      this.trailEl.setAttribute('points', this.pts.join(' '));
      if (this.o.sensorScale) {
        const quarter = Math.max(this.weight / 4, 1);
        for (const k in this.sEls) this.sEls[k].setAttribute('r', (6 + 10 * clamp(cal[k] / quarter / 2, 0, 1.6)).toFixed(1));
      }
      this.listeners.forEach((fn) => fn(this.state, this));
      if (!document.hidden) requestAnimationFrame(this.loop);
    }
  }

  // The 40-byte TCP raw packet, ">qQ6f": timestamp (i64, Unix µs), MAC (u64), TR, BR, TL, BL, cop_x, cop_y (f32).
  const packet = (s, mac = 0x37fea12bfdf4n) => {
    const buf = new DataView(new ArrayBuffer(40));
    buf.setBigInt64(0, BigInt(Date.now()) * 1000n);
    buf.setBigUint64(8, mac);
    [s.tr, s.br, s.tl, s.bl, s.x, s.y].forEach((v, i) => buf.setFloat32(16 + i * 4, v));
    return [...new Uint8Array(buf.buffer)];
  };
  const hex = (b) => b.toString(16).padStart(2, '0');

  window.TBT = { Board, cop, split, metrics, packet, hex, clamp, mmss, STANCES, ACTIVITIES, HX, HY, reduced, toSvg };
})();
