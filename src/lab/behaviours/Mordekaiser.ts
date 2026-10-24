/* Mordekaiser: Death's Grasp's claw rises where it is aimed and pulls DelayBeforeMovement after the cast; the
   game file's MordekaiserEMissile is not a projectile he throws. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Mordekaiser', {
  reviewed: '16.20.1',
  actions: { e: { speed: 0, delay: 'DelayBeforeMovement' } },
  notes: ['Death\'s Grasp\'s pull does not move the target here.'],
});
