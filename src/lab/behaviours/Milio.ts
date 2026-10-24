/* Milio: Warm Hugs holds two charges that come back one at a time (MilioE's ammo recharge, 17/16/15/14/13
   seconds); the game file's 0.5 second cooldown is only the wait between two hugs. The game file gives Ultra
   Mega Fire Kick no cooldown at all. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Milio', {
  reviewed: '16.20.1',
  sources: [
    'Two charges of Warm Hugs, from its tooltip; their recharge is MilioE\'s ammo recharge in the game file, which a formula cannot read.',
    'Ultra Mega Fire Kick\'s 12 second cooldown is from the League Wiki: MilioQ has none in the game file.',
  ],
  actions: {
    q: { charges: { count: 1, recharge: '12 * 100 / (100 + abilityHaste)' } },
    e: { charges: { count: 2, recharge: '(18 - rank) * 100 / (100 + abilityHaste)' } },
  },
  notes: ['Ultra Mega Fire Kick explodes when the ball reaches the target; its bounce before the explosion is not timed.'],
});
