'use strict';
/* Every change Bible Notes makes to the text of a note, as pure functions
   (text in, text out) so each can be proven to touch only what it says.
   The plugin never rebuilds a body: it flips one checkbox, adds one
   frontmatter key, or appends at the end. */

const { patchFrontmatter, detectEOL } = require('./frontmatter');
const { KIND_KEY } = require('./constants');
const { DONE_DATE } = require('./tasks');
const { longDate } = require('./dates');

const STATUS = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)(.)(\])/;

/* Tick or untick the checkbox on `line` (0-based). `expectRaw` is the line
   as it was read; if the note changed since, return null rather than flip
   whatever now sits there. Ticking adds ` ✅ YYYY-MM-DD` (the done date the
   Tasks plugin writes) unless one is there; unticking removes it. */
function toggleTask(text, line, expectRaw, done, today) {
  const lines = String(text).split('\n');
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return null;
  const cur = lines[line];
  const cr = cur.endsWith('\r');
  const bare = cr ? cur.slice(0, -1) : cur;
  if (bare !== expectRaw || !STATUS.test(bare)) return null;
  let next = bare.replace(STATUS, (all, a, s, b) => a + (done ? 'x' : ' ') + b);
  if (done && !DONE_DATE.test(next)) next = next.replace(/[ \t]+$/, '') + ` ✅ ${today}`;
  if (!done) next = next.replace(DONE_DATE, '');
  lines[line] = next + (cr ? '\r' : '');
  return lines.join('\n');
}

/* Make an existing note a Bible Notes note: one key, nothing else. */
function adopt(text, kind) {
  return patchFrontmatter(text, { [KIND_KEY]: kind });
}

/* Fill {{name}} placeholders; an unknown one is left as written. */
function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
}

/* A study session is the part of the Study template from its dated heading
   (`## {{date_long}}`) to the end. A template without one gives just the
   dated heading. */
function sessionBlock(template, iso) {
  const lines = String(template || '').split(/\r?\n/);
  const at = lines.findIndex(l => /^#{1,6}[ \t].*\{\{date_long\}\}/.test(l));
  const vars = { date: iso, date_long: longDate(iso), scripture: '' };
  const block = at < 0 ? `## ${longDate(iso)}` : renderTemplate(lines.slice(at).join('\n'), vars);
  return block.replace(/\s+$/, '') + '\n';
}

/* Append a block at the very end, in the note's own line endings, with one
   blank line before it. */
function appendSession(text, block) {
  const eol = detectEOL(text);
  const sep = text.endsWith('\n') ? eol : eol + eol;
  return text + sep + block.replace(/\s+$/, '').replace(/\r?\n/g, eol) + eol;
}

module.exports = { toggleTask, adopt, renderTemplate, sessionBlock, appendSession };
