'use strict';
/* Planning a new note and naming a note from its title. Pure: the caller
   passes the index, the settings, an `exists(path)` probe (case-insensitive,
   like the file systems Obsidian runs on) and the vault's template texts. */

const { parseFrontmatter, serializeFrontmatter, safeName } = require('./frontmatter');
const { KIND_KEY, kindOf } = require('./constants');
const { DEFAULT_TEMPLATES } = require('./templates');
const { renderTemplate } = require('./writes');
const { longDate } = require('./dates');

const join = (dir, name) => (dir ? `${dir.replace(/\/+$/, '')}/${name}` : name);

/* `base.md`, or `base 2.md`, `base 3.md`… — the first name not taken. */
function freePath(dir, base, exists, self) {
  let p = join(dir, `${base}.md`);
  for (let n = 2; exists(p) && (!self || p.toLowerCase() !== self.toLowerCase()); n++) p = join(dir, `${base} ${n}.md`);
  return p;
}

/* → { open: path } when today's note of this kind already exists (a study is
   never "today's"), else { create: path, text }. A Sunday note carries the
   speaker and church of the most recent Sunday, but not its series: a
   one-off sermon would otherwise join the last series as its next part.
   Nothing is invented, and an empty field is left out rather than written
   blank. `extra.series` is the one exception, and only because it was asked
   for: Home's "Continue <series>" passes it for a Sunday note. */
function planNote(kind, today, ctx, extra) {
  const { index, settings, exists } = ctx;
  if (kind !== 'study') {
    const same = index.notes.find(n => n.kind === kind && n.date === today);
    if (same) return { open: same.path };
  }
  const fm = { [KIND_KEY]: kind };
  if (kind === 'study') fm.started = today; else fm.date = today;
  if (kind === 'sunday') {
    const series = extra && typeof extra.series === 'string' ? extra.series.trim() : '';
    if (series) fm.series = series;
    const last = index.notes.find(n => n.kind === 'sunday' && n.date && n.date < today);
    if (last && last.speaker) fm.speaker = last.speaker;
    const church = (last && last.church) || settings.church;
    if (church) fm.church = church;
  }
  const tpl = parseFrontmatter((ctx.templates && ctx.templates[kind]) || DEFAULT_TEMPLATES[kind]);
  for (const [k, v] of Object.entries(tpl.fm)) if (!(k in fm)) fm[k] = v;
  const body = renderTemplate(tpl.body, { date: today, date_long: longDate(today), scripture: '', title: '' })
    .replace(/^(\r?\n)+/, '').replace(/\s*$/, '\n');
  const dir = (settings.folders && settings.folders[kind]) || '';
  const base = kind === 'study' ? 'New study' : `${today} ${kindOf(kind).label}`;
  return { create: freePath(dir, base, exists), text: serializeFrontmatter(fm) + '\n' + body };
}

/* The path a note should have for `title`: `YYYY-MM-DD Title.md` beside
   where it is now (a study, or a note without a date: `Title.md`). A colon
   becomes a dot (`John 15.1-8`), other characters no file system allows
   become `-`, a name another file holds gets a number. null = nothing to do. */
function renameTarget(note, title, exists) {
  const t = String(title || '').trim();
  if (!t) return null;
  const clean = safeName(t.replace(/:/g, '.'));
  const dir = note.path.includes('/') ? note.path.slice(0, note.path.lastIndexOf('/')) : '';
  const base = note.kind === 'study' || !note.date ? clean : `${note.date} ${clean}`;
  const target = freePath(dir, base, exists, note.path);
  return target === note.path ? null : target;
}

module.exports = { planNote, renameTarget, freePath };
