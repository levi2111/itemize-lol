/* The HTTP API: everything under /api/v1, all JSON. This file runs unchanged on Node (main.ts)
   and on Cloudflare Workers (worker/index.ts), so it imports nothing that belongs to either. */
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { calculate, championAsTarget } from '../engine/calc.ts';
import { CalcError, type CalcResult, type TargetInput } from '../engine/types.ts';
import type { ChampionData, ItemData, Slot } from '../shared/types.ts';
import { SLOTS } from '../shared/types.ts';
import type { ServedData } from './dataset.ts';
import { createLink, readLinkBody, type LinkStore } from './links.ts';
import { championSlugs } from './pages.ts';

/** Riot requires this wording, readily visible, on every product that uses its assets. */
export const LEGAL = 'itemize.lol isn\'t endorsed by Riot Games and doesn\'t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.';

export interface AppOptions {
  /** requests per minute per client on POST /calc; 0 turns the limit off */
  calcPerMinute?: number;
  /** the client's address, the key for that limit; without one every client shares a single allowance */
  clientAddress?: (c: Context) => string | undefined;
  /** a limiter kept outside this process, used instead of calcPerMinute; resolves false to refuse */
  calcGate?: (c: Context) => Promise<boolean>;
  /** where short links are kept (links.ts); without it POST /links answers 503 and the page shares a long link */
  links?: (c: Context) => LinkStore | undefined;
  /** requests per minute per client on POST /links; 0 turns the limit off */
  linksPerMinute?: number;
  /** as calcGate, for POST /links */
  linkGate?: (c: Context) => Promise<boolean>;
}

/** At most two builds are compared, as in the UI. */
const MAX_BUILDS = 2;

const championView = (c: ChampionData) => ({
  id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags, ranged: c.ranged, resource: c.resource, stats: c.stats,
  slots: Object.fromEntries(SLOTS.map((s: Slot) => {
    const m = c.models[s];
    return [s, { name: c.slots[s].name, icon: c.slots[s].icon, maxRank: c.slots[s].maxRank, status: m.status, damaging: m.rules.length > 0 || m.status === 'unmodeled', notes: m.notes }];
  })),
  options: c.options.map(o => ({ id: o.id, label: o.label, kind: o.kind, ...(o.min !== undefined && { min: o.min }), ...(o.max !== undefined && { max: o.max }) })),
  // what this champion's players build, for the item picker's order
  ...(c.itemPopularity && { itemPopularity: c.itemPopularity }),
});
const itemView = (i: ItemData) => ({
  id: i.id, name: i.name, gold: i.gold, tags: i.tags, plaintext: i.plaintext, shops: i.shops, component: i.component, stats: i.stats,
  roles: i.roles, aliases: i.aliases, forms: i.forms, traits: i.traits, popularity: i.popularity ?? 0,
  status: i.model.status, notes: i.model.notes,
  // what a page can let the user set about the item; defaults depend on the build, so a calculation reports them
  controls: (i.model.controls ?? []).map(c => ({
    id: c.id, label: c.label, kind: c.kind, ...(c.min !== undefined && { min: c.min }), ...(c.max !== undefined && { max: c.max }), ...(c.rule && { rule: c.rule }),
  })),
  effects: i.model.rules.filter(r => r.label && !(r.amount.k === 'num' && r.amount.v === 0)).map(r => ({ id: r.id, label: r.label, type: r.type })),
});

function fixedWindow(perMinute: number) {
  const seen = new Map<string, { n: number; reset: number }>();
  return (key: string, now = Date.now()): { ok: boolean; retryAfter: number } => {
    if (seen.size > 50_000) for (const [k, v] of seen) if (v.reset <= now) seen.delete(k);
    let e = seen.get(key);
    if (!e || e.reset <= now) seen.set(key, e = { n: 0, reset: now + 60_000 });
    e.n++;
    return { ok: e.n <= perMinute, retryAfter: Math.ceil((e.reset - now) / 1000) };
  };
}

