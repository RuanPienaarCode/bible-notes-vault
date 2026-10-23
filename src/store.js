'use strict';
/* Vault IO — every read and write Bible Notes makes goes through here, on
   the Vault API only (desktop and iOS). Writes go through vault.process with
   the pure text functions in writes.js, so a body is never rebuilt.

   Frontmatter is patched as text (frontmatter.js, vendored from Rhythm with
   its tests) rather than through FileManager.processFrontMatter, on purpose:
   processFrontMatter re-serialises the whole block, which drops YAML
   comments and rewrites the quoting and list style of keys the user wrote by
   hand. Patching changes only the key being set and leaves every other line
   byte for byte.

   The store keeps one note per Bible Notes file and rebuilds the index
   (cheap, pure) whenever one changes; views subscribe to it. */

const { Notice, normalizePath } = require('obsidian');
const { readNote } = require('./note');
const { buildIndex } = require('./index');
const { toggleTask, adopt, sessionBlock, appendSession } = require('./writes');
const { planNote, renameTarget } = require('./newnote');
const { candidates } = require('./adopt');
const { parseFrontmatter, patchFrontmatter } = require('./frontmatter');
const { DEFAULT_TEMPLATES, TEMPLATE_NAMES } = require('./templates');
const { passageNoteName, passageLink, bibleHubUrl, readerRef } = require('./scripture');
const { KIND_KEY, KIND_IDS } = require('./constants');
const D = require('./dates');

