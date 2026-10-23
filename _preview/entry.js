/* Harness entry: mounts the REAL Home (src/home.js) and the REAL cover band
   and reading-view chips (src/cover.js, src/chips.js) on a fake plugin host
   backed by an in-memory vault. Sample notes are SYNTHETIC — this repo is
   public.
     ?theme=dark      Obsidian's theme-dark class
     ?empty=1         a vault with no Bible Notes yet (first run + adopt card)
     ?accent=green    the green accent (default indigo)
     ?now=2026-10-25T08:30   the clock Home reads (default: that Sunday morning)
     ?open=<path>     open a note in the right-hand pane
     ?phone=1         the phone's classes (is-mobile is-phone is-floating-nav)
                      and a stand-in for Obsidian's floating navigation bar
     ?w=375           the width of the Home pane in px (default 390)
     ?hide=open,pray  Home tiles hidden in the settings */
import { makeMemoryVault } from './memory-vault.js';
const { makeStore } = require('../src/store');
const { mountHome } = require('../src/home');
const { Covers } = require('../src/cover');
const { makePostProcessor } = require('../src/chips');
const { DEFAULT_SETTINGS } = require('../src/constants');
const { AdoptModal } = require('../src/adopt-modal');
const { PrayerModal } = require('../src/prayer-modal');
const { parseFrontmatter } = require('../src/frontmatter');

const q = new URLSearchParams(location.search);
document.body.classList.add(q.get('theme') === 'dark' ? 'theme-dark' : 'theme-light');
if (q.get('phone')) document.body.classList.add('is-mobile', 'is-phone', 'is-floating-nav');
if (q.get('w')) document.documentElement.style.setProperty('--home-w', Number(q.get('w')) + 'px');
const NOW = q.get('now') ? new Date(q.get('now')) : new Date(2026, 9, 25, 8, 30);
/* The store dates new notes and prayers with `new Date()`: hold the clock at
   NOW so what Home shows and what it writes agree. */
{
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(NOW.getTime()); }
    static now() { return NOW.getTime(); }
  };
}

