/* Locke: Ritual Nails readies Ammo nails, each thrown as a cast of its own (LockeQMissile, which uses his
   attack timing): one action here, locked for all the throws. Soul Ignition is instant and its attack speed
   lasts BaseDuration, which the timeline keeps. Ashen Pursuit teleports him toward the target and his next
   attack dashes the rest of the way (BonusRange): drawn as one dash within the cast. Its cooldown is on another
   spell object. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Locke', {
  reviewed: '16.20.1',
  sources: [
    'Each nail\'s throw is LockeQMissile\'s 0.25 second cast in the game file.',
    'Ashen Pursuit\'s 425 teleport is LockeE\'s cast range in the game file.',
    'Ashen Pursuit\'s cooldown, 10/9.5/9/8.5/8 seconds, is LockeEDashOut\'s in the game file: the slot spell has none.',
    'Purgatory\'s artifact lands after LockeR\'s fixed 0.5 second flight (its missileTime in the game file).',
  ],
  actions: {
    q: { lock: 'Ammo * 0.25' },
    // a self-cast with nothing to reach
    w: { range: 20000 },
    e: {
      dash: { speed: '(425 + BonusRange) / 0.175', distance: '425 + BonusRange', direction: 'toward' },
      charges: { count: 1, recharge: '(10.5 - 0.5 * rank) * 100 / (100 + abilityHaste)' },
    },
    // the game file's missile speed of 20 is not its flight: it lands after a fixed time
    r: { speed: 0 },
  },
  windows: [{ option: 'ignition', after: 'w', for: 'BaseDuration' }],
  notes: [
    'Every nail of Ritual Nails is thrown at once after the cast, and each throw takes 0.25 seconds whatever his attack speed.',
    'Ashen Pursuit\'s teleport and the dash of the attack after it are one dash, lasting the cast.',
  ],
});
