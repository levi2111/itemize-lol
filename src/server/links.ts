/* Short share links: itemize.lol/b/x7Kq2Pa instead of a page address carrying the whole build in `?s=`.
   The share button posts the build (encodeState's string) and its layout to POST /api/v1/links, which stores
   them under an id and answers with the link; /b/<id> then serves that layout's page with the build in it
   and a link preview of its own. Where the links are kept is a LinkStore: Cloudflare D1 on the Worker
   (src/worker/links.ts), node:sqlite on the Node server (sqlite-links.ts), a Map in tests. The table is
   migrations/0001_links.sql. Nothing here belongs to Node or to Workers. */
import { metaTags, type Meta } from './preview.ts';
import { decodeShare, MAX_LINK, type Layout } from './share.ts';

export interface StoredLink { layout: Layout; s: string }
export interface LinkStore {
  get(id: string): Promise<StoredLink | null>;
  /** Stores the link under `id` unless the id is taken; resolves to what the id holds afterwards. */
  add(id: string, link: StoredLink): Promise<StoredLink>;
}

/** What an id looks like; anything else is not looked up. */
export const LINK_ID = /^[0-9A-Za-z]{7,12}$/;
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** The ids a link may have, shortest first: base62 digits of a hash of the layout and the build, 7 of them and
    then one more at a time. The same build always asks for the same id, so the table dedupes itself; a longer
    one is only taken when a different build already holds the shorter (with 62^7, 3.5 trillion ids, that
    starts to happen around a million links). */
export async function linkIds(link: StoredLink): Promise<string[]> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${link.layout}\n${link.s}`)));
  let n = hash.slice(0, 16).reduce((v, b) => v << 8n | BigInt(b), 0n), digits = '';
  for (let i = 0; i < 12; i++, n /= 62n) digits += DIGITS[Number(n % 62n)];
  return [7, 8, 9, 10, 11, 12].map(k => digits.slice(0, k));
}

/** The body of POST /api/v1/links read, or what is wrong with it. `s` must be a build the page can open: the
    same reader as the link previews', with the same size limit. */
export function readLinkBody(body: unknown): StoredLink | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const { s, layout } = body as Record<string, unknown>;
  if (layout !== 'tabs' && layout !== 'receipt') return 'layout must be "tabs" or "receipt"';
  if (typeof s !== 'string' || !s) return 's must be a build link\'s state';
  if (s.length > MAX_LINK) return `s must be at most ${MAX_LINK} characters`;
  if (!decodeShare(s)) return 's is not a build';
  return { layout, s };
}

/** Stores a link and resolves to its id. */
export async function createLink(store: LinkStore, link: StoredLink): Promise<string> {
  for (const id of await linkIds(link)) {
    const held = await store.add(id, link);
    if (held.layout === link.layout && held.s === link.s) return id;
  }
  throw new Error('every id for this link is taken');
}

/** A store in memory, for tests. */
export function memoryLinks(): LinkStore & { size(): number } {
  const m = new Map<string, StoredLink>();
  return {
    get: async id => m.get(id) ?? null,
    add: async (id, link) => { if (!m.has(id)) m.set(id, { ...link }); return m.get(id)!; },
    size: () => m.size,
  };
}

/** The day a link is made, all that is kept of when. */
export const today = () => new Date().toISOString().slice(0, 10);

/** A short link's page: the layout's page as it is served (the Worker's static file, or web/'s on Node) with the build
    written into it for app.js to open (brought() reads #shared-build), ahead of layout.js, which hands it on when the
    visitor prefers the other layout. With `tags`, the head's preview is the build's instead of the site's. Each change
    must find its place exactly once, so a page that changes shape fails loudly instead of going out half made. */
export function sharedPage(html: string, shared: { id: string; link: StoredLink } | null, tags: Meta | null): string {
  const one = (re: RegExp, to: string | ((found: string) => string)) => {
    const n = html.match(new RegExp(re.source, 'g'))?.length ?? 0;
    if (n !== 1) throw new Error(`expected one ${re} in the page, found ${n}`);
    html = html.replace(re, typeof to === 'string' ? () => to : to);
  };
  if (tags) {
    html = html.replace(/<meta (?:property|name)="(?:og:[^"]*|twitter:[^"]*|theme-color)"[^>]*>\n?/g, '');
    const attr = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    one(/<title>[^<]*<\/title>/, `<title>${attr(tags.title)} · itemize.lol</title>`);
    // without a description of its own the page's is dropped too, or Discord would show the site's in its place
    one(/<meta name="description" content="[^"]*">/, (tags.description ? `<meta name="description" content="${attr(tags.description)}">\n` : '') + metaTags(tags));
  }
  if (shared) {
    // "<" is escaped so that nothing in the data can close the element, as with the art index (scripts/site.ts)
    const json = JSON.stringify({ id: shared.id, layout: shared.link.layout, s: shared.link.s }).replaceAll('<', '\\u003c');
    one(/<script src="\/(?:assets\/)?layout[\w.]*\.js"><\/script>/, m => `<script type="application/json" id="shared-build">${json}</script>\n${m}`);
  }
  return html;
}
