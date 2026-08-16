/**
 * On-device weather sketch — deterministic from place + hour so demos feel alive
 * without an API key. Swap for real Open-Meteo later.
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
  const baseTemp = 6 + (seed % 22);
  const curve = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 5;
  const temp = Math.round(baseTemp + curve);

  let condition = pick(seed, CONDITIONS);
  if (hour >= 22 || hour < 5) {
    condition = pick(seed, ["clear", "haze", "cloud"]);
  }
  if (seed % 7 === 0) condition = "rain";
  if (seed % 23 === 0) condition = "storm";

  const precip = condition === "rain" || condition === "storm";
  const wind = 4 + (seed % 18);
  const feels = temp - (wind > 15 ? 2 : 0) - (precip ? 1 : 0);

  return {
    placeId,
    temp,
    feels,
    condition,
    precip,
    wind,
    label: labelFor(condition),
    hint: hintFor(condition, temp),
    code: condition,
    updatedAt: when.getTime(),
  };
}

function labelFor(c) {
  switch (c) {
    case "clear":
      return "Clear";
    case "haze":
      return "Soft haze";
    case "cloud":
      return "Overcast";
    case "rain":
      return "Rain";
    case "storm":
      return "Storm light";
    case "wind":
      return "Windy";
    default:
      return c;
  }
}

function hintFor(c, temp) {
  if (c === "rain" || c === "storm") return "Take the umbrella.";
  if (temp <= 6) return "Coat weather.";
  if (temp >= 26) return "Warm out — travel light.";
  if (c === "wind") return "Wind on the bridges.";
  return "Ordinary sky. Good.";
}

export function compareWeather(home, dest) {
  const dTemp = dest.temp - home.temp;
  const lines = [];
  if (Math.abs(dTemp) >= 3) {
    lines.push(
      dTemp > 0
        ? `${Math.abs(dTemp)}° warmer where you're going`
        : `${Math.abs(dTemp)}° colder where you're going`
    );
  } else {
    lines.push("Same air, roughly");
  }
  if (dest.precip && !home.precip) lines.push("Rain starts at the destination");
  if (!dest.precip && home.precip) lines.push("Rain here — clearer ahead");
  if (dest.precip && home.precip) lines.push("Wet both sides of the door");
  return lines;
}

export function wxGlyph(condition) {
  switch (condition) {
    case "storm":
      return "⚡";
    case "rain":
      return "☂";
    case "snow":
      return "❄";
    case "cloud":
      return "☁";
    case "haze":
      return "◌";
    case "wind":
      return "🌬";
    default:
      return "☀";
  }
}
