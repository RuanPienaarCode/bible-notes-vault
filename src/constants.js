'use strict';
/* Names shared across the plugin. Pure — safe to require from tests. */

const KIND_KEY = 'bible-notes';
const VIEW_TYPE = 'bible-notes-home';

/* The four kinds, in Start-row order. `emoji` is the Notion-pure page icon;
   `label` names an untitled note and the button. */
const KINDS = [
  { id: 'sunday', label: 'Sunday', button: 'Sunday note', emoji: '⛪', tone: 'orange' },
  { id: 'community', label: 'Community', button: 'Community', emoji: '🤝', tone: 'blue' },
  { id: 'meditation', label: 'Meditation', button: 'Meditation', emoji: '🌅', tone: 'green' },
  { id: 'study', label: 'Study', button: 'Study', emoji: '📖', tone: 'purple' },
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
  templatesWritten: false,
};

module.exports = { KIND_KEY, VIEW_TYPE, KINDS, KIND_IDS, kindOf, DEFAULT_SETTINGS };
