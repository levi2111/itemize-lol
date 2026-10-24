/* Kalista: Pierce's slot spell carries a placeholder range; the spear is KalistaMysticShotMissile, with its
   own reach and speed. Rend has no cooldown in the game file's cooldown field: its cooldown is the
   FakedCooldown value, with ability haste, played as one charge that comes back after it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Kalista', {
  reviewed: '16.20.1',
  actions: {
    q: { spell: 'KalistaMysticShotMissile' },
    e: { charges: { count: 1, recharge: 'FakedCooldown * 100 / (100 + abilityHaste)' } },
  },
  notes: [
    'Martial Poise\'s hop after each attack is not drawn.',
    'Rend\'s cooldown reset when it kills is not counted.',
  ],
});
