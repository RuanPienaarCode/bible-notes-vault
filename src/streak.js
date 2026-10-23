'use strict';
/* The Sunday streak on Home: a contribution-graph grid of the last 13 weeks
   (Sunday to Saturday, oldest first) and how many Sundays in a row have a
   Sunday note. Pure: the indexed notes and `now` in, cells and a count out.

   A day is marked 'sunday' when a Sunday note is dated that day, 'other' when
   only some other Bible Notes note is. The run counts calendar Sundays that
   carry a Sunday note, newest first. A Sunday that is today and has no note
   yet does not break the run (it is "next: today"); a Sunday that has gone by
   without one does. The run is not cut at the edge of the grid. */

const D = require('./dates');

const WEEKS = 13;
const MIN_LABEL_GAP = 3;

function buildStreak(notes, now) {
  const today = D.todayISO(now);
  const list = (notes || []).filter(Boolean);

  /* date -> 'sunday' | 'other' */
  const marks = new Map();
  for (const n of list) {
    if (!n.date) continue;
    if (n.kind === 'sunday') marks.set(n.date, 'sunday');
    else if (!marks.has(n.date)) marks.set(n.date, 'other');
  }

  const thisSunday = D.addDays(today, -D.weekday(today));
  const weeks = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const start = D.addDays(thisSunday, -7 * w);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = D.addDays(start, i);
      days.push({ date, kind: marks.get(date) || null, today: date === today, future: date > today });
    }
    weeks.push(days);
  }

  /* The run, newest Sunday first. */
  const hasSunday = date => marks.get(date) === 'sunday';
  let cursor = thisSunday;
  if (cursor === today && !hasSunday(cursor)) cursor = D.addDays(cursor, -7);
  let sundays = 0;
  while (hasSunday(cursor)) { sundays++; cursor = D.addDays(cursor, -7); }

  /* The next Sunday note to write: today when it is a Sunday without one. */
  const next = thisSunday === today && !hasSunday(today)
    ? { date: today, today: true }
    : { date: D.addDays(thisSunday, 7), today: false };

  /* A month label over the first column of each month, thinned from the
     newest end so two labels are never closer than three columns. */
  const candidates = [];
  weeks.forEach((w, col) => {
    const month = D.MONTHS[Number(w[0].date.slice(5, 7)) - 1].slice(0, 3);
    if (!candidates.length || candidates[candidates.length - 1].label !== month) candidates.push({ col, label: month });
  });
  const months = [];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i];
    if (!months.length || months[0].col - c.col >= MIN_LABEL_GAP) months.unshift(c);
  }

  return { empty: list.length === 0, weeks, sundays, next, months };
}

module.exports = { buildStreak, WEEKS };
