'use strict';
/* Seam 10 — what the create button offers. The Sunday choice (open today's,
   ask which, or create) and the rows of the action sheet. Pure: the indexed
   notes and today's date in, a plain answer out. Fixtures are synthetic. */
const assert = require('node:assert');
const { readNote } = require('../src/note');
const { buildIndex } = require('../src/index');
const { sundayPlan, createRows } = require('../src/create');
const S = require('../src/stats');

const SETTINGS = { templateFolder: 'Templates/Bible Notes' };
const note = (path, lines) => readNote({ path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), text: lines.join('\n') }, SETTINGS);
const TODAY = '2026-10-25';
const sunday = (date, extra) => note(`Sun/${date} Sunday.md`, ['---', 'bible-notes: sunday', `date: ${date}`, ...(extra || []), '---', '']);
const idx = notes => buildIndex(notes, TODAY);

/* Today's Sunday note exists: open it — even when a series could continue. */
{
  const today = sunday(TODAY, ['series: Abide']);
  const i = idx([sunday('2026-10-18', ['series: Abide']), today]);
  assert.deepStrictEqual(sundayPlan(i.notes, TODAY), { action: 'open', path: today.path, title: 'Sunday' });
}

/* No note today, last Sunday was in a series: ask once, naming the series
   and the part a new note would be. */
{
  const i = idx([sunday('2026-10-04', ['series: Abide']), sunday('2026-10-11', ['series: Abide']), sunday('2026-10-18', ['series: Abide'])]);
  assert.deepStrictEqual(sundayPlan(i.notes, TODAY), { action: 'ask', series: 'Abide', part: 4 });
  assert.deepStrictEqual(S.nextSeries(i.notes, TODAY), { series: 'Abide', part: 4 }, 'the same answer Home gave before');
}

/* Neither: create straight away — no Sundays at all, or last Sunday was a
   one-off with no series. */
assert.deepStrictEqual(sundayPlan([], TODAY), { action: 'create' });
assert.deepStrictEqual(sundayPlan(idx([sunday('2026-10-18')]).notes, TODAY), { action: 'create' });
/* A Sunday note dated in the future is not "today's". */
assert.deepStrictEqual(sundayPlan(idx([sunday('2026-11-01')]).notes, TODAY), { action: 'create' });

/* ---- The sheet's rows ---- */
const MED = note('Med/2026-10-25 Be still.md', ['---', 'bible-notes: meditation', `date: ${TODAY}`, '---', '']);
const STUDY = note('Study/Romans 8.md', ['---', 'bible-notes: study', `started: ${TODAY}`, '---', '']);
const COMM = note('Com/2026-10-22 Community.md', ['---', 'bible-notes: community', 'date: 2026-10-22', '---', '']);

/* Five rows, in order, each with its kind's own icon; prayer last. */
{
  const rows = createRows(idx([COMM]).notes, TODAY);
  assert.deepStrictEqual(rows.map(r => r.id), ['sunday', 'community', 'meditation', 'study', 'prayer']);
  assert.deepStrictEqual(rows.map(r => r.icon), ['church', 'users', 'sunrise', 'book-open', 'hand-heart']);
  assert.deepStrictEqual(rows.map(r => r.label), ['New Sunday note', 'New community note', 'New meditation note', 'New study note', 'Prayer request']);
  assert.ok(rows.every(r => r.open === null), 'nothing exists today');
}

/* Today's note of a kind exists: its row says "Open today's …" and carries
   the path. A study is never today's (each one is a passage that grows). A
   prayer request is always an add. */
{
  const i = idx([sunday(TODAY), MED, STUDY, COMM]);
  const rows = Object.fromEntries(createRows(i.notes, TODAY).map(r => [r.id, r]));
  assert.strictEqual(rows.sunday.label, 'Open today’s Sunday note');
  assert.strictEqual(rows.sunday.open, i.notes.find(n => n.kind === 'sunday').path);
  assert.strictEqual(rows.meditation.label, 'Open today’s meditation note');
  assert.strictEqual(rows.meditation.open, MED.path);
  assert.strictEqual(rows.community.label, 'New community note', 'the community note is from Thursday');
  assert.strictEqual(rows.study.label, 'New study note');
  assert.strictEqual(rows.study.open, null);
  assert.strictEqual(rows.prayer.label, 'Prayer request');
  assert.strictEqual(rows.prayer.open, null);
}

console.log('create OK');
