/* Xayah: Deadly Plumage (an attack reset in the game file) lasts WAttackSpeedDuration: its attack speed and second
   blade are on for that long. Featherstorm lifts her for RAttackDelay before the Feathers fly (XayahRMissile, 1100
   units at 4000), and she stays untargetable and unable to act until RUntargetable has passed. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Xayah', {
  reviewed: '16.20.1',
  sources: ['Featherstorm\'s Feathers reach 1100: XayahRMissile\'s range in the game file (XayahR\'s 450 is her leap).'],
  actions: {
    // plumageTimed stops the model keeping the second blade on for the rest of the fight
    w: { variants: [{ options: { plumageTimed: 1 } }] },
    r: { lock: 'RAttackDelay', range: 1100, channel: 'RUntargetable - RAttackDelay' },
  },
  windows: [{ option: 'deadlyPlumage', after: 'w', for: 'WAttackSpeedDuration' }],
  notes: [
    'Double Daggers\' cast shortened by attack speed is not played: its game-file cast of 0.25 seconds is used.',
    'Bladecaller\'s Feathers are timed as flying from Xayah to the target.',
  ],
});
