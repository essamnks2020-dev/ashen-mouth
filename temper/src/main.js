import { analyze, replaceToken, quenchPulse, diffWords } from './heat.js';
import { createForge } from './forge.js';
import { unlockAudio, setHeatDrone, quenchHiss, metalTing, anvilTap, copyChime } from './audio.js';
import { isBreathSupported, startBreath, stopBreath } from './breath.js';
import {
  loadVault, addEntry, removeEntry, clearVault,
  loadSettings, saveSettings, patterns,
} from './vault.js';

const SAMPLES = [
  `You ALWAYS do this. I'm so sick of your pathetic excuses. You never listen and everyone knows you're a liar. Don't bother texting me back. We're DONE.`,
  `I hate how you made me feel at dinner. You clearly don't care about anyone but yourself. Honestly it's ridiculous. I'm done pretending this is okay.`,
  `This is insane. You dumped the entire project on me AGAIN and then took credit in the meeting. What the hell is wrong with you? I quit if this keeps happening.`,
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  screen: 'enter',
  text: '',
  originalText: '',
  analysis: analyze(''),
  heatBefore: 0,
  coolOffset: 0,
  quenching: false,
  quenchTimer: null,
  settings: loadSettings(),
  selectedToken: null,
  compare: false,
  wasReady: false,
  history: [],
};

const canvas = $('#forge-canvas');
const forge = createForge(canvas);
forge.setReduceMotion(
  state.settings.reduceMotion ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches,
);

const els = {
  message: $('#message'),
  overlay: $('#token-overlay'),
  summary: $('#summary'),
  heatPill: $('#heat-pill'),
  meterFill: $('#meter-fill'),
  meterScore: $('#meter-score'),
  threshold: $('#threshold-label'),
  btnQuench: $('#btn-quench'),
  btnCopy: $('#btn-copy'),
  btnSave: $('#btn-save'),
  btnClear: $('#btn-clear'),
  cooler: $('#cooler-pop'),
  toast: $('#toast'),
  vaultRoot: $('#vault-root'),
  patternsRoot: $('#patterns-root'),
  breathRow: $('#breath-row'),
  breathFill: $('#breath-fill'),
  btnBreath: $('#btn-breath'),
  tips: $('#tips-list'),
  comparePanel: $('#compare-view'),
  deltaPill: $('#delta-pill'),
  btnCompare: $('#btn-compare'),
  btnUndo: $('#btn-undo'),
  btnTemperHard: $('#btn-temper-hard'),
};

els.threshold.textContent = String(state.settings.threshold);

if (isBreathSupported()) {
  els.breathRow.hidden = false;
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function nav(screen) {
  state.screen = screen;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === screen));
  $$('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === screen));
  if (screen === 'vault') renderVault();
  if (screen === 'patterns') renderPatterns();
  if (screen === 'forge') {
    requestAnimationFrame(() => els.message.focus());
  }
  // hash for shareable deep links
  history.replaceState(null, '', `#${screen}`);
}

function syncOverlayScroll() {
  els.overlay.scrollTop = els.message.scrollTop;
  els.overlay.scrollLeft = els.message.scrollLeft;
}

function effectiveScore(raw = state.analysis.score) {
  return Math.max(0, Math.round(raw - state.coolOffset));
}

function bandFor(score) {
  if (score >= 75) return 'molten';
  if (score >= 50) return 'hot';
  if (score >= 28) return 'warm';
  if (score >= 12) return 'tepid';
  return 'cool';
}

function summaryFor(score) {
  const band = bandFor(score);
  switch (band) {
    case 'molten': return `Molten · ${score} — this will leave a mark.`;
    case 'hot': return `Hot · ${score} — cool before it leaves your hands.`;
    case 'warm': return `Warm · ${score} — edge left. A little quench helps.`;
    case 'tepid': return `Tepid · ${score} — almost ready.`;
    default: return `Tempered · ${score} — meaning kept. Scorch gone.`;
  }
}

