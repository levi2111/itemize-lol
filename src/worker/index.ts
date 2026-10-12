/* The Cloudflare Worker. It answers /api/v1; the site in web/ is served by Cloudflare's static
   assets before a request ever reaches this code, with the headers in web/_headers. */
import { createApp } from '../server/app.ts';
import type { ChampionIndexEntry, ServedData } from '../server/dataset.ts';
import type { ChampionData, DatasetManifest, ItemData } from '../shared/types.ts';
import text from './data.gen.txt';

interface Env {
  /** the rate limit declared in wrangler.jsonc */
  CALC_LIMIT: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

// parsed once per isolate, as it starts, so no request pays for it
const bundle: { patch: string; manifest: DatasetManifest; index: ChampionIndexEntry[]; items: ItemData[]; champions: Record<string, ChampionData> } = JSON.parse(text);
const ids = new Map(bundle.index.map(c => [c.id.toLowerCase(), c.id]));
const itemById = new Map(bundle.items.map(i => [i.id, i]));
const data: ServedData = {
  patch: bundle.patch, manifest: bundle.manifest, index: bundle.index, items: bundle.items,
  champion: id => bundle.champions[ids.get(String(id).toLowerCase()) ?? ''],
  item: id => itemById.get(id),
};

export default createApp(data, {
  calcGate: async c => (await (c.env as Env).CALC_LIMIT.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' })).success,
});
