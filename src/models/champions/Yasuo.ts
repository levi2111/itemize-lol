import { champion } from '../dsl.ts';

/* Way of the Wanderer is what a build feeds: critical strike chance counts
   double, crits are a little weaker, and chance past 100% turns into attack
   damage. Steel Tempest is an attack in ability form, crit and on-hit effects
   included. Last Breath's penetration is the awkward part: it works on bonus
   armor only and for critical strikes only, and the engine averages crits. */
export default champion('Yasuo', {
  reviewed: '16.20.1',
  vars: {
    keen: 'lastBreath || time < keenUntil',
    // a basic attack or Steel Tempest, before anything it sets off: the only damage that can be a critical strike
    strike: '!struck && (cast.q || !(cast.w || cast.e || cast.r))',
  },
  options: {
    // kept up on minions; the per-target cooldown outlasts the stacks, so a lone target never sees one
    dashStacks: { label: 'Sweeping Blade stacks from earlier dashes', kind: 'int', default: 0, min: 0 },
    lastBreath: { label: 'Last Breath\'s armor penetration active', default: false },
  },
  // keenUntil: when the penetration from a Last Breath cast in this combo runs out; struck: this action has dealt damage
  counters: { keenUntil: {}, struck: { max: 1 } },
  // the Flow shield does no damage
  p: {
    statMods: [
      // a flat change reads the chance from items alone, before the doubling below; YasuoCritToAD is what a whole 100% above the cap gives
      { stat: 'ad', value: 'YasuoCritToAD * max(0, critChance * (1 + CritChanceMultiplier) - 1)' },
      { stat: 'critChance', value: 'CritChanceMultiplier', phase: 'percent' },
      // the penalty scales the whole crit, bonus crit damage from items included
      { stat: 'critDamage', value: '-(1 - CritDamageMod) * critDamage', phase: 'convert' },
    ],
  },
  // the whirlwind at two stacks and the circle during Sweeping Blade deal the same damage
  q: {
    hits: [{ id: 'thrust', type: 'physical', amount: 'TotalDamage', crit: 'TotalDamageCrit', appliesOnHit: true }],
  },
  // Wind Wall only blocks projectiles
  w: {},
  e: {
    hits: [{
      id: 'dash', type: 'magic', amount: 'TotalDamage + BonusDamagePerStack * min(dashStacks, MaxStacks)',
      note: 'Sweeping Blade has no stacks unless "Sweeping Blade stacks from earlier dashes" is set: one enemy cannot be dashed through again before they run out.',
    }],
  },
  r: {
    hits: [{ id: 'slash', type: 'physical', amount: 'Damage', then: 'keenUntil = time + RBuffDuration' }],
    rules: [
      // on-hit effects and item procs riding on a strike are not critical strikes themselves
      { id: 'struck', on: 'damage', type: 'physical', amount: 0, then: 'struck = 1' },
      { id: 'next', on: 'after', type: 'physical', amount: 0, then: 'struck = 0' },
    ],
    // crits are averaged, so the penetration follows the chance: exact at 100%, where Yasuo sits from two crit
    // items on. RPercentArmorPen is in percent points
    resists: [{ stat: 'armor', kind: 'penBonusPct', when: 'keen && strike', value: 'RPercentArmorPen / 100 * critChance' }],
    notes: [
      'Last Breath needs an airborne target, such as one hit by the whirlwind of the third Steel Tempest.',
      'The armor penetration applies to basic attacks and Steel Tempest after Last Breath is cast in the combo, or throughout with "Last Breath\'s armor penetration active". Below 100% critical strike chance it is scaled down by the chance.',
      'It works on the target\'s bonus armor only: none on the dummy\'s base armor, which is 0, or on a champion\'s own.',
    ],
  },
});
