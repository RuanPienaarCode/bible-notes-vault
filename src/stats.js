'use strict';
/* The numbers behind Home's Bento tiles: notes per day and per week, the
   week's fullest day, days in the Word, what was written this month by kind,
   the weekly change in Still open, series progress, passage heat and the
   series a new Sunday note can continue. Pure: indexed notes and today's
   date in, plain numbers out.

   Weeks run Monday to Sunday, so a Sunday closes its week. Everything counts
   what was written up to today; a day still to come counts nothing. */

const D = require('./dates');
const { KINDS } = require('./constants');
const { chapterKeys } = require('./scripture');
const { allRefs } = require('./index');

const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const mon3 = iso => D.MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3);
const monthName = iso => D.MONTHS[Number(iso.slice(5, 7)) - 1];

/* A study session's dated heading: `## 20 October 2026`. */
const SESSION = /^#{1,6}[ \t]+(\d{1,2}) ([A-Z][a-z]+) (\d{4})[ \t]*$/gm;

function sessionDates(body) {
  const out = [];
  for (const m of String(body || '').matchAll(SESSION)) {
    const month = D.MONTHS.indexOf(m[2]);
    if (month < 0) continue;
    const iso = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (D.isRealISO(iso) && !out.includes(iso)) out.push(iso);
  }
  return out;
}

/* Everything written, on the day it was written: a dated note on its date; a
   study on each of its dated sessions, or on the day it started when it has
   none. Oldest first. */
