import { createSea } from './sea.js';
import { unlockAudio, landChime, tapSoft, warnPulse } from './audio.js';
import {
  load, save, SPECIES, DOCKS, speciesById, dockById,
  bestDock, calcTrip, formatMoney, formatMoneyExact, uid,
  quotaPressure, applyHaulsToQuota, seedDemoTrip, seedPrices,
  suggestTripName, scenarioBoard, seasonStats, countUp,
} from './lib/store.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

createSea($('#sea'));

let state = seedDemoTrip(load());
let screen = 'wake';
let tripStep = 0;
let detailId = null;
const draft = () => state.draft || blankDraft();

function blankDraft() {
  return {
    name: suggestTripName(),
    hours: 10,
    landDock: state.vessel.homeDock,
    fuelCost: 350,
    iceCost: 60,
    otherCost: 0,
    hauls: [{ species: 'cod', weight: 200 }],
    notes: '',
  };
}

function persist() { save(state); }

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function flashLand() {
  const f = $('#flash');
  f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), 500);
}

function nav(name, { resetTrip = false } = {}) {
  screen = name;
  if (resetTrip) {
    tripStep = 0;
    state.draft = blankDraft();
  }
  $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  const showTabs = !['wake', 'detail', 'vessel'].includes(name);
  $('#tabbar').hidden = !showTabs;
  $$('#tabbar .tab').forEach((t) => t.classList.toggle('active', t.dataset.nav === name));
  render();
}

