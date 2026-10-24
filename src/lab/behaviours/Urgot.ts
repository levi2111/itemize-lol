/* Urgot: Corrosive Charge explodes ExplosionDelayPostMissile after its flight (UrgotQMissile). Purge fires for its
   duration, during which he cannot attack but can still cast. Disdain is a charge at BaseDashSpeed over its
   MinimumDashRange, started only when it reaches the target. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Urgot', {
  reviewed: '16.20.1',
  sources: ['Corrosive Charge\'s 0.2 second flight is UrgotQMissile\'s missileTime in the game file.'],
  actions: {
    q: { delay: '0.2 + ExplosionDelayPostMissile' },
    // at max rank it is a toggle: as long as the model's "Seconds Purge fires at the target"
    w: { channel: 'min(purgeSeconds, Duration)', allows: ['q', 'e', 'r'] },
    // a charge that would stop short of the target is not started: he walks in first
    e: { dash: { speed: 'BaseDashSpeed', distance: 'MinimumDashRange', direction: 'toward' }, variants: [{ beyond: 'MinimumDashRange', dash: null }] },
  },
  notes: [
    'Purge\'s shots are counted when it starts and spread over its duration.',
    'Disdain cast during Purge does not move him here; outside it the charge stops at the target.',
  ],
});
