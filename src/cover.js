'use strict';
/* The cover on a Bible Notes note, Bento: a row with a round Home button and
   where the note sits, then the hero band — the kind, a round ↗ that opens
   the note's passage, a big title that renames the file, and the properties
   as pills you tap to edit (passages as green chips) — then "still open from
   earlier". It replaces Obsidian's inline title and properties panel on these
   notes only; "Show raw properties" brings the native panel back.

   Mounted beside the editor (in .cm-sizer, where Obsidian keeps its own
   inline title) and in reading view's header — never inside the editable
   text, so it can't end up in the file. */

const { Platform } = require('obsidian');
const { el, icon, button, clear, checkRow } = require('./dom');
const { kindOf } = require('./constants');
const { carriedInto, partOf } = require('./index');
const { showPassagePopover } = require('./popover');
const D = require('./dates');

/* Passages lead, as on the Bento board; then the kind's own fields. */
const FIELDS = {
  sunday: ['scripture', 'date', 'speaker', 'series', 'church'],
  community: ['scripture', 'date', 'people'],
  meditation: ['scripture', 'date'],
  study: ['scripture', 'started'],
};
/* LABELS name a field for a screen reader, its tooltip and its input. */
const LABELS = { date: 'Date', started: 'Started', speaker: 'Speaker', series: 'Series', scripture: 'Passage', church: 'Church', people: 'Who was there' };
const PLACEHOLDER = { date: 'Add a date', started: 'Add a date', speaker: 'Add speaker', series: 'Add series', scripture: 'Add passage', church: 'Add church', people: 'Add people' };
/* What the row above the band calls each kind's notes. */
const PLACE = { sunday: 'Sunday notes', community: 'Community', meditation: 'Meditations', study: 'Bible study' };

const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const list = v => (Array.isArray(v) ? v : (v === null || v === undefined || v === '' ? [] : [v])).map(String);

/* "Sun 25 Oct", with the year when it is not this year's. */
function pillDate(iso, today) {
  const s = D.stampDate(iso);
  return iso.slice(0, 4) === today.slice(0, 4) ? s.slice(0, -5) : s;
}

/* Stop the editor underneath from treating a tap or a key in the band as
   its own (moving the cursor, running a hotkey). */
function shield(node) {
  for (const ev of ['mousedown', 'pointerdown', 'click', 'keydown', 'keyup', 'input', 'beforeinput', 'paste']) {
    node.addEventListener(ev, e => e.stopPropagation());
  }
}

