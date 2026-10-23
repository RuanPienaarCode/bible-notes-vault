'use strict';
/* Home — the Dev Glass page: a quick-switcher field, the greeting, the Sunday
   streak, Start as a command palette, Still open, Praying for (with the
   answered diff), Recent as a commit log, the passage index as heat tiles and
   a status line. Built from the index on the standard DOM only, so the
   preview harness renders the same code. */

const { Platform } = require('obsidian');
const { el, icon, button, clear, checkRow } = require('./dom');
const { KINDS, kindOf, accentOf, ACCENT_GREEN } = require('./constants');
const { partOf } = require('./index');
const { buildStreak } = require('./streak');
const D = require('./dates');

const OPEN_LIMIT = 6;
const ANSWERED_FRESH_DAYS = 14;
/* A study session's dated heading: `## 20 October 2026`. */
const SESSION_HEADING = /^#{1,6}[ \t]+\d{1,2} [A-Z][a-z]+ \d{4}[ \t]*$/gm;

const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

function greeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* Which kind the Start list leads with: Sunday all Sunday, Meditation on
   other mornings, none otherwise. */
function emphasis(today, hour) {
  if (D.weekday(today) === 0) return 'sunday';
  if (hour < 12) return 'meditation';
  return null;
}

function firstPassage(note) {
  for (const e of note.scripture) if (e.refs.length) return e.refs[0].label;
  return note.scripture.length ? note.scripture[0].raw : '';
}

/* Obsidian's default hotkey for the quick switcher is Cmd/Ctrl+O. */
const switcherHint = () => (Platform.isMacOS ? '⌘O' : 'Ctrl O');

/* How long the answer took, for the "+" row of the answered diff. */
function daysPhrase(a) {
  if (a.days === null) return '';
  return a.days === 0 ? 'the same day' : `after ${plural(a.days, 'day')}`;
}

