/* npm run bundle. Packs the compiled dataset into one file for the Cloudflare Worker, which
   has no file system to read it from. Wrangler runs this before every dev session and deploy.
     ITEMIZE_PATCH        bundle this compiled patch instead of the latest */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, ROOT, distDir } from '../src/pipeline/paths.ts';
import type { ChampionIndexEntry } from '../src/server/dataset.ts';

const patch: string = process.env.ITEMIZE_PATCH ?? JSON.parse(readFileSync(join(DATA_DIR, 'dist', 'latest.json'), 'utf8')).patch;
const read = (f: string) => JSON.parse(readFileSync(join(distDir(patch), f), 'utf8'));
const index: ChampionIndexEntry[] = read('champions.json');
const bundle = {
  patch,
  manifest: read('manifest.json'),
  index,
  items: read('items.json'),
  champions: Object.fromEntries(index.map(c => [c.id, read(join('champions', `${c.id}.json`))])),
};
const out = join(ROOT, 'src', 'worker', 'data.gen.txt');
const text = JSON.stringify(bundle);
writeFileSync(out, text);
console.log(`bundled patch ${patch}: ${index.length} champions, ${(text.length / 1e6).toFixed(1)} MB`);
