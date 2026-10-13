import { champion } from '../dsl.ts';

/* Two things the game data leaves to prose: Blooming Burst blooms again on a
   champion, twice, and Shapesplitter's passive rides on every third attack, so
   it is a counter. */
export default champion('Neeko', {
  reviewed: '16.20.1',
  counters: { petals: {} },
  // Inherent Glamour only disguises her
  p: {},
  q: {
    hits: [
      { id: 'bloom', type: 'magic', amount: 'ExplosionDamage' },
      // hitting a champion makes it bloom again; the tooltip states two extra blooms, the game data has no value for the count
      { id: 'repeat', label: 'Further blooms', type: 'magic', amount: 'SecondDamage', count: 2, over: '2 * RepeatDelay', note: 'All three blooms of Blooming Burst are counted; the target has to stay in the area for the later two.' },
    ],
  },
  w: {
    // the active only makes a clone; the passive is the damage
    rules: [
      { id: 'stack', on: 'attack', type: 'magic', amount: 0, then: 'petals += 1' },
      // "every 3rd attack" is only in the tooltip's prose
      { id: 'third', label: 'Shapesplitter empowered attack', on: 'attack', when: 'petals >= 3', type: 'magic', amount: 'PassiveBonusDamageCalc', then: 'petals = 0' },
    ],
  },
  e: {
    hits: [{ id: 'tangle', type: 'magic', amount: 'BaseDamage' }],
  },
  r: {
    hits: [{ id: 'crash', type: 'magic', amount: 'TotalDamage' }],
  },
});
