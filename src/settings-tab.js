'use strict';
/* Settings: where each kind's new notes go, the template folder, the prayer
   list note, the BibleHub translation, the church a Sunday note starts with,
   where passage chips appear and which tiles Home shows. */

const { PluginSettingTab, Setting, normalizePath } = require('obsidian');
const { KINDS, DEFAULT_SETTINGS } = require('./constants');
const { TILES, shownTiles } = require('./tiles');

/* One line per Home tile. Start has no switch: every note begins there. */
const TILE_DESC = {
  open: 'Unticked checkboxes from your notes, with how the count moved this week.',
  pray: 'Prayer requests, and the most recent answered one.',
  week: 'How many notes you wrote each day this week, or each week for five weeks.',
  index: 'Every chapter you have written about, greener the more notes it has.',
  days: 'The days this month with a morning meditation.',
  recent: 'Your latest notes.',
  kinds: 'This month’s notes by kind.',
  series: 'Each sermon series and how many parts you have written.',
};

/* A typed folder, normalised — but empty stays empty (normalizePath('')
   would be '/', the vault root). */
const folderPath = v => {
  const p = String(v || '').trim();
  const n = p ? normalizePath(p) : '';
  return n === '/' ? '' : n;
};

const TRANSLATIONS = [
  ['niv', 'NIV'], ['esv', 'ESV'], ['nlt', 'NLT'], ['csb', 'CSB'], ['bsb', 'BSB'],
  ['nkjv', 'NKJV'], ['kjv', 'KJV'], ['nasb', 'NASB'], ['net', 'NET'],
];

class BibleNotesSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = () => this.plugin.saveSettings();

    new Setting(containerEl).setName('Folders').setHeading();
    for (const k of KINDS) {
      new Setting(containerEl)
        .setName(`${k.label} notes`)
        .setDesc(`New ${k.label.toLowerCase()} notes are created here. Notes are found by their property, so moving one never breaks it.`)
        .addText(t => t.setValue(s.folders[k.id]).onChange(async v => { s.folders[k.id] = folderPath(v); await save(); }));
    }
    new Setting(containerEl)
      .setName('Template folder')
      .setDesc('Sunday.md, Community.md, Meditation.md and Study.md here shape each new note. Edit them like any note.')
      .addText(t => t.setValue(s.templateFolder).onChange(async v => { s.templateFolder = folderPath(v) || 'Templates/Bible Notes'; await save(); }));

    new Setting(containerEl).setName('Prayer list').setHeading();
    new Setting(containerEl)
      .setName('Prayer list note')
      .setDesc('The one note that prayer requests are added to (the + button on Home, then Prayer request), each as a checkbox under “Praying for”. It is made when you add the first one. Tick a request on Home when it is answered.')
      .addText(t => t.setPlaceholder(DEFAULT_SETTINGS.prayerList).setValue(s.prayerList).onChange(async v => { s.prayerList = folderPath(v) || DEFAULT_SETTINGS.prayerList; await save(); }));

    new Setting(containerEl).setName('Scripture').setHeading();
    new Setting(containerEl)
      .setName('Translation')
      .setDesc('Used when a passage opens on BibleHub. A reference that names a translation BibleHub has, like (CSB), opens in that one instead.')
      .addDropdown(d => {
        for (const [v, label] of TRANSLATIONS) d.addOption(v, label);
        d.setValue(s.translation).onChange(async v => { s.translation = v; await save(); });
      });
    new Setting(containerEl)
      .setName('Passage chips in every note')
      .setDesc('Off: only Bible Notes notes turn references like John 15:5 into chips.')
      .addToggle(t => t.setValue(s.chipsEverywhere).onChange(async v => { s.chipsEverywhere = v; await save(); }));

    new Setting(containerEl).setName('Sunday').setHeading();
    new Setting(containerEl)
      .setName('Church')
      .setDesc('A new Sunday note carries over the last one’s church, speaker and series. This is used when the last one has no church.')
      .addText(t => t.setValue(s.church).onChange(async v => { s.church = v.trim(); await save(); }));

    new Setting(containerEl).setName('Home').setHeading();
    const shown = new Set(shownTiles(s));
    for (const t of TILES) {
      new Setting(containerEl)
        .setName(t.label)
        .setDesc(TILE_DESC[t.id])
        .addToggle(tg => tg.setValue(shown.has(t.id)).onChange(v => this.plugin.setTileShown(t.id, v)));
    }

    new Setting(containerEl).setName('Existing notes').setHeading();
    new Setting(containerEl)
      .setName('Adopt existing notes')
      .setDesc('Find sermon, community, meditation and study notes already in the vault and review them before adopting.')
      .addButton(b => b.setButtonText('Find notes').onClick(() => this.plugin.openAdopt()));
  }
}

module.exports = { BibleNotesSettingTab };
