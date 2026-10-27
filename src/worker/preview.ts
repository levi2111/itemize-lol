/* Link previews on Cloudflare. A shared build is a link to one of the two pages with the build in its
   query, /?s=… or /receipt?s=…, and those two addresses come to the Worker before the static files
   (run_worker_first in wrangler.jsonc). Without `s` a page is passed through as it is. With one, the
   page's head gets tags that state the result (src/server/preview.ts) and point at an image of it:
   /og/b/<version>/<layout>/<s>.png, drawn here (src/og/card.ts) over the champion's card that the build
   made (/og/<id>.png), and kept in Cloudflare's cache. The version names the data and the drawing, so
   an image is never stale under its address. A link that cannot be read gets the site's own preview. */
import type { ServedData } from '../server/dataset.ts';
import { metaTags, preview, type Preview } from '../server/preview.ts';
import { LAYOUT_PATH, decodeShare, linkParam, readShare, type Layout } from '../server/share.ts';
import { renderCard } from '../og/card.ts';
import type { Fonts } from '../og/font.ts';

export interface Assets { fetch(req: Request | URL | string): Promise<Response> }
export interface PreviewEnv { ASSETS: Assets }
interface Context { waitUntil(p: Promise<unknown>): void }

const LAYOUTS: Record<string, Layout> = { '/': 'tabs', '/receipt': 'receipt' };
const IMAGE = /^\/og\/b\/([\w-]{1,40})\/([tr])\/([\w-]{1,4096})\.png$/;
/** a rendered image never changes under its address */
const FOREVER = 'public, max-age=31536000, immutable';

/** What a link describes, or null when it cannot be read; never throws. */
function describe(data: ServedData, s: string | null, layout: Layout): Preview | null {
  const state = decodeShare(s);
  if (!state) return null;
  try { return preview(data, readShare(data, state, layout)); } catch (err) { console.error('preview', err); return null; }
}

export function previews(data: ServedData, fonts: () => Fonts, version: string) {
  /** A page, with tags describing the build in its link. */
  async function page(req: Request, env: PreviewEnv): Promise<Response> {
    const url = new URL(req.url), layout = LAYOUTS[url.pathname]!;
    const res = await env.ASSETS.fetch(req);
    const s = linkParam(url.search);
    if (!s || res.status !== 200 || !res.headers.get('content-type')?.includes('text/html')) return res;
    const p = describe(data, s, layout);
    if (!p) return res;
    const link = `${url.origin}${LAYOUT_PATH[layout]}?s=${s}`;
    const tags = metaTags({ title: p.title, description: p.description, url: link, image: `${url.origin}/og/b/${version}/${layout[0]}/${s}.png`, imageAlt: p.imageAlt, color: p.color });
    const out = new HTMLRewriter()
      .on('meta[property^="og:"], meta[name^="twitter:"], meta[name="theme-color"]', { element: e => e.remove() })
      .on('meta[name="description"]', { element: e => { e.setAttribute('content', p.description); e.after(tags, { html: true }); } })
      .on('title', { element: e => e.setInnerContent(`${p.title} · itemize.lol`) })
      .transform(res);
    // the static page's headers, security policy and caching included; its ETag described other bytes
    const headers = new Headers(out.headers);
    headers.delete('etag'); headers.delete('content-length');
    return new Response(out.body, { status: 200, headers });
  }

  /** The image for a link: drawn once, then served from the cache. */
  async function image(req: Request, env: PreviewEnv, ctx: Context): Promise<Response> {
    const url = new URL(req.url), m = IMAGE.exec(url.pathname)!;
    const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
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
    // a link that cannot be read, or a champion without a card, shows the site's own card for a day
    const body = png ?? await asset('/og/default.png');
    if (!body) return new Response('not found', { status: 404 });
    const res = new Response(req.method === 'HEAD' ? null : body as Uint8Array<ArrayBuffer>, { headers: {
      'content-type': 'image/png', 'content-length': String(body.length), 'cache-control': png ? FOREVER : 'public, max-age=86400',
      'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'cross-origin',
    } });
    if (cache && req.method === 'GET') ctx.waitUntil(cache.put(req, res.clone()));
    return res;
  }

  /** Answers what is a preview's to answer, or returns null for the API to. */
  return (req: Request, env: PreviewEnv, ctx: Context): Promise<Response> | null => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return null;
    const path = new URL(req.url).pathname;
    if (path in LAYOUTS) return page(req, env);
    if (IMAGE.test(path)) return image(req, env, ctx);
    return null;
  };
}
