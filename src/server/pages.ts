/* The champion pages. /vayne is the tabs page with Vayne already chosen and a head of her own; /receipt/vayne is the
   same in the receipt layout, for visitors who chose that one (layout.js sends them there), and its canonical is /vayne.
   scripts/site.ts writes them as files for Cloudflare, with the sitemap, robots.txt and the redirects of other names;
   the Node server makes the same per request (main.ts). Both call these functions, so the two can't drift. Nothing
   here belongs to Node or to Workers: the API reads the slugs from here too, so that a page can move its address to
   the champion the visitor picks. */
import type { ChampionData } from '../shared/types.ts';
import { CAST_SLOTS } from '../shared/types.ts';

export const ORIGIN = 'https://itemize.lol';
export type Layout = 'tabs' | 'receipt';
export const LAYOUTS: readonly Layout[] = ['tabs', 'receipt'];
/** The page of web/ each layout's champion pages are made from. */
export const SOURCE: Record<Layout, string> = { tabs: 'index.html', receipt: 'receipt.html' };

/** A champion's address: its name in lower case, apostrophes and periods dropped, and every other run of characters
    that are not letters or digits made one hyphen, so that the words stay apart. Kai'Sa is kaisa, Dr. Mundo is
    dr-mundo, Nunu & Willump is nunu-willump. */
export const slugOf = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Addresses the site has other uses for, which no champion or other name may take. */
const RESERVED = new Set(['receipt', 'api', 'art', 'assets', 'fonts', 'og', 'b', 'index', 'sitemap', 'robots', 'favicon']);

export const pagePath = (slug: string, layout: Layout = 'tabs') => layout === 'receipt' ? `/receipt/${slug}` : `/${slug}`;
/** The file that answers a page's address on Cloudflare. Its static assets serve /vayne from vayne.html with a 200
    (html_handling's default, auto-trailing-slash); vayne/index.html would answer /vayne with a redirect to /vayne/. */
const pageFile = (slug: string, layout: Layout) => `${pagePath(slug, layout).slice(1)}.html`;

type Named = { id: string; name: string };

/** Every champion's slug, by champion id. Two champions on one address, or one on an address the site uses itself,
    stop the build rather than leave one of them without a page. */
export function championSlugs(index: readonly Named[]): Map<string, string> {
  const slugs = new Map<string, string>(), owner = new Map<string, string>();
  for (const c of index) {
    const slug = slugOf(c.name);
    if (!slug || RESERVED.has(slug)) throw new Error(`${c.name} can't have the address /${slug}`);
    if (owner.has(slug)) throw new Error(`${c.name} and ${owner.get(slug)} would share the address /${slug}`);
    owner.set(slug, c.name);
    slugs.set(c.id, slug);
  }
  return slugs;
}

/** Names people use that none of the rules in otherNames arrives at. */
const ALSO: Record<string, string[]> = { DrMundo: ['mundo'], JarvanIV: ['jarvan'], Nunu: ['nunu-and-willump'] };

/** Other addresses that lead to a champion's page, with a 301: its Data Dragon id as written and in lower case
    (/MonkeyKing and /monkeyking to /wukong, /Vayne to /vayne), its slug without hyphens (/leesin), its name with the
    apostrophes made hyphens (/kai-sa), and ALSO. Cloudflare matches a redirect's path exactly, case and all, so each
    spelling is a line of its own. A name two champions could claim is left out. */
