/**
 * Homeport v2 — richer pricing, haul scenarios, season stats.
 */

const KEY = 'homeport.v2';
const LEGACY = 'homeport.v1';

export const SPECIES = [
  { id: 'cod', name: 'Atlantic cod', unit: 'lb', quota: 1200, icon: '◆' },
  { id: 'haddock', name: 'Haddock', unit: 'lb', quota: 900, icon: '◇' },
  { id: 'scallop', name: 'Sea scallop', unit: 'lb', quota: 600, icon: '◎' },
  { id: 'lobster', name: 'Lobster', unit: 'lb', quota: 800, icon: '▣' },
  { id: 'flounder', name: 'Flounder', unit: 'lb', quota: 500, icon: '▫' },
  { id: 'tuna', name: 'Bluefin tuna', unit: 'lb', quota: 200, icon: '▲' },
];

export const DOCKS = [
  { id: 'gloucester', name: 'Gloucester', harbor: 'MA', lat: 42.61, steamHrs: 0 },
  { id: 'newbedford', name: 'New Bedford', harbor: 'MA', lat: 41.64, steamHrs: 3.5 },
  { id: 'portland', name: 'Portland', harbor: 'ME', lat: 43.66, steamHrs: 4.2 },
  { id: 'pointjudith', name: 'Point Judith', harbor: 'RI', lat: 41.36, steamHrs: 5.0 },
  { id: 'montauk', name: 'Montauk', harbor: 'NY', lat: 41.07, steamHrs: 6.5 },
];

const TRIP_NAMES = [
  'Dawn set — Jeffreys Ledge',
  'Night tow — Stellwagen',
  'Fog bank — Cashes',
  'Hard bottom — Tillies',
  'Southeast wind — Fippennies',
  'Moon tide — Platts',
];

export function suggestTripName() {
  return TRIP_NAMES[Math.floor(Math.random() * TRIP_NAMES.length)];
}

export function seedPrices(rng = Math.random) {
  const base = {
    cod: 2.85, haddock: 3.1, scallop: 14.5, lobster: 8.4, flounder: 2.4, tuna: 18.0,
  };
  const out = {};
  for (const d of DOCKS) {
    out[d.id] = {};
    for (const [sp, p] of Object.entries(base)) {
      const drift = 1 + (rng() - 0.5) * 0.2;
      const premium = d.id === 'newbedford' && sp === 'scallop' ? 1.1
        : d.id === 'portland' && sp === 'lobster' ? 1.07
        : d.id === 'gloucester' && (sp === 'cod' || sp === 'haddock') ? 1.05
        : d.id === 'montauk' && sp === 'tuna' ? 1.12
        : 1;
      out[d.id][sp] = Math.round(p * drift * premium * 100) / 100;
    }
  }
  return out;
}

function defaultState() {
  return {
    vessel: {
      name: 'F/V Maren',
      homeDock: 'gloucester',
      crewShare: 0.35,
      fuelPerHour: 42, // $ burn steaming
      skipper: 'You',
    },
    quotas: Object.fromEntries(SPECIES.map((s) => [s.id, {
      used: Math.round(s.quota * (0.28 + Math.random() * 0.25)),
      cap: s.quota,
    }])),
    prices: seedPrices(),
    pricesAt: Date.now(),
    trips: [],
    draft: null,
    onboarded: false,
    seasonGoal: 45000,
  };
}

