/* Sion: Decimating Smash charges for up to 2 seconds and swings as it is released, so a full charge is a 2 second
   cast (an instant release follows the model's option). Soul Furnace's detonation can be recast only
   DetonateRecastCooldown after the shield. Unstoppable Onslaught is a charge at MoveSpeedCap onto the target. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Sion', {
  reviewed: '16.20.1',
  sources: [
    'The 2 second charge is in Decimating Smash\'s tooltip; an instant release is taken as SionQDamage\'s 0.25 second cast.',
    'The smash is counted within SionQDamage\'s 350 radius (SionQ\'s own range is 10000).',
    'Unstoppable Onslaught runs up to SionR\'s 7500 range in the game file.',
  ],
  actions: {
    q: { lock: 2, range: 350, speed: 0, variants: [{ when: '!qCharged', lock: 0.25 }] },
    w: { delay: 'DetonateRecastCooldown' },
    r: { dash: { speed: 'MoveSpeedCap', distance: 7500, direction: 'toward' } },
  },
  notes: [
    'Soul Furnace is recast as soon as it can be: the detonation lands DetonateRecastCooldown after the shield.',
    'Unstoppable Onslaught runs at its top speed from the start, and its damage still follows "Unstoppable Onslaught at full charge distance".',
  ],
});
