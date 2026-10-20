'use strict';
/* Every Bible Notes note → what Home shows: still open, praying for,
   answered, recent, the passage index and the series. Pure: notes come from
   note.readNote, nothing here touches the vault. */

const { chapterKeys, chapters, BOOKS } = require('./scripture');
const { diffDays } = require('./dates');

const RECENT = 8;

/* Newest first. A note without a date sorts after every dated note, then by
   last edit. */
function byNewest(a, b) {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (!!a.date !== !!b.date) return a.date ? -1 : 1;
  if (a.mtime !== b.mtime) return b.mtime - a.mtime;
  return a.title.localeCompare(b.title);
}

/* Every reference a note makes: its scripture property and the verses
   written in its body. */
const allRefs = n => n.scripture.flatMap(e => e.refs).concat(n.refs);

function passageIndex(notes) {
  const books = new Map();
  for (const n of notes) {
    for (const ref of allRefs(n)) {
      const keys = chapterKeys(ref);
      chapters(ref).forEach((c, i) => {
        if (!books.has(ref.bookIndex)) books.set(ref.bookIndex, new Map());
        const chs = books.get(ref.bookIndex);
        if (!chs.has(c)) chs.set(c, { chapter: c, key: keys[i], notes: [] });
        const entry = chs.get(c);
        if (!entry.notes.includes(n)) entry.notes.push(n);
      });
    }
  }
  return [...books.entries()].sort((a, b) => a[0] - b[0]).map(([bi, chs]) => ({
    book: BOOKS[bi].name,
    bookIndex: bi,
    chapters: [...chs.values()].sort((a, b) => a.chapter - b.chapter).map(c => ({ ...c, notes: c.notes.slice().sort(byNewest) })),
  }));
}

function seriesIndex(notes) {
  const groups = new Map();
  for (const n of notes.slice().sort((a, b) => byNewest(b, a))) {
    if (n.kind !== 'sunday' || !n.series) continue;
    const key = n.series.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!groups.has(key)) groups.set(key, { name: n.series, notes: [] });
    const g = groups.get(key);
    g.notes.push({ note: n, part: g.notes.length + 1 });
  }
  return [...groups.values()]
    .map(g => ({ ...g, latest: g.notes[g.notes.length - 1].note.date }))
    .sort((a, b) => byNewest(a.notes[a.notes.length - 1].note, b.notes[b.notes.length - 1].note));
}

function buildIndex(input, today) {
  const notes = input.filter(Boolean).slice().sort(byNewest);
  const open = [], praying = [], answered = [];
  for (const n of notes) {
    for (const t of n.tasks) {
      if (t.prayer) {
        if (!t.done) praying.push({ note: n, task: t });
        else answered.push({ note: n, task: t, days: t.doneDate && n.date ? diffDays(n.date, t.doneDate) : null });
      } else if (!t.done) {
        open.push({ note: n, task: t });
      }
    }
  }
  answered.sort((a, b) => {
    if (a.task.doneDate && b.task.doneDate) return a.task.doneDate < b.task.doneDate ? 1 : (a.task.doneDate > b.task.doneDate ? -1 : 0);
    return a.task.doneDate ? -1 : (b.task.doneDate ? 1 : 0);
  });
  return {
    today,
    notes,
    byPath: new Map(notes.map(n => [n.path, n])),
    recent: notes.slice(0, RECENT),
    open,
    praying,
    answered,
    passages: passageIndex(notes),
    series: seriesIndex(notes),
  };
}

/* The open to-dos a note inherits: from every note dated before it (all
   other notes when it has no date). */
function carriedInto(index, note) {
  return index.open.filter(o => o.note.path !== note.path && (!note.date || (o.note.date && o.note.date < note.date)));
}

function partOf(index, note) {
  for (const s of index.series) for (const x of s.notes) if (x.note.path === note.path) return x.part;
  return null;
}

/* Every note on one chapter key ("John 15"), newest first. */
function notesOn(index, key) {
  for (const b of index.passages) for (const c of b.chapters) if (c.key === key) return c.notes;
  return [];
}

module.exports = { buildIndex, carriedInto, partOf, notesOn, byNewest, allRefs };
