/* Mel: Radiant Volley's bolts fly from her at MelQMissile1's speed (the slot spell has no projectile). Golden
   Eclipse strikes every enemy with Overwhelm, wherever they are. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Mel', {
  reviewed: '16.20.1',
  sources: ['Radiant Volley\'s bolts fly at 3800 units a second: MelQMissile1 to MelQMissile10 in the game file.'],
  actions: {
    q: { speed: 3800 },
    r: { range: 20000 },
  },
  notes: ['Radiant Volley\'s explosions land together rather than spread over its half second.'],
});
