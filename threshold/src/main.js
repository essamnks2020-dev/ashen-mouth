import { createAtmos } from "./atmos.js";
import { tap, checkOn, doorOpen, unlockAudio } from "./audio.js";
import {
  load,
  save,
  weekdayLabel,
  itemsForToday,
  nextEvent,
  leaveBy,
  formatTime,
  formatDay,
  minutesUntil,
  toggleChecked,
  resetChecks,
  recordDeparture,
  upsertItem,
  uid,
} from "./lib/store.js";
import { weatherFor, compareWeather, wxGlyph } from "./lib/weather.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let state = load();
let screen = "wake";
let sealed = false;
let ritualDestId = state.selectedDestId;

const atmos = createAtmos($("#atmos"));
const toastEl = $("#toast");
let toastTimer = 0;

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

function showScreen(name) {
  screen = name;
  $$(".screen").forEach((el) => el.classList.toggle("active", el.dataset.screen === name));
  $("#status-step").textContent = STEP_LABEL[name] || name;

  if (name === "wake" || name === "home") atmos.setMode("inside");
  else if (name === "seal" && sealed) atmos.setMode("open");
  else atmos.setMode("ritual");

  const { there } = wxPair();
  atmos.setWeather(there.condition);

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
}

function renderHome() {
  const { home, there, dest } = wxPair();
  const ev = nextEvent(state);
  const leave = leaveBy(ev, dest, state.prefs);
  const mins = leave != null ? minutesUntil(leave) : null;

  $("#greeting").textContent = `Good ${period()}, ${state.name}.`;
  $("#home-when").textContent = `${weekdayLabel()} · ${formatTime(Date.now())}`;

  $("#home-temp").textContent = `${home.temp}°`;
  $("#home-cond").textContent = `${home.label} · feel ${home.feels}° · wind ${home.wind}`;
  $("#home-wx-icon").textContent = wxGlyph(home.condition);

  const card = $("#next-card");
  if (ev) {
    card.hidden = false;
    $("#next-title").textContent = ev.title;
    $("#next-meta").textContent = `${formatTime(ev.at)} · ${dest.label} · ${dest.travelMin} min travel`;
    let leaveTxt = `Leave by ${formatTime(leave)}`;
    if (mins != null) {
      if (mins > 0) leaveTxt += ` · in ${mins} min`;
      else if (mins > -12) leaveTxt += " · leave now";
      else leaveTxt += " · running late";
    }
    $("#next-leave").textContent = leaveTxt;
    card.classList.toggle("late", mins != null && mins < 8);
  } else {
    card.hidden = true;
  }

  const headline = $("#leave-headline");
  if (mins != null && mins < 0) headline.textContent = "You're late — still go clean.";
  else if (mins != null && mins < 15) headline.textContent = "Door time is close.";
  else if (ev) headline.textContent = `Toward ${dest.label}.`;
  else headline.textContent = "Whenever you're ready.";

  atmos.setWeather(home.condition);
}

function renderDest() {
  const { home, there, dest } = wxPair();
  const ev = nextEvent(state);
  const leave = leaveBy(ev, dest, state.prefs);
  const mins = leave != null ? minutesUntil(leave) : null;

  const grid = $("#dest-grid");
  grid.innerHTML = state.destinations
    .map(
      (d) => `
    <button type="button" class="dest ${d.id === dest.id ? "on" : ""}" data-dest="${d.id}">
      <b>${escapeHtml(d.label)}</b>
      <span>${d.travelMin} min</span>
    </button>`
    )
    .join("");

  $("#split-home-temp").textContent = `${home.temp}°`;
  $("#split-home-cond").textContent = home.label;
  $("#split-home-icon").textContent = wxGlyph(home.condition);
  $("#split-dest-where").textContent = dest.label;
  $("#split-dest-temp").textContent = `${there.temp}°`;
  $("#split-dest-cond").textContent = there.label;
  $("#split-dest-icon").textContent = wxGlyph(there.condition);
  $("#wx-compare").innerHTML = compareWeather(home, there)
    .map((l) => escapeHtml(l))
    .join("<br/>");

  $("#dest-leave-time").textContent = leave != null ? formatTime(leave) : "—";
  let meta = ev ? `${ev.title} at ${formatTime(ev.at)}` : "No upcoming event — buffer only";
  if (mins != null) {
    meta +=
      mins > 0 ? ` · leave in ${mins}m` : mins > -12 ? " · leave now" : " · late";
  }
  $("#dest-leave-meta").textContent = meta;
  $("#dest-leave-card").classList.toggle("late", mins != null && mins < 8);

  atmos.setWeather(there.condition);
}

function renderCheck() {
  const { home, there, dest } = wxPair();
  const items = itemsForToday(state, home, there);
  const done = items.filter((it) => state.checked[it.id]).length;
  const total = items.length;

  $("#check-day").textContent = `${weekdayLabel()} · toward ${dest.label}`;
  $("#check-count").textContent = `${done}/${total}`;

  const list = $("#check-list");
  if (!items.length) {
    list.innerHTML = `<p class="sub" style="margin:1rem 0">Nothing due today. You're light.</p>`;
  } else {
    list.innerHTML = items
      .map((it) => {
        const on = !!state.checked[it.id];
        return `
        <button type="button" class="check ${on ? "done" : ""}" data-id="${it.id}">
          <span class="box" aria-hidden="true">${on ? "✓" : ""}</span>
          <span class="ico" aria-hidden="true">${it.icon || ""}</span>
          <span class="label">${escapeHtml(it.label)}</span>
        </button>`;
      })
      .join("");
  }

  const btn = $("#btn-to-seal");
  btn.disabled = total > 0 && done < total;
  btn.textContent = total === 0 || done >= total ? "Open the door" : `Check ${total - done} more`;

  atmos.setWeather(there.condition);
}

