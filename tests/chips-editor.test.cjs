'use strict';
/* Seam 6b — the Live Preview extension's wiring, run against a small fake of
   the CodeMirror pieces it touches (the real editor is checked in Obsidian):
   which lines get marks, that an edit invalidates the line-state cache from
   its first changed line, and that the refresh effect rebuilds only when
   whether a note gets chips has flipped. */
const assert = require('node:assert');
const Module = require('node:module');

/* ---- fakes ---- */
const INFO = { token: 'editorInfoField' };
class FakeDoc {
  constructor(lines) { this.lines = lines; this.starts = []; let p = 0; for (const l of lines) { this.starts.push(p); p += l.length + 1; } this.length = p - 1; }
  line(n) { return { number: n, text: this.lines[n - 1], from: this.starts[n - 1], to: this.starts[n - 1] + this.lines[n - 1].length }; }
  lineAt(pos) { let n = 1; while (n < this.lines.length && this.starts[n] <= pos) n++; return this.line(n); }
}
class FakeBuilder { constructor() { this.out = []; } add(from, to, deco) { this.out.push([from, to, deco.class]); } finish() { return this.out; } }
let pluginSpec = null;
const NONE = Object.freeze([]);
const obsidian = { editorInfoField: INFO, Platform: { isMobile: false }, setIcon() {} };
const cmView = {
  ViewPlugin: { fromClass: (cls) => { pluginSpec = cls; return {}; } },
  Decoration: { mark: spec => spec, none: NONE },
  EditorView: { domEventHandlers: () => ({}) },
};
const cmState = {
  RangeSetBuilder: FakeBuilder,
  /* An effect answers e.is(type) true only for the type that made it. */
  StateEffect: { define: () => { const self = {}; self.of = value => ({ is: t => t === self, value }); return self; } },
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'obsidian') return obsidian;
  if (request === '@codemirror/view') return cmView;
  if (request === '@codemirror/state') return cmState;
  return origLoad.call(this, request, ...rest);
};
const chips = require('../src/chips');
Module._load = origLoad;

const plugin = { settings: { chipsEverywhere: true }, store: { notes: new Map() } };
chips.makeEditorExtension(plugin);
const Plugin = pluginSpec;

/* The refresh effect, taken from the ViewPlugin source by dispatching one
   through refreshChipViews against a fake workspace. */
let sent = null;
const leafOf = (cm, path) => ({ view: { editor: { cm }, file: { path }, previewMode: null } });
function effectFor(path) {
  const cm = { dispatch: tr => { sent = tr.effects; } };
  const p = { ...plugin, app: { workspace: { getLeavesOfType: () => [leafOf(cm, path)] } } };
  chips.refreshChipViews(p);
  return sent;
}

let currentPath = 'Notes/a.md';
const viewOf = (doc, from, to) => ({
  state: { doc, field: (f) => (f === INFO ? { file: { path: currentPath } } : undefined) },
  visibleRanges: [{ from: doc.starts[from - 1], to: doc.line(to).to }],
});
const marks = (deco, doc) => deco.map(([a, z]) => { const t = doc.lines.join('\n').slice(a, z); return t; });
/* A fresh instance on the same doc/view: what the cached one must equal. */
const fresh = (doc, a, z) => new Plugin(viewOf(doc, a, z)).decorations;

/* ---- first draw: only the plain reference is marked ---- */
const lines1 = ['---', 'title: John 3:1', '---', 'See John 3:16 and `John 3:17` here', '```', 'John 3:18', '```', 'Then [x](u) John 3:19 [[John 3:20]] John 3:21'];
const doc1 = new FakeDoc(lines1);
const view1 = viewOf(doc1, 1, 8);
const inst = new Plugin(view1);
assert.deepStrictEqual(marks(inst.decorations, doc1), ['John 3:16', 'John 3:19', 'John 3:21']);

/* ---- viewport-only update reuses the cache ---- */
{
  const before = inst.states.classified;
  inst.update({ docChanged: false, viewportChanged: true, view: view1, transactions: [], state: view1.state });
  assert.strictEqual(inst.states.classified - before, 8, 'a scroll re-walks only the visible lines');
  assert.deepStrictEqual(marks(inst.decorations, doc1), ['John 3:16', 'John 3:19', 'John 3:21']);
}

