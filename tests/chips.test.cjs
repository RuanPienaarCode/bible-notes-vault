'use strict';
/* Seam 6 — which references in a Live Preview line become chips.
   Reading view skips code, links and frontmatter; the editor sees raw line
   text, so chip-scan.js masks the same spans before a reference counts.
   Every expected value is written out by hand from the line itself.
   Also: the per-line fence/frontmatter cache must give exactly what a fresh
   top-to-bottom walk gives, across edits. */
const assert = require('node:assert');
const { parseRefs } = require('../src/scripture');
const C = require('../src/chip-scan');

/* The masked text, span by span. */
const masked = text => C.maskedSpans(text).map(([a, z]) => text.slice(a, z));
const labels = (text, mask) => C.visibleRefs(text, mask).map(r => r.label);

/* ---- inline code: a backtick run closes on a run of the SAME length ---- */
assert.deepStrictEqual(masked('Code `John 3:16` after'), ['`John 3:16`']);
assert.deepStrictEqual(masked('a ``x ` John 3:16`` b'), ['``x ` John 3:16``'], 'double backticks may hold a single one');
assert.deepStrictEqual(masked('a ``x` John 3:16'), [], 'a double run with no closing double run is plain text');
assert.deepStrictEqual(masked('a ` John 3:16'), [], 'an unmatched backtick masks nothing');
assert.deepStrictEqual(masked('a `x`` John 3:16 `y` b'), ['`x`` John 3:16 `'], 'the closer is the next run of the same length');
assert.deepStrictEqual(masked('\\`John 3:16\\`'), [], 'an escaped backtick is a plain character');
assert.deepStrictEqual(masked('`[[a]]` and `%%b%%`'), ['`[[a]]`', '`%%b%%`'], 'constructs inside code are not masked on their own');

/* ---- [text](url): the whole span, label and destination ---- */
assert.deepStrictEqual(masked('link [John 3:17](https://example.com) x'), ['[John 3:17](https://example.com)']);
assert.deepStrictEqual(masked('[a](https://e.com/a_(b)) John 3:5'), ['[a](https://e.com/a_(b))'], 'parentheses inside the destination');
assert.deepStrictEqual(masked('[a](u "t John 3:1") z'), ['[a](u "t John 3:1")'], 'a title is part of the span');
assert.deepStrictEqual(masked('![John 3:2](pic.png)'), ['[John 3:2](pic.png)'], 'an image is the same span');
assert.deepStrictEqual(masked('[John 3:16] and (x)'), [], 'brackets with no destination are plain text');
assert.deepStrictEqual(masked('[a](dest John 3:16'), [], 'an unclosed destination masks nothing');
assert.deepStrictEqual(masked('[a [b] c](u)'), ['[a [b] c](u)'], 'nested brackets in the label');

/* ---- [[wikilinks]] and embeds ---- */
assert.deepStrictEqual(masked('wiki [[John 3:18]] x'), ['[[John 3:18]]']);
assert.deepStrictEqual(masked('wiki [[Note|John 3:18]] x'), ['[[Note|John 3:18]]']);
assert.deepStrictEqual(masked('![[John 3:18]]'), ['[[John 3:18]]']);
assert.deepStrictEqual(masked('[[John 3:18 and more'), [], 'an unclosed wikilink masks nothing');

/* ---- <autolinks> and bare URLs ---- */
assert.deepStrictEqual(masked('<https://example.com/a> John 3:19'), ['<https://example.com/a>']);
assert.deepStrictEqual(masked('see https://example.com/John3:16?x=1 then John 3:21'), ['https://example.com/John3:16?x=1']);
assert.deepStrictEqual(masked('see http://e.com/a, then'), ['http://e.com/a,']);
assert.deepStrictEqual(masked('ahttps://e.com is not a link start'), [], 'a URL must start a word');
assert.deepStrictEqual(masked('a < b and c > d John 3:16'), [], 'a plain angle bracket is not an autolink');

/* ---- %%comments%% on one line ---- */
assert.deepStrictEqual(masked('a %%John 3:20%% b'), ['%%John 3:20%%']);
assert.deepStrictEqual(masked('a %% John 3:20 with no end'), [], 'an unclosed comment masks nothing on this line');
assert.deepStrictEqual(masked('50% off, 60% too'), [], 'single percent signs are plain text');

