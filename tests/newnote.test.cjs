'use strict';
/* Seam 4b — creating, naming and adopting notes. */
const assert = require('node:assert');
const { readNote } = require('../src/note');
const { buildIndex } = require('../src/index');
const { planNote, renameTarget } = require('../src/newnote');
const { candidates } = require('../src/adopt');
const { parseFrontmatter } = require('../src/frontmatter');

const SETTINGS = {
  folders: { sunday: 'Church/Sunday Sermons', community: 'Church/Community', meditation: 'Faith/Meditation', study: 'Faith/Bible Study' },
  templateFolder: 'Templates/Bible Notes',
  church: 'Grace Church',
};
const note = (path, text) => readNote({ path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), text }, SETTINGS);
const existsIn = paths => p => paths.some(x => x.toLowerCase() === p.toLowerCase());

const lastSunday = note('Church/Sunday Sermons/2026-10-18 Remain in me.md',
  '---\nbible-notes: sunday\ndate: 2026-10-18\nspeaker: Ps. Andrew\nseries: Abide\nchurch: Grace Church\n---\n');
const olderSunday = note('Church/Sunday Sermons/2026-10-11 Peace.md',
  '---\nbible-notes: sunday\ndate: 2026-10-11\nspeaker: Guest\nseries: Older\n---\n');
const todayMed = note('Faith/Meditation/2026-10-25 Meditation.md', '---\nbible-notes: meditation\ndate: 2026-10-25\n---\n');
const index = buildIndex([olderSunday, lastSunday, todayMed], '2026-10-25');

/* A new Sunday note: speaker, series and church carry over from the most
   recent Sunday; empty fields are left out; the body is the template. */
{
  const p = planNote('sunday', '2026-10-25', { index, settings: SETTINGS, exists: existsIn([]), templates: {} });
  assert.strictEqual(p.create, 'Church/Sunday Sermons/2026-10-25 Sunday.md');
  assert.strictEqual(p.text, '---\nbible-notes: sunday\ndate: 2026-10-25\nspeaker: Ps. Andrew\nseries: Abide\nchurch: Grace Church\n---\n\n## Message\n\n## What stuck\n\n## Response\n\n## Questions\n');
}

/* The first Sunday ever: church from settings, nothing else invented. */
{
  const p = planNote('sunday', '2026-10-25', { index: buildIndex([], '2026-10-25'), settings: SETTINGS, exists: existsIn([]), templates: {} });
  assert.ok(p.text.startsWith('---\nbible-notes: sunday\ndate: 2026-10-25\nchurch: Grace Church\n---\n\n'));
}

/* Today's note of that kind already exists → open it, don't make a second. */
assert.deepStrictEqual(planNote('meditation', '2026-10-25', { index, settings: SETTINGS, exists: existsIn([todayMed.path]), templates: {} }), { open: todayMed.path });

/* A name already taken by another file → " 2". A study has no date in its
   name and starts today. The vault's own template wins, its extra
   frontmatter kept after ours. */
{
  const taken = existsIn(['Church/Community/2026-10-25 Community.md']);
  assert.strictEqual(planNote('community', '2026-10-25', { index, settings: SETTINGS, exists: taken, templates: {} }).create, 'Church/Community/2026-10-25 Community 2.md');
  const s = planNote('study', '2026-10-25', { index, settings: SETTINGS, exists: existsIn(['Faith/Bible Study/New study.md']), templates: {
    study: '---\ntags: [study]\n---\n## {{date_long}}\n\n### Observe\n',
  } });
  assert.strictEqual(s.create, 'Faith/Bible Study/New study 2.md');
  assert.strictEqual(s.text, '---\nbible-notes: study\nstarted: 2026-10-25\ntags: [study]\n---\n\n## 25 October 2026\n\n### Observe\n');
  assert.strictEqual(parseFrontmatter(s.text).fm['bible-notes'], 'study');
}

/* Renaming from the title: date kept in front, colon → dot, illegal
   characters folded, a clash numbered, nothing to do → null. */
{
  const n = { path: 'Church/Sunday Sermons/2026-10-25 Sunday.md', kind: 'sunday', date: '2026-10-25' };
  assert.strictEqual(renameTarget(n, 'Pruned to bear fruit', existsIn([])), 'Church/Sunday Sermons/2026-10-25 Pruned to bear fruit.md');
  assert.strictEqual(renameTarget(n, 'John 15:1-8', existsIn([])), 'Church/Sunday Sermons/2026-10-25 John 15.1-8.md');
  assert.strictEqual(renameTarget(n, 'Why? / How', existsIn([])), 'Church/Sunday Sermons/2026-10-25 Why- - How.md');
  assert.strictEqual(renameTarget(n, 'Vine', existsIn(['Church/Sunday Sermons/2026-10-25 vine.md'])), 'Church/Sunday Sermons/2026-10-25 Vine 2.md');
  assert.strictEqual(renameTarget(n, 'Sunday', existsIn([n.path])), null);
  assert.strictEqual(renameTarget(n, '   ', existsIn([])), null);
  const s = { path: 'Faith/Bible Study/New study.md', kind: 'study', date: '2026-10-25' };
  assert.strictEqual(renameTarget(s, 'Romans 8', existsIn([s.path])), 'Faith/Bible Study/Romans 8.md');
  assert.strictEqual(renameTarget(s, 'new Study', existsIn([s.path])), 'Faith/Bible Study/new Study.md', 'a case-only change is allowed');
}

/* Notes that look like they belong: by `type`, by folder. Templates and
   notes already adopted are skipped. */
{
  const fm = t => parseFrontmatter(t).fm;
  const files = [
    { path: 'Faith/Groups/Community/Messages/Grace in the ordinary.md', fm: fm('---\ntype: sermon\ntags: [community/messages]\n---\n') },
    { path: 'Church/Gathering/Morning service.md', fm: fm('') },
    { path: 'Templates/Sermon Template.md', fm: fm('---\ntype: sermon\n---\n') },
    { path: 'Church/Sunday Sermons/2026-10-18 Remain in me.md', fm: fm('---\nbible-notes: sunday\n---\n') },
    { path: 'Notes/Quiet time 3.md', fm: fm('---\ntype: devotion\n---\n') },
    { path: 'Faith/Bible Study/Romans 8 draft.md', fm: fm('---\ntags: [x]\n---\n') },
    { path: 'Journal/2026-01-05.md', fm: fm('---\ntags: [journal]\n---\n') },
    { path: 'Archive/Sermons/Old one.md', fm: fm('') },
  ];
  assert.deepStrictEqual(candidates(files, SETTINGS).map(c => [c.path, c.kind]), [
    ['Archive/Sermons/Old one.md', 'sunday'],
    ['Church/Gathering/Morning service.md', 'sunday'],
    ['Faith/Bible Study/Romans 8 draft.md', 'study'],
    ['Faith/Groups/Community/Messages/Grace in the ordinary.md', 'community'],
    ['Notes/Quiet time 3.md', 'meditation'],
  ]);
}

console.log('newnote OK');
