'use strict';
/* Scripture references, read the way people actually type them:
   `John 15:1-8`, `Matthew 11:28–30`, `1 Sam 10:1,5-7`, `Act 19:1,2, 19:6`,
   `John 1:12 (NIV)`, `Romans 8`.

   Two modes. In PROSE (the body of a note) a reference must carry a verse —
   `Mark 2 points` is not scripture — and the book must start with a capital,
   so `it is 3:1` never turns into Isaiah. In a PROPERTY (`scripture:`) the
   value is known to be scripture, so chapter-only references and any case
   are fine.

   Pure — no DOM, no obsidian import. No lookbehind regex anywhere (a
   lookbehind LITERAL is a parse-time SyntaxError on iOS < 16.4 and kills the
   whole bundle at load); the "not inside a word" check is done by hand. */

/* name: canonical (the chapter-note naming Bible Search and most Bible
   vaults use). short: what a label says ("Psalm 23"). num: the 1/2/3 of a
   numbered book. aliases: lower case, WITHOUT the number. slug: BibleHub. */
const B = (name, chapters, slug, aliases, extra) => Object.assign({ name, short: name, num: null, chapters, slug, aliases }, extra || {});
const N = (num, base, chapters, aliases) => B(`${num} ${base}`, chapters, `${num}_${base.toLowerCase()}`, aliases, { num });

const SAMUEL = ['samuel', 'sam', 'sa', 'sm', 'samual'];
const KINGS = ['kings', 'kgs', 'ki', 'kin'];
const CHRON = ['chronicles', 'chron', 'chr', 'ch'];
const COR = ['corinthians', 'cor', 'corin'];
const THESS = ['thessalonians', 'thess', 'thes', 'th'];
const TIM = ['timothy', 'tim', 'ti', 'tm'];
const PETER = ['peter', 'pet', 'pe', 'pt'];
const JOHN = ['john', 'jn', 'jhn', 'joh'];

