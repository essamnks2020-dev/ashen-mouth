/**
 * Homeport — offline-first fishing ledger.
 * Profit after fuel & crew. Quota warnings. Dock price board.
 * Everything stays on-device until you choose to sync.
 */

const KEY = 'homeport.v1';

const SPECIES = [
  { id: 'cod', name: 'Atlantic cod', unit: 'lb', quota: 1200 },
  { id: 'haddock', name: 'Haddock', unit: 'lb', quota: 900 },
  { id: 'scallop', name: 'Sea scallop', unit: 'lb', quota: 600 },
  { id: 'lobster', name: 'Lobster', unit: 'lb', quota: 800 },
  { id: 'flounder', name: 'Flounder', unit: 'lb', quota: 500 },
  { id: 'tuna', name: 'Bluefin tuna', unit: 'lb', quota: 200 },
];

const DOCKS = [
  { id: 'gloucester', name: 'Gloucester', harbor: 'MA', lat: 42.61 },
  { id: 'newbedford', name: 'New Bedford', harbor: 'MA', lat: 41.64 },
  { id: 'portland', name: 'Portland', harbor: 'ME', lat: 43.66 },
  { id: 'pointjudith', name: 'Point Judith', harbor: 'RI', lat: 41.36 },
  { id: 'montauk', name: 'Montauk', harbor: 'NY', lat: 41.07 },
];

/** Seed dock prices — wobble slightly each load so the board feels alive */
export function seedPrices(rng = Math.random) {
  const base = {
    cod: 2.85, haddock: 3.1, scallop: 14.5, lobster: 8.4, flounder: 2.4, tuna: 18.0,
  };
  const out = {};
  for (const d of DOCKS) {
    out[d.id] = {};
    for (const [sp, p] of Object.entries(base)) {
      const drift = 1 + (rng() - 0.5) * 0.18;
      const premium = d.id === 'newbedford' && sp === 'scallop' ? 1.08
        : d.id === 'portland' && sp === 'lobster' ? 1.06
        : d.id === 'gloucester' && sp === 'cod' ? 1.05
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
      crewShare: 0.35, // crew % of net after fuel/ice
      skipper: 'You',
    },
    quotas: Object.fromEntries(SPECIES.map((s) => [s.id, { used: Math.round(s.quota * 0.42), cap: s.quota }])),
    prices: seedPrices(),
    pricesAt: Date.now(),
    trips: [],
    draft: null,
    offline: true,
    onboarded: false,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = { ...defaultState(), ...JSON.parse(raw) };
    // refresh prices if stale (>6h) so board breathes
    if (!s.pricesAt || Date.now() - s.pricesAt > 6 * 3600e3) {
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

export { SPECIES, DOCKS };

export function speciesById(id) {
  return SPECIES.find((s) => s.id === id);
}

export function dockById(id) {
  return DOCKS.find((d) => d.id === id);
}

/** Best dock price for a species */
export function bestDock(prices, speciesId) {
  let best = null;
  for (const d of DOCKS) {
    const p = prices[d.id]?.[speciesId];
    if (p == null) continue;
    if (!best || p > best.price) best = { dock: d, price: p };
  }
  return best;
}

export function calcTrip(trip, vessel, prices) {
  const dockId = trip.landDock || vessel.homeDock;
  const board = prices[dockId] || {};
  let gross = 0;
  const lines = (trip.hauls || []).map((h) => {
    const px = h.priceOverride ?? board[h.species] ?? 0;
    const line = Math.round(h.weight * px * 100) / 100;
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

function round2(n) {
  return Math.round(n * 100) / 100;
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

/** Quota pressure 0–1+ after adding weight */
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
      next[h.species].cap * 1.2,
      next[h.species].used + (Number(h.weight) || 0),
    );
  }
  return next;
}

/** Demo trip so the bridge isn't empty on first open */
export function seedDemoTrip(state) {
  if (state.trips.length) return state;
  const trip = {
    id: uid(),
    name: 'Dawn set — Jeffreys Ledge',
    departedAt: Date.now() - 36e5 * 18,
    landedAt: Date.now() - 36e5 * 6,
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
  const money = calcTrip(trip, state.vessel, state.prices);
  state.trips = [{ ...trip, money }];
  return state;
}
