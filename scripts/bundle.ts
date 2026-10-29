/* npm run bundle. Packs the compiled datasets into one file for the Cloudflare Worker, which
   has no file system to read them from, and the preview images' glyphs next to it. Wrangler runs
   this before every dev session and deploy.
     ITEMIZE_PATCH        bundle this compiled patch as the live one instead of the latest
   Every patch served goes in (src/shared/patch.ts): the live one, the one before and a preview of the next.
   Each is a line of JSON with everything but its champions, then a line per champion in the order of its
   index, so the Worker parses a champion only when it is first asked for (src/worker/data.ts). */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { ROOT, distDir } from '../src/pipeline/paths.ts';
import type { ChampionIndexEntry } from '../src/server/dataset.ts';
import { servedFromDisk } from '../src/server/dataset.ts';

const lines: string[] = [];
for (const { patch, kind } of servedFromDisk(process.env.ITEMIZE_PATCH)) {
  const read = (f: string) => readFileSync(join(distDir(patch), f), 'utf8');
  const index: ChampionIndexEntry[] = JSON.parse(read('champions.json'));
  lines.push(JSON.stringify({ patch, kind, manifest: JSON.parse(read('manifest.json')), index, items: JSON.parse(read('items.json')) }));
  // as written by the build: one line of JSON each
  for (const c of index) lines.push(JSON.stringify(JSON.parse(read(join('champions', `${c.id}.json`)))));
  console.log(`bundled ${kind} patch ${patch}: ${index.length} champions`);
}
// outside src/, which wrangler dev watches: writing there would start the build again
const out = join(ROOT, '.build', 'data.txt');
mkdirSync(join(ROOT, '.build'), { recursive: true });
const text = lines.join('\n');
writeFileSync(out, text);
console.log(`bundle: ${(text.length / 1e6).toFixed(1)} MB`);
// the glyphs the preview images draw text with, inflated so the Worker reads them as they are
writeFileSync(join(ROOT, '.build', 'glyphs.bin'), inflateRawSync(readFileSync(join(ROOT, 'src', 'og', 'glyphs.bin'))));
