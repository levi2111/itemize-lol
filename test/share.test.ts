/* Share links read on the server: each case is a link as the page writes it and the request the page
   then sends (web/app.js: encodeState, applyState, loadKit, recalc), worked out by hand from that code. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, championAsTarget, headline } from '../src/engine/calc.ts';
import { Dataset } from '../src/server/dataset.ts';
import { clean, preview } from '../src/server/preview.ts';
import { decodeShare, linkParam, readShare } from '../src/server/share.ts';

const data = new Dataset();
/** encodeState's packing: JSON, UTF-8, base64url without padding. */
const pack = (s: unknown) => Buffer.from(JSON.stringify(s), 'utf8').toString('base64url');
const read = (s: unknown, layout: 'tabs' | 'receipt' = 'tabs') => readShare(data, decodeShare(pack(s))!, layout);
/** What the page's share button writes for its opening state, Kai'Sa's two builds. */
const PAGE = {
  c: 'Kaisa', l: 13, r: [5, 1, 5, 2], o: 'qew', a: [6672, 3006, 3124, 3115, null, null], b: [6655, 3020, 3115, 4645, null, null],
  n: ['On-hit', 'AP burst'], m: 1, t: 'dummy', d: { hp: 2400, ar: 80, mr: 50 }, e: ['Ornn', 13], q: [3, 1, 1, 0, 0],
};

test('links decode as the page decodes them, and nothing else does', () => {
  assert.deepEqual(decodeShare(pack({ c: 'Vayne' })), { c: 'Vayne' });
  assert.deepEqual(decodeShare(pack({ n: ['Kraken ⚔ Slayer'] })), { n: ['Kraken ⚔ Slayer'] });
  for (const bad of ['', '!!!', 'e30=', pack([1, 2]), pack(5), pack(null), pack('text'),
    Buffer.from([0xff, 0xfe, 0x7b, 0x7d]).toString('base64url'),                 // not UTF-8
    Buffer.from('﻿{}', 'utf8').toString('base64url'),                       // a BOM, which JSON.parse refuses on the page
    'A'.repeat(5000)]) assert.equal(decodeShare(bad), null, bad.slice(0, 20));
  assert.equal(linkParam('?s=abc_-9&x=1'), 'abc_-9');
  assert.equal(linkParam('?x=1&s=abc'), 'abc');
  assert.equal(linkParam('?xs=abc'), null);
});

test('the page\'s own link asks for exactly what the page asks for', () => {
  const sb = read(PAGE);
  assert.deepEqual(sb.body, {
    champion: 'Kaisa', level: 13, ranks: { q: 5, w: 1, e: 5, r: 2 }, options: {},
    builds: [{ items: [6672, 3006, 3124, 3115] }, { items: [6655, 3020, 3115, 4645] }],
    target: { dummy: true, hp: 2400, armor: 80, mr: 50 }, combo: { counts: { aa: 3, q: 1, w: 1, e: 0, r: 0 }, crits: 'average' },
  });
  assert.equal(sb.requests.length, 2);
  assert.deepEqual(sb.requests[1]!.build, { champion: 'Kaisa', level: 13, ranks: { q: 5, w: 1, e: 5, r: 2 }, options: {}, items: [6655, 3020, 3115, 4645], itemOptions: undefined });
  assert.deepEqual(sb.builds.map(b => [b.name, b.typed]), [['On-hit', false], ['AP burst', false]]);
});

test('one build, an enemy champion, raw output', () => {
  const one = read({ ...PAGE, c: 'Vayne', m: 0, n: ['Kraken', 'x'] });
  assert.equal(one.body.builds.length, 1);
  assert.deepEqual(one.builds.map(b => [b.name, b.typed]), [['Kraken', true]]);
  const enemy = read({ ...PAGE, t: 'champ', e: ['Ornn', 9], d: { hp: 9999, ar: 1, mr: 1 } });
  // the dials are refilled with the enemy's own stats when they arrive, so the link's numbers are not used
  assert.deepEqual(enemy.body.target, { champion: 'Ornn', level: 9, ...championAsTarget(data.champion('Ornn')!, 9) });
  assert.equal(enemy.target.kind, 'champ');
  assert.equal(read({ ...PAGE, t: 'raw' }).body.target, null);
  // an unknown enemy leaves the page's Ornn at level 13
  assert.deepEqual(read({ ...PAGE, t: 'champ', e: ['Nobody', 4] }).body.target, { champion: 'Ornn', level: 13, ...championAsTarget(data.champion('Ornn')!, 13) });
});

test('values are clamped and defaulted as applyState does', () => {
  const sb = read({ c: 'Vayne', l: 40, r: [9, '2', null, 'x'], a: [6672, '3006', 999999, 3124.5, 3031], m: 0, d: { hp: 0, ar: -5, mr: 'x' }, q: [99, -1, 2] });
  assert.equal(sb.level, 18);
  // 9 is cut to 6 by the link's reader and to the kit's 5 once the kit loads; null and "2" count as numbers
  assert.deepEqual(sb.body.ranks, { q: 5, w: 2, e: 0, r: 0 });
  assert.deepEqual(sb.body.builds[0]!.items, [6672, 3031]);
  assert.deepEqual(sb.body.target, { dummy: true, hp: 1, armor: 0, mr: 50 });
  assert.deepEqual(sb.body.combo.counts, { aa: 30, q: 0, w: 2, e: 0, r: 0 });
  // a link without a champion or builds: Kai'Sa, empty, one build, the page's own names and combo
  const bare = read({});
  assert.equal(bare.champion.id, 'Kaisa');
  assert.deepEqual(bare.body.builds, [{ items: [] }]);
  assert.deepEqual(bare.body.combo.counts, { aa: 3, q: 1, w: 1, e: 0, r: 0 });
  assert.equal(bare.builds[0]!.name, 'On-hit');
});

