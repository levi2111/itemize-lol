/* Varus: Piercing Arrow is drawn for a full charge unless the model's "charged" is off, then flies as
   VarusQMissile. Hail of Arrows falls a fixed time after the cast (VarusEMissile). */
import { behaviour } from '../behaviour.ts';

export default behaviour('Varus', {
  reviewed: '16.20.1',
  sources: [
    'Piercing Arrow reaching full charge after 1.25 seconds is from the League Wiki; the game data has no value for it.',
    'The arrow flies at 1900 units a second (VarusQMissile) and the hail lands 0.5 seconds after the cast (VarusEMissile\'s missileTime) in the game file.',
  ],
  actions: {
    q: { lock: 1.25, speed: 1900, variants: [{ when: '!charged', lock: 0 }] },
    e: { speed: 0, delay: 0.5 },
  },
  notes: ['A charged Piercing Arrow reaches no further than an uncharged one here (VarusQ\'s 925).'],
});
