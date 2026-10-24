'use strict';
/* What Live Preview may turn into a chip — the pure half of src/chips.js
   (no Obsidian or CodeMirror here, so tests/chips.test.cjs runs it as is).

   Reading view skips code, links and frontmatter because it sees the
   rendered DOM. The editor sees raw line text, so two things stand in:
   - maskedSpans(): the ranges of a line that markdown would not render as
     plain prose (code, links, wikilinks, autolinks, URLs, comments, math);
     a reference overlapping one is not a chip.
   - LineStates: which lines are frontmatter or inside a fenced block,
     remembered per line so a keystroke or a scroll does not re-walk the
     note from line 1.
   No lookbehind anywhere (iOS 15 parses the whole bundle at load). */

const { parseRefs } = require('./scripture');

/* ---------------------------------------------------------------- masks */

const AUTOLINK = /<[A-Za-z][A-Za-z0-9+.-]*:[^\s<>]*>/y;
const BARE_URL = /https?:\/\/\S+/iy;
const WORD = /[A-Za-z0-9]/;

function runLength(text, i, ch) {
  let j = i;
  while (text[j] === ch) j++;
  return j - i;
}

/* End of a code span opened by a run of `run` backticks that ends at `from`:
   the next run of exactly that many. -1 when there is none. */
function codeEnd(text, from, run) {
  let j = from;
  while (j < text.length) {
    if (text[j] === '`') {
      const r = runLength(text, j, '`');
      if (r === run) return j + r;
      j += r;
    } else j++;
  }
  return -1;
}

/* `[label](destination "title")` starting at the `[` at i; end index or -1. */
function linkEnd(text, i) {
  let j = i + 1;
  let depth = 1;
  for (; j < text.length && depth; j++) {
    const c = text[j];
    if (c === '\\') j++;
    else if (c === '[') depth++;
    else if (c === ']') depth--;
  }
  if (depth || text[j] !== '(') return -1;
  let paren = 0;
  for (; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') j++;
    else if (c === '(') paren++;
    else if (c === ')' && --paren === 0) return j + 1;
  }
  return -1;
}

/* `$x$` or `$$x$$` starting at i. As Obsidian reads it, a single `$` opens
   only before a non-space and closes only after a non-space and not before
   a digit, so "$5 and $10" is two prices, not a formula. */
function mathEnd(text, i) {
  const dbl = text[i + 1] === '$';
  const from = i + (dbl ? 2 : 1);
  if (!dbl && (from >= text.length || /\s/.test(text[from]))) return -1;
  for (let j = from; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') { j++; continue; }
    if (c !== '$') continue;
    if (dbl) { if (text[j + 1] === '$') return j + 2; continue; }
    if (/\s/.test(text[j - 1])) continue;
    if (j + 1 < text.length && /[0-9]/.test(text[j + 1])) continue;
    return j + 1;
  }
  return -1;
}

/* The [start, end) ranges of `text` that are not plain prose, in order and
   not overlapping. The first construct to start wins, and what is inside it
   is part of it. An unmatched opener masks nothing. */
function maskedSpans(text) {
  const out = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    let end = -1;
    let step = 1;
    if (c === '\\') { i += 2; continue; }
    if (c === '`') {
      step = runLength(text, i, '`');
      end = codeEnd(text, i + step, step);
    } else if (c === '[') {
      if (text[i + 1] === '[') {
        const close = text.indexOf(']]', i + 2);
        end = close < 0 ? -1 : close + 2;
      } else end = linkEnd(text, i);
    } else if (c === '<') {
      AUTOLINK.lastIndex = i;
      if (AUTOLINK.test(text)) end = AUTOLINK.lastIndex;
    } else if (c === 'h' || c === 'H') {
      if (i === 0 || !WORD.test(text[i - 1])) {
        BARE_URL.lastIndex = i;
        if (BARE_URL.test(text)) end = BARE_URL.lastIndex;
      }
    } else if (c === '%') {
      if (text[i + 1] === '%') {
        const close = text.indexOf('%%', i + 2);
        end = close < 0 ? -1 : close + 2;
        step = 2;
      }
    } else if (c === '$') {
      end = mathEnd(text, i);
      step = text[i + 1] === '$' ? 2 : 1;
    }
    if (end > i) { out.push([i, end]); i = end; } else i += step;
  }
  return out;
}

/* The references in a line that stay chips: all of them, minus any that
   overlap a masked span. `mask` is a parameter only so a test can switch
   it off. */
function visibleRefs(text, mask) {
  const refs = parseRefs(text);
  if (!refs.length) return refs;
  const spans = (mask || maskedSpans)(text);
  if (!spans.length) return refs;
  return refs.filter(r => !spans.some(([a, z]) => r.start < z && r.end > a));
}

/* ------------------------------------------------------------ line state */

/* The state a line is entered in. */
const BODY = 0;
const FRONT = 1;
const FENCE_TICK = 2;
const FENCE_TILDE = 3;

const FRONT_START = /^---[ \t]*$/;
const FRONT_END = /^(---|\.\.\.)[ \t]*$/;
const FENCE = /^[ \t]*(```|~~~)/;

/* One line: (state after) * 2 + (1 when the line is prose a chip may sit
   in). Frontmatter opens only on line 1; a fence closes only on its own
   kind of marker; marker lines and everything between are not prose. */
function step(state, text, n) {
  if (state === FRONT) return (FRONT_END.test(text) ? BODY : FRONT) * 2;
  if (n === 1 && FRONT_START.test(text)) return FRONT * 2;
  const f = FENCE.exec(text);
  if (f) {
    const kind = f[1] === '```' ? FENCE_TICK : FENCE_TILDE;
    if (state === BODY) return kind * 2;
    return (kind === state ? BODY : state) * 2;
  }
  return state * 2 + (state === BODY ? 1 : 0);
}

/* The entering state of every line, remembered. The state entering line n
   depends only on lines above it, so after an edit whose first changed line
   is L, everything up to and including the state entering L stays valid:
   invalidateFrom(L). A scroll changes nothing and reuses it all. */
class LineStates {
  constructor() {
    this.st = [BODY, BODY]; /* st[n] = state entering line n (st[0] unused) */
    this.classified = 0; /* lines run through step(): what the cache saves */
  }

  invalidateFrom(line) {
    this.st.length = Math.min(this.st.length, Math.max(2, line + 1));
  }

  reset() { this.st.length = 2; }

  /* visit(n, text) for every line in a..z that may carry a chip. */
  walk(lineText, a, z, visit) {
    const st = this.st;
    while (st.length <= a) {
      const k = st.length - 1;
      st.push(step(st[k], lineText(k), k) >> 1);
      this.classified++;
    }
    for (let n = a; n <= z; n++) {
      const text = lineText(n);
      const r = step(st[n], text, n);
      this.classified++;
      if (st.length === n + 1) st.push(r >> 1);
      if (r & 1) visit(n, text);
    }
  }
}

/* [[a, z], ...] line ranges, ascending: any that touch or overlap become one
   (a line may be visible in two ranges, and a decoration is added once). */
function mergeLineRanges(ranges) {
  const out = [];
  for (const [a, z] of ranges) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], z);
    else out.push([a, z]);
  }
  return out;
}

module.exports = { maskedSpans, visibleRefs, mergeLineRanges, LineStates };
