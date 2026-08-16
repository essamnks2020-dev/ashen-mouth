import { createAtmos } from "./atmos.js";
import { tap, checkOn, doorOpen, unlockAudio, whoosh } from "./audio.js";
import {
  load,
  save,
  weekdayLabel,
  itemsForToday,
  nextEvent,
  upcomingEvents,
  todaysPlan,
  departuresOnDay,
  weekSealedCount,
  expandSchedule,
  leaveBy,
  formatTime,
  formatDay,
  minutesUntil,
  toggleChecked,
  resetChecks,
  recordDeparture,
  upsertItem,
  upsertEvent,
  upsertRoutine,
  travelMinutes,
  TRAVEL_MODES,
  PRESETS,
  layerHint,
  topForgot,
  dayStamp,
  uid,
  WEEKDAYS,
} from "./lib/store.js";
import { weatherFor, compareWeather } from "./lib/weather.js";
import { icon, wxIcon, modeIcon } from "./ui/icons.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let state = load();
let screen = "wake";
let sealed = false;
let ritualDestId = state.selectedDestId;

const atmos = createAtmos($("#atmos"));
const toastEl = $("#toast");
let toastTimer = 0;

function wireChromeIcons() {
  const map = [
    ["#btn-share", "share"],
    ["#btn-hist", "history"],
    ["#btn-settings", "settings"],
    ["#back-dest", "back"],
    ["#back-check", "back"],
    ["#back-settings", "back"],
    ["#back-history", "back"],
  ];
  for (const [sel, name] of map) {
    const el = $(sel);
    if (el) el.innerHTML = icon(name);
  }
}

const STEP_LABEL = {
  wake: "Wake",
  home: "Home",
  dest: "Out",
  check: "Pack",
  seal: "Go",
  settings: "Set",
  history: "Log",
};

function persist() {
  save(state);
  expose();
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function period() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function destById(id) {
  return state.destinations.find((d) => d.id === id) || state.destinations[0];
}

function currentDest() {
  const ev = nextEvent(state);
  const id = ritualDestId || ev?.placeId || state.selectedDestId || state.destinations[0].id;
  return destById(id);
}

function wxPair() {
  const home = weatherFor("home");
  const dest = currentDest();
  const there = weatherFor(dest.id);
  return { home, there, dest };
}

function leaveInfo() {
  const { dest } = wxPair();
  const ev = nextEvent(state);
  const leave = leaveBy(ev, dest, state.prefs, state.travelMode);
  const mins = leave != null ? minutesUntil(leave) : null;
  const travel = travelMinutes(dest, state.travelMode);
  return { ev, dest, leave, mins, travel };
}

function showScreen(name) {
  screen = name;
  $$(".screen").forEach((el) => el.classList.toggle("active", el.dataset.screen === name));
  $("#status-step").textContent = STEP_LABEL[name] || name;

  if (name === "wake" || name === "home") atmos.setMode("inside");
  else if (name === "seal" && sealed) atmos.setMode("open");
  else atmos.setMode("ritual");

  const { there } = wxPair();
  atmos.setWeather(there.condition);
  whoosh();

  if (name === "home") renderHome();
  if (name === "dest") renderDest();
  if (name === "check") renderCheck();
  if (name === "seal") renderSeal();
  if (name === "settings") renderSettings();
  if (name === "history") renderHistory();
  expose();
}

function tickClock() {
  const now = new Date();
  $("#status-clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (screen === "home") updateCountdownOnly();
}

function updateCountdownOnly() {
  const { leave, mins, dest, ev, travel } = leaveInfo();
  const ring = $("#leave-ring");
  const label = $("#leave-ring-label");
  if (!ring) return;
  if (mins == null) {
    ring.style.setProperty("--p", "0");
    label.textContent = "—";
    return;
  }
  const windowMin = Math.max(travel + (state.prefs.leaveBufferMin || 8), 30);
  const p = Math.max(0, Math.min(100, ((windowMin - Math.max(mins, 0)) / windowMin) * 100));
  ring.style.setProperty("--p", String(p));
  label.textContent = mins > 120 ? `${Math.round(mins / 60)}h` : mins > 0 ? `${mins}m` : mins > -12 ? "NOW" : "LATE";
  const strong = $("#leave-cd-strong");
  const sub = $("#leave-cd-sub");
  if (strong) strong.textContent = `Leave by ${formatTime(leave)}`;
  if (sub) {
    sub.textContent = ev
      ? `${dest.label} · ${TRAVEL_MODES[state.travelMode]?.label || "Transit"} · ${travel} min`
      : "Add an event in Settings";
  }
}

function renderWeek() {
  const row = $("#week-row");
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const sealedDays = new Set(
    (state.departures || []).map((d) => dayStamp(new Date(d.at)))
  );
  row.innerHTML = days
    .map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const stamp = dayStamp(d);
      const today = stamp === dayStamp(now);
      const has = sealedDays.has(stamp);
      return `<div class="week-day ${today ? "today" : ""} ${has ? "has" : ""}"><span>${label}</span><b>${d.getDate()}</b></div>`;
    })
    .join("");
}

