// Inline interactive House Style B charts for /blog/ev-pareto. Uses model.js + data.js.
(function () {
  'use strict';

  const DATA = window.EV_PARETO_DATA;
  const M = window.EVParetoModel;
  if (!DATA || !M) return;

  const ALL_MARKETS = Object.keys(DATA.markets);
  const ALL_CHEMS = Object.keys(DATA.chemistries);
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    white: '#FFFFFF',
    ink: '#1E2A33',
    muted: '#56636D',
    rule: '#E3E8EA',
    poppy: '#D6363F',
    cobalt: '#2C4FA3',
  };

  const FLEET_WT_IDS = new Set([
    'chevy-silverado-ev-std',
    'chevy-silverado-ev-ext',
    'chevy-silverado-ev-max',
  ]);

  const FIGS = {
    'us-kwh': {
      state: { mode: 'all', pinnedId: null },
      chips: [
        ['all', 'All US packs (102)'],
        ['no-wt', 'Drop fleet WT pickups'],
        ['lfp', 'US LFP only (8)'],
      ],
      evalOpts: (s) => ({
        markets: ['US'],
        chemistries: s.mode === 'lfp' ? ['lfp'] : ALL_CHEMS,
        yAxis: 'kwh',
      }),
      filterRows: (rows, s) =>
        s.mode === 'no-wt' ? rows.filter((r) => !FLEET_WT_IDS.has(r.id)) : rows,
      xMax: 135000,
      refs: ['tesla-model3-std-us', 'rivian-r1t-std-lfp', 'lucid-air-pure', 'vinfast-vf9-plus'],
    },
    'global-chem': {
      state: { slice: 'global', pinnedId: null },
      chips: [
        ['global', 'Global (all 9 markets)'],
        ['cn', 'China only'],
        ['eu', 'Europe'],
        ['na', 'US + Canada'],
        ['weird', 'Post-LFP chemistries (9)'],
      ],
      evalOpts: (s) => ({
        markets:
          s.slice === 'cn'
            ? ['CN']
            : s.slice === 'eu'
            ? ['EU', 'UK', 'NO']
            : s.slice === 'na'
            ? ['US', 'CA']
            : ALL_MARKETS,
        chemistries: s.slice === 'weird' ? ['lmfp', 'na-ion', 'semi-solid'] : ALL_CHEMS,
        yAxis: 'kwh',
      }),
      xMax: 135000,
      refs: [
        'changan-nevo-a06-na-ion',
        'mg4-semi-solid',
        'im-l6-lightyear-semisolid',
        'luxeed-s7-m3p',
        'byd-tang-l-ev',
        'chevy-equinox-ev-fwd',
      ],
    },
    'us-range': {
      state: { metric: 'us-range', pinnedId: null },
      chips: [
        ['us-range', 'US EPA miles'],
        ['us-kwh', 'US usable kWh (same cars)'],
        ['global-harm', 'Global (harmonized EPA-eq.)'],
        ['global-raw', 'Global (raw WLTP / CLTC)'],
      ],
      evalOpts: (s) => ({
        markets: s.metric.startsWith('global') ? ALL_MARKETS : ['US'],
        chemistries: ALL_CHEMS,
        yAxis: s.metric === 'us-kwh' ? 'kwh' : 'range',
        rangeUnit: 'mi',
        harmonizeRange: s.metric !== 'global-raw',
      }),
      xMax: 135000,
      refs: [
        'lucid-air-pure',
        'gmc-hummer-ev-3x-24mod',
        'chevy-equinox-ev-fwd',
        'tesla-cybertruck-awd',
        'mercedes-cla-250-plus',
        'xiaomi-su7-pro',
      ],
    },
  };

  function el(tag, attrs, parent, text) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v != null) node.setAttribute(k, String(v));
    }
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function shapePath(shape, r) {
    if (shape === 'square') {
      const s = +(r * 0.88).toFixed(2);
      return `M ${-s} ${-s} H ${s} V ${s} H ${-s} Z`;
    }
    if (shape === 'diamond') {
      const d = +(r * 1.22).toFixed(2);
      return `M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`;
    }
    if (shape === 'triangle') {
      const t = +(r * 1.28).toFixed(2);
      const w = +(r * 1.15).toFixed(2);
      const b = +(r * 0.96).toFixed(2);
      return `M 0 ${-t} L ${w} ${b} L ${-w} ${b} Z`;
    }
    if (shape === 'star') {
      const outer = r * 1.36;
      const inner = r * 0.58;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${(Math.cos(a) * rad).toFixed(2)} ${(Math.sin(a) * rad).toFixed(2)}`);
      }
      return `M ${pts.join(' L ')} Z`;
    }
    const c = +r.toFixed(2);
    return `M ${-c} 0 a ${c} ${c} 0 1 0 ${c * 2} 0 a ${c} ${c} 0 1 0 ${-c * 2} 0`;
  }

  function swatchSvgHtml(chemKey) {
    const chem = DATA.chemistries[chemKey];
    const stroke = chemKey === 'semi-solid' ? C.ink : C.white;
    return `<svg width="13" height="13" viewBox="-8 -8 16 16" aria-hidden="true"><path d="${shapePath(
      chem.shape,
      4.6
    )}" fill="${chem.color}" stroke="${stroke}" stroke-width="1.1"/></svg>`;
  }

  const fmtUsdK = (n) => {
    if (n === 0) return '$0';
    const k = n / 1000;
    return '$' + (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
  };
  const fmtUsd = (n) => '$' + Math.round(n).toLocaleString('en-US');

  function shortLabel(v, frontier) {
    const dup = frontier.filter((f) => f.short === v.short);
    if (dup.length > 1) {
      const tag = v.trim
        .replace(/\(.*?\)/g, '')
        .replace(/\b(WT|AWD|FWD|RWD|Dual|Range)\b/g, '')
        .trim()
        .split(/\s+/)[0];
      if (tag) return `${v.short} (${tag})`;
    }
    return v.short;
  }

  function renderLegend(legendEl, visible, isKwh) {
    if (!legendEl) return;
    const presentChems = ALL_CHEMS.filter((k) => visible.some((r) => r.chemistry === k));
    const hasHarm = !isKwh && visible.some((r) => r.isHarmonizedEstimate);
    const items = [
      `<span class="evp-leg-item"><span class="evp-leg-line" aria-hidden="true"></span>Pareto frontier</span>`,
    ];
    for (const k of presentChems) {
      items.push(
        `<span class="evp-leg-item">${swatchSvgHtml(k)}${DATA.chemistries[k].short}</span>`
      );
    }
    if (hasHarm) {
      items.push(
        `<span class="evp-leg-item"><svg width="13" height="13" viewBox="-8 -8 16 16" aria-hidden="true"><circle cx="0" cy="0" r="4.6" fill="${C.muted}"/><circle cx="0" cy="0" r="1.9" fill="${C.white}"/></svg>Hollow dot = converted to EPA-eq.</span>`
      );
    }
    legendEl.innerHTML = items.join('');
  }

  function renderLiveBar(live, rows, frontier, pinned, isKwh, onClear) {
    if (!live) return;
    live.replaceChildren();
    if (!pinned) {
      live.hidden = true;
      return;
    }
    live.hidden = false;
    const chem = DATA.chemistries[pinned.chemistry];
    const dom = pinned.onFrontier
      ? null
      : frontier.find((f) => f.id !== pinned.id && M.dominates(f, pinned));
    const box = document.createElement('div');
    box.className = 'evp-pin-box' + (pinned.onFrontier ? ' is-frontier' : '');

    const specText = document.createElement('div');
    specText.className = 'evp-pin-main';
    const title = document.createElement('strong');
    title.textContent = `${pinned.year} ${pinned.make} ${pinned.model} (${pinned.trim})`;
    specText.appendChild(title);

    const meta = document.createElement('span');
    const rangeNote = `${pinned.rangeDisplay} mi (${pinned.rangeCycleLabel})`;
    const statusText = pinned.onFrontier
      ? ' ★ On the Pareto frontier.'
      : dom
      ? ` Dominated on this view by ${dom.make} ${dom.model} (${fmtUsd(dom.msrpUsd)}, ${
          isKwh ? dom.kwhUsable + ' kWh' : dom.rangeDisplay + ' mi'
        }).`
      : '';
    meta.textContent = ` · ${chem.short} (${pinned.cellDetail}) · ${fmtUsd(pinned.msrpUsd)} (${
      pinned.priceMarket
    }) · ${pinned.kwhUsable} kWh usable (${pinned.kwhGross} gross, $${Math.round(
      pinned.dollarsPerKwh
    )}/kWh) · ${rangeNote}.${statusText}`;
    specText.appendChild(meta);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'evp-pin-clear';
    clearBtn.textContent = 'Clear pin';
    clearBtn.addEventListener('click', onClear);

    box.appendChild(specText);
    box.appendChild(clearBtn);
    live.appendChild(box);
  }

  function draw(root, cfg) {
    const svg = root.querySelector('.evp-wrap svg');
    const tip = root.querySelector('.evp-tip');
    const live = root.querySelector('.evp-live');
    const legendEl = root.querySelector('.evp-legend');
    if (!svg) return;

    const W = Math.max(300, Math.round(root.clientWidth || 760));
    const narrow = W < 540;
    const H = narrow ? 368 : 432;
    const pad = { l: narrow ? 44 : 54, r: narrow ? 20 : 24, t: 20, b: 44 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', String(H));
    svg.replaceChildren();
    if (tip) tip.hidden = true;

    const opts = cfg.evalOpts(cfg.state);
    let { rows, frontier } = M.evaluateDataset(DATA, opts);
    if (cfg.filterRows) {
      rows = cfg.filterRows(rows, cfg.state);
      frontier = M.paretoFrontier(rows);
      const fSet = new Set(frontier.map((f) => f.id));
      rows = rows.map((r) => ({ ...r, onFrontier: fSet.has(r.id) }));
    }

    if (cfg.state.pinnedId && !rows.some((r) => r.id === cfg.state.pinnedId)) {
      cfg.state.pinnedId = null;
    }

    const xMax = cfg.xMax;
    const visible = rows.filter((r) => r.msrpUsd <= xMax);
    const isKwh = opts.yAxis === 'kwh';
    const isRawGlobal = cfg.state.metric === 'global-raw';
    const rawMaxY = visible.reduce((m, r) => Math.max(m, r.metricValue), isKwh ? 100 : 300);
    const yStep = isKwh ? (rawMaxY <= 140 ? 25 : 40) : 100;
    const yMax = Math.ceil((rawMaxY * 1.1) / yStep) * yStep;

    renderLegend(legendEl, visible, isKwh);

    const X = (v) => pad.l + (v / xMax) * plotW;
    const Y = (v) => pad.t + plotH - (v / yMax) * plotH;

    // Frame
    el('rect', { x: pad.l, y: pad.t, width: plotW, height: plotH, fill: C.white, stroke: C.rule }, svg);

    // Y grid
    for (let yv = 0; yv <= yMax; yv += yStep) {
      el(
        'line',
        {
          x1: pad.l,
          x2: W - pad.r,
          y1: Y(yv),
          y2: Y(yv),
          stroke: yv === 0 ? C.ink : C.rule,
          'stroke-width': yv === 0 ? 1.5 : 1,
        },
        svg
      );
      el('text', { x: pad.l - 8, y: Y(yv) + 3.5, 'text-anchor': 'end', class: 'evp-ax' }, svg, String(yv));
    }

    // X grid
    const xStep = narrow ? 45000 : 25000;
    for (let xv = 0; xv <= xMax; xv += xStep) {
      el(
        'line',
        {
          x1: X(xv),
          x2: X(xv),
          y1: pad.t,
          y2: H - pad.b,
          stroke: xv === 0 ? C.ink : C.rule,
          'stroke-width': xv === 0 ? 1.5 : 1,
        },
        svg
      );
      el('text', { x: X(xv), y: H - pad.b + 17, 'text-anchor': 'middle', class: 'evp-ax' }, svg, fmtUsdK(xv));
    }

    // Axis titles
    el(
      'text',
      { x: pad.l + plotW / 2, y: H - 7, 'text-anchor': 'middle', class: 'evp-axt' },
      svg,
      'Retail MSRP in USD (lower is left ← · higher is right →)'
    );
    const yLabel = isKwh
      ? 'Usable battery capacity (kWh)'
      : isRawGlobal
      ? 'Official local cycle range (unharmonized miles)'
      : opts.markets.length === 1 && opts.markets[0] === 'US'
      ? 'Official US EPA combined range (miles)'
      : 'Driving range (EPA-equivalent miles)';
    const yMid = pad.t + plotH / 2;
    el(
      'text',
      {
        x: 14,
        y: yMid,
        'text-anchor': 'middle',
        class: 'evp-axt',
        transform: `rotate(-90 14 ${yMid})`,
      },
      svg,
      yLabel
    );

    // Clip layer for frontier
    const defs = el('defs', {}, svg);
    const clipId = 'evp-clip-' + Math.random().toString(36).slice(2, 8);
    const clip = el('clipPath', { id: clipId }, defs);
    el('rect', { x: pad.l, y: pad.t, width: plotW, height: plotH }, clip);
    const clipped = el('g', { 'clip-path': `url(#${clipId})` }, svg);

    if (frontier.length >= 2) {
      const stepPts = M.paretoStepPoints(frontier, xMax);
      const stepD = stepPts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`)
        .join(' ');
      el(
        'path',
        {
          d: stepD,
          fill: 'none',
          stroke: C.poppy,
          'stroke-opacity': '0.45',
          'stroke-width': 1.3,
          'stroke-dasharray': '5 4',
        },
        clipped
      );

      const lineD = frontier
        .map((f, i) => `${i === 0 ? 'M' : 'L'} ${X(f.msrpUsd).toFixed(1)} ${Y(f.metricValue).toFixed(1)}`)
        .join(' ');
      el(
        'path',
        {
          d: lineD,
          fill: 'none',
          stroke: C.poppy,
          'stroke-width': 2.4,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        },
        clipped
      );
    }

    // Points
    const fIds = new Set(frontier.map((f) => f.id));
    const sorted = visible
      .slice()
      .sort(
        (a, b) =>
          Number(a.id === cfg.state.pinnedId) - Number(b.id === cfg.state.pinnedId) ||
          Number(fIds.has(a.id)) - Number(fIds.has(b.id))
      );
    const ptsGroup = el('g', {}, svg);

    for (const r of sorted) {
      const on = fIds.has(r.id);
      const isPinned = r.id === cfg.state.pinnedId;
      const chem = DATA.chemistries[r.chemistry];
      const cx = X(r.msrpUsd);
      const cy = Y(r.metricValue);
      const yStr = isKwh
        ? `${r.kwhUsable} kWh usable (${r.kwhGross} gross)`
        : `${r.rangeDisplay} mi (${r.rangeCycleLabel})`;

      const g = el(
        'g',
        {
          class: 'evp-pt',
          tabindex: '0',
          role: 'button',
          'aria-label': `${r.year} ${r.make} ${r.model} ${r.trim}, ${fmtUsd(r.msrpUsd)}, ${yStr}${
            on ? ', on Pareto frontier' : ''
          }`,
        },
        ptsGroup
      );

      // 22px diameter pointer/touch hit target + keyboard focus ring
      el('circle', { cx, cy, r: 11, fill: 'transparent' }, g);
      el('circle', { cx, cy, r: 11.5, class: 'evp-focus-ring' }, g);

      if (isPinned) {
        el('circle', { cx, cy, r: 10.5, fill: 'none', stroke: C.ink, 'stroke-width': 2.2 }, g);
      }
      if (on) {
        el('circle', { cx, cy, r: 8.2, fill: 'none', stroke: C.poppy, 'stroke-width': 1.7 }, g);
      }
      el(
        'path',
        {
          d: shapePath(chem.shape, isPinned ? 6.4 : on ? 5.6 : 4.4),
          transform: `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`,
          fill: chem.color,
          'fill-opacity': on || isPinned ? '1' : '0.82',
          stroke: r.chemistry === 'semi-solid' ? C.ink : C.white,
          'stroke-width': 1.15,
        },
        g
      );
      if (r.isHarmonizedEstimate) {
        el('circle', { cx, cy, r: 1.9, fill: C.white, 'pointer-events': 'none' }, g);
      }

      const showTip = () => {
        if (!tip) return;
        const wrapRect = root.querySelector('.evp-wrap').getBoundingClientRect();
        tip.innerHTML = `<strong>${r.year} ${r.make} ${r.model}</strong><br>${r.trim} · ${chem.short}<br>${fmtUsd(
          r.msrpUsd
        )} (${r.priceMarket}) · ${yStr}${
          on ? '<br><span class="evp-tip-f">★ Pareto frontier</span>' : ''
        }<small class="evp-tip-hint">${isPinned ? 'Pinned below (click to unpin)' : 'Click to pin below'}</small>`;
        tip.hidden = false;
        const tw = tip.offsetWidth || 230;
        const th = tip.offsetHeight || 84;
        let left = cx + 12;
        if (left + tw > wrapRect.width - 8) left = cx - tw - 12;
        left = Math.max(8, Math.min(wrapRect.width - tw - 8, left));
        let top = cy - th / 2;
        top = Math.max(8, Math.min(H - th - 8, top));
        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
      };

      const togglePin = () => {
        cfg.state.pinnedId = cfg.state.pinnedId === r.id ? null : r.id;
        draw(root, cfg);
      };

      g.addEventListener('mouseenter', showTip);
      g.addEventListener('focus', showTip);
      g.addEventListener('mouseleave', () => {
        if (tip) tip.hidden = true;
      });
      g.addEventListener('blur', () => {
        if (tip) tip.hidden = true;
      });
      g.addEventListener('click', (ev) => {
        ev.stopPropagation();
        togglePin();
      });
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          togglePin();
        }
      });
    }

    // Greedy collision-free labels
    const labelsGroup = el('g', {}, svg);
    const obstacles = visible.map((r) => {
      const rad = r.id === cfg.state.pinnedId ? 12 : fIds.has(r.id) ? 9.8 : 5.2;
      return { id: r.id, x: X(r.msrpUsd) - rad, y: Y(r.metricValue) - rad, w: rad * 2, h: rad * 2 };
    });
    const placed = [];
    const wantIds = [];
    if (cfg.state.pinnedId) wantIds.push(cfg.state.pinnedId);
    const visFrontier = frontier.filter((f) => f.msrpUsd <= xMax);
    if (visFrontier.length) {
      for (const endId of [visFrontier[0].id, visFrontier[visFrontier.length - 1].id]) {
        if (!wantIds.includes(endId)) wantIds.push(endId);
      }
      for (const f of visFrontier) if (!wantIds.includes(f.id)) wantIds.push(f.id);
    }
    if (!narrow) {
      for (const id of cfg.refs || []) {
        if (!wantIds.includes(id) && visible.some((v) => v.id === id)) wantIds.push(id);
      }
    }

    const maxLab = narrow ? 5 : 12;
    const offsets = [
      [11.5, 3, 'start'],
      [10.5, -8, 'start'],
      [10.5, 12, 'start'],
      [-11.5, 3, 'end'],
      [-10.5, -8, 'end'],
      [0, -12, 'middle'],
      [0, 15, 'middle'],
      [18, 11, 'start'],
      [-16, -12, 'end'],
    ];

    const overlap = (a, b, p = 2) =>
      !(a.x + a.w + p < b.x || b.x + b.w + p < a.x || a.y + a.h + p < b.y || b.y + b.h + p < a.y);

    for (const id of wantIds) {
      if (placed.length >= maxLab) break;
      const v = visible.find((x) => x.id === id);
      if (!v) continue;
      const cx = X(v.msrpUsd);
      const cy = Y(v.metricValue);
      const on = fIds.has(v.id) || v.id === cfg.state.pinnedId;
      const txt = shortLabel(v, visFrontier);
      const fs = narrow ? 10 : 11;

      for (const [dx, dy, anchor] of offsets) {
        const lx = cx + dx;
        const ly = cy + dy;
        const node = el(
          'text',
          {
            x: lx.toFixed(1),
            y: ly.toFixed(1),
            'text-anchor': anchor,
            class: on ? 'evp-lab evp-on' : 'evp-lab',
            'font-size': fs,
          },
          labelsGroup,
          txt
        );
        let bb;
        try {
          const b = node.getBBox();
          bb = { x: b.x, y: b.y, w: b.width, h: b.height };
        } catch (_) {
          const w = txt.length * fs * 0.56;
          bb = { x: anchor === 'end' ? lx - w : anchor === 'middle' ? lx - w / 2 : lx, y: ly - fs, w, h: fs + 2 };
        }

        const inBox =
          bb.x >= pad.l + 3 &&
          bb.x + bb.w <= W - pad.r - 3 &&
          bb.y >= pad.t + 3 &&
          bb.y + bb.h <= H - pad.b - 3;
        const hitLab = placed.some((p) => overlap(bb, p, 3));
        const hitDot = obstacles.some((o) => o.id !== v.id && overlap(bb, o, 1));
        if (inBox && !hitLab && !hitDot) {
          placed.push(bb);
          break;
        }
        labelsGroup.removeChild(node);
      }
    }

    const pinnedObj = cfg.state.pinnedId ? rows.find((r) => r.id === cfg.state.pinnedId) : null;
    renderLiveBar(live, rows, frontier, pinnedObj, isKwh, () => {
      cfg.state.pinnedId = null;
      draw(root, cfg);
    });
  }

  document.querySelectorAll('[data-evp-fig]').forEach((root) => {
    const cfg = FIGS[root.dataset.evpFig];
    if (!cfg) return;
    const bar = root.querySelector('.evp-chips');
    const wrap = root.querySelector('.evp-wrap');
    if (wrap && !root.querySelector('.evp-legend')) {
      const leg = document.createElement('div');
      leg.className = 'evp-legend';
      leg.setAttribute('aria-label', 'Chart legend');
      root.insertBefore(leg, wrap);
    }
    if (bar && cfg.chips) {
      const stateKey = Object.keys(cfg.state)[0];
      for (const [val, label] of cfg.chips) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'evp-chip';
        btn.textContent = label;
        btn.setAttribute('aria-pressed', String(cfg.state[stateKey] === val));
        btn.addEventListener('click', () => {
          cfg.state[stateKey] = val;
          bar.querySelectorAll('.evp-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          draw(root, cfg);
        });
        bar.appendChild(btn);
      }
    }
    draw(root, cfg);
    let lastW = root.clientWidth;
    let timer = null;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (root.clientWidth !== lastW) {
          lastW = root.clientWidth;
          draw(root, cfg);
        }
      }, 120);
    });
  });
})();
