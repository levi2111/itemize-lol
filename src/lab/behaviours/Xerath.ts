/* Xerath: Arcanopulse charges from 750 to its full 1500 range, so the hold lasts as long as the target's distance
   needs (in four steps), and the beam fires XerathArcanopulse2's 0.5 second cast after the release. Eye of
   Destruction strikes DamageDelay after the cast. Rite of the Arcane roots him for its whole Duration, over which
   the model spreads the shots. */
import { behaviour } from '../behaviour.ts';

/** XerathArcanopulse2's cast in the game file: the beam fires this long after the release */
const FIRE = 0.5;
/** seconds of charge per 250 units of range past 750 (1.5 seconds from 750 to 1500) */
const STEP = 0.5;
const RADIUS = 65;

export default behaviour('Xerath', {
  reviewed: '16.20.1',
  sources: [
    'Arcanopulse\'s range: StartRangePercent of 1500 (XerathArcanopulseChargeUp\'s radius in the game file) to 1500, grown over 1.5 seconds of charge (League Wiki).',
    'The beam firing 0.5 seconds after the release is XerathArcanopulse2\'s cast time in the game file.',
  ],
  actions: {
    q: {
      range: 1500,
      lock: 3 * STEP + FIRE,
      variants: [
        { within: 750 - RADIUS, lock: FIRE },
        { within: 1000 - RADIUS, lock: STEP + FIRE },
        { within: 1250 - RADIUS, lock: 2 * STEP + FIRE },
      ],
    },
    w: { delay: 'DamageDelay' },
    r: { channel: 'Duration' },
  },
  notes: [
    'Arcanopulse is charged standing still; he can really walk, slowed, while charging.',
    'Rite of the Arcane is held for its whole Duration, as the model spreads its shots over it.',
  ],
});
