/**
 * Outset — local-first departure companion.
 * Milk light · sage · leave ready.
 */

const KEY = "outset.v1";
const LEGACY = "threshold.v1";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const TRAVEL_MODES = {
  walk: { id: "walk", label: "Walk", icon: "🚶", factor: 1.35 },
  transit: { id: "transit", label: "Transit", icon: "🚇", factor: 1 },
  drive: { id: "drive", label: "Drive", icon: "🚗", factor: 0.72 },
  bike: { id: "bike", label: "Bike", icon: "🚲", factor: 0.85 },
};

export const PRESETS = [
  {
    id: "workday",
    label: "Workday",
    itemIds: ["keys", "phone", "wallet", "transit", "laptop", "headphones", "charger", "water"],
  },
  {
    id: "gymday",
    label: "Gym day",
    itemIds: ["keys", "phone", "wallet", "gym", "water", "headphones"],
  },
  {
    id: "weekend",
    label: "Weekend light",
    itemIds: ["keys", "phone", "wallet", "water"],
  },
  {
    id: "full",
    label: "Everything due",
    itemIds: null, // use day/weather filter
  },
];

export const DEFAULT_ITEMS = [
  { id: "keys", label: "Keys", days: WEEKDAYS.slice(), icon: "🔑", essential: true },
  { id: "phone", label: "Phone", days: WEEKDAYS.slice(), icon: "📱", essential: true },
  { id: "wallet", label: "Wallet", days: WEEKDAYS.slice(), icon: "💳", essential: true },
  { id: "transit", label: "Transit card", days: ["mon", "tue", "wed", "thu", "fri"], icon: "🚇" },
  { id: "laptop", label: "Laptop", days: ["mon", "tue", "wed", "thu", "fri"], icon: "💻" },
  { id: "gym", label: "Gym bag", days: ["tue", "thu"], icon: "🎒" },
  { id: "umbrella", label: "Umbrella", days: [], icon: "☂️", weather: "rain" },
  { id: "charger", label: "Charger", days: ["mon", "wed", "fri"], icon: "🔌" },
  { id: "headphones", label: "Headphones", days: ["mon", "tue", "wed", "thu", "fri"], icon: "🎧" },
  { id: "water", label: "Water bottle", days: WEEKDAYS.slice(), icon: "💧" },
  { id: "coat", label: "Coat / layer", days: [], icon: "🧥", weather: "cold" },
  { id: "sunscreen", label: "Sunscreen", days: [], icon: "🧴", weather: "hot" },
];

export const DESTINATIONS = [
  { id: "work", label: "Work", travelMin: 28, outdoor: true, note: "Main office" },
  { id: "school", label: "School", travelMin: 22, outdoor: true, note: "Studio building" },
  { id: "gym", label: "Gym", travelMin: 15, outdoor: true, note: "" },
  { id: "errand", label: "Errands", travelMin: 12, outdoor: true, note: "" },
  { id: "friend", label: "Friend's place", travelMin: 35, outdoor: true, note: "" },
  { id: "cafe", label: "Café", travelMin: 10, outdoor: true, note: "Focus block" },
  { id: "other", label: "Somewhere else", travelMin: 20, outdoor: true, note: "" },
];

function nextUpcoming(h, m) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now() + 45 * 60e3) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function defaultState() {
  return {
    name: "Essam",
    homeLabel: "Home",
    items: structuredClone(DEFAULT_ITEMS),
    destinations: structuredClone(DESTINATIONS),
    events: [
      { id: "e1", title: "Studio critique", at: nextUpcoming(10, 30), placeId: "school" },
      { id: "e2", title: "Focus block", at: nextUpcoming(14, 0), placeId: "cafe" },
    ],
    checked: {},
    selectedDestId: "school",
    travelMode: "transit",
    activePreset: "full",
    departures: [],
    streaks: { current: 0, best: 0, lastDay: null },
    forgot: {},
    onboarded: false,
    prefs: {
      leaveBufferMin: 8,
      sound: true,
      briefTips: true,
    },
  };
}

