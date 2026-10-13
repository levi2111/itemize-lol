/* npm start. Configuration is by environment:
     PORT                 default 8787
     ITEMIZE_PATCH        serve this compiled patch instead of the latest
     ITEMIZE_DATA_DIR     where data/ lives, default ./data
     CALC_PER_MINUTE      per-client limit on POST /api/v1/calc, default 240, 0 = off
     TRUST_PROXY=1        take the client address from X-Forwarded-For (only behind your own proxy) */
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { join, relative } from 'node:path';
import { ROOT } from '../pipeline/paths.ts';
import { createApp } from './app.ts';
import { Dataset } from './dataset.ts';

const data = new Dataset(process.env.ITEMIZE_PATCH);
const trustProxy = process.env.TRUST_PROXY === '1';
const app = createApp(data, {
  calcPerMinute: Number(process.env.CALC_PER_MINUTE ?? 240),
  clientAddress: c => (trustProxy && c.req.header('x-forwarded-for')?.split(',')[0]?.trim()) || getConnInfo(c).remote.address,
});
// everything that is not the API is the static site in web/; a page answers without its .html, as on Cloudflare
app.use('/*', serveStatic({
  root: relative(process.cwd(), join(ROOT, 'web')) || '.',
  rewriteRequestPath: path => path === '/receipt' ? '/receipt.html' : path,
}));
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, info => {
  const m = data.manifest;
  console.log(`itemize.lol on http://localhost:${info.port}  patch ${m.displayPatch} (${m.patch}), ${m.champions} champions, ${m.items} items`);
});
