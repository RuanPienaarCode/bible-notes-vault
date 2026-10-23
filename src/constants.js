'use strict';
/* Names shared across the plugin. Pure — safe to require from tests. */

const KIND_KEY = 'bible-notes';
/* The prayer list note's `bible-notes:` value. It is not one of the four
   kinds a note is started as (KINDS): it is one list that prayer requests are
   appended to, read for Praying for and kept out of everything that counts
   notes written. */
const PRAYER_KIND = 'prayer';
const VIEW_TYPE = 'bible-notes-home';

/* The four kinds, in Start-row order. `icon` is the lucide line icon in the
   kind's round tile (checked against the lucide Obsidian bundles); `label`
   names an untitled note and the button; `command` is spelled out because
   "Sunday" keeps its capital in sentence case and the others don't. */
const KINDS = [
  { id: 'sunday', label: 'Sunday', button: 'Sunday note', command: 'New Sunday note', icon: 'church' },
  { id: 'community', label: 'Community', button: 'Community', command: 'New community note', icon: 'users' },
  { id: 'meditation', label: 'Meditation', button: 'Meditation', command: 'New meditation note', icon: 'sunrise' },
  { id: 'study', label: 'Study', button: 'Study', command: 'New study note', icon: 'book-open' },
];
const KIND_IDS = KINDS.map(k => k.id);
/* The create sheet's last row. `heading` is the section requests go under. */
const PRAYER = { id: 'prayer', label: 'Prayer request', command: 'Add a prayer request', icon: 'hand-heart', heading: 'Praying for' };
const kindOf = id => KINDS.find(k => k.id === id) || null;

/* Generic defaults for a fresh vault. A vault keeps its own folders in the
   plugin's data.json (set from the settings tab). */
const DEFAULT_SETTINGS = {
  folders: {
    sunday: 'Bible Notes/Sunday',
    community: 'Bible Notes/Community',
    meditation: 'Bible Notes/Meditation',
    study: 'Bible Notes/Study',
  },
  templateFolder: 'Templates/Bible Notes',
  /* The one note prayer requests are added to (Home's + button). */
  prayerList: 'Bible Notes/Prayer list.md',
  translation: 'niv',
  church: '',
  chipsEverywhere: true,
  /* Home tiles hidden from Home's settings button or Settings → Home (ids
     from src/tiles.js). */
  hiddenTiles: [],
  templatesWritten: false,
};

module.exports = { KIND_KEY, PRAYER_KIND, PRAYER, VIEW_TYPE, KINDS, KIND_IDS, kindOf, DEFAULT_SETTINGS };
