import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseExpr } from '../src/models/parse.ts';
import { checkAnchors } from '../src/pipeline/anchors.ts';
import { autoAbilityModel } from '../src/pipeline/automodel.ts';
import { clean, compileCalc, matchNameCase, nameHash, newLog } from '../src/pipeline/calc.ts';
import { resolveChampion, resolveItem } from '../src/pipeline/models.ts';
import { countBuilds } from '../src/pipeline/popularity.ts';
import { findDamageRefs } from '../src/pipeline/tooltip.ts';
import { Dataset } from '../src/server/dataset.ts';
import { evaluate, formatExpr, type EvalEnv, type Scope } from '../src/shared/expr.ts';
import type { CalcData, Expr } from '../src/shared/types.ts';

const env = (over: Partial<EvalEnv> = {}): EvalEnv => ({
  level: 1, ranged: false, stat: () => 0, scope: () => undefined, variable: () => undefined, stacks: () => 0, itemCount: () => 0,
  unknown: what => { throw new Error(`unknown: ${what}`); }, ...over,
});
const scope = (dv: Record<string, number> = {}): Scope => ({ id: 'test', dv: n => dv[n], eff: () => undefined, calc: () => undefined });

test('floats from the game files are cleaned to what the designer typed', () => {
  assert.equal(clean(0.30000001192092896), 0.3);
  assert.equal(clean(1.100000023841858), 1.1);
  assert.equal(clean(0.0006000000284984708), 0.0006);
  assert.equal(clean(258.75), 258.75);
});

test('game calculations compile: data value + stat x ratio', () => {
  const log = newLog();
  const c = compileCalc({
    __type: 'GameCalculation',
    mFormulaParts: [
      { __type: 'NamedDataValueCalculationPart', mDataValue: 'BaseDamage' },
      { __type: 'StatByNamedDataValueCalculationPart', mStat: 2, mDataValue: 'ADRatio' },
      { __type: 'StatByCoefficientCalculationPart', mCoefficient: 0.5, mStatFormula: 2 },
    ],
    DamageType: 1,
  }, log);
  assert.equal(c.damageType, 'magic');
  assert.equal(formatExpr(c.expr), 'BaseDamage + AD × ADRatio + bonus AP × 0.5');
  const v = evaluate(c.expr, env({ stat: (s, k) => s === 'ad' ? 200 : s === 'ap' && k === 'bonus' ? 100 : 0 }), scope({ BaseDamage: 40, ADRatio: 0.3 }));
  assert.equal(v, 40 + 60 + 50);
  assert.equal(log.unknownParts.size, 0);
});

test('an unknown stat code or part is recorded, never guessed', () => {
  const log = newLog();
  const c = compileCalc({ __type: 'GameCalculation', mFormulaParts: [{ __type: 'StatByCoefficientCalculationPart', mStat: 99, mCoefficient: 1 }, { __type: 'SomethingNew' }] }, log);
  assert.equal(log.unknownStats.get(99), 1);
  assert.equal(log.unknownParts.get('SomethingNew'), 1);
  assert.throws(() => evaluate(c.expr, env(), scope()), /unknown/);
});

test('level breakpoints: "per level at and after" includes the breakpoint level', () => {
  // Kraken Slayer's shape: 150 until level 9, then +5 a level
  const e: Expr = { k: 'breaks', level1: { k: 'num', v: 150 }, perLevel: { k: 'num', v: 0 }, breakpoints: [{ level: 9, perLevel: { k: 'num', v: 5 } }] };
  const at = (level: number) => evaluate(e, env({ level }), scope());
  assert.deepEqual([at(1), at(8), at(9), at(18)], [150, 150, 155, 200]);
  const lerp: Expr = { k: 'lerp', start: { k: 'num', v: 4 }, end: { k: 'num', v: 30 }, curve: 'linear' };
  assert.equal(evaluate(lerp, env({ level: 1 }), scope()), 4);
  assert.equal(evaluate(lerp, env({ level: 18 }), scope()), 30);
});

