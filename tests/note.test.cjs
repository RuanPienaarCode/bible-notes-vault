'use strict';
/* Seam 2 — reading one note into what the plugin knows about it. */
const assert = require('node:assert');
const { readNote } = require('../src/note');

const SETTINGS = { templateFolder: 'Templates/Bible Notes' };
const file = (path, text, mtime) => ({ path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), text, mtime: mtime || 0 });

/* Kind, date and title. */
{
  const n = readNote(file('Church/Sunday Sermons/2026-10-25 Pruned to bear fruit.md',
    '---\nbible-notes: sunday\ndate: 2026-10-25\nspeaker: Ps. Andrew\nseries: Abide\n---\n\n## Message\n'), SETTINGS);
  assert.strictEqual(n.kind, 'sunday');
  assert.strictEqual(n.date, '2026-10-25');
  assert.strictEqual(n.title, 'Pruned to bear fruit');
  assert.strictEqual(n.speaker, 'Ps. Andrew');
  assert.strictEqual(n.series, 'Abide');
}

/* Not a Bible Notes note, or the kind is unknown → null. */
assert.strictEqual(readNote(file('Journal/2026-10-20.md', '---\ntags: [x]\n---\nhello'), SETTINGS), null);
assert.strictEqual(readNote(file('A.md', '---\nbible-notes: podcast\n---\n'), SETTINGS), null);
assert.strictEqual(readNote(file('A.md', 'no frontmatter at all'), SETTINGS), null);

/* Templates are never notes, even when they carry the kind. */
assert.strictEqual(readNote(file('Templates/Bible Notes/Sunday.md', '---\nbible-notes: sunday\n---\n'), SETTINGS), null);

/* Date falls back to the file name, then to `started`; title without a date
   prefix is the whole name; an untitled note is named after its kind. */
{
  const a = readNote(file('X/2026-10-22 Community.md', '---\nbible-notes: Community\n---\n'), SETTINGS);
  assert.strictEqual(a.kind, 'community', 'kind is case-insensitive');
  assert.strictEqual(a.date, '2026-10-22');
  assert.strictEqual(a.title, 'Community');
  const s = readNote(file('X/Romans 8.md', '---\nbible-notes: study\nstarted: 2026-09-01\n---\n'), SETTINGS);
  assert.strictEqual(s.date, '2026-09-01');
  assert.strictEqual(s.title, 'Romans 8');
  const bad = readNote(file('X/Grace.md', '---\nbible-notes: community\ndate: 2026-13-45\n---\n'), SETTINGS);
  assert.strictEqual(bad.date, null, 'an impossible date is no date');
}

/* Passages: the property (chapter-only allowed, unrecognised kept) and the
   verse-level references written in the body. */
{
  const n = readNote(file('X/2026-10-25 Vine.md', [
    '---', 'bible-notes: sunday', 'scripture: [John 15:1-8, the vine]', '---', '',
    '## Message', '- Same word as John 14:23.', '- Romans 8 is a chapter, not a verse here.', '',
  ].join('\n')), SETTINGS);
  assert.deepStrictEqual(n.scripture.map(e => e.raw), ['John 15:1-8', 'the vine']);
  assert.deepStrictEqual(n.scripture.map(e => e.refs.map(r => r.label)), [['John 15:1–8'], []]);
  assert.deepStrictEqual(n.refs.map(r => r.label), ['John 14:23']);
}

/* Checkboxes. Line numbers count from the top of the FILE (frontmatter
   included) so a write can find the line again. Under a heading that
   mentions prayer — at any level above — a checkbox is a prayer request.
   `✅ date` is read and kept out of the text. Cancelled `[-]` and anything
   inside a code fence is not an item. */
{
  const text = [
    '---',                                   // 0
    'bible-notes: community',                // 1
    'date: 2026-10-01',                      // 2
    '---',                                   // 3
    '',                                      // 4
    '## Follow up',                          // 5
    '- [ ] Message Pieter about the camp lift', // 6
    '- [x] Book the hall ✅ 2026-10-03',      // 7
    '- [-] Cancelled thing',                 // 8
    '',                                      // 9
    '## Prayer',                             // 10
    '- [ ] Thandi — job interview',          // 11
    '### Pieter',                            // 12
    '* [x] Visa came through ✅ 2026-10-25',  // 13
    '```',                                   // 14
    '- [ ] not an item, inside a fence',     // 15
    '```',                                   // 16
    '## Questions',                          // 17
    '  - [ ] What does pruning look like?',  // 18
  ].join('\n');
  const n = readNote(file('X/2026-10-01 Community.md', text), SETTINGS);
  assert.deepStrictEqual(n.tasks.map(t => [t.line, t.text, t.done, t.doneDate, t.prayer, t.heading]), [
    [6, 'Message Pieter about the camp lift', false, null, false, 'Follow up'],
    [7, 'Book the hall', true, '2026-10-03', false, 'Follow up'],
    [11, 'Thandi — job interview', false, null, true, 'Prayer'],
    [13, 'Visa came through', true, '2026-10-25', true, 'Pieter'],
    [18, 'What does pruning look like?', false, null, false, 'Questions'],
  ]);
  assert.strictEqual(n.tasks[0].raw, '- [ ] Message Pieter about the camp lift', 'raw is the exact line, for the stale-write check');
}

/* Windows line endings: same line numbers, no stray \r in the text. */
{
  const n = readNote(file('X/2026-10-01 C.md', '---\r\nbible-notes: community\r\n---\r\n\r\n## Prayer\r\n- [ ] Rain\r\n'), SETTINGS);
  assert.deepStrictEqual(n.tasks.map(t => [t.line, t.text, t.raw]), [[5, 'Rain', '- [ ] Rain']]);
}

/* Who was there: links are unwrapped for display, and remembered as links. */
{
  const n = readNote(file('X/2026-10-22 Community.md',
    '---\nbible-notes: community\npeople:\n  - "[[Sarah]]"\n  - Pieter\n  - "[[People/Thandi M|Thandi]]"\n---\n'), SETTINGS);
  assert.deepStrictEqual(n.people, [
    { name: 'Sarah', linked: true }, { name: 'Pieter', linked: false }, { name: 'Thandi', linked: true },
  ]);
  const none = readNote(file('X/2026-10-22 Community.md', '---\nbible-notes: community\n---\n'), SETTINGS);
  assert.deepStrictEqual(none.people, []);
}

console.log('note OK');
