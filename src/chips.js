'use strict';
/* Passage chips in the body of a note. The text underneath stays exactly
   what was typed: reading view wraps the reference in a link-like chip,
   Live Preview marks the same characters with a class (still editable).
   Only verse-level references count in prose (scripture.parseRefs). */

const { editorInfoField, Platform } = require('obsidian');
const { ViewPlugin, Decoration, EditorView } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');
const { parseRefs } = require('./scripture');
const { showPassagePopover } = require('./popover');

const SKIP = 'code, pre, a, .bn-ref, .frontmatter, .metadata-container, .bn-cover';

function chipsOn(plugin, path) {
  return plugin.settings.chipsEverywhere || (!!path && plugin.store.notes.has(path));
}

function openFrom(plugin, node, sourcePath) {
  const refs = parseRefs(node.getAttribute('data-bn-ref') || node.textContent || '');
  if (refs.length) showPassagePopover(plugin, refs[0], node, sourcePath);
}

/* Reading view. */
function makePostProcessor(plugin) {
  return (root, ctx) => {
    if (!chipsOn(plugin, ctx.sourcePath)) return;
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
     the frontmatter or inside a code block. Telling those apart needs the
     lines above the viewport too, so the walk starts at the top (notes are
     short; only visible lines are parsed for references). */
  function build(view) {
    if (!chipsOn(plugin, pathOf(view))) return Decoration.none;
    const doc = view.state.doc;
    const shown = view.visibleRanges.map(r => [doc.lineAt(r.from).number, doc.lineAt(r.to).number]);
    if (!shown.length) return Decoration.none;
    const isShown = n => shown.some(([a, z]) => n >= a && n <= z);
    const b = new RangeSetBuilder();
    let front = /^---[ \t]*$/.test(doc.line(1).text);
    let fence = null;
    for (let n = front ? 2 : 1; n <= shown[shown.length - 1][1]; n++) {
      const line = doc.line(n);
      if (front) { if (/^(---|\.\.\.)[ \t]*$/.test(line.text)) front = false; continue; }
      const f = /^[ \t]*(```|~~~)/.exec(line.text);
      if (f) { if (!fence) fence = f[1]; else if (f[1] === fence) fence = null; continue; }
      if (fence || !isShown(n)) continue;
      for (const r of parseRefs(line.text)) {
        b.add(line.from + r.start, line.from + r.end, Decoration.mark({ class: 'bn-ref', attributes: { 'data-bn-ref': r.raw } }));
      }
    }
    return b.finish();
  }
  const marks = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = build(view); }
    update(u) { if (u.docChanged || u.viewportChanged) this.decorations = build(u.view); }
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

module.exports = { makePostProcessor, makeEditorExtension, chipsOn };