test('model formulas: precedence, percent literals, functions and name checking', () => {
  const resolve = (path: string[]): Expr => {
    if (path.join('.') === 'target.hpPct') return { k: 'var', name: 'target.hpPct' };
    if (path[0] === 'Base') return { k: 'dv', name: 'Base' };
    throw new Error(`unknown name "${path.join('.')}"`);
  };
  const quoted = () => ({ k: 'num', v: 7 }) as Expr;
  const run = (src: string, hp = 1) => evaluate(parseExpr(src, resolve, quoted), env({ variable: () => hp }), scope({ Base: 100 }));
  assert.equal(run('Base * (1 + (6 - 1) * 25%)'), 225);
  assert.equal(run('2 + 3 * 4 - 6 / 3'), 12);
  assert.equal(run('if(target.hpPct < 40%, Base * 1.2, Base)', 0.3), 120);
  assert.equal(run('if(target.hpPct < 40%, Base * 1.2, Base)', 0.9), 100);
  assert.equal(run('min(Base, 50) + max(1, 2) + floor(2.9)'), 54);
  assert.equal(run("calc('{405deeb1}') + 1"), 8);
  assert.equal(run('-Base + 1'), -99);
  assert.throws(() => run('Bose * 2'), /unknown name "Bose"/);
  assert.throws(() => run('Base +'), /ends early/);
  assert.throws(() => run('Base $ 2'), /unexpected/);
});

test('tooltips: damage tags give type, grouping, section and qualifier', () => {
  const tip = '<spellPassive>Passive:</spellPassive> Attacks deal <magicDamage>@OnHit@ magic damage</magicDamage>.<br><spellActive>Active:</spellActive> Deals <physicalDamage>@Base@ plus @Pct*100@% max Health physical damage</physicalDamage>. Current: <physicalDamage>@f1@/@Cap@ Bonus Attack Damage</physicalDamage>';
  const names = { calc: (n: string) => ['OnHit', 'Base'].find(x => x.toLowerCase() === n.toLowerCase()), dv: (n: string) => ['Pct', 'Cap'].find(x => x.toLowerCase() === n.toLowerCase()) };
  const refs = findDamageRefs(tip, names);
  assert.deepEqual(refs.map(r => [r.ref.name, r.type, r.section, r.group, r.times100]), [
    ['OnHit', 'magic', 'passive', 0, false],
    ['Base', 'physical', 'active', 1, false],
    ['Pct', 'physical', 'active', 1, true],
  ]);
  assert.match(refs[2]!.qualifier, /max health/);
});

const data = new Dataset();

test('format canaries pass on the built dataset', () => {
  const res = checkAnchors((owner, spell, calc) => typeof owner === 'number' ? data.item(owner)?.calcs[calc] : data.champion(owner)?.spells[spell ?? '']?.calcs[calc]);
  assert.deepEqual(res.failed, []);
  assert.ok(res.passed >= 10);
});

test('each shop sells one item per name, and the Rift none of the items Data Dragon misfiles under it', () => {
  const items = new Dataset().items;
  for (const shop of ['sr', 'aram', 'arena'] as const) {
    const names = items.filter(i => i.shops.includes(shop)).map(i => i.name);
    assert.equal(new Set(names).size, names.length, `${shop} lists a name twice`);
  }
  const rift = items.filter(i => i.shops.includes('sr'));
  // six-digit ids are other modes' copies, and Arena's prismatic items under stale ids
  assert.ok(rift.every(i => i.id < 100_000));
  // ARAM's Guardian's items are listed for the Rift as well, and are not sold there
  for (const id of [2051, 3112, 3177, 3184]) assert.deepEqual(items.find(i => i.id === id)?.shops, ['aram']);
  // Arena's copy of a Rift item is its own item
  const ie = items.filter(i => i.name === 'Infinity Edge');
  assert.ok(ie.some(i => i.shops.includes('sr')) && ie.some(i => i.shops.includes('arena') && !i.shops.includes('sr')));
});

