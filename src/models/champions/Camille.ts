import { champion } from '../dsl.ts';

/* Precision Protocol is two attacks, and the second is where a model is needed:
   past the ramp-up time its bonus doubles and a share of the whole attack, its
   attack damage included, turns into true damage. A bonus on top of the engine's
   own attack cannot say that, and neither attack can crit, so both are written as
   the strikes they are.

   The Hextech Ultimatum deals nothing itself. It is a window of a few seconds in
   which every attack hits for a share of the target's current health. */
export default champion('Camille', {
  reviewed: '16.20.1',
  vars: {
    // the game data lets the share grow on past the level where it reaches the whole attack
    converted: 'min(1, CamilleQ.DamageConversionPercentage)',
    trapped: 'time < zoneEnd || (ultimatum && time < CamilleR.RDuration)',
  },
  options: {
    outerHalf: { label: 'Tactical Sweep hits with its outer half', default: true },
    hookshot: { label: 'Hookshot attack speed active', default: false },
    ultimatum: { label: 'Fight starts inside The Hextech Ultimatum', default: false },
    // a timeline plays the two attacks as two casts; 0, the default, counts both in one
    qCast: { label: 'Precision Protocol attack counted (0 both, 1 the first, 2 the recast)', kind: 'int', default: 0, min: 0, max: 2, timeline: true },
  },
  // the time the zone of a cast Hextech Ultimatum closes
  counters: { zoneEnd: {} },
  // Adaptive Defenses only shields
  p: {},
  q: {
    hits: [
      { id: 'first', label: 'First attack', type: 'physical', amount: 'ad + BonusDamage', appliesOnHit: true, when: 'qCast != 2' },
      // the converted share lands just before the rest of the attack
      { id: 'converted', label: 'Recast attack, true damage', type: 'true', amount: '(ad + EmpoweredBonusDamage) * converted', when: 'qCast != 1' },
      // deals nothing once the whole attack is converted, and still applies on-hit effects
      { id: 'recast', label: 'Recast attack', type: 'physical', amount: '(ad + EmpoweredBonusDamage) * (1 - converted)', appliesOnHit: true, when: 'qCast != 1' },
    ],
    notes: ['One cast counts both attacks of Precision Protocol whole, on-hit effects included, the second as the empowered recast with part of it dealt as true damage. Do not add auto attacks for them.'],
  },
  w: {
    hits: [
      { id: 'sweep', type: 'physical', amount: 'BaseDamageTotal' },
      // a second instance of damage rather than more of the first
      { id: 'outer', label: 'Outer half', type: 'physical', amount: 'OuterEdgeTooltip * target.maxHp', when: 'outerHalf' },
    ],
    notes: ['Tactical Sweep is counted hitting with its outer half unless "Tactical Sweep hits with its outer half" is turned off.'],
  },
  e: {
    hits: [{ id: 'dive', type: 'physical', amount: 'TotalDamage' }],
    statMods: [{ stat: 'attackSpeed', value: 'ASBuff', when: 'hookshot' }],
    notes: ['The attack speed is off unless "Hookshot attack speed active" is set.'],
  },
  r: {
    hits: [{ id: 'zone', type: 'magic', amount: 0, then: 'zoneEnd = time + RDuration' }],
    rules: [
      // RPercentCurrentHPDamage is in percent points
      { id: 'trapped', on: 'onhit', when: 'trapped', type: 'magic', amount: 'RPercentCurrentHPDamage / 100 * target.hp' },
    ],
    notes: ['The Hextech Ultimatum deals no damage of its own: attacks made after it in the combo, until its zone closes, deal the bonus damage. Set "Fight starts inside The Hextech Ultimatum" to count the zone from the first attack instead.'],
  },
});
