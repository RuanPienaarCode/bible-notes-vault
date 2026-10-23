'use strict';
/* The prayer list: ONE note (`bible-notes: prayer`, path from the settings)
   that prayer requests are appended to as

     - [ ] <text> ➕ YYYY-MM-DD

   under a `## Praying for` heading — the Tasks plugin's created-date marker,
   so the line is a real task in a vault that uses Tasks. Pure: text in, text
   out. Like every write Bible Notes makes, an append touches only what it
   says: one line, the heading when the note has none, and the one
   frontmatter key when the note was not yet a prayer list. Nothing is parsed
   into a model and written back. */

const { parseFrontmatter, patchFrontmatter, detectEOL } = require('./frontmatter');
const { KIND_KEY, PRAYER_KIND, PRAYER } = require('./constants');
const { parseTasks } = require('./tasks');
const { titleOf, inFolder } = require('./note');

const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const FENCE = /^[ \t]*(```|~~~)/;

/* One line, trimmed: a pasted newline becomes a space, never a second line
   (that would leave half a request outside its checkbox). */
const cleanPrayer = s => String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();

const str = v => (v === null || v === undefined ? '' : String(Array.isArray(v) ? v[0] : v).trim());

/* Add one request, dated `today`. → { ok: true, text } or { ok: false,
   reason: 'empty' } (nothing to add) or { ok: false, reason: 'kind', kind }
   (the note is already a note of another kind: it would not be read as a
   list, so it is left alone). A missing or empty note gets frontmatter, the
   heading and the line. */
function appendPrayer(text, prayer, today) {
  const t = cleanPrayer(prayer);
  if (!t) return { ok: false, reason: 'empty' };
  const item = `- [ ] ${t} ➕ ${today}`;
  const head = `## ${PRAYER.heading}`;
  const src = text === null || text === undefined ? '' : String(text);
  if (!src.trim()) return { ok: true, text: `---\n${KIND_KEY}: ${PRAYER_KIND}\n---\n\n${head}\n${item}\n` };

  const eol = detectEOL(src);
  let cur = src;
  const kind = str(parseFrontmatter(cur).fm[KIND_KEY]).toLowerCase();
  if (kind && kind !== PRAYER_KIND) return { ok: false, reason: 'kind', kind };
  if (!kind) cur = patchFrontmatter(cur, { [KIND_KEY]: PRAYER_KIND });

  /* The body starts after the frontmatter; headings are looked for there
     only, outside code fences. */
  const { body } = parseFrontmatter(cur);
  const lines = cur.split('\n');
  const bare = i => (lines[i].endsWith('\r') ? lines[i].slice(0, -1) : lines[i]);
  const from = cur.slice(0, cur.length - body.length).split('\n').length - 1;
  let fence = null, at = -1, end = lines.length;
  for (let i = from; i < lines.length; i++) {
    const line = bare(i);
    const f = FENCE.exec(line);
    if (f) { if (!fence) fence = f[1]; else if (f[1] === fence) fence = null; continue; }
    if (fence) continue;
    const h = HEADING.exec(line);
    if (!h) continue;
    if (at < 0) { if (h[2].toLowerCase() === PRAYER.heading.toLowerCase()) at = i; } else { end = i; break; }
  }
  if (at < 0) {
    /* No such heading: it goes at the end, after one blank line. */
    const sep = cur.endsWith('\n') ? eol : eol + eol;
    return { ok: true, text: cur + sep + head + eol + item + eol };
  }
  /* The end of the section: after its last line that has anything on it. */
  let last = at;
  for (let i = at + 1; i < end; i++) if (bare(i).trim()) last = i;
  lines.splice(last + 1, 0, item + (eol === '\r\n' ? '\r' : ''));
  return { ok: true, text: lines.join('\n') };
}

/* A prayer-list note → what Home needs, in the shape readNote gives a note
   (so the index treats it alike), or null when the file is not one. Found by
   its property, wherever it lives; a template never counts. Every checkbox in
   it is a prayer request and is dated by its own ➕ — the list has no date. */
function readPrayerList(file, settings) {
  if (inFolder(file.path, settings && settings.templateFolder)) return null;
  const { fm, body } = parseFrontmatter(file.text);
  if (str(fm[KIND_KEY]).toLowerCase() !== PRAYER_KIND) return null;
  const text = String(file.text || '');
  const bodyLine = text.slice(0, text.length - body.length).split('\n').length - 1;
  return {
    path: file.path,
    basename: file.basename,
    mtime: file.mtime || 0,
    kind: PRAYER_KIND,
    date: null,
    title: titleOf(file.basename),
    speaker: '', series: '', church: '', started: null,
    people: [], scripture: [], refs: [],
    tasks: parseTasks(text, bodyLine, { created: true }),
    fm,
    body,
  };
}

module.exports = { appendPrayer, cleanPrayer, readPrayerList };
