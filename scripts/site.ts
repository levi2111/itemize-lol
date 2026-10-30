/* npm run site. Prepares web/ for publishing, into .build/site/. A page itself is always
   revalidated, so everything it points at can be cached forever:
     - its scripts are renamed after their contents and the page is pointed at the new names;
     - the art index is written into the page, with a preload for the item sheet, so the first
       pictures are on their way before any script has run;
     - the engine the auto-build runs in the browser, with its data, goes in a folder named after
       its contents (src/server/engine-files.ts), and the page's <meta name="engine"> points there;
       the fly goes in one of its own the same way, for <meta name="fly">.
   There is a page per layout, and both get the same treatment.
   Then each champion gets a page of its own in both layouts, made from those (src/server/pages.ts), with the
   sitemap, robots.txt and the redirects of other names.
   It also draws the preview images made ahead of time (scripts/og.ts) into og/, and writes the
   version that names the images the Worker draws (.build/og-version.txt).
   The Node server needs none of the renaming and serves web/ as it is; it makes the champion pages itself, with the
   same functions. */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from '../src/pipeline/paths.ts';
import type { ArtIndex } from '../src/pipeline/art.ts';
import { buildOg } from './og.ts';
import { loadPatches } from '../src/server/dataset.ts';
import { ENGINE_BASE, engineModules, FLY_BASE, flyFiles } from '../src/server/engine-files.ts';
import { championPage, championSite, redirectsFile, robots, sitemap, SOURCE } from '../src/server/pages.ts';

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

// the engine for the auto-build's worker, with the data it reads for each patch served, in a folder named after all
// of it (src/server/engine-files.ts); its modules import each other by relative paths, so the folder moves as one
const patches = loadPatches(process.env.ITEMIZE_PATCH), dataset = patches.live;
const engine = new Map<string, string>(engineModules());
for (const { data: d } of patches.all) {
  engine.set(`data/${d.patch}/items.json`, JSON.stringify(d.items));
  for (const c of d.index) engine.set(`data/${d.patch}/champions/${c.id}.json`, JSON.stringify(d.champion(c.id)));
}
/** Writes these files into a folder named after all of them, and returns its name. */
const folder = (name: string, files: Map<string, string>) => {
  const hash = createHash('sha256');
  for (const [path, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(path).update('\0').update(text).update('\0');
  const dir = `assets/${name}.${hash.digest('hex').slice(0, 10)}/`;
  for (const [path, text] of files) {
    mkdirSync(dirname(join(out, dir, path)), { recursive: true });
    writeFileSync(join(out, dir, path), text);
  }
  return dir;
};
const engineDir = folder('engine', engine), flyDir = folder('fly', flyFiles());

const art: ArtIndex = JSON.parse(readFileSync(join(web, 'art', 'index.json'), 'utf8'));
const made: Record<string, string> = {};
for (const page of PAGES) {
  let html = readFileSync(join(web, page), 'utf8');
  html = swap(page, html, '<script src="/app.js" defer></script>', `<script src="/${app}" defer></script>`);
  html = swap(page, html, '<script src="/layout.js"></script>', `<script src="/${layout}"></script>`);
  html = swap(page, html, `<meta name="engine" content="${ENGINE_BASE}">`, `<meta name="engine" content="/${engineDir}">`);
  html = swap(page, html, `<meta name="fly" content="${FLY_BASE}">`, `<meta name="fly" content="/${flyDir}">`);
  html = swap(page, html, '<!--art-->', [
    `<link rel="preload" href="/art/${art.version}/items.webp" as="image" type="image/webp">`,
    // "<" is escaped so that nothing in the data can close the element
    `<script type="application/json" id="art-index">${JSON.stringify(art).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n'));
  writeFileSync(join(out, page), html);
  made[page] = html;
}

// the champion pages, from the live patch the Worker is bundled with (scripts/bundle.ts reads the same ITEMIZE_PATCH)
const data = dataset;
const site = championSite(data.index);
mkdirSync(join(out, 'receipt'), { recursive: true });
for (const p of site.pages) writeFileSync(join(out, p.file), championPage(made[SOURCE[p.layout]]!, data.champion(p.id)!, p.slug, p.layout));
writeFileSync(join(out, 'sitemap.xml'), sitemap(site.slugs, data.manifest.builtAt));
writeFileSync(join(out, 'robots.txt'), robots());
writeFileSync(join(out, '_redirects'), redirectsFile(site.redirects));

// a build's image follows from the cards and glyphs (the key buildOg returns), the data, and the code that reads a link and does the sums
const og = await buildOg(out), version = createHash('sha256').update(og);
for (const dir of ['src/engine', 'src/server', 'src/og']) for (const f of readdirSync(join(ROOT, dir)).sort()) version.update(readFileSync(join(ROOT, dir, f)));
writeFileSync(join(ROOT, '.build', 'og-version.txt'), version.digest('hex').slice(0, 12));
console.log(`site -> .build/site/ (${app}, ${layout}, art ${art.version}; ${site.pages.length} champion pages, ${site.redirects.size} redirects)`);
