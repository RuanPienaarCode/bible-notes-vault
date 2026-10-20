/* Build the browser harness: real src/ modules, the shipped stylesheet, a
   stubbed `obsidian` + CodeMirror and an in-memory vault. Outputs are
   gitignored. Obsidian's real app.css comes from the
   obsidian-plugin-preview-harness skill's extract-obsidian-css.sh.
   Serve:  python3 -m http.server 8828   then /_preview/preview.html */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
writeFileSync(join(here, 'bible-notes.css'), readFileSync(join(root, 'src/styles.css'), 'utf8'));
await esbuild.build({
  entryPoints: [join(here, 'entry.js')],
  outfile: join(here, 'bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'safari15',
  alias: {
    obsidian: join(here, 'obsidian-stub.js'),
    '@codemirror/view': join(here, 'cm-stub.js'),
    '@codemirror/state': join(here, 'cm-stub.js'),
  },
  logLevel: 'info',
});
