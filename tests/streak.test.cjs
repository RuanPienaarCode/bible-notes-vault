'use strict';
/* Seam 6 — the Sunday streak on Home: 13 weeks x 7 days of cells, and how many
   Sundays in a row have a Sunday note. Pure: notes in, cells and a count out.
   2026-10-25 is a Sunday. Fixtures are synthetic. */
const assert = require('node:assert');
const { buildStreak } = require('../src/streak');
const D = require('../src/dates');

const sunday = date => ({ kind: 'sunday', date });
const other = (kind, date) => ({ kind, date });
const at = (y, m, d) => new Date(y, m - 1, d, 9, 30);
const flat = s => s.weeks.flat();
const cellOn = (s, date) => flat(s).find(c => c.date === date);

/* The calendar the fixtures rely on. */
assert.strictEqual(D.weekday('2026-10-25'), 0, '25 Oct 2026 is a Sunday');
assert.strictEqual(D.stampDate('2026-10-25'), 'Sun 25 Oct 2026');

/* Empty vault: no notes, no run, a full grid of empty cells, and the panel
   says it is empty so Home can hide it. */
{
  const s = buildStreak([], at(2026, 10, 25));
  assert.strictEqual(s.empty, true);
  assert.strictEqual(s.sundays, 0);
  assert.strictEqual(s.weeks.length, 13);
  assert.ok(s.weeks.every(w => w.length === 7), 'every week has seven cells');
  assert.ok(flat(s).every(c => c.kind === null), 'no cell is marked');
  assert.strictEqual(buildStreak([{ kind: 'sunday', date: null }], at(2026, 10, 25)).empty, false, 'a dateless note is still a note');
}

/* Three consecutive Sundays, looked at on a Wednesday: the run is three, the
   Sunday notes are marked as Sunday, and the next one is the coming Sunday. */
{
  const notes = [sunday('2026-10-25'), sunday('2026-10-18'), sunday('2026-10-11')];
  const s = buildStreak(notes, at(2026, 10, 28));
  assert.strictEqual(s.empty, false);
  assert.strictEqual(s.sundays, 3);
  assert.deepStrictEqual(['2026-10-25', '2026-10-18', '2026-10-11'].map(d => cellOn(s, d).kind), ['sunday', 'sunday', 'sunday']);
  assert.deepStrictEqual(s.next, { date: '2026-11-01', today: false });
}

/* A missed Sunday breaks the run: 25 Oct and 18 Oct, nothing on 11 Oct, then
   4 Oct and 27 Sep, which no longer count. */
{
  const notes = [sunday('2026-10-25'), sunday('2026-10-18'), sunday('2026-10-04'), sunday('2026-09-27')];
  const s = buildStreak(notes, at(2026, 10, 25));
  assert.strictEqual(s.sundays, 2);
  assert.strictEqual(cellOn(s, '2026-10-04').kind, 'sunday', 'the older Sunday notes are still drawn');
  assert.strictEqual(cellOn(s, '2026-10-11').kind, null);
}

/* Today is a Sunday with no note yet: that does not break the run. It shows
   as "next: today", and the today cell is marked. */
{
  const notes = [sunday('2026-10-18'), sunday('2026-10-11'), sunday('2026-10-04')];
  const s = buildStreak(notes, at(2026, 10, 25));
  assert.strictEqual(s.sundays, 3);
  assert.deepStrictEqual(s.next, { date: '2026-10-25', today: true });
  const t = cellOn(s, '2026-10-25');
  assert.strictEqual(t.today, true);
  assert.strictEqual(t.kind, null);
  assert.strictEqual(flat(s).filter(c => c.today).length, 1, 'exactly one today cell');
  /* Once today's Sunday note exists it counts, and the next one is a week on. */
  const written = buildStreak(notes.concat(sunday('2026-10-25')), at(2026, 10, 25));
  assert.strictEqual(written.sundays, 4);
  assert.deepStrictEqual(written.next, { date: '2026-11-01', today: false });
  assert.strictEqual(cellOn(written, '2026-10-25').today, true, 'today stays marked when it has a note');
  assert.strictEqual(cellOn(written, '2026-10-25').kind, 'sunday');
}

/* But a Sunday that has gone by without a note does break it: on Tuesday the
   run is nothing if last Sunday was missed. */
{
  const s = buildStreak([sunday('2026-10-11'), sunday('2026-10-04')], at(2026, 10, 27));
  assert.strictEqual(s.sundays, 0);
}

/* Notes that are not Sunday notes are "other": they colour their day but never
   count toward the run, even on a Sunday. A Sunday note wins over another note
   on the same day. */
{
  const notes = [
    other('community', '2026-10-22'),              /* a Thursday */
    other('meditation', '2026-10-25'),             /* a Sunday, but not a Sunday note */
    other('study', '2026-10-20'),
    sunday('2026-10-18'), other('community', '2026-10-18'),
  ];
  const s = buildStreak(notes, at(2026, 10, 25));
  assert.strictEqual(cellOn(s, '2026-10-22').kind, 'other');
  assert.strictEqual(cellOn(s, '2026-10-20').kind, 'other');
  assert.strictEqual(cellOn(s, '2026-10-25').kind, 'other');
  assert.strictEqual(cellOn(s, '2026-10-18').kind, 'sunday');
  assert.strictEqual(s.sundays, 1, 'only 18 Oct counts: a meditation note on today\'s Sunday is not a Sunday note');
  assert.deepStrictEqual(s.next, { date: '2026-10-25', today: true });
}

/* The grid: 13 weeks, oldest first, each week Sunday to Saturday, the last
   week the one containing today. Days after today are future cells. */
{
  const s = buildStreak([sunday('2026-10-18')], at(2026, 10, 28));   /* a Wednesday */
  assert.strictEqual(s.weeks[12][0].date, '2026-10-25');
  assert.strictEqual(s.weeks[12][3].date, '2026-10-28');
  assert.strictEqual(s.weeks[12][3].today, true);
  assert.deepStrictEqual(s.weeks[12].map(c => c.future), [false, false, false, false, true, true, true]);
  assert.strictEqual(s.weeks[0][0].date, '2026-08-02', 'twelve weeks before the current one');
  assert.ok(s.weeks.every(w => D.weekday(w[0].date) === 0), 'every week starts on a Sunday');
  for (let i = 1; i < flat(s).length; i++) assert.strictEqual(D.diffDays(flat(s)[i - 1].date, flat(s)[i].date), 1, 'days are consecutive');
}

/* The run is not cut at the edge of the grid: 15 Sundays in a row is 15. */
{
  const notes = [];
  for (let i = 0; i < 15; i++) notes.push(sunday(D.addDays('2026-10-25', -7 * i)));
  const s = buildStreak(notes, at(2026, 10, 25));
  assert.strictEqual(s.sundays, 15);
  assert.strictEqual(cellOn(s, '2026-07-19'), undefined, 'older than the grid is not drawn');
}

/* Month labels sit over the first column of each month and never crowd. */
{
  const s = buildStreak([sunday('2026-10-25')], at(2026, 10, 25));
  assert.deepStrictEqual(s.months.map(m => m.label), ['Aug', 'Sep', 'Oct']);
  for (let i = 1; i < s.months.length; i++) assert.ok(s.months[i].col - s.months[i - 1].col >= 3, 'labels are at least three columns apart');
}

console.log('streak OK');
