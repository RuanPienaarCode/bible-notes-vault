'use strict';
/* Calendar dates as YYYY-MM-DD strings, computed in UTC so no time zone or
   daylight-saving shift can move a day. Pure. */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = n => String(n).padStart(2, '0');
const toUTC = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

/* A real calendar date in YYYY-MM-DD form — 2026-13-45 has the shape but is
   not a date. */
function isRealISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(toUTC(s));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` === s;
}

/* Today in the device's own time zone. */
function todayISO(now) {
  const d = now || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* Whole days from a to b (b later → positive). */
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);

function addDays(iso, n) {
  const d = new Date(toUTC(iso) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const parts = iso => { const d = new Date(toUTC(iso)); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), w: d.getUTCDay() }; };

/* "25 October 2026" */
function longDate(iso) { const p = parts(iso); return `${p.d} ${MONTHS[p.m]} ${p.y}`; }
/* "Sunday, 25 October" */
function dayHeading(iso) { const p = parts(iso); return `${DAYS[p.w]}, ${p.d} ${MONTHS[p.m]}`; }
/* "Sun", "25 Oct" — the short date beside a row: weekday within the last
   week, day and month otherwise. */
function shortDate(iso, today) {
  const p = parts(iso);
  const ago = diffDays(iso, today);
  if (ago === 0) return 'Today';
  if (ago > 0 && ago < 7) return DAYS[p.w].slice(0, 3);
  return `${p.d} ${MONTHS[p.m].slice(0, 3)}`;
}
const weekday = iso => parts(iso).w;

module.exports = { isRealISO, todayISO, diffDays, addDays, longDate, dayHeading, shortDate, weekday, MONTHS, DAYS };
