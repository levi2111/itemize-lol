import { champion } from '../dsl.ts';

/* A straightforward kit: every ability is one amount on one target. The two things
   the game data leaves open are whether the sapling was thrown into brush, which
   doubles it and is the player's choice, and how many of Nature's Grasp's brambles
   reach one enemy. */
export default champion('Maokai', {
  reviewed: '16.20.1',
  options: {
    brush: { label: 'Sapling placed in brush', default: false },
  },
  // Sap Magic only heals
  p: {},
  q: {
    hits: [{ id: 'smash', type: 'magic', amount: 'TotalDamage + BasePercentHealth * target.maxHp' }],
  },
  w: {
    hits: [{ id: 'advance', type: 'magic', amount: 'TotalDamage' }],
  },
  e: {
    hits: [
      { id: 'sapling', type: 'magic', amount: 'TotalDamage', when: '!brush' },
      // the calculation is the total over EmpoweredDoTDuration; the game data has no value for the number of bursts
      {
        id: 'brushSapling', label: 'Sapling from brush', type: 'magic', amount: 'TotalEmpoweredDamage', when: 'brush',
        over: 'EmpoweredDoTDuration',
        note: 'With "Sapling placed in brush" set, the full duration of the larger explosion is counted.',
      },
    ],
  },
  r: {
    // the brambles advance side by side and each stops at the champion it hits, so a lone target takes one
    hits: [{ id: 'bramble', type: 'magic', amount: 'TotalDamage' }],
  },
});
