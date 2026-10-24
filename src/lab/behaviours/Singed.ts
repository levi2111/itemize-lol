/* Singed: Poison Trail is a toggle with no cast time. The model counts one cast as the target poisoned for
   "Seconds the target is poisoned by Poison Trail", so it is toggled on again only once that time has run.
   Insanity Potion's ability power lasts its Duration, which the timeline keeps. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Singed', {
  reviewed: '16.20.1',
  actions: {
    q: { lock: 0 },
  },
  windows: [{ option: 'potion', after: 'r', for: 'Duration' }],
  hooks: {
    canStart(c) {
      if (c.action !== 'q' || c.t >= (c.state.trailUntil ?? 0) - 1e-9) return true;
      c.note('Poison Trail stays on: it is used again only when the poison it counts has run out.');
      return false;
    },
    onStart(c) {
      if (c.action === 'q') c.state.trailUntil = c.t + c.option('trailSeconds');
    },
  },
});