test("items carry the shop's roles, what players call them and what the search finds them by", () => {
  const rift = (name: string) => data.items.find(i => i.name === name && i.shops.includes('sr'))!;
  assert.deepEqual(rift("Lord Dominik's Regards").roles, ['Marksman']);
  assert.deepEqual(rift('Thornmail').roles, ['Tank', 'Support']);
  // the upgraded boots are listed under no role in the game files, and take their recipe's
  assert.deepEqual(rift('Gunmetal Greaves').roles, rift("Berserker's Greaves").roles);
  assert.ok(data.items.filter(i => i.shops.includes('sr')).every(i => i.roles.length));
  // Data Dragon's nicknames and ours; none it gets wrong, and none that is a stat word
  assert.ok(rift('Blade of The Ruined King').aliases.includes('bork'));
  assert.ok(rift("Berserker's Greaves").aliases.includes('zerks'));
  assert.ok(!rift('Cull').aliases.includes('dblade') && !rift("Lord Dominik's Regards").aliases.includes('lw'));
  assert.ok(rift('Bloodthirster').aliases.includes('bt') && rift('Void Staff').aliases.includes('vs'));
  assert.ok(!rift("Seeker's Armguard").aliases.includes('zhg') && rift("Zhonya's Hourglass").aliases.includes('zhg'));
  // what an item turns into is a name the search finds it by
  assert.deepEqual(rift('Manamune').forms, ['Muramana']);
  assert.deepEqual(rift("Archangel's Staff").forms, ["Seraph's Embrace"]);
  assert.deepEqual(rift('World Atlas').forms, ['Runic Compass', 'Bounty of Worlds']);
  assert.ok(data.items.every(i => !i.aliases.includes('lethality') && i.aliases.every(a => /^[a-z0-9]{2,}$/.test(a))));
  // anti-heal reads "Grievous Wounds" on some items and "40% Wounds" on others
  assert.deepEqual(data.items.filter(i => i.shops.includes('sr') && i.traits.includes('antiheal')).map(i => i.name).sort(),
    ['Bramble Vest', 'Chempunk Chainsword', "Executioner's Calling", 'Morellonomicon', 'Mortal Reminder', 'Oblivion Orb', 'Thornmail']);
  assert.ok(rift("Sterak's Gage").traits.includes('shield'));
});

test("the built items and champions carry the sampled games' popularity", () => {
  const item = (id: number) => data.item(id)!;
  assert.ok(item(3031).popularity! > 0);
  // a component counts for every build that goes through it: B. F. Sword for each Infinity Edge
  assert.ok(item(1038).popularity! >= item(3031).popularity!);
  const kaisa = data.champion('Kaisa')!.itemPopularity!;
  assert.ok(kaisa.builds >= 20);
  assert.ok(Object.values(kaisa.shares).every(s => s > 0 && s <= 1));
});

test('popularity counts an item for every build that holds it or something built from it', () => {
  // 3 is built from 2 and 1, and 2 from 1; 11 is what 10 turns into
  const dd = { data: { 1: { from: [] }, 2: { from: ['1'] }, 3: { from: ['2', '1'] }, 10: { from: ['1'] }, 11: { specialRecipe: 10, from: ['10'] } } };
  const games = [
    { id: 'a', version: '16.20.5', players: [{ champion: 145, items: [3, 11, 9999] }, { champion: 1, items: [2] }, { champion: 77777, items: [3] }] },
    { id: 'b', version: '16.19.1', skip: 'patch' as const },
  ];
  const n = countBuilds(games, dd, new Map([[145, 'Kaisa'], [1, 'Annie']]));
  assert.equal(n.games, 1);
  assert.equal(n.builds, 2);
  assert.deepEqual(n.versions, { '16.20': 1 });
  assert.deepEqual(n.items, { 1: 2, 2: 2, 3: 1, 10: 1 });
  assert.deepEqual(n.champions.Kaisa, { builds: 1, items: { 1: 1, 2: 1, 3: 1, 10: 1 } });
});

test('automatic models read a stated hit count but refuse to guess one', () => {
  const samira = data.champion('Samira')!;
  const r = autoAbilityModel(samira, 'r');
  assert.equal(r.status, 'auto');
  assert.deepEqual(r.rules[0]!.count, { k: 'num', v: 10 });
  assert.deepEqual(autoAbilityModel(samira, 'w').rules[0]!.count, { k: 'num', v: 2 });
  // "launches N missiles … each dealing": the count is a placeholder and later hits are reduced, so no multiplier
  const kaisaQ = autoAbilityModel(data.champion('Kaisa')!, 'q');
  assert.equal(kaisaQ.rules[0]!.count, undefined);
  // passives are never guessed
  assert.equal(autoAbilityModel(samira, 'p').status, 'unmodeled');
});

