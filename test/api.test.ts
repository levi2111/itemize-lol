import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp, LEGAL } from '../src/server/app.ts';
import { Dataset } from '../src/server/dataset.ts';

const data = new Dataset();
const app = createApp(data);
const get = (path: string, headers?: Record<string, string>) => app.request(`/api/v1${path}`, { headers });
const calc = (body: unknown, a = app) => a.request('/api/v1/calc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const KAISA = { champion: 'Kaisa', level: 13, ranks: { q: 5, w: 1, e: 5, r: 2 }, combo: { counts: { aa: 3, q: 1, w: 1 } } };

test('meta carries the patch and Riot\'s required notice', async () => {
  const j = await (await get('/meta')).json() as any;
  assert.equal(j.patch, data.patch);
  assert.equal(j.legal, LEGAL);
  assert.match(j.legal, /isn't endorsed by Riot Games/);
});

test('lists are cached and revalidate by ETag', async () => {
  const res = await get('/items');
  assert.equal(res.status, 200);
  const etag = res.headers.get('etag')!;
  assert.match(res.headers.get('cache-control')!, /max-age/);
  assert.equal((await get('/items', { 'if-none-match': etag })).status, 304);
  const champs = await (await get('/champions')).json() as any[];
  assert.equal(champs.length, data.index.length);
});

test('a champion view exposes the kit and model status, not game internals', async () => {
  const j = await (await get('/champions/kaisa')).json() as any;
  assert.equal(j.id, 'Kaisa');
  assert.equal(j.slots.q.status, 'curated');
  assert.equal(j.slots.e.damaging, false);
  assert.equal(j.spells, undefined);
  assert.equal(JSON.stringify(j).includes('tooltip'), false);
  assert.equal((await get('/champions/nobody')).status, 404);
});

test('target stats for an enemy champion', async () => {
  const j = await (await get('/champions/Ornn/target?level=13')).json() as any;
  assert.ok(j.hp > 1000 && j.armor > 50 && j.mr > 30);
  assert.equal((await get('/champions/Ornn/target?level=40')).status, 400);
});

test('calc compares up to two builds against the same target', async () => {
  const res = await calc({ ...KAISA, builds: [{ items: [6672, 3006, 3124, 3115, null, null] }, { items: [6655, 3020, 3115, 4645] }], target: { hp: 2400, armor: 80, mr: 50 } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const j = await res.json() as any;
  assert.equal(j.results.length, 2);
  assert.ok(j.results[0].dps.dealt > j.results[1].dps.dealt, 'the on-hit build out-sustains the burst build');
  assert.ok(j.results[0].combo.total.dealt < j.results[0].combo.total.raw);
});

test('a build can bring its own ranks; the others use the shared ones', async () => {
  const items = [6672, 3006];
  const j = await (await calc({ ...KAISA, builds: [{ items }, { items, ranks: { q: 1, w: 5, e: 5, r: 2 } }], target: { hp: 2400, armor: 80, mr: 50 } })).json() as any;
  const q = (r: any) => r.combo.lines.find((l: any) => l.key === 'q').total.dealt;
  assert.ok(q(j.results[0]) > q(j.results[1]), 'rank 5 Q out-damages rank 1 Q');
  const same = await (await calc({ ...KAISA, builds: [{ items }, { items }], target: { hp: 2400, armor: 80, mr: 50 } })).json() as any;
  assert.deepEqual(same.results[0].combo.total, same.results[1].combo.total);
});

test('items list what a page can let the user set, and a build takes it as itemOptions', async () => {
  const items = await (await get('/items')).json() as any[];
  const sheen = items.find(i => i.id === 3057);
  assert.deepEqual(sheen.controls.map((c: any) => [c.id, c.kind, c.rule]), [['spellblade', 'procs', 'spellblade']]);
  assert.deepEqual(sheen.effects.map((e: any) => e.label), ['Spellblade']);
  const j = await (await calc({ ...KAISA, builds: [{ items: [3057], itemOptions: { 3057: { spellblade: 2 } } }], target: null })).json() as any;
  assert.equal(j.results[0].items[0].settings.spellblade, 2);
  assert.equal(j.results[0].items[0].effects[0].fired, 2);
  assert.equal((await calc({ ...KAISA, builds: [{ items: [3057], itemOptions: { 3057: { nope: 1 } } }], target: null })).status, 400);
});

test('items say which shops sell them', async () => {
  const items = await (await get('/items')).json() as any[];
  const byId = new Map(items.map(i => [i.id, i]));
  assert.ok(byId.get(3031).shops.includes('sr'));
  assert.ok(items.every(i => Array.isArray(i.shops) && i.shops.length));
  assert.ok(items.some(i => i.shops.includes('aram') && !i.shops.includes('sr')));
  assert.ok(items.some(i => i.shops.includes('arena') && !i.shops.includes('sr')));
});

test('calc accepts an enemy champion as the target, with overrides', async () => {
  const j = await (await calc({ ...KAISA, builds: [{ items: [] }], target: { champion: 'Ornn', level: 13, armor: 200 } })).json() as any;
  assert.equal(j.target.armor, 200);
  assert.ok(j.target.hp > 1000);
  const raw = await (await calc({ ...KAISA, builds: [{ items: [] }], target: null })).json() as any;
  assert.equal(raw.target, null);
  assert.equal(raw.results[0].combo.total.raw, raw.results[0].combo.total.dealt);
});

test('calc rejects bad input with 400 and never touches the file system with it', async () => {
  for (const body of [
    'not json',
    { ...KAISA, builds: [] },
    { ...KAISA, builds: [{}, {}, {}] },
    { ...KAISA, champion: '../../package', builds: [{}] },
    { ...KAISA, level: 'x', builds: [{}] },
    { ...KAISA, builds: [{ items: [123456789] }] },
    { ...KAISA, builds: [{}], target: { champion: 'Nope' } },
  ]) assert.equal((await calc(body)).status, 400, JSON.stringify(body));
  assert.equal((await calc('x'.repeat(40_000))).status, 413);
});

test('calc is rate limited per client', async () => {
  const limited = createApp(data, { calcPerMinute: 3 });
  const codes: number[] = [];
  for (let i = 0; i < 5; i++) codes.push((await calc({ ...KAISA, builds: [{}] }, limited)).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});