function renderAnalysis() {
  const a = state.analysis;
  const score = effectiveScore(a.score);
  const band = bandFor(score);
  forge.setHeat(score);
  setHeatDrone(score);

  const summary = summaryFor(score);
  els.heatPill.textContent = summary.split('—')[0].trim();
  els.heatPill.className = `heat-pill ${band}`;
  els.meterFill.style.width = `${score}%`;
  els.meterScore.textContent = String(score);
  els.summary.textContent = state.text.trim() ? summary : 'The anvil is cold. Put words on it.';

  const parts = a.tokens.map((t) => {
    if (/^\s+$/.test(t.text)) return t.text;
    if (t.hot) {
      return `<span class="tok hot" data-i="${t.i}" title="Tap to anneal">${escapeHtml(t.text)}</span>`;
    }
    return escapeHtml(t.text);
  });
  els.overlay.innerHTML = parts.join('') || '';

  const thr = state.settings.threshold;
  const ready = score <= thr && state.text.trim().length > 0;
  const hasText = state.text.trim().length > 0;
  els.btnQuench.disabled = !hasText || score <= 0;
  els.btnCopy.disabled = !ready;
  els.btnSave.disabled = !hasText;
  if (els.btnTemperHard) els.btnTemperHard.disabled = !hasText || score <= 0;
  if (els.btnUndo) els.btnUndo.disabled = state.history.length === 0;

  // Ready celebration (once)
  document.body.classList.toggle('plate-ready', ready);
  if (ready && !state.wasReady) {
    state.wasReady = true;
    metalTing();
  }
  if (!ready) state.wasReady = false;

  // Delta from original heat
  if (els.deltaPill) {
    if (hasText && state.heatBefore > 0) {
      const pulled = Math.max(0, state.heatBefore - score);
      els.deltaPill.hidden = false;
      els.deltaPill.textContent = pulled > 0
        ? `${state.heatBefore}→${score} · −${pulled} scorch`
        : `heat ${score}`;
    } else {
      els.deltaPill.hidden = true;
    }
  }

  if (els.btnCompare) {
    els.btnCompare.disabled = !state.originalText || state.originalText === state.text;
  }
  renderCompare();

  const tips = [];
  if (a.hotCount) tips.push(`<li>${a.hotCount} hot word${a.hotCount === 1 ? '' : 's'} on the plate. Tap a glow to anneal.</li>`);
  if (a.youCount > a.iCount && a.youCount >= 3) {
    tips.push(`<li>“You” appears ${a.youCount}× vs “I” ${a.iCount}× — accusatory skew feeds the fire.</li>`);
  }
  if (a.phraseHits.length) {
    tips.push(`<li>Phrase bomb: <code>${escapeHtml(a.phraseHits[0].phrase)}</code> — forge-grade heat.</li>`);
  }
  if (band === 'molten') tips.push('<li>Molten. Quench hard before this leaves your hands.</li>');
  if (ready) tips.push('<li>Plate is tempered. Copy when the words still sound like you.</li>');
  if (!tips.length) {
    tips.push('<li>Tap a <code>glowing</code> word to anneal it.</li>');
    tips.push('<li>Hold <code>quench</code> (or Space) to dunk the plate.</li>');
    tips.push('<li>Copy unlocks under the heat threshold. Friction is the feature.</li>');
  }
  els.tips.innerHTML = tips.join('');
}

