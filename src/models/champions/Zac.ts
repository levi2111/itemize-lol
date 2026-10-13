import { champion } from '../dsl.ts';

/* Zac's formulas are one amount each. What the game data leaves to prose is how
   often they land: Stretching Strikes hits a lone target with both arms, and
   Let's Bounce! lands four times, the bounces after the first at reduced damage. */
export default champion('Zac', {
  reviewed: '16.20.1',
  // Cell Division only heals and revives
  p: {},
  q: {
    hits: [
      { id: 'strike', label: 'First strike', type: 'magic', amount: 'TotalDamage' },
      // the second arm takes the place of the next basic attack and deals the ability's damage, not an attack's.
      // against two enemies the first one takes the collision instead, for the same amount
      {
        id: 'second', label: 'Second strike', type: 'magic', amount: 'TotalDamage',
        note: 'Both strikes of Stretching Strikes are counted on the one target. The second takes the place of a basic attack: do not add an auto attack for it.',
      },
    ],
  },
  w: {
    // DisplayPercentDamage is the share of the target's maximum health, ability power included
    hits: [{ id: 'burst', type: 'magic', amount: 'BaseDamage + DisplayPercentDamage * target.maxHp' }],
  },
  e: {
    hits: [{ id: 'landing', type: 'magic', amount: 'Damage' }],
  },
  r: {
    hits: [
      { id: 'bounce', label: 'First bounce', type: 'magic', amount: 'DamagePerBounce' },
      {
        id: 'repeat', label: 'Further bounces', type: 'magic', amount: 'DamagePerSubsequentBounce',
        count: 'Bounces - 1', over: 'DurationTooltip',
        note: 'Every bounce of Let\'s Bounce! is counted on the one target.',
      },
    ],
  },
});