function renderHome() {
  const { home, there, dest } = wxPair();
  const { ev, leave, mins, travel } = leaveInfo();
  const leftToday = departuresOnDay(state).length;

  $("#greeting").textContent = `Good ${period()}, ${state.name}.`;
  $("#home-when").textContent = `${weekdayLabel()} · ${formatTime(Date.now())}`;

  $("#stat-streak").textContent = String(state.streaks?.current || 0);
  $("#stat-today").textContent = String(leftToday);
  $("#stat-week").textContent = String(weekSealedCount(state));

  $("#home-temp").textContent = `${home.temp}°`;
  $("#home-cond").textContent = `${home.label} · feel ${home.feels}° · wind ${home.wind}`;
  $("#home-wx-icon").innerHTML = wxIcon(home.condition);

  updateCountdownOnly();

  const headline = $("#leave-headline");
  if (mins != null && mins < 0) headline.textContent = "You're late — still go ready.";
  else if (mins != null && mins < 15) headline.textContent = "Time to head out soon.";
  else if (ev) headline.textContent = `Next: ${ev.title}`;
  else headline.textContent = "No leave planned — go when you want.";

  const tips = [];
  tips.push(layerHint(home, there));
  if (there.precip || home.precip) tips.push("Take an umbrella.");
  const forgot = topForgot(state, 1)[0];
  if (forgot?.item) tips.push(`You often forget ${forgot.item.label}.`);
  if (state.streaks?.current >= 2) tips.push(`${state.streaks.current} days in a row — keep going.`);
  if (!(state.routines || []).length) tips.push("Add a weekly routine in Settings so tomorrow is ready.");
  $("#brief-text").textContent = tips.slice(0, 2).join(" ");

  const plan = $("#today-plan");
  const todayLeaves = todaysPlan(state);
  const coming = expandSchedule(state, 3).slice(0, 5);
  const rows = todayLeaves.length ? todayLeaves : coming;
  const headings = [...document.querySelectorAll("#screen-home .section")];
  const planHeading = headings.find((h) => /leaves|coming/i.test(h.textContent));
  if (planHeading) planHeading.textContent = todayLeaves.length ? "Today's leaves" : "Coming next";

  if (!rows.length) {
    plan.innerHTML = `<p class="plan-empty">No leaves planned. Tap Quick leave, or add a weekly routine in Settings.</p>`;
  } else {
    plan.innerHTML = rows
      .map((e) => {
        const d = destById(e.placeId);
        const on = (state.activeEventId || nextEvent(state)?.id) === e.id;
        const tag = e.source === "routine" ? "weekly" : "once";
        const whenDay = dayStamp(new Date(e.at)) === dayStamp() ? "today" : formatDay(e.at);
        return `<button type="button" class="plan-row ${on ? "on" : ""}" data-event="${e.id}" data-place="${e.placeId}">
          <span class="t">${formatTime(e.at)}</span>
          <span class="body"><b>${escapeHtml(e.title)}</b><span>${whenDay} · ${escapeHtml(d?.label || "")} · ${tag}</span></span>
        </button>`;
      })
      .join("");
  }

  renderWeek();

  const card = $("#next-card");
  if (ev) {
    card.hidden = false;
    $("#next-title").textContent = ev.title;
    $("#next-meta").textContent = `${formatTime(ev.at)} · ${dest.label} · ${travel} min · ${TRAVEL_MODES[state.travelMode]?.label}`;
    let leaveTxt = `Leave by ${formatTime(leave)}`;
    if (mins != null) {
      if (mins > 120) leaveTxt += ` · in ${Math.round(mins / 60)}h`;
      else if (mins > 0) leaveTxt += ` · in ${mins} min`;
      else if (mins > -12) leaveTxt += " · leave now";
      else leaveTxt += " · running late";
    }
    $("#next-leave").textContent = leaveTxt;
    card.classList.toggle("late", mins != null && mins < 8);
  } else {
    card.hidden = true;
  }

  atmos.setWeather(home.condition);
}