function makeStore(plugin) {
  const app = plugin.app;
  const v = app.vault;
  const settings = () => plugin.settings;
  const notes = new Map();
  const listeners = new Set();
  let index = buildIndex([], D.todayISO());
  let timer = null;

  const isMd = f => !!f && (f.extension === 'md' || /\.md$/.test(f.name || ''));
  const getFile = path => (v.getFileByPath ? v.getFileByPath(path) : v.getAbstractFileByPath(path));

  function rebuild() {
    timer = null;
    index = buildIndex([...notes.values()], D.todayISO());
    for (const fn of listeners) { try { fn(index); } catch (e) { console.error('bible-notes listener', e); } }
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(rebuild, 200);
  }

  /* Does the metadata cache say this file carries the kind key? null when
     there is no cache entry yet (or no cache, in the preview harness) — then
     the file is read to find out. */
  function cacheSays(f) {
    const mc = app.metadataCache;
    if (!mc || !mc.getFileCache) return null;
    const c = mc.getFileCache(f);
    if (!c) return null;
    return !!(c.frontmatter && Object.prototype.hasOwnProperty.call(c.frontmatter, KIND_KEY));
  }

  async function readFile(f) {
    if (!isMd(f)) return false;
    if (cacheSays(f) === false) return notes.delete(f.path);
    let text;
    try { text = await v.cachedRead(f); } catch (e) { console.error('bible-notes read', f.path, e); return false; }
    const n = readNote({ path: f.path, basename: f.basename, text, mtime: f.stat ? f.stat.mtime : 0 }, settings());
    if (n) { notes.set(f.path, n); return true; }
    return notes.delete(f.path);
  }

  async function loadAll() {
    notes.clear();
    for (const f of v.getMarkdownFiles()) await readFile(f);
    rebuild();
  }

  /* Keep the index in step with the vault. Returns the event refs for the
     caller to register (so they are released on unload). */
  function watch() {
    const refs = [];
    const onChange = f => { readFile(f).then(changed => { if (changed) schedule(); }); };
    if (app.metadataCache && app.metadataCache.on) refs.push(app.metadataCache.on('changed', onChange));
    else { refs.push(v.on('modify', onChange)); refs.push(v.on('create', onChange)); }
    refs.push(v.on('delete', f => { if (notes.delete(f.path)) schedule(); }));
    refs.push(v.on('rename', (f, old) => { notes.delete(old); readFile(f).then(() => schedule()); }));
    return refs;
  }

  /* Case-insensitive, like the file systems Obsidian runs on. */
  function existsProbe() {
    const all = new Set(v.getFiles().map(f => f.path.toLowerCase()));
    return p => all.has(String(p).toLowerCase());
  }

  async function ensureFolder(dir) {
    const parts = normalizePath(dir || '').split('/').filter(Boolean);
    let cur = '';
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      if (!v.getAbstractFileByPath(cur)) {
        try { await v.createFolder(cur); } catch (e) { /* created meanwhile */ }
      }
    }
  }

  const templatePath = kind => normalizePath(`${settings().templateFolder}/${TEMPLATE_NAMES[kind]}.md`);

  async function readTemplates() {
    const out = {};
    for (const k of KIND_IDS) {
      const f = getFile(templatePath(k));
      out[k] = f ? await v.cachedRead(f) : null;
    }
    return out;
  }

  /* First run only: put the four templates in the vault, where they can be
     edited like any note. A template that already exists is never touched. */
  async function writeTemplatesOnce() {
    if (settings().templatesWritten) return;
    await ensureFolder(settings().templateFolder);
    for (const k of KIND_IDS) {
      if (!getFile(templatePath(k))) {
        try { await v.create(templatePath(k), DEFAULT_TEMPLATES[k]); } catch (e) { console.error('bible-notes template', e); }
      }
    }
    settings().templatesWritten = true;
    await plugin.saveSettings();
  }

  /* Open a file and bring its tab to the front. From Home, getLeaf(false)
     picks the last note tab — opening there without revealing it would
     leave Home on screen and the note out of sight. */
  async function showFile(f, newTab) {
    const ws = app.workspace;
    const leaf = ws.getLeaf(newTab ? 'tab' : false);
    await leaf.openFile(f, { active: true });
    if (ws.revealLeaf) await ws.revealLeaf(leaf);
  }

  async function openPath(path, newTab) {
    const f = getFile(path);
    if (f) await showFile(f, newTab);
  }

  /* Start a note of `kind` (or open today's). `extra.series` starts a Sunday
     note as the next part of that series. Resolves to the path. */
  async function createNote(kind, extra) {
    const today = D.todayISO();
    const plan = planNote(kind, today, { index, settings: settings(), exists: existsProbe(), templates: await readTemplates() }, extra);
    if (plan.open) { await openPath(plan.open); return plan.open; }
    const target = normalizePath(plan.create);
    await ensureFolder(target.slice(0, target.lastIndexOf('/')));
    const f = await v.create(target, plan.text);
    await readFile(f);
    rebuild();
    plugin.focusTitleFor = f.path;
    await showFile(f);
    return f.path;
  }

  /* Tick a checkbox shown on Home or in a cover band. Refuses (with a
     notice) when the line changed since it was read. */
  async function toggle(note, task, done) {
    const f = getFile(note.path);
    if (!f) return false;
    let refused = false;
    await v.process(f, text => {
      const out = toggleTask(text, task.line, task.raw, done, D.todayISO());
      if (out === null) { refused = true; return text; }
      return out;
    });
    if (refused) new Notice('Bible Notes: that line changed since it was shown. Open the note to tick it.');
    return !refused;
  }

  async function setProps(path, patch) {
    const f = getFile(path);
    if (f) await v.process(f, text => patchFrontmatter(text, patch));
  }

  async function renameFromTitle(path, title) {
    const note = notes.get(path);
    const f = getFile(path);
    if (!note || !f) return path;
    const planned = renameTarget(note, title, existsProbe());
    if (!planned) return path;
    const target = normalizePath(planned);
    await app.fileManager.renameFile(f, target);
    return target;
  }

  async function addSession(path) {
    const f = getFile(path);
    if (!f) return;
    const tpl = (await readTemplates()).study || DEFAULT_TEMPLATES.study;
    await v.process(f, text => appendSession(text, sessionBlock(tpl, D.todayISO())));
  }

  async function adoptScan() {
    const files = [];
    for (const f of v.getMarkdownFiles()) {
      const c = app.metadataCache && app.metadataCache.getFileCache ? app.metadataCache.getFileCache(f) : null;
      const fm = c ? (c.frontmatter || {}) : parseFrontmatter(await v.cachedRead(f)).fm;
      files.push({ path: f.path, fm });
    }
    return candidates(files, settings());
  }

  async function adoptApply(items) {
    let n = 0;
    for (const it of items) {
      const f = getFile(it.path);
      if (!f) continue;
      await v.process(f, text => adopt(text, it.kind));
      n++;
    }
    return n;
  }

  /* A Bible-as-notes vault (Bible Search's layout) holds "John 15" as a
     note with a `chapter` property — open that when it is there. */
  function chapterNote(ref) {
    const mc = app.metadataCache;
    if (!mc || !mc.getFirstLinkpathDest) return null;
    const f = mc.getFirstLinkpathDest(passageNoteName(ref), '');
    if (!f) return null;
    const c = mc.getFileCache(f);
    return c && c.frontmatter && c.frontmatter.chapter !== undefined ? f : null;
  }

  /* Bible Search's reader, when that plugin is on and offers its api —
     looked up per call, since it can be switched on or off at any time. */
  function reader() {
    const p = app.plugins && app.plugins.plugins && app.plugins.plugins['bible-search'];
    return p && p.api && typeof p.api.openPassage === 'function' ? p.api : null;
  }
  const readerName = () => (reader() ? 'Bible Search' : null);

  /* Where a passage opens, in order: Bible Search's reader; the vault's own
     chapter note; BibleHub. Bible Search answering false (no search page
     set up) or failing falls through to the next. Resolves to which one. */
  async function openPassage(ref, sourcePath) {
    const r = reader();
    if (r) {
      try { if (await r.openPassage(readerRef(ref))) return 'bible-search'; } catch (e) { console.error('bible-notes: Bible Search could not open', ref.label, e); }
    }
    if (chapterNote(ref)) { await app.workspace.openLinkText(passageLink(ref), sourcePath || '', false); return 'vault'; }
    /* activeWindow: the window the tap came from, popouts included. */
    (window.activeWindow || window).open(bibleHubUrl(ref, settings().translation), '_blank', 'noopener');
    return 'biblehub';
  }

  /* `[[Sarah]]` when a note called Sarah exists, plain `Sarah` otherwise —
     never a link to nothing. */
  function personValue(name) {
    const mc = app.metadataCache;
    const f = mc && mc.getFirstLinkpathDest ? mc.getFirstLinkpathDest(name, '') : null;
    return f ? `[[${name}]]` : name;
  }

  return {
    get index() { return index; },
    notes,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    loadAll, watch, readFile, rebuild, getFile, openPath,
    createNote, toggle, setProps, renameFromTitle, addSession,
    adoptScan, adoptApply, writeTemplatesOnce, readTemplates,
    chapterNote, openPassage, readerName, personValue,
  };
}

module.exports = { makeStore };
