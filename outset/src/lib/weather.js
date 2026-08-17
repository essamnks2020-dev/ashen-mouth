/**
 * Weather — live Open-Meteo when possible, on-device sketch otherwise.
 * Destination weather is the forecast at *arrival*, not now.
 */

const CONDITIONS = ["clear", "haze", "cloud", "rain", "storm", "wind"];
const CACHE_KEY = "outset.wx.live.v1";
const TTL = 20 * 60e3;

let live = null;
let liveStatus = "idle";

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(seed, arr) {
  return arr[seed % arr.length];
}

function wmoToCondition(code) {
  const n = Number(code);
  if (n === 0 || n === 1) return "clear";
  if (n === 2 || n === 3) return "cloud";
  if (n === 45 || n === 48) return "haze";
  if (n >= 95) return "storm";
  if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82) || (n >= 71 && n <= 77)) return "rain";
  return "wind";
}

function labelFor(c) {
  const map = {
    clear: "Clear sky",
    haze: "Soft haze",
    cloud: "Overcast",
    rain: "Rain",
    storm: "Storm light",
    wind: "Breezy",
  };
  return map[c] || c;
}

function hintFor(c, temp) {
  if (c === "rain" || c === "storm") return "Umbrella earns its keep.";
  if (temp <= 6) return "Coat weather.";
  if (temp >= 26) return "Warm — travel light.";
  if (c === "wind") return "Wind on the bridges.";
  return "Gentle sky.";
}

function pack(condition, temp, extra = {}) {
  const precip = condition === "rain" || condition === "storm";
  const wind = extra.wind ?? 8;
  const feels = extra.feels ?? temp - (wind > 14 ? 2 : 0) - (precip ? 1 : 0);
  return {
    placeId: extra.placeId || "home",
    temp,
    feels,
    condition,
    precip,
    wind,
    humidity: extra.humidity ?? 55,
    pop: extra.pop ?? (precip ? 70 : 10),
    label: labelFor(condition),
    hint: hintFor(condition, temp),
    code: condition,
    source: extra.source || "sketch",
    updatedAt: extra.updatedAt || Date.now(),
  };
}

function sketch(placeId, when = new Date()) {
  const hour = when.getHours();
  const seed = hash(`${placeId}-${when.toDateString()}-${hour}`);
  const baseTemp = 8 + (seed % 20);
  const curve = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 5;
  const temp = Math.round(baseTemp + curve);
  let condition = pick(seed, CONDITIONS);
  if (hour >= 22 || hour < 5) condition = pick(seed, ["clear", "haze", "cloud"]);
  if (seed % 7 === 0) condition = "rain";
  if (seed % 23 === 0) condition = "storm";
  return pack(condition, temp, {
    placeId,
    wind: 3 + (seed % 16),
    humidity: 40 + (seed % 45),
    source: "sketch",
    updatedAt: when.getTime(),
  });
}

function fromLive(placeId, when = new Date()) {
  if (!live?.hourly) return sketch(placeId, when);
  const ts = when.getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < live.hourly.time.length; i++) {
    const t = Date.parse(live.hourly.time[i]);
    const d = Math.abs(t - ts);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  const temp = Math.round(live.hourly.temperature_2m[best]);
  const condition = wmoToCondition(live.hourly.weather_code[best]);
  const pop = live.hourly.precipitation_probability?.[best] ?? 0;
  const isNow = Math.abs(ts - Date.now()) < 45 * 60e3 && live.current;
  if (isNow && placeId === "home") {
    return pack(wmoToCondition(live.current.weather_code), Math.round(live.current.temperature_2m), {
      placeId,
      feels: Math.round(live.current.apparent_temperature),
      wind: Math.round(live.current.wind_speed_10m),
      humidity: Math.round(live.current.relative_humidity_2m),
      pop,
      source: "live",
      updatedAt: Date.now(),
    });
  }
  return pack(condition, temp, {
    placeId,
    pop,
    wind: isNow ? Math.round(live.current?.wind_speed_10m || 8) : 8,
    source: "live",
    updatedAt: Date.parse(live.hourly.time[best]),
  });
}

export function weatherFor(placeId, when = new Date()) {
  return live ? fromLive(placeId, when) : sketch(placeId, when);
}

export function hourlyStrip(placeId, hours = 6) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const out = [];
  for (let i = 0; i < hours; i++) {
    const t = new Date(now.getTime() + i * 3600e3);
    const wx = weatherFor(placeId, t);
    out.push({
      ...wx,
      at: t.getTime(),
      hourLabel: t.toLocaleTimeString([], { hour: "numeric" }),
    });
  }
  return out;
}

export function skyTone(when = new Date(), condition = "clear") {
  if (condition === "rain" || condition === "storm") return "rain";
  const h = when.getHours();
  if (h < 6 || h >= 21) return "night";
  if (h < 9) return "dawn";
  if (h >= 18) return "dusk";
  return "day";
}

export function compareWeather(home, dest) {
  const dTemp = dest.temp - home.temp;
  const lines = [];
  if (Math.abs(dTemp) >= 3) {
    lines.push(dTemp > 0 ? `${Math.abs(dTemp)}° warmer where you're going` : `${Math.abs(dTemp)}° cooler where you're going`);
  } else {
    lines.push("Same air, roughly — still check the hour you arrive");
  }
  if (dest.precip && !home.precip) lines.push("Rain waits at the destination");
  if (!dest.precip && home.precip) lines.push("Wet here — clearer ahead");
  if (dest.precip && home.precip) lines.push("Wet on both sides of the door");
  if (dest.pop >= 50 && !dest.precip) lines.push(`${dest.pop}% chance of rain when you arrive`);
  return lines;
}

export function wxGlyph(condition) {
  return condition || "clear";
}

export function weatherSource() {
  return liveStatus;
}

export async function hydrateWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached?.at && Date.now() - cached.at < TTL && cached.data) {
      live = cached.data;
      liveStatus = "live";
      return live;
    }
  } catch {
    /* ignore */
  }

  let lat = 51.5074;
  let lon = -0.1278;
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("no geo"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2500, maximumAge: 600000 });
    });
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  } catch {
    /* default city */
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&forecast_days=2&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("wx http");
    const data = await res.json();
    live = data;
    liveStatus = "live";
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
    return live;
  } catch {
    liveStatus = "sketch";
    return null;
  }
}