/* ---- $inline math$ ---- */
assert.deepStrictEqual(masked('so $x^2 + John 3:16$ done'), ['$x^2 + John 3:16$']);
assert.deepStrictEqual(masked('so $$a+b$$ done'), ['$$a+b$$']);
assert.deepStrictEqual(masked('it costs $5 and $10 each'), [], 'two prices are not a formula');
assert.deepStrictEqual(masked('US$5 for x$10 John 3:16'), [], 'a closing dollar before a digit is a price');
assert.deepStrictEqual(masked('$ John 3:16 $'), [], 'a space after the opening dollar is not math');
assert.deepStrictEqual(masked('pay \\$5 then $x$'), ['$x$'], 'an escaped dollar does not open math');

/* ---- several spans: in order, none overlapping ---- */
assert.deepStrictEqual(masked('`a` [b](c) [[d]] %%e%% $f$'), ['`a`', '[b](c)', '[[d]]', '%%e%%', '$f$']);
assert.deepStrictEqual(masked('plain John 3:16 only'), []);
assert.deepStrictEqual(masked(''), []);

/* ---- references: dropped only when they overlap a masked span ---- */
{
  /* The audit line, as the real Live Preview showed it. */
  const line = 'Code `John 3:16` link [John 3:17](https://example.com) wiki [[John 3:18]] comment %%John 3:20%% plain John 3:21';
  assert.strictEqual(parseRefs(line).length, 5, 'fixture: the parser alone finds all five');
  assert.deepStrictEqual(labels(line), ['John 3:21']);
  const only = C.visibleRefs(line)[0];
  assert.strictEqual(line.slice(only.start, only.end), 'John 3:21', 'the survivor keeps its own offsets');

  /* Negative control: with the mask switched off the same assertion fails,
     so the assertion above really depends on the mask. */
  assert.deepStrictEqual(labels(line, () => []), ['John 3:16', 'John 3:17', 'John 3:18', 'John 3:20', 'John 3:21']);
  assert.notDeepStrictEqual(labels(line, () => []), ['John 3:21']);
}
assert.deepStrictEqual(labels('Read John 3:16.'), ['John 3:16'], 'a plain reference stays a chip');
assert.deepStrictEqual(labels('**John 3:16** and _Rom 8:28_'), ['John 3:16', 'Romans 8:28'], 'emphasis is not a mask');
assert.deepStrictEqual(labels('`code` John 3:16 [l](u) Rom 8:28'), ['John 3:16', 'Romans 8:28'], 'next to a span is not inside it');
assert.deepStrictEqual(labels('x John 3:16`c`'), ['John 3:16'], 'a reference ending where a span starts');
assert.deepStrictEqual(labels('a ` John 3:16'), ['John 3:16'], 'an unmatched backtick leaves the chip');
assert.deepStrictEqual(labels('a ``x ` John 3:16`` John 3:17'), ['John 3:17']);
assert.deepStrictEqual(labels('plain text, no reference'), []);

/* ---- merging the visible line ranges (touching ranges become one) ---- */
assert.deepStrictEqual(C.mergeLineRanges([[3, 5], [5, 8], [10, 12]]), [[3, 8], [10, 12]]);
assert.deepStrictEqual(C.mergeLineRanges([[3, 5], [6, 8]]), [[3, 5], [6, 8]]);
assert.deepStrictEqual(C.mergeLineRanges([]), []);

/* ============ the line-state cache against a fresh walk ============ */

/* The walk as it was written before the cache — the oracle. Returns the
   numbers of the lines that may carry a chip, among lines a..z. */
