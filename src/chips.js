'use strict';
/* Passage chips in the body of a note. The text underneath stays exactly
   what was typed: reading view wraps the reference in a link-like chip,
   Live Preview marks the same characters with a class (still editable).
   Only verse-level references count in prose (scripture.parseRefs). */

const { editorInfoField, Platform } = require('obsidian');
const { ViewPlugin, Decoration, EditorView } = require('@codemirror/view');
const { RangeSetBuilder, StateEffect } = require('@codemirror/state');
const { parseRefs } = require('./scripture');
const { visibleRefs, mergeLineRanges, LineStates } = require('./chip-scan');
const { showPassagePopover } = require('./popover');

const SKIP = 'code, pre, a, .bn-ref, .frontmatter, .metadata-container, .bn-cover';

function chipsOn(plugin, path) {
  return plugin.settings.chipsEverywhere || (!!path && plugin.store.notes.has(path));
}

/* Sent to every Live Preview editor when whether a note gets chips may have
   changed (the store loaded, a note was adopted, the setting was toggled);
   the editor extension rebuilds its marks on it. */
const refreshChips = StateEffect.define();

/* Whether reading view last drew chips for a path, so a refresh re-renders
   only the previews whose answer has since changed. */
const drawn = new Map();

/* Tell every open markdown view to re-decide its chips: Live Preview through
   the effect, reading view by re-rendering when its answer changed. */
function refreshChipViews(plugin) {
  for (const leaf of plugin.app.workspace.getLeavesOfType('markdown')) {
    const view = leaf.view;
    if (!view) continue;
    const cm = view.editor && view.editor.cm;
    if (cm && cm.dispatch) {
      try { cm.dispatch({ effects: refreshChips.of(null) }); } catch (e) { console.error('bible-notes chips', e); }
    }
    const path = view.file ? view.file.path : null;
    const now = path ? chipsOn(plugin, path) : null;
    if (path && view.previewMode && drawn.has(path) && drawn.get(path) !== now) {
      drawn.set(path, now);
      try { view.previewMode.rerender(true); } catch (e) { console.error('bible-notes chips', e); }
    }
  }
}

function openFrom(plugin, node, sourcePath) {
  const refs = parseRefs(node.getAttribute('data-bn-ref') || node.textContent || '');
  if (refs.length) showPassagePopover(plugin, refs[0], node, sourcePath);
}

/* Reading view. */
function makePostProcessor(plugin) {
  return (root, ctx) => {
    const on = chipsOn(plugin, ctx.sourcePath);
    drawn.set(ctx.sourcePath, on);
    if (!on) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement && n.parentElement.closest(SKIP)) continue;
      const refs = parseRefs(n.nodeValue);
      if (refs.length) hits.push([n, refs]);
    }
    for (const [node, refs] of hits) {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let at = 0;
      for (const r of refs) {
        if (r.start > at) frag.appendChild(document.createTextNode(text.slice(at, r.start)));
        const a = document.createElement('a');
        a.className = 'bn-ref';
        a.href = '#';
        a.textContent = text.slice(r.start, r.end);
        a.setAttribute('data-bn-ref', r.raw);
        a.setAttribute('aria-haspopup', 'dialog');
        a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openFrom(plugin, a, ctx.sourcePath); });
        frag.appendChild(a);
        at = r.end;
      }
      if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
      node.parentNode.replaceChild(frag, node);
    }
  };
}

/* Live Preview / source mode. */
function makeEditorExtension(plugin) {
  const pathOf = view => {
    const info = view.state.field(editorInfoField, false);
    return info && info.file ? info.file.path : null;
  };
  /* Chips on the visible lines only, and — as in reading view — never in
     the frontmatter, inside a code block, or inside inline code, a link, a
     wikilink, a URL, a comment or math (chip-scan.js masks those). Telling
     frontmatter and fences apart needs the lines above the viewport, so
     the state entering each line is cached (LineStates) and dropped only
     from the first changed line down; a scroll reuses all of it. */
  function build(view, states) {
    if (!chipsOn(plugin, pathOf(view))) return Decoration.none;
    const doc = view.state.doc;
    const shown = mergeLineRanges(view.visibleRanges.map(r => [doc.lineAt(r.from).number, doc.lineAt(r.to).number]));
    if (!shown.length) return Decoration.none;
    const b = new RangeSetBuilder();
    const textOf = n => doc.line(n).text;
    for (const [a, z] of shown) {
      states.walk(textOf, a, z, (n, text) => {
        const refs = visibleRefs(text);
        if (!refs.length) return;
        const from = doc.line(n).from;
        for (const r of refs) {
          b.add(from + r.start, from + r.end, Decoration.mark({ class: 'bn-ref', attributes: { 'data-bn-ref': r.raw } }));
        }
      });
    }
    return b.finish();
  }
  const marks = ViewPlugin.fromClass(class {
    constructor(view) {
      this.states = new LineStates();
      this.doc = view.state.doc;
      this.on = chipsOn(plugin, pathOf(view));
      this.decorations = build(view, this.states);
    }
    update(u) {
      if (u.docChanged) {
        if (u.startState.doc !== this.doc) this.states.reset();
        let first = u.state.doc.length;
        u.changes.iterChangedRanges((fromA, toA, fromB) => { if (fromB < first) first = fromB; });
        this.states.invalidateFrom(u.state.doc.lineAt(first).number);
      }
      this.doc = u.state.doc;
      const forced = u.transactions.some(tr => tr.effects.some(e => e.is(refreshChips)));
      const on = chipsOn(plugin, pathOf(u.view));
      if (u.docChanged || u.viewportChanged || (forced && on !== this.on)) {
        this.on = on;
        this.decorations = build(u.view, this.states);
      }
    }
  }, { decorations: v => v.decorations });
  /* Desktop: a plain click on a chip opens the card instead of moving the
     cursor; with a modifier, or from the keyboard, the text edits as normal.
     Phone: a tap lands as a click after the caret has moved (iOS places the
     caret whatever mousedown does), so the card opens on click and the
     caret is left where the tap put it. */
  const chipAt = e => (e.target && e.target.closest ? e.target.closest('.bn-ref') : null);
  const plain = e => e.button === 0 && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
  const taps = EditorView.domEventHandlers({
    mousedown(e, view) {
      if (Platform.isMobile) return false;
      const t = chipAt(e);
      if (!t || !plain(e)) return false;
      e.preventDefault();
      openFrom(plugin, t, pathOf(view));
      return true;
    },
    click(e, view) {
      if (!Platform.isMobile) return false;
      const t = chipAt(e);
      if (!t || !plain(e)) return false;
      openFrom(plugin, t, pathOf(view));
      return false;
    },
  });
  return [marks, taps];
}

module.exports = { makePostProcessor, makeEditorExtension, refreshChipViews, chipsOn };