function renderDest() {
  const { home, there, dest } = wxPair();
  const { ev, leave, mins, travel } = leaveInfo();

  $("#mode-row").innerHTML = Object.values(TRAVEL_MODES)
    .map(
      (m) =>
        `<button type="button" class="mode-pill ${state.travelMode === m.id ? "on" : ""}" data-mode="${m.id}"><span class="pill-ico">${modeIcon(m.id)}</span>${m.label}</button>`
    )
    .join("");

  $("#dest-grid").innerHTML = state.destinations
    .map(
      (d) => `
      <button type="button" class="dest ${d.id === dest.id ? "on" : ""}" data-dest="${d.id}">
        <b>${escapeHtml(d.label)}</b>
        <span>${travelMinutes(d, state.travelMode)} min · ${escapeHtml(d.note || "ready")}</span>
      </button>`
    )
    .join("");

  $("#split-home-temp").textContent = `${home.temp}°`;
  $("#split-home-cond").textContent = home.label;
  $("#split-home-icon").innerHTML = wxIcon(home.condition);
  $("#split-dest-where").textContent = dest.label;
  $("#split-dest-temp").textContent = `${there.temp}°`;
  $("#split-dest-cond").textContent = there.label;
  $("#split-dest-icon").innerHTML = wxIcon(there.condition);
  $("#wx-compare").innerHTML = compareWeather(home, there).map(escapeHtml).join("<br/>");
  $("#layer-hint").textContent = layerHint(home, there);

  $("#dest-leave-time").textContent = leave != null ? formatTime(leave) : "—";
  let meta = ev ? `${ev.title} at ${formatTime(ev.at)}` : "No upcoming event";
  meta += ` · ${travel} min ${TRAVEL_MODES[state.travelMode]?.label || ""}`;
  if (mins != null) meta += mins > 0 ? ` · leave in ${mins}m` : mins > -12 ? " · leave now" : " · late";
  $("#dest-leave-meta").textContent = meta;
  $("#dest-leave-card").classList.toggle("late", mins != null && mins < 8);

  atmos.setWeather(there.condition);
}

function renderCheck() {
  const { home, there, dest } = wxPair();
  const items = itemsForToday(state, home, there, state.activePreset);
  const done = items.filter((it) => state.checked[it.id]).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 100;

  $("#preset-row").innerHTML = PRESETS.map(
    (p) =>
      `<button type="button" class="preset-pill ${state.activePreset === p.id ? "on" : ""}" data-preset="${p.id}">${escapeHtml(p.label)}</button>`
  ).join("");

  $("#check-day").textContent = `${weekdayLabel()} · toward ${dest.label}`;
  $("#check-count").textContent = `${done}/${total}`;
  $("#pack-fill").style.width = `${pct}%`;

  const list = $("#check-list");
  if (!items.length) {
    list.innerHTML = `<p class="sub" style="margin:1rem 0">Nothing due — you're traveling light.</p>`;
  } else {
    list.innerHTML = items
      .map((it) => {
        const on = !!state.checked[it.id];
        const why = it.weather
          ? `weather · ${it.weather}`
          : it.essential
            ? "every departure"
            : (it.days || []).map((d) => d.slice(0, 3)).join(" · ");
        return `
        <button type="button" class="check ${on ? "done" : ""}" data-id="${it.id}">
          <span class="box" aria-hidden="true">${on ? icon("check") : ""}</span>
          <span class="ico" aria-hidden="true">${icon(it.icon || "item")}</span>
          <span class="label">${escapeHtml(it.label)}<span class="why">${escapeHtml(why)}</span></span>
        </button>`;
      })
      .join("");
  }

  const btn = $("#btn-to-seal");
  btn.disabled = total > 0 && done < total;
  btn.textContent = total === 0 || done >= total ? "Step out" : `Check ${total - done} more`;
  atmos.setWeather(there.condition);
}

