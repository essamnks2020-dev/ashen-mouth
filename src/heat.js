/**
 * Heat analysis — no network, no model. Lexicon + structure + rhythm.
 * Returns a 0–100 score plus per-token annotations for the forge UI.
 */

const HOT = {
  // Direct attack / contempt
  stupid: 9, idiot: 10, dumb: 8, pathetic: 9, worthless: 10, trash: 8,
  hate: 8, disgusting: 9, ridiculous: 6, insane: 5, crazy: 4,
  shut: 7, stfu: 10, fuck: 9, fucking: 8, fucked: 8, shit: 7, bitch: 10,
  asshole: 10, bastard: 9, damn: 4, hell: 3, crap: 4,

  // Blame / accusation
  always: 7, never: 7, everyone: 5, nobody: 5, whatever: 4,
  blame: 6, fault: 5, accused: 5, lying: 8, liar: 9, lied: 8,
  gaslight: 8, narcissist: 8, toxic: 7, manipulat: 7,

  // Threat / ultimatum
  ultimatum: 8, or_else: 8, divorce: 7, quit: 5, resign: 5,
  blocked: 6, blocking: 6, done: 4, over: 3, leave: 4,
  sue: 8, lawyer: 6, police: 6, report: 4,

  // Dismissal
  whatever: 4, anyways: 3, k: 3, okc: 3, idc: 7, idgaf: 10,
  lol: 2, lmao: 3, 'lmao.': 4,

  // Absolutes / mind-reading
  obviously: 5, clearly: 5, honestly: 3, seriously: 4,
  impossible: 4, completely: 3, totally: 3, literally: 2,
};

const HOT_PHRASES = [
  [/you always/gi, 12],
  [/you never/gi, 12],
  [/i hate you/gi, 18],
  [/kill yourself/gi, 30],
  [/kys\b/gi, 30],
  [/go die/gi, 25],
  [/fuck you/gi, 16],
  [/screw you/gi, 12],
  [/who even are you/gi, 10],
  [/don't bother/gi, 8],
  [/dont bother/gi, 8],
  [/i'm done/gi, 8],
  [/im done/gi, 8],
  [/we're done/gi, 10],
  [/were done/gi, 10],
  [/or else/gi, 10],
  [/last chance/gi, 9],
  [/how dare you/gi, 11],
  [/what's wrong with you/gi, 11],
  [/whats wrong with you/gi, 11],
  [/you make me sick/gi, 14],
  [/i don't care/gi, 7],
  [/i dont care/gi, 7],
];

const COOLERS = {
  stupid: ['unhelpful', 'off-base', 'not landing'],
  idiot: ['missing something', 'not seeing this'],
  dumb: ['confusing', 'not clear'],
  hate: ['really struggle with', 'can’t accept'],
  always: ['often', 'keeps happening'],
  never: ['rarely', 'hasn’t yet'],
  whatever: ['okay', 'I hear you'],
  fucking: ['really', 'genuinely'],
  fuck: ['damn', 'wow'],
  shit: ['mess', 'situation'],
  pathetic: ['disappointing', 'hard to watch'],
  worthless: ['not valued here', 'dismissed'],
  ridiculous: ['hard to believe', 'a stretch'],
  liar: ['not matching what I know'],
  lying: ['not lining up'],
  toxic: ['harmful', 'wearing me down'],
  shut: ['please stop', 'I need a pause'],
  done: ['at my limit', 'need space'],
  obviously: ['from where I sit', 'it seems'],
  clearly: ['it looks like', 'I think'],
  insane: ['intense', 'a lot'],
  crazy: ['overwhelming', 'a lot'],
  blame: ['responsibility', 'part in this'],
  fault: ['role in this'],
};

/** Tokenize preserving whitespace/punctuation as separate soft tokens */
export function tokenize(text) {
  if (!text) return [];
  return text.split(/(\s+)/).filter((t) => t.length);
}

function stemKey(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return '';
  if (HOT[w] != null) return w;
  // light stem for manipulat*
  if (w.startsWith('manipulat')) return 'manipulat';
  return w;
}

function wordHeat(raw) {
  const letters = raw.replace(/[^a-zA-Z']/g, '');
  if (!letters) return 0;
  let h = 0;
  const key = stemKey(raw);
  if (key && HOT[key] != null) h += HOT[key];

  // ALL CAPS shout (3+ letters)
  if (letters.length >= 3 && letters === letters.toUpperCase()) h += 6;

  // !!! density
  const bangs = (raw.match(/!/g) || []).length;
  if (bangs >= 1) h += Math.min(8, bangs * 3);

  // ??? aggression-adjacent
  const q = (raw.match(/\?/g) || []).length;
  if (q >= 2) h += 3;

  // ellipsis passive-aggression
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
      coolers: COOLERS[key] || COOLERS[t.toLowerCase().replace(/[^a-z']/g, '')] || null,
    };
  });

  let phraseBonus = 0;
  const phraseHits = [];
  for (const [re, score] of HOT_PHRASES) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) {
      phraseBonus += score * m.length;
      phraseHits.push({ phrase: m[0], score });
    }
  }

  const content = annotated.filter((t) => !/^\s+$/.test(t.text));
  const hotWords = content.filter((t) => t.hot);
  const rawSum = content.reduce((s, t) => s + t.heat, 0) + phraseBonus;

  // Structure signals
  const chars = text.length;
  const lines = text.split(/\n/).length;
  const capsRatio = content.length
    ? content.filter((t) => {
        const L = t.text.replace(/[^a-zA-Z]/g, '');
        return L.length >= 3 && L === L.toUpperCase();
      }).length / content.length
    : 0;

  let structure = 0;
  if (chars > 400) structure += 4; // wall of text rage
  if (chars > 900) structure += 6;
  if (lines > 8) structure += 3;
  structure += Math.round(capsRatio * 20);

  // You-density (accusatory second person)
  const youCount = (text.match(/\byou\b/gi) || []).length;
  const iCount = (text.match(/\bi\b/gi) || []).length;
  if (youCount >= 3 && youCount > iCount) structure += Math.min(12, youCount * 1.5);

  const total = rawSum + structure;
  // Soft logistic curve into 0–100
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

/** Apply a cooler replacement at token index; returns new full text */
export function replaceToken(text, tokenIndex, replacement) {
  const tokens = tokenize(text);
  if (tokenIndex < 0 || tokenIndex >= tokens.length) return text;
  const original = tokens[tokenIndex];
  // Preserve trailing punctuation from original word
  const punct = original.match(/[^a-zA-Z']+$/);
  const lead = original.match(/^[^a-zA-Z']+/);
  let next = replacement;
  // Match capitalization of original letters
  const letters = original.replace(/[^a-zA-Z']/g, '');
  if (letters && letters[0] === letters[0].toUpperCase() && letters === letters.toUpperCase()) {
    next = replacement.toUpperCase();
  } else if (letters && letters[0] === letters[0].toUpperCase()) {
    next = replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  tokens[tokenIndex] = `${lead ? lead[0] : ''}${next}${punct ? punct[0] : ''}`;
  return tokens.join('');
}

export function quenchScore(score, amount) {
  return Math.max(0, Math.round(score - amount));
}
