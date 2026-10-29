/* Engine tests against the compiled dataset. Expected values are derived in the
   test from the dataset's own numbers, so a balance patch does not break them;
   what they pin down is how the numbers are combined. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, championAsTarget, resolveTarget } from '../src/engine/calc.ts';
import { damageMultiplier, defaultSequence, Fight, resistAfterPen } from '../src/engine/sim.ts';
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
  // penetration of bonus resistance cuts only the bonus part: 40 base + 60 bonus at 50% is 70, then the rest as before
  near(resistAfterPen(100, 0, 0, 60, 0.5), 70, 1e-9);
  near(resistAfterPen(100, 0.35, 18, 60, 0.5), 70 * 0.65 - 18, 1e-9);
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

test('item settings: a proc counted by hand fires that many times and never on its own', () => {
  const run = (itemOptions?: Record<string, Record<string, number>>) =>
    calculate(data, req({ champion: 'Garen', ranks: { q: 5, w: 3, e: 5, r: 2 }, items: [3057], itemOptions }, { counts: { aa: 3, q: 1, e: 1 } }));
  const blade = (r: ReturnType<typeof calculate>) => r.items[0]!.effects.find(e => e.id === 'spellblade')!;
  const auto = run(), four = run({ 3057: { spellblade: 4 } }), none = run({ 3057: { spellblade: 0 } });
  assert.ok(blade(auto).fired >= 1, 'left alone, the combo sets it off');
  assert.equal(auto.items[0]!.settings.spellblade, null);
  assert.equal(blade(four).fired, 4);
  assert.equal(four.items[0]!.settings.spellblade, 4);
  assert.equal(blade(none).fired, 0);
  // one proc is the item's own calculation, base attack damage, and the line holds exactly the counted procs
  near(blade(four).one.raw, four.stats.ad.base);
  near(line(four, 'items').total.raw, 4 * four.stats.ad.base);
  assert.equal(line(none, 'items').total.raw, 0);
  // sustained damage is not the combo: a count there changes nothing
  assert.deepEqual(four.dps, none.dps);
});

test('item settings: stacks the fight starts with, an amp for abilities only, haste for basic abilities only', () => {
  const shojin = data.item(3161)!, garen = data.champion('Garen')!;
  const run = (stacks?: number) => calculate(data, req({ champion: 'Garen', ranks: { q: 5, w: 3, e: 5, r: 2 }, items: [3161], ...(stacks !== undefined && { itemOptions: { 3161: { stacks } } }) }, { counts: { aa: 1, q: 1 } }));
  const zero = run(), four = run(4);
  near(four.abilities.q.cast!.raw, zero.abilities.q.cast!.raw * (1 + 4 * shojin.dataValues.SpellDamageIncrease!));
  near(line(four, 'aa').total.raw, line(zero, 'aa').total.raw);
  assert.equal(run(99).items[0]!.settings.stacks, shojin.dataValues.StackCount, 'stacks stop at the game\'s limit');
  // Dragonforce's haste shortens Q and leaves R alone
  const cd = (s: 'q' | 'r') => garen.spells[garen.slots[s].spell]!.cooldown![s === 'q' ? 5 : 2]!;
  near(zero.abilities.q.cooldown!.seconds, cd('q') * 100 / (100 + shojin.dataValues.AHBase!));
  near(zero.abilities.r.cooldown!.seconds, cd('r'));
  assert.equal(zero.abilities.p.cast, null);
  assert.equal(run().abilities.w.cooldown!.haste, shojin.dataValues.AHBase);
});

test('item settings: an active is used at the start of the combo, as often as set, and never in sustained damage', () => {
  const run = (bolt?: number) => calculate(data, req({ champion: 'Akali', items: [3146], ...(bolt !== undefined && { itemOptions: { 3146: { bolt } } }) }, { counts: { aa: 1 } }));
  const part = (r: ReturnType<typeof calculate>) => line(r, 'items').parts.find(p => p.id === 'item:3146/bolt');
  const one = run(), none = run(0), two = run(2);
  assert.equal(part(one)!.hits, 1);
  assert.equal(part(none), undefined);
  near(part(two)!.total.raw, 2 * part(one)!.total.raw);
  assert.deepEqual(one.dps, none.dps);
});

test('an effect\'s preview is one firing on its own, not what it sets off again', () => {
  const res = calculate(data, req({ champion: 'Jax', items: [3145] }, { counts: { aa: 3, q: 1 } }));
  const revved = res.items[0]!.effects.find(e => e.id === 'revved')!, part = line(res, 'items').parts.find(p => p.id === 'item:3145/revved')!;
  near(revved.one.raw, part.total.raw / part.hits);
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

test('the fight: with no ability in the combo it is the sustained DPS and time to kill', () => {
  for (const [champion, items] of [['Samira', [3031]], ['Vayne', [3153, 3124, 3006]], ['Jinx', [3031, 6672]]] as const) {
    for (const target of [{ hp: 2400, armor: 80, mr: 50 }, { champion: 'Ornn', level: 13 }, { hp: 900000, armor: 300, mr: 300 }]) {
      const res = calculate(data, req({ champion, items: [...items] }, { counts: { aa: 3 } }, target));
      // out of reach, the two cut the last attack at the horizon a little differently
      if (res.timeToKill === null) near(res.fight.dps.dealt / res.dps.dealt, 1, 0.005);
      else near(res.fight.dps.dealt, res.dps.dealt);
      assert.equal(res.fight.timeToKill, res.timeToKill);
      assert.deepEqual(res.fight.abilities, []);
    }
  }
});

test('the fight: it lasts until the target dies, and its DPS is the target\'s health over that time', () => {
  const res = calculate(data, req({ items: [3031, 6672] }, { counts: { aa: 3, q: 1, w: 1, e: 1, r: 1 } }, { hp: 2400, armor: 80, mr: 50 }));
  assert.ok(res.fight.timeToKill !== null);
  assert.equal(res.fight.seconds, res.fight.timeToKill);
  near(res.fight.dps.dealt * res.fight.timeToKill!, 2400, 2);
  // abilities on top of the attacks kill sooner
  assert.ok(res.fight.timeToKill! < res.timeToKill!);
  // no target: a fixed window; a target out of reach: the horizon, and no time to kill
  const raw = calculate(data, req({ items: [3031] }, { counts: { aa: 3, q: 1 } }));
  assert.equal(raw.fight.seconds, 10);
  assert.equal(raw.fight.timeToKill, null);
  const wall = calculate(data, req({ items: [3031] }, { counts: { aa: 3, q: 1 } }, { hp: 900000, armor: 300, mr: 300 }));
  assert.equal(wall.fight.seconds, 60);
  assert.equal(wall.fight.timeToKill, null);
});

test('the fight: each ability comes back after its cooldown with haste, in the combo\'s order, and buffs are not cast', () => {
  // a target that never dies: the whole minute is played
  const target = { hp: 900000, armor: 0, mr: 0 };
  const ez = calculate(data, req({ champion: 'Ezreal', ranks: { q: 5, w: 1, e: 1, r: 2 }, items: [3158] }, { sequence: ['q', 'w', 'aa'] }, target));
  assert.deepEqual(ez.fight.abilities, ['q', 'w']);
  const cd = ez.abilities.q.cooldown!.seconds;
  assert.ok(ez.abilities.q.cooldown!.haste > 0);
  // cast as soon as it is ready, give or take an attack's wind-up now and then
  assert.ok(ez.fight.uses.q <= Math.ceil(60 / cd) && ez.fight.uses.q >= Math.floor(60 / (cd + 0.3)), `${ez.fight.uses.q} casts of a ${cd} s cooldown`);
  assert.equal(ez.fight.uses.e, 0, 'not in the combo');
  // Silver Bolts is a passive in W's slot and Final Hour a buff: neither is cast, Tumble is
  const vayne = calculate(data, req({ champion: 'Vayne', items: [3153] }, { counts: { aa: 3, q: 1, w: 1, r: 1 } }, target));
  assert.deepEqual(vayne.fight.abilities, ['q']);
  assert.equal(vayne.fight.uses.w + vayne.fight.uses.r, 0);
});

test('the fight: charges from the game data, and an ability without a real cooldown is cast once', () => {
  const target = { hp: 900000, armor: 0, mr: 0 };
  const velkoz = data.champion('Velkoz')!, w = velkoz.spells[velkoz.slots.w.spell]!;
  const [max, recharge] = [w.ammo!.max[5]!, w.ammo!.recharge[5]!];
  const res = calculate(data, req({ champion: 'Velkoz', ranks: { q: 1, w: 5, e: 1, r: 2 }, items: [] }, { counts: { w: 1 } }, target));
  // both charges at the start, then one each recharge
  near(res.fight.uses.w, max + Math.floor((60 - 1e-9) / recharge), 1);
  // Light Binding has no cooldown in the game data
  const lux = calculate(data, req({ champion: 'Lux', ranks: { q: 1, w: 1, e: 5, r: 2 }, items: [] }, { counts: { q: 1, e: 1 } }, target));
  assert.equal(lux.fight.uses.q, 1);
  assert.ok(lux.fight.uses.e > 3);
  assert.ok(lux.caveats.some(c => /Light Binding .* casts it once/.test(c)));
});

test('the fight: damage over time from a cast lands tick by tick on the clock', () => {
  const cass = data.champion('Cassiopeia')!, build = { champion: 'Cassiopeia', level: 13, ranks: { q: 5, w: 1, e: 1, r: 1 }, items: [] };
  const target = resolveTarget(data, { hp: 5000, armor: 0, mr: 0 });
  const f = new Fight(cass, [], build, target, { sustained: true, timed: true });
  f.time = 0;
  f.act('q');
  assert.equal(f.total.dealt, 0, 'nothing has landed yet');
  assert.ok(f.nextTick > 0 && f.nextTick < 1);
  f.landTicks(10);
  const once = calculate(data, { build, target: { hp: 5000, armor: 0, mr: 0 }, combo: {} }).abilities.q.cast!;
  near(f.total.dealt, once.dealt, 0.05);
});

test('target items: a champion\'s items add to its health, armor and magic resist, as bonus', () => {
  const thornmail = data.item(3075)!, fon = data.item(4401)!;
  const darius = data.champion('Darius')!, own = championAsTarget(darius, 13);
  const t = resolveTarget(data, { champion: 'Darius', level: 13, items: [3075, 4401, null] });
  assert.deepEqual([t.hp.base, t.armor.base, t.mr.base], [own.hp, own.armor, own.mr]);
  near(t.hp.bonus, (thornmail.stats.hp ?? 0) + (fon.stats.hp ?? 0), 1);
  near(t.armor.bonus, (thornmail.stats.armor ?? 0) + (fon.stats.armor ?? 0), 1);
  near(t.mr.bonus, (thornmail.stats.mr ?? 0) + (fon.stats.mr ?? 0), 1);
  assert.deepEqual(championAsTarget(darius, 13, [thornmail, fon]), { hp: t.hp.total, armor: t.armor.total, mr: t.mr.total });
  // the champion's own passive works on them as in any build: Ornn's Living Forge raises his bonus armor
  const ornn = resolveTarget(data, { champion: 'Ornn', level: 13, items: [3075] });
  assert.ok(ornn.armor.bonus > (thornmail.stats.armor ?? 0));
  const own2 = championAsTarget(data.champion('Ornn')!, 13);
  // totals given are still the totals; what is above the champion's own is bonus
  const given = resolveTarget(data, { champion: 'Ornn', level: 13, items: [3075], hp: own2.hp + 1000, armor: own2.armor + 100, mr: own2.mr });
  assert.deepEqual([given.hp.bonus, given.armor.bonus, given.mr.bonus], [1000, 100, 0]);
  // and they count against the attacker, with a word on what does not
  const vs = (items: number[]) => calculate(data, req({ items: [3031] }, { counts: { aa: 3 } }, { champion: 'Ornn', level: 13, items }));
  assert.ok(vs([3075]).combo.total.dealt < vs([]).combo.total.dealt);
  assert.ok(vs([3075]).caveats.some(c => /target's items/.test(c)));
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

test('the target splits into base and bonus: the dummy, a champion, plain numbers', () => {
  const split = (t: Parameters<typeof resolveTarget>[1]) => {
    const r = resolveTarget(data, t);
    return [r.hp, r.armor, r.mr].map(l => [l.base, l.bonus]);
  };
  // the practice tool's dummy: 1000 base health and no base resistances, so the rest is bonus
  assert.deepEqual(split({ dummy: true, hp: 2400, armor: 80, mr: 50 }), [[1000, 1400], [0, 80], [0, 50]]);
  // below its base it is all base
  assert.deepEqual(split({ dummy: true, hp: 600, armor: 0, mr: 0 }), [[600, 0], [0, 0], [0, 0]]);
  // a champion: its own stats are base, what is set above them bonus, and what is left out its own
  const own = championAsTarget(data.champion('Ornn')!, 13);
  assert.deepEqual(split({ champion: 'Ornn', level: 13 }), [[own.hp, 0], [own.armor, 0], [own.mr, 0]]);
  assert.deepEqual(split({ champion: 'Ornn', level: 13, hp: own.hp + 900, mr: own.mr + 40 }), [[own.hp, 900], [own.armor, 0], [own.mr, 40]]);
  // plain numbers are all base unless a bonus is given; a given bonus wins over the one that follows from the base
  assert.deepEqual(split({ hp: 2400, armor: 80, mr: 50, bonusArmor: 30 }), [[2400, 0], [50, 30], [50, 0]]);
  assert.deepEqual(split({ dummy: true, hp: 2400, armor: 80, mr: 50, bonusHp: 200 }), [[2200, 200], [0, 80], [0, 50]]);
});

test('Giant Slayer reads the dummy\'s bonus health, as in the practice tool', () => {
  const ldr = data.item(3036)!, { MaxBonusDamagePercent: pct, MaxBonusHealth: cap } = ldr.dataValues as Record<string, number>;
  const hit = (target: CalcRequest['target']) => calculate(data, req({ items: [3036] }, { counts: { aa: 1 }, crits: 'never' }, target)).combo.total.dealt;
  const plain = hit({ hp: 2400, armor: 80, mr: 50 }), dummy = hit({ dummy: true, hp: 2400, armor: 80, mr: 50 });
  // 1400 bonus health of the 1500 that maxes it
  near(dummy / plain, 1 + pct! * 1400 / cap!, 1e-4);
  near(hit({ dummy: true, hp: 5000, armor: 80, mr: 50 }) / hit({ hp: 5000, armor: 80, mr: 50 }), 1 + pct!, 1e-4);
});

test('Sett R scales with the grabbed target\'s bonus health', () => {
  const r = (bonusHp: number) => line(calculate(data, {
    build: { champion: 'Sett', level: 11, ranks: { q: 5, w: 1, e: 2, r: 2 }, items: [] }, target: { hp: 3000, armor: 0, mr: 0, bonusHp }, combo: { counts: { r: 1 } },
  }), 'r').total.raw;
  assert.ok(r(1000) > r(0));
  near(r(1000) - r(0), 2 * (r(500) - r(0)), 0.05);
});

test('bonus armor penetration works on bonus armor only: K\'Sante\'s All Out', () => {
  const pen = data.champion('KSante')!.spells.KSanteR!.dataValues.ArmorPenPercent![2]!;
  const auto = (target: CalcRequest['target']) => {
    const l = line(calculate(data, {
      build: { champion: 'KSante', level: 13, ranks: { q: 5, w: 1, e: 1, r: 2 }, items: [], options: { allOut: true } }, target, combo: { counts: { aa: 1 }, crits: 'never' },
    }), 'aa');
    return l.total.dealt / l.total.raw;
  };
  near(auto({ hp: 3000, armor: 100, mr: 0 }), 100 / 200, 1e-3);
  near(auto({ hp: 3000, armor: 100, mr: 0, bonusArmor: 100 }), 100 / (100 + 100 * (1 - pen)), 1e-3);
  near(auto({ hp: 3000, armor: 100, mr: 0, bonusArmor: 40 }), 100 / (100 + 60 + 40 * (1 - pen)), 1e-3);
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
  bad(req({}, {}, { dummy: true, armor: 0, mr: 0 }), 'target.hp');
  bad(req({}, {}, { hp: 2000, armor: 0, mr: 0, bonusHp: 2500 }), 'target.bonusHp');
  bad(req({}, {}, { hp: 2000, armor: 50, mr: 0, bonusArmor: -1 }), 'target.bonusArmor');
  bad(req({}, {}, { dummy: true, champion: 'Ornn', level: 3 }), 'target');
  bad(req({}, {}, { champion: 'Nobody', level: 3 }), 'target.champion');
  bad(req({}, {}, { champion: 'Ornn', level: 19 }), 'target.level');
  bad(req({}, {}, { dummy: true, hp: 2400, armor: 0, mr: 0, items: [3075] }), 'target.items');
  bad(req({}, {}, { champion: 'Ornn', level: 13, items: [999999] }), 'target.items');
  bad(req({}, {}, { champion: 'Ornn', level: 13, items: [3075, 3075, 3075, 3075, 3075, 3075, 3075] }), 'target.items');
  bad(req({ items: [3161], itemOptions: { 3057: { spellblade: 1 } } }, {}), 'build.itemOptions');
  bad(req({ items: [3161], itemOptions: { 3161: { nothing: 1 } } }, {}), 'build.itemOptions');
  bad(req({ items: [3161], itemOptions: { 3161: { stacks: 'four' as unknown as number } } }, {}), 'build.itemOptions');
});

test('every champion computes without a crash or a NaN', () => {
  for (const c of data.index) {
    const champ = data.champion(c.id)!;
    const ranks = { q: champ.slots.q.maxRank, w: champ.slots.w.maxRank, e: champ.slots.e.maxRank, r: champ.slots.r.maxRank };
    const res = calculate(data, { build: { champion: c.id, level: 18, ranks, items: [3153, 6672, 3071] }, target: { hp: 3000, armor: 100, mr: 60 }, combo: { counts: { aa: 3, q: 1, w: 1, e: 1, r: 1 } } });
    for (const v of [res.combo.total.raw, res.combo.total.dealt, res.dps.dealt, res.fight.dps.dealt, res.stats.ad.total]) assert.ok(Number.isFinite(v) && v >= 0, `${c.id}: ${v}`);
    assert.ok(res.fight.seconds > 0 && res.fight.seconds <= 60, `${c.id}: a fight of ${res.fight.seconds} s`);
    assert.ok(res.combo.total.dealt <= res.combo.total.raw + 0.01, `${c.id}: dealt exceeds raw`);
  }
});