export function load() {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY);
      if (raw) {
        localStorage.setItem(KEY, raw);
        localStorage.removeItem(LEGACY);
      }
    }
    if (!raw) return defaultState();
    const s = { ...defaultState(), ...JSON.parse(raw) };
    s.vessel = { ...defaultState().vessel, ...s.vessel };
    if (!s.pricesAt || Date.now() - s.pricesAt > 4 * 3600e3) {
      s.prices = seedPrices();
      s.pricesAt = Date.now();
    }
    return s;
  } catch {
    return defaultState();
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function speciesById(id) {
  return SPECIES.find((s) => s.id === id);
}

export function dockById(id) {
  return DOCKS.find((d) => d.id === id);
}

export function bestDock(prices, speciesId) {
  let best = null;
  for (const d of DOCKS) {
    const p = prices[d.id]?.[speciesId];
    if (p == null) continue;
    if (!best || p > best.price) best = { dock: d, price: p };
  }
  return best;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function calcTrip(trip, vessel, prices) {
  const dockId = trip.landDock || vessel.homeDock;
  const board = prices[dockId] || {};
  let gross = 0;
  const lines = (trip.hauls || []).map((h) => {
    const px = h.priceOverride ?? board[h.species] ?? 0;
    const line = round2(h.weight * px);
    gross += line;
    return { ...h, price: px, line };
  });
  const fuel = Number(trip.fuelCost) || 0;
  const ice = Number(trip.iceCost) || 0;
  const other = Number(trip.otherCost) || 0;
  const expenses = fuel + ice + other;
  const net = gross - expenses;
  const crew = Math.max(0, net) * (vessel.crewShare ?? 0.35);
  const profit = net - crew;
  return {
    lines,
    gross: round2(gross),
    expenses: round2(expenses),
    net: round2(net),
    crew: round2(crew),
    profit: round2(profit),
    perHour: trip.hours > 0 ? round2(profit / trip.hours) : null,
  };
}

/** What if this haul lands at every dock — steam cost from home */
export function scenarioBoard(hauls, vessel, prices) {
  const home = dockById(vessel.homeDock);
  return DOCKS.map((d) => {
    const steam = Math.abs((d.steamHrs || 0) - (home?.steamHrs || 0));
    const steamCost = round2(steam * (vessel.fuelPerHour || 42));
    const trip = {
      landDock: d.id,
      hours: 1,
      fuelCost: steamCost,
      iceCost: 0,
      otherCost: 0,
      hauls,
    };
    const money = calcTrip(trip, vessel, prices);
    return {
      dock: d,
      steamHrs: steam,
      steamCost,
      gross: money.gross,
      profit: money.profit,
      delta: null,
    };
  }).map((row, _, arr) => {
    const homeRow = arr.find((x) => x.dock.id === vessel.homeDock);
    return { ...row, delta: round2(row.profit - (homeRow?.profit || 0)) };
  }).sort((a, b) => b.profit - a.profit);
}

export function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatMoneyExact(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function uid() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function quotaPressure(quotas, speciesId, addWeight = 0) {
  const q = quotas[speciesId];
  if (!q) return 0;
  return (q.used + addWeight) / q.cap;
}

export function applyHaulsToQuota(quotas, hauls) {
  const next = structuredClone(quotas);
  for (const h of hauls || []) {
    if (!next[h.species]) continue;
    next[h.species].used = Math.min(
      next[h.species].cap * 1.15,
      next[h.species].used + (Number(h.weight) || 0),
    );
  }
  return next;
}

export function seasonStats(trips) {
  const profits = trips.map((t) => t.money?.profit || 0);
  const total = profits.reduce((a, b) => a + b, 0);
  const best = trips.length ? Math.max(...profits) : 0;
  const avg = trips.length ? total / trips.length : 0;
  const hours = trips.reduce((a, t) => a + (t.hours || 0), 0);
  return {
    total: round2(total),
    best: round2(best),
    avg: round2(avg),
    trips: trips.length,
    hours,
    perHour: hours > 0 ? round2(total / hours) : 0,
  };
}

export function seedDemoTrip(state) {
  if (state.trips.length) return state;
  const trip = {
    id: uid(),
    name: 'Dawn set — Jeffreys Ledge',
    departedAt: Date.now() - 36e5 * 22,
    landedAt: Date.now() - 36e5 * 8,
    hours: 12,
    landDock: 'gloucester',
    fuelCost: 420,
    iceCost: 85,
    otherCost: 40,
    hauls: [
      { species: 'cod', weight: 380 },
      { species: 'haddock', weight: 210 },
      { species: 'lobster', weight: 95 },
    ],
    notes: 'Fog until 0900. Good mark on the north edge.',
  };
  trip.money = calcTrip(trip, state.vessel, state.prices);
  state.trips = [trip];
  return state;
}

/** Animate a number in an element */
export function countUp(el, to, { ms = 900, money = true } = {}) {
  if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    el.textContent = money ? formatMoney(to) : String(Math.round(to));
    return;
  }
  const from = 0;
  const t0 = performance.now();
  const tick = (now) => {
    const u = Math.min(1, (now - t0) / ms);
    const e = 1 - (1 - u) ** 3;
    const v = from + (to - from) * e;
    el.textContent = money ? formatMoney(v) : String(Math.round(v));
    if (u < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
