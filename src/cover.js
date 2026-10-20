'use strict';
/* The cover band on a Bible Notes note: a flat band, the kind's icon, a big
   title that renames the file, the properties as quiet rows you tap to edit,
   and "still open from earlier". It replaces Obsidian's inline title and
   properties panel on these notes only; "Show raw properties" brings the
   native panel back.

   Mounted beside the editor (in .cm-sizer, where Obsidian keeps its own
   inline title) and in reading view's header — never inside the editable
   text, so it can't end up in the file. */

const { Platform } = require('obsidian');
const { el, icon, button, clear, checkRow } = require('./dom');
const { kindOf } = require('./constants');
const { carriedInto, partOf } = require('./index');
const { showPassagePopover } = require('./popover');
const D = require('./dates');

const FIELDS = {
  sunday: ['date', 'speaker', 'series', 'scripture', 'church'],
  community: ['date', 'people', 'scripture'],
  meditation: ['date', 'scripture'],
  study: ['started', 'scripture'],
};
const LABELS = { date: 'Date', started: 'Started', speaker: 'Speaker', series: 'Series', scripture: 'Passage', church: 'Church', people: 'Who was there' };
const PLACEHOLDER = { date: 'Add a date', started: 'Add a date', speaker: 'Add speaker', series: 'Add series', scripture: 'Add passage', church: 'Add church', people: 'Add people' };

const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const list = v => (Array.isArray(v) ? v : (v === null || v === undefined || v === '' ? [] : [v])).map(String);

/* Stop the editor underneath from treating a tap or a key in the band as
   its own (moving the cursor, running a hotkey). */
function shield(node) {
  for (const ev of ['mousedown', 'pointerdown', 'click', 'keydown', 'keyup', 'input', 'beforeinput', 'paste']) {
    node.addEventListener(ev, e => e.stopPropagation());
  }
}

class Covers {
  constructor(plugin) {
    this.plugin = plugin;
    this.raw = new Set();
    this.expanded = new Set();
  }

  get store() { return this.plugin.store; }