/* ---- an edit on line 5 (the opening fence) invalidates from line 5 ---- */
{
  const lines2 = lines1.slice(); lines2[4] = '(no fence now)';
  const doc2 = new FakeDoc(lines2);
  const view2 = viewOf(doc2, 1, 8);
  const change = (fromA, toA, fromB, toB) => ({ iterChangedRanges: fn => fn(fromA, toA, fromB, toB) });
  const fromB = doc2.starts[4];
  inst.update({ docChanged: true, viewportChanged: false, view: view2, transactions: [], state: view2.state, startState: { doc: doc1 }, changes: change(fromB, fromB + 3, fromB, fromB + 14) });
  assert.deepStrictEqual(marks(inst.decorations, doc2), marks(fresh(doc2, 1, 8), doc2), 'cached update equals a fresh draw');
  assert.ok(marks(inst.decorations, doc2).includes('John 3:18'), 'the line that was fenced now gets a chip');
}

/* ---- a doc swapped under a change that claims to start late: the guard
   notices the document is not the one the cache was built on ---- */
{
  const doc3 = new FakeDoc(['plain', 'John 3:16']);
  const view3 = viewOf(doc3, 1, 2);
  inst.update({ docChanged: true, viewportChanged: false, view: view3, transactions: [], state: view3.state, startState: { doc: new FakeDoc(['x']) }, changes: { iterChangedRanges: fn => fn(6, 9, 6, 15) } });
  assert.deepStrictEqual(marks(inst.decorations, doc3), ['John 3:16']);
}

/* ---- the refresh effect ---- */
{
  const doc = new FakeDoc(['John 3:16']);
  const view = viewOf(doc, 1, 1);
  plugin.settings.chipsEverywhere = false;
  const p = new Plugin(view);
  assert.deepStrictEqual(p.decorations, NONE, 'store not loaded and setting off: no chips');
  const effects = effectFor(currentPath);
  assert.ok(effects && typeof effects.is === 'function', 'refreshChipViews dispatches a refresh effect to the editor');
  const tx = { effects: [effects] };
  /* Nothing flipped: the effect must not rebuild. */
  const same = p.decorations;
  p.update({ docChanged: false, viewportChanged: false, view, transactions: [tx], state: view.state });
  assert.strictEqual(p.decorations, same, 'no flip, no rebuild');
  /* The store learns the note (load / adopt): chips appear. */
  plugin.store.notes.set(currentPath, {});
  p.update({ docChanged: false, viewportChanged: false, view, transactions: [tx], state: view.state });
  assert.deepStrictEqual(marks(p.decorations, doc), ['John 3:16']);
  /* Already on, effect again, nothing flipped: left alone. */
  plugin.store.notes.set(currentPath, {});
  const on = p.decorations;
  p.update({ docChanged: false, viewportChanged: false, view, transactions: [tx], state: view.state });
  assert.strictEqual(p.decorations, on, 'an effect with no flip does not rebuild');
  /* An update with no effect and no change leaves it alone, even if the answer moved. */
  plugin.store.notes.delete(currentPath);
  const kept = p.decorations;
  p.update({ docChanged: false, viewportChanged: false, view, transactions: [], state: view.state });
  assert.strictEqual(p.decorations, kept, 'only the effect, a change or a scroll rebuilds');
  /* The setting toggled on: chips for any note. */
  plugin.settings.chipsEverywhere = true;
  p.update({ docChanged: false, viewportChanged: false, view, transactions: [tx], state: view.state });
  assert.deepStrictEqual(marks(p.decorations, doc), ['John 3:16']);
  /* Toggled off again: chips go. */
  plugin.settings.chipsEverywhere = false;
  p.update({ docChanged: false, viewportChanged: false, view, transactions: [tx], state: view.state });
  assert.deepStrictEqual(p.decorations, NONE);
}

/* ---- reading view: re-render only previews whose answer changed ---- */
{
  let renders = 0;
  const view = { editor: null, file: { path: 'R/b.md' }, previewMode: { rerender: () => { renders++; } } };
  const p = { ...plugin, app: { workspace: { getLeavesOfType: () => [{ view }] } } };
  plugin.settings.chipsEverywhere = false;
  const post = chips.makePostProcessor(plugin);
  /* A section drawn with chips off is remembered (an empty root is enough). */
  const root = { ownerDocument: null };
  global.document = { createTreeWalker: () => ({ nextNode: () => null }) };
  global.NodeFilter = { SHOW_TEXT: 4 };
  post(root, { sourcePath: 'R/b.md' });
  chips.refreshChipViews(p);
  assert.strictEqual(renders, 0, 'nothing changed: no re-render');
  plugin.settings.chipsEverywhere = true;
  chips.refreshChipViews(p);
  assert.strictEqual(renders, 1, 'the setting flipped: the preview re-renders once');
  chips.refreshChipViews(p);
  assert.strictEqual(renders, 1, 'and not again until it flips back');
  delete global.document; delete global.NodeFilter;
}

console.log('chips-editor.test.cjs ok');
