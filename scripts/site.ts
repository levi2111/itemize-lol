/* npm run site. Prepares web/ for publishing, into .build/site/. A page itself is always
   revalidated, so everything it points at can be cached forever:
     - its scripts are renamed after their contents and the page is pointed at the new names;
     - the art index is written into the page, with a preload for the item sheet, so the first
       pictures are on their way before any script has run.
   There is a page per layout, and both get the same treatment.
   It also draws the preview images made ahead of time (scripts/og.ts) into og/, and writes the
   version that names the images the Worker draws (.build/og-version.txt).
   The Node server needs none of this and serves web/ as it is. */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/pipeline/paths.ts';
import type { ArtIndex } from '../src/pipeline/art.ts';
import { buildOg } from './og.ts';

const web = join(ROOT, 'web'), out = join(ROOT, '.build', 'site');
mkdirSync(out, { recursive: true });
// emptied, not removed: wrangler dev holds the directory open
for (const name of readdirSync(out)) rmSync(join(out, name), { recursive: true, force: true });
cpSync(web, out, { recursive: true });

const PAGES = ['index.html', 'receipt.html'];
const swap = (page: string, text: string, from: string, to: string) => {
  if (text.split(from).length !== 2) throw new Error(`expected exactly one "${from}" in ${page}`);
  return text.replace(from, () => to);
};

mkdirSync(join(out, 'assets'), { recursive: true });
/** Moves a script of web/ to a name made from its contents, and returns that name. */
const named = (file: string) => {
  const script = readFileSync(join(web, file));
  const name = `assets/${file.replace(/\.js$/, '')}.${createHash('sha256').update(script).digest('hex').slice(0, 10)}.js`;
  writeFileSync(join(out, name), script);
  rmSync(join(out, file));
  return name;
};
const app = named('app.js'), layout = named('layout.js');

const art: ArtIndex = JSON.parse(readFileSync(join(web, 'art', 'index.json'), 'utf8'));
for (const page of PAGES) {
  let html = readFileSync(join(web, page), 'utf8');
  html = swap(page, html, '<script src="/app.js" defer></script>', `<script src="/${app}" defer></script>`);
  html = swap(page, html, '<script src="/layout.js"></script>', `<script src="/${layout}"></script>`);
  html = swap(page, html, '<!--art-->', [
    `<link rel="preload" href="/art/${art.version}/items.webp" as="image" type="image/webp">`,
    // "<" is escaped so that nothing in the data can close the element
    `<script type="application/json" id="art-index">${JSON.stringify(art).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n'));
  writeFileSync(join(out, page), html);
}
// a build's image follows from the cards and glyphs (the key buildOg returns), the data, and the code that reads a link and does the sums
const og = await buildOg(out), version = createHash('sha256').update(og);
for (const dir of ['src/engine', 'src/server', 'src/og']) for (const f of readdirSync(join(ROOT, dir)).sort()) version.update(readFileSync(join(ROOT, dir, f)));
writeFileSync(join(ROOT, '.build', 'og-version.txt'), version.digest('hex').slice(0, 12));
console.log(`site -> .build/site/ (${app}, ${layout}, art ${art.version})`);
