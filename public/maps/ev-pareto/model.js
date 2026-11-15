(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EVParetoModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MARKET_PRIORITY = ['US', 'CA', 'EU', 'UK', 'NO', 'CN', 'KR', 'JP', 'AU'];
  const KM_PER_MILE = 1.609344;

  function resolvePrice(vehicle, activeMarkets, pretax = false) {
    const set = activeMarkets instanceof Set ? activeMarkets : new Set(activeMarkets || []);
    const matching = vehicle.markets.filter((m) => set.has(m));
    if (matching.length === 0) return null;

    const priceMap = pretax ? vehicle.pricesPretaxUsd : vehicle.pricesUsd;
    let bestMarket = matching[0];
    let bestUsd = priceMap[bestMarket];

    for (let i = 1; i < matching.length; i++) {
      const m = matching[i];
      const usd = priceMap[m];
      if (
        usd < bestUsd ||
        (usd === bestUsd && MARKET_PRIORITY.indexOf(m) < MARKET_PRIORITY.indexOf(bestMarket))
      ) {
        bestUsd = usd;
        bestMarket = m;
      }
    }

    return {
      usd: bestUsd,
      stickerUsd: vehicle.pricesUsd[bestMarket],
      pretaxUsd: vehicle.pricesPretaxUsd[bestMarket],
      market: bestMarket,
      matchingMarkets: matching,
      localAmount: vehicle.localPrices[bestMarket],
    };
  }

  function resolveRange(vehicle, harmonizeRange = true, rangeUnit = 'mi') {
    if (harmonizeRange) {
      const mi = vehicle.rangeEpaMi;
      return {
        value: rangeUnit === 'km' ? Math.round(mi * KM_PER_MILE) : mi,
        unit: rangeUnit,
        cycleLabel: vehicle.rangeHarmonized ? `${vehicle.rawOfficialCycle}→EPA eq.` : 'EPA',
        isHarmonizedEstimate: Boolean(vehicle.rangeHarmonized),
      };
    }
    // Raw official local test cycle rating
    if (rangeUnit === 'km') {
      const km =
        vehicle.rawOfficialCycle === 'EPA'
          ? Math.round(vehicle.rawOfficialRange * KM_PER_MILE)
          : vehicle.rawOfficialRange;
      return {
        value: km,
        unit: 'km',
        cycleLabel: vehicle.rawOfficialCycle,
        isHarmonizedEstimate: false,
      };
    }
    const mi =
      vehicle.rawOfficialCycle === 'EPA'
        ? vehicle.rawOfficialRange
        : vehicle.rawOfficialMi;
    return {
      value: mi,
      unit: 'mi',
      cycleLabel: vehicle.rawOfficialCycle,
      isHarmonizedEstimate: false,
    };
  }

  function dominates(a, b) {
    const eps = 1e-9;
    const cheaperOrEqual = a.msrpUsd <= b.msrpUsd + eps;
    const higherOrEqual = a.metricValue >= b.metricValue - eps;
    const strictlyBetter = a.msrpUsd < b.msrpUsd - eps || a.metricValue > b.metricValue + eps;
    return cheaperOrEqual && higherOrEqual && strictlyBetter;
  }

  function paretoFrontier(rows) {
    const valid = rows.filter(
      (r) => Number.isFinite(r.msrpUsd) && r.msrpUsd > 0 && Number.isFinite(r.metricValue)
    );
    return valid
      .filter((a) => !valid.some((b) => b.id !== a.id && dominates(b, a)))
      .sort(
        (a, b) =>
          a.msrpUsd - b.msrpUsd ||
          a.metricValue - b.metricValue ||
          a.id.localeCompare(b.id)
      );
  }

  function paretoStepPoints(frontier, maxX) {
    if (!frontier || frontier.length === 0) return [];
    const pts = [];
    for (let i = 0; i < frontier.length; i++) {
      const cur = frontier[i];
      if (i > 0) {
        pts.push({ x: cur.msrpUsd, y: frontier[i - 1].metricValue });
      }
      pts.push({ x: cur.msrpUsd, y: cur.metricValue });
    }
    const last = frontier[frontier.length - 1];
    if (Number.isFinite(maxX) && maxX > last.msrpUsd) {
      pts.push({ x: maxX, y: last.metricValue });
    }
    return pts;
  }

  function deduplicateNameplates(rows, granularity = 'all') {
    if (granularity === 'all') return rows;
    const byNameplate = new Map();
    for (const r of rows) {
      const prev = byNameplate.get(r.nameplate);
      if (!prev) {
        byNameplate.set(r.nameplate, r);
        continue;
      }
      if (granularity === 'base') {
        if (
          r.msrpUsd < prev.msrpUsd ||
          (r.msrpUsd === prev.msrpUsd && r.metricValue > prev.metricValue)
        ) {
          byNameplate.set(r.nameplate, r);
        }
      } else if (granularity === 'max') {
        if (
          r.metricValue > prev.metricValue ||
          (r.metricValue === prev.metricValue && r.msrpUsd < prev.msrpUsd)
        ) {
          byNameplate.set(r.nameplate, r);
        }
      }
    }
    return Array.from(byNameplate.values());
  }

  function evaluateDataset(data, state) {
    const activeMarkets = new Set(state.markets || []);
    const activeChems = new Set(state.chemistries || []);
    const query = String(state.search || '').trim().toLowerCase();
    const body = state.body || 'all';
    const yAxis = state.yAxis === 'range' ? 'range' : 'kwh';
    const rangeUnit = state.rangeUnit === 'km' ? 'km' : 'mi';
    const harmonizeRange = state.harmonizeRange !== false;
    const pretax = Boolean(state.pretax);

    let evaluated = [];
    for (const v of data.vehicles) {
      if (!activeChems.has(v.chemistry)) continue;
      if (body !== 'all' && v.body !== body) continue;
      if (query) {
        const hay = `${v.year} ${v.make} ${v.model} ${v.trim} ${v.cellDetail} ${v.chemistry}`.toLowerCase();
        if (!hay.includes(query)) continue;
      }
      const priceInfo = resolvePrice(v, activeMarkets, pretax);
      if (!priceInfo) continue;

      const rangeInfo = resolveRange(v, harmonizeRange, rangeUnit);
      const metricValue = yAxis === 'range' ? rangeInfo.value : v.kwhUsable;
      const metricUnit = yAxis === 'range' ? rangeInfo.unit : 'kWh';

      evaluated.push({
        ...v,
        msrpUsd: priceInfo.usd,
        stickerUsd: priceInfo.stickerUsd,
        pretaxUsd: priceInfo.pretaxUsd,
        priceMarket: priceInfo.market,
        matchingMarkets: priceInfo.matchingMarkets,
        localAmount: priceInfo.localAmount,
        rangeDisplay: rangeInfo.value,
        rangeUnit: rangeInfo.unit,
        rangeCycleLabel: rangeInfo.cycleLabel,
        isHarmonizedEstimate: yAxis === 'range' && rangeInfo.isHarmonizedEstimate,
        metricValue,
        metricUnit,
        dollarsPerKwh: priceInfo.usd / v.kwhUsable,
        dollarsPerRange: priceInfo.usd / rangeInfo.value,
        milesPerKwh: v.rangeEpaMi / v.kwhUsable,
      });
    }

    evaluated = deduplicateNameplates(evaluated, state.granularity || 'all');
    const frontier = paretoFrontier(evaluated);
    const frontierIds = new Set(frontier.map((f) => f.id));

    const rows = evaluated.map((r) => ({
      ...r,
      onFrontier: frontierIds.has(r.id),
    }));

    return { rows, frontier, frontierIds };
  }

  return {
    MARKET_PRIORITY,
    KM_PER_MILE,
    resolvePrice,
    resolveRange,
    dominates,
    paretoFrontier,
    paretoStepPoints,
    deduplicateNameplates,
    evaluateDataset,
  };
});
