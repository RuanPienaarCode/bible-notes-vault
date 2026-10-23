'use strict';
/* Seam 5 — bundle-safety gates for the real mobile floor (iOS 15 WebKit):
   1. no lookbehind regex literals in src/;  2. no Node APIs in src/;
   3. no innerHTML / outerHTML / insertAdjacentHTML;  4. the built main.js
   (when present) evaluates against obsidian + CodeMirror stubs and exports
   a Plugin subclass;  5. the stylesheet (src/styles.css, and the built root
   styles.css when present) uses no CSS iOS 15 WebKit can't parse or that
   drops a whole rule: :has(), color-mix(), @container, @layer, nesting, a
   backdrop-filter without its -webkit- twin, a :focus-visible rule without
   the @supports fallback. */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const NODE_REQUIRES = /require\(\s*['"](?:node:)?(fs|path|os|child_process|crypto|http|https|net|electron)['"]\s*\)/;

for (const f of fs.readdirSync(srcDir).filter(f => f.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(srcDir, f), 'utf8');
  assert.ok(!text.includes('(?<'), `${f}: lookbehind/named-group regex literal — iOS 15 fatal`);
  assert.ok(!NODE_REQUIRES.test(text), `${f}: Node API require — mobile fatal`);
  assert.ok(!/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML/.test(text), `${f}: HTML string injection — build DOM instead`);
}

/* ---- CSS ---- */
/* Returns the problems found in one stylesheet's text. Exported through
   module.exports.cssHazards so the negative controls below can feed it text
   that breaks each rule. */
function cssHazards(raw) {
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\(data:[^)]*\)/g, 'url()');
  const found = [];
  if (/:has\(/.test(css)) found.push(':has() needs iOS 15.4');
  if (/color-mix\(/.test(css)) found.push('color-mix() needs iOS 16.2');
  if (/@container\b/.test(css)) found.push('@container needs iOS 16');
  if (/@layer\b/.test(css)) found.push('@layer needs iOS 15.4');
  /* nesting: a `{` inside a style rule's block (at-rule blocks may nest) */
  const stack = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      const head = css.slice(start, i).trim();
      const at = head.startsWith('@');
      if (stack.length && !stack[stack.length - 1]) found.push(`nested rule in a style rule: ${head.slice(0, 40)}`);
      stack.push(at && !/^@(font-face|page)/.test(head));
      start = i + 1;
    } else if (ch === '}') { stack.pop(); start = i + 1; } else if (ch === ';') start = i + 1;
  }
  /* every backdrop-filter has a -webkit- twin in the same block, first */
  for (const block of css.match(/\{[^{}]*\}/g) || []) {
    if (/(^|[;{\s])backdrop-filter\s*:/.test(block) && !/-webkit-backdrop-filter\s*:/.test(block)) found.push('backdrop-filter without -webkit-backdrop-filter');
  }
  if (/:focus-visible/.test(css) && !/@supports\s+not\s+selector\(\s*:focus-visible\s*\)/.test(css)) found.push(':focus-visible without the @supports fallback');
  return found;
}
for (const f of ['src/styles.css', 'styles.css']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  assert.deepStrictEqual(cssHazards(fs.readFileSync(p, 'utf8')), [], `${f}: iOS 15 CSS hazard`);
}
/* negative controls: each rule must fail on text that breaks it */
assert.ok(cssHazards('.a:has(.b){color:red}').length, 'guard misses :has()');
assert.ok(cssHazards('.a{background:color-mix(in srgb,red,blue)}').length, 'guard misses color-mix()');
assert.ok(cssHazards('@container (min-width:1px){.a{color:red}}').length, 'guard misses @container');
assert.ok(cssHazards('.a{color:red;.b{color:blue}}').length, 'guard misses nesting');
assert.ok(cssHazards('.a{backdrop-filter:blur(2px)}').length, 'guard misses a bare backdrop-filter');
assert.ok(cssHazards('.a:focus-visible{outline:0}').length, 'guard misses a bare :focus-visible');
assert.deepStrictEqual(cssHazards('@media (hover:hover){.a{-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}}@supports not selector(:focus-visible){.a:focus{outline:0}}.a:focus-visible{outline:0}'), [], 'guard flags good CSS');

const bundlePath = path.join(root, 'main.js');
if (fs.existsSync(bundlePath)) {
  class Base {}
  const obsidian = {
    Plugin: class Plugin {}, ItemView: class ItemView {}, MarkdownView: class MarkdownView {}, Modal: class Modal {},
    Setting: class Setting {}, PluginSettingTab: class PluginSettingTab {}, Notice: class Notice {}, Menu: class Menu {},
    TFile: class TFile {}, TFolder: class TFolder {}, Platform: { isMobile: false },
    normalizePath: p => p, setIcon: () => {}, debounce: f => f,
  };
  const cmView = {
    ViewPlugin: { fromClass: () => ({}) }, Decoration: { mark: () => ({ range: () => ({}) }), set: () => ({}), none: {} },
    EditorView: Object.assign(Base, { domEventHandlers: () => ({}) }), WidgetType: Base,
  };
  const cmState = { RangeSetBuilder: class { add() {} finish() { return {}; } } };
  const origLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'obsidian') return obsidian;
    if (request === '@codemirror/view') return cmView;
    if (request === '@codemirror/state') return cmState;
    return origLoad.call(this, request, ...rest);
  };
  try {
    const text = fs.readFileSync(bundlePath, 'utf8');
    assert.ok(!text.includes('(?<'), 'main.js: lookbehind survived into the bundle');
    delete require.cache[bundlePath];
    const exported = require(bundlePath);
    assert.strictEqual(typeof exported, 'function', 'bundle must export the plugin class');
    assert.ok(exported.prototype instanceof obsidian.Plugin, 'export must extend obsidian.Plugin');
  } finally {
    Module._load = origLoad;
  }
  console.log('ios hazards OK (bundle evaluated)');
} else {
  console.log('ios hazards OK (src only — main.js not built yet)');
}