  refreshAll() {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) this.refresh(leaf.view);
  }

  removeAll() {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) {
      const c = leaf.view && leaf.view.containerEl;
      if (!c) continue;
      c.classList.remove('bn-note', 'bn-raw');
      c.querySelectorAll('.bn-cover').forEach(removeCover);
    }
  }

  refresh(view) {
    if (!view || !view.containerEl) return;
    const c = view.containerEl;
    const note = view.file ? this.store.notes.get(view.file.path) : null;
    if (!note) {
      c.classList.remove('bn-note', 'bn-raw');
      c.querySelectorAll('.bn-cover').forEach(removeCover);
      return;
    }
    c.classList.add('bn-note');
    c.classList.toggle('bn-raw', this.raw.has(note.path));
    const sizer = c.querySelector('.markdown-source-view .cm-sizer');
    if (sizer) this.mount(sizer, sizer.querySelector(':scope > .inline-title'), note, view);
    const head = c.querySelector('.markdown-reading-view .mod-header') || c.querySelector('.markdown-preview-view .markdown-preview-sizer');
    if (head) this.mount(head, head.querySelector(':scope > .inline-title') || head.firstChild, note, view);
  }

  mount(parent, before, note, view) {
    let cover = parent.querySelector(':scope > .bn-cover');
    if (!cover) {
      cover = el(null, 'div', 'bn-cover');
      shield(cover);
      parent.insertBefore(cover, before && before.parentNode === parent ? before : parent.firstChild);
      /* A change that arrived while someone was typing in the band is drawn
         once focus leaves it. */
      cover.addEventListener('focusout', () => setTimeout(() => {
        if (cover._bnStale && cover.isConnected && !cover.contains(document.activeElement)) {
          cover._bnStale = false;
          this.refresh(cover._bnView);
        }
      }, 60));
    }
    cover._bnView = view;
    /* Never redraw under someone typing in the band. */
    if (cover.contains(document.activeElement) && cover.dataset.path === note.path) { cover._bnStale = true; return; }
    const sig = signature(note, this.store.index, this.raw.has(note.path), this.expanded.has(note.path));
    if (cover.dataset.sig === sig && cover.dataset.path === note.path) return;
    cover.dataset.sig = sig;
    cover.dataset.path = note.path;
    this.render(cover, note, view);
    remeasure(view);
  }

  render(cover, note, view) {
    const store = this.store;
    const index = store.index;
    const k = kindOf(note.kind);
    if (cover._bnRO) { cover._bnRO.disconnect(); cover._bnRO = null; }
    clear(cover);
    cover.className = `bn-cover kind-${note.kind}`;
    el(cover, 'div', 'bn-cover-band').setAttribute('aria-hidden', 'true');
    const inner = el(cover, 'div', 'bn-cover-inner');
    el(inner, 'div', 'bn-cover-icon', k.emoji).setAttribute('aria-hidden', 'true');

    /* The title IS the file name (minus its date). */
    const title = el(inner, 'textarea', 'bn-title');
    title.rows = 1;
    title.value = note.title;
    title.placeholder = k.label;
    title.setAttribute('aria-label', 'Title');
    title.spellcheck = true;
    /* Grow to fit the title. Measured only once the box has its real width
       (a box measured before layout wraps every character), and again
       whenever its width changes. */
    const grow = () => {
      if (!title.isConnected || !title.clientWidth) return;
      const before = title.style.height;
      title.style.height = 'auto';
      title.style.height = `${title.scrollHeight}px`;
      if (title.style.height !== before) remeasure(view);
    };
    title.addEventListener('input', grow);
    if (typeof ResizeObserver !== 'undefined') {
      let width = 0;
      cover._bnRO = new ResizeObserver(entries => {
        const w = Math.round(entries[0].contentRect.width);
        if (w !== width) { width = w; grow(); }
      });
      cover._bnRO.observe(title);
    }
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); focusBody(view); }
      if (e.key === 'Escape') { title.value = note.title; title.blur(); }
    });
    title.addEventListener('blur', async () => {
      const t = title.value.trim();
      if (t && t !== note.title) await store.renameFromTitle(note.path, t);
      else title.value = note.title;
    });
    requestAnimationFrame(grow);
    if (this.plugin.focusTitleFor === note.path) {
      this.plugin.focusTitleFor = null;
      setTimeout(() => { title.focus(); title.select(); }, 30);
    }

    const props = el(inner, 'div', 'bn-props');
    for (const key of FIELDS[note.kind]) this.prop(props, note, key, view);

    const tools = el(inner, 'div', 'bn-cover-tools');
    if (note.kind === 'study') button(tools, 'bn-btn bn-btn-quiet', 'Add a session', () => store.addSession(note.path), 'plus');
    const raw = this.raw.has(note.path);
    button(tools, 'bn-link', raw ? 'Hide raw properties' : 'Show raw properties', () => {
      if (raw) this.raw.delete(note.path); else this.raw.add(note.path);
      this.refresh(view);
    });

    const carried = carriedInto(index, note);
    if (carried.length) {
      const open = this.expanded.has(note.path);
      const bar = el(inner, 'button', 'bn-carry' + (open ? ' is-open' : ''));
      bar.type = 'button';
      bar.setAttribute('aria-expanded', String(open));
      icon(bar, open ? 'chevron-down' : 'chevron-right', 'bn-carry-chev');
      el(bar, 'span', 'bn-grow', `${plural(carried.length, 'thing')} still open from earlier`);
      const from = [...new Set(carried.map(c => c.note.title))].slice(0, 2).join(' · ');
      el(bar, 'span', 'bn-dim bn-ellipsis bn-carry-from', from);
      bar.addEventListener('click', () => {
        if (open) this.expanded.delete(note.path); else this.expanded.add(note.path);
        this.refresh(view);
      });
      if (open) {
        const listEl = el(inner, 'div', 'bn-carry-list');
        for (const item of carried.slice(0, 8)) {
          const { row, box } = checkRow(listEl, 'bn-row bn-task', false, async checked => {
            const ok = await store.toggle(item.note, item.task, checked);
            if (!ok) box.checked = !checked;
          });
          box.setAttribute('aria-label', item.task.text);
          const t = el(row, 'span', 'bn-task-text');
          el(t, 'span', 'bn-task-title', item.task.text);
          const m = el(t, 'button', 'bn-task-meta');
          m.type = 'button';
          el(m, 'span', 'bn-meta-emoji', kindOf(item.note.kind).emoji).setAttribute('aria-hidden', 'true');
          m.appendChild(document.createTextNode(item.note.title));
          m.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); store.openPath(item.note.path); });
        }
        if (carried.length > 8) el(listEl, 'p', 'bn-dim bn-carry-more', `and ${carried.length - 8} more on Home`);
      }
    }
  }

  /* One property row: label, then the value as a button that turns into an
     input in place. */
  prop(parent, note, key, view) {
    const store = this.store;
    el(parent, 'span', 'bn-prop-label', LABELS[key]);
    const cell = el(parent, 'div', 'bn-prop-value');
    const value = key === 'date' || key === 'started' ? (note.fm[key] ? String(note.fm[key]) : '') : list(note.fm[key]).join(key === 'scripture' ? '; ' : ', ');

    const show = () => {
      clear(cell);
      if (key === 'scripture' && note.scripture.length) {
        const wrap = el(cell, 'span', 'bn-chips');
        for (const e of note.scripture) {
          if (e.refs.length) {
            for (const r of e.refs) {
              const chip = el(wrap, 'button', 'bn-pill tone-blue bn-chip', r.label);
              chip.type = 'button';
              chip.setAttribute('aria-haspopup', 'dialog');
              chip.addEventListener('click', ev => { ev.stopPropagation(); showPassagePopover(this.plugin, r, chip, note.path); });
            }
          } else {
            const bad = el(wrap, 'span', 'bn-pill bn-pill-bad', e.raw);
            bad.title = 'Not recognised as a passage';
          }
        }
        button(wrap, 'bn-prop-edit', null, edit, 'pencil').setAttribute('aria-label', 'Edit passage');
        return;
      }
      const b = el(cell, 'button', 'bn-prop-btn' + (value ? '' : ' is-empty'));
      b.type = 'button';
      if (key === 'series' && value) {
        el(b, 'span', 'bn-pill tone-purple', value);
        const part = partOf(store.index, note);
        if (part) el(b, 'span', 'bn-dim', `part ${part}`);
      } else if ((key === 'date' || key === 'started') && D.isRealISO(value)) {
        b.textContent = `${D.DAYS[D.weekday(value)]} ${D.longDate(value)}`;
      } else if (key === 'people' && note.people.length) {
        for (const p of note.people) el(b, 'span', 'bn-pill' + (p.linked ? ' tone-blue' : ''), p.name);
      } else {
        b.textContent = value || PLACEHOLDER[key];
      }
      b.addEventListener('click', edit);
    };

    const edit = () => {
      clear(cell);
      const input = el(cell, 'input', 'bn-prop-input');
      input.type = key === 'date' || key === 'started' ? 'date' : 'text';
      input.value = value;
      input.placeholder = key === 'scripture' ? 'John 15:1-8; Psalm 1' : (key === 'people' ? 'Names, separated by commas' : PLACEHOLDER[key]);
      input.setAttribute('aria-label', LABELS[key]);
      if (key === 'people' || key === 'speaker' || key === 'series' || key === 'church') {
        const options = suggestions(store.index, key);
        if (options.length) {
          const dl = el(cell, 'datalist');
          dl.id = `bn-dl-${key}-${Math.random().toString(36).slice(2, 8)}`;
          for (const o of options) { const opt = el(dl, 'option'); opt.value = o; }
          input.setAttribute('list', dl.id);
        }
      }
      let done = false;
      const commit = async save => {
        if (done) return;
        done = true;
        const next = input.value.trim();
        /* Let go of focus first: the band won't redraw while it holds it. */
        if (document.activeElement === input) input.blur();
        if (!save || next === value) { show(); return; }
        input.disabled = true;
        await store.setProps(note.path, { [key]: toValue(store, key, next) });
        /* The vault change redraws the band; if nothing changed, put the
           value back rather than leave a dead input. */
        setTimeout(() => { if (input.isConnected) show(); }, 1500);
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(true); }
        if (e.key === 'Escape') { e.preventDefault(); commit(false); }
      });
      if (input.type === 'date' && Platform.isMobile) {
        /* The phone's date sheet has no Enter key, and may take focus from
           the input while it is open: save on the pick itself, and let a
           blur only tidy up when nothing was picked. */
        input.addEventListener('change', () => { if (input.value) commit(true); });
        input.addEventListener('blur', () => {
          if (input.value && input.value !== value) commit(true);
          else setTimeout(() => { if (!done && document.activeElement !== input) commit(false); }, 800);
        });
      } else {
        input.addEventListener('blur', () => commit(true));
      }
      input.focus();
    };
    show();
  }
}

