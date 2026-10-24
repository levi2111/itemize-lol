/* Teemo: Move Quick is instant (the game file's half second is its animation) and needs no target. Toxic Shot has
   no active: it is on every attack. Noxious Trap holds MaxAmmo charges, arms ArmTime after it lands, and is counted
   as stepped on at once. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Teemo', {
  reviewed: '16.20.1',
  sources: ['Noxious Trap\'s charges come back every 35, 30 and 25 seconds by rank: TeemoR\'s ammoRecharge in the game file, taken as cut by ability haste.'],
  actions: {
    w: { lock: 0, range: 20000 },
    e: { requires: 0 },
    r: { delay: 'ArmTime', charges: { count: 'MaxAmmo', recharge: '(40 - 5 * rank) * 100 / (100 + abilityHaste)' } },
  },
  notes: [
    'Toxic Shot is never cast: its poison rides on his attacks.',
    'Noxious Trap is thrown under the target, which steps on it as soon as it is armed.',
  ],
});
