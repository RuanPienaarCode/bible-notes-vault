'use strict';
/* The workspace view hosting Home. */

const { ItemView } = require('obsidian');
const { VIEW_TYPE } = require('./constants');
const { mountHome } = require('./home');

class HomeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
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
