'use strict';
/* Checkboxes in a note's text, with the heading they sit under. Pure.

   Only `[ ]` (open) and `[x]`/`[X]` (done) are items. Other statuses —
   `[-]` cancelled, `[/]` and friends from the Tasks plugin — are left alone:
   a cancelled request is neither open nor answered. */

const TASK = /^([ \t]*)([-*+]|\d+[.)])[ \t]+\[(.)\](?:[ \t]+(.*))?$/;
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const FENCE = /^[ \t]*(```|~~~)/;
const DONE_DATE = /[ \t]*✅[ \t]*(\d{4}-\d{2}-\d{2})/;
const PRAYER = /pray/i;

/* Every open or done checkbox from line `from` on (0-based, counted over the
   whole file so a write can find the line again):
   { line, raw, text, done, doneDate, prayer, heading } */
function parseTasks(text, from) {
  const lines = String(text || '').split('\n');
  const stack = [];
  let fence = null;
  const out = [];
  for (let i = from || 0; i < lines.length; i++) {
    const line = lines[i].endsWith('\r') ? lines[i].slice(0, -1) : lines[i];
    const f = FENCE.exec(line);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const h = HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      stack.length = level;
      stack[level - 1] = h[2];
      continue;
    }
    const t = TASK.exec(line);
    if (!t) continue;
    const status = t[3];
    if (status !== ' ' && status !== 'x' && status !== 'X') continue;
    let body = t[4] || '';
    const d = DONE_DATE.exec(body);
    if (d) body = body.replace(DONE_DATE, '');
    const headings = stack.filter(Boolean);
    out.push({
      line: i,
      raw: line,
      text: body.trim(),
      done: status !== ' ',
      doneDate: d ? d[1] : null,
      prayer: headings.some(x => PRAYER.test(x)),
      heading: headings.length ? headings[headings.length - 1] : null,
    });
  }
  return out;
}

module.exports = { parseTasks, TASK, DONE_DATE };
