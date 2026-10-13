import { champion } from '../dsl.ts';

/* Silver Bolts is the kit: every third attack or Condemn on the same target adds
   true damage from its maximum health. The stacks are a counter, so the order of
   the combo decides which hit sets them off. */
export default champion('Vayne', {
  reviewed: '16.20.1',
  options: {
    wall: { label: 'Condemn knocks the target into terrain', default: false },
    finalHour: { label: 'Final Hour active', default: false },
  },
  counters: { silver: {} },
  // Night Hunter only grants move speed
  p: {},
  q: {
    // the bonus on top of the next attack only; the attack itself is an aa in the combo
    hits: [{ id: 'tumble', type: 'physical', amount: 'ADRatioBonus', note: 'Tumble counts only the bonus damage of the empowered attack; add the auto attack to the combo.' }],
  },
  w: {
    rules: [
      { id: 'stack', on: 'onhit', type: 'true', amount: 0, then: 'silver += 1' },
      // Condemn adds a stack too; Tumble's bonus rides on an attack and adds none of its own
      { id: 'stackCondemn', on: 'spell', when: 'cast.e', type: 'true', amount: 0, then: 'silver += 1' },
      // without a target the maximum health reads 0 and the minimum damage is what counts
      { id: 'bolts', on: 'after', when: 'silver >= 3', type: 'true', amount: 'max(DamageFloor, TotalDamage * target.maxHp)', then: 'silver = 0' },
    ],
  },
  e: {
    hits: [
      { id: 'bolt', type: 'physical', amount: 'TotalDamage' },
      { id: 'wall', label: 'Condemn into terrain', type: 'physical', amount: 'EmpoweredDamageTT', when: 'wall' },
    ],
    notes: ['The terrain bonus is off unless "Condemn knocks the target into terrain" is set.'],
  },
  r: {
    statMods: [{ stat: 'ad', value: 'BonusAttackDamage', when: 'finalHour' }],
    notes: ['The attack damage is off unless "Final Hour active" is set.'],
  },
});
