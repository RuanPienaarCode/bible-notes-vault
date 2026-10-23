/* Minimal `obsidian` stand-in for the browser harness. setIcon draws a plain
   24x24 stroke path per name so the layout matches what lucide occupies. */
const PATHS = {
  'book-open': 'M2 5.5C4.5 4 8 4 12 6c4-2 7.5-2 10-.5V20c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5ZM12 6v14.5',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'external-link': 'M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  pencil: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  'arrow-up-right': 'M7 17 17 7M7 7h10v10',
  church: 'M10 9h4M12 7v5M14 22v-4a2 2 0 0 0-4 0v4M18 22V5.6L12 2 6 5.6V22M2 22h20',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  sunrise: 'M12 2v8M4.9 10.9l1.4 1.4M2 18h2M20 18h2M19.1 10.9l-1.4 1.4M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0',
  'sliders-horizontal': 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  home: 'M3 10 12 3l9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM9 22V12h6v10',
  check: 'M20 6 9 17l-5-5',
};
export function setIcon(node, name) {
  const d = PATHS[name];
  if (!d) { node.textContent = '□'; return; }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  svg.append(p);
  node.append(svg);
}
export class Notice {
  constructor(msg) {
    const n = document.createElement('div');
    n.className = 'stub-notice';
    n.textContent = msg;
    document.body.append(n);
    setTimeout(() => n.remove(), 4000);
    console.log('[Notice]', msg);
  }
}
export class Modal {
  constructor(app) {
    this.app = app;
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal stub-modal';
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'modal-content';
    this.modalEl.append(this.contentEl);
    this.bg = document.createElement('div');
    this.bg.className = 'stub-modal-bg';
    this.bg.addEventListener('click', () => this.close());
  }
  open() { document.body.append(this.bg, this.modalEl); this.onOpen && this.onOpen(); }
  close() { this.onClose && this.onClose(); this.modalEl.remove(); this.bg.remove(); }
}
/* Home's settings button: the items are logged, and the first click on each
   runs it (enough to drive a tile toggle from the harness console). */
export class Menu {
  constructor() { this.items = []; }
  addItem(cb) {
    const item = { title: '', checked: null, run: null };
    const api = {
      setTitle: t => { item.title = t; return api; }, setChecked: c => { item.checked = c; return api; },
      setIcon: () => api, onClick: f => { item.run = f; return api; },
    };
    cb(api);
    this.items.push(item);
    return this;
  }
  addSeparator() { return this; }
  showAtPosition() { window.__bnMenu = this.items; console.log('[Menu]', this.items.map(i => `${i.checked === null ? '' : i.checked ? '[x] ' : '[ ] '}${i.title}`).join(' | ')); }
}
export class Plugin {}
export class ItemView {}
export class MarkdownView {}
export class PluginSettingTab {}
export class Setting {}
export class TFile {}
export class TFolder {}
export const editorInfoField = {};
export const Platform = { isMobile: document.body.classList.contains('is-mobile') };
export const normalizePath = p => String(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
