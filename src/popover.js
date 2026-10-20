'use strict';
/* The small card a passage chip opens: where to read it, and the other
   notes on the same chapter. Never shows verse text. One at a time; closes
   on Escape, an outside tap, or the page moving under it. */

const { el, icon } = require('./dom');
const { kindOf } = require('./constants');
const { chapterKeys, passageNoteName, linkTranslation } = require('./scripture');
const { notesOn } = require('./index');
const D = require('./dates');

const WIDTH = 264;
let current = null;

function closePopover() {
  if (!current) return;
  const c = current;
  current = null;
  c.cleanup();
  c.node.remove();
}

function showPassagePopover(plugin, ref, anchor, sourcePath) {
  closePopover();
  const store = plugin.store;
  const today = D.todayISO();
  const pop = el(document.body, 'div', 'bn-popover');
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', ref.label);

  const head = el(pop, 'div', 'bn-pop-head');
  el(head, 'strong', null, ref.label);
  const inVault = store.chapterNote(ref);
  /* The badge names what the link opens: the reference's own translation
     when BibleHub has it, otherwise the chosen one. A vault chapter note
     opens in the vault's own text, so the reference keeps its tag. */
  el(head, 'span', 'bn-pill', inVault ? (ref.translation || '').toUpperCase() || 'Your Bible' : linkTranslation(ref, plugin.settings.translation));
  const go = el(pop, 'button', 'bn-pop-row');
  go.type = 'button';
  icon(go, 'book-open');
  el(go, 'span', 'bn-grow', inVault ? `Open ${passageNoteName(ref)}` : 'Open in BibleHub');
  if (!inVault) icon(go, 'external-link', 'bn-dim');
  go.addEventListener('click', () => { closePopover(); store.openPassage(ref, sourcePath); });

  el(pop, 'div', 'bn-pop-rule');
  el(pop, 'div', 'bn-pop-label', 'Also in your notes');
  const seen = new Set([sourcePath]);
  const others = [];
  for (const key of chapterKeys(ref)) for (const n of notesOn(store.index, key)) {
    if (!seen.has(n.path)) { seen.add(n.path); others.push(n); }
  }
  if (!others.length) {
    el(pop, 'p', 'bn-pop-empty', `No other notes on ${chapterKeys(ref)[0]} yet.`);
  } else {
    for (const n of others.slice(0, 5)) {
      const r = el(pop, 'button', 'bn-pop-row');
      r.type = 'button';
      el(r, 'span', 'bn-row-emoji', kindOf(n.kind).emoji).setAttribute('aria-hidden', 'true');
      el(r, 'span', 'bn-grow bn-ellipsis', n.title);
      el(r, 'span', 'bn-dim', n.date ? D.shortDate(n.date, today) : '');
      r.addEventListener('click', () => { closePopover(); store.openPath(n.path); });
    }
  }

  /* Below the chip, or above it when there is no room; never off screen.
     The VISIBLE viewport, so on a phone it never hides behind the keyboard. */
  const rect = anchor.getBoundingClientRect();
  const vv = window.visualViewport;
  const vw = window.innerWidth;
  const top0 = vv ? vv.offsetTop : 0;
  const vh = vv ? vv.height + vv.offsetTop : window.innerHeight;
  const w = Math.min(WIDTH, vw - 16);
  pop.style.width = `${w}px`;
  pop.style.left = `${Math.max(8, Math.min(rect.left, vw - w - 8))}px`;
  const h = pop.offsetHeight;
  const below = rect.bottom + 6;
  pop.style.top = `${below + h > vh - 8 && rect.top - h - 6 > top0 + 8 ? rect.top - h - 6 : Math.min(below, Math.max(top0 + 8, vh - h - 8))}px`;
  /* Take focus only when the chip was opened from the keyboard. From a tap
     in the editor, moving focus would drop the phone's keyboard and lose the
     writer's place. */
  if (document.activeElement === anchor) go.focus({ preventScroll: true });

  /* The keyboard appearing or going away resizes and scrolls the page; that
     must not close the card. Only a real width change (rotation) does, and
     nothing counts in the first moment after opening. */
  const opened = Date.now();
  const settled = () => Date.now() - opened > 400;
  const width0 = window.innerWidth;
  const onDown = e => { if (!pop.contains(e.target) && e.target !== anchor) closePopover(); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); closePopover(); anchor.focus && anchor.focus(); } };
  const onMove = e => {
    if (!settled() || pop.contains(e.target)) return;
    const t0 = e.target;
    if (t0 === document || (t0 && t0.contains && t0.contains(anchor))) closePopover();
  };
  const onResize = () => { if (settled() && window.innerWidth !== width0) closePopover(); };
  /* Listeners go on after this tap finishes, or it would close at once. */
  const t = setTimeout(() => {
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('scroll', onMove, true);
  }, 0);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  current = {
    node: pop,
    cleanup() {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('scroll', onMove, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
    },
  };
  return pop;
}

module.exports = { showPassagePopover, closePopover };
