'use strict';
/* Home — the Bento page. A bar (the mark, the week's pills, the quick
   switcher), the greeting with the week in one line, then tiles: Start (the
   Sunday tile), Still open, Praying for (with the answered moment), notes per
   day or per week, the index of passages as a one-hue heatmap, days in the
   Word, recent notes, what was written this month and series progress. Over
   the page floats the dock (src/dock.js): Top, Open, a raised + that creates
   a note or a prayer request, Prayers and Search. Built from the index on the
   standard DOM only, so the preview harness renders the same code. */

const { Platform, Menu, Notice } = require('obsidian');
const { el, icon, button, clear, checkRow } = require('./dom');
const { kindOf } = require('./constants');
const { TILES, shownTiles } = require('./tiles');
const { mountDock } = require('./dock');
const { sundayPlan, createRows } = require('./create');
const { buildStreak } = require('./streak');
const S = require('./stats');
const D = require('./dates');

const OPEN_LIMIT = 3;
const PRAY_LIMIT = 3;
const RECENT_SHORT = 5;
const INDEX_BOOKS = 6;
const ANSWERED_FRESH_DAYS = 14;
/* Two columns of tiles from this width of the view, three (in a framed
   panel) from the next. */
const WIDE = 700;
const XWIDE = 1080;
const SVG = 'http://www.w3.org/2000/svg';

const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

function greeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* Which kind the day leads with: Sunday all Sunday, Meditation on other
   mornings, none otherwise. */
function emphasis(today, hour) {
  if (D.weekday(today) === 0) return 'sunday';
  if (hour < 12) return 'meditation';
  return null;
}

function firstPassage(note) {
  for (const e of note.scripture) if (e.refs.length) return e.refs[0].label;
  return note.scripture.length ? note.scripture[0].raw : '';
}

/* "19 – 25 Oct 2026", "28 Sep – 4 Oct 2026", "29 Dec 2026 – 4 Jan 2027". */
function weekRange({ start, end }) {
  const day = iso => Number(iso.slice(8, 10));
  const mon = iso => D.MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3);
  if (start.slice(0, 4) !== end.slice(0, 4)) return `${day(start)} ${mon(start)} ${start.slice(0, 4)} – ${day(end)} ${mon(end)} ${end.slice(0, 4)}`;
  if (start.slice(5, 7) !== end.slice(5, 7)) return `${day(start)} ${mon(start)} – ${day(end)} ${mon(end)} ${end.slice(0, 4)}`;
  return `${day(start)} – ${day(end)} ${mon(end)} ${end.slice(0, 4)}`;
}

/* Obsidian's default hotkey for the quick switcher is Cmd/Ctrl+O. */
const switcherHint = () => (Platform.isMacOS ? '⌘O' : 'Ctrl O');

function svg(parent, tag, attrs) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
}

