import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayPatch } from '../src/pipeline/build.ts';
import { newLog } from '../src/pipeline/calc.ts';
import { compileItems } from '../src/pipeline/items.ts';
import { notesIn } from '../src/pipeline/notes.ts';
import { createApp } from '../src/server/app.ts';
import { Dataset, loadPatches } from '../src/server/dataset.ts';
import { engineData } from '../src/server/engine-files.ts';
import { isPreview, majorMinor, previewId, servedPatches } from '../src/shared/patch.ts';
import { readBundle } from '../src/worker/data.ts';

test('a preview is named after the patch it previews, and reads as it', () => {
  const id = previewId('16.22.8331392+branch.main.content.beta');
  assert.equal(id, '16.22-pbe');
  assert.ok(isPreview(id));
  assert.ok(!isPreview('16.21.1'));
  assert.equal(majorMinor(id), '16.22');
  assert.equal(displayPatch(id), '26.22');
  assert.equal(displayPatch('16.21.1'), '26.21');
});

test('the site serves the live patch, the newest before it, and a preview only of a later patch', () => {
  const kinds = (compiled: string[], live: string) => servedPatches(compiled, live).map(p => `${p.kind} ${p.patch}`);
  assert.deepEqual(kinds(['16.19.1', '16.20.1', '16.21.1', '16.22-pbe'], '16.21.1'), ['preview 16.22-pbe', 'live 16.21.1', 'previous 16.20.1']);
  // the preview of a patch that is out is not one any more
  assert.deepEqual(kinds(['16.21.1', '16.22.1', '16.22-pbe'], '16.22.1'), ['live 16.22.1', 'previous 16.21.1']);
  // patch 10 comes after patch 9
  assert.deepEqual(kinds(['16.9.1', '16.10.1'], '16.10.1'), ['live 16.10.1', 'previous 16.9.1']);
  assert.deepEqual(kinds(['16.21.1'], '16.21.1'), ['live 16.21.1']);
});

test("Riot's patch notes are found by the patch's name, and not by a longer one", () => {
  const page = '<a href="/en-us/news/game-updates/league-of-legends-patch-26-21-notes">26.21</a>'
    + '<a href="https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-2-notes/">26.2</a>';
  assert.equal(notesIn(page, '26.21'), 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-21-notes');
  assert.equal(notesIn(page, '26.2'), 'https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-2-notes/');
  assert.equal(notesIn(page, '26.22'), null);
  assert.equal(notesIn(page.replace('26-2-notes', '26-25-notes'), '26.2'), null);
});

test("an item's price comes from the game files, its recipe's added in", () => {
  const dd = {
    data: {
      1001: { name: 'Part', gold: { total: 300, purchasable: true }, maps: { 11: true }, into: ['3001'], tags: [] },
      3001: { name: 'Whole', gold: { total: 1000, purchasable: true }, maps: { 11: true }, from: ['1001'], tags: [] },
    },
  };
  const bin = {
    'Items/1001': { __type: 'ItemData', itemID: 1001, price: 350 },
    'Items/3001': { __type: 'ItemData', itemID: 3001, price: 800, recipeItemLinks: ['Items/1001', 'Items/1001'] },
  };
  const { items, warnings } = compileItems(dd, bin, {}, newLog());
  assert.deepEqual(items.map(i => [i.id, i.gold]), [[1001, 350], [3001, 1500]]);
  assert.ok(warnings.some(w => /3001 Whole: Data Dragon gold=1000 but game data has 1500/.test(w)));
});

test('the engine files are addressed by patch', () => {
  assert.deepEqual(engineData('data/16.21.1/items.json'), { patch: '16.21.1', items: true });
  assert.deepEqual(engineData('data/16.22-pbe/champions/Ahri.json'), { patch: '16.22-pbe', champion: 'Ahri' });
  assert.equal(engineData('data/items.json'), null);
  assert.equal(engineData('data/../../secret/items.json'), null);
});

test("the Worker's bundle reads each patch, and a champion when first asked for", () => {
  const live = new Dataset(), ids = live.index.slice(0, 3);
  const head = (patch: string, kind: string) => JSON.stringify({ patch, kind, manifest: live.manifest, index: ids, items: live.items.slice(0, 2) });
  const text = [head('16.30-pbe', 'preview'), ...ids.map(c => JSON.stringify(live.champion(c.id))), head(live.patch, 'live'), ...ids.map(c => JSON.stringify(live.champion(c.id)))].join('\n');
  const set = readBundle(text);
  assert.equal(set.live.patch, live.patch);
  assert.deepEqual(set.all.map(p => p.kind), ['preview', 'live']);
  const other = set.get('16.30-pbe')!;
  assert.equal(other.champion(ids[2]!.id.toUpperCase())?.id, ids[2]!.id);
  assert.equal(other.champion('nobody'), undefined);
  assert.equal(other.item(live.items[0]!.id)?.id, live.items[0]!.id);
});

test('the API serves every patch served, by its id, and the live one without', async () => {
  const patches = loadPatches(), app = createApp(patches);
  const get = (path: string) => app.request(`/api/v1${path}`);
  const meta = await (await get('/meta')).json() as any;
  assert.equal(meta.patch, patches.live.patch);
  assert.equal(meta.live, patches.live.patch);
  assert.deepEqual(meta.patches.map((p: any) => p.patch), patches.all.map(p => p.data.patch));
  assert.equal(meta.patches.filter((p: any) => p.kind === 'live').length, 1);
  for (const { data, kind } of patches.all) {
    const q = kind === 'live' ? '' : `?patch=${data.patch}`;
    assert.equal((await (await get(`/items${q}`)).json() as any[]).length, data.items.length);
    assert.equal((await (await get(`/champions/Kaisa${q}`)).json() as any).id, 'Kaisa');
    const res = await app.request('/api/v1/calc', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patch: data.patch, champion: 'Kaisa', level: 13, builds: [{ items: [] }], combo: { counts: { aa: 3 } } }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json() as any).patch, data.patch);
  }
  assert.equal((await get('/items?patch=15.1.1')).status, 404);
  assert.equal((await get('/champions/Kaisa/target?level=3&patch=nope')).status, 404);
  const wrong = await app.request('/api/v1/calc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patch: 'nope', champion: 'Kaisa', builds: [{}] }) });
  assert.equal(wrong.status, 404);
});
