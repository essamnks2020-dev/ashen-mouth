/**
 * Heat analysis — on-device lexicon + structure + phrase rewrites.
 * Quench prefers phrase-level coolers so sentences stay grammatical.
 */

const HOT = {
  stupid: 9, idiot: 10, dumb: 8, pathetic: 9, worthless: 10, trash: 8,
  hate: 8, disgusting: 9, ridiculous: 6, insane: 5, crazy: 4,
  shut: 7, stfu: 10, fuck: 9, fucking: 8, fucked: 8, shit: 7, bitch: 10,
  asshole: 10, bastard: 9, damn: 4, hell: 3, crap: 4,
  always: 7, never: 7, everyone: 5, nobody: 5, whatever: 4,
  blame: 6, fault: 5, accused: 5, lying: 8, liar: 9, lied: 8,
  gaslight: 8, narcissist: 8, toxic: 7, manipulat: 7,
  ultimatum: 8, divorce: 7, quit: 5, resign: 5,
  blocked: 6, blocking: 6, done: 4, leave: 4,
  sue: 8, lawyer: 6, police: 6,
  idc: 7, idgaf: 10, lol: 2, lmao: 3,
  obviously: 5, clearly: 5, honestly: 3, seriously: 4,
  impossible: 4, completely: 3, totally: 3, literally: 2,
};

