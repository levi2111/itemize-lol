/* Short links: their ids, what POST /api/v1/links takes, the stores, and the page a link opens. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../src/server/app.ts';
import { Dataset } from '../src/server/dataset.ts';
import { createLink, LINK_ID, linkIds, memoryLinks, readLinkBody, sharedPage, type LinkStore } from '../src/server/links.ts';
import { metaTags, siteMeta } from '../src/server/preview.ts';
import { sqliteLinks } from '../src/server/sqlite-links.ts';

const data = new Dataset();
const pack = (s: unknown) => Buffer.from(JSON.stringify(s), 'utf8').toString('base64url');
const S = pack({ c: 'Vayne', l: 11, a: [3153, 3006], m: 0 });
const post = (app: ReturnType<typeof createApp>, body: unknown) => app.request('http://localhost:8787/api/v1/links', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('an id is made from the build and its layout: 7 base62 characters, then longer ones', async () => {
  const ids = await linkIds({ layout: 'tabs', s: S });
  assert.deepEqual(ids.map(i => i.length), [7, 8, 9, 10, 11, 12]);
  for (const id of ids) assert.match(id, LINK_ID);
  ids.forEach((id, i) => assert.ok(i === 0 || id.startsWith(ids[i - 1]!), 'each is the one before and a character more'));
  assert.deepEqual(await linkIds({ layout: 'tabs', s: S }), ids);
  assert.notEqual((await linkIds({ layout: 'receipt', s: S }))[0], ids[0]);
  assert.notEqual((await linkIds({ layout: 'tabs', s: pack({ c: 'Vayne', l: 12 }) }))[0], ids[0]);
});

test('only a build the page can open is taken', () => {
  assert.deepEqual(readLinkBody({ s: S, layout: 'receipt' }), { layout: 'receipt', s: S });
  for (const bad of [null, 'text', [], { s: S }, { s: S, layout: 'grid' }, { layout: 'tabs' }, { s: 5, layout: 'tabs' },
    { s: '', layout: 'tabs' }, { s: 'not base64!', layout: 'tabs' }, { s: pack([1, 2]), layout: 'tabs' }, { s: 'A'.repeat(5000), layout: 'tabs' }])
    assert.equal(typeof readLinkBody(bad), 'string', JSON.stringify(bad)?.slice(0, 40));
});

test('the same build gets the same id; an id another build holds is lengthened', async () => {
  const store = memoryLinks(), link = { layout: 'tabs' as const, s: S };
  const id = await createLink(store, link);
  assert.equal(id, (await linkIds(link))[0]);
  assert.equal(await createLink(store, link), id);
  assert.equal(store.size(), 1);
  const taken = memoryLinks(), [short, longer] = await linkIds(link);
  await taken.add(short!, { layout: 'tabs', s: pack({ c: 'Ahri' }) });
  assert.equal(await createLink(taken, link), longer);
  assert.deepEqual(await taken.get(longer!), link);
  assert.equal(await createLink(taken, link), longer, 'and keeps it');
});

test('the SQLite store keeps links across opens, and never overwrites one', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'itemize-links-')), file = join(dir, 'links.sqlite');
  try {
    const a = sqliteLinks(file);
    assert.equal(await a.get('abcdefg'), null);
    assert.deepEqual(await a.add('abcdefg', { layout: 'receipt', s: S }), { layout: 'receipt', s: S });
    assert.deepEqual(await a.add('abcdefg', { layout: 'tabs', s: 'other' }), { layout: 'receipt', s: S }, 'the first stays');
    a.close();
    const b = sqliteLinks(file);              // the migration is not applied twice
    assert.deepEqual(await b.get('abcdefg'), { layout: 'receipt', s: S });
    b.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('POST /links answers with the link, and refuses what it cannot keep', async () => {
  const store = memoryLinks(), app = createApp(data, { links: () => store, linksPerMinute: 2 });
  const res = await post(app, { s: S, layout: 'tabs' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const j = await res.json() as { id: string; url: string };
  assert.match(j.id, /^[0-9A-Za-z]{7}$/);
  assert.equal(j.url, `http://localhost:8787/b/${j.id}`);
  assert.deepEqual(await store.get(j.id), { layout: 'tabs', s: S });
  assert.equal((await post(app, { s: 'x', layout: 'tabs' })).status, 400);
  assert.equal((await post(app, '{')).status, 429, 'the third in a minute');

  const fresh = () => createApp(data, { links: () => store });
  assert.equal((await post(fresh(), '{')).status, 400);
  assert.equal((await post(fresh(), { s: 'A'.repeat(9000), layout: 'tabs' })).status, 413);
  assert.equal((await post(createApp(data), { s: S, layout: 'tabs' })).status, 503, 'no store');
  const broken: LinkStore = { get: async () => { throw new Error('down'); }, add: async () => { throw new Error('D1 is over its daily limit'); } };
  const err = console.error; console.error = () => {};
  try { assert.equal((await post(createApp(data, { links: () => broken }), { s: S, layout: 'tabs' })).status, 503); } finally { console.error = err; }
});

test('a short link\'s page carries the build ahead of layout.js, and the build\'s preview', () => {
  const page = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const link = { layout: 'tabs' as const, s: S };
  const tags = { ...siteMeta('/'), title: 'Vayne · <Kraken> build', url: 'https://itemize.lol/b/abcdefg' };
  const html = sharedPage(page, { id: 'abcdefg', link }, tags);
  const at = html.indexOf('<script type="application/json" id="shared-build">');
  assert.ok(at > 0 && at < html.indexOf('<script src="/layout.js">'), 'before layout.js, which reads it');
  assert.deepEqual(JSON.parse(/id="shared-build">([^<]*)</.exec(html)![1]!), { id: 'abcdefg', layout: 'tabs', s: S });
  assert.ok(html.includes(metaTags(tags)));
  assert.ok(!html.includes(metaTags(siteMeta('/'))), 'the site\'s own tags are gone');
  assert.equal(html.match(/property="og:title"/g)!.length, 1);
  assert.match(html, /<title>Vayne · &lt;Kraken&gt; build · itemize\.lol<\/title>/);
  // a name in the data cannot close the element
  const hostile = sharedPage(page, { id: 'abcdefg', link: { layout: 'tabs', s: '</script><script>alert(1)' } }, null);
  assert.ok(!hostile.includes('</script><script>alert'));
  assert.ok(hostile.includes(metaTags(siteMeta('/'))), 'without tags the site\'s stay');
  // as scripts/site.ts names the scripts
  assert.match(sharedPage(page.replace('/layout.js', '/assets/layout.5f332ce111.js'), { id: 'abcdefg', link }, null), /id="shared-build">.*\n<script src="\/assets\/layout\./);
  assert.throws(() => sharedPage('<html></html>', { id: 'abcdefg', link }, null));
});
