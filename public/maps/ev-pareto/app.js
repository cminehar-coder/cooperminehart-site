(function () {
  'use strict';

  const DATA = window.EV_PARETO_DATA;
  const M = window.EVParetoModel;
  if (!DATA || !M) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'ev-pareto-state-v1';
  const ALL_MARKETS = Object.keys(DATA.markets);
  const ALL_CHEMS = Object.keys(DATA.chemistries);

  const REGION_ORDER = ['North America', 'Europe', 'East Asia', 'Oceania'];
  const MARKET_SHORT_NAMES = {
    US: 'USA',
    CA: 'Canada',
    EU: 'Euro (DE)',
    UK: 'UK',
    NO: 'Norway',
    CN: 'China',
    KR: 'S. Korea',
    JP: 'Japan',
    AU: 'Australia',
  };

  const REGION_PRESETS = {
    all: ALL_MARKETS,
    US: ['US'],
    na: ['US', 'CA'],
    eu: ['EU', 'UK', 'NO'],
    asia: ['CN', 'KR', 'JP'],
    CN: ['CN'],
    AU: ['AU'],
    'ex-cn': ALL_MARKETS.filter((m) => m !== 'CN'),
  };

  const CHEM_PRESETS = {
    all: ALL_CHEMS,
    mainstream: ['high-nickel', 'lfp'],
    'high-nickel': ['high-nickel'],
    lfp: ['lfp'],
    weird: ['lmfp', 'na-ion', 'semi-solid'],
  };

  const CHEM_SUBTITLES = {
    'high-nickel': 'NMC / NCA / NCMA ternary',
    lfp: 'LiFePO4 · Blade / Shenxing',
    lmfp: 'Mn-doped phosphate · M3P',
    'na-ion': 'Lithium-free · CATL Naxtra',
    'semi-solid': 'Hybrid solid-liquid cell',
  };

  const VALID_XSCALES = new Set(['150000', '80000', 'all', 'log']);
  const VALID_GRANULARITIES = new Set(['all', 'base', 'max']);
  const VALID_BODIES = new Set(['all', 'Hatchback', 'Sedan', 'SUV', 'Pickup', 'Van', 'Coupe']);
  const VALID_SORTS = new Set([
    'msrp-asc',
    'kwh-desc',
    'range-desc',
    'val-kwh',
    'val-range',
    'eff-desc',
    'name',
  ]);

  function defaultState() {
    return {
      yAxis: 'kwh',
      rangeUnit: 'mi',
      harmonizeRange: true,
      markets: [...ALL_MARKETS],
      chemistries: [...ALL_CHEMS],
      xScale: '150000',
      granularity: 'all',
      body: 'all',
      search: '',
      pretax: false,
      showRays: true,
      showStep: true,
      frontierOnly: false,
      sort: 'msrp-asc',
      selected: 'chevy-equinox-ev-fwd',
    };
  }

  function sanitizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;

    if (raw.yAxis === 'range' || raw.yAxis === 'kwh') base.yAxis = raw.yAxis;
    if (raw.rangeUnit === 'km' || raw.rangeUnit === 'mi') base.rangeUnit = raw.rangeUnit;
    if (typeof raw.harmonizeRange === 'boolean') base.harmonizeRange = raw.harmonizeRange;

    if (Array.isArray(raw.markets)) {
      base.markets = raw.markets.filter((m) => ALL_MARKETS.includes(m));
    }
    if (Array.isArray(raw.chemistries)) {
      base.chemistries = raw.chemistries.filter((c) => ALL_CHEMS.includes(c));
    }

    if (VALID_XSCALES.has(String(raw.xScale))) base.xScale = String(raw.xScale);
    if (VALID_GRANULARITIES.has(raw.granularity)) base.granularity = raw.granularity;
    if (VALID_BODIES.has(raw.body)) base.body = raw.body;
    if (typeof raw.search === 'string') base.search = raw.search.slice(0, 80);
    if (typeof raw.pretax === 'boolean') base.pretax = raw.pretax;
    if (typeof raw.showRays === 'boolean') base.showRays = raw.showRays;
    if (typeof raw.showStep === 'boolean') base.showStep = raw.showStep;
    if (typeof raw.frontierOnly === 'boolean') base.frontierOnly = raw.frontierOnly;
    if (VALID_SORTS.has(raw.sort)) base.sort = raw.sort;
    if (typeof raw.selected === 'string' && raw.selected) base.selected = raw.selected;

    return base;
  }

  function encodeScenario(st) {
    const compact = {
      y: st.yAxis,
      ru: st.rangeUnit,
      hr: st.harmonizeRange ? 1 : 0,
      m: st.markets,
      c: st.chemistries,
      xs: st.xScale,
      g: st.granularity,
      b: st.body,
      q: st.search,
      pt: st.pretax ? 1 : 0,
      ry: st.showRays ? 1 : 0,
      sp: st.showStep ? 1 : 0,
      fo: st.frontierOnly ? 1 : 0,
      so: st.sort,
      sel: st.selected,
    };
    return encodeURIComponent(JSON.stringify(compact));
  }

  function decodeScenario(hash) {
    if (!hash || !hash.startsWith('#scenario=')) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(hash.slice('#scenario='.length)));
      return sanitizeState({
        yAxis: parsed.y,
        rangeUnit: parsed.ru,
        harmonizeRange: Boolean(parsed.hr),
        markets: parsed.m,
        chemistries: parsed.c,
        xScale: parsed.xs,
        granularity: parsed.g,
        body: parsed.b,
        search: parsed.q,
        pretax: Boolean(parsed.pt),
        showRays: parsed.ry !== 0,
        showStep: parsed.sp !== 0,
        frontierOnly: Boolean(parsed.fo),
        sort: parsed.so,
        selected: parsed.sel,
      });
    } catch (_) {
      return null;
    }
  }

  function loadInitialState() {
    const fromHash = decodeScenario(window.location.hash);
    if (fromHash) return fromHash;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return sanitizeState(JSON.parse(saved));
    } catch (_) {
      // Ignore storage access errors
    }
    return defaultState();
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      // Ignore storage quota / privacy mode errors
    }
  }

  let state = loadInitialState();
  let currentEval = { rows: [], frontier: [], frontierIds: new Set() };
  let latestChartMeta = {
    plottedCount: 0,
    overflowCount: 0,
    directLabelCount: 0,
    labelOverlaps: 0,
    xScaleMode: state.xScale,
    xDomain: [0, 150000],
    yDomain: [0, 240],
  };

  // DOM References
  const els = {
    scopePill: document.getElementById('scope-pill'),
    resetAll: document.getElementById('reset-all'),
    yAxisBtns: Array.from(document.querySelectorAll('[data-yaxis]')),
    rangeOptions: document.getElementById('range-options'),
    harmonizeRange: document.getElementById('harmonize-range'),
    marketSummary: document.getElementById('market-summary'),
    regionPresetBtns: Array.from(document.querySelectorAll('[data-region-preset]')),
    marketGroups: document.getElementById('market-groups'),
    priceRuleNote: document.getElementById('price-rule-note'),
    chemSummary: document.getElementById('chem-summary'),
    chemPresetBtns: Array.from(document.querySelectorAll('[data-chem-preset]')),
    chemList: document.getElementById('chemistry-list'),
    xScale: document.getElementById('x-scale'),
    granularity: document.getElementById('granularity'),
    bodyFilter: document.getElementById('body-filter'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    pretax: document.getElementById('pretax'),
    showRays: document.getElementById('show-rays'),
    raysLabel: document.getElementById('rays-label'),
    showStep: document.getElementById('show-step'),
    chartTitle: document.getElementById('chart-title'),
    chartSubtitle: document.getElementById('chart-subtitle'),
    frontierPill: document.getElementById('frontier-pill'),
    legend: document.getElementById('legend'),
    overflowBanner: document.getElementById('overflow-banner'),
    chartWrap: document.getElementById('chart-wrap'),
    chart: document.getElementById('chart'),
    tooltip: document.getElementById('tooltip'),
    chartEmpty: document.getElementById('chart-empty'),
    chartStatus: document.getElementById('chart-status'),
    frontierExplanation: document.getElementById('frontier-explanation'),
    ladderMeta: document.getElementById('ladder-meta'),
    frontierLadder: document.getElementById('frontier-ladder'),
    vehicleDetail: document.getElementById('vehicle-detail'),
    tableSubtitle: document.getElementById('table-subtitle'),
    shareBtn: document.getElementById('share-btn'),
    exportBtn: document.getElementById('export-btn'),
    frontierOnly: document.getElementById('frontier-only'),
    sortSelect: document.getElementById('sort-select'),
    thMsrp: document.getElementById('th-msrp'),
    thRange: document.getElementById('th-range'),
    thValRange: document.getElementById('th-val-range'),
    vehicleTable: document.getElementById('vehicle-table'),
    tableNote: document.getElementById('table-note'),
    discontinuedList: document.getElementById('discontinued-list'),
    toast: document.getElementById('toast'),
  };

  // Formatting Helpers
  const fmtUsd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const fmtUsdCompact = (n) => {
    if (n === 0) return '$0';
    if (n >= 1000) {
      const k = n / 1000;
      return '$' + (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
    }
    return '$' + Math.round(n);
  };
  const fmtKwh = (n) => (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1));
  const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

  function fmtLocalPrice(marketCode, amount) {
    const meta = DATA.markets[marketCode];
    if (!meta || amount == null) return '';
    if (marketCode === 'NO') return `${Math.round(amount).toLocaleString('en-US')} kr`;
    return `${meta.symbol}${Math.round(amount).toLocaleString('en-US')}`;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sameSet(arrA, arrB) {
    if (arrA.length !== arrB.length) return false;
    const setB = new Set(arrB);
    return arrA.every((x) => setB.has(x));
  }

  // Geometry for distinct accessible chemistry markers
  function markerPathD(shape, r) {
    switch (shape) {
      case 'square': {
        const s = +(r * 0.88).toFixed(2);
        return `M ${-s} ${-s} H ${s} V ${s} H ${-s} Z`;
      }
      case 'diamond': {
        const d = +(r * 1.22).toFixed(2);
        return `M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`;
      }
      case 'triangle': {
        const t = +(r * 1.28).toFixed(2);
        const w = +(r * 1.16).toFixed(2);
        const b = +(r * 0.96).toFixed(2);
        return `M 0 ${-t} L ${w} ${b} L ${-w} ${b} Z`;
      }
      case 'star': {
        const outer = r * 1.36;
        const inner = r * 0.58;
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? outer : inner;
          const angle = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push(`${(Math.cos(angle) * rad).toFixed(2)} ${(Math.sin(angle) * rad).toFixed(2)}`);
        }
        return `M ${pts.join(' L ')} Z`;
      }
      case 'circle':
      default: {
        const c = +r.toFixed(2);
        return `M ${-c} 0 a ${c} ${c} 0 1 0 ${c * 2} 0 a ${c} ${c} 0 1 0 ${-c * 2} 0`;
      }
    }
  }

  function inlineChemIconSvg(chemKey, size = 14) {
    const meta = DATA.chemistries[chemKey] || DATA.chemistries['high-nickel'];
    const half = size / 2;
    const d = markerPathD(meta.shape, size * 0.36);
    const stroke = chemKey === 'semi-solid' ? '#1E2A33' : '#FFFFFF';
    return `<svg class="chem-swatch" width="${size}" height="${size}" viewBox="${-half} ${-half} ${size} ${size}" aria-hidden="true"><path d="${d}" fill="${meta.color}" stroke="${stroke}" stroke-width="1"/></svg>`;
  }

  function svgEl(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) node.setAttribute(k, String(v));
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let toastTimer = null;
  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2600);
  }

  // Faceted counts for controls so users know what each toggle contains
  function computeFacetCounts() {
    const marketCounts = Object.fromEntries(ALL_MARKETS.map((m) => [m, 0]));
    const chemCounts = Object.fromEntries(ALL_CHEMS.map((c) => [c, 0]));
    const activeChems = new Set(state.chemistries);
    const activeMarkets = new Set(state.markets);
    const query = state.search.trim().toLowerCase();

    for (const v of DATA.vehicles) {
      if (state.body !== 'all' && v.body !== state.body) continue;
      if (query) {
        const hay = `${v.year} ${v.make} ${v.model} ${v.trim} ${v.cellDetail} ${v.chemistry}`.toLowerCase();
        if (!hay.includes(query)) continue;
      }
      if (activeChems.has(v.chemistry)) {
        for (const m of v.markets) {
          if (marketCounts[m] !== undefined) marketCounts[m]++;
        }
      }
      if (v.markets.some((m) => activeMarkets.has(m))) {
        if (chemCounts[v.chemistry] !== undefined) chemCounts[v.chemistry]++;
      }
    }
    return { marketCounts, chemCounts };
  }

  function renderSidebarControls() {
    const { marketCounts, chemCounts } = computeFacetCounts();

    // Y-axis segmented buttons (both sidebar and chart header)
    const activeYKey = state.yAxis === 'kwh' ? 'kwh' : `range-${state.rangeUnit}`;
    for (const btn of els.yAxisBtns) {
      const isMatch = btn.dataset.yaxis === activeYKey;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
    }

    els.rangeOptions.hidden = state.yAxis !== 'range';
    els.harmonizeRange.checked = state.harmonizeRange;

    // Region summary & preset chips
    els.marketSummary.textContent = `${state.markets.length} / ${ALL_MARKETS.length}`;
    for (const chip of els.regionPresetBtns) {
      const target = REGION_PRESETS[chip.dataset.regionPreset] || [];
      const active = sameSet(state.markets, target);
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    }

    // Grouped market checkboxes
    const activeMarketSet = new Set(state.markets);
    els.marketGroups.innerHTML = REGION_ORDER.map((regionName) => {
      const codes = ALL_MARKETS.filter((c) => DATA.markets[c].region === regionName);
      const allChecked = codes.every((c) => activeMarketSet.has(c));
      const itemsHtml = codes
        .map((code) => {
          const meta = DATA.markets[code];
          const checked = activeMarketSet.has(code) ? 'checked' : '';
          const title = `${meta.name} (${meta.currency}) -- ${marketCounts[code]} matching EV configs`;
          return `<label class="market-item" title="${escapeHtml(title)}">
            <input type="checkbox" data-market="${code}" ${checked}>
            <span><b>${code}</b> ${escapeHtml(MARKET_SHORT_NAMES[code] || meta.name)} <em>(${marketCounts[code]})</em></span>
          </label>`;
        })
        .join('');

      return `<div class="market-region-box">
        <div class="market-region-head">
          <span>${escapeHtml(regionName)}</span>
          <button type="button" class="region-toggle-btn" data-toggle-region="${escapeHtml(regionName)}">${allChecked ? 'Clear' : 'Select all'}</button>
        </div>
        <div class="market-grid">${itemsHtml}</div>
      </div>`;
    }).join('');

    // Price rule note
    if (state.markets.length === 0) {
      els.priceRuleNote.textContent = 'No markets selected. Check at least one country or preset above.';
    } else if (state.markets.length === 1) {
      const m = state.markets[0];
      const meta = DATA.markets[m];
      const fxText = m === 'US' ? 'exact USD retail MSRP' : `${meta.currency} MSRP converted at ${meta.fxPerUsd} ${meta.currency}/USD`;
      els.priceRuleNote.textContent = `Single-country mode (${meta.name}): plotting ${fxText}${state.pretax && meta.vatRate ? ', net of local VAT/GST' : ''}.`;
    } else {
      els.priceRuleNote.textContent = `Multi-market mode (${state.markets.length} countries): each vehicle plots at its lowest purchasable ${state.pretax ? 'pre-tax ' : ''}MSRP across your active markets.`;
    }

    // Chemistry summary & presets
    els.chemSummary.textContent = `${state.chemistries.length} / ${ALL_CHEMS.length}`;
    for (const chip of els.chemPresetBtns) {
      const target = CHEM_PRESETS[chip.dataset.chemPreset] || [];
      const active = sameSet(state.chemistries, target);
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    }

    const activeChemSet = new Set(state.chemistries);
    els.chemList.innerHTML = ALL_CHEMS.map((chemKey) => {
      const meta = DATA.chemistries[chemKey];
      const checked = activeChemSet.has(chemKey) ? 'checked' : '';
      return `<label class="chem-item" title="${escapeHtml(meta.description)}">
        <input type="checkbox" data-chem="${chemKey}" ${checked}>
        ${inlineChemIconSvg(chemKey, 15)}
        <span class="chem-name">${escapeHtml(meta.short)}<small>${escapeHtml(CHEM_SUBTITLES[chemKey] || '')}</small></span>
        <span class="chem-count">${chemCounts[chemKey]}</span>
      </label>`;
    }).join('');

    // Select & checkbox sync
    els.xScale.value = state.xScale;
    els.granularity.value = state.granularity;
    els.bodyFilter.value = state.body;
    if (els.searchInput.value !== state.search) {
      els.searchInput.value = state.search;
    }
    els.clearSearch.hidden = state.search.length === 0;
    els.pretax.checked = state.pretax;
    els.showRays.checked = state.showRays;
    els.showStep.checked = state.showStep;
    els.frontierOnly.checked = state.frontierOnly;
    els.sortSelect.value = state.sort;

    const rayUnitLabel = state.yAxis === 'kwh' ? '$/kWh' : `$/${state.rangeUnit}`;
    els.raysLabel.innerHTML = `Show ${rayUnitLabel} iso-value reference rays<small>Reference trajectories showing constant vehicle MSRP per ${state.yAxis === 'kwh' ? 'usable kWh' : state.rangeUnit}.</small>`;
  }

  function renderHeaderAndLegend() {
    const { rows, frontier } = currentEval;
    els.scopePill.textContent = `${DATA.vehicles.length} configs · 9 markets · ${DATA.asOf}`;

    if (state.yAxis === 'kwh') {
      els.chartTitle.textContent = `Usable Battery Capacity (kWh) vs. ${state.pretax ? 'Pre-Tax ' : 'Retail '}MSRP`;
    } else {
      const unitWord = state.rangeUnit === 'km' ? 'Kilometers' : 'Miles';
      const cycleNote = state.harmonizeRange ? 'EPA-Equivalent' : 'Official Local Cycle';
      els.chartTitle.textContent = `Driving Range (${unitWord}, ${cycleNote}) vs. ${state.pretax ? 'Pre-Tax ' : 'Retail '}MSRP`;
    }

    const mktDesc =
      state.markets.length === ALL_MARKETS.length
        ? 'Global (all 9 markets)'
        : state.markets.length === 1
        ? `${DATA.markets[state.markets[0]].name} only`
        : `${state.markets.length} selected markets (${state.markets.join(', ')})`;

    const granDesc =
      state.granularity === 'base'
        ? ' · Lowest-MSRP trim per model'
        : state.granularity === 'max'
        ? ' · Max-pack trim per model'
        : '';

    els.chartSubtitle.textContent = `${rows.length} active EV configurations in ${mktDesc}${granDesc}`;
    els.frontierPill.textContent = `${frontier.length} on Pareto frontier`;

    // Legend items
    const activeChemSet = new Set(state.chemistries);
    const chemLegend = ALL_CHEMS.filter((c) => activeChemSet.has(c))
      .map((c) => {
        const meta = DATA.chemistries[c];
        return `<span class="legend-item">${inlineChemIconSvg(c, 14)}<span>${escapeHtml(meta.short)}</span></span>`;
      })
      .join('');

    const stepLegend = state.showStep
      ? `<span class="legend-item"><span class="legend-step" aria-hidden="true"></span><span>Dominated boundary</span></span>`
      : '';

    const harmonizedLegend =
      state.yAxis === 'range' && state.harmonizeRange && rows.some((r) => r.isHarmonizedEstimate)
        ? `<span class="legend-item"><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="5" fill="#56636D"/><circle r="2" fill="#FFFFFF"/></svg><span>Hollow center = WLTP/CLTC→EPA eq.</span></span>`
        : '';

    els.legend.innerHTML = `
      <span class="legend-item"><span class="legend-line" aria-hidden="true"></span><strong>Pareto frontier</strong></span>
      ${stepLegend}
      ${chemLegend}
      ${harmonizedLegend}
    `;
  }

  function boxesOverlap(a, b, pad = 2) {
    return !(
      a.x + a.width + pad < b.x ||
      b.x + b.width + pad < a.x ||
      a.y + a.height + pad < b.y ||
      b.y + b.height + pad < a.y
    );
  }

  function computeXScale(rows, plotLeft, plotRight, isMobile) {
    const plotW = plotRight - plotLeft;
    if (state.xScale === 'log') {
      const xMin = 5000;
      const xMax = 425000;
      const logMin = Math.log10(xMin);
      const logMax = Math.log10(xMax);
      const ticks = isMobile
        ? [5000, 10000, 25000, 60000, 150000, 400000]
        : [5000, 10000, 20000, 40000, 80000, 150000, 300000, 420000];
      return {
        mode: 'log',
        xMin,
        xMax,
        ticks,
        toPx: (val) => {
          const clamped = Math.max(xMin, Math.min(xMax, val));
          return plotLeft + ((Math.log10(clamped) - logMin) / (logMax - logMin)) * plotW;
        },
      };
    }

    let xMax = 150000;
    if (state.xScale === '80000') {
      xMax = 80000;
    } else if (state.xScale === 'all') {
      const maxRow = rows.reduce((m, r) => Math.max(m, r.msrpUsd), 60000);
      xMax = Math.max(80000, Math.ceil((maxRow * 1.05) / 50000) * 50000);
    }

    let step = 25000;
    if (xMax <= 80000) step = isMobile ? 20000 : 10000;
    else if (xMax <= 150000) step = isMobile ? 50000 : 25000;
    else step = isMobile ? 100000 : 50000;

    const ticks = [];
    for (let v = 0; v <= xMax; v += step) ticks.push(v);

    return {
      mode: 'linear',
      xMin: 0,
      xMax,
      ticks,
      toPx: (val) => plotLeft + (val / xMax) * plotW,
    };
  }

  function computeYScale(visibleRows, frontierRows, plotTop, plotBottom, isMobile) {
    const plotH = plotBottom - plotTop;
    const refRows = visibleRows.length > 0 ? visibleRows : frontierRows;
    const rawMax = refRows.reduce((m, r) => Math.max(m, r.metricValue), state.yAxis === 'kwh' ? 100 : 300);

    let step;
    if (state.yAxis === 'kwh') {
      step = rawMax <= 120 ? 20 : isMobile ? 50 : 40;
    } else if (state.rangeUnit === 'km') {
      step = rawMax <= 600 ? 100 : 200;
    } else {
      step = rawMax <= 350 ? 50 : 100;
    }

    const yMax = Math.max(step * 3, Math.ceil((rawMax * 1.1) / step) * step);
    const ticks = [];
    for (let v = 0; v <= yMax; v += step) ticks.push(v);

    return {
      yMin: 0,
      yMax,
      ticks,
      toPx: (val) => plotBottom - (val / yMax) * plotH,
    };
  }

  function renderOverflowBanner(overflowRows) {
    if (overflowRows.length === 0) {
      els.overflowBanner.hidden = true;
      els.overflowBanner.innerHTML = '';
      return;
    }

    const capLabel = fmtUsdCompact(Number(state.xScale));
    const frontierOverflow = overflowRows.filter((r) => r.onFrontier);
    const frontierNote =
      frontierOverflow.length > 0
        ? ` (${frontierOverflow.length} on Pareto frontier; line continues to right edge)`
        : ' (none on Pareto frontier)';

    const chips = overflowRows
      .slice()
      .sort((a, b) => a.msrpUsd - b.msrpUsd)
      .map(
        (r) =>
          `<button type="button" class="overflow-chip" data-overflow-id="${escapeHtml(r.id)}">${escapeHtml(r.short)} · ${fmtUsdCompact(r.msrpUsd)}</button>`
      )
      .join('');

    els.overflowBanner.hidden = false;
    els.overflowBanner.innerHTML = `
      <span><strong>${overflowRows.length} ultra-luxury EV${overflowRows.length === 1 ? '' : 's'} &gt; ${capLabel}</strong> outside zoom frame${frontierNote}:</span>
      ${chips}
      <button type="button" class="overflow-chip" data-zoom-all="1"><strong>Zoom out to all MSRPs →</strong></button>
    `;
  }

  function renderChart() {
    const svg = els.chart;
    svg.innerHTML = '';
    els.tooltip.hidden = true;

    const { rows, frontier } = currentEval;
    const width = Math.max(280, Math.round(els.chartWrap.clientWidth || 900));
    const height = Math.max(340, Math.round(svg.clientHeight || 490));
    const isMobile = width < 540;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    if (rows.length === 0) {
      els.chartEmpty.hidden = false;
      const reason =
        state.markets.length === 0
          ? 'No countries/regions are selected.'
          : state.chemistries.length === 0
          ? 'No battery chemistries are selected.'
          : 'No vehicles match your active search, body style, and chemistry filters.';
      els.chartEmpty.innerHTML = `<div><strong>No EVs to plot</strong><p style="margin:6px 0 10px">${escapeHtml(reason)}</p><button type="button" class="secondary" id="empty-reset-btn">Reset filters</button></div>`;
      const resetBtn = document.getElementById('empty-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state = defaultState();
          update();
        });
      }
      renderOverflowBanner([]);
      els.chartStatus.textContent = '0 vehicles plotted.';
      latestChartMeta = {
        plottedCount: 0,
        overflowCount: 0,
        directLabelCount: 0,
        labelOverlaps: 0,
        xScaleMode: state.xScale,
        xDomain: [0, 0],
        yDomain: [0, 0],
      };
      return;
    }

    els.chartEmpty.hidden = true;

    const pad = isMobile
      ? { left: 44, right: 24, top: 22, bottom: 44 }
      : { left: 58, right: 26, top: 24, bottom: 48 };

    const plotLeft = pad.left;
    const plotRight = width - pad.right;
    const plotTop = pad.top;
    const plotBottom = height - pad.bottom;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    const xScale = computeXScale(rows, plotLeft, plotRight, isMobile);
    const inFrameRows =
      xScale.mode === 'log'
        ? rows.slice()
        : rows.filter((r) => r.msrpUsd <= xScale.xMax + 1e-6);
    const overflowRows =
      xScale.mode === 'log'
        ? []
        : rows.filter((r) => r.msrpUsd > xScale.xMax + 1e-6);

    renderOverflowBanner(overflowRows);

    const yScale = computeYScale(inFrameRows, frontier, plotTop, plotBottom, isMobile);

    // Clip path for lines/rays inside plot frame
    const defs = svgEl('defs');
    const clip = svgEl('clipPath', { id: 'plot-frame-clip' });
    clip.appendChild(
      svgEl('rect', {
        x: plotLeft,
        y: plotTop,
        width: plotW,
        height: plotH,
      })
    );
    defs.appendChild(clip);
    svg.appendChild(defs);

    // Plot background (pure white, crisp rule frame)
    svg.appendChild(
      svgEl('rect', {
        x: plotLeft,
        y: plotTop,
        width: plotW,
        height: plotH,
        fill: '#FFFFFF',
        stroke: '#E3E8EA',
        'stroke-width': 1,
      })
    );

    const gridGroup = svgEl('g', { class: 'grid-layer' });
    svg.appendChild(gridGroup);

    // Horizontal Y gridlines & labels
    for (const tick of yScale.ticks) {
      const y = yScale.toPx(tick);
      gridGroup.appendChild(
        svgEl('line', {
          x1: plotLeft,
          x2: plotRight,
          y1: y,
          y2: y,
          stroke: tick === 0 ? '#1E2A33' : '#E3E8EA',
          'stroke-width': tick === 0 ? 1.5 : 1,
        })
      );
      gridGroup.appendChild(
        svgEl(
          'text',
          {
            x: plotLeft - 8,
            y: y + 3.5,
            'text-anchor': 'end',
          },
          String(tick)
        )
      );
    }

    // Vertical X gridlines & labels
    for (const tick of xScale.ticks) {
      const x = xScale.toPx(tick);
      gridGroup.appendChild(
        svgEl('line', {
          x1: x,
          x2: x,
          y1: plotTop,
          y2: plotBottom,
          stroke: tick === xScale.xMin ? '#1E2A33' : '#E3E8EA',
          'stroke-width': tick === xScale.xMin ? 1.5 : 1,
        })
      );
      gridGroup.appendChild(
        svgEl(
          'text',
          {
            x,
            y: plotBottom + 17,
            'text-anchor': 'middle',
          },
          fmtUsdCompact(tick)
        )
      );
    }

    // Axis titles
    const xTitle =
      state.xScale === 'log'
        ? `${state.pretax ? 'Pre-Tax ' : 'Retail '}MSRP in USD (Log Scale →)`
        : isMobile
        ? `${state.pretax ? 'Pre-Tax ' : 'Retail '}MSRP in USD (← Lower · Higher →)`
        : `${state.pretax ? 'Pre-Tax ' : 'Retail '}MSRP in USD (Lower is Left ← · Higher is Right →)`;
    svg.appendChild(
      svgEl(
        'text',
        {
          class: 'axis-title',
          x: plotLeft + plotW / 2,
          y: height - 8,
          'text-anchor': 'middle',
        },
        xTitle
      )
    );

    const yTitle =
      state.yAxis === 'kwh'
        ? 'Usable Battery Capacity (kWh)'
        : `Driving Range (${state.rangeUnit === 'km' ? 'km' : 'miles'})`;
    const yAxisTitleX = isMobile ? 13 : 16;
    const yAxisTitleY = plotTop + plotH / 2;
    svg.appendChild(
      svgEl(
        'text',
        {
          class: 'axis-title',
          x: yAxisTitleX,
          y: yAxisTitleY,
          'text-anchor': 'middle',
          transform: `rotate(-90 ${yAxisTitleX} ${yAxisTitleY})`,
        },
        yTitle
      )
    );

    const clippedLayer = svgEl('g', { 'clip-path': 'url(#plot-frame-clip)' });
    svg.appendChild(clippedLayer);

    // Iso-value reference rays (y = x / rate)
    if (state.showRays) {
      const rates =
        state.yAxis === 'kwh'
          ? [250, 450, 800, 1500]
          : state.rangeUnit === 'km'
          ? [45, 80, 130, 220]
          : [75, 125, 200, 350];

      const unitSuffix = state.yAxis === 'kwh' ? '/kWh' : `/${state.rangeUnit}`;

      for (const rate of rates) {
        const endXVal = Math.min(xScale.xMax, rate * yScale.yMax);
        const startXVal = xScale.mode === 'log' ? xScale.xMin : 0;
        if (endXVal <= startXVal) continue;

        let d = '';
        const samples = xScale.mode === 'log' ? 42 : 2;
        for (let i = 0; i <= samples; i++) {
          const t = i / samples;
          const xv =
            xScale.mode === 'log'
              ? startXVal * Math.pow(endXVal / startXVal, t)
              : startXVal + (endXVal - startXVal) * t;
          const yv = xv / rate;
          const px = xScale.toPx(xv);
          const py = yScale.toPx(yv);
          d += (i === 0 ? 'M ' : ' L ') + `${px.toFixed(1)} ${py.toFixed(1)}`;
        }

        clippedLayer.appendChild(
          svgEl('path', {
            d,
            fill: 'none',
            stroke: '#D2DBE0',
            'stroke-width': 1,
            'stroke-dasharray': '3 4',
          })
        );

        if (!isMobile) {
          let frac = 0.94;
          let lx = xScale.toPx(endXVal * frac);
          let ly = yScale.toPx((endXVal * frac) / rate);
          // Avoid colliding with the top-left 'HIGHER OUTPUT · LOWER MSRP' callout banner
          if (ly < plotTop + 28 && lx < plotLeft + 340) {
            frac = 0.78;
            lx = xScale.toPx(endXVal * frac);
            ly = yScale.toPx((endXVal * frac) / rate);
          }
          if (lx > plotLeft + 44 && lx < plotRight - 6 && ly > plotTop + 12 && ly < plotBottom - 10) {
            clippedLayer.appendChild(
              svgEl(
                'text',
                {
                  class: 'ray-label',
                  x: lx - 3,
                  y: ly - 4,
                  'text-anchor': 'end',
                },
                `$${rate}${unitSuffix}`
              )
            );
          }
        }
      }
    }

    // Monotonic Pareto Step Boundary & Direct Poppy Frontier Line
    if (frontier.length > 0) {
      const stepPts = M.paretoStepPoints(frontier, xScale.xMax);
      if (state.showStep && stepPts.length >= 2) {
        const stepD = stepPts
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale.toPx(p.x).toFixed(1)} ${yScale.toPx(p.y).toFixed(1)}`)
          .join(' ');

        clippedLayer.appendChild(
          svgEl('path', {
            d: stepD,
            fill: 'none',
            stroke: '#D6363F',
            'stroke-opacity': '0.5',
            'stroke-width': 1.4,
            'stroke-dasharray': '5 4',
          })
        );
      }

      // Direct Pareto Frontier Polyline (Poppy: "The one thing to see")
      if (frontier.length >= 2) {
        const lineD = frontier
          .map(
            (f, i) =>
              `${i === 0 ? 'M' : 'L'} ${xScale.toPx(f.msrpUsd).toFixed(1)} ${yScale.toPx(f.metricValue).toFixed(1)}`
          )
          .join(' ');
        clippedLayer.appendChild(
          svgEl('path', {
            d: lineD,
            fill: 'none',
            stroke: '#D6363F',
            'stroke-width': 2.6,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          })
        );
      }
    }

    // Upper-left Pareto direction callout
    const calloutText = isMobile
      ? '↖ Pareto optimal'
      : '↖ Higher output · lower MSRP (Pareto frontier)';
    const calloutEl = svgEl(
      'text',
      {
        class: 'better-callout',
        x: plotLeft + 10,
        y: plotTop + 16,
        stroke: '#FFFFFF',
        'stroke-width': 3.5,
        'paint-order': 'stroke',
      },
      calloutText
    );
    svg.appendChild(calloutEl);

    // Sort points for clean z-ordering: non-frontier first, then frontier, then selected on very top
    const orderedRows = inFrameRows.slice().sort((a, b) => {
      const aSel = a.id === state.selected ? 2 : a.onFrontier ? 1 : 0;
      const bSel = b.id === state.selected ? 2 : b.onFrontier ? 1 : 0;
      return aSel - bSel || a.msrpUsd - b.msrpUsd;
    });

    const pointsGroup = svgEl('g', { class: 'points-layer' });
    svg.appendChild(pointsGroup);

    const coordsById = new Map();

    for (const r of orderedRows) {
      const cx = xScale.toPx(r.msrpUsd);
      const cy = yScale.toPx(r.metricValue);
      coordsById.set(r.id, { cx, cy, row: r });

      const chem = DATA.chemistries[r.chemistry] || DATA.chemistries['high-nickel'];
      const isSelected = r.id === state.selected;
      const radius = isSelected ? 7.2 : r.onFrontier ? 6.4 : 4.9;

      const metricDesc =
        state.yAxis === 'kwh'
          ? `${fmtKwh(r.kwhUsable)} kWh usable`
          : `${fmtInt(r.rangeDisplay)} ${r.rangeUnit} (${r.rangeCycleLabel})`;

      const g = svgEl('g', {
        class: `dot-group${r.onFrontier ? ' is-frontier' : ''}${isSelected ? ' is-selected' : ''}`,
        tabindex: '0',
        role: 'button',
        'data-id': r.id,
        'aria-label': `${r.year} ${r.make} ${r.model} ${r.trim}: ${metricDesc}, ${fmtUsd(r.msrpUsd)} in ${r.priceMarket}, ${chem.short}${r.onFrontier ? ', on Pareto frontier' : ''}`,
      });

      // Invisible 24px touch/pointer hit target
      g.appendChild(
        svgEl('circle', {
          cx,
          cy,
          r: 12,
          fill: 'transparent',
        })
      );

      // Keyboard focus halo
      g.appendChild(
        svgEl('circle', {
          class: 'focus-ring',
          cx,
          cy,
          r: 12.5,
        })
      );

      // Pareto frontier poppy outer ring
      if (r.onFrontier) {
        g.appendChild(
          svgEl('circle', {
            cx,
            cy,
            r: 9.2,
            fill: 'none',
            stroke: '#D6363F',
            'stroke-width': 1.8,
          })
        );
      }

      // Selected vehicle ink outer target ring
      if (isSelected) {
        g.appendChild(
          svgEl('circle', {
            cx,
            cy,
            r: 11.8,
            fill: 'none',
            stroke: '#1E2A33',
            'stroke-width': 2.2,
          })
        );
      }

      // Distinct chemistry shape marker
      const markerStroke = r.chemistry === 'semi-solid' ? '#1E2A33' : '#FFFFFF';
      g.appendChild(
        svgEl('path', {
          d: markerPathD(chem.shape, radius),
          transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)})`,
          fill: chem.color,
          'fill-opacity': r.onFrontier || isSelected ? '1' : '0.84',
          stroke: markerStroke,
          'stroke-width': r.chemistry === 'semi-solid' ? 1.25 : r.onFrontier || isSelected ? 1.45 : 1.1,
        })
      );

      // Hollow center dot when plotting converted WLTP/CLTC range
      if (r.isHarmonizedEstimate) {
        g.appendChild(
          svgEl('circle', {
            cx,
            cy,
            r: 2.0,
            fill: '#FFFFFF',
            'pointer-events': 'none',
          })
        );
      }

      g.addEventListener('mouseenter', () => showTooltip(r, cx, cy));
      g.addEventListener('mouseleave', hideTooltip);
      g.addEventListener('focus', () => showTooltip(r, cx, cy));
      g.addEventListener('blur', hideTooltip);
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        selectVehicle(r.id, false);
      });
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectVehicle(r.id, false);
        }
      });

      pointsGroup.appendChild(g);
    }

    // Greedy collision-free direct SVG labels
    const labelsGroup = svgEl('g', { class: 'labels-layer' });
    svg.appendChild(labelsGroup);

    const occupiedBoxes = [];
    // Protect callout text box
    try {
      const cb = calloutEl.getBBox();
      if (cb.width > 0) occupiedBoxes.push({ x: cb.x - 4, y: cb.y - 2, width: cb.width + 8, height: cb.height + 4 });
    } catch (_) {
      occupiedBoxes.push({ x: plotLeft + 6, y: plotTop + 4, width: 250, height: 18 });
    }

    // Protect marker centers so text never obscures frontier/selected rings
    const dotObstacles = [];
    for (const { cx, cy, row } of coordsById.values()) {
      const padR = row.id === state.selected ? 12.5 : row.onFrontier ? 10 : 5.5;
      dotObstacles.push({
        id: row.id,
        x: cx - padR,
        y: cy - padR,
        width: padR * 2,
        height: padR * 2,
      });
    }

    // Build prioritized label candidate list
    const candidateIds = [];
    const pushCandidate = (id) => {
      if (id && coordsById.has(id) && !candidateIds.includes(id)) candidateIds.push(id);
    };

    pushCandidate(state.selected);

    const visibleFrontier = frontier.filter((f) => coordsById.has(f.id));
    if (visibleFrontier.length > 0) {
      pushCandidate(visibleFrontier[0].id);
      pushCandidate(visibleFrontier[visibleFrontier.length - 1].id);
      for (const f of visibleFrontier) pushCandidate(f.id);
    }

    if (!isMobile) {
      // Notable chemistry / benchmark reference cars if space permits
      const notableIds = [
        'changan-nevo-a06-na-ion',
        'mg4-semi-solid',
        'im-l6-lightyear-semisolid',
        'luxeed-s7-m3p',
        'lucid-air-pure',
        'tesla-model3-std-us',
        'tesla-modely-std-us',
        'gmc-hummer-ev-3x-24mod',
        'rivian-r2-perf-awd',
      ];
      for (const id of notableIds) pushCandidate(id);
    }

    const maxLabels = isMobile ? 6 : 16;
    const candidateOffsets = [
      { dx: 10, dy: 3, anchor: 'start' },
      { dx: 9, dy: -8, anchor: 'start' },
      { dx: 9, dy: 12, anchor: 'start' },
      { dx: 0, dy: -12, anchor: 'middle' },
      { dx: -10, dy: 3, anchor: 'end' },
      { dx: -9, dy: -8, anchor: 'end' },
      { dx: -9, dy: 12, anchor: 'end' },
      { dx: 0, dy: 16, anchor: 'middle' },
      { dx: 20, dy: 11, anchor: 'start' },
      { dx: -16, dy: -13, anchor: 'end' },
      { dx: 18, dy: -15, anchor: 'start' },
    ];

    const placedLabelBoxes = [];

    for (const id of candidateIds) {
      if (placedLabelBoxes.length >= maxLabels) break;
      const item = coordsById.get(id);
      if (!item) continue;
      const { cx, cy, row } = item;
      const isSelected = row.id === state.selected;

      let labelText = row.short;
      // Disambiguate multi-pack frontier siblings (e.g., Silverado EV Extended vs Max)
      const sameShortOnFrontier = visibleFrontier.filter((f) => f.short === row.short);
      if (sameShortOnFrontier.length > 1) {
        const shortTrim = row.trim
          .replace(/\(.*?\)/g, '')
          .replace(/\b(WT|AWD|FWD|RWD|Dual|Luxury)\b/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join(' ');
        if (shortTrim) labelText = `${row.short} (${shortTrim})`;
      }

      let placed = false;
      const ringClear = isSelected ? 4 : row.onFrontier ? 2 : 0;
      for (const off of candidateOffsets) {
        const signX = off.dx === 0 ? 0 : off.dx > 0 ? 1 : -1;
        const signY = off.dx === 0 ? (off.dy > 0 ? 1 : -1) : 0;
        const lx = cx + off.dx + signX * ringClear;
        const ly = cy + off.dy + signY * ringClear;
        const textNode = svgEl(
          'text',
          {
            class: `point-label${row.onFrontier ? ' frontier-label' : ''}${isSelected ? ' selected-label' : ''}`,
            x: lx.toFixed(1),
            y: ly.toFixed(1),
            'text-anchor': off.anchor,
          },
          labelText
        );
        labelsGroup.appendChild(textNode);

        let bbox;
        try {
          bbox = textNode.getBBox();
        } catch (_) {
          bbox = { x: lx, y: ly - 10, width: labelText.length * 6, height: 12 };
        }

        const withinFrame =
          bbox.x >= plotLeft + 3 &&
          bbox.x + bbox.width <= plotRight - 3 &&
          bbox.y >= plotTop + 3 &&
          bbox.y + bbox.height <= plotBottom - 3;

        const hitsCalloutOrLabel =
          occupiedBoxes.some((b) => boxesOverlap(bbox, b, 3)) ||
          placedLabelBoxes.some((b) => boxesOverlap(bbox, b, 3));

        const hitsOtherMarker = dotObstacles.some(
          (d) => d.id !== row.id && boxesOverlap(bbox, d, 1)
        );

        if (withinFrame && !hitsCalloutOrLabel && !hitsOtherMarker) {
          // Subtle leader tick if label sits further away
          const nearX =
            off.anchor === 'start' ? bbox.x - 2 : off.anchor === 'end' ? bbox.x + bbox.width + 2 : cx;
          const nearY = bbox.y + bbox.height * 0.55;
          const dist = Math.hypot(nearX - cx, nearY - cy);
          if (dist > 8.5) {
            labelsGroup.insertBefore(
              svgEl('line', {
                x1: cx + ((nearX - cx) / dist) * 6.5,
                y1: cy + ((nearY - cy) / dist) * 6.5,
                x2: nearX,
                y2: nearY,
                stroke: isSelected ? '#1E2A33' : '#8FA0AC',
                'stroke-width': 0.9,
              }),
              textNode
            );
          }
          placedLabelBoxes.push({
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
          });
          placed = true;
          break;
        } else {
          labelsGroup.removeChild(textNode);
        }
      }
      void placed;
    }

    // Verify pairwise label overlaps (should always be 0)
    let overlapCount = 0;
    for (let i = 0; i < placedLabelBoxes.length; i++) {
      for (let j = i + 1; j < placedLabelBoxes.length; j++) {
        if (boxesOverlap(placedLabelBoxes[i], placedLabelBoxes[j], 0)) overlapCount++;
      }
    }

    els.chartStatus.textContent = `Showing ${inFrameRows.length} EV configurations${
      overflowRows.length ? ` (+${overflowRows.length} above ${fmtUsdCompact(xScale.xMax)} zoom)` : ''
    } · ${frontier.length} on Pareto frontier.`;

    latestChartMeta = {
      plottedCount: inFrameRows.length,
      overflowCount: overflowRows.length,
      directLabelCount: placedLabelBoxes.length,
      labelOverlaps: overlapCount,
      xScaleMode: xScale.mode,
      xDomain: [xScale.xMin, xScale.xMax],
      yDomain: [yScale.yMin, yScale.yMax],
    };
  }

  function showTooltip(r, cx, cy) {
    const chem = DATA.chemistries[r.chemistry];
    const mktMeta = DATA.markets[r.priceMarket];
    const localNote =
      r.priceMarket !== 'US'
        ? ` (${fmtLocalPrice(r.priceMarket, r.localAmount)} in ${r.priceMarket})`
        : ' (US MSRP)';

    els.tooltip.innerHTML = `
      <strong>${escapeHtml(r.year + ' ' + r.make + ' ' + r.model)}</strong>
      <div class="tip-sub">${escapeHtml(r.trim)} · ${escapeHtml(chem.short)}</div>
      <div><strong>MSRP:</strong> ${fmtUsd(r.msrpUsd)}${escapeHtml(localNote)}</div>
      <div><strong>Usable pack:</strong> ${fmtKwh(r.kwhUsable)} kWh <span style="color:#C7D0D6">(${fmtKwh(r.kwhGross)} gross)</span></div>
      <div><strong>Range:</strong> ${fmtInt(r.rangeDisplay)} ${r.rangeUnit} <span style="color:#C7D0D6">(${escapeHtml(r.rangeCycleLabel)})</span></div>
      <div><strong>Value:</strong> ${fmtUsd(r.dollarsPerKwh)}/kWh · ${fmtUsd(r.dollarsPerRange)}/${r.rangeUnit}</div>
      ${r.onFrontier ? '<span class="tip-frontier">★ Pareto frontier</span>' : ''}
      <small>Offered in: ${escapeHtml(r.markets.join(', '))}${mktMeta ? '' : ''}</small>
    `;
    els.tooltip.hidden = false;

    const wrapW = els.chartWrap.clientWidth || 800;
    const wrapH = els.chartWrap.clientHeight || 490;
    const tipW = els.tooltip.offsetWidth || 250;
    const tipH = els.tooltip.offsetHeight || 130;

    let left = cx + 15;
    if (left + tipW > wrapW - 8) left = cx - tipW - 15;
    left = Math.max(8, Math.min(wrapW - tipW - 8, left));

    let top = cy - tipH / 2;
    top = Math.max(8, Math.min(wrapH - tipH - 8, top));

    els.tooltip.style.left = `${Math.round(left)}px`;
    els.tooltip.style.top = `${Math.round(top)}px`;
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  function renderFrontierLadder() {
    const { frontier } = currentEval;
    if (frontier.length === 0) {
      els.ladderMeta.textContent = '0 vehicles';
      els.frontierLadder.innerHTML = `<span class="control-note">No frontier vehicles for current filter selection.</span>`;
      return;
    }

    const minF = frontier[0];
    const maxF = frontier[frontier.length - 1];
    els.ladderMeta.textContent = `${frontier.length} undefeated steps · ${fmtUsdCompact(minF.msrpUsd)} → ${fmtUsdCompact(maxF.msrpUsd)}`;

    els.frontierLadder.innerHTML = frontier
      .map((f, idx) => {
        const isSel = f.id === state.selected;
        const chem = DATA.chemistries[f.chemistry];
        const yText =
          state.yAxis === 'kwh'
            ? `${fmtKwh(f.kwhUsable)} kWh`
            : `${fmtInt(f.rangeDisplay)} ${f.rangeUnit}`;
        return `<button type="button" role="listitem" class="ladder-card${isSel ? ' selected' : ''}" data-select-id="${escapeHtml(f.id)}">
          <div class="ladder-step"><span>#${idx + 1} · ${escapeHtml(chem.short)}</span><span>${escapeHtml(f.priceMarket)}</span></div>
          <span class="ladder-name" title="${escapeHtml(f.make + ' ' + f.model + ' ' + f.trim)}">${escapeHtml(f.short)}</span>
          <div class="ladder-metrics">${fmtUsdCompact(f.msrpUsd)} · ${yText}</div>
        </button>`;
      })
      .join('');
  }

  function renderVehicleDetail() {
    const { rows, frontier } = currentEval;
    const r = rows.find((x) => x.id === state.selected) || frontier[0] || rows[0];

    if (!r) {
      els.vehicleDetail.innerHTML = `<p class="control-note">Select at least one market and chemistry to inspect vehicle specifications and Pareto dominance.</p>`;
      return;
    }

    const chem = DATA.chemistries[r.chemistry];
    const activeMarketSet = new Set(state.markets);

    // Market price tags across every region where this EV is sold
    const marketTags = r.markets
      .map((m) => {
        const isLowestActive = m === r.priceMarket;
        const isActive = activeMarketSet.has(m);
        const usdVal = state.pretax ? r.pricesPretaxUsd[m] : r.pricesUsd[m];
        const label = `${m}: ${fmtLocalPrice(m, r.localPrices[m])}${m !== 'US' ? ` (${fmtUsd(usdVal)})` : ''}`;
        return `<span class="mkt-tag${isLowestActive ? ' active-mkt' : ''}" title="${
          isLowestActive
            ? 'Active plotted MSRP'
            : isActive
            ? 'Also offered in your selected markets'
            : 'Offered here (market currently unchecked)'
        }">${escapeHtml(label)}${isLowestActive ? ' ★' : ''}</span>`;
      })
      .join('');

    // Exact Pareto Dominance Diagnostic
    let domHtml = '';
    if (r.onFrontier) {
      const idx = frontier.findIndex((f) => f.id === r.id);
      const prev = idx > 0 ? frontier[idx - 1] : null;
      const next = idx < frontier.length - 1 ? frontier[idx + 1] : null;
      const unitStr = state.yAxis === 'kwh' ? 'kWh' : r.rangeUnit;
      const prevNote = prev
        ? ` Steps up +${
            state.yAxis === 'kwh'
              ? fmtKwh(r.metricValue - prev.metricValue)
              : fmtInt(r.metricValue - prev.metricValue)
          } ${unitStr} over ${escapeHtml(prev.short)} (+${fmtUsd(r.msrpUsd - prev.msrpUsd)}).`
        : ' Anchors the lowest-MSRP entry point of the active frontier.';
      const nextNote = next
        ? ` Next step up: ${escapeHtml(next.short)} at ${fmtUsd(next.msrpUsd)} (${
            state.yAxis === 'kwh' ? fmtKwh(next.metricValue) : fmtInt(next.metricValue)
          } ${unitStr}).`
        : ' Holds the maximum capacity/range ceiling of the active frontier.';
      domHtml = `<div class="domination-box is-frontier"><strong>★ Undefeated on the active Pareto frontier (Step #${idx + 1} of ${frontier.length}):</strong> No active EV delivers ≥ ${
        state.yAxis === 'kwh' ? fmtKwh(r.metricValue) + ' kWh' : fmtInt(r.metricValue) + ' ' + r.rangeUnit
      } for ≤ ${fmtUsd(r.msrpUsd)}.${prevNote}${nextNote}</div>`;
    } else {
      const dominators = frontier.filter((f) => M.dominates(f, r));
      const topDom = dominators
        .slice()
        .sort(
          (a, b) =>
            r.msrpUsd - a.msrpUsd + (a.metricValue - r.metricValue) * 200 -
            (r.msrpUsd - b.msrpUsd + (b.metricValue - r.metricValue) * 200)
        )
        .reverse()
        .slice(0, 2);

      const domDesc = topDom
        .map((d) => {
          const saved = r.msrpUsd - d.msrpUsd;
          const gain = d.metricValue - r.metricValue;
          const gainStr =
            state.yAxis === 'kwh' ? `+${fmtKwh(gain)} kWh` : `+${fmtInt(gain)} ${r.rangeUnit}`;
          return `<button type="button" class="text-button" data-select-id="${escapeHtml(d.id)}">${escapeHtml(d.short)} (${escapeHtml(d.trim)})</button> (${fmtUsd(saved)} cheaper and ${gainStr})`;
        })
        .join(' and ');

      domHtml = `<div class="domination-box"><strong>Dominated in current view</strong> by ${dominators.length} frontier vehicle${
        dominators.length === 1 ? '' : 's'
      }, notably ${domDesc || 'active frontier leaders'}.</div>`;
    }

    const sourceLinks = (r.sources || [])
      .map((sKey) => {
        const s = DATA.sources[sKey];
        if (!s) return '';
        return `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)} ↗</a>`;
      })
      .filter(Boolean)
      .join('');

    const primaryMetricBig =
      state.yAxis === 'kwh'
        ? `${fmtKwh(r.kwhUsable)} kWh`
        : `${fmtInt(r.rangeDisplay)} ${r.rangeUnit}`;
    const primaryMetricSub =
      state.yAxis === 'kwh'
        ? `usable (${fmtKwh(r.kwhGross)} kWh gross) · ${fmtUsd(r.msrpUsd)} (${r.priceMarket})`
        : `${r.rangeCycleLabel} · ${fmtUsd(r.msrpUsd)} (${r.priceMarket})`;

    els.vehicleDetail.innerHTML = `
      <div class="detail-top">
        <div>
          <h2>${escapeHtml(r.year + ' ' + r.make + ' ' + r.model)}</h2>
          <p class="detail-trim">${escapeHtml(r.trim)} · ${escapeHtml(r.body)} · Cell: ${escapeHtml(r.cellDetail)}</p>
        </div>
        <div class="detail-highlight">
          <strong>${escapeHtml(primaryMetricBig)}</strong>
          <span>${escapeHtml(primaryMetricSub)}</span>
        </div>
      </div>

      <div class="badges">
        ${r.onFrontier ? '<span class="badge frontier">★ On Pareto Frontier</span>' : ''}
        <span class="badge">${inlineChemIconSvg(r.chemistry, 12)} ${escapeHtml(chem.label)}</span>
        <span class="badge">${r.epaVerified ? '✓ Official US EPA Verified' : `Cycle: ${escapeHtml(r.rawOfficialRange + ' ' + (r.rawOfficialCycle === 'EPA' ? 'mi EPA' : 'km ' + r.rawOfficialCycle))}`}</span>
        <span class="badge">Buffer: ${fmtKwh(Math.max(0, r.kwhGross - r.kwhUsable))} kWh (${Math.round((r.kwhUsable / r.kwhGross) * 100)}% net/gross)</span>
      </div>

      <div class="detail-grid">
        <div class="d-metric">
          <span>Plotted MSRP (${escapeHtml(r.priceMarket)})</span>
          <strong>${fmtUsd(r.msrpUsd)}</strong>
          <small>${state.pretax ? 'Pre-tax normalized' : 'Local retail sticker'}</small>
        </div>
        <div class="d-metric">
          <span>Usable / Gross Pack</span>
          <strong>${fmtKwh(r.kwhUsable)} kWh</strong>
          <small>${fmtKwh(r.kwhGross)} kWh gross</small>
        </div>
        <div class="d-metric">
          <span>Driving Range</span>
          <strong>${fmtInt(r.rangeDisplay)} ${r.rangeUnit}</strong>
          <small>${escapeHtml(r.rangeCycleLabel)}</small>
        </div>
        <div class="d-metric">
          <span>Pack Cost Ratio</span>
          <strong>${fmtUsd(r.dollarsPerKwh)}/kWh</strong>
          <small>Vehicle MSRP ÷ net kWh</small>
        </div>
        <div class="d-metric">
          <span>Range Cost Ratio</span>
          <strong>${fmtUsd(r.dollarsPerRange)}/${r.rangeUnit}</strong>
          <small>Vehicle MSRP ÷ ${r.rangeUnit}</small>
        </div>
        <div class="d-metric">
          <span>EPA-Eq. Efficiency</span>
          <strong>${r.milesPerKwh.toFixed(2)} mi/kWh</strong>
          <small>${Math.round(100 / r.milesPerKwh)} kWh / 100 mi</small>
        </div>
      </div>

      <div class="market-prices-strip" aria-label="Regional MSRPs where offered">
        ${marketTags}
      </div>

      <p class="detail-notes">${escapeHtml(r.notes)}</p>
      ${domHtml}
      <div class="source-links"><span>Sources:</span> ${sourceLinks}</div>
    `;
  }

  function sortRows(rows) {
    const copy = rows.slice();
    switch (state.sort) {
      case 'kwh-desc':
        return copy.sort((a, b) => b.kwhUsable - a.kwhUsable || a.msrpUsd - b.msrpUsd);
      case 'range-desc':
        return copy.sort((a, b) => b.rangeDisplay - a.rangeDisplay || a.msrpUsd - b.msrpUsd);
      case 'val-kwh':
        return copy.sort((a, b) => a.dollarsPerKwh - b.dollarsPerKwh || a.msrpUsd - b.msrpUsd);
      case 'val-range':
        return copy.sort((a, b) => a.dollarsPerRange - b.dollarsPerRange || a.msrpUsd - b.msrpUsd);
      case 'eff-desc':
        return copy.sort((a, b) => b.milesPerKwh - a.milesPerKwh || a.msrpUsd - b.msrpUsd);
      case 'name':
        return copy.sort((a, b) =>
          `${a.make} ${a.model} ${a.trim}`.localeCompare(`${b.make} ${b.model} ${b.trim}`)
        );
      case 'msrp-asc':
      default:
        return copy.sort((a, b) => a.msrpUsd - b.msrpUsd || b.metricValue - a.metricValue);
    }
  }

  function renderTable() {
    const { rows, frontier } = currentEval;
    const filtered = state.frontierOnly ? rows.filter((r) => r.onFrontier) : rows;
    const sorted = sortRows(filtered);

    els.thMsrp.textContent = state.pretax ? 'Pre-Tax MSRP' : 'MSRP (USD)';
    els.thRange.textContent = `Range (${state.rangeUnit})`;
    els.thValRange.textContent = `$/${state.rangeUnit}`;

    els.tableSubtitle.textContent = `Showing ${sorted.length} of ${DATA.vehicles.length} audited configurations (${frontier.length} on active Pareto frontier). Click any row to highlight on chart.`;

    if (sorted.length === 0) {
      els.vehicleTable.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:#56636D">No vehicles match the active filters.</td></tr>`;
      els.tableNote.textContent = '';
      return;
    }

    els.vehicleTable.innerHTML = sorted
      .map((r) => {
        const chem = DATA.chemistries[r.chemistry];
        const isSel = r.id === state.selected;
        return `<tr class="${isSel ? 'selected' : ''}" data-row-id="${escapeHtml(r.id)}">
          <td>
            <button type="button" class="row-btn" data-select-id="${escapeHtml(r.id)}">${escapeHtml(r.year + ' ' + r.make + ' ' + r.model)}</button>
            <small>${escapeHtml(r.trim)} · ${escapeHtml(r.body)}</small>
          </td>
          <td><span class="chem-pill">${inlineChemIconSvg(r.chemistry, 12)} ${escapeHtml(chem.short)}</span></td>
          <td><strong>${fmtUsd(r.msrpUsd)}</strong><small>${escapeHtml(r.priceMarket)}${r.priceMarket !== 'US' ? ' · ' + fmtLocalPrice(r.priceMarket, r.localAmount) : ''}</small></td>
          <td><strong>${fmtKwh(r.kwhUsable)}</strong><small>${fmtKwh(r.kwhGross)} gross</small></td>
          <td><strong>${fmtInt(r.rangeDisplay)} ${r.rangeUnit}</strong><small>${escapeHtml(r.rangeCycleLabel)}</small></td>
          <td>${fmtUsd(r.dollarsPerKwh)}</td>
          <td>${fmtUsd(r.dollarsPerRange)}</td>
          <td><small style="white-space:normal;max-width:170px">${escapeHtml(r.markets.join(', '))}</small></td>
          <td class="frontier-cell">${r.onFrontier ? '<span class="frontier-mark">★</span>Frontier' : '-'}</td>
        </tr>`;
      })
      .join('');

    els.tableNote.textContent = `Note: Table includes all ${sorted.length} matching vehicles regardless of horizontal chart zoom (${
      state.xScale === 'log' ? 'Log scale' : state.xScale === 'all' ? 'All MSRPs' : '≤ ' + fmtUsdCompact(Number(state.xScale))
    }).`;
  }

  function renderDiscontinuedList() {
    if (!els.discontinuedList || !Array.isArray(DATA.discontinued)) return;
    els.discontinuedList.innerHTML = DATA.discontinued
      .map((d) => `<li><strong>${escapeHtml(d.model)}:</strong> ${escapeHtml(d.reason)}</li>`)
      .join('');
  }

  function selectVehicle(id, scrollToChart = false) {
    state.selected = id;
    update();
    if (scrollToChart) {
      els.chartWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function exportCsv() {
    const { rows } = currentEval;
    const exportRows = sortRows(state.frontierOnly ? rows.filter((r) => r.onFrontier) : rows);
    const headers = [
      'id',
      'year',
      'make',
      'model',
      'trim',
      'body',
      'chemistry',
      'cell_detail',
      'price_market',
      state.pretax ? 'msrp_pretax_usd' : 'msrp_usd',
      'local_price',
      'kwh_usable',
      'kwh_gross',
      `range_${state.rangeUnit}`,
      'range_cycle',
      'usd_per_kwh',
      `usd_per_${state.rangeUnit}`,
      'epa_eq_mi_per_kwh',
      'on_pareto_frontier',
      'markets_offered',
    ];

    const csvCell = (val) => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [headers.join(',')];
    for (const r of exportRows) {
      lines.push(
        [
          r.id,
          r.year,
          r.make,
          r.model,
          r.trim,
          r.body,
          r.chemistry,
          r.cellDetail,
          r.priceMarket,
          Math.round(r.msrpUsd),
          r.localAmount,
          r.kwhUsable,
          r.kwhGross,
          r.rangeDisplay,
          r.rangeCycleLabel,
          Math.round(r.dollarsPerKwh),
          Math.round(r.dollarsPerRange),
          r.milesPerKwh.toFixed(2),
          r.onFrontier ? 'true' : 'false',
          r.markets.join('|'),
        ]
          .map(csvCell)
          .join(',')
      );
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ev-pareto-${state.yAxis}-${state.markets.length === 9 ? 'global' : state.markets.join('-').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${exportRows.length} EV configurations to CSV.`);
  }

  function copyScenarioLink() {
    const hash = `#scenario=${encodeScenario(state)}`;
    try {
      history.replaceState(null, '', hash);
    } catch (_) {
      window.location.hash = hash;
    }
    const fullUrl = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(
        () => showToast('Scenario permalink copied to clipboard.'),
        () => showToast('Updated URL hash with shareable scenario link.')
      );
    } else {
      showToast('Updated URL hash with shareable scenario link.');
    }
  }

  function update() {
    currentEval = M.evaluateDataset(DATA, state);

    // Ensure selected vehicle remains valid in current filtered view
    if (
      currentEval.rows.length > 0 &&
      !currentEval.rows.some((r) => r.id === state.selected)
    ) {
      state.selected = (currentEval.frontier[0] || currentEval.rows[0]).id;
    }

    persistState();
    renderSidebarControls();
    renderHeaderAndLegend();
    renderChart();
    renderFrontierLadder();
    renderVehicleDetail();
    renderTable();
  }

  // Event Wiring
  els.resetAll.addEventListener('click', () => {
    state = defaultState();
    if (window.location.hash) {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) {
        // Ignore on restricted origins
      }
    }
    update();
    showToast('Reset all filters to default Global view.');
  });

  for (const btn of els.yAxisBtns) {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.yaxis;
      if (mode === 'kwh') {
        state.yAxis = 'kwh';
      } else if (mode === 'range-km') {
        state.yAxis = 'range';
        state.rangeUnit = 'km';
      } else {
        state.yAxis = 'range';
        state.rangeUnit = 'mi';
      }
      update();
    });
  }

  els.harmonizeRange.addEventListener('change', () => {
    state.harmonizeRange = els.harmonizeRange.checked;
    update();
  });

  for (const chip of els.regionPresetBtns) {
    chip.addEventListener('click', () => {
      const preset = REGION_PRESETS[chip.dataset.regionPreset];
      if (preset) {
        state.markets = [...preset];
        update();
      }
    });
  }

  els.marketGroups.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-market]');
    if (!input) return;
    const code = input.dataset.market;
    const set = new Set(state.markets);
    if (input.checked) set.add(code);
    else set.delete(code);
    state.markets = ALL_MARKETS.filter((m) => set.has(m));
    update();
  });

  els.marketGroups.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-toggle-region]');
    if (!btn) return;
    const region = btn.dataset.toggleRegion;
    const regionCodes = ALL_MARKETS.filter((m) => DATA.markets[m].region === region);
    const set = new Set(state.markets);
    const allIn = regionCodes.every((m) => set.has(m));
    for (const c of regionCodes) {
      if (allIn) set.delete(c);
      else set.add(c);
    }
    state.markets = ALL_MARKETS.filter((m) => set.has(m));
    update();
  });

  for (const chip of els.chemPresetBtns) {
    chip.addEventListener('click', () => {
      const preset = CHEM_PRESETS[chip.dataset.chemPreset];
      if (preset) {
        state.chemistries = [...preset];
        update();
      }
    });
  }

  els.chemList.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-chem]');
    if (!input) return;
    const chem = input.dataset.chem;
    const set = new Set(state.chemistries);
    if (input.checked) set.add(chem);
    else set.delete(chem);
    state.chemistries = ALL_CHEMS.filter((c) => set.has(c));
    update();
  });

  els.xScale.addEventListener('change', () => {
    state.xScale = els.xScale.value;
    update();
  });

  els.granularity.addEventListener('change', () => {
    state.granularity = els.granularity.value;
    update();
  });

  els.bodyFilter.addEventListener('change', () => {
    state.body = els.bodyFilter.value;
    update();
  });

  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value;
    update();
  });

  els.clearSearch.addEventListener('click', () => {
    state.search = '';
    els.searchInput.value = '';
    update();
    els.searchInput.focus();
  });

  els.pretax.addEventListener('change', () => {
    state.pretax = els.pretax.checked;
    update();
  });

  els.showRays.addEventListener('change', () => {
    state.showRays = els.showRays.checked;
    update();
  });

  els.showStep.addEventListener('change', () => {
    state.showStep = els.showStep.checked;
    update();
  });

  els.overflowBanner.addEventListener('click', (e) => {
    const zoomAll = e.target.closest('[data-zoom-all]');
    if (zoomAll) {
      state.xScale = 'all';
      update();
      return;
    }
    const chip = e.target.closest('[data-overflow-id]');
    if (chip) {
      state.selected = chip.dataset.overflowId;
      state.xScale = 'all';
      update();
    }
  });

  els.frontierLadder.addEventListener('click', (e) => {
    const card = e.target.closest('[data-select-id]');
    if (card) selectVehicle(card.dataset.selectId, false);
  });

  els.vehicleDetail.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select-id]');
    if (btn) selectVehicle(btn.dataset.selectId, true);
  });

  els.frontierOnly.addEventListener('change', () => {
    state.frontierOnly = els.frontierOnly.checked;
    update();
  });

  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    update();
  });

  els.vehicleTable.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-row-id]');
    if (row) selectVehicle(row.dataset.rowId, true);
  });

  els.shareBtn.addEventListener('click', copyScenarioLink);
  els.exportBtn.addEventListener('click', exportCsv);

  window.addEventListener('hashchange', () => {
    const decoded = decodeScenario(window.location.hash);
    if (decoded) {
      state = decoded;
      update();
    }
  });

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => renderChart());
  });

  // Expose programmatic QA / inspection hook
  window.EV_PARETO = {
    snapshot: () => ({
      state: JSON.parse(JSON.stringify(state)),
      totalDatasetCount: DATA.vehicles.length,
      matchingCount: currentEval.rows.length,
      frontierCount: currentEval.frontier.length,
      frontierIds: currentEval.frontier.map((f) => f.id),
      selectedId: state.selected,
      chart: { ...latestChartMeta },
    }),
    setState: (patch) => {
      state = sanitizeState({ ...state, ...patch });
      update();
    },
  };

  const isEmbed = document.documentElement.classList.contains('is-embed');
  const tableDetails = document.getElementById('table-section');
  if (isEmbed && tableDetails) {
    tableDetails.open = false;
  }

  renderDiscontinuedList();
  update();

  if (isEmbed && window.parent && window.parent !== window && typeof ResizeObserver !== 'undefined') {
    const postHeight = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      window.parent.postMessage({ type: 'ev-pareto-height', height: h }, '*');
    };
    postHeight();
    new ResizeObserver(postHeight).observe(document.body);
  }
})();