const BOOKS = [
  B('Genesis', 50, 'genesis', ['genesis', 'gen', 'ge', 'gn']),
  B('Exodus', 40, 'exodus', ['exodus', 'exod', 'exo', 'ex']),
  B('Leviticus', 27, 'leviticus', ['leviticus', 'lev', 'le', 'lv']),
  B('Numbers', 36, 'numbers', ['numbers', 'numb', 'num', 'nu', 'nm']),
  B('Deuteronomy', 34, 'deuteronomy', ['deuteronomy', 'deut', 'deu', 'dt', 'de']),
  B('Joshua', 24, 'joshua', ['joshua', 'josh', 'jos']),
  B('Judges', 21, 'judges', ['judges', 'judg', 'jdg', 'jg']),
  B('Ruth', 4, 'ruth', ['ruth', 'rth', 'ru']),
  N(1, 'Samuel', 31, SAMUEL),
  N(2, 'Samuel', 24, SAMUEL),
  N(1, 'Kings', 22, KINGS),
  N(2, 'Kings', 25, KINGS),
  N(1, 'Chronicles', 29, CHRON),
  N(2, 'Chronicles', 36, CHRON),
  B('Ezra', 10, 'ezra', ['ezra', 'ezr']),
  B('Nehemiah', 13, 'nehemiah', ['nehemiah', 'neh', 'ne']),
  B('Esther', 10, 'esther', ['esther', 'esth', 'est', 'es']),
  B('Job', 42, 'job', ['job', 'jb']),
  B('Psalms', 150, 'psalms', ['psalms', 'psalm', 'psa', 'psm', 'pss', 'ps'], { short: 'Psalm' }),
  B('Proverbs', 31, 'proverbs', ['proverbs', 'prov', 'prv', 'pro', 'pr']),
  B('Ecclesiastes', 12, 'ecclesiastes', ['ecclesiastes', 'eccles', 'eccl', 'ecc', 'ec', 'qoh']),
  B('Song of Songs', 8, 'songs', ['song of songs', 'song of solomon', 'songs', 'song', 'sos', 'sg']),
  B('Isaiah', 66, 'isaiah', ['isaiah', 'isa', 'is']),
  B('Jeremiah', 52, 'jeremiah', ['jeremiah', 'jer', 'je', 'jr']),
  B('Lamentations', 5, 'lamentations', ['lamentations', 'lam', 'la']),
  B('Ezekiel', 48, 'ezekiel', ['ezekiel', 'ezek', 'eze', 'ezk']),
  B('Daniel', 12, 'daniel', ['daniel', 'dan', 'da', 'dn']),
  B('Hosea', 14, 'hosea', ['hosea', 'hos', 'ho']),
  B('Joel', 3, 'joel', ['joel', 'jl']),
  B('Amos', 9, 'amos', ['amos', 'am']),
  B('Obadiah', 1, 'obadiah', ['obadiah', 'obad', 'ob']),
  B('Jonah', 4, 'jonah', ['jonah', 'jon', 'jnh']),
  B('Micah', 7, 'micah', ['micah', 'mic', 'mc']),
  B('Nahum', 3, 'nahum', ['nahum', 'nah', 'na']),
  B('Habakkuk', 3, 'habakkuk', ['habakkuk', 'hab', 'hb']),
  B('Zephaniah', 3, 'zephaniah', ['zephaniah', 'zeph', 'zep', 'zp']),
  B('Haggai', 2, 'haggai', ['haggai', 'hag', 'hg']),
  B('Zechariah', 14, 'zechariah', ['zechariah', 'zech', 'zec', 'zc']),
  B('Malachi', 4, 'malachi', ['malachi', 'mal', 'ml']),
  B('Matthew', 28, 'matthew', ['matthew', 'matt', 'mat', 'mt']),
  B('Mark', 16, 'mark', ['mark', 'mrk', 'mk', 'mr']),
  B('Luke', 24, 'luke', ['luke', 'luk', 'lk']),
  B('John', 21, 'john', JOHN),
  B('Acts', 28, 'acts', ['acts', 'act', 'ac']),
  B('Romans', 16, 'romans', ['romans', 'rom', 'ro', 'rm']),
  N(1, 'Corinthians', 16, COR),
  N(2, 'Corinthians', 13, COR),
  B('Galatians', 6, 'galatians', ['galatians', 'gal', 'ga']),
  B('Ephesians', 6, 'ephesians', ['ephesians', 'ephes', 'eph']),
  B('Philippians', 4, 'philippians', ['philippians', 'phil', 'php', 'pp']),
  B('Colossians', 4, 'colossians', ['colossians', 'col']),
  N(1, 'Thessalonians', 5, THESS),
  N(2, 'Thessalonians', 3, THESS),
  N(1, 'Timothy', 6, TIM),
  N(2, 'Timothy', 4, TIM),
  B('Titus', 3, 'titus', ['titus', 'tit']),
  B('Philemon', 1, 'philemon', ['philemon', 'philem', 'phm', 'pm']),
  B('Hebrews', 13, 'hebrews', ['hebrews', 'heb']),
  B('James', 5, 'james', ['james', 'jas', 'jm']),
  N(1, 'Peter', 5, PETER),
  N(2, 'Peter', 3, PETER),
  N(1, 'John', 5, JOHN),
  N(2, 'John', 1, JOHN),
  N(3, 'John', 1, JOHN),
  B('Jude', 1, 'jude', ['jude', 'jud', 'jd']),
  B('Revelation', 22, 'revelation', ['revelation', 'revelations', 'rev', 're']),
];
BOOKS.forEach((b, i) => { b.index = i; });

/* (number|alias) → book. A numbered alias only resolves with its number. */
const LOOKUP = new Map();
for (const b of BOOKS) for (const a of b.aliases) LOOKUP.set(`${b.num || ''}|${a}`, b);

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ \\t\\u00a0]+');
const ALIASES = [...new Set(BOOKS.flatMap(b => b.aliases))].sort((a, b) => b.length - a.length);
/* number prefix (1 / 2 / 3, optional space; I / II / III, space required),
   the book, an optional dot, an optional space, the chapter. */
const SP = '[ \\t\\u00a0]';
const FIND = new RegExp(`(?:([123])${SP}?|(III|II|I)${SP})?(${ALIASES.map(escape).join('|')})\\.?${SP}?(\\d{1,3})`, 'gi');
const ROMAN = { I: 1, II: 2, III: 3 };
const MAX_VERSE = 176; /* Psalm 119 */

const isDigit = ch => ch >= '0' && ch <= '9';
const isWordChar = ch => !!ch && /[A-Za-z0-9\u00C0-\u024F]/.test(ch);
const isSpace = ch => ch === ' ' || ch === '\t' || ch === '\u00a0';
const isDash = ch => ch === '-' || ch === '\u2013' || ch === '\u2014';

function readInt(text, p) {
  let q = p;
  while (q < text.length && q - p < 3 && isDigit(text[q])) q++;
  if (q === p || isDigit(text[q])) return null;
  return [Number(text.slice(p, q)), q];
}
const skipSpaces = (text, p) => { while (isSpace(text[p])) p++; return p; };

/* Everything after `Book 15`: verses, lists, ranges, a translation tag.
   Returns { spans, end, translation } or null when it is not a reference. */
