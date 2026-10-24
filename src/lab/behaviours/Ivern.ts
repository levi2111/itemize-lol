/* Ivern: Triggerseed bursts when its shield ends, ShieldDuration after the cast (or sooner if the shield
   breaks, which a target dummy does not do). */
import { behaviour } from '../behaviour.ts';

export default behaviour('Ivern', {
  reviewed: '16.20.1',
  actions: {
    e: { delay: 'ShieldDuration' },
  },
  notes: [
    'Rootcaller\'s recast, the dash to the rooted target, is not played; Q is the vine alone.',
    'Daisy\'s attacks land when she is summoned; in the game they come over the time she fights.',
  ],
});
