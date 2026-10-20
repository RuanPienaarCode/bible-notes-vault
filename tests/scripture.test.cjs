'use strict';
/* Seam 1 — reading scripture references the way people actually type them.
   Every expected value here is written out by hand from the reference
   itself, never recomputed the way the parser does it. */
const assert = require('node:assert');
const S = require('../src/scripture');

const one = (text, opts) => {
  const refs = S.parseRefs(text, opts);
  assert.strictEqual(refs.length, 1, `expected one reference in ${JSON.stringify(text)}, got ${refs.length}`);
  return refs[0];
};

/* A plain verse range in running prose. */
{
  const text = 'Today: John 15:1-8 on the vine.';
  const r = one(text);
  assert.strictEqual(r.book, 'John');
  assert.deepStrictEqual(r.spans, [{ c1: 15, v1: 1, c2: 15, v2: 8 }]);
  assert.strictEqual(r.label, 'John 15:1–8');
  assert.strictEqual(text.slice(r.start, r.end), 'John 15:1-8');
}

/* An en dash in the range, as pasted from a Bible app. */
{
  const r = one('**Matthew 11:28–30** — Come to Me');
  assert.strictEqual(r.book, 'Matthew');
  assert.deepStrictEqual(r.spans, [{ c1: 11, v1: 28, c2: 11, v2: 30 }]);
  assert.strictEqual(r.label, 'Matthew 11:28–30');
}

/* Abbreviated, numbered book with a verse list: two spans in one chapter. */
{
  const r = one('Opening: 1 Sam 10:1,5-7 and then');
  assert.strictEqual(r.book, '1 Samuel');
  assert.deepStrictEqual(r.spans, [{ c1: 10, v1: 1, c2: 10, v2: 1 }, { c1: 10, v1: 5, c2: 10, v2: 7 }]);
  assert.strictEqual(r.label, '1 Samuel 10:1, 5–7');
  assert.strictEqual(r.raw, '1 Sam 10:1,5-7');
}

/* Short forms with and without a dot, glued or spaced numbers. */
{
  assert.strictEqual(one('Gal 3:1-5').label, 'Galatians 3:1–5');
  assert.strictEqual(one('see Eph. 2:8').label, 'Ephesians 2:8');
  assert.strictEqual(one('1Cor 13:4').label, '1 Corinthians 13:4');
  assert.strictEqual(one('Ps 46:10').label, 'Psalm 46:10');
  assert.strictEqual(one('Song of Solomon 2:4').book, 'Song of Songs');
}

/* Two references in one line, separated by a semicolon. */
{
  const refs = S.parseRefs('John 3:16; Rom 8:28');
  assert.deepStrictEqual(refs.map(r => r.label), ['John 3:16', 'Romans 8:28']);
}

/* A list that changes chapter inside the same book (a quick note often
   writes it this way), and a range that crosses a chapter. */
{
  const r = one('Act 19:1,2, 19:6 — the Spirit');
  assert.strictEqual(r.book, 'Acts');
  assert.deepStrictEqual(r.spans, [
    { c1: 19, v1: 1, c2: 19, v2: 1 }, { c1: 19, v1: 2, c2: 19, v2: 2 }, { c1: 19, v1: 6, c2: 19, v2: 6 },
  ]);
  const x = one('John 15:1–16:4');
  assert.deepStrictEqual(x.spans, [{ c1: 15, v1: 1, c2: 16, v2: 4 }]);
  assert.strictEqual(x.label, 'John 15:1–16:4');
  assert.deepStrictEqual(S.chapterKeys(x), ['John 15', 'John 16']);
  const y = one('Gen 1:1; 2:4');
  assert.strictEqual(y.label, 'Genesis 1:1; 2:4');
}

/* A translation in brackets belongs to the reference. */
{
  const r = one('> John 1:12 (NIV)');
  assert.strictEqual(r.translation, 'NIV');
  assert.strictEqual(r.raw, 'John 1:12 (NIV)');
  assert.strictEqual(one('John 2:17 (CSB) And his disciples').translation, 'CSB');
  assert.strictEqual(one('John 2:17').translation, null);
}

/* Prose that is NOT scripture. */
{
  const none = t => assert.deepStrictEqual(S.parseRefs(t).map(r => r.raw), [], `should find nothing in ${JSON.stringify(t)}`);
  none('Romans 8 was the study');          /* chapter only — prose needs a verse */
  none('the ratio is 3:1 here');           /* lowercase book */
  none('a remark 2:1 to nobody');          /* inside a word */
  none('John 25:1');                       /* John has 21 chapters */
  none('Ps 23:0');                         /* no verse 0 */
  none('Mark 2 points before 10');         /* no verse */
  none('Johnson 3:16');                    /* a surname */
}

/* A property value is known to be scripture: chapter-only and any case. */
{
  const p = t => one(t, { prose: false });
  assert.deepStrictEqual(p('Romans 8').spans, [{ c1: 8, v1: null, c2: 8, v2: null }]);
  assert.strictEqual(p('Romans 8').label, 'Romans 8');
  assert.strictEqual(p('john 14–16').label, 'John 14–16');
  assert.strictEqual(p('2 Peter 3:9-13').label, '2 Peter 3:9–13');
  /* A one-chapter book's bare number is a verse. */
  assert.deepStrictEqual(p('Jude 3').spans, [{ c1: 1, v1: 3, c2: 1, v2: 3 }]);
  assert.strictEqual(p('Jude 3').label, 'Jude 1:3');
}

