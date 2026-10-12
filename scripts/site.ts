/* npm run site. Prepares web/ for publishing, into .build/site/. The page itself is always
   revalidated, so everything it points at can be cached forever:
     - app.js is renamed after its contents and the page is pointed at the new name;
     - the art index is written into the page, with a preload for the item sheet, so the first
       pictures are on their way before any script has run.
   The Node server needs none of this and serves web/ as it is. */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/pipeline/paths.ts';
import type { ArtIndex } from '../src/pipeline/art.ts';

const web = join(ROOT, 'web'), out = join(ROOT, '.build', 'site');
mkdirSync(out, { recursive: true });
// emptied, not removed: wrangler dev holds the directory open
for (const name of readdirSync(out)) rmSync(join(out, name), { recursive: true, force: true });
cpSync(web, out, { recursive: true });

const swap = (text: string, from: string, to: string) => {
  if (text.split(from).length !== 2) throw new Error(`expected exactly one "${from}" in index.html`);
  return text.replace(from, () => to);
};

const script = readFileSync(join(web, 'app.js'));
const name = `assets/app.${createHash('sha256').update(script).digest('hex').slice(0, 10)}.js`;
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, name), script);
rmSync(join(out, 'app.js'));

const art: ArtIndex = JSON.parse(readFileSync(join(web, 'art', 'index.json'), 'utf8'));
let html = readFileSync(join(web, 'index.html'), 'utf8');
html = swap(html, '<script src="/app.js" defer></script>', `<script src="/${name}" defer></script>`);
html = swap(html, '<!--art-->', [
  `<link rel="preload" href="/art/${art.version}/items.webp" as="image" type="image/webp">`,
  // "<" is escaped so that nothing in the data can close the element
  `<script type="application/json" id="art-index">${JSON.stringify(art).replaceAll('<', '\\u003c')}</script>`,
].join('\n'));
writeFileSync(join(out, 'index.html'), html);
console.log(`site -> .build/site/ (${name}, art ${art.version})`);
