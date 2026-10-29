/* Auto-build tests against the compiled dataset: the search keeps to its limits and the game's rules, scores
   builds as the engine does, and the browser gets the engine as plain JavaScript. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoBuild, builtBy, effectiveHealth, finished, type AutoBuildRequest } from '../src/autobuild/search.ts';
import { buildStats, calculate, championAsTarget, comboDamage, fightDps, sustainedDps } from '../src/engine/calc.ts';
import type { CalcRequest } from '../src/engine/types.ts';
import { Dataset } from '../src/server/dataset.ts';
import { ENGINE_ENTRY, engineData, engineModules } from '../src/server/engine-files.ts';
import type { ItemData } from '../src/shared/types.ts';

const data = new Dataset();
const target = championAsTarget(data.champion('Ornn')!, 13);
const ask = (over: Partial<AutoBuildRequest>): AutoBuildRequest => ({
  build: { champion: 'Kaisa', level: 13, ranks: { q: 5, w: 1, e: 5, r: 2 }, items: [] },
  target, combo: { counts: { aa: 3, q: 1, w: 1, e: 1, r: 1 } },
  goal: 'burst', limit: { gold: 6000 }, keep: [], never: [], ...over,
});
const item = (name: string) => data.items.find(i => i.name === name && i.shops.includes('sr'))!;
const items = (ids: number[]) => ids.map(id => data.item(id)!);
/** No group holds more of its items than the game allows. */
const legal = (set: ItemData[]) => {
  const held = new Map<string, number>();
  for (const it of set) for (const [g, cap] of Object.entries(it.limits)) { held.set(g, (held.get(g) ?? 0) + 1); if (held.get(g)! > cap) return false; }
  return true;
};

test('item limits come from the game files: one pair of boots, one Last Whisper item', () => {
  assert.equal(item("Berserker's Greaves").limits.Boots, 1);
  assert.equal(item('Plated Steelcaps').limits.Boots, 1);
  assert.equal(item("Lord Dominik's Regards").limits.LastWhisper, 1);
  assert.equal(item('Mortal Reminder').limits.LastWhisper, 1);
  assert.ok(!legal([item("Berserker's Greaves"), item('Plated Steelcaps')]));
  assert.ok(legal([item('Long Sword'), item('Long Sword')]));
});

test('quick measures are the numbers a full calculation reports', () => {
  const req: CalcRequest = { build: { champion: 'Kaisa', level: 13, ranks: { q: 5, w: 1, e: 5, r: 2 }, items: [item('Infinity Edge').id, item('Kraken Slayer').id] }, target, combo: { counts: { aa: 3, q: 1, w: 1 } } };
  const full = calculate(data, req);
  assert.ok(Math.abs(comboDamage(data, req) - full.combo.total.dealt) < 0.01);
  assert.ok(Math.abs(sustainedDps(data, req) - full.dps.dealt) < 0.01);
  assert.ok(Math.abs(fightDps(data, req) - full.fight.dps.dealt) < 0.01);
  assert.ok(Math.abs(buildStats(data, req).hp.total - full.stats.hp.total) < 0.01);
});

test('DPS is the fight\'s, abilities included, and a pool of what the champion\'s players build', () => {
  const syndra = { champion: 'Syndra', level: 13, ranks: { q: 5, w: 5, e: 1, r: 2 }, items: [] };
  const theirs = builtBy(data.champion('Syndra'))!;
  assert.ok(theirs.size >= 8 && theirs.has(item("Rabadon's Deathcap").id));
  const built = autoBuild(data, data.items, ask({ goal: 'dps', build: syndra, limit: { items: 3 }, pool: 'built' }));
  assert.equal(built.pool, 'built');
  for (const b of built.builds) {
    assert.ok(b.items.every(id => theirs.has(id)), 'only what Syndra players build');
    assert.ok(Math.abs(b.score - fightDps(data, { build: { ...syndra, items: b.items }, target, combo: ask({}).combo })) < 0.01);
  }
  const any = autoBuild(data, data.items, ask({ goal: 'dps', build: syndra, limit: { items: 3 }, pool: 'any' }));
  assert.equal(any.pool, 'any');
  assert.ok(any.allowed > built.allowed);
  // a champion without a sample, or with too few of its items for the slots, falls back to any item
  assert.equal(builtBy({ ...data.champion('Syndra')!, itemPopularity: { builds: 5, shares: {} } }), null);
});

