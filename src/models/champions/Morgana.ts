import { champion } from '../dsl.ts';

export default champion('Morgana', {
  reviewed: '16.20.1',
  // Soul Siphon only heals
  p: {},
  q: {
    hits: [{ id: 'binding', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // the calculations are per second; the pool ticks every TickRate seconds, and each tick
    // reads the health the last one left, between the minimum and the maximum
    hits: [{
      id: 'pool', type: 'magic',
      amount: '(TotalMinDamage + (TotalMaxDamage - TotalMinDamage) * target.missingHpPct) * TickRate',
      count: 'WDuration / TickRate',
      over: 'WDuration',
      note: 'The target is counted as standing in Tormented Shadow for its whole duration; each tick grows with the health already missing.',
    }],
  },
  // Black Shield only shields
  e: {},
  r: {
    hits: [
      { id: 'chain', type: 'magic', amount: 'TotalDamage' },
      { id: 'snap', label: 'Soul Shackles after the chain holds', type: 'magic', amount: 'TotalDamage', note: 'Both hits of Soul Shackles are counted: the target does not break the chain.' },
    ],
  },
});
