import { champion } from '../dsl.ts';

/* Lucian's damage is in the weave: every ability arms Lightslinger, and the next
   basic attack fires a second shot. The game data has that shot's damage and its
   crit; that one cast arms one shot, that the shot is an attack of its own for
   on-hit effects, and that The Culling's per-shot damage lands as many times as
   its shot count says are what the model adds. */
export default champion('Lucian', {
  reviewed: '16.20.1',
  options: {
    vigilance: { label: 'Vigilance: overcharged shots stored', kind: 'int', default: 0, min: 0 },
  },
  counters: { lightslinger: { max: 1 }, overcharged: {} },
  p: {
    rules: [
      { id: 'arm', on: 'ability', type: 'physical', amount: 0, then: 'lightslinger = 1' },
      // CritDamage reads "bonus crit damage", which the engine answers with the total; the 2 takes the base every champion record has back out
      {
        id: 'second', label: 'Lightslinger second shot', on: 'attack', when: 'lightslinger', type: 'physical',
        amount: 'TotalDamage', crit: 'CritDamage - 2 * TotalDamage', appliesOnHit: true, then: 'lightslinger = 0',
      },
      // each shot spends one, the second shot included
      {
        id: 'vigilance', label: 'Vigilance', on: 'onhit', when: 'overcharged < min(vigilance, MaxAutos)', type: 'magic',
        amount: 'PassiveTotalDamage', then: 'overcharged += 1',
      },
    ],
    notes: [
      'Each ability cast arms one Lightslinger double shot and the next basic attack fires it; put an attack after each ability in the combo.',
      'Vigilance is off unless "Vigilance: overcharged shots stored" is set. Each shot spends one, Lightslinger\'s second shot included.',
    ],
  },
  q: {
    hits: [{ id: 'bolt', type: 'physical', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{ id: 'blast', type: 'magic', amount: 'TotalDamage' }],
  },
  // Relentless Pursuit is a dash; it still arms Lightslinger
  e: {},
  r: {
    // the shot count grows with crit chance and crit damage, and is not a whole number in between
    hits: [{
      id: 'shots', type: 'physical', amount: 'DamagePerBullet', count: 'TotalNumShots', over: 'Duration',
      note: 'Every shot of The Culling is counted on the one target, for the full channel.',
    }],
  },
});