function firstRef(note) {
  for (const e of note.scripture) if (e.refs.length) return e.refs[0];
  return null;
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
      remeasure(leaf.view);
    }
  }

  refresh(view) {
    if (!view || !view.containerEl) return;
    const c = view.containerEl;
    const note = view.file ? this.store.notes.get(view.file.path) : null;
    if (!note) {
      c.classList.remove('bn-note', 'bn-raw');
      c.querySelectorAll('.bn-cover').forEach(removeCover);
      remeasure(view);
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
      /* The band sits in .cm-sizer, outside what CodeMirror observes, so ANY
         change to its height (a pill turning into an input and wrapping, a
         passage list growing, the font swapping in) must ask the editor to
         measure again. One observer on the band covers them all. */
      parent.insertBefore(cover, before && before.parentNode === parent ? before : parent.firstChild);
      /* The observer of the window the band lives in (a pop-out has its own). */
      const RO = (parent.ownerDocument.defaultView || window).ResizeObserver;
      if (typeof RO !== 'undefined') {
        cover._bnBand = new RO(() => remeasure(cover._bnView));
        cover._bnBand.observe(cover);
      }
      /* A change that arrived while someone was typing in the band is drawn
         once focus leaves it. */
      cover.addEventListener('focusout', () => setTimeout(() => {
        if (cover._bnStale && cover.isConnected && !cover.contains(cover.ownerDocument.activeElement)) {
          cover._bnStale = false;
          this.refresh(cover._bnView);
        }
      }, 60));
    }
    cover._bnView = view;
    /* Never redraw under someone typing in the band. */
    if (cover.contains(cover.ownerDocument.activeElement) && cover.dataset.path === note.path) { cover._bnStale = true; return; }
    const sig = signature(note, this.store.index, this.raw.has(note.path), this.expanded.has(note.path), D.todayISO());
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
    cover.className = `bn-cover bn-k-${note.kind}`;
    const inner = el(cover, 'div', 'bn-cover-inner');

    /* Home, and where this note sits. */
    const nav = el(inner, 'div', 'bn-nav');
    const home = el(nav, 'button', 'bn-circle');
    home.type = 'button';
    home.setAttribute('aria-label', 'Bible Notes home');
    home.title = 'Bible Notes home';
    icon(home, 'home');
    home.addEventListener('click', () => this.plugin.activateHome());
    const crumb = el(nav, 'span', 'bn-crumb');
    crumb.appendChild(document.createTextNode(`${PLACE[note.kind]} / `));
    el(crumb, 'strong', null, note.basename);

    const hero = el(inner, 'section', 'bn-nhero');
    hero.setAttribute('aria-label', `${k.button}: ${note.title}`);
    const top = el(hero, 'div', 'bn-nhero-top');
    const kind = el(top, 'span', 'bn-nhero-k');
    icon(kind, k.icon);
    const sub = kindSub(note, index);
    el(kind, 'span', null, sub ? `${k.label} · ${sub}` : k.button);
    const ref = firstRef(note);
    if (ref) {
      const go = el(top, 'button', 'bn-arrow is-inv');
      go.type = 'button';
      go.setAttribute('aria-label', `Open ${ref.label}`);
      go.title = `Open ${ref.label}`;
      icon(go, 'arrow-up-right');
      go.addEventListener('click', () => store.openPassage(ref, note.path));
    }

    /* The title IS the file name (minus its date). */
    const title = el(hero, 'textarea', 'bn-title');
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
      /* Through a CSS variable (styles.css sets the height from it). */
      const before = title.style.getPropertyValue('--bn-title-h');
      title.style.setProperty('--bn-title-h', 'auto');
      const next = `${title.scrollHeight}px`;
      title.style.setProperty('--bn-title-h', next);
      if (next !== before) remeasure(view);
    };
    title.addEventListener('input', grow);
    const win = title.ownerDocument.defaultView || window;
    if (typeof win.ResizeObserver !== 'undefined') {
      let width = 0;
      /* Grow on the next frame, not inside the callback: growing resizes
         the band, which its own observer watches, and a size change made
         during delivery is reported as a ResizeObserver loop. */
      cover._bnRO = new win.ResizeObserver(entries => {
        const w = Math.round(entries[0].contentRect.width);
        if (w !== width) { width = w; win.requestAnimationFrame(grow); }
      });
      cover._bnRO.observe(title);
    }
    /* The bundled font swaps in after first paint and can re-wrap the title. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(grow);
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
      /* A new note: put the cursor in its title. The band exists in both the
         editing and the (hidden) reading container, and a just-opened leaf
         may not be laid out yet — so keep trying for about a second, only
         while this title is actually visible, and stop the moment one takes
         focus or the writer is already typing in the note. */
      let tries = 0;
      const plugin = this.plugin;
      const tick = () => {
        if (plugin.focusTitleFor !== note.path || !title.isConnected) return;
        /* Out of tries: let the flag go, so a later redraw never grabs focus. */
        if (tries++ > 20) { plugin.focusTitleFor = null; return; }
        /* Obsidian focuses the editor itself as a note opens; only after
           that first moment does focus in the text mean someone is typing. */
        const a = title.ownerDocument.activeElement;
        if (tries > 6 && a && a.closest && a.closest('.cm-content')) { plugin.focusTitleFor = null; return; }
        if (title.offsetParent !== null) {
          title.focus();
          if (title.ownerDocument.activeElement === title) { title.select(); plugin.focusTitleFor = null; return; }
        }
        setTimeout(tick, 50);
      };
      setTimeout(tick, 30);
    }

    const props = el(hero, 'div', 'bn-fields');
    props.setAttribute('role', 'group');
    props.setAttribute('aria-label', 'Properties');
    for (const key of FIELDS[note.kind]) this.prop(props, note, key, view);

    const tools = el(inner, 'div', 'bn-cover-tools');
    if (note.kind === 'study') button(tools, 'bn-btn-quiet', 'Add a session', () => store.addSession(note.path), 'plus');
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
      el(bar, 'span', 'bn-pill bn-pill-green bn-pill-sm', String(carried.length));
      el(bar, 'span', 'bn-grow', `${carried.length === 1 ? 'thing' : 'things'} still open from earlier`);
      const from = [...new Set(carried.map(c => c.note.title))].slice(0, 2).join(' · ');
      el(bar, 'span', 'bn-carry-from', from);
      icon(bar, 'chevron-right', 'bn-carry-chev');
      bar.addEventListener('click', () => {
        if (open) this.expanded.delete(note.path); else this.expanded.add(note.path);
        this.refresh(view);
      });
      if (open) {
        const listEl = el(inner, 'div', 'bn-carry-list');
        for (const item of carried.slice(0, 8)) {
          const { row, box } = checkRow(listEl, 'bn-task', false, async checked => {
            const ok = await store.toggle(item.note, item.task, checked);
            if (!ok) box.checked = !checked;
          });
          box.setAttribute('aria-label', item.task.text);
          const t = el(row, 'span', 'bn-task-text');
          el(t, 'span', 'bn-task-title', item.task.text);
          const m = el(t, 'button', 'bn-task-meta', item.note.title);
          m.type = 'button';
          m.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); store.openPath(item.note.path); });
        }
        if (carried.length > 8) el(listEl, 'p', 'bn-carry-more', `and ${carried.length - 8} more on Home`);
      }
    }
  }

  /* One property as a pill that turns into an input in place. Passages are
     green chips (each opens its card) with a round pencil to edit them. */
  prop(parent, note, key, view) {
    const store = this.store;
    const today = D.todayISO();
    const cell = el(parent, 'span', 'bn-field');
    const value = key === 'date' || key === 'started' ? (note.fm[key] ? String(note.fm[key]) : '') : list(note.fm[key]).join(key === 'scripture' ? '; ' : ', ');

    const show = () => {
      clear(cell);
      if (key === 'scripture' && note.scripture.length) {
        for (const e of note.scripture) {
          if (e.refs.length) {
            for (const r of e.refs) {
              const chip = el(cell, 'button', 'bn-chip');
              chip.type = 'button';
              chip.setAttribute('aria-haspopup', 'dialog');
              icon(chip, 'book-open');
              el(chip, 'span', null, r.label);
              chip.addEventListener('click', ev => { ev.stopPropagation(); showPassagePopover(this.plugin, r, chip, note.path); });
            }
          } else {
            const bad = el(cell, 'span', 'bn-fpill is-bad', e.raw);
            bad.title = 'Not recognised as a passage';
          }
        }
        const pen = button(cell, 'bn-fpill bn-fpill-icon', null, edit, 'pencil');
        pen.setAttribute('aria-label', 'Edit passage');
        pen.title = 'Edit passage';
        return;
      }
      const b = el(cell, 'button', 'bn-fpill' + (value ? '' : ' is-empty'));
      b.type = 'button';
      b.title = LABELS[key];
      if (!value) {
        icon(b, 'plus');
        el(b, 'span', null, PLACEHOLDER[key]);
      } else if ((key === 'date' || key === 'started') && D.isRealISO(value)) {
        b.textContent = pillDate(value, today);
        b.setAttribute('aria-label', `${LABELS[key]}: ${D.longDate(value)}`);
      } else if (key === 'series') {
        b.textContent = value;
        const part = partOf(store.index, note);
        if (part) el(b, 'em', null, ` · part ${part}`);
        b.setAttribute('aria-label', `${LABELS[key]}: ${value}${part ? `, part ${part}` : ''}`);
      } else if (key === 'people' && note.people.length) {
        b.textContent = note.people.map(p => p.name).join(', ');
        b.setAttribute('aria-label', `${LABELS[key]}: ${b.textContent}`);
      } else {
        b.textContent = value;
        b.setAttribute('aria-label', `${LABELS[key]}: ${value}`);
      }
      b.addEventListener('click', edit);
    };

    const edit = () => {
      clear(cell);
      const input = el(cell, 'input', 'bn-fpill-input');
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
        if (input.ownerDocument.activeElement === input) input.blur();
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
          else setTimeout(() => { if (!done && input.ownerDocument.activeElement !== input) commit(false); }, 800);
        });
      } else {
        input.addEventListener('blur', () => commit(true));
      }
      input.focus();
    };
    show();
  }
}

