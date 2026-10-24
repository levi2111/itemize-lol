/* In the model each W is one Sand Soldier attack. A soldier only strikes while it stays within
   SoldierDeactivationRange of Azir, which is taken as the attack's reach (the summon spell's 2500 is not a
   reach). Conquering Sands' soldiers travel at SoldierDashSpeed, and Shifting Sands is a dash at DashSpeed
   over up to CastRange. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Azir', {
  reviewed: '16.20.1',
  actions: {
    q: { speed: 'SoldierDashSpeed' },
    w: { range: 'AzirPassive.SoldierDeactivationRange' },
    e: { lock: 0, dash: { speed: 'DashSpeed', distance: 'CastRange', direction: 'toward' } },
  },
  notes: [
    'A soldier attack (W) keeps the summon\'s cast time and cooldown rather than Azir\'s attack timer, and Azir still attacks in between.',
    'Conquering Sands\' soldiers are taken to start from Azir.',
  ],
});