/* A common misspelling still reads. */
assert.strictEqual(one('1 Samual 22:1-7').label, '1 Samuel 22:1–7');

/* Numbered books: the number belongs to the book only when that makes a
   real book; `3 John 3:16` can't be 3 John (one chapter), so it is John 3:16
   with a stray 3 in front. Roman numerals need their space. */
{
  assert.strictEqual(one('1 John 4:8').label, '1 John 4:8');
  assert.strictEqual(one('I John 4:8').label, '1 John 4:8');
  assert.strictEqual(one('II Tim 3:16').label, '2 Timothy 3:16');
  const r = one('verse 3 John 3:16');
  assert.strictEqual(r.label, 'John 3:16');
  assert.strictEqual(r.raw, 'John 3:16');
}

/* Where a reference leads. */
{
  const vine = one('John 15:5');
  assert.strictEqual(S.bibleHubUrl(vine, 'NIV'), 'https://biblehub.com/niv/john/15.htm');
  assert.strictEqual(S.bibleHubUrl(one('1 Sam 10:1'), 'bsb'), 'https://biblehub.com/bsb/1_samuel/10.htm');
  assert.strictEqual(S.bibleHubUrl(one('Song 2:4')), 'https://biblehub.com/niv/songs/2.htm');
  assert.strictEqual(S.passageNoteName(vine), 'John 15');
  assert.strictEqual(S.passageLink(vine), 'John 15#^5');
  const ps = one('Ps 23:1');
  assert.strictEqual(S.passageNoteName(ps), 'Psalms 23', 'chapter notes use the canonical book name');
  assert.deepStrictEqual(S.chapterKeys(ps), ['Psalm 23'], 'labels and index keys use the singular');
}

/* What Bible Search's reader is handed: its own simple form — canonical
   book, one chapter, a verse or a plain range — whatever was typed. Lists
   and cross-chapter ranges come down to where they start. */
{
  assert.strictEqual(S.readerRef(one('John 15:5')), 'John 15:5');
  assert.strictEqual(S.readerRef(one('Jn 15:1–8')), 'John 15:1-8');
  assert.strictEqual(S.readerRef(one('Ps 23:1')), 'Psalms 23:1');
  assert.strictEqual(S.readerRef(one('1 Sam 10:1,5-7')), '1 Samuel 10:1');
  assert.strictEqual(S.readerRef(one('John 15:1–16:4')), 'John 15:1');
  assert.strictEqual(S.readerRef(one('Romans 8', { prose: false })), 'Romans 8');
  assert.strictEqual(S.readerRef(one('Song of Solomon 2:4')), 'Song of Songs 2:4');
}

/* A reference that names its own translation opens in it — when BibleHub
   has that translation; otherwise the chosen one. */
{
  assert.strictEqual(S.bibleHubUrl(one('John 1:12 (CSB)'), 'niv'), 'https://biblehub.com/csb/john/1.htm');
  assert.strictEqual(S.bibleHubUrl(one('John 1:12 (ESV)'), 'niv'), 'https://biblehub.com/esv/john/1.htm');
  assert.strictEqual(S.bibleHubUrl(one('John 1:12 (AFR83)'), 'niv'), 'https://biblehub.com/niv/john/1.htm');
  /* A chosen translation BibleHub doesn't serve falls back to NIV, never a
     dead link; and the card names the translation the link will open. */
  assert.strictEqual(S.bibleHubUrl(one('John 1:12'), 'msg'), 'https://biblehub.com/niv/john/1.htm');
  assert.strictEqual(S.linkTranslation(one('John 1:12 (AFR83)'), 'esv'), 'ESV');
  assert.strictEqual(S.linkTranslation(one('John 1:12 (CSB)'), 'esv'), 'CSB');
}

/* A time is not a verse. */
{
  assert.deepStrictEqual(S.parseRefs('Meet at Am 5:30 pm, then Ex 9:15am').map(r => r.raw), []);
  assert.deepStrictEqual(S.parseRefs('Amos 5:24 and Am 5:24.').map(r => r.label), ['Amos 5:24', 'Amos 5:24']);
}

/* A scripture property: one value or a list, unrecognised entries kept. */
{
  const p = S.parseProperty(['John 15:1-8', 'Psalm 1', 'the vine']);
  assert.deepStrictEqual(p.map(e => e.raw), ['John 15:1-8', 'Psalm 1', 'the vine']);
  assert.deepStrictEqual(p.map(e => e.refs.length), [1, 1, 0]);
  assert.deepStrictEqual(S.parseProperty('2 Peter 3:9-13').map(e => e.refs[0].label), ['2 Peter 3:9–13']);
  assert.deepStrictEqual(S.parseProperty(null), []);
  assert.deepStrictEqual(S.parseProperty(''), []);
}

console.log('scripture OK');
