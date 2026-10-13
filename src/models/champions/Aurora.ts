import { champion } from '../dsl.ts';

/* Spirit Abjuration ties the kit together: every attack and every ability hit on
   the same target is one stack, and the third exorcises it for a share of its
   maximum health. The stacks are a counter, so the order of the combo decides
   which hit sets it off. Twofold Hex is two of those hits in one cast. */
export default champion('Aurora', {
  reviewed: '16.20.1',
  counters: { spirit: {} },
  p: {
    rules: [
      { id: 'stack', on: 'attack', type: 'magic', amount: 0, then: 'spirit += 1' },
      // "3 times" is only in the tooltip's prose; a hit past the third starts the next set
      { id: 'exorcise', on: 'after', when: 'spirit >= 3', type: 'magic', amount: 'ProcDamage * target.maxHp', then: 'spirit = spirit - 3' },
    ],
  },
  q: {
    hits: [
      { id: 'hex', label: 'Curse', type: 'magic', amount: 'Damage', then: 'spirit += 1' },
      // Q2DamageMax is the recast against a target with no health left; dividing the bonus back out gives its base
      {
        id: 'recast', label: 'Recast', type: 'magic',
        amount: 'Q2DamageMax / (1 + MissingHealthPercentMod) * (1 + MissingHealthPercentMod * target.missingHpPct)',
        then: 'spirit += 1',
        note: 'The recast of Twofold Hex is counted right after the first hit, at the health the target has then; it deals more the later in the combo it is used.',
      },
    ],
  },
  // Across the Veil is a hop with invisibility and move speed
  w: {},
  e: {
    hits: [{ id: 'blast', type: 'magic', amount: 'DamageCalc', then: 'spirit += 1' }],
  },
  r: {
    // crossing the border only slows
    hits: [{ id: 'pulse', type: 'magic', amount: 'DamageCalc', then: 'spirit += 1' }],
  },
});