function renderSeal() {
  const { there, dest } = wxPair();
  const { ev } = leaveInfo();
  const openBtn = $("#btn-seal-open");
  const againBtn = $("#btn-again");
  const copyBtn = $("#btn-copy-leaving");
  const door = $("#seal-door");
  const stage = $("#seal-stage");

  if (sealed) {
    openBtn.hidden = true;
    againBtn.hidden = false;
    copyBtn.hidden = false;
    $("#seal-title").textContent = "You're set.";
    $("#seal-sub").textContent = `Sealed · ${formatTime(Date.now())} · ${dest.label} · ${there.temp}° ${there.label}${
      ev ? ` · ${ev.title}` : ""
    }`;
    door.classList.add("open");
    stage.classList.add("open");
    atmos.setMode("open");
  } else {
    openBtn.hidden = false;
    againBtn.hidden = true;
    copyBtn.hidden = true;
    $("#seal-title").textContent = "Ready when you are.";
    $("#seal-sub").textContent = "Everything checked. Open the door.";
    door.classList.remove("open");
    stage.classList.remove("open");
    atmos.setMode("ritual");
  }
  atmos.setWeather(there.condition);
}

function renderSettings() {
  const body = $("#settings-body");
  const upcoming = upcomingEvents(state, 8);
  const dayOpts = WEEKDAYS.map((d) => `<option value="${d}">${d}</option>`).join("");
  body.innerHTML = `
    <p class="tip-card" style="margin-top:0"><b>Keep using Outset</b>
      <span>Set weekly routines once (work, gym, class). Outset shows them every matching day — morning, afternoon, evening.</span>
    </p>

    <div class="field">
      <label for="set-name">Your name</label>
      <input id="set-name" value="${escapeHtml(state.name)}" autocomplete="nickname" />
    </div>
    <div class="field">
      <label for="set-buffer">Leave this many minutes early</label>
      <input id="set-buffer" type="number" min="3" max="45" value="${state.prefs.leaveBufferMin}" />
    </div>

    <p class="section">Weekly routines</p>
    <div id="routine-list">
      ${(state.routines || [])
        .map((r) => {
          const d = destById(r.placeId);
          const days = (r.days || []).join(", ");
          const time = `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}`;
          return `<div class="hist">
            <b>${escapeHtml(r.title)} · ${time}</b>
            <span>${escapeHtml(d?.label || "")} · ${escapeHtml(days)} · ${r.enabled === false ? "off" : "on"}</span>
            <button type="button" class="btn btn-ghost" data-toggle-routine="${r.id}" style="margin-top:0.4rem;padding:0.45rem 0.7rem;font-size:0.72rem;border-radius:999px">
              ${r.enabled === false ? "Turn on" : "Turn off"}
            </button>
          </div>`;
        })
        .join("") || `<p class="sub">No routines yet.</p>`}
    </div>

    <p class="section" style="margin-top:1rem">Add weekly routine</p>
    <div class="field"><label for="rt-title">Name</label><input id="rt-title" placeholder="Work, class, gym…" /></div>
    <div class="field"><label for="rt-hour">Hour (0–23)</label><input id="rt-hour" type="number" min="0" max="23" value="9" /></div>
    <div class="field"><label for="rt-min">Minute</label><input id="rt-min" type="number" min="0" max="59" value="0" /></div>
    <div class="field"><label for="rt-place">Place</label>
      <select id="rt-place">${state.destinations.map((d) => `<option value="${d.id}">${escapeHtml(d.label)}</option>`).join("")}</select>
    </div>
    <div class="field"><label for="rt-days">Days (hold Ctrl/Cmd for many)</label>
      <select id="rt-days" multiple size="4">${dayOpts}</select>
    </div>
    <button type="button" class="btn btn-primary btn-block" id="btn-add-routine">Save routine</button>

    <p class="section" style="margin-top:1.2rem">One-time leave</p>
    <div class="field"><label for="ev-title">Title</label><input id="ev-title" placeholder="Meeting…" /></div>
    <div class="field"><label for="ev-time">Starts in (minutes)</label><input id="ev-time" type="number" min="15" max="720" value="90" /></div>
    <div class="field"><label for="ev-place">Place</label>
      <select id="ev-place">${state.destinations.map((d) => `<option value="${d.id}">${escapeHtml(d.label)}</option>`).join("")}</select>
    </div>
    <button type="button" class="btn btn-ghost btn-block" id="btn-add-event">Add one-time event</button>

    <p class="section" style="margin-top:1.2rem">Coming up</p>
    ${
      upcoming.length
        ? upcoming
            .map((e) => {
              const d = destById(e.placeId);
              const tag = e.source === "routine" ? "weekly" : "once";
              return `<div class="hist"><b>${escapeHtml(e.title)}</b><span>${formatDay(e.at)} · ${formatTime(e.at)} · ${escapeHtml(d?.label || "")} · ${tag}</span></div>`;
            })
            .join("")
        : `<p class="sub">Nothing upcoming. Add a routine.</p>`
    }

    <p class="section" style="margin-top:1.2rem">What you pack</p>
    <div id="item-editor">
      ${state.items
        .map(
          (it) => `
        <div class="hist">
          <b>${icon(it.icon || "item")} ${escapeHtml(it.label)}</b>
          <span>${it.weather ? `when ${it.weather}` : (it.days || []).join(", ") || "—"}</span>
          <button type="button" class="btn btn-ghost" data-toggle="${it.id}" style="margin-top:0.4rem;padding:0.45rem 0.7rem;font-size:0.72rem;border-radius:999px">
            ${it.enabled === false ? "Enable" : "Disable"}
          </button>
        </div>`
        )
        .join("")}
    </div>
    <div class="field" style="margin-top:1rem">
      <label for="new-item">Add item</label>
      <input id="new-item" placeholder="Lunch box, badge…" />
    </div>
    <button type="button" class="btn btn-primary btn-block" id="btn-add-item">Add to pack</button>
    <button type="button" class="btn btn-ghost btn-block" id="btn-reset-checks" style="margin-top:0.55rem">Clear checks</button>
  `;

  $("#set-name").onchange = (e) => {
    state = { ...state, name: e.target.value.trim() || "Friend" };
    persist();
  };
  $("#set-buffer").onchange = (e) => {
    const n = Math.max(3, Math.min(45, Number(e.target.value) || 8));
    state = { ...state, prefs: { ...state.prefs, leaveBufferMin: n } };
    persist();
  };
  $("#routine-list").onclick = (e) => {
    const id = e.target.closest("[data-toggle-routine]")?.dataset.toggleRoutine;
    if (!id) return;
    const r = (state.routines || []).find((x) => x.id === id);
    if (!r) return;
    state = upsertRoutine(state, { ...r, enabled: r.enabled === false });
    persist();
    tap();
    renderSettings();
  };
  $("#btn-add-routine").onclick = () => {
    const title = $("#rt-title").value.trim() || "Routine";
    const hour = Math.max(0, Math.min(23, Number($("#rt-hour").value) || 9));
    const minute = Math.max(0, Math.min(59, Number($("#rt-min").value) || 0));
    const placeId = $("#rt-place").value;
    const selected = [...$("#rt-days").selectedOptions].map((o) => o.value);
    const days = selected.length ? selected : ["mon", "tue", "wed", "thu", "fri"];
    state = upsertRoutine(state, {
      id: uid(),
      title,
      hour,
      minute,
      placeId,
      days,
      enabled: true,
    });
    persist();
    checkOn();
    toast("Weekly routine saved");
    renderSettings();
  };
  $("#btn-add-event").onclick = () => {
    const title = $("#ev-title").value.trim() || "Event";
    const mins = Math.max(15, Number($("#ev-time").value) || 90);
    const placeId = $("#ev-place").value;
    state = upsertEvent(state, {
      id: uid(),
      title,
      at: Date.now() + mins * 60e3,
      placeId,
    });
    persist();
    checkOn();
    toast("One-time event added");
    renderSettings();
  };
  $("#item-editor").onclick = (e) => {
    const id = e.target.closest("[data-toggle]")?.dataset.toggle;
    if (!id) return;
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    state = upsertItem(state, { ...it, enabled: it.enabled === false });
    persist();
    tap();
    renderSettings();
  };
  $("#btn-add-item").onclick = () => {
    const label = $("#new-item").value.trim();
    if (!label) return;
    state = upsertItem(state, {
      id: uid(),
      label,
      days: WEEKDAYS.slice(),
      icon: "item",
      enabled: true,
    });
    persist();
    checkOn();
    toast("Added to pack");
    renderSettings();
  };
  $("#btn-reset-checks").onclick = () => {
    state = resetChecks(state);
    persist();
    tap();
    toast("Checks cleared");
  };
}

