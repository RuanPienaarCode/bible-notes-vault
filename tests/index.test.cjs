'use strict';
/* Seam 3 — everything Home shows, from a month of notes. Expected values are
   read off the fixture by hand. */
const assert = require('node:assert');
const { readNote } = require('../src/note');
const { buildIndex, carriedInto, partOf } = require('../src/index');

const S = { templateFolder: 'Templates/Bible Notes' };
const note = (path, lines) => readNote({ path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), text: lines.join('\n') }, S);

const H = note('Sun/2026-10-25 Pruned to bear fruit.md', ['---', 'bible-notes: sunday', 'date: 2026-10-25', 'series: abide', 'scripture: John 15:1-8', '---', '', '## Message']);
const B = note('Com/2026-10-22 Community.md', ['---', 'bible-notes: community', 'date: 2026-10-22', 'scripture: John 15:9-17', '---', '',
  '## Follow up', '- [ ] Message Pieter about the camp lift', '## Prayer', '- [ ] Thandi — job interview']);
const D = note('Med/2026-10-21 Be still.md', ['---', 'bible-notes: meditation', 'date: 2026-10-21', 'scripture: Psalm 46:10', '---', '', 'Noticed: John 15:5 again.']);
const A = note('Sun/2026-10-18 Remain in me.md', ['---', 'bible-notes: sunday', 'date: 2026-10-18', 'series: Abide', 'scripture: John 15:1-8', '---', '',
  '## Response', '- [ ] Read John 15 slowly every morning', '## Questions', '- [ ] What does pruning look like?']);
const F = note('Sun/2026-10-11 Peace.md', ['---', 'bible-notes: sunday', 'date: 2026-10-11', 'series: Abide', 'scripture: John 14:1-14', '---', '']);
const G = note('Sun/2026-10-04 Home.md', ['---', 'bible-notes: sunday', 'date: 2026-10-04', 'series: Abide', '---', '']);
const C = note('Com/2026-10-01 Community.md', ['---', 'bible-notes: community', 'date: 2026-10-01', '---', '',
  '## Praying for', '- [x] Pieter’s visa ✅ 2026-10-25', '- [x] Rain']);
const E = note('Study/Romans 8.md', ['---', 'bible-notes: study', 'started: 2026-09-01', 'scripture: Romans 8', '---', '', 'The Spirit, John 15:26.']);

const idx = buildIndex([E, C, A, H, G, D, F, B], '2026-10-25');
const titles = list => list.map(n => n.title);

/* Recent: newest first. */
assert.deepStrictEqual(titles(idx.recent), ['Pruned to bear fruit', 'Community', 'Be still', 'Remain in me', 'Peace', 'Home', 'Community', 'Romans 8']);

/* Still open: to-dos, newest note first, then in the order written. */
assert.deepStrictEqual(idx.open.map(o => o.task.text), ['Message Pieter about the camp lift', 'Read John 15 slowly every morning', 'What does pruning look like?']);
assert.strictEqual(idx.open[0].note, B);

/* Praying for, and answered — with the days from the note to the answer. */
assert.deepStrictEqual(idx.praying.map(o => o.task.text), ['Thandi — job interview']);
assert.deepStrictEqual(idx.answered.map(o => [o.task.text, o.days]), [['Pieter’s visa', 24], ['Rain', null]]);

/* Passages: books in Bible order, chapters ascending, notes newest first.
   Property and body references both count; a note counts once. */
assert.deepStrictEqual(idx.passages.map(b => [b.book, b.chapters.map(c => [c.key, titles(c.notes)])]), [
  ['Psalms', [['Psalm 46', ['Be still']]]],
  ['John', [
    ['John 14', ['Peace']],
    ['John 15', ['Pruned to bear fruit', 'Community', 'Be still', 'Remain in me', 'Romans 8']],
  ]],
  ['Romans', [['Romans 8', ['Romans 8']]]],
]);

/* Series: parts by date, whatever the casing; named as first written. */
assert.deepStrictEqual(idx.series.map(s => [s.name, s.notes.map(x => [x.part, x.note.title])]), [
  ['Abide', [[1, 'Home'], [2, 'Peace'], [3, 'Remain in me'], [4, 'Pruned to bear fruit']]],
]);
assert.strictEqual(partOf(idx, H), 4);
assert.strictEqual(partOf(idx, D), null);

/* What a note carries in from before its date (to-dos only, never itself). */
assert.deepStrictEqual(carriedInto(idx, H).map(o => o.task.text), ['Message Pieter about the camp lift', 'Read John 15 slowly every morning', 'What does pruning look like?']);
assert.deepStrictEqual(carriedInto(idx, A), []);

console.log('index OK');
