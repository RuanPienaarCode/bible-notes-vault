'use strict';
/* One note → what Bible Notes knows about it: kind, date, title, passages,
   checkboxes. Pure — the caller hands in the file's text. */

const { parseFrontmatter } = require('./frontmatter');
const { KIND_KEY, KIND_IDS } = require('./constants');
const { isRealISO } = require('./dates');
const { parseRefs, parseProperty } = require('./scripture');
const { parseTasks } = require('./tasks');

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:[ _-]+|$)/;

const str = v => (v === null || v === undefined ? '' : String(Array.isArray(v) ? v[0] : v).trim());

function inFolder(path, folder) {
  const f = String(folder || '').replace(/^\/+|\/+$/g, '');
  return !!f && (path === f || path.startsWith(f + '/'));
}

/* The title is the file name without its date: `2026-10-25 Pruned to bear
   fruit` → `Pruned to bear fruit`. */
function titleOf(basename) {
  const m = DATE_PREFIX.exec(basename);
  return m ? basename.slice(m[0].length).trim() : basename;
}

/* `[[Sarah]]`, `[[People/Thandi M|Thandi]]` or plain `Pieter` → a display
   name, and whether it was written as a link. */
const WIKI = /^\[\[([^\]|]*)(?:\|([^\]]*))?\]\]$/;
function person(v) {
  const s = String(v).trim();
  const m = WIKI.exec(s);
  if (!m) return { name: s, linked: false };
  const target = m[1].trim();
  return { name: (m[2] || target.slice(target.lastIndexOf('/') + 1)).trim(), linked: true };
}
const list = v => (Array.isArray(v) ? v : (v === null || v === undefined || v === '' ? [] : [v]));

function readNote(file, settings) {
  if (inFolder(file.path, settings && settings.templateFolder)) return null;
  const { fm, body } = parseFrontmatter(file.text);
  const kind = str(fm[KIND_KEY]).toLowerCase();
  if (!KIND_IDS.includes(kind)) return null;
  const m = DATE_PREFIX.exec(file.basename);
  const date = [str(fm.date), m ? m[1] : '', str(fm.started)].find(isRealISO) || null;
  /* The body is the tail of the text, so the lines before it are the
     frontmatter (and the gap after it). */
  const text = String(file.text || '');
  const bodyLine = text.slice(0, text.length - body.length).split('\n').length - 1;
  return {
    path: file.path,
    basename: file.basename,
    mtime: file.mtime || 0,
    kind,
    date,
    title: titleOf(file.basename),
    speaker: str(fm.speaker),
    series: str(fm.series),
    church: str(fm.church),
    started: isRealISO(str(fm.started)) ? str(fm.started) : null,
    people: list(fm.people).map(person).filter(p => p.name),
    scripture: parseProperty(fm.scripture),
    refs: parseRefs(body),
    tasks: parseTasks(text, bodyLine),
    fm,
    body,
  };
}

module.exports = { readNote, titleOf, inFolder };