function renderHistory() {
  const body = $("#history-body");
  const rows = state.departures || [];
  const forgot = topForgot(state, 3);
  let html = "";
  if (forgot.length) {
    html += `<p class="section">Often missed</p>`;
    html += forgot
      .map(
        (f) =>
          `<div class="hist"><b>${f.item ? icon(f.item.icon || "item") : ""} ${escapeHtml(f.item?.label || f.id)}</b><span>${f.count} times</span></div>`
      )
      .join("");
  }
  html += `<p class="section">Sealed departures</p>`;
  if (!rows.length) {
    html += `<p class="sub">No sealed departures yet.</p>`;
  } else {
    html += rows
      .map((h) => {
        const d = destById(h.destinationId);
        return `<div class="hist">
          <b>${escapeHtml(d?.label || "Out")}</b>
          <span>${formatDay(h.at)} · ${formatTime(h.at)} · ${escapeHtml(h.weatherSummary || "")}</span>
          <span>${(h.checkedIds || []).length} checked · ${escapeHtml(h.mode || "")}</span>
        </div>`;
      })
      .join("");
  }
  body.innerHTML = html;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leavingStatusText() {
  const { there, dest } = wxPair();
  const { ev, leave, travel } = leaveInfo();
  return `Leaving for ${dest.label}${ev ? ` (${ev.title})` : ""} · leave by ${formatTime(leave)} · ${travel} min ${TRAVEL_MODES[state.travelMode]?.label} · ${there.temp}° ${there.label}`;
}

async function copyLeaving() {
  const text = leavingStatusText();
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied status");
  } catch {
    toast(text);
  }
}

