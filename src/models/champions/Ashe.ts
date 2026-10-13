import { champion } from '../dsl.ts';

/* Ashe's critical strikes deal no extra damage: her crit damage starts at 1 where
   everyone else's starts at 2, so the engine's averaged attack only carries what
   items add to crit damage. Frost Shot pays the rest on every attack instead,
   scaled by crit chance, and Ranger's Focus multiplies the whole of it.

   Ranger's Focus lasts for several attacks, so it is a state rather than a hit:
   casting it in a combo turns it on, and an option does the same for damage per
   second, where nothing is cast. */
export default champion('Ashe', {
  reviewed: '16.20.1',
  vars: {
    // Frost Shot's DamageBonus, rebuilt: its "bonus crit damage" is the part from items, which for Ashe is critDamage - 1
    frost: '1 + critChance * critDamage',
  },
  options: {
    rangersFocus: { label: 'Ranger\'s Focus active', default: false },
  },
  counters: { focus: { max: 1 } },
  p: {
    rules: [
      // ad * frost, less the attack the engine already dealt at ad * (1 + critChance * (critDamage - 1))
      { id: 'frost', on: 'attack', type: 'physical', amount: 'ad * critChance' },
    ],
  },
  q: {
    hits: [{
      id: 'activate', type: 'physical', amount: 0, then: 'focus = 1',
      note: 'Casting Ranger\'s Focus empowers every later attack in the combo, with its Focus stacks taken as ready. For damage per second, set "Ranger\'s Focus active".',
    }],
    rules: [
      // EmpoweredDamage is the whole flurry in place of the attack; on-hit effects stay with the attack, once
      { id: 'flurry', on: 'attack', when: 'focus || rangersFocus', type: 'physical', amount: '(EmpoweredDamage - ad) * frost' },
    ],
    // BonusAS is in percent points; stats are settled before the fight, so only the option can grant it
    statMods: [{ stat: 'attackSpeed', value: 'BonusAS / 100', when: 'rangersFocus' }],
  },
  w: {
    // a target can catch several arrows but only the first one damages it
    hits: [{ id: 'arrow', type: 'physical', amount: 'TotalDamage' }],
  },
  // Hawkshot only grants vision
  e: {},
  r: {
    hits: [{ id: 'arrow', type: 'magic', amount: 'RMainDamage' }],
  },
});
