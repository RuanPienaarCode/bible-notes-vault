'use strict';
/* Seam 9 — the prayer list: one note, `bible-notes: prayer`, that prayer
   requests are appended to as `- [ ] text ➕ YYYY-MM-DD`. Appending is a pure
   text-to-text function that touches nothing else; a list note feeds Home's
   Praying for (dated by the ➕, not by the note) and never counts as a note
   written: not in the week, the month, the kinds or the Sunday streak.
   Fixtures are synthetic. */
const assert = require('node:assert');
const { appendPrayer, cleanPrayer, readPrayerList } = require('../src/prayer');
const { parseTasks } = require('../src/tasks');
const { readNote } = require('../src/note');
const { buildIndex } = require('../src/index');
const { toggleTask } = require('../src/writes');
const { DEFAULT_SETTINGS, PRAYER_KIND, KIND_IDS } = require('../src/constants');
const S = require('../src/stats');
const { buildStreak } = require('../src/streak');

const TODAY = '2026-10-25';
const ok = r => { assert.strictEqual(r.ok, true, JSON.stringify(r)); return r.text; };
const FM = '---\nbible-notes: prayer\n---\n';

/* The kind and the default path. */
assert.strictEqual(PRAYER_KIND, 'prayer');
assert.ok(!KIND_IDS.includes('prayer'), 'a list is not one of the four kinds a note can be started as');
assert.strictEqual(DEFAULT_SETTINGS.prayerList, 'Bible Notes/Prayer list.md');

/* cleanPrayer: trimmed, every run of whitespace (a pasted newline too)
   collapsed to one space. */
assert.strictEqual(cleanPrayer('  Thandi’s interview  '), 'Thandi’s interview');
assert.strictEqual(cleanPrayer('Line one\nline two\r\n\tline three'), 'Line one line two line three');
assert.strictEqual(cleanPrayer(' \n\t '), '');
assert.strictEqual(cleanPrayer(undefined), '');

/* 1. A missing or empty note: frontmatter, the heading, the line. */
for (const empty of ['', null, undefined]) {
  assert.strictEqual(ok(appendPrayer(empty, 'Rain for the farms', TODAY)), FM + '\n## Praying for\n- [ ] Rain for the farms ➕ 2026-10-25\n');
}

/* 2. An existing heading: the line goes at the end of that section, before
   the next heading, after the items already there (blank lines before the
   next heading stay where they were). Nothing else changes. */
{
  const text = FM + '\n## Praying for\n- [ ] Sarah’s mom ➕ 2026-10-15\n- [x] Pieter’s visa ➕ 2026-10-01 ✅ 2026-10-20\n\n## Praise\n- thank you\n';
  assert.strictEqual(ok(appendPrayer(text, 'Thandi — interview', TODAY)),
    FM + '\n## Praying for\n- [ ] Sarah’s mom ➕ 2026-10-15\n- [x] Pieter’s visa ➕ 2026-10-01 ✅ 2026-10-20\n- [ ] Thandi — interview ➕ 2026-10-25\n\n## Praise\n- thank you\n');
  /* The last section of the file, with and without a final newline. */
  assert.strictEqual(ok(appendPrayer(FM + '\n## Praying for\n- [ ] a\n', 'b', TODAY)), FM + '\n## Praying for\n- [ ] a\n- [ ] b ➕ 2026-10-25\n');
  assert.strictEqual(ok(appendPrayer(FM + '\n## Praying for\n- [ ] a', 'b', TODAY)), FM + '\n## Praying for\n- [ ] a\n- [ ] b ➕ 2026-10-25');
  /* An empty section, heading level and case do not matter. */
  assert.strictEqual(ok(appendPrayer(FM + '\n### praying for\n\n## Later\n', 'b', TODAY)), FM + '\n### praying for\n- [ ] b ➕ 2026-10-25\n\n## Later\n');
  /* A heading-looking line inside a code fence is not a heading. */
  const fenced = FM + '\n## Praying for\n- [ ] a\n```\n## not a heading\n```\n- [ ] after the fence\n';
  assert.strictEqual(ok(appendPrayer(fenced, 'b', TODAY)), fenced + '- [ ] b ➕ 2026-10-25\n');
}

/* 3. A note without the heading: the heading is added at the end, after one
   blank line, and what was written is not touched. */
{
  const text = FM + '\n# My prayers\nSome words I wrote.\n';
  assert.strictEqual(ok(appendPrayer(text, 'Rain', TODAY)), text + '\n## Praying for\n- [ ] Rain ➕ 2026-10-25\n');
  assert.strictEqual(ok(appendPrayer(FM, 'Rain', TODAY)), FM + '\n## Praying for\n- [ ] Rain ➕ 2026-10-25\n', 'frontmatter only');
  assert.strictEqual(ok(appendPrayer(FM + '\nno newline at the end', 'Rain', TODAY)), FM + '\nno newline at the end\n\n## Praying for\n- [ ] Rain ➕ 2026-10-25\n');
}

