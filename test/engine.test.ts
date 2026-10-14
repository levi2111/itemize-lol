/* Engine tests against the compiled dataset. Expected values are derived in the
   test from the dataset's own numbers, so a balance patch does not break them;
   what they pin down is how the numbers are combined. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, championAsTarget } from '../src/engine/calc.ts';
import { damageMultiplier, defaultSequence, resistAfterPen } from '../src/engine/sim.ts';
import { CalcError, type CalcRequest } from '../src/engine/types.ts';
import { Dataset } from '../src/server/dataset.ts';
import { growth } from '../src/shared/expr.ts';

const data = new Dataset();
const near = (a: number, b: number, eps = 0.02) => assert.ok(Math.abs(a - b) <= eps, `${a} should be within ${eps} of ${b}`);
const req = (over: Partial<CalcRequest['build']>, combo: CalcRequest['combo'], target: CalcRequest['target'] = null): CalcRequest => ({
  build: { champion: 'Samira', level: 13, ranks: { q: 5, w: 1, e: 5, r: 2 }, items: [], ...over }, target, combo,
});
const line = (res: ReturnType<typeof calculate>, key: string) => res.combo.lines.find(l => l.key === key)!;

test('mitigation: resistances, penetration order and negative armor', () => {
  near(damageMultiplier(100), 0.5, 1e-9);
  near(damageMultiplier(0), 1, 1e-9);
  near(damageMultiplier(-25), 1.2, 1e-9);
  // percent first, then flat; never below zero; nothing happens to a target already at or below zero
  near(resistAfterPen(100, 0.35, 18), 47, 1e-9);
  assert.equal(resistAfterPen(10, 0, 50), 0);
  assert.equal(resistAfterPen(-12, 0.4, 20), -12);
});

test('level growth matches the published formula', () => {
  assert.equal(growth(1), 0);
  near(growth(18), 17, 1e-9);
  near(growth(13), 12 * (0.7025 + 0.0175 * 12), 1e-9);
});

test('default combo order weaves autos between casts', () => {
  assert.deepEqual(defaultSequence({ aa: 3, q: 1, w: 1 }), ['aa', 'q', 'aa', 'w', 'aa']);
  assert.deepEqual(defaultSequence({ q: 2, r: 1 }), ['q', 'q', 'r']);
});

test('Samira R: ten shots of the per-shot calculation', () => {
  const samira = data.champion('Samira')!;
  const r = samira.spells.SamiraR!;
  const ad = samira.stats.ad + samira.stats.adPerLevel * growth(13);
  const perShot = r.dataValues.BaseDamage![2]! + r.dataValues.ADRatio![2]! * ad;

  const raw = calculate(data, req({}, { counts: { r: 1 } }));
  near(raw.combo.total.raw, 10 * perShot);
  assert.equal(line(raw, 'r').parts[0]!.hits, 10);

  const vsArmor = calculate(data, req({}, { counts: { r: 1 } }, { hp: 5000, armor: 100, mr: 0 }));
  near(vsArmor.combo.total.dealt, 10 * perShot / 2);
  near(vsArmor.combo.blocked, 10 * perShot / 2);
  near(vsArmor.combo.hpLeft!, 5000 - 10 * perShot / 2);
});

test('basic attacks use crit-chance-weighted damage and crit damage from items', () => {
  const ie = data.item(3031)!;
  const res = calculate(data, req({ items: [3031] }, { counts: { aa: 1 } }));
  const s = res.stats;
  near(s.critChance, ie.stats.critChance!, 1e-6);
  near(s.critDamage, data.champion('Samira')!.stats.critDamage + ie.stats.critDamage!, 1e-6);
  near(res.combo.total.raw, s.ad.total * (1 + s.critChance * (s.critDamage - 1)));
});

test('crits: the combo counts them at the average, never or always; sustained damage stays on the average', () => {
  const build = { champion: 'Yasuo', level: 11, ranks: { q: 5, w: 1, e: 3, r: 2 }, items: [3031, 3072, 3006] };
  const run = (crits?: 'average' | 'never' | 'always') => calculate(data, { build, target: { hp: 2400, armor: 80, mr: 50 }, combo: { counts: { aa: 3, q: 2, e: 1 }, crits } });
  const avg = run(), never = run('never'), always = run('always');
  assert.equal(avg.combo.crits, 'average');
  assert.ok(never.combo.total.dealt < avg.combo.total.dealt && avg.combo.total.dealt < always.combo.total.dealt);
  assert.deepEqual(never.dps, avg.dps);
  assert.deepEqual(always.timeToKill, avg.timeToKill);
  // the autos: ad, ad x crit damage, and between them by the chance
  const s = avg.stats, aa = line(avg, 'aa');
  near(aa.crits!.never.raw, 3 * s.ad.total);
  near(aa.crits!.always.raw, 3 * s.ad.total * s.critDamage);
  near(aa.crits!.average.raw, aa.total.raw);
  // every line that can crit reports all three, whichever way the combo counted; the rest report none
  assert.deepEqual(line(never, 'q').crits, line(avg, 'q').crits);
  assert.equal(line(always, 'q').total.raw, line(avg, 'q').crits!.always.raw);
  assert.equal(line(avg, 'e').crits, undefined);
  assert.throws(() => calculate(data, { build, target: null, combo: { counts: { aa: 1 }, crits: 'sometimes' as never } }), (e: unknown) => e instanceof CalcError && e.field === 'combo.crits');
});

test('attack speed: base + ratio x bonus, with level growth', () => {
  const kaisa = data.champion('Kaisa')!, b = kaisa.stats;
  const res = calculate(data, { build: { champion: 'Kaisa', level: 13, ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [3006] }, target: null, combo: {} });
  const bonus = b.attackSpeedPerLevel * growth(13) + data.item(3006)!.stats.attackSpeed!;
  near(res.stats.attackSpeed.total, b.attackSpeed + b.attackSpeedRatio * bonus, 1e-4);
});

test('Kai\'Sa Q: every missile on one target, more of them once evolved', () => {
  const q = data.champion('Kaisa')!.spells.KaisaQ!;
  const [base, unevolved, evolved, falloff, threshold] = [q.dataValues.BaseDamage![1]!, q.effects[2]![1]!, q.effects[7]![1]!, q.dataValues.ExtraHitReduction![1]!, q.effects[6]![1]!];
  const cast = (level: number, items: number[]) => calculate(data, { build: { champion: 'Kaisa', level, ranks: { q: 1, w: 0, e: 0, r: 0 }, items }, target: null, combo: { counts: { q: 1 } } });

  const plain = cast(1, []);
  near(plain.combo.total.raw, base * (1 + (unevolved - 1) * falloff));

  // enough attack damage from items alone crosses the evolution threshold
  const big = cast(1, [3031, 3072]);
  assert.ok(big.stats.ad.bonus >= threshold, 'test build should reach the evolution threshold');
  const perMissile = base + q.dataValues.BonusADRatio![1]! * big.stats.ad.bonus;
  near(big.combo.total.raw, perMissile * (1 + (evolved - 1) * falloff));
});

test('Kai\'Sa passive: plasma builds per attack and ruptures on the fifth', () => {
  const res = calculate(data, { build: { champion: 'Kaisa', level: 10, ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [] }, target: { hp: 3000, armor: 0, mr: 0 }, combo: { counts: { aa: 5 } } });
  const p = line(res, 'p');
  const plasma = p.parts.find(x => x.id === 'p/caustic')!, rupture = p.parts.find(x => x.id === 'p/rupture')!;
  assert.equal(plasma.hits, 5);
  assert.equal(rupture.hits, 1);
  assert.ok(rupture.total.raw > 0);
  const four = calculate(data, { build: { champion: 'Kaisa', level: 10, ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [] }, target: { hp: 3000, armor: 0, mr: 0 }, combo: { counts: { aa: 4 } } });
  assert.equal(line(four, 'p').parts.find(x => x.id === 'p/rupture'), undefined);
});

test('on-hit items: every third attack procs Kraken Slayer; current-health damage shrinks', () => {
  const six = calculate(data, req({ champion: 'Kaisa', ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [6672] }, { counts: { aa: 6 } }, { hp: 9000, armor: 0, mr: 0 }));
  assert.equal(line(six, 'items').parts.find(p => p.id === 'item:6672/proc')!.hits, 2);

  const botrk = calculate(data, req({ champion: 'Kaisa', ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [3153] }, { sequence: ['aa'] }, { hp: 4000, armor: 0, mr: 0 }));
  const ratio = data.item(3153)!.dataValues.RangedValue!;
  // the attack lands first, then her own on-hit, then the item reads what health is left
  near(line(botrk, 'items').total.dealt, (4000 - line(botrk, 'aa').total.dealt - line(botrk, 'p').total.dealt) * ratio);
  const none = calculate(data, req({ champion: 'Kaisa', ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [3153] }, { sequence: ['aa'] }));
  assert.equal(line(none, 'items').total.raw, 0, 'no target, no current-health damage');
});

test('damage over time: the total is dealt, and its rate and duration are reported beside it', () => {
  const r = data.champion('Renekton')!.spells.RenektonReignOfTheTyrant!;
  const seconds = r.dataValues.BuffDuration![3]!;
  const cast = (n: number, options = {}) => calculate(data, { build: { champion: 'Renekton', level: 18, ranks: { q: 5, w: 0, e: 0, r: 3 }, items: [], options }, target: null, combo: { counts: { r: n, q: 1 } } });

  const one = cast(1), aura = line(one, 'r');
  assert.equal(aura.over!.seconds, seconds);
  near(aura.over!.perSecond.raw * seconds, aura.total.raw);
  assert.deepEqual(aura.parts[0]!.over, aura.over);
  // a second cast doubles the total and the time, not the rate
  const two = line(cast(2), 'r');
  near(two.total.raw, 2 * aura.total.raw);
  assert.equal(two.over!.seconds, 2 * seconds);
  near(two.over!.perSecond.raw, aura.over!.perSecond.raw);
  // a shorter stay in the aura deals less at the same rate
  const short = line(cast(1, { auraSeconds: 4 }), 'r');
  assert.equal(short.over!.seconds, 4);
  near(short.over!.perSecond.raw, aura.over!.perSecond.raw);
  // instant damage carries no duration
  assert.equal(line(one, 'q').over, undefined);
});

test('penetration and percent stat changes from items', () => {
  const voidStaff = data.item(3135)!, cap = data.item(3089)!;
  const res = calculate(data, req({ champion: 'Kaisa', items: [3135, 3089] }, {}));
  near(res.stats.magicPenPct, voidStaff.stats.magicPenPct!, 1e-6);
  near(res.stats.ap.total, (voidStaff.stats.ap! + cap.stats.ap!) * (1 + cap.dataValues.APAmp!), 0.01);
});

test('time to kill and DPS agree with each other', () => {
  const res = calculate(data, req({ items: [3031] }, { counts: { aa: 1 } }, { hp: 2000, armor: 50, mr: 50 }));
  assert.ok(res.timeToKill !== null);
  near(res.dps.dealt * res.timeToKill!, 2000, 2);
  const unkillable = calculate(data, req({ level: 1, ranks: { q: 0, w: 0, e: 0, r: 0 } }, {}, { hp: 900000, armor: 500, mr: 500 }));
  assert.equal(unkillable.timeToKill, null);
});

test('an ability without a rank does nothing and says so', () => {
  const res = calculate(data, req({ ranks: { q: 0, w: 0, e: 0, r: 0 } }, { counts: { q: 1 } }));
  assert.equal(res.combo.total.raw, 0);
  assert.ok(res.caveats.some(c => /no rank/.test(c)));
});

test('champion as a target: base stats at level', () => {
  const ornn = data.champion('Ornn')!, t = championAsTarget(ornn, 13);
  assert.equal(t.hp, Math.round(ornn.stats.hp + ornn.stats.hpPerLevel * growth(13)));
  assert.equal(t.armor, Math.round(ornn.stats.armor + ornn.stats.armorPerLevel * growth(13)));
});

test('bad requests are rejected with the offending field', () => {
  const bad = (r: unknown, field: string) => assert.throws(() => calculate(data, r as CalcRequest), (e: unknown) => e instanceof CalcError && e.field === field);
  bad(req({ champion: 'Nobody' }, {}), 'build.champion');
  bad(req({ level: 19 }, {}), 'build.level');
  bad(req({ items: [1, 2, 3, 4, 5, 6, 7] }, {}), 'build.items');
  bad(req({ items: [999999] }, {}), 'build.items');
  bad(req({}, { counts: { aa: 500 } }), 'combo.counts.aa');
  bad(req({}, { sequence: ['x' as 'aa'] }), 'combo.sequence');
  bad(req({}, {}, { hp: -5, armor: 0, mr: 0 }), 'target.hp');
});

test('every champion computes without a crash or a NaN', () => {
  for (const c of data.index) {
    const champ = data.champion(c.id)!;
    const ranks = { q: champ.slots.q.maxRank, w: champ.slots.w.maxRank, e: champ.slots.e.maxRank, r: champ.slots.r.maxRank };
    const res = calculate(data, { build: { champion: c.id, level: 18, ranks, items: [3153, 6672, 3071] }, target: { hp: 3000, armor: 100, mr: 60 }, combo: { counts: { aa: 3, q: 1, w: 1, e: 1, r: 1 } } });
    for (const v of [res.combo.total.raw, res.combo.total.dealt, res.dps.dealt, res.stats.ad.total]) assert.ok(Number.isFinite(v) && v >= 0, `${c.id}: ${v}`);
    assert.ok(res.combo.total.dealt <= res.combo.total.raw + 0.01, `${c.id}: dealt exceeds raw`);
  }
});
