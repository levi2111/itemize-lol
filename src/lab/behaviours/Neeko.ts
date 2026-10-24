/* Neeko: Shapesplitter's active is instant (the game file gives it no cast time). Pop Blossom crashes down
   DelayUntilReveal plus DelayUntilExplosion after it is cast: she prepares, then leaps. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Neeko', {
  reviewed: '16.20.1',
  actions: {
    w: { lock: 0 },
    r: {
      lock: 0,
      channel: 'DelayUntilReveal + DelayUntilExplosion',
      delay: 'DelayUntilReveal + DelayUntilExplosion',
      allows: ['q', 'w', 'e'],
    },
  },
  notes: ['While Pop Blossom prepares and leaps Neeko is counted as not attacking; her other abilities may still be cast. Walking during the preparation is not drawn.'],
});