function renderCompare() {
  if (!els.compareView) return;
  if (!state.compare || !state.originalText) {
    els.compareView.hidden = true;
    return;
  }
  els.compareView.hidden = false;
  const diff = diffWords(state.originalText, state.text);
  const afterHtml = diff.map((d) => (
    d.changed
      ? `<mark class="diff-new">${escapeHtml(d.text)}</mark>`
      : escapeHtml(d.text)
  )).join('');
  els.compareView.innerHTML = `
    <div class="compare-col">
      <h4>Molten in</h4>
      <pre>${escapeHtml(state.originalText)}</pre>
    </div>
    <div class="compare-col">
      <h4>Tempered out</h4>
      <pre>${afterHtml}</pre>
    </div>
  `;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pushHistory() {
  if (!state.text) return;
  state.history.push({
    text: state.text,
    coolOffset: state.coolOffset,
    heatBefore: state.heatBefore,
  });
  if (state.history.length > 40) state.history.shift();
}

function setText(text, { trackBefore = false, resetCool = false, setOriginal = false, record = false } = {}) {
  if (record && text !== state.text) pushHistory();
  state.text = text;
  els.message.value = text;
  const a = analyze(text);
  state.analysis = a;
  if (resetCool) state.coolOffset = 0;
  if (setOriginal || (!state.originalText && text.trim())) {
    state.originalText = text;
  }
  if (trackBefore || state.heatBefore === 0) state.heatBefore = Math.max(state.heatBefore, a.score);
  if (text.trim() && a.score > state.heatBefore) state.heatBefore = a.score;
  if (state.coolOffset > a.score) state.coolOffset = a.score;
  renderAnalysis();
  syncOverlayScroll();
}

function quenchStep() {
  const pulse = quenchPulse(state.text);
  if (pulse.changed) setText(pulse.text, { record: true });
  state.coolOffset = Math.min(100, state.coolOffset + 6);
  renderAnalysis();
  forge.burstSteam(10);
  quenchHiss(0.7 + Math.random() * 0.4);
}

function startQuench(e) {
  if (els.btnQuench.disabled) return;
  if (e && e.cancelable) e.preventDefault();
  unlockAudio();
  state.quenching = true;
  forge.setQuenching(true);
  els.btnQuench.classList.add('holding');
  els.btnQuench.textContent = 'Quenching…';
  quenchStep();
  clearInterval(state.quenchTimer);
  state.quenchTimer = setInterval(quenchStep, 380);
}

function endQuench() {
  if (!state.quenching && !state.quenchTimer) return;
  state.quenching = false;
  forge.setQuenching(false);
  els.btnQuench.classList.remove('holding');
  els.btnQuench.textContent = 'Hold to quench';
  clearInterval(state.quenchTimer);
  state.quenchTimer = null;
  metalTing();
}

/** Single click / Space pulse — one quench beat (automation-friendly) */
function pulseQuench() {
  if (els.btnQuench.disabled) return;
  unlockAudio();
  forge.setQuenching(true);
  quenchStep();
  forge.setQuenching(false);
  metalTing();
}

function openCooler(tokenIndex, clientX, clientY) {
  const tok = state.analysis.tokens[tokenIndex];
  if (!tok || !tok.hot) return;
  anvilTap();
  state.selectedToken = tokenIndex;
  const coolers = tok.coolers || ['soften this', 'rephrase', 'delete'];
  els.cooler.innerHTML = `
    <div class="cap">Anneal “${escapeHtml(tok.text.trim())}”</div>
    ${coolers.map((c) => `<button type="button" data-rep="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
    <button type="button" data-rep="__delete">strike from plate</button>
  `;
  els.cooler.classList.add('open');
  const pad = 12;
  const rect = els.cooler.getBoundingClientRect();
  let x = clientX;
  let y = clientY + 12;
  if (x + 200 > window.innerWidth) x = window.innerWidth - 220;
  if (y + 180 > window.innerHeight) y = clientY - 160;
  els.cooler.style.left = `${Math.max(pad, x)}px`;
  els.cooler.style.top = `${Math.max(pad, y)}px`;
}

function closeCooler() {
  els.cooler.classList.remove('open');
  state.selectedToken = null;
}

function renderVault() {
  const entries = loadVault();
  if (!entries.length) {
    els.vaultRoot.innerHTML = `
      <div class="empty-vault">
        <h2>Empty vault</h2>
        <p>Sealed messages appear here as cooled plaques. Nothing leaves this device.</p>
        <button type="button" class="btn btn-primary" data-nav="forge" style="margin-top:1rem">Forge one</button>
      </div>`;
    return;
  }
  els.vaultRoot.innerHTML = `
    <div style="max-width:1100px;margin:0 auto 1rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <h2 style="margin:0;font-family:var(--font-brand);letter-spacing:0.08em;text-transform:uppercase;font-size:1rem;color:var(--ash)">${entries.length} plaque${entries.length === 1 ? '' : 's'}</h2>
      <button type="button" class="btn btn-ghost" id="btn-clear-vault" style="padding:0.45rem 0.9rem;font-size:0.8rem">Clear vault</button>
    </div>
    <div class="vault-grid">
      ${entries.map((e) => `
        <article class="plaque" data-id="${e.id}">
          <time datetime="${new Date(e.createdAt).toISOString()}">${formatWhen(e.createdAt)}</time>
          <span class="delta">${e.heatBefore}→${e.heatAfter}</span>
          <p class="body">${escapeHtml(e.textAfter || e.textBefore || '')}</p>
          <div class="actions">
            <button type="button" data-act="load">Reheat</button>
            <button type="button" data-act="copy">Copy</button>
            <button type="button" data-act="delete">Discard</button>
          </div>
        </article>
      `).join('')}
    </div>`;
}

function renderPatterns() {
  const p = patterns(loadVault());
  const stats = p.stats
    ? `<div class="stat-row">
        <div class="stat"><b>${p.stats.count}</b><span>Tempered</span></div>
        <div class="stat"><b>${p.stats.avgBefore}</b><span>Avg heat in</span></div>
        <div class="stat"><b>${p.stats.avgAfter}</b><span>Avg heat out</span></div>
        <div class="stat"><b>${p.stats.saved}</b><span>Scorch pulled</span></div>
      </div>`
    : '';
  els.patternsRoot.innerHTML = `
    <p class="micro">Smith’s notes</p>
    <h1>${escapeHtml(p.headline)}</h1>
    ${stats}
    ${p.notes.map((n) => `<p>${escapeHtml(n)}</p>`).join('')}
    <p style="margin-top:2rem"><button type="button" class="btn btn-primary" data-nav="forge">Back to the forge</button></p>
  `;
}

function formatWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// —— Events ——
$$('[data-nav]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    unlockAudio();
    nav(el.dataset.nav);
  });
});

$$('[data-sample]').forEach((el) => {
  el.addEventListener('click', () => {
    unlockAudio();
    const i = Number(el.dataset.sample);
    state.heatBefore = 0;
    state.coolOffset = 0;
    state.originalText = '';
    state.compare = false;
    setText(SAMPLES[i], { trackBefore: true, resetCool: true, setOriginal: true });
    nav('forge');
    toast('Molten sample on the anvil');
  });
});

els.message.addEventListener('input', () => {
  unlockAudio();
  // Fresh edits re-heat the plate a little (you’re rewriting under emotion)
  state.coolOffset = Math.max(0, state.coolOffset - 4);
  setText(els.message.value);
});

els.message.addEventListener('scroll', syncOverlayScroll);

els.overlay.addEventListener('click', (e) => {
  const tok = e.target.closest('.tok.hot');
  if (!tok) return;
  openCooler(Number(tok.dataset.i), e.clientX, e.clientY);
});

els.cooler.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-rep]');
  if (!btn || state.selectedToken == null) return;
  const rep = btn.dataset.rep;
  let next;
  if (rep === '__delete') {
    const tokens = state.text.split(/(\s+)/);
    // use heat tokenize indices — replace with empty then tidy
    next = replaceToken(state.text, state.selectedToken, '');
    next = next.replace(/  +/g, ' ').replace(/ ([,.!?])/g, '$1').trim();
  } else {
    next = replaceToken(state.text, state.selectedToken, rep);
  }
  setText(next, { record: true });
  metalTing();
  closeCooler();
});

document.addEventListener('click', (e) => {
  if (!els.cooler.classList.contains('open')) return;
  if (els.cooler.contains(e.target)) return;
  if (e.target.closest('.tok.hot')) return;
  closeCooler();
});

const qEl = els.btnQuench;
qEl.addEventListener('pointerdown', (e) => {
  if (e.button != null && e.button !== 0) return;
  qEl.setPointerCapture?.(e.pointerId);
  startQuench(e);
});
qEl.addEventListener('pointerup', endQuench);
qEl.addEventListener('pointercancel', endQuench);
qEl.addEventListener('lostpointercapture', endQuench);
window.addEventListener('blur', endQuench);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && state.screen === 'forge' && !e.repeat) {
    if (document.activeElement === els.message) return;
    e.preventDefault();
    startQuench(e);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') endQuench();
});

els.btnCopy.addEventListener('click', async () => {
  if (els.btnCopy.disabled) return;
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(state.text);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    const ta = els.message;
    ta.focus();
    ta.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    // collapse selection
    window.getSelection()?.removeAllRanges();
  }
  if (ok) {
    copyChime();
    toast('Tempered text copied');
  } else {
    toast('Select the text and copy manually');
  }
});

els.btnSave.addEventListener('click', () => {
  if (els.btnSave.disabled) return;
  const a = state.analysis;
  const after = effectiveScore(a.score);
  addEntry({
    textBefore: state.originalText || state.text,
    textAfter: state.text,
    heatBefore: state.heatBefore || a.score,
    heatAfter: after,
    youCount: a.youCount,
    iCount: a.iCount,
    band: bandFor(after),
  });
  metalTing();
  toast('Sealed in the vault');
});

els.btnClear.addEventListener('click', () => {
  state.heatBefore = 0;
  state.coolOffset = 0;
  state.originalText = '';
  state.compare = false;
  setText('', { resetCool: true });
  closeCooler();
});

if (els.btnCompare) {
  els.btnCompare.addEventListener('click', () => {
    state.compare = !state.compare;
    els.btnCompare.classList.toggle('active', state.compare);
    renderCompare();
  });
}

if (els.btnUndo) {
  els.btnUndo.addEventListener('click', () => {
    const prev = state.history.pop();
    if (!prev) return;
    state.coolOffset = prev.coolOffset;
    state.heatBefore = prev.heatBefore;
    setText(prev.text);
    toast('Undone');
  });
}

if (els.btnTemperHard) {
  els.btnTemperHard.addEventListener('click', async () => {
    if (els.btnTemperHard.disabled) return;
    unlockAudio();
    els.btnTemperHard.disabled = true;
    pushHistory();
    forge.setQuenching(true);
    for (let i = 0; i < 14; i++) {
      const pulse = quenchPulse(state.text);
      if (pulse.changed) setText(pulse.text);
      state.coolOffset = Math.min(100, state.coolOffset + 5);
      renderAnalysis();
      forge.burstSteam(8);
      quenchHiss(0.55 + Math.random() * 0.35);
      await new Promise((r) => setTimeout(r, 75));
      if (effectiveScore() <= state.settings.threshold) break;
    }
    forge.setQuenching(false);
    metalTing();
    toast(effectiveScore() <= state.settings.threshold ? 'Hard tempered' : 'Still warm — quench more');
    renderAnalysis();
  });
}

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && state.screen === 'forge') {
    if (document.activeElement === els.message && !e.shiftKey) return;
    e.preventDefault();
    els.btnUndo?.click();
  }
});

els.vaultRoot.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    nav(navBtn.dataset.nav);
    return;
  }
  if (e.target.id === 'btn-clear-vault') {
    clearVault();
    renderVault();
    toast('Vault cleared');
    return;
  }
  const plaque = e.target.closest('.plaque');
  const act = e.target.closest('[data-act]');
  if (!plaque || !act) return;
  const id = plaque.dataset.id;
  const entry = loadVault().find((x) => x.id === id);
  if (!entry) return;
  if (act.dataset.act === 'delete') {
    removeEntry(id);
    renderVault();
    return;
  }
  if (act.dataset.act === 'copy') {
    await navigator.clipboard.writeText(entry.textAfter || '');
    toast('Copied from vault');
    return;
  }
  if (act.dataset.act === 'load') {
    state.heatBefore = entry.heatBefore || 0;
    setText(entry.textAfter || entry.textBefore || '');
    nav('forge');
  }
});

els.patternsRoot.addEventListener('click', (e) => {
  const b = e.target.closest('[data-nav]');
  if (b) nav(b.dataset.nav);
});

els.btnBreath.addEventListener('click', async () => {
  unlockAudio();
  const ok = await startBreath((level) => {
    els.breathFill.style.width = `${Math.round(level * 100)}%`;
    if (level > 0.35 && state.text.trim() && effectiveScore() > 0) {
      if (!els.btnBreath._last || performance.now() - els.btnBreath._last > 500) {
        els.btnBreath._last = performance.now();
        const pulse = quenchPulse(state.text);
        if (pulse.changed) setText(pulse.text);
        state.coolOffset = Math.min(100, state.coolOffset + 3 + level * 4);
        renderAnalysis();
        if (level > 0.55) {
          forge.burstSteam(3);
          quenchHiss(0.35);
        }
      }
    }
  });
  if (ok) {
    els.btnBreath.textContent = 'Listening';
    state.settings.breath = true;
    saveSettings(state.settings);
    toast('Blow gently toward the mic to cool');
  } else {
    toast('Mic blocked — quench with the button instead');
  }
});

// Deep link + boot
const hash = (location.hash || '#enter').slice(1);
const valid = ['enter', 'forge', 'vault', 'patterns', 'case'];
nav(valid.includes(hash) ? hash : 'enter');
renderAnalysis();

// Expose a tiny QA hook
window.__TEMPER = {
  analyze,
  quenchPulse,
  setText: (t) => {
    state.coolOffset = 0;
    state.originalText = '';
    setText(t, { trackBefore: true, resetCool: true, setOriginal: true });
  },
  quench: (n = 3) => {
    for (let i = 0; i < n; i++) quenchStep();
    endQuench();
  },
  nav,
  state: () => ({
    screen: state.screen,
    score: effectiveScore(),
    raw: state.analysis.score,
    band: bandFor(effectiveScore()),
    chars: state.text.length,
    vault: loadVault().length,
    copyReady: !els.btnCopy.disabled,
    original: state.originalText.slice(0, 80),
    text: state.text.slice(0, 80),
  }),
};

console.info('TEMPER ready — cool it before you send it.');