/* 4. Text: trimmed, a newline collapsed, nothing at all rejected. */
assert.strictEqual(ok(appendPrayer('', '  Rain\nfor the farms  ', TODAY)), FM + '\n## Praying for\n- [ ] Rain for the farms ➕ 2026-10-25\n');
for (const blank of ['', '   ', '\n\n', '\t', null, undefined]) {
  assert.deepStrictEqual(appendPrayer(FM + '\n## Praying for\n', blank, TODAY), { ok: false, reason: 'empty' });
}

/* Windows line endings stay Windows line endings, in the new line and the
   new heading alike; no bare \n is introduced. */
{
  const text = '---\r\nbible-notes: prayer\r\n---\r\n\r\n## Praying for\r\n- [ ] a\r\n\r\n## Praise\r\n';
  assert.strictEqual(ok(appendPrayer(text, 'b', TODAY)), '---\r\nbible-notes: prayer\r\n---\r\n\r\n## Praying for\r\n- [ ] a\r\n- [ ] b ➕ 2026-10-25\r\n\r\n## Praise\r\n');
  const added = ok(appendPrayer('---\r\nbible-notes: prayer\r\n---\r\n', 'b', TODAY));
  assert.ok(!/[^\r]\n/.test(added), JSON.stringify(added));
}

/* A note that is not yet a prayer list: adopting adds the one key and leaves
   every other line alone. A note already something else is refused, never
   rewritten (it would not be indexed as a list). A heading-like line in the
   frontmatter is not mistaken for the section. */
{
  const plain = '# Prayers\nSome words.\n';
  const out = ok(appendPrayer(plain, 'Rain', TODAY));
  assert.strictEqual(out, '---\nbible-notes: prayer\n---\n\n# Prayers\nSome words.\n\n## Praying for\n- [ ] Rain ➕ 2026-10-25\n');
  const withFm = '---\ntags: [prayer]\n# Praying for\n---\nBody\n';
  assert.ok(ok(appendPrayer(withFm, 'Rain', TODAY)).includes('tags: [prayer]\n# Praying for\nbible-notes: prayer\n---\nBody\n\n## Praying for\n- [ ] Rain'), 'frontmatter comment is not the section');
  assert.deepStrictEqual(appendPrayer('---\nbible-notes: sunday\ndate: 2026-10-25\n---\n', 'Rain', TODAY), { ok: false, reason: 'kind', kind: 'sunday' });
}

/* A line this function writes is read back as one open prayer, dated by its ➕. */
{
  const text = ok(appendPrayer('', 'Rain for the farms', TODAY));
  const [t] = parseTasks(text, 0, { created: true });
  assert.deepStrictEqual([t.text, t.done, t.created, t.prayer], ['Rain for the farms', false, TODAY, true]);
}

/* ---- Reading a list note ---- */
const SETTINGS = { templateFolder: 'Templates/Bible Notes' };
const list = (text, path) => readPrayerList({ path: path || 'Bible Notes/Prayer list.md', basename: 'Prayer list', text, mtime: 5 }, SETTINGS);

/* Found by its property, wherever it lives; not a template; not other kinds. */
assert.strictEqual(list('# no frontmatter\n- [ ] x\n'), null);
assert.strictEqual(list('---\nbible-notes: sunday\n---\n- [ ] x\n'), null);
assert.strictEqual(list(FM + '- [ ] x\n', 'Templates/Bible Notes/Prayer list.md'), null);
assert.strictEqual(readNote({ path: 'Bible Notes/Prayer list.md', basename: 'Prayer list', text: FM + '- [ ] x\n' }, SETTINGS), null, 'readNote still reads only the four kinds');

/* Every checkbox in the list is a prayer request, under any heading; the ➕
   date is the item's start and is not part of its text; a ✅ is its answer. */
const PRAYERS = list(FM + '\n## Praying for\n- [ ] Sarah’s mom — recovery ➕ 2026-10-15\n- [x] Pieter’s visa ➕ 2026-10-01 ✅ 2026-10-20\n- [ ] Hand-written, no date\n\n## Somewhere else\n- [ ] Under another heading ➕ 2026-10-20\n- [-] cancelled ➕ 2026-10-02\n');
assert.strictEqual(PRAYERS.kind, 'prayer');
assert.strictEqual(PRAYERS.date, null, 'a list has no date of its own');
assert.strictEqual(PRAYERS.title, 'Prayer list');
assert.deepStrictEqual(PRAYERS.tasks.map(t => [t.text, t.done, t.created, t.doneDate, t.prayer]), [
  ['Sarah’s mom — recovery', false, '2026-10-15', null, true],
  ['Pieter’s visa', true, '2026-10-01', '2026-10-20', true],
  ['Hand-written, no date', false, null, null, true],
  ['Under another heading', false, '2026-10-20', null, true],
]);
assert.ok(PRAYERS.tasks.every(t => !t.text.includes('➕')), 'the ➕ date is not shown');
assert.ok(PRAYERS.tasks[0].raw.includes('➕ 2026-10-15'), 'the raw line keeps it, so a tick can find the line again');

