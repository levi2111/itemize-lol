import { champion } from '../dsl.ts';

/* Lux's formulas are one line each. What the game data does not say is when
   Illumination pays out: damaging abilities leave a mark, a basic attack spends
   it, and Final Spark spends it and leaves a new one. The mark is a counter, so
   the order of the combo decides how many times the passive lands. */
export default champion('Lux', {
  reviewed: '16.20.1',
  counters: { mark: { max: 1 } },
  p: {
    rules: [
      { id: 'attack', label: 'Illumination', on: 'attack', when: 'mark', type: 'magic', amount: 'TotalDamage', then: 'mark = 0' },
      // Final Spark sets off a mark that is already there; its own hit then leaves the new one
      { id: 'spark', label: 'Illumination', on: 'ability', when: 'cast.r && mark', type: 'magic', amount: 'TotalDamage', then: 'mark = 0' },
    ],
    notes: ['Illumination is dealt by a basic attack after a damaging ability, and by Final Spark on a target that is already marked: the order of the combo decides how often.'],
  },
  q: {
    hits: [{ id: 'binding', type: 'magic', amount: 'TotalDamageTT', then: 'mark = 1' }],
  },
  // Prismatic Barrier only shields
  w: {},
  e: {
    hits: [{ id: 'detonation', type: 'magic', amount: 'TotalDamageTT', then: 'mark = 1' }],
  },
  r: {
    hits: [{ id: 'beam', type: 'magic', amount: 'TotalDamage', then: 'mark = 1' }],
  },
});