function renderSeal() {
  const { there, dest } = wxPair();
  const ev = nextEvent(state);
  const openBtn = $("#btn-seal-open");
  const againBtn = $("#btn-again");
  const door = $("#seal-door");

  if (sealed) {
    openBtn.hidden = true;
    againBtn.hidden = false;
    $("#seal-title").textContent = "You're set.";
    $("#seal-sub").textContent = `Sealed · ${formatTime(Date.now())}\nToward ${dest.label} · ${there.temp}° ${there.label}${
      ev ? ` · ${ev.title}` : ""
    }`.replace("\n", " · ");
    door.classList.add("open");
    atmos.setMode("open");
  } else {
    openBtn.hidden = false;
    againBtn.hidden = true;
    $("#seal-title").textContent = "Threshold.";
    $("#seal-sub").textContent = "Everything checked. Open the door when you're ready.";
    door.classList.remove("open");
    atmos.setMode("ritual");
  }
  atmos.setWeather(there.condition);
}

function renderSettings() {
  const body = $("#settings-body");
  body.innerHTML = `
    <div class="field">
      <label for="set-name">Your name</label>
      <input id="set-name" value="${escapeHtml(state.name)}" autocomplete="nickname" />
    </div>
    <div class="field">
      <label for="set-home">Home label</label>
      <input id="set-home" value="${escapeHtml(state.homeLabel)}" />
    </div>
    <div class="field">
      <label for="set-buffer">Leave buffer (minutes early)</label>
      <input id="set-buffer" type="number" min="3" max="45" value="${state.prefs.leaveBufferMin}" />
    </div>
    <p class="section">Checklist</p>
    <div id="item-editor">
      ${state.items
        .map(
          (it) => `
        <div class="hist">
          <b>${escapeHtml(it.icon || "")} ${escapeHtml(it.label)}</b>
          <span>${it.weather ? `when ${it.weather}` : (it.days || []).join(", ") || "—"}</span>
          <button type="button" class="btn btn-ghost" data-toggle="${it.id}" style="margin-top:0.45rem;padding:0.45rem 0.7rem;font-size:0.72rem">
            ${it.enabled === false ? "Enable" : "Disable"}
          </button>
        </div>`
        )
        .join("")}
    </div>
    <div class="field" style="margin-top:1rem">
      <label for="new-item">Add item</label>
      <input id="new-item" placeholder="Lunch box, badge, …" />
    </div>
    <button type="button" class="btn btn-primary btn-block" id="btn-add-item">Add to ritual</button>
    <button type="button" class="btn btn-ghost btn-block" id="btn-reset-checks" style="margin-top:0.55rem">Reset today's checks</button>
  `;

  $("#set-name").onchange = (e) => {
    state = { ...state, name: e.target.value.trim() || "Friend" };
    persist();
  };
  $("#set-home").onchange = (e) => {
    state = { ...state, homeLabel: e.target.value.trim() || "Home" };
    persist();
  };
  $("#set-buffer").onchange = (e) => {
    const n = Math.max(3, Math.min(45, Number(e.target.value) || 8));
    state = { ...state, prefs: { ...state.prefs, leaveBufferMin: n } };
    persist();
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
      days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      icon: "•",
      enabled: true,
    });
    persist();
    checkOn();
    toast("Added to ritual");
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
  if (!rows.length) {
    body.innerHTML = `<p class="sub">No sealed departures yet. Complete a ritual and open the door.</p>`;
    return;
  }
  body.innerHTML = rows
    .map((h) => {
      const d = destById(h.destinationId);
      return `<div class="hist">
        <b>${escapeHtml(d?.label || "Out")}</b>
        <span>${formatDay(h.at)} · ${formatTime(h.at)} · ${escapeHtml(h.weatherSummary || "")}</span>
        <span>${(h.checkedIds || []).length} checked</span>
      </div>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sealDeparture() {
  const { there, dest } = wxPair();
  const ev = nextEvent(state);
  const checkedIds = Object.keys(state.checked).filter((k) => state.checked[k]);
  state = recordDeparture(state, {
    destinationId: dest.id,
    eventId: ev?.id,
    checkedIds,
    weatherSummary: `${there.temp}° ${there.label} @ ${dest.label}`,
  });
  sealed = true;
  persist();
  doorOpen();
  renderSeal();
  toast("Departure sealed");
}

function expose() {
  window.__THRESHOLD = {
    state: () => structuredClone(state),
    screen: () => screen,
    go: (name) => {
      showScreen(name);
    },
    begin: () => {
      sealed = false;
      showScreen("home");
    },
    selectDest: (id) => {
      ritualDestId = id;
      state = { ...state, selectedDestId: id };
      persist();
      renderDest();
    },
    checkAll: () => {
      const { home, there } = wxPair();
      const items = itemsForToday(state, home, there);
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
      localStorage.removeItem("threshold.v1");
      state = load();
      sealed = false;
      ritualDestId = state.selectedDestId;
      persist();
      showScreen("wake");
    },
    landDemo: () => {
      /* full happy-path for QA */
      sealed = false;
      showScreen("dest");
      window.__THRESHOLD.checkAll();
      showScreen("check");
      window.__THRESHOLD.checkAll();
      showScreen("seal");
      sealDeparture();
    },
  };
}

/* —— Events —— */
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
$("#btn-settings").onclick = () => {
  tap();
  showScreen("settings");
};
$("#btn-hist").onclick = () => {
  tap();
  showScreen("history");
};

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
atmos.setWeather(weatherFor("home").condition);
persist();
if (state.onboarded) {
  showScreen("home");
} else {
  showScreen("wake");
}
