/* Syndra: a Dark Sphere forms a moment after the cast (SyndraQSpell's flight), and from Q1UpgradeThreshold
   Splinters of Wrath Dark Sphere holds Upgrade1MaxAmmo charges. Force of Will is played as one action, the grab
   and the throw back to back, as the model counts its damage once. Unleashed Power's spheres fly to the target. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Syndra', {
  reviewed: '16.20.1',
  sources: [
    'The Dark Sphere forming 0.6 seconds after the cast is SyndraQSpell\'s missileTime in the game file.',
    'Force of Will\'s grab (SyndraW) and throw (SyndraWCast) each have a 0.25 second cast time in the game file.',
    'Unleashed Power\'s spheres fly at 1400 units a second: SyndraRCastTime in the game file.',
  ],
  actions: {
    q: {
      delay: 0.6,
      // the charges recharge at Dark Sphere's cooldown, as the tooltip says (AmmoRechargeTime, reduced by ability haste)
      charges: { count: 'if(splinters >= SyndraPassive.Q1UpgradeThreshold, Upgrade1MaxAmmo, 1)' },
    },
    w: { lock: 0.5 },
    r: { speed: 1400 },
  },
  notes: ['Force of Will throws what it grabs at once; holding it for up to 5 seconds is not played.'],
});
