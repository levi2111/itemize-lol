/* Nami: Aqua Prison's bubble (NamiQMissile) lands a fixed time after it is thrown, however far; Ebb and Flow
   is a stream that flies to its first target (NamiWEnemy). The game data has no cooldown for Ebb and Flow: a
   single charge coming back after it, shortened by ability haste, stands in for one. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Nami', {
  reviewed: '16.20.1',
  sources: [
    'Aqua Prison lands 0.7 seconds after its release: NamiQMissile\'s missileTime in the game file.',
    'Ebb and Flow flies at 2500 units a second to an enemy: NamiWEnemy\'s missile speed in the game file.',
    'Ebb and Flow\'s 10 second cooldown is from the League Wiki; the slot spell has none in the game data.',
  ],
  actions: {
    q: { speed: 0, delay: 0.7 },
    w: { speed: 2500, charges: { count: 1, recharge: '10 * 100 / (100 + abilityHaste)' } },
  },
  notes: ['Ebb and Flow is cast straight at the target; its bounces are not drawn.'],
});
