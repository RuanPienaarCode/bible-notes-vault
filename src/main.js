'use strict';
/* ============================================================================
   BIBLE NOTES — Obsidian plugin (entry point)
   Sunday, community, morning meditation and Bible study notes you come back
   to and build on. Notes are plain markdown, found by their `bible-notes:`
   property. Vault API only — desktop and iOS/Android. Source lives in src/
   as CommonJS modules; esbuild bundles them into main.js (target safari15 —
   the real engine floor on mobile, not minAppVersion).
   ============================================================================ */

const { Plugin, MarkdownView } = require('obsidian');
const { VIEW_TYPE, DEFAULT_SETTINGS, KINDS, PRAYER } = require('./constants');
const { makeStore } = require('./store');
const { HomeView } = require('./view');
const { Covers } = require('./cover');
const { makePostProcessor, makeEditorExtension, refreshChipViews } = require('./chips');
const { closePopover } = require('./popover');
const { AdoptModal } = require('./adopt-modal');
const { PrayerModal } = require('./prayer-modal');
const { BibleNotesSettingTab } = require('./settings-tab');
const { setTile } = require('./tiles');
const D = require('./dates');

class BibleNotesPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.store = makeStore(this);
    this.covers = new Covers(this);
    this.focusTitleFor = null;

    this.registerView(VIEW_TYPE, leaf => new HomeView(leaf, this));
    this.addRibbonIcon('book-open', 'Open Bible Notes', () => this.activateHome());
    this.addCommand({ id: 'open-home', name: 'Open home', callback: () => this.activateHome() });
    for (const k of KINDS) {
      this.addCommand({ id: `new-${k.id}`, name: k.command, callback: () => this.store.createNote(k.id) });
    }
    this.addCommand({ id: 'add-prayer', name: PRAYER.command, callback: () => this.openPrayer() });
    this.addCommand({
      id: 'add-session',
      name: 'Add a study session',
      checkCallback: checking => {
        const note = this.activeNote();
        if (!note || note.kind !== 'study') return false;
        if (!checking) this.store.addSession(note.path);
        return true;
      },
    });
    this.addCommand({
      id: 'toggle-raw-properties',
      name: 'Show or hide raw properties',
      checkCallback: checking => {
        const note = this.activeNote();
        if (!note) return false;
        if (!checking) {
          if (this.covers.raw.has(note.path)) this.covers.raw.delete(note.path); else this.covers.raw.add(note.path);
          this.covers.refreshAll();
        }
        return true;
      },
    });
    this.addCommand({ id: 'adopt', name: 'Adopt existing notes', callback: () => this.openAdopt() });
    this.addSettingTab(new BibleNotesSettingTab(this.app, this));

    this.registerMarkdownPostProcessor(makePostProcessor(this));
    this.registerEditorExtension(makeEditorExtension(this));

    const ws = this.app.workspace;
    const refreshCovers = () => this.covers.refreshAll();
    this.registerEvent(ws.on('layout-change', refreshCovers));
    this.registerEvent(ws.on('file-open', () => setTimeout(refreshCovers, 0)));
    this.registerEvent(ws.on('active-leaf-change', refreshCovers));

    ws.onLayoutReady(async () => {
      await this.store.loadAll();
      for (const ref of this.store.watch()) this.registerEvent(ref);
      /* Whether a note gets chips depends on the store (a Bible Notes note, or
         one just adopted), which fills only now: tell the open editors. */
      this.register(this.store.subscribe(() => { this.covers.refreshAll(); this.refreshChips(); }));
      this.covers.refreshAll();
      this.refreshChips();
      this.store.writeTemplatesOnce().catch(e => console.error('bible-notes templates', e));
    });

    /* "Today" moves at midnight even if nothing in the vault does. */
    let day = D.todayISO();
    this.registerInterval(window.setInterval(() => {
      if (D.todayISO() !== day) { day = D.todayISO(); this.store.rebuild(); }
    }, 5 * 60 * 1000));
  }

  onunload() {
    closePopover();
    if (this.covers) this.covers.removeAll();
  }

  activeNote() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view && view.file ? this.store.notes.get(view.file.path) || null : null;
  }

  /* Re-decide the passage chips in every open note (Live Preview and reading
     view): the store changed what counts as a Bible Notes note, or the
     "chips in every note" setting was toggled. */
  refreshChips() {
    refreshChipViews(this);
  }

  /* Redraw every open Home (its tiles changed). */
  refreshHome() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.home) leaf.view.home.render();
    }
  }

  /* Show or hide one Home tile — from Home's settings button or the
     settings tab, which share this one list. */
  async setTileShown(id, show) {
    this.settings.hiddenTiles = setTile(this.settings.hiddenTiles, id, show);
    await this.saveSettings();
    this.refreshHome();
  }

  /* Settings → Bible Notes. `app.setting` is not in the public typings but
     is how plugins open their own tab. */
  openSettings() {
    const s = this.app.setting;
    if (!s || !s.open) return;
    s.open();
    if (s.openTabById) s.openTabById(this.manifest.id);
  }

  /* "Prayer request": one text input, added to the prayer list note. */
  openPrayer() {
    new PrayerModal(this.app, this).open();
  }

  async openAdopt() {
    const items = await this.store.adoptScan();
    new AdoptModal(this.app, this, items).open();
  }

  async activateHome() {
    const ws = this.app.workspace;
    const existing = ws.getLeavesOfType(VIEW_TYPE);
    if (existing.length) { ws.revealLeaf(existing[0]); return; }
    const leaf = ws.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    ws.revealLeaf(leaf);
  }

  async loadSettings() {
    const saved = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    this.settings.folders = Object.assign({}, DEFAULT_SETTINGS.folders, saved.folders || {});
    /* Its own copy, never the default's array. */
    this.settings.hiddenTiles = Array.isArray(saved.hiddenTiles) ? saved.hiddenTiles.slice() : [];
    /* 0.3.0 had an accent choice; Bento has one palette. */
    delete this.settings.accent;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

module.exports = BibleNotesPlugin;
