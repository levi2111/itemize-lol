import { champion } from '../dsl.ts';

/* One set of abilities with a Dragon Form upgrade on each. The game data has no
   separate Dragon Form spells: the upgrades are extra calculations on the same Q
   and E. "Dragon Form" picks the form a fight starts in, and in an exact sequence
   everything after Dragon's Descent is transformed, so `r, e, q` is the breath,
   the piercing fireball with its trail, and all three strikes of Emberstrike. */
export default champion('Shyvana', {
  reviewed: '16.20.1',
  vars: {
    inDragon: 'rank.r && (dragon || descended)',
  },
  options: {
    dragon: { label: 'Dragon Form', default: false },
  },
  counters: { descended: { max: 1 } },
  // Scalemail only grants armor and magic resist
  p: {},
  q: {
    rules: [
      // the passive half: a share of the target's maximum health on every attack once Q has a rank
      { id: 'scorch', label: 'Emberstrike on-hit', on: 'onhit', type: 'magic', amount: 'Calc_Max_Health_Damage * target.maxHp' },
    ],
    hits: [
      // Calc_Damage is the whole empowered attack and the engine already counts the attack itself.
      // the tooltip states one recast; the game data has no value for the count
      {
        id: 'strikes', label: 'Empowered attack bonus', type: 'physical', amount: 'Calc_Damage - ad', count: 2,
        note: 'Emberstrike counts only what it adds to its two empowered attacks; put two basic attacks after it in the combo.',
      },
      // the third strike turns the whole attack into true damage, so it is a strike of its own rather than a bonus on top of an auto attack
      {
        id: 'bite', label: 'Dragon Form bite', when: 'inDragon', type: 'true', amount: 'Calc_Dragon_Form_Damage', appliesOnHit: true,
        note: 'In Dragon Form the bite is counted as a whole attack, on-hit effects included: do not add an auto attack for it.',
      },
    ],
    notes: ['A critical strike is counted on the attacks themselves, not on what Emberstrike adds to them.'],
  },
  w: {
    // one detonation, however it is set off; Dragon Form only adds a heal
    hits: [{ id: 'detonation', type: 'magic', amount: 'Damage' }],
  },
  e: {
    hits: [
      { id: 'fireball', when: '!inDragon', type: 'magic', amount: 'Damage + Calc_Max_Health_Damage * target.maxHp' },
      {
        id: 'pulse', label: 'Dragon Form explosion', when: 'inDragon', type: 'magic',
        amount: 'Calc_Dragon_Damage + Calc_Max_Health_Dragon_Damage * target.maxHp',
        note: 'One Dragon Form explosion of Molten Burst is counted; a second, overlapping one at reduced damage is not.',
      },
      // damage is given per second; the trail lasts GroundLingerDuration seconds
      {
        id: 'trail', label: 'Fire trail', when: 'inDragon', type: 'magic', amount: 'DamagePerSecond', count: 'GroundLingerDuration',
        over: 'GroundLingerDuration',
        note: 'In Dragon Form the target is counted as standing in Molten Burst\'s fire trail for its whole duration.',
      },
    ],
  },
  r: {
    hits: [{ id: 'breath', type: 'magic', amount: 'Damage', then: 'descended = 1' }],
    notes: ['Q and E are their Human Form versions unless "Dragon Form" is set or they come after Dragon\'s Descent in an exact sequence.'],
  },
});
