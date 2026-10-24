/* In the model each W is one Sand Soldier attack. When Azir attacks near a soldier the soldiers stab instead
   (Arise!'s tooltip), so a W is one of his attacks: it waits on his attack timer and starts the next period,
   with no cooldown of its own. A soldier only strikes while it stays within SoldierDeactivationRange of
   Azir, which is taken as the attack's reach (the summon spell's 2500 is not a reach). Conquering Sands'
   soldiers travel at SoldierDashSpeed, and Shifting Sands is a dash at DashSpeed over up to CastRange. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Azir', {
  reviewed: '16.20.1',
  sources: ['A soldier attack has no cooldown: AzirW\'s 1.5 seconds in the game file are the time between summons, not between stabs.'],
  actions: {
    q: { speed: 'SoldierDashSpeed' },
    w: { range: 'AzirPassive.SoldierDeactivationRange', asAttack: true, cooldown: 0 },
    e: { lock: 0, dash: { speed: 'DashSpeed', distance: 'CastRange', direction: 'toward' } },
  },
  notes: [
    'A soldier attack (W) is taken to find a Sand Soldier already standing by the target: summoning them is not drawn, and the stab keeps the summon\'s cast time as its windup.',
    'Conquering Sands\' soldiers are taken to start from Azir.',
  ],
});
