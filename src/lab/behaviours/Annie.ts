/* Molten Shield has no cooldown in the compiled spell, so it would be cast again at once; Data Dragon gives
   it one. A hook holds it, without ability haste. */
import { behaviour } from '../behaviour.ts';

/** AnnieE's cooldown in Data Dragon (championFull.json) */
const SHIELD_COOLDOWN = 10;

export default behaviour('Annie', {
  reviewed: '16.20.1',
  sources: ['Molten Shield\'s 10 s cooldown is Data Dragon\'s; the game file the dataset compiles has none for AnnieE.'],
  hooks: {
    canStart(c) { return c.action !== 'e' || c.t >= (c.state.shieldReady ?? 0) - 1e-9; },
    onStart(c) { if (c.action === 'e') c.state.shieldReady = c.t + SHIELD_COOLDOWN; },
  },
  notes: ['Molten Shield\'s cooldown is held at 10 seconds; ability haste does not shorten it here.'],
});
