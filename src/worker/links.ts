/* The Worker's short links (src/server/links.ts) in Cloudflare D1, the LINKS binding in wrangler.jsonc. The table is
   made by migrations/ (wrangler d1 migrations apply). */
import { today, type LinkStore, type StoredLink } from '../server/links.ts';

/** The little of D1's API used here. */
export interface D1 {
  prepare(sql: string): { bind(...values: unknown[]): D1Statement };
}
interface D1Statement {
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}

export function d1Links(db: D1): LinkStore {
  const get = async (id: string) => {
    const r = await db.prepare('SELECT layout, state AS s FROM links WHERE id = ?1').bind(id).first<StoredLink>();
    return r ? { layout: r.layout, s: r.s } : null;
  };
  return {
    get,
    add: async (id, link) => {
      const r = await db.prepare('INSERT INTO links (id, layout, state, created) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (id) DO NOTHING')
        .bind(id, link.layout, link.s, today()).run();
      // a new row is the link itself; otherwise the id was taken, by this link or another
      return r.meta.changes ? link : (await get(id))!;
    },
  };
}
