/* Maokai: Twisted Advance is a dash to the target at DashSpeed (the game file gives no distance). Sapling Toss
   is lobbed on a fixed flight time (MaokaiEMissile's missileTime), not at a speed. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Maokai', {
  reviewed: '16.20.1',
  sources: ['Twisted Advance\'s 525 reach is MaokaiW\'s cast range in the game file.'],
  actions: {
    w: { dash: { speed: 'DashSpeed', distance: 525, direction: 'toward' } },
    e: { speed: 0 },
  },
  notes: [
    'The sapling is counted as exploding when it lands, on the target.',
    'Nature\'s Grasp lands at once: the game data gives the wall no usable speed.',
  ],
});