function parseTail(text, pos, book, chapter, prose) {
  const spans = [];
  let end = pos;
  const sep = text[pos];
  if (sep === ':' || (sep === '.' && isDigit(text[pos + 1]))) {
    let c = chapter;
    let p = pos + 1;
    let first = readInt(text, p);
    if (!first) return prose ? null : finish([{ c1: chapter, v1: null, c2: chapter, v2: null }], pos);
    let v1 = first[0];
    p = first[1];
    for (;;) {
      let c2 = c, v2 = v1;
      const d = skipSpaces(text, p);
      if (isDash(text[d])) {
        const n = readInt(text, skipSpaces(text, d + 1));
        if (n) {
          if (text[n[1]] === ':' && isDigit(text[n[1] + 1])) {
            const v = readInt(text, n[1] + 1);
            if (v) { c2 = n[0]; v2 = v[0]; p = v[1]; }
          } else { v2 = n[0]; p = n[1]; }
        }
      }
      spans.push({ c1: c, v1, c2, v2 });
      c = c2;
      end = p;
      /* A list continues after `,` or `;` with a verse (`,5-7`) or a new
         chapter in the same book (`, 19:6`). Anything else ends it. */
      const s = skipSpaces(text, p);
      if (text[s] !== ',' && text[s] !== ';') break;
      const n = readInt(text, skipSpaces(text, s + 1));
      if (!n) break;
      if (text[n[1]] === ':') {
        const v = readInt(text, n[1] + 1);
        if (!v) break;
        c = n[0]; v1 = v[0]; p = v[1];
      } else {
        v1 = n[0]; p = n[1];
      }
    }
    return finish(spans, end);
  }
  if (prose) return null;
  /* Property mode, no verse: a one-chapter book's number is a verse
     (`Jude 3`); otherwise it is a chapter or a chapter range (`John 14–16`). */
  let to = chapter, p = pos;
  const d = skipSpaces(text, pos);
  if (isDash(text[d])) {
    const n = readInt(text, skipSpaces(text, d + 1));
    if (n && text[n[1]] !== ':') { to = n[0]; p = n[1]; }
  }
  if (book.chapters === 1) return finish([{ c1: 1, v1: chapter, c2: 1, v2: to }], p);
  return finish([{ c1: chapter, v1: null, c2: to, v2: null }], p);

  function finish(list, at) {
    for (const s of list) {
      if (s.c1 < 1 || s.c2 < s.c1 || s.c2 > book.chapters) return null;
      if (s.v1 !== null) {
        if (s.v1 < 1 || s.v2 < 1 || s.v1 > MAX_VERSE || s.v2 > MAX_VERSE) return null;
        if (s.c1 === s.c2 && s.v2 < s.v1) { const t = s.v1; s.v1 = s.v2; s.v2 = t; }
      }
    }
    let translation = null;
    const t = skipSpaces(text, at);
    if (text[t] === '(') {
      const m = /^\(([A-Z][A-Z0-9]{1,6})\)/.exec(text.slice(t, t + 10));
      if (m) { translation = m[1]; at = t + m[0].length; }
    }
    /* `Am 5:30 pm` is a time, not Amos. */
    if (/^[ap]\.?m\b/i.test(text.slice(skipSpaces(text, at), skipSpaces(text, at) + 5))) return null;
    return { spans: list, end: at, translation };
  }
}

function formatSpans(spans) {
  let out = '', prev = null;
  spans.forEach((s, i) => {
    const tail = s.c2 !== s.c1 ? `–${s.c2}:${s.v2}` : (s.v2 !== s.v1 ? `–${s.v2}` : '');
    if (s.v1 === null) {
      out += (i ? '; ' : '') + (s.c2 !== s.c1 ? `${s.c1}–${s.c2}` : `${s.c1}`);
    } else if (i === 0 || s.c1 !== prev) {
      out += (i ? '; ' : '') + `${s.c1}:${s.v1}` + tail;
    } else {
      out += `, ${s.v1}` + tail;
    }
    prev = s.c2;
  });
  return out;
}

/* Every reference in `text`, in order. opts.prose (default true) applies the
   prose rules above; pass { prose: false } for a `scripture:` value. */
function parseRefs(text, opts) {
  const prose = !opts || opts.prose !== false;
  const s = String(text || '');
  const out = [];
  FIND.lastIndex = 0;
  let m;
  while ((m = FIND.exec(s)) !== null) {
    const at = m.index;
    const ref = isWordChar(s[at - 1]) ? null : resolve(s, m, prose);
    if (ref) { out.push(ref); FIND.lastIndex = ref.end; } else { FIND.lastIndex = at + 1; }
  }
  return out;
}