function otherNames(index: readonly Named[], slugs: Map<string, string>): Map<string, string> {
  const pages = new Set(slugs.values()), out = new Map<string, string>(), torn = new Set<string>();
  for (const c of index) {
    const slug = slugs.get(c.id)!;
    for (const name of new Set([c.id, c.id.toLowerCase(), slug.replaceAll('-', ''), slugOf(c.name.replace(/['’]/g, '-')), ...(ALSO[c.id] ?? [])])) {
      if (!/^[\w-]+$/.test(name) || pages.has(name) || RESERVED.has(name.toLowerCase()) || torn.has(name)) continue;
      const to = pagePath(slug);
      if (out.has(name) && out.get(name) !== to) { out.delete(name); torn.add(name); continue; }
      out.set(name, to);
    }
  }
  return new Map([...out].map(([name, to]) => [`/${name}`, to]));
}

export interface ChampionPage { id: string; slug: string; layout: Layout; path: string; file: string }

/** The site's champion pages, one per champion and layout, and the other names that redirect to them. */
export function championSite(index: readonly Named[]) {
  const slugs = championSlugs(index);
  const pages: ChampionPage[] = index.flatMap(c => LAYOUTS.map(layout => {
    const slug = slugs.get(c.id)!;
    return { id: c.id, slug, layout, path: pagePath(slug, layout), file: pageFile(slug, layout) };
  }));
  return { slugs, pages, redirects: otherNames(index, slugs) };
}

type PageChampion = Pick<ChampionData, 'id' | 'name' | 'title' | 'tags' | 'slots' | 'models'>;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** What a champion's page says about itself in a search result and in a shared link. Searches go "vayne build
    damage", "vayne dps calculator". The description names the champion's title and roles, and the abilities the site
    counts damage for when they fit in what a search result shows (about 160 characters); that also keeps it
    different from every other champion's. */
export function championHead(c: PageChampion, slug: string) {
  // Data Dragon writes "the Night Hunter" and "The Star Forger" alike
  const title = c.title.replace(/^The /, 'the ');
  const roles = c.tags.length ? ` (${c.tags.map(t => t.toLowerCase()).join(', ')})` : '';
  const abilities = CAST_SLOTS.filter(s => c.models[s].rules.length > 0 || c.models[s].status === 'unmodeled').map(s => c.slots[s].name);
  const say = (kit: string) => `Damage calculator for ${c.name}, ${title}${roles}: compare item builds by combo damage${kit}, DPS and time to kill.`;
  const full = say(abilities.length ? ` (${abilities.join(', ')})` : '');
  return {
    title: `${c.name} build damage and DPS calculator`,
    description: full.length <= 160 ? full : say(''),
    url: ORIGIN + pagePath(slug),
    image: `${ORIGIN}/og/${c.id}.png`,
  };
}

/** A champion's page in one layout, made from web/'s page of that layout (as it is, on the Node server, or as
    scripts/site.ts has prepared it): the champion named on <html> for layout.js and app.js, its name and title where
    the page shows them, so that the page never shows the default champion first and a crawler reads whose page it is
    without running it, and a head of its own. Each change must find its place exactly once, so a page that changes
    shape stops the build instead of going out half made. */
export function championPage(html: string, c: PageChampion, slug: string, layout: Layout): string {
  const head = championHead(c, slug);
  const one = (re: RegExp, to: string) => {
    const n = html.match(new RegExp(re.source, 'g'))?.length ?? 0;
    if (n !== 1) throw new Error(`expected one ${re} in the ${layout} page, found ${n}`);
    html = html.replace(re, () => to);
  };
  // the general page's own preview, if it has one, gives way to the champion's
  html = html.replace(/<meta (?:property|name)="(?:og|twitter):[^"]*"[^>]*>\n?/g, '');
  one(/<html\b/, `<html data-champ="${slug}"`);
  one(/<title>[^<]*<\/title>/, `<title>${esc(head.title)} | itemize.lol</title>`);
  one(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(head.description)}">`);
  one(/<link rel="canonical" href="[^"]*">/, [
    `<link rel="canonical" href="${head.url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="itemize.lol">`,
    `<meta property="og:title" content="${esc(head.title)}">`,
    `<meta property="og:description" content="${esc(head.description)}">`,
    `<meta property="og:url" content="${head.url}">`,
    `<meta property="og:image" content="${head.image}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n'));
  // as paintChamp in app.js writes them, --len included (the receipt sizes the name by it)
  one(/id="champ-name"[^>]*>[^<]*/, `id="champ-name" style="--len:${Math.max(5, c.name.length)}">${esc(c.name)}`);
  one(/id="champ-title">[^<]*/, `id="champ-title">${esc(c.title ? c.title[0]!.toUpperCase() + c.title.slice(1) : '')}`);
  // the receipt names the champion twice more
  html = html.replace(/(id="(?:r-champ|raw-champ)">)[^<]*/g, (_, open: string) => open + esc(c.name));
  return html;
}

/** The sitemap: / and every champion's page, as of the dataset's build. */
export function sitemap(slugs: Map<string, string>, builtAt: string): string {
  const day = builtAt.slice(0, 10);
  const urls = ['/', ...[...slugs.values()].sort().map(s => pagePath(s))];
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => `<url><loc>${ORIGIN}${u}</loc><lastmod>${day}</lastmod></url>`), '</urlset>', ''].join('\n');
}

/** Everything may be crawled, /api/v1 included: the pages draw themselves from it, so a crawler that runs them needs it. */
export const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;

/** Cloudflare's _redirects file for the other names. */
export const redirectsFile = (redirects: Map<string, string>) => '# Other names of each champion, to its page. Made by scripts/site.ts (src/server/pages.ts).\n'
  + [...redirects].map(([from, to]) => `${from} ${to} 301\n`).join('');
