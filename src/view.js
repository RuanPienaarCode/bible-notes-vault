'use strict';
/* The workspace view hosting Home. */

const { ItemView } = require('obsidian');
const { VIEW_TYPE } = require('./constants');
const { mountHome } = require('./home');

class HomeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    /* Navigable, like a note: a note opened from Home replaces Home in this
       same tab, so Obsidian records Home in the tab's history and its back
       button returns here. Without this, getLeaf(false) skips Home and the
       note lands in another tab with nothing to go back to — on a phone,
       where tabs are hidden, Home is simply gone. */
    this.navigation = true;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Bible Notes'; }
  getIcon() { return 'book-open'; }

  async onOpen() {
    this.contentEl.classList.add('bn-home-view');
    this.home = mountHome(this.contentEl, { store: this.plugin.store, plugin: this.plugin });
  }

  async onClose() {
    if (this.home) this.home.destroy();
  }
}

module.exports = { HomeView };
