'use strict';
/* Seam 7 — the Bento tiles on Home: notes per day, the week's fullest day,
   days in the Word, what you wrote by kind, the weekly change in Still open,
   series progress, passage heat and the series a Sunday note can continue.
   Pure: notes in, numbers out. 2026-10-25 is a Sunday; weeks run Monday to
   Sunday. Fixtures are synthetic. */
const assert = require('node:assert');
const { readNote } = require('../src/note');
const { buildIndex } = require('../src/index');
const S = require('../src/stats');

const SET = { templateFolder: 'Templates/Bible Notes' };
const note = (path, fm, body) => readNote({
  path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''),
  text: ['---', ...fm, '---', '', ...(body || [])].join('\n'),
}, SET);
const sun = (date, title, series, scripture, body) => note(`Sun/${date} ${title}.md`, ['bible-notes: sunday', `date: ${date}`, ...(series ? [`series: ${series}`] : []), ...(scripture ? [`scripture: ${scripture}`] : [])], body);
const med = (date, title, scripture) => note(`Med/${date} ${title}.md`, ['bible-notes: meditation', `date: ${date}`, `scripture: ${scripture}`]);

/* This week (Mon 19 – Sun 25 Oct): Tue a study session, Wed one meditation,
   Thu a meditation and a community night, Sun the sermon, a meditation on the
   same chapter and a study session. */
const H = sun('2026-10-25', 'Pruned to bear fruit', 'Abide', 'John 15:1-8');
const M25 = med('2026-10-25', 'Fruit', 'John 15:4');
const M22 = med('2026-10-22', 'Be still', 'Psalm 46:10');
const M21 = med('2026-10-21', 'Shepherd', 'Psalm 23');
const M02 = med('2026-10-02', 'Morning', 'Psalm 1');
const M01 = med('2026-10-01', 'First light', 'Psalm 5');
const M01b = med('2026-10-01', 'Evening', 'Psalm 4');
const MSEP = med('2026-09-30', 'Last of September', 'Psalm 90');
const COM = note('Com/2026-10-22 Community.md', ['bible-notes: community', 'date: 2026-10-22', 'scripture: John 15:9-17'], [
  '## Follow up', '- [ ] Message Pieter about the camp lift', '## Praying for', '- [ ] Thandi — job interview']);
const ROM = note('Study/Romans 8.md', ['bible-notes: study', 'started: 2026-09-01', 'scripture: Romans 8'], [
  '## 20 October 2026', 'No condemnation.', '## 25 October 2026', 'Groaning.']);
const JAS = note('Study/James.md', ['bible-notes: study', 'started: 2026-10-08', 'scripture: James 1'], ['Faith and works.']);
/* Earlier Sundays: Abide parts 1–3, a long finished series and a one-off. */
const A3 = sun('2026-10-18', 'Remain in me', 'Abide', 'John 15:1-8', [
  '## Response', '- [ ] Read John 15 slowly every morning', '- [x] Write down three things ✅ 2026-10-20',
  '- [x] Ask Sarah about the meal rota ✅ 2026-10-23', '- [x] Old thing ✅ 2026-10-10', '- [x] Undated done thing']);
const A2 = sun('2026-10-11', 'Peace I leave with you', 'Abide', 'John 14:27');
const A1 = sun('2026-10-04', 'Home', 'Abide', 'John 14:23');
const KC = ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06'].map((d, i) => sun(d, `Kingdom ${i + 1}`, 'Kingdom Come', 'Matthew 6:10'));
const FA = sun('2026-09-13', 'Beyond a cerebral faith', 'Faith', 'Hebrews 11:1');
const NODATE = note('Misc/Loose.md', ['bible-notes: community'], ['- [ ] A dateless to-do']);

const ALL = [H, M25, M22, M21, M02, M01, M01b, MSEP, COM, ROM, JAS, A3, A2, A1, ...KC, FA, NODATE];

/* ---- weeks run Monday to Sunday ---- */
assert.deepStrictEqual(S.weekOf('2026-10-25'), { start: '2026-10-19', end: '2026-10-25' }, 'a Sunday closes its week');
assert.deepStrictEqual(S.weekOf('2026-10-19'), { start: '2026-10-19', end: '2026-10-25' }, 'a Monday opens it');
assert.deepStrictEqual(S.weekOf('2026-10-26'), { start: '2026-10-26', end: '2026-11-01' });

