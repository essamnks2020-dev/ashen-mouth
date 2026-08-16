/**
 * Local-first vault of tempered messages + lightweight pattern notes.
 */

const KEY = 'temper.vault.v1';
const SETTINGS = 'temper.settings.v1';

export function loadVault() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveVault(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 200)));
}

export function addEntry(entry) {
  const list = loadVault();
  list.unshift({
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    ...entry,
  });
  saveVault(list);
  return list[0];
}

export function removeEntry(id) {
  saveVault(loadVault().filter((e) => e.id !== id));
}

export function clearVault() {
  saveVault([]);
}

export function loadSettings() {
  try {
    return {
      breath: false,
      threshold: 28,
      reduceMotion: false,
      ...JSON.parse(localStorage.getItem(SETTINGS) || '{}'),
    };
  } catch {
    return { breath: false, threshold: 28, reduceMotion: false };
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS, JSON.stringify(s));
}

/** Smith's notes — patterns from the vault, never wellness-guilt copy */
export function patterns(entries) {
  if (!entries.length) {
    return {
      headline: 'The vault is empty.',
      notes: ['Temper one message. Plaques will stack here like cooled steel.'],
      stats: null,
    };
  }

  const heats = entries.map((e) => e.heatBefore ?? 0);
  const afters = entries.map((e) => e.heatAfter ?? 0);
  const avgBefore = avg(heats);
  const avgAfter = avg(afters);
  const saved = Math.max(0, avgBefore - avgAfter);

  const hours = entries.map((e) => new Date(e.createdAt).getHours());
  const night = hours.filter((h) => h >= 22 || h < 5).length;
  const nightRatio = night / entries.length;

  const youHeavy = entries.filter((e) => (e.youCount || 0) > (e.iCount || 0)).length;

  const notes = [];
  notes.push(`Average heat in: ${Math.round(avgBefore)}. Average out: ${Math.round(avgAfter)}. You pulled ~${Math.round(saved)} points of scorch.`);
  if (nightRatio >= 0.4) {
    notes.push(`About ${Math.round(nightRatio * 100)}% of your tempers happen late (10pm–5am). Night metal runs hotter — the forge is earning its keep.`);
  } else if (nightRatio > 0) {
    notes.push(`A few late-night tempers (${night}). Not a pattern yet — watch the clock when the heat spikes.`);
  } else {
    notes.push('Most tempers happen in daylight. Your nights are quieter than most smiths’.');
  }
  if (youHeavy / entries.length >= 0.5) {
    notes.push(`More than half started “you”-heavy. Accusatory second person is the fastest path to molten. Shifting to “I” drops heat fast.`);
  }
  const molten = entries.filter((e) => (e.heatBefore || 0) >= 75).length;
  if (molten) {
    notes.push(`${molten} message${molten === 1 ? '' : 's'} arrived molten (≥75). Those are the ones that usually end friendships. You caught them.`);
  }

  let headline = 'Steady hands.';
  if (saved >= 25) headline = 'You’re tempering hard heat.';
  else if (avgBefore >= 60) headline = 'The forge is busy.';
  else if (entries.length >= 10) headline = 'A practiced smith.';

  return {
    headline,
    notes,
    stats: {
      count: entries.length,
      avgBefore: Math.round(avgBefore),
      avgAfter: Math.round(avgAfter),
      saved: Math.round(saved),
      nightRatio,
    },
  };
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
