'use strict';
/* A fake Obsidian host for the store tests: an in-memory vault with the
   surface src/store.js touches, a metadata cache read from the same text,
   a workspace that records what was opened, and a stubbed `obsidian`
   module. Not a test file itself (run-tests.mjs only runs *.test.cjs). */
const Module = require('node:module');
const { parseFrontmatter } = require('../src/frontmatter');

const notices = [];
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'obsidian') {
    return {
      Notice: class { constructor(m) { notices.push(m); } },
      normalizePath: p => String(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || '/',
      setIcon() {},
    };
  }
  return origLoad.call(this, request, ...rest);
};

function makeApp(initial, opts) {
  const files = new Map(Object.entries(initial || {}));
  const folders = new Set();
  const listeners = {};
  let clock = 1;
  const mtimes = new Map();
  const parent = p => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  const ensureParents = p => { let d = parent(p); while (d) { folders.add(d); d = parent(d); } };
  for (const p of files.keys()) { ensureParents(p); mtimes.set(p, clock++); }
  const fileObj = p => {
    const name = p.slice(p.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    return { path: p, name, basename: dot > 0 ? name.slice(0, dot) : name, extension: dot > 0 ? name.slice(dot + 1) : '', stat: { mtime: mtimes.get(p) || 0 } };
  };
  const emit = (ev, ...a) => (listeners[ev] || []).forEach(cb => cb(...a));
  const touch = p => mtimes.set(p, clock++);

  const vault = {
    files,
    getMarkdownFiles: () => [...files.keys()].filter(p => p.endsWith('.md')).map(fileObj),
    getFiles: () => [...files.keys()].map(fileObj),
    getFileByPath: p => (files.has(p) ? fileObj(p) : null),
    getAbstractFileByPath: p => (files.has(p) ? fileObj(p) : (folders.has(p) ? { path: p, children: [] } : null)),
    cachedRead: async f => files.get(f.path) ?? '',
    read: async f => files.get(f.path) ?? '',
    async create(p, content) {
      if ([...files.keys()].some(k => k.toLowerCase() === p.toLowerCase())) throw new Error('exists: ' + p);
      ensureParents(p); files.set(p, content); touch(p); emit('create', fileObj(p)); return fileObj(p);
    },
    async process(f, fn) { const next = fn(files.get(f.path) ?? ''); files.set(f.path, next); touch(f.path); emit('modify', fileObj(f.path)); return next; },
    async createFolder(p) { folders.add(p); },
    async rename(f, np) { const c = files.get(f.path); files.delete(f.path); ensureParents(np); files.set(np, c); touch(np); emit('rename', fileObj(np), f.path); },
    on(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); return { ev, cb }; },
  };

  const opened = [], openStates = [], revealed = [], links = [], windows = [];
  const app = {
    vault,
    metadataCache: {
      getFileCache: f => (files.has(f.path) ? { frontmatter: parseFrontmatter(files.get(f.path)).fm } : null),
      getFirstLinkpathDest: name => { const p = [...files.keys()].find(k => fileObj(k).basename === name); return p ? fileObj(p) : null; },
      on: () => ({}),
    },
    workspace: {
      /* Records how a file was opened and whether its tab was revealed. */
      getLeaf: () => { const leaf = { openFile: async (f, state) => { opened.push(f.path); openStates.push(state || null); leaf.file = f.path; } }; return leaf; },
      revealLeaf: async leaf => { revealed.push(leaf.file); },
      openLinkText: async (link, source) => { links.push([link, source]); },
    },
    fileManager: { renameFile: (f, np) => vault.rename(f, np) },
    plugins: { plugins: (opts && opts.plugins) || {} },
  };
  global.window = { open: (url, target, features) => { windows.push([url, target, features]); return null; } };
  return { app, vault, files, opened, openStates, revealed, links, windows, notices };
}

module.exports = { makeApp, notices };
