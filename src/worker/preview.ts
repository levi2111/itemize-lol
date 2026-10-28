/* Link previews on Cloudflare. A shared build is a short link, /b/<id> (src/server/links.ts), and those addresses
   come to the Worker before the static files (run_worker_first in wrangler.jsonc). It looks the id up in D1, with
   Cloudflare's cache in front, since an id holds the same build forever, and answers with the layout's page, the
   build written into it for the page to open, and a head whose tags state the result (src/server/preview.ts) and
   point at an image of it: /og/b/<version>/<layout>/<s>.png, drawn here (src/og/card.ts) over the champion's card
   that the build made (/og/<id>.png), and kept in Cloudflare's cache. The version names the data and the drawing,
   so an image is never stale under its address. An id that is not there gets the tabs page as it is, with a 404.
   The pages themselves, / and /receipt, are plain static files: a long link (/?s=…) opens its build in the page
   but shows the site's own preview. */
import type { ServedData } from '../server/dataset.ts';
import { LINK_ID, sharedPage, type LinkStore, type StoredLink } from '../server/links.ts';
import { preview, type Meta, type Preview } from '../server/preview.ts';
import { LAYOUT_PATH, decodeShare, readShare, type Layout } from '../server/share.ts';
import { renderCard } from '../og/card.ts';
import type { Fonts } from '../og/font.ts';

export interface Assets { fetch(req: Request | URL | string): Promise<Response> }
export interface PreviewEnv { ASSETS: Assets }
interface Context { waitUntil(p: Promise<unknown>): void }

const SHORT = /^\/b\/([^/]*)$/;
const IMAGE = /^\/og\/b\/([\w-]{1,40})\/([tr])\/([\w-]{1,4096})\.png$/;
/** a rendered image never changes under its address, and neither does what an id holds */
const FOREVER = 'public, max-age=31536000, immutable';
const cacheOf = () => (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;

/** What a link describes, or null when it cannot be read; never throws. */
function describe(data: ServedData, s: string | null, layout: Layout): Preview | null {
  const state = decodeShare(s);
  if (!state) return null;
  try { return preview(data, readShare(data, state, layout)); } catch (err) { console.error('preview', err); return null; }
}

export function previews(data: ServedData, fonts: () => Fonts, version: string, links: (env: PreviewEnv) => LinkStore) {
  /** What an id holds: from the cache, else from the store, and then cached, as it never changes. Throws when the store does. */
  async function lookup(url: URL, id: string, env: PreviewEnv, ctx: Context): Promise<StoredLink | null> {
    const cache = cacheOf(), key = new Request(`${url.origin}/b/${id}.json`);
    const hit = await cache?.match(key);
    if (hit) return await hit.json() as StoredLink;
    const link = await links(env).get(id);
    if (link && cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(link), { headers: { 'content-type': 'application/json', 'cache-control': FOREVER } })));
    return link;
  }

  /** A short link: its layout's page, with its build and a preview of it. */
  async function shared(req: Request, env: PreviewEnv, ctx: Context): Promise<Response> {
    const url = new URL(req.url), id = SHORT.exec(url.pathname)![1]!;
    let link: StoredLink | null = null, status = 404;
    if (LINK_ID.test(id)) try { link = await lookup(url, id, env, ctx); } catch (err) { console.error('links', err); status = 503; }
    const layout = link?.layout ?? 'tabs';
    const res = await env.ASSETS.fetch(new URL(LAYOUT_PATH[layout], url));
    if (res.status !== 200) return res;
    const p = link && describe(data, link.s, layout);
    const tags: Meta | null = p && { title: p.title, url: `${url.origin}/b/${id}`,
      image: `${url.origin}/og/b/${version}/${layout[0]}/${link!.s}.png`, imageAlt: p.imageAlt, color: p.color };
    let html = await res.text();
    try { html = sharedPage(html, link && { id, link }, tags); } catch (err) { console.error('page', err); }
    // the static page's headers, security policy and caching included (a deploy changes what the page points at,
    // so it is revalidated like the page); its ETag and length described other bytes
    const headers = new Headers(res.headers);
    headers.delete('etag'); headers.delete('content-length');
    return new Response(req.method === 'HEAD' ? null : html, { status: link ? 200 : status, headers });
  }

  /** The image for a link: drawn once, then served from the cache. */
  async function image(req: Request, env: PreviewEnv, ctx: Context): Promise<Response> {
    const url = new URL(req.url), m = IMAGE.exec(url.pathname)!;
    const cache = cacheOf();
    const hit = await cache?.match(req);
    if (hit) return hit;
    const asset = async (path: string) => { const r = await env.ASSETS.fetch(new URL(path, url)); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; };
    const p = describe(data, m[3]!, m[2] === 'r' ? 'receipt' : 'tabs');
    let png: Uint8Array | null = null;
    if (p) {
      const ids = [...new Set(p.card.builds.flatMap(b => b.items))];
      const [card, ...pics] = await Promise.all([asset(`/og/${p.card.champion.id}.png`), ...ids.map(id => asset(`/og/items/${id}.bin`))]);
      const icons = new Map(ids.flatMap((id, i) => pics[i] ? [[id, pics[i]!] as const] : []));
      try { png = card && renderCard(card, fonts(), p.card, icons); } catch (err) { console.error('card', err); }
    }
    // a link that cannot be read, or a champion without a card, shows the site's own poster for a day
    const body = png ?? await asset('/og/default.jpg');
    if (!body) return new Response('not found', { status: 404 });
    const res = new Response(req.method === 'HEAD' ? null : body as Uint8Array<ArrayBuffer>, { headers: {
      'content-type': png ? 'image/png' : 'image/jpeg', 'content-length': String(body.length), 'cache-control': png ? FOREVER : 'public, max-age=86400',
      'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'cross-origin',
    } });
    if (cache && req.method === 'GET') ctx.waitUntil(cache.put(req, res.clone()));
    return res;
  }

  /** Answers what is a preview's to answer, or returns null for the API to. */
  return (req: Request, env: PreviewEnv, ctx: Context): Promise<Response> | null => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return null;
    const path = new URL(req.url).pathname;
    if (SHORT.test(path)) return shared(req, env, ctx);
    if (IMAGE.test(path)) return image(req, env, ctx);
    return null;
  };
}