/* What a typed value is written as. Empty removes the property. */
function toValue(store, key, text) {
  if (!text) return undefined;
  if (key === 'people') {
    const names = text.split(',').map(s => s.trim()).filter(Boolean);
    return names.length ? names.map(n => store.personValue(n)) : undefined;
  }
  if (key === 'scripture') {
    const parts = text.split(';').map(s => s.trim()).filter(Boolean);
    return parts.length === 1 ? parts[0] : parts;
  }
  return text;
}

/* Values already used for this property, most recent first. */
function suggestions(index, key) {
  const out = [];
  for (const n of index.notes) {
    const vals = key === 'people' ? n.people.map(p => p.name) : [n[key]];
    for (const v of vals) if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 40);
}

/* Everything the band shows, as one string — when it is unchanged the band
   is left alone (no flicker, no lost focus). */
function signature(note, index, raw, expanded) {
  const carried = carriedInto(index, note).map(c => c.task.raw + c.note.path).join('|');
  return JSON.stringify([note.path, note.title, note.kind, FIELDS[note.kind].map(k => note.fm[k]), partOf(index, note), carried, raw, expanded]);
}

/* The band sits above the editor's text; when its height changes the
   editor's cached positions are stale until it measures again. */
function remeasure(view) {
  try { if (view && view.editor && view.editor.cm) view.editor.cm.requestMeasure(); } catch (e) { /* reading view */ }
}

function removeCover(node) {
  if (node._bnRO) node._bnRO.disconnect();
  node.remove();
}

function focusBody(view) {
  try { if (view && view.editor) view.editor.focus(); } catch (e) { /* reading view */ }
}

module.exports = { Covers, toValue, suggestions };
