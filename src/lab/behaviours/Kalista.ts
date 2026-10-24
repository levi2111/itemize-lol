/* Kalista: Rend has no cooldown in the game file's cooldown field: its cooldown is the FakedCooldown value,
   with ability haste. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Kalista', {
  reviewed: '16.20.1',
  actions: {
    e: { cooldown: 'FakedCooldown * 100 / (100 + abilityHaste)' },
  },
  notes: [
    'Martial Poise\'s hop after each attack is not drawn.',
    'Rend\'s cooldown reset when it kills is not counted.',
  ],
});
