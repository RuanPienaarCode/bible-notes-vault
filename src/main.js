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
const { VIEW_TYPE, DEFAULT_SETTINGS, KINDS, ACCENTS } = require('./constants');
const { makeStore } = require('./store');
const { HomeView } = require('./view');
const { Covers } = require('./cover');
const { makePostProcessor, makeEditorExtension } = require('./chips');
const { closePopover } = require('./popover');
const { AdoptModal } = require('./adopt-modal');
const { BibleNotesSettingTab } = require('./settings-tab');
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
      this.register(this.store.subscribe(() => this.covers.refreshAll()));
      this.covers.refreshAll();
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

  /* The accent changed in Settings: retag every note leaf and redraw each
     cover and Home that is open. (A passage card already on screen keeps the
     accent it opened with; the next one picks up the new one.) */
  applyAccent() {
    this.covers.refreshAll();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.home) leaf.view.home.render();
    }
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
    if (!ACCENTS.some(([id]) => id === this.settings.accent)) this.settings.accent = DEFAULT_SETTINGS.accent;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

module.exports = BibleNotesPlugin;