function sealDeparture() {
  const { there, dest } = wxPair();
  const { ev } = leaveInfo();
  const { home } = wxPair();
  const due = itemsForToday(state, home, there, state.activePreset);
  const checkedIds = due.filter((i) => state.checked[i.id]).map((i) => i.id);
  const missedIds = due.filter((i) => !state.checked[i.id]).map((i) => i.id);
  state = recordDeparture(state, {
    destinationId: dest.id,
    eventId: ev?.id,
    checkedIds,
    missedIds,
    mode: TRAVEL_MODES[state.travelMode]?.label,
    weatherSummary: `${there.temp}° ${there.label} @ ${dest.label}`,
  });
  sealed = true;
  persist();
  doorOpen();
  renderSeal();
  toast("Departure sealed");
}

function expose() {
  const api = {
    state: () => structuredClone(state),
    screen: () => screen,
    go: (name) => showScreen(name),
    begin: () => {
      sealed = false;
      showScreen("home");
    },
    selectDest: (id) => {
      ritualDestId = id;
      state = { ...state, selectedDestId: id };
      persist();
      if (screen === "dest") renderDest();
    },
    setMode: (id) => {
      state = { ...state, travelMode: id };
      persist();
      if (screen === "dest") renderDest();
      if (screen === "home") renderHome();
    },
    checkAll: () => {
      const { home, there } = wxPair();
      const items = itemsForToday(state, home, there, state.activePreset);
      const checked = { ...state.checked };
      for (const it of items) checked[it.id] = true;
      state = { ...state, checked };
      persist();
      if (screen === "check") renderCheck();
    },
    seal: () => {
      showScreen("seal");
      sealDeparture();
    },
    reset: () => {
      localStorage.removeItem("outset.v1");
      localStorage.removeItem("threshold.v1");
      state = load();
      sealed = false;
      ritualDestId = state.selectedDestId;
      persist();
      showScreen("wake");
    },
    landDemo: () => {
      sealed = false;
      showScreen("dest");
      api.checkAll();
      showScreen("check");
      api.checkAll();
      showScreen("seal");
      sealDeparture();
    },
  };
  window.__OUTSET = api;
  window.__THRESHOLD = api; // back-compat
}

