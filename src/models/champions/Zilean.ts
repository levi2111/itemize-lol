import { champion } from '../dsl.ts';

export default champion('Zilean', {
  reviewed: '16.20.1',
  // Time In A Bottle only stores and hands out experience
  p: {},
  q: {
    // a second bomb on the same target sets the first off early and still goes off itself: every cast is one detonation
    hits: [{ id: 'bomb', type: 'magic', amount: 'TotalDamage', note: 'Each Time Bomb is counted as one detonation; add Q to the combo twice for the double bomb.' }],
  },
  // Rewind only reduces the cooldowns of Q and E
  w: {},
  // Time Warp only slows an enemy or speeds up an ally
  e: {},
  // Chronoshift only revives and heals an ally
  r: {},
});
