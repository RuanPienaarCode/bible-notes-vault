'use strict';
/* The store against an in-memory vault: every vault write Bible Notes makes,
   end to end, and the order a passage opens in. Sample notes are synthetic. */
const assert = require('node:assert');
const { makeApp } = require('./_fake-app.cjs');
const { makeStore } = require('../src/store');
const { DEFAULT_SETTINGS } = require('../src/constants');
const { parseRefs } = require('../src/scripture');
const D = require('../src/dates');

const today = D.todayISO();
const lastSunday = D.addDays(today, -7);
const SETTINGS = { ...DEFAULT_SETTINGS, folders: { ...DEFAULT_SETTINGS.folders }, church: 'Grace Church' };

const VAULT = {
  [`Bible Notes/Sunday/${lastSunday} Remain in me.md`]: `---\nbible-notes: sunday\ndate: ${lastSunday}\nspeaker: Ps. Andrew\nseries: Abide\n---\n\n## Response\n- [ ] Read John 15 slowly\n`,
  'Bible Notes/Community/2026-10-01 Community.md': '---\nbible-notes: community\ndate: 2026-10-01\n---\n\n## Prayer\n- [ ] Rain for the farms\n',
  'Templates/Bible Notes/Study.md': '---\nbible-notes: study\n---\n## {{date_long}}\n\n### Noticed\n',
  'Journal/2026-10-19.md': '---\ntags: [journal]\n---\nA quiet day.\n',
  'Sermons/Old notes.md': '---\ntype: sermon\n---\nGalatians 5:22-23.\n',
  'Bible/John 15.md': '---\nbook: John\nchapter: 15\n---\n**5** I am the vine ^5\n',
};

const host = (opts) => {
  const h = makeApp(VAULT, opts);
  const plugin = { app: h.app, settings: JSON.parse(JSON.stringify(SETTINGS)), async saveSettings() { this.saved = true; } };
  return { ...h, plugin, store: makeStore(plugin) };
};