function tickClock() {
  $('#clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 30e3);

function syncNet() {
  const online = navigator.onLine;
  $('#net-dot').classList.toggle('off', !online);
  $('#net-label').textContent = online ? 'Harbor signal' : 'Offshore · offline';
}
syncNet();
addEventListener('online', syncNet);
addEventListener('offline', syncNet);

function render() {
  if (screen === 'bridge') renderBridge();
  if (screen === 'trip') renderTripForm();
  if (screen === 'docks') renderDocks();
  if (screen === 'ledger') renderLedger();
  if (screen === 'detail') renderDetail();
  if (screen === 'vessel') renderVessel();
}

function renderBridge() {
  const last = state.trips[0];
  const stats = seasonStats(state.trips);
  const goal = state.seasonGoal || 45000;
  const pct = Math.min(100, (stats.total / goal) * 100);
  $('#goal-label').textContent = `${formatMoney(stats.total)} / ${formatMoney(goal)}`;
  $('#goal-fill').style.width = `${pct}%`;

  if (last) {
    const m = last.money || calcTrip(last, state.vessel, state.prices);
    countUp($('#hero-profit'), m.profit);
    $('#hero-trip-name').textContent = last.name || 'Untitled trip';
    $('#hero-per-hour').textContent = m.perHour != null ? `${formatMoney(m.perHour)}/hr` : '—';
    $('#hero-dock').textContent = dockById(last.landDock)?.name || last.landDock;
  } else {
    $('#hero-profit').textContent = '$0';
    $('#hero-trip-name').textContent = 'No trips yet';
    $('#hero-per-hour').textContent = '—';
    $('#hero-dock').textContent = '—';
  }

  const ranked = SPECIES.map((s) => {
    const p = quotaPressure(state.quotas, s.id);
    return { s, p, q: state.quotas[s.id] };
  }).sort((a, b) => b.p - a.p).slice(0, 4);

  $('#quota-row').innerHTML = ranked.map(({ s, p, q }) => {
    const cls = p >= 0.92 ? 'hot' : p >= 0.75 ? 'warn' : '';
    return `<div class="q-chip ${cls}">
      <div class="sp">${s.icon || ''} ${s.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, p * 100)}%"></div></div>
      <div class="nums">${Math.round(q.used)} / ${q.cap} ${s.unit}</div>
    </div>`;
  }).join('');

  const hot = ranked.find((x) => x.p >= 0.85);
  const box = $('#quota-alert');
  if (hot) {
    if (hot.p >= 0.9) warnPulse();
    box.innerHTML = `<div class="alert ${hot.p >= 0.95 ? 'hot' : ''}">
      ${hot.s.name} is at ${Math.round(hot.p * 100)}% of quota.
      Land light or you’ll ride the cap.
    </div>`;
  } else box.innerHTML = '';

  const list = $('#trip-list');
  if (!state.trips.length) {
    list.innerHTML = `<div class="empty"><h3>Log is empty</h3><p>Start a trip from the tab below.</p></div>`;
    return;
  }
  list.innerHTML = state.trips.slice(0, 8).map((t) => {
    const m = t.money || calcTrip(t, state.vessel, state.prices);
    const when = new Date(t.landedAt || t.departedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<button type="button" class="trip-card" data-trip="${t.id}">
      <p class="t-name">${escapeHtml(t.name || 'Trip')}</p>
      <div class="t-row"><span>${when} · ${dockById(t.landDock)?.name || ''}</span>
      <span class="t-profit">${formatMoney(m.profit)}</span></div>
    </button>`;
  }).join('');
}

function renderTripForm() {
  const d = draft();
  [...$('#trip-steps').children].forEach((el, i) => el.classList.toggle('on', i <= tripStep));
  const form = $('#trip-form');

  if (tripStep === 0) {
    form.innerHTML = `
      <p class="section-label">Depart</p>
      <div class="field"><label>Trip name</label>
        <input id="f-name" value="${escapeAttr(d.name)}" placeholder="Dawn set — Jeffreys Ledge" /></div>
      <div class="row-2">
        <div class="field"><label>Hours underway</label>
          <input id="f-hours" type="number" min="1" step="0.5" value="${d.hours}" /></div>
        <div class="field"><label>Land dock</label>
          <select id="f-dock">${DOCKS.map((x) =>
            `<option value="${x.id}" ${x.id === d.landDock ? 'selected' : ''}>${x.name}, ${x.harbor}</option>`).join('')}
          </select></div>
      </div>
      <button type="button" class="btn btn-primary btn-block" id="f-next">Haul →</button>`;
  } else if (tripStep === 1) {
    const warnings = d.hauls.map((h) => {
      const p = quotaPressure(state.quotas, h.species, Number(h.weight) || 0);
      if (p < 0.8) return '';
      const sp = speciesById(h.species);
      return `<div class="alert ${p >= 0.95 ? 'hot' : ''}">${sp?.name || h.species}: this haul would put you at ${Math.round(p * 100)}% of quota.</div>`;
    }).join('');

    form.innerHTML = `
      <p class="section-label">Haul</p>
      ${warnings}
      <div class="haul-list" id="haul-list">${d.hauls.map((h, i) => haulRow(h, i)).join('')}</div>
      <button type="button" class="btn btn-ghost btn-block" id="f-add-haul" style="margin-bottom:0.75rem">+ Add species</button>
      <div style="display:flex;gap:0.5rem">
        <button type="button" class="btn btn-ghost" id="f-back" style="flex:1">Back</button>
        <button type="button" class="btn btn-primary" id="f-next" style="flex:2">Costs →</button>
      </div>`;
  } else {
    const preview = calcTrip({ ...d }, state.vessel, state.prices);
    const scenarios = scenarioBoard(d.hauls, state.vessel, state.prices).slice(0, 3);
    form.innerHTML = `
      <p class="section-label">Fuel · ice · crew</p>
      <div class="row-2">
        <div class="field"><label>Fuel $</label>
          <input id="f-fuel" type="number" min="0" step="1" value="${d.fuelCost}" /></div>
        <div class="field"><label>Ice $</label>
          <input id="f-ice" type="number" min="0" step="1" value="${d.iceCost}" /></div>
      </div>
      <div class="field"><label>Other $</label>
        <input id="f-other" type="number" min="0" step="1" value="${d.otherCost}" /></div>
      <div class="field"><label>Notes</label>
        <textarea id="f-notes" placeholder="Fog until 0900…">${escapeHtml(d.notes || '')}</textarea></div>

      <p class="section-label">Best docks for this haul</p>
      <div class="scenario">
        <div class="row head"><span>Dock</span><span>Profit</span><span>vs home</span></div>
        ${scenarios.map((r, i) => `
          <div class="row ${i === 0 ? 'best' : ''}">
            <span class="dock">${r.dock.name}</span>
            <span>${formatMoney(r.profit)}</span>
            <span class="${r.delta >= 0 ? 'pos' : 'neg'}">${r.delta >= 0 ? '+' : ''}${formatMoney(r.delta)}</span>
          </div>`).join('')}
      </div>

      <div class="breakdown">
        <div class="line"><span>Gross @ ${dockById(d.landDock)?.name || d.landDock}</span><span>${formatMoneyExact(preview.gross)}</span></div>
        <div class="line"><span>Expenses</span><span class="neg">−${formatMoneyExact(preview.expenses)}</span></div>
        <div class="line"><span>Crew (${Math.round(state.vessel.crewShare * 100)}%)</span><span class="neg">−${formatMoneyExact(preview.crew)}</span></div>
        <div class="line total"><span>Your share</span><span>${formatMoneyExact(preview.profit)}</span></div>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button type="button" class="btn btn-ghost" id="f-back" style="flex:1">Back</button>
        <button type="button" class="btn btn-primary" id="f-land" style="flex:2">Land trip</button>
      </div>`;
  }
}

function haulRow(h, i) {
  return `<div class="haul-item" data-i="${i}">
    <div class="field" style="margin:0"><label>Species</label>
      <select data-f="species">${SPECIES.map((s) =>
        `<option value="${s.id}" ${s.id === h.species ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select></div>
    <div class="field" style="margin:0"><label>Weight lb</label>
      <input data-f="weight" type="number" min="1" step="1" value="${h.weight}" /></div>
    <button type="button" class="rm" data-rm="${i}">✕</button>
  </div>`;
}

function syncDraftFromDom() {
  if (!state.draft) state.draft = blankDraft();
  const d = state.draft;
  if (tripStep === 0) {
    d.name = $('#f-name')?.value || '';
    d.hours = Number($('#f-hours')?.value) || 1;
    d.landDock = $('#f-dock')?.value || d.landDock;
  } else if (tripStep === 1) {
    $$('#haul-list .haul-item').forEach((row, i) => {
      d.hauls[i] = d.hauls[i] || { species: 'cod', weight: 100 };
      d.hauls[i].species = row.querySelector('[data-f=species]').value;
      d.hauls[i].weight = Number(row.querySelector('[data-f=weight]').value) || 0;
    });
  } else if (tripStep === 2) {
    d.fuelCost = Number($('#f-fuel')?.value) || 0;
    d.iceCost = Number($('#f-ice')?.value) || 0;
    d.otherCost = Number($('#f-other')?.value) || 0;
    d.notes = $('#f-notes')?.value || '';
  }
}

function landTrip({ skipDomSync = false } = {}) {
  if (!skipDomSync) syncDraftFromDom();
  const d = draft();
  if (!d.hauls.some((h) => h.weight > 0)) {
    toast('Add at least one haul');
    return;
  }
  const trip = {
    id: uid(),
    name: d.name.trim() || `Trip · ${new Date().toLocaleDateString()}`,
    departedAt: Date.now() - (d.hours || 1) * 3600e3,
    landedAt: Date.now(),
    hours: d.hours,
    landDock: d.landDock,
    fuelCost: d.fuelCost,
    iceCost: d.iceCost,
    otherCost: d.otherCost,
    hauls: d.hauls.filter((h) => h.weight > 0),
    notes: d.notes,
  };
  trip.money = calcTrip(trip, state.vessel, state.prices);
  state.quotas = applyHaulsToQuota(state.quotas, trip.hauls);
  state.trips.unshift(trip);
  state.draft = null;
  persist();
  landChime();
  flashLand();
  toast(`Landed · ${formatMoney(trip.money.profit)} yours`);
  detailId = trip.id;
  nav('detail');
}

function runDemoLand() {
  unlockAudio();
  state.onboarded = true;
  state.draft = {
    name: 'Night tow — Stellwagen',
    hours: 14,
    landDock: 'newbedford',
    fuelCost: 510,
    iceCost: 95,
    otherCost: 25,
    hauls: [
      { species: 'scallop', weight: 240 },
      { species: 'cod', weight: 160 },
    ],
    notes: 'Hard bottom. Price board favored New Bedford.',
  };
  tripStep = 2;
  landTrip({ skipDomSync: true });
}

function renderDocks() {
  const sel = $('#price-species');
  if (!sel.options.length) {
    sel.innerHTML = SPECIES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  const sp = sel.value || 'cod';
  const best = bestDock(state.prices, sp);
  const homePx = state.prices[state.vessel.homeDock]?.[sp];

  const sorted = [...DOCKS].sort((a, b) =>
    (state.prices[b.id]?.[sp] ?? 0) - (state.prices[a.id]?.[sp] ?? 0));
  $('#price-body').innerHTML = sorted.map((d) => {
    const p = state.prices[d.id]?.[sp] ?? 0;
    const isBest = best && d.id === best.dock.id;
    return `<tr class="${isBest ? 'best' : ''}">
      <td class="dock-name">${d.name}<div style="font-size:0.68rem;color:var(--mute);font-family:var(--font-ui)">${d.harbor}</div></td>
      <td>${p.toFixed(2)}</td>
      <td style="color:var(--brass);font-size:0.62rem;letter-spacing:0.08em">${isBest ? 'BEST' : ''}</td>
    </tr>`;
  }).join('');

  const alert = $('#price-alert');
  if (best && homePx != null && best.price > homePx * 1.04 && best.dock.id !== state.vessel.homeDock) {
    const lift = ((best.price - homePx) / homePx * 100).toFixed(0);
    alert.innerHTML = `<div class="alert ok">
      ${best.dock.name} is paying ~${lift}% more than ${dockById(state.vessel.homeDock)?.name} for ${speciesById(sp)?.name}.
    </div>`;
  } else alert.innerHTML = '';

  // Scenario from last trip hauls
  const hauls = state.trips[0]?.hauls || [{ species: 'cod', weight: 200 }];
  const board = scenarioBoard(hauls, state.vessel, state.prices);
  $('#scenario-board').innerHTML = `
    <div class="row head"><span>Dock</span><span>Profit</span><span>vs home</span></div>
    ${board.map((r, i) => `
      <div class="row ${i === 0 ? 'best' : ''}">
        <span class="dock">${r.dock.name}${r.steamHrs ? ` <span style="color:var(--mute);font-weight:400">· ${r.steamHrs.toFixed(1)}h</span>` : ''}</span>
        <span style="font-family:var(--font-mono)">${formatMoney(r.profit)}</span>
        <span class="${r.delta >= 0 ? 'pos' : 'neg'}">${r.delta >= 0 ? '+' : ''}${formatMoney(r.delta)}</span>
      </div>`).join('')}`;
}

function renderLedger() {
  const stats = seasonStats(state.trips);
  $('#season-stats').innerHTML = `
    <div class="stat"><b>${formatMoney(stats.total)}</b><span>Season</span></div>
    <div class="stat"><b>${formatMoney(stats.best)}</b><span>Best trip</span></div>
    <div class="stat"><b>${formatMoney(stats.perHour)}</b><span>$ / hour</span></div>`;

  $('#quota-full').innerHTML = SPECIES.map((s) => {
    const q = state.quotas[s.id];
    const p = q.used / q.cap;
    const cls = p >= 0.92 ? 'hot' : p >= 0.75 ? 'warn' : '';
    return `<div class="q-chip ${cls}" style="margin-bottom:0.45rem">
      <div class="sp">${s.icon} ${s.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, p * 100)}%"></div></div>
      <div class="nums">${Math.round(q.used)} / ${q.cap} ${s.unit} · ${Math.round(p * 100)}%</div>
    </div>`;
  }).join('');

  const list = $('#ledger-list');
  if (!state.trips.length) {
    list.innerHTML = `<div class="empty"><h3>No landings yet</h3></div>`;
    return;
  }
  list.innerHTML = state.trips.map((t) => {
    const m = t.money || calcTrip(t, state.vessel, state.prices);
    const when = new Date(t.landedAt || t.departedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<button type="button" class="trip-card" data-trip="${t.id}">
      <p class="t-name">${escapeHtml(t.name || 'Trip')}</p>
      <div class="t-row"><span>${when}</span><span class="t-profit">${formatMoney(m.profit)}</span></div>
    </button>`;
  }).join('');
}

function renderDetail() {
  const t = state.trips.find((x) => x.id === detailId);
  const body = $('#detail-body');
  if (!t) {
    body.innerHTML = `<div class="empty"><h3>Trip not found</h3></div>`;
    return;
  }
  const m = t.money || calcTrip(t, state.vessel, state.prices);
  body.innerHTML = `
    <h2 style="font-family:var(--font-display);font-weight:400;font-size:1.75rem;margin:0 0 0.35rem">${escapeHtml(t.name)}</h2>
    <p style="color:var(--mute);margin:0 0 1rem;font-size:0.88rem">
      ${dockById(t.landDock)?.name || t.landDock} · ${t.hours}h underway
    </p>
    <div class="hero-profit">
      <p class="label">Your share</p>
      <p class="amount" id="detail-profit">${formatMoney(m.profit)}</p>
      <div class="meta">
        <span>${m.perHour != null ? `<strong>${formatMoney(m.perHour)}</strong>/hr` : ''}</span>
        <span>Crew took ${formatMoney(m.crew)}</span>
      </div>
    </div>
    <p class="section-label">Haul</p>
    ${m.lines.map((l) => {
      const sp = speciesById(l.species);
      return `<div class="breakdown"><div class="line">
        <span>${sp?.name || l.species} · ${l.weight} lb @ ${l.price.toFixed(2)}</span>
        <span>${formatMoneyExact(l.line)}</span>
      </div></div>`;
    }).join('')}
    <div class="breakdown">
      <div class="line"><span>Gross</span><span>${formatMoneyExact(m.gross)}</span></div>
      <div class="line"><span>Fuel / ice / other</span><span class="neg">−${formatMoneyExact(m.expenses)}</span></div>
      <div class="line"><span>Crew share</span><span class="neg">−${formatMoneyExact(m.crew)}</span></div>
      <div class="line total"><span>Skipper</span><span>${formatMoneyExact(m.profit)}</span></div>
    </div>
    ${t.notes ? `<p class="section-label">Notes</p><p style="color:var(--mute);line-height:1.5">${escapeHtml(t.notes)}</p>` : ''}
    <button type="button" class="btn btn-ghost btn-block" id="btn-delete-trip" style="margin-top:1.25rem;color:var(--signal);border-color:rgba(224,74,64,0.35)">Strike from log</button>
  `;
  countUp($('#detail-profit'), m.profit, { ms: 700 });
}

function renderVessel() {
  const v = state.vessel;
  $('#vessel-form').innerHTML = `
    <div class="field"><label>Vessel name</label>
      <input id="v-name" value="${escapeAttr(v.name)}" /></div>
    <div class="field"><label>Home dock</label>
      <select id="v-dock">${DOCKS.map((d) =>
        `<option value="${d.id}" ${d.id === v.homeDock ? 'selected' : ''}>${d.name}, ${d.harbor}</option>`).join('')}
      </select></div>
    <div class="field"><label>Crew share (<span id="v-crew-label">${Math.round(v.crewShare * 100)}</span>%)</label>
      <input id="v-crew" type="range" min="20" max="50" step="1" value="${Math.round(v.crewShare * 100)}" /></div>
    <div class="field"><label>Fuel burn steaming ($/hr)</label>
      <input id="v-fuel-hr" type="number" min="10" step="1" value="${v.fuelPerHour || 42}" /></div>
    <div class="field"><label>Season goal $</label>
      <input id="v-goal" type="number" min="5000" step="1000" value="${state.seasonGoal || 45000}" /></div>
    <button type="button" class="btn btn-primary btn-block" id="v-save">Save vessel</button>
    <p style="color:var(--mute);font-size:0.85rem;line-height:1.5;margin-top:1.5rem">
      Homeport keeps every trip on this device. No account. No cloud bill.
      The log works in fog and dead zones — sync later when you want.
    </p>
  `;
  $('#v-crew').addEventListener('input', (e) => {
    $('#v-crew-label').textContent = e.target.value;
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

// Events
$('#btn-enter').addEventListener('click', () => {
  unlockAudio(); tapSoft();
  state.onboarded = true; persist();
  nav('bridge');
});
$('#btn-demo-land').addEventListener('click', runDemoLand);

$('#tabbar').addEventListener('click', (e) => {
  const t = e.target.closest('[data-nav]');
  if (!t) return;
  unlockAudio(); tapSoft();
  nav(t.dataset.nav, { resetTrip: t.dataset.nav === 'trip' });
});

$$('[data-back]').forEach((b) => b.addEventListener('click', () => { tapSoft(); nav(b.dataset.back); }));
$('#btn-vessel').addEventListener('click', () => { tapSoft(); nav('vessel'); });

$('#btn-suggest-name')?.addEventListener('click', () => {
  if (!state.draft) state.draft = blankDraft();
  state.draft.name = suggestTripName();
  const input = $('#f-name');
  if (input) input.value = state.draft.name;
  else { tripStep = 0; renderTripForm(); }
  toast('Name suggested');
});

$('#btn-refresh-prices').addEventListener('click', () => {
  state.prices = seedPrices();
  state.pricesAt = Date.now();
  persist();
  renderDocks();
  toast('Dock board refreshed');
});
$('#price-species').addEventListener('change', () => renderDocks());

$('#btn-clear-demo').addEventListener('click', () => {
  if (!confirm('Clear all trips and reset quotas?')) return;
  const vessel = { ...state.vessel };
  const goal = state.seasonGoal;
  localStorage.removeItem('homeport.v2');
  localStorage.removeItem('homeport.v1');
  state = seedDemoTrip(load());
  state.vessel = vessel;
  state.seasonGoal = goal;
  persist();
  toast('Log reset');
  renderLedger();
});

$('#app').addEventListener('click', (e) => {
  const card = e.target.closest('[data-trip]');
  if (card) { detailId = card.dataset.trip; nav('detail'); return; }
  if (e.target.id === 'btn-delete-trip') {
    state.trips = state.trips.filter((t) => t.id !== detailId);
    persist(); toast('Struck from log'); nav('bridge'); return;
  }
  if (e.target.id === 'v-save') {
    state.vessel.name = $('#v-name').value.trim() || state.vessel.name;
    state.vessel.homeDock = $('#v-dock').value;
    state.vessel.crewShare = Number($('#v-crew').value) / 100;
    state.vessel.fuelPerHour = Number($('#v-fuel-hr').value) || 42;
    state.seasonGoal = Number($('#v-goal').value) || 45000;
    persist(); toast('Vessel saved'); nav('bridge'); return;
  }
  if (e.target.id === 'f-next') {
    syncDraftFromDom(); tripStep = Math.min(2, tripStep + 1); tapSoft(); renderTripForm(); return;
  }
  if (e.target.id === 'f-back') {
    syncDraftFromDom(); tripStep = Math.max(0, tripStep - 1); renderTripForm(); return;
  }
  if (e.target.id === 'f-land') { landTrip(); return; }
  if (e.target.id === 'f-add-haul') {
    syncDraftFromDom();
    state.draft.hauls.push({ species: 'haddock', weight: 100 });
    renderTripForm(); return;
  }
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    syncDraftFromDom();
    const i = Number(rm.dataset.rm);
    if (state.draft.hauls.length > 1) { state.draft.hauls.splice(i, 1); renderTripForm(); }
  }
});

const hash = (location.hash || '').slice(1);
if (hash === 'bridge' || state.onboarded) {
  nav(['trip', 'docks', 'ledger'].includes(hash) ? hash : 'bridge');
} else nav('wake');

window.__HOMEPORT = {
  state: () => structuredClone(state),
  nav,
  landDemo: runDemoLand,
  reset() { localStorage.removeItem('homeport.v2'); localStorage.removeItem('homeport.v1'); location.reload(); },
};

console.info('Homeport v2 — profit after fuel & crew.');