/* ---- entries: everything written, on the day it was written ---- */
{
  const dates = n => S.entries([n]).map(e => e.date);
  assert.deepStrictEqual(dates(ROM), ['2026-10-20', '2026-10-25'], 'a study counts on each dated session, not its start');
  assert.deepStrictEqual(dates(JAS), ['2026-10-08'], 'a study with no session counts on the day it started');
  assert.deepStrictEqual(dates(H), ['2026-10-25']);
  assert.deepStrictEqual(dates(NODATE), [], 'a note without a date is on no day');
  const all = S.entries(ALL);
  assert.ok(all.every((e, i) => i === 0 || all[i - 1].date <= e.date), 'oldest first');
}

/* ---- notes this week, per day ---- */
{
  const w = S.weekBars(ALL, '2026-10-25');
  assert.deepStrictEqual(w.days.map(d => d.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepStrictEqual(w.days.map(d => d.count), [0, 1, 1, 2, 0, 0, 3]);
  assert.deepStrictEqual(w.days.map(d => d.today), [false, false, false, false, false, false, true]);
  assert.ok(w.days.every(d => !d.future));
  assert.strictEqual(w.total, 7);
  assert.strictEqual(w.max, 3);
  /* Sunday: the sermon and the meditation are both on John 15, the study
     session on Romans 8 — three notes on two passages. */
  assert.deepStrictEqual(w.fullest, { date: '2026-10-25', label: 'Sun', day: 'Sunday', count: 3, passages: 2, today: true });

  /* Looked at on the Thursday, with only what existed then: Friday to Sunday
     are still to come, and Thursday is the fullest day so far. */
  const thu = S.weekBars([M22, M21, COM, ROM, A3], '2026-10-22');
  assert.deepStrictEqual(thu.days.map(d => d.future), [false, false, false, false, true, true, true]);
  assert.deepStrictEqual(thu.days.map(d => d.count), [0, 1, 1, 2, 0, 0, 0]);
  assert.deepStrictEqual(thu.fullest, { date: '2026-10-22', label: 'Thu', day: 'Thursday', count: 2, passages: 2, today: true });

  /* A tie goes to the latest day. */
  assert.strictEqual(S.weekBars([M21, M22], '2026-10-25').fullest.date, '2026-10-22');
  /* Nothing this week: no fullest day. */
  const empty = S.weekBars([A3], '2026-10-25');
  assert.strictEqual(empty.total, 0);
  assert.strictEqual(empty.fullest, null);
}

/* ---- the week in one line ---- */
assert.strictEqual(S.weekInsight(ALL, '2026-10-25'), 'Today is your fullest day this week — 3 notes on 2 passages.');
assert.strictEqual(S.weekInsight([M22, M21, COM, ROM, A3, H], '2026-10-26'), 'Nothing written yet this week.', 'a new week starts empty');
assert.strictEqual(S.weekInsight([M22, COM, M21], '2026-10-24'), 'Thursday was your fullest day — 2 notes on 2 passages.');
assert.strictEqual(S.weekInsight([M21], '2026-10-24'), 'One note so far this week.');
assert.strictEqual(S.weekInsight([M21, M22], '2026-10-25'), '2 notes this week, each on its own day.');
assert.strictEqual(S.weekInsight([sun('2026-10-25', 'Untitled'), med('2026-10-25', 'Two', 'Nothing here')], '2026-10-25'), 'Today is your fullest day this week — 2 notes.', 'no passage → no passage count');

/* ---- notes per week, the last five weeks ---- */
{
  const m = S.monthBars(ALL, '2026-10-25');
  assert.deepStrictEqual(m.bars.map(b => b.start), ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']);
  assert.deepStrictEqual(m.bars.map(b => b.label), ['21 Sep', '28 Sep', '5 Oct', '12 Oct', '19 Oct']);
  /* 28 Sep–4 Oct: MSEP, M01, M01b, M02, A1. 5–11 Oct: JAS, A2. 12–18 Oct: A3. */
  assert.deepStrictEqual(m.bars.map(b => b.count), [0, 5, 2, 1, 7]);
  assert.deepStrictEqual(m.bars.map(b => b.current), [false, false, false, false, true]);
  assert.strictEqual(m.total, 15);
  assert.strictEqual(m.max, 7);
  assert.strictEqual(S.monthBars(ALL, '2026-10-25', 3).bars.length, 3);
}

/* ---- days in the Word: morning meditations this month ---- */
{
  const d = S.daysInWord(ALL, '2026-10-25');
  assert.strictEqual(d.month, 'October');
  assert.strictEqual(d.days.length, 31);
  /* 1 (twice), 2, 21, 22 and 25 met; every other day up to the 24th missed. */
  assert.strictEqual(d.met, 5);
  assert.strictEqual(d.missed, 20);
  assert.deepStrictEqual(d.days.filter(x => x.state === 'met').map(x => x.day), [1, 2, 21, 22, 25]);
  assert.ok(d.days.slice(25).every(x => x.state === 'future'), '26–31 are still to come');
  assert.strictEqual(d.days[0].date, '2026-10-01');

  /* Saturday morning, nothing yet today: today is open, not missed. */
  const sat = S.daysInWord(ALL.filter(n => n !== M25 && n !== H), '2026-10-24');
  assert.strictEqual(sat.days[23].state, 'open');
  assert.strictEqual(sat.met, 4);
  assert.strictEqual(sat.missed, 19);
  /* February in a leap year has 29 days; September's meditation is not October's. */
  assert.strictEqual(S.daysInWord([], '2028-02-10').days.length, 29);
  assert.strictEqual(S.daysInWord([MSEP], '2026-10-25').met, 0);
}

/* ---- what you wrote this month, by kind ---- */
{
  const k = S.kindMix(ALL, '2026-10-25');
  assert.strictEqual(k.month, 'October');
  /* Sunday 4, 11, 18, 25 Oct; community 22 Oct; meditations 1, 1, 2, 21, 22,
     25 Oct; studies Romans 8 (sessions this month, counted once) and James. */
  assert.deepStrictEqual(k.kinds.map(x => [x.kind, x.count]), [['sunday', 4], ['community', 1], ['meditation', 6], ['study', 2]]);
  assert.deepStrictEqual(k.kinds.map(x => x.label), ['Sunday', 'Community', 'Meditation', 'Study']);
  assert.strictEqual(k.total, 13);
  assert.strictEqual(S.kindMix([], '2026-10-25').total, 0);
}

/* ---- the weekly change in Still open ---- */
{
  /* Open now: "Read John 15" and "Message Pieter" (prayer requests are not to-dos;
     the dateless note's to-do is in both counts). Open on Monday morning:
     "Read John 15", plus the two ticked since (20 and 23 Oct). "Old thing" was
     done before the week; a tick with no date is taken as done long ago. */
  assert.strictEqual(S.openDelta(ALL, '2026-10-25'), -1);
  assert.strictEqual(S.openDelta([COM], '2026-10-25'), 1, 'a new note this week adds its to-dos');
  assert.strictEqual(S.openDelta([], '2026-10-25'), 0);
}

/* ---- series progress ---- */
{
  const idx = buildIndex(ALL, '2026-10-25');
  const bars = S.seriesBars(idx.series, '2026-10-25');
  assert.deepStrictEqual(bars.map(b => [b.name, b.parts]), [['Abide', 4], ['Faith', 1], ['Kingdom Come', 6]]);
  assert.deepStrictEqual(bars.map(b => b.ratio), [4 / 6, 1 / 6, 1]);
  assert.deepStrictEqual(bars.map(b => b.today), [true, false, false]);
  assert.deepStrictEqual(bars.map(b => b.active), [true, false, false], 'the newest series is the one running');
  assert.strictEqual(bars[0].path, H.path, 'a bar opens the latest part');
  assert.strictEqual(S.seriesBars(idx.series, '2026-10-25', 2).length, 2);
  assert.deepStrictEqual(S.seriesBars([], '2026-10-25'), []);
}

/* ---- passage heat: one hue, three steps ---- */
assert.deepStrictEqual([0, 1, 2, 3, 4, 9].map(S.heatLevel), [0, 1, 2, 2, 3, 3]);

/* ---- the series a new Sunday note can continue ---- */
assert.deepStrictEqual(S.nextSeries(ALL, '2026-10-28'), { series: 'Abide', part: 5 });
assert.deepStrictEqual(S.nextSeries(ALL, '2026-10-25'), { series: 'Abide', part: 4 }, 'only Sundays before today count');
assert.strictEqual(S.nextSeries([FA, sun('2026-09-20', 'One-off')], '2026-09-27'), null, 'the last Sunday had no series');
assert.strictEqual(S.nextSeries([], '2026-10-25'), null);

console.log('stats OK');
