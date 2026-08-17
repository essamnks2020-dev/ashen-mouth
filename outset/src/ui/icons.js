/**
 * Outset icon system — all custom SVG, no emoji.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.7",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

function svg(body, view = "0 0 24 24") {
  return `<svg viewBox="${view}" aria-hidden="true" class="ico-svg">${body}</svg>`;
}

const PATHS = {
  keys: `<circle cx="8" cy="14" r="3.2"/><path d="M10.5 12.5 18 5m0 0h3m-3 0v3M7.2 15.8l1.6 1.6"/>`,
  phone: `<rect x="7" y="3.5" width="10" height="17" rx="2.2"/><path d="M10.5 18.5h3"/>`,
  wallet: `<rect x="3.5" y="7" width="17" height="11" rx="2"/><path d="M3.5 10.5h17M15.5 14.2h2.5"/>`,
  transit: `<rect x="6" y="4" width="12" height="14" rx="2.5"/><path d="M9 18.5v1.5M15 18.5v1.5M8 9h8M8 12.5h8"/><circle cx="9.5" cy="15.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="14.5" cy="15.5" r="0.9" fill="currentColor" stroke="none"/>`,
  laptop: `<rect x="4" y="5.5" width="16" height="10" rx="1.5"/><path d="M2.5 17.5h19"/>`,
  gym: `<path d="M8 8.5h8l1.5 10.5H6.5L8 8.5z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>`,
  umbrella: `<path d="M12 11.5v7.2a1.6 1.6 0 0 0 3.2 0"/><path d="M5 11.5c0-4 3.1-7 7-7s7 3 7 7H5z"/>`,
  charger: `<rect x="9" y="3.5" width="6" height="10" rx="1.4"/><path d="M11 13.5v4M13 13.5v4M10.5 17.5h3"/>`,
  headphones: `<path d="M5.5 13.5v-2a6.5 6.5 0 0 1 13 0v2"/><rect x="3.8" y="12.5" width="3.4" height="5.5" rx="1.2"/><rect x="16.8" y="12.5" width="3.4" height="5.5" rx="1.2"/>`,
  water: `<path d="M12 3.5s5.5 6.2 5.5 10.2a5.5 5.5 0 1 1-11 0C6.5 9.7 12 3.5 12 3.5z"/>`,
  coat: `<path d="M9 4.5 12 7l3-2.5 3 2v13.5H6V6.5l3-2z"/><path d="M12 7v13"/>`,
  sunscreen: `<rect x="8.5" y="7" width="7" height="13" rx="2"/><path d="M10.5 7V5.2a1.5 1.5 0 0 1 3 0V7M10 11h4"/>`,
  item: `<circle cx="12" cy="12" r="6.5"/><path d="M12 8.5v7M8.5 12h7"/>`,

  walk: `<circle cx="12" cy="5.5" r="2"/><path d="M10 9.5 8 21M14 9.5l2 4-3 2 1.5 5.5M10 9.5l4 4"/>`,
  drive: `<path d="M4.5 14.5h15l-1.2-4.2A2 2 0 0 0 16.4 9H7.6a2 2 0 0 0-1.9 1.3L4.5 14.5z"/><path d="M4.5 14.5v3h2.2v-1.2h10.6v1.2h2.2v-3"/><circle cx="8" cy="14.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="14.5" r="1.1" fill="currentColor" stroke="none"/>`,
  bike: `<circle cx="6.5" cy="15.5" r="3"/><circle cx="17.5" cy="15.5" r="3"/><path d="M6.5 15.5 10 8.5h4l3.5 7M10 8.5 12.5 15M14 8.5h2.5"/>`,

  clear: `<circle cx="12" cy="12" r="4"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6"/>`,
  cloud: `<path d="M7.5 16.5h10a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.5-1.2A3.8 3.8 0 0 0 7.5 16.5z"/>`,
  rain: `<path d="M7.5 13.5h10a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.5-1.2A3.8 3.8 0 0 0 7.5 13.5z"/><path d="M9 16.5 8 19.5M12.5 16.5 11.5 19.5M16 16.5 15 19.5"/>`,
  storm: `<path d="M7.5 12.5h10a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.5-1.2A3.8 3.8 0 0 0 7.5 12.5z"/><path d="m11 13 2.5-4H12l1.5 4h-1.8L14 18"/>`,
  haze: `<path d="M5 9.5h14M5 12.5h14M5 15.5h14"/><circle cx="12" cy="7" r="2.2" opacity="0.6"/>`,
  wind: `<path d="M4 9.5h11a2.2 2.2 0 1 0-2.2-2.2M4 13h14a2.2 2.2 0 1 1-2.2 2.2M4 16.5h8"/>`,

  share: `<path d="M7 12v7.5h10V12M12 4.5v11M8.5 8 12 4.5 15.5 8"/>`,
  history: `<circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.5l3 1.8"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M12 4.2v2M12 17.8v2M4.2 12h2M17.8 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4"/>`,
  back: `<path d="M14.5 6 9 12l5.5 6"/>`,
  check: `<path d="m6.5 12.2 3.4 3.4 7.6-7.8"/>`,
  door: `<path d="M7 20V6.5A2.5 2.5 0 0 1 9.5 4H16v16"/><path d="M7 20h12"/><circle cx="13.8" cy="12" r="0.9" fill="currentColor" stroke="none"/>`,
};

function strokeIcon(key) {
  const body = PATHS[key] || PATHS.item;
  const attrs = Object.entries(stroke)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return svg(`<g ${attrs}>${body}</g>`);
}

export function icon(name) {
  return strokeIcon(name);
}

export function wxIcon(condition) {
  const map = {
    clear: "clear",
    haze: "haze",
    cloud: "cloud",
    rain: "rain",
    storm: "storm",
    wind: "wind",
  };
  return icon(map[condition] || "clear");
}

export function modeIcon(modeId) {
  if (modeId === "transit") return icon("transit");
  if (modeId === "drive") return icon("drive");
  if (modeId === "bike") return icon("bike");
  if (modeId === "walk") return icon("walk");
  return icon("walk");
}
