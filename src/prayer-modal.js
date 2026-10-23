'use strict';
/* "Prayer request": a small modal with one text input and Add / Cancel. Built
   for a phone — autofocus, Enter adds, and the input is 16px so iOS doesn't
   zoom the page when it takes focus (see styles.css). The request goes to the
   one prayer list note (store.addPrayer). */

const { Modal, Notice } = require('obsidian');
const { el, button } = require('./dom');
const { DEFAULT_SETTINGS } = require('./constants');

class PrayerModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.busy = false;
  }

  onOpen() {
    this.modalEl.classList.add('bn-prayer-modal');
    const c = this.contentEl;
    el(c, 'h2', 'bn-modal-title', 'Prayer request');
    const list = String((this.plugin.settings && this.plugin.settings.prayerList) || DEFAULT_SETTINGS.prayerList);
    el(c, 'p', 'bn-dim', `Added to ${list.slice(list.lastIndexOf('/') + 1).replace(/\.md$/i, '')}, where you can tick it when it is answered.`);
    const input = el(c, 'input', 'bn-prayer-input');
    input.type = 'text';
    input.placeholder = 'Who or what are you praying for?';
    input.setAttribute('aria-label', 'Prayer request');
    input.setAttribute('enterkeyhint', 'done');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'sentences');
    input.autofocus = true;
    this.input = input;
    const acts = el(c, 'div', 'bn-modal-actions');
    button(acts, 'bn-btn bn-btn-quiet', 'Cancel', () => this.close());
    this.go = button(acts, 'mod-cta bn-btn', 'Add', () => this.add());
    this.go.disabled = true;
    input.addEventListener('input', () => { this.go.disabled = this.busy || !input.value.trim(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing && !e.shiftKey) { e.preventDefault(); this.add(); }
    });
    /* Synchronously, inside the tap that opened the modal: iOS only raises the
       keyboard for a focus() made in the same gesture. */
    input.focus();
  }

  async add() {
    const text = this.input.value;
    if (this.busy || !text.trim()) return;
    this.busy = true;
    this.go.disabled = true;
    let res = null;
    try { res = await this.plugin.store.addPrayer(text); } catch (e) {
      console.error('bible-notes prayer', e);
      new Notice('Bible Notes: the prayer request could not be saved.');
    }
    this.busy = false;
    if (res && res.ok) {
      new Notice('Bible Notes: added to your prayer list.');
      this.close();
    } else {
      this.go.disabled = !this.input.value.trim();
    }
  }
}

module.exports = { PrayerModal };
