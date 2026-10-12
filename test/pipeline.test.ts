import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseExpr } from '../src/models/parse.ts';
import { checkAnchors } from '../src/pipeline/anchors.ts';
import { autoAbilityModel } from '../src/pipeline/automodel.ts';
import { clean, compileCalc, newLog } from '../src/pipeline/calc.ts';
import { resolveChampion } from '../src/pipeline/models.ts';
import { findDamageRefs } from '../src/pipeline/tooltip.ts';
import { Dataset } from '../src/server/dataset.ts';
import { evaluate, formatExpr, type EvalEnv, type Scope } from '../src/shared/expr.ts';
import type { Expr } from '../src/shared/types.ts';

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
