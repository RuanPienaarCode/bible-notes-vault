/* Builds the shipped stylesheet: src/styles.css with the bundled font
   inlined at the `@bn-fonts` marker. Used by esbuild.config.mjs (root
   styles.css) and by the preview harness, so both see the same bytes.

   Font: Outfit, taken unmodified from the pinned `@fontsource-variable/outfit`
   devDependency (SIL Open Font License 1.1, text in fonts/OFL.txt). One
   variable file carries every weight; the latin and latin-ext subsets are
   split by unicode-range exactly as Fontsource ships them, so a page that
   only uses latin never decodes the other. The family is named "Bible Notes
   Outfit" so it can never collide with another plugin that bundles Outfit
   under the plain name. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER = '/* @bn-fonts */';

const DIR = 'node_modules/@fontsource-variable/outfit/files';
const FONTS = [
  {
    family: 'Bible Notes Outfit',
    file: `${DIR}/outfit-latin-ext-wght-normal.woff2`,
    range: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  },
  {
    family: 'Bible Notes Outfit',
    file: `${DIR}/outfit-latin-wght-normal.woff2`,
    range: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
];

/* OFL condition 2: every copy of the font carries the copyright notice and
   the licence. A release ships only main.js, manifest.json and styles.css,
   so the full licence text travels in the stylesheet beside the font. */
function licenceComment(root) {
  const text = readFileSync(join(root, 'fonts/OFL.txt'), 'utf8');
  if (text.includes('*/')) throw new Error('fonts/OFL.txt must not contain a comment terminator');
  return `/* Outfit — licence for the font inlined below.\n\n${text.trim()}\n*/`;
}

export function fontFaces(root) {
  return licenceComment(root) + '\n' + FONTS.map(({ family, file, range }) => {
    const b64 = readFileSync(join(root, file)).toString('base64');
    return `@font-face { font-family: "${family}"; font-style: normal; font-weight: 100 900; font-display: swap; src: url(data:font/woff2;base64,${b64}) format("woff2"); unicode-range: ${range}; }`;
  }).join('\n');
}

export function buildStyles(root) {
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
  if (css.split(MARKER).length !== 2) throw new Error(`src/styles.css must contain ${MARKER} exactly once`);
  return css.replace(MARKER, () => fontFaces(root));
}