function entries(notes) {
  const out = [];
  for (const n of notes || []) {
    if (!n) continue;
    const days = n.kind === 'study' ? sessionDates(n.body) : [];
    if (days.length) for (const date of days) out.push({ date, note: n });
    else if (n.date) out.push({ date: n.date, note: n });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function weekOf(today) {
  const start = D.addDays(today, -((D.weekday(today) + 6) % 7));
  return { start, end: D.addDays(start, 6) };
}

/* Entries on each date up to today. */
function byDate(notes, today) {
  const m = new Map();
  for (const e of entries(notes)) {
    if (e.date > today) continue;
    if (!m.has(e.date)) m.set(e.date, []);
    m.get(e.date).push(e.note);
  }
  return m;
}

const passagesIn = list => new Set(list.flatMap(n => allRefs(n).flatMap(chapterKeys))).size;

/* This week, Monday to Sunday, and its fullest day (a tie goes to the later
   day). */
function weekBars(notes, today) {
  const on = byDate(notes, today);
  const { start } = weekOf(today);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = D.addDays(start, i);
    const list = on.get(date) || [];
    days.push({ date, label: D.DAYS[D.weekday(date)].slice(0, 3), count: list.length, today: date === today, future: date > today, list });
  }
  const total = days.reduce((s, d) => s + d.count, 0);
  const max = Math.max(0, ...days.map(d => d.count));
  let fullest = null;
  for (const d of days) {
    if (d.count && d.count === max) {
      fullest = { date: d.date, label: d.label, day: D.DAYS[D.weekday(d.date)], count: d.count, passages: passagesIn(d.list), today: d.today };
    }
  }
  for (const d of days) delete d.list;
  return { days, total, max, fullest };
}

/* Notes per week for the last `weeks` weeks, oldest first; each bar is named
   by its Monday. */
function monthBars(notes, today, weeks) {
  const n = weeks || 5;
  const on = byDate(notes, today);
  const { start } = weekOf(today);
  const bars = [];
  for (let w = n - 1; w >= 0; w--) {
    const s = D.addDays(start, -7 * w);
    const e = D.addDays(s, 6);
    let count = 0;
    for (let i = 0; i < 7; i++) count += (on.get(D.addDays(s, i)) || []).length;
    bars.push({ start: s, end: e, label: `${Number(s.slice(8, 10))} ${mon3(s)}`, count, current: w === 0 });
  }
  return { bars, total: bars.reduce((s, b) => s + b.count, 0), max: Math.max(0, ...bars.map(b => b.count)) };
}

/* The week in one line, under the greeting. */
function weekInsight(notes, today) {
  const w = weekBars(notes, today);
  if (!w.total) return 'Nothing written yet this week.';
  if (w.total === 1) return 'One note so far this week.';
  if (w.max === 1) return `${w.total} notes this week, each on its own day.`;
  const f = w.fullest;
  const what = plural(f.count, 'note') + (f.passages ? ` on ${plural(f.passages, 'passage')}` : '');
  return f.today ? `Today is your fullest day this week — ${what}.` : `${f.day} was your fullest day — ${what}.`;
}

/* This month's mornings: a day with a meditation note is met, a day gone by
   without one is missed, today without one is still open. */
function daysInWord(notes, today) {
  const met = new Set(entries(notes).filter(e => e.note.kind === 'meditation' && e.date <= today).map(e => e.date));
  const first = `${today.slice(0, 8)}01`;
  const days = [];
  for (let date = first; date.slice(0, 7) === first.slice(0, 7); date = D.addDays(date, 1)) {
    const state = met.has(date) ? 'met' : date > today ? 'future' : date === today ? 'open' : 'missed';
    days.push({ date, day: Number(date.slice(8, 10)), state });
  }
  return {
    month: monthName(today),
    met: days.filter(d => d.state === 'met').length,
    missed: days.filter(d => d.state === 'missed').length,
    days,
  };
}

/* Notes written this month, by kind, each note once (a study with three
   sessions this month is one study). All four kinds, in Start order. */
function kindMix(notes, today) {
  const month = today.slice(0, 7);
  const seen = new Set();
  const count = Object.fromEntries(KINDS.map(k => [k.id, 0]));
  for (const e of entries(notes)) {
    if (e.date > today || e.date.slice(0, 7) !== month || seen.has(e.note.path)) continue;
    seen.add(e.note.path);
    if (e.note.kind in count) count[e.note.kind]++;
  }
  const kinds = KINDS.map(k => ({ kind: k.id, label: k.label, count: count[k.id] }));
  return { month: monthName(today), total: kinds.reduce((s, k) => s + k.count, 0), kinds };
}

/* Open to-dos now, minus open to-dos when this week began. A to-do was open
   then when its note is older than the week and it is open now or was ticked
   this week. A tick with no date is taken as done long ago; a note with no
   date counts the same in both, so it never moves the number. A to-do added
   this week to an older note counts as open then too: the file keeps no date
   for when a line was written. Prayer requests are not to-dos. */
function openDelta(notes, today) {
  const { start } = weekOf(today);
  let now = 0, then = 0;
  for (const n of notes || []) {
    if (!n) continue;
    const older = !n.date || n.date < start;
    for (const t of n.tasks) {
      if (t.prayer) continue;
      if (!t.done) { now++; if (older) then++; } else if (older && t.doneDate && t.doneDate >= start) then++;
    }
  }
  return now - then;
}

/* Series as progress bars: parts written, against the longest series shown.
   The newest series is the running one. */
function seriesBars(series, today, limit) {
  const list = (series || []).slice(0, limit || 3);
  const most = Math.max(1, ...list.map(s => s.notes.length));
  return list.map((s, i) => {
    const last = s.notes[s.notes.length - 1].note;
    return { name: s.name, parts: s.notes.length, ratio: s.notes.length / most, today: last.date === today, active: i === 0, path: last.path };
  });
}

/* One hue, three steps: one note, two or three, four or more. */
const heatLevel = n => (n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);

/* The series the last Sunday before today belonged to, and the part a new
   Sunday note would be — never applied without asking (a one-off sermon must
   not join it). */
const seriesKey = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
function nextSeries(notes, today) {
  const sundays = (notes || []).filter(n => n && n.kind === 'sunday' && n.date && n.date < today).sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = sundays[0];
  if (!last || !last.series) return null;
  const key = seriesKey(last.series);
  return { series: last.series, part: sundays.filter(n => n.series && seriesKey(n.series) === key).length + 1 };
}

module.exports = { entries, sessionDates, weekOf, weekBars, monthBars, weekInsight, daysInWord, kindMix, openDelta, seriesBars, heatLevel, nextSeries };
