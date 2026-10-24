/* npm run lab. Builds the Fight Lab into one self-contained page, .build/lab/index.html:
   lab/index.html with lab/page.js and the engine bundled in, and the dataset written into it.
   It talks to no server, so the file works opened on its own or published anywhere.
     ITEMIZE_PATCH        build with this compiled patch instead of the latest */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { DATA_DIR, ROOT, distDir } from '../src/pipeline/paths.ts';
import type { ChampionIndexEntry } from '../src/server/dataset.ts';
import type { ChampionData, ItemData } from '../src/shared/types.ts';

const patch: string = process.env.ITEMIZE_PATCH ?? JSON.parse(readFileSync(join(DATA_DIR, 'dist', 'latest.json'), 'utf8')).patch;
const read = (f: string) => JSON.parse(readFileSync(join(distDir(patch), f), 'utf8'));
const index: ChampionIndexEntry[] = read('champions.json');

// the engine never reads tooltips or damage mentions: they are tooling, and most of the weight
const champions = index.map(c => {
  const champ: ChampionData = read(join('champions', `${c.id}.json`));
  for (const s of Object.values(champ.spells)) { delete s.tooltip; s.damageRefs = []; }
  champ.warnings = [];
  return champ;
});
// the Rift's shop: finished items and boots
const items = (read('items.json') as ItemData[])
  .filter(i => i.shops.includes('sr') && (!i.component || i.tags.includes('Boots')))
  .map(i => ({ ...i, damageRefs: [], plaintext: undefined }));

const app = await build({
  entryPoints: [join(ROOT, 'lab', 'page.js')], bundle: true, format: 'iife', target: 'es2022', minify: true, write: false, legalComments: 'none',
});
const script = app.outputFiles[0]!.text;
// nothing inside a script element may close it
const json = JSON.stringify({ patch, champions, items }).replace(/</g, '\\u003c');

const fill = (html: string, mark: string, text: string) => {
  if (html.split(mark).length !== 2) throw new Error(`expected exactly one ${mark} in lab/index.html`);
  return html.replace(mark, () => text);
};
let html = readFileSync(join(ROOT, 'lab', 'index.html'), 'utf8');
html = fill(html, '/*DATA*/', json);
html = fill(html, '/*APP*/', script.replace(/<\/script/gi, '<\\/script'));
const out = join(ROOT, '.build', 'lab');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
console.log(`lab built with patch ${patch}: ${champions.length} champions, ${items.length} items, ${(html.length / 1e6).toFixed(1)} MB -> .build/lab/index.html`);