function resolve(s, m, prose) {
  const word = m[3];
  if (prose && word[0] === word[0].toLowerCase()) return null;
  if (m[2] && m[2] !== m[2].toUpperCase()) return null;
  const alias = word.toLowerCase().replace(/[ \t\u00a0]+/g, ' ');
  const chapter = Number(m[4]);
  const tailAt = m.index + m[0].length;
  const num = m[1] ? Number(m[1]) : (m[2] ? ROMAN[m[2]] : null);
  const tries = [];
  if (num) tries.push({ book: LOOKUP.get(`${num}|${alias}`), start: m.index });
  /* `verse 3 John 3:16`: when the number doesn't make a numbered book, the
     reference starts at the book name. */
  tries.push({ book: LOOKUP.get(`|${alias}`), start: m.index + m[0].indexOf(word, m[1] || m[2] ? 1 : 0) });
  for (const t of tries) {
    if (!t.book) continue;
    const tail = parseTail(s, tailAt, t.book, chapter, prose);
    if (!tail) continue;
    return {
      start: t.start,
      end: tail.end,
      raw: s.slice(t.start, tail.end),
      book: t.book.name,
      bookIndex: t.book.index,
      spans: tail.spans,
      translation: tail.translation,
      label: `${t.book.short} ${formatSpans(tail.spans)}`,
    };
  }
  return null;
}

const bookOf = ref => BOOKS[ref.bookIndex];

/* "John 15", "Psalm 23" — one per chapter the reference touches. */
function chapterKeys(ref) {
  const b = bookOf(ref);
  const keys = [];
  for (const s of ref.spans) for (let c = s.c1; c <= s.c2; c++) {
    const k = `${b.short} ${c}`;
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

function chapters(ref) {
  const out = [];
  for (const s of ref.spans) for (let c = s.c1; c <= s.c2; c++) if (!out.includes(c)) out.push(c);
  return out;
}

/* Translations BibleHub serves chapter pages for, by its own codes. */
const BIBLEHUB = new Set(['niv', 'nlt', 'esv', 'bsb', 'kjv', 'nkjv', 'nasb', 'csb', 'hcsb', 'net', 'isv', 'web', 'ylt', 'asv', 'drb']);
const code = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Which translation a passage link opens: the one the reference names, when
   BibleHub has it, else `fallback` (the chosen translation), else NIV —
   never a code BibleHub would answer with a dead page. */
function linkCode(ref, fallback) {
  const own = code(ref.translation);
  if (BIBLEHUB.has(own)) return own;
  const chosen = code(fallback);
  return BIBLEHUB.has(chosen) ? chosen : 'niv';
}
const linkTranslation = (ref, fallback) => linkCode(ref, fallback).toUpperCase();

function bibleHubUrl(ref, fallback) {
  return `https://biblehub.com/${linkCode(ref, fallback)}/${bookOf(ref).slug}/${ref.spans[0].c1}.htm`;
}

/* The reference in the simple form Bible Search's reader parses:
   canonical book, one chapter, then a verse or a range within it. A list or
   a cross-chapter range opens where it starts. */
function readerRef(ref) {
  const s = ref.spans[0];
  const base = `${bookOf(ref).name} ${s.c1}`;
  if (s.v1 === null) return base;
  const range = ref.spans.length === 1 && s.c2 === s.c1 && s.v2 !== s.v1 ? `-${s.v2}` : '';
  return `${base}:${s.v1}${range}`;
}

/* The chapter note a Bible-as-notes vault would hold ("John 15",
   "Psalms 23") and the link that lands on the first verse. */
function passageNoteName(ref) {
  return `${bookOf(ref).name} ${ref.spans[0].c1}`;
}
function passageLink(ref) {
  const v = ref.spans[0].v1;
  return passageNoteName(ref) + (v ? `#^${v}` : '');
}

/* A `scripture:` property — one string or a list — read entry by entry.
   An entry that holds no reference is KEPT (refs: []) so the cover band can
   show it as not recognised instead of silently dropping what was typed. */
function parseProperty(value) {
  const list = Array.isArray(value) ? value : (value === null || value === undefined || value === '' ? [] : [value]);
  return list.map(v => String(v)).filter(v => v.trim()).map(raw => ({ raw, refs: parseRefs(raw, { prose: false }) }));
}

module.exports = { BOOKS, parseRefs, parseProperty, chapterKeys, chapters, bibleHubUrl, linkTranslation, readerRef, passageNoteName, passageLink, formatSpans };
