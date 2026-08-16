/**
 * On-device weather sketch — deterministic, no API key.
 */

const CONDITIONS = ["clear", "haze", "cloud", "rain", "storm", "wind"];

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

export function weatherFor(placeId, when = new Date()) {
  const hour = when.getHours();
  const seed = hash(`${placeId}-${when.toDateString()}-${hour}`);
  const baseTemp = 8 + (seed % 20);
  const curve = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 5;
  const temp = Math.round(baseTemp + curve);

  let condition = pick(seed, CONDITIONS);
  if (hour >= 22 || hour < 5) condition = pick(seed, ["clear", "haze", "cloud"]);
  if (seed % 7 === 0) condition = "rain";
  if (seed % 23 === 0) condition = "storm";

  const precip = condition === "rain" || condition === "storm";
  const wind = 3 + (seed % 16);
  const feels = temp - (wind > 14 ? 2 : 0) - (precip ? 1 : 0);
  const humidity = 40 + (seed % 45);

  return {
    placeId,
    temp,
    feels,
    condition,
    precip,
    wind,
    humidity,
    label: labelFor(condition),
    hint: hintFor(condition, temp),
    code: condition,
    updatedAt: when.getTime(),
  };
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

export function compareWeather(home, dest) {
  const dTemp = dest.temp - home.temp;
  const lines = [];
  if (Math.abs(dTemp) >= 3) {
    lines.push(dTemp > 0 ? `${Math.abs(dTemp)}° warmer where you're going` : `${Math.abs(dTemp)}° cooler where you're going`);
  } else {
    lines.push("Same air, roughly");
  }
  if (dest.precip && !home.precip) lines.push("Rain waits at the destination");
  if (!dest.precip && home.precip) lines.push("Wet here — clearer ahead");
  if (dest.precip && home.precip) lines.push("Wet on both sides of the door");
  return lines;
}

export function wxGlyph(condition) {
  const map = { storm: "⚡", rain: "☂", cloud: "☁", haze: "◌", wind: "🌬", clear: "☀" };
  return map[condition] || "☀";
}
