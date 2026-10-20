'use strict';
/* Home — the Notion-pure page: greeting, Start, Still open, Praying for
   (with the answered moment), Recent, the passage index and the series.
   Built from the index on the standard DOM only, so the preview harness
   renders the same code. */

const { el, icon, button, clear, checkRow } = require('./dom');
const { KINDS, kindOf } = require('./constants');
const { partOf } = require('./index');
const D = require('./dates');

const OPEN_LIMIT = 6;
const ANSWERED_FRESH_DAYS = 14;
/* A study session's dated heading: `## 20 October 2026`. */
const SESSION_HEADING = /^#{1,6}[ \t]+\d{1,2} [A-Z][a-z]+ \d{4}[ \t]*$/gm;

const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

/* Spelled out, the way a book would set it: 24 → "twenty-four". Past 99,
   digits. */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  return String(n);
}
const capitalise = s => s.charAt(0).toUpperCase() + s.slice(1);

function greeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* Which kind the Start row leads with: Sunday all Sunday, Meditation on
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

function mountHome(container, ctx) {
  const { store } = ctx;
  const state = { openAll: false, answeredOpen: false, chapter: null, adoptCount: 0, seenAnswered: new Set() };
  const root = el(container, 'div', 'bn-home');
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => root.classList.toggle('bn-wide', root.clientWidth >= 760));
    ro.observe(root);
  }

  function meta(parent, note, today) {
    el(parent, 'span', 'bn-meta-emoji', kindOf(note.kind).emoji).setAttribute('aria-hidden', 'true');
    parent.appendChild(document.createTextNode(`${note.title}${note.date ? ' · ' + D.shortDate(note.date, today) : ''}`));
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

  function renderStart(parent, idx, today, hour) {
    const sec = el(parent, 'section', 'bn-sec bn-start');
    sectionHead(sec, 'Start');
    const lead = emphasis(today, hour);
    if (lead) {
      const k = kindOf(lead);
      const card = el(sec, 'button', `bn-lead tone-${k.tone}`);
      card.type = 'button';
      el(card, 'span', 'bn-lead-emoji', k.emoji).setAttribute('aria-hidden', 'true');
      const txt = el(card, 'span', 'bn-lead-text');
      el(txt, 'strong', null, lead === 'meditation' ? 'Morning meditation' : k.button);
      el(txt, 'span', 'bn-lead-sub', leadSubtitle(idx, lead, today));
      icon(card, 'arrow-right', 'bn-lead-go');
      card.addEventListener('click', () => store.createNote(lead));
    }
    const grid = el(sec, 'div', 'bn-kinds' + (lead ? '' : ' is-four'));
    for (const k of KINDS) {
      if (k.id === lead) continue;
      const b = el(grid, 'button', 'bn-kind');
      b.type = 'button';
      el(b, 'span', 'bn-kind-emoji', k.emoji).setAttribute('aria-hidden', 'true');
      el(b, 'span', 'bn-kind-label', k.label);
      b.addEventListener('click', () => store.createNote(k.id));
    }
  }

  function leadSubtitle(idx, kind, today) {
    const todays = idx.notes.find(n => n.kind === kind && n.date === today);
    if (todays) return `Continue “${todays.title}”`;
    if (kind === 'meditation') return 'A passage, a prayer, one line to carry';
    const last = idx.notes.find(n => n.kind === 'sunday' && n.date && n.date < today);
    if (!last) return 'Message, what stuck, response';
    const bits = [];
    if (last.series) bits.push(last.series, `part ${(partOf(idx, last) || 0) + 1}`);
    if (last.speaker) bits.push(last.speaker);
    return bits.length ? bits.join(' · ') : 'Message, what stuck, response';
  }

  function renderOpen(parent, idx, today) {
    if (!idx.open.length) return;
    const sec = el(parent, 'section', 'bn-sec');
    sectionHead(sec, 'Still open', idx.open.length);
    const list = state.openAll ? idx.open : idx.open.slice(0, OPEN_LIMIT);
    for (const item of list) taskRow(sec, item, today);
    if (idx.open.length > OPEN_LIMIT) {
      button(sec, 'bn-more', state.openAll ? 'Show fewer' : `Show all ${idx.open.length}`, () => { state.openAll = !state.openAll; render(); });
    }
  }

  function renderPrayer(parent, idx, today) {
    const fresh = idx.answered.find(a => a.task.doneDate && D.diffDays(a.task.doneDate, today) <= ANSWERED_FRESH_DAYS);
    if (!idx.praying.length && !idx.answered.length) return;
    const sec = el(parent, 'section', 'bn-sec');
    sectionHead(sec, 'Praying for', idx.praying.length);
    for (const item of idx.praying) taskRow(sec, item, today);
    if (fresh) answeredMoment(sec, fresh, today);
    if (idx.answered.length) {
      const t = button(sec, 'bn-more', state.answeredOpen ? 'Hide answered' : `${plural(idx.answered.length, 'answered prayer')}`, () => { state.answeredOpen = !state.answeredOpen; render(); });
      t.setAttribute('aria-expanded', String(state.answeredOpen));
      if (state.answeredOpen) {
        const list = el(sec, 'div', 'bn-answered-list');
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

  /* Editorial's moment, in Notion's voice: a quiet green callout for the
     prayer answered most recently. */
  function answeredMoment(parent, a, today) {
    /* It rises in once — the first time this answer is shown — not on every
       redraw. */
    const key = a.note.path + '\n' + a.task.raw;
    const fresh = !state.seenAnswered.has(key);
    state.seenAnswered.add(key);
    const box = el(parent, 'button', 'bn-answered' + (fresh ? ' is-new' : ''));
    box.type = 'button';
    el(box, 'span', 'bn-answered-orn', '❦').setAttribute('aria-hidden', 'true');
    const txt = el(box, 'span', 'bn-answered-text');
    el(txt, 'span', 'bn-answered-kicker', 'Answered');
    el(txt, 'span', 'bn-answered-title', a.task.text);
    const since = a.days === null ? 'Ticked as answered'
      : a.days === 0 ? 'The same day you first wrote it down'
        : `${capitalise(numberWords(a.days))} ${a.days === 1 ? 'day' : 'days'} after you first wrote it down`;
    el(txt, 'span', 'bn-answered-sub', a.note.date ? `${since} · ${D.shortDate(a.note.date, today)}` : since);
    box.addEventListener('click', () => store.openPath(a.note.path));
  }

  function renderRecent(parent, idx, today) {
    if (!idx.recent.length) return;
    const sec = el(parent, 'section', 'bn-sec');
    sectionHead(sec, 'Recent');
    for (const n of idx.recent) {
      const r = el(sec, 'button', 'bn-row bn-recent');
      r.type = 'button';
      el(r, 'span', 'bn-row-emoji', kindOf(n.kind).emoji).setAttribute('aria-hidden', 'true');
      el(r, 'span', 'bn-grow bn-ellipsis', n.title);
      const p = firstPassage(n);
      if (p) el(r, 'span', 'bn-pill tone-blue', p);
      else if (n.kind === 'study') {
        const sessions = (n.body.match(SESSION_HEADING) || []).length;
        if (sessions) el(r, 'span', 'bn-pill', plural(sessions, 'session'));
      }
      el(r, 'span', 'bn-dim bn-date', n.date ? D.shortDate(n.date, today) : '');
      r.addEventListener('click', () => store.openPath(n.path));
    }
  }

  /* Editorial's index of passages: book, then chapters with a small count;
     a chapter opens the notes on it right there. */
  function renderPassages(parent, idx, today) {
    if (!idx.passages.length) return;
    const sec = el(parent, 'section', 'bn-sec bn-index');
    sectionHead(sec, 'Index of passages');
    for (const b of idx.passages) {
      const row = el(sec, 'div', 'bn-index-row');
      el(row, 'span', 'bn-index-book', b.book);
      const chs = el(row, 'span', 'bn-index-chs');
      let open = null;
      for (const c of b.chapters) {
        const a = el(chs, 'button', 'bn-index-ch' + (state.chapter === c.key ? ' is-open' : ''));
        a.type = 'button';
        a.setAttribute('aria-expanded', String(state.chapter === c.key));
        a.setAttribute('aria-label', `${c.key}, ${plural(c.notes.length, 'note')}`);
        el(a, 'span', null, String(c.chapter));
        el(a, 'sup', null, String(c.notes.length));
        a.addEventListener('click', () => { state.chapter = state.chapter === c.key ? null : c.key; render(); });
        if (state.chapter === c.key) open = c;
      }
      if (open) {
        const list = el(sec, 'div', 'bn-index-notes');
        for (const n of open.notes) {
          const r = el(list, 'button', 'bn-row bn-index-note');
          r.type = 'button';
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
    for (const s of idx.series.slice(0, 4)) {
      const last = s.notes[s.notes.length - 1];
      const r = el(sec, 'button', 'bn-row bn-series');
      r.type = 'button';
      const left = el(r, 'span', 'bn-grow bn-series-left');
      el(left, 'span', 'bn-series-name', s.name);
      const bars = el(left, 'span', 'bn-series-bars');
      bars.setAttribute('aria-label', `${plural(s.notes.length, 'part')}`);
      for (const x of s.notes.slice(-8)) el(bars, 'span', 'bn-series-bar' + (x.note.date === today ? ' is-today' : ''));
      if (last.note.date === today) el(r, 'span', 'bn-pill tone-purple', `Part ${last.part} today`);
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

  function renderEmpty(parent) {
    const sec = el(parent, 'section', 'bn-empty');
    icon(sec, 'book-open', 'bn-empty-icon');
    el(sec, 'h2', null, 'Nothing here yet');
    el(sec, 'p', null, 'Every passage you write becomes a thread you can pull later. Your first note starts above.');
    if (state.adoptCount > 0 && !ctx.plugin.settings.adoptDismissed) {
      const card = el(parent, 'section', 'bn-adopt-card');
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
    clear(root);
    const head = el(root, 'header', 'bn-home-head');
    el(head, 'div', 'bn-page-icon', '🕊️').setAttribute('aria-hidden', 'true');
    el(head, 'h1', 'bn-h1', greeting(hour));
    el(head, 'p', 'bn-dim bn-today', D.dayHeading(today));
    renderStart(root, idx, today, hour);
    if (!idx.notes.length) { renderEmpty(root); return; }
    const cols = el(root, 'div', 'bn-cols');
    const a = el(cols, 'div', 'bn-col');
    const b = el(cols, 'div', 'bn-col');
    renderOpen(a, idx, today);
    renderPrayer(a, idx, today);
    renderRecent(b, idx, today);
    renderSeries(b, idx, today);
    renderPassages(root, idx, today);
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

module.exports = { mountHome, greeting, emphasis, numberWords };
