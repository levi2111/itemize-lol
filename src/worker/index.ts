/* The Cloudflare Worker. It answers /api/v1, and the link previews of shared builds (preview.ts): the
   two pages when their address carries a build, and the images of builds. The rest of the site in
   web/ is served by Cloudflare's static assets before a request ever reaches this code, with the
   headers in web/_headers. */
import type { ExecutionContext } from 'hono';
import { createApp } from '../server/app.ts';
import type { ChampionIndexEntry, ServedData } from '../server/dataset.ts';
import type { ChampionData, DatasetManifest, ItemData } from '../shared/types.ts';
import { readAtlas, type Fonts } from '../og/font.ts';
import { previews, type PreviewEnv } from './preview.ts';
import text from '../../.build/data.txt';
import glyphs from '../../.build/glyphs.bin';
import version from '../../.build/og-version.txt';

interface Env extends PreviewEnv {
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
// the glyphs are read when the first image is drawn, so the API's requests never pay for them
let fonts: Fonts | null = null;
const preview = previews(data, () => fonts ??= readAtlas(new Uint8Array(glyphs)), version.trim());

const app = createApp(data, {
  calcGate: async c => (await (c.env as Env).CALC_LIMIT.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' })).success,
});

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    preview(req, env, ctx) ?? app.fetch(req, env, ctx),
};