export function load() {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const migrated = { ...defaultState(), ...parsed, prefs: { ...defaultState().prefs, ...(parsed.prefs || {}) } };
        save(migrated);
        return migrated;
      }
      return defaultState();
    }
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      items: Array.isArray(parsed.items) ? parsed.items : base.items,
      destinations: Array.isArray(parsed.destinations) ? parsed.destinations : base.destinations,
      events: Array.isArray(parsed.events) ? parsed.events : base.events,
      checked: parsed.checked && typeof parsed.checked === "object" ? parsed.checked : {},
      forgot: parsed.forgot && typeof parsed.forgot === "object" ? parsed.forgot : {},
      streaks: { ...base.streaks, ...(parsed.streaks || {}) },
      prefs: { ...base.prefs, ...(parsed.prefs || {}) },
    };
  } catch {
    return defaultState();
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function todayKey(d = new Date()) {
  return WEEKDAYS[d.getDay()];
}

export function dayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function weekdayLabel(d = new Date()) {
  return d.toLocaleDateString([], { weekday: "long" });
}

export function travelMinutes(dest, modeId) {
  const base = dest?.travelMin ?? 20;
  const mode = TRAVEL_MODES[modeId] || TRAVEL_MODES.transit;
  return Math.max(5, Math.round(base * mode.factor));
}

export function itemsForToday(state, weatherHere, weatherDest, presetId) {
  const day = todayKey();
  const rain =
    weatherHere?.precip ||
    weatherDest?.precip ||
    ["rain", "storm"].includes(weatherHere?.condition) ||
    ["rain", "storm"].includes(weatherDest?.condition);
  const cold = Math.min(weatherHere?.temp ?? 99, weatherDest?.temp ?? 99) < 10;
  const hot = Math.max(weatherHere?.temp ?? 0, weatherDest?.temp ?? 0) >= 26;

  let pool = state.items.filter((it) => it.enabled !== false);

  const preset = PRESETS.find((p) => p.id === (presetId || state.activePreset));
  if (preset?.itemIds) {
    const set = new Set(preset.itemIds);
    pool = pool.filter((it) => set.has(it.id) || it.weather);
  }

  return pool.filter((it) => {
    if (it.weather === "rain") return rain;
    if (it.weather === "cold") return cold;
    if (it.weather === "hot") return hot;
    if (preset?.itemIds) return true;
    return (it.days || []).includes(day);
  });
}

export function nextEvent(state) {
  const now = Date.now();
  return (
    (state.events || [])
      .filter((e) => e.at > now - 5 * 60e3)
      .sort((a, b) => a.at - b.at)[0] || null
  );
}

export function upcomingEvents(state, limit = 5) {
  const now = Date.now();
  return (state.events || [])
    .filter((e) => e.at > now - 5 * 60e3)
    .sort((a, b) => a.at - b.at)
    .slice(0, limit);
}

export function leaveBy(event, dest, prefs, modeId) {
  if (!event) return null;
  const travel = travelMinutes(dest, modeId || "transit");
  const buffer = prefs?.leaveBufferMin ?? 8;
  return event.at - (travel + buffer) * 60e3;
}

export function formatTime(ts) {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDay(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function minutesUntil(ts) {
  return Math.round((ts - Date.now()) / 60000);
}

export function toggleChecked(state, id) {
  return { ...state, checked: { ...state.checked, [id]: !state.checked[id] } };
}

export function resetChecks(state) {
  return { ...state, checked: {} };
}

export function recordDeparture(state, payload) {
  const entry = { id: uid(), at: Date.now(), ...payload };
  const departures = [entry, ...(state.departures || [])].slice(0, 60);

  // streak
  const today = dayStamp();
  let { current, best, lastDay } = state.streaks || { current: 0, best: 0, lastDay: null };
  if (lastDay !== today) {
    const yesterday = dayStamp(new Date(Date.now() - 864e5));
    current = lastDay === yesterday ? current + 1 : 1;
    lastDay = today;
    best = Math.max(best, current);
  }

  // forgot tracking: items that were due but unchecked at seal time are rare if we require all —
  // instead track which essentials get unchecked most often via miss history from partial seals
  const forgot = { ...(state.forgot || {}) };
  for (const id of payload.missedIds || []) {
    forgot[id] = (forgot[id] || 0) + 1;
  }

  return {
    ...state,
    departures,
    streaks: { current, best, lastDay },
    forgot,
    onboarded: true,
    checked: {},
  };
}

export function upsertItem(state, item) {
  const items = [...state.items];
  const i = items.findIndex((x) => x.id === item.id);
  if (i >= 0) items[i] = { ...items[i], ...item };
  else items.push(item);
  return { ...state, items };
}

export function upsertEvent(state, event) {
  const events = [...(state.events || [])];
  const i = events.findIndex((x) => x.id === event.id);
  if (i >= 0) events[i] = { ...events[i], ...event };
  else events.push(event);
  return { ...state, events };
}

export function upsertDestination(state, dest) {
  const destinations = [...state.destinations];
  const i = destinations.findIndex((x) => x.id === dest.id);
  if (i >= 0) destinations[i] = { ...destinations[i], ...dest };
  else destinations.push(dest);
  return { ...state, destinations };
}

export function topForgot(state, n = 3) {
  return Object.entries(state.forgot || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, count]) => ({ id, count, item: state.items.find((i) => i.id === id) }));
}

export function layerHint(home, dest) {
  const t = Math.min(home.temp, dest.temp);
  if (t < 6) return "Heavy layer — coat weather.";
  if (t < 12) return "Light jacket recommended.";
  if (Math.max(home.temp, dest.temp) >= 26) return "Dress light — warm out.";
  if (dest.precip || home.precip) return "Waterproof layer if you have it.";
  return "Ordinary clothes. You're fine.";
}

export function uid() {
  return `os_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