const S = 'Bible Notes/Sunday/', C = 'Bible Notes/Community/', M = 'Bible Notes/Meditation/', T = 'Bible Notes/Study/';
const lines = (...a) => a.join('\n') + '\n';
const NOTES = {
  [S + '2026-10-04 Home.md']: lines('---', 'bible-notes: sunday', 'date: 2026-10-04', 'speaker: Ps. Andrew', 'series: Abide', 'scripture: John 14:1-4', 'church: Grace Church', '---', '', '## Message', '- A room is being prepared.', '', '## What stuck', 'Home is a person before it is a place.'),
  [S + '2026-10-11 Peace I leave with you.md']: lines('---', 'bible-notes: sunday', 'date: 2026-10-11', 'speaker: Ps. Andrew', 'series: Abide', 'scripture: John 14:27', 'church: Grace Church', '---', '', '## Message', '- Peace is given, not achieved (John 14:27).'),
  [S + '2026-10-18 Remain in me.md']: lines('---', 'bible-notes: sunday', 'date: 2026-10-18', 'speaker: Ps. Andrew', 'series: Abide', 'scripture: John 15:1-8', 'church: Grace Church', '---', '',
    '## Message', '- Jesus is the vine, the Father is the gardener (v1).', '- “Remain” means make your home here. Same word as John 14:23.', '',
    '## What stuck', 'Fruit is the overflow of staying close, not the goal of trying harder.', '',
    '## Response', '- [ ] Read John 15 slowly every morning this week', '- [x] Write down three things God pruned this year', '',
    '## Questions', '- [ ] What does pruning look like in a season of rest?'),
  [C + '2026-10-01 Community.md']: lines('---', 'bible-notes: community', 'date: 2026-10-01', 'people: [Pieter, Thandi]', '---', '', '## Discussion', 'Matthew 11:28–30 — rest that is learned.', '', '## Prayer', '- [x] Pieter’s visa came through ✅ 2026-10-25'),
  [C + '2026-10-15 Community.md']: lines('---', 'bible-notes: community', 'date: 2026-10-15', 'people: ["[[Sarah]]", Pieter]', '---', '', '## Follow up', '- [ ] Ask Sarah how we can help after the surgery', '', '## Prayer', '- [ ] Sarah’s mom — recovery after surgery'),
  [C + '2026-10-22 Community.md']: lines('---', 'bible-notes: community', 'date: 2026-10-22', 'scripture: John 15:9-17', 'people: ["[[Sarah]]", Pieter, Thandi]', '---', '',
    '## Discussion', 'Friends, not servants (John 15:15).', '', '## Prayer', '- [ ] Thandi — job interview on Thursday', '', '## Follow up', '- [ ] Message Pieter about the camp lift'),
  [M + '2026-10-21 Be still.md']: lines('---', 'bible-notes: meditation', 'date: 2026-10-21', 'scripture: Psalm 46:10', '---', '', '## Noticed', 'Stillness is trust made visible. Linked in my head with John 15:5.', '', '## Carry today', 'Stop striving before 9.'),
  [M + '2026-10-24 The Lord is my shepherd.md']: lines('---', 'bible-notes: meditation', 'date: 2026-10-24', 'scripture: Psalm 23', '---', '', '## Noticed', 'He makes me lie down — rest is his idea.'),
  [T + 'Romans 8.md']: lines('---', 'bible-notes: study', 'started: 2026-09-01', 'scripture: Romans 8', '---', '', '## Questions', '- [ ] How does 8:28 sit beside lament?', '', '## Cross references', '- John 15:26 — the Helper', '',
    '## 1 September 2026', '', '### Observe', 'No condemnation (Rom 8:1).', '', '## 16 October 2026', '', '### Observe', 'Groaning, three times (vv. 22–26).'),
};
const OTHER = {
  'People/Sarah.md': '# Sarah\n',
  'Sermons/Old notes.md': '---\ntype: sermon\n---\nNotes from a conference talk on Galatians 5:22-23.\n',
  'Journal/2026-10-19.md': '---\ntags: [journal]\n---\nA quiet day.\n',
};
const vault = makeMemoryVault(q.get('empty') ? OTHER : { ...NOTES, ...OTHER });

let noteView = null;
const plugin = {
  settings: { ...DEFAULT_SETTINGS, folders: { ...DEFAULT_SETTINGS.folders }, church: 'Grace Church', hiddenTiles: (q.get('hide') || '').split(',').filter(Boolean), accent: q.get('accent') === 'green' ? 'green' : 'indigo' },
  focusTitleFor: null,
  async saveSettings() {},
  openPrayer() { new PrayerModal(plugin.app, plugin).open(); },
  async openAdopt() { new AdoptModal(plugin.app, plugin, await plugin.store.adoptScan()).open(); },
};
plugin.app = {
  vault,
  commands: { executeCommandById: id => { console.log('[command]', id); window.__lastCommand = id; } },
  workspace: {
    getLeaf: () => ({ openFile: f => openNote(f.path) }),
    getLeavesOfType: t => (t === 'markdown' && noteView ? [{ view: noteView }] : []),
    openLinkText: link => console.log('[openLinkText]', link),
  },
  fileManager: { renameFile: (f, np) => vault.rename(f, np) },
};
/* BibleHub opens in a new tab in the app; here it is logged instead. */
window.open = url => { console.log('[open]', url); window.__lastOpened = url; return null; };

plugin.store = makeStore(plugin);
plugin.covers = new Covers(plugin);
const postProcess = makePostProcessor(plugin);

/* A reading-view stand-in in Obsidian's real container chain, with the
   body rendered by a tiny markdown subset so chips have text to find. */
