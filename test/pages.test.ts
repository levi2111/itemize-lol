import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../src/pipeline/paths.ts';
import { createApp } from '../src/server/app.ts';
import { Dataset } from '../src/server/dataset.ts';
import { championHead, championPage, championSite, redirectsFile, sitemap, slugOf, SOURCE } from '../src/server/pages.ts';

const data = new Dataset();
const site = championSite(data.index);
const source = (layout: 'tabs' | 'receipt') => readFileSync(join(ROOT, 'web', SOURCE[layout]), 'utf8');
const vayne = data.champion('Vayne')!;

test('slugs are lower-case readable names, one per champion', () => {
  assert.equal(slugOf("Kai'Sa"), 'kaisa');
  assert.equal(slugOf("Bel'Veth"), 'belveth');
  assert.equal(slugOf('Dr. Mundo'), 'dr-mundo');
  assert.equal(slugOf('Nunu & Willump'), 'nunu-willump');
  assert.equal(slugOf('Renata Glasc'), 'renata-glasc');
  assert.equal(slugOf('Jarvan IV'), 'jarvan-iv');
  assert.equal(slugOf('Wukong'), 'wukong');
  const slugs = [...site.slugs.values()];
  assert.equal(slugs.length, data.index.length);
  assert.equal(new Set(slugs).size, slugs.length, 'two champions share a slug');
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(site.slugs.get('MonkeyKing'), 'wukong');
  assert.throws(() => championSite([{ id: 'A', name: 'Kai Sa' }, { id: 'B', name: 'Kai-Sa' }]), /share/);
  assert.throws(() => championSite([{ id: 'R', name: 'Receipt' }]), /address/);
});

test('every champion has a page in each layout, and other names redirect to the tabs one', () => {
  assert.equal(site.pages.length, data.index.length * 2);
  const paths = new Set(site.pages.map(p => p.path));
  assert.ok(paths.has('/vayne') && paths.has('/receipt/vayne') && paths.has('/wukong'));
  assert.equal(site.pages.find(p => p.path === '/vayne')!.file, 'vayne.html');
  assert.equal(site.pages.find(p => p.path === '/receipt/vayne')!.file, 'receipt/vayne.html');
  const r = site.redirects;
  assert.equal(r.get('/MonkeyKing'), '/wukong');
  assert.equal(r.get('/monkeyking'), '/wukong');
  assert.equal(r.get('/Vayne'), '/vayne');
  assert.equal(r.get('/leesin'), '/lee-sin');
  assert.equal(r.get('/kai-sa'), '/kaisa');
  assert.equal(r.get('/nunu'), '/nunu-willump');
  for (const [from, to] of r) {
    assert.ok(!paths.has(from), `${from} is a page and a redirect`);
    assert.ok(paths.has(to), `${from} leads nowhere`);
  }
  // Cloudflare takes 2,000 static redirects
  assert.ok(r.size < 2000);
  assert.match(redirectsFile(r), /^\/MonkeyKing \/wukong 301$/m);
});

test('a champion page starts on its champion, with a head of its own', () => {
  const html = championPage(source('tabs'), vayne, 'vayne', 'tabs');
  assert.match(html, /<html data-champ="vayne" lang="en" data-layout="tabs">/);
  assert.match(html, /<title>Vayne [^<]*\| itemize\.lol<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*Vayne, the Night Hunter[^"]*Tumble[^"]*">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/itemize\.lol\/vayne">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/itemize\.lol\/vayne">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/itemize\.lol\/og\/Vayne\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /id="champ-name"[^>]*>Vayne</);
  assert.match(html, /id="champ-title">The Night Hunter</);
  assert.ok(!html.includes("Kai'Sa"), 'the default champion is still on the page');
  // a preview the general page may carry gives way to the champion's
  const withOg = source('tabs').replace('<link rel="canonical"', '<meta property="og:title" content="itemize.lol">\n<link rel="canonical"');
  assert.equal(championPage(withOg, vayne, 'vayne', 'tabs').match(/property="og:title"/g)!.length, 1);
  // og images are named by Data Dragon id
  assert.match(championPage(source('tabs'), data.champion('MonkeyKing')!, 'wukong', 'tabs'), /og\/MonkeyKing\.png/);
});

test('the receipt page of a champion points search at the tabs one', () => {
  const nunu = data.champion('Nunu')!;
  const html = championPage(source('receipt'), nunu, 'nunu-willump', 'receipt');
  assert.match(html, /<html data-champ="nunu-willump" lang="en" data-layout="receipt">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/itemize\.lol\/nunu-willump">/);
  assert.match(html, /id="champ-name" style="--len:14">Nunu &amp; Willump</);
  assert.match(html, /id="r-champ">Nunu &amp; Willump</);
  assert.ok(!html.includes("Kai'Sa"));
});

test('titles and descriptions differ from champion to champion', () => {
  const heads = data.index.map(c => championHead(data.champion(c.id)!, site.slugs.get(c.id)!));
  assert.equal(new Set(heads.map(h => h.title)).size, heads.length);
  assert.equal(new Set(heads.map(h => h.description)).size, heads.length);
});

test('the sitemap lists / and every champion page once', () => {
  const xml = sitemap(site.slugs, data.manifest.builtAt);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>(\d{4}-\d\d-\d\d)<\/lastmod><\/url>/g)].map(m => m[1]!);
  assert.equal(locs.length, data.index.length + 1);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.includes('https://itemize.lol/') && locs.includes('https://itemize.lol/wukong'));
  assert.ok(!xml.includes('&') && !locs.some(l => l.includes('/receipt')));
});

test('the API gives each champion the slug of its page', async () => {
  const champs = await (await createApp(data).request('/api/v1/champions')).json() as { id: string; slug: string }[];
  for (const c of champs) assert.equal(c.slug, site.slugs.get(c.id));
});
