'use strict';
/* What Home's create button offers. Pure: the indexed notes and today's date
   in, a plain answer out — the sheet and the Start tile both read it, so a
   Sunday note starts the same way from either. */

const { KINDS, PRAYER } = require('./constants');
const { nextSeries } = require('./stats');

/* The Sunday flow. Today's Sunday note exists → open it. Otherwise, when the
   last Sunday before today belonged to a series, ask once whether this is its
   next part (a one-off sermon must not join a series unasked). Otherwise
   create straight away.
   → { action: 'open', path, title } | { action: 'ask', series, part } | { action: 'create' } */
function sundayPlan(notes, today) {
  const list = notes || [];
  const todays = list.find(n => n && n.kind === 'sunday' && n.date === today);
  if (todays) return { action: 'open', path: todays.path, title: todays.title };
  const next = nextSeries(list, today);
  if (next) return { action: 'ask', series: next.series, part: next.part };
  return { action: 'create' };
}

/* The sheet's rows: the four kinds, then a prayer request. `open` is the path
   of today's note of that kind, whose row says "Open today’s …" instead (a
   study is never today's, and a prayer request is always an add). */
function createRows(notes, today) {
  const rows = KINDS.map(k => {
    const todays = k.id !== 'study' && (notes || []).find(n => n && n.kind === k.id && n.date === today);
    return {
      id: k.id,
      icon: k.icon,
      label: todays ? `Open today’s ${k.id === 'sunday' ? 'Sunday' : k.id} note` : k.command,
      open: todays ? todays.path : null,
      title: todays ? todays.title : '',
    };
  });
  rows.push({ id: PRAYER.id, icon: PRAYER.icon, label: PRAYER.label, open: null, title: '' });
  return rows;
}

module.exports = { sundayPlan, createRows };