function mountHome(container, ctx) {
  const { store } = ctx;
  const state = { openAll: false, answeredOpen: false, chapter: null, adoptCount: 0, seenAnswered: new Set() };
  const root = el(container, 'div', 'bn-home');
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => root.classList.toggle('bn-wide', root.clientWidth >= 760));
    ro.observe(root);
  }

  /* A kind dot, then "Title · date". The button carries the kind class, so
     the dot takes the kind's colour. */
  function meta(parent, note, today) {
    parent.classList.add(`bn-k-${note.kind}`);
    el(parent, 'i', 'bn-dot').setAttribute('aria-hidden', 'true');
    parent.appendChild(document.createTextNode(`${note.title}${note.date ? ' · ' + D.shortDate(note.date, today) : ''}`));
  }

  /* The quick switcher, Obsidian's own. `app.commands` is not in the public
     typings but is what every plugin uses to run a command by id. */
  function openSwitcher() {
    const app = ctx.plugin && ctx.plugin.app;
    if (app && app.commands && app.commands.executeCommandById) app.commands.executeCommandById('switcher:open');
  }

  function taskRow(parent, item, today) {
    const { row, box } = checkRow(parent, 'bn-row bn-task', item.task.done, async (checked) => {
      row.classList.toggle('is-done', checked);
      const ok = await store.toggle(item.note, item.task, checked);
      if (!ok) { box.checked = !checked; row.classList.toggle('is-done', !checked); }
    });
    box.setAttribute('aria-label', item.task.text);
    const t = el(row, 'span', 'bn-task-text');
    el(t, 'span', 'bn-task-title', item.task.text);
    const m = el(t, 'button', 'bn-task-meta');
    m.type = 'button';
    meta(m, item.note, today);
    m.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); store.openPath(item.note.path); });
    return row;
  }

  function sectionHead(parent, title, count) {
    const h = el(parent, 'div', 'bn-sec-head');
    el(h, 'h2', 'bn-label', title);
    if (count !== undefined) el(h, 'span', 'bn-count', String(count));
    return h;
  }

  /* The church line under the date: the last Sunday note's, then the one in
     Settings. */
  function churchOf(idx) {
    const last = idx.notes.find(n => n.kind === 'sunday' && n.church);
    return last ? last.church : ((ctx.plugin && ctx.plugin.settings && ctx.plugin.settings.church) || '');
  }

  function renderSearch(parent) {
    const b = el(parent, 'button', 'bn-glass bn-cmd');
    b.type = 'button';
    icon(b, 'search', 'bn-cmd-ico');
    el(b, 'span', 'bn-cmd-text', 'Jump to a note or passage');
    el(b, 'span', 'bn-kbd bn-cmd-kbd', switcherHint()).setAttribute('aria-hidden', 'true');
    b.addEventListener('click', openSwitcher);
  }

  /* 13 weeks x 7 days. Sunday notes in the accent, other notes dimmer, today
     dashed. Hidden when there are no notes at all. */
  function renderStreak(parent, idx, now, today) {
    const s = buildStreak(idx.notes, now);
    if (s.empty) return;
    const sec = el(parent, 'section', 'bn-glass bn-streak');
    sec.setAttribute('aria-label', 'Sunday streak');
    const head = el(sec, 'div', 'bn-st-h');
    el(head, 'strong', null, s.sundays ? `${plural(s.sundays, 'Sunday')} in a row` : 'No Sundays in a row');
    const next = s.next.today ? 'today' : (D.diffDays(today, s.next.date) === 1 ? 'tomorrow' : `Sun ${D.shortDate(s.next.date, today)}`);
    el(head, 'span', null, `next: ${next}`);
    const grid = el(sec, 'div', 'bn-hm');
    grid.setAttribute('aria-hidden', 'true');
    for (const week of s.weeks) {
      const col = el(grid, 'span', 'bn-hm-c');
      for (const c of week) {
        el(col, 'i', 'bn-hm-d' + (c.kind === 'sunday' ? ' is-sunday' : c.kind === 'other' ? ' is-other' : '')
          + (c.today ? ' is-today' : '') + (c.future ? ' is-future' : ''));
      }
    }
    const months = el(sec, 'div', 'bn-hm-m');
    months.setAttribute('aria-hidden', 'true');
    for (const m of s.months) el(months, 'span', null, m.label).style.setProperty('--bn-col', String(m.col + 1));
    const legend = el(sec, 'div', 'bn-hm-l');
    for (const [cls, label] of [['is-sunday', 'Sunday note'], ['is-other', 'Other notes']]) {
      const item = el(legend, 'span');
      el(item, 'i', `bn-hm-key ${cls}`);
      item.appendChild(document.createTextNode(label));
    }
  }

  /* Start, as a command-palette list: one row per kind with a key chip. The
     kind the day leads with is the selected row (Enter). */
  function renderStart(parent, idx, today, hour) {
    const sec = el(parent, 'section', 'bn-sec bn-start');
    sectionHead(sec, 'Start');
    const lead = emphasis(today, hour);
    const panel = el(sec, 'div', 'bn-glass bn-list');
    for (const k of KINDS) {
      const b = el(panel, 'button', `bn-pal bn-k-${k.id}` + (k.id === lead ? ' is-lead' : ''));
      b.type = 'button';
      el(b, 'span', 'bn-et', k.emoji).setAttribute('aria-hidden', 'true');
      const txt = el(b, 'span', 'bn-pal-t');
      el(txt, 'strong', null, k.id === 'meditation' && lead === 'meditation' ? 'Morning meditation' : k.button);
      el(txt, 'span', null, kindSubtitle(idx, k.id, today));
      el(b, 'span', 'bn-kbd', k.id === lead ? '↵' : '›').setAttribute('aria-hidden', 'true');
      b.addEventListener('click', () => store.createNote(k.id));
    }
  }

  function kindSubtitle(idx, kind, today) {
    const todays = idx.notes.find(n => n.kind === kind && n.date === today);
    if (todays) return `Continue “${todays.title}”`;
    if (kind === 'meditation') return 'A passage, a prayer, one line to carry';
    if (kind === 'community') return 'Who was there, passage, prayer';
    if (kind === 'study') return 'Questions and sessions';
    const last = idx.notes.find(n => n.kind === 'sunday' && n.date && n.date < today);
    if (!last) return 'Message, what stuck, response';
    return last.speaker ? `Last week: ${last.speaker}` : 'Message, what stuck, response';
  }

  function renderOpen(parent, idx, today) {
    if (!idx.open.length) return;
    const sec = el(parent, 'section', 'bn-sec');
    sectionHead(sec, 'Still open', idx.open.length);
    const panel = el(sec, 'div', 'bn-glass bn-list');
    const list = state.openAll ? idx.open : idx.open.slice(0, OPEN_LIMIT);
    for (const item of list) taskRow(panel, item, today);
    if (idx.open.length > OPEN_LIMIT) {
      const ft = el(panel, 'div', 'bn-ft');
      el(ft, 'span', null, state.openAll ? `All ${idx.open.length} shown` : `${list.length} of ${idx.open.length} shown`);
      const more = el(ft, 'button', 'bn-more');
      more.type = 'button';
      el(more, 'span', null, state.openAll ? 'Show fewer' : 'Show all');
      el(more, 'span', 'bn-kbd', state.openAll ? '↑' : '↓').setAttribute('aria-hidden', 'true');
      more.addEventListener('click', () => { state.openAll = !state.openAll; render(); });
    }
  }

  function renderPrayer(parent, idx, today) {
    const fresh = idx.answered.find(a => a.task.doneDate && D.diffDays(a.task.doneDate, today) <= ANSWERED_FRESH_DAYS);
    if (!idx.praying.length && !idx.answered.length) return;
    const sec = el(parent, 'section', 'bn-sec');
    sectionHead(sec, 'Praying for', idx.praying.length);
    if (idx.praying.length) {
      const panel = el(sec, 'div', 'bn-glass bn-list');
      for (const item of idx.praying) taskRow(panel, item, today);
    }
    if (fresh) answeredMoment(sec, fresh, today);
    if (idx.answered.length) {
      const t = button(sec, 'bn-more bn-more-quiet', state.answeredOpen ? 'Hide answered' : `${plural(idx.answered.length, 'answered prayer')}`, () => { state.answeredOpen = !state.answeredOpen; render(); });
      t.setAttribute('aria-expanded', String(state.answeredOpen));
      if (state.answeredOpen) {
        const list = el(sec, 'div', 'bn-glass bn-list bn-answered-list');
        for (const a of idx.answered) {
          const r = el(list, 'button', 'bn-row bn-answered-row');
          r.type = 'button';
          el(r, 'span', 'bn-answered-mark', '✓').setAttribute('aria-hidden', 'true');
          el(r, 'span', 'bn-grow', a.task.text);
          el(r, 'span', 'bn-dim', a.days === null ? 'answered' : (a.days === 0 ? 'same day' : plural(a.days, 'day')));
          r.addEventListener('click', () => store.openPath(a.note.path));
        }
      }
    }
  }

  /* The prayer answered most recently, as a diff: the request as it was
     written (muted, "−") and the answer (green, "+"). The note stores one
     line, so the "+" row says when it was answered rather than rewording
     it. */
  function answeredMoment(parent, a, today) {
    /* It rises in once — the first time this answer is shown — not on every
       redraw. */
    const key = a.note.path + '\n' + a.task.raw;
    const fresh = !state.seenAnswered.has(key);
    state.seenAnswered.add(key);
    const box = el(parent, 'button', 'bn-diff' + (fresh ? ' is-new' : ''));
    box.type = 'button';
    el(box, 'span', 'bn-diff-h', a.days === null ? 'answered' : (a.days === 0 ? 'answered · same day' : `answered · ${plural(a.days, 'day')}`));
    const old = el(box, 'span', 'bn-dl is-old');
    el(old, 'i', null, '−').setAttribute('aria-hidden', 'true');
    el(old, 'span', null, a.task.text);
    const added = el(box, 'span', 'bn-dl is-add');
    el(added, 'i', null, '+').setAttribute('aria-hidden', 'true');
    el(added, 'span', null, `Answered ${daysPhrase(a)}`.trim());
    const bits = [];
    if (a.note.date) bits.push(`Written ${D.shortDate(a.note.date, today)}`);
    if (a.task.doneDate) bits.push(`answered ${D.shortDate(a.task.doneDate, today).toLowerCase()}`);
    el(box, 'span', 'bn-diff-f', bits.length ? bits.join(' · ') : a.note.title);
    box.addEventListener('click', () => store.openPath(a.note.path));
  }

  /* Recent, as a commit log: a rail down the left with a dot in the kind's
     colour, the title, then emoji and date, and the first passage as a key
     cap on the right. */
  function renderRecent(parent, idx, today) {
    if (!idx.recent.length) return;
    const sec = el(parent, 'section', 'bn-sec');
    sectionHead(sec, 'Recent');
    const panel = el(sec, 'div', 'bn-glass bn-list');
    for (const n of idx.recent) {
      const r = el(panel, 'button', `bn-lg bn-k-${n.kind}`);
      r.type = 'button';
      el(r, 'i', 'bn-dot').setAttribute('aria-hidden', 'true');
      const t = el(r, 'span', 'bn-lg-t');
      el(t, 'strong', 'bn-ellipsis', n.title);
      const sub = el(t, 'span');
      el(sub, 'span', null, kindOf(n.kind).emoji).setAttribute('aria-hidden', 'true');
      const p = firstPassage(n);
      const bits = [];
      if (!p && n.kind === 'study') {
        const sessions = (n.body.match(SESSION_HEADING) || []).length;
        if (sessions) bits.push(plural(sessions, 'session'));
      }
      if (n.date) bits.push(D.shortDate(n.date, today));
      sub.appendChild(document.createTextNode(bits.join(' · ')));
      if (p) el(r, 'span', 'bn-keycap', p);
      r.addEventListener('click', () => store.openPath(n.path));
    }
  }

  /* The index of passages as heat tiles: book, then its chapters, each tile
     warmer the more notes are on it. A chapter opens its notes right there. */
  function renderPassages(parent, idx, today) {
    if (!idx.passages.length) return;
    const sec = el(parent, 'section', 'bn-sec bn-index');
    sectionHead(sec, 'Passages');
    const panel = el(sec, 'div', 'bn-glass bn-list');
    for (const b of idx.passages) {
      const row = el(panel, 'div', 'bn-ix');
      el(row, 'strong', 'bn-index-book', b.book);
      const chs = el(row, 'span', 'bn-ix-c');
      let open = null;
      for (const c of b.chapters) {
        const heat = Math.min(3, c.notes.length);
        const a = el(chs, 'button', `bn-tile is-heat-${heat}` + (state.chapter === c.key ? ' is-open' : ''));
        a.type = 'button';
        a.setAttribute('aria-expanded', String(state.chapter === c.key));
        a.setAttribute('aria-label', `${c.key}, ${plural(c.notes.length, 'note')}`);
        el(a, 'span', null, String(c.chapter));
        el(a, 'sup', null, String(c.notes.length));
        a.addEventListener('click', () => { state.chapter = state.chapter === c.key ? null : c.key; render(); });
        if (state.chapter === c.key) open = c;
      }
      if (open) {
        const list = el(panel, 'div', 'bn-index-notes');
        for (const n of open.notes) {
          const r = el(list, 'button', `bn-row bn-index-note bn-k-${n.kind}`);
          r.type = 'button';
          el(r, 'i', 'bn-dot').setAttribute('aria-hidden', 'true');
          el(r, 'span', 'bn-row-emoji', kindOf(n.kind).emoji).setAttribute('aria-hidden', 'true');
          el(r, 'span', 'bn-grow bn-ellipsis', n.title);
          el(r, 'span', 'bn-dim bn-date', n.date ? D.shortDate(n.date, today) : '');
          r.addEventListener('click', () => store.openPath(n.path));
        }
      }
    }
  }

  function renderSeries(parent, idx, today) {
    if (!idx.series.length) return;
    const sec = el(parent, 'section', 'bn-sec');
    sectionHead(sec, 'Series');
    const panel = el(sec, 'div', 'bn-glass bn-list');
    for (const s of idx.series.slice(0, 4)) {
      const last = s.notes[s.notes.length - 1];
      const r = el(panel, 'button', 'bn-row bn-series');
      r.type = 'button';
      const left = el(r, 'span', 'bn-grow bn-series-left');
      el(left, 'span', 'bn-series-name', s.name);
      const bars = el(left, 'span', 'bn-series-bars');
      bars.setAttribute('aria-label', `${plural(s.notes.length, 'part')}`);
      for (const x of s.notes.slice(-8)) el(bars, 'span', 'bn-series-bar' + (x.note.date === today ? ' is-today' : ''));
      if (last.note.date === today) el(r, 'span', 'bn-pill', `Part ${last.part} today`);
      else {
        const first = s.notes[0].note.date;
        const mon = iso => D.MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3);
        const range = !first || !last.note.date ? ''
          : (first.slice(0, 7) === last.note.date.slice(0, 7) ? ` · ${mon(first)}` : ` · ${mon(first)} – ${mon(last.note.date)}`);
        el(r, 'span', 'bn-dim', `${plural(s.notes.length, 'note')}${range}`);
      }
      r.addEventListener('click', () => store.openPath(last.note.path));
    }
  }

  function renderStatus(parent, idx) {
    const line = el(parent, 'div', 'bn-statl');
    el(line, 'span', 'bn-ok', `${plural(idx.notes.length, 'note')} · ${idx.open.length} open`);
    const tr = ctx.plugin && ctx.plugin.settings && ctx.plugin.settings.translation;
    el(line, 'span', null, `${tr ? String(tr).toUpperCase() + ' · ' : ''}Bible Notes`);
  }

  function renderEmpty(parent) {
    const sec = el(parent, 'section', 'bn-empty');
    icon(sec, 'book-open', 'bn-empty-icon');
    el(sec, 'h2', null, 'Nothing here yet');
    el(sec, 'p', null, 'Every passage you write becomes a thread you can pull later. Your first note starts above.');
    if (state.adoptCount > 0 && !ctx.plugin.settings.adoptDismissed) {
      const card = el(parent, 'section', 'bn-glass bn-adopt-card');
      const head = el(card, 'div', 'bn-adopt-head');
      el(head, 'span', 'bn-adopt-emoji', '🗂️').setAttribute('aria-hidden', 'true');
      const t = el(head, 'div');
      const one = state.adoptCount === 1;
      const what = state.adoptSermons ? (one ? 'a sermon note' : 'sermon notes') : (one ? 'it belongs here' : 'they belong here');
      el(t, 'h2', null, `${plural(state.adoptCount, 'note')} in your vault look${one ? 's' : ''} like ${what}`);
      el(t, 'p', null, one ? 'Adopting adds one property to it. Nothing else in it changes.' : 'Adopting adds one property to each. Nothing else in them changes.');
      const acts = el(card, 'div', 'bn-adopt-actions');
      button(acts, 'mod-cta bn-btn', 'Review and adopt', () => ctx.plugin.openAdopt());
      button(acts, 'bn-btn bn-btn-quiet', 'Not now', async () => { ctx.plugin.settings.adoptDismissed = true; await ctx.plugin.saveSettings(); render(); });
    }
  }

  function render() {
    const idx = store.index;
    const now = ctx.now ? ctx.now() : new Date();
    const today = D.todayISO(now);
    const hour = now.getHours();
    root.classList.toggle('bn-wide', root.clientWidth >= 760);
    /* On the root, and on the scroller behind it (the ground's glows take
       the accent from there). */
    const green = accentOf(ctx.plugin && ctx.plugin.settings) === 'green';
    root.classList.toggle(ACCENT_GREEN, green);
    container.classList.toggle(ACCENT_GREEN, green);
    clear(root);
    renderSearch(root);
    const head = el(root, 'header', 'bn-home-head');
    el(head, 'h1', 'bn-h1', greeting(hour));
    el(head, 'p', 'bn-when', [D.stampDate(today), churchOf(idx)].filter(Boolean).join(' · '));
    const top = el(root, 'div', 'bn-top');
    renderStreak(top, idx, now, today);
    renderStart(top, idx, today, hour);
    if (!idx.notes.length) { renderEmpty(root); return; }
    const cols = el(root, 'div', 'bn-cols');
    const a = el(cols, 'div', 'bn-col');
    const b = el(cols, 'div', 'bn-col');
    renderOpen(a, idx, today);
    renderPrayer(a, idx, today);
    renderRecent(b, idx, today);
    renderSeries(b, idx, today);
    renderPassages(root, idx, today);
    renderStatus(root, idx);
  }

  const unsub = store.subscribe(() => render());
  render();
  if (!store.index.notes.length) {
    store.adoptScan().then(c => {
      state.adoptCount = c.length;
      state.adoptSermons = c.every(x => x.kind === 'sunday' || x.kind === 'community');
      render();
    }).catch(() => {});
  }
  return {
    render,
    destroy() { unsub(); if (ro) ro.disconnect(); },
  };
}

module.exports = { mountHome, greeting, emphasis };