function mountHome(container, ctx) {
  const { store } = ctx;
  const state = {
    openAll: false, prayAll: false, answeredOpen: false, chapter: null, indexAll: false,
    range: 'week', recentAll: false, adoptCount: 0, adoptSermons: false, seenAnswered: new Set(),
  };
  /* The page scrolls inside its own region; the dock and its sheet sit in a
     layer over it (absolute in the view), so they stay put while it scrolls. */
  const scroller = el(container, 'div', 'bn-scroll');
  const root = el(scroller, 'div', 'bn-home');
  const layer = el(container, 'div', 'bn-chrome');
  let dock = null;
  /* Measured on the view, not on Home itself: the framed panel's own margins
     must not flip it back below the width that framed it. */
  const size = () => {
    const w = container.clientWidth || root.clientWidth;
    root.classList.toggle('bn-wide', w >= WIDE);
    root.classList.toggle('bn-xwide', w >= XWIDE);
    if (dock) dock.setCompact(w < WIDE);
  };
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(size);
    ro.observe(container);
  }
  let uid = 0;

  /* A tile: a card with a title, a line under it, and room on the right of
     the head for a round arrow or a toggle. */
  function card(parent, cls, title, sub) {
    const sec = el(parent, 'section', 'bn-card' + (cls ? ' ' + cls : ''));
    const head = el(sec, 'div', 'bn-head');
    const t = el(head, 'div', 'bn-head-t');
    const h = el(t, 'h2', 'bn-lbl', title);
    h.id = `bn-h${++uid}`;
    sec.setAttribute('aria-labelledby', h.id);
    if (sub) el(t, 'p', 'bn-sub', sub);
    return { sec, head };
  }

  /* The round ↗ button. Expanded, it turns to point back. */
  function arrow(parent, label, onClick, cls) {
    const b = el(parent, 'button', 'bn-arrow' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    icon(b, 'arrow-up-right');
    b.addEventListener('click', onClick);
    return b;
  }

  function toggle(key) { state[key] = !state[key]; render(); }

  /* The quick switcher, Obsidian's own. `app.commands` is not in the public
     typings but is what every plugin uses to run a command by id. */
  function openSwitcher() {
    const app = ctx.plugin && ctx.plugin.app;
    if (app && app.commands && app.commands.executeCommandById) app.commands.executeCommandById('switcher:open');
  }

  /* ---- the dock ---- */
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function scrollToY(y) { scroller.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? 'auto' : 'smooth' }); }

  /* Scroll Home to a tile, leaving a little ground above it. A tile switched
     off in Home's settings (or a first-run Home with no tiles) says so
     instead of doing nothing. */
  function toTile(id, name) {
    const t = root.querySelector(`[data-tile="${id}"]`);
    if (!t) { new Notice(`Bible Notes: “${name}” isn’t showing on Home. Turn it on with the sliders button.`); return; }
    scrollToY(scroller.scrollTop + t.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12);
  }

  /* The create sheet's rows, today's own note first marked where the day
     leads with it (Sunday all Sunday, Meditation on a morning). */
  function sheetRows() {
    const now = ctx.now ? ctx.now() : new Date();
    const today = D.todayISO(now);
    const lead = emphasis(today, now.getHours());
    return createRows(store.index.notes, today).map(r => ({ ...r, lead: r.id === lead }));
  }
  const todayNow = () => D.todayISO(ctx.now ? ctx.now() : new Date());
  const sundayNow = () => sundayPlan(store.index.notes, todayNow());

  /* The Sunday flow — the Start tile and the sheet's Sunday row both run it.
     Today's note: open it. A series to continue: the sheet asks once. Else
     create. */
  function startSunday() {
    const plan = sundayNow();
    if (plan.action === 'open') store.openPath(plan.path);
    else if (plan.action === 'ask') dock.open('sunday', false);
    else store.createNote('sunday');
  }

  function pick(r) {
    if (r.id === 'sunday') startSunday();
    else if (r.id === 'prayer') { if (ctx.plugin && ctx.plugin.openPrayer) ctx.plugin.openPrayer(); } else store.createNote(r.id);
  }

  dock = mountDock(layer, {
    onTop: () => scrollToY(0),
    onOpen: () => toTile('open', 'Still open'),
    onPray: () => toTile('pray', 'Praying for'),
    onSearch: openSwitcher,
    rows: sheetRows,
    sunday: sundayNow,
    pick,
    chooseSunday: series => store.createNote('sunday', series ? { series } : undefined),
  });

  function taskRow(parent, item, today) {
    const { row, box } = checkRow(parent, 'bn-task', item.task.done, async (checked) => {
      row.classList.toggle('is-done', checked);
      const ok = await store.toggle(item.note, item.task, checked);
      if (!ok) { box.checked = !checked; row.classList.toggle('is-done', !checked); }
    });
    box.setAttribute('aria-label', item.task.text);
    const t = el(row, 'span', 'bn-task-text');
    el(t, 'span', 'bn-task-title', item.task.text);
    /* A prayer-list request is dated by when it was written down (its ➕). */
    const when = item.task.created || item.note.date;
    const m = el(t, 'button', 'bn-task-meta', `${item.note.title}${when ? ' · ' + D.shortDate(when, today) : ''}`);
    m.type = 'button';
    m.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); store.openPath(item.note.path); });
    return row;
  }

  /* The church under Start: the last Sunday note's, then the one in
     Settings. */
  function churchOf(idx) {
    const last = idx.notes.find(n => n.kind === 'sunday' && n.church);
    return last ? last.church : ((ctx.plugin && ctx.plugin.settings && ctx.plugin.settings.church) || '');
  }

  function renderBar(parent, idx, today) {
    const bar = el(parent, 'header', 'bn-topbar');
    const brand = el(bar, 'div', 'bn-brand');
    icon(el(brand, 'span', 'bn-mark'), 'book-open');
    el(brand, 'span', 'bn-brand-t', 'Bible Notes');
    const right = el(bar, 'div', 'bn-topbar-r');
    if (idx.notes.length) {
      const n = el(right, 'span', 'bn-pill bn-pill-grey bn-topbar-pill');
      el(n, 'i', 'bn-live').setAttribute('aria-hidden', 'true');
      n.appendChild(document.createTextNode(plural(idx.notes.length, 'note')));
      el(right, 'span', 'bn-pill bn-pill-grey bn-topbar-pill', weekRange(S.weekOf(today)));
    }
    const s = el(right, 'button', 'bn-circle');
    s.type = 'button';
    s.setAttribute('aria-label', `Jump to a note or passage (${switcherHint()})`);
    s.title = `Jump to a note or passage (${switcherHint()})`;
    icon(s, 'search');
    s.addEventListener('click', openSwitcher);
    if (ctx.plugin) {
      const g = el(right, 'button', 'bn-circle');
      g.type = 'button';
      g.setAttribute('aria-label', 'Choose what Home shows');
      g.setAttribute('aria-haspopup', 'menu');
      g.title = 'Choose what Home shows';
      icon(g, 'sliders-horizontal');
      g.addEventListener('click', () => tileMenu(g));
    }
  }

  /* Home's settings button: a tick for each tile, "Show all tiles" once one
     is hidden, and the plugin's settings tab. Obsidian's own menu, so on a
     phone it is a sheet. */
  function tileMenu(anchor) {
    const plugin = ctx.plugin;
    const shown = new Set(shownTiles(plugin.settings));
    const menu = new Menu();
    for (const t of TILES) {
      menu.addItem(i => i.setTitle(t.label).setChecked(shown.has(t.id)).onClick(() => plugin.setTileShown(t.id, !shown.has(t.id))));
    }
    if (shown.size < TILES.length) {
      menu.addSeparator();
      menu.addItem(i => i.setTitle('Show all tiles').setIcon('eye').onClick(async () => {
        plugin.settings.hiddenTiles = [];
        await plugin.saveSettings();
        plugin.refreshHome();
      }));
    }
    menu.addSeparator();
    menu.addItem(i => i.setTitle('Bible Notes settings').setIcon('settings').onClick(() => plugin.openSettings()));
    const r = anchor.getBoundingClientRect();
    menu.showAtPosition({ x: r.right, y: r.bottom + 6, left: true });
  }

  /* Start: the Sunday tile — today's note, or the way to begin one. Every
     other note, and a prayer request, begins from the dock's +. */
  function renderStart(parent, idx, now, today) {
    const sec = el(parent, 'section', 'bn-card bn-hero bn-start');
    sec.setAttribute('aria-label', 'Start your Sunday note');
    const todays = idx.notes.find(n => n.kind === 'sunday' && n.date === today);
    const last = idx.notes.find(n => n.kind === 'sunday' && n.date && n.date < today);
    const main = el(sec, 'button', 'bn-start-main');
    main.type = 'button';
    const t = el(main, 'span', 'bn-head-t');
    el(t, 'span', 'bn-lbl', todays ? 'Today’s Sunday note' : 'Start your Sunday note');
    el(t, 'span', 'bn-sub', todays ? todays.title : (last && last.speaker ? `Last week: ${last.speaker}` : 'Message, what stuck, response'));
    icon(el(main, 'span', 'bn-arrow is-inv'), 'arrow-up-right');
    main.addEventListener('click', startSunday);

    const s = buildStreak(idx.notes, now);
    const foot = el(sec, 'div', 'bn-start-foot');
    const run = el(foot, 'span', 'bn-run');
    el(run, 'span', 'bn-big', String(s.sundays));
    el(run, 'span', 'bn-run-cap', s.sundays === 1 ? 'Sunday in a row' : 'Sundays in a row');
    const meta = el(foot, 'span', 'bn-start-meta');
    const next = s.next.today ? 'today' : (D.diffDays(today, s.next.date) === 1 ? 'tomorrow' : `Sun ${D.shortDate(s.next.date, today)}`);
    el(meta, 'span', null, `Next: ${next}`);
    const church = churchOf(idx);
    if (church) el(meta, 'span', null, church);
  }

  function renderOpen(parent, idx, today) {
    const { sec, head } = card(parent, 'bn-open', 'Still open', 'From your recent notes');
    if (idx.open.length > OPEN_LIMIT) {
      arrow(head, state.openAll ? 'Show fewer' : `Show all ${idx.open.length}`, () => toggle('openAll'), state.openAll ? 'is-back' : '')
        .setAttribute('aria-expanded', String(state.openAll));
    }
    const num = el(sec, 'div', 'bn-num');
    el(num, 'span', 'bn-big', String(idx.open.length));
    const delta = S.openDelta(idx.notes, today);
    if (delta) el(num, 'span', 'bn-pill ' + (delta < 0 ? 'bn-pill-green' : 'bn-pill-grey'), `${delta < 0 ? '−' : '+'}${Math.abs(delta)} this week`);
    if (!idx.open.length) {
      el(sec, 'p', 'bn-hint', 'Nothing open. A checkbox in any note shows up here until it is ticked.');
      return;
    }
    const list = el(sec, 'div', 'bn-list');
    for (const item of state.openAll ? idx.open : idx.open.slice(0, OPEN_LIMIT)) taskRow(list, item, today);
  }

  function renderPrayer(parent, idx, today) {
    const { sec, head } = card(parent, 'bn-pray', 'Praying for', 'Answered prayers stay remembered');
    if (idx.praying.length > PRAY_LIMIT) {
      arrow(head, state.prayAll ? 'Show fewer' : `Show all ${idx.praying.length}`, () => toggle('prayAll'), state.prayAll ? 'is-back' : '')
        .setAttribute('aria-expanded', String(state.prayAll));
    }
    const num = el(sec, 'div', 'bn-num');
    el(num, 'span', 'bn-big', String(idx.praying.length));
    if (idx.answered.length) {
      const p = button(num, 'bn-pill bn-pill-grey bn-pill-btn', state.answeredOpen ? 'Hide answered' : `${idx.answered.length} answered`, () => toggle('answeredOpen'));
      p.setAttribute('aria-expanded', String(state.answeredOpen));
    }
    if (!idx.praying.length && !idx.answered.length) {
      el(sec, 'p', 'bn-hint', 'Tap + and choose Prayer request to add one. Checkboxes under a heading with “pray” in any note count too. Tick one when it is answered.');
      return;
    }
    const list = el(sec, 'div', 'bn-list');
    for (const item of state.prayAll ? idx.praying : idx.praying.slice(0, PRAY_LIMIT)) taskRow(list, item, today);
    if (state.answeredOpen) {
      for (const a of idx.answered) answeredRow(list, a, false);
    } else {
      const fresh = idx.answered.find(a => a.task.doneDate && D.diffDays(a.task.doneDate, today) <= ANSWERED_FRESH_DAYS);
      if (fresh) answeredRow(list, fresh, true);
    }
  }

  /* An answered prayer: ticked green, with how long the answer took. The
     most recent one (answered in the last two weeks) rises in once — the
     first time it is shown, not on every redraw. */
  function answeredRow(parent, a, moment) {
    const key = a.note.path + '\n' + a.task.raw;
    const rise = moment && !state.seenAnswered.has(key);
    if (moment) state.seenAnswered.add(key);
    const r = el(parent, 'button', 'bn-answered' + (rise ? ' is-new' : ''));
    r.type = 'button';
    icon(el(r, 'span', 'bn-tick'), 'check');
    el(r, 'span', 'bn-answered-t', a.task.text);
    const took = a.days === null ? 'answered' : (a.days === 0 ? 'same day' : plural(a.days, 'day'));
    el(r, 'span', 'bn-pill bn-pill-green bn-pill-sm', took);
    r.setAttribute('aria-label', `Answered${a.days === null ? '' : a.days === 0 ? ' the same day' : ' after ' + plural(a.days, 'day')}: ${a.task.text}. Opens ${a.note.title}`);
    r.addEventListener('click', () => store.openPath(a.note.path));
  }

  /* Notes this week (Monday to Sunday), or per week for five weeks. The
     fullest bar is green and carries its count. */
  function renderWeek(parent, idx, today) {
    const week = state.range === 'week';
    const { sec, head } = card(parent, 'bn-week', week ? 'Notes this week' : 'Notes per week', week ? 'Everything you wrote, per day' : 'The last five weeks');
    const seg = el(head, 'div', 'bn-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Range');
    for (const [id, label] of [['week', 'Week'], ['month', 'Month']]) {
      button(seg, 'bn-seg-b' + (state.range === id ? ' is-on' : ''), label, () => { state.range = id; render(); })
        .setAttribute('aria-pressed', String(state.range === id));
    }
    const bars = week
      ? S.weekBars(idx.notes, today).days.map(d => ({ label: d.label, count: d.count, now: d.today, future: d.future, name: D.DAYS[D.weekday(d.date)] }))
      : S.monthBars(idx.notes, today).bars.map(b => ({ label: b.label, count: b.count, now: b.current, future: false, name: `week of ${b.label}` }));
    const max = Math.max(0, ...bars.map(b => b.count));
    let peak = -1;
    bars.forEach((b, i) => { if (max && b.count === max) peak = i; });
    const chart = el(sec, 'div', 'bn-chart');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `${week ? 'Notes per day' : 'Notes per week'}: ${bars.map(b => `${b.name} ${b.count}`).join(', ')}`);
    bars.forEach((b, i) => {
      const col = el(chart, 'span', 'bn-col');
      const bar = el(col, 'span', 'bn-bar' + (i === peak ? ' is-peak' : '') + (b.future ? ' is-future' : ''));
      bar.style.setProperty('--bn-h', `${b.future || !max ? 8 : Math.max(8, Math.round((b.count / max) * 100))}%`);
      if (i === peak) el(bar, 'span', 'bn-bar-n', String(b.count));
    });
    const x = el(sec, 'div', 'bn-chart-x');
    x.setAttribute('aria-hidden', 'true');
    for (const b of bars) el(x, 'span', b.now ? 'is-now' : null, b.label);
  }

  /* The index of passages: book, then its chapters as pills, greener the
     more notes are on them. A chapter opens its notes right there. */
  function renderIndex(parent, idx, today) {
    const { sec, head } = card(parent, 'bn-index', 'Index of passages', idx.passages.length ? 'Tap a chapter for its notes' : 'Chapters you write about gather here');
    if (!idx.passages.length) {
      el(sec, 'p', 'bn-hint', 'Add a passage to a note’s cover, or write a reference like John 15:5 anywhere in it.');
      return;
    }
    if (idx.passages.length > INDEX_BOOKS) {
      arrow(head, state.indexAll ? 'Show fewer books' : `Show all ${idx.passages.length} books`, () => toggle('indexAll'), state.indexAll ? 'is-back' : '')
        .setAttribute('aria-expanded', String(state.indexAll));
    }
    const grid = el(sec, 'div', 'bn-ix');
    const books = state.indexAll ? idx.passages : idx.passages.slice(0, INDEX_BOOKS);
    for (const b of books) {
      el(grid, 'span', 'bn-ix-book', b.book);
      const chs = el(grid, 'span', 'bn-ix-c');
      let open = null;
      for (const c of b.chapters) {
        const isOpen = state.chapter === c.key;
        const p = el(chs, 'button', `bn-heat is-h${S.heatLevel(c.notes.length)}` + (isOpen ? ' is-open' : ''), String(c.chapter));
        p.type = 'button';
        p.setAttribute('aria-expanded', String(isOpen));
        p.setAttribute('aria-label', `${c.key}, ${plural(c.notes.length, 'note')}`);
        p.addEventListener('click', () => { state.chapter = isOpen ? null : c.key; render(); });
        if (isOpen) open = c;
      }
      if (open) {
        const list = el(grid, 'div', 'bn-ix-notes');
        for (const n of open.notes) {
          const r = el(list, 'button', 'bn-ix-note');
          r.type = 'button';
          icon(r, kindOf(n.kind).icon, 'bn-ix-kind');
          el(r, 'span', 'bn-grow bn-ellipsis', n.title);
          el(r, 'span', 'bn-faint', n.date ? D.shortDate(n.date, today) : '');
          r.addEventListener('click', () => store.openPath(n.path));
        }
      }
    }
    const legend = el(sec, 'div', 'bn-legend');
    for (const [lv, label] of [[1, '1 note'], [2, '2–3'], [3, '4 or more']]) {
      const item = el(legend, 'span');
      el(item, 'i', `bn-key is-h${lv}`);
      item.appendChild(document.createTextNode(label));
    }
  }

  /* Morning meditations this month: met, missed, and a dot for every day. */
  function renderDays(parent, idx, today) {
    const d = S.daysInWord(idx.notes, today);
    const { sec, head } = card(parent, 'bn-hero bn-days', 'Days in the Word', `Morning meditations, ${d.month}`);
    const todays = idx.notes.find(n => n.kind === 'meditation' && n.date === today);
    arrow(head, todays ? 'Open today’s meditation' : 'Start today’s meditation', () => store.createNote('meditation'), 'is-inv');
    const nums = el(sec, 'div', 'bn-days-n');
    const met = el(nums, 'span', 'bn-mid', String(d.met));
    el(met, 'small', 'is-met', 'met');
    const missed = el(nums, 'span', 'bn-mid', String(d.missed));
    el(missed, 'small', null, 'missed');
    const dots = el(sec, 'div', 'bn-dots');
    const sofar = d.days.filter(x => x.state !== 'future').length;
    dots.setAttribute('role', 'img');
    dots.setAttribute('aria-label', `${d.met} of ${sofar} ${sofar === 1 ? 'day' : 'days'} in ${d.month} so far had a meditation note`);
    for (const day of d.days) el(dots, 'i', `bn-dd is-${day.state}`);
  }

  function renderRecent(parent, idx, today) {
    const { sec, head } = card(parent, 'bn-recent', 'Recent notes', 'Pick up where you left off');
    if (idx.recent.length > RECENT_SHORT) {
      button(head, 'bn-pill bn-pill-grey bn-pill-btn', state.recentAll ? 'Fewer' : 'See all', () => toggle('recentAll'))
        .setAttribute('aria-expanded', String(state.recentAll));
    }
    const list = el(sec, 'div', 'bn-list');
    for (const n of state.recentAll ? idx.recent : idx.recent.slice(0, RECENT_SHORT)) {
      /* A study is as recent as its latest session. */
      const when = (n.kind === 'study' && S.sessionDates(n.body).slice(-1)[0]) || n.date;
      const r = el(list, 'button', 'bn-rrow');
      r.type = 'button';
      icon(el(r, 'span', 'bn-kicon' + (when === today ? ' is-today' : '')), kindOf(n.kind).icon);
      el(r, 'span', 'bn-rrow-t', n.title);
      const p = firstPassage(n);
      if (p) el(r, 'span', 'bn-pill bn-pill-grey bn-pill-sm bn-rrow-p', p);
      el(r, 'span', 'bn-rrow-d', when ? D.shortDate(when, today) : '');
      r.addEventListener('click', () => store.openPath(n.path));
    }
  }

  /* Notes this month by kind, as a donut with its legend. Each kind keeps
     its own fill: Sunday ink, meditation green, community and study greys. */
  function renderKinds(parent, idx, today) {
    const k = S.kindMix(idx.notes, today);
    const { sec } = card(parent, 'bn-kinds', 'What you wrote', `Notes in ${k.month}, by kind`);
    if (!k.total) {
      el(sec, 'p', 'bn-hint', `Nothing written in ${k.month} yet.`);
      return;
    }
    const wrap = el(sec, 'div', 'bn-donut');
    const shown = k.kinds.filter(x => x.count);
    const chart = svg(wrap, 'svg', { viewBox: '0 0 120 120', class: 'bn-donut-svg', role: 'img', 'aria-label': `${plural(k.total, 'note')} in ${k.month}: ${shown.map(x => `${x.label.toLowerCase()} ${x.count}`).join(', ')}` });
    const g = svg(chart, 'g', { transform: 'rotate(-90 60 60)' });
    const C = 2 * Math.PI * 48;
    const gap = shown.length > 1 ? 2.5 : 0;
    let off = 0;
    for (const x of shown) {
      const len = (x.count / k.total) * C;
      svg(g, 'circle', { cx: 60, cy: 60, r: 48, class: `bn-arc is-${x.kind}`, 'stroke-dasharray': `${Math.max(0.5, len - gap).toFixed(2)} ${C.toFixed(2)}`, 'stroke-dashoffset': (-off).toFixed(2) });
      off += len;
    }
    const total = svg(chart, 'text', { x: 60, y: 60, class: 'bn-donut-n', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    total.textContent = String(k.total);
    const legend = el(wrap, 'div', 'bn-donut-l');
    for (const x of k.kinds) {
      el(legend, 'i', `bn-key is-${x.kind}`).setAttribute('aria-hidden', 'true');
      el(legend, 'span', x.count ? null : 'bn-faint', x.label);
      el(legend, 'strong', x.count ? null : 'bn-faint', String(x.count));
    }
  }

  /* Series as progress bars: parts written, against the longest shown. */
  function renderSeries(parent, idx, today) {
    const bars = S.seriesBars(idx.series, today, 3);
    const { sec } = card(parent, 'bn-series', 'Series', 'Parts you’ve written');
    if (!bars.length) {
      el(sec, 'p', 'bn-hint', 'Give Sunday notes a series and follow it here, part by part.');
      return;
    }
    const list = el(sec, 'div', 'bn-series-l');
    for (const b of bars) {
      const r = el(list, 'button', 'bn-srow');
      r.type = 'button';
      const top = el(r, 'span', 'bn-srow-top');
      el(top, 'span', 'bn-srow-n', b.name);
      el(top, 'span', 'bn-srow-p', b.today ? `Part ${b.parts} today` : plural(b.parts, 'part'));
      const track = el(r, 'span', 'bn-track');
      el(track, 'span', 'bn-fill' + (b.active ? ' is-active' : '')).style.setProperty('--bn-w', `${Math.round(b.ratio * 100)}%`);
      r.setAttribute('aria-label', `${b.name}, ${plural(b.parts, 'part')}. Opens the latest part`);
      r.addEventListener('click', () => store.openPath(b.path));
    }
  }

  function renderEmpty(parent) {
    const sec = el(parent, 'section', 'bn-card bn-empty');
    icon(sec, 'book-open', 'bn-empty-icon');
    el(sec, 'h2', 'bn-lbl', 'Nothing here yet');
    el(sec, 'p', 'bn-sub', 'Every passage you write becomes a thread you can pull later. Your first note starts above.');
    if (state.adoptCount > 0 && !ctx.plugin.settings.adoptDismissed) {
      const card2 = el(parent, 'section', 'bn-card bn-adopt-card');
      const one = state.adoptCount === 1;
      const what = state.adoptSermons ? (one ? 'a sermon note' : 'sermon notes') : (one ? 'it belongs here' : 'they belong here');
      el(card2, 'h2', 'bn-lbl', `${plural(state.adoptCount, 'note')} in your vault look${one ? 's' : ''} like ${what}`);
      el(card2, 'p', 'bn-sub', one ? 'Adopting adds one property to it. Nothing else in it changes.' : 'Adopting adds one property to each. Nothing else in them changes.');
      const acts = el(card2, 'div', 'bn-adopt-actions');
      button(acts, 'mod-cta bn-btn', 'Review and adopt', () => ctx.plugin.openAdopt());
      button(acts, 'bn-btn bn-btn-quiet', 'Not now', async () => { ctx.plugin.settings.adoptDismissed = true; await ctx.plugin.saveSettings(); render(); });
    }
  }

  function render() {
    const idx = store.index;
    const now = ctx.now ? ctx.now() : new Date();
    const today = D.todayISO(now);
    const hour = now.getHours();
    size();
    clear(root);
    renderBar(root, idx, today);
    const hello = el(root, 'header', 'bn-hello');
    el(hello, 'h1', 'bn-h1', greeting(hour));
    el(hello, 'p', 'bn-sub', idx.notes.length ? S.weekInsight(idx.notes, today) : 'Sunday, community, morning meditation and Bible study, in one place.');
    /* Prayer requests alone are enough to show the tiles (the first request
       in a fresh vault must appear under Praying for). */
    const empty = !idx.notes.length && !idx.praying.length && !idx.answered.length;
    const tiles = el(root, 'div', 'bn-tiles' + (empty ? ' is-solo' : ''));
    renderStart(tiles, idx, now, today);
    if (empty) { renderEmpty(root); dock.refresh(); return; }
    const draw = {
      open: renderOpen, pray: renderPrayer, week: renderWeek, index: renderIndex,
      days: renderDays, recent: renderRecent, kinds: renderKinds, series: renderSeries,
    };
    for (const id of shownTiles(ctx.plugin && ctx.plugin.settings)) {
      draw[id](tiles, idx, today);
      tiles.lastElementChild.dataset.tile = id;
    }
    dock.refresh();
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
    destroy() { unsub(); if (ro) ro.disconnect(); dock.destroy(); },
  };
}

module.exports = { mountHome, greeting, emphasis, weekRange };