function renderBody(sizer, text) {
  const { body } = parseFrontmatter(text);
  const section = document.createElement('div');
  section.className = 'bn-preview-body';
  let list = null;
  for (const raw of body.split('\n')) {
    const h = /^(#{1,6})\s+(.*)$/.exec(raw);
    const t = /^\s*[-*]\s+\[(.)\]\s+(.*)$/.exec(raw);
    const li = /^\s*[-*]\s+(.*)$/.exec(raw);
    if (!t && !li) list = null;
    if (h) { const e = document.createElement('h' + h[1].length); e.textContent = h[2]; section.append(e); continue; }
    if (t || li) {
      if (!list) { list = document.createElement('ul'); if (t) list.className = 'contains-task-list'; section.append(list); }
      const item = document.createElement('li');
      if (t) {
        item.className = 'task-list-item' + (t[1] !== ' ' ? ' is-checked' : '');
        const box = document.createElement('input');
        box.type = 'checkbox'; box.className = 'task-list-item-checkbox'; box.checked = t[1] !== ' ';
        item.append(box, document.createTextNode(t[2]));
      } else item.textContent = li[1];
      list.append(item);
      continue;
    }
    if (raw.trim()) { const p = document.createElement('p'); p.textContent = raw; section.append(p); }
  }
  sizer.append(section);
  postProcess(section, { sourcePath: noteView.file.path });
}

let current = null;
function openNote(path) {
  current = path;
  const pane = document.getElementById('note');
  pane.textContent = '';
  const file = vault.getFileByPath(path);
  if (!file) return;
  const leafContent = document.createElement('div');
  leafContent.className = 'workspace-leaf-content';
  leafContent.dataset.type = 'markdown';
  const viewContent = document.createElement('div');
  viewContent.className = 'view-content';
  const reading = document.createElement('div');
  reading.className = 'markdown-reading-view';
  const preview = document.createElement('div');
  preview.className = 'markdown-preview-view markdown-rendered node-insert-event is-readable-line-width allow-fold-headings show-indentation-guide allow-fold-lists';
  const sizer = document.createElement('div');
  sizer.className = 'markdown-preview-sizer markdown-preview-section';
  const header = document.createElement('div');
  header.className = 'mod-header';
  const inline = document.createElement('div');
  inline.className = 'inline-title';
  inline.textContent = file.basename;
  const meta = document.createElement('div');
  meta.className = 'metadata-container';
  meta.textContent = '(Obsidian’s properties panel — hidden unless raw properties are shown)';
  header.append(inline, meta);
  sizer.append(header);
  preview.append(sizer);
  reading.append(preview);
  viewContent.append(reading);
  leafContent.append(viewContent);
  pane.append(leafContent);
  noteView = { file, containerEl: leafContent, editor: null };
  renderBody(sizer, vault.files.get(path));
  plugin.covers.refresh(noteView);
}

(async () => {
  await plugin.store.loadAll();
  plugin.store.watch();
  await plugin.store.writeTemplatesOnce();
  /* Like Obsidian: the open view stays; its body re-renders and the cover
     is refreshed in place (so a focused title keeps its focus). */
  plugin.store.subscribe(() => {
    if (!current || !noteView) return;
    const file = vault.getFileByPath(current);
    if (!file) return;
    noteView.file = file;
    const sizer = noteView.containerEl.querySelector('.markdown-preview-sizer');
    const old = sizer.querySelector('.bn-preview-body');
    if (old) old.remove();
    renderBody(sizer, vault.files.get(current));
    plugin.covers.refresh(noteView);
  });
  /* A rename moves the open note with it. */
  vault.on('rename', (f, old) => { if (old === current) current = f.path; });
  const home = mountHome(document.getElementById('home'), { store: plugin.store, plugin, now: () => NOW });
  window.__bn = { plugin, vault, home, openNote };
  const open = q.get('open') || (q.get('empty') ? null : S + '2026-10-18 Remain in me.md');
  if (open) openNote(open);
})();
