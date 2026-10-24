/* Smolder: Flap, Flap, Flap's bolts fly as SmolderEAttack, and MMOOOMMMM!'s fire as SmolderRMomMissile; neither
   slot spell names its projectile. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Smolder', {
  reviewed: '16.20.1',
  sources: ['The bolts fly at 2000 units a second (SmolderEAttack) and the fire at 1700 (SmolderRMomMissile), from the game file.'],
  actions: {
    e: { speed: 2000 },
    r: { speed: 1700 },
  },
  notes: [
    'All bolts of Flap, Flap, Flap land together, as the first would.',
    'MMOOOMMMM!\'s fire is drawn flying from Smolder, not from his mother behind him.',
  ],
});
