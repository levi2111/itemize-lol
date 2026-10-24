/* Swain: Death's Hand's bolts take SwainQDummyMissile's fixed flight; Vision of Empire strikes after its reveal;
   Nevermove's wave goes out its full length and detonates on the way back. Demonic Ascension is instant. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Swain', {
  reviewed: '16.20.1',
  sources: [
    'Death\'s Hand\'s 0.2 second flight is SwainQDummyMissile\'s missileTime in the game file.',
    'Vision of Empire striking 1.5 seconds after the cast is in its tooltip.',
    'Nevermove flies out 850 at 1125 (SwainE) and back at 2000 (SwainEReturnMissile); the return is taken to reach the target halfway back.',
  ],
  actions: {
    q: { delay: 0.2 },
    w: { delay: 1.5 },
    e: { speed: 0, delay: '850 / 1125 + 425 / 2000' },
    r: { lock: 0 },
  },
  notes: ['Nevermove\'s recast, the pull, is not played.'],
});