export function createApp(data: ServedData, opts: AppOptions = {}) {
  const app = new Hono();
  const etag = `"${data.manifest.patch}-${Date.parse(data.manifest.builtAt).toString(36)}"`;
  const limit = opts.calcPerMinute ? fixedWindow(opts.calcPerMinute) : undefined;
  const linkLimit = opts.linksPerMinute ? fixedWindow(opts.linksPerMinute) : undefined;
  const refuse = (c: Context, retryAfter: number) => { c.header('Retry-After', String(retryAfter)); return c.json({ error: { message: 'too many requests' } }, 429); };

  app.use(secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      // art and fonts are the site's own files; the only outside script is Cloudflare Web Analytics,
      // which counts page views without cookies and reports them to cloudflareinsights.com
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://static.cloudflareinsights.com'],
      connectSrc: ["'self'", 'https://cloudflareinsights.com'],
      frameAncestors: ["'none'"],
    },
  }));

  const api = new Hono();

  /** Static data changes only when a new dataset is built, so it is cached hard and revalidated by ETag. */
  const cached = (c: Context, body: unknown) => {
    c.header('ETag', etag);
    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    if (c.req.header('If-None-Match') === etag) return c.body(null, 304);
    return c.json(body as object);
  };

  const meta = { ...data.manifest, legal: LEGAL };
  // each with the address of its page (/vayne), which the page moves to when that champion is chosen
  const slugs = championSlugs(data.index);
  const champions = data.index.map(c => ({ ...c, slug: slugs.get(c.id) }));
  const items = data.items.map(itemView);

  api.get('/meta', c => cached(c, meta));
  api.get('/champions', c => cached(c, champions));
  api.get('/items', c => cached(c, items));
  api.get('/champions/:id', c => {
    const champ = data.champion(c.req.param('id'));
    return champ ? cached(c, championView(champ)) : c.json({ error: { message: 'no such champion' } }, 404);
  });
  api.get('/champions/:id/target', c => {
    const champ = data.champion(c.req.param('id'));
    if (!champ) return c.json({ error: { message: 'no such champion' } }, 404);
    const level = Math.round(Number(c.req.query('level') ?? 1));
    if (!(level >= 1 && level <= 18)) return c.json({ error: { field: 'level', message: 'level must be between 1 and 18' } }, 400);
    return cached(c, championAsTarget(champ, level));
  });

  api.post('/calc', bodyLimit({ maxSize: 16 * 1024 }), async c => {
    const gate = opts.calcGate ? { ok: await opts.calcGate(c), retryAfter: 60 } : limit?.(opts.clientAddress?.(c) || 'unknown');
    if (gate && !gate.ok) return refuse(c, gate.retryAfter);
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: { message: 'body must be JSON' } }, 400); }
    try {
      if (!body || typeof body !== 'object') throw new CalcError('body', 'body must be an object');
      const builds: unknown = body.builds;
      if (!Array.isArray(builds) || builds.length < 1 || builds.length > MAX_BUILDS) throw new CalcError('builds', `builds must list 1 to ${MAX_BUILDS} builds`);

      let target: TargetInput | null = null;
      const t = body.target;
      if (t !== null && t !== undefined) {
        if (typeof t !== 'object') throw new CalcError('target', 'target must be an object or null');
        if (typeof t.champion === 'string') {
          const enemy = data.champion(t.champion);
          if (!enemy) throw new CalcError('target.champion', `unknown champion "${t.champion}"`);
          const level = Math.round(Number(t.level ?? 1));
          if (!(level >= 1 && level <= 18)) throw new CalcError('target.level', 'target.level must be between 1 and 18');
          // explicit numbers win over the champion's own, so the UI's dials can override them
          target = { ...championAsTarget(enemy, level), ...(typeof t.hp === 'number' && { hp: t.hp }), ...(typeof t.armor === 'number' && { armor: t.armor }), ...(typeof t.mr === 'number' && { mr: t.mr }), ...(typeof t.bonusHp === 'number' && { bonusHp: t.bonusHp }) };
        } else target = t as TargetInput;
      }

      const results: CalcResult[] = builds.map((b: any, i: number) => {
        if (!b || typeof b !== 'object') throw new CalcError(`builds[${i}]`, 'each build must be an object');
        // a build's own ranks, when it has them, replace the shared ones
        return calculate(data, {
          build: { champion: body.champion, level: body.level, ranks: b.ranks ?? body.ranks ?? {}, options: body.options, items: b.items ?? [], itemOptions: b.itemOptions },
          target, combo: body.combo ?? {},
        });
      });
      c.header('Cache-Control', 'no-store');
      return c.json({ patch: data.patch, target, results });
    } catch (err) {
      if (err instanceof CalcError) return c.json({ error: { field: err.field, message: err.message } }, 400);
      throw err;
    }
  });

  /* A short link for a build: { s, layout } in, { id, url } out, the same id for the same build every time.
     Each one is a row written, so it has a limit of its own, well under the calculation's: sharing is a click,
     not something a page does as it is used. */
  api.post('/links', bodyLimit({ maxSize: 8 * 1024 }), async c => {
    const gate = opts.linkGate ? { ok: await opts.linkGate(c), retryAfter: 60 } : linkLimit?.(opts.clientAddress?.(c) || 'unknown');
    if (gate && !gate.ok) return refuse(c, gate.retryAfter);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: { message: 'body must be JSON' } }, 400); }
    const link = readLinkBody(body);
    if (typeof link === 'string') return c.json({ error: { message: link } }, 400);
    const store = opts.links?.(c);
    c.header('Cache-Control', 'no-store');
    if (!store) return c.json({ error: { message: 'short links are not available' } }, 503);
    let id: string;
    // the store being down or full (D1 refuses writes past its daily allowance) leaves the page its long link
    try { id = await createLink(store, link); } catch (err) { console.error('links', err); return c.json({ error: { message: 'could not store the link' } }, 503); }
    return c.json({ id, url: `${new URL(c.req.url).origin}/b/${id}` });
  });

  api.notFound(c => c.json({ error: { message: 'not found' } }, 404));
  app.route('/api/v1', api);

  app.onError((err, c) => {
    // thrown by middleware with a ready-made response, e.g. 413 from the body limit
    if (err instanceof HTTPException) return c.json({ error: { message: err.message || 'request refused' } }, err.status);
    console.error(err);
    return c.json({ error: { message: 'internal error' } }, 500);
  });

  return app;
}
