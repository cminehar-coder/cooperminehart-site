// Inline interactive charts for the Trail / Range post. Uses the tool's own model.js + data.js.
(function () {
  const M = window.OffroadModel, D = window.OFFROAD_DATA.vehicles;
  const C = { gas: '#547b91', hybrid: '#32806e', ev: '#8b66a6', front: '#bd5a31', ink: '#172d30', muted: '#626e6c', line: '#dedfd5', grey: '#b9bdb6' };
  const PRICES = { pgh: ['Pittsburgh', 4.6884, .2172], slo: ['San Luis Obispo', 6.5873, .3361], msp: ['Minneapolis', 4.2593, .1745], sea: ['Seattle', 5.6734, .1471], hnl: ['Honolulu', 5.5558, .48] };
  const PRESETS = {
    balanced: ['Balanced', { ...M.DEFAULTS }],
    clearance: ['Clearance first', { clearance: 60, approach: 10, departure: 10, breakover: 10, tire: 10, wheelbase: 0 }],
    angles: ['Angles first', { clearance: 15, approach: 30, departure: 25, breakover: 25, tire: 5, wheelbase: 0 }],
    tight: ['Short wheelbase', { clearance: 15, approach: 15, departure: 15, breakover: 15, tire: 5, wheelbase: 35 }]
  };
  const SHORT = {
    'bronco-raptor': "Bronco Raptor '22", 'bronco-sasquatch-2': "Bronco Sasquatch 2-dr '21", 'bronco-sasquatch-4': 'Sasquatch 4-dr',
    'wrangler-rubicon-2': "Rubicon 2-dr '23", 'wrangler-rubicon-4': 'Rubicon 4-dr', 'wrangler-sport-2': 'Wrangler Sport 2-dr',
    'tacoma-pro': "Tacoma TRD Pro hybrid '24", renegade: "Renegade Trailhawk '20", '4runner-trail': "4Runner Trail '15",
    landcruiser: "Land Cruiser '24", 'crosstrek-wilderness': 'Crosstrek Wilderness', 'crosstrek-base': 'Crosstrek',
    'rav4-woodland': 'RAV4 Hybrid Woodland', 'rav4-hybrid': 'RAV4 Hybrid LE', 'outback-wilderness': 'Outback Wilderness',
    r1s: 'Rivian R1S', r1t: 'Rivian R1T', r2: "Rivian R2 '27", cybertruck: 'Cybertruck', 'solterra-2026': "Solterra '26",
    'lightning-er': 'F-150 Lightning', f150: 'F-150 XL'
  };
  const FIGS = {
    field: {
      metric: 'mpg', chips: {},
      state: {},
      filters: () => ({ combustion: true }), weights: () => M.DEFAULTS, city: () => 'pgh',
      refs: ['4runner-trail', 'landcruiser', 'wrangler-rubicon-4', 'wrangler-sport-2', 'outback-wilderness']
    },
    ev: {
      metric: 'mpd', chips: { city: Object.entries(PRICES).map(([k, v]) => [k, v[0]]) },
      state: { city: 'pgh' },
      filters: () => ({}), weights: () => M.DEFAULTS, city: s => s.city,
      refs: ['tacoma-pro', 'rav4-hybrid', 'r1t', 'lightning-er']
    },
    weights: {
      metric: 'mpg', chips: { preset: Object.entries(PRESETS).map(([k, v]) => [k, v[0]]) },
      state: { preset: 'balanced' },
      filters: () => ({ combustion: true }), weights: s => PRESETS[s.preset][1], city: () => 'pgh',
      refs: ['tacoma-pro', 'wrangler-sport-2', 'bronco-raptor']
    }
  };
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent, text) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; parent && parent.appendChild(e); return e; };
  const color = v => v.fuel === 'Electric' ? C.ev : v.fuel === 'Hybrid' ? C.hybrid : C.gas;
  const name = v => SHORT[v.id] || `${v.model} '${String(v.year).slice(2)}`;

  function rows(cfg) {
    const s = cfg.state, [, g, e] = PRICES[cfg.city(s)];
    const r = D.filter(v => M.eligible(v, { yearMin: 2010, yearMax: 2027, ...cfg.filters(s) }))
      .map(v => ({ ...v, cost: M.energyCost(v, g, e), mpd: 100 / M.energyCost(v, g, e), ...M.evaluate(v, cfg.weights(s), true) }))
      .filter(v => v.score != null);
    return { r, f: M.frontier(r, cfg.metric) };
  }

  function draw(root, cfg) {
    const svg = root.querySelector('svg'), tip = root.querySelector('.tr-tip'), cap = root.querySelector('.tr-live');
    const W = Math.max(320, root.clientWidth), narrow = W < 560, H = narrow ? 380 : 440;
    const m = { l: 44, r: narrow ? 10 : 24, t: 14, b: 42 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H); svg.replaceChildren();
    const { r, f } = rows(cfg), fid = new Set(f.map(v => v.id));
    const cost = cfg.metric === 'mpd';
    const xs = r.map(v => v[cfg.metric]);
    let x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
    if (!cost) { x0 = 12; x1 = 42; } else { x0 = 0; x1 = Math.ceil(x1 / 2) * 2 + 2; }
    // cost axis is reversed: cheaper to the right
    const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = s => H - m.b - s / 100 * (H - m.t - m.b);
    // grid
    for (let s = 0; s <= 100; s += 20) { el('line', { x1: m.l, x2: W - m.r, y1: Y(s), y2: Y(s), stroke: C.line }, svg); el('text', { x: m.l - 8, y: Y(s) + 4, 'text-anchor': 'end', class: 'tr-ax' }, svg, s); }
    const step = cost ? 2 : 5;
    for (let t = Math.ceil(x0 / step) * step; t <= x1; t += step) el('text', { x: X(t), y: H - m.b + 18, 'text-anchor': 'middle', class: 'tr-ax' }, svg, t);
    el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'tr-ax tr-axt' }, svg, cost ? 'Miles per dollar of energy →' : 'EPA combined MPG →');
    el('text', { x: 12, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'tr-ax tr-axt', transform: `rotate(-90 12 ${(m.t + H - m.b) / 2})` }, svg, 'Off-road geometry score →');
    // frontier
    el('polyline', { points: f.map(v => `${X(v[cfg.metric])},${Y(v.score)}`).join(' '), fill: 'none', stroke: C.front, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    // points: background first, frontier on top
    const labelled = new Set([...fid, ...cfg.refs.filter(id => r.some(v => v.id === id))]);
    const sorted = [...r].sort((a, b) => (fid.has(a.id) - fid.has(b.id)) || (labelled.has(a.id) - labelled.has(b.id)));
    for (const v of sorted) {
      const on = fid.has(v.id), lab = labelled.has(v.id), c = on || lab ? color(v) : C.grey;
      const p = el('circle', { cx: X(v[cfg.metric]), cy: Y(v.score), r: on ? 6 : lab ? 5 : 4, fill: v.estimated ? '#fff' : c, stroke: on ? C.front : c, 'stroke-width': on ? 2.2 : 1.6, class: 'tr-pt' }, svg);
      const val = cost ? `${v.mpd.toFixed(1)} miles per $ ($${v.cost.toFixed(2)} per 100 mi)` : `${v.mpg} mpg`;
      const show = ev => { const b = root.getBoundingClientRect(); tip.hidden = false; tip.innerHTML = `<b>${v.year} ${v.make} ${v.model}</b><br>${v.trim}<br>${val} · score ${v.score.toFixed(1)}${v.estimated ? ' (est. breakover)' : ''}${on ? '<br><span style="color:' + C.front + '">on the frontier</span>' : ''}`; const px = (ev.clientX ?? b.left) - b.left, py = (ev.clientY ?? b.top) - b.top; tip.style.left = Math.min(px + 12, W - 220) + 'px'; tip.style.top = (py + 12) + 'px'; };
      p.addEventListener('mousemove', show); p.addEventListener('click', show); p.addEventListener('mouseleave', () => tip.hidden = true);
    }
    // labels with greedy collision avoidance
    const placed = [], fs = narrow ? 10.5 : 12;
    for (const v of r) if (labelled.has(v.id)) placed.push({ x: X(v[cfg.metric]) - 7, y: Y(v.score) - 7, w: 14, h: 14 });
    const boxes = [...labelled].map(id => r.find(v => v.id === id)).sort((a, b) => b.score - a.score);
    for (const v of boxes) {
      const px = X(v[cfg.metric]), py = Y(v.score), t = name(v), w = t.length * fs * 0.56, h = fs + 2;
      const tries = [];
      for (const dy of [0, -13, 13, -26, 26, -39, 39]) { tries.push([px + 9, py + 4 + dy, 'start']); tries.push([px - 9, py + 4 + dy, 'end']); }
      let best = tries[0];
      for (const tr of tries) {
        const bx = tr[2] === 'start' ? tr[0] : tr[0] - w, by = tr[1] - h + 3;
        if (bx < m.l || bx + w > W - 2 || by < 0 || by + h > H - m.b) continue;
        if (!placed.some(p => bx < p.x + p.w && bx + w > p.x && by < p.y + p.h && by + h > p.y)) { best = tr; break; }
      }
      const bx = best[2] === 'start' ? best[0] : best[0] - w;
      placed.push({ x: bx, y: best[1] - h + 3, w, h });
      if (Math.abs(best[1] - (py + 4)) > 1) el('line', { x1: px, y1: py, x2: best[2] === 'start' ? best[0] - 2 : best[0] + 2, y2: best[1] - 4, stroke: C.muted, 'stroke-width': .7 }, svg);
      el('text', { x: best[0], y: best[1], 'text-anchor': best[2], class: fid.has(v.id) ? 'tr-lab tr-on' : 'tr-lab', 'font-size': fs }, svg, t);
    }
    if (cap) {
      const s = cfg.state;
      const ctx = s.city ? ` at ${PRICES[s.city][0]} prices ($${PRICES[s.city][1].toFixed(2)}/gal, $${PRICES[s.city][2].toFixed(3)}/kWh)` : '';
      cap.textContent = `${r.length} vehicles, ${f.length} on the frontier${ctx}: ${f.slice().sort((a, b) => b.score - a.score).map(name).join(' · ')}.`;
    }
  }

  document.querySelectorAll('[data-tr-fig]').forEach(root => {
    const cfg = FIGS[root.dataset.trFig];
    const bar = root.querySelector('.tr-chips');
    for (const [key, opts] of Object.entries(cfg.chips)) for (const [val, label] of opts) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = 'tr-chip';
      b.setAttribute('aria-pressed', cfg.state[key] === val);
      b.onclick = () => { cfg.state[key] = val; bar.querySelectorAll('.tr-chip').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(root, cfg); };
      bar.appendChild(b);
    }
    draw(root, cfg);
    let lastW = root.clientWidth, t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (root.clientWidth !== lastW) { lastW = root.clientWidth; draw(root, cfg); } }, 120); });
  });
})();