/* events */
$("#btn-begin").onclick = () => {
  unlockAudio();
  tap();
  sealed = false;
  showScreen("home");
};
$("#btn-skip").onclick = () => {
  unlockAudio();
  tap();
  sealed = false;
  showScreen("dest");
};
$("#btn-start-ritual").onclick = () => {
  tap();
  sealed = false;
  showScreen("dest");
};
$("#btn-leave-now").onclick = () => {
  tap();
  sealed = false;
  state = {
    ...state,
    activeEventId: null,
    selectedDestId: state.selectedDestId || "errand",
  };
  // ephemeral quick leave — pin a synthetic "now" event via one-off
  const id = uid();
  state = upsertEvent(state, {
    id,
    title: "Quick leave",
    at: Date.now() + 25 * 60e3,
    placeId: state.selectedDestId || "errand",
  });
  state = { ...state, activeEventId: id };
  persist();
  showScreen("dest");
  toast("Quick leave ready");
};
$("#btn-to-pack").onclick = () => {
  tap();
  showScreen("check");
};
$("#btn-to-seal").onclick = () => {
  if ($("#btn-to-seal").disabled) return;
  tap();
  sealed = false;
  showScreen("seal");
};
$("#btn-seal-open").onclick = () => sealDeparture();
$("#btn-again").onclick = () => {
  tap();
  sealed = false;
  state = resetChecks(state);
  persist();
  showScreen("wake");
};
$("#btn-copy-leaving").onclick = () => copyLeaving();
$("#btn-share").onclick = () => {
  tap();
  copyLeaving();
};
$("#btn-settings").onclick = () => {
  tap();
  showScreen("settings");
};
$("#btn-hist").onclick = () => {
  tap();
  showScreen("history");
};
$("#btn-check-all").onclick = () => {
  window.__OUTSET.checkAll();
  checkOn();
  toast("All due items checked");
};

$("#today-plan")?.addEventListener("click", (e) => {
  const row = e.target.closest("[data-event]");
  if (!row) return;
  state = {
    ...state,
    activeEventId: row.dataset.event,
    selectedDestId: row.dataset.place || state.selectedDestId,
  };
  ritualDestId = state.selectedDestId;
  persist();
  tap();
  renderHome();
  toast("Selected for leaving");
});

$("#mode-row")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  state = { ...state, travelMode: btn.dataset.mode };
  persist();
  tap();
  renderDest();
});

$("#preset-row")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-preset]");
  if (!btn) return;
  state = { ...state, activePreset: btn.dataset.preset };
  persist();
  tap();
  renderCheck();
});

$("#dest-grid")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-dest]");
  if (!btn) return;
  ritualDestId = btn.dataset.dest;
  state = { ...state, selectedDestId: ritualDestId };
  const ev = nextEvent(state);
  if (ev) {
    state = {
      ...state,
      events: state.events.map((x) => (x.id === ev.id ? { ...x, placeId: ritualDestId } : x)),
    };
  }
  persist();
  tap();
  renderDest();
});

$("#check-list")?.addEventListener("click", (e) => {
  const row = e.target.closest("[data-id]");
  if (!row) return;
  const was = !!state.checked[row.dataset.id];
  state = toggleChecked(state, row.dataset.id);
  persist();
  if (!was) {
    checkOn();
    row.classList.add("pop");
  } else tap();
  renderCheck();
});

document.querySelector(".phone").addEventListener("click", (e) => {
  const back = e.target.closest("[data-back]");
  if (!back) return;
  tap();
  showScreen(back.dataset.back);
});

tickClock();
setInterval(tickClock, 1000);
wireChromeIcons();
atmos.setWeather(weatherFor("home").condition);
persist();
showScreen(state.onboarded ? "home" : "wake");
