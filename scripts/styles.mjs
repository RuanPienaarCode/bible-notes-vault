/* Builds the shipped stylesheet: src/styles.css with the bundled fonts
   inlined at the `@bn-fonts` marker. Used by esbuild.config.mjs (root
   styles.css) and by the preview harness, so both see the same bytes.

   Fonts: Geist and Geist Mono, taken unmodified from the pinned `geist`
   devDependency (SIL Open Font License 1.1, text in fonts/OFL.txt). The
   variable files carry every weight in one file each, which is smaller than
   five static weights. The families are named "Bible Notes Geist…" so they can
   never collide with another plugin that bundles Geist under the plain name. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER = '/* @bn-fonts */';

const FONTS = [
  { family: 'Bible Notes Geist', file: 'node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2' },
  { family: 'Bible Notes Geist Mono', file: 'node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2' },
];

/* OFL condition 2: every copy of the fonts carries the copyright notice and
   the licence. A release ships only main.js, manifest.json and styles.css,
   so the full licence text travels in the stylesheet beside the fonts. */
function licenceComment(root) {
  const text = readFileSync(join(root, 'fonts/OFL.txt'), 'utf8');
  if (text.includes('*/')) throw new Error('fonts/OFL.txt must not contain a comment terminator');
  return `/* Geist and Geist Mono — licence for the fonts inlined below.\n\n${text.trim()}\n*/`;
}

export function fontFaces(root) {
  return licenceComment(root) + '\n' + FONTS.map(({ family, file }) => {
    const b64 = readFileSync(join(root, file)).toString('base64');
    return `@font-face { font-family: "${family}"; font-style: normal; font-weight: 100 900; font-display: swap; src: url(data:font/woff2;base64,${b64}) format("woff2"); }`;
  }).join('\n');
}

export function buildStyles(root) {
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
  if (css.split(MARKER).length !== 2) throw new Error(`src/styles.css must contain ${MARKER} exactly once`);
  return css.replace(MARKER, () => fontFaces(root));
}