function oracle(lines, a, z) {
  const out = [];
  let front = /^---[ \t]*$/.test(lines[0]);
  let fence = null;
  for (let n = front ? 2 : 1; n <= z; n++) {
    const text = lines[n - 1];
    if (front) { if (/^(---|\.\.\.)[ \t]*$/.test(text)) front = false; continue; }
    const f = /^[ \t]*(```|~~~)/.exec(text);
    if (f) { if (!fence) fence = f[1]; else if (f[1] === fence) fence = null; continue; }
    if (fence || n < a) continue;
    out.push(n);
  }
  return out;
}
function viaCache(states, lines, a, z) {
  const out = [];
  states.walk(n => lines[n - 1], a, z, n => out.push(n));
  return out;
}
const fresh = () => new C.LineStates();

/* Hand-written cases. */
{
  const doc = ['---', 'title: x', '---', 'John 3:16', '```', 'John 3:17', '```', 'John 3:18', '~~~', '```', 'John 3:19', '~~~', 'John 3:20'];
  assert.deepStrictEqual(viaCache(fresh(), doc, 1, 13), [4, 8, 13]);
  assert.deepStrictEqual(viaCache(fresh(), doc, 1, 13), oracle(doc, 1, 13));
  assert.deepStrictEqual(viaCache(fresh(), doc, 5, 8), [8], 'a window below the top still knows about the fence above it');
  assert.deepStrictEqual(viaCache(fresh(), ['---', 'a: b', 'John 3:16'], 1, 3), [], 'frontmatter that never closes hides the rest');
  assert.deepStrictEqual(viaCache(fresh(), ['intro', '---', 'John 3:16'], 1, 3), [1, 2, 3], '--- below line 1 is not frontmatter');
  assert.deepStrictEqual(viaCache(fresh(), ['---', 'a: b', '...', 'John 3:16'], 1, 4), [4], '... closes frontmatter too');
  assert.deepStrictEqual(viaCache(fresh(), ['```', 'John 3:16'], 1, 2), [], 'an unclosed fence runs to the end');
}

/* Reuse: after a warm walk, a viewport move or an edit near the window
   classifies only the window, not everything above it. */
{
  const lines = Array.from({ length: 3000 }, (_, i) => (i % 400 === 0 && i ? '```' : `line ${i + 1} John 3:16`));
  const s = fresh();
  viaCache(s, lines, 2880, 2920);
  assert.strictEqual(s.classified, 2920, 'first walk classifies every line down to the window');
  const before = s.classified;
  viaCache(s, lines, 2880, 2920);
  assert.strictEqual(s.classified - before, 41, 'a viewport-only update classifies just the window');
  s.invalidateFrom(2900);
  const mid = s.classified;
  assert.deepStrictEqual(viaCache(s, lines, 2880, 2920), oracle(lines, 2880, 2920));
  assert.ok(s.classified - mid <= 41, `an edit at line 2900 reclassified ${s.classified - mid} lines`);
  s.invalidateFrom(1);
  const top = s.classified;
  viaCache(s, lines, 2880, 2920);
  assert.strictEqual(s.classified - top, 2920, 'an edit on line 1 correctly walks from the top');
}

/* A seeded run of random edits: after each, the cache (invalidated from the
   first changed line, as the editor does) agrees with a fresh walk. */
{
  let seed = 12345;
  const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const pieces = ['---', '...', '```', '~~~', '    ```', 'plain John 3:16', 'text', '', '## head', '- [ ] task', '--- x'];
  for (let round = 0; round < 40; round++) {
    const lines = Array.from({ length: 5 + rnd(60) }, () => pieces[rnd(pieces.length)]);
    const s = fresh();
    for (let step = 0; step < 60; step++) {
      const a = 1 + rnd(lines.length);
      const z = Math.min(lines.length, a + rnd(15));
      assert.deepStrictEqual(viaCache(s, lines, a, z), oracle(lines, a, z), `round ${round} step ${step}`);
      const at = rnd(lines.length);
      const kind = rnd(3);
      if (kind === 0) lines.splice(at, 1, pieces[rnd(pieces.length)]);
      else if (kind === 1) lines.splice(at, 0, pieces[rnd(pieces.length)]);
      else if (lines.length > 2) lines.splice(at, 1);
      s.invalidateFrom(at + 1);
    }
  }
}

/* Negative control: forgetting to invalidate gives a wrong answer, so the
   random run above really exercises the invalidation. */
{
  const lines = ['intro', 'John 3:16', 'John 3:17', 'John 3:18'];
  const s = fresh();
  viaCache(s, lines, 1, 4);
  lines.splice(0, 1, '```');
  assert.notDeepStrictEqual(viaCache(s, lines, 1, 4), oracle(lines, 1, 4), 'a stale cache disagrees with a fresh walk');
  s.invalidateFrom(1);
  assert.deepStrictEqual(viaCache(s, lines, 1, 4), oracle(lines, 1, 4));
}

console.log('chips.test.cjs ok');