/** Phrase bombs → full cooler sentences/fragments (grammar-safe) */
const PHRASE_REWRITES = [
  { re: /you always/gi, heat: 12, to: ['you often', 'this keeps happening when you'] },
  { re: /you never/gi, heat: 12, to: ['you rarely', 'I haven’t felt you'] },
  { re: /i hate you/gi, heat: 18, to: ['I’m really hurt by you', 'I’m struggling with us'] },
  { re: /fuck you/gi, heat: 16, to: ['I’m furious', 'this crossed a line'] },
  { re: /screw you/gi, heat: 12, to: ['I’m done engaging like this', 'that’s not okay'] },
  { re: /don't bother(?:\s+texting me back)?/gi, heat: 8, to: ['I need space for now', 'please give me time'] },
  { re: /dont bother(?:\s+texting me back)?/gi, heat: 8, to: ['I need space for now', 'please give me time'] },
  { re: /i'?m done/gi, heat: 8, to: ['I’m at my limit', 'I need a pause'] },
  { re: /we'?re done/gi, heat: 10, to: ['we need distance', 'I can’t continue like this'] },
  { re: /or else/gi, heat: 10, to: ['or we need to talk differently', 'and I need a change'] },
  { re: /how dare you/gi, heat: 11, to: ['I can’t believe', 'that really hurt when you'] },
  { re: /what'?s wrong with you/gi, heat: 11, to: ['what’s going on', 'help me understand'] },
  { re: /you make me sick/gi, heat: 14, to: ['this is really hard for me', 'I’m struggling with this'] },
  { re: /i don't care/gi, heat: 7, to: ['I’m stepping back', 'I need to protect my energy'] },
  { re: /i dont care/gi, heat: 7, to: ['I’m stepping back', 'I need to protect my energy'] },
  { re: /everyone knows (?:you're|you are) a liar/gi, heat: 16, to: ['this isn’t lining up with what I know', 'I’m finding it hard to trust this'] },
  { re: /you're a liar/gi, heat: 14, to: ['you’re not being straight with me', 'this doesn’t feel honest'] },
  { re: /you are a liar/gi, heat: 14, to: ['you’re not being straight with me', 'this doesn’t feel honest'] },
  { re: /everyone knows/gi, heat: 8, to: ['it seems', 'from where I sit'] },
  { re: /pathetic excuses/gi, heat: 12, to: ['thin explanations', 'reasons that aren’t landing'] },
  { re: /what the hell/gi, heat: 8, to: ['seriously', 'I need to understand'] },
  { re: /kill yourself|\bkys\b|go die/gi, heat: 30, to: ['[removed — I won’t send harm]'] },
];

/** Single-token coolers — same part of speech, short */
const COOLERS = {
  stupid: ['unhelpful', 'off-base', 'rough'],
  idiot: ['confused', 'misguided'],
  dumb: ['unclear', 'messy'],
  hate: ['resent', 'reject'],
  always: ['often', 'repeatedly'],
  never: ['rarely', 'seldom'],
  whatever: ['okay', 'fine'],
  fucking: ['really', 'truly'],
  fuck: ['damn', 'wow'],
  shit: ['mess', 'chaos'],
  pathetic: ['thin', 'weak'],
  worthless: ['empty', 'hollow'],
  ridiculous: ['extreme', 'unlikely'],
  liar: ['dishonest', 'evasive'],
  lying: ['evasive', 'off'],
  toxic: ['harmful', 'draining'],
  shut: ['stop', 'pause'],
  done: ['finished', 'spent'],
  obviously: ['seemingly', 'apparently'],
  clearly: ['seemingly', 'apparently'],
  insane: ['intense', 'extreme'],
  crazy: ['intense', 'wild'],
  blame: ['share', 'own'],
  fault: ['part', 'role'],
  everyone: ['people', 'folks'],
  nobody: ['few'],
  excuses: ['reasons', 'explanations'],
  hell: ['world', 'earth'],
};

export function tokenize(text) {
  if (!text) return [];
  return text.split(/(\s+)/).filter((t) => t.length);
}

function stemKey(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return '';
  if (HOT[w] != null) return w;
  if (w.startsWith('manipulat')) return 'manipulat';
  return w;
}

function wordHeat(raw) {
  const letters = raw.replace(/[^a-zA-Z']/g, '');
  if (!letters) return 0;
  let h = 0;
  const key = stemKey(raw);
  if (key && HOT[key] != null) h += HOT[key];
  if (letters.length >= 3 && letters === letters.toUpperCase()) h += 6;
  const bangs = (raw.match(/!/g) || []).length;
  if (bangs >= 1) h += Math.min(8, bangs * 3);
  const q = (raw.match(/\?/g) || []).length;
  if (q >= 2) h += 3;
  if (/\.\.\.|…/.test(raw)) h += 2;
  return h;
}

export function analyze(text) {
  const tokens = tokenize(text);
  const annotated = tokens.map((t, i) => {
    const heat = /\s/.test(t) ? 0 : wordHeat(t);
    const key = stemKey(t);
    return {
      i,
      text: t,
      heat,
      hot: heat >= 5,
      coolers: COOLERS[key] || null,
    };
  });

  let phraseBonus = 0;
  const phraseHits = [];
  for (const p of PHRASE_REWRITES) {
    p.re.lastIndex = 0;
    const m = text.match(p.re);
    if (m) {
      phraseBonus += p.heat * m.length;
      phraseHits.push({ phrase: m[0], score: p.heat, options: p.to });
    }
  }

  const content = annotated.filter((t) => !/^\s+$/.test(t.text));
  const hotWords = content.filter((t) => t.hot);
  const rawSum = content.reduce((s, t) => s + t.heat, 0) + phraseBonus;

  const chars = text.length;
  const lines = text.split(/\n/).length;
  const capsRatio = content.length
    ? content.filter((t) => {
        const L = t.text.replace(/[^a-zA-Z]/g, '');
        return L.length >= 3 && L === L.toUpperCase();
      }).length / content.length
    : 0;

  let structure = 0;
  if (chars > 400) structure += 4;
  if (chars > 900) structure += 6;
  if (lines > 8) structure += 3;
  structure += Math.round(capsRatio * 20);

  const youCount = (text.match(/\byou\b/gi) || []).length;
  const iCount = (text.match(/\bi\b/gi) || []).length;
  if (youCount >= 3 && youCount > iCount) structure += Math.min(12, youCount * 1.5);

  const total = rawSum + structure;
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-total / 28)))));

  let band = 'cool';
  if (score >= 75) band = 'molten';
  else if (score >= 50) band = 'hot';
  else if (score >= 28) band = 'warm';
  else if (score >= 12) band = 'tepid';

  return {
    score,
    band,
    tokens: annotated,
    hotCount: hotWords.length,
    phraseHits,
    structure,
    youCount,
    iCount,
    chars,
    summary: bandLabel(band, score),
  };
}

function bandLabel(band, score) {
  switch (band) {
    case 'molten': return `Molten · ${score} — this will leave a mark.`;
    case 'hot': return `Hot · ${score} — cool before it leaves your hands.`;
    case 'warm': return `Warm · ${score} — edge left. A little quench helps.`;
    case 'tepid': return `Tepid · ${score} — almost ready.`;
    default: return `Tempered · ${score} — meaning kept. Scorch gone.`;
  }
}

export function replaceToken(text, tokenIndex, replacement) {
  const tokens = tokenize(text);
  if (tokenIndex < 0 || tokenIndex >= tokens.length) return text;
  const original = tokens[tokenIndex];
  const punct = original.match(/[^a-zA-Z']+$/);
  const lead = original.match(/^[^a-zA-Z']+/);
  let next = replacement;
  const letters = original.replace(/[^a-zA-Z']/g, '');
  if (letters && letters === letters.toUpperCase() && letters.length >= 2) {
    next = replacement.toUpperCase();
  } else if (letters && letters[0] === letters[0].toUpperCase()) {
    next = replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  tokens[tokenIndex] = `${lead ? lead[0] : ''}${next}${punct ? punct[0] : ''}`;
  return tokens.join('');
}

/**
 * One quench pulse: prefer phrase rewrite → token anneal → bangs/caps strip.
 * Returns { text, changed, kind }.
 */
export function quenchPulse(text) {
  // 1) Longest phrase rewrite first
  const sorted = [...PHRASE_REWRITES].sort((a, b) => b.heat - a.heat);
  for (const p of sorted) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) {
      p.re.lastIndex = 0;
      const next = text.replace(p.re, (match) => {
        const opt = p.to[0];
        // Preserve rough capitalization of first letter
        if (match[0] && match[0] === match[0].toUpperCase()) {
          return opt.charAt(0).toUpperCase() + opt.slice(1);
        }
        return opt;
      });
      if (next !== text) return { text: next, changed: true, kind: 'phrase' };
    }
  }

  // 2) Anneal hottest token with a cooler
  const a = analyze(text);
  const hot = [...a.tokens]
    .filter((t) => t.hot && t.coolers?.length)
    .sort((x, y) => y.heat - x.heat)[0];
  if (hot) {
    return {
      text: replaceToken(text, hot.i, hot.coolers[0]),
      changed: true,
      kind: 'token',
    };
  }

  // 3) Soften shouting / bangs
  let next = text;
  if (/!{2,}/.test(next)) {
    next = next.replace(/!{2,}/g, '!');
    return { text: next, changed: true, kind: 'bang' };
  }
  if (/\b[A-Z]{3,}\b/.test(next)) {
    next = next.replace(/\b[A-Z]{3,}\b/, (w) => w.charAt(0) + w.slice(1).toLowerCase());
    if (next !== text) return { text: next, changed: true, kind: 'caps' };
  }

  return { text, changed: false, kind: 'none' };
}

/** Word-level diff for before/after compare */
export function diffWords(before, after) {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  // Simple LCS-ish marking: mark tokens in after that differ
  const setA = new Set(a.filter((t) => t.trim()));
  return b.map((t) => {
    if (!t.trim()) return { text: t, changed: false };
    return { text: t, changed: !setA.has(t) };
  });
}

export function quenchScore(score, amount) {
  return Math.max(0, Math.round(score - amount));
}
