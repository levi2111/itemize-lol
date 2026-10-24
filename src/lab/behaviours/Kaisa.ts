/* Kai'Sa: Icathian Rain's missiles (KaisaQLeftMissile…) reach their targets in a fixed time. Supercharge
   charges for TotalCastTime, which shortens with attack speed, then gives its attack speed for 4 seconds,
   kept as the model's "Supercharge attack speed active"; each attack takes time off its cooldown (hook).
   Killer Instinct warps her next to a target carrying Plasma. */
import { behaviour } from '../behaviour.ts';

/** KaisaE: Effect2Amount (seconds of attack speed) and Effect4Amount (cooldown taken off per attack). */
const SUPERCHARGE = 4, PER_ATTACK = 0.5;

export default behaviour('Kaisa', {
  reviewed: '16.20.1',
  sources: [
    'Icathian Rain\'s missiles land in 0.4 seconds (KaisaQLeftMissile1 to 6, missileTime in the game file).',
    'Supercharge\'s 4 seconds of attack speed and the 0.5 seconds each attack takes off its cooldown are its tooltip\'s Effect2Amount and Effect4Amount.',
    'Killer Instinct has no dash speed in the game data: 3000 units a second is an assumption.',
  ],
  actions: {
    q: { speed: 0, delay: 0.4 },
    e: { lock: 'TotalCastTime' },
    r: { dash: { speed: 3000, distance: 'RRange', direction: 'toward' } },
  },
  windows: [{ option: 'supercharge', after: 'e', for: SUPERCHARGE }],
  hooks: {
    canStart(c) {
      if (c.action !== 'r' || c.counter('plasma') > 0) return true;
      c.note('Killer Instinct waits for Plasma on the target.');
      return false;
    },
    onLand(c) {
      if (c.action === 'aa') c.setReadyAt('e', Math.max(c.t, c.readyAt('e') - PER_ATTACK));
    },
  },
  notes: [
    'Killer Instinct ends next to the target here; in the game she picks a spot around it.',
    'Void Seeker\'s evolved cooldown refund on hitting a champion is not counted.',
  ],
});
