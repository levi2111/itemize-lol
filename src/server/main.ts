/* npm start. Configuration is by environment:
     PORT                 default 8787
     ITEMIZE_PATCH        serve this compiled patch as the live one instead of the latest (with those around it)
     ITEMIZE_DATA_DIR     where data/ lives, default ./data
     CALC_PER_MINUTE      per-client limit on POST /api/v1/calc, default 240, 0 = off
     LINKS_PER_MINUTE     per-client limit on POST /api/v1/links, default 20, 0 = off
     ITEMIZE_LINKS        the short links' SQLite file, default data/links.sqlite
     TRUST_PROXY=1        take the client address from X-Forwarded-For (only behind your own proxy) */
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from '../pipeline/paths.ts';
import { createApp } from './app.ts';
import { loadPatches } from './dataset.ts';
import { LINK_ID, sharedPage } from './links.ts';
import { championPage, championSite, robots, sitemap, SOURCE } from './pages.ts';
import { preview, siteMeta } from './preview.ts';
import { ENGINE_BASE, ENGINE_ENTRY, engineData, engineModules } from './engine-files.ts';
import { decodeShare, readShare } from './share.ts';
import { sqliteLinks } from './sqlite-links.ts';

const patches = loadPatches(process.env.ITEMIZE_PATCH), data = patches.live;
const trustProxy = process.env.TRUST_PROXY === '1';
const links = sqliteLinks(process.env.ITEMIZE_LINKS ?? join(ROOT, 'data', 'links.sqlite'));
const app = createApp(patches, {
  calcPerMinute: Number(process.env.CALC_PER_MINUTE ?? 240),
  linksPerMinute: Number(process.env.LINKS_PER_MINUTE ?? 20),
  clientAddress: c => (trustProxy && c.req.header('x-forwarded-for')?.split(',')[0]?.trim()) || getConnInfo(c).remote.address,
  links: () => links,
});
const web = join(ROOT, 'web');
// a short link, as the Worker answers it (src/worker/preview.ts), but for the image: this server draws none, so the
// preview shows the site's own
app.get('/b/:id', async c => {
  const id = c.req.param('id'), link = LINK_ID.test(id) ? await links.get(id) : null;
  const html = readFileSync(join(web, SOURCE[link?.layout ?? 'tabs']), 'utf8');
  if (!link) return c.html(html, 404);
  const state = decodeShare(link.s), p = state && preview(data, readShare(data, state, link.layout));
  const tags = p && { ...siteMeta('/'), description: undefined, title: p.title, url: `${new URL(c.req.url).origin}/b/${id}`, color: p.color };
  return c.html(sharedPage(html, { id, link }, tags));
});
// the champion pages (/vayne, /receipt/vayne), the sitemap, robots.txt and the other names' redirects: what
// scripts/site.ts writes as files for Cloudflare, made here by the same functions from web/'s pages as they are
const site = championSite(data.index), pageAt = new Map(site.pages.map(p => [p.path, p]));
app.get('/sitemap.xml', c => c.body(sitemap(site.slugs, data.manifest.builtAt), 200, { 'Content-Type': 'application/xml; charset=utf-8' }));
app.get('/robots.txt', c => c.text(robots()));
app.get('/*', async (c, next) => {
  const to = site.redirects.get(c.req.path);
  if (to) return c.redirect(to, 301);
  const p = pageAt.get(c.req.path);
  if (!p) return next();
  return c.html(championPage(readFileSync(join(web, SOURCE[p.layout]), 'utf8'), data.champion(p.id)!, p.slug, p.layout));
});
// the engine as the auto-build's worker runs it in the browser (src/server/engine-files.ts), made from src/ as it
// is now: the published site has a copy written by scripts/site.ts instead
let modules: Map<string, string> | null = null;
app.get(`${ENGINE_BASE}*`, c => {
  const path = c.req.path.slice(ENGINE_BASE.length), want = engineData(path);
  if (want) {
    const of = patches.get(want.patch), body = of && ('items' in want ? of.items : of.champion(want.champion));
    return body ? c.json(body) : c.notFound();
  }
  // made again on each request for the worker, so an edit to src/ shows on reload
  if (path === ENGINE_ENTRY || !modules) modules = engineModules();
  const code = modules.get(path);
  return code === undefined ? c.notFound() : c.body(code, 200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
});
// everything else that is not the API is the static site in web/; a page answers without its .html, as on Cloudflare
app.use('/*', serveStatic({
  root: relative(process.cwd(), web) || '.',
  rewriteRequestPath: path => path === '/receipt' ? '/receipt.html' : path,
}));
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, info => {
  const m = data.manifest;
  console.log(`itemize.lol on http://localhost:${info.port}  patch ${m.displayPatch} (${m.patch}), ${m.champions} champions, ${m.items} items`);
  const others = patches.all.filter(p => p.kind !== 'live').map(p => `${p.kind} ${p.data.manifest.displayPatch} (${p.data.patch})`);
  if (others.length) console.log(`  also ${others.join(', ')}`);
});