test('options, item settings, crits and ranks per build', () => {
  const s = {
    ...PAGE, c: 'Kindred', x: { marks: 4.6, dance: true, bogus: 3, bites: 'x' },
    a: [6672, 3161, 3124], b: [3078, 6672], k: 'always', rb: [1, 5, 5, 3], ob: 'wqe',
    io: { a: { 6672: { attacks: 2.4, nope: 1 }, 3161: { stacks: 'x' }, 3078: { spellblade: 2 } }, b: { 3078: { spellblade: 3 }, 9: { x: 1 } } },
  };
  const tabs = read(s);
  assert.deepEqual(tabs.body.options, { marks: 5, dance: 1 });
  // A holds no Trinity Force, so its setting is dropped; a setting that is not a number never arrives
  assert.deepEqual(tabs.body.builds[0]!.itemOptions, { 6672: { attacks: 2 } });
  assert.deepEqual(tabs.body.builds[1]!.itemOptions, { 3078: { spellblade: 3 } });
  assert.equal(tabs.body.combo.crits, 'always');
  assert.deepEqual(tabs.body.builds[1]!.ranks, { q: 1, w: 5, e: 5, r: 3 });
  assert.deepEqual(tabs.requests[1]!.build.ranks, { q: 1, w: 5, e: 5, r: 3 });
  // the receipt shows one set of ranks and no crits switch
  const receipt = read(s, 'receipt');
  assert.equal(receipt.body.combo.crits, 'average');
  assert.equal(receipt.body.builds[1]!.ranks, undefined);
  assert.deepEqual(receipt.requests[1]!.build.ranks, receipt.body.ranks);
  // and the mirrored request is one the engine takes
  for (const r of [...tabs.requests, ...receipt.requests]) calculate(data, r);
});

test('a headline is the calculation\'s own numbers', () => {
  for (const r of [...read(PAGE).requests, ...read({ ...PAGE, t: 'raw', k: 'never' }).requests, ...read({ ...PAGE, c: 'Vayne', t: 'champ', e: ['Garen', 18] }).requests]) {
    const full = calculate(data, r), h = headline(data, r);
    assert.deepEqual(h, { combo: { total: full.combo.total, hpLeft: full.combo.hpLeft, kills: full.combo.kills }, dps: full.dps, timeToKill: full.timeToKill });
  }
});

test('preview says only what it is: the champion and a comparison or one build; the card names the builds', () => {
  const sb = read({ ...PAGE, c: 'Vayne', a: [6672, 3006, 3124], b: [3153, 3006, 3124], q: [3, 1, 0, 1, 0] });
  const p = preview(data, sb);
  assert.equal(p.title, 'Vayne · Build comparison');
  const [a, b] = p.card.builds;
  assert.deepEqual([a!.name, b!.name], ['Kraken Slayer', 'Blade of The Ruined King']);
  assert.equal(p.card.lead!.key, a!.total > b!.total ? 'a' : 'b');
  // typed names win, and are tidied
  const typed = preview(data, read({ ...PAGE, n: ['  Burst‮  build ', 'AP burst'] }));
  assert.equal(typed.card.builds[0]!.name, 'Burst build');
  // the page's default name is not taken for one written by hand: B is named by the first item only it has
  assert.equal(typed.card.builds[1]!.name, 'Luden\'s Echo');
  const one = preview(data, read({ ...PAGE, m: 0, t: 'raw' }));
  assert.equal(one.title, 'Kai\'Sa · Build damage');
  assert.equal(one.card.builds[0]!.name, 'Kraken Slayer build');
  assert.equal(clean('x'.repeat(50)).length, 40);
});

test('a hostile link is read without throwing, and what it says is tidied', () => {
  const odd = [
    { c: {}, l: 'x', r: 'abc', a: 'x', b: { 0: 1 }, n: [{}, null], m: 'yes', t: 'champ', d: 5, e: 'x', q: {}, x: [], io: 5, k: 7, rb: 'x' },
    { c: '__proto__', a: [null, -1, 1e308, NaN], io: { a: { __proto__: { x: 1 } }, b: [] }, x: { constructor: 1, toString: 2 } },
    { n: ['<script>alert(1)</script>\u0000‮', '\n\n'.repeat(30)], m: 1, d: { hp: 1e12, ar: -1e12, mr: Infinity } },
  ];
  for (const s of odd) {
    const p = preview(data, read(s));
    assert.ok(p.title.length < 200 && !/[\u0000-\u001f‮]/.test(p.title + p.card.builds.map(b => b.name).join('')), p.title);
  }
  assert.equal(preview(data, read(odd[2])).card.builds[0]!.name, '<script>alert(1)</script>');
});
