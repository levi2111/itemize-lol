import { champion } from '../dsl.ts';

/* Renata's own damage is small and plain; the structure is in Leverage. Her attack
   pays the bonus only on a target that carries no mark, further attacks refresh
   the mark, and only an ally can consume it. Alone she gets it once per fight. */
export default champion('Renata', {
  reviewed: '16.20.1',
  options: {
    allyConsumes: { label: 'An ally consumes Leverage\'s mark after every attack', default: false },
    bailout: { label: 'Bailout cast on herself', default: false },
  },
  counters: { marked: { max: 1 } },
  p: {
    rules: [
      { id: 'mark', label: 'Leverage', on: 'attack', when: 'allyConsumes || !marked', type: 'magic', amount: 'PercentAmpCalcSelf * target.maxHp', then: 'marked = 1' },
      // the ally's hit sets it off, but the amount is Renata's and scales with her ability power
      { id: 'consume', label: 'Leverage consumed by an ally', on: 'attack', when: 'allyConsumes', type: 'magic', amount: 'PercentAmpCalc * target.maxHp' },
    ],
    notes: [
      'Leverage is counted on the first attack only: later attacks refresh the mark instead of paying it again.',
      'With "An ally consumes Leverage\'s mark after every attack" set, every attack counts both her own bonus and the damage of the ally consuming the mark.',
    ],
  },
  q: {
    // the recast only damages enemies the target is thrown into, never the target itself
    hits: [{ id: 'hook', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // the bonus doubles over the buff's duration; stats are fixed for a fight, so it is one end or the other
    statMods: [{ stat: 'attackSpeed', value: 'if(sustained, FinalASCalc, ASCalc)', when: 'bailout' }],
    notes: ['With "Bailout cast on herself" set, sustained damage uses the fully ramped attack speed and a combo the starting one.'],
  },
  e: {
    // the two rockets and the missile they merge into damage an enemy once
    hits: [{ id: 'rockets', type: 'magic', amount: 'TotalDamage' }],
  },
  // Hostile Takeover only makes enemies attack each other
  r: {},
});