/* In an ordinary note a ➕ stays in the text exactly as before. */
{
  const n = readNote({ path: 'Sun/2026-10-18 Remain.md', basename: '2026-10-18 Remain', text: '---\nbible-notes: sunday\ndate: 2026-10-18\n---\n## Prayer\n- [ ] Rain ➕ 2026-10-17\n' }, SETTINGS);
  assert.strictEqual(n.tasks[0].text, 'Rain ➕ 2026-10-17');
  assert.strictEqual(n.tasks[0].created, undefined);
}

/* ---- Home's index ---- */
const note = (path, lines) => readNote({ path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), text: lines.join('\n') }, SETTINGS);
const COMM = note('Com/2026-10-22 Community.md', ['---', 'bible-notes: community', 'date: 2026-10-22', '---', '', '## Prayer', '- [ ] Thandi — job interview']);
const SUN = note('Sun/2026-10-25 Home.md', ['---', 'bible-notes: sunday', 'date: 2026-10-25', '---', '']);
const MED = note('Med/2026-10-24 Be still.md', ['---', 'bible-notes: meditation', 'date: 2026-10-24', '---', '']);
const idx = buildIndex([COMM, PRAYERS, SUN, MED], TODAY);

/* Its items are Praying for and Answered; it is not a note. */
assert.deepStrictEqual(idx.praying.map(p => p.task.text), [
  'Thandi — job interview', 'Under another heading', 'Sarah’s mom — recovery', 'Hand-written, no date',
], 'newest first by the ➕ date (the community note by its own date), undated last');
assert.deepStrictEqual(idx.answered.map(a => [a.task.text, a.days]), [['Pieter’s visa', 19]], 'answered after N days counts from the ➕ date');
assert.strictEqual(idx.open.length, 0, 'prayers are not to-dos');
assert.ok(!idx.notes.includes(PRAYERS) && !idx.recent.includes(PRAYERS) && !idx.byPath.has(PRAYERS.path), 'not in the notes, recent or the path map');
assert.deepStrictEqual(idx.notes.map(n => n.kind).sort(), ['community', 'meditation', 'sunday']);
assert.deepStrictEqual(idx.series, []);
assert.deepStrictEqual(idx.passages, []);

/* A done item with no ➕ is answered, days unknown (the list has no date). */
{
  const i = buildIndex([list(FM + '- [x] Old one ✅ 2026-10-20\n')], TODAY);
  assert.deepStrictEqual(i.answered.map(a => [a.task.text, a.days]), [['Old one', null]]);
}

/* Ticking one marks it answered: the line found again by its raw text. */
{
  const t = PRAYERS.tasks[0];
  const text = FM + '\n## Praying for\n- [ ] Sarah’s mom — recovery ➕ 2026-10-15\n';
  const done = toggleTask(text, t.line, t.raw, true, TODAY);
  assert.strictEqual(done, FM + '\n## Praying for\n- [x] Sarah’s mom — recovery ➕ 2026-10-15 ✅ 2026-10-25\n');
  const back = buildIndex([list(done)], TODAY);
  assert.deepStrictEqual(back.answered.map(a => [a.task.text, a.days]), [['Sarah’s mom — recovery', 10]]);
}

/* ---- Stats and the streak never see a list, even handed one directly ---- */
const ALL = [COMM, PRAYERS, SUN, MED];
const dated = { ...PRAYERS, date: TODAY, started: TODAY }; /* the worst case: a list that somehow carries today's date */
for (const notes of [ALL, [dated, ...ALL]]) {
  assert.deepStrictEqual(S.entries(notes).map(e => e.note.kind).sort(), ['community', 'meditation', 'sunday']);
  assert.strictEqual(S.weekBars(notes, TODAY).total, 3, 'the week counts the three notes');
  assert.strictEqual(S.kindMix(notes, TODAY).total, 3);
  assert.deepStrictEqual(S.kindMix(notes, TODAY).kinds.map(k => k.kind), ['sunday', 'community', 'meditation', 'study'], 'no prayer slice');
  assert.strictEqual(S.monthBars(notes, TODAY).total, 3);
  const streak = buildStreak(notes, new Date(2026, 9, 25, 9));
  assert.strictEqual(streak.sundays, 1);
  assert.strictEqual(streak.weeks.flat().find(c => c.date === TODAY).kind, 'sunday');
}
{
  /* Alone on a Sunday, a dated list is no streak and no mark. */
  const streak = buildStreak([dated], new Date(2026, 9, 25, 9));
  assert.strictEqual(streak.empty, true);
  assert.strictEqual(streak.sundays, 0);
  assert.ok(streak.weeks.flat().every(c => c.kind === null));
  assert.strictEqual(S.kindMix([dated], TODAY).total, 0);
}

console.log('prayer OK');
