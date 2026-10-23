'use strict';
/* Seam 8 — which tiles Home shows. One stored list of hidden tile ids, read
   by Home's settings button and Settings → Home alike. Start is not a tile
   you can hide. Pure. */
const assert = require('node:assert');
const { TILES, TILE_IDS, shownTiles, setTile } = require('../src/tiles');

/* Home's order, and every tile has a name for the menu and the settings tab. */
assert.deepStrictEqual(TILE_IDS, ['open', 'pray', 'week', 'index', 'days', 'recent', 'kinds', 'series']);
assert.ok(TILES.every(t => typeof t.label === 'string' && t.label));
assert.ok(!TILE_IDS.includes('start'), 'Start always shows');

/* Nothing stored, or junk stored: everything shows. */
assert.deepStrictEqual(shownTiles({}), TILE_IDS);
assert.deepStrictEqual(shownTiles(undefined), TILE_IDS);
assert.deepStrictEqual(shownTiles({ hiddenTiles: 'week' }), TILE_IDS, 'a string is not a list');

/* Hidden ones drop out; an id this version does not know is ignored. */
assert.deepStrictEqual(shownTiles({ hiddenTiles: ['kinds', 'week', 'start', 'gone'] }), ['open', 'pray', 'index', 'days', 'recent', 'series']);

/* Hiding and showing one tile: the stored list stays in Home's order, keeps
   no duplicates and no unknown ids, and the input is not changed. */
{
  const before = ['series', 'gone'];
  const hidden = setTile(before, 'week', false);
  assert.deepStrictEqual(hidden, ['week', 'series']);
  assert.deepStrictEqual(before, ['series', 'gone'], 'input untouched');
  assert.deepStrictEqual(setTile(hidden, 'week', false), ['week', 'series'], 'hiding twice is still once');
  assert.deepStrictEqual(setTile(hidden, 'week', true), ['series']);
  assert.deepStrictEqual(setTile(hidden, 'start', false), ['week', 'series'], 'Start cannot be hidden');
  assert.deepStrictEqual(setTile(undefined, 'open', false), ['open']);
}

console.log('tiles OK');