test('a gold limit: every build fits in it, keeps the rules, and beats an empty build', () => {
  const r = autoBuild(data, data.items, ask({ limit: { gold: 6000 } }));
  assert.equal(r.problem, null);
  assert.ok(r.builds.length >= 1 && r.builds.length <= 3);
  for (const b of r.builds) {
    const set = items(b.items);
    assert.ok(b.gold <= 6000, `${b.gold} gold is over the limit`);
    assert.equal(b.gold, set.reduce((s, it) => s + it.gold, 0));
    assert.ok(set.length <= 6 && legal(set));
    assert.ok(b.score > r.base);
    // the score is the engine's own number for that build
    assert.ok(Math.abs(b.score - comboDamage(data, { build: { ...ask({}).build, items: b.items }, target, combo: ask({}).combo })) < 0.01);
  }
  assert.ok(r.builds.every((b, i) => i === 0 || r.builds[i - 1]!.score >= b.score), 'best first');
});

test('an item count: exactly that many finished items, boots only if allowed', () => {
  for (const boots of [true, false]) {
    const r = autoBuild(data, data.items, ask({ goal: 'dps', limit: { items: 4 }, boots }));
    for (const b of r.builds) {
      const set = items(b.items);
      assert.equal(set.length, 4);
      assert.ok(set.every(finished) && legal(set));
      if (!boots) assert.ok(!set.some(it => it.tags.includes('Boots')));
    }
  }
});

test('kept items stay and count toward the gold; never-used items are left out', () => {
  const ie = item('Infinity Edge').id, kraken = item('Kraken Slayer').id;
  const r = autoBuild(data, data.items, ask({ limit: { gold: 7000 }, keep: [ie], never: [kraken] }));
  for (const b of r.builds) {
    assert.equal(b.items[0], ie);
    assert.ok(!b.items.includes(kraken));
    assert.ok(b.gold <= 7000);
  }
  const over = autoBuild(data, data.items, ask({ limit: { gold: 2000 }, keep: [ie] }));
  assert.equal(over.builds.length, 0);
  assert.match(over.problem!, /more than the gold/);
});

test('six open slots are too many to score one by one: the result says it is the best found', () => {
  const r = autoBuild(data, data.items, ask({ limit: { items: 6 } }));
  assert.equal(r.exact, false);
  assert.ok(r.scored < 5000, `${r.scored} builds scored`);
  assert.equal(r.builds[0]!.items.length, 6);
});

test('tankiness is effective health against the damage split', () => {
  const stats = { hp: { total: 2000 }, armor: { total: 100 }, mr: { total: 0 } };
  assert.equal(effectiveHealth(stats, { physical: 1, magic: 0, true: 0 }), 4000);
  assert.equal(effectiveHealth(stats, { physical: 0, magic: 1, true: 0 }), 2000);
  assert.equal(effectiveHealth(stats, { physical: 0.5, magic: 0.5, true: 0 }), 2000 / 0.75);
  const r = autoBuild(data, data.items, ask({ goal: 'tank', build: { champion: 'Ornn', level: 13, ranks: { q: 5, w: 5, e: 1, r: 2 }, items: [] }, limit: { gold: 6000 } }));
  for (const b of r.builds) assert.ok(items(b.items).some(it => (it.stats.hp ?? 0) > 0 || (it.stats.armor ?? 0) > 0 || (it.stats.mr ?? 0) > 0));
});

test('the browser gets the worker and what it imports as JavaScript, beside the data', () => {
  const mods = engineModules();
  assert.ok(mods.has(ENGINE_ENTRY));
  for (const p of ['autobuild/search.js', 'engine/calc.js', 'engine/sim.js', 'shared/expr.js', 'shared/types.js']) assert.ok(mods.has(p), p);
  for (const [p, code] of mods) {
    assert.ok(!/from\s*['"][^'"]+\.ts['"]/.test(code), `${p} still imports a .ts file`);
    assert.ok(!/^\s*(export\s+)?(interface|type)\s+\w+/m.test(code), `${p} still has types`);
  }
  assert.deepEqual(engineData('data/items.json'), { items: true });
  assert.deepEqual(engineData('data/champions/Kaisa.json'), { champion: 'Kaisa' });
  assert.equal(engineData('data/champions/../../package.json'), null);
  assert.equal(engineData('data/../package.json'), null);
});