test('a calculation naming a data value by its hash finds it', () => {
  assert.equal(nameHash('AbilityDamageRangeMod'), 'd62bdfef');
  const calcs: Record<string, CalcData> = { C: { expr: { k: 'mul', parts: [{ k: 'num', v: 2 }, { k: 'dv', name: `{${nameHash('RangeModifier')}}` }] } } };
  matchNameCase(calcs, () => ({ calcs, dataValues: { RangeModifier: 0.8 } }));
  assert.deepEqual(calcs.C!.expr, { k: 'mul', parts: [{ k: 'num', v: 2 }, { k: 'dv', name: 'RangeModifier' }] });
});

test('an item model gives the user settings: options, counted procs, actives', () => {
  const sheen = data.item(3057)!, { model: _, ...bare } = sheen;
  const src = {
    reviewed: 'x', options: { primed: { label: 'Primed', default: true }, count: { label: 'Count', default: 0, max: 'SpellbladeCooldown * 2' } },
    counters: { blade: { max: 1, start: 'primed' } },
    rules: [
      { id: 'proc', label: 'Spellblade', on: 'onhit' as const, when: 'blade', type: 'physical' as const, amount: 'SpellbladeDamage', procs: true },
      { id: 'zap', label: 'Zap', on: 'use' as const, type: 'magic' as const, amount: 'SpellbladeDamage', uses: 2 },
    ],
  };
  const { model, issues } = resolveItem(bare, src, { champions: {}, items: {} });
  assert.deepEqual(issues, []);
  assert.deepEqual(model.controls!.map(c => [c.id, c.kind, c.max ?? null, c.rule ?? null]),
    [['primed', 'bool', null, null], ['count', 'int', sheen.dataValues.SpellbladeCooldown! * 2, null], ['proc', 'procs', 20, 'proc'], ['zap', 'uses', 20, 'zap']]);
  // a limit can only read the item's data values, and a champion's rules cannot be counted by hand
  assert.match(resolveItem(bare, { ...src, options: { ...src.options, n: { label: 'N', default: 0, max: 'ad' } } }, { champions: {}, items: {} }).issues[0]!.message, /can only use the item's data values/);
  const samira = data.champion('Samira')!;
  const champ = resolveChampion(samira, { reviewed: 'x', q: { hits: [{ type: 'physical', amount: 'DamageCalc', procs: true }] } }, { champions: {}, items: {} });
  assert.match(champ.issues[0]!.message, /only items can have/);
});

test('a model naming something the patch no longer has falls back and is reported', () => {
  const samira = data.champion('Samira')!;
  const res = resolveChampion(samira, { reviewed: 'x', r: { hits: [{ type: 'physical', amount: 'RenamedCalc', count: 10 }] }, q: { hits: [{ type: 'physical', amount: 'DamageCalc' }] } }, { champions: {}, items: {} });
  assert.equal(res.issues.length, 1);
  assert.match(res.issues[0]!.message, /unknown name "RenamedCalc"/);
  assert.equal(res.models.r.status, 'auto');
  assert.equal(res.models.q.status, 'curated');
});

test('a model whose spell changed shape since it was accepted is marked stale', () => {
  const samira = data.champion('Samira')!;
  const src = { reviewed: 'x', r: { hits: [{ type: 'physical' as const, amount: 'DamageCalc', count: 10 }] } };
  const fresh = resolveChampion(samira, src, { champions: {}, items: {} });
  assert.equal(fresh.models.r.status, 'curated');
  const same = resolveChampion(samira, src, { champions: { Samira: { r: fresh.fingerprints.r! } }, items: {} });
  assert.equal(same.models.r.status, 'curated');
  const changed = structuredClone(samira);
  changed.spells.SamiraR!.tooltip = changed.spells.SamiraR!.tooltip!.replace('10 times', '12 times');
  const stale = resolveChampion(changed, src, { champions: { Samira: { r: fresh.fingerprints.r! } }, items: {} });
  assert.equal(stale.models.r.status, 'stale');
  // a pure number change is not a shape change
  const tuned = structuredClone(samira);
  tuned.spells.SamiraR!.dataValues.BaseDamage = [0, 25, 50, 75, 100, 125, 150];
  assert.equal(resolveChampion(tuned, src, { champions: { Samira: { r: fresh.fingerprints.r! } }, items: {} }).models.r.status, 'curated');
});
