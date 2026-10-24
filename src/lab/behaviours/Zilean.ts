/* Zilean: Time Bomb is thrown (ZileanQMissile's 0.45 second flight) and explodes FuseDuration after it sticks.
   Rewind takes CooldownReduction off Time Bomb's and Time Warp's cooldowns (hook). */
import { behaviour } from '../behaviour.ts';

/** ZileanW.CooldownReduction */
const REWIND = 10;

export default behaviour('Zilean', {
  reviewed: '16.20.1',
  sources: ['The bomb\'s 0.45 second flight is ZileanQMissile\'s missile time in the game file.'],
  actions: {
    q: { speed: 0, delay: '0.45 + FuseDuration' },
    // cast on himself, wherever the target is
    w: { range: 20000 },
  },
  hooks: {
    onLand(c) {
      if (c.action !== 'w') return;
      for (const slot of ['q', 'e'] as const) c.setReadyAt(slot, Math.max(c.t, c.readyAt(slot) - REWIND));
    },
  },
  notes: ['A second Time Bomb on the target sets the first off at once; here each bomb waits its own fuse.'],
});
