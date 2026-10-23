'use strict';
/* Home's floating dock and the create sheet. The dock is a rounded bar pinned
   to the bottom of the Home view: Top and Open on the left, a raised round +
   in the middle, Prayers and Search on the right — one width, always there.
   + opens the sheet: a bottom sheet on a narrow view, a popover standing on
   the + on a wide one (the CSS decides by `.is-compact` on the layer). The
   sheet's rows are the four kinds and a prayer request; a Sunday note with a
   series to continue asks once, in a second step of the same sheet.

   DOM on the standard API only, so the preview harness renders this exact
   code. What each button DOES is passed in (`h`); this file only draws and
   moves focus. */

const { el, icon, clear } = require('./dom');

const DOCK = [
  { id: 'top', icon: 'arrow-up', label: 'Top', aria: 'Scroll to the top' },
  { id: 'open', icon: 'list-checks', label: 'Open', aria: 'Go to Still open' },
  { id: 'create' },
  { id: 'pray', icon: 'hand-heart', label: 'Prayers', aria: 'Go to Praying for' },
  { id: 'search', icon: 'search', label: 'Search', aria: 'Search notes and passages' },
];

const FOCUSABLE = 'button:not([disabled])';

/* layer: the element the dock and sheet live in (position: absolute over the
   view). h: {
     onTop(), onOpen(), onPray(), onSearch(),
     rows()      -> createRows(...) with `lead` marked,
     sunday()    -> sundayPlan(...) (read when the Sunday step is drawn),
     pick(row)   -> a row was chosen (the sheet is already closed),
     chooseSunday(series | null) -> the Sunday step's answer (sheet closed),
   } */
function mountDock(layer, h) {
  const nav = el(layer, 'nav', 'bn-dock');
  nav.setAttribute('aria-label', 'Quick actions');
  let plus = null;
  for (const d of DOCK) {
    if (d.id === 'create') {
      const slot = el(nav, 'span', 'bn-dock-slot');
      plus = el(slot, 'button', 'bn-dock-plus');
      plus.type = 'button';
      plus.setAttribute('aria-label', 'Create a note or a prayer request');
      plus.setAttribute('aria-haspopup', 'dialog');
      plus.setAttribute('aria-expanded', 'false');
      icon(plus, 'plus');
      el(slot, 'span', 'bn-dock-l', 'New');
      plus.addEventListener('click', () => (sheet ? close(true) : open('menu', true)));
      continue;
    }
    const b = el(nav, 'button', 'bn-dock-btn');
    b.type = 'button';
    b.setAttribute('aria-label', d.aria);
    icon(b, d.icon);
    el(b, 'span', 'bn-dock-l', d.label);
    b.addEventListener('click', () => h[{ top: 'onTop', open: 'onOpen', pray: 'onPray', search: 'onSearch' }[d.id]]());
  }

  /* ---- the sheet ---- */
  let sheet = null; /* { wrap, panel, step, back } */
  let returnTo = null;

  function close(restore) {
    if (!sheet) return;
    sheet.wrap.remove();
    sheet = null;
    plus.setAttribute('aria-expanded', 'false');
    if (restore && returnTo && returnTo.isConnected) returnTo.focus();
    returnTo = null;
  }

  function row(parent, cls, iconName, title, sub, onClick) {
    const r = el(parent, 'button', 'bn-sheet-row' + (cls ? ' ' + cls : ''));
    r.type = 'button';
    icon(el(r, 'span', 'bn-sheet-ico'), iconName);
    const t = el(r, 'span', 'bn-sheet-t');
    el(t, 'span', 'bn-sheet-title', title);
    if (sub) el(t, 'span', 'bn-sheet-sub', sub);
    r.addEventListener('click', onClick);
    return r;
  }

  const SUB = {
    sunday: 'Message, what stuck, response',
    community: 'Discussion, prayer, follow up',
    meditation: 'Read, noticed, carry today',
    study: 'A passage you come back to',
    prayer: 'Added to your prayer list',
  };

  /* What the open sheet shows, as one string: Home redraws on every vault
     change, and a sheet that did not change must not lose the focus. */
  const shown = () => JSON.stringify([h.rows().map(r => [r.id, r.label, r.open, r.lead]), h.sunday()]);

  function draw() {
    const { panel } = sheet;
    sheet.sig = shown();
    clear(panel);
    if (sheet.step === 'menu') {
      el(panel, 'h2', 'bn-sheet-h', 'Create');
      const list = el(panel, 'div', 'bn-sheet-list');
      for (const r of h.rows()) {
        row(list, r.lead ? 'is-lead' : '', r.icon, r.label, r.open ? r.title : SUB[r.id], () => {
          if (r.id === 'sunday' && !r.open && h.sunday().action === 'ask') { sheet.step = 'sunday'; sheet.back = true; draw(); return; }
          close(false);
          h.pick(r);
        });
      }
    } else {
      const plan = h.sunday();
      const head = el(panel, 'div', 'bn-sheet-head');
      if (sheet.back) {
        const b = el(head, 'button', 'bn-sheet-back');
        b.type = 'button';
        b.setAttribute('aria-label', 'Back');
        icon(b, 'chevron-left');
        b.addEventListener('click', () => { sheet.step = 'menu'; draw(); });
      }
      el(head, 'h2', 'bn-sheet-h', 'Sunday note');
      const list = el(panel, 'div', 'bn-sheet-list');
      if (plan.action === 'ask') {
        row(list, 'is-lead', 'church', `Continue ${plan.series} · part ${plan.part}`, `Adds the series “${plan.series}”`, () => { close(false); h.chooseSunday(plan.series); });
        row(list, '', 'plus', 'New sermon', 'A one-off, with no series', () => { close(false); h.chooseSunday(null); });
      }
    }
    const first = panel.querySelector(FOCUSABLE + '.bn-sheet-row') || panel.querySelector(FOCUSABLE);
    if (first) first.focus();
  }

  /* step: 'menu' (the + button) or 'sunday' (the Start tile, straight to the
     one question). from: the element focus goes back to on close. */
  function open(step, fromPlus) {
    if (sheet) close(false);
    returnTo = fromPlus ? plus : (layer.ownerDocument.activeElement || null);
    const wrap = el(layer, 'div', 'bn-sheet-wrap');
    const scrim = el(wrap, 'div', 'bn-scrim');
    scrim.addEventListener('click', () => close(true));
    const panel = el(wrap, 'div', 'bn-sheet');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', step === 'menu' ? 'Create' : 'Sunday note');
    sheet = { wrap, panel, step, back: false };
    plus.setAttribute('aria-expanded', 'true');
    wrap.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const at = items.indexOf(layer.ownerDocument.activeElement);
      const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at < 0 || at === items.length - 1 ? 0 : at + 1);
      e.preventDefault();
      items[next].focus();
    });
    draw();
  }

  return {
    open,
    close,
    isOpen: () => !!sheet,
    /* Narrow views get the bottom sheet, wide ones the popover. */
    setCompact(on) { layer.classList.toggle('is-compact', !!on); },
    /* Home redrew (a note was made elsewhere, midnight passed): an open sheet
       reads the new rows, or closes when its Sunday question is gone. */
    refresh() {
      if (!sheet || sheet.sig === shown()) return;
      if (sheet.step === 'sunday' && h.sunday().action !== 'ask') { close(true); return; }
      draw();
    },
    destroy() { close(false); nav.remove(); },
  };
}

module.exports = { mountDock, DOCK };
