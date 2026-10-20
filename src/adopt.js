'use strict';
/* Existing notes that look like they belong to Bible Notes — offered for
   adoption, never adopted silently. Adopting adds one property (writes.adopt);
   this only decides what to offer, and as which kind. Pure. */

const { KIND_KEY, KIND_IDS } = require('./constants');
const { inFolder } = require('./note');

const COMMUNITY = /communit|small group|connect group|cell group|life group|home group/i;
const BY_TYPE = [
  { test: /sermon|message|preach/i, kind: null /* sunday or community, by context */ },
  { test: /devotion|quiet time|meditation/i, kind: 'meditation' },
  { test: /bible study|study/i, kind: 'study' },
];
const SUNDAY_FOLDER = /^(sunday sermons?|sermons?|gathering|sunday)$/i;

const list = v => (Array.isArray(v) ? v : (v === null || v === undefined ? [] : [v])).map(String);

/* files: [{ path, fm }] for every markdown file → [{ path, kind, reason }]. */
function candidates(files, settings) {
  const out = [];
  for (const f of files) {
    if (f.fm && f.fm[KIND_KEY] !== undefined) continue;
    const segments = f.path.split('/');
    if (segments.slice(0, -1).some(s => /^templates?$/i.test(s)) || inFolder(f.path, settings.templateFolder)) continue;
    const type = list(f.fm && f.fm.type).join(', ');
    let hit = null;
    for (const rule of BY_TYPE) {
      if (!type || !rule.test.test(type)) continue;
      const context = f.path + ' ' + list(f.fm && f.fm.tags).join(' ');
      hit = { kind: rule.kind || (COMMUNITY.test(context) ? 'community' : 'sunday'), reason: `type: ${type}` };
      break;
    }
    if (!hit) {
      const k = KIND_IDS.find(id => inFolder(f.path, settings.folders && settings.folders[id]));
      if (k) hit = { kind: k, reason: `in ${settings.folders[k]}` };
    }
    if (!hit) {
      const seg = segments.slice(0, -1).find(s => SUNDAY_FOLDER.test(s));
      if (seg) hit = { kind: 'sunday', reason: `in ${seg}` };
    }
    if (hit) out.push({ path: f.path, kind: hit.kind, reason: hit.reason });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

module.exports = { candidates };
