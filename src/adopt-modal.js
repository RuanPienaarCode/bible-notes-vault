'use strict';
/* Review existing notes before adopting them: each one ticked or not, with
   its kind, and why it was found. Adopting adds one property; nothing else
   in the note changes, and nothing is adopted without this list. */

const { Modal, Notice } = require('obsidian');
const { el, button, clear } = require('./dom');
const { KINDS } = require('./constants');

class AdoptModal extends Modal {
  constructor(app, plugin, items) {
    super(app);
    this.plugin = plugin;
    this.items = items.map(it => ({ ...it, on: true }));
  }

  onOpen() {
    this.modalEl.classList.add('bn-adopt-modal');
    this.render();
  }

  render() {
    const c = this.contentEl;
    clear(c);
    el(c, 'h2', 'bn-modal-title', 'Adopt existing notes');
    if (!this.items.length) {
      el(c, 'p', 'bn-dim', 'Nothing in this vault looks like a sermon, community, meditation or study note that isn’t already adopted.');
      button(el(c, 'div', 'bn-modal-actions'), 'bn-btn', 'Close', () => this.close());
      return;
    }
    el(c, 'p', 'bn-dim', 'Adopting adds one property to each note (bible-notes: its kind). Nothing else in the note changes, and it stays where it is.');
    const listEl = el(c, 'div', 'bn-adopt-list');
    for (const it of this.items) {
      const row = el(listEl, 'div', 'bn-adopt-row');
      const label = el(row, 'label', 'bn-adopt-main');
      const box = el(label, 'input', 'bn-check');
      box.type = 'checkbox';
      box.checked = it.on;
      box.addEventListener('change', () => { it.on = box.checked; this.updateCount(); });
      const t = el(label, 'span', 'bn-adopt-text');
      el(t, 'span', 'bn-adopt-name', it.path.slice(it.path.lastIndexOf('/') + 1).replace(/\.md$/, ''));
      el(t, 'span', 'bn-dim bn-adopt-path', `${it.path.slice(0, it.path.lastIndexOf('/')) || '/'} · ${it.reason}`);
      const sel = el(row, 'select', 'dropdown bn-adopt-kind');
      sel.setAttribute('aria-label', 'Kind');
      for (const k of KINDS) {
        const o = el(sel, 'option', null, k.label);
        o.value = k.id;
        if (k.id === it.kind) o.selected = true;
      }
      sel.addEventListener('change', () => { it.kind = sel.value; });
    }
    const acts = el(c, 'div', 'bn-modal-actions');
    button(acts, 'bn-btn bn-btn-quiet', 'Cancel', () => this.close());
    this.go = button(acts, 'mod-cta bn-btn', 'Adopt', () => this.apply());
    this.updateCount();
  }

  updateCount() {
    const n = this.items.filter(i => i.on).length;
    const label = this.go.querySelector('.bn-btn-label');
    label.textContent = n ? `Adopt ${n} note${n === 1 ? '' : 's'}` : 'Adopt';
    this.go.disabled = !n;
  }

  async apply() {
    const chosen = this.items.filter(i => i.on);
    this.go.disabled = true;
    const n = await this.plugin.store.adoptApply(chosen);
    new Notice(`Bible Notes: adopted ${n} note${n === 1 ? '' : 's'}.`);
    this.close();
  }
}

module.exports = { AdoptModal };
