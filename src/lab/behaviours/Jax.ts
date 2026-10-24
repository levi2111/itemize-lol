/* Jax: Leap Strike is a leap onto the target. Empower is instant (the game file's 0.52 seconds is the
   empowered attack's) and resets the attack. Counter Strike lets him keep moving and attacking while he
   dodges, and strikes DodgeDuration later. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Jax', {
  reviewed: '16.20.1',
  sources: [
    'Leap Strike has no leap speed in the game data: 1500 units a second over its 700 cast range is an assumption.',
    'Counter Strike striking after DodgeDuration, or when recast, is in its tooltip.',
  ],
  actions: {
    q: { dash: { speed: 1500, distance: 700, direction: 'toward' } },
    w: { lock: 0 },
    e: { lock: 0, delay: 'DodgeDuration' },
  },
  notes: ['Counter Strike is never recast early here: it always strikes at the end of its dodge.'],
});
