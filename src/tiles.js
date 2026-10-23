'use strict';
/* The tiles Home can show, and which of them a vault has hidden — one stored
   list (`hiddenTiles`), set from Home's settings button or Settings → Home.
   Start is not among them: it is where every note begins, so it always
   shows. Pure. */

/* In Home's order. */
const TILES = [
  { id: 'open', label: 'Still open' },
  { id: 'pray', label: 'Praying for' },
  { id: 'week', label: 'Notes this week' },
  { id: 'index', label: 'Index of passages' },
  { id: 'days', label: 'Days in the Word' },
  { id: 'recent', label: 'Recent notes' },
  { id: 'kinds', label: 'What you wrote' },
  { id: 'series', label: 'Series' },
];
const TILE_IDS = TILES.map(t => t.id);

const hiddenSet = list => new Set((Array.isArray(list) ? list : []).filter(id => TILE_IDS.includes(id)));

/* The tiles shown, in Home's order. An id this version does not know is
   ignored. */
function shownTiles(settings) {
  const hidden = hiddenSet(settings && settings.hiddenTiles);
  return TILE_IDS.filter(id => !hidden.has(id));
}

/* The hidden list after showing or hiding one tile: known ids only, each
   once, in Home's order. The list passed in is not changed. */
function setTile(hiddenTiles, id, show) {
  const hidden = hiddenSet(hiddenTiles);
  if (TILE_IDS.includes(id)) {
    if (show) hidden.delete(id); else hidden.add(id);
  }
  return TILE_IDS.filter(x => hidden.has(x));
}

module.exports = { TILES, TILE_IDS, shownTiles, setTile };