/* The line beside the kind in the band: a Sunday note's series and part. */
function kindSub(note, index) {
  if (note.kind !== 'sunday' || !note.series) return '';
  const part = partOf(index, note);
  return part ? `${note.series}, part ${part}` : note.series;
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
   is left alone (no flicker, no lost focus). Today is in it because the date
   pill drops the year only for this year's dates. */
function signature(note, index, raw, expanded, today) {
  const carried = carriedInto(index, note).map(c => c.task.raw + c.note.path).join('|');
  return JSON.stringify([note.path, note.title, note.kind, FIELDS[note.kind].map(k => note.fm[k]), partOf(index, note), carried, raw, expanded, today.slice(0, 4)]);
}

/* The band sits above the editor's text; when its height changes the
   editor's cached positions are stale until it measures again. */
function remeasure(view) {
  try { if (view && view.editor && view.editor.cm) view.editor.cm.requestMeasure(); } catch (e) { /* reading view */ }
}

function removeCover(node) {
  if (node._bnRO) node._bnRO.disconnect();
  if (node._bnBand) node._bnBand.disconnect();
  node.remove();
}

function focusBody(view) {
  try { if (view && view.editor) view.editor.focus(); } catch (e) { /* reading view */ }
}

module.exports = { Covers, toValue, suggestions };