(async () => {
  /* Loading: only Bible Notes notes, never a template. */
  {
    const { store } = host();
    await store.loadAll();
    assert.deepStrictEqual([...store.notes.keys()].sort(), ['Bible Notes/Community/2026-10-01 Community.md', `Bible Notes/Sunday/${lastSunday} Remain in me.md`]);
    assert.deepStrictEqual(store.index.praying.map(p => p.task.text), ['Rain for the farms']);
  }

  /* A new Sunday note: created where settings say, last Sunday's speaker and
     church carried (never its series), opened, title focused; asking again opens the same note. */
  {
    const { store, files, opened, openStates, revealed, plugin } = host();
    await store.loadAll();
    const path = await store.createNote('sunday');
    assert.strictEqual(path, `Bible Notes/Sunday/${today} Sunday.md`);
    assert.ok(files.get(path).startsWith(`---\nbible-notes: sunday\ndate: ${today}\nspeaker: Ps. Andrew\nchurch: Grace Church\n---\n\n## Message\n`));
    assert.deepStrictEqual(opened, [path]);
    /* Opened as the active leaf and brought to the front — from Home, the
       note would otherwise open in a tab nobody can see. */
    assert.deepStrictEqual(openStates, [{ active: true }]);
    assert.deepStrictEqual(revealed, [path]);
    assert.strictEqual(plugin.focusTitleFor, path);
    assert.strictEqual(await store.createNote('sunday'), path);
    assert.strictEqual([...files.keys()].filter(k => k.startsWith(`Bible Notes/Sunday/${today}`)).length, 1);
  }

  /* Ticking: one line, with the done date; a stale line is refused with a
     notice and the note is left exactly as it was. */
  {
    const { store, files, notices } = host();
    await store.loadAll();
    const p = 'Bible Notes/Community/2026-10-01 Community.md';
    const item = store.index.praying[0];
    assert.strictEqual(await store.toggle(item.note, item.task, true), true);
    assert.strictEqual(files.get(p), `---\nbible-notes: community\ndate: 2026-10-01\n---\n\n## Prayer\n- [x] Rain for the farms ✅ ${today}\n`);
    const before = files.get(p);
    assert.strictEqual(await store.toggle(item.note, item.task, false), false, 'the read line no longer matches');
    assert.strictEqual(files.get(p), before);
    assert.strictEqual(notices.length, 1);
  }

  /* Properties, rename, a study session. */
  {
    const { store, files } = host();
    await store.loadAll();
    const p = `Bible Notes/Sunday/${lastSunday} Remain in me.md`;
    await store.setProps(p, { scripture: 'John 15:1-8' });
    assert.ok(files.get(p).includes('series: Abide\nscripture: "John 15:1-8"\n---\n\n## Response\n- [ ] Read John 15 slowly\n'), 'a colon is quoted, the body untouched');
    await store.readFile(store.getFile(p));
    const moved = await store.renameFromTitle(p, 'The vine: part 3');
    assert.strictEqual(moved, `Bible Notes/Sunday/${lastSunday} The vine. part 3.md`);
    assert.ok(files.has(moved) && !files.has(p));

    const studyPath = await store.createNote('study');
    assert.strictEqual(studyPath, 'Bible Notes/Study/New study.md');
    await store.addSession(studyPath);
    const text = files.get(studyPath);
    assert.ok(text.endsWith(`\n\n## ${D.longDate(today)}\n\n### Noticed\n`), 'the session comes from the vault’s own template');
  }

  /* Templates: written once, an existing one never touched. */
  {
    const { store, files, plugin } = host();
    await store.writeTemplatesOnce();
    assert.deepStrictEqual([...files.keys()].filter(k => k.startsWith('Templates/Bible Notes/')).sort(),
      ['Templates/Bible Notes/Community.md', 'Templates/Bible Notes/Meditation.md', 'Templates/Bible Notes/Study.md', 'Templates/Bible Notes/Sunday.md']);
    assert.strictEqual(files.get('Templates/Bible Notes/Study.md'), VAULT['Templates/Bible Notes/Study.md']);
    assert.strictEqual(plugin.settings.templatesWritten, true);
    files.delete('Templates/Bible Notes/Sunday.md');
    await store.writeTemplatesOnce();
    assert.ok(!files.has('Templates/Bible Notes/Sunday.md'), 'once means once: a template deleted later stays deleted');
  }

  /* Adopting: the candidates, then one property each. */
  {
    const { store, files } = host();
    const c = await store.adoptScan();
    assert.deepStrictEqual(c.map(x => [x.path, x.kind]), [['Sermons/Old notes.md', 'sunday']]);
    assert.strictEqual(await store.adoptApply(c), 1);
    assert.strictEqual(files.get('Sermons/Old notes.md'), '---\ntype: sermon\nbible-notes: sunday\n---\nGalatians 5:22-23.\n');
  }

  /* Opening a passage: Bible Search's reader first, then the vault's own
     chapter note, then BibleHub — falling through when Bible Search says
     no or fails. */
  {
    const vine = parseRefs('John 15:1-8')[0];
    const asked = [];
    const yes = host({ plugins: { 'bible-search': { api: { openPassage: async r => { asked.push(r); return true; } } } } });
    assert.strictEqual(await yes.store.openPassage(vine, 'x.md'), 'bible-search');
    assert.deepStrictEqual(asked, ['John 15:1-8']);
    assert.deepStrictEqual([yes.links, yes.windows], [[], []]);

    const no = host({ plugins: { 'bible-search': { api: { openPassage: async () => false } } } });
    assert.strictEqual(await no.store.openPassage(vine, 'x.md'), 'vault');
    assert.deepStrictEqual(no.links, [['John 15#^1', 'x.md']]);

    const broken = host({ plugins: { 'bible-search': { api: { openPassage: async () => { throw new Error('cannot open'); } } } } });
    const logged = [];
    const err = console.error;
    console.error = (...a) => logged.push(a.join(' '));
    try { assert.strictEqual(await broken.store.openPassage(vine, 'x.md'), 'vault'); } finally { console.error = err; }
    assert.strictEqual(logged.length, 1, 'the failure is logged once, then it falls through');

    const bare = host();
    bare.files.delete('Bible/John 15.md');
    assert.strictEqual(await bare.store.openPassage(vine, 'x.md'), 'biblehub');
    assert.deepStrictEqual(bare.windows, [['https://biblehub.com/niv/john/15.htm', '_blank', 'noopener']]);
    assert.strictEqual(bare.store.readerName(), null);
    assert.strictEqual(yes.store.readerName(), 'Bible Search');
  }

  console.log('store OK');
})().catch(e => { console.error(e); process.exit(1); });
