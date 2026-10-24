/* Nocturne: Duskbringer leaves a trail for TrailDuration, and Nocturne is counted on it (the model's
   "duskTrail") for that long. Shroud of Darkness is instant (the game file gives it no cast time). Paranoia's
   darkness and its recast, a dash at the target (DashSpeed), are played as one cast. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Nocturne', {
  reviewed: '16.20.1',
  sources: ['Paranoia\'s dash reaches 2500/3250/4000 by rank: NocturneParanoia\'s cast range in the game file.'],
  actions: {
    // a self-cast shield with nothing to reach: it can be cast anywhere
    w: { lock: 0, range: 20000 },
    r: { dash: { speed: 'DashSpeed', distance: '1750 + 750 * rank', direction: 'toward' } },
  },
  windows: [{ option: 'duskTrail', after: 'q', for: 'TrailDuration' }],
  notes: [
    'Nocturne is counted on the Dusk Trail for its whole duration after Duskbringer, wherever he goes.',
    'Paranoia is recast at once; the darkness before the dash is not drawn.',
  ],
});
