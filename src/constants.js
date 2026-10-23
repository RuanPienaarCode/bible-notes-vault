'use strict';
/* Names shared across the plugin. Pure — safe to require from tests. */

const KIND_KEY = 'bible-notes';
const VIEW_TYPE = 'bible-notes-home';

/* The four kinds, in Start-row order. `emoji` is the Notion-pure page icon;
   `label` names an untitled note and the button; `command` is spelled out
   because "Sunday" keeps its capital in sentence case and the others don't. */
const KINDS = [
  { id: 'sunday', label: 'Sunday', button: 'Sunday note', command: 'New Sunday note', emoji: '⛪', tone: 'orange' },
  { id: 'community', label: 'Community', button: 'Community', command: 'New community note', emoji: '🤝', tone: 'blue' },
  { id: 'meditation', label: 'Meditation', button: 'Meditation', command: 'New meditation note', emoji: '🌅', tone: 'green' },
  { id: 'study', label: 'Study', button: 'Study', command: 'New study note', emoji: '📖', tone: 'purple' },
];
const KIND_IDS = KINDS.map(k => k.id);
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
  translation: 'niv',
  church: '',
  chipsEverywhere: true,
  accent: 'indigo',
  templatesWritten: false,
};

/* The one accent colour at a time (Settings → Appearance). Indigo is the
   default; green puts `bn-accent-green` on the plugin's roots, and styles.css
   swaps the accent tokens under it. */
const ACCENTS = [['indigo', 'Indigo'], ['green', 'Green']];
const ACCENT_GREEN = 'bn-accent-green';
const accentOf = settings => (settings && settings.accent === 'green' ? 'green' : 'indigo');
const accentClass = settings => (accentOf(settings) === 'green' ? ACCENT_GREEN : '');

module.exports = { KIND_KEY, VIEW_TYPE, KINDS, KIND_IDS, kindOf, DEFAULT_SETTINGS, ACCENTS, ACCENT_GREEN, accentOf, accentClass };
