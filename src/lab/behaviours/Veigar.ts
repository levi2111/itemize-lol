/* Veigar: Baleful Strike flies as VeigarBalefulStrikeMis, which the slot spell (range 10000) does not name. Dark
   Matter falls ImpactDelay after the cast, its cooldown being its BaseCooldown (the spell's own is 0), and Event
   Horizon's cage forms CageDelay after it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Veigar', {
  reviewed: '16.20.1',
  sources: ['Baleful Strike flies 1050 at 2200 units a second: VeigarBalefulStrikeMis in the game file.'],
  actions: {
    q: { range: 1050, speed: 2200 },
    // the game data gives Dark Matter no cooldown of its own: it is BaseCooldown, cut by Phenomenal Evil stacks
    // and ability haste. One charge coming back after it is that cooldown
    w: {
      delay: 'ImpactDelay',
      charges: { count: 1, recharge: 'BaseCooldown * (1 - VeigarPassive.DarkMatterCDRIncrement * floor(evil / VeigarPassive.PStacksPerDarkMatterCDR)) * 100 / (100 + abilityHaste)' },
    },
    e: { delay: 'CageDelay' },
  },
});
