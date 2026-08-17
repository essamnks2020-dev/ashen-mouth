/**
 * Threshold — local-first departure ritual.
 * Everything on-device. No account.
 */

const KEY = "threshold.v1";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DEFAULT_ITEMS = [
  { id: "keys", label: "Keys", days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], icon: "🔑" },
  { id: "phone", label: "Phone", days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], icon: "📱" },
  { id: "wallet", label: "Wallet", days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], icon: "💳" },
  { id: "transit", label: "Transit card", days: ["mon", "tue", "wed", "thu", "fri"], icon: "🚇" },
  { id: "laptop", label: "Laptop", days: ["mon", "tue", "wed", "thu", "fri"], icon: "💻" },
  { id: "gym", label: "Gym bag", days: ["tue", "thu"], icon: "🎒" },
  { id: "umbrella", label: "Umbrella", days: [], icon: "☂️", weather: "rain" },
  { id: "charger", label: "Charger", days: ["mon", "wed", "fri"], icon: "🔌" },
  { id: "headphones", label: "Headphones", days: ["mon", "tue", "wed", "thu", "fri"], icon: "🎧" },
];

export const DESTINATIONS = [
  { id: "work", label: "Work", travelMin: 28, outdoor: true },
  { id: "school", label: "School", travelMin: 22, outdoor: true },
  { id: "gym", label: "Gym", travelMin: 15, outdoor: true },
  { id: "errand", label: "Errands", travelMin: 12, outdoor: true },
  { id: "friend", label: "Friend's place", travelMin: 35, outdoor: true },
  { id: "other", label: "Somewhere else", travelMin: 20, outdoor: true },
];

function nextUpcoming(h, m, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
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
      {
        id: "e1",
        title: "Studio critique",
        at: nextUpcoming(10, 30),
        placeId: "school",
      },
    ],
    checked: {},
    selectedDestId: "school",
    departures: [],
    onboarded: false,
    prefs: {
      leaveBufferMin: 8,
      sound: true,
    },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      items: Array.isArray(parsed.items) ? parsed.items : base.items,
      destinations: Array.isArray(parsed.destinations) ? parsed.destinations : base.destinations,
      events: Array.isArray(parsed.events) ? parsed.events : base.events,
      checked: parsed.checked && typeof parsed.checked === "object" ? parsed.checked : {},
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

export function weekdayLabel(d = new Date()) {
  return d.toLocaleDateString([], { weekday: "long" });
}

export function itemsForToday(state, weatherHere, weatherDest) {
  const day = todayKey();
  const rain =
    weatherHere?.precip ||
    weatherDest?.precip ||
    weatherHere?.condition === "rain" ||
    weatherDest?.condition === "rain" ||
    weatherHere?.condition === "storm" ||
    weatherDest?.condition === "storm";
  const cold = Math.min(weatherHere?.temp ?? 99, weatherDest?.temp ?? 99) < 8;

  return state.items.filter((it) => {
    if (it.enabled === false) return false;
    if (it.weather === "rain") return rain;
    if (it.weather === "cold") return cold;
    return (it.days || []).includes(day);
  });
}

export function nextEvent(state) {
  const now = Date.now();
  const upcoming = (state.events || [])
    .filter((e) => e.at > now - 5 * 60e3)
    .sort((a, b) => a.at - b.at);
  return upcoming[0] || null;
}

export function leaveBy(event, dest, prefs) {
  if (!event) return null;
  const travel = dest?.travelMin ?? 20;
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
  const checked = { ...state.checked, [id]: !state.checked[id] };
  return { ...state, checked };
}

export function resetChecks(state) {
  return { ...state, checked: {} };
}

export function recordDeparture(state, payload) {
  const entry = {
    id: uid(),
    at: Date.now(),
    ...payload,
  };
  const departures = [entry, ...(state.departures || [])].slice(0, 40);
  return { ...state, departures, onboarded: true, checked: {} };
}

export function upsertItem(state, item) {
  const items = [...state.items];
  const i = items.findIndex((x) => x.id === item.id);
  if (i >= 0) items[i] = { ...items[i], ...item };
  else items.push(item);
  return { ...state, items };
}

export function uid() {
  return `th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
